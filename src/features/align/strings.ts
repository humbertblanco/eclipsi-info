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

type Entry = { ca: string; es: string };

const STRINGS = {
  /* --- el panell --------------------------------------------------------- */
  'panel.title': { ca: 'El Sol damunt d’un cim', es: 'El Sol encima de una cima' },
  'panel.lead': {
    ca: 'Digues quin cim, castell o campanar vols sota el Sol i et diu on t’has de plantar. Comprova que el terreny del mig no te’l tapi: és l’única part que les altres aplicacions no fan.',
    es: 'Di qué cima, castillo o campanario quieres bajo el Sol y te dice dónde tienes que ponerte. Comprueba que el terreno de en medio no te lo tape: es la única parte que las otras aplicaciones no hacen.',
  },
  'panel.solve': { ca: 'Troba el punt', es: 'Encuentra el punto' },
  'panel.solveAgain': { ca: 'Torna-hi', es: 'Vuelve a calcularlo' },
  'panel.stop': { ca: 'Atura', es: 'Detén' },
  'panel.dataWarning': {
    ca: 'Baixa el relleu del passadís entre el punt i l’element. Amb dades mòbils comptades, fes-ho abans de sortir de casa.',
    es: 'Descarga el relieve del pasillo entre el punto y el elemento. Con datos móviles contados, hazlo antes de salir de casa.',
  },
  'panel.cancelled': {
    ca: 'Càlcul aturat. No s’ha baixat res més.',
    es: 'Cálculo detenido. No se ha descargado nada más.',
  },
  'panel.failed': {
    ca: 'El càlcul de l’alineació ha fallat.',
    es: 'El cálculo de la alineación ha fallado.',
  },
  'panel.progressLabel': { ca: 'Progrés del càlcul', es: 'Progreso del cálculo' },

  /* --- etapes ------------------------------------------------------------ */
  'stage.geometry': { ca: 'Resolent la geometria', es: 'Resolviendo la geometría' },
  'stage.tiles': {
    ca: 'Baixant el relleu del passadís ({done} de {total})',
    es: 'Descargando el relieve del pasillo ({done} de {total})',
  },
  'stage.terrain': {
    ca: 'Comprovant que el terreny no ho tapi',
    es: 'Comprobando que el terreno no lo tape',
  },
  'stage.done': { ca: 'Fet', es: 'Hecho' },

  /* --- l'objectiu -------------------------------------------------------- */
  'target.legend': { ca: 'Què vols sota el Sol', es: 'Qué quieres bajo el Sol' },
  'target.search': { ca: 'Busca’l pel nom', es: 'Búscalo por el nombre' },
  'target.searchHint': {
    ca: 'Cims, colls, pobles i monuments. Cal xarxa; sense xarxa, escriu les coordenades.',
    es: 'Cimas, puertos, pueblos y monumentos. Hace falta red; sin red, escribe las coordenadas.',
  },
  'target.searching': { ca: 'Cercant…', es: 'Buscando…' },
  'target.noHits': { ca: 'Cap resultat amb aquest nom.', es: 'Ningún resultado con ese nombre.' },
  'target.coords': { ca: 'O les coordenades', es: 'O las coordenadas' },
  'target.coordsHint': {
    ca: 'Latitud i longitud en graus decimals, separades per una coma.',
    es: 'Latitud y longitud en grados decimales, separadas por una coma.',
  },
  'target.coordsBad': {
    ca: 'No s’entén. Escriu-ho com «42.3251, -0.6089».',
    es: 'No se entiende. Escríbelo como «42.3251, -0.6089».',
  },
  'target.name': { ca: 'Com se’n diu', es: 'Cómo se llama' },
  'target.namePlaceholder': { ca: 'el castell', es: 'el castillo' },
  'target.use': { ca: 'Fes-lo servir', es: 'Úsalo' },
  'target.chosen': { ca: 'Objectiu', es: 'Objetivo' },
  'target.clear': { ca: 'Canvia’l', es: 'Cámbialo' },

  /* --- l'altura de l'element ---------------------------------------------
   *
   * Els dos camps són EXCLOENTS i volen dir coses molt diferents. Un cim té
   * cota publicada; un campanar té alçada des de terra i el model del terreny
   * no en sap res perquè és de terra nua.                                    */
  'height.legend': { ca: 'Quina altura té', es: 'Qué altura tiene' },
  'height.summit': { ca: 'Cota del cim (m)', es: 'Cota de la cima (m)' },
  'height.summitHint': {
    ca: 'L’altitud de la punta sobre el mar, la dels mapes. Si la saps, mana sobre la resta.',
    es: 'La altitud de la punta sobre el mar, la de los mapas. Si la sabes, manda sobre lo demás.',
  },
  'height.above': { ca: 'Alçada des de terra (m)', es: 'Altura desde el suelo (m)' },
  'height.aboveHint': {
    ca: 'Per a torres, campanars i arbres: el model del terreny és de terra nua i no els porta.',
    es: 'Para torres, campanarios y árboles: el modelo del terreno es de tierra desnuda y no los lleva.',
  },
  'height.none': {
    ca: 'Sense cap de les dues, es fa servir la cota del model del terreny al peu de l’element.',
    es: 'Sin ninguna de las dos, se usa la cota del modelo del terreno al pie del elemento.',
  },

  /* --- l'instant --------------------------------------------------------- */
  'moment.legend': { ca: 'En quin moment', es: 'En qué momento' },
  'moment.c1': { ca: 'Primer contacte', es: 'Primer contacto' },
  'moment.c2': { ca: 'Inici de la fase central', es: 'Inicio de la fase central' },
  'moment.max': { ca: 'Màxim', es: 'Máximo' },
  'moment.c3': { ca: 'Final de la fase central', es: 'Final de la fase central' },
  'moment.c4': { ca: 'Quart contacte', es: 'Cuarto contacto' },

  /* --- l'enquadrament ---------------------------------------------------- */
  'framing.legend': { ca: 'Com el vols enquadrar', es: 'Cómo lo quieres encuadrar' },
  /*
   * UNA PARAULA CADA UNA. Les etiquetes llargues («Disc centrat a la punta»)
   * es tallaven a «Disc centrat a la…» dins de la fitxa del mapa, que fa 230 px:
   * un commutador on les dues opcions acaben amb punts suspensius no commuta
   * res. La diferència entre les dues la diu la nota de sota, sencera.
   */
  'framing.centred': { ca: 'Centrat', es: 'Centrado' },
  'framing.resting': { ca: 'Recolzat', es: 'Apoyado' },
  'framing.hint': {
    ca: 'Centrat, mitja corona queda per damunt del cim. Recolzat, el disc sencer li queda just a sobre sense tocar-lo.',
    es: 'Centrado, media corona queda por encima de la cima. Apoyado, el disco entero queda justo encima sin tocarlo.',
  },

  /* --- el resultat ------------------------------------------------------- */
  'result.coords': { ca: 'Punt', es: 'Punto' },
  'result.copy': { ca: 'Copia les coordenades', es: 'Copia las coordenadas' },
  'result.copied': { ca: 'Copiades', es: 'Copiadas' },
  'result.openMap': { ca: 'Obre al mapa', es: 'Abre en el mapa' },
  'result.makeMine': { ca: 'Calcula-ho tot des d’aquí', es: 'Calcúlalo todo desde aquí' },
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
