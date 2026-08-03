/**
 * Validació del catàleg de punts oficials.
 *
 * Aquí hi ha dues menes de proves i convé no confondre-les. Les primeres són
 * d'higiene: que l'esquema hi sigui sencer, que els dos idiomes hi siguin, que
 * els URL siguin https, que les coordenades tinguin els cinc decimals de
 * `SHARE_DECIMALS` i cap més. Són barates i atrapen errors de dit.
 *
 * L'última és la que val de debò: que el que el fitxer DIU de cada punt sigui
 * el que el motor en calcula. Un punt oficial mal col·locat no és una errada
 * cosmètica — és algú que fa tres hores de cotxe, s'hi planta amb la cadira i
 * es queda sense totalitat.
 *
 * ---
 *
 * PER QUÈ AQUESTA PROVA JA NO DIU "DINS DE LA FRANJA", I QUÈ VIGILA ARA.
 *
 * Abans exigia que cap punt no quedés fora de la franja de centralitat. Aquella
 * regla acotava la recollida de dades sense voler: van quedar fora Madrid,
 * Barcelona i Sevilla, que tenen punts oficials, milions d'habitants i
 * obscuracions del 99,97 %, el 99,80 % i el 94,62 %. La decisió nova és que un
 * punt oficial hi entra encara que només hi hagi parcial, i que el fitxer ho
 * declari amb `phase` (vegeu la regla 3 de `catalog.ts`).
 *
 * La regla vella, però, feia una feina real: caçar la coordenada mal picada. No
 * es pot treure sense posar-hi res, i abans de decidir què s'hi posa vaig
 * mesurar QUÈ CAÇA CADA CANDIDATA. 1.918 mutacions sobre els 274 punts (signe
 * canviat, lat i lon intercanviades, ±1° i ±2° en cada eix):
 *
 *   caçades pel bbox d'Espanya .................. 296
 *   caçades per canvi de fase (central↔parcial) . 522
 *   caçades per obscuració < 90 % ................. 0
 *   se n'escapen a totes ........................ 548
 *
 * EL ZERO ÉS LA DADA IMPORTANT i va contra la intuïció: el 12 d'agost del 2026
 * NO hi ha cap racó del bbox per sota del 90 % d'obscuració. Tota la península
 * i les Balears passen del 92 %, o sigui que un llindar d'obscuració no caça ni
 * un sol error de dit d'aquell eclipsi. Es queda igualment, però sabent per què:
 * és una GARANTIA SEMÀNTICA ("d'aquí s'hi veu un eclipsi de debò"), no una
 * xarxa antierrades, i sí que mossega als altres dos, on la franja no cobreix
 * tot el territori — el 2027 Galícia es queda entre el 73,3 % i el 77,9 %, i el
 * 2028 entre el 70,0 % i el 72,7 %. Un punt de Cadis picat a Galícia hi cau.
 *
 * El llindar és el 80 %, i no més amunt per una raó que no és arbitrària: el
 * 2028 és ANULAR, i al bell mig de la seva franja l'obscuració màxima és del
 * 82,7 %. Qualsevol llindar per sobre d'això deixaria fora punts perfectament
 * bons de l'eclipsi que menys Sol tapa per naturalesa.
 *
 * I els 548 que s'escapen de tot? Són desplaçaments d'1° que cauen dins de la
 * mateixa franja. Cap invariant barata els distingeix, i la regla vella tampoc
 * no els caçava (permetia 160 km). La defensa contra això no és una prova: és
 * que cada punt porta l'URL de qui l'ha publicat i es pot anar a mirar.
 *
 * ---
 *
 * COM ES MESURA "FORA DE LA FRANJA", I PER QUÈ NO ÉS COM semblava.
 *
 * El pla era construir el polígon de la franja amb `computeEclipsePath` (límit
 * nord + límit sud invertit) i exigir que cada punt hi fos a dins o a menys de
 * 30 km. Fet i provat, dona respostes falses al tram final del 12 d'agost del
 * 2026, i val la pena deixar-ho escrit perquè no ho torni a provar ningú:
 *
 *   la platja de Palma és a 5,5 km de la línia central i hi ha 98 s de
 *   totalitat, però el polígon la deixava a 134,8 km "fora".
 *
 * El motiu no és cap bug de `path.ts`: és que allà la franja ja no té límit
 * sud. Amb el Sol a punt de pondre's, el límit sud de l'ombra abandona la
 * Terra, i la darrera polilínia sud acaba a 40,54 N 3,71 O, terra endins de la
 * península. A partir d'allà la vora sud de la franja és el terminador, no una
 * corba que `computeEclipsePath` dibuixi. Un polígon tancat amb el que queda
 * talla per on no toca.
 *
 * La sortida per l'altra banda tampoc no serveix: mirar la mitja amplada local
 * amb `pathLimitsAt` dona 320-360 km sobre Espanya (l'ombra hi arriba
 * estiradíssima, amb el Sol entre 12° i 1°), i amb aquest marge hi passa
 * qualsevol cosa — ni tan sols els vuit punts de Salamanca, que són ben bé fora
 * de la franja, hi cauen.
 *
 * Així que la pregunta se li fa a qui la sap respondre exactament: el motor.
 * `computeLocalCircumstances` torna `umbralMarginArcsec`, que és negatiu a dins
 * de la franja i positiu a fora, i `centralDurationSec`. Això no és "a menys de
 * 30 km de la franja": és A DINS, que és més estricte i no depèn de com estigui
 * dibuixada la vora.
 *
 * `computeEclipsePath` es queda igualment, i fent una feina que sí que li
 * pertoca: mesurar la distància a la LÍNIA CENTRAL que l'usuari té pintada al
 * mapa. Serveix de xarxa contra la mena d'error que el marge umbral no atrapa
 * de manera llegible — una coordenada copiada amb el signe canviat o amb dos
 * dígits ballats no cau "una mica" fora, cau a centenars de quilòmetres. Dels
 * 262 punts CENTRALS del catàleg, el més allunyat de la línia central n'és a
 * 147,0 km (l'ombra és molt ampla al capvespre) i el punt central de Madrid que
 * hi arriba més lluny, Hoyo de Manzanares, a 145,1 km. El llindar de 160 km cau
 * còmodament per sobre.
 *
 * Aquesta comprovació val NOMÉS per als punts de `phase: 'central'`, i és
 * deliberat: als de parcialitat la distància a la línia central no vol dir res
 * —San Martín de Valdeiglesias, oficial i legítim, n'és a 191,8 km— i exigir-hi
 * un màxim tornaria a prohibir per la porta del darrere el que la regla nova
 * acaba de permetre.
 */

import { describe, expect, it } from 'vitest';
import {
  findObservationPoint,
  observationSourcesFor,
  pointsForEclipse,
  type ObservationPoint,
} from './catalog';
import { ECLIPSES } from '../../core/eclipses/catalog';
import { computeEclipsePath, distanceToCenterLineKm } from '../../core/eclipses/path';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import { SHARE_DECIMALS } from '../../features/share/link';

const ECLIPSE_IDS = ECLIPSES.map((e) => e.id);

/**
 * Caixa que conté tot el territori on hi ha punts: península i Balears. No hi
 * posem les Canàries a posta — cap de les tres franges no hi passa, i si un dia
 * hi apareix una coordenada és molt més probable que sigui una errada de signe
 * que no pas un punt oficial canari.
 */
const SPAIN_BOUNDS = { minLat: 35.5, maxLat: 44.2, minLon: -9.6, maxLon: 4.6 };

/** Els punts que hi ha a `2026-08-12.json` no s'han de perdre per accident. */
const EXPECTED_2026_COUNT = 274;

/** D'aquests, els que veuen la totalitat i els que només veuen la parcial. */
const EXPECTED_2026_CENTRAL = 262;
const EXPECTED_2026_PARTIAL = 12;

/** Vegeu la capçalera: 147,0 km és el màxim mesurat entre els centrals; 160 deixa marge. */
const MAX_CENTER_LINE_KM = 160;

/**
 * Obscuració mínima per considerar que d'un punt s'hi veu un eclipsi de debò.
 *
 * Vegeu la capçalera per què és el 80 % i no un número més exigent: al centre
 * de la franja de l'anular del 2028 l'obscuració màxima és del 82,7 %.
 */
const MIN_OBSCURATION = 0.8;

function decimalsOf(value: number): number {
  const text = String(value);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

function everyPoint(): { eclipseId: string; point: ObservationPoint }[] {
  return ECLIPSE_IDS.flatMap((eclipseId) =>
    pointsForEclipse(eclipseId).map((point) => ({ eclipseId, point })),
  );
}

describe('el catàleg de punts oficials', () => {
  it('té una entrada per cada eclipsi del catàleg, encara que sigui buida', () => {
    for (const eclipseId of ECLIPSE_IDS) {
      expect(Array.isArray(pointsForEclipse(eclipseId))).toBe(true);
    }
    expect(pointsForEclipse('2026-08-12')).toHaveLength(EXPECTED_2026_COUNT);
  });

  it('sap quants punts veuen la totalitat i quants només la parcial', () => {
    const points = pointsForEclipse('2026-08-12');
    expect(points.filter((p) => p.phase === 'central')).toHaveLength(EXPECTED_2026_CENTRAL);
    expect(points.filter((p) => p.phase === 'partial')).toHaveLength(EXPECTED_2026_PARTIAL);
  });

  it('encara no té cap punt del 2027 ni del 2028, i això és una resposta', () => {
    // Si algun dia s'omplen, aquesta prova ha de FALLAR i obligar a revisar la
    // capçalera de `catalog.ts`, que explica per què eren buides.
    // Última repassada de fonts: 3 d'agost del 2026 (portal de l'Estat, els
    // onze portals autonòmics, Junta d'Andalusia i Múrcia). Continua a zero.
    expect(pointsForEclipse('2027-08-02')).toHaveLength(0);
    expect(pointsForEclipse('2028-01-26')).toHaveLength(0);
  });

  it('no coneix cap eclipsi que no sigui al catàleg, i no peta per això', () => {
    expect(pointsForEclipse('1905-08-30')).toEqual([]);
    expect(findObservationPoint('1905-08-30', 'sigui-el-que-sigui')).toBeUndefined();
  });

  it('no repeteix cap identificador dins del mateix eclipsi', () => {
    for (const eclipseId of ECLIPSE_IDS) {
      const ids = pointsForEclipse(eclipseId).map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('troba qualsevol punt pel seu identificador', () => {
    for (const { eclipseId, point } of everyPoint()) {
      expect(findObservationPoint(eclipseId, point.id)?.name.ca).toBe(point.name.ca);
    }
  });
});

describe('cada punt del catàleg', () => {
  it('té un identificador en minúscules, sense accents ni espais', () => {
    for (const { point } of everyPoint()) {
      expect(point.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('té nom en català i en castellà, i cap dels dos és buit', () => {
    for (const { point } of everyPoint()) {
      expect(typeof point.name.ca).toBe('string');
      expect(typeof point.name.es).toBe('string');
      expect(point.name.ca.trim().length).toBeGreaterThan(0);
      expect(point.name.es.trim().length).toBeGreaterThan(0);
    }
  });

  it('té la nota, si en té, en tots dos idiomes', () => {
    for (const { point } of everyPoint()) {
      if (point.note === undefined) continue;
      expect(point.note.ca.trim().length).toBeGreaterThan(0);
      expect(point.note.es.trim().length).toBeGreaterThan(0);
    }
  });

  it('diu d’on surt, amb un URL https que es pot obrir', () => {
    for (const { point } of everyPoint()) {
      expect(point.source.who.trim().length).toBeGreaterThan(0);
      expect(point.source.url).toMatch(/^https:\/\//);
      expect(() => new URL(point.source.url)).not.toThrow();
    }
  });

  it('declara si la coordenada és publicada o estimada, i quina mena de lloc és', () => {
    for (const { point } of everyPoint()) {
      expect(['exact', 'estimated']).toContain(point.precision);
      expect(['official', 'event', 'observatory']).toContain(point.kind);
      expect(['central', 'partial'], point.id).toContain(point.phase);
    }
  });

  it('si la coordenada és estimada, explica per què ho és', () => {
    // La regla 2 de `catalog.ts` només val si la interfície té alguna cosa per
    // ensenyar. Un punt estimat sense nota seria un punt que sembla exacte.
    for (const { point } of everyPoint()) {
      if (point.precision !== 'estimated') continue;
      expect(point.note, point.id).toBeDefined();
    }
  });

  it('no guarda més decimals dels que el projecte comparteix', () => {
    // Cinc decimals són ~1 m. Escriure'n més seria fingir una precisió que ni
    // les fonts tenen ni l'enllaç compartit sap transportar.
    for (const { point } of everyPoint()) {
      expect(decimalsOf(point.lat)).toBeLessThanOrEqual(SHARE_DECIMALS);
      expect(decimalsOf(point.lon)).toBeLessThanOrEqual(SHARE_DECIMALS);
    }
  });

  it('cau dins d’Espanya', () => {
    for (const { point } of everyPoint()) {
      expect(Number.isFinite(point.lat)).toBe(true);
      expect(Number.isFinite(point.lon)).toBe(true);
      expect(point.lat).toBeGreaterThanOrEqual(SPAIN_BOUNDS.minLat);
      expect(point.lat).toBeLessThanOrEqual(SPAIN_BOUNDS.maxLat);
      expect(point.lon).toBeGreaterThanOrEqual(SPAIN_BOUNDS.minLon);
      expect(point.lon).toBeLessThanOrEqual(SPAIN_BOUNDS.maxLon);
    }
  });
});

describe('el motor i el fitxer', () => {
  it('de cada punt s’hi veu un eclipsi de debò, no una engruna', () => {
    // GARANTIA SEMÀNTICA, no xarxa antierrades: vegeu la capçalera, el 2026
    // aquest llindar no en caça ni un. Serveix perquè cap punt del catàleg no
    // pugui prometre un eclipsi que des d'allà amb prou feines es nota.
    const fluixos: string[] = [];
    for (const { eclipseId, point } of everyPoint()) {
      const local = computeLocalCircumstances(eclipseId, {
        lat: point.lat,
        lon: point.lon,
        elevation: 0,
      });
      const obscuration = local.contacts.max.obscuration;
      if (local.kind === 'none' || obscuration < MIN_OBSCURATION) {
        fluixos.push(
          `${point.id} (${point.source.who}): ${local.kind}, obscuració ${(obscuration * 100).toFixed(2)} %`,
        );
      }
    }
    expect(fluixos).toEqual([]);
  });

  it('el `phase` que hi ha escrit és el que diu el motor', () => {
    // Aquesta és la que substitueix de debò la regla vella. Si algú mou una
    // coordenada d'un punt central cap a fora de la franja (o al revés) i no
    // toca el `phase`, aquí peta. És el que fa que valgui la pena tenir el
    // camp desat en comptes de derivar-lo cada vegada.
    const mentides: string[] = [];
    for (const { eclipseId, point } of everyPoint()) {
      const local = computeLocalCircumstances(eclipseId, {
        lat: point.lat,
        lon: point.lon,
        elevation: 0,
      });
      const segonsMotor = local.centralDurationSec;
      const esperat = segonsMotor > 0 ? 'central' : 'partial';
      if (point.phase !== esperat) {
        mentides.push(
          `${point.id} (${point.source.who}): el fitxer diu ${point.phase}, el motor ${esperat} (${segonsMotor.toFixed(0)} s, marge ${local.umbralMarginArcsec.toFixed(2)}″)`,
        );
      }
    }
    expect(mentides).toEqual([]);
  });

  it('coincideix amb el PDF de la Comunitat de Madrid sobre qui té totalitat', () => {
    /*
     * LA MILLOR VALIDACIÓ QUE TENIM DEL MOTOR, i surt de franc.
     *
     * La Comunitat de Madrid publica dues coses per separat: la llista dels 52
     * municipis amb punt d'observació, i un PDF ("Observación de la totalidad
     * del eclipse") amb els 40 que tenen totalitat i quants segons en tenen.
     * Els 12 que falten al PDF no hi són perquè no en tenen.
     *
     * El motor, sense mirar el PDF, dona EXACTAMENT els mateixos 40. I les
     * durades quadren dins d'un segon: Somosierra 1:29 al PDF i 88 s aquí,
     * Buitrago del Lozoya 1:19 i 80 s, Ambite 0:26 i 27 s, Hoyo de Manzanares
     * 0:19 i 20 s. Dos càlculs independents, la mateixa resposta.
     *
     * Si un dia això falla, abans de tocar res: mirar si el que ha canviat és
     * una coordenada nostra (probable) o el motor (greu).
     */
    const senseTotalitat = [
      'mad-brunete',
      'mad-chapineria',
      'mad-chinchon',
      'mad-navas-del-rey',
      'mad-perales-de-tajuna',
      'mad-robledo-de-chavela',
      'mad-san-lorenzo-de-el-escorial',
      'mad-san-martin-de-valdeiglesias',
      'mad-santa-maria-de-la-alameda',
      'mad-torrejon-de-la-calzada',
      'mad-villamantilla',
      'mad-villarejo-de-salvanes',
    ];
    const madrid = pointsForEclipse('2026-08-12').filter((p) => p.id.startsWith('mad-'));
    expect(madrid).toHaveLength(52);
    const parcials = madrid.filter((p) => p.phase === 'partial').map((p) => p.id);
    expect([...parcials].sort()).toEqual([...senseTotalitat].sort());
  });

  it('cap punt central no queda disparat lluny de la línia central dibuixada', () => {
    for (const eclipseId of ECLIPSE_IDS) {
      const points = pointsForEclipse(eclipseId).filter((p) => p.phase === 'central');
      if (points.length === 0) continue;
      const path = computeEclipsePath(eclipseId);
      for (const point of points) {
        const km = distanceToCenterLineKm(point, path.center);
        expect(km, point.id).not.toBeNull();
        expect(km ?? Infinity, point.id).toBeLessThan(MAX_CENTER_LINE_KM);
      }
    }
  });
});

describe('les fonts', () => {
  it('són vuit administracions per al 2026, sense repetits i ordenades', () => {
    const sources = observationSourcesFor('2026-08-12');
    expect(sources).toHaveLength(8);
    expect(new Set(sources.map((s) => s.url)).size).toBe(sources.length);
    const noms = sources.map((s) => s.who);
    expect([...noms].sort((a, b) => a.localeCompare(b, 'ca'))).toEqual(noms);
  });

  it('no en té cap per als eclipsis que encara no tenen punts', () => {
    expect(observationSourcesFor('2027-08-02')).toEqual([]);
    expect(observationSourcesFor('2028-01-26')).toEqual([]);
  });
});
