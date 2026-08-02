/**
 * Worker de l'alineació Sol–element.
 *
 * ── PER QUÈ UN WORKER ───────────────────────────────────────────────────────
 *
 * `solveAlignment` camina la línia des de l'element cap enfora llegint el model
 * del terreny a cada pas, i abans ha de baixar les tessel·les del passadís. Al
 * fil principal això congela la interfície durant tota l'estona — inclòs el
 * botó de cancel·lar, que és el que l'usuari voldria prémer. Aquí dins, no.
 *
 * ── PER QUÈ UN WORKER PROPI I NO EL DE LA CERCA ─────────────────────────────
 *
 * El mateix motiu que separa el de l'horitzó del dels llocs: `releaseTiles()`
 * és global al fil i s'ho emporta tot. Si l'alineació compartís fil amb la
 * cerca de llocs, acabar una cerca alliberaria les tessel·les que l'alineació
 * està llegint a mig càlcul.
 *
 * ── LES PASSADES ────────────────────────────────────────────────────────────
 *
 * És el protocol que documenta `core/spots/alignment.ts` i no una optimització
 * inventada aquí, amb una passada zero que va caldre afegir després de provar-ho
 * amb un cim de veritat (vegeu-la més avall):
 *
 *   0. LA COTA DE L'ELEMENT, una tessel·la, i només si no la sabem ja.
 *   1. GEOMETRIA SOLA, sense lector d'elevació. Val mil·lisegons i respon la
 *      pregunta caríssima: si el Sol ja s'ha post, si l'element és massa baix o
 *      si el punt cauria a 200 km, no cal baixar ni un byte.
 *   2. Amb el punt provisional a la mà ja se sap QUIN passadís de terreny fa
 *      falta. Es baixa només aquell, i es torna a resoldre amb el lector: la
 *      segona passada és la que comprova que des d'allà l'element (i per tant
 *      el Sol) es vegin de veritat.
 *
 * ── EL QUE TRAVESSA `postMessage` ───────────────────────────────────────────
 *
 * El clonatge estructurat no sap copiar funcions ni `AbortSignal`. La petició
 * porta només dades i la cancel·lació viatja com un missatge propi, que aquí
 * dins es converteix en un `AbortController`. El progrés viatja com a CODI
 * d'etapa i no com a frase: qui el pinta sap en quin idioma va l'app, i aquest
 * fitxer no.
 *
 * El Worker s'instancia amb el format de Vite:
 *   new Worker(new URL('../../workers/alignment.worker.ts', import.meta.url),
 *              { type: 'module' })
 */

import type { Atmosphere, GeoLocation } from '../core/astro/types';
import {
  DEFAULT_ZOOM,
  elevationAtSync,
  lonLatToTilePixel,
  prefetchTiles,
  releaseTiles,
  tileKey,
  type TileId,
} from '../core/horizon/elevation';
import {
  solveAlignment,
  tilesAlongLine,
  type AlignmentMoment,
  type AlignmentOutcome,
  type AlignmentTarget,
} from '../core/spots/alignment';

/**
 * Opcions que sobreviuen al clonatge estructurat.
 *
 * És `AlignmentOptions` sense `elevation` (una funció) i sense l'eclipsi i
 * l'objectiu, que van a la petició. Es declara a mà i no amb `Omit<>` perquè el
 * contracte del Worker s'ha de poder llegir aquí, sense obrir cap altre fitxer.
 */
export interface AlignmentWorkerOptions {
  moment?: AlignmentMoment;
  atUtcMs?: number;
  atmosphere?: Atmosphere;
  elevationZoom?: number;
  eyeHeightM?: number;
  sunAboveTargetDeg?: number;
  refractionK?: number;
  maxDistanceKm?: number;
  minDistanceM?: number;
  fallbackGroundElevationM?: number;
  clampToSeaLevel?: boolean;
  checkCentral?: boolean;
}

/** Etapes del càlcul. Codis, no frases: el text el posa la interfície. */
export type AlignmentStage = 'geometry' | 'tiles' | 'terrain' | 'done';

export interface AlignmentProgress {
  stage: AlignmentStage;
  /** Tant per u global, per a la barra. */
  ratio: number;
  /** Tessel·les baixades i totals, quan l'etapa és la de xarxa. */
  tilesDone?: number;
  tilesTotal?: number;
}

export interface AlignmentWorkerSolveRequest {
  type: 'solve';
  /** Identificador de la petició: les respostes tardanes es poden descartar. */
  id: number;
  eclipseId: string;
  target: AlignmentTarget;
  /** On ets. Serveix per dir-te què et costa arribar-hi. */
  origin?: GeoLocation;
  options?: AlignmentWorkerOptions;
}

export interface AlignmentWorkerCancelRequest {
  type: 'cancel';
  id: number;
}

export type AlignmentWorkerRequest =
  | AlignmentWorkerSolveRequest
  | AlignmentWorkerCancelRequest;

export type AlignmentWorkerResponse =
  | { type: 'progress'; id: number; progress: AlignmentProgress }
  | { type: 'done'; id: number; outcome: AlignmentOutcome; terrainChecked: boolean }
  | { type: 'error'; id: number; message: string };

/**
 * `DedicatedWorkerGlobalScope` no existeix quan la configuració de TypeScript
 * carrega la llibreria DOM, i barrejar les dues llibreries dona col·lisions de
 * tipus a tot el projecte. Declarem només la part del scope que fem servir.
 * Mateix criteri que a `horizon.worker.ts` i `spots.worker.ts`.
 */
interface WorkerScope {
  postMessage(message: AlignmentWorkerResponse): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<AlignmentWorkerRequest>) => void,
  ): void;
}

const ctx = self as unknown as WorkerScope;

/** Controladors vius, per poder cancel·lar una feina en curs per identificador. */
const running = new Map<number, AbortController>();

/**
 * Sostre de tessel·les que es baixen per a una alineació.
 *
 * D'ON SURT. Un passadís de 40 km —el límit per defecte— són unes 40 tessel·les
 * amb el marge d'una a cada costat. Aquest número no hi posa cap límit real:
 * hi és perquè una petició amb `maxDistanceKm` esbojarrat no es pugui convertir
 * en un miler de peticions de xarxa des del mòbil d'algú.
 */
const MAX_TILES = 240;

async function handleSolve(request: AlignmentWorkerSolveRequest): Promise<void> {
  // Una petició nova amb el mateix identificador substitueix l'anterior.
  running.get(request.id)?.abort();

  const controller = new AbortController();
  running.set(request.id, controller);
  const { signal } = controller;

  const send = (progress: AlignmentProgress): void => {
    if (signal.aborted) return;
    ctx.postMessage({ type: 'progress', id: request.id, progress });
  };

  try {
    const base = {
      eclipseId: request.eclipseId,
      target: request.target,
      origin: request.origin,
      ...request.options,
    };
    const zoom = request.options?.elevationZoom ?? DEFAULT_ZOOM;

    /* ---- passada 0: la cota de l'element -------------------------------
     *
     * PER QUÈ CAL, I PER QUÈ NO ES VA VEURE FINS A PROVAR-HO. Sense cota,
     * `solveAlignment` no té res a fer i retorna `no-elevation`: la geometria
     * sencera penja de saber a quina altura és la punta. La cota pot venir de
     * tres llocs —escrita per l'usuari, deduïda de la cota del cim, o llegida
     * del model del terreny— i la tercera necessita una tessel·la baixada.
     *
     * Amb el protocol de dues passades tal com estava, la primera es feia
     * sense lector d'elevació i, per tant, qui triés un cim del cercador i no
     * escrivís cap número a mà rebia sempre «no sabem a quina cota és». Que és
     * el cas de la immensa majoria: ningú no sap de memòria que el castell de
     * Loarre és a 1.070 m.
     *
     * Es baixa NOMÉS la tessel·la de l'element (una, ~120 kB) i la cota es
     * passa com a dada. Així la primera passada segueix essent geometria pura
     * —sense comprovació de terreny amb el magatzem mig buit, que és el que el
     * mòdul avisa que no s'ha de fer— i el cas car segueix venint després.
     */
    let target = request.target;
    if (
      target.groundElevationM === undefined &&
      target.summitElevationM === undefined
    ) {
      const { x, y } = lonLatToTilePixel(target.lon, target.lat, zoom);
      send({ stage: 'tiles', ratio: 0.05, tilesDone: 0, tilesTotal: 1 });
      await prefetchTiles([{ z: zoom, x, y }], { signal });
      if (signal.aborted) return;

      const ground = elevationAtSync(target.lon, target.lat, zoom);
      // `undefined` vol dir que la tessel·la no ha arribat. No s'hi posa cap
      // zero: `solveAlignment` ja sap dir que no ho sap, i un zero enviaria
      // algú a buscar un castell al nivell del mar.
      if (ground !== undefined) target = { ...target, groundElevationM: ground };
    }
    const withTarget = { ...base, target };

    /* ---- passada 1: geometria sola ------------------------------------- */
    send({ stage: 'geometry', ratio: 0.1 });
    const geometry = solveAlignment(withTarget);

    if (signal.aborted) return;

    // Sense punt no hi ha passadís que baixar, i el motiu del fracàs ja és
    // definitiu: cap tessel·la faria aparèixer un Sol que ja s'ha post.
    if (!geometry.ok) {
      ctx.postMessage({
        type: 'done',
        id: request.id,
        outcome: geometry,
        terrainChecked: false,
      });
      return;
    }

    /* ---- passada 2: el terreny del passadís ----------------------------- */
    const tiles = new Map<string, TileId>();
    for (const tile of tilesAlongLine(target, geometry.point, zoom)) {
      tiles.set(tileKey(tile), tile);
    }
    // Les alternatives són punts de la MATEIXA línia més enllà del primer: si
    // no s'hi afegeixen, la segona passada les comprova amb el terreny a
    // mitges i les descarta per falta de dades, no per terreny.
    for (const other of geometry.alternatives) {
      for (const tile of tilesAlongLine(target, other, zoom)) {
        tiles.set(tileKey(tile), tile);
      }
    }

    const list = [...tiles.values()].slice(0, MAX_TILES);
    send({ stage: 'tiles', ratio: 0.15, tilesDone: 0, tilesTotal: list.length });

    const fetched = await prefetchTiles(list, {
      signal,
      onTileDone: (done, total) => {
        send({
          stage: 'tiles',
          // De 0,15 a 0,85: la xarxa és el gruix de l'espera i la barra ha de
          // dir-ho. La resta del càlcul són mil·lisegons.
          ratio: 0.15 + 0.7 * (total === 0 ? 1 : done / total),
          tilesDone: done,
          tilesTotal: total,
        });
      },
    });

    if (signal.aborted) return;

    /*
      SI NO HA ARRIBAT CAP TESSEL·LA, NO ES TORNA A RESOLDRE.

      Amb el lector posat i el magatzem buit, `solveAlignment` no falla: fa la
      comprovació de terreny contra un terreny que no hi és i el resultat surt
      amb `checked: false`. Seria el mateix que la primera passada però havent
      fet esperar l'usuari, i amb el risc que la segona resolgués una geometria
      lleugerament diferent. Es retorna la primera i es diu que el terreny no
      s'ha comprovat.
    */
    if (list.length > 0 && fetched.loaded === 0) {
      ctx.postMessage({
        type: 'done',
        id: request.id,
        outcome: geometry,
        terrainChecked: false,
      });
      return;
    }

    send({ stage: 'terrain', ratio: 0.9 });
    const withTerrain = solveAlignment({ ...withTarget, elevation: elevationAtSync });

    if (signal.aborted) return;
    send({ stage: 'done', ratio: 1 });
    ctx.postMessage({
      type: 'done',
      id: request.id,
      outcome: withTerrain,
      terrainChecked: withTerrain.ok ? withTerrain.terrain.checked : false,
    });
  } catch (error) {
    // Una cancel·lació no és un error per a qui espera: ja no vol el resultat.
    if (signal.aborted) return;
    ctx.postMessage({
      type: 'error',
      id: request.id,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    // Només esborrem el nostre: si mentrestant n'ha entrat un altre amb el
    // mateix identificador, el seu controlador ja ocupa la casella.
    if (running.get(request.id) === controller) running.delete(request.id);
    // Si no queda cap feina viva, les tessel·les tornen al sistema. El Worker
    // sobreviu a la petició: provar un altre cim del mateix massís no torna a
    // baixar res.
    if (running.size === 0) releaseTiles();
  }
}

ctx.addEventListener('message', (event: MessageEvent<AlignmentWorkerRequest>) => {
  const request = event.data;
  if (request.type === 'cancel') {
    running.get(request.id)?.abort();
    return;
  }
  void handleSolve(request);
});
