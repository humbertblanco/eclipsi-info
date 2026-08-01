/**
 * API pública del programador d'avisos.
 *
 * Qui el consumeix importa d'aquí i no dels fitxers de dins: així la
 * reorganització interna no trenca res. Res d'aquest mòdul toca el DOM.
 */

export type {
  AlertAnchor,
  AlertKind,
  AlertSchedule,
  AlertSeverity,
  ContactId,
  ContactTimesMs,
  CountdownTarget,
  FilterGate,
  FilterGateReason,
  LocalisedText,
  TimerLocale,
  TimerPhase,
  VoiceAlert,
} from './types';

export { buildAlertSchedule, scheduleFromCircumstances } from './schedule';
export type { ScheduleInput } from './schedule';

export {
  canRemoveFilter,
  FILTER_OFF_DELAY_SEC,
  MIN_TOTALITY_FOR_FILTER_OFF_SEC,
} from './safety';
export type { FilterGateInput } from './safety';

/**
 * Els dos textos que parlen del filtre, exposats a fora amb el sufix `Phrase`.
 *
 * Els necessita el guió de la totalitat (`src/content/totality-script.ts`), que
 * ha de dir el mateix que la veu sense redactar-ho una segona vegada: dues
 * redaccions de la mateixa autorització és com es divergeix sense adonar-se'n.
 * El sufix evita confondre'ls amb els valors `'filter-off'` i `'filter-on'` de
 * `AlertKind`.
 */
export { filterOff as filterOffPhrase, filterOn as filterOnPhrase } from './phrases';
export type { AlertText, CentralMode } from './phrases';

export { FILTER_GATE_NOTE } from './phrases';
export { formatCountdown, resolveCountdown, splitDuration } from './countdown';
export type { CountdownInput, DurationParts } from './countdown';

export { createMonotonicClock, DEFAULT_RESYNC_TOLERANCE_MS } from './clock';
export type { ClockSources, MonotonicClock, MonotonicClockOptions } from './clock';

export { createAlertRunner } from './runner';
export type {
  AlertEvent,
  AlertRunner,
  RunnerOptions,
  SkipReason,
  TimerFns,
  TimerHandle,
} from './runner';

export { buildRehearsalSchedule, rehearsalDurationMs } from './rehearsal';
export type { RehearsalOptions } from './rehearsal';
