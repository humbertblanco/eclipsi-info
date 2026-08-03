/**
 * Per què ha fallat el càlcul de l'horitzó, en un valor que es pot traduir.
 *
 * PER QUÈ EXISTEIX AQUEST FITXER. El canal de PROGRÉS d'aquest mòdul ja parla
 * amb codis des de fa temps (`HorizonProgressStatus` a `raycast.ts`, i les
 * paraules les posa `features/sim/strings.ts`). El canal d'ERRORS, en canvi,
 * seguia viatjant en prosa catalana: «Només s'han pogut baixar 3 de 150
 * tessel·les del terreny. Amb el relleu a mitges, el resultat no seria de fiar.
 * Comprova la connexió.» Aquella frase pujava del nucli al Worker, del Worker
 * al hook i del hook a la pantalla sense que ningú la traduís, i arribava tal
 * qual a un usuari que té l'app en castellà — just al moment en què l'app li ha
 * fallat, que és el pitjor moment per semblar una altra app. ESTAT.md §4 ho
 * tenia obert amb totes les lletres.
 *
 * LA SOLUCIÓ ÉS LA MATEIXA QUE JA ES FA SERVIR, NO UNA DE PARAL·LELA: una unió
 * TANCADA de codis (com `LocationErrorCode` de `state/useObserver.ts` i com
 * `CloudErrorCode` de `core/weather/types.ts`), i el text el resol la capa de
 * vista, que sí que sap l'idioma.
 *
 * DUES PECES I NO UNA, I EL MOTIU ÉS EL `postMessage`. El càlcul viu dins d'un
 * Web Worker. El clonatge estructurat d'un `Error` no conserva ni la subclasse
 * ni les propietats afegides: si el codi visqués només com a camp d'una classe,
 * es perdria en creuar la frontera. Per això la dada és un objecte pla
 * (`HorizonFailure`) que travessa el `postMessage` sencer, i la classe
 * (`HorizonComputeError`) només és el vehicle per LLANÇAR-LA dins del mateix
 * fil.
 *
 * EL `message` DE L'ERROR ÉS EL CODI, NO UNA FRASE. És deliberat i té dues
 * conseqüències bones: la consola d'errors deixa de tenir català (és una
 * etiqueta estable, apta per agregar), i qui només rebi el text —el Worker
 * antic encara envia `message: string`— en pot recuperar el codi amb
 * `toHorizonFailure`. Vegeu-hi el pont.
 */

/**
 * Els únics motius pels quals el nucli deixa de calcular un horitzó.
 *
 * `unknown` hi és a posta i no és un calaix de sastre: és el que es respon
 * quan arriba una excepció que no ha nascut aquí (un `TypeError` d'un
 * navegador vell, un error de xarxa cru). Sense ell, la capa de vista hauria
 * de saber què fer amb un codi que no existeix, i el `switch` exhaustiu que
 * ens protegeix deixaria de ser exhaustiu.
 */
export type HorizonErrorCode =
  /** L'usuari (o el hook) ha cancel·lat. No és una avaria: ningú no espera res. */
  | 'cancelled'
  /**
   * No ha arribat prou relleu. És l'error important d'aquest mòdul: un horitzó
   * a mitges no és una resposta pitjor, és una resposta EQUIVOCADA, i en
   * aquesta app la resposta equivocada és «sí que el veuràs». Vegeu
   * `MIN_TILE_COVERAGE` a `raycast.ts`.
   */
  | 'tiles-incomplete'
  /** Ni una sola tessel·la descodificada: no hi ha cap terreny sobre què traçar. */
  | 'no-terrain'
  /** Qualsevol altra cosa. Vegeu la nota de dalt. */
  | 'unknown';

/**
 * La fallada com a DADA: objecte pla, sense mètodes ni classes, perquè
 * sobrevisqui al clonatge estructurat d'un `postMessage`.
 *
 * Les xifres són opcionals perquè només `tiles-incomplete` en té, i perquè el
 * camí que passa pel Worker antic —el que encara envia només text— pot
 * recuperar el codi però no els comptadors. La capa de vista ha de saber dir
 * la frase amb xifres i sense: vegeu `horizonFailureText`.
 */
export interface HorizonFailure {
  readonly code: HorizonErrorCode;
  /** Tessel·les que sí que han arribat, quan el codi és `tiles-incomplete`. */
  readonly loaded?: number;
  /** Tessel·les que feien falta, quan el codi és `tiles-incomplete`. */
  readonly total?: number;
}

/** Totes les possibilitats, per poder recórrer-les des d'un test. */
export const HORIZON_ERROR_CODES: readonly HorizonErrorCode[] = [
  'cancelled',
  'tiles-incomplete',
  'no-terrain',
  'unknown',
];

function isHorizonErrorCode(value: unknown): value is HorizonErrorCode {
  return (
    typeof value === 'string' &&
    (HORIZON_ERROR_CODES as readonly string[]).includes(value)
  );
}

/**
 * L'excepció que llança el nucli.
 *
 * El `message` és el codi i prou. Qui vulgui una frase la demana a la capa de
 * vista; qui vulgui diagnosticar té `failure` i `cause`.
 */
export class HorizonComputeError extends Error {
  readonly failure: HorizonFailure;

  constructor(failure: HorizonFailure, cause?: unknown) {
    // `cause` per l'opció estàndard d'ES2022: la cadena d'errors original no es
    // perd i la consola segueix ensenyant d'on venia de debò.
    super(failure.code, { cause });
    this.name = 'HorizonComputeError';
    this.failure = failure;
  }
}

/** Enter no negatiu, o res. Els comptadors que arriben de fora no es creuen. */
function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
}

/**
 * Qualsevol cosa que hagi petat → una fallada tipada.
 *
 * Accepta quatre formes, i totes quatre passen de debò:
 *
 *   1. Un `HorizonComputeError` nostre: es torna la seva fallada.
 *   2. Un objecte pla amb `code` vàlid: és el que arriba per `postMessage`
 *      quan el Worker ja envia la dada estructurada.
 *   3. Un `AbortError` (`DOMException` o un `Error` que se'n digui): cancel·lat.
 *   4. Un text: el PONT. El Worker d'avui encara respon `{ message: string }`,
 *      i com que el `message` del nostre error ÉS el codi, aquí es recupera.
 *      Es perden els comptadors, no el motiu. Quan el Worker enviï la fallada
 *      sencera, aquesta branca deixarà de fer falta i es pot esborrar.
 *
 * Tot el que no encaixi enlloc és `unknown`. Aquesta funció no llança mai:
 * és el darrer parapet abans de la pantalla.
 */
export function toHorizonFailure(value: unknown): HorizonFailure {
  if (value instanceof HorizonComputeError) return value.failure;

  if (typeof value === 'string') {
    return isHorizonErrorCode(value) ? { code: value } : { code: 'unknown' };
  }

  if (typeof value === 'object' && value !== null) {
    const candidate = value as { code?: unknown; name?: unknown; message?: unknown };

    if (candidate.name === 'AbortError') return { code: 'cancelled' };

    if (isHorizonErrorCode(candidate.code)) {
      const raw = value as { loaded?: unknown; total?: unknown };
      const loaded = count(raw.loaded);
      const total = count(raw.total);
      return {
        code: candidate.code,
        ...(loaded === undefined ? {} : { loaded }),
        ...(total === undefined ? {} : { total }),
      };
    }

    // Un `Error` qualsevol que porti el codi al text: mateix pont que el cas 4.
    if (isHorizonErrorCode(candidate.message)) {
      return { code: candidate.message };
    }
  }

  return { code: 'unknown' };
}

/**
 * Cert si això ve d'una cancel·lació i no d'una avaria.
 *
 * Qui cancel·la ja no vol el resultat: ensenyar-li un error seria acusar-lo
 * d'una cosa que ha demanat ell. Els dos hooks ho fan servir per callar.
 */
export function isHorizonCancelled(value: unknown): boolean {
  return toHorizonFailure(value).code === 'cancelled';
}
