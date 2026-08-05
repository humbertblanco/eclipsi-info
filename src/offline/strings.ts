/**
 * Textos de la capa offline, en català i castellà.
 *
 * PER QUÈ EXISTEIX: el panell i la insígnia es van escriure amb tot el text en
 * català a pèl, quan encara no els muntava ningú. En muntar-los en una app que
 * ja es pot posar en castellà, deixar-los monolingües hauria estat repetir el
 * defecte que ESTAT.md documenta a `verdict.summary` («català per
 * construcció»).
 *
 * PER QUÈ NO VAN A `src/i18n/*.json` NI A `src/screens/strings.ts`: aquesta
 * feina només toca `src/offline/**` i les taules `{ ca, es }` dins del mòdul
 * són el patró que ja segueixen `features/location/strings.ts` i
 * `features/countdown/CountdownView.tsx`. Si algun dia es consolida l'i18n,
 * aquestes claus es poden abocar tal qual als JSON.
 *
 * TO: frases curtes i declaratives, tractament de tu. Etiquetes de botó en
 * imperatiu. Cap emoji, cap signe d'admiració, cap paraula d'entusiasme. I la
 * regla pròpia d'aquesta capa: no es promet mai què es podrà baixar, es diu
 * què hi ha DESAT — `navigator.onLine` menteix massa sovint per fer-ho d'una
 * altra manera (vegeu `useOnlineStatus`).
 */

import type { Locale } from '../i18n';
import type { PrepareFailure } from './prepare';

type Entry = { ca: string; es: string; en: string; fr: string };

const STRINGS = {
  /* --- insígnia de connexió ---------------------------------------------
   * En majúscules d'overline via CSS. «desat» i no «llest»: la insígnia no
   * pot saber si hi ha CAP punt preparat, només si l'esquelet de l'app
   * respondrà sense xarxa.                                                  */
  'badge.online': { ca: 'En línia', es: 'En línea', en: 'Online', fr: 'En ligne' },
  'badge.offlineSaved': { ca: 'Sense xarxa · desat', es: 'Sin red · guardado', en: 'Offline · saved', fr: 'Hors ligne · enregistré' },
  'badge.offlineUnsaved': { ca: 'Sense xarxa · no desat', es: 'Sin red · no guardado', en: 'Offline · not saved', fr: 'Hors ligne · non enregistré' },

  /* --- avís de versió nova ----------------------------------------------- */
  'update.ready': {
    ca: 'Hi ha una versió nova de l’app, ja baixada.',
    es: 'Hay una versión nueva de la app, ya descargada.',
    en: 'A new version of the app has already been downloaded.',
    fr: 'Une nouvelle version de l’application a déjà été téléchargée.',
  },
  'update.later': { ca: 'Ara no', es: 'Ahora no', en: 'Not now', fr: 'Pas maintenant' },
  'update.apply': { ca: 'Actualitza', es: 'Actualiza', en: 'Update', fr: 'Mettre à jour' },

  /* --- panell: capçalera i pla ------------------------------------------- */
  'panel.title': { ca: 'Preparar per anar-hi', es: 'Preparar para ir', en: 'Prepare for your trip', fr: 'Préparer le déplacement' },
  'panel.lede': {
    ca: 'El dia de l’eclipsi la xarxa mòbil estarà saturada. Baixa ara el terreny, el mapa i els càlculs del punt on aniràs: després l’app funciona sencera sense connexió.',
    es: 'El día del eclipse la red móvil estará saturada. Descarga ahora el terreno, el mapa y los cálculos del punto al que irás: después la app funciona entera sin conexión.',
    en: 'Mobile networks will be congested on eclipse day. Download the terrain, map, and calculations for your destination now; the entire app will then work offline.',
    fr: 'Les réseaux mobiles seront saturés le jour de l’éclipse. Téléchargez dès maintenant le relief, la carte et les calculs de votre destination : l’application fonctionnera ensuite entièrement hors ligne.',
  },
  'panel.needPoint': {
    ca: 'Tria un punt al mapa o localitza’t per poder preparar-lo.',
    es: 'Elige un punto en el mapa o localízate para poder prepararlo.',
    en: 'Choose a point on the map or use your location to prepare it.',
    fr: 'Choisissez un point sur la carte ou utilisez votre position pour le préparer.',
  },
  'figures.point': { ca: 'Punt', es: 'Punto', en: 'Point', fr: 'Point' },
  'figures.tiles': { ca: 'Tessel·les', es: 'Teselas', en: 'Tiles', fr: 'Tuiles' },
  'figures.weight': { ca: 'Pes estimat', es: 'Peso estimado', en: 'Estimated size', fr: 'Taille estimée' },
  'figures.range': { ca: 'Radi del relleu', es: 'Radio del relieve', en: 'Terrain radius', fr: 'Rayon du relief' },

  /* --- progrés ------------------------------------------------------------
   * Les frases de fase es componen AQUÍ i no a `prepare.ts`: el motor no sap
   * l'idioma de la interfície i no l'ha de saber.                           */
  'progress.label': { ca: 'Progrés de la preparació', es: 'Progreso de la preparación', en: 'Preparation progress', fr: 'Progression de la préparation' },
  'progress.keepOpen': {
    ca: 'Deixa l’app oberta i la pantalla encesa.',
    es: 'Deja la app abierta y la pantalla encendida.',
    en: 'Keep the app open and the screen on.',
    fr: 'Laissez l’application ouverte et l’écran allumé.',
  },
  'progress.stop': { ca: 'Atura', es: 'Detén', en: 'Stop', fr: 'Arrêter' },
  'phase.inici': {
    ca: 'Preparant la llista del que cal baixar…',
    es: 'Preparando la lista de lo que hay que descargar…',
    en: 'Preparing the download list…',
    fr: 'Préparation de la liste des téléchargements…',
  },
  'phase.relleu': { ca: 'Baixant el relleu…', es: 'Descargando el relieve…', en: 'Downloading terrain…', fr: 'Téléchargement du relief…' },
  'phase.mapa': { ca: 'Baixant el mapa…', es: 'Descargando el mapa…', en: 'Downloading map…', fr: 'Téléchargement de la carte…' },
  'phase.calcul': { ca: 'Calculant l’horitzó…', es: 'Calculando el horizonte…', en: 'Calculating horizon…', fr: 'Calcul de l’horizon…' },
  'phase.desat': { ca: 'Desant els càlculs…', es: 'Guardando los cálculos…', en: 'Saving calculations…', fr: 'Enregistrement des calculs…' },
  'phase.fet': { ca: 'Llest per anar-hi', es: 'Listo para ir', en: 'Ready to go', fr: 'Prêt pour le départ' },

  /* --- accions i resultat ------------------------------------------------- */
  'action.prepare': { ca: 'Prepara’m per anar-hi', es: 'Prepárame para ir', en: 'Prepare for my trip', fr: 'Préparer mon déplacement' },
  'action.again': { ca: 'Torna a preparar aquest punt', es: 'Vuelve a preparar este punto', en: 'Prepare this point again', fr: 'Préparer de nouveau ce point' },
  'note.offline': {
    ca: 'Sense xarxa no es pot baixar res. El que ja tinguis desat segueix disponible.',
    es: 'Sin red no se puede descargar nada. Lo que ya tengas guardado sigue disponible.',
    en: 'Nothing can be downloaded while offline. Anything you have already saved remains available.',
    fr: 'Aucun téléchargement n’est possible hors ligne. Tout ce qui est déjà enregistré reste disponible.',
  },
  /* --- per què no s'ha pogut preparar ------------------------------------
   *
   * ABANS AQUÍ HI HAVIA UNA SOLA CLAU amb un `{error}` que s'omplia amb el
   * `message` cru de `prepare.ts` — una frase catalana. La línia sortia mig
   * traduïda: «No se ha podido completar la preparación: No s'ha pogut baixar
   * cap tessel·la del terreny. Comprova la connexió i torna-ho a provar.» Ara
   * el motor emet codis (`PrepareErrorCode`) i cada codi té la seva frase.
   *
   * TO: què ha passat i què pots fer. La frase no promet mai que amb un
   * reintent anirà bé, perquè al camp sovint no hi anirà.                    */
  'error.noTerrain': {
    ca: 'No s’ha pogut baixar cap tessel·la del terreny. Comprova la connexió i torna-ho a provar.',
    es: 'No se ha podido descargar ninguna tesela del terreno. Comprueba la conexión y vuelve a intentarlo.',
    en: 'No terrain tiles could be downloaded. Check your connection and try again.',
    fr: 'Aucune tuile de relief n’a pu être téléchargée. Vérifiez votre connexion et réessayez.',
  },
  'error.horizonTiles': {
    ca: 'El terreny ha baixat a mitges i amb un horitzó incomplet el resultat no seria de fiar. Comprova la connexió i torna-ho a provar.',
    es: 'El terreno se ha descargado a medias y con un horizonte incompleto el resultado no sería fiable. Comprueba la conexión y vuelve a intentarlo.',
    en: 'The terrain download is incomplete, and the result would not be reliable with a partial horizon. Check your connection and try again.',
    fr: 'Le téléchargement du relief est incomplet et le résultat ne serait pas fiable avec un horizon partiel. Vérifiez votre connexion et réessayez.',
  },
  'error.horizon': {
    ca: 'El terreny s’ha desat, però no s’ha pogut calcular l’horitzó d’aquest punt.',
    es: 'El terreno se ha guardado, pero no se ha podido calcular el horizonte de este punto.',
    en: 'The terrain was saved, but the horizon could not be calculated for this point.',
    fr: 'Le relief a été enregistré, mais l’horizon n’a pas pu être calculé pour ce point.',
  },
  'error.unknown': {
    ca: 'No s’ha pogut completar la preparació.',
    es: 'No se ha podido completar la preparación.',
    en: 'Preparation could not be completed.',
    fr: 'La préparation n’a pas pu être terminée.',
  },
  'note.done': { ca: 'Punt preparat. {bytes} desats.', es: 'Punto preparado. {bytes} guardados.', en: 'Point prepared. {bytes} saved.', fr: 'Point préparé. {bytes} enregistrés.' },
  'note.doneFailed': {
    ca: 'Punt preparat. {bytes} desats, amb {n} tessel·les que no han baixat.',
    es: 'Punto preparado. {bytes} guardados, con {n} teselas que no se han descargado.',
    en: 'Point prepared. {bytes} saved, with {n} tiles that could not be downloaded.',
    fr: 'Point préparé. {bytes} enregistrés, avec {n} tuiles qui n’ont pas pu être téléchargées.',
  },
  'note.already': {
    ca: 'Aquest punt ja el tens preparat: {date}, {bytes} desats.',
    es: 'Este punto ya lo tienes preparado: {date}, {bytes} guardados.',
    en: 'You have already prepared this point: {date}, {bytes} saved.',
    fr: 'Vous avez déjà préparé ce point : {date}, {bytes} enregistrés.',
  },

  /* --- inventari ----------------------------------------------------------- */
  'saved.title': { ca: 'Desat al telèfon', es: 'Guardado en el teléfono', en: 'Saved on this device', fr: 'Enregistré sur cet appareil' },
  'saved.loading': { ca: 'Consultant què hi ha desat…', es: 'Consultando qué hay guardado…', en: 'Checking saved data…', fr: 'Vérification des données enregistrées…' },
  'saved.empty': {
    ca: 'Encara no has preparat cap punt.',
    es: 'Todavía no has preparado ningún punto.',
    en: 'You have not prepared any points yet.',
    fr: 'Vous n’avez encore préparé aucun point.',
  },
  'saved.tiles': { ca: 'tessel·les', es: 'teselas', en: 'tiles', fr: 'tuiles' },
  'saved.holes': {
    ca: '{n} tessel·les no baixades: l’horitzó pot tenir forats.',
    es: '{n} teselas sin descargar: el horizonte puede tener huecos.',
    en: '{n} tiles were not downloaded: the horizon may have gaps.',
    fr: '{n} tuiles n’ont pas été téléchargées : le profil de l’horizon peut présenter des lacunes.',
  },
  'saved.expiry': {
    ca: 'Fa {n} dies que és desat i l’app no està instal·lada: el navegador el pot esborrar.',
    es: 'Hace {n} días que está guardado y la app no está instalada: el navegador lo puede borrar.',
    en: 'It was saved {n} days ago and the app is not installed: the browser may delete it.',
    fr: 'Ces données ont été enregistrées il y a {n} jours et l’application n’est pas installée : le navigateur peut les supprimer.',
  },
  'saved.remove': { ca: 'Treu', es: 'Quita', en: 'Remove', fr: 'Retirer' },
  'saved.removeLabel': { ca: 'Treu {label} de la llista', es: 'Quita {label} de la lista', en: 'Remove {label} from the list', fr: 'Retirer {label} de la liste' },
  'figures.terrain': { ca: 'Relleu desat', es: 'Relieve guardado', en: 'Terrain saved', fr: 'Relief enregistré' },
  'figures.basemap': { ca: 'Mapa desat', es: 'Mapa guardado', en: 'Map saved', fr: 'Carte enregistrée' },
  'figures.used': { ca: 'Espai ocupat', es: 'Espacio ocupado', en: 'Space used', fr: 'Espace utilisé' },
  'figures.free': { ca: 'Espai disponible', es: 'Espacio disponible', en: 'Space available', fr: 'Espace disponible' },
  'saved.clear': {
    ca: 'Allibera l’espai de les tessel·les',
    es: 'Libera el espacio de las teselas',
    en: 'Free up space used by terrain tiles',
    fr: 'Libérer l’espace occupé par les tuiles de relief',
  },

  /* --- instal·lació i limitacions ------------------------------------------ */
  'install.title': { ca: 'Instal·la l’app', es: 'Instala la app', en: 'Install the app', fr: 'Installer l’application' },
  'limits.title': { ca: 'Què pot fallar', es: 'Qué puede fallar', en: 'What can go wrong', fr: 'Ce qui peut mal fonctionner' },
  'limits.immutable': {
    ca: 'El relleu i el mapa es desen tal com són avui. No canvien mai, per això es guarden un any sense tornar-los a demanar.',
    es: 'El relieve y el mapa se guardan tal como son hoy. No cambian nunca, por eso se guardan un año sin volver a pedirlos.',
    en: 'The terrain and map are saved as they are today. They never change, so they are kept for a year without being downloaded again.',
    fr: 'Le relief et la carte sont enregistrés tels qu’ils sont aujourd’hui. Ils ne changent jamais et sont donc conservés pendant un an sans nouveau téléchargement.',
  },
  'limits.iosSevenDays': {
    ca: 'A l’iPhone, si l’app no està instal·lada a la pantalla d’inici, el sistema pot esborrar tot el que hi ha desat després de set dies sense obrir-la.',
    es: 'En el iPhone, si la app no está instalada en la pantalla de inicio, el sistema puede borrar todo lo guardado tras siete días sin abrirla.',
    en: 'On iPhone, if the app is not installed on the Home Screen, the system may delete all saved data after seven days without opening it.',
    fr: 'Sur iPhone, si l’application n’est pas installée sur l’écran d’accueil, le système peut supprimer toutes les données enregistrées après sept jours sans ouverture.',
  },
  'limits.foreground': {
    ca: 'La baixada només avança amb l’app en primer pla: iOS congela les pestanyes de fons i no hi ha manera de continuar en segon terme.',
    es: 'La descarga solo avanza con la app en primer plano: iOS congela las pestañas de fondo y no hay manera de continuar en segundo plano.',
    en: 'The download only progresses while the app is in the foreground: iOS freezes background tabs, so it cannot continue in the background.',
    fr: 'Le téléchargement n’avance que lorsque l’application est au premier plan : iOS suspend les onglets en arrière-plan, empêchant toute progression.',
  },
  'limits.eviction': {
    ca: 'Si el telèfon va just d’espai, el navegador pot alliberar aquestes dades sense avisar. Comprova aquesta pantalla abans de sortir.',
    es: 'Si el teléfono va justo de espacio, el navegador puede liberar estos datos sin avisar. Comprueba esta pantalla antes de salir.',
    en: 'If your phone is low on space, the browser may delete this data without warning. Check this screen before you leave.',
    fr: 'Si votre téléphone manque d’espace, le navigateur peut supprimer ces données sans avertissement. Vérifiez cet écran avant de partir.',
  },
} as const satisfies Record<string, Entry>;

export type OfflineStringKey = keyof typeof STRINGS;

/**
 * Text d'una clau en l'idioma actiu. Mateixa signatura i mateixos marcadors
 * `{nom}` que `s()` de `src/screens/strings.ts`, perquè el dia que l'i18n es
 * consolidi la substitució sigui mecànica.
 */
export function os(
  key: OfflineStringKey,
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

/**
 * De la fallada a la frase, amb `switch` exhaustiu.
 *
 * EL MOTIU DE L'HORITZÓ NO ES RESUMEIX. «No ha arribat gens de relleu» i
 * «n'ha arribat una part» porten al mateix consell —comprova la connexió— però
 * es diuen diferent perquè el segon cas passa amb cobertura dolenta i el
 * primer amb cobertura nul·la, i qui és al camp ha de poder distingir si val
 * la pena esperar-se o si ha de moure's.
 *
 * Mateix contracte que `horizonFailureText` i `spotSearchFailureText`: un codi
 * nou trenca la compilació aquí fins que algú escriu les dues llengües.
 */
export function prepareFailureText(failure: PrepareFailure, locale: Locale): string {
  switch (failure.code) {
    case 'no-terrain':
      return os('error.noTerrain', locale);
    case 'horizon':
      return failure.horizon?.code === 'tiles-incomplete' ||
        failure.horizon?.code === 'no-terrain'
        ? os('error.horizonTiles', locale)
        : os('error.horizon', locale);
    case 'unknown':
      return os('error.unknown', locale);
  }
}
