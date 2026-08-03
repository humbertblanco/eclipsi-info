/**
 * Validació de la franja generada contra les coordenades publicades per la NASA.
 *
 * Font de referència (baixada i transcrita literalment aquí sota):
 *   https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2026Aug12Tpath.html
 *   https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2027Aug02Tpath.html
 *   https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2028Jan26Apath.html
 *
 * "Eclipse Predictions by Fred Espenak, NASA's GSFC"
 *
 * Les files són literalment les de les taules, en graus i minuts, cada 120 s.
 * Es transcriuen tal com surten publicades i es converteixen aquí: així no hi
 * ha cap pas manual on es pugui colar un error d'arrodoniment i qualsevol pot
 * comparar-les amb la pàgina original a cop d'ull.
 *
 * Precisió de la referència: la NASA arrodoneix a 0,1 minut d'arc, o sigui
 * ±185 m. Qualsevol desviació d'aquest ordre és soroll de la taula, no error
 * nostre.
 */

import { describe, expect, it } from 'vitest';
import {
  approxDistanceKm,
  centralLineAt,
  computeEclipsePath,
  eclipsePathToGeoJson,
  pathLimitsAt,
} from './path';

/** [hora UT, límit nord, límit sud, línia central] tal com ho publica el GSFC. */
type NasaRow = [string, string, string, string];

/** Total del 12 d'agost de 2026 — trams de l'Àrtic, l'Atlàntic i l'entrada a Espanya. */
const NASA_2026: NasaRow[] = [
  ['17:10', '86 32.7N 032 43.7E', '86 08.5N 029 13.0W', '86 50.1N 001 38.3W'],
  ['17:30', '74 16.0N 023 08.7W', '73 02.6N 031 58.3W', '73 41.0N 027 47.3W'],
  ['17:44', '66 37.6N 022 26.2W', '65 42.2N 028 37.5W', '66 11.1N 025 37.8W'],
  ['17:46', '65 35.6N 022 07.2W', '64 42.6N 028 06.4W', '65 10.3N 025 12.3W'],
  ['18:00', '58 33.6N 018 56.6W', '57 56.7N 024 04.6W', '58 16.3N 021 34.4W'],
  ['18:10', '53 32.8N 015 30.2W', '53 09.1N 020 29.1W', '53 22.3N 018 03.4W'],
  ['18:20', '48 12.5N 010 16.0W', '48 08.8N 015 38.3W', '48 12.7N 013 02.9W'],
  ['18:24', '45 48.1N 007 04.6W', '45 59.0N 013 00.5W', '45 56.6N 010 11.4W'],
  ['18:26', '44 27.4N 004 56.9W', '44 49.9N 011 25.2W', '44 42.8N 008 23.9W'],
  ['18:28', '42 54.5N 002 05.1W', '43 36.4N 009 33.1W', '43 22.3N 006 11.3W'],
  ['18:30', '40 39.9N 003 17.7E', '42 15.8N 007 14.2W', '41 49.0N 003 11.1W'],
];

/** Total del 2 d'agost de 2027 — de l'Atlàntic al golf d'Aden, passant per l'Estret. */
const NASA_2027: NasaRow[] = [
  ['08:40', '36 14.4N 013 01.4W', '34 14.5N 011 57.8W', '35 14.6N 012 27.6W'],
  ['09:20', '34 42.8N 015 24.3E', '32 31.6N 014 44.8E', '33 37.1N 015 04.8E'],
  ['10:00', '27 51.4N 031 44.0E', '25 55.3N 030 18.2E', '26 53.3N 031 00.8E'],
  ['10:06', '26 34.9N 033 44.1E', '24 41.7N 032 14.2E', '25 38.3N 032 58.8E'],
  ['10:08', '26 08.7N 034 23.2E', '24 16.5N 032 52.0E', '25 12.6N 033 37.3E'],
  ['10:20', '23 24.0N 038 10.3E', '21 37.4N 036 32.6E', '22 30.8N 037 21.1E'],
  ['11:00', '12 35.4N 050 42.2E', '11 06.4N 048 51.0E', '11 51.1N 049 46.1E'],
  ['11:30', '01 43.4N 064 02.9E', '00 28.7N 061 59.1E', '01 06.5N 063 00.3E'],
];

/** Anular del 26 de gener de 2028 — de l'Equador a la península Ibèrica. */
const NASA_2028: NasaRow[] = [
  ['13:40', '02 25.3S 078 39.0W', '05 39.4S 077 25.4W', '04 03.4S 078 00.8W'],
  ['14:20', '01 29.4S 063 25.8W', '04 16.6S 062 01.9W', '02 53.8S 062 43.7W'],
  ['15:00', '03 00.6N 053 59.8W', '00 33.4N 052 22.2W', '01 46.1N 053 11.1W'],
  ['15:08', '04 12.6N 052 20.6W', '01 48.5N 050 41.1W', '02 59.7N 051 31.0W'],
  ['15:10', '04 31.5N 051 56.1W', '02 08.1N 050 16.2W', '03 19.0N 051 06.2W'],
  ['16:00', '14 35.5N 041 08.0W', '12 18.1N 039 22.2W', '13 26.0N 040 15.3W'],
  ['16:30', '23 40.6N 031 19.3W', '21 06.7N 029 42.1W', '22 22.4N 030 31.4W'],
  ['16:50', '33 32.9N 017 14.4W', '30 08.8N 016 41.4W', '31 47.4N 017 02.5W'],
];

/** Converteix "65 35.6N 022 07.2W" a graus decimals. */
function parseNasaCoord(text: string): { lat: number; lon: number } {
  const m = text.match(/^(\d+)\s+([\d.]+)([NS])\s+(\d+)\s+([\d.]+)([EW])$/);
  if (!m) throw new Error(`Coordenada NASA il·legible: ${text}`);
  const lat = (Number(m[1]) + Number(m[2]) / 60) * (m[3] === 'S' ? -1 : 1);
  const lon = (Number(m[4]) + Number(m[5]) / 60) * (m[6] === 'W' ? -1 : 1);
  return { lat, lon };
}

const utcOf = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm}:00Z`);

/**
 * Objectiu de precisió. 2 km és el que ens vam marcar; el que surt de debò és
 * un ordre de magnitud millor (vegeu el test que fixa el sostre real), i és
 * important que continuï sent-ho: la franja només serveix si distingeix un
 * poble de dins d'un poble de fora, i els límits es mouen ~1-3 km només pel
 * perfil del limbe lunar, que aquí no es modela.
 */
const TOLERANCE_KM = 2;

interface Deviation {
  label: string;
  km: number;
}

/** Compara tota una taula i retorna les desviacions, per poder-les reportar. */
function measure(eclipseId: string, date: string, rows: NasaRow[]): Deviation[] {
  const out: Deviation[] = [];
  for (const [hhmm, north, south, center] of rows) {
    const utcMs = utcOf(date, hhmm);

    const computedCenter = centralLineAt(eclipseId, utcMs);
    expect(computedCenter, `${eclipseId} ${hhmm}: sense línia central`).not.toBeNull();
    out.push({
      label: `${hhmm} central`,
      km: approxDistanceKm(parseNasaCoord(center), computedCenter!),
    });

    const limits = pathLimitsAt(eclipseId, utcMs);
    expect(limits.north, `${eclipseId} ${hhmm}: sense límit nord`).not.toBeNull();
    expect(limits.south, `${eclipseId} ${hhmm}: sense límit sud`).not.toBeNull();
    out.push({
      label: `${hhmm} nord`,
      km: approxDistanceKm(parseNasaCoord(north), limits.north!),
    });
    out.push({
      label: `${hhmm} sud`,
      km: approxDistanceKm(parseNasaCoord(south), limits.south!),
    });
  }
  return out;
}

function worst(deviations: Deviation[]): Deviation {
  return deviations.reduce((a, b) => (b.km > a.km ? b : a));
}

describe('franja de centralitat contra les taules del GSFC', () => {
  const tables: [string, string, NasaRow[]][] = [
    ['2026-08-12', '2026-08-12', NASA_2026],
    ['2027-08-02', '2027-08-02', NASA_2027],
    ['2028-01-26', '2028-01-26', NASA_2028],
  ];

  for (const [eclipseId, date, rows] of tables) {
    it(`reprodueix ${eclipseId} amb menys de ${TOLERANCE_KM} km d'error`, () => {
      const deviations = measure(eclipseId, date, rows);
      const peak = worst(deviations);
      expect(
        peak.km,
        `desviació màxima ${peak.km.toFixed(3)} km a ${peak.label}`,
      ).toBeLessThan(TOLERANCE_KM);
    });
  }

  /**
   * Sostre de regressió. Sobre les tres taules senceres (46 + 102 + 109 files)
   * el màxim és de 0,60 km i la mitjana de 0,07 km; sobre les files transcrites
   * aquí, el màxim és de 0,42 km. Si això s'enfila, algú ha tocat els elements
   * besselians, el ΔT o la geodèsia — i el test de 2 km no ho detectaria fins
   * molt tard.
   */
  it('es manté per sota dels 700 m, que és el nivell que dona el mètode', () => {
    const all = tables.flatMap(([id, date, rows]) => measure(id, date, rows));
    const peak = worst(all);
    const mean = all.reduce((sum, d) => sum + d.km, 0) / all.length;
    expect(
      peak.km,
      `màxim ${peak.km.toFixed(3)} km a ${peak.label}, mitjana ${mean.toFixed(3)} km`,
    ).toBeLessThan(0.7);
    expect(mean).toBeLessThan(0.2);
  });
});

describe('límit conegut: el primer i el darrer instant del recorregut', () => {
  /**
   * A l'instant en què l'ombra toca la Terra per primera vegada, la franja no
   * està limitada per cap tangència sinó pel limbe mateix: l'ombra hi arriba
   * completament rasant. Allà la nostra tria del punt i la del GSFC divergeixen
   * fins a un centenar de quilòmetres, i és inevitable — qualsevol punt d'un
   * tros de limbe de centenars de km compleix la condició amb la mateixa
   * legitimitat. La NASA, de fet, en alguns d'aquests instants publica un guió
   * en comptes d'una coordenada (12-08-2026 a les 18:32).
   *
   * Aquest test no valida res: fixa el comportament perquè quedi documentat i
   * perquè, si un dia algú el millora, el vegi trencar-se i actualitzi el
   * número en comptes de descobrir-ho pel mapa.
   */
  it("divergeix del GSFC al primer instant del recorregut del 2026", () => {
    const utcMs = utcOf('2026-08-12', '17:02');
    const north = pathLimitsAt('2026-08-12', utcMs).north;
    expect(north).not.toBeNull();

    const km = approxDistanceKm(parseNasaCoord('75 56.2N 108 45.5E'), north!);
    expect(km).toBeGreaterThan(10);
    expect(km, `divergència ${km.toFixed(1)} km`).toBeLessThan(150);
  });

  it('a partir del segon punt tabulat ja torna a estar dins del quilòmetre', () => {
    const utcMs = utcOf('2026-08-12', '17:04');
    const north = pathLimitsAt('2026-08-12', utcMs).north;
    const km = approxDistanceKm(parseNasaCoord('82 09.8N 103 13.0E'), north!);
    expect(km, `desviació ${km.toFixed(3)} km`).toBeLessThan(1);
  });
});

describe('punt de màxim eclipsi', () => {
  /**
   * El GSFC publica l'instant de màxim eclipsi de 2026 a 17:45:53,8 UT amb
   * l'eix de l'ombra a 65°13,5'N 25°13,7'O. És el punt més ben determinat de
   * tota la taula, i cau just al mig del tram atlàntic que ens interessa.
   */
  it("cau on diu la NASA per al 12 d'agost de 2026", () => {
    const point = centralLineAt('2026-08-12', Date.parse('2026-08-12T17:45:53.800Z'));
    expect(point).not.toBeNull();
    const km = approxDistanceKm({ lat: 65 + 13.5 / 60, lon: -(25 + 13.7 / 60) }, point!);
    expect(km, `desviació ${km.toFixed(3)} km`).toBeLessThan(0.3);
  });
});

describe('estructura de la franja generada', () => {
  it('cobreix tot el recorregut de l’ombra del 2026 i entra a la Península', () => {
    const path = computeEclipsePath('2026-08-12');

    expect(path.kind).toBe('total');
    expect(path.center.length).toBeGreaterThan(50);
    expect(path.northLimit.length).toBeGreaterThan(50);
    expect(path.southLimit.length).toBeGreaterThan(50);

    // El GSFC dona el primer i el darrer contacte de l'ombra central entre les
    // 17:02 i les 18:32 UT; els nostres extrems han de quedar-hi a prop.
    expect(path.startMs).toBeGreaterThan(Date.parse('2026-08-12T16:55:00Z'));
    expect(path.startMs).toBeLessThan(Date.parse('2026-08-12T17:05:00Z'));
    expect(path.endMs).toBeGreaterThan(Date.parse('2026-08-12T18:30:00Z'));
    expect(path.endMs).toBeLessThan(Date.parse('2026-08-12T18:40:00Z'));

    // La línia central ha de passar pel nord-oest peninsular.
    const overSpain = path.center.filter(
      (p) => p.lat > 40 && p.lat < 44 && p.lon > -9 && p.lon < 1,
    );
    expect(overSpain.length).toBeGreaterThan(0);
  });

  it('ordena els punts en el temps i no els deixa saltar', () => {
    const path = computeEclipsePath('2027-08-02', { stepSeconds: 120 });
    for (let i = 1; i < path.center.length; i++) {
      expect(path.center[i].timeMs).toBeGreaterThan(path.center[i - 1].timeMs);
    }

    // Amb pas de 120 s, al gruix del recorregut l'ombra avança uns centenars de
    // km per pas. Els dos primers i els dos darrers passos queden fora del
    // control expressament: als extrems de la franja l'ombra arriba rasant i la
    // seva velocitat sobre el terreny tendeix a infinit — allà un pas de 120 s
    // val més de 1000 km, i és correcte que ho valgui.
    const steps = path.center
      .slice(1)
      .map((p, i) => approxDistanceKm(path.center[i], p))
      .slice(2, -2);
    expect(Math.max(...steps)).toBeLessThan(500);
  });

  it('deixa la línia central entre els dos límits del 2028', () => {
    const utcMs = Date.parse('2028-01-26T16:00:00Z');
    const center = centralLineAt('2028-01-26', utcMs)!;
    const { north, south } = pathLimitsAt('2028-01-26', utcMs);
    expect(north!.lat).toBeGreaterThan(center.lat);
    expect(south!.lat).toBeLessThan(center.lat);
  });

  it('rebutja un eclipsi sense elements besselians', () => {
    expect(() => computeEclipsePath('2030-06-01')).toThrow(/elements besselians/);
  });
});

describe('exportació a GeoJSON', () => {
  it('dona una LineString per a la central i un Polygon tancat per a la franja', () => {
    const { centerLine, band } = eclipsePathToGeoJson(computeEclipsePath('2026-08-12'));

    expect(centerLine.type).toBe('Feature');
    expect(centerLine.geometry.type).toBe('LineString');
    expect(centerLine.geometry.coordinates.length).toBeGreaterThan(50);
    // Ordre GeoJSON: [longitud, latitud].
    const [lon, lat] = centerLine.geometry.coordinates[0];
    expect(Math.abs(lat)).toBeLessThanOrEqual(90);
    expect(Number.isFinite(lon)).toBe(true);

    expect(band.geometry.type).toBe('Polygon');
    const ring = band.geometry.coordinates[0];
    expect(ring.length).toBeGreaterThan(100);
    expect(ring[0]).toEqual(ring[ring.length - 1]);

    expect(band.properties.attribution).toContain('Espenak');
  });

  it('no trenca la polilínia en creuar l’antimeridià', () => {
    // El recorregut del 2026 comença a Sibèria i acaba a la Mediterrània: si les
    // longituds es reduïssin a ±180° apareixerien salts de 360° entre punts
    // consecutius, que al mapa es dibuixen com una ratlla travessant el món.
    const path = computeEclipsePath('2026-08-12');
    for (let i = 1; i < path.center.length; i++) {
      expect(Math.abs(path.center[i].lon - path.center[i - 1].lon)).toBeLessThan(180);
    }
  });
});

describe('la franja ha de ser DIBUIXABLE, no només correcta', () => {
  /*
   * EL BUG QUE VA DESTAPAR L'USUARI: «i no veus que el mapa no té la franja
   * de l'eclipsi?». La cartografia hi sortia i la banda no.
   *
   * La causa: la trajectòria del 12-08-2026 comença a Sibèria i passa PEL POL
   * abans de baixar cap a Islàndia i la Península. De 731 punts de l'anell,
   * 188 eren per damunt dels 80° de latitud i arribava als 89,1°. Web Mercator
   * —la projecció de qualsevol mapa de tessel·les— talla a ±85,05°, i la
   * latitud 90 hi queda a distància infinita: aquell polígon no és una figura
   * estirada, és una figura indefinida, i el trossejador de tessel·les no en
   * dibuixava res.
   *
   * La geometria era CORRECTA i el mapa era buit. Per això aquest test no mira
   * si els números són bons —d'això ja n'hi ha d'altres— sinó si es poden
   * pintar.
   */
  const IDS = ['2026-08-12', '2027-08-02', '2028-01-26'];

  for (const id of IDS) {
    it(`${id}: cap punt de l’anell fora del que Mercator pot projectar`, () => {
      const { band } = eclipsePathToGeoJson(computeEclipsePath(id));
      const ring = band.geometry.coordinates[0];
      expect(ring.length).toBeGreaterThan(50);
      for (const [, lat] of ring) {
        expect(Math.abs(lat)).toBeLessThanOrEqual(85);
      }
    });

    it(`${id}: la franja segueix passant per on ha de passar`, () => {
      // Retallar no pot menjar-se la part que importa. Els tres eclipsis del
      // catàleg travessen la finestra ibèrica o la seva rodalia.
      const { band, centerLine } = eclipsePathToGeoJson(computeEclipsePath(id));
      const ring = band.geometry.coordinates[0];
      const line = centerLine.geometry.coordinates;
      expect(ring.length).toBeGreaterThan(line.length / 2);
      expect(line.length).toBeGreaterThan(50);
    });
  }

  it('2026: la franja conserva els punts de la Península', () => {
    const { band } = eclipsePathToGeoJson(computeEclipsePath('2026-08-12'));
    const iberian = band.geometry.coordinates[0].filter(
      ([lon, lat]) => lon > -12 && lon < 5 && lat > 34 && lat < 45,
    );
    // Retallar el pol no en pot treure cap. El llindar es va calibrar a 100
    // quan la vora encara duia la dent del sud-est de Menorca: d'aquells punts,
    // una quinzena eren mostres espúries del límit nord (i el refinament les
    // densificava). Amb la vora sana n'hi queden 93 de reals; 90 vigila la
    // mateixa regressió —que el retall polar no es mengi la Península— sense
    // exigir que la dent torni.
    expect(iberian.length).toBeGreaterThanOrEqual(90);
  });

  it('les línies dels límits tampoc no salten pel pol', () => {
    const { limits } = eclipsePathToGeoJson(computeEclipsePath('2026-08-12'));
    for (const line of limits.geometry.coordinates) {
      for (const [, lat] of line) expect(Math.abs(lat)).toBeLessThanOrEqual(85);
      for (let i = 1; i < line.length; i++) {
        expect(Math.abs(line[i][0] - line[i - 1][0])).toBeLessThan(90);
      }
    }
  });
});

describe('la vora de la franja és una corba llisa, sense dents de serra', () => {
  /*
   * EL BUG QUE VIGILA AIXÒ, vist en una captura del mapa: la franja del
   * 12-08-2026 duia una DENT al límit nord al sud-est de Menorca. Entre les
   * 18:30:10 i les 18:30:33 UT la vora queia de cop de (40,31°N 4,36°E) a
   * (39,97°N 4,22°E) —quaranta quilòmetres al sud, i enrere en longitud—,
   * baixava per una branca falsa fins a (39,59°N 4,27°E) i tornava a pujar
   * d'un salt a (40,18°N 4,52°E): una V invertida que físicament no pot
   * existir, perquè el límit és una corba llisa fins a l'extrem.
   *
   * La causa era la TRIA del candidat quan el contorn de l'ombra queda tallat
   * pel terminador: dels dos punts de tall, tots dos al costat nord de l'eix,
   * guanyava el primer en l'ordre d'escombrat en comptes del transversalment
   * més extrem (vegeu `pathLimitsAt`). El mateix mecanisme feia banyes de
   * ~170° als extrems del recorregut del 2028.
   *
   * El test mesura el gir entre segments consecutius de cada límit, per trams
   * dibuixables (els mateixos talls que fa el GeoJSON: |lat| ≤ 80 i sense
   * salts de longitud) i després de fondre els vèrtexs a menys de 5 km,
   * perquè el que busquem són articulacions a escala de quilòmetres, no
   * soroll de mostreig submètric.
   *
   * CALIBRATGE del llindar, mesurat sobre les corbes reals: amb la geometria
   * sana, el gir màxim dels tres eclipsis és de 15,8° (el relleu suau
   * tangència → terminador del 2026); amb la dent, 151°; amb les banyes del
   * 2028, 169° i 171°. A 120° hi ha un ordre de magnitud de marge per sota i
   * un bon coixí per sobre.
   */
  const MAX_TURN_DEG = 120;
  const COLLAPSE_KM = 5;
  const KM_PER_DEG_LAT = 111.32;

  type LatLon = { lat: number; lon: number };

  /** Trams contigus dibuixables, amb els mateixos talls que el GeoJSON. */
  function drawableStretches(points: readonly LatLon[]): LatLon[][] {
    const runs: LatLon[][] = [];
    let run: LatLon[] = [];
    for (const p of points) {
      const usable = Math.abs(p.lat) <= 80;
      const jumped = run.length > 0 && Math.abs(p.lon - run[run.length - 1].lon) > 90;
      if (!usable || jumped) {
        if (run.length > 1) runs.push(run);
        run = usable ? [p] : [];
        continue;
      }
      run.push(p);
    }
    if (run.length > 1) runs.push(run);
    return runs;
  }

  /** Fon els vèrtexs a menys de COLLAPSE_KM perquè els girs siguin a escala. */
  function collapse(points: readonly LatLon[]): LatLon[] {
    const out: LatLon[] = [];
    for (const p of points) {
      const last = out[out.length - 1];
      if (last && approxDistanceKm(last, p) < COLLAPSE_KM) continue;
      out.push(p);
    }
    return out;
  }

  /** Gir màxim entre parells de segments consecutius, en graus. */
  function worstTurnDeg(points: readonly LatLon[]): number {
    let worst = 0;
    for (const stretch of drawableStretches(points)) {
      const c = collapse(stretch);
      for (let i = 1; i < c.length - 1; i++) {
        const kmPerDegLon = KM_PER_DEG_LAT * Math.cos((c[i].lat * Math.PI) / 180);
        const v1x = (c[i].lon - c[i - 1].lon) * kmPerDegLon;
        const v1y = (c[i].lat - c[i - 1].lat) * KM_PER_DEG_LAT;
        const v2x = (c[i + 1].lon - c[i].lon) * kmPerDegLon;
        const v2y = (c[i + 1].lat - c[i].lat) * KM_PER_DEG_LAT;
        const cos =
          (v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y));
        const deg = (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
        worst = Math.max(worst, deg);
      }
    }
    return worst;
  }

  const IDS = ['2026-08-12', '2027-08-02', '2028-01-26'];

  for (const id of IDS) {
    it(`${id}: cap límit no gira més de ${MAX_TURN_DEG}° a escala de ${COLLAPSE_KM} km`, () => {
      const path = computeEclipsePath(id);
      for (const [name, curve] of [
        ['nord', path.northLimit],
        ['sud', path.southLimit],
        ['central', path.center],
      ] as const) {
        const worst = worstTurnDeg(curve);
        expect(worst, `${id} límit ${name}: gir màxim ${worst.toFixed(1)}°`).toBeLessThan(
          MAX_TURN_DEG,
        );
      }
    });

    it(`${id}: l'anell del polígon no s'autointerseca`, () => {
      // Una vora amb dent pot arribar a doblegar-se fins a creuar-se, i un
      // polígon autointersecat es pinta amb forats imprevisibles. La prova és
      // O(n²) sobre uns pocs centenars de segments: barata en un test.
      const { band } = eclipsePathToGeoJson(computeEclipsePath(id));
      const ring = band.geometry.coordinates[0];

      const crosses = (
        a: readonly number[], b: readonly number[],
        c: readonly number[], d: readonly number[],
      ): boolean => {
        const orient = (o: readonly number[], p: readonly number[], q: readonly number[]) =>
          (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
        const d1 = orient(c, d, a);
        const d2 = orient(c, d, b);
        const d3 = orient(a, b, c);
        const d4 = orient(a, b, d);
        return (
          ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
          ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
        );
      };

      // El darrer vèrtex duplica el primer: es recorre sense ell i el parell
      // (primer, últim segment) es salta perquè són adjacents pel tancament.
      const n = ring.length - 1;
      for (let i = 0; i < n; i++) {
        for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          expect(
            crosses(ring[i], ring[i + 1], ring[j], ring[j + 1]),
            `segments ${i} i ${j} es creuen`,
          ).toBe(false);
        }
      }
    });
  }

  it('2026: el límit nord es manté a la branca bona dins la finestra de la dent', () => {
    // El punt exacte on la captura ensenyava la dent. Amb el bug, a les
    // 18:30:20 UT el límit nord queia a (39,81°N 4,18°E), la branca falsa;
    // la corba bona hi passa per (40,29°N 4,35°E). Mig grau de latitud de
    // diferència: cap tolerància raonable no els confon.
    const north = pathLimitsAt('2026-08-12', Date.parse('2026-08-12T18:30:20Z')).north;
    expect(north).not.toBeNull();
    expect(north!.lat).toBeGreaterThan(40.2);
    expect(north!.lat).toBeLessThan(40.4);
    expect(north!.lon).toBeGreaterThan(4.2);
    expect(north!.lon).toBeLessThan(4.5);
  });
});
