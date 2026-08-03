/**
 * Que la fallada del cercador no torni a ser una frase.
 *
 * PER QUÈ VAL LA PENA. El text que arribava a la pantalla era «El cercador ha
 * fallat: No s'ha pogut baixar cap tessel·la del terreny. Comprova la
 * connexió.», i la meitat de dins estava escrita en català dins de
 * `core/spots/search.ts`. La capçalera del diccionari del cercador ho donava
 * per bo dient que el motiu era «tècnic»: no ho era. «Comprova la connexió» és
 * l'única part accionable de tot l'avís, i és justament la que no es traduïa.
 *
 * SENSE XARXA. `searchSpots` accepta la precàrrega de tessel·les per
 * paràmetre; aquí s'hi injecta una que no en baixa cap, que és el cas real de
 * la cobertura morta i és determinista.
 */

import { describe, expect, it } from 'vitest';
import { HorizonComputeError } from '../horizon/errors';
import {
  isSpotSearchCancelled,
  SPOT_SEARCH_ERROR_CODES,
  SpotSearchError,
  toSpotSearchFailure,
  type SpotSearchErrorCode,
} from './errors';
import { searchSpots } from './search';
import type { ElevationReader, SpotSearchOptions } from './types';

const SORIA = { lat: 41.7665, lon: -2.479, elevation: 1000 };
const ECLIPSE = '2026-08-12';

/** Altiplà pla: el terreny mai no és el problema en aquestes proves. */
const ALTIPLA: ElevationReader = () => 1000;

/** Una precàrrega que no baixa res: cobertura morta, el cas del turó. */
const RES: NonNullable<SpotSearchOptions['prefetch']> = (tiles) =>
  Promise.resolve({ requested: tiles.length, loaded: 0, failed: tiles.length });

describe('la unió de codis és tancada i es pot assertar', () => {
  it('cap codi no és una frase: només minúscules i guionets', () => {
    for (const code of SPOT_SEARCH_ERROR_CODES) {
      expect(code).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it('la llista i el tipus no poden separar-se', () => {
    const exhaustive: Record<SpotSearchErrorCode, true> = {
      cancelled: true,
      'no-terrain': true,
      'terrain-incomplete': true,
      unknown: true,
    };
    expect(Object.keys(exhaustive).sort()).toEqual([...SPOT_SEARCH_ERROR_CODES].sort());
  });
});

describe('toSpotSearchFailure', () => {
  it('el `message` de l’excepció és el codi, no una frase', () => {
    expect(new SpotSearchError('no-terrain').message).toBe('no-terrain');
  });

  it('sobreviu al clonatge estructurat i al pont de text', () => {
    expect(toSpotSearchFailure({ code: 'no-terrain' })).toEqual({ code: 'no-terrain' });
    expect(toSpotSearchFailure('cancelled')).toEqual({ code: 'cancelled' });
    expect(toSpotSearchFailure(new Error('no-terrain'))).toEqual({ code: 'no-terrain' });
  });

  it('tradueix la fallada de l’horitzó en comptes d’engolir-la', () => {
    // L'etapa D2 crida `computeHorizonProfile` de debò: la seva fallada surt
    // per aquí sense passar per cap `catch`. Si es resumís com a `unknown`,
    // l'usuari llegiria «ha fallat» en comptes de «falta relleu».
    const horitzo = new HorizonComputeError({ code: 'tiles-incomplete', loaded: 2, total: 90 });
    expect(toSpotSearchFailure(horitzo)).toEqual({ code: 'terrain-incomplete' });
    expect(toSpotSearchFailure(new HorizonComputeError({ code: 'no-terrain' }))).toEqual({
      code: 'no-terrain',
    });
    expect(isSpotSearchCancelled(new HorizonComputeError({ code: 'cancelled' }))).toBe(true);
  });

  it('el que no reconeix cau a `unknown` i no llança mai', () => {
    for (const rar of [undefined, null, 42, [], new TypeError('boom')]) {
      expect(toSpotSearchFailure(rar)).toEqual({ code: 'unknown' });
    }
  });
});

describe('searchSpots no torna mai prosa', () => {
  it('un senyal ja cancel·lat dona el codi `cancelled`', async () => {
    const controller = new AbortController();
    controller.abort();

    const error = await searchSpots({
      eclipseId: ECLIPSE,
      origin: SORIA,
      signal: controller.signal,
      elevation: ALTIPLA,
      prefetch: RES,
    }).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(SpotSearchError);
    expect(toSpotSearchFailure(error).code).toBe('cancelled');
    expect((error as Error).message).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it('sense cap tessel·la, el codi és `no-terrain`', async () => {
    const error = await searchSpots({
      eclipseId: ECLIPSE,
      origin: SORIA,
      // Radi curt: la prova mira el camí del codi, no la geografia.
      radiusKm: 6,
      spacingKm: 2,
      elevation: ALTIPLA,
      prefetch: RES,
    }).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(toSpotSearchFailure(error).code).toBe('no-terrain');
    expect((error as Error).message).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });
});
