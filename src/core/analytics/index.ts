/**
 * Analítica d'ús — barril públic.
 *
 * QUÈ HI HA AQUÍ DINS, en una frase: saber quines coses de l'app es fan servir
 * sense saber mai on és ningú.
 *
 * COM ES FA SERVIR, en tres línies:
 *
 *     import { track } from '../core/analytics';
 *     track('map_layer_toggle', { layer: 'hillshade', state: 'on' });
 *
 * I res més: si no hi ha `gtag`, si hi ha un bloquejador, si això corre a Node
 * o dins d'un Worker, la crida no fa res i no peta. No cal comprovar res abans.
 *
 * QUÈ NO POT SORTIR D'AQUÍ, i està escrit com a codi a `sanitize.ts`: cap
 * número, cap text lliure, cap clau amb nom de lloc i cap adreça amb consulta.
 * Per tant, cap coordenada, cap topònim de l'usuari i cap `?p=lat,lon`.
 *
 * ON AFEGIR UN ESDEVENIMENT NOU: a `vocabulary.ts`, i enlloc més. Allà hi ha la
 * pregunta que t'has de fer abans (quina decisió canviaria) i el format de la
 * resposta.
 */

export {
  VOCABULARY,
  isAnalyticsEventName,
  declaredParams,
  type AnalyticsEventName,
  type AnalyticsParams,
  type Vocabulary,
} from './vocabulary';

export {
  sanitizeEvent,
  safePageLocation,
  isSafeToken,
  isForbiddenKey,
  TOKEN_PATTERN,
  EVENT_NAME_PATTERN,
  MAX_PARAMS,
  type RejectionReason,
  type SanitizeResult,
} from './sanitize';

export {
  track,
  installAnalytics,
  analyticsInstalled,
  type AnalyticsTransport,
  type TrackOutcome,
} from './track';

export {
  CONSENT_STORAGE_KEY,
  CONSENT_MAX_AGE_MS,
  CONSENT_FUTURE_TOLERANCE_MS,
  isConsentChoice,
  serializeConsent,
  parseConsent,
  needsDecision,
  analyticsStorage,
  type ConsentChoice,
  type ConsentState,
  type StoredConsent,
} from './consent';

export {
  waitBucket,
  durationBucket,
  terrainBucket,
  rankBucket,
  horizonReason,
  type WaitBucket,
  type DurationBucket,
  type TerrainBucket,
  type RankBucket,
} from './buckets';
