/**
 * Models visuals dels tres retrats del punt.
 *
 * La vista no recalcula astronomia: transforma dades que ja han passat pels
 * motors de circumstàncies, relleu, incertesa i moviment de l'ombra. Això és
 * important perquè un dibuix convincent amb una segona definició de «franja»
 * seria més perillós que cap dibuix. Totes les coordenades que surten d'aquí
 * són normalitzades i es poden provar sense DOM ni canvas.
 */

import type { LocalCircumstances } from '../../core/astro/types';
import type { BandLimitDistance } from '../../core/astro/uncertainty';
import type { ShadowMotion } from '../../core/astro/shadow';
import type { HorizonProfile } from '../../core/horizon/profile';
import type { VisibilityVerdict } from '../../core/visibility/verdict';

export interface FingerprintPoint {
  x: number;
  y: number;
}

export interface FingerprintModel {
  terrain: 'measured' | 'assumed';
  horizon: FingerprintPoint[];
  sunAzimuthDeg: number;
  sunRadius: number;
  moonRadius: number;
  separation: number;
  metric: number | null;
  kind: LocalCircumstances['kind'];
}

const TAU = Math.PI * 2;

/**
 * El perfil circular usa una escala angular fixa: 0° cau al radi 0,76 i cada
 * grau de relleu el fa entrar 0,012. No s'autoescala per punt: una carena de
 * 8° ha de semblar més alta que una de 2°, també comparant dues empremtes.
 */
export function buildFingerprintModel(
  circumstances: LocalCircumstances,
  horizon: HorizonProfile | null,
  verdict: VisibilityVerdict | null,
): FingerprintModel {
  const max = circumstances.contacts.max;
  const altitudes = horizon?.altitudes.length ? horizon.altitudes : new Array(72).fill(0);
  const step = Math.max(1, Math.ceil(altitudes.length / 144));
  const points: FingerprintPoint[] = [];

  for (let i = 0; i < altitudes.length; i += step) {
    const azimuth = (i / altitudes.length) * 360;
    const angle = (azimuth - 90) * (Math.PI / 180);
    const altitude = Math.max(-5, Math.min(20, altitudes[i] ?? 0));
    const radius = Math.max(0.46, Math.min(0.82, 0.76 - altitude * 0.012));
    points.push({ x: 0.5 + Math.cos(angle) * radius * 0.5, y: 0.5 + Math.sin(angle) * radius * 0.5 });
  }

  const central = circumstances.kind === 'total' || circumstances.kind === 'annular';
  const rawMetric = central
    ? verdict?.centralVisibleFraction ?? null
    : verdict?.maxVisibleObscuration ?? max.obscuration;
  const scale = 0.115 / Math.max(max.sun.angularRadius, max.moon.angularRadius);

  return {
    terrain: horizon ? 'measured' : 'assumed',
    horizon: points,
    sunAzimuthDeg: max.sun.azimuth,
    sunRadius: max.sun.angularRadius * scale,
    moonRadius: max.moon.angularRadius * scale,
    separation: Math.min(0.18, max.separation * scale),
    metric: rawMetric === null ? null : Math.max(0, Math.min(1, rawMetric)),
    kind: circumstances.kind,
  };
}

export function fingerprintPath(model: FingerprintModel, size: number): string {
  if (model.horizon.length === 0) return '';
  return model.horizon
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${(point.x * size).toFixed(2)} ${(point.y * size).toFixed(2)}`)
    .join(' ') + ' Z';
}

export interface ShadowApproachModel {
  arrivalBearing: number;
  speedKmh: number | null;
  watchFromMs: number;
  c2Ms: number;
  progress: number;
  lowSunCaveat: boolean;
  kind: 'total' | 'annular';
}

export function buildShadowApproachModel(
  motion: ShadowMotion,
  circumstances: LocalCircumstances,
  nowMs: number,
): ShadowApproachModel | null {
  const c2 = circumstances.contacts.c2;
  if (!c2 || (circumstances.kind !== 'total' && circumstances.kind !== 'annular')) return null;
  const watchFromMs = motion.watchFromUtc.getTime();
  const c2Ms = c2.time.getTime();
  const duration = Math.max(1, c2Ms - watchFromMs);
  return {
    arrivalBearing: motion.arrivalBearing,
    speedKmh: motion.speedDiverging ? null : motion.speedKmh,
    watchFromMs,
    c2Ms,
    progress: Math.max(0, Math.min(1, (nowMs - watchFromMs) / duration)),
    lowSunCaveat: motion.lowSunCaveat,
    kind: circumstances.kind,
  };
}

export interface BandPositionModel {
  inside: boolean;
  side: 'north' | 'south';
  point: number;
  center: number;
  uncertaintyFraction: number;
  distanceToLimitKm: number;
  distanceToCenterKm: number | null;
  bandWidthKm: number;
}

/**
 * A dins, la posició surt de la distància al límit sobre l'amplada calculada
 * pel mateix motor. A fora el marcador ocupa una ranura fixa: la xifra escrita
 * conserva la distància exacta i el dibuix no fingeix que una escala finita
 * pot representar qualsevol distància exterior.
 */
export function buildBandPositionModel(
  limit: BandLimitDistance,
  toCenterKm: number | null,
  limitUncertaintyKm: number,
): BandPositionModel {
  const width = Math.max(0.001, limit.bandWidthKm);
  let point: number;
  if (limit.inside) {
    point = limit.side === 'north' ? limit.km / width : 1 - limit.km / width;
  } else {
    point = limit.side === 'north' ? -0.08 : 1.08;
  }
  point = Math.max(-0.08, Math.min(1.08, point));

  let center = 0.5;
  if (toCenterKm !== null && limit.inside) {
    center = limit.side === 'north'
      ? point + toCenterKm / width
      : point - toCenterKm / width;
    if (center < 0 || center > 1) center = 0.5;
  }

  return {
    inside: limit.inside,
    side: limit.side,
    point,
    center,
    uncertaintyFraction: Math.max(0, Math.min(0.25, limitUncertaintyKm / width)),
    distanceToLimitKm: limit.km,
    distanceToCenterKm: toCenterKm,
    bandWidthKm: limit.bandWidthKm,
  };
}

export function polarPoint(bearingDeg: number, radius: number, cx = 50, cy = 50) {
  const angle = (bearingDeg - 90) * (TAU / 360);
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}
