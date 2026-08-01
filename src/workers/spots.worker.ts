/**
 * Worker del cercador de llocs.
 *
 * Una cerca de 25 km baixa unes 90 tessel·les i llegeix set milions de mostres
 * del terreny. Al fil principal, l'aplicació quedaria congelada durant tot el
 * procés — inclosa la barra de progrés que l'usuari mira, i inclòs el botó de
 * cancel·lar, que és el que voldria prémer. Aquí dins, la interfície segueix
 * viva.
 *
 * ── PER QUÈ UN WORKER PROPI I NO EL DE L'HORITZÓ ────────────────────────────
 *
 * Perquè les dues feines competeixen per la mateixa memòria. El perfil
 * d'horitzó té ~150 tessel·les descodificades obertes alhora (40 MB) i la
 * cerca en té ~90 més. En fils separats, cadascun té el seu magatzem i
 * `releaseTiles` d'un no s'emporta les de l'altre a mig càlcul.
 *
 * ── EL QUE TRAVESSA `postMessage` ───────────────────────────────────────────
 *
 * El clonatge estructurat no sap copiar funcions ni `AbortSignal`. Per això la
 * petició porta només el subconjunt de `SpotSearchOptions` que són dades, i la
 * cancel·lació viatja com un missatge propi que aquí dins es converteix en un
 * `AbortController`. Els resultats són números plans i cadenes: `SpotResult`
 * està dissenyat per travessar aquesta frontera sense cap conversió.
 *
 * El Worker s'instancia amb el format de Vite:
 *   new Worker(new URL('../../workers/spots.worker.ts', import.meta.url),
 *              { type: 'module' })
 */

import type { Atmosphere, GeoLocation } from '../core/astro/types';
import { releaseTiles } from '../core/horizon/elevation';
import type { HorizonRing } from '../core/horizon/raycast';
import { searchSpots } from '../core/spots/search';
import type {
  SpotScoreWeights,
  SpotSearchOutcome,
  SpotSearchProgress,
} from '../core/spots/types';

/**
 * Opcions que sobreviuen al clonatge estructurat.
 *
 * És a dir: `SpotSearchOptions` sense `onProgress`, sense `signal` i sense les
 * tres injeccions de proves. Es declara a mà en comptes de derivar-la amb
 * `Omit<>` perquè el contracte del Worker ha de ser explícit: qui l'usi ha de
 * poder llegir aquí què li pot enviar, sense anar a buscar cap altre fitxer.
 */
export interface SpotsWorkerOptions {
  radiusKm?: number;
  spacingKm?: number;
  finalists?: number;
  limit?: number;
  minSeparationKm?: number;
  weights?: SpotScoreWeights;
  atmosphere?: Atmosphere;
  eyeHeightM?: number;
  sieveRings?: HorizonRing[];
  sieveHalfWidthDeg?: number;
  sieveStepDeg?: number;
  refineStepDeg?: number;
  refineMaxRangeKm?: number;
  refine?: boolean;
}

export interface SpotsWorkerSearchRequest {
  type: 'search';
  /** Identificador de la petició: les respostes tardanes es poden descartar. */
  id: number;
  eclipseId: string;
  origin: GeoLocation;
  options?: SpotsWorkerOptions;
}

export interface SpotsWorkerCancelRequest {
  type: 'cancel';
  id: number;
}

export type SpotsWorkerRequest = SpotsWorkerSearchRequest | SpotsWorkerCancelRequest;

export type SpotsWorkerResponse =
  | { type: 'progress'; id: number; progress: SpotSearchProgress }
  | { type: 'done'; id: number; outcome: SpotSearchOutcome }
  | { type: 'error'; id: number; message: string };

/**
 * `DedicatedWorkerGlobalScope` no existeix quan la configuració de TypeScript
 * carrega la llibreria DOM (i no la de webworker), i barrejar les dues
 * llibreries dona col·lisions de tipus a tot el projecte. Declarem només la
 * part del scope que fem servir. Mateix criteri que a `horizon.worker.ts`.
 */
interface WorkerScope {
  postMessage(message: SpotsWorkerResponse): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<SpotsWorkerRequest>) => void,
  ): void;
}

const ctx = self as unknown as WorkerScope;

/** Controladors vius, per poder cancel·lar una feina en curs per identificador. */
const running = new Map<number, AbortController>();

/**
 * Escanyament dels missatges de progrés.
 *
 * La cerca crida el callback centenars de vegades — un cop cada 24 candidats i
 * un cop per tessel·la baixada — i cada `postMessage` força un canvi d'estat de
 * React a l'altre costat. Amb 100 ms la barra es veu fluida sense inundar el
 * fil principal, que és justament el que volíem evitar posant això aquí.
 *
 * El canvi d'etapa i el final SEMPRE passen: el text que llegeix l'usuari
 * («Baixant el relleu», «Calculant els finalistes») no es pot perdre pel camí,
 * perquè és l'única explicació que té de per què això triga.
 */
const PROGRESS_THROTTLE_MS = 100;

async function handleSearch(request: SpotsWorkerSearchRequest): Promise<void> {
  // Una petició nova amb el mateix identificador substitueix l'anterior.
  running.get(request.id)?.abort();

  const controller = new AbortController();
  running.set(request.id, controller);

  let lastSent = 0;
  let lastStage: SpotSearchProgress['stage'] | null = null;

  try {
    const outcome = await searchSpots({
      eclipseId: request.eclipseId,
      origin: request.origin,
      ...request.options,
      signal: controller.signal,
      onProgress: (progress) => {
        const now = Date.now();
        const canviaEtapa = progress.stage !== lastStage;
        if (canviaEtapa || progress.ratio >= 1 || now - lastSent >= PROGRESS_THROTTLE_MS) {
          lastSent = now;
          lastStage = progress.stage;
          ctx.postMessage({ type: 'progress', id: request.id, progress });
        }
      },
    });

    if (controller.signal.aborted) return;
    ctx.postMessage({ type: 'done', id: request.id, outcome });
  } catch (error) {
    // Una cancel·lació no és un error per a qui espera: ja no vol el resultat.
    if (controller.signal.aborted) return;
    ctx.postMessage({
      type: 'error',
      id: request.id,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    // Només esborrem el nostre: si mentrestant n'ha entrat un altre amb el
    // mateix identificador, el seu controlador ja ocupa la casella.
    if (running.get(request.id) === controller) running.delete(request.id);
    // Les tessel·les d'una cerca són desenes de megabytes. Si no queda cap
    // feina viva, les tornem al sistema: el Worker sobreviu a la petició.
    if (running.size === 0) releaseTiles();
  }
}

ctx.addEventListener('message', (event: MessageEvent<SpotsWorkerRequest>) => {
  const request = event.data;
  if (request.type === 'cancel') {
    running.get(request.id)?.abort();
    running.delete(request.id);
    return;
  }
  if (request.type === 'search') {
    void handleSearch(request);
  }
});
