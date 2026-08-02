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

type Entry = { ca: string; es: string };

const STRINGS = {
  /* --- l'avís, quan el desfasament està demostrat ------------------------ */
  'drift.behind': {
    ca: 'El rellotge del telèfon va {sec} s endarrerit',
    es: 'El reloj del teléfono va {sec} s atrasado',
  },
  'drift.ahead': {
    ca: 'El rellotge del telèfon va {sec} s avançat',
    es: 'El reloj del teléfono va {sec} s adelantado',
  },
  /* El PER QUÈ importa, amb la xifra que ho decideix. Sense el marge concret,
     «el rellotge va malament» no mou ningú a obrir els ajustos. */
  'drift.whyLate': {
    ca: 'Els avisos de veu surten d’aquest rellotge, i l’últim «posa’t el filtre» es dona 5 s abans que acabi la totalitat. Amb aquest retard sonaria amb el Sol ja tornat.',
    es: 'Los avisos de voz salen de este reloj, y el último «ponte el filtro» se da 5 s antes de que acabe la totalidad. Con este retraso sonaría con el Sol ya de vuelta.',
  },
  'drift.whyEarly': {
    ca: 'Els avisos de veu surten d’aquest rellotge. Amb aquest avançament, el de treure’s el filtre sonaria abans que la totalitat hagi començat.',
    es: 'Los avisos de voz salen de este reloj. Con este adelanto, el de quitarse el filtro sonaría antes de que la totalidad haya empezado.',
  },
  'drift.fix': {
    ca: 'Als ajustos del sistema, posa la data i l’hora en automàtic. L’app no la corregeix sola: totes les hores que veus són les del telèfon.',
    es: 'En los ajustes del sistema, pon la fecha y la hora en automático. La app no la corrige sola: todas las horas que ves son las del teléfono.',
  },
  /* D'on surt el número. Va sempre al costat, com les `origin.*` del lloc. */
  'drift.measure': {
    ca: 'Mesurat contra el servidor: {sec} s ± {err} s.',
    es: 'Medido contra el servidor: {sec} s ± {err} s.',
  },
  'drift.recheck': { ca: 'Torna-ho a comprovar', es: 'Vuelve a comprobarlo' },
  'drift.rechecking': { ca: 'Comprovant…', es: 'Comprobando…' },

  /* --- quan no s'ha pogut comprovar --------------------------------------
   * Callar aquí seria dir «el rellotge va bé», que és una altra cosa. Una
   * línia discreta, sense color d'estat i sense alarma.                     */
  'unchecked.offline': {
    ca: 'Sense xarxa no es pot comprovar si el rellotge del telèfon va bé, i els avisos de veu en depenen. Mira que la data i l’hora estiguin en automàtic.',
    es: 'Sin red no se puede comprobar si el reloj del teléfono va bien, y los avisos de voz dependen de él. Mira que la fecha y la hora estén en automático.',
  },
  'unchecked.failed': {
    ca: 'No s’ha pogut comprovar el rellotge del telèfon. Els avisos de veu en depenen: mira que la data i l’hora estiguin en automàtic.',
    es: 'No se ha podido comprobar el reloj del teléfono. Los avisos de voz dependen de él: mira que la fecha y la hora estén en automático.',
  },
  'unchecked.inconclusive': {
    ca: 'La comprovació del rellotge no ha estat prou fina per assegurar res (±{err} s). Torna-ho a provar amb millor cobertura.',
    es: 'La comprobación del reloj no ha sido lo bastante fina para asegurar nada (±{err} s). Vuelve a intentarlo con mejor cobertura.',
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
