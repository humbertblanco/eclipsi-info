/**
 * El paquet de dades que `App` calcula un sol cop i reparteix a les pantalles.
 *
 * PER QUÈ ES CALCULA A DALT I NO A CADA PANTALLA: `computeLocalCircumstances`
 * fa una cerca d'arrels amb centenars de crides a efemèrides, i
 * `computeVisibility` escombra la fase central segon a segon. Fer-ho a cada
 * pantalla vol dir refer-ho cada vegada que es canvia de pestanya, i el
 * resultat és exactament el mateix: depèn només del lloc i de l'eclipsi.
 */

import type { GeoLocation, LocalCircumstances } from '../core/astro/types';
import type { HorizonProfile } from '../core/horizon/profile';
import type { VisibilityVerdict } from '../core/visibility/verdict';
import type { Locale } from '../i18n';

export interface EclipseContext {
  eclipseId: string;
  locale: Locale;
  /** `null` mentre no se sap on és l'usuari. */
  location: GeoLocation | null;
  /**
   * Nom del lloc, quan es coneix (s'ha triat d'una llista, no s'ha geolocalitzat).
   * No hi ha geocodificació inversa: sense xarxa no serviria de res el dia de
   * l'eclipsi, que és justament quan cal.
   */
  placeLabel: string | null;
  circumstances: LocalCircumstances | null;
  /**
   * `null` mentre el perfil del terreny no està calculat. Sense veredicte, les
   * pantalles han de dir que la xifra és la teòrica i que el relleu encara no
   * hi entra — mai fer veure que ja és la bona.
   */
  verdict: VisibilityVerdict | null;
  horizon: HorizonProfile | null;
}
