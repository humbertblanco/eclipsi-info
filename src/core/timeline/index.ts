/**
 * API pública del rellotge de simulació.
 *
 * Qui el consumeix importa d'aquí i no dels fitxers de dins, com a
 * `core/timer/index.ts`. Res d'aquest mòdul toca el DOM ni cap rellotge: es pot
 * córrer en un Worker, en un test de Node i —això és el que el fa reutilitzable—
 * dins de tres pantalles alhora sense que cap es porti l'estat de l'altra.
 */

export {
  activeMarkIndex,
  createTimeline,
  isPlayable,
  markTime,
  offsetFromNowMs,
  sampleIndexForTime,
  timelineFromContacts,
  timelineProgress,
  timelineReduce,
  MAX_FRAME_MS,
  NUDGE_MS,
  PLAYBACK_RATES,
} from './playback';

export type { CreateTimelineOptions } from './playback';

export type {
  ContactId,
  ContactTimesMs,
  PlaybackRate,
  TimelineAction,
  TimelineMark,
  TimelineSource,
  TimelineState,
  TimelineWindow,
} from './types';
