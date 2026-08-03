/**
 * Hook de la precàrrega d'un punt: arrenca, informa i cancel·la.
 *
 * Tota la lògica de veritat és a `prepare.ts`; aquí només hi ha el pont amb
 * React i l'escanyament dels avisos de progrés.
 *
 * ── PER QUÈ `offline_ready` S'APUNTA AQUÍ I NO A `prepare.ts` ───────────────
 *
 * Perquè `prepareLocation()` és una funció que qualsevol pot cridar —un script,
 * un test, una futura precàrrega en segon pla— i el que s'ha de mesurar és la
 * PROMESA DE PRODUCTE: algú ha demanat de poder anar sense cobertura i ha
 * arribat al final. Aquest hook és l'únic camí per on això passa avui (només
 * `OfflinePanel` el munta), i és on la cancel·lació ja està separada de
 * l'avaria. Posar-ho al motor mesuraria també les crides que no són ningú.
 *
 * `ok` I `partial` SURTEN DE `failedTiles`, que és la xifra que decideix: amb
 * una sola tessel·la que falti, el perfil d'horitzó d'aquell rumb és una
 * suposició i la promesa és a mitges. Cancel·lar no és cap dels dos i no
 * s'apunta: qui atura la descàrrega no ha promès res.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '../core/analytics';
import type { GeoLocation } from '../core/astro/types';
import {
  isAbortError,
  prepareLocation,
  toPrepareFailure,
  type PrepareFailure,
  type PrepareOptions,
  type PrepareProgress,
  type PrepareResult,
} from './prepare';

/**
 * Cada tessel·la baixada dispara un avís. Amb ~800 tessel·les i sis baixades
 * en paral·lel, repintar a cada una vol dir centenars de renders per segon
 * mentre la CPU hauria d'estar descodificant PNG. Vuitanta mil·lisegons donen
 * una barra que es veu contínua a l'ull.
 */
const THROTTLE_MS = 80;

export interface UsePrepareState {
  running: boolean;
  progress: PrepareProgress | null;
  /**
   * La fallada com a CODI, no com a frase.
   *
   * Abans hi arribava `error.message` tal qual, que era una frase catalana
   * escrita dins de `prepare.ts`, i `OfflinePanel` la interpolava dins de
   * `note.error`: mitja línia en castellà i mitja en català. El text el posa
   * ara `offline/strings.ts` amb `prepareFailureText`.
   */
  error: PrepareFailure | null;
  result: PrepareResult | null;
}

export interface UsePrepareResult extends UsePrepareState {
  start: (location: GeoLocation, options?: Omit<PrepareOptions, 'onProgress' | 'signal'>) => void;
  cancel: () => void;
  /** Esborra l'error o el resultat de l'intent anterior. */
  reset: () => void;
}

const IDLE: UsePrepareState = {
  running: false,
  progress: null,
  error: null,
  result: null,
};

export function usePrepare(): UsePrepareResult {
  const [state, setState] = useState<UsePrepareState>(IDLE);
  const controller = useRef<AbortController | null>(null);
  const lastEmit = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // Si l'usuari se'n va de la pantalla, no deixem baixades òrfenes
      // consumint dades mòbils.
      controller.current?.abort();
    };
  }, []);

  const start = useCallback(
    (
      location: GeoLocation,
      options: Omit<PrepareOptions, 'onProgress' | 'signal'> = {},
    ) => {
      controller.current?.abort();
      const ac = new AbortController();
      controller.current = ac;
      lastEmit.current = 0;

      setState({ running: true, progress: null, error: null, result: null });

      void prepareLocation(location, {
        ...options,
        signal: ac.signal,
        onProgress: (progress) => {
          if (!alive.current || ac.signal.aborted) return;
          const now = Date.now();
          // Els canvis de fase i el final sempre passen: són els moments en
          // què el text canvia i l'usuari mira.
          const forced = progress.ratio >= 1 || progress.doneTiles === 0;
          if (!forced && now - lastEmit.current < THROTTLE_MS) return;
          lastEmit.current = now;
          setState((previous) => ({ ...previous, progress }));
        },
      })
        .then((result) => {
          if (!alive.current || ac.signal.aborted) return;
          setState((previous) => ({ ...previous, running: false, result }));
          track('offline_ready', {
            outcome: result.failedTiles === 0 ? 'ok' : 'partial',
          });
        })
        .catch((error: unknown) => {
          if (!alive.current) return;
          if (isAbortError(error)) {
            setState(IDLE);
            return;
          }
          setState((previous) => ({
            ...previous,
            running: false,
            error: toPrepareFailure(error),
          }));
          track('offline_ready', { outcome: 'failed' });
        });
    },
    [],
  );

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState(IDLE);
  }, []);

  const reset = useCallback(() => setState(IDLE), []);

  return { ...state, start, cancel, reset };
}
