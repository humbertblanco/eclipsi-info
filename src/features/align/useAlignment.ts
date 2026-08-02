/**
 * Enganxa l'alineació Sol–element amb React.
 *
 * És el bessó de `features/spots/useSpotSearch`, i les tres decisions de fons
 * són les mateixes perquè els dos càlculs tenen el mateix cost:
 *
 * 1. NO ARRENCA SOL. Baixa el passadís de terreny entre tu i l'element. Al
 *    camp, amb dades mòbils i bateria comptada, això s'ha de demanar, no
 *    passar. El hook exposa `solve()` i no fa res fins que algú el crida.
 *
 * 2. EL WORKER ES CREA AL PRIMER ÚS I NO ES MATA ENTRE CONSULTES. Les
 *    tessel·les descodificades hi viuen dins: provar un segon cim del mateix
 *    massís, o el mateix cim en un altre contacte, no torna a baixar res.
 *
 * 3. LES RESPOSTES PORTEN IDENTIFICADOR. Si canvies d'objectiu a mig càlcul, la
 *    resposta vella pot arribar DESPRÉS de la nova, i sense identificador la
 *    pantalla ensenyaria el punt d'un altre cim sense que es pogués saber.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeoLocation } from '../../core/astro/types';
import type { AlignmentOutcome, AlignmentTarget } from '../../core/spots/alignment';
import type {
  AlignmentProgress,
  AlignmentWorkerOptions,
  AlignmentWorkerRequest,
  AlignmentWorkerResponse,
} from '../../workers/alignment.worker';

export type AlignmentStatus = 'idle' | 'running' | 'done' | 'error' | 'cancelled';

export interface UseAlignmentParams {
  eclipseId: string;
  /** `null` mentre no hi ha objectiu triat. El hook ho diu i espera. */
  target: AlignmentTarget | null;
  /** On ets. Només serveix per dir-te què et costa arribar-hi. */
  origin?: GeoLocation | null;
  options?: AlignmentWorkerOptions;
}

export interface UseAlignmentResult {
  status: AlignmentStatus;
  /** Etapa i tant per u, per a la barra. `null` quan no hi ha res en marxa. */
  progress: AlignmentProgress | null;
  outcome: AlignmentOutcome | null;
  /**
   * Cert quan el resultat porta comprovació de terreny.
   *
   * NO ÉS UN DETALL TÈCNIC: sense terreny, aquesta funcionalitat és el mateix
   * que fan totes les altres aplicacions —una línia i sort—, i la pantalla ho
   * ha de poder dir.
   */
  terrainChecked: boolean;
  /** Cert quan es pot demanar un càlcul ara mateix. */
  canSolve: boolean;
  solve: () => void;
  cancel: () => void;
}

export function useAlignment(params: UseAlignmentParams): UseAlignmentResult {
  const { eclipseId, target, origin, options } = params;

  const [status, setStatus] = useState<AlignmentStatus>('idle');
  const [progress, setProgress] = useState<AlignmentProgress | null>(null);
  const [outcome, setOutcome] = useState<AlignmentOutcome | null>(null);
  const [terrainChecked, setTerrainChecked] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);

  // Les entrades viuen en una referència perquè `solve` no canviï d'identitat a
  // cada re-render: un botó que canvia de callback a mig premut perd clics.
  const inputRef = useRef({ eclipseId, target, origin, options });
  inputRef.current = { eclipseId, target, origin, options };

  const ensureWorker = useCallback((): Worker | null => {
    if (workerRef.current) return workerRef.current;
    if (typeof Worker === 'undefined') return null;

    const worker = new Worker(
      new URL('../../workers/alignment.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.addEventListener('message', (event: MessageEvent<AlignmentWorkerResponse>) => {
      const message = event.data;
      // Resposta d'una consulta que ja no interessa: es descarta sense sorolls.
      if (message.id !== requestRef.current) return;

      if (message.type === 'progress') {
        setProgress(message.progress);
        return;
      }
      if (message.type === 'done') {
        setOutcome(message.outcome);
        setTerrainChecked(message.terrainChecked);
        setProgress(null);
        setStatus('done');
        return;
      }
      setProgress(null);
      setStatus('error');
    });

    worker.addEventListener('error', () => {
      setProgress(null);
      setStatus('error');
    });

    workerRef.current = worker;
    return worker;
  }, []);

  const solve = useCallback(() => {
    const { eclipseId: id, target: what, origin: from, options: opts } = inputRef.current;
    if (!what) return;

    const worker = ensureWorker();
    if (!worker) {
      setStatus('error');
      return;
    }

    // La petició anterior es cancel·la explícitament: si no, el Worker seguiria
    // baixant tessel·les d'un objectiu que ja no mira ningú.
    if (requestRef.current > 0) {
      const cancel: AlignmentWorkerRequest = { type: 'cancel', id: requestRef.current };
      worker.postMessage(cancel);
    }

    requestRef.current += 1;
    setStatus('running');
    setOutcome(null);
    setTerrainChecked(false);
    setProgress({ stage: 'geometry', ratio: 0 });

    const request: AlignmentWorkerRequest = {
      type: 'solve',
      id: requestRef.current,
      eclipseId: id,
      target: what,
      origin: from ?? undefined,
      options: opts,
    };
    worker.postMessage(request);
  }, [ensureWorker]);

  const cancel = useCallback(() => {
    const worker = workerRef.current;
    if (!worker || requestRef.current === 0) return;
    const request: AlignmentWorkerRequest = { type: 'cancel', id: requestRef.current };
    worker.postMessage(request);
    // S'incrementa l'identificador perquè qualsevol resposta que ja fos en camí
    // quedi òrfena i no repinti res.
    requestRef.current += 1;
    setProgress(null);
    setStatus('cancelled');
  }, []);

  // El Worker mor amb el component. Les tessel·les que tingués descodificades
  // se'n van amb ell.
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
    terrainChecked,
    canSolve: target !== null && status !== 'running',
    solve,
    cancel,
  };
}
