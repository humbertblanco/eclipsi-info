/**
 * LES MÀSCARES DELS GENERADORS CONTRA EL MOTOR. La peça que faltava.
 *
 * ── QUÈ COMPARA AMB QUÈ, QUE ÉS L'ÚNICA PREGUNTA QUE IMPORTA ────────────────
 *
 * A l'esquerra, `computeEclipsePath` i `insideBand`: la franja de veritat, la
 * mateixa que el mapa pinta i la mateixa amb què l'script decideix si es queda
 * un mirador que ha arribat d'Overpass. A la dreta, LA MÀSCARA: els rectangles
 * que `scripts/build-viewpoints.ts` demanarà i la finestra de món que
 * `scripts/build-cloud-clim.ts` calcularà (`scripts/lib/mascares.ts`).
 *
 * La regla és una sola frase: **tot el que el motor accepta s'ha d'haver
 * demanat**. Un punt que passi `insideBand` i no caigui dins de cap rectangle és
 * un forat: allà no es preguntarà mai res, no en sortirà mai res, i el mapa
 * ensenyarà un buit que ningú no sabrà distingir d'un lloc sense miradors.
 *
 * ── PER QUÈ AQUEST FITXER EXISTEIX: DUES VEGADES LA MATEIXA FORMA ───────────
 *
 * 1. MALLORCA I EIVISSA. El darrer tram del 2026 es descartava per no tenir
 *    límit nord —allà la vora de la franja és la TAPA contra el terminador, no
 *    cap tangència— i Palma, amb 96 s de totalitat, no queia dins de cap
 *    rectangle de consulta. El catàleg de miradors es va publicar sense haver
 *    demanat mai res de les Balears. Cap prova comparava el que es demana amb el
 *    que es calcula.
 *
 * 2. EL LÍMIT SUD DE SIBÈRIA, trobat el 12-08-2026 escrivint això mateix. Les
 *    finestres dels trams es tallen recorrent la línia CENTRAL, i la vora
 *    comença abans i acaba després que ella: al 2026, el límit sud existeix des
 *    de les 16:58:16 i la central no comença fins a les 17:00:04. Aquells punts
 *    no entraven a cap tram, cap tram no en generava cel·la, i 103 sondes de dins
 *    de la franja —de 74,91°N/117,96°E a 80,00°N/121,02°E— no es demanaven mai.
 *    Als altres dos eclipsis el forat no s'arribava a obrir perquè les tapes hi
 *    queien a sobre: sort, no cap garantia. La correcció és a `bandChunks`.
 *
 * ── COM ESTÀ ESCRIT PERQUÈ NO SIGUI UN MIRALL ──────────────────────────────
 *
 * Les sondes NO són els vèrtexs que la màscara fa servir per triar cel·les. Una
 * cel·la es queda si hi cau un punt dels LÍMITS del tram o si una mostra de 5×5
 * és dins de la franja; per això aquí s'hi posen, a més dels vèrtexs, els punts
 * INTERMEDIS de cada corba, la línia CENTRAL —que no participa mai en la tria—
 * i travesses entre el límit nord i el sud del mateix instant. Si la màscara i
 * la prova fossin la mateixa cosa dita dues vegades, cap dels dos forats no
 * hauria sortit, i tots dos han sortit.
 *
 * I ES RECORRE `ECLIPSES`, NO CAP LLISTA COPIADA. Un eclipsi nou al catàleg
 * arriba aquí sol: si ningú li ha decidit la finestra de núvols, aquest fitxer es
 * posa vermell el mateix dia que s'afegeix, i no el dia que algú vulgui generar
 * les dades.
 *
 * NO ES TOCA LA XARXA NI CAP FITXER DE `public/data/`. Això prova la DECISIÓ de
 * què es demana; que el fitxer publicat quadri amb la franja ja ho prova
 * `core/places/viewpoints.test.ts`.
 */

import { describe, expect, it } from 'vitest';

import { ECLIPSES } from '../src/core/eclipses/catalog';
import { computeEclipsePath, type EclipsePath, type PathPoint } from '../src/core/eclipses/path';
import {
  BAND_LAT_LIMIT_DEG,
  bandChunks,
  bandGeometry,
  boxKey,
  chunkQueryBoxes,
  insideAnyBox,
  insideBand,
  splitAntimeridian,
  type BandBox,
  type BandGeometry,
} from '../src/core/places/viewpoints';
import { SEO_CITIES } from '../src/content/seo/cities';
import {
  CLIM_BUFFER_KM,
  CLIM_WINDOWS,
  VIEWPOINTS_CHUNK_KM,
  VIEWPOINTS_MARGIN_KM,
  VIEWPOINTS_SPAN_DEG,
  insideClimWindow,
} from '../scripts/lib/mascares';

/* --------------------------------------------------------------- bastida */

interface Point {
  lat: number;
  lon: number;
}

/** Longitud reduïda a ±180°, només per als missatges d'error. */
const readableLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;
const say = (p: Point) => `${p.lat.toFixed(3)}, ${readableLon(p.lon).toFixed(3)}`;

/**
 * Les sondes: punts de la franja que el motor dona, sense passar per la màscara.
 *
 * Tres menes, i cada una tapa un forat diferent dels que ja s'han vist:
 *
 *  · ELS VÈRTEXS de les cinc corbes, tapes incloses. Són els que la màscara
 *    també mira, i per si sols no provarien gran cosa; hi són perquè un tram
 *    sencer descartat (el cas de Palma) els deixa fora igualment.
 *  · ELS PUNTS INTERMEDIS de cada corba, a un quart, a la meitat i a tres
 *    quarts. Aquests no els ha vist mai ningú: han de caure dins d'un rectangle
 *    per geometria, no per haver-los triat.
 *  · LES TRAVESSES entre el límit nord i el límit sud del MATEIX instant, que
 *    són l'interior de la franja. Amb el Sol arran d'horitzó l'ombra és una
 *    el·lipse de centenars de km i la travessa no és perpendicular a res, però
 *    tant se val: el que se'n demana és que si el motor diu que un punt és dins
 *    de la franja, la màscara l'hagi demanat.
 */
function bandProbes(path: EclipsePath): Point[] {
  const probes: Point[] = [];
  const curves: readonly (readonly PathPoint[])[] = [
    path.center,
    path.northLimit,
    path.southLimit,
    path.startCap,
    path.endCap,
  ];

  for (const curve of curves) {
    for (let i = 0; i < curve.length; i++) {
      probes.push({ lat: curve[i].lat, lon: curve[i].lon });
      if (i === 0) continue;
      for (const t of [0.25, 0.5, 0.75]) {
        probes.push({
          lat: curve[i - 1].lat + (curve[i].lat - curve[i - 1].lat) * t,
          lon: curve[i - 1].lon + (curve[i].lon - curve[i - 1].lon) * t,
        });
      }
    }
  }

  for (const north of path.northLimit) {
    let mate: PathPoint | null = null;
    let closestMs = Infinity;
    for (const south of path.southLimit) {
      const gap = Math.abs(south.timeMs - north.timeMs);
      if (gap < closestMs) {
        closestMs = gap;
        mate = south;
      }
    }
    // Sense parella del mateix instant no hi ha travessa que valgui: dos punts
    // separats un minut són dues posicions de l'ombra, no els dos costats d'una.
    if (mate === null || closestMs > 2000) continue;
    for (let k = 1; k < 10; k++) {
      const t = k / 10;
      probes.push({
        lat: north.lat + (mate.lat - north.lat) * t,
        lon: north.lon + (mate.lon - north.lon) * t,
      });
    }
  }

  return probes;
}

/**
 * La màscara dels miradors, muntada EXACTAMENT com la munta l'script.
 *
 * Els números surten de `lib/mascares.ts` i no d'aquí: si algú els ajusta,
 * aquesta prova mira la màscara nova i no una còpia congelada de l'antiga.
 */
function queryBoxes(path: EclipsePath, band: BandGeometry): BandBox[] {
  const chunks = bandChunks(path, {
    marginKm: VIEWPOINTS_MARGIN_KM,
    chunkKm: VIEWPOINTS_CHUNK_KM,
  });
  const boxes: BandBox[] = [];
  const claimed = new Set<string>();
  for (const chunk of chunks) {
    for (const cell of chunkQueryBoxes(chunk, band, VIEWPOINTS_SPAN_DEG)) {
      for (const box of splitAntimeridian(cell)) {
        const key = boxKey(box);
        if (claimed.has(key)) continue;
        claimed.add(key);
        boxes.push(box);
      }
    }
  }
  return boxes;
}

interface Mask {
  path: EclipsePath;
  /** La franja amb el marge dels MIRADORS (20 km). */
  viewpointsBand: BandGeometry;
  /** La franja amb el marge dels NÚVOLS (50 km): la capa promet fins aquí. */
  cloudBand: BandGeometry;
  boxes: BandBox[];
}

const masks = new Map<string, Mask>();
function maskOf(eclipseId: string): Mask {
  const cached = masks.get(eclipseId);
  if (cached) return cached;
  const path = computeEclipsePath(eclipseId);
  const viewpointsBand = bandGeometry(path, VIEWPOINTS_MARGIN_KM);
  const built: Mask = {
    path,
    viewpointsBand,
    cloudBand: bandGeometry(path, CLIM_BUFFER_KM),
    boxes: queryBoxes(path, viewpointsBand),
  };
  masks.set(eclipseId, built);
  return built;
}

/* ================================================================== */
/* 1. ELS MIRADORS: CAP FORAT A LA MÀSCARA                             */
/* ================================================================== */

describe.each(ECLIPSES.map((eclipse) => eclipse.id))('la màscara de %s', (eclipseId) => {
  it('demana tot el que el motor accepta com a franja', () => {
    const { path, viewpointsBand, boxes } = maskOf(eclipseId);

    const accepted = bandProbes(path).filter(
      (probe) =>
        /*
         * L'ÚNICA EXCEPCIÓ LEGÍTIMA, i està escrita al codi que la fa: per
         * damunt de `BAND_LAT_LIMIT_DEG` no es fan trams, perquè Web Mercator ja
         * no hi dibuixa la franja i el mapa d'aquesta app no hi podria ensenyar
         * res. Allà es demana el que caigui dins de les cel·les veïnes i prou, i
         * la cobertura no es promet. Sota el límit, sí.
         */
        Math.abs(probe.lat) <= BAND_LAT_LIMIT_DEG && insideBand(probe, viewpointsBand),
    );

    // El bucle ha de córrer de debò: una franja que no acceptés res faria passar
    // aquesta prova amb zero comprovacions i sense dir-ho. Mesurat el 12-08-2026:
    // 5.470 sondes acceptades el 2026, 14.755 el 2027 i 12.709 el 2028.
    expect(accepted.length).toBeGreaterThan(1000);

    const missing = accepted.filter((probe) => !insideAnyBox(probe, boxes));
    expect(
      missing.slice(0, 12).map(say),
      `${missing.length} punts de dins de la franja de ${eclipseId} no cauen dins ` +
        `de cap dels ${boxes.length} rectangles que es demanaran`,
    ).toEqual([]);
  });

  it('no es tapa el forat demanant el món: els rectangles segueixen sent petits', () => {
    /*
     * EL CONTRAPÈS DE LA PROVA D'ABANS, i fa tanta falta com ella. Un forat de
     * cobertura es tapa en dues línies eixamplant la màscara, i la prova de dalt
     * es posaria verda mentre la generació passa de tres hores a tres dies contra
     * un servei de voluntaris. Aquí es mira el preu.
     *
     * MESURAT el 12-08-2026 amb `--dry`: 110 rectangles el 2026, 146 el 2027 i
     * 144 el 2028. La forquilla és ampla a posta —el traçat de la franja es pot
     * refinar i moure aquests números— però el sostre és real: 250 rectangles per
     * eclipsi són unes dues hores de cua d'Overpass.
     */
    const { boxes } = maskOf(eclipseId);
    expect(boxes.length).toBeGreaterThan(50);
    expect(boxes.length).toBeLessThan(250);

    const oversized = boxes.filter(
      (box) =>
        box.maxLat - box.minLat > VIEWPOINTS_SPAN_DEG + 1e-9 ||
        box.maxLon - box.minLon > VIEWPOINTS_SPAN_DEG + 1e-9,
    );
    // Un rectangle més gros que la cel·la de la malla vol dir que algú ha
    // «arreglat» la cobertura demanant-ne un de continental, i el servidor el
    // rebutjarà amb un 504 que semblarà mala sort.
    expect(oversized.map((b) => `${b.minLat},${b.minLon} → ${b.maxLat},${b.maxLon}`)).toEqual(
      [],
    );
  });

  /* ================================================================ */
  /* 2. ELS NÚVOLS: LA FINESTRA NO POT DEIXAR FORA EL QUE PROMETEM     */
  /* ================================================================ */

  it('té finestra de núvols decidida, i no per defecte', () => {
    const window = CLIM_WINDOWS[eclipseId];
    expect(
      window,
      `${eclipseId} és al catàleg i no té finestra a scripts/lib/mascares.ts: ` +
        'la graella de núvols d’aquest eclipsi no es pot generar',
    ).toBeDefined();
    if (!window) return;
    expect(window.east).toBeGreaterThan(window.west);
    expect(window.north).toBeGreaterThan(window.south);
  });

  it('la finestra de núvols conté totes les ciutats que el motor posa a la franja', () => {
    /*
     * AQUESTA ÉS LA PROVA DE MALLORCA, dita amb la llista de ciutats de la
     * pròpia app. `SEO_CITIES` són les ciutats de les quals publiquem una fitxa
     * per eclipsi: si el motor diu que una és dins de la franja (o dins dels 50
     * km que la capa promet) i la finestra no la calcula, aquella fitxa ensenya
     * un mapa de núvols amb un buit blanc justament al lloc del qual parla.
     *
     * La finestra POT retallar la franja —és deliberat, i els números del que es
     * deixa fora són a `lib/mascares.ts`—, però no per aquí.
     */
    const window = CLIM_WINDOWS[eclipseId];
    if (!window) return; // ja ho diu la prova d'abans, i més clar.
    const { cloudBand } = maskOf(eclipseId);

    const served = SEO_CITIES.filter((city) => insideBand(city, cloudBand));
    // Mesurat: 21 ciutats el 2026, 9 el 2027 i 22 el 2028. Si això es buida, el
    // que s'ha trencat és el motor o la llista, i la prova ha de cridar.
    expect(served.length).toBeGreaterThanOrEqual(5);

    const orphans = served.filter((city) => !insideClimWindow(city, window));
    expect(
      orphans.map((city) => `${city.id} (${say(city)})`),
      `${eclipseId}: hi ha ciutats a la franja que la finestra de núvols no calcula`,
    ).toEqual([]);
  });
});

/* ================================================================== */
/* 3. EL CAS QUE HI HA DARRERE DE TOT AIXÒ, ESCRIT AMB NOMS PROPIS     */
/* ================================================================== */

describe('les Balears del 12 d’agost de 2026', () => {
  /*
   * La prova general de més amunt ja cobreix això, i tot i així hi és: el dia que
   * es posi vermella, qui la llegeixi ha de saber en deu segons què s'ha trencat.
   * «103 sondes fora dels rectangles» no ho diu; «Palma no es demana», sí.
   *
   * Les coordenades són del centre de cada ciutat. Palma té 96 s de totalitat i
   * Eivissa és a la meitat sud de la franja: totes dues són dins amb marge, i no
   * hi ha cap tolerància a ajustar.
   */
  const PALMA = { lat: 39.5696, lon: 2.6502 };
  const EIVISSA = { lat: 38.9089, lon: 1.4328 };

  it('el motor les posa a la franja i la màscara les demana', () => {
    const { viewpointsBand, boxes } = maskOf('2026-08-12');

    expect(insideBand(PALMA, viewpointsBand)).toBe(true);
    expect(insideBand(EIVISSA, viewpointsBand)).toBe(true);

    expect(insideAnyBox(PALMA, boxes), 'cap rectangle no demana Mallorca').toBe(true);
    expect(insideAnyBox(EIVISSA, boxes), 'cap rectangle no demana Eivissa').toBe(true);
  });

  it('i la finestra de núvols també les calcula', () => {
    const window = CLIM_WINDOWS['2026-08-12'];
    expect(window).toBeDefined();
    if (!window) return;
    expect(insideClimWindow(PALMA, window)).toBe(true);
    expect(insideClimWindow(EIVISSA, window)).toBe(true);
  });
});
