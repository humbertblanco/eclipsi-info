/**
 * Worker del mapa de calor.
 *
 * Una passada són fins a 800 cel·les, milions de mostres del terreny i uns
 * quants megabytes de tessel·les. Al fil principal, el mapa quedaria congelat
 * mentre l'usuari l'arrossega — o sigui, justament mentre demana una passada
 * nova. Aquí dins, el mapa segueix viu i el gest de l'usuari mana: el moviment
 * cancel·la la passada anterior i en demana una altra.
 *
 * ── PER QUÈ UN WORKER PROPI I NO EL DE LA CERCA ─────────────────────────────
 *
 * Pel mateix motiu que `spots.worker.ts` no és el de l'horitzó: les tessel·les
 * descodificades són desenes de megabytes i `releaseTiles()` d'una feina se
 * n'enduria les de l'altra a mig càlcul. El mapa de calor i la cerca de llocs
 * es poden demanar alhora (el mapa es mou mentre la cerca corre), i han de
 * tenir magatzems separats.
 *
 * ── EL PROTOCOL ─────────────────────────────────────────────────────────────
 *
 * Calcat del de la cerca: `id` a cada missatge, `cancel` propi, progrés
 * escanyat. L'única diferència de forma és que aquí els resultats arriben
 * en BLOCS PARCIALS (`block`) abans del `done`: el mapa ha de començar a
 * pintar-se de seguida i tornar-se més fi a mesura que el relleu contesta.
 * Una cel·la pot arribar dues vegades —primer com a teoria, després com a
 * mesura— i qui escolta ha de substituir per `id`, mai acumular.
 *
 * El clonatge estructurat no sap copiar funcions ni `AbortSignal`, així que la
 * petició porta només dades i la cancel·lació viatja com un missatge propi.
 *
 * El Worker s'instancia amb el format de Vite:
 *   new Worker(new URL('../../workers/heat.worker.ts', import.meta.url),
 *              { type: 'module' })
 */

import type { Atmosphere } from '../core/astro/types';
import { indexedDbHeatCache } from '../core/heat/cache';
import { computeHeat } from '../core/heat/compute';
import type {
  HeatCellValue,
  HeatOutcome,
  HeatProgress,
} from '../core/heat/compute';
import { cellsForViewport, type HeatBbox } from '../core/heat/grid';
import { releaseTiles } from '../core/horizon/elevation';
import type { HorizonRing } from '../core/horizon/raycast';

/**
 * Opcions que sobreviuen al clonatge estructurat: `HeatComputeOptions` sense
 * les crides de retorn, sense el senyal i sense les injeccions de proves. Es
 * declara a mà, com a `spots.worker.ts`, perquè el contracte del Worker s'ha
 * de poder llegir aquí sense anar a buscar cap altre fitxer.
 */
export interface HeatWorkerOptions {
  level?: 1 | 2;
  atmosphere?: Atmosphere;
  eyeHeightM?: number;
  sieveRings?: HorizonRing[];
  sieveHalfWidthDeg?: number;
  sieveStepDeg?: number;
  blockSize?: number;
  /** Sostre de cel·les de la passada. */
  maxCells?: number;
  /** Marge al voltant de la franja, en km. */
  marginKm?: number;
  /** Fals per no retallar a la franja. Només per a proves. */
  clipToBand?: boolean;
}

export interface HeatWorkerRequest {
  type: 'heat';
  /** Identificador de la passada: les respostes tardanes es poden descartar. */
  id: number;
  eclipseId: string;
  bbox: HeatBbox;
  /** Zoom del mapa. D'aquí surt la mida de la cel·la. */
  zoom: number;
  options?: HeatWorkerOptions;
}

export interface HeatWorkerCancelRequest {
  type: 'cancel';
  id: number;
}

export type HeatWorkerMessage = HeatWorkerRequest | HeatWorkerCancelRequest;

export type HeatWorkerResponse =
  /** Cel·les llestes. En poden arribar diversos, i una cel·la pot repetir-se. */
  | { type: 'block'; id: number; cells: HeatCellValue[] }
  | { type: 'progress'; id: number; progress: HeatProgress }
  | { type: 'done'; id: number; outcome: HeatOutcome }
  | { type: 'error'; id: number; message: string };

/**
 * `DedicatedWorkerGlobalScope` no existeix amb la llibreria DOM carregada, i
 * barrejar les dues llibreries dona col·lisions de tipus a tot el projecte.
 * Declarem només la part del scope que fem servir. Mateix criteri que a
 * `spots.worker.ts` i `horizon.worker.ts`.
 */
interface WorkerScope {
  postMessage(message: HeatWorkerResponse): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<HeatWorkerMessage>) => void,
  ): void;
}

const ctx = self as unknown as WorkerScope;

/** Controladors vius, per poder cancel·lar una passada per identificador. */
const running = new Map<number, AbortController>();

/**
 * Escanyament del progrés. Igual que a la cerca: 100 ms manté la barra fluida
 * sense inundar el fil principal, i el canvi d'etapa i el final passen sempre
 * perquè el text que llegeix l'usuari no es pot perdre pel camí.
 *
 * ELS BLOCS NO S'ESCANYEN. Un bloc són cel·les pintables, no decoració: si se
 * n'escanya un, el mapa es queda amb un forat fins al següent.
 */
const PROGRESS_THROTTLE_MS = 100;

async function handleHeat(request: HeatWorkerRequest): Promise<void> {
  // Una petició nova amb el mateix identificador substitueix l'anterior.
  running.get(request.id)?.abort();

  const controller = new AbortController();
  running.set(request.id, controller);

  let lastSent = 0;
  let lastStage: HeatProgress['stage'] | null = null;

  try {
    const { clipToBand = true, maxCells, marginKm, ...computeOptions } =
      request.options ?? {};

    const cells = cellsForViewport(
      request.bbox,
      request.zoom,
      clipToBand ? request.eclipseId : undefined,
      { maxCells, marginKm },
    );

    const outcome = await computeHeat({
      eclipseId: request.eclipseId,
      cells,
      ...computeOptions,
      cache: indexedDbHeatCache,
      signal: controller.signal,
      onBlock: (block) => {
        if (controller.signal.aborted) return;
        ctx.postMessage({ type: 'block', id: request.id, cells: block });
      },
      onProgress: (progress) => {
        const now = Date.now();
        const canviaEtapa = progress.stage !== lastStage;
        if (
          canviaEtapa ||
          progress.ratio >= 1 ||
          now - lastSent >= PROGRESS_THROTTLE_MS
        ) {
          lastSent = now;
          lastStage = progress.stage;
          ctx.postMessage({ type: 'progress', id: request.id, progress });
        }
      },
    });

    if (controller.signal.aborted) return;
    ctx.postMessage({ type: 'done', id: request.id, outcome });
  } catch (error) {
    // Una cancel·lació no és cap error per a qui espera: ja no vol el resultat.
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
    // Les tessel·les d'una passada són desenes de megabytes. Si no queda cap
    // feina viva, les tornem al sistema: el Worker sobreviu a la petició.
    if (running.size === 0) releaseTiles();
  }
}

ctx.addEventListener('message', (event: MessageEvent<HeatWorkerMessage>) => {
  const request = event.data;
  if (request.type === 'cancel') {
    running.get(request.id)?.abort();
    running.delete(request.id);
    return;
  }
  if (request.type === 'heat') {
    void handleHeat(request);
  }
});
