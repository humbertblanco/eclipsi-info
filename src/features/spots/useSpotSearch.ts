/**
 * Enganxa el cercador de llocs amb React.
 *
 * Tres decisions que semblen detalls i no ho són:
 *
 * 1. LA CERCA NO ARRENCA SOLA. Baixa desenes de megabytes de relleu. Al camp,
 *    amb dades mòbils i bateria comptada, això s'ha de demanar, no passar. El
 *    hook exposa `search()` i no fa res fins que algú el crida.
 *
 * 2. EL WORKER ES CREA AL PRIMER ÚS I NO ES MATA ENTRE CERQUES. Les tessel·les
 *    ja descodificades hi viuen dins: una segona cerca al mateix lloc — canviar
 *    el radi, per exemple — les torna a trobar i no baixa res. Matar-lo entre
 *    cerques faria tornar a pagar tota la xarxa.
 *
 * 3. LES RESPOSTES PORTEN IDENTIFICADOR. Si l'usuari canvia de lloc a mig
 *    càlcul, la cerca vella pot arribar DESPRÉS de la nova. Sense
 *    l'identificador, la pantalla ensenyaria els resultats del lloc anterior i
 *    l'usuari no tindria manera de saber-ho.
 *
 * ── LA MESURA: UNA CERCA QUE ARRENCA ACABA AMB UN ESDEVENIMENT I NOMÉS UN ────
 *
 * Aquest embut val 6,1 s i 7,5 MB a Sòria i 14,5 s i 12,5 MB a Barcelona
 * (mesurats a `core/spots/search.ts`), i la decisió que penja de
 * `spot_search_run` —encongir el radi de 25 km o afluixar el garbell— demana
 * saber com ACABEN les cerques, no quantes se'n demanen. Per això l'emissió
 * passa per `finish()`, que buida la referència de la cerca viva: els camins de
 * sortida són cinc (resultats, cancel·lació, avaria del motor, avaria del
 * Worker i desmuntatge) i cap d'ells no pot emetre dues vegades ni quedar-se
 * mut. Si en faltés un, la columna de `cancelled` sortiria petita per
 * construcció i diria que l'espera no molesta ningú.
 *
 * MARXAR DE LA PANTALLA ÉS CANCEL·LAR. El desmuntatge mata el Worker amb la
 * cerca a mitges: comptar-ho com a res faria que abandonar sortís gratis a
 * l'informe, quan és exactament el senyal que es busca.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { track, waitBucket, type AnalyticsParams } from '../../core/analytics';
import type { GeoLocation } from '../../core/astro/types';
import type { SpotSearchOutcome, SpotSearchProgress } from '../../core/spots/types';
import {
  toSpotSearchFailure,
  type SpotSearchErrorCode,
} from '../../core/spots/errors';
import type {
  SpotsWorkerOptions,
  SpotsWorkerRequest,
  SpotsWorkerResponse,
} from '../../workers/spots.worker';

export type SpotSearchStatus = 'idle' | 'running' | 'done' | 'error' | 'cancelled';

/**
 * Per què s'ha aturat, com a CODI.
 *
 * Els quatre primers vénen del motor tal qual (`SpotSearchErrorCode`); els dos
 * últims són propis d'aquest hook, que és qui sap del Worker: `worker` és que
 * ha petat sencer, `no-worker` és que aquest navegador no en té. Exactament la
 * mateixa forma que `HorizonProgressCode` (codis del nucli + codis del hook),
 * perquè hi hagi UNA manera de fer això i no dues.
 *
 * ABANS AQUÍ HI HAVIA UN `string`. Hi arribava el `message` del motor —català
 * escrit dins de `core/spots/search.ts`— i també dues frases catalanes
 * clavades en aquest fitxer. Tot plegat es pintava dins d'una frase traduïda,
 * i la meitat de la línia sortia en l'idioma equivocat.
 */
export type SpotSearchFailureCode = SpotSearchErrorCode | 'worker' | 'no-worker';

export interface UseSpotSearchParams {
  eclipseId: string;
  /** `null` mentre no se sap on és l'usuari. El hook ho diu i espera. */
  origin: GeoLocation | null;
  /** Paràmetres de l'embut. Es llegeixen quan es crida `search()`, no abans. */
  options?: SpotsWorkerOptions;
}

export interface UseSpotSearchResult {
  status: SpotSearchStatus;
  /** Etapa i tant per u, per a la barra. `null` quan no hi ha res en marxa. */
  progress: SpotSearchProgress | null;
  /** Resultats i cost de l'última cerca acabada. */
  outcome: SpotSearchOutcome | null;
  /** Codi de la fallada; el text el posa `features/spots/strings.ts`. */
  error: SpotSearchFailureCode | null;
  /** Cert quan es pot demanar una cerca ara mateix. */
  canSearch: boolean;
  search: () => void;
  cancel: () => void;
}

/** Com ha acabat, en la paraula que el vocabulari declara. */
type SearchOutcomeWord = AnalyticsParams<'spot_search_run'>['outcome'];

/**
 * Una avaria amb la xarxa caiguda no és la mateixa avaria.
 *
 * `navigator.onLine` només és fiable EN NEGATIU, i això ja ho té escrit
 * `offline/useOnlineStatus.ts`: que digui que sí no vol dir que la xarxa arribi
 * enlloc —el 12 d'agost, sota l'antena col·lapsada, dirà que sí—, però que
 * digui que no vol dir que no hi ha ni interfície. Feta servir només en aquesta
 * direcció, separa «el nostre embut s'ha trencat» de «aquesta persona era al
 * mig del no-res», que porten a arreglar coses oposades. Sense la separació,
 * tot un dia de camp sense cobertura arriba com un pic d'errors nostres.
 */
function failureOutcome(): SearchOutcomeWord {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  return 'error';
}

export function useSpotSearch(params: UseSpotSearchParams): UseSpotSearchResult {
  const { eclipseId, origin, options } = params;

  const [status, setStatus] = useState<SpotSearchStatus>('idle');
  const [progress, setProgress] = useState<SpotSearchProgress | null>(null);
  const [outcome, setOutcome] = useState<SpotSearchOutcome | null>(null);
  const [error, setError] = useState<SpotSearchFailureCode | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);

  /**
   * La cerca viva i quan va arrencar. `null` vol dir que no n'hi ha cap i que,
   * per tant, no queda res per apuntar.
   *
   * L'INSTANT ES PREN AMB `Date.now()` I NO AMB `performance.now()` a posta:
   * `features/map/useHeatmap.ts` mesura la seva espera igual, i tota la gràcia
   * de tenir UNA escala d'esperes (`WAIT`, a `vocabulary.ts`) és poder dir «el
   * mapa de calor fa esperar com el cercador de llocs». Dos rellotges diferents
   * per a la mateixa columna serien dues sèries que no es poden comparar.
   */
  const runStartedAtRef = useRef<number | null>(null);

  /**
   * Tanca la cerca viva amb la paraula que li toca. Idempotent: qui arribi
   * segon —la resposta que creua el `postMessage` mentre el component es
   * desmunta, per exemple— es troba la referència buida i calla.
   */
  const finish = useCallback((outcome: SearchOutcomeWord): void => {
    const startedAtMs = runStartedAtRef.current;
    if (startedAtMs === null) return;
    runStartedAtRef.current = null;
    track('spot_search_run', {
      outcome,
      wait: waitBucket(Date.now() - startedAtMs),
    });
  }, []);

  // Les entrades viuen en referències perquè `search` no canviï d'identitat a
  // cada re-render: si canviés, tot component que la rebi per props es
  // repintaria per no res, i un botó que canvia de callback a mig premut és
  // una font de clics perduts.
  const inputRef = useRef({ eclipseId, origin, options });
  inputRef.current = { eclipseId, origin, options };

  const ensureWorker = useCallback((): Worker | null => {
    if (workerRef.current) return workerRef.current;
    if (typeof Worker === 'undefined') return null;

    const worker = new Worker(
      new URL('../../workers/spots.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.addEventListener('message', (event: MessageEvent<SpotsWorkerResponse>) => {
      const message = event.data;
      // Resposta d'una cerca que ja no interessa: es descarta sense sorolls.
      if (message.id !== requestRef.current) return;

      if (message.type === 'progress') {
        setProgress(message.progress);
        return;
      }
      if (message.type === 'done') {
        setOutcome(message.outcome);
        setProgress(null);
        setStatus('done');
        // Quedar-se sense candidats NO és una fallada (ho diu
        // `core/spots/errors.ts`) i té la seva pròpia paraula: si el que domina
        // és `empty`, el que s'ha d'afluixar és el garbell, no el radi.
        finish(message.outcome.results.length === 0 ? 'empty' : 'ok');
        return;
      }
      /*
       * LA FRONTERA DEL `postMessage` NO CONSERVA LES CLASSES: el que ha de
       * creuar és la DADA. S'hi passa el missatge SENCER perquè
       * `workers/spots.worker.ts` encara respon `{ message: string }` —el
       * fitxer el porta una altra sessió i el pegat va escrit a l'informe— i
       * el pont funciona igualment: el `message` d'un `SpotSearchError` ÉS el
       * codi. El dia que enviï `failure`, aquesta línia no s'ha de tocar.
       */
      const failure = toSpotSearchFailure(message);
      setProgress(null);
      // Cancel·lar no és fallar: qui atura la cerca no vol veure cap error.
      if (failure.code === 'cancelled') {
        setStatus('cancelled');
        finish('cancelled');
        return;
      }
      setError(failure.code);
      setStatus('error');
      finish(failureOutcome());
    });

    worker.addEventListener('error', () => {
      // El `message` d'un `ErrorEvent` ve en anglès i parla de fitxers i
      // línies: no es pot ensenyar a ningú. El codi diu QUÈ ha passat.
      setError('worker');
      setProgress(null);
      setStatus('error');
      finish(failureOutcome());
    });

    workerRef.current = worker;
    return worker;
  }, [finish]);

  const search = useCallback(() => {
    const { eclipseId: id, origin: from, options: opts } = inputRef.current;
    if (!from) return;

    // Demanar una cerca nova atura la que hi hagués viva, i això ÉS una
    // cancel·lació: la definició de `cancelled` a `core/spots/errors.ts` diu
    // literalment «l'usuari ha premut Atura, o s'ha demanat una cerca nova».
    finish('cancelled');

    const worker = ensureWorker();
    if (!worker) {
      setError('no-worker');
      setStatus('error');
      // Una cerca demanada que no arrenca mai també ha acabat, i en avaria.
      // L'espera és de zero de debò —no hi ha hagut res que esperar—, i sense
      // aquesta línia un navegador sense Workers no existiria a l'informe.
      track('spot_search_run', { outcome: 'error', wait: waitBucket(0) });
      return;
    }

    // La petició anterior es cancel·la explícitament: si no, el Worker seguiria
    // baixant tessel·les d'una cerca que ja no mira ningú.
    if (requestRef.current > 0) {
      const cancel: SpotsWorkerRequest = { type: 'cancel', id: requestRef.current };
      worker.postMessage(cancel);
    }

    requestRef.current += 1;
    runStartedAtRef.current = Date.now();
    setStatus('running');
    setError(null);
    setOutcome(null);
    setProgress({ stage: 'grid', ratio: 0, examined: 0, alive: 0 });

    const request: SpotsWorkerRequest = {
      type: 'search',
      id: requestRef.current,
      eclipseId: id,
      origin: from,
      options: opts,
    };
    worker.postMessage(request);
    // `finish` hi és encara que avui sigui estable (`useCallback` amb la llista
    // buida): és el que fa que el dia que li creixi una dependència, aquesta
    // funció no es quedi cridant la versió vella i apuntant esperes d'una
    // cerca que ja no existeix.
  }, [ensureWorker, finish]);

  const cancel = useCallback(() => {
    const worker = workerRef.current;
    if (!worker || requestRef.current === 0) return;
    const request: SpotsWorkerRequest = { type: 'cancel', id: requestRef.current };
    worker.postMessage(request);
    // S'incrementa l'identificador perquè qualsevol resposta que ja fos en camí
    // quedi òrfena i no repinti res. També és el que fa que la resposta
    // `cancelled` del Worker arribi muda: qui apunta la cancel·lació és aquesta
    // funció, que és on l'usuari l'ha demanada.
    requestRef.current += 1;
    setProgress(null);
    setStatus('cancelled');
    finish('cancelled');
  }, [finish]);

  // El Worker mor amb el component. Les tessel·les que tingués descodificades
  // se'n van amb ell, que són desenes de megabytes.
  useEffect(() => {
    return () => {
      // Marxar de la pantalla amb la cerca a mitges és abandonar-la. Va abans
      // de matar el Worker perquè després ja no arribarà cap resposta que ho
      // pugui explicar.
      finish('cancelled');
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [finish]);

  return {
    status,
    progress,
    outcome,
    error,
    canSearch: origin !== null && status !== 'running',
    search,
    cancel,
  };
}
