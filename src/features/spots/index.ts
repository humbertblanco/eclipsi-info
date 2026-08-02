/**
 * API pública del cercador de llocs, per al coordinador.
 *
 * El camí curt és `SpotSearchPanel`: se li passa l'eclipsi i on ets, i ja
 * porta el botó, el progrés, els errors i la llista. Les peces soltes
 * s'exporten perquè una pantalla que ja tingui la seva pròpia capçalera pugui
 * fer servir només la llista, o només el hook.
 */

export { SpotSearchPanel } from './SpotSearchPanel';
export type { SpotSearchPanelProps } from './SpotSearchPanel';

export { SpotList } from './SpotList';
export type { SpotListProps } from './SpotList';

export { SpotCard } from './SpotCard';
export type { SpotCardProps } from './SpotCard';

export { SpotFunnelCost } from './SpotFunnelCost';
export type { SpotFunnelCostProps } from './SpotFunnelCost';

export { sp } from './strings';
export type { SpotStringKey } from './strings';

export { useSpotSearch } from './useSpotSearch';
export type {
  SpotSearchStatus,
  UseSpotSearchParams,
  UseSpotSearchResult,
} from './useSpotSearch';

export {
  NBSP,
  bearingPhrase,
  durationText,
  formatBytes,
  formatClock,
  coordsForCopy,
  formatCoords,
  formatCount,
  formatDegrees,
  formatDistance,
  formatDuration,
  formatMetres,
  formatMs,
  formatPercent,
  formatRatio,
  mapUrl,
} from './format';
