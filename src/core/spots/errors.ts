/**
 * Per què s'ha aturat la cerca de llocs, en un valor que es pot traduir.
 *
 * PER QUÈ EXISTEIX. `search.ts` llançava frases fetes en català («No s'ha
 * pogut baixar cap tessel·la del terreny. Comprova la connexió.»), i el camí
 * que feien acabava a `SpotSearchPanel`, interpolades dins de
 * `panel.failedDetail`. La capçalera d'aquell diccionari ho tenia escrit
 * negre sobre blanc i ho donava per bo: «el text del motor pot arribar en
 * català a una pantalla en castellà; és tècnic, i val més una pista en
 * l'idioma equivocat que cap pista». No era tècnic: era «comprova la
 * connexió», que és exactament la part útil de l'avís. ESTAT.md §4 tenia el
 * mateix forat obert per a l'horitzó, i el camí és el mateix per als dos.
 *
 * MATEIX PATRÓ QUE `core/horizon/errors.ts`, A POSTA I NO PER CASUALITAT: unió
 * tancada de codis, dada plana que sobreviu al `postMessage` del Worker,
 * classe només com a vehicle per llançar, i les paraules a la capa de vista
 * (`features/spots/strings.ts`). Dues solucions paral·leles per al mateix
 * problema serien dos llocs on oblidar-se del castellà.
 *
 * EL `message` DE L'ERROR ÉS EL CODI. Serveix de diagnòstic estable a la
 * consola i de pont mentre `workers/spots.worker.ts` només sàpiga enviar text.
 */

import { toHorizonFailure } from '../horizon/errors';

/**
 * Els únics motius pels quals l'embut deixa de buscar.
 *
 * No hi ha cap codi per a «no he trobat res»: quedar-se sense candidats NO és
 * una fallada, és una resposta —i es torna com a `SpotSearchOutcome` amb la
 * llista buida, que és el que deixa que la pantalla digui «prova d'eixamplar
 * el radi» en comptes de «ha fallat».
 */
export type SpotSearchErrorCode =
  /** L'usuari ha premut «Atura», o s'ha demanat una cerca nova. */
  | 'cancelled'
  /** Ni una tessel·la: sense terreny no es pot garbellar res per horitzó. */
  | 'no-terrain'
  /** N'ha arribat una part. Els resultats sortirien optimistes i falsos. */
  | 'terrain-incomplete'
  /** Qualsevol altra cosa. Vegeu la nota de `horizon/errors.ts`. */
  | 'unknown';

/** La fallada com a dada plana, per travessar el `postMessage` sencera. */
export interface SpotSearchFailure {
  readonly code: SpotSearchErrorCode;
}

/** Totes les possibilitats, per poder recórrer-les des d'un test. */
export const SPOT_SEARCH_ERROR_CODES: readonly SpotSearchErrorCode[] = [
  'cancelled',
  'no-terrain',
  'terrain-incomplete',
  'unknown',
];

function isSpotSearchErrorCode(value: unknown): value is SpotSearchErrorCode {
  return (
    typeof value === 'string' &&
    (SPOT_SEARCH_ERROR_CODES as readonly string[]).includes(value)
  );
}

/** L'excepció que llança l'embut. El `message` és el codi i prou. */
export class SpotSearchError extends Error {
  readonly failure: SpotSearchFailure;

  constructor(code: SpotSearchErrorCode, cause?: unknown) {
    super(code, { cause });
    this.name = 'SpotSearchError';
    this.failure = { code };
  }
}

/**
 * Del codi de l'horitzó al codi de la cerca, un a un.
 *
 * L'etapa D2 crida `computeHorizonProfile` de debò, o sigui que una fallada
 * seva pot sortir per aquí sense passar per cap `catch`. Traduir-la en comptes
 * d'engolir-la és el que fa que l'usuari llegeixi «falta relleu» i no «ha
 * fallat»: és el mateix problema, dit al lloc on el pot resoldre.
 */
const FROM_HORIZON: Record<string, SpotSearchErrorCode> = {
  cancelled: 'cancelled',
  'no-terrain': 'no-terrain',
  'tiles-incomplete': 'terrain-incomplete',
  unknown: 'unknown',
};

/**
 * Qualsevol cosa que hagi petat → una fallada tipada. No llança mai.
 *
 * Accepta el mateix repertori que `toHorizonFailure`: la nostra excepció, un
 * objecte pla vingut del Worker, un `AbortError`, o el text que encara envia
 * el Worker d'avui (que és el codi). I, a més, una fallada de l'horitzó, que
 * es tradueix amb la taula de sobre.
 */
export function toSpotSearchFailure(value: unknown): SpotSearchFailure {
  if (value instanceof SpotSearchError) return value.failure;

  if (typeof value === 'string') {
    return { code: isSpotSearchErrorCode(value) ? value : fromHorizon(value) };
  }

  if (typeof value === 'object' && value !== null) {
    const candidate = value as {
      code?: unknown;
      name?: unknown;
      message?: unknown;
      failure?: unknown;
    };

    if (candidate.name === 'AbortError') return { code: 'cancelled' };
    // El sobre del Worker: la fallada de debò va a dins. Que això s'accepti és
    // el que deixa el pegat del Worker purament additiu.
    if (typeof candidate.failure === 'object' && candidate.failure !== null) {
      return toSpotSearchFailure(candidate.failure);
    }
    if (isSpotSearchErrorCode(candidate.code)) return { code: candidate.code };
    if (isSpotSearchErrorCode(candidate.message)) return { code: candidate.message };
  }

  return { code: fromHorizon(value) };
}

/**
 * Últim recurs: mirar-ho amb ulls d'horitzó. Si allò tampoc no ho reconeix,
 * `toHorizonFailure` torna `unknown` i la taula el deixa igual.
 */
function fromHorizon(value: unknown): SpotSearchErrorCode {
  return FROM_HORIZON[toHorizonFailure(value).code] ?? 'unknown';
}

/** Cert si això ve d'una cancel·lació i no d'una avaria. */
export function isSpotSearchCancelled(value: unknown): boolean {
  return toSpotSearchFailure(value).code === 'cancelled';
}
