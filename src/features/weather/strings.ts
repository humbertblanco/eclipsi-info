/**
 * Textos del panell de nuvolositat, en català i castellà.
 *
 * PER QUÈ EXISTEIX: el panell es va escriure sencer en català a pèl mentre no
 * el muntava ningú. En obrir-lo al mapa, deixar-lo monolingüe seria repetir el
 * defecte que ESTAT.md documenta a `verdict.summary` («català per
 * construcció»): una pantalla en castellà amb un paràgraf en català al mig.
 *
 * PER QUÈ NO VAN A `src/i18n/*.json`: aquesta feina no toca `src/i18n/**`, i
 * les taules `{ ca, es }` dins del mòdul són el patró que ja segueixen
 * `features/location/strings.ts`, `src/offline/strings.ts` i
 * `features/countdown/CountdownView.tsx`. Si algun dia l'i18n es consolida,
 * aquestes claus s'aboquen als JSON tal com estan.
 *
 * QUÈ NO ÉS AQUÍ: tot el que és una AFIRMACIÓ sobre el cel viu al nucli
 * (`core/weather/describe.ts`, `layers.ts`, `outlook.ts`). Aquí només hi ha
 * etiquetes, estats i botons. La divisió no és estètica: les frases del nucli
 * es poden equivocar i allà hi ha tests que les vigilen; una etiqueta de
 * columna, no.
 *
 * TO: pla, curt, de tu. Cap signe d'admiració, cap emoji. Els botons, en
 * imperatiu. I la regla pròpia d'aquest panell: no s'amaga mai què val la
 * xifra, o sigui que les etiquetes d'edat i de fiabilitat no són decoració i
 * no es poden escurçar fins a fer-les desaparèixer.
 */

import type { Locale } from '../../i18n';

type Entry = { ca: string; es: string; en: string; fr: string };

const STRINGS = {
  /* --- capçalera i estats buits ----------------------------------------- */
  title: { ca: 'Nuvolositat', es: 'Nubosidad', en: 'Cloud cover', fr: 'Couverture nuageuse' },
  'empty.noInput': {
    ca: 'Cal saber on ets i a quina hora et passa l’eclipsi.',
    es: 'Hace falta saber dónde estás y a qué hora te pasa el eclipse.',
    en: 'We need to know where you are and when the eclipse occurs there.',
    fr: 'Nous devons savoir où tu es et à quelle heure l’éclipse s’y produit.',
  },
  loading: { ca: 'Consultant Open-Meteo…', es: 'Consultando Open-Meteo…', en: 'Checking Open-Meteo…', fr: 'Consultation d’Open-Meteo…' },
  'error.none': { ca: 'No hi ha dada de nuvolositat.', es: 'No hay dato de nubosidad.', en: 'No cloud-cover data is available.', fr: 'Aucune donnée de couverture nuageuse disponible.' },
  /* L'espai del davant és a posta: s'enganxa darrere del missatge d'error. */
  'error.offline': {
    ca: ' Estàs sense connexió i no hi ha res desat d’aquest lloc.',
    es: ' Estás sin conexión y no hay nada guardado de este lugar.',
    en: ' You are offline and there is no saved data for this location.',
    fr: ' Tu es hors connexion et aucune donnée n’est enregistrée pour ce lieu.',
  },
  retry: { ca: 'Torna-ho a provar', es: 'Inténtalo otra vez', en: 'Try again', fr: 'Réessayer' },

  /* --- insígnia de la font ----------------------------------------------
   * Dues paraules que han de caber al costat del títol a 390 px.           */
  'badge.forecast': { ca: 'Previsió', es: 'Previsión', en: 'Forecast', fr: 'Prévision' },
  'badge.climatology': { ca: 'Climatologia', es: 'Climatología', en: 'Climatology', fr: 'Climatologie' },

  /* --- dada vella --------------------------------------------------------
   * Acaba en coma perquè al darrere hi va l'edat en negreta i el punt.      */
  'stale.lead': {
    ca: 'Sense connexió. Aquesta és l’última dada que es va desar,',
    es: 'Sin conexión. Este es el último dato que se guardó,',
    en: 'Offline. This is the last saved reading,',
    fr: 'Hors connexion. Voici la dernière donnée enregistrée,',
  },

  /* --- capes ------------------------------------------------------------- */
  'layers.overline': { ca: 'Capes de núvols', es: 'Capas de nubes', en: 'Cloud layers', fr: 'Couches nuageuses' },
  'layers.legend': {
    ca: 'El pes de la dreta és quanta llum atura cada capa. Els cirrus deixen passar la corona; els estrats, no.',
    es: 'El peso de la derecha es cuánta luz para cada capa. Los cirros dejan pasar la corona; los estratos, no.',
    en: 'The weight on the right shows how much light each layer blocks. Cirrus lets the corona through; stratus does not.',
    fr: 'Le coefficient à droite indique la quantité de lumière bloquée par chaque couche. Les cirrus laissent passer la couronne, contrairement aux stratus.',
  },
  'layers.totalOnly': {
    ca: 'El model no ha donat el desglossament per capes. La xifra és grollera.',
    es: 'El modelo no ha dado el desglose por capas. La cifra es tosca.',
    en: 'The model did not provide a layer breakdown. This is a rough figure.',
    fr: 'Le modèle n’a pas fourni de répartition par couche. Cette valeur est approximative.',
  },

  /* --- línia de visió ---------------------------------------------------- */
  'los.overline': { ca: 'Línia de visió', es: 'Línea de visión', en: 'Line of sight', fr: 'Ligne de visée' },
  'los.truncated': {
    ca: 'La línia de visió surt de la zona que consultem. Els núvols més llunyans no hi entren.',
    es: 'La línea de visión sale de la zona que consultamos. Las nubes más lejanas no entran.',
    en: 'The line of sight extends beyond the area we check. More distant clouds are not included.',
    fr: 'La ligne de visée dépasse la zone consultée. Les nuages plus éloignés ne sont pas pris en compte.',
  },

  /* --- repartiment de la climatologia ------------------------------------ */
  'climo.overline': { ca: 'Repartiment dels anys', es: 'Reparto de los años', en: 'Distribution across years', fr: 'Répartition selon les années' },
  'climo.clearHours': { ca: 'Hores amb cel net', es: 'Horas con cielo despejado', en: 'Clear-sky hours', fr: 'Heures de ciel dégagé' },
  'climo.cloudyHours': { ca: 'Hores amb cel tapat', es: 'Horas con cielo cubierto', en: 'Overcast hours', fr: 'Heures de ciel couvert' },
  'climo.half': { ca: 'La meitat dels casos, entre', es: 'La mitad de los casos, entre', en: 'Half of cases, between', fr: 'La moitié des cas, entre' },
  /* La conjunció canvia d'idioma i és l'error que no es veu fins que es veu. */
  'climo.halfValue': { ca: '{a} i {b}', es: '{a} y {b}', en: '{a} and {b}', fr: '{a} et {b}' },
  'climo.series': { ca: 'Sèrie', es: 'Serie', en: 'Series', fr: 'Série' },
  'climo.seriesValue': { ca: '{first}–{last}, ±{days} dies', es: '{first}–{last}, ±{days} días', en: '{first}–{last}, ±{days} days', fr: '{first}–{last}, ±{days} jours' },
  'climo.hours': { ca: 'Hores observades', es: 'Horas observadas', en: 'Observed hours', fr: 'Heures observées' },
  'climo.hoursValue': { ca: '{n} en {years} anys', es: '{n} en {years} años', en: '{n} across {years} years', fr: '{n} sur {years} ans' },

  /* --- peu de metadades --------------------------------------------------- */
  'event.max': { ca: 'Màxim de l’eclipsi', es: 'Máximo del eclipse', en: 'Eclipse maximum', fr: 'Maximum de l’éclipse' },
  'meta.lead': { ca: 'Antelació', es: 'Antelación', en: 'Lead time', fr: 'Échéance' },
  'meta.confidence': { ca: 'Fiabilitat de la xifra', es: 'Fiabilidad de la cifra', en: 'Figure reliability', fr: 'Fiabilité de la valeur' },
  'meta.age': { ca: 'Dada de', es: 'Dato de', en: 'Data from', fr: 'Donnée du' },
  refresh: { ca: 'Actualitza', es: 'Actualiza', en: 'Refresh', fr: 'Actualiser' },
  refreshing: { ca: 'Consultant…', es: 'Consultando…', en: 'Checking…', fr: 'Consultation…' },
} as const satisfies Record<string, Entry>;

export type WeatherStringKey = keyof typeof STRINGS;

/**
 * Text d'una clau en l'idioma actiu. Mateixa signatura i mateixos marcadors
 * `{nom}` que `ls()` de `features/location/strings.ts` i `os()` d'`offline`,
 * perquè el dia que l'i18n es consolidi la substitució sigui mecànica.
 */
export function ws(
  key: WeatherStringKey,
  locale: Locale,
  vars?: Readonly<Record<string, string | number>>,
): string {
  const text: string = STRINGS[key][locale];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}
