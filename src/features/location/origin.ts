/**
 * Com es diu, en paraules, d'on ha sortit un punt.
 *
 * PER QUÈ VIU EN UN FITXER PROPI i no dins de `LocationBar.tsx`: un mòdul que
 * exporta un component i a més constants trenca la recàrrega en calent de
 * React, i `oxlint` ho marca. Però el motiu de fons és millor que això: la
 * taula d'orígens la fan servir la barra, la fulla de tria i la llista de
 * l'historial, i si visqués dins d'un component, el segon consumidor se'n
 * faria una còpia i acabaríem dient «GPS» en un lloc i «Del GPS» en un altre
 * per al mateix punt.
 */

import { formatCoords } from '../../screens/format';
import type { FixedLocation, LocationOrigin } from '../../state/location';
import type { LocationStringKey } from './strings';

/** Clau de text per a cada origen. Cap origen no es queda sense dir-se. */
export const ORIGIN_KEY: Record<LocationOrigin, LocationStringKey> = {
  gps: 'origin.gps',
  map: 'origin.map',
  search: 'origin.search',
  recent: 'origin.recent',
  link: 'origin.link',
  default: 'origin.default',
};

/**
 * El nom del lloc, i si no se'n sap, les coordenades.
 *
 * MAI RES BUIT: un punt sense nom segueix essent un punt perfectament
 * identificable, i ensenyar-hi un espai en blanc faria pensar que l'app no sap
 * on ets quan ho sap exactament.
 */
export function placeTitle(fix: FixedLocation): string {
  if (fix.label !== null && fix.label !== '') return fix.label;
  return formatCoords(fix.location.lat, fix.location.lon);
}
