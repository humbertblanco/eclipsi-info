/**
 * API pública de la previsió de nuvolositat.
 *
 * El punt d'entrada normal és `getCloudOutlook`. La resta són peces que
 * s'exporten perquè la interfície les necessita per explicar la dada, i
 * perquè els tests les puguin provar per separat.
 */

export {
  getCloudOutlook,
  outlookMode,
  leadDays,
  confidenceForLead,
  confidenceForYears,
  forecastCaveat,
  climatologyCaveat,
  CONFIDENCE_LABEL,
  CLIMATOLOGY_YEARS,
  CLIMATOLOGY_WINDOW_DAYS,
  CLIMATOLOGY_MIN_YEARS,
  FORECAST_TTL_MS,
  CLIMATOLOGY_TTL_MS,
} from './outlook';

/**
 * La capa de nuvolositat del mapa. Són dues peces i van juntes: `climGrid`
 * llegeix la climatologia precalculada de tota la franja i `mapMode` decideix
 * si el que toca ensenyar és aquella climatologia o una previsió viva —i amb
 * quina cara, que és la part que no es pot delegar al component.
 */
export {
  parseCloudClimGrid,
  climCellsForViewport,
  climCellsToGeoJson,
  climCellAt,
  climGridBounds,
  climGridFileName,
  allClimCells,
  CloudClimGridError,
  CLIM_GRID_FORMAT,
} from './climGrid';
export type {
  CloudClimGrid,
  CloudClimColumns,
  ClimCell,
  ClimCellProperties,
  ClimGridErrorCode,
  GeoBBox,
} from './climGrid';

export { planCloudMap, FORECAST_HORIZON_DAYS, LIVE_FORECAST_MAX_POINTS } from './mapMode';
export type { CloudMapPlan, CloudMapPlanOptions, CloudMapTexture } from './mapMode';

export {
  scoreCloudLayers,
  bandForScore,
  estimateHaze,
  averageLayers,
  LAYER_TRANSMISSION,
  LAYER_OPACITY,
  LAYER_BOUNDS_M,
  LAYER_ORDER,
  LAYER_LABEL,
  LAYER_NOTE,
  BAND_CLEAR_MIN,
  BAND_PARTIAL_MIN,
  SCORING_VERSION,
} from './layers';

export {
  planLineOfSight,
  pointsForLayer,
  planSignature,
  groundDistanceToHeightKm,
  groundDistanceToHeightM,
  angularFromGroundM,
  destinationPoint,
  compassLabel,
  SLANT_ALTITUDE_THRESHOLD_DEG,
  MAX_SAMPLE_DISTANCE_KM,
  LAYER_SAMPLE_HEIGHTS_M,
} from './lineOfSight';

export {
  BAND_TITLE,
  BAND_MEANING,
  describeAge,
  describeAgeSince,
  describeLead,
  describeLineOfSight,
  describeDominantLayer,
  describeHaze,
} from './describe';

export {
  OPEN_METEO_ATTRIBUTION,
  MAX_FORECAST_DAYS,
  FORECAST_ENDPOINT,
  ARCHIVE_ENDPOINT,
} from './openMeteo';

export { clearWeatherCache } from './cache';

export { CloudOutlookError, CLOUD_ERROR_TEXT } from './types';
export type {
  CloudErrorCode,
  LocalisedText,
  WeatherLocale,
  CloudOutlook,
  ForecastOutlook,
  ClimatologyOutlook,
  ClimatologyStats,
  CloudOutlookRequest,
  CloudOutlookOptions,
  CloudLayers,
  CloudLayerId,
  CloudScore,
  Confidence,
  HazeEstimate,
  LineOfSightPoint,
  OutlookMode,
  SamplingPlan,
  SkyBand,
} from './types';
