/* ============================================================================
   Capa offline — API pública.

   Tot el que la resta de l'aplicació ha de conèixer passa per aquí. Qui
   connecti això a l'App només necessita tres coses:

     1. `initServiceWorker()` a `main.tsx`, abans de muntar React.
     2. `<OfflinePanel location={...} />` en una pestanya o full, i
        `<ConnectionBadge />` a la barra superior. Els estils viatgen amb els
        components; no cal importar cap CSS.

   La resta (hooks, planificació, inventari) queda disponible per si es vol
   ensenyar l'estat en un altre lloc.
   ========================================================================== */

/* --- arrencada ------------------------------------------------------------ */
export {
  initServiceWorker,
  applyUpdate,
  dismissUpdate,
  getServiceWorkerState,
  subscribeServiceWorker,
} from './registerServiceWorker';
export type { ServiceWorkerState } from './registerServiceWorker';

/* --- components ----------------------------------------------------------- */
export { OfflinePanel } from './OfflinePanel';
export type { OfflinePanelProps } from './OfflinePanel';
export { ConnectionBadge } from './ConnectionBadge';
export type { ConnectionBadgeProps } from './ConnectionBadge';
export { UpdatePrompt } from './UpdatePrompt';

/* --- hooks ---------------------------------------------------------------- */
export { useOnlineStatus } from './useOnlineStatus';
export type { OnlineStatus } from './useOnlineStatus';
export { useServiceWorker } from './useServiceWorker';
export { usePrepare } from './usePrepare';
export type { UsePrepareResult, UsePrepareState } from './usePrepare';
export { useOfflineInventory } from './useOfflineInventory';
export type { OfflineInventory } from './useOfflineInventory';

/* --- precàrrega ----------------------------------------------------------- */
export {
  prepareLocation,
  defaultPlaceLabel,
  isAbortError,
  waitForServiceWorkerControl,
} from './prepare';
export type {
  PrepareOptions,
  PreparePhase,
  PrepareProgress,
  PrepareResult,
} from './prepare';

/* --- planificació i inventari --------------------------------------------- */
export {
  planPrepare,
  planTerrainTiles,
  planBasemapTiles,
  tilesInRadius,
  formatBytes,
} from './plan';
export type { PreparePlan } from './plan';
export {
  listPreparedPlaces,
  savePreparedPlace,
  deletePreparedPlace,
  clearPreparedPlaces,
  preparedPlaceId,
} from './store';
export type { PreparedPlace } from './store';
export {
  estimateStorage,
  requestPersistentStorage,
  countCachedTiles,
  countCacheEntries,
  clearTileCaches,
} from './storage';
export type { StorageSummary, CachedTileCounts } from './storage';

/* --- configuració del mapa base ------------------------------------------- */
/* El component del mapa ha de construir les URL amb `basemapTileUrl` o amb
   `BASEMAP.urlTemplate`: si en fa servir una altra, la precàrrega del mapa no
   li servirà de res (vegeu el comentari a `config.ts`). */
export {
  BASEMAP,
  BASEMAP_SOURCES,
  BASEMAP_LEVELS,
  basemapTileUrl,
  terrainTileUrl,
  CACHE_BASEMAP,
  CACHE_TERRAIN,
} from './config';
export type { BasemapSource, BasemapLevel } from './config';

/* --- plataforma ----------------------------------------------------------- */
export { isIOS, isStandalone, installHint } from './ios';
export type { InstallHint } from './ios';
