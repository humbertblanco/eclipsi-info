/**
 * Hook del perfil d'horitzó: memòria cau → Worker → estat de React.
 *
 * L'ordre importa. Primer mirem si el perfil d'aquest punt ja el tenim desat
 * (resposta immediata i zero dades mòbils); només si no hi és arrenquem el
 * Worker, que és el que baixa els 10-20 MB de tessel·les. Cada perfil que es
 * calcula queda desat per a la propera vegada.
 *
 * La posició s'arrodoneix a ~100 m ABANS de calcular res. Si no, el degoteig
 * del GPS faria disparar un recàlcul complet cada pocs segons i la memòria cau
 * no encertaria mai.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeoLocation } from '../../core/astro/types';
import type { HorizonProfile } from '../../core/horizon/profile';
import {
  horizonCacheKey,
  readCachedProfile,
  roundCoordinate,
  writeCachedProfile,
} from '../../core/horizon/cache';
import {
  clipRings,
  computeHorizonProfile,
  DEFAULT_AZIMUTH_STEP_DEG,
  DEFAULT_RINGS,
  ringSignature,
  TERRESTRIAL_REFRACTION_K,
} from '../../core/horizon/raycast';
import type {
  HorizonWorkerRequest,
  HorizonWorkerResponse,
} from '../../workers/horizon.worker';

export interface UseHorizonOptions {
  azimuthStepDeg?: number;
  /** Retalla el radi explorat. Menys km = menys dades i menys precisió lluny. */
  maxRangeKm?: number;
  /**
   * Altura de l'observador per damunt del TERRENY, en metres: un mirador, un
   * terrat, el sostre del cotxe. No és una altitud sobre el nivell del mar —
   * la cota base la posa sempre el model del terreny.
   */
  heightAboveGroundM?: number;
  /**
   * Posa-ho a fals per no gastar dades sense que l'usuari ho hagi demanat.
   * Un perfil sencer són desenes de megabytes.
   */
  enabled?: boolean;
}

export interface UseHorizonResult {
  profile: HorizonProfile | null;
  /** Progrés de 0 a 1. */
  progress: number;
  /** Text de progrés en català, llest per ensenyar. */
  progressMessage: string;
  loading: boolean;
  error: string | null;
  /** Cert si el perfil ha sortit de la memòria cau i no s'ha recalculat. */
  fromCache: boolean;
  /** Força el recàlcul ignorant la memòria cau. */
  reload: () => void;
}

interface State {
  profile: HorizonProfile | null;
  progress: number;
  progressMessage: string;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
}

const IDLE: State = {
  profile: null,
  progress: 0,
  progressMessage: '',
  loading: false,
  error: null,
  fromCache: false,
};

export function useHorizon(
  location: GeoLocation | null,
  options: UseHorizonOptions = {},
): UseHorizonResult {
  const {
    azimuthStepDeg = DEFAULT_AZIMUTH_STEP_DEG,
    maxRangeKm,
    heightAboveGroundM = 0,
    enabled = true,
  } = options;

  const [state, setState] = useState<State>(IDLE);
  const [nonce, setNonce] = useState(0);

  // Marca quin nonce ha d'ignorar la memòria cau. Lligar-ho al VALOR i no a un
  // booleà és el que fa que funcioni sota StrictMode, que executa cada efecte
  // dues vegades: les dues passades veuen el mateix nonce i les dues salten la
  // cau, en comptes que la segona rescati el perfil vell que volíem refer.
  const bypassNonce = useRef(-1);

  const reload = useCallback(() => {
    setNonce((n) => {
      bypassNonce.current = n + 1;
      return n + 1;
    });
  }, []);

  // Dependències escalars, no l'objecte: `location` es reconstrueix a cada
  // render del component que ens crida i dispararia l'efecte sense parar.
  const lat = location === null ? null : roundCoordinate(location.lat);
  const lon = location === null ? null : roundCoordinate(location.lon);
  // Arrodonida al metre: ja no és l'origen del perfil (h0 surt del model), però
  // sí que serveix per detectar que l'altitud que ens passen no hi quadra, i no
  // volem que un decimal que balla rellanci l'efecte.
  const elevation = location === null ? null : Math.round(location.elevation);

  // Identificador de petició, per ignorar respostes d'un Worker que ja no ens
  // interessa (l'usuari s'ha mogut mentre calculàvem).
  const requestId = useRef(0);

  useEffect(() => {
    if (!enabled || lat === null || lon === null || elevation === null) {
      setState(IDLE);
      return;
    }

    const snapped: GeoLocation = { lat, lon, elevation };
    const signature = ringSignature(
      maxRangeKm === undefined ? DEFAULT_RINGS : clipRings(maxRangeKm),
      azimuthStepDeg,
      TERRESTRIAL_REFRACTION_K,
      heightAboveGroundM,
    );
    const key = horizonCacheKey(lat, lon, signature);
    const id = ++requestId.current;

    let cancelled = false;
    let worker: Worker | null = null;

    const start = async () => {
      // Saltar-se la cau és l'única manera de refer un perfil que hagi quedat
      // incomplet per un tall de xarxa.
      if (bypassNonce.current !== nonce) {
        const cached = await readCachedProfile(key);
        if (cancelled || id !== requestId.current) return;
        if (cached) {
          setState({
            profile: cached,
            progress: 1,
            progressMessage: 'Horitzó recuperat de la memòria',
            loading: false,
            error: null,
            fromCache: true,
          });
          return;
        }
      }

      setState({
        profile: null,
        progress: 0,
        progressMessage: 'Preparant el càlcul de l’horitzó…',
        loading: true,
        error: null,
        fromCache: false,
      });

      const finish = (profile: HorizonProfile) => {
        void writeCachedProfile(profile, key);
        setState({
          profile,
          progress: 1,
          progressMessage: 'Horitzó llest',
          loading: false,
          error: null,
          fromCache: false,
        });
      };

      const fail = (message: string) => {
        setState({
          profile: null,
          progress: 0,
          progressMessage: '',
          loading: false,
          error: message,
          fromCache: false,
        });
      };

      if (typeof Worker === 'undefined') {
        // Sense Workers (renderitzat al servidor, entorns de prova, navegadors
        // molt vells) calculem al fil principal. La interfície es quedarà
        // enganxada mentre duri, però val més això que no donar cap horitzó.
        try {
          const profile = await computeHorizonProfile(snapped, {
            azimuthStepDeg,
            eyeHeightM: heightAboveGroundM,
            rings: maxRangeKm === undefined ? undefined : clipRings(maxRangeKm),
            onProgress: (p) => {
              if (!cancelled && id === requestId.current) {
                setState((s) => ({ ...s, progress: p.ratio, progressMessage: p.message }));
              }
            },
          });
          if (cancelled || id !== requestId.current) return;
          finish(profile);
        } catch (error) {
          if (cancelled || id !== requestId.current) return;
          fail(error instanceof Error ? error.message : String(error));
        }
        return;
      }

      worker = new Worker(new URL('../../workers/horizon.worker.ts', import.meta.url), {
        type: 'module',
      });

      // Si l'efecte s'ha netejat mentre esperàvem la memòria cau, el Worker
      // acaba de néixer orfe: el matem aquí mateix.
      if (cancelled) {
        worker.terminate();
        return;
      }

      worker.addEventListener('message', (event: MessageEvent<HorizonWorkerResponse>) => {
        const message = event.data;
        if (cancelled || message.id !== id || id !== requestId.current) return;

        if (message.type === 'progress') {
          setState((s) => ({
            ...s,
            progress: message.progress.ratio,
            progressMessage: message.progress.message,
          }));
        } else if (message.type === 'done') {
          finish(message.profile);
          worker?.terminate();
          worker = null;
        } else {
          fail(message.message);
          worker?.terminate();
          worker = null;
        }
      });

      worker.addEventListener('error', () => {
        if (cancelled || id !== requestId.current) return;
        fail('El càlcul de l’horitzó ha fallat dins del worker.');
      });

      const request: HorizonWorkerRequest = {
        type: 'compute',
        id,
        location: snapped,
        options: { azimuthStepDeg, maxRangeKm, eyeHeightM: heightAboveGroundM },
      };
      worker.postMessage(request);
    };

    void start();

    return () => {
      cancelled = true;
      if (worker) {
        // Avisem el Worker abans de matar-lo perquè pugui deixar les baixades
        // a mitges; `terminate` sol l'aturaria igualment, però així també
        // funciona si algun dia el reaprofitem entre peticions.
        const cancel: HorizonWorkerRequest = { type: 'cancel', id };
        worker.postMessage(cancel);
        worker.terminate();
        worker = null;
      }
    };
  }, [
    enabled,
    lat,
    lon,
    elevation,
    azimuthStepDeg,
    maxRangeKm,
    heightAboveGroundM,
    nonce,
  ]);

  return { ...state, reload };
}
