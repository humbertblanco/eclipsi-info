/** API pública de la pàgina «Com funciona», per al coordinador. */

export { AboutScreen } from './AboutScreen';
export type { AboutScreenProps } from './AboutScreen';
/*
 * Els textos i les dades surten pel mateix motiu que a weather: la pantalla
 * que munti la pàgina n'ha de poder dir el títol —a una pestanya, a un menú—
 * sense reescriure'l, i les còpies de les fonts i dels autors (vegeu la nota
 * a strings.ts) han de ser visibles perquè l'orquestrador les unifiqui amb
 * les de SiteFooter quan cabli.
 */
export { ab, ABOUT_AUTHORS, ABOUT_SOURCES } from './strings';
export type { AboutAuthor, AboutSource, AboutStringKey } from './strings';
