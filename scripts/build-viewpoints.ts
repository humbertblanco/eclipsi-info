/**
 * Preextracció dels miradors i cims de la franja, des d'OpenStreetMap.
 *
 * Ús:  npx tsx scripts/build-viewpoints.ts [eclipseId …] [--chunk-km=220] [--span-deg=2.4] [--reuse] [--dry]
 *      npx tsx scripts/build-viewpoints.ts 2026-08-12
 *
 * Sortida: `public/data/viewpoints-<eclipseId>.json`.
 *
 * ── COM ES CORRE: UNA ORDRE I UNA ESPERA ────────────────────────────────────
 *
 * Els tres eclipsis del catàleg, seguits, són una sola ordre i una tarda:
 *
 *     npx tsx scripts/build-viewpoints.ts
 *
 * QUÈ COSTA, mesurat amb `--dry` el 12-08-2026 (rectangles) i amb els
 * cronòmetres del 3-8-2026 (segons per rectangle):
 *
 *     2026-08-12    110 rectangles    ~45 min
 *     2027-08-02    146 rectangles    ~60 min
 *     2028-01-26    144 rectangles    ~60 min
 *     ───────────────────────────────────────
 *     els tres      400 rectangles    ~2 h 45 min
 *
 * El comptador: cada rectangle val entre 21 i 47 s de CUA d'Overpass (buit o
 * ple, tant li fa: vegeu `VIEWPOINTS_SPAN_DEG`) més la pausa d'1,5 s, i van dos
 * fils en paral·lel, un per mirall. Amb 45 s de mitjana surten uns 23 s de
 * rellotge per rectangle. La xifra ballarà: depèn de com de plens estiguin
 * aquell dia dos servidors de voluntaris, i els reintents amb espera creixent
 * poden doblar-la sense que res vagi malament.
 *
 * NO CAL VIGILAR-HO. Si un mirall cau, es passa a l'altre; si tots dos donen
 * 429 o 504, s'espera i es torna a provar fins a sis vegades. El que sí que val
 * la pena saber: el resultat cru de cada eclipsi es desa al directori temporal
 * i, si vols refer NOMÉS el criteri de rellevància, `--reuse` te'l torna a
 * escriure en mil·lisegons i sense tocar la xarxa.
 *
 * ABANS DE COMENÇAR, si vols veure què es demanarà sense demanar-ho:
 *
 *     npx tsx scripts/build-viewpoints.ts --dry
 *
 * ── LA DECISIÓ: EN TEMPS DE COMPILACIÓ, MAI EN TEMPS D'EXECUCIÓ ─────────────
 *
 * Overpass és un servei comunitari amb dos fils per IP i una cua compartida per
 * tothom. Demanar-li miradors des del telèfon de l'usuari està malament per dos
 * motius independents, i qualsevol dels dos ja bastaria:
 *
 *  1. EL DIA DE L'ECLIPSI NO HI HAURÀ COBERTURA. Cinquanta mil persones dins
 *     d'una franja de cent quilòmetres, totes mirant el mòbil el mateix quart
 *     d'hora. La llista de miradors serveix justament quan ja ets al camp
 *     decidint on plantar-te, que és exactament quan no hi ha xarxa.
 *  2. NO ÉS NOSTRE. Fer que cada instal·lació de l'app piqui a un servidor
 *     mantingut per voluntaris, el dia que a mig continent li interessa la
 *     mateixa zona, és abusar-ne.
 *
 * Per això aquí es baixa una vegada, en fred, i el resultat viatja amb l'app.
 * La competència ven «+22.000 miradors i localitats» com a funció de pagament i
 * els demana en viu; nosaltres en donem menys, però els donem sempre.
 *
 * ── COM ES DEMANA ───────────────────────────────────────────────────────────
 *
 * La franja és global (la del 2026 comença a l'Àrtic i acaba a les Balears) i
 * no es pot demanar d'una peça. `bandChunks` la talla en trams d'uns 220 km de
 * recorregut, i de cada tram `chunkQueryBoxes` en treu una malla de rectangles
 * de 2,4° retallada a la franja + 20 km de marge. Del 2026 en surten 110
 * rectangles; del 2027, 146; del 2028, 144.
 *
 * ELS TRES NÚMEROS D'AQUESTA MÀSCARA —marge, tram i costat del rectangle— viuen
 * a `scripts/lib/mascares.ts` i no aquí, i el motiu és que hi ha una prova que
 * els fa servir: aquest fitxer crida `main()` a l'última línia i importar-lo per
 * comprovar res voldria dir engegar tres hores de descàrregues. La prova
 * (`tests/mascares-dels-generadors.test.ts`) agafa els mateixos números, torna a
 * muntar la màscara i comprova contra el motor que no hi hagi cap forat a dins.
 *
 * PER QUÈ LA MALLA I NO EL RECTANGLE DEL TRAM, amb els números que ho van
 * decidir (3 d'agost de 2026, contra `overpass-api.de`): el rectangle del tram
 * 21 del 2026 —tot el nord peninsular i el sud de França— conté 26.708
 * elements i el servidor va trigar 73 segons només a COMPTAR-LOS; els dos
 * trams següents van tornar «the server is probably too busy». Amb la malla,
 * un rectangle dens dels Pirineus (42,0 −1,2 → 43,2 0,0) es resol en 43 s i
 * 577 kB. La capçalera de `chunkQueryBoxes` explica per què el rectangle d'un
 * tram és inevitablement enorme amb el Sol arran d'horitzó.
 *
 * Els rectangles són un superconjunt deliberat de la franja: baixar de més val
 * uns segons de xarxa aquí, i el retall exacte el fa `insideBandChunk`, que és
 * codi pur i té proves. Els rectangles sobre l'oceà tornen buits de seguida.
 *
 * REINTENTS. Overpass respon 429 (massa peticions) i 504 (servidor ple) amb
 * tota normalitat: no són errors, són la manera que té de dir «espera». Es
 * reintenta amb espera creixent i, si el mirall segueix caigut, es passa al
 * següent de `MIRRORS`. Mesurat el 3 d'agost de 2026 des d'aquí: només
 * `overpass-api.de` respon; `kumi.systems` i `private.coffee` esgoten 40 s
 * sense ni obrir la connexió. Es deixen escrits igualment perquè la
 * disponibilitat dels miralls canvia cada mes i el cost de tenir-los a la
 * llista és zero.
 *
 * ── ATRIBUCIÓ ───────────────────────────────────────────────────────────────
 *
 * Les dades són d'OpenStreetMap sota ODbL 1.0. L'atribució s'escriu DINS de
 * cada JSON generat (camps `attribution`, `attributionUrl`, `license`) perquè
 * no es pugui separar mai de les dades, i ha de sortir també a la interfície
 * allà on es pintin els miradors.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeEclipsePath } from '../src/core/eclipses/path';
import { ECLIPSES } from '../src/core/eclipses/catalog';
import {
  DEFAULT_RELEVANCE,
  OSM_COPYRIGHT_URL,
  OSM_LICENSE_ID,
  OSM_ODBL_ATTRIBUTION,
  bandChunks,
  bandGeometry,
  boxKey,
  chunkQueryBoxes,
  insideBand,
  selectViewpoints,
  splitAntimeridian,
  toViewpoint,
  viewpointsFileName,
} from '../src/core/places/viewpoints';
import type { BandBox, OverpassElement, Viewpoint } from '../src/core/places/viewpoints';
import {
  VIEWPOINTS_CHUNK_KM,
  VIEWPOINTS_MARGIN_KM,
  VIEWPOINTS_SPAN_DEG,
} from './lib/mascares';

/* -------------------------------------------------------------- paràmetres */

/**
 * Miralls d'Overpass entre els quals es reparteix la feina.
 *
 * TOTS DOS PROVATS AMB PLANETA SENCER el 3 d'agost de 2026 sobre el mateix
 * rectangle dens dels Pirineus (42,0 −1,2 → 43,2 0,0): 576.984 B en 43 s el
 * de Heidelberg, 576.983 B en 46 s el d'OSM-FR — un byte de diferència, que és
 * la marca de temps. No es tria el «millor»: es van alternant petició a
 * petició, que reparteix la càrrega entre dos serveis de voluntaris en comptes
 * de carregar-ne un.
 *
 * ELS QUE NO HI SÓN I PER QUÈ, perquè algú no els torni a provar a cegues:
 *  · `overpass.kumi.systems` i `overpass.private.coffee` — 40 s sense ni obrir
 *    la connexió des d'aquesta xarxa;
 *  · `overpass.osm.ch` — respon de seguida, però només porta un extracte de
 *    Suïssa: a la mateixa consulta torna 272 B on els altres en tornen 1.658;
 *  · `overpass.osm.jp` i `overpass.osm.rambler.ru` — no resolen.
 */
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

/*
 * La màscara —marge, llargada del tram i costat del rectangle— és a
 * `lib/mascares.ts`, amb el perquè de cada número i la prova que la compara amb
 * el motor. Aquí només se'n posen els àlies curts que fa servir la resta del
 * fitxer.
 */
const MARGIN_KM = VIEWPOINTS_MARGIN_KM;
const DEFAULT_CHUNK_KM = VIEWPOINTS_CHUNK_KM;
const DEFAULT_SPAN_DEG = VIEWPOINTS_SPAN_DEG;

/** Temps que se li deixa a Overpass per resoldre una consulta, en segons. */
const OVERPASS_TIMEOUT_S = 180;

/**
 * Intents per rectangle abans de donar-lo per perdut.
 *
 * Sis, i no és paranoia: el 3 d'agost de 2026 el servidor de Heidelberg
 * tornava 504 («the server is probably too busy») a la meitat de les
 * peticions, incloent-hi rectangles buits de l'Àrtic, mentre `/api/status`
 * deia que teníem els dos slots lliures. O sigui que el 504 no és el nostre
 * límit de peticions sinó la càrrega global del servei, i l'única resposta
 * raonable és esperar i tornar-hi.
 */
const MAX_ATTEMPTS = 6;

/** Espera base entre intents, en ms. Es dobla a cada intent, fins a un minut. */
const BACKOFF_MS = 5000;
const MAX_BACKOFF_MS = 60_000;

/**
 * Pausa entre rectangles consecutius, en ms.
 *
 * No és per prudència abstracta: Overpass dona dos fils per IP i, si se li
 * encadenen peticions sense respirar, contesta 429 i acabem esperant més que
 * si haguéssim anat a poc a poc des del principi.
 */
const PAUSE_MS = 1500;

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * On es desa el que ha arribat d'Overpass, ja retallat a la franja i abans de
 * cap criteri de rellevància.
 *
 * PER QUÈ EXISTEIX, i és una lliçó pagada: afinar el filtre de rellevància vol
 * dir tornar a executar l'script, i sense això tornar-lo a executar vol dir
 * demanar 9,7 MB i 44.000 elements a un servidor de voluntaris per obtenir
 * EXACTAMENT les mateixes dades. La primera vegada que va passar (la malla es
 * va passar de llarg i el fitxer va sortir a mig omplir) el preu de la
 * correcció eren vint-i-tres minuts i una altra descàrrega sencera.
 *
 * Amb `--reuse` es llegeix d'aquí i la reselecció és instantània i gratuïta
 * per a tothom. Va al directori temporal del sistema i no al repositori: són
 * dades intermèdies, no una font.
 */
const RAW_CACHE_DIR = join(tmpdir(), 'eclipsi-viewpoints');

function rawCachePath(eclipseId: string): string {
  return join(RAW_CACHE_DIR, `${eclipseId}.json`);
}

/* ------------------------------------------------------------------ la xarxa */

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/**
 * La consulta.
 *
 * Es filtra tant com es pot AL SERVIDOR, perquè el que no baixa no s'ha de
 * pagar: nom obligatori a tot, i cota obligatòria als cims (que és el filtre
 * que de debò talla — la immensa majoria de `natural=peak` amb nom i sense
 * cota són microtopònims). Els miradors es demanen també com a `way`: n'hi ha
 * de mapats com a terrassa o plataforma, i `out center` en dona el centroide.
 *
 * `qt` ordena per posició en comptes de per identificador: els elements
 * arriben agrupats geogràficament i el JSON de sortida es llegeix seguint la
 * franja.
 */
function overpassQuery(box: BandBox): string {
  const bbox = `${box.minLat.toFixed(5)},${box.minLon.toFixed(5)},${box.maxLat.toFixed(5)},${box.maxLon.toFixed(5)}`;
  return `[out:json][timeout:${OVERPASS_TIMEOUT_S}];
(
  node["tourism"="viewpoint"]["name"](${bbox});
  way["tourism"="viewpoint"]["name"](${bbox});
  node["natural"="peak"]["name"]["ele"](${bbox});
);
out center qt;`;
}

interface FetchOutcome {
  elements: OverpassElement[];
  bytes: number;
}

/**
 * Demana un rectangle, amb reintents i canvi de mirall.
 *
 * 429 i 504 no es tracten com a errors sinó com a «espera»: són la resposta
 * normal d'un servidor compartit i saturat. Un 400 sí que és un error nostre
 * (consulta mal formada) i s'atura tot: reintentar-lo és perdre el temps i
 * molestar el servidor.
 */
async function fetchBox(
  box: BandBox,
  label: string,
  preferred: number,
): Promise<FetchOutcome> {
  const body = `data=${encodeURIComponent(overpassQuery(box))}`;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Cada fil té el seu mirall i només se'n va a l'altre si el seu falla.
    const mirror = MIRRORS[(preferred + attempt) % MIRRORS.length];
    try {
      const response = await fetch(mirror, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Overpass demana identificar-se; així poden escriure'ns si molestem.
          'User-Agent': 'eclipsi.info build-viewpoints (https://eclipsi.info)',
        },
        body,
        signal: AbortSignal.timeout((OVERPASS_TIMEOUT_S + 30) * 1000),
      });

      if (response.status === 400) {
        throw new Error(
          `Overpass ha rebutjat la consulta (400) a ${label}. És un error nostre: ` +
            'revisa overpassQuery().',
        );
      }
      if (response.status === 429 || response.status === 504) {
        lastError = new Error(`${response.status} des de ${mirror}`);
      } else if (!response.ok) {
        lastError = new Error(`${response.status} ${response.statusText} des de ${mirror}`);
      } else {
        const text = await response.text();
        const parsed = JSON.parse(text) as { elements?: OverpassElement[] };
        return { elements: parsed.elements ?? [], bytes: text.length };
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.startsWith('Overpass ha rebutjat')) {
        throw error;
      }
      lastError = error;
    }

    const wait = Math.min(MAX_BACKOFF_MS, BACKOFF_MS * 2 ** attempt);
    process.stdout.write(
      `    intent ${attempt + 1}/${MAX_ATTEMPTS} fallit (${String(lastError)}), ` +
        `espero ${(wait / 1000).toFixed(0)} s\n`,
    );
    await sleep(wait);
  }

  throw new Error(`No s'ha pogut baixar ${label} de cap mirall: ${String(lastError)}`);
}

/* ------------------------------------------------------------ un eclipsi */

interface BuildOptions {
  chunkKm: number;
  /** Costat màxim de cada rectangle que es demana, en graus. */
  maxSpanDeg: number;
  dryRun: boolean;
  /** Reaprofita el que ja es va baixar en comptes de tornar-hi. */
  reuse: boolean;
}

async function buildEclipse(eclipseId: string, options: BuildOptions): Promise<void> {
  const t0 = Date.now();
  process.stdout.write(`\n── ${eclipseId} ─────────────────────────────────\n`);

  const path = computeEclipsePath(eclipseId);
  // La franja de veritat —el mateix polígon que el mapa pinta— es prepara una
  // sola vegada: és qui decideix, al final, què entra al fitxer.
  const band = bandGeometry(path, MARGIN_KM);
  const chunks = bandChunks(path, { marginKm: MARGIN_KM, chunkKm: options.chunkKm });

  const cached = options.reuse ? readRawCache(eclipseId) : null;
  if (cached !== null) {
    process.stdout.write(
      `  reaprofitant ${cached.inBand.length} llocs de ${rawCachePath(eclipseId)}\n`,
    );
    writeOutput(eclipseId, cached.inBand, cached.received, cached.valid, 0, t0);
    return;
  }

  /*
   * D'un tram en surten moltes cel·les i els trams se solapen molt, sobretot al
   * final del recorregut, on cinc trams seguits cobreixen gairebé el mateix
   * tros de Península. Com que la malla de `chunkQueryBoxes` està ancorada al
   * meridià zero, dues cel·les que es trepitgen tenen EXACTAMENT la mateixa
   * clau i es demanen una sola vegada. Mesurat el 12-08-2026: 304 cel·les
   * brutes → 110 (2026), 423 → 146 (2027), 466 → 144 (2028). Dos terços de les
   * peticions estalviats per haver ancorat una malla on tocava.
   *
   * El tram amb què es demana la cel·la ja no importa per al retall: aquest es
   * fa contra la franja SENCERA (vegeu `insideBand`).
   */
  const requests: { box: BandBox; label: string }[] = [];
  const claimed = new Set<string>();
  chunks.forEach((chunk, index) => {
    for (const cell of chunkQueryBoxes(chunk, band, options.maxSpanDeg)) {
      // L'antimeridià: cap API de rectangles no admet minLon > maxLon, i
      // demanar-lo tal qual tornaria el rectangle COMPLEMENTARI — mig món.
      for (const box of splitAntimeridian(cell)) {
        const key = boxKey(box);
        if (claimed.has(key)) continue;
        claimed.add(key);
        requests.push({ box, label: `tram ${index + 1}/${chunks.length}` });
      }
    }
  });

  process.stdout.write(
    `  franja: ${path.center.length} punts de central, ${chunks.length} trams, ` +
      `${requests.length} rectangles de ${options.maxSpanDeg}°\n`,
  );

  if (options.dryRun) {
    let previous = '';
    for (const request of requests) {
      const { box } = request;
      if (request.label !== previous) {
        process.stdout.write(`  ${request.label}\n`);
        previous = request.label;
      }
      process.stdout.write(
        `    ${box.minLat.toFixed(2)},${box.minLon.toFixed(2)} → ` +
          `${box.maxLat.toFixed(2)},${box.maxLon.toFixed(2)}\n`,
      );
    }
    return;
  }

  let received = 0;
  let downloadedBytes = 0;
  let valid = 0;
  const inBand: Viewpoint[] = [];
  const seen = new Set<string>();

  /*
   * UN FIL PER MIRALL, i ni un més.
   *
   * Overpass dona dos slots per IP i per servei. Amb un sol fil, els 290
   * rectangles del 2026 anaven a més de dues hores perquè la meitat de les
   * peticions al servidor de Heidelberg tornaven 504 i s'esperava el reintent
   * sense fer res mentrestant. Amb un fil per mirall es fa servir UN dels dos
   * slots de cada servei: es dobla el rendiment i no es puja el que cadascun
   * rep respecte del que ja acceptava.
   */
  let next = 0;
  const worker = async (preferred: number): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= requests.length) return;
      const { box, label } = requests[i];
      const outcome = await fetchBox(box, label, preferred);
      received += outcome.elements.length;
      downloadedBytes += outcome.bytes;

      let kept = 0;
      for (const element of outcome.elements) {
        const viewpoint = toViewpoint(element);
        if (viewpoint === null) continue;
        valid += 1;
        if (seen.has(viewpoint.id)) continue;
        // El retall exacte, contra la franja SENCERA: el rectangle era un
        // superconjunt a posta, i el tram que l'ha demanat no és cap polígon
        // (vegeu `insideBand`).
        if (!insideBand(viewpoint, band)) continue;
        seen.add(viewpoint.id);
        inBand.push(viewpoint);
        kept += 1;
      }

      process.stdout.write(
        `  [${i + 1}/${requests.length}] ${label}: ${outcome.elements.length} elements, ` +
          `${(outcome.bytes / 1024).toFixed(0)} kB → ${kept} dins de la franja\n`,
      );
      await sleep(PAUSE_MS);
    }
  };

  await Promise.all(MIRRORS.map((_, index) => worker(index)));

  // L'ordre de sortida no pot dependre de quin fil va acabar abans: el fitxer
  // ha de ser el mateix si es genera dues vegades. S'ordena per posició, que a
  // més el deixa llegible seguint la franja de nord a sud.
  inBand.sort((a, b) => b.lat - a.lat || a.lon - b.lon || (a.id < b.id ? -1 : 1));

  writeRawCache(eclipseId, { received, valid, inBand });
  writeOutput(eclipseId, inBand, received, valid, downloadedBytes, t0);
}

/* ------------------------------------------------------ desar i reaprofitar */

interface RawCache {
  received: number;
  valid: number;
  inBand: Viewpoint[];
}

function writeRawCache(eclipseId: string, raw: RawCache): void {
  mkdirSync(RAW_CACHE_DIR, { recursive: true });
  writeFileSync(rawCachePath(eclipseId), JSON.stringify(raw), 'utf8');
}

function readRawCache(eclipseId: string): RawCache | null {
  const target = rawCachePath(eclipseId);
  if (!existsSync(target)) return null;
  try {
    const parsed = JSON.parse(readFileSync(target, 'utf8')) as Partial<RawCache>;
    if (!Array.isArray(parsed.inBand)) return null;
    return {
      received: parsed.received ?? parsed.inBand.length,
      valid: parsed.valid ?? parsed.inBand.length,
      inBand: parsed.inBand,
    };
  } catch {
    // Una memòria cau il·legible no és cap error: es torna a baixar i prou.
    return null;
  }
}

/**
 * Aplica el criteri de rellevància i escriu el JSON que viatjarà amb l'app.
 *
 * Separat de la descàrrega justament perquè es pugui tornar a fer sol: aquest
 * tros és determinista, val mil·lisegons i no toca la xarxa.
 */
function writeOutput(
  eclipseId: string,
  inBand: readonly Viewpoint[],
  received: number,
  valid: number,
  downloadedBytes: number,
  startedAtMs: number,
): void {
  const selection = selectViewpoints(inBand, DEFAULT_RELEVANCE, { received, valid });

  const file = {
    eclipseId,
    generatedAt: new Date().toISOString(),
    attribution: OSM_ODBL_ATTRIBUTION,
    attributionUrl: OSM_COPYRIGHT_URL,
    license: OSM_LICENSE_ID,
    source: `Overpass API (${MIRRORS[0]}), tourism=viewpoint i natural=peak amb nom`,
    marginKm: MARGIN_KM,
    relevance: selection.relevance,
    count: selection.viewpoints.length,
    viewpoints: selection.viewpoints,
  };

  const target = resolve(HERE, '..', 'public', viewpointsFileName(eclipseId));
  mkdirSync(dirname(target), { recursive: true });
  // Compacte i sense sagnat: és un fitxer de dades que viatja al telèfon, no
  // un document per llegir. El sagnat hi afegiria un terç de pes per res.
  writeFileSync(target, `${JSON.stringify(file)}\n`, 'utf8');

  const bytes = statSync(target).size;
  const viewpointCount = selection.viewpoints.filter((v) => v.kind === 'viewpoint').length;
  const peakCount = selection.viewpoints.length - viewpointCount;

  process.stdout.write(
    `\n  ${target}\n` +
      `  ${received} elements rebuts (${(downloadedBytes / 1e6).toFixed(1)} MB) → ` +
      `${valid} vàlids → ${selection.stats.inBand} dins de la franja → ` +
      `${selection.stats.deduped} sense duplicats → ${selection.viewpoints.length} publicats\n` +
      `  ${viewpointCount} miradors · ${peakCount} cims · ` +
      `malla ${selection.stats.cellKm} km (${selection.stats.passes} volta/es)\n` +
      `  ${(bytes / 1024).toFixed(1)} kB · ${((Date.now() - startedAtMs) / 1000).toFixed(0)} s\n`,
  );

  if (bytes > 250 * 1024) {
    process.stdout.write(
      `  AVÍS: ${(bytes / 1024).toFixed(1)} kB passa de l'objectiu de 250 kB. ` +
        'Abaixa maxCount a DEFAULT_RELEVANCE.\n',
    );
  }
}

/* ------------------------------------------------------------------- entrada */

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry');
  const reuse = args.includes('--reuse');
  const chunkArg = args.find((a) => a.startsWith('--chunk-km='));
  const chunkKm = chunkArg ? Number(chunkArg.split('=')[1]) : DEFAULT_CHUNK_KM;
  const spanArg = args.find((a) => a.startsWith('--span-deg='));
  const maxSpanDeg = spanArg ? Number(spanArg.split('=')[1]) : DEFAULT_SPAN_DEG;
  const ids = args.filter((a) => !a.startsWith('--'));

  const known = ECLIPSES.map((eclipse) => eclipse.id);
  const targets = ids.length > 0 ? ids : known;
  for (const id of targets) {
    if (!known.includes(id)) {
      throw new Error(`L'eclipsi ${id} no és al catàleg. N'hi ha: ${known.join(', ')}`);
    }
  }

  for (const id of targets) {
    await buildEclipse(id, { chunkKm, maxSpanDeg, dryRun, reuse });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
