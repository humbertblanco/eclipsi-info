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
import type {
  SpotsWorkerOptions,
  SpotsWorkerRequest,
  SpotsWorkerResponse,
} from '../../workers/spots.worker';

export type SpotSearchStatus = 'idle' | 'running' | 'done' | 'error' | 'cancelled';

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
  /** Missatge en català, llest per pintar. `null` si no hi ha hagut cap error. */
  error: string | null;
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
  const [error, setError] = useState<string | null>(null);

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
      setError(message.message);
      setProgress(null);
      setStatus('error');
    });

    worker.addEventListener('error', (event: ErrorEvent) => {
      setError(event.message || 'El càlcul dels llocs ha fallat');
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
      setError('Aquest navegador no pot calcular els llocs en segon pla.');
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
    setProgress({
      stage: 'grid',
      ratio: 0,
      message: 'Preparant la cerca',
      examined: 0,
      alive: 0,
    });

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
