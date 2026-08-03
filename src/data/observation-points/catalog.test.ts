/**
 * Validació del catàleg de punts oficials.
 *
 * Aquí hi ha dues menes de proves i convé no confondre-les. Les primeres són
 * d'higiene: que l'esquema hi sigui sencer, que els dos idiomes hi siguin, que
 * els URL siguin https, que les coordenades tinguin els cinc decimals de
 * `SHARE_DECIMALS` i cap més. Són barates i atrapen errors de dit.
 *
 * L'última és la que val de debò: que cap punt no quedi FORA de la franja de
 * centralitat del seu eclipsi. Un punt oficial mal col·locat no és una errada
 * cosmètica — és algú que fa tres hores de cotxe, s'hi planta amb la cadira i
 * es queda sense totalitat.
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
 * 222 punts del catàleg, el més allunyat de la línia central n'és a 147,0 km
 * (l'ombra és molt ampla al capvespre); els de Salamanca, que vam treure, hi
 * eren de 174,9 a 236,9 km. El llindar de 160 km cau còmodament entremig.
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
const EXPECTED_2026_COUNT = 222;

/** Vegeu la capçalera: 147,0 km és el màxim mesurat; 160 deixa marge sense colar-hi Salamanca. */
const MAX_CENTER_LINE_KM = 160;

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

  it('encara no té cap punt del 2027 ni del 2028, i això és una resposta', () => {
    // Si algun dia s'omplen, aquesta prova ha de FALLAR i obligar a revisar la
    // capçalera de `catalog.ts`, que explica per què eren buides.
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

describe('la franja', () => {
  it('conté tots els punts oficials: cap no es queda fora de la totalitat', () => {
    const fora: string[] = [];
    for (const { eclipseId, point } of everyPoint()) {
      const local = computeLocalCircumstances(eclipseId, {
        lat: point.lat,
        lon: point.lon,
        elevation: 0,
      });
      if (local.centralDurationSec <= 0 || local.umbralMarginArcsec >= 0) {
        fora.push(`${point.id} (${point.source.who}): marge ${local.umbralMarginArcsec.toFixed(2)}″`);
      }
    }
    expect(fora).toEqual([]);
  });

  it('no té cap punt disparat lluny de la línia central dibuixada', () => {
    for (const eclipseId of ECLIPSE_IDS) {
      const points = pointsForEclipse(eclipseId);
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
  it('són set administracions per al 2026, sense repetits i ordenades', () => {
    const sources = observationSourcesFor('2026-08-12');
    expect(sources).toHaveLength(7);
    expect(new Set(sources.map((s) => s.url)).size).toBe(sources.length);
    const noms = sources.map((s) => s.who);
    expect([...noms].sort((a, b) => a.localeCompare(b, 'ca'))).toEqual(noms);
  });

  it('no en té cap per als eclipsis que encara no tenen punts', () => {
    expect(observationSourcesFor('2027-08-02')).toEqual([]);
    expect(observationSourcesFor('2028-01-26')).toEqual([]);
  });
});
