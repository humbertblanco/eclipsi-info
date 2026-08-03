/**
 * Textos del selector de lloc, en català i castellà.
 *
 * PER QUÈ NO VAN A `src/i18n/*.json`: aquesta tasca no toca `src/i18n/**`, i
 * la resta de l'app ja resol el mateix problema igual (`src/screens/strings.ts`,
 * `features/countdown/CountdownView.tsx`). Se segueix el patró que ja hi ha.
 *
 * TO. Pla, curt, de tu. Cap signe d'admiració, cap emoji, cap paraula
 * d'entusiasme. L'app no s'alegra que hagis trobat un lloc: t'hi diu quants
 * segons hi duraràs.
 *
 * REGLA QUE MANA A TOT AQUEST FITXER: no s'amaga mai d'on surt una xifra. Les
 * cadenes d'origen (`origin.*`) no són decoració, són la resposta a «i això
 * d'on ho treus», i han de sortir al costat del número sempre.
 */

import type { Locale } from '../../i18n';

type Entry = { ca: string; es: string };

const STRINGS = {
  /* --- la barra sempre visible ------------------------------------------ */
  'bar.none': { ca: 'Encara no has dit on seràs', es: 'Todavía no has dicho dónde estarás' },
  'bar.change': { ca: 'Canvia el lloc', es: 'Cambia el lugar' },
  'bar.open': { ca: 'Tria el lloc', es: 'Elige el lugar' },

  /* --- d'on surt el punt -------------------------------------------------
   * Quatre paraules com a màxim: van dins d'una insígnia al costat del nom.  */
  'origin.gps': { ca: 'GPS', es: 'GPS' },
  'origin.map': { ca: 'Punt del mapa', es: 'Punto del mapa' },
  'origin.search': { ca: 'Cercat pel nom', es: 'Buscado por nombre' },
  'origin.recent': { ca: 'De l’historial', es: 'Del historial' },
  /* L'únic origen que NO és un gest de qui té l'app a la mà: el punt l'ha triat
     algú altre i ha arribat per un enllaç. Dir-ho és el mateix compromís que la
     resta d'aquest bloc, però aquí és més necessari que enlloc, perquè és
     l'únic cas en què l'usuari no pot reconstruir d'on surt el punt tot sol. */
  'origin.link': { ca: 'D’un enllaç', es: 'De un enlace' },
  'origin.default': { ca: 'Punt d’exemple', es: 'Punto de ejemplo' },

  /* --- l'avís que les xifres no són teves ------------------------------- */
  'placeholder.title': {
    ca: 'Aquestes xifres no són del teu lloc',
    es: 'Estas cifras no son de tu lugar',
  },
  'placeholder.body': {
    ca: 'Són de la línia central a Astúries, que fem servir d’exemple. Digues on seràs i es recalcula tot.',
    es: 'Son de la línea central en Asturias, que usamos de ejemplo. Di dónde estarás y se recalcula todo.',
  },
  'restored.note': {
    ca: 'Aquest lloc ve de l’última vegada que vas obrir l’app.',
    es: 'Este lugar viene de la última vez que abriste la app.',
  },

  /* --- precisió i altitud ------------------------------------------------ */
  'accuracy.gps': { ca: '±{m} m', es: '±{m} m' },
  'elevation.dem': { ca: '{m} m del model del terreny', es: '{m} m del modelo del terreno' },
  /* Mentre la tessel·la viatja, les xifres es calculen amb altitud zero. La
     regla del fitxer mana dir-ho: és una finestra de segons amb xarxa bona,
     però sense xarxa pot ser l'estat en què es queda tot. */
  'elevation.pending': {
    ca: 'Cercant l’altitud al model del terreny; mentre no arribi, es calcula al nivell del mar.',
    es: 'Buscando la altitud en el modelo del terreno; hasta que llegue, se calcula al nivel del mar.',
  },
  'elevation.assumed': {
    ca: 'Altitud desconeguda: es calcula com si fossis al nivell del mar.',
    es: 'Altitud desconocida: se calcula como si estuvieras al nivel del mar.',
  },
  'elevation.gps': {
    ca: 'Altitud del GPS, no del terreny. Té ±10 a ±30 m d’error i pot moure el veredicte.',
    es: 'Altitud del GPS, no del terreno. Tiene ±10 a ±30 m de error y puede mover el veredicto.',
  },
  'elevation.disagree': {
    ca: 'El GPS diu {gps} m i el model del terreny {dem} m. Fem servir la del terreny. Si ets dins d’un edifici o el model no té la teva vall, l’horitzó calculat no serà el teu.',
    es: 'El GPS dice {gps} m y el modelo del terreno {dem} m. Usamos la del terreno. Si estás dentro de un edificio o el modelo no tiene tu valle, el horizonte calculado no será el tuyo.',
  },

  /* --- la fulla de tria -------------------------------------------------- */
  'sheet.title': { ca: 'On seràs', es: 'Dónde estarás' },
  'sheet.close': { ca: 'Tanca', es: 'Cerrar' },
  'sheet.here': { ca: 'On soc ara', es: 'Dónde estoy ahora' },
  'sheet.locating': { ca: 'Cercant el senyal…', es: 'Buscando la señal…' },
  'sheet.mapHint': {
    ca: 'Al mapa, toca qualsevol punt i es recalcula tot des d’allà. Funciona sense xarxa.',
    es: 'En el mapa, toca cualquier punto y se recalcula todo desde ahí. Funciona sin red.',
  },
  'sheet.recents': { ca: 'Últims llocs', es: 'Últimos lugares' },
  'sheet.recentsEmpty': {
    ca: 'Aquí aniran sortint els llocs que triïs, per poder-los comparar.',
    es: 'Aquí irán saliendo los lugares que elijas, para poder compararlos.',
  },
  'sheet.forget': { ca: 'Treu-lo de la llista', es: 'Quítalo de la lista' },
  'sheet.compareWith': { ca: 'Compara', es: 'Compara' },
  /* El camp dedicat viu plegat al final de la fulla: existeix per al flux de
     camp amb un GPS de mà, però gairebé ningú no escriu coordenades, i el que
     s'enganxa ja l'entén el cercador. */
  'sheet.coordsToggle': { ca: 'Tinc coordenades exactes', es: 'Tengo coordenadas exactas' },
  'sheet.coords': { ca: 'Coordenades', es: 'Coordenadas' },
  'sheet.coordsHint': {
    ca: 'Latitud i longitud en graus decimals, separades per una coma.',
    es: 'Latitud y longitud en grados decimales, separadas por una coma.',
  },
  'sheet.coordsBad': {
    ca: 'No s’entén. Escriu-ho com «41.3851, 2.1734».',
    es: 'No se entiende. Escríbelo como «41.3851, 2.1734».',
  },
  'sheet.use': { ca: 'Fes-lo servir', es: 'Úsalo' },

  /* --- cerca per nom ----------------------------------------------------- */
  'search.label': { ca: 'Cerca un lloc', es: 'Busca un lugar' },
  /* El cercador és el camp universal: també entén un parell de coordenades
     enganxades, i el placeholder ho diu perquè ningú no busqui un camp a part. */
  'search.placeholder': {
    ca: 'Poble, cim, port… o coordenades',
    es: 'Pueblo, cima, puerto… o coordenadas',
  },
  /* La fila que surt quan el que hi ha escrit JA són unes coordenades: un
     resultat local, immediat i sense xarxa. */
  'search.exact': { ca: 'Punt exacte', es: 'Punto exacto' },
  'search.searching': { ca: 'Cercant…', es: 'Buscando…' },
  'search.empty': { ca: 'Cap resultat amb aquest nom.', es: 'Ningún resultado con ese nombre.' },
  'search.offline': {
    ca: 'Els noms de lloc necessiten xarxa. Sense xarxa, toca el mapa o escriu les coordenades: la resta de l’app funciona igual.',
    es: 'Los nombres de lugar necesitan red. Sin red, toca el mapa o escribe las coordenadas: el resto de la app funciona igual.',
  },
  'search.failed': {
    ca: 'El cercador de noms no ha respost. Toca el mapa o escriu les coordenades.',
    es: 'El buscador de nombres no ha respondido. Toca el mapa o escribe las coordenadas.',
  },
  /* Els tipus de lloc que torna el cercador. Qui busca horitzó de ponent
     busca colls i cims tant com pobles, i la llista els ha de distingir. */
  'kind.peak': { ca: 'Cim o coll', es: 'Cima o puerto' },
  'kind.settlement': { ca: 'Nucli', es: 'Núcleo' },

  /* --- errors de geolocalització ---------------------------------------- */
  'error.unsupported': {
    ca: 'Aquest dispositiu no té geolocalització. Toca el mapa o escriu les coordenades.',
    es: 'Este dispositivo no tiene geolocalización. Toca el mapa o escribe las coordenadas.',
  },
  'error.denied': {
    ca: 'Has dit que no a la ubicació. Es canvia als ajustos del navegador, al cadenat de la barra d’adreces. També pots tocar el mapa.',
    es: 'Has dicho que no a la ubicación. Se cambia en los ajustes del navegador, en el candado de la barra de direcciones. También puedes tocar el mapa.',
  },
  'error.unavailable': {
    ca: 'El dispositiu no s’ha sabut situar. Sota cobert costa; surt a fora o toca el mapa.',
    es: 'El dispositivo no ha sabido situarse. Bajo techo cuesta; sal fuera o toca el mapa.',
  },
  'error.timeout': {
    ca: 'El GPS ha trigat massa. Torna-ho a provar o toca el mapa.',
    es: 'El GPS ha tardado demasiado. Vuelve a intentarlo o toca el mapa.',
  },

  /* --- la porta d'entrada -----------------------------------------------
   * Explica ABANS de demanar. El diàleg del navegador surt després del botó,
   * mai en obrir l'app: un permís que no saps per què et demanen es denega.  */
  'intro.title': { ca: 'Tot depèn d’on siguis', es: 'Todo depende de dónde estés' },
  'intro.body': {
    ca: 'L’hora dels contactes, l’altura del Sol, si una muntanya te’l tapa i si ets dins o fora de la franja: tot canvia amb el punt exacte. Cinc quilòmetres poden ser la diferència entre veure la totalitat i no veure-la.',
    es: 'La hora de los contactos, la altura del Sol, si una montaña te lo tapa y si estás dentro o fuera de la franja: todo cambia con el punto exacto. Cinco kilómetros pueden ser la diferencia entre ver la totalidad y no verla.',
  },
  'intro.privacy': {
    ca: 'La posició no surt del dispositiu. Els càlculs es fan aquí i no s’envia enlloc.',
    es: 'La posición no sale del dispositivo. Los cálculos se hacen aquí y no se envía a ninguna parte.',
  },
  'intro.accept': { ca: 'Fes servir el GPS', es: 'Usa el GPS' },
  'intro.pick': { ca: 'Trio el lloc jo', es: 'Elijo el lugar yo' },
  'intro.skip': { ca: 'Mira-ho amb un punt d’exemple', es: 'Míralo con un punto de ejemplo' },

  /* --- comparació -------------------------------------------------------- */
  'compare.title': { ca: 'Compara dos llocs', es: 'Compara dos lugares' },
  'compare.pick': {
    ca: 'Tria un segon lloc de l’historial per veure quants segons hi guanyes o hi perds.',
    es: 'Elige un segundo lugar del historial para ver cuántos segundos ganas o pierdes.',
  },
  'compare.clear': { ca: 'Deixa de comparar', es: 'Deja de comparar' },
  'compare.swap': { ca: 'Vés-hi', es: 'Ve allí' },
  'compare.here': { ca: 'On ets ara', es: 'Donde estás ahora' },
  'compare.other': { ca: 'L’altre lloc', es: 'El otro lugar' },
  'compare.delta': { ca: 'Diferència', es: 'Diferencia' },
  'compare.distance': { ca: 'Distància', es: 'Distancia' },
  'compare.gain': {
    ca: '{place} et dona {sec} s més de fase central.',
    es: '{place} te da {sec} s más de fase central.',
  },
  'compare.kind': {
    ca: 'A {place} hi ha fase central i a l’altre punt no. No és una diferència de segons.',
    es: 'En {place} hay fase central y en el otro punto no. No es una diferencia de segundos.',
  },
  'compare.tie': {
    ca: 'La diferència és més petita que la precisió de les efemèrides. Tria pel cel, pel terreny o pel camí.',
    es: 'La diferencia es menor que la precisión de las efemérides. Elige por el cielo, por el terreno o por el camino.',
  },
  'compare.edge': {
    ca: 'Un dels dos punts és al caire de la franja i allà no podem decidir ni qui guanya. Mou-te cap al centre de la franja.',
    es: 'Uno de los dos puntos está en el borde de la franja y ahí no podemos decidir ni quién gana. Muévete hacia el centro de la franja.',
  },
  'compare.timeGap': {
    ca: 'El màxim hi passa {sec} s {when}.',
    es: 'El máximo pasa allí {sec} s {when}.',
  },
  'compare.later': { ca: 'més tard', es: 'más tarde' },
  'compare.earlier': { ca: 'abans', es: 'antes' },
  'compare.noCentral': { ca: 'Sense fase central', es: 'Sin fase central' },
} as const satisfies Record<string, Entry>;

export type LocationStringKey = keyof typeof STRINGS;

/** Text d'una clau en l'idioma actiu, amb marcadors `{nom}`. */
export function ls(
  key: LocationStringKey,
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
