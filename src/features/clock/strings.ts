/**
 * Textos del control del rellotge del dispositiu, en català i castellà.
 *
 * PER QUÈ NO VAN A `src/i18n/*.json`: mateix motiu que a
 * `features/location/strings.ts` i `offline/strings.ts` — una taula `{ ca, es }`
 * dins del mòdul és el patró que ja segueix l'app, i el dia que l'i18n es
 * consolidi aquestes claus s'hi aboquen tal qual.
 *
 * TO. Pla i de tu, com la resta. Però amb una regla pròpia d'aquest mòdul:
 * l'avís NO pot semblar un error de l'app ni una cosa que l'app arregli sola.
 * El rellotge és del telèfon, l'arregla l'usuari als ajustos del sistema, i
 * mentre no ho faci els avisos de veu aniran desplaçats. Cada text acaba dient
 * què ha de fer, no què passa.
 *
 * I NO S'AMAGA D'ON SURT LA XIFRA: el desfasament es diu sempre amb la seva
 * barra d'error, perquè es mesura amb una capçalera HTTP que té resolució de
 * segon i el número sol seria més precís del que podem justificar.
 */

import type { Locale } from '../../i18n';

type Entry = { ca: string; es: string; en: string; fr: string };

const STRINGS = {
  /* --- l'avís, quan el desfasament està demostrat ------------------------ */
  'drift.behind': {
    ca: 'El rellotge del telèfon va {sec} s endarrerit',
    es: 'El reloj del teléfono va {sec} s atrasado',
    en: 'Your phone’s clock is {sec} s behind',
    fr: 'L’horloge de votre téléphone retarde de {sec} s',
  },
  'drift.ahead': {
    ca: 'El rellotge del telèfon va {sec} s avançat',
    es: 'El reloj del teléfono va {sec} s adelantado',
    en: 'Your phone’s clock is {sec} s ahead',
    fr: 'L’horloge de votre téléphone avance de {sec} s',
  },
  /* El PER QUÈ importa, amb la xifra que ho decideix. Sense el marge concret,
     «el rellotge va malament» no mou ningú a obrir els ajustos. */
  'drift.whyLate': {
    ca: 'Els avisos de veu surten d’aquest rellotge, i l’últim «posa’t el filtre» es dona 5 s abans que acabi la totalitat. Amb aquest retard sonaria amb el Sol ja tornat.',
    es: 'Los avisos de voz salen de este reloj, y el último «ponte el filtro» se da 5 s antes de que acabe la totalidad. Con este retraso sonaría con el Sol ya de vuelta.',
    en: 'Voice alerts use this clock, and the final “put your filter on” warning is given 5 s before totality ends. With this delay, it would sound after the Sun had already reappeared.',
    fr: 'Les alertes vocales utilisent cette horloge, et le dernier avertissement « remettez votre filtre » est donné 5 s avant la fin de la totalité. Avec ce retard, il retentirait alors que le Soleil serait déjà réapparu.',
  },
  'drift.whyEarly': {
    ca: 'Els avisos de veu surten d’aquest rellotge. Amb aquest avançament, el de treure’s el filtre sonaria abans que la totalitat hagi començat.',
    es: 'Los avisos de voz salen de este reloj. Con este adelanto, el de quitarse el filtro sonaría antes de que la totalidad haya empezado.',
    en: 'Voice alerts use this clock. With it running fast, the warning to remove your filter would sound before totality had begun.',
    fr: 'Les alertes vocales utilisent cette horloge. Avec cette avance, l’avertissement demandant de retirer le filtre retentirait avant le début de la totalité.',
  },
  'drift.fix': {
    ca: 'Als ajustos del sistema, posa la data i l’hora en automàtic. L’app no la corregeix sola: totes les hores que veus són les del telèfon.',
    es: 'En los ajustes del sistema, pon la fecha y la hora en automático. La app no la corrige sola: todas las horas que ves son las del teléfono.',
    en: 'In system settings, set the date and time to automatic. The app cannot correct them itself: every time you see comes from your phone.',
    fr: 'Dans les réglages du système, activez la date et l’heure automatiques. L’application ne peut pas les corriger elle-même : toutes les heures affichées proviennent de votre téléphone.',
  },
  /* D'on surt el número. Va sempre al costat, com les `origin.*` del lloc. */
  'drift.measure': {
    ca: 'Mesurat contra el servidor: {sec} s ± {err} s.',
    es: 'Medido contra el servidor: {sec} s ± {err} s.',
    en: 'Measured against the server: {sec} s ± {err} s.',
    fr: 'Mesuré par rapport au serveur : {sec} s ± {err} s.',
  },
  'drift.recheck': { ca: 'Torna-ho a comprovar', es: 'Vuelve a comprobarlo', en: 'Check again', fr: 'Vérifier à nouveau' },
  'drift.rechecking': { ca: 'Comprovant…', es: 'Comprobando…', en: 'Checking…', fr: 'Vérification…' },

  /* --- quan no s'ha pogut comprovar --------------------------------------
   * Callar aquí seria dir «el rellotge va bé», que és una altra cosa. Una
   * línia discreta, sense color d'estat i sense alarma.                     */
  'unchecked.offline': {
    ca: 'Sense xarxa no es pot comprovar si el rellotge del telèfon va bé, i els avisos de veu en depenen. Mira que la data i l’hora estiguin en automàtic.',
    es: 'Sin red no se puede comprobar si el reloj del teléfono va bien, y los avisos de voz dependen de él. Mira que la fecha y la hora estén en automático.',
    en: 'Without a connection, the phone’s clock cannot be checked, and voice alerts depend on it. Make sure the date and time are set to automatic.',
    fr: 'Sans connexion, l’horloge du téléphone ne peut pas être vérifiée, alors que les alertes vocales en dépendent. Vérifiez que la date et l’heure sont réglées automatiquement.',
  },
  'unchecked.failed': {
    ca: 'No s’ha pogut comprovar el rellotge del telèfon. Els avisos de veu en depenen: mira que la data i l’hora estiguin en automàtic.',
    es: 'No se ha podido comprobar el reloj del teléfono. Los avisos de voz dependen de él: mira que la fecha y la hora estén en automático.',
    en: 'The phone’s clock could not be checked. Voice alerts depend on it, so make sure the date and time are set to automatic.',
    fr: 'L’horloge du téléphone n’a pas pu être vérifiée. Les alertes vocales en dépendent : vérifiez que la date et l’heure sont réglées automatiquement.',
  },
  'unchecked.inconclusive': {
    ca: 'La comprovació del rellotge no ha estat prou fina per assegurar res (±{err} s). Torna-ho a provar amb millor cobertura.',
    es: 'La comprobación del reloj no ha sido lo bastante fina para asegurar nada (±{err} s). Vuelve a intentarlo con mejor cobertura.',
    en: 'The clock check was not accurate enough to be conclusive (±{err} s). Try again with a better connection.',
    fr: 'La vérification de l’horloge n’a pas été assez précise pour être concluante (±{err} s). Réessayez avec une meilleure connexion.',
  },
} as const satisfies Record<string, Entry>;

export type ClockStringKey = keyof typeof STRINGS;

/**
 * Text d'una clau en l'idioma actiu. Mateixa signatura i mateixos marcadors
 * `{nom}` que `s()` de `src/screens/strings.ts`.
 */
export function cs(
  key: ClockStringKey,
  locale: Locale,
  vars?: Readonly<Record<string, string | number>>,
): string {
  const text = STRINGS[key][locale];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}
