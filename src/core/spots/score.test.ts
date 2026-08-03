/**
 * Proves de la puntuació.
 *
 * La nota d'un lloc és una decisió editorial i no una llei física: aquí no es
 * comprova cap valor de referència extern, sinó que el marcador digui el que
 * `score.ts` promet que dirà. Cada prova és una frase del consell que l'app
 * dona a l'usuari, escrita en forma de comprovació.
 */

import { describe, expect, it } from 'vitest';
import {
  ALTITUDE_FULL_M,
  ALTITUDE_ZERO_M,
  CLEARANCE_FULL_DEG,
  DEFAULT_SPOT_WEIGHTS,
  compareSpots,
  scoreSpot,
  type SpotScoreInput,
} from './score';

/** Cas base: tot al mig, perquè cada prova en mogui una sola cosa. */
function baseline(overrides: Partial<SpotScoreInput> = {}): SpotScoreInput {
  return {
    centralVisibleSec: 50,
    bestCentralSec: 100,
    clearanceDeg: 0.75,
    distanceKm: 10,
    radiusKm: 25,
    elevationM: 1000,
    originElevationM: 1000,
    ...overrides,
  };
}

describe('pesos', () => {
  it('sumen 1', () => {
    const { centralSeconds, clearance, closeness, altitude } = DEFAULT_SPOT_WEIGHTS;
    expect(centralSeconds + clearance + closeness + altitude).toBeCloseTo(1, 12);
  });

  it('els segons de fase central pesen més que tota la resta junta', () => {
    const { centralSeconds, clearance, closeness, altitude } = DEFAULT_SPOT_WEIGHTS;
    expect(centralSeconds).toBeGreaterThan(clearance + closeness + altitude);
  });
});

describe('termes', () => {
  it('un lloc perfecte val 100 i un de nul val 0', () => {
    const best = scoreSpot({
      centralVisibleSec: 100,
      bestCentralSec: 100,
      clearanceDeg: CLEARANCE_FULL_DEG,
      distanceKm: 0,
      radiusKm: 25,
      elevationM: 1000 + ALTITUDE_FULL_M,
      originElevationM: 1000,
    });
    expect(best.score).toBeCloseTo(100, 9);

    const worst = scoreSpot({
      centralVisibleSec: 0,
      bestCentralSec: 100,
      clearanceDeg: -5,
      distanceKm: 25,
      radiusKm: 25,
      elevationM: 1000 + ALTITUDE_ZERO_M,
      originElevationM: 1000,
    });
    expect(worst.score).toBeCloseTo(0, 9);
  });

  it('normalitza els segons contra la MILLOR durada de la zona, no contra la pròpia', () => {
    // El cas que justifica la decisió: 10 s vistos sencers no poden guanyar a
    // 95 s vistos de 100. Si es normalitzés contra la durada pròpia, el primer
    // valdria 1 i el segon 0,95, i el consell seria exactament l'invers del bo.
    const petit = scoreSpot(baseline({ centralVisibleSec: 10, bestCentralSec: 100 }));
    const gran = scoreSpot(baseline({ centralVisibleSec: 95, bestCentralSec: 100 }));
    expect(gran.parts.centralSeconds).toBeGreaterThan(petit.parts.centralSeconds);
    expect(gran.score).toBeGreaterThan(petit.score);
  });

  it('sense franja dins del radi, el terme de segons val 0 per a tothom', () => {
    const result = scoreSpot(baseline({ bestCentralSec: 0, centralVisibleSec: 0 }));
    expect(result.parts.centralSeconds).toBe(0);
    // La classificació encara existeix: la fan l'horitzó i la distància.
    const aProp = scoreSpot(baseline({ bestCentralSec: 0, centralVisibleSec: 0, distanceKm: 2 }));
    expect(aProp.score).toBeGreaterThan(result.score);
  });

  it('el marge d’horitzó se satura a 1,5° i no premia més amunt', () => {
    const just = scoreSpot(baseline({ clearanceDeg: CLEARANCE_FULL_DEG }));
    const molt = scoreSpot(baseline({ clearanceDeg: 40 }));
    expect(just.parts.clearance).toBe(1);
    expect(molt.parts.clearance).toBe(1);
    expect(molt.score).toBeCloseTo(just.score, 12);
  });

  it('el marge negatiu no resta per sota de zero', () => {
    const result = scoreSpot(baseline({ clearanceDeg: -12 }));
    expect(result.parts.clearance).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('la proximitat és lineal i val 1 on ets', () => {
    const aqui = scoreSpot(baseline({ distanceKm: 0 }));
    const mig = scoreSpot(baseline({ distanceKm: 12.5 }));
    const vora = scoreSpot(baseline({ distanceKm: 25 }));
    expect(aqui.parts.closeness).toBe(1);
    expect(mig.parts.closeness).toBeCloseTo(0.5, 12);
    expect(vora.parts.closeness).toBe(0);
  });

  it('baixar cap al fons de la vall anul·la el terme d’altura', () => {
    const avall = scoreSpot(baseline({ elevationM: 1000 + ALTITUDE_ZERO_M - 50 }));
    const igual = scoreSpot(baseline({ elevationM: 1000 }));
    const amunt = scoreSpot(baseline({ elevationM: 1000 + ALTITUDE_FULL_M }));
    expect(avall.parts.altitude).toBe(0);
    expect(amunt.parts.altitude).toBe(1);
    expect(igual.parts.altitude).toBeGreaterThan(0);
    expect(igual.parts.altitude).toBeLessThan(1);
  });

  it('l’altura pesa menys que el marge d’horitzó, i molt menys que els segons', () => {
    // Comprovat pel seu efecte i no pels números dels pesos: guanyar 300 m no
    // pot compensar perdre tot el marge d'horitzó.
    const altSenseMarge = scoreSpot(
      baseline({ clearanceDeg: 0, elevationM: 1000 + ALTITUDE_FULL_M }),
    );
    const baixAmbMarge = scoreSpot(
      baseline({ clearanceDeg: CLEARANCE_FULL_DEG, elevationM: 1000 }),
    );
    expect(baixAmbMarge.score).toBeGreaterThan(altSenseMarge.score);
  });
});

describe('robustesa', () => {
  it('cap entrada raonable no produeix NaN', () => {
    const casos: SpotScoreInput[] = [
      baseline({ bestCentralSec: 0 }),
      baseline({ radiusKm: 0 }),
      baseline({ centralVisibleSec: Number.NaN }),
      baseline({ clearanceDeg: Number.NaN }),
      baseline({ elevationM: Number.NaN }),
      baseline({ distanceKm: Number.POSITIVE_INFINITY }),
    ];
    for (const cas of casos) {
      const result = scoreSpot(cas);
      expect(Number.isFinite(result.score)).toBe(true);
      for (const value of Object.values(result.parts)) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it('uns pesos qualssevol segueixen donant una nota de 0 a 100', () => {
    const result = scoreSpot(
      baseline({
        centralVisibleSec: 100,
        clearanceDeg: 3,
        distanceKm: 0,
        elevationM: 2000,
        weights: { centralSeconds: 3, clearance: 1, closeness: 1, altitude: 1 },
      }),
    );
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('amb tots els pesos a zero la nota és zero i no una divisió indefinida', () => {
    const result = scoreSpot(
      baseline({ weights: { centralSeconds: 0, clearance: 0, closeness: 0, altitude: 0 } }),
    );
    expect(result.score).toBe(0);
  });
});

describe('ordre de la llista', () => {
  it('primer la nota, i a igualtat de nota el més a prop', () => {
    const llista = [
      { score: 80, distanceKm: 3 },
      { score: 90, distanceKm: 20 },
      { score: 80, distanceKm: 1 },
    ];
    const ordenada = llista.slice().sort(compareSpots);
    expect(ordenada.map((s) => s.distanceKm)).toEqual([20, 1, 3]);
  });
});

describe('el desempat per altura', () => {
  it('a nota igual i segons pràcticament iguals, guanya el lloc alt encara que sigui més lluny', () => {
    // 100,2 i 99,8 són el mateix segon a efectes pràctics: el model barat del
    // garbell té 0,36 s d'error mesurat i ordenar per dècimes seria ordenar
    // pel soroll. Aquí el desempat és la cota: arran d'horitzó, la calitja fa
    // la mateixa feina que una muntanya, i el lloc alt compra marge.
    const cim = { score: 80, distanceKm: 12, centralVisibleSec: 100.2, elevation: 700 };
    const vall = { score: 80, distanceKm: 2, centralVisibleSec: 99.8, elevation: 150 };
    expect(compareSpots(cim, vall)).toBeLessThan(0);
    expect(compareSpots(vall, cim)).toBeGreaterThan(0);
  });

  it('l’altura no usurpa mai el tron: qui té més segons guanya sempre', () => {
    // La garantia del producte: un cim tapat perd contra una vall neta. Dos
    // mil cinc-cents metres de cota no compren ni un segon de fase central.
    const vallAmbSegons = {
      score: 80,
      distanceKm: 20,
      centralVisibleSec: 90,
      elevation: 100,
    };
    const cimTapat = {
      score: 80,
      distanceKm: 1,
      centralVisibleSec: 80,
      elevation: 2500,
    };
    expect(compareSpots(vallAmbSegons, cimTapat)).toBeLessThan(0);
    expect(compareSpots(cimTapat, vallAmbSegons)).toBeGreaterThan(0);
  });

  it('amb segons i cota idèntics, decideix la distància, com sempre', () => {
    const aProp = { score: 80, distanceKm: 2, centralVisibleSec: 100, elevation: 500 };
    const lluny = { score: 80, distanceKm: 9, centralVisibleSec: 100, elevation: 500 };
    expect(compareSpots(aProp, lluny)).toBeLessThan(0);
  });

  it('sense segons a la vista, la cota no decideix res: cap desempat cec', () => {
    // Si no sabem els segons de tots dos, l'altura no pot manar: la promesa
    // és que només desempata entre llocs PROVADAMENT iguals en segons.
    const alt = { score: 80, distanceKm: 9, elevation: 900 };
    const baix = { score: 80, distanceKm: 2, elevation: 100 };
    expect(compareSpots(baix, alt)).toBeLessThan(0);
  });
});
