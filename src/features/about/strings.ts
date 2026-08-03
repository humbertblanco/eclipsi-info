/**
 * Textos de la pàgina «Com funciona», en català i castellà.
 *
 * PER QUÈ AQUÍ I NO A `src/i18n/*.json`: mateixa raó i mateix patró que
 * `features/weather/strings.ts` — la taula `{ ca, es }` dins del mòdul és el
 * que ja fan `location`, `offline` i `spots`, i si l'i18n es consolida les
 * claus s'aboquen als JSON tal com estan.
 *
 * TO: pla, precís, de tu. Cap signe d'admiració, cap superlatiu de fulletó.
 * La pàgina explica QUÈ fa l'app, D'ON surt cada dada i QUÈ NO FA; el bloc de
 * premsa dona a un periodista la dada comprovable i el text per enganxar,
 * no un eslògan.
 *
 * LES DUES DESCRIPCIONS DE PREMSA (`press.oneLiner`, `press.paragraph`) estan
 * escrites per ser copiades senceres fora de l'app: han de sobreviure sense
 * cap context al voltant, i per això repeteixen el nom del producte i la data
 * que la resta de la pàgina ja dona per sabuts.
 */

import type { Locale } from '../../i18n';

type Entry = { ca: string; es: string };

const STRINGS = {
  /* --- capçalera ---------------------------------------------------------- */
  title: { ca: 'Com funciona', es: 'Cómo funciona' },
  subtitle: {
    ca: 'Què calcula, d’on surt cada dada, i què no fa.',
    es: 'Qué calcula, de dónde sale cada dato, y qué no hace.',
  },

  /* --- bloc 1: el càlcul es fa al dispositiu ------------------------------ */
  'calc.overline': { ca: 'El càlcul', es: 'El cálculo' },
  'calc.title': {
    ca: 'Es fa al teu dispositiu, per al teu punt',
    es: 'Se hace en tu dispositivo, para tu punto',
  },
  'calc.p1': {
    ca: 'Les hores de contacte, la magnitud i la durada no surten d’una taula per ciutats: es calculen per a les teves coordenades i la teva altitud, amb paral·laxi lunar i refracció. És un càlcul topocèntric — del teu punt, no del d’un catàleg.',
    es: 'Las horas de contacto, la magnitud y la duración no salen de una tabla por ciudades: se calculan para tus coordenadas y tu altitud, con paralaje lunar y refracción. Es un cálculo topocéntrico — de tu punto, no del de un catálogo.',
  },
  'calc.p2': {
    ca: 'I tot això passa aquí, al dispositiu. Cap servidor no rep les teves coordenades per calcular-te res: la teva ubicació no surt del mòbil.',
    es: 'Y todo eso pasa aquí, en el dispositivo. Ningún servidor recibe tus coordenadas para calcularte nada: tu ubicación no sale del móvil.',
  },

  /* --- bloc 2: l'horitzó de veritat (la funció diferencial) ---------------- */
  'horizon.overline': { ca: 'El terreny', es: 'El terreno' },
  'horizon.title': {
    ca: 'El teu horitzó, no el de les taules',
    es: 'Tu horizonte, no el de las tablas',
  },
  'horizon.p1': {
    ca: 'Del voltant del teu punt se’n baixa el model digital del terreny (AWS Terrain Tiles) i se’n traça l’horitzó real en 360°, amb curvatura terrestre i refracció atmosfèrica. Les taules suposen l’horitzó llis d’un mar; el teu té carenes.',
    es: 'Del entorno de tu punto se baja el modelo digital del terreno (AWS Terrain Tiles) y se traza el horizonte real en 360°, con curvatura terrestre y refracción atmosférica. Las tablas suponen el horizonte liso de un mar; el tuyo tiene sierras.',
  },
  'horizon.p2': {
    ca: 'Per això la durada que l’app et diu pot ser més curta que la de les taules — i és la bona. El 12 d’agost de 2026 el Sol serà a pocs graus de l’horitzó, i una carena a ponent pot tapar la totalitat sencera. L’app t’ho diu en segons, abans que hi siguis.',
    es: 'Por eso la duración que la app te dice puede ser más corta que la de las tablas — y es la buena. El 12 de agosto de 2026 el Sol estará a pocos grados del horizonte, y una sierra a poniente puede tapar la totalidad entera. La app te lo dice en segundos, antes de que estés allí.',
  },

  /* --- bloc 3: fonts ------------------------------------------------------- */
  'sources.overline': { ca: 'Les fonts', es: 'Las fuentes' },
  'sources.title': {
    ca: 'D’on surten les dades',
    es: 'De dónde salen los datos',
  },
  'sources.p1': {
    ca: 'Una app que et diu quan et pots treure una protecció ocular ha de poder dir contra què s’ha validat. Cada peça té un origen amb nom, i es pot anar a comprovar:',
    es: 'Una app que te dice cuándo puedes quitarte una protección ocular tiene que poder decir contra qué se ha validado. Cada pieza tiene un origen con nombre, y se puede ir a comprobar:',
  },

  /* --- bloc 4: què no fa ---------------------------------------------------- */
  'not.overline': { ca: 'Els límits', es: 'Los límites' },
  'not.title': { ca: 'Què no fa', es: 'Qué no hace' },
  'not.lang': {
    ca: 'No et detecta l’idioma: el tries tu al selector, i s’hi queda.',
    es: 'No te detecta el idioma: lo eliges tú en el selector, y ahí se queda.',
  },
  'not.location': {
    ca: 'No envia la teva ubicació enlloc ni la desa fora del dispositiu.',
    es: 'No envía tu ubicación a ningún sitio ni la guarda fuera del dispositivo.',
  },
  'not.offline': {
    ca: 'No necessita connexió un cop preparat: el càlcul, la guia i el que hagis desat funcionen sense cobertura, que és com estarà la xarxa dins la franja aquell dia.',
    es: 'No necesita conexión una vez preparado: el cálculo, la guía y lo que hayas guardado funcionan sin cobertura, que es como estará la red dentro de la franja ese día.',
  },

  /* --- enllaç a la guia ------------------------------------------------------
   * Textual a posta: l'avís de debò viu a la guia i no es duplica aquí.       */
  'safety.link': {
    ca: 'Seguretat ocular, a la guia',
    es: 'Seguridad ocular, en la guía',
  },

  /* --- premsa ---------------------------------------------------------------- */
  'press.overline': { ca: 'Premsa', es: 'Prensa' },
  'press.title': { ca: 'Per a periodistes', es: 'Para periodistas' },
  'press.badge': { ca: '12 d’agost de 2026', es: '12 de agosto de 2026' },
  'press.fact': {
    ca: 'El 12 d’agost de 2026 un eclipsi total de Sol creuarà la península: el primer amb totalitat visible des d’aquí des del 1905. La dada que aquesta app afegeix: els segons REALS de totalitat des del punt exacte de cadascú, amb el relleu descomptat.',
    es: 'El 12 de agosto de 2026 un eclipse total de Sol cruzará la península: el primero con totalidad visible desde aquí desde 1905. El dato que esta app añade: los segundos REALES de totalidad desde el punto exacto de cada uno, con el relieve descontado.',
  },
  'press.oneLinerLabel': {
    ca: 'Descripció d’una línia',
    es: 'Descripción de una línea',
  },
  'press.oneLiner': {
    ca: 'eclipsi.info et diu quants segons de l’eclipsi total del 12 d’agost de 2026 veuràs de debò des del punt exacte on seràs, muntanyes incloses.',
    es: 'eclipsi.info te dice cuántos segundos del eclipse total del 12 de agosto de 2026 verás de verdad desde el punto exacto donde estarás, montañas incluidas.',
  },
  'press.paragraphLabel': {
    ca: 'Descripció d’un paràgraf',
    es: 'Descripción de un párrafo',
  },
  'press.paragraph': {
    ca: 'El 12 d’agost de 2026 un eclipsi total de Sol creuarà la península, el primer amb totalitat visible des d’aquí des del 1905, amb el Sol a pocs graus de l’horitzó. eclipsi.info calcula al mateix dispositiu, per a les coordenades i l’altitud de cadascú, les hores de contacte i els segons reals de totalitat: traça l’horitzó en 360° amb el model del terreny i descompta el que tapa cada carena — que amb el Sol tan baix pot ser la totalitat sencera. Funciona sense connexió un cop preparat, no envia la ubicació enlloc i és de codi obert. Fet per Humbert Blanco i Damos en el Blanco.',
    es: 'El 12 de agosto de 2026 un eclipse total de Sol cruzará la península, el primero con totalidad visible desde aquí desde 1905, con el Sol a pocos grados del horizonte. eclipsi.info calcula en el propio dispositivo, para las coordenadas y la altitud de cada uno, las horas de contacto y los segundos reales de totalidad: traza el horizonte en 360° con el modelo del terreno y descuenta lo que tapa cada sierra — que con el Sol tan bajo puede ser la totalidad entera. Funciona sin conexión una vez preparado, no envía la ubicación a ningún sitio y es de código abierto. Hecho por Humbert Blanco y Damos en el Blanco.',
  },
  'press.copy': { ca: 'Copia', es: 'Copia' },
  'press.copied': { ca: 'Copiat', es: 'Copiado' },

  /* --- actius de marca ------------------------------------------------------- */
  'assets.overline': { ca: 'Actius de marca', es: 'Activos de marca' },
  'assets.note': {
    ca: 'Lliures per a ús editorial. No en canviïs els colors ni les proporcions.',
    es: 'Libres para uso editorial. No cambies sus colores ni sus proporciones.',
  },
  'assets.logo': { ca: 'Logotip complet', es: 'Logotipo completo' },
  'assets.mark': { ca: 'Marca sola', es: 'Marca sola' },
  'assets.markMono': { ca: 'Marca monocroma', es: 'Marca monocroma' },
  'assets.daylight': {
    ca: 'Logotip per a fons clar',
    es: 'Logotipo para fondo claro',
  },
  'assets.og': {
    ca: 'Imatge social (1200 × 630)',
    es: 'Imagen social (1200 × 630)',
  },

  /* --- contacte ---------------------------------------------------------------
   * Acaba en dos punts perquè al darrere hi van els dos enllaços d'autor.      */
  'contact.lead': {
    ca: 'Per a entrevistes o dades del vostre punt concret, escriviu als autors:',
    es: 'Para entrevistas o datos de vuestro punto concreto, escribid a los autores:',
  },
  'contact.and': { ca: 'i', es: 'y' },
} as const satisfies Record<string, Entry>;

export type AboutStringKey = keyof typeof STRINGS;

/**
 * Text d'una clau en l'idioma actiu. Mateixa signatura i mateixos marcadors
 * `{nom}` que `ws()` de weather, `ls()` de location i `os()` d'offline: el
 * dia que l'i18n es consolidi, la substitució és mecànica.
 */
export function ab(
  key: AboutStringKey,
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

/* ---------------------------------------------------------------------------
 * D'on surt cada cosa.
 *
 * CÒPIA DELIBERADA de la llista canònica de `src/screens/SiteFooter.tsx`
 * (mateixes files, mateix ordre: primer el que decideix les xifres, després
 * el que decideix el que veus). Aquesta tasca no pot tocar fitxers existents;
 * quan l'orquestrador cabli la pàgina, la font única ha de ser una de sola i
 * aquesta constant és la candidata a morir.
 * ------------------------------------------------------------------------- */

export interface AboutSource {
  what: Record<Locale, string>;
  who: string;
  url: string;
}

export const ABOUT_SOURCES: AboutSource[] = [
  {
    what: { ca: 'Efemèrides', es: 'Efemérides' },
    who: 'astronomy-engine',
    url: 'https://github.com/cosinekitty/astronomy',
  },
  {
    what: { ca: 'Trajectòria de l’ombra', es: 'Trayectoria de la sombra' },
    who: 'Fred Espenak, NASA/GSFC',
    url: 'https://eclipse.gsfc.nasa.gov/',
  },
  {
    what: { ca: 'Dades d’observació', es: 'Datos de observación' },
    who: 'IGN',
    url: 'https://eclipses.ign.es/',
  },
  {
    what: { ca: 'Model del terreny', es: 'Modelo del terreno' },
    who: 'AWS Terrain Tiles',
    url: 'https://registry.opendata.aws/terrain-tiles/',
  },
  {
    what: { ca: 'Cartografia i topònims', es: 'Cartografía y topónimos' },
    who: 'OpenStreetMap · Photon · CARTO',
    url: 'https://www.openstreetmap.org/copyright',
  },
  {
    what: { ca: 'Meteorologia', es: 'Meteorología' },
    who: 'Open-Meteo',
    url: 'https://open-meteo.com/',
  },
  {
    what: { ca: 'Seguretat ocular', es: 'Seguridad ocular' },
    who: 'AAS · ISO 12312-2',
    url: 'https://eclipse.aas.org/eye-safety',
  },
];

/**
 * Qui ho signa, per al bloc de contacte de premsa. Els dos al mateix nivell,
 * com al peu: la persona al seu perfil i el despatx al seu domini.
 * (Còpia deliberada de `SiteFooter.tsx`, mateixa nota que `ABOUT_SOURCES`.)
 */
export interface AboutAuthor {
  name: string;
  url: string;
}

export const ABOUT_AUTHORS: AboutAuthor[] = [
  { name: 'Humbert Blanco', url: 'https://x.com/humbertblanco' },
  { name: 'Damos en el Blanco', url: 'https://damosenelblanco.com' },
];
