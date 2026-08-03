/** API pública de la pàgina «Com funciona», per al coordinador. */

export { AboutScreen } from './AboutScreen';
export type { AboutScreenProps } from './AboutScreen';

/*
 * ELS CRÈDITS SURTEN D'AQUÍ PERQUÈ NO SÓN D'AQUESTA PÀGINA: els pinten també
 * el peu i el diàleg del mapa. Viuen a `features/about` perquè és aquí on la
 * pàgina que té per feina publicar-los els llegeix, no perquè li pertanyin.
 *
 * `ObservationSources` s'exporta pel mateix motiu: el diàleg de crèdits del
 * mapa l'ha de poder muntar sense saber res de la pàgina «Com funciona».
 */
export { ObservationSources } from './ObservationSources';
export type { ObservationSourcesProps } from './ObservationSources';
export {
  CREDITS,
  OBSERVATION_SOURCES_HEADING,
  OBSERVATION_SOURCES_NOTE,
  PRIVACY_NOTE,
  SOURCES_HEADING,
} from './credits';
export type { Credit } from './credits';

/*
 * Els textos surten pel mateix motiu que a weather: la pantalla que munti la
 * pàgina n'ha de poder dir el títol —a una pestanya, a un menú— sense
 * reescriure'l. La còpia dels autors (vegeu la nota a strings.ts) segueix
 * visible; la de les fonts ja no existeix.
 */
export { ab, ABOUT_AUTHORS } from './strings';
export type { AboutAuthor, AboutStringKey } from './strings';
