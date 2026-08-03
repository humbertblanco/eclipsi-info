/**
 * Desplaçar una polilínia lateralment, en quilòmetres.
 *
 * PER QUÈ EXISTEIX. La vora de la franja es dibuixa com una ratlla dura, i la
 * ratlla dura és mentida: sabem on és amb un error de quilòmetres. Per pintar
 * el dubte cal el que la ratlla no dona — les DUES ratlles paral·leles a una
 * distància real d'ella—, i això és desplaçar la polilínia de costat.
 *
 * PER QUÈ NO ES FA AMB `destinationPoint` DE `geo/sector`. Perquè aquella
 * normalitza la longitud a ±180°, i les polilínies de `eclipses/path` arriben
 * DESENROTLLADES a posta: la franja del 2026 passa pel pol i els seus punts
 * poden anar a 190° o a −200° perquè el traçat no es parteixi. Normalitzar-los
 * pel camí dibuixaria una banda que travessa el mapa sencer — el mateix
 * accident que `drawableRuns` s'encarrega d'evitar a l'altra banda. Aquí, per
 * tant, s'aplica el desplaçament en graus i es deixa la longitud tal com ve.
 *
 * L'APROXIMACIÓ ÉS PLANA I ES POT DEFENSAR. Un grau de latitud són 111,32 km i
 * un de longitud, aquells mateixos km pel cosinus de la latitud. Per a
 * desplaçaments de desenes de quilòmetres l'error d'aquesta aproximació és de
 * metres, i el que es pinta és una zona de dubte de vint quilòmetres d'ample:
 * el mateix criteri que `geo/sector` documenta per al con de visió i que
 * `spots/grid` fa servir per a les distàncies aproximades.
 */

import type { Position } from 'geojson';

/** Km d'un grau de latitud. El mateix valor que `eclipses/path`. */
const KM_PER_DEG_LAT = 111.32;

const DEG = Math.PI / 180;

/**
 * Coordenada en ordre GeoJSON: [longitud, latitud].
 *
 * És el `Position` de GeoJSON i no una tupla pròpia a posta: així les
 * polilínies que surten d'`eclipsePathToGeoJson` s'hi poden passar tal com
 * són, sense cap conversió pel camí que convidi a normalitzar la longitud.
 */
export type LonLat = Position;

/**
 * Rumb del tram de polilínia al vèrtex `i`, com a vector unitari en graus de
 * longitud i latitud ja escalats a km. Als extrems s'agafa el tram que hi ha;
 * al mig, la mitjana dels dos, que és el que fa que la banda no faci escalons
 * als colzes.
 */
function tangentAt(points: readonly LonLat[], i: number): { east: number; north: number } {
  const prev = points[Math.max(0, i - 1)];
  const next = points[Math.min(points.length - 1, i + 1)];
  const lat = points[i][1];
  const cos = Math.max(0.02, Math.cos(lat * DEG));

  const east = (next[0] - prev[0]) * cos;
  const north = next[1] - prev[1];
  const norm = Math.hypot(east, north);
  // Dos vèrtexs idèntics no tenen tangent: es respon nord, que és tan arbitrari
  // com qualsevol altra cosa però no és NaN.
  if (norm < 1e-12) return { east: 0, north: 1 };
  return { east: east / norm, north: north / norm };
}

/**
 * La polilínia desplaçada `offsetKm` cap a la seva ESQUERRA (positiu) o cap a
 * la dreta (negatiu), mirant en el sentit del traçat.
 *
 * Manté el nombre de vèrtexs i l'ordre, i no normalitza cap longitud.
 */
export function offsetPolylineKm(
  points: readonly LonLat[],
  offsetKm: number,
): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const [lon, lat] = points[i];
    const t = tangentAt(points, i);
    // Normal esquerra del vector tangent (est, nord): (−nord, est).
    const dNorthKm = offsetKm * t.east;
    const dEastKm = -offsetKm * t.north;

    const kmPerDegLon = KM_PER_DEG_LAT * Math.max(0.02, Math.cos(lat * DEG));
    out.push([lon + dEastKm / kmPerDegLon, lat + dNorthKm / KM_PER_DEG_LAT]);
  }
  return out;
}

/**
 * L'anell d'una franja paral·lela a la polilínia, entre les distàncies `fromKm`
 * i `toKm` (amb signe: positiu és l'esquerra del traçat).
 *
 * Retorna l'anell exterior d'un `Polygon` de GeoJSON, tancat: una vora
 * endavant, l'altra enrere i el primer vèrtex repetit al final. Buit si la
 * polilínia no té almenys dos punts, perquè un polígon d'un sol punt no és res.
 */
export function polylineStripRing(
  points: readonly LonLat[],
  fromKm: number,
  toKm: number,
): [number, number][] {
  if (points.length < 2) return [];

  const near = offsetPolylineKm(points, fromKm);
  const far = offsetPolylineKm(points, toKm);
  const ring: [number, number][] = [...near, ...far.reverse()];
  ring.push(ring[0]);
  return ring;
}
