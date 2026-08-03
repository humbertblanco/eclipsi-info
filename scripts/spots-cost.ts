/**
 * Cost real de l'embut del cercador de llocs, mesurat contra la xarxa de debò.
 *
 * Ús:  npx tsx scripts/spots-cost.ts [lloc] [radiKm] [pasKm]
 *      npx tsx scripts/spots-cost.ts soria 25 2
 *
 * ── PER QUÈ EXISTEIX ────────────────────────────────────────────────────────
 *
 * La capçalera de `src/core/spots/search.ts` afirma que l'embut baixa el cost
 * de 102.000 tessel·les a unes 90. És una afirmació comprovable i s'ha de poder
 * tornar a comprovar cada cop que algú canviï el radi, el pas de la graella o
 * els anells del garbell. Aquest script ho mesura sense simular res: baixa les
 * tessel·les de veritat d'AWS Open Data i compta els bytes que passen.
 *
 * ── COM CORRE EL CODI DEL NAVEGADOR DINS DE NODE ────────────────────────────
 *
 * `src/core/horizon/elevation.ts` descodifica les tessel·les amb
 * `createImageBitmap` i `OffscreenCanvas`, que a Node no existeixen. En comptes
 * de duplicar el mòdul —que és la manera segura de mesurar una cosa diferent de
 * la que es publica—, aquí s'implementen aquests dos globals amb un
 * descodificador de PNG mínim. El resultat és que el camí que es mesura és
 * EXACTAMENT el que corre al navegador, línia per línia.
 *
 * Les tessel·les terrarium són PNG de 8 bits, color type 2 (RGB) i sense
 * entrellaçat. El descodificador cobreix això i prou; si algun dia canvia el
 * format, peta amb un missatge clar en comptes de donar cotes inventades.
 */

import { inflateSync } from 'node:zlib';
import { STANDARD_ATMOSPHERE } from '../src/core/astro/constants';
import type { GeoLocation } from '../src/core/astro/types';
import { searchSpots } from '../src/core/spots/search';
import type { SpotSearchCost, SpotSearchStage } from '../src/core/spots/types';

/* ------------------------------------------------------- descodificador PNG */

interface DecodedImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Desfà el filtre d'una línia PNG, en el lloc. */
function unfilter(
  type: number,
  line: Uint8Array,
  previous: Uint8Array,
  bytesPerPixel: number,
): void {
  const n = line.length;
  switch (type) {
    case 0:
      return;
    case 1:
      for (let i = bytesPerPixel; i < n; i++) line[i] = (line[i] + line[i - bytesPerPixel]) & 255;
      return;
    case 2:
      for (let i = 0; i < n; i++) line[i] = (line[i] + previous[i]) & 255;
      return;
    case 3:
      for (let i = 0; i < n; i++) {
        const left = i >= bytesPerPixel ? line[i - bytesPerPixel] : 0;
        line[i] = (line[i] + ((left + previous[i]) >> 1)) & 255;
      }
      return;
    case 4:
      for (let i = 0; i < n; i++) {
        const left = i >= bytesPerPixel ? line[i - bytesPerPixel] : 0;
        const up = previous[i];
        const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] : 0;
        line[i] = (line[i] + paeth(left, up, upLeft)) & 255;
      }
      return;
    default:
      throw new Error(`Filtre PNG desconegut: ${type}`);
  }
}

function decodePng(buffer: Buffer): DecodedImage {
  const SIGNATURE = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== SIGNATURE) {
    throw new Error('Això no és un PNG');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  if (depth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(
      `PNG no suportat: profunditat ${depth}, tipus ${colorType}, entrellaçat ${interlace}`,
    );
  }

  const channels = colorType === 2 ? 3 : 4;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8ClampedArray(width * height * 4);

  let previous = new Uint8Array(stride);
  let current = new Uint8Array(stride);
  let p = 0;

  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    current.set(raw.subarray(p, p + stride));
    p += stride;
    unfilter(filter, current, previous, channels);

    for (let x = 0; x < width; x++) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      out[d] = current[s];
      out[d + 1] = current[s + 1];
      out[d + 2] = current[s + 2];
      out[d + 3] = channels === 4 ? current[s + 3] : 255;
    }

    const swap = previous;
    previous = current;
    current = swap;
  }

  return { width, height, data: out };
}

/* ------------------------------- globals del navegador que Node no porta */

interface BitmapLike {
  image: DecodedImage;
  close(): void;
}

const network = { requests: 0, bytes: 0 };

function installBrowserGlobals(): void {
  const scope = globalThis as unknown as Record<string, unknown>;

  // Es compten els bytes que passen de veritat, no els que estimem.
  const realFetch = globalThis.fetch.bind(globalThis);
  scope.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await realFetch(input, init);
    network.requests++;
    const buffer = await response.arrayBuffer();
    network.bytes += buffer.byteLength;
    // Es torna una resposta nova perquè qui crida encara pugui llegir el cos.
    return new Response(buffer, { status: response.status, headers: response.headers });
  };

  scope.createImageBitmap = async (blob: Blob): Promise<BitmapLike> => {
    const buffer = Buffer.from(await blob.arrayBuffer());
    return { image: decodePng(buffer), close: () => {} };
  };

  class FakeContext {
    private held: DecodedImage | null = null;

    drawImage(bitmap: BitmapLike): void {
      this.held = bitmap.image;
    }

    getImageData(_x: number, _y: number, width: number, height: number) {
      if (!this.held) throw new Error('No s’ha dibuixat cap imatge');
      return { data: this.held.data, width, height };
    }
  }

  class FakeOffscreenCanvas {
    getContext(kind: string): FakeContext {
      if (kind !== '2d') throw new Error(`Context no suportat: ${kind}`);
      return new FakeContext();
    }
  }

  scope.OffscreenCanvas = FakeOffscreenCanvas;
}

/* ------------------------------------------------------------------- llocs */

const PLACES: Record<string, { eclipseId: string; origin: GeoLocation }> = {
  soria: {
    eclipseId: '2026-08-12',
    origin: { lat: 41.7665, lon: -2.479, elevation: 1065 },
  },
  burgos: {
    eclipseId: '2026-08-12',
    origin: { lat: 42.3439, lon: -3.6969, elevation: 860 },
  },
  penyiscola: {
    eclipseId: '2026-08-12',
    origin: { lat: 40.3583, lon: 0.4064, elevation: 10 },
  },
  tarifa: {
    eclipseId: '2027-08-02',
    origin: { lat: 36.0143, lon: -5.6044, elevation: 20 },
  },
  murcia: {
    eclipseId: '2028-01-26',
    origin: { lat: 37.9922, lon: -1.1307, elevation: 43 },
  },
  /**
   * El pitjor cas de tots: el 26 de gener de 2028 el Sol es pon a Barcelona
   * DURANT l'anularitat. Amb el Sol arran d'horitzó, `sieveRangeKm` obre el
   * garbell fins als 90 km i el nombre de tessel·les es dispara. Si l'embut ha
   * d'aguantar en algun lloc, és aquí.
   */
  barcelona: {
    eclipseId: '2028-01-26',
    origin: { lat: 41.3874, lon: 2.1686, elevation: 12 },
  },
};

/* ------------------------------------------------------------------ sortida */

const STAGE_LABEL: Record<Exclude<SpotSearchStage, 'done'>, string> = {
  grid: 'graella',
  astro: 'A astronomia',
  tiles: 'B tessel·les',
  sieve: 'C garbell',
  refineTiles: 'D1 tessel·les fines',
  refine: 'D2 càlcul complet',
};

const num = new Intl.NumberFormat('ca-ES');

function pad(text: string, width: number, right = false): string {
  return right ? text.padStart(width) : text.padEnd(width);
}

function printCost(cost: SpotSearchCost, candidates: number): void {
  const stages = Object.keys(STAGE_LABEL) as Exclude<SpotSearchStage, 'done'>[];

  console.log('');
  console.log(
    pad('etapa', 21),
    pad('entren', 8, true),
    pad('surten', 8, true),
    pad('ms', 8, true),
    pad('efemèrides', 11, true),
    pad('mostres', 14, true),
    pad('tessel·les', 11, true),
  );
  console.log('-'.repeat(88));

  for (const stage of stages) {
    const row = cost[stage];
    console.log(
      pad(STAGE_LABEL[stage], 21),
      pad(num.format(row.entered), 8, true),
      pad(num.format(row.survived), 8, true),
      pad(num.format(Math.round(row.ms)), 8, true),
      pad(num.format(row.ephemerisCalls), 11, true),
      pad(num.format(row.terrainSamples), 14, true),
      pad(num.format(row.tiles), 11, true),
    );
  }

  const mostres = cost.sieve.terrainSamples + cost.refine.terrainSamples;
  const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  console.log('');
  console.log('candidats                ', num.format(candidates));
  console.log('temps total              ', `${(cost.totalMs / 1000).toFixed(2)} s`);
  console.log('tessel·les úniques       ', num.format(cost.uniqueTiles));
  console.log(
    'xarxa real               ',
    `${num.format(network.requests)} peticions · ${mb(network.bytes)}`,
  );
  console.log(
    'pes mitjà per tessel·la  ',
    network.requests === 0 ? '—' : `${Math.round(network.bytes / network.requests / 1024)} kB`,
  );
  console.log('');
  console.log('SI ES FES CANDIDAT A CANDIDAT');
  console.log('tessel·les               ', num.format(cost.tilesIfNaive));
  console.log(
    'xarxa estimada           ',
    mb(cost.tilesIfNaive * (network.bytes / Math.max(1, network.requests))),
  );
  console.log('mostres del terreny      ', num.format(cost.terrainSamplesIfNaive));
  console.log('');
  console.log(
    'ESTALVI                   xarxa ×' +
      (cost.tilesIfNaive / Math.max(1, cost.uniqueTiles)).toFixed(0) +
      '   terreny ×' +
      (cost.terrainSamplesIfNaive / Math.max(1, mostres)).toFixed(0),
  );
}

/* -------------------------------------------------------------------- crida */

async function main(): Promise<void> {
  installBrowserGlobals();

  const [placeArg = 'soria', radiusArg = '25', spacingArg = '2'] = process.argv.slice(2);
  const place = PLACES[placeArg];
  if (!place) {
    console.error(`Lloc desconegut: ${placeArg}. Tria un de: ${Object.keys(PLACES).join(', ')}`);
    process.exit(1);
  }

  const radiusKm = Number(radiusArg);
  const spacingKm = Number(spacingArg);

  console.log('');
  console.log(
    `COST DE L'EMBUT — ${placeArg}, eclipsi ${place.eclipseId}, radi ${radiusKm} km, pas ${spacingKm} km`,
  );

  let lastStage = '';
  const outcome = await searchSpots({
    eclipseId: place.eclipseId,
    origin: place.origin,
    radiusKm,
    spacingKm,
    atmosphere: STANDARD_ATMOSPHERE,
    onProgress: (progress) => {
      if (progress.stage === lastStage) return;
      lastStage = progress.stage;
      // El nucli ja no envia prosa: envia el codi d'etapa (vegeu
      // `core/spots/types.ts`). Aquest script mesura, no parla amb ningú, i
      // per això escriu el codi tal qual en comptes de demanar-ne la frase a
      // la capa de vista.
      console.log(`  · ${progress.stage}`);
    },
  });

  printCost(outcome.cost, outcome.candidates);

  console.log('');
  console.log('MILLORS LLOCS');
  for (const [index, spot] of outcome.results.slice(0, 5).entries()) {
    console.log(
      `${index + 1}. ${spot.lat.toFixed(5)},${spot.lon.toFixed(5)}`,
      `${spot.distanceKm.toFixed(1)} km`,
      `${Math.round(spot.elevation)} m`,
      `veus ${spot.centralVisibleSec.toFixed(1)} s de ${spot.centralTotalSec.toFixed(1)} s`,
      `marge ${spot.clearanceDeg.toFixed(2)}°`,
      `nota ${spot.score.toFixed(1)}`,
      spot.detail,
    );
  }
  console.log('');
}

void main();
