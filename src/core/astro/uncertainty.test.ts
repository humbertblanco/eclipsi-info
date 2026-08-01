/**
 * Proves de la quantificació de la incertesa.
 *
 * Les dues que compten són les dels extrems, i tiren en direccions contràries:
 *
 *  · AL MIG DE LA FRANJA no s'ha de mencionar res. Ni `notable`, ni `summary`,
 *    ni cap interval. Fer semblar insegura una app que no ho és és un error tan
 *    gran com prometre precisió que no tenim, i és molt més fàcil de cometre.
 *  · AL CAIRE s'ha de dir que no ho sabem, dir per què, i dir quants
 *    quilòmetres cal fer per deixar de dependre'n.
 *
 * La resta valida la derivació: que la distància al límit que calculem sigui la
 * distància a l'arrel de veritat, que la nostra bandera coincideixi exactament
 * amb `edgeUncertain` de `contacts.ts`, i que els dos motors independents que
 * tenim per situar la franja (resolució directa de la separació aquí,
 * elements besselians del GSFC a `eclipses/path.ts`) no se separin mai més del
 * que aquest mòdul diu que es poden separar.
 */

import { describe, expect, it } from 'vitest';
import { computeLocalCircumstances } from './contacts';
import { computeDurationGradient } from './gradient';
import {
  RELATIVE_POSITION_ERROR_ARCSEC,
  centralProbabilityFromMargin,
  computeUncertainty,
  describeContactPrecision,
  describeUncertainty,
  type EclipseUncertainty,
} from './uncertainty';
import type { GeoLocation } from './types';

const KM_PER_DEG_LAT = 111.3195;

/**
 * Punts triats a mà sobre el meridià −3,70°E, que travessa la franja del 2026
 * de banda a banda. Les cotes són les del terreny, no les del GPS.
 */
const BURGOS: GeoLocation = { lat: 42.34, lon: -3.7, elevation: 860 };
const CAIRE_NORD: GeoLocation = { lat: 43.68, lon: -3.7, elevation: 700 };
const JUST_FORA: GeoLocation = { lat: 43.75, lon: -3.7, elevation: 700 };
const SUD_DINS: GeoLocation = { lat: 41.2, lon: -3.7, elevation: 900 };
const BARCELONA: GeoLocation = { lat: 41.3874, lon: 2.1686, elevation: 12 };
const VALENCIA: GeoLocation = { lat: 39.4699, lon: -0.3763, elevation: 15 };
const TARIFA: GeoLocation = { lat: 36.013, lon: -5.606, elevation: 20 };

const cache = new Map<string, EclipseUncertainty>();
function uncertaintyAt(eclipseId: string, location: GeoLocation): EclipseUncertainty {
  const key = `${eclipseId}|${location.lat}|${location.lon}|${location.elevation}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = computeUncertainty(
    eclipseId,
    computeLocalCircumstances(eclipseId, location),
  );
  cache.set(key, value);
  return value;
}

describe('al mig de la franja no s’ha de mencionar res', () => {
  it('Burgos, 2026: cap avís, cap resum', () => {
    const u = uncertaintyAt('2026-08-12', BURGOS);

    expect(u.centralProbability).toBe(1);
    expect(u.confidence).toBe('central-certain');
    expect(u.centralPhaseUncertain).toBe(false);
    expect(u.durationUncertain).toBe(false);
    expect(u.notable).toBe(false);
    expect(u.summary).toBeNull();
    expect(u.kmToCertainty).toBeNull();
  });

  it('Burgos, 2026: l’interval de durada és de segons, no de desenes', () => {
    const u = uncertaintyAt('2026-08-12', BURGOS);
    const spread = u.centralDurationMaxSec - u.centralDurationMinSec;

    // Poc més de dos segons sobre gairebé dos minuts: ningú no ho nota, i per
    // això la bandera de dalt està baixada.
    expect(spread).toBeLessThan(5);
    expect(u.centralDurationSec).toBeGreaterThan(100);
    expect(u.centralDurationMinSec).toBeLessThanOrEqual(u.centralDurationSec);
    expect(u.centralDurationMaxSec).toBeGreaterThanOrEqual(u.centralDurationSec);
  });

  it('València 2028 i Tarifa 2027 tampoc no diuen res', () => {
    for (const [id, place] of [
      ['2028-01-26', VALENCIA],
      ['2027-08-02', TARIFA],
    ] as const) {
      const u = uncertaintyAt(id, place);
      expect(u.centralProbability).toBe(1);
      expect(u.notable).toBe(false);
      expect(u.summary).toBeNull();
    }
  });

  it('afegir-hi el gradient de durada tampoc no en treu text', () => {
    const u = uncertaintyAt('2026-08-12', BURGOS);
    const gradient = computeDurationGradient('2026-08-12', BURGOS);
    expect(describeUncertainty(u, gradient)).toBeNull();
  });
});

describe('al caire de la franja s’ha de dir', () => {
  it('la resposta és una moneda a l’aire i es diu que ho és', () => {
    const u = uncertaintyAt('2026-08-12', CAIRE_NORD);

    expect(u.centralPhaseUncertain).toBe(true);
    expect(u.centralProbability).toBeGreaterThan(0);
    expect(u.centralProbability).toBeLessThan(1);
    expect(u.confidence).toBe('coin-flip');
    expect(u.notable).toBe(true);
    expect(u.summary).not.toBeNull();
  });

  it('la durada honesta comença a zero', () => {
    const u = uncertaintyAt('2026-08-12', CAIRE_NORD);
    // Si el biaix va en contra, des d'aquí no hi ha totalitat. Dir-ho és tota
    // la gràcia del mòdul.
    expect(u.centralDurationMinSec).toBe(0);
    expect(u.centralDurationMaxSec).toBeGreaterThan(u.centralDurationSec);
  });

  it('diu on és el límit, de quin costat, i a quants km', () => {
    const u = uncertaintyAt('2026-08-12', CAIRE_NORD);
    expect(u.limit).not.toBeNull();
    const limit = u.limit!;

    expect(limit.side).toBe('north');
    expect(limit.inside).toBe(true);
    expect(limit.km).toBeGreaterThan(0);
    expect(limit.km).toBeLessThan(3);
    expect(u.summary).toContain('límit nord');
  });

  it('dona el consell accionable: quants km i cap a on', () => {
    const u = uncertaintyAt('2026-08-12', CAIRE_NORD);

    expect(u.kmToCertainty).not.toBeNull();
    expect(u.kmToCertainty!).toBeGreaterThan(1);
    expect(u.kmToCertainty!).toBeLessThan(30);
    // Al caire nord de la franja del 2026, endins vol dir cap al sud-oest.
    expect(u.summary).toContain('sud-oest');
  });

  it('el rumb del consell és el mateix que el del gradient de durada', () => {
    const u = uncertaintyAt('2026-08-12', CAIRE_NORD);
    const gradient = computeDurationGradient('2026-08-12', CAIRE_NORD);

    expect(gradient.bearingDeg).not.toBeNull();
    const delta = Math.abs(
      ((u.limit!.inwardBearingDeg - gradient.bearingDeg! + 540) % 360) - 180,
    );
    // Dos camins independents cap a la línia central: el gradient del marge i
    // el gradient de la durada. Han de coincidir.
    expect(delta).toBeLessThan(10);
  });

  it('just per fora del límit tampoc no es tanca la porta', () => {
    const u = uncertaintyAt('2026-08-12', JUST_FORA);

    expect(u.centralPhaseUncertain).toBe(true);
    expect(u.limit!.inside).toBe(false);
    expect(u.centralDurationSec).toBe(0);
    // Amb el biaix a favor encara hi hauria totalitat, i es diu.
    expect(u.centralDurationMaxSec).toBeGreaterThan(10);
    expect(u.summary).toContain('per fora');
    expect(u.summary).toContain('no podem descartar');
  });
});

describe('clarament fora de la franja', () => {
  it('Barcelona 2026: la resposta és que no, sense matisos', () => {
    const u = uncertaintyAt('2026-08-12', BARCELONA);

    expect(u.centralProbability).toBe(0);
    expect(u.confidence).toBe('no-central-certain');
    expect(u.centralPhaseUncertain).toBe(false);
    expect(u.durationUncertain).toBe(false);
    expect(u.notable).toBe(false);
    expect(u.summary).toBeNull();
    expect(u.centralDurationMaxSec).toBe(0);
  });
});

describe('la derivació, número a número', () => {
  it('la probabilitat surt de la distribució de l’arcsinus', () => {
    const sigma = RELATIVE_POSITION_ERROR_ARCSEC;

    // Al límit exacte, mitja moneda.
    expect(centralProbabilityFromMargin(0, sigma)).toBeCloseTo(0.5, 12);
    // Suport acotat: fora de ±σ no hi ha dubte, i això és el que permet callar.
    expect(centralProbabilityFromMargin(-sigma, sigma)).toBe(1);
    expect(centralProbabilityFromMargin(sigma, sigma)).toBe(0);
    expect(centralProbabilityFromMargin(-100, sigma)).toBe(1);
    expect(centralProbabilityFromMargin(100, sigma)).toBe(0);
    // Monòtona decreixent amb el marge.
    let previous = 1;
    for (let margin = -sigma; margin <= sigma; margin += sigma / 20) {
      const p = centralProbabilityFromMargin(margin, sigma);
      expect(p).toBeLessThanOrEqual(previous + 1e-12);
      previous = p;
    }
  });

  it('la bandera coincideix EXACTAMENT amb edgeUncertain de contacts.ts', () => {
    // Si els dos se separessin, la interfície podria ensenyar «vora incerta»
    // amb una confiança de l'1 al costat.
    for (let lat = 43.55; lat <= 43.85; lat += 0.03) {
      const location: GeoLocation = { lat, lon: -3.7, elevation: 700 };
      const circumstances = computeLocalCircumstances('2026-08-12', location);
      const u = computeUncertainty('2026-08-12', circumstances, {
        locateSeaLevelLimit: false,
      });
      expect(u.centralPhaseUncertain).toBe(circumstances.edgeUncertain);
    }
  });

  it('la velocitat angular relativa cau on ha de caure', () => {
    // La capçalera de contacts.ts la situa entre 0,4 i 0,6 segons d'arc per
    // segon segons l'eclipsi. Si aquesta mesura se n'anés, tots els intervals
    // de temps quedarien mal escalats sense que res més ho denunciés.
    const rates = [
      uncertaintyAt('2026-08-12', BURGOS).relativeRateArcsecPerSec,
      uncertaintyAt('2027-08-02', TARIFA).relativeRateArcsecPerSec,
      uncertaintyAt('2028-01-26', VALENCIA).relativeRateArcsecPerSec,
    ];
    for (const rate of rates) {
      expect(rate).toBeGreaterThan(0.4);
      expect(rate).toBeLessThan(0.62);
    }
    // El 2026 és el més ràpid dels tres i el 2028 el més lent.
    expect(rates[0]).toBeGreaterThan(rates[2]);
  });

  it('l’interval dels contactes cobreix els desplaçaments mesurats de veritat', () => {
    // contacts.ts documenta −3,6 a −3,9 s el 2026 i +4,4 s el 2024 contra JPL
    // Horizons. Arrodonit cap amunt, el nostre marge els ha de cobrir.
    const u = uncertaintyAt('2026-08-12', BURGOS);
    expect(u.contactHalfWidthSec).toBeGreaterThan(3);
    expect(Math.ceil(u.contactHalfWidthSec)).toBeGreaterThanOrEqual(4);

    const text = describeContactPrecision(u);
    expect(text).toContain('4 s');
    expect(text).toContain('JPL Horizons');
    // No entra mai al resum automàtic: no canvia cap decisió.
    expect(u.summary ?? '').not.toContain('hores de contacte');
  });

  it('la zona incerta no fa el mateix a cada eclipsi', () => {
    const dosMilVintiSis = uncertaintyAt('2026-08-12', CAIRE_NORD).limitUncertaintyKm;
    const dosMilVintiSet = uncertaintyAt('2027-08-02', TARIFA).limitUncertaintyKm;

    // El 2026 la Lluna tot just cobreix el Sol: el marge canvia molt a poc a
    // poc sobre el terreny i la zona on no podem decidir és molt més ampla.
    expect(dosMilVintiSis).toBeGreaterThan(8);
    expect(dosMilVintiSis).toBeLessThan(12);
    expect(dosMilVintiSet).toBeGreaterThan(2.5);
    expect(dosMilVintiSet).toBeLessThan(5);
    expect(dosMilVintiSis).toBeGreaterThan(2 * dosMilVintiSet);
  });

  it('la distància al límit és la distància a l’arrel del marge', () => {
    // Aquesta és la prova que valida la linealització marge/gradient: es busca
    // per bisecció on el marge val zero seguint el rumb cap enfora, i es
    // compara amb el número que publiquem.
    const u = uncertaintyAt('2026-08-12', CAIRE_NORD);
    const bearing = u.limit!.bearingDeg;

    const marginAt = (km: number): number => {
      const rad = (bearing * Math.PI) / 180;
      const lonKm = KM_PER_DEG_LAT * Math.cos((CAIRE_NORD.lat * Math.PI) / 180);
      return computeLocalCircumstances('2026-08-12', {
        lat: CAIRE_NORD.lat + (km * Math.cos(rad)) / KM_PER_DEG_LAT,
        lon: CAIRE_NORD.lon + (km * Math.sin(rad)) / lonKm,
        elevation: CAIRE_NORD.elevation,
      }).umbralMarginArcsec;
    };

    let lo = 0;
    let hi = 40;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (marginAt(mid) < 0) lo = mid;
      else hi = mid;
    }
    const rootKm = (lo + hi) / 2;

    expect(u.limit!.km).toBeCloseTo(rootKm, 1);
  });

  it('els dos motors que situen la franja no se separen més del que diem', () => {
    // `contacts.ts` resol la separació angular amb astronomy-engine;
    // `eclipses/path.ts` genera el límit amb els elements besselians del GSFC.
    // Són camins independents. La seva discrepància ha de quedar dins de la
    // mateixa incertesa que aquest mòdul publica — si no, o el nostre número és
    // massa petit o hi ha un error en algun dels dos.
    const cases: [string, GeoLocation][] = [
      ['2026-08-12', BURGOS],
      ['2026-08-12', CAIRE_NORD],
      ['2026-08-12', SUD_DINS],
      ['2027-08-02', TARIFA],
      ['2028-01-26', VALENCIA],
    ];

    for (const [id, place] of cases) {
      const u = uncertaintyAt(id, place);
      const limit = u.limit!;
      expect(limit.seaLevelKm).not.toBeNull();

      const corrected = limit.seaLevelKm! + limit.elevationShiftKm;
      const disagreement = Math.abs(corrected - limit.km);
      expect(disagreement).toBeLessThan(u.limitUncertaintyKm);
    }
  });

  it('l’amplada de la franja que en surt és la que fa', () => {
    // 2026: uns 290-300 km sobre la Península. 2028: més ampla perquè el Sol hi
    // arriba encara més baix.
    const width2026 = uncertaintyAt('2026-08-12', BURGOS).limit!.bandWidthKm;
    expect(width2026).toBeGreaterThan(280);
    expect(width2026).toBeLessThan(320);
  });
});

describe('a quin costat de la franja ets', () => {
  it('el nord i el sud es reparteixen com toca al llarg del meridià', () => {
    const nord = uncertaintyAt('2026-08-12', CAIRE_NORD).limit!;
    const sud = uncertaintyAt('2026-08-12', SUD_DINS).limit!;

    expect(nord.side).toBe('north');
    expect(sud.side).toBe('south');
    // Els dos són a dins, i cadascun mira cap a la seva vora: un cap al
    // nord-est, l'altre cap al sud-oest. Els rumbs han de quedar oposats.
    const separation = Math.abs(
      ((nord.bearingDeg - sud.bearingDeg + 540) % 360) - 180,
    );
    expect(separation).toBeGreaterThan(160);
  });

  it('a fora, el límit més proper queda cap endins', () => {
    const limit = uncertaintyAt('2026-08-12', JUST_FORA).limit!;
    expect(limit.inside).toBe(false);
    expect(limit.side).toBe('north');
    expect(limit.bearingDeg).toBeCloseTo(limit.inwardBearingDeg, 6);
  });
});

describe('el text', () => {
  const texts = () =>
    [
      uncertaintyAt('2026-08-12', CAIRE_NORD),
      uncertaintyAt('2026-08-12', JUST_FORA),
      uncertaintyAt('2027-08-02', { lat: 36.72, lon: -4.42, elevation: 11 }),
    ].map((u) => describeUncertainty(u, computeDurationGradient(u.eclipseId, u.location)));

  it('sempre diu d’on surt la xifra', () => {
    for (const text of texts()) {
      expect(text).not.toBeNull();
      expect(text).toContain('JPL Horizons');
      expect(text).toContain('segons d’arc');
    }
  });

  it('no crida, no s’entusiasma i no porta emojis', () => {
    for (const text of texts()) {
      expect(text).not.toMatch(/[!¡]/);
      expect(text).not.toMatch(
        /[\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{FE0F}]/u,
      );
      expect(text!.toLowerCase()).not.toMatch(
        /increïble|espectacular|fantàstic|no et perdis|imperdible/,
      );
    }
  });

  it('escriu els decimals amb coma', () => {
    const text = describeUncertainty(uncertaintyAt('2026-08-12', CAIRE_NORD));
    expect(text).toMatch(/\d,\d km/);
    expect(text).not.toMatch(/\d\.\d km/);
  });
});

describe('l’amplada de la franja no depèn d’on la miris', () => {
  /*
   * LA V DEL VÈRTEX. El marge umbral és `D − R` amb `D` la distància a l'eix de
   * l'ombra, i `D` val zero justament sobre la línia central: la superfície és
   * una V, no un pla. La diferència centrada que la calculava trepitjava el
   * vèrtex, restava dos pendents de signe contrari i es cancel·lava.
   *
   * AIXÒ ÉS EL QUE ES VEIA. Sevilla, 26-01-2028, sobre la línia central:
   * l'aplicació publicava una franja de 1.866 km d'amplada —cinc vegades la
   * real, sobre una península que en fa mil— mentre que a Cadis, el mateix
   * eclipsi i a noranta quilòmetres, en publicava 355.
   *
   * El test no fixa cap xifra absoluta a posta: el que ha de quedar clavat és
   * que dos punts del mateix eclipsi no poden discrepar, perquè és una propietat
   * de la geometria i no del mètode que la mesuri.
   */
  const sameEclipse: Array<[string, string, GeoLocation, GeoLocation]> = [
    [
      '2028-01-26',
      'Sevilla (línia central) i Cadis',
      { lat: 37.3891, lon: -5.9845, elevation: 12 },
      { lat: 36.5271, lon: -6.2886, elevation: 10 },
    ],
    [
      '2026-08-12',
      'Oviedo (línia central) i Iturmendi (caire)',
      { lat: 43.3619, lon: -5.8494, elevation: 232 },
      { lat: 42.8799, lon: -2.1247, elevation: 570 },
    ],
  ];

  for (const [id, label, a, b] of sameEclipse) {
    it(`${label} publiquen la mateixa amplada`, () => {
      const wa = uncertaintyAt(id, a).limit?.bandWidthKm;
      const wb = uncertaintyAt(id, b).limit?.bandWidthKm;
      expect(wa).toBeDefined();
      expect(wb).toBeDefined();
      // Un 15 %: el gradient es mesura al punt i la franja no és un rectangle.
      expect(Math.abs(wa! - wb!) / wb!).toBeLessThan(0.15);
    });
  }

  it('sobre la línia central l’amplada segueix sent d’ordre peninsular', () => {
    const width = uncertaintyAt('2028-01-26', {
      lat: 37.3891,
      lon: -5.9845,
      elevation: 12,
    }).limit?.bandWidthKm;
    expect(width).toBeGreaterThan(200);
    expect(width).toBeLessThan(500);
  });
});
