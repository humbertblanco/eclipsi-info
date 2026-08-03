/**
 * Que la fallada de «Prepara'm per anar-hi» no torni a ser una frase.
 *
 * PER QUÈ VAL LA PENA. La línia que veia l'usuari era aquesta, sencera:
 *
 *   «No se ha podido completar la preparación: No s'ha pogut baixar cap
 *    tessel·la del terreny. Comprova la connexió i torna-ho a provar.»
 *
 * Fora, castellà; dins, català. I la part catalana era justament la que deia
 * QUÈ FER. `prepare.ts` escrivia la frase i `OfflinePanel` la interpolava.
 *
 * QUÈ ES PROVA I QUÈ NO. Aquí no s'executa `prepareLocation`: demana xarxa,
 * Cache Storage i un Worker, i el que ha de vigilar aquest fitxer és el
 * CONTRACTE de la fallada, que és pur. Que el motiu de l'horitzó arribi sencer
 * fins aquí és el que fa que la pantalla pugui distingir «no ha arribat gens
 * de relleu» de «n'ha arribat una part», que porten a consells diferents.
 */

import { describe, expect, it } from 'vitest';
import { HorizonComputeError } from '../core/horizon/errors';
import {
  isAbortError,
  PREPARE_ERROR_CODES,
  PrepareError,
  toPrepareFailure,
  type PrepareErrorCode,
} from './prepare';

describe('la unió de codis és tancada i es pot assertar', () => {
  it('cap codi no és una frase: només minúscules i guionets', () => {
    for (const code of PREPARE_ERROR_CODES) {
      expect(code).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it('la llista i el tipus no poden separar-se', () => {
    const exhaustive: Record<PrepareErrorCode, true> = {
      'no-terrain': true,
      horizon: true,
      unknown: true,
    };
    expect(Object.keys(exhaustive).sort()).toEqual([...PREPARE_ERROR_CODES].sort());
  });

  it('el `message` de l’excepció és el codi, no una frase', () => {
    expect(new PrepareError({ code: 'no-terrain' }).message).toBe('no-terrain');
  });
});

describe('toPrepareFailure', () => {
  it('reconeix la seva pròpia excepció', () => {
    const error = new PrepareError({ code: 'no-terrain' });
    expect(toPrepareFailure(error)).toEqual({ code: 'no-terrain' });
  });

  it('el motiu de l’horitzó arriba sencer i no es resumeix', () => {
    // Sense això, «no ha baixat gens de relleu» i «n'ha baixat una part» es
    // dirien igual, i al camp la diferència decideix si val la pena esperar-se
    // o si cal moure's a buscar cobertura.
    const parcial = toPrepareFailure(
      new HorizonComputeError({ code: 'tiles-incomplete', loaded: 4, total: 200 }),
    );
    expect(parcial.code).toBe('horizon');
    expect(parcial.horizon).toEqual({ code: 'tiles-incomplete', loaded: 4, total: 200 });

    const gens = toPrepareFailure(new HorizonComputeError({ code: 'no-terrain' }));
    expect(gens).toEqual({ code: 'horizon', horizon: { code: 'no-terrain' } });
  });

  it('el que no reconeix cau a `unknown` i no llança mai', () => {
    for (const rar of [undefined, null, 42, [], new TypeError('boom')]) {
      expect(toPrepareFailure(rar)).toEqual({ code: 'unknown' });
    }
  });
});

describe('cancel·lar no és fallar', () => {
  it('l’avortament segueix reconeixent-se pel `name` i no pel text', () => {
    // El text de l'`AbortError` era «Precàrrega cancel·lada» i ara és un codi:
    // el que no pot canviar és que `isAbortError` el segueixi veient, o el
    // panell ensenyaria un error vermell a qui acaba de prémer «Atura».
    expect(isAbortError(new DOMException('cancelled', 'AbortError'))).toBe(true);
    expect(isAbortError(new PrepareError({ code: 'no-terrain' }))).toBe(false);
  });
});
