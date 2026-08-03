/**
 * Que la fallada de l'horitzó no torni a ser una frase.
 *
 * PER QUÈ VAL LA PENA PROVAR UNS CODIS. Perquè el defecte que aquestes proves
 * caçen ja hi era, escrit i documentat: ESTAT.md §4 deia que «els ERRORS de
 * l'horitzó encara viatgen en català», i el text que arribava a l'usuari era
 * «Només s'han pogut baixar 3 de 150 tessel·les del terreny… Comprova la
 * connexió». Qui tenia l'app en castellà rebia aquella frase tal qual, just al
 * moment en què l'app li havia fallat.
 *
 * Un test que només comprovés que `computeHorizonProfile` peta no vigilaria
 * res: petava abans i petava malament. El que es prova aquí és que el que
 * SURT és una DADA d'una unió tancada, que no conté cap prosa, i que
 * sobreviu a les tres travessies que fa de veritat: el `throw` directe, el
 * `postMessage` (objecte pla clonat) i el pont de text del Worker d'avui.
 *
 * SENSE XARXA. El camí de les tessel·les incompletes es prova substituint
 * `fetch` per un que sempre falla: és exactament el que passa al camp amb
 * cobertura dolenta, i deixa la prova determinista i instantània.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HORIZON_ERROR_CODES,
  HorizonComputeError,
  isHorizonCancelled,
  toHorizonFailure,
  type HorizonErrorCode,
  type HorizonFailure,
} from './errors';
import { clipRings, computeHorizonProfile } from './raycast';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('la unió de codis és tancada i es pot assertar', () => {
  it('cap codi no és una frase: només minúscules i guionets', () => {
    // Si algú hi torna a posar text, això peta. Un codi amb espais, accents o
    // majúscules és una frase disfressada, i una frase no es pot traduir des
    // de la capa de vista.
    for (const code of HORIZON_ERROR_CODES) {
      expect(code).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it('la llista i el tipus no poden separar-se', () => {
    // `HORIZON_ERROR_CODES` és el que recorren els tests i el que fa servir la
    // porta d'analítica; el tipus és el que fa servir el `switch` exhaustiu de
    // la capa de vista. Si algú n'afegeix un al tipus i no a la llista, aquesta
    // assignació deixa de compilar.
    const exhaustive: Record<HorizonErrorCode, true> = {
      cancelled: true,
      'tiles-incomplete': true,
      'no-terrain': true,
      unknown: true,
    };
    expect(Object.keys(exhaustive).sort()).toEqual([...HORIZON_ERROR_CODES].sort());
  });
});

describe('toHorizonFailure', () => {
  it('reconeix la nostra excepció i en conserva les xifres', () => {
    const error = new HorizonComputeError({
      code: 'tiles-incomplete',
      loaded: 3,
      total: 150,
    });
    expect(toHorizonFailure(error)).toEqual({
      code: 'tiles-incomplete',
      loaded: 3,
      total: 150,
    });
  });

  it('el `message` de l’excepció és el codi, no una frase', () => {
    // És el que fa que el pont del Worker funcioni i el que treu el català de
    // la consola d'errors.
    expect(new HorizonComputeError({ code: 'no-terrain' }).message).toBe('no-terrain');
  });

  it('sobreviu al clonatge estructurat: la dada plana es reconeix', () => {
    // El que travessa un `postMessage` és això, no la classe: el clonatge es
    // deixa la subclasse i les propietats afegides pel camí.
    const wire: HorizonFailure = { code: 'tiles-incomplete', loaded: 3, total: 150 };
    const clone: unknown = JSON.parse(JSON.stringify(wire));
    expect(toHorizonFailure(clone)).toEqual(wire);
  });

  it('el pont de text recupera el codi del Worker d’avui', () => {
    // `workers/horizon.worker.ts` encara respon `{ message: string }`. Com que
    // el `message` és el codi, el motiu no es perd; les xifres, sí.
    expect(toHorizonFailure('tiles-incomplete')).toEqual({ code: 'tiles-incomplete' });
    expect(toHorizonFailure(new Error('no-terrain'))).toEqual({ code: 'no-terrain' });
  });

  it('accepta el missatge SENCER del Worker, abans i després del pegat', () => {
    /*
     * Les dues formes s'han de poder llegir amb la mateixa línia de codi, o
     * el dia que es pegui `workers/horizon.worker.ts` s'hauran de tocar tres
     * consumidors alhora — i és exactament el moment en què se n'oblida un.
     * Aquest test és el contracte que fa que el pegat sigui purament additiu.
     */
    const avui = { type: 'error', id: 7, message: 'tiles-incomplete' };
    expect(toHorizonFailure(avui)).toEqual({ code: 'tiles-incomplete' });

    const desprès = {
      type: 'error',
      id: 7,
      failure: { code: 'tiles-incomplete', loaded: 3, total: 150 },
    };
    expect(toHorizonFailure(desprès)).toEqual({
      code: 'tiles-incomplete',
      loaded: 3,
      total: 150,
    });
  });

  it('un AbortError és una cancel·lació, vingui d’on vingui', () => {
    const dom = new DOMException('cancelled', 'AbortError');
    expect(isHorizonCancelled(dom)).toBe(true);
    // Node i els navegadors vells no sempre donen `DOMException`: el `name`
    // és l'única cosa comuna a tots.
    expect(isHorizonCancelled({ name: 'AbortError' })).toBe(true);
  });

  it('el que no reconeix cau a `unknown` i no llança mai', () => {
    // Aquesta funció és l'últim parapet abans de la pantalla: si petés, la
    // fallada es menjaria la fallada.
    for (const rar of [undefined, null, 42, [], new TypeError('boom'), 'qualsevol cosa']) {
      expect(toHorizonFailure(rar)).toEqual({ code: 'unknown' });
    }
  });

  it('no es creu els comptadors que li arriben de fora', () => {
    // La dada ve d'un `postMessage` i per tant de codi que no controlem.
    const brut = toHorizonFailure({ code: 'tiles-incomplete', loaded: -1, total: 'moltes' });
    expect(brut).toEqual({ code: 'tiles-incomplete' });
  });
});

describe('computeHorizonProfile no torna mai prosa', () => {
  it('un senyal ja cancel·lat dona el codi `cancelled`', async () => {
    const controller = new AbortController();
    controller.abort();

    const error = await computeHorizonProfile(
      { lat: 41.7665, lon: -2.479, elevation: 1000 },
      { signal: controller.signal, rings: clipRings(1) },
    ).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(HorizonComputeError);
    expect(toHorizonFailure(error).code).toBe('cancelled');
  });

  it('sense cap tessel·la, el codi és `no-terrain` amb els comptadors', async () => {
    // Cobertura zero: exactament el turó sense cobertura on es va a veure un
    // eclipsi. Abans, d'aquí en sortia una frase catalana amb les xifres
    // dins; ara en surt la dada, i les paraules les posa la pantalla.
    vi.stubGlobal('fetch', () => Promise.reject(new Error('sense xarxa')));

    const error = await computeHorizonProfile(
      { lat: 41.7665, lon: -2.479, elevation: 1000 },
      // Un anell curt: la prova mira el camí del codi, no la precisió.
      { rings: clipRings(1), azimuthStepDeg: 30 },
    ).then(
      () => null,
      (caught: unknown) => caught,
    );

    const failure = toHorizonFailure(error);
    expect(failure.code).toBe('no-terrain');
    expect(failure.loaded).toBe(0);
    expect(failure.total).toBeGreaterThan(0);

    // I el que es llança no porta ni una lletra accentuada ni un espai: si
    // algú hi torna a clavar una frase, aquesta línia ho atura.
    expect((error as Error).message).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });
});
