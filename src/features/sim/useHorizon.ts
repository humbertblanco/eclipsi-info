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
  type HorizonProgressStatus,
} from '../../core/horizon/raycast';
import {
  isHorizonCancelled,
  toHorizonFailure,
  type HorizonErrorCode,
  type HorizonFailure,
} from '../../core/horizon/errors';
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

/**
 * El canal de progrés parla amb CODIS, no amb frases fetes.
 *
 * Els tres primers estats vénen del nucli tal qual (`HorizonProgressStatus`);
 * els altres dos són propis del hook: el perfil rescatat de la memòria cau i
 * l'instant abans d'arrencar el Worker. Les paraules —en l'idioma de
 * l'usuari— les posa `features/sim/strings.ts`, que és qui pinta.
 */
export type HorizonProgressCode =
  | HorizonProgressStatus
  | { stage: 'cache' }
  | { stage: 'preparing' };

/**
 * La fallada, també com a codi.
 *
 * ABANS AQUÍ HI HAVIA UN `detail: string`, i era el forat que ESTAT.md §4
 * tenia obert: hi viatjava el missatge tal com l'havia dit qui fallava —una
 * frase catalana escrita dins de `core/horizon/raycast.ts`— i la pantalla
 * l'interpolava dins d'una frase bilingüe. El resultat era mig castellà i mig
 * català a la mateixa línia, i el motiu real (el que fa accionable l'avís) era
 * justament la meitat que no es traduïa.
 *
 * Ara el nucli emet `HorizonErrorCode` i aquí només s'hi afegeix el codi que
 * el nucli no pot conèixer: que el Worker hagi petat sencer. Exactament el
 * mateix patró que `HorizonProgressCode` (tres estats del nucli, dos del
 * hook). Les paraules, a `features/sim/strings.ts`.
 */
export type HorizonFailureCode = HorizonErrorCode | 'worker';

export interface HorizonError extends Omit<HorizonFailure, 'code'> {
  code: HorizonFailureCode;
}

export interface UseHorizonResult {
  profile: HorizonProfile | null;
  /** Progrés de 0 a 1. */
  progress: number;
  /** Codi de progrés; el text el posa `features/sim/strings.ts`. */
  progressCode: HorizonProgressCode | null;
  loading: boolean;
  error: HorizonError | null;
  /** Cert si el perfil ha sortit de la memòria cau i no s'ha recalculat. */
  fromCache: boolean;
  /** Força el recàlcul ignorant la memòria cau. */
  reload: () => void;
}

interface State {
  profile: HorizonProfile | null;
  progress: number;
  progressCode: HorizonProgressCode | null;
  loading: boolean;
  error: HorizonError | null;
  fromCache: boolean;
}

const IDLE: State = {
  profile: null,
  progress: 0,
  progressCode: null,
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

  /**
   * L'ALTITUD VA PER REFERÈNCIA I NO PER DEPENDÈNCIA. És el que costa 10-20 MB.
   *
   * Cada tria de lloc fixa el punt DUES vegades: primer amb l'altitud a zero i
   * la font a `pending`, i uns segons més tard amb la del model del terreny
   * (vegeu `state/observerFlow.ts`). Amb l'altitud a les dependències, la segona
   * fixació rellançava l'efecte: matava el Worker a mig baixar tessel·les i el
   * tornava a engegar des de la primera. O sigui que cada lloc que es tria
   * baixava el paquet sencer dues vegades, i la segona just quan l'usuari ja
   * estava mirant la barra de progrés avançar.
   *
   * Es pot treure perquè NO POT CANVIAR EL PERFIL: `computeHorizonProfile` treu
   * h0 del model del terreny al punt de l'observador precisament perquè les dues
   * cotes surtin de la mateixa font, i l'altitud que li passem només va a parar
   * a tres camps de diagnòstic (`requestedElevation`, `elevationMismatchM`,
   * `elevationSuspect`) que no pinta ningú. És el mateix motiu pel qual tampoc
   * no forma part de la clau de la memòria cau (`horizonCacheKey`): si hi fos,
   * un perfil ja calculat no es tornaria a trobar mai per un metre de diferència.
   */
  const elevationRef = useRef(0);
  elevationRef.current = location === null ? 0 : Math.round(location.elevation);

  // Identificador de petició, per ignorar respostes d'un Worker que ja no ens
  // interessa (l'usuari s'ha mogut mentre calculàvem).
  const requestId = useRef(0);

  useEffect(() => {
    if (!enabled || lat === null || lon === null) {
      setState(IDLE);
      return;
    }

    const snapped: GeoLocation = { lat, lon, elevation: elevationRef.current };
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
            progressCode: { stage: 'cache' },
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
        progressCode: { stage: 'preparing' },
        loading: true,
        error: null,
        fromCache: false,
      });

      const finish = (profile: HorizonProfile) => {
        void writeCachedProfile(profile, key);
        setState({
          profile,
          progress: 1,
          progressCode: { stage: 'done' },
          loading: false,
          error: null,
          fromCache: false,
        });
      };

      const fail = (error: HorizonError) => {
        setState({
          profile: null,
          progress: 0,
          progressCode: null,
          loading: false,
          error,
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
                setState((s) => ({ ...s, progress: p.ratio, progressCode: p.status }));
              }
            },
          });
          if (cancelled || id !== requestId.current) return;
          finish(profile);
        } catch (error) {
          if (cancelled || id !== requestId.current) return;
          // Una cancel·lació no és una avaria: es calla i s'espera el recàlcul.
          if (isHorizonCancelled(error)) return;
          fail(toHorizonFailure(error));
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
            progressCode: message.progress.status,
          }));
        } else if (message.type === 'done') {
          finish(message.profile);
          worker?.terminate();
          worker = null;
        } else {
          /*
           * LA FRONTERA DEL `postMessage` NO CONSERVA LES CLASSES.
           *
           * El clonatge estructurat d'un `Error` es deixa la subclasse i les
           * propietats afegides pel camí, i per això el que ha de creuar és la
           * DADA (`HorizonFailure`), no l'excepció. El Worker encara respon
           * `{ message: string }` — el fitxer el porta una altra sessió i el
           * pegat va escrit a l'informe—, i mentrestant el pont funciona
           * igualment: el `message` d'un `HorizonComputeError` ÉS el codi, i
           * `toHorizonFailure` el reconeix. Quan el Worker enviï `failure`,
           * aquesta primera branca l'agafarà i hi arribaran també les xifres.
           */
          const failure =
            'failure' in message
              ? toHorizonFailure(message.failure)
              : toHorizonFailure(message.message);
          if (!isHorizonCancelled(failure)) fail(failure);
          worker?.terminate();
          worker = null;
        }
      });

      worker.addEventListener('error', () => {
        if (cancelled || id !== requestId.current) return;
        // Abans aquí hi havia una frase en català clavada al hook, i després
        // el `event.message` del navegador —que ve en anglès i parla de
        // fitxers i línies. Cap de les dues coses es pot ensenyar a ningú: el
        // codi diu QUÈ ha passat i la frase la posa la pantalla.
        fail({ code: 'worker' });
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
  }, [enabled, lat, lon, azimuthStepDeg, maxRangeKm, heightAboveGroundM, nonce]);

  return { ...state, reload };
}
