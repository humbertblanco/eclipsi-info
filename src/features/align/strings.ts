/**
 * Textos de l'alineació Sol–element, en català i castellà.
 *
 * Patró de `features/location/strings.ts` (`ls`) i `src/offline/strings.ts`:
 * taula `{ ca, es }` i una funció d'accés amb marcadors `{nom}`. No es toca
 * `src/i18n/*.json`.
 *
 * EL TEXT DEL RESULTAT NO ÉS AQUÍ: el munta `describeAlignment` a
 * `core/spots/alignment.ts`, que és qui té les xifres. Aquí hi ha només el que
 * envolta el càlcul —el formulari, les etapes i els avisos—, i s'ha de llegir
 * com una continuació d'allò: pla, curt, de tu.
 */

import type { Locale } from '../../i18n';

type Entry = { ca: string; es: string; en: string; fr: string };

const STRINGS = {
  /* --- el panell --------------------------------------------------------- */
  'panel.title': { ca: 'El Sol damunt d’un cim', es: 'El Sol encima de una cima', en: 'The Sun above a peak', fr: 'Le Soleil au-dessus d’un sommet' },
  'panel.lead': {
    ca: 'Digues quin cim, castell o campanar vols sota el Sol i et diu on t’has de plantar. Comprova que el terreny del mig no te’l tapi: és l’única part que les altres aplicacions no fan.',
    es: 'Di qué cima, castillo o campanario quieres bajo el Sol y te dice dónde tienes que ponerte. Comprueba que el terreno de en medio no te lo tape: es la única parte que las otras aplicaciones no hacen.',
    en: 'Choose the peak, castle, or bell tower you want beneath the Sun, and it will show you where to stand. Check that the terrain in between does not block it: that is the one thing other apps do not do.',
    fr: 'Choisissez le sommet, le château ou le clocher que vous voulez placer sous le Soleil : l’application vous indiquera où vous installer. Vérifiez que le relief intermédiaire ne le masque pas, la seule chose que les autres applications ne font pas.',
  },
  'panel.solve': { ca: 'Troba el punt', es: 'Encuentra el punto', en: 'Find the spot', fr: 'Trouver le point' },
  'panel.solveAgain': { ca: 'Torna-hi', es: 'Vuelve a calcularlo', en: 'Calculate again', fr: 'Recalculer' },
  'panel.stop': { ca: 'Atura', es: 'Detén', en: 'Stop', fr: 'Arrêter' },
  'panel.dataWarning': {
    ca: 'Baixa el relleu del passadís entre el punt i l’element. Amb dades mòbils comptades, fes-ho abans de sortir de casa.',
    es: 'Descarga el relieve del pasillo entre el punto y el elemento. Con datos móviles contados, hazlo antes de salir de casa.',
    en: 'This downloads terrain data for the corridor between the spot and the landmark. If your mobile data is limited, do it before leaving home.',
    fr: 'Cette opération télécharge le relief du couloir entre le point et le repère. Si votre forfait mobile est limité, faites-le avant de partir.',
  },
  'panel.cancelled': {
    ca: 'Càlcul aturat. No s’ha baixat res més.',
    es: 'Cálculo detenido. No se ha descargado nada más.',
    en: 'Calculation stopped. Nothing else was downloaded.',
    fr: 'Calcul arrêté. Aucun autre téléchargement n’a été effectué.',
  },
  'panel.failed': {
    ca: 'El càlcul de l’alineació ha fallat.',
    es: 'El cálculo de la alineación ha fallado.',
    en: 'The alignment calculation failed.',
    fr: 'Le calcul de l’alignement a échoué.',
  },
  /*
   * EL DETALL DE L'ERROR. Mateix patró que `src/offline/strings.ts`
   * (`note.error`) i que el cercador de llocs: frase traduïda i la causa crua
   * interpolada, perquè un «ha fallat» pelat no deixa distingir una xarxa
   * caiguda d'un relleu corrupte. El text del worker és tècnic i pot arribar
   * en català a una pantalla en castellà; val més això que cap pista.
   */
  'panel.failedDetail': {
    ca: 'L’alineació ha fallat: {error}',
    es: 'La alineación ha fallado: {error}',
    en: 'The alignment failed: {error}',
    fr: 'L’alignement a échoué : {error}',
  },
  'panel.progressLabel': { ca: 'Progrés del càlcul', es: 'Progreso del cálculo', en: 'Calculation progress', fr: 'Progression du calcul' },

  /* --- etapes ------------------------------------------------------------ */
  'stage.geometry': { ca: 'Resolent la geometria', es: 'Resolviendo la geometría', en: 'Working out the geometry', fr: 'Calcul de la géométrie' },
  'stage.tiles': {
    ca: 'Baixant el relleu del passadís ({done} de {total})',
    es: 'Descargando el relieve del pasillo ({done} de {total})',
    en: 'Downloading corridor terrain ({done} of {total})',
    fr: 'Téléchargement du relief du couloir ({done} sur {total})',
  },
  'stage.terrain': {
    ca: 'Comprovant que el terreny no ho tapi',
    es: 'Comprobando que el terreno no lo tape',
    en: 'Checking that the terrain does not block it',
    fr: 'Vérification de l’absence d’obstacle dans le relief',
  },
  'stage.done': { ca: 'Fet', es: 'Hecho', en: 'Done', fr: 'Terminé' },

  /* --- l'objectiu -------------------------------------------------------- */
  'target.legend': { ca: 'Què vols sota el Sol', es: 'Qué quieres bajo el Sol', en: 'What do you want beneath the Sun?', fr: 'Que voulez-vous sous le Soleil ?' },
  'target.search': { ca: 'Busca’l pel nom', es: 'Búscalo por el nombre', en: 'Search by name', fr: 'Rechercher par nom' },
  'target.searchHint': {
    ca: 'Cims, colls, pobles i monuments. Cal xarxa; sense xarxa, escriu les coordenades.',
    es: 'Cimas, puertos, pueblos y monumentos. Hace falta red; sin red, escribe las coordenadas.',
    en: 'Peaks, mountain passes, towns, and monuments. A connection is required; offline, enter the coordinates.',
    fr: 'Sommets, cols, localités et monuments. Une connexion est nécessaire ; hors ligne, saisissez les coordonnées.',
  },
  'target.searching': { ca: 'Cercant…', es: 'Buscando…', en: 'Searching…', fr: 'Recherche…' },
  'target.noHits': { ca: 'Cap resultat amb aquest nom.', es: 'Ningún resultado con ese nombre.', en: 'No results found for that name.', fr: 'Aucun résultat pour ce nom.' },
  'target.coords': { ca: 'O les coordenades', es: 'O las coordenadas', en: 'Or enter coordinates', fr: 'Ou saisir les coordonnées' },
  'target.coordsHint': {
    ca: 'Latitud i longitud en graus decimals, separades per una coma.',
    es: 'Latitud y longitud en grados decimales, separadas por una coma.',
    en: 'Latitude and longitude in decimal degrees, separated by a comma.',
    fr: 'Latitude et longitude en degrés décimaux, séparées par une virgule.',
  },
  'target.coordsBad': {
    ca: 'No s’entén. Escriu-ho com «42.3251, -0.6089».',
    es: 'No se entiende. Escríbelo como «42.3251, -0.6089».',
    en: 'That format is not recognised. Enter it as “42.3251, -0.6089”.',
    fr: 'Ce format n’est pas reconnu. Saisissez-le sous la forme « 42.3251, -0.6089 ».',
  },
  'target.name': { ca: 'Com se’n diu', es: 'Cómo se llama', en: 'What is it called?', fr: 'Quel est son nom ?' },
  'target.namePlaceholder': { ca: 'el castell', es: 'el castillo', en: 'the castle', fr: 'le château' },
  'target.use': { ca: 'Fes-lo servir', es: 'Úsalo', en: 'Use this', fr: 'Utiliser' },
  'target.chosen': { ca: 'Objectiu', es: 'Objetivo', en: 'Target', fr: 'Cible' },
  'target.clear': { ca: 'Canvia’l', es: 'Cámbialo', en: 'Change', fr: 'Changer' },

  /* --- l'altura de l'element ---------------------------------------------
   *
   * Els dos camps són EXCLOENTS i volen dir coses molt diferents. Un cim té
   * cota publicada; un campanar té alçada des de terra i el model del terreny
   * no en sap res perquè és de terra nua.                                    */
  'height.legend': { ca: 'Quina altura té', es: 'Qué altura tiene', en: 'How high is it?', fr: 'Quelle est sa hauteur ?' },
  'height.summit': { ca: 'Cota del cim (m)', es: 'Cota de la cima (m)', en: 'Peak elevation (m)', fr: 'Altitude du sommet (m)' },
  'height.summitHint': {
    ca: 'L’altitud de la punta sobre el mar, la dels mapes. Si la saps, mana sobre la resta.',
    es: 'La altitud de la punta sobre el mar, la de los mapas. Si la sabes, manda sobre lo demás.',
    en: 'The elevation of the top above sea level, as shown on maps. If known, it takes precedence over everything else.',
    fr: 'L’altitude du sommet au-dessus du niveau de la mer, telle qu’elle figure sur les cartes. Si elle est renseignée, elle prévaut sur le reste.',
  },
  'height.above': { ca: 'Alçada des de terra (m)', es: 'Altura desde el suelo (m)', en: 'Height above ground (m)', fr: 'Hauteur au-dessus du sol (m)' },
  'height.aboveHint': {
    ca: 'Per a torres, campanars i arbres: el model del terreny és de terra nua i no els porta.',
    es: 'Para torres, campanarios y árboles: el modelo del terreno es de tierra desnuda y no los lleva.',
    en: 'For towers, bell towers, and trees: the terrain model represents bare ground and does not include them.',
    fr: 'Pour les tours, clochers et arbres : le modèle de terrain représente le sol nu et ne les inclut pas.',
  },
  'height.none': {
    ca: 'Sense cap de les dues, es fa servir la cota del model del terreny al peu de l’element.',
    es: 'Sin ninguna de las dos, se usa la cota del modelo del terreno al pie del elemento.',
    en: 'If neither is provided, the terrain model elevation at the foot of the landmark is used.',
    fr: 'Si aucune des deux valeurs n’est renseignée, l’altitude du modèle de terrain au pied du repère est utilisée.',
  },

  /* --- l'instant --------------------------------------------------------- */
  'moment.legend': { ca: 'En quin moment', es: 'En qué momento', en: 'At what point?', fr: 'À quel moment ?' },
  'moment.c1': { ca: 'Primer contacte', es: 'Primer contacto', en: 'First contact', fr: 'Premier contact' },
  'moment.c2': { ca: 'Inici de la fase central', es: 'Inicio de la fase central', en: 'Start of the central phase', fr: 'Début de la phase centrale' },
  'moment.max': { ca: 'Màxim', es: 'Máximo', en: 'Maximum eclipse', fr: 'Maximum de l’éclipse' },
  'moment.c3': { ca: 'Final de la fase central', es: 'Final de la fase central', en: 'End of the central phase', fr: 'Fin de la phase centrale' },
  'moment.c4': { ca: 'Quart contacte', es: 'Cuarto contacto', en: 'Fourth contact', fr: 'Quatrième contact' },

  /* --- l'enquadrament ---------------------------------------------------- */
  'framing.legend': { ca: 'Com el vols enquadrar', es: 'Cómo lo quieres encuadrar', en: 'How do you want to frame it?', fr: 'Comment voulez-vous le cadrer ?' },
  /*
   * UNA PARAULA CADA UNA. Les etiquetes llargues («Disc centrat a la punta»)
   * es tallaven a «Disc centrat a la…» dins de la fitxa del mapa, que fa 230 px:
   * un commutador on les dues opcions acaben amb punts suspensius no commuta
   * res. La diferència entre les dues la diu la nota de sota, sencera.
   */
  'framing.centred': { ca: 'Centrat', es: 'Centrado', en: 'Centred', fr: 'Centré' },
  'framing.resting': { ca: 'Recolzat', es: 'Apoyado', en: 'Above', fr: 'Au-dessus' },
  'framing.hint': {
    ca: 'Centrat, mitja corona queda per damunt del cim. Recolzat, el disc sencer li queda just a sobre sense tocar-lo.',
    es: 'Centrado, media corona queda por encima de la cima. Apoyado, el disco entero queda justo encima sin tocarlo.',
    en: 'Centred places half the corona above the peak. Above places the whole disc just over it without touching.',
    fr: 'Centré place la moitié de la couronne au-dessus du sommet. Au-dessus place le disque entier juste au-dessus, sans le toucher.',
  },

  /* --- el resultat ------------------------------------------------------- */
  'result.coords': { ca: 'Punt', es: 'Punto', en: 'Spot', fr: 'Point' },
  'result.copy': { ca: 'Copia les coordenades', es: 'Copia las coordenadas', en: 'Copy coordinates', fr: 'Copier les coordonnées' },
  'result.copied': { ca: 'Copiades', es: 'Copiadas', en: 'Copied', fr: 'Copiées' },
  'result.openMap': { ca: 'Obre al mapa', es: 'Abre en el mapa', en: 'Open in map', fr: 'Ouvrir sur la carte' },
  'result.makeMine': { ca: 'Calcula-ho tot des d’aquí', es: 'Calcúlalo todo desde aquí', en: 'Calculate everything from here', fr: 'Tout calculer depuis ce point' },
  /*
   * L'AVÍS QUE HO CANVIA TOT.
   *
   * Sense comprovació de terreny, això és exactament el mateix que fan les
   * altres aplicacions: una línia i sort. Dir-ho és el que fa que quan SÍ que
   * s'ha comprovat, el resultat valgui alguna cosa.
   */
  'result.noTerrain': {
    ca: 'No s’ha pogut comprovar el terreny del mig. La geometria és bona, però ningú no ha mirat si des d’allà es veu de debò: és el mateix que et donaria qualsevol altra aplicació.',
    es: 'No se ha podido comprobar el terreno de en medio. La geometría es buena, pero nadie ha mirado si desde ahí se ve de verdad: es lo mismo que te daría cualquier otra aplicación.',
    en: 'The terrain in between could not be checked. The geometry is correct, but there is no confirmation that it is actually visible from there: this is the same result any other app would give you.',
    fr: 'Le relief intermédiaire n’a pas pu être vérifié. La géométrie est correcte, mais rien ne confirme que le repère soit réellement visible depuis ce point : c’est le même résultat que fournirait n’importe quelle autre application.',
  },
} as const satisfies Record<string, Entry>;

export type AlignStringKey = keyof typeof STRINGS;

/** Text d'una clau en l'idioma actiu, amb marcadors `{nom}`. */
export function al(
  key: AlignStringKey,
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
