/**
 * Textos del cercador de llocs, en català i castellà.
 *
 * PER QUÈ EXISTEIX AQUEST FITXER. El cercador es va escriure sencer en català
 * clavat dins dels components, perquè no es muntava enlloc i ningú no el veia.
 * En el moment de muntar-lo, això deixa de ser un detall: qui té l'app en
 * castellà rebria una pantalla sencera en català, que és exactament el defecte
 * que ja ha calgut arreglar amb el veredicte, amb el guió de la totalitat i amb
 * la zona de la realitat augmentada.
 *
 * PATRÓ. El mateix que `features/location/strings.ts` (`ls`) i
 * `src/offline/strings.ts`: taula `{ ca, es }` i una funció d'accés amb
 * marcadors `{nom}`. No es toca `src/i18n/*.json`.
 *
 * TO. Pla, curt, de tu. Cap exclamació i cap paraula d'entusiasme: la llista no
 * celebra res, diu quants segons duraràs a cada punt.
 */

import type { Locale } from '../../i18n';
import type { SpotSearchFailureCode } from './useSpotSearch';

type Entry = { ca: string; es: string; en: string };

const STRINGS = {
  'card.score': { ca: 'Per què és un bon lloc', es: 'Por qué es un buen sitio', en: 'Why this is a good spot' },
  'card.scoreIntro': {
    ca: 'Nota transparent del cercador: cada fila mostra els punts que aporta.',
    es: 'Nota transparente del buscador: cada fila muestra los puntos que aporta.',
    en: 'Transparent search score: each row shows how many points it contributes.',
  },
  'card.scoreSeconds': { ca: 'Fase central visible', es: 'Fase central visible', en: 'Visible central phase' },
  'card.scoreClearance': { ca: 'Marge sobre el relleu', es: 'Margen sobre el relieve', en: 'Clearance above the terrain' },
  'card.scoreDistance': { ca: 'Proximitat', es: 'Proximidad', en: 'Proximity' },
  'card.scoreAltitude': { ca: 'Cota guanyada', es: 'Altura ganada', en: 'Elevation gained' },
  'card.scoreWeather': {
    ca: 'La meteorologia no entra en aquesta nota: consulta-la a Núvols perquè canvia amb el temps.',
    es: 'La meteorología no entra en esta nota: consúltala en Nubes porque cambia con el tiempo.',
    en: 'Weather is not included in this score: check Clouds, as conditions change over time.',
  },
  /* --- el panell --------------------------------------------------------- */
  'panel.title': { ca: 'Busca on guanyar més segons', es: 'Busca dónde ganar más segundos', en: 'Find where you can gain more seconds' },
  'panel.lead': {
    ca: 'Compara punts propers segons la durada visible, el relleu i la distància.',
    es: 'Compara puntos cercanos según la duración visible, el relieve y la distancia.',
    en: 'Compare nearby points by visible duration, terrain, and distance.',
  },
  'panel.search': { ca: 'Troba llocs millors a prop', es: 'Encuentra sitios mejores cerca', en: 'Find better spots nearby' },
  'panel.searchAgain': { ca: 'Torna a cercar', es: 'Vuelve a buscar', en: 'Search again' },
  'panel.stop': { ca: 'Atura', es: 'Detén', en: 'Stop' },
  'panel.needOrigin': {
    ca: 'Cal saber on ets per poder buscar-hi al voltant.',
    es: 'Hace falta saber dónde estás para poder buscar a tu alrededor.',
    en: 'Your location is needed to search nearby.',
  },
  'panel.cancelled': {
    ca: 'Cerca aturada. No s’ha baixat res més.',
    es: 'Búsqueda detenida. No se ha descargado nada más.',
    en: 'Search stopped. No more data was downloaded.',
  },
  'panel.failed': {
    ca: 'El càlcul dels llocs ha fallat.',
    es: 'El cálculo de los sitios ha fallado.',
    en: 'The spot calculation failed.',
  },
  'panel.progressLabel': { ca: 'Progrés de la cerca', es: 'Progreso de la búsqueda', en: 'Search progress' },
  /*
   * AVÍS DE DADES. La cerca baixa desenes de megabytes de relleu i al camp
   * això es paga. Es diu abans de prémer el botó, no després.
   */
  'panel.dataWarning': {
    ca: 'Baixa relleu de tot el voltant: unes desenes de megabytes. Amb dades mòbils comptades, fes-ho abans de sortir de casa.',
    es: 'Descarga relieve de todo el entorno: unas decenas de megabytes. Con datos móviles contados, hazlo antes de salir de casa.',
    en: 'Downloads terrain for the entire surrounding area: several dozen megabytes. If your mobile data is limited, do this before leaving home.',
  },
  'panel.origin': { ca: 'El teu punt ara', es: 'Tu punto ahora', en: 'Your current point' },
  'panel.originVisible': {
    ca: 'Hi veuries {visible} dels {total} de fase central.',
    es: 'Verías {visible} de los {total} de fase central.',
    en: 'You would see {visible} of the {total} central phase.',
  },
  'panel.originPending': {
    ca: 'Hi ha {total} de fase central teòrica. Falta calcular què en tapa el relleu.',
    es: 'Hay {total} de fase central teórica. Falta calcular qué parte tapa el relieve.',
    en: 'There is {total} of theoretical central phase. The terrain obstruction still needs to be calculated.',
  },
  'panel.originNoCentral': {
    ca: 'En aquest punt no hi ha fase central.',
    es: 'En este punto no hay fase central.',
    en: 'There is no central phase at this point.',
  },

  /* --- les etapes de la barra de progrés ---------------------------------
   *
   * El motor ja envia un `message` en català dins de `SpotSearchProgress`.
   * NO es fa servir a la pantalla: es fa servir l'etapa, que és un codi, i el
   * text surt d'aquí. Així el progrés parla l'idioma de l'usuari sense que
   * `core/spots` hagi de saber què és un idioma.                             */
  'stage.grid': { ca: 'Preparant la graella de candidats', es: 'Preparando la rejilla de candidatos', en: 'Preparing the candidate grid' },
  'stage.astro': { ca: 'Calculant l’eclipsi a cada punt', es: 'Calculando el eclipse en cada punto', en: 'Calculating the eclipse at each point' },
  'stage.tiles': { ca: 'Baixant el relleu de la zona', es: 'Descargando el relieve de la zona', en: 'Downloading terrain for the area' },
  'stage.sieve': { ca: 'Garbellant per horitzó', es: 'Cribando por horizonte', en: 'Screening by horizon' },
  'stage.refineTiles': { ca: 'Baixant el relleu dels finalistes', es: 'Descargando el relieve de los finalistas', en: 'Downloading terrain for the finalists' },
  'stage.refine': { ca: 'Perfil d’horitzó complet dels finalistes', es: 'Perfil de horizonte completo de los finalistas', en: 'Calculating full horizon profiles for the finalists' },
  'stage.done': { ca: 'Fet', es: 'Hecho', en: 'Done' },

  /* --- la llista --------------------------------------------------------- */
  'list.empty': {
    ca: 'Dins de {radius} no hi ha cap punt des d’on el Sol quedi per damunt de l’horitzó durant l’eclipsi. Prova d’eixamplar el radi.',
    es: 'Dentro de {radius} no hay ningún punto desde donde el Sol quede por encima del horizonte durante el eclipse. Prueba a ampliar el radio.',
    en: 'Within {radius}, there are no points where the Sun remains above the horizon during the eclipse. Try increasing the radius.',
  },
  'list.contextOne': {
    ca: '{n} lloc de {candidates} punts mirats dins de {radius}.',
    es: '{n} sitio de {candidates} puntos mirados dentro de {radius}.',
    en: '{n} spot from {candidates} points checked within {radius}.',
  },
  'list.contextMany': {
    ca: '{n} llocs de {candidates} punts mirats dins de {radius}.',
    es: '{n} sitios de {candidates} puntos mirados dentro de {radius}.',
    en: '{n} spots from {candidates} points checked within {radius}.',
  },
  'list.best': {
    ca: 'La millor fase central de la zona dura {duration}.',
    es: 'La mejor fase central de la zona dura {duration}.',
    en: 'The best central phase in the area lasts {duration}.',
  },
  'list.noCentral': {
    ca: 'Dins d’aquest radi no hi arriba la franja de centralitat: la llista ordena per horitzó i per distància, no per segons de totalitat.',
    es: 'Dentro de este radio no llega la franja de centralidad: la lista ordena por horizonte y por distancia, no por segundos de totalidad.',
    en: 'The path of centrality does not reach this radius: the list is ranked by horizon and distance, not by seconds of totality.',
  },
  'list.estimate': {
    ca: 'Tots aquests números són estimacions del garbell, amb terreny gruixut. Es poden equivocar en desenes de segons.',
    es: 'Todos estos números son estimaciones de la criba, con terreno grueso. Pueden equivocarse en decenas de segundos.',
    en: 'All these figures are screening estimates based on coarse terrain. They may be off by tens of seconds.',
  },
  'list.featured': { ca: 'Les 3 millors opcions', es: 'Las 3 mejores opciones', en: 'Top 3 options' },
  'list.more': { ca: 'Mostra {n} opcions més', es: 'Muestra {n} opciones más', en: 'Show {n} more options' },
  'list.less': { ca: 'Amaga la resta', es: 'Oculta el resto', en: 'Hide the rest' },
  'list.caveat': {
    ca: 'El relleu surt d’un model de terra nua: no hi ha arbres, ni edificis, ni tanques. Una filera de pollancres a 500 m val 2°. Amb menys de mig grau de marge, ves-hi abans i mira-t’ho.',
    es: 'El relieve sale de un modelo de tierra desnuda: no hay árboles, ni edificios, ni vallas. Una hilera de chopos a 500 m vale 2°. Con menos de medio grado de margen, ve antes y míratelo.',
    en: 'The terrain comes from a bare-earth model: it does not include trees, buildings, or fences. A row of poplars 500 m away can block 2°. With less than half a degree of clearance, visit beforehand and check the view.',
  },

  /* --- la targeta d'un lloc ---------------------------------------------- */
  'card.rank': { ca: 'Posició {n}', es: 'Posición {n}', en: 'Position {n}' },
  'card.verdict.none': { ca: 'Sense fase central', es: 'Sin fase central', en: 'No central phase' },
  'card.verdict.blocked': { ca: 'Tapat', es: 'Tapado', en: 'Blocked' },
  'card.verdict.full': { ca: 'Sencera', es: 'Entera', en: 'Full' },
  'card.verdict.partial': { ca: 'A mitges', es: 'A medias', en: 'Partial' },
  'card.willSee': { ca: 'Hi veuràs', es: 'Verás', en: 'You will see' },
  'card.thereIs': { ca: 'N’hi ha', es: 'Hay', en: 'Available' },
  'card.clearance': { ca: 'Marge sobre el terreny', es: 'Margen sobre el terreno', en: 'Clearance above terrain' },
  'card.gain': {
    ca: 'Guanyes {duration} respecte al teu punt actual.',
    es: 'Ganas {duration} respecto a tu punto actual.',
    en: 'You gain {duration} compared with your current point.',
  },
  'card.blocking': {
    ca: 'El terreny arriba a {altitude}{distance}. El Sol hi passa {clearance} per damunt.',
    es: 'El terreno llega a {altitude}{distance}. El Sol pasa {clearance} por encima.',
    en: 'The terrain reaches {altitude}{distance}. The Sun passes {clearance} above it.',
  },
  'card.blockingEats': {
    ca: 'El terreny arriba a {altitude}{distance} i se’t menja el Sol per {clearance}.',
    es: 'El terreno llega a {altitude}{distance} y se te come el Sol por {clearance}.',
    en: 'The terrain reaches {altitude}{distance} and blocks the Sun by {clearance}.',
  },
  'card.at': { ca: ' a {distance}', es: ' a {distance}', en: ' at {distance}' },
  'card.lostNoClimb': {
    ca: 'Se’n perden {lost} i des d’aquí no es recuperen pujant.',
    es: 'Se pierden {lost} y desde aquí no se recuperan subiendo.',
    en: 'You lose {lost}, and climbing from here will not recover it.',
  },
  'card.lostClimb': {
    ca: 'Se’n perden {lost}. Pujant {climb} els recuperaries.',
    es: 'Se pierden {lost}. Subiendo {climb} los recuperarías.',
    en: 'You lose {lost}. Climbing {climb} would recover it.',
  },
  'card.coords': { ca: 'Coordenades', es: 'Coordenadas', en: 'Coordinates' },
  'card.midCentral': { ca: 'Mig de la fase central', es: 'Mitad de la fase central', en: 'Middle of the central phase' },
  'card.sun': { ca: 'Sol', es: 'Sol', en: 'Sun' },
  'card.sieve': { ca: 'Estimació amb terreny gruixut', es: 'Estimación con terreno grueso', en: 'Coarse-terrain estimate' },
  'card.edge': { ca: 'Vora de la franja', es: 'Borde de la franja', en: 'Edge of the path' },
  'card.coverage': { ca: 'Relleu incomplet ({percent})', es: 'Relieve incompleto ({percent})', en: 'Incomplete terrain ({percent})' },
  'card.copy': { ca: 'Copia les coordenades', es: 'Copia las coordenadas', en: 'Copy coordinates' },
  'card.copied': { ca: 'Copiades', es: 'Copiadas', en: 'Copied' },
  'card.share': { ca: 'Comparteix', es: 'Comparte', en: 'Share' },
  'card.linkCopied': { ca: 'Enllaç copiat', es: 'Enlace copiado', en: 'Link copied' },
  'card.openMap': { ca: 'Obre al mapa', es: 'Abre en el mapa', en: 'Open in map' },
  /* L'acció que faltava: una fitxa que no es pot fer teva és una fitxa morta. */
  'card.makeMine': { ca: 'Calcula-ho des d’aquí', es: 'Calcúlalo desde aquí', en: 'Calculate from here' },

  /* --- el cost de l'embut (per a qui en toqui els paràmetres) ------------- */
  'cost.title': { ca: 'Cost de l’embut', es: 'Coste del embudo', en: 'Funnel cost' },
  'cost.tiles': { ca: 'tessel·les', es: 'teselas', en: 'tiles' },
  'cost.stage': { ca: 'Etapa', es: 'Etapa', en: 'Stage' },
  'cost.in': { ca: 'Entren', es: 'Entran', en: 'Input' },
  'cost.out': { ca: 'Surten', es: 'Salen', en: 'Output' },
  'cost.time': { ca: 'Temps', es: 'Tiempo', en: 'Time' },
  'cost.ephemeris': { ca: 'Efemèrides', es: 'Efemérides', en: 'Ephemerides' },
  'cost.samples': { ca: 'Mostres', es: 'Muestras', en: 'Samples' },
  'cost.tilesCol': { ca: 'Tessel·les', es: 'Teselas', en: 'Tiles' },
  'cost.candidates': { ca: 'Candidats', es: 'Candidatos', en: 'Candidates' },
  'cost.totalTime': { ca: 'Temps total', es: 'Tiempo total', en: 'Total time' },
  'cost.downloaded': { ca: 'Tessel·les baixades', es: 'Teselas descargadas', en: 'Tiles downloaded' },
  'cost.naive': { ca: 'Si es fes candidat a candidat', es: 'Si se hiciera candidato a candidato', en: 'If calculated one candidate at a time' },
  'cost.netSaving': { ca: 'Estalvi de xarxa', es: 'Ahorro de red', en: 'Network savings' },
  'cost.terrainSaving': { ca: 'Estalvi de terreny', es: 'Ahorro de terreno', en: 'Terrain savings' },
  'cost.note': {
    ca: 'Els números de la dreta són el que costaria calcular el perfil complet de cada candidat un per un. Si l’estalvi baixa d’unes cent vegades, val la pena tornar a mirar els paràmetres del garbell.',
    es: 'Los números de la derecha son lo que costaría calcular el perfil completo de cada candidato uno por uno. Si el ahorro baja de unas cien veces, vale la pena volver a mirar los parámetros de la criba.',
    en: 'The figures on the right show the cost of calculating a full profile for every candidate individually. If the savings fall below roughly one hundredfold, the screening parameters are worth reviewing.',
  },
  'cost.stage.grid': { ca: 'Graella de candidats', es: 'Rejilla de candidatos', en: 'Candidate grid' },
  'cost.stage.astro': { ca: 'A · Astronomia barata', es: 'A · Astronomía barata', en: 'A · Low-cost astronomy' },
  'cost.stage.tiles': { ca: 'B · Tessel·les compartides', es: 'B · Teselas compartidas', en: 'B · Shared tiles' },
  'cost.stage.sieve': { ca: 'C · Garbell d’horitzó', es: 'C · Criba de horizonte', en: 'C · Horizon screening' },
  'cost.stage.refineTiles': { ca: 'D1 · Tessel·les dels finalistes', es: 'D1 · Teselas de los finalistas', en: 'D1 · Finalist tiles' },
  'cost.stage.refine': { ca: 'D2 · Càlcul complet', es: 'D2 · Cálculo completo', en: 'D2 · Full calculation' },

  /* --- errors ---------------------------------------------------------------
   *
   * AQUÍ HI HAVIA UN FORAT I ERA GROS. La clau que hi vivia abans es deia
   * `panel.failedDetail` i deia «El cercador ha fallat: {error}», amb
   * `{error}` omplert pel `message` cru del motor — que estava escrit en
   * català dins de `core/spots/search.ts`. La capçalera d'aquest fitxer ho
   * defensava dient que allò era «tècnic»: no ho era. Era «Comprova la
   * connexió», o sigui l'única part accionable de l'avís, arribant en català
   * a una pantalla en castellà. Ara el motor emet codis
   * (`core/spots/errors.ts`) i cada codi té la seva frase, en dues llengües.
   *
   * TO: què ha passat i què pots fer. Res d'HTTP i res de culpar l'usuari.   */
  'error.cancelled': {
    ca: 'Cerca aturada.',
    es: 'Búsqueda detenida.',
    en: 'Search stopped.',
  },
  'error.noTerrain': {
    ca: 'No ha arribat cap tessel·la del terreny i sense relleu no es pot mirar cap horitzó. Comprova la connexió.',
    es: 'No ha llegado ninguna tesela del terreno y sin relieve no se puede mirar ningún horizonte. Comprueba la conexión.',
    en: 'No terrain tiles were received, and horizons cannot be checked without terrain data. Check your connection.',
  },
  'error.terrainIncomplete': {
    ca: 'Ha faltat relleu per baixar. Amb el terreny a mitges els llocs sortirien optimistes i falsos, i val més no donar-los. Comprova la connexió.',
    es: 'Ha faltado relieve por descargar. Con el terreno a medias los sitios saldrían optimistas y falsos, y vale más no darlos. Comprueba la conexión.',
    en: 'Some terrain could not be downloaded. With incomplete terrain, the suggested spots would be falsely optimistic, so it is safer not to show them. Check your connection.',
  },
  'error.unknown': {
    ca: 'No s’han pogut calcular els llocs. Torna-ho a provar.',
    es: 'No se han podido calcular los sitios. Vuelve a intentarlo.',
    en: 'The spots could not be calculated. Try again.',
  },
  'error.worker': {
    ca: 'La cerca s’ha aturat sola. Torna-ho a provar; si es repeteix, tanca i torna a obrir l’app.',
    es: 'La búsqueda se ha parado sola. Vuelve a intentarlo; si se repite, cierra y vuelve a abrir la app.',
    en: 'The search stopped unexpectedly. Try again; if it keeps happening, close and reopen the app.',
  },
  'error.noWorker': {
    ca: 'Aquest navegador no pot calcular els llocs en segon pla.',
    es: 'Este navegador no puede calcular los sitios en segundo plano.',
    en: 'This browser cannot calculate spots in the background.',
  },
} as const satisfies Record<string, Entry>;

export type SpotStringKey = keyof typeof STRINGS;

/** Text d'una clau en l'idioma actiu, amb marcadors `{nom}`. */
export function sp(
  key: SpotStringKey,
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
 * Del codi de la fallada a la frase, amb `switch` exhaustiu.
 *
 * Mateix contracte que `horizonProgressText` i `horizonFailureText`: afegir un
 * codi a la unió trenca la compilació aquí fins que algú escriu les dues
 * frases. És l'única xarxa que evita que el castellà arribi tard.
 */
export function spotSearchFailureText(
  code: SpotSearchFailureCode,
  locale: Locale,
): string {
  switch (code) {
    case 'cancelled':
      return sp('error.cancelled', locale);
    case 'no-terrain':
      return sp('error.noTerrain', locale);
    case 'terrain-incomplete':
      return sp('error.terrainIncomplete', locale);
    case 'worker':
      return sp('error.worker', locale);
    case 'no-worker':
      return sp('error.noWorker', locale);
    case 'unknown':
      return sp('error.unknown', locale);
  }
}
