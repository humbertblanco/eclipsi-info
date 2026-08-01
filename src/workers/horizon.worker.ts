/**
 * Worker del perfil d'horitzó.
 *
 * El càlcul baixa desenes de tessel·les i fa un parell de milions
 * d'interpolacions: al fil principal deixaria l'aplicació congelada durant tot
 * el procés, just quan l'usuari mira la barra de progrés. Aquí dins, la
 * interfície segueix viva i pot cancel·lar.
 *
 * El Worker s'instancia des del hook amb el format de Vite:
 *   new Worker(new URL('../../workers/horizon.worker.ts', import.meta.url),
 *              { type: 'module' })
 */

import { clipRings, computeHorizonProfile } from '../core/horizon/raycast';
import { releaseTiles } from '../core/horizon/elevation';
import type { HorizonProgress } from '../core/horizon/raycast';
import type { HorizonProfile } from '../core/horizon/profile';
import type { GeoLocation } from '../core/astro/types';

export interface HorizonWorkerComputeRequest {
  type: 'compute';
  /** Identificador de la petició: les respostes tardanes es poden descartar. */
  id: number;
  location: GeoLocation;
  /** Subconjunt d'opcions que sobreviu al clonatge estructurat (res de funcions). */
  options?: {
    azimuthStepDeg?: number;
    maxRangeKm?: number;
    refractionK?: number;
    eyeHeightM?: number;
  };
}

export interface HorizonWorkerCancelRequest {
  type: 'cancel';
  id: number;
}

export type HorizonWorkerRequest =
  | HorizonWorkerComputeRequest
  | HorizonWorkerCancelRequest;

export type HorizonWorkerResponse =
  | { type: 'progress'; id: number; progress: HorizonProgress }
  | { type: 'done'; id: number; profile: HorizonProfile }
  | { type: 'error'; id: number; message: string };

/**
 * `DedicatedWorkerGlobalScope` no existeix quan la configuració de TypeScript
 * carrega la llibreria DOM (i no la de webworker), i barrejar les dues
 * llibreries dona col·lisions de tipus a tot el projecte. Declarem només la
 * part del scope que fem servir.
 */
interface WorkerScope {
  postMessage(message: HorizonWorkerResponse): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<HorizonWorkerRequest>) => void,
  ): void;
}

const ctx = self as unknown as WorkerScope;

/** Controladors vius, per poder cancel·lar una feina en curs per identificador. */
const running = new Map<number, AbortController>();

/**
 * Escanyament dels missatges de progrés.
 *
 * El raycast pot cridar el callback centenars de vegades i cada `postMessage`
 * força un canvi d'estat de React a l'altre costat. Amb 100 ms n'hi ha prou
 * perquè la barra es vegi fluida sense inundar el fil principal, que és
 * justament el que volíem evitar posant això en un Worker.
 */
const PROGRESS_THROTTLE_MS = 100;

async function handleCompute(request: HorizonWorkerComputeRequest): Promise<void> {
  const controller = new AbortController();
  running.set(request.id, controller);

  let lastSent = 0;

  try {
    const { azimuthStepDeg, maxRangeKm, refractionK, eyeHeightM } =
      request.options ?? {};

    const profile = await computeHorizonProfile(request.location, {
      azimuthStepDeg,
      refractionK,
      eyeHeightM,
      rings: maxRangeKm === undefined ? undefined : clipRings(maxRangeKm),
      signal: controller.signal,
      onProgress: (progress) => {
        const now = Date.now();
        if (progress.ratio >= 1 || now - lastSent >= PROGRESS_THROTTLE_MS) {
          lastSent = now;
          ctx.postMessage({ type: 'progress', id: request.id, progress });
        }
      },
    });

    if (controller.signal.aborted) return;
    ctx.postMessage({ type: 'done', id: request.id, profile });
  } catch (error) {
    // Una cancel·lació no és un error per a qui espera: ja no vol el resultat.
    if (controller.signal.aborted) return;
    ctx.postMessage({
      type: 'error',
      id: request.id,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    running.delete(request.id);
    // Les tessel·les d'un perfil són ~40 MB. Si no queda cap feina viva, les
    // alliberem: el Worker pot sobreviure a la petició que les havia demanat.
    if (running.size === 0) releaseTiles();
  }
}

ctx.addEventListener('message', (event: MessageEvent<HorizonWorkerRequest>) => {
  const request = event.data;
  if (request.type === 'cancel') {
    running.get(request.id)?.abort();
    running.delete(request.id);
    return;
  }
  if (request.type === 'compute') {
    void handleCompute(request);
  }
});
