/**
 * Les franges: que parteixin on diuen, i que el que en surt sigui sempre una
 * paraula que el vocabulari accepti.
 *
 * L'ÚLTIM TEST ÉS EL QUE IMPORTA de debò. Les funcions de franja i la taula del
 * vocabulari són dos fitxers, i el compilador ja els lliga pels tipus; però els
 * tipus s'esborren i la porta comprova cadenes en execució. Aquest test tanca
 * el cercle: sigui quin sigui el número que hi entri —inclosos els que no
 * s'haurien de veure mai—, el que en surt travessa la porta.
 */

import { describe, it, expect } from 'vitest';
import { durationBucket, rankBucket, terrainBucket, waitBucket } from './buckets';
import { sanitizeEvent } from './sanitize';

describe('les franges d’espera', () => {
  it('parteixen a un, cinc i quinze segons', () => {
    expect(waitBucket(0)).toBe('under_one_s');
    expect(waitBucket(999)).toBe('under_one_s');
    expect(waitBucket(1_000)).toBe('one_to_five_s');
    expect(waitBucket(4_999)).toBe('one_to_five_s');
    expect(waitBucket(5_000)).toBe('five_to_fifteen_s');
    expect(waitBucket(14_999)).toBe('five_to_fifteen_s');
    expect(waitBucket(15_000)).toBe('over_fifteen_s');
  });

  it('situen les mesures reals de la cerca de llocs on toca', () => {
    // 6,1 s a Sòria i 14,5 s a Barcelona (`core/spots/search.ts`, mesurats amb
    // xarxa de debò). Si una passada d'aquestes surt `over_fifteen_s`, l'embut
    // s'ha degradat i la columna del panell ho dirà sense que ningú hi torni.
    expect(waitBucket(6_100)).toBe('five_to_fifteen_s');
    expect(waitBucket(14_500)).toBe('five_to_fifteen_s');
  });

  it('una espera que no s’ha pogut mesurar es diu així i no s’arrodoneix', () => {
    for (const ms of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(waitBucket(ms), String(ms)).toBe('unknown');
    }
  });
});

describe('les franges de durada', () => {
  it('parteixen al minut i als dos minuts', () => {
    expect(durationBucket(0)).toBe('none');
    expect(durationBucket(59.9)).toBe('under_one_min');
    expect(durationBucket(60)).toBe('one_to_two_min');
    expect(durationBucket(119.9)).toBe('one_to_two_min');
    expect(durationBucket(120)).toBe('over_two_min');
  });

  it('no inventen durada quan el número no es pot llegir', () => {
    for (const sec of [Number.NaN, Number.NEGATIVE_INFINITY, -5]) {
      expect(durationBucket(sec), String(sec)).toBe('none');
    }
  });

  it('una durada exacta no es pot reconstruir de la franja', () => {
    // La raó de ser de tot això: 97,3 s i 101,8 s són corbes diferents sobre el
    // mapa i han de sortir indistingibles.
    expect(durationBucket(97.3)).toBe(durationBucket(101.8));
  });
});

describe('què li fa el relleu a la fase central', () => {
  it('sense fase central no diu que el terreny no molesti', () => {
    // Un parcial no té res que el relleu pugui robar d'aquesta magnitud;
    // comptar-ho com a `clear` ompliria la columna bona de casos muts.
    expect(terrainBucket(0, 0)).toBe('unknown');
    expect(terrainBucket(null, 12)).toBe('unknown');
    expect(terrainBucket(12, null)).toBe('unknown');
    expect(terrainBucket(Number.NaN, 12)).toBe('unknown');
  });

  it('distingeix el que el terreny deixa intacte, retalla o es menja', () => {
    expect(terrainBucket(102.1, 102.1)).toBe('clear');
    expect(terrainBucket(102.1, 101.8)).toBe('clear'); // arrodoniment del segon a segon
    expect(terrainBucket(102.1, 61)).toBe('trimmed');
    expect(terrainBucket(102.1, 0)).toBe('blocked');
  });
});

describe('el rang del lloc triat', () => {
  it('distingeix el primer, els tres primers i la resta', () => {
    expect(rankBucket(0)).toBe('first');
    expect(rankBucket(1)).toBe('top_three');
    expect(rankBucket(2)).toBe('top_three');
    expect(rankBucket(3)).toBe('rest');
    expect(rankBucket(40)).toBe('rest');
  });

  it('un índex impossible no es converteix en un primer lloc', () => {
    for (const index of [-1, Number.NaN]) {
      expect(rankBucket(index), String(index)).toBe('rest');
    }
  });
});

describe('les franges i la porta parlen el mateix idioma', () => {
  it('tot el que surt d’una franja travessa la porta', () => {
    const numeros = [
      0, 1, 0.5, 59, 60, 97.3, 120, 999, 1_000, 5_000, 15_000, 86_400_000,
      -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
    ];

    for (const n of numeros) {
      expect(
        sanitizeEvent('heat_render', { source: 'cache', wait: waitBucket(n) }).ok,
        `waitBucket(${n})`,
      ).toBe(true);

      expect(
        sanitizeEvent('spot_pick', { rank: rankBucket(n) }).ok,
        `rankBucket(${n})`,
      ).toBe(true);

      expect(
        sanitizeEvent('verdict_shown', {
          kind: 'total',
          duration: durationBucket(n),
          terrain: terrainBucket(120, n),
        }).ok,
        `durationBucket(${n})`,
      ).toBe(true);
    }
  });
});
