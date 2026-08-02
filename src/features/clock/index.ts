/**
 * API pública del control del rellotge del dispositiu.
 *
 * El component ja porta la comprovació a dins; el hook s'exporta per si alguna
 * altra vista vol dir-ho d'una altra manera. La matemàtica no és aquí: és a
 * `core/timer/reference.ts`, que es pot provar sense navegador.
 */

export { ClockDriftNotice } from './ClockDriftNotice';
export type { ClockDriftNoticeProps } from './ClockDriftNotice';

export { useClockCheck } from './useClockCheck';
export type { ClockCheckProblem, ClockCheckState } from './useClockCheck';
