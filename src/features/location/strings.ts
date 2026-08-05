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

type Entry = { ca: string; es: string; en: string; fr: string };

const STRINGS = {
  /* --- la barra sempre visible ------------------------------------------ */
  'bar.none': { ca: 'Encara no has dit on seràs', es: 'Todavía no has dicho dónde estarás', en: 'You haven’t chosen where you’ll be yet', fr: 'Tu n’as pas encore choisi où tu seras' },
  'bar.change': { ca: 'Canvia el lloc', es: 'Cambia el lugar', en: 'Change location', fr: 'Changer de lieu' },
  'bar.open': { ca: 'Tria el lloc', es: 'Elige el lugar', en: 'Choose a location', fr: 'Choisir un lieu' },

  /* --- d'on surt el punt -------------------------------------------------
   * Quatre paraules com a màxim: van dins d'una insígnia al costat del nom.  */
  'origin.gps': { ca: 'GPS', es: 'GPS', en: 'GPS', fr: 'GPS' },
  'origin.map': { ca: 'Punt del mapa', es: 'Punto del mapa', en: 'Map point', fr: 'Point sur la carte' },
  'origin.search': { ca: 'Cercat pel nom', es: 'Buscado por nombre', en: 'Found by name', fr: 'Trouvé par son nom' },
  'origin.recent': { ca: 'De l’historial', es: 'Del historial', en: 'From history', fr: 'Depuis l’historique' },
  /* L'únic origen que NO és un gest de qui té l'app a la mà: el punt l'ha triat
     algú altre i ha arribat per un enllaç. Dir-ho és el mateix compromís que la
     resta d'aquest bloc, però aquí és més necessari que enlloc, perquè és
     l'únic cas en què l'usuari no pot reconstruir d'on surt el punt tot sol. */
  'origin.link': { ca: 'D’un enllaç', es: 'De un enlace', en: 'From a link', fr: 'Depuis un lien' },
  'origin.default': { ca: 'Punt d’exemple', es: 'Punto de ejemplo', en: 'Example point', fr: 'Point d’exemple' },

  /* --- l'avís que les xifres no són teves ------------------------------- */
  'placeholder.title': {
    ca: 'Aquestes xifres no són del teu lloc',
    es: 'Estas cifras no son de tu lugar',
    en: 'These figures are not for your location',
    fr: 'Ces données ne correspondent pas à ton lieu',
  },
  'placeholder.body': {
    ca: 'Són de la línia central a Astúries, que fem servir d’exemple. Digues on seràs i es recalcula tot.',
    es: 'Son de la línea central en Asturias, que usamos de ejemplo. Di dónde estarás y se recalcula todo.',
    en: 'They are for the centerline in Asturias, which we use as an example. Choose where you’ll be and everything will be recalculated.',
    fr: 'Elles correspondent à la ligne centrale dans les Asturies, utilisée comme exemple. Indique où tu seras et tout sera recalculé.',
  },
  'restored.note': {
    ca: 'Aquest lloc ve de l’última vegada que vas obrir l’app.',
    es: 'Este lugar viene de la última vez que abriste la app.',
    en: 'This location is from the last time you opened the app.',
    fr: 'Ce lieu vient de ta dernière ouverture de l’app.',
  },

  /* --- precisió i altitud ------------------------------------------------ */
  'accuracy.gps': { ca: '±{m} m', es: '±{m} m', en: '±{m} m', fr: '±{m} m' },
  'elevation.dem': { ca: '{m} m del model del terreny', es: '{m} m del modelo del terreno', en: '{m} m from the terrain model', fr: '{m} m d’après le modèle de terrain' },
  /* Mentre la tessel·la viatja, les xifres es calculen amb altitud zero. La
     regla del fitxer mana dir-ho: és una finestra de segons amb xarxa bona,
     però sense xarxa pot ser l'estat en què es queda tot. */
  'elevation.pending': {
    ca: 'Cercant l’altitud al model del terreny; mentre no arribi, es calcula al nivell del mar.',
    es: 'Buscando la altitud en el modelo del terreno; hasta que llegue, se calcula al nivel del mar.',
    en: 'Looking up elevation in the terrain model; until it arrives, calculations use sea level.',
    fr: 'Recherche de l’altitude dans le modèle de terrain ; en attendant, les calculs utilisent le niveau de la mer.',
  },
  'elevation.assumed': {
    ca: 'Altitud desconeguda: es calcula com si fossis al nivell del mar.',
    es: 'Altitud desconocida: se calcula como si estuvieras al nivel del mar.',
    en: 'Elevation unknown: calculations assume you are at sea level.',
    fr: 'Altitude inconnue : les calculs supposent que tu es au niveau de la mer.',
  },
  'elevation.gps': {
    ca: 'Altitud del GPS, no del terreny. Té ±10 a ±30 m d’error i pot moure el veredicte.',
    es: 'Altitud del GPS, no del terreno. Tiene ±10 a ±30 m de error y puede mover el veredicto.',
    en: 'GPS elevation, not terrain elevation. It has an error of ±10 to ±30 m and may change the verdict.',
    fr: 'Altitude GPS, et non celle du terrain. Sa marge d’erreur de ±10 à ±30 m peut modifier le verdict.',
  },
  'elevation.disagree': {
    ca: 'El GPS diu {gps} m i el model del terreny {dem} m. Fem servir la del terreny. Si ets dins d’un edifici o el model no té la teva vall, l’horitzó calculat no serà el teu.',
    es: 'El GPS dice {gps} m y el modelo del terreno {dem} m. Usamos la del terreno. Si estás dentro de un edificio o el modelo no tiene tu valle, el horizonte calculado no será el tuyo.',
    en: 'The GPS says {gps} m and the terrain model says {dem} m. We use the terrain elevation. If you are inside a building or the model does not include your valley, the calculated horizon will not match yours.',
    fr: 'Le GPS indique {gps} m et le modèle de terrain {dem} m. Nous utilisons l’altitude du terrain. Si tu es dans un bâtiment ou si le modèle ne couvre pas ta vallée, l’horizon calculé ne correspondra pas au tien.',
  },

  /* --- la fulla de tria -------------------------------------------------- */
  'sheet.title': { ca: 'On seràs', es: 'Dónde estarás', en: 'Where you’ll be', fr: 'Où tu seras' },
  'sheet.close': { ca: 'Tanca', es: 'Cerrar', en: 'Close', fr: 'Fermer' },
  'sheet.here': { ca: 'On soc ara', es: 'Dónde estoy ahora', en: 'Where I am now', fr: 'Ma position actuelle' },
  'sheet.locating': { ca: 'Cercant el senyal…', es: 'Buscando la señal…', en: 'Finding your location…', fr: 'Localisation en cours…' },
  'sheet.mapHint': {
    ca: 'Al mapa, toca qualsevol punt i es recalcula tot des d’allà. Funciona sense xarxa.',
    es: 'En el mapa, toca cualquier punto y se recalcula todo desde ahí. Funciona sin red.',
    en: 'Tap any point on the map and everything will be recalculated from there. Works offline.',
    fr: 'Touche un point de la carte : tout sera recalculé depuis cet endroit. Fonctionne hors connexion.',
  },
  'sheet.recents': { ca: 'Últims llocs', es: 'Últimos lugares', en: 'Recent locations', fr: 'Lieux récents' },
  'sheet.recentsEmpty': {
    ca: 'Aquí aniran sortint els llocs que triïs, per poder-los comparar.',
    es: 'Aquí irán saliendo los lugares que elijas, para poder compararlos.',
    en: 'Locations you choose will appear here so you can compare them.',
    fr: 'Les lieux que tu choisis apparaîtront ici pour que tu puisses les comparer.',
  },
  'sheet.forget': { ca: 'Treu-lo de la llista', es: 'Quítalo de la lista', en: 'Remove from list', fr: 'Retirer de la liste' },
  'sheet.compareWith': { ca: 'Compara', es: 'Compara', en: 'Compare', fr: 'Comparer' },
  /* El camp dedicat viu plegat al final de la fulla: existeix per al flux de
     camp amb un GPS de mà, però gairebé ningú no escriu coordenades, i el que
     s'enganxa ja l'entén el cercador. */
  'sheet.coordsToggle': { ca: 'Tinc coordenades exactes', es: 'Tengo coordenadas exactas', en: 'I have exact coordinates', fr: 'J’ai des coordonnées exactes' },
  'sheet.coords': { ca: 'Coordenades', es: 'Coordenadas', en: 'Coordinates', fr: 'Coordonnées' },
  'sheet.coordsHint': {
    ca: 'Latitud i longitud en graus decimals, separades per una coma.',
    es: 'Latitud y longitud en grados decimales, separadas por una coma.',
    en: 'Latitude and longitude in decimal degrees, separated by a comma.',
    fr: 'Latitude et longitude en degrés décimaux, séparées par une virgule.',
  },
  'sheet.coordsBad': {
    ca: 'No s’entén. Escriu-ho com «41.3851, 2.1734».',
    es: 'No se entiende. Escríbelo como «41.3851, 2.1734».',
    en: 'That format is not recognized. Enter it as “41.3851, 2.1734”.',
    fr: 'Ce format n’est pas reconnu. Saisis-le ainsi : « 41.3851, 2.1734 ».',
  },
  'sheet.use': { ca: 'Fes-lo servir', es: 'Úsalo', en: 'Use this location', fr: 'Utiliser ce lieu' },

  /* --- cerca per nom ----------------------------------------------------- */
  'search.label': { ca: 'Cerca un lloc', es: 'Busca un lugar', en: 'Search for a location', fr: 'Rechercher un lieu' },
  /* El cercador és el camp universal: també entén un parell de coordenades
     enganxades, i el placeholder ho diu perquè ningú no busqui un camp a part. */
  'search.placeholder': {
    ca: 'Poble, cim, port… o coordenades',
    es: 'Pueblo, cima, puerto… o coordenadas',
    en: 'Town, peak, pass… or coordinates',
    fr: 'Ville, sommet, col… ou coordonnées',
  },
  /* La fila que surt quan el que hi ha escrit JA són unes coordenades: un
     resultat local, immediat i sense xarxa. */
  'search.exact': { ca: 'Punt exacte', es: 'Punto exacto', en: 'Exact point', fr: 'Point exact' },
  'search.searching': { ca: 'Cercant…', es: 'Buscando…', en: 'Searching…', fr: 'Recherche…' },
  'search.empty': { ca: 'Cap resultat amb aquest nom.', es: 'Ningún resultado con ese nombre.', en: 'No results found with that name.', fr: 'Aucun résultat pour ce nom.' },
  'search.offline': {
    ca: 'Els noms de lloc necessiten xarxa. Sense xarxa, toca el mapa o escriu les coordenades: la resta de l’app funciona igual.',
    es: 'Los nombres de lugar necesitan red. Sin red, toca el mapa o escribe las coordenadas: el resto de la app funciona igual.',
    en: 'Place-name search requires a connection. Offline, tap the map or enter coordinates; the rest of the app works as usual.',
    fr: 'La recherche par nom nécessite une connexion. Hors connexion, touche la carte ou saisis des coordonnées ; le reste de l’app fonctionne normalement.',
  },
  'search.failed': {
    ca: 'El cercador de noms no ha respost. Toca el mapa o escriu les coordenades.',
    es: 'El buscador de nombres no ha respondido. Toca el mapa o escribe las coordenadas.',
    en: 'The place-name search did not respond. Tap the map or enter coordinates.',
    fr: 'La recherche de lieux n’a pas répondu. Touche la carte ou saisis les coordonnées.',
  },
  /* Els tipus de lloc que torna el cercador. Qui busca horitzó de ponent
     busca colls i cims tant com pobles, i la llista els ha de distingir. */
  'kind.peak': { ca: 'Cim o coll', es: 'Cima o puerto', en: 'Peak or pass', fr: 'Sommet ou col' },
  'kind.settlement': { ca: 'Nucli', es: 'Núcleo', en: 'Settlement', fr: 'Localité' },

  /* --- errors de geolocalització ---------------------------------------- */
  'error.unsupported': {
    ca: 'Aquest dispositiu no té geolocalització. Toca el mapa o escriu les coordenades.',
    es: 'Este dispositivo no tiene geolocalización. Toca el mapa o escribe las coordenadas.',
    en: 'This device does not support geolocation. Tap the map or enter coordinates.',
    fr: 'Cet appareil ne prend pas en charge la géolocalisation. Touche la carte ou saisis les coordonnées.',
  },
  'error.denied': {
    ca: 'Has dit que no a la ubicació. Es canvia als ajustos del navegador, al cadenat de la barra d’adreces. També pots tocar el mapa.',
    es: 'Has dicho que no a la ubicación. Se cambia en los ajustes del navegador, en el candado de la barra de direcciones. También puedes tocar el mapa.',
    en: 'Location access was denied. You can change this in your browser settings, under the padlock in the address bar. You can also tap the map.',
    fr: 'L’accès à la position a été refusé. Tu peux le modifier dans les réglages du navigateur, sous le cadenas de la barre d’adresse. Tu peux aussi toucher la carte.',
  },
  'error.unavailable': {
    ca: 'El dispositiu no s’ha sabut situar. Sota cobert costa; surt a fora o toca el mapa.',
    es: 'El dispositivo no ha sabido situarse. Bajo techo cuesta; sal fuera o toca el mapa.',
    en: 'The device could not determine its location. This is harder indoors; go outside or tap the map.',
    fr: 'L’appareil n’a pas pu déterminer sa position. C’est plus difficile à l’intérieur ; sors ou touche la carte.',
  },
  'error.timeout': {
    ca: 'El GPS ha trigat massa. Torna-ho a provar o toca el mapa.',
    es: 'El GPS ha tardado demasiado. Vuelve a intentarlo o toca el mapa.',
    en: 'The GPS took too long. Try again or tap the map.',
    fr: 'Le GPS a mis trop de temps. Réessaie ou touche la carte.',
  },

  /* --- la porta d'entrada -----------------------------------------------
   * Explica ABANS de demanar. El diàleg del navegador surt després del botó,
   * mai en obrir l'app: un permís que no saps per què et demanen es denega.  */
  'intro.title': { ca: 'Tot depèn d’on siguis', es: 'Todo depende de dónde estés', en: 'Everything depends on where you are', fr: 'Tout dépend de l’endroit où tu te trouves' },
  'intro.body': {
    ca: 'L’hora dels contactes, l’altura del Sol, si una muntanya te’l tapa i si ets dins o fora de la franja: tot canvia amb el punt exacte. Cinc quilòmetres poden ser la diferència entre veure la totalitat i no veure-la.',
    es: 'La hora de los contactos, la altura del Sol, si una montaña te lo tapa y si estás dentro o fuera de la franja: todo cambia con el punto exacto. Cinco kilómetros pueden ser la diferencia entre ver la totalidad y no verla.',
    en: 'Contact times, the Sun’s altitude, whether a mountain blocks it, and whether you are inside or outside the path all change with your exact location. Five kilometers can make the difference between seeing totality and missing it.',
    fr: 'Les heures des contacts, la hauteur du Soleil, la présence d’une montagne devant lui et ta position dans ou hors de la bande dépendent du point exact. Cinq kilomètres peuvent faire la différence entre voir la totalité et la manquer.',
  },
  'intro.privacy': {
    ca: 'La posició no surt del dispositiu. Els càlculs es fan aquí i no s’envia enlloc.',
    es: 'La posición no sale del dispositivo. Los cálculos se hacen aquí y no se envía a ninguna parte.',
    en: 'Your location never leaves your device. Calculations happen here and nothing is sent anywhere.',
    fr: 'Ta position ne quitte jamais ton appareil. Les calculs sont effectués ici et rien n’est envoyé.',
  },
  'intro.accept': { ca: 'Fes servir el GPS', es: 'Usa el GPS', en: 'Use GPS', fr: 'Utiliser le GPS' },
  'intro.pick': { ca: 'Trio el lloc jo', es: 'Elijo el lugar yo', en: 'I’ll choose the location', fr: 'Je choisis le lieu' },
  'intro.skip': { ca: 'Mira-ho amb un punt d’exemple', es: 'Míralo con un punto de ejemplo', en: 'View with an example point', fr: 'Voir avec un point d’exemple' },

  /* --- comparació -------------------------------------------------------- */
  'compare.title': { ca: 'Compara dos llocs', es: 'Compara dos lugares', en: 'Compare two locations', fr: 'Comparer deux lieux' },
  'compare.pick': {
    ca: 'Tria un segon lloc de l’historial per veure quants segons hi guanyes o hi perds.',
    es: 'Elige un segundo lugar del historial para ver cuántos segundos ganas o pierdes.',
    en: 'Choose a second location from your history to see how many seconds you gain or lose.',
    fr: 'Choisis un second lieu dans ton historique pour voir combien de secondes tu gagnes ou perds.',
  },
  'compare.clear': { ca: 'Deixa de comparar', es: 'Deja de comparar', en: 'Stop comparing', fr: 'Arrêter la comparaison' },
  'compare.swap': { ca: 'Vés-hi', es: 'Ve allí', en: 'Go there', fr: 'Y aller' },
  'compare.here': { ca: 'On ets ara', es: 'Donde estás ahora', en: 'Where you are now', fr: 'Ta position actuelle' },
  'compare.other': { ca: 'L’altre lloc', es: 'El otro lugar', en: 'The other location', fr: 'L’autre lieu' },
  'compare.delta': { ca: 'Diferència', es: 'Diferencia', en: 'Difference', fr: 'Différence' },
  'compare.distance': { ca: 'Distància', es: 'Distancia', en: 'Distance', fr: 'Distance' },
  'compare.gain': {
    ca: '{place} et dona {sec} s més de fase central.',
    es: '{place} te da {sec} s más de fase central.',
    en: '{place} gives you {sec} s more of the central phase.',
    fr: '{place} t’offre {sec} s de phase centrale en plus.',
  },
  'compare.kind': {
    ca: 'A {place} hi ha fase central i a l’altre punt no. No és una diferència de segons.',
    es: 'En {place} hay fase central y en el otro punto no. No es una diferencia de segundos.',
    en: '{place} has a central phase and the other point does not. This is not a difference measured in seconds.',
    fr: 'Il y a une phase centrale à {place}, mais pas à l’autre point. Ce n’est pas une différence en secondes.',
  },
  'compare.tie': {
    ca: 'La diferència és més petita que la precisió de les efemèrides. Tria pel cel, pel terreny o pel camí.',
    es: 'La diferencia es menor que la precisión de las efemérides. Elige por el cielo, por el terreno o por el camino.',
    en: 'The difference is smaller than the precision of the ephemerides. Choose based on the sky, terrain, or route.',
    fr: 'La différence est inférieure à la précision des éphémérides. Choisis selon le ciel, le terrain ou le trajet.',
  },
  'compare.edge': {
    ca: 'Un dels dos punts és al caire de la franja i allà no podem decidir ni qui guanya. Mou-te cap al centre de la franja.',
    es: 'Uno de los dos puntos está en el borde de la franja y ahí no podemos decidir ni quién gana. Muévete hacia el centro de la franja.',
    en: 'One of the two points is at the edge of the path, where we cannot even determine which is better. Move toward the center of the path.',
    fr: 'L’un des deux points se trouve au bord de la bande, où nous ne pouvons même pas déterminer lequel est préférable. Rapproche-toi du centre de la bande.',
  },
  'compare.timeGap': {
    ca: 'El màxim hi passa {sec} s {when}.',
    es: 'El máximo pasa allí {sec} s {when}.',
    en: 'Maximum eclipse occurs there {sec} s {when}.',
    fr: 'Le maximum de l’éclipse y a lieu {sec} s {when}.',
  },
  'compare.later': { ca: 'més tard', es: 'más tarde', en: 'later', fr: 'plus tard' },
  'compare.earlier': { ca: 'abans', es: 'antes', en: 'earlier', fr: 'plus tôt' },
  'compare.noCentral': { ca: 'Sense fase central', es: 'Sin fase central', en: 'No central phase', fr: 'Pas de phase centrale' },
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
