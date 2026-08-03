/**
 * Geometria de sectors sobre l'esfera, per pintar el con de visió al mapa.
 *
 * El con de visió és el tros de territori que tens davant quan mires el Sol
 * durant l'eclipsi: des del teu punt, l'abast d'azimuts entre el primer
 * contacte i l'últim. El mapa el pinta com un sector circular; aquest mòdul
 * només en calcula els vèrtexs, en coordenades geogràfiques, i per això viu a
 * `core`: ni DOM, ni MapLibre, i es prova a Node amb casos que un mapa no
 * ensenyaria mai (azimuts que creuen el nord, sectors degenerats).
 *
 * Esfera i no el·lipsoide, a posta: el con és un dibuix orientatiu de
 * desenes de quilòmetres, no una mesura. L'error esfèric a aquesta escala és
 * de metres i cap decisió de l'usuari no hi depèn — el mateix criteri que
 * `core/spots/grid.ts` fa servir per a les distàncies aproximades.
 */

/** Radi mitjà de la Terra, en km. */
const EARTH_RADIUS_KM = 6371;

export interface GeoPoint {
  lat: number;
  lon: number;
}

/**
 * El punt on arribes caminant `distanceKm` des de (lat, lon) amb rumb
 * `bearingDeg` (0 = nord, 90 = est), sobre l'esfera.
 */
export function destinationPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceKm: number,
): GeoPoint {
  const δ = distanceKm / EARTH_RADIUS_KM;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;

  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(Math.max(-1, Math.min(1, sinφ2)));
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * sinφ2,
    );

  const lat2 = (φ2 * 180) / Math.PI;
  // Normalitzada a ±180°: el sector es pinta en un mapa que no vol còpies del món.
  const lon2 = ((((λ2 * 180) / Math.PI + 180) % 360) + 360) % 360 - 180;
  return { lat: lat2, lon: lon2 };
}

/**
 * Gir NET (amb signe) per anar del rumb `fromDeg` al rumb `toDeg` pel camí
 * curt. Positiu en sentit horari. És el que resol els azimuts que creuen el
 * nord: de 350° a 10° el resultat és +20, no −340.
 */
export function bearingDelta(fromDeg: number, toDeg: number): number {
  return ((toDeg - fromDeg + 540) % 360) - 180;
}

/**
 * L'anell d'un sector circular: el vèrtex al punt d'origen i l'arc del rumb
 * `fromBearingDeg` al `toBearingDeg` pel camí curt, a `radiusKm`.
 *
 * Retorna coordenades en ordre GeoJSON ([lon, lat]) i TANCADES (el primer i
 * l'últim vèrtex són el punt d'origen): és directament l'anell exterior d'un
 * `Polygon`.
 */
export function sectorRing(
  lat: number,
  lon: number,
  fromBearingDeg: number,
  toBearingDeg: number,
  radiusKm: number,
  steps = 24,
): [number, number][] {
  const delta = bearingDelta(fromBearingDeg, toBearingDeg);
  const n = Math.max(2, steps);

  const ring: [number, number][] = [[lon, lat]];
  for (let i = 0; i <= n; i++) {
    const bearing = fromBearingDeg + (delta * i) / n;
    const p = destinationPoint(lat, lon, bearing, radiusKm);
    ring.push([p.lon, p.lat]);
  }
  ring.push([lon, lat]);
  return ring;
}
