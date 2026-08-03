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

type Entry = { ca: string; es: string };

const STRINGS = {
  /* --- el panell --------------------------------------------------------- */
  'panel.title': { ca: 'On m’he de plantar', es: 'Dónde me tengo que poner' },
  'panel.lead': {
    ca: 'Escombra el voltant i creua la trajectòria del Sol amb el relleu real de cada punt.',
    es: 'Barre los alrededores y cruza la trayectoria del Sol con el relieve real de cada punto.',
  },
  'panel.search': { ca: 'Busca llocs', es: 'Busca sitios' },
  'panel.searchAgain': { ca: 'Torna a cercar', es: 'Vuelve a buscar' },
  'panel.stop': { ca: 'Atura', es: 'Detén' },
  'panel.needOrigin': {
    ca: 'Cal saber on ets per poder buscar-hi al voltant.',
    es: 'Hace falta saber dónde estás para poder buscar a tu alrededor.',
  },
  'panel.cancelled': {
    ca: 'Cerca aturada. No s’ha baixat res més.',
    es: 'Búsqueda detenida. No se ha descargado nada más.',
  },
  'panel.failed': {
    ca: 'El càlcul dels llocs ha fallat.',
    es: 'El cálculo de los sitios ha fallado.',
  },
  /*
   * EL DETALL DE L'ERROR. Un «ha fallat» pelat no deixa distingir una xarxa
   * caiguda d'un relleu corrupte, i el missatge real ja el guarda
   * `useSpotSearch`. El patró és el d'`src/offline/strings.ts` (`note.error`):
   * frase traduïda i la causa crua interpolada. El text del motor pot arribar
   * en català a una pantalla en castellà; és tècnic, i val més una pista en
   * l'idioma equivocat que cap pista.
   */
  'panel.failedDetail': {
    ca: 'El cercador ha fallat: {error}',
    es: 'El buscador ha fallado: {error}',
  },
  'panel.progressLabel': { ca: 'Progrés de la cerca', es: 'Progreso de la búsqueda' },
  /*
   * AVÍS DE DADES. La cerca baixa desenes de megabytes de relleu i al camp
   * això es paga. Es diu abans de prémer el botó, no després.
   */
  'panel.dataWarning': {
    ca: 'Baixa relleu de tot el voltant: unes desenes de megabytes. Amb dades mòbils comptades, fes-ho abans de sortir de casa.',
    es: 'Descarga relieve de todo el entorno: unas decenas de megabytes. Con datos móviles contados, hazlo antes de salir de casa.',
  },

  /* --- les etapes de la barra de progrés ---------------------------------
   *
   * El motor ja envia un `message` en català dins de `SpotSearchProgress`.
   * NO es fa servir a la pantalla: es fa servir l'etapa, que és un codi, i el
   * text surt d'aquí. Així el progrés parla l'idioma de l'usuari sense que
   * `core/spots` hagi de saber què és un idioma.                             */
  'stage.grid': { ca: 'Preparant la graella de candidats', es: 'Preparando la rejilla de candidatos' },
  'stage.astro': { ca: 'Calculant l’eclipsi a cada punt', es: 'Calculando el eclipse en cada punto' },
  'stage.tiles': { ca: 'Baixant el relleu de la zona', es: 'Descargando el relieve de la zona' },
  'stage.sieve': { ca: 'Garbellant per horitzó', es: 'Cribando por horizonte' },
  'stage.refineTiles': { ca: 'Baixant el relleu dels finalistes', es: 'Descargando el relieve de los finalistas' },
  'stage.refine': { ca: 'Perfil d’horitzó complet dels finalistes', es: 'Perfil de horizonte completo de los finalistas' },
  'stage.done': { ca: 'Fet', es: 'Hecho' },

  /* --- la llista --------------------------------------------------------- */
  'list.empty': {
    ca: 'Dins de {radius} no hi ha cap punt des d’on el Sol quedi per damunt de l’horitzó durant l’eclipsi. Prova d’eixamplar el radi.',
    es: 'Dentro de {radius} no hay ningún punto desde donde el Sol quede por encima del horizonte durante el eclipse. Prueba a ampliar el radio.',
  },
  'list.contextOne': {
    ca: '{n} lloc de {candidates} punts mirats dins de {radius}.',
    es: '{n} sitio de {candidates} puntos mirados dentro de {radius}.',
  },
  'list.contextMany': {
    ca: '{n} llocs de {candidates} punts mirats dins de {radius}.',
    es: '{n} sitios de {candidates} puntos mirados dentro de {radius}.',
  },
  'list.best': {
    ca: 'La millor fase central de la zona dura {duration}.',
    es: 'La mejor fase central de la zona dura {duration}.',
  },
  'list.noCentral': {
    ca: 'Dins d’aquest radi no hi arriba la franja de centralitat: la llista ordena per horitzó i per distància, no per segons de totalitat.',
    es: 'Dentro de este radio no llega la franja de centralidad: la lista ordena por horizonte y por distancia, no por segundos de totalidad.',
  },
  'list.estimate': {
    ca: 'Tots aquests números són estimacions del garbell, amb terreny gruixut. Es poden equivocar en desenes de segons.',
    es: 'Todos estos números son estimaciones de la criba, con terreno grueso. Pueden equivocarse en decenas de segundos.',
  },
  'list.caveat': {
    ca: 'El relleu surt d’un model de terra nua: no hi ha arbres, ni edificis, ni tanques. Una filera de pollancres a 500 m val 2°. Amb menys de mig grau de marge, ves-hi abans i mira-t’ho.',
    es: 'El relieve sale de un modelo de tierra desnuda: no hay árboles, ni edificios, ni vallas. Una hilera de chopos a 500 m vale 2°. Con menos de medio grado de margen, ve antes y míratelo.',
  },

  /* --- la targeta d'un lloc ---------------------------------------------- */
  'card.rank': { ca: 'Posició {n}', es: 'Posición {n}' },
  'card.verdict.none': { ca: 'Sense fase central', es: 'Sin fase central' },
  'card.verdict.blocked': { ca: 'Tapat', es: 'Tapado' },
  'card.verdict.full': { ca: 'Sencera', es: 'Entera' },
  'card.verdict.partial': { ca: 'A mitges', es: 'A medias' },
  'card.willSee': { ca: 'Hi veuràs', es: 'Verás' },
  'card.thereIs': { ca: 'N’hi ha', es: 'Hay' },
  'card.clearance': { ca: 'Marge sobre el terreny', es: 'Margen sobre el terreno' },
  'card.blocking': {
    ca: 'El terreny arriba a {altitude}{distance}. El Sol hi passa {clearance} per damunt.',
    es: 'El terreno llega a {altitude}{distance}. El Sol pasa {clearance} por encima.',
  },
  'card.blockingEats': {
    ca: 'El terreny arriba a {altitude}{distance} i se’t menja el Sol per {clearance}.',
    es: 'El terreno llega a {altitude}{distance} y se te come el Sol por {clearance}.',
  },
  'card.at': { ca: ' a {distance}', es: ' a {distance}' },
  'card.lostNoClimb': {
    ca: 'Se’n perden {lost} i des d’aquí no es recuperen pujant.',
    es: 'Se pierden {lost} y desde aquí no se recuperan subiendo.',
  },
  'card.lostClimb': {
    ca: 'Se’n perden {lost}. Pujant {climb} els recuperaries.',
    es: 'Se pierden {lost}. Subiendo {climb} los recuperarías.',
  },
  'card.coords': { ca: 'Coordenades', es: 'Coordenadas' },
  'card.midCentral': { ca: 'Mig de la fase central', es: 'Mitad de la fase central' },
  'card.sun': { ca: 'Sol', es: 'Sol' },
  'card.sieve': { ca: 'Estimació amb terreny gruixut', es: 'Estimación con terreno grueso' },
  'card.edge': { ca: 'Vora de la franja', es: 'Borde de la franja' },
  'card.coverage': { ca: 'Relleu incomplet ({percent})', es: 'Relieve incompleto ({percent})' },
  'card.copy': { ca: 'Copia les coordenades', es: 'Copia las coordenadas' },
  'card.copied': { ca: 'Copiades', es: 'Copiadas' },
  'card.share': { ca: 'Comparteix', es: 'Comparte' },
  'card.linkCopied': { ca: 'Enllaç copiat', es: 'Enlace copiado' },
  'card.openMap': { ca: 'Obre al mapa', es: 'Abre en el mapa' },
  /* L'acció que faltava: una fitxa que no es pot fer teva és una fitxa morta. */
  'card.makeMine': { ca: 'Calcula-ho des d’aquí', es: 'Calcúlalo desde aquí' },

  /* --- el cost de l'embut (per a qui en toqui els paràmetres) ------------- */
  'cost.title': { ca: 'Cost de l’embut', es: 'Coste del embudo' },
  'cost.tiles': { ca: 'tessel·les', es: 'teselas' },
  'cost.stage': { ca: 'Etapa', es: 'Etapa' },
  'cost.in': { ca: 'Entren', es: 'Entran' },
  'cost.out': { ca: 'Surten', es: 'Salen' },
  'cost.time': { ca: 'Temps', es: 'Tiempo' },
  'cost.ephemeris': { ca: 'Efemèrides', es: 'Efemérides' },
  'cost.samples': { ca: 'Mostres', es: 'Muestras' },
  'cost.tilesCol': { ca: 'Tessel·les', es: 'Teselas' },
  'cost.candidates': { ca: 'Candidats', es: 'Candidatos' },
  'cost.totalTime': { ca: 'Temps total', es: 'Tiempo total' },
  'cost.downloaded': { ca: 'Tessel·les baixades', es: 'Teselas descargadas' },
  'cost.naive': { ca: 'Si es fes candidat a candidat', es: 'Si se hiciera candidato a candidato' },
  'cost.netSaving': { ca: 'Estalvi de xarxa', es: 'Ahorro de red' },
  'cost.terrainSaving': { ca: 'Estalvi de terreny', es: 'Ahorro de terreno' },
  'cost.note': {
    ca: 'Els números de la dreta són el que costaria calcular el perfil complet de cada candidat un per un. Si l’estalvi baixa d’unes cent vegades, val la pena tornar a mirar els paràmetres del garbell.',
    es: 'Los números de la derecha son lo que costaría calcular el perfil completo de cada candidato uno por uno. Si el ahorro baja de unas cien veces, vale la pena volver a mirar los parámetros de la criba.',
  },
  'cost.stage.grid': { ca: 'Graella de candidats', es: 'Rejilla de candidatos' },
  'cost.stage.astro': { ca: 'A · Astronomia barata', es: 'A · Astronomía barata' },
  'cost.stage.tiles': { ca: 'B · Tessel·les compartides', es: 'B · Teselas compartidas' },
  'cost.stage.sieve': { ca: 'C · Garbell d’horitzó', es: 'C · Criba de horizonte' },
  'cost.stage.refineTiles': { ca: 'D1 · Tessel·les dels finalistes', es: 'D1 · Teselas de los finalistas' },
  'cost.stage.refine': { ca: 'D2 · Càlcul complet', es: 'D2 · Cálculo completo' },

  /* --- errors del worker -------------------------------------------------- */
  'error.noWorker': {
    ca: 'Aquest navegador no pot calcular els llocs en segon pla.',
    es: 'Este navegador no puede calcular los sitios en segundo plano.',
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
