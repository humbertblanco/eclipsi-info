/**
 * API pública del compte enrere.
 *
 * El component ja porta tot el que necessita (veu, bloqueig de pantalla,
 * assaig). El hook s'exporta per si el coordinador vol muntar una altra
 * disposició amb la mateixa lògica.
 */

export { CountdownView } from './CountdownView';
export type { CountdownViewProps } from './CountdownView';

export { useEclipseTimer } from './useEclipseTimer';
export type { EclipseTimerState, ScriptMoment, UseEclipseTimerOptions } from './useEclipseTimer';

export { createAnnouncer } from './speech';
export type { Announcer, AnnouncerOptions, VoiceStatus } from './speech';

export { useWakeLock } from './useWakeLock';
export type { WakeLockState } from './useWakeLock';
