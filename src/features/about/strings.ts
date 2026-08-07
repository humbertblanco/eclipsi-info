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

type Entry = { ca: string; es: string; en: string; fr: string };

const STRINGS = {
  /* --- capçalera ---------------------------------------------------------- */
  title: { ca: 'Com funciona', es: 'Cómo funciona', en: 'How it works', fr: 'Comment ça marche' },
  subtitle: {
    ca: 'Què calcula, d’on surt cada dada, i què no fa. Gratuït, per a tothom i sense ànim de lucre.',
    es: 'Qué calcula, de dónde sale cada dato, y qué no hace. Gratuito, para todo el mundo y sin ánimo de lucro.',
    en: 'What it calculates, where each piece of data comes from, and what it does not do. Free, open to everyone, and not for profit.',
    fr: 'Ce que l’application calcule, d’où vient chaque donnée et ce qu’elle ne fait pas. Gratuite, ouverte à tous et sans but lucratif.',
  },

  /* --- bloc 1: el càlcul es fa al dispositiu ------------------------------ */
  'calc.overline': { ca: 'El càlcul', es: 'El cálculo', en: 'The calculation', fr: 'Le calcul' },
  'calc.title': {
    ca: 'Es fa al teu dispositiu, per al teu punt',
    es: 'Se hace en tu dispositivo, para tu punto',
    en: 'Calculated on your device, for your exact location',
    fr: 'Effectué sur votre appareil, pour votre position exacte',
  },
  'calc.p1': {
    ca: 'Les hores de contacte, la magnitud i la durada no surten d’una taula per ciutats: es calculen per a les teves coordenades i la teva altitud, amb paral·laxi lunar i refracció. És un càlcul topocèntric — del teu punt, no del d’un catàleg.',
    es: 'Las horas de contacto, la magnitud y la duración no salen de una tabla por ciudades: se calculan para tus coordenadas y tu altitud, con paralaje lunar y refracción. Es un cálculo topocéntrico — de tu punto, no del de un catálogo.',
    en: 'Contact times, magnitude, and duration do not come from a table of cities: they are calculated for your coordinates and elevation, including lunar parallax and refraction. It is a topocentric calculation—for your location, not a catalogue entry.',
    fr: 'Les heures de contact, la magnitude et la durée ne proviennent pas d’un tableau de villes : elles sont calculées pour vos coordonnées et votre altitude, en tenant compte de la parallaxe lunaire et de la réfraction. C’est un calcul topocentrique, propre à votre position et non à une entrée de catalogue.',
  },
  /*
   * La salvaguarda («per calcular-te res») era correcta i l'acabava desfent
   * una afirmació nua que no ho és: les coordenades SÍ que surten cap a
   * Photon i Open-Meteo. Vegeu `PRIVACY_NOTE` a `credits.ts`.
   */
  'calc.p2': {
    ca: 'I tot això passa aquí, al dispositiu: cap servidor no rep les teves coordenades per calcular-te res. Sí que les reben, en canvi, els dos serveis que posen nom al lloc i donen la previsió — i el relleu es baixa per tessel·les, que també diuen aproximadament on ets.',
    es: 'Y todo eso pasa aquí, en el dispositivo: ningún servidor recibe tus coordenadas para calcularte nada. Sí las reciben, en cambio, los dos servicios que ponen nombre al lugar y dan la previsión — y el relieve se descarga por teselas, que también dicen aproximadamente dónde estás.',
    en: 'All of this happens here, on your device: no server receives your coordinates to perform the calculation. They are, however, sent to the two services that name the location and provide the forecast—and terrain is downloaded in tiles, which also reveal your approximate location.',
    fr: 'Tout cela s’effectue ici, sur votre appareil : aucun serveur ne reçoit vos coordonnées pour réaliser le calcul. Elles sont toutefois envoyées aux deux services qui identifient le lieu et fournissent les prévisions ; le relief est téléchargé sous forme de tuiles, qui révèlent également votre position approximative.',
  },

  /* --- bloc 2: l'horitzó de veritat (la funció diferencial) ---------------- */
  'horizon.overline': { ca: 'El terreny', es: 'El terreno', en: 'The terrain', fr: 'Le relief' },
  'horizon.title': {
    ca: 'El teu horitzó, no el de les taules',
    es: 'Tu horizonte, no el de las tablas',
    en: 'Your horizon, not the one in the tables',
    fr: 'Votre horizon, pas celui des tables',
  },
  'horizon.p1': {
    ca: 'Del voltant del teu punt se’n baixa el model digital del terreny (AWS Terrain Tiles) i se’n traça l’horitzó real en 360°, amb curvatura terrestre i refracció atmosfèrica. Les taules suposen l’horitzó llis d’un mar; el teu té carenes.',
    es: 'Del entorno de tu punto se baja el modelo digital del terreno (AWS Terrain Tiles) y se traza el horizonte real en 360°, con curvatura terrestre y refracción atmosférica. Las tablas suponen el horizonte liso de un mar; el tuyo tiene sierras.',
    en: 'A digital terrain model (AWS Terrain Tiles) is downloaded around your location and used to trace your actual 360° horizon, including Earth curvature and atmospheric refraction. Tables assume a flat sea horizon; yours has ridgelines.',
    fr: 'Un modèle numérique de terrain (AWS Terrain Tiles) est téléchargé autour de votre position afin de tracer votre horizon réel à 360°, en tenant compte de la courbure terrestre et de la réfraction atmosphérique. Les tables supposent un horizon marin plat ; le vôtre comporte des crêtes.',
  },
  'horizon.p2': {
    ca: 'Per això la durada que l’app et diu pot ser més curta que la de les taules — i és la bona. El 12 d’agost de 2026 el Sol serà a pocs graus de l’horitzó, i una carena a ponent pot tapar la totalitat sencera. L’app t’ho diu en segons, abans que hi siguis.',
    es: 'Por eso la duración que la app te dice puede ser más corta que la de las tablas — y es la buena. El 12 de agosto de 2026 el Sol estará a pocos grados del horizonte, y una sierra a poniente puede tapar la totalidad entera. La app te lo dice en segundos, antes de que estés allí.',
    en: 'That is why the duration shown by the app may be shorter than the duration in the tables—and why it is the right one. On 12 August 2026, the Sun will be only a few degrees above the horizon, and a ridge to the west could block the whole of totality. The app tells you how many seconds you will see before you get there.',
    fr: 'C’est pourquoi la durée affichée par l’application peut être plus courte que celle des tables, et pourquoi c’est la bonne. Le 12 août 2026, le Soleil ne sera qu’à quelques degrés au-dessus de l’horizon, et une crête à l’ouest pourrait masquer toute la totalité. L’application vous indique à l’avance combien de secondes vous verrez.',
  },

  /* --- bloc 3: fonts ------------------------------------------------------- */
  'sources.overline': { ca: 'Les fonts', es: 'Las fuentes', en: 'Sources', fr: 'Sources' },
  'sources.title': {
    ca: 'D’on surten les dades',
    es: 'De dónde salen los datos',
    en: 'Where the data comes from',
    fr: 'D’où viennent les données',
  },
  'sources.p1': {
    ca: 'Una app que et diu quan et pots treure una protecció ocular ha de poder dir contra què s’ha validat. Cada peça té un origen amb nom, i es pot anar a comprovar:',
    es: 'Una app que te dice cuándo puedes quitarte una protección ocular tiene que poder decir contra qué se ha validado. Cada pieza tiene un origen con nombre, y se puede ir a comprobar:',
    en: 'An app that tells you when you can remove eye protection must be able to say what it was validated against. Every component has a named source that you can check:',
    fr: 'Une application qui vous indique quand retirer votre protection oculaire doit pouvoir préciser sur quelles références elle a été validée. Chaque composant provient d’une source nommée que vous pouvez consulter :',
  },

  /* --- bloc 4: què no fa ---------------------------------------------------- */
  'not.overline': { ca: 'Els límits', es: 'Los límites', en: 'Limitations', fr: 'Limites' },
  'not.title': { ca: 'Què no fa', es: 'Qué no hace', en: 'What it does not do', fr: 'Ce que l’application ne fait pas' },
  'not.lang': {
    ca: 'No et detecta l’idioma: el tries tu al selector, i s’hi queda.',
    es: 'No te detecta el idioma: lo eliges tú en el selector, y ahí se queda.',
    en: 'It does not detect your language: you choose it in the selector, and your choice is remembered.',
    fr: 'Elle ne détecte pas votre langue : vous la choisissez dans le sélecteur, et ce choix est mémorisé.',
  },
  /*
   * AQUESTA DEIA «no envia la teva ubicació enlloc» I ERA FALSA: l'app la
   * envia a Photon per posar nom al punt i a Open-Meteo per la previsió.
   * Vegeu el raonament sencer al costat de `PRIVACY_NOTE` a `credits.ts`. El
   * que és cert —i segueix sent el que la gent vol saber— és que no la desa
   * fora del dispositiu, que no va a cap altre lloc i que no arriba mai a
   * l'analítica.
   */
  'not.location': {
    ca: 'No desa la teva ubicació fora del dispositiu ni la envia enlloc més que als dos serveis que la necessiten: Photon, per posar nom al lloc, i Open-Meteo, per la previsió.',
    es: 'No guarda tu ubicación fuera del dispositivo ni la envía a ningún sitio más que a los dos servicios que la necesitan: Photon, para poner nombre al lugar, y Open-Meteo, para la previsión.',
    en: 'It does not store your location outside your device or send it anywhere except to the two services that need it: Photon, to name the location, and Open-Meteo, for the forecast.',
    fr: 'Elle ne conserve pas votre position hors de votre appareil et ne l’envoie qu’aux deux services qui en ont besoin : Photon, pour nommer le lieu, et Open-Meteo, pour les prévisions.',
  },
  'not.offline': {
    ca: 'No necessita connexió un cop preparat: el càlcul, la guia i el que hagis desat funcionen sense cobertura, que és com estarà la xarxa dins la franja aquell dia.',
    es: 'No necesita conexión una vez preparado: el cálculo, la guía y lo que hayas guardado funcionan sin cobertura, que es como estará la red dentro de la franja ese día.',
    en: 'Once prepared, it does not need a connection: the calculation, guide, and anything you have saved work without coverage—which is likely how the network will be inside the eclipse path that day.',
    fr: 'Une fois préparée, elle n’a plus besoin de connexion : le calcul, le guide et tout ce que vous avez enregistré fonctionnent sans réseau, comme ce sera probablement le cas dans la bande de l’éclipse ce jour-là.',
  },

  /* --- enllaç a la guia ------------------------------------------------------
   * Textual a posta: l'avís de debò viu a la guia i no es duplica aquí.       */
  'safety.link': {
    ca: 'Seguretat ocular, a la guia',
    es: 'Seguridad ocular, en la guía',
    en: 'Eye safety, in the guide',
    fr: 'Sécurité oculaire, dans le guide',
  },

  /* --- cobertura editorial -------------------------------------------------- */
  'mentions.overline': { ca: 'Als mitjans', es: 'En los medios', en: 'In the media', fr: 'Dans les médias' },
  'mentions.title': { ca: 'Han parlat d’eclipsi.info', es: 'Han hablado de eclipsi.info', en: 'eclipsi.info in the press', fr: 'La presse parle d’eclipsi.info' },
  'mentions.note': {
    ca: 'Una selecció de mitjans que han explicat el projecte. La llista continuarà creixent.',
    es: 'Una selección de medios que han explicado el proyecto. La lista seguirá creciendo.',
    en: 'A selection of outlets that have covered the project. More will be added over time.',
    fr: 'Une sélection de médias qui ont présenté le projet. La liste continuera de s’enrichir.',
  },
  'mentions.read': { ca: 'Llegeix la peça', es: 'Lee el artículo', en: 'Read the story', fr: 'Lire l’article' },

  /* --- premsa ---------------------------------------------------------------- */
  'press.overline': { ca: 'Premsa', es: 'Prensa', en: 'Press', fr: 'Presse' },
  'press.title': { ca: 'Per a periodistes', es: 'Para periodistas', en: 'For journalists', fr: 'Pour les journalistes' },
  'press.badge': { ca: '12 d’agost de 2026', es: '12 de agosto de 2026', en: '12 August 2026', fr: '12 août 2026' },
  'press.fact': {
    ca: 'El 12 d’agost de 2026 un eclipsi total de Sol creuarà la península: el primer amb totalitat visible des d’aquí des del 1905. La dada que aquesta app afegeix: els segons REALS de totalitat des del punt exacte de cadascú, amb el relleu descomptat.',
    es: 'El 12 de agosto de 2026 un eclipse total de Sol cruzará la península: el primero con totalidad visible desde aquí desde 1905. El dato que esta app añade: los segundos REALES de totalidad desde el punto exacto de cada uno, con el relieve descontado.',
    en: 'On 12 August 2026, a total solar eclipse will cross the Iberian Peninsula: the first with totality visible from here since 1905. What this app adds is the ACTUAL number of seconds of totality at each person’s exact location, after accounting for the terrain.',
    fr: 'Le 12 août 2026, une éclipse totale de Soleil traversera la péninsule Ibérique : la première dont la totalité sera visible depuis cette région depuis 1905. L’apport de cette application : le nombre RÉEL de secondes de totalité à la position exacte de chacun, relief pris en compte.',
  },
  'press.oneLinerLabel': {
    ca: 'Descripció d’una línia',
    es: 'Descripción de una línea',
    en: 'One-line description',
    fr: 'Description en une ligne',
  },
  'press.oneLiner': {
    ca: 'eclipsi.info et diu quants segons de l’eclipsi total del 12 d’agost de 2026 veuràs de debò des del punt exacte on seràs, muntanyes incloses.',
    es: 'eclipsi.info te dice cuántos segundos del eclipse total del 12 de agosto de 2026 verás de verdad desde el punto exacto donde estarás, montañas incluidas.',
    en: 'eclipsi.info tells you how many seconds of the 12 August 2026 total eclipse you will actually see from your exact location, mountains included.',
    fr: 'eclipsi.info vous indique combien de secondes de l’éclipse totale du 12 août 2026 vous verrez réellement depuis votre position exacte, montagnes comprises.',
  },
  'press.paragraphLabel': {
    ca: 'Descripció d’un paràgraf',
    es: 'Descripción de un párrafo',
    en: 'One-paragraph description',
    fr: 'Description en un paragraphe',
  },
  'press.paragraph': {
    ca: 'El 12 d’agost de 2026 un eclipsi total de Sol creuarà la península, el primer amb totalitat visible des d’aquí des del 1905, amb el Sol a pocs graus de l’horitzó. eclipsi.info calcula al mateix dispositiu, per a les coordenades i l’altitud de cadascú, les hores de contacte i els segons reals de totalitat: traça l’horitzó en 360° amb el model del terreny i descompta el que tapa cada carena — que amb el Sol tan baix pot ser la totalitat sencera. Funciona sense connexió un cop preparat, no desa la ubicació fora del dispositiu i només la comparteix amb els serveis necessaris per posar nom al lloc i donar la previsió. És de codi obert. Fet per Humbert Blanco i Damos en el Blanco.',
    es: 'El 12 de agosto de 2026 un eclipse total de Sol cruzará la península, el primero con totalidad visible desde aquí desde 1905, con el Sol a pocos grados del horizonte. eclipsi.info calcula en el propio dispositivo, para las coordenadas y la altitud de cada uno, las horas de contacto y los segundos reales de totalidad: traza el horizonte en 360° con el modelo del terreno y descuenta lo que tapa cada sierra — que con el Sol tan bajo puede ser la totalidad entera. Funciona sin conexión una vez preparado, no guarda la ubicación fuera del dispositivo y solo la comparte con los servicios necesarios para poner nombre al lugar y dar la previsión. Es de código abierto. Hecho por Humbert Blanco y Damos en el Blanco.',
    en: 'On 12 August 2026, a total solar eclipse will cross the Iberian Peninsula—the first with totality visible from here since 1905—with the Sun only a few degrees above the horizon. eclipsi.info calculates contact times and the actual seconds of totality on the device for each person’s coordinates and elevation: it traces the 360° horizon from the terrain model and subtracts whatever each ridge blocks—which, with the Sun this low, could be the whole of totality. Once prepared, it works offline, does not store location outside the device, and shares it only with the services needed to name the place and provide the forecast. It is open source. Created by Humbert Blanco and Damos en el Blanco.',
    fr: 'Le 12 août 2026, une éclipse totale de Soleil traversera la péninsule Ibérique — la première dont la totalité sera visible depuis cette région depuis 1905 — avec le Soleil à quelques degrés seulement au-dessus de l’horizon. eclipsi.info calcule sur l’appareil, pour les coordonnées et l’altitude de chacun, les heures de contact et les secondes réelles de totalité : l’application trace l’horizon à 360° à partir du modèle de terrain et retranche ce que masque chaque crête — ce qui, avec un Soleil aussi bas, peut représenter toute la totalité. Une fois préparée, elle fonctionne hors ligne, ne conserve pas la position hors de l’appareil et ne la partage qu’avec les services nécessaires pour nommer le lieu et fournir les prévisions. Son code source est ouvert. Créée par Humbert Blanco et Damos en el Blanco.',
  },
  'press.copy': { ca: 'Copia', es: 'Copia', en: 'Copy', fr: 'Copier' },
  'press.copied': { ca: 'Copiat', es: 'Copiado', en: 'Copied', fr: 'Copié' },

  /* --- material editorial --------------------------------------------------- */
  'media.overline': { ca: 'Material de premsa', es: 'Material de prensa', en: 'Press materials', fr: 'Ressources presse' },
  'media.note': {
    ca: 'Imatges en alta resolució i nota de premsa, preparades per a ús editorial.',
    es: 'Imágenes en alta resolución y nota de prensa, preparadas para uso editorial.',
    en: 'High-resolution images and a press release, prepared for editorial use.',
    fr: 'Images en haute résolution et communiqué de presse, préparés pour un usage éditorial.',
  },
  'media.simulation': { ca: 'Simulació de l’eclipsi al mòbil', es: 'Simulación del eclipse en el móvil', en: 'Eclipse simulation on a phone', fr: 'Simulation de l’éclipse sur téléphone' },
  'media.simulationAlt': {
    ca: 'Mòbil amb el recorregut simulat de l’eclipsi sobre una plaça',
    es: 'Móvil con el recorrido simulado del eclipse sobre una plaza',
    en: 'Phone showing the simulated progress of the eclipse over a town square',
    fr: 'Téléphone affichant la progression simulée de l’éclipse au-dessus d’une place',
  },
  'media.desktop': { ca: 'Vista de l’aplicació a l’escriptori', es: 'Vista de la aplicación en escritorio', en: 'Desktop view of the app', fr: 'Vue de l’application sur ordinateur' },
  'media.desktopAlt': {
    ca: 'Pantalla d’escriptori amb el compte enrere i la durada visible de l’eclipsi',
    es: 'Pantalla de escritorio con la cuenta atrás y la duración visible del eclipse',
    en: 'Desktop screen showing the countdown and visible eclipse duration',
    fr: 'Écran d’ordinateur affichant le compte à rebours et la durée visible de l’éclipse',
  },
  'media.download': { ca: 'Descarrega', es: 'Descarga', en: 'Download', fr: 'Télécharger' },
  'media.release': { ca: 'Descarrega la nota de premsa', es: 'Descarga la nota de prensa', en: 'Download the press release', fr: 'Télécharger le communiqué de presse' },

  /* --- actius de marca ------------------------------------------------------- */
  'assets.overline': { ca: 'Actius de marca', es: 'Activos de marca', en: 'Brand assets', fr: 'Éléments de marque' },
  'assets.note': {
    ca: 'Lliures per a ús editorial. No en canviïs els colors ni les proporcions.',
    es: 'Libres para uso editorial. No cambies sus colores ni sus proporciones.',
    en: 'Free for editorial use. Do not alter their colours or proportions.',
    fr: 'Libres pour un usage éditorial. Ne modifiez ni leurs couleurs ni leurs proportions.',
  },
  'assets.logo': { ca: 'Logotip complet', es: 'Logotipo completo', en: 'Full logo', fr: 'Logo complet' },
  'assets.mark': { ca: 'Marca sola', es: 'Marca sola', en: 'Logo mark', fr: 'Symbole seul' },
  'assets.markMono': { ca: 'Marca monocroma', es: 'Marca monocroma', en: 'Monochrome logo mark', fr: 'Symbole monochrome' },
  'assets.daylight': {
    ca: 'Logotip per a fons clar',
    es: 'Logotipo para fondo claro',
    en: 'Logo for light backgrounds',
    fr: 'Logo pour fonds clairs',
  },
  'assets.og': {
    ca: 'Imatge social (1200 × 630)',
    es: 'Imagen social (1200 × 630)',
    en: 'Social image (1200 × 630)',
    fr: 'Image pour les réseaux sociaux (1200 × 630)',
  },

  /* --- contacte ---------------------------------------------------------------
   * Acaba en dos punts perquè al darrere hi van els dos enllaços d'autor.      */
  'contact.lead': {
    ca: 'Per a entrevistes o dades del vostre punt concret, escriviu als autors:',
    es: 'Para entrevistas o datos de vuestro punto concreto, escribid a los autores:',
    en: 'For interviews or data about a specific location, contact the authors:',
    fr: 'Pour une interview ou des données sur un lieu précis, contactez les auteurs :',
  },
  'contact.and': { ca: 'i', es: 'y', en: 'and', fr: 'et' },
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
 * D'ON SURT CADA COSA JA NO S'ESCRIU AQUÍ.
 *
 * Hi va viure `ABOUT_SOURCES`, una CÒPIA DELIBERADA de la llista del peu, amb
 * la nota al costat que era candidata a morir el dia que hi hagués cablatge.
 * La còpia va fer el que fan les còpies: el 3 d'agost de 2026 van entrar dues
 * fonts noves —els miradors i cims d'OpenStreetMap, i la llicència CC BY
 * d'Open-Meteo— i cap de les dues llistes ho deia. Com que l'ODbL i la CC BY
 * són obligacions de llicència i no cortesies, la còpia no era un deute
 * d'ordre: era un incompliment amb la dada ja pintada al mapa.
 *
 * La llista canònica és `./credits.ts` i la pàgina la llegeix d'allà.
 * ------------------------------------------------------------------------- */

/**
 * Qui ho signa, per al bloc de contacte de premsa. Els dos al mateix nivell,
 * com al peu: la persona al seu perfil i el despatx al seu domini.
 *
 * SEGUEIX SENT UNA CÒPIA de la del peu, i aquesta sí que s'hi queda de moment:
 * una autoria no és cap font de dades ni porta cap llicència al darrere, i el
 * dia que els dos noms divergeixin no s'incompleix res —es veu de seguida i es
 * corregeix. La llista de FONTS era una altra cosa i per això ha marxat a
 * `./credits.ts`.
 */
export interface AboutAuthor {
  name: string;
  url: string;
}

export const ABOUT_AUTHORS: AboutAuthor[] = [
  { name: 'Humbert Blanco', url: 'https://x.com/humbertblanco' },
  {
    name: 'Damos en el Blanco',
    url: 'https://damosenelblanco.com/?utm_source=eclipsi.info&utm_medium=referral&utm_campaign=credits',
  },
];
