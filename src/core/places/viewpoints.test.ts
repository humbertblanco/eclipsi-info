/**
 * Els miradors: què entra al fitxer i què no.
 *
 * Aquest mòdul no calcula res d'astronòmic, però decideix una cosa que l'usuari
 * es creurà del tot: que els llocs de la llista tenen a veure amb la franja. Un
 * punt mal filtrat no es veu —al mapa surt igual de bonic que els altres— i
 * mena algú a plantar-se on l'eclipsi no serà total. Per això la prova que més
 * val d'aquest fitxer no és cap de les del filtre de rellevància, sinó la que
 * agafa la franja de veritat amb `computeEclipsePath` i hi passa ciutats
 * conegudes: Sòria a dins, Sevilla i Barcelona fora, i Madrid a dins NOMÉS pel
 * marge de 20 km, que és el resultat correcte i el que en va posar el número
 * (13,6 km del límit sud) dins d'una prova en comptes de dins d'una suposició.
 *
 * La fixture imita el que torna Overpass de debò, amb els seus defectes:
 * elements sense nom, cotes escrites de cinc maneres, el mateix cim mapat com
 * a node i com a àrea, i un mirador al mig del mar Cantàbric.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeEclipsePath, distanceToCenterLineKm } from '../eclipses/path';
import {
  DEFAULT_RELEVANCE,
  bandChunks,
  bandGeometry,
  chunkQueryBoxes,
  decimateByCell,
  dedupeViewpoints,
  insideAnyBox,
  insideBand,
  parseElevationM,
  parseViewpointFile,
  selectViewpoints,
  splitAntimeridian,
  toViewpoint,
  viewpointsFileName,
} from './viewpoints';
import type { OverpassElement, Viewpoint, ViewpointFile } from './viewpoints';

/* -------------------------------------------------------------- la fixture */

/**
 * Elements crus d'Overpass. Els identificadors i els noms són reals o
 * versemblants; el que importa és que cada un provi una decisió del filtre.
 */
const OVERPASS_FIXTURE: OverpassElement[] = [
  // Un mirador de manual, dins de la franja del 2026 (Sòria).
  {
    type: 'node',
    id: 1001,
    lat: 41.7636,
    lon: -2.4679,
    tags: { tourism: 'viewpoint', name: 'Mirador del Mirón' },
  },
  // Un cim amb cota escrita "1234 m": ha de passar.
  {
    type: 'node',
    id: 1002,
    lat: 41.8189,
    lon: -2.7714,
    tags: { natural: 'peak', name: 'Pico Frentes', ele: '1381 m' },
  },
  // Un cim sense cota: fora. És un microtopònim i, a més, no es podria ordenar.
  {
    type: 'node',
    id: 1003,
    lat: 41.8195,
    lon: -2.7702,
    tags: { natural: 'peak', name: 'Alto del Pinar' },
  },
  // Un mirador sense nom: fora. No es pot dir en veu alta ni buscar al mapa.
  {
    type: 'node',
    id: 1004,
    lat: 41.7601,
    lon: -2.4612,
    tags: { tourism: 'viewpoint' },
  },
  // El mateix cim, mapat com a àrea 90 m més enllà: duplicat, s'ha de fusionar.
  {
    type: 'way',
    id: 2002,
    center: { lat: 41.8181, lon: -2.7708 },
    tags: { natural: 'peak', name: 'Pico Frentes', ele: '1381' },
  },
  // Un cim en peus: fora, perquè la unitat no és metres.
  {
    type: 'node',
    id: 1005,
    lat: 41.7,
    lon: -2.5,
    tags: { natural: 'peak', name: 'Cerro Feet', ele: "4000'" },
  },
  // Un mirador al mig del mar Cantàbric: fora de la franja del 2026.
  {
    type: 'node',
    id: 1006,
    lat: 45.5,
    lon: -5.0,
    tags: { tourism: 'viewpoint', name: 'Mirador Fantasma' },
  },
  // Una font: no és ni mirador ni cim.
  {
    type: 'node',
    id: 1007,
    lat: 41.76,
    lon: -2.46,
    tags: { amenity: 'drinking_water', name: 'Fuente de la Teja' },
  },
];

function viewpoint(
  id: string,
  name: string,
  lat: number,
  lon: number,
  kind: Viewpoint['kind'],
  ele?: number,
): Viewpoint {
  return ele === undefined ? { id, name, lat, lon, kind } : { id, name, lat, lon, kind, ele };
}

/* ------------------------------------------------------------------ esquema */

describe('parseElevationM', () => {
  it('accepta les formes que no són ambigües', () => {
    expect(parseElevationM('1381')).toBe(1381);
    expect(parseElevationM('1381 m')).toBe(1381);
    expect(parseElevationM('1381M')).toBe(1381);
    expect(parseElevationM('1381,5')).toBe(1381.5);
    expect(parseElevationM('1381.5')).toBe(1381.5);
    expect(parseElevationM('-2')).toBe(-2);
  });

  it('el punt de milers no es pot desfer, i per tant es rebutja', () => {
    // "1.381" tant pot ser mil tres-cents vuitanta-un com un metre i escaig.
    expect(parseElevationM('1.381')).toBeUndefined();
  });

  it('el que no són metres no és cap cota', () => {
    expect(parseElevationM("4000'")).toBeUndefined();
    expect(parseElevationM('4000 ft')).toBeUndefined();
    expect(parseElevationM('alta')).toBeUndefined();
    expect(parseElevationM('')).toBeUndefined();
    expect(parseElevationM(undefined)).toBeUndefined();
  });

  it('rebutja el que no pot ser una cota terrestre', () => {
    expect(parseElevationM('99999')).toBeUndefined();
    expect(parseElevationM('-1000')).toBeUndefined();
  });
});

describe('toViewpoint', () => {
  it('un punt sense nom no és cap lloc', () => {
    expect(toViewpoint(OVERPASS_FIXTURE[3])).toBeNull();
  });

  it('un cim sense cota no entra', () => {
    expect(toViewpoint(OVERPASS_FIXTURE[2])).toBeNull();
  });

  it('una font no és ni mirador ni cim', () => {
    expect(toViewpoint(OVERPASS_FIXTURE[7])).toBeNull();
  });

  it('l’identificador porta el tipus al davant', () => {
    expect(toViewpoint(OVERPASS_FIXTURE[0])?.id).toBe('n1001');
    expect(toViewpoint(OVERPASS_FIXTURE[4])?.id).toBe('w2002');
  });

  it('una àrea es queda amb el centre que dona `out center`', () => {
    const parsed = toViewpoint(OVERPASS_FIXTURE[4]);
    expect(parsed).not.toBeNull();
    expect(parsed?.lat).toBeCloseTo(41.8181, 4);
    expect(parsed?.lon).toBeCloseTo(-2.7708, 4);
  });

  it('les coordenades s’arrodoneixen al metre i no més enllà', () => {
    const parsed = toViewpoint({
      type: 'node',
      id: 9,
      lat: 41.763612345,
      lon: -2.467887654,
      tags: { tourism: 'viewpoint', name: 'Balcó' },
    });
    expect(parsed?.lat).toBe(41.76361);
    expect(parsed?.lon).toBe(-2.46789);
  });

  it('descarta coordenades impossibles', () => {
    expect(
      toViewpoint({
        type: 'node',
        id: 9,
        lat: 91,
        lon: 0,
        tags: { tourism: 'viewpoint', name: 'Enlloc' },
      }),
    ).toBeNull();
  });
});

/* --------------------------------------------------------------- duplicats */

describe('dedupeViewpoints', () => {
  it('el mateix cim mapat dues vegades és un sol cim', () => {
    const parsed = OVERPASS_FIXTURE.map(toViewpoint).filter(
      (v): v is Viewpoint => v !== null,
    );
    const deduped = dedupeViewpoints(parsed, DEFAULT_RELEVANCE.dedupeM);
    const frentes = deduped.filter((v) => v.name === 'Pico Frentes');
    expect(frentes).toHaveLength(1);
    // Entre el node i l'àrea, guanya el node: la posició d'un cim és un punt.
    expect(frentes[0].id).toBe('n1002');
  });

  it('dos llocs amb el mateix nom lluny l’un de l’altre no són el mateix', () => {
    const list = [
      viewpoint('n1', 'Mirador del Ebro', 42.0, -3.0, 'viewpoint'),
      viewpoint('n2', 'Mirador del Ebro', 41.5, -1.0, 'viewpoint'),
    ];
    expect(dedupeViewpoints(list, 200)).toHaveLength(2);
  });

  it('els accents no fan dos llocs d’un', () => {
    const list = [
      viewpoint('n1', 'Peña Ubiña', 43.0, -5.9, 'peak', 2417),
      viewpoint('w2', 'Pena Ubina', 43.0005, -5.9, 'peak', 2417),
    ];
    expect(dedupeViewpoints(list, 200)).toHaveLength(1);
  });
});

/* ---------------------------------------------------------------- densitat */

describe('decimateByCell', () => {
  it('el mirador senyalitzat mana sobre el cim, i el cim més alt sobre el baix', () => {
    // Tots quatre dins d'un mateix quadrat de 4 km, a 41,7°N.
    const list = [
      viewpoint('n1', 'Cim baix', 41.7, -2.5, 'peak', 900),
      viewpoint('n2', 'Cim alt', 41.705, -2.5, 'peak', 1400),
      viewpoint('n3', 'Mirador', 41.702, -2.502, 'viewpoint'),
      viewpoint('n4', 'Cim mitjà', 41.703, -2.498, 'peak', 1100),
    ];
    const kept = decimateByCell(list, 4, 2);
    expect(kept.map((v) => v.name).sort()).toEqual(['Cim alt', 'Mirador']);
  });

  it('la malla no és el conjunt de dades: cel·les diferents, tots dos es queden', () => {
    const list = [
      viewpoint('n1', 'Cim A', 41.70, -2.5, 'peak', 900),
      // 40 km al nord: una altra fila de la malla, passi el que passi.
      viewpoint('n2', 'Cim B', 42.06, -2.5, 'peak', 800),
    ];
    expect(decimateByCell(list, 4, 1)).toHaveLength(2);
  });

  it('les cel·les són quadrades sobre el terreny, no en graus', () => {
    // A 60° de latitud un grau de longitud són ~55 km: dos punts separats
    // 0,05° de longitud (2,8 km) han de caure a la mateixa cel·la de 4 km.
    const list = [
      viewpoint('n1', 'Nord A', 60.0, 10.0, 'peak', 900),
      viewpoint('n2', 'Nord B', 60.0, 10.05, 'peak', 800),
    ];
    expect(decimateByCell(list, 4, 1)).toHaveLength(1);
  });

  it('l’ordre de sortida és el d’entrada, no el de les cel·les', () => {
    const list = [
      viewpoint('n1', 'Primer', 41.0, -2.0, 'peak', 900),
      viewpoint('n2', 'Segon', 42.0, -2.0, 'peak', 800),
      viewpoint('n3', 'Tercer', 43.0, -2.0, 'peak', 700),
    ];
    expect(decimateByCell(list, 4, 1).map((v) => v.name)).toEqual([
      'Primer',
      'Segon',
      'Tercer',
    ]);
  });
});

describe('selectViewpoints', () => {
  it('el sostre no talla per la cua: eixampla la malla', () => {
    // Vint cims en fila, un cada 5 km, tots a cel·les diferents amb malla de 4.
    const list = Array.from({ length: 20 }, (_, i) =>
      viewpoint(`n${i}`, `Cim ${i}`, 41 + (i * 5) / 111.195, -2, 'peak', 1000 + i),
    );
    const result = selectViewpoints(list, { maxCount: 6, cellKm: 4, perCell: 1 });

    expect(result.viewpoints.length).toBeLessThanOrEqual(6);
    expect(result.stats.passes).toBeGreaterThan(1);
    expect(result.stats.cellKm).toBeGreaterThan(4);
    // El repartiment segueix cobrint tota la fila i no només el principi.
    const lats = result.viewpoints.map((v) => v.lat);
    expect(Math.max(...lats) - Math.min(...lats)).toBeGreaterThan(0.5);
  });

  it('el sostre no passa de llarg: s’atura al gra més fi que hi cap', () => {
    // Cent cims en fila, un cada 2 km. Amb salts de ×1,5 i prou, la malla
    // passava de llarg i el fitxer sortia a mig omplir (mesurat amb el 2026:
    // 1.336 llocs quan en cabien 2.000). Amb la bisecció, el resultat s'ha
    // d'enganxar al sostre per sota.
    const list = Array.from({ length: 100 }, (_, i) =>
      viewpoint(`n${i}`, `Cim ${i}`, 41 + (i * 2) / 111.195, -2, 'peak', 1000 + i),
    );
    const result = selectViewpoints(list, { maxCount: 40, cellKm: 1, perCell: 1 });

    expect(result.viewpoints.length).toBeLessThanOrEqual(40);
    // Sense bisecció això queia a 34 (malla 5,06 km); amb bisecció s'hi acosta.
    expect(result.viewpoints.length).toBeGreaterThanOrEqual(38);
  });

  it('sense pressió de mida no toca res', () => {
    const list = [
      viewpoint('n1', 'Un', 41.0, -2.0, 'viewpoint'),
      viewpoint('n2', 'Dos', 42.0, -2.0, 'peak', 1200),
    ];
    const result = selectViewpoints(list);
    expect(result.viewpoints).toHaveLength(2);
    expect(result.stats.passes).toBe(1);
    expect(result.relevance.cellKm).toBe(DEFAULT_RELEVANCE.cellKm);
  });
});

/* --------------------------------------------------- la franja de l'eclipsi */

describe('la franja del 12 d’agost de 2026', () => {
  const path = computeEclipsePath('2026-08-12');
  const band = bandGeometry(path, 20);
  const chunks = bandChunks(path, { marginKm: 20, chunkKm: 220 });

  it('la franja es talla en trams i cap no és buit', () => {
    /*
     * AQUEST TEST DEMANAVA ABANS DOS PUNTS DE LÍMIT NORD I DOS DE SUD A CADA
     * TRAM, i aquella condició era falsa i amagava el defecte.
     *
     * Als extrems del recorregut la franja no està limitada per cap tangència
     * sinó pel terminador: la vora d'allà és la TAPA (vegeu `eclipses/path.ts`).
     * Al 12-08-2026 el límit nord s'acaba a les 18:30:17 i la franja encara dura
     * fins a les 18:34:05 — tot el tram de les Balears té vora, però no en té de
     * «nord». Exigint límit nord, aquell tram es descartava sencer i Palma
     * (39,57 / 2,65), amb 96 s de totalitat, no queia dins de cap rectangle de
     * consulta: cap mirador de Mallorca no s'hi arribava a demanar mai.
     *
     * El que ha de valdre, doncs, és que cada tram tingui VORA —de la mena que
     * sigui— i un rectangle amb àrea.
     */
    expect(chunks.length).toBeGreaterThan(5);
    for (const chunk of chunks) {
      const edge = chunk.north.length + chunk.south.length + chunk.cap.length;
      expect(edge, `tram ${chunk.startMs} sense vora`).toBeGreaterThanOrEqual(2);
      expect(chunk.box.maxLat).toBeGreaterThan(chunk.box.minLat);
    }
    // I el gruix del recorregut sí que ha de tenir els dos límits: si això
    // s'ensorra, el que s'ha trencat és `pathLimitsAt`, no les tapes.
    const withBothLimits = chunks.filter(
      (c) => c.north.length >= 2 && c.south.length >= 2,
    );
    expect(withBothLimits.length).toBeGreaterThan(chunks.length / 2);
  });

  it('Sòria hi és a dins; Sevilla, Barcelona i el mig del Cantàbric, no', () => {
    // Sòria és a la línia central del 2026: 7,4° d'altura solar i 1'41" de
    // totalitat segons les infografies de l'IGN.
    expect(insideBand({ lat: 41.7636, lon: -2.4679 }, band)).toBe(true);
    // Sevilla és a 500 km al sud-oest de la franja; Barcelona, just a fora del
    // límit sud (l'IGN li dona magnitud ~1,00 i CAP totalitat), però prou
    // lluny perquè ni amb 20 km de marge no hi entri.
    expect(insideBand({ lat: 37.3891, lon: -5.9845 }, band)).toBe(false);
    expect(insideBand({ lat: 41.3851, lon: 2.1734 }, band)).toBe(false);
    expect(insideBand({ lat: 45.5, lon: -5.0 }, band)).toBe(false);
  });

  it('Madrid entra pel marge, i és exactament el que ha de passar', () => {
    // MESURAT: Madrid és a 13,6 km del límit sud de la franja del 2026. No hi
    // tindrà totalitat —l'IGN li dona un 99,7 % que aquesta app es nega a
    // escriure com a 100— però qui hi visqui té la totalitat a un quart d'hora
    // de cotxe, i els miradors del seu voltant són informació útil: diuen cap
    // on s'ha de moure. Per això el marge existeix.
    const toSouth = distanceToCenterLineKm({ lat: 40.4168, lon: -3.7038 }, path.southLimit);
    expect(toSouth).not.toBeNull();
    expect(toSouth ?? 0).toBeGreaterThan(10);
    expect(toSouth ?? 0).toBeLessThan(20);

    expect(insideBand({ lat: 40.4168, lon: -3.7038 }, band)).toBe(true);
    expect(insideBand({ lat: 40.4168, lon: -3.7038 }, bandGeometry(path, 5))).toBe(false);
  });

  it('el que la fixture diu que és de la franja, hi és; el fantasma, no', () => {
    const parsed = OVERPASS_FIXTURE.map(toViewpoint).filter(
      (v): v is Viewpoint => v !== null,
    );
    const inBand = parsed.filter((v) => insideBand(v, band));
    expect(inBand.map((v) => v.name).sort()).toEqual([
      'Mirador del Mirón',
      'Pico Frentes',
      'Pico Frentes',
    ]);
    expect(inBand.some((v) => v.name === 'Mirador Fantasma')).toBe(false);
  });

  it('tot punt de dins de la franja cau dins d’algun rectangle de consulta', () => {
    // És la garantia que fa que l'extracció sigui completa: si un lloc de la
    // franja no cau en cap rectangle, mai no el demanarem i no existirà.
    const boxes = chunks.flatMap((chunk) =>
      chunkQueryBoxes(chunk, band, 1.2).flatMap(splitAntimeridian),
    );
    expect(insideAnyBox({ lat: 41.7636, lon: -2.4679 }, boxes)).toBe(true);
    expect(insideAnyBox({ lat: 43.3619, lon: -5.8494 }, boxes)).toBe(true); // Oviedo
    expect(insideAnyBox({ lat: 39.5696, lon: 2.6502 }, boxes)).toBe(true); // Palma
    expect(insideAnyBox({ lat: 64.1466, lon: -21.9426 }, boxes)).toBe(true); // Reykjavík
  });

  it('la malla de consulta llença la major part del que no toca la franja', () => {
    // Sense el descart, els rectangles dels trams del 2026 —que amb el Sol
    // arran d'horitzó fan centenars de milers de km²— es partirien en milers
    // de cel·les de mar obert. Amb ell en surten uns quants centenars.
    const boxes = chunks.flatMap((chunk) => chunkQueryBoxes(chunk, band, 1.2));
    const full = chunks.reduce((sum, chunk) => {
      const rows = Math.ceil((chunk.box.maxLat - chunk.box.minLat) / 1.2) + 1;
      const cols = Math.ceil((chunk.box.maxLon - chunk.box.minLon) / 1.2) + 1;
      return sum + rows * cols;
    }, 0);
    expect(boxes.length).toBeLessThan(full * 0.75);
    expect(boxes.length).toBeGreaterThan(50);
  });
});

describe('splitAntimeridian', () => {
  it('un rectangle normal no es toca', () => {
    expect(splitAntimeridian({ minLat: 40, maxLat: 42, minLon: -3, maxLon: -1 })).toEqual([
      { minLat: 40, maxLat: 42, minLon: -3, maxLon: -1 },
    ]);
  });

  it('un rectangle que acaba a l’antimeridià segueix acceptant punts', () => {
    // `normalizeLon(180)` val −180: normalitzant el rectangle en comptes del
    // punt, aquest tros es quedava buit i tot el Pacífic del 2028 s'hauria
    // extret de dos rectangles dels quals un no acceptava res.
    const parts = splitAntimeridian({ minLat: 10, maxLat: 12, minLon: 175, maxLon: 190 });
    expect(insideAnyBox({ lat: 11, lon: 179 }, parts)).toBe(true);
    expect(insideAnyBox({ lat: 11, lon: -175 }, parts)).toBe(true);
    expect(insideAnyBox({ lat: 11, lon: 160 }, parts)).toBe(false);
  });

  it('un rectangle que travessa l’antimeridià es parteix en dos', () => {
    const parts = splitAntimeridian({
      minLat: 10,
      maxLat: 12,
      minLon: 175,
      maxLon: 190,
    });
    expect(parts).toHaveLength(2);
    expect(parts[0].maxLon).toBe(180);
    expect(parts[1].minLon).toBe(-180);
    expect(parts[1].maxLon).toBeCloseTo(-170, 6);
  });
});

/* ------------------------------------------------------------- el publicat */

describe('parseViewpointFile', () => {
  it('un fitxer vell o mig trencat no fa caure res: es queda el que serveix', () => {
    const file = parseViewpointFile({
      eclipseId: '2026-08-12',
      viewpoints: [
        { id: 'n1', name: 'Bo', lat: 41, lon: -2, kind: 'viewpoint' },
        { id: 'n2', name: '', lat: 41, lon: -2, kind: 'peak', ele: 100 },
        { id: 'n3', name: 'Sense tipus', lat: 41, lon: -2 },
        { id: 'n4', name: 'Fora del món', lat: 200, lon: -2, kind: 'peak', ele: 100 },
        'això no és un objecte',
      ],
    });
    expect(file?.viewpoints.map((v) => v.id)).toEqual(['n1']);
    expect(file?.count).toBe(1);
    // Sense atribució escrita, s'hi posa la que toca: mai es publica sense.
    expect(file?.attribution).toContain('OpenStreetMap');
  });

  it('el que no té ni identificador d’eclipsi ni llista no és cap fitxer', () => {
    expect(parseViewpointFile(null)).toBeNull();
    expect(parseViewpointFile({ viewpoints: [] })).toBeNull();
    expect(parseViewpointFile({ eclipseId: '2026-08-12' })).toBeNull();
  });
});

describe('viewpointsFileName', () => {
  it('el nom del fitxer porta l’eclipsi', () => {
    expect(viewpointsFileName('2026-08-12')).toBe('data/viewpoints-2026-08-12.json');
  });
});

/* ------------------------------------------- el fitxer generat, si existeix */

/**
 * La prova de la caixa tancada.
 *
 * Si `scripts/build-viewpoints.ts` ja s'ha executat, el fitxer que viatjarà al
 * telèfon és aquí al costat i es pot obrir. Aleshores la pregunta ja no és si
 * el filtre és correcte en abstracte, sinó si el FITXER que publicarem té tots
 * els punts dins de la franja del seu eclipsi. Si encara no s'ha generat, la
 * prova no falla: no hi ha res a comprovar i dir el contrari seria una alarma
 * falsa a qualsevol que es baixi el repositori.
 */
describe('el fitxer publicat de 2026-08-12', () => {
  const file = readGeneratedFile('2026-08-12');

  it.skipIf(file === null)('tot punt cau dins de la franja + 20 km', () => {
    if (file === null) return;
    const band = bandGeometry(computeEclipsePath('2026-08-12'), 20);
    const outside = file.viewpoints.filter((v) => !insideBand(v, band));
    expect(outside.map((v) => `${v.name} (${v.lat}, ${v.lon})`)).toEqual([]);
  });

  it.skipIf(file === null)('porta l’atribució d’OpenStreetMap i la llicència', () => {
    if (file === null) return;
    expect(file.attribution).toContain('OpenStreetMap');
    expect(file.license).toBe('ODbL-1.0');
    expect(file.attributionUrl).toContain('openstreetmap.org/copyright');
  });

  it.skipIf(file === null)('no repeteix cap identificador', () => {
    if (file === null) return;
    expect(new Set(file.viewpoints.map((v) => v.id)).size).toBe(file.viewpoints.length);
  });
});

function readGeneratedFile(eclipseId: string): ViewpointFile | null {
  const target = new URL(
    `../../../public/${viewpointsFileName(eclipseId)}`,
    import.meta.url,
  );
  if (!existsSync(target)) return null;
  return parseViewpointFile(JSON.parse(readFileSync(target, 'utf8')));
}
