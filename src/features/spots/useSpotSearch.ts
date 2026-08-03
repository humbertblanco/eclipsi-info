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
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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

export function useSpotSearch(params: UseSpotSearchParams): UseSpotSearchResult {
  const { eclipseId, origin, options } = params;

  const [status, setStatus] = useState<SpotSearchStatus>('idle');
  const [progress, setProgress] = useState<SpotSearchProgress | null>(null);
  const [outcome, setOutcome] = useState<SpotSearchOutcome | null>(null);
  const [error, setError] = useState<SpotSearchFailureCode | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);

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
        return;
      }
      /*
       * LA FRONTERA DEL `postMessage` NO CONSERVA LES CLASSES: el que ha de
       * creuar és la DADA. `workers/spots.worker.ts` encara respon
       * `{ message: string }` —el fitxer el porta una altra sessió i el pegat
       * va escrit a l'informe—, i mentrestant el pont funciona: el `message`
       * d'un `SpotSearchError` ÉS el codi i `toSpotSearchFailure` el reconeix.
       */
      const failure =
        'failure' in message
          ? toSpotSearchFailure(message.failure)
          : toSpotSearchFailure(message.message);
      setProgress(null);
      // Cancel·lar no és fallar: qui atura la cerca no vol veure cap error.
      if (failure.code === 'cancelled') {
        setStatus('cancelled');
        return;
      }
      setError(failure.code);
      setStatus('error');
    });

    worker.addEventListener('error', () => {
      // El `message` d'un `ErrorEvent` ve en anglès i parla de fitxers i
      // línies: no es pot ensenyar a ningú. El codi diu QUÈ ha passat.
      setError('worker');
      setProgress(null);
      setStatus('error');
    });

    workerRef.current = worker;
    return worker;
  }, []);

  const search = useCallback(() => {
    const { eclipseId: id, origin: from, options: opts } = inputRef.current;
    if (!from) return;

    const worker = ensureWorker();
    if (!worker) {
      setError('no-worker');
      setStatus('error');
      return;
    }

    // La petició anterior es cancel·la explícitament: si no, el Worker seguiria
    // baixant tessel·les d'una cerca que ja no mira ningú.
    if (requestRef.current > 0) {
      const cancel: SpotsWorkerRequest = { type: 'cancel', id: requestRef.current };
      worker.postMessage(cancel);
    }

    requestRef.current += 1;
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
  }, [ensureWorker]);

  const cancel = useCallback(() => {
    const worker = workerRef.current;
    if (!worker || requestRef.current === 0) return;
    const request: SpotsWorkerRequest = { type: 'cancel', id: requestRef.current };
    worker.postMessage(request);
    // S'incrementa l'identificador perquè qualsevol resposta que ja fos en camí
    // quedi òrfena i no repinti res.
    requestRef.current += 1;
    setProgress(null);
    setStatus('cancelled');
  }, []);

  // El Worker mor amb el component. Les tessel·les que tingués descodificades
  // se'n van amb ell, que són desenes de megabytes.
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

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
