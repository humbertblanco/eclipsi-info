/**
 * L'INVENTARI DE FONTS. Una sola llista, i tot el que la pinta la llegeix
 * d'aquí.
 *
 * PER QUÈ EXISTEIX AQUEST FITXER I PER QUÈ ÉS AQUÍ.
 *
 * La llista canònica vivia dins de `screens/SiteFooter.tsx` i «Com funciona»
 * en tenia una CÒPIA DELIBERADA (`ABOUT_SOURCES`, amb la nota escrita al
 * costat que aquella constant era candidata a morir). La còpia va fer
 * exactament el que fan les còpies: el 3 d'agost de 2026 l'app va guanyar dues
 * fonts de dades noves —els miradors i cims d'OpenStreetMap i els punts
 * d'observació de vuit administracions— i cap de les dues llistes ho deia. Les
 * fonts noves no eren cap cortesia pendent: l'ODbL d'OpenStreetMap i la CC BY
 * d'Open-Meteo són OBLIGACIONS de llicència, i s'incomplien mentre la dada ja
 * es pintava al mapa.
 *
 * Ara la llista és una i viu al costat de la pàgina que té per feina
 * publicar-la. El peu (`screens/SiteFooter.tsx`) la reexporta perquè el diàleg
 * de crèdits del mapa la importa d'allà des de sempre i no calia moure-li res:
 * l'única cosa que canvia de lloc és on s'escriu, no d'on es llegeix.
 *
 * ── LES DUES REGLES QUE FAN QUE NO ES TORNI A OBRIR EL FORAT ────────────────
 *
 * 1. `licence` i `hosts` són OBLIGATORIS, no opcionals. No és estil: és una
 *    comporta de compilació. Qui afegeixi una font ha de decidir sota quina
 *    llicència va (i `null` vol dir «cap llicència d'atribució», amb el motiu
 *    escrit a la fila) i de quins amfitrions baixa. Amb el camp opcional,
 *    afegir una fila incompleta compila; amb el camp obligatori, no.
 * 2. `hosts` és el que tanca l'inventari. `tests/credits-de-les-fonts.test.ts`
 *    recorre el codi que es publica i els generadors de `scripts/` buscant
 *    amfitrions externs dins del CODI (no dels comentaris) i exigeix que
 *    cadascun sigui d'alguna fila d'aquí o d'una llista declarada de coses que
 *    no són fonts. La pròxima font que s'afegeixi portarà un amfitrió nou —el
 *    seu servidor si es demana en execució, el seu Overpass o el seu portal si
 *    es cou en compilació— i la prova la trobarà tota sola, sense que ningú
 *    se'n recordi tres mesos després.
 *
 * ── PER QUÈ AQUEST FITXER NO IMPORTA RES DE `core` ──────────────────────────
 *
 * Perquè el peu el munta l'estructura de l'app i per tant aquesta llista és al
 * PAQUET D'ARRENCADA. `OSM_COPYRIGHT_URL` viu a `core/places/viewpoints.ts`, que
 * importa `core/eclipses/path.ts` per retallar els miradors a la franja: importar
 * la constant hauria arrossegat els elements besselians sencers a la primera
 * pintada per estalviar-se trenta-nou caràcters. L'adreça s'escriu aquí i és
 * `tests/credits-de-les-fonts.test.ts` qui exigeix que sigui la MATEIXA cadena
 * que `OSM_COPYRIGHT_URL` i que `PLACES_ATTRIBUTION_URL`. No és cap excepció a
 * la regla de no duplicar: és el mateix criteri que ja fa servir
 * `offline/basemap-agreement.test.ts` amb la URL de les tessel·les, on dos
 * mòduls que no s'han d'importar entre ells declaren la mateixa cadena i és una
 * prova qui els lliga.
 *
 * ELS PUNTS D'OBSERVACIÓ OFICIALS NO SÓN UNA FILA D'AQUÍ, i és a posta: són
 * vuit administracions i la llista CANVIA per eclipsi (vuit el 2026, cap el
 * 2027 ni el 2028). Una constant estàtica hi mentiria dues vegades de tres.
 * Els llista `ObservationSources.tsx` a partir d'`observationSourcesFor()`, que
 * els deriva del catàleg mateix i per tant no es pot quedar enrere.
 */

import type { Locale } from '../../i18n';

/**
 * On es llegeixen les condicions de l'ODbL.
 *
 * Cadena literal a posta (vegeu la capçalera): ha de ser idèntica a
 * `OSM_COPYRIGHT_URL` de `core/places/viewpoints.ts` i a `PLACES_ATTRIBUTION_URL`
 * de `core/places/photon.ts`, i qui ho vigila és la prova dels crèdits.
 */
const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

/**
 * Una font de dades, tal com s'ha d'ensenyar.
 *
 * `what` és per a l'usuari («Meteorologia») i es tradueix; `who` i `licence`
 * NO es tradueixen mai, perquè el nom del proveïdor i el de la llicència són
 * justament la part que ha de sobreviure sencera perquè l'atribució serveixi
 * de res.
 */
export interface Credit {
  /** Què n'obtenim, en la llengua de qui llegeix. */
  what: Record<Locale, string>;
  /**
   * Qui la fa. Nom propi, mai traduït.
   *
   * ÉS TAMBÉ LA IDENTITAT DE LA FILA: és el que fan servir de clau de React les
   * dues llistes que la pinten. L'`url` no pot fer-ho —les dues files d'OSM
   * apunten totes dues a la pàgina de la llicència, perquè és on són les
   * condicions de totes dues—, i que dues germanes comparteixin clau és de les
   * poques maneres que React té de pintar malament sense petar. Ho vigila
   * `tests/credits-de-les-fonts.test.ts`.
   */
  who: string;
  /** On es pot anar a comprovar, i on hi ha les condicions. */
  url: string;
  /**
   * El nom públic de la llicència, tal com s'ha d'ensenyar («ODbL 1.0»,
   * «CC BY 4.0»).
   *
   * `null` vol dir que aquesta font NO imposa cap llicència d'atribució, i
   * cada `null` d'aquesta llista porta el motiu escrit al seu costat. No vol
   * dir mai «no ho hem mirat»: si no s'ha mirat, no es posa la fila.
   */
  licence: string | null;
  /**
   * Els amfitrions que aquesta font ocupa dins del codi: tant d'on se'n baixen
   * bytes com les pàgines que el contingut hi enllaça.
   *
   * `[]` vol dir que la dada no travessa la xarxa —va dins del paquet— i és
   * una resposta perfectament vàlida. El que no és vàlid és un amfitrió al
   * codi que no surti de cap fila.
   */
  hosts: readonly string[];
}

/**
 * D'on surt cada cosa.
 *
 * L'ORDRE ÉS EL DE LA IMPORTÀNCIA PER A L'USUARI, no l'alfabètic: primer el
 * que decideix les xifres, després el que decideix el que veu.
 */
export const CREDITS: readonly Credit[] = [
  {
    what: { ca: 'Efemèrides', es: 'Efemérides' },
    who: 'astronomy-engine',
    url: 'https://github.com/cosinekitty/astronomy',
    /*
     * MIT. És una dependència que va compilada dins del paquet: no se'n baixa
     * cap dada en execució. L'únic amfitrió que ocupa és la seva pàgina, la que
     * enllaça aquesta fila mateixa.
     */
    licence: 'MIT',
    hosts: ['github.com'],
  },
  {
    what: { ca: 'Trajectòria de l’ombra', es: 'Trayectoria de la sombra' },
    who: 'Fred Espenak, NASA/GSFC',
    url: 'https://eclipse.gsfc.nasa.gov/',
    /*
     * Sense llicència d'atribució: el que demana l'autor és una LÍNIA DE
     * CRÈDIT literal, i la porta el mapa dins del llenç
     * (`ESPENAK_ATTRIBUTION`, `core/eclipses/path.ts`). Posar-hi un nom de
     * llicència que no existeix seria inventar-se una condició.
     */
    licence: null,
    hosts: ['eclipse.gsfc.nasa.gov', 'umbra.nascom.nasa.gov'],
  },
  {
    what: { ca: 'Contrast de les prediccions', es: 'Contraste de las predicciones' },
    who: 'IGN',
    url: 'https://eclipses.ign.es/',
    /*
     * Sense llicència perquè no en redistribuïm cap dada: les seves taules són
     * el CONTRAST contra el qual es validen els nostres càlculs (els daurats
     * de `tests/golden/`, 39 municipis). El crèdit hi és perquè una app que et
     * diu quan et pots treure el filtre ha de poder dir contra què s'ha
     * comprovat — no perquè cap llicència ho exigeixi.
     */
    licence: null,
    hosts: ['eclipses.ign.es'],
  },
  {
    what: { ca: 'Model del terreny', es: 'Modelo del terreno' },
    who: 'AWS Terrain Tiles',
    url: 'https://registry.opendata.aws/terrain-tiles/',
    /*
     * El conjunt és un agregat de fonts públiques (SRTM, NED, EU-DEM…) amb les
     * seves pròpies condicions, llistades a la pàgina del registre. Cap
     * etiqueta única no el descriuria honestament, i per això l'enllaç ÉS la
     * resposta.
     */
    licence: null,
    hosts: ['s3.amazonaws.com', 'registry.opendata.aws'],
  },
  {
    what: { ca: 'Cartografia i topònims', es: 'Cartografía y topónimos' },
    who: 'OpenStreetMap · Photon · CARTO',
    url: OSM_COPYRIGHT_URL,
    /*
     * ODbL: OBLIGACIÓ, no cortesia. Les tessel·les de CARTO i els topònims de
     * Photon són tots dos derivats d'OpenStreetMap, i per això van a la
     * mateixa fila amb la mateixa llicència.
     */
    licence: 'ODbL 1.0',
    hosts: ['tile.openstreetmap.org', 'basemaps.cartocdn.com', 'photon.komoot.io', 'www.openstreetmap.org'],
  },
  {
    /*
     * LA FILA QUE FALTAVA (3-8-2026). Els miradors i cims són una EXTRACCIÓ
     * d'OpenStreetMap que publiquem nosaltres a `public/data/`, no unes
     * tessel·les que ens serveixi ningú: l'obligació de l'ODbL és aquí més
     * forta que a la cartografia, perquè el que redistribuïm és la base de
     * dades, i tot i així era l'única de les dues que no sortia enlloc. La
     * dada la pintava el mapa des del primer dia.
     */
    what: { ca: 'Miradors i cims', es: 'Miradores y cimas' },
    who: 'col·laboradors d’OpenStreetMap',
    url: OSM_COPYRIGHT_URL,
    licence: 'ODbL 1.0',
    /*
     * En execució no es demana res: el catàleg es cou en compilació i viatja
     * amb l'app. Els amfitrions són els de l'extracció, `scripts/build-viewpoints.ts`
     * —les dues rèpliques d'Overpass, la del recanvi inclosa—, i hi són
     * declarats perquè una dada que entra al producte per la porta de la
     * compilació no deixa de ser una dada del producte.
     */
    hosts: ['www.openstreetmap.org', 'overpass-api.de', 'overpass.openstreetmap.fr'],
  },
  {
    what: { ca: 'Meteorologia', es: 'Meteorología' },
    who: 'Open-Meteo',
    url: 'https://open-meteo.com/',
    /*
     * LA LLICÈNCIA QUE FALTAVA DIR (3-8-2026). La fila hi era des del principi
     * i no deia «CC BY 4.0» enlloc, que és justament la condició amb què podem
     * fer servir la dada. `OPEN_METEO_ATTRIBUTION` (`core/weather/openMeteo.ts`)
     * sí que la deia, i el panell de núvols la pinta; els crèdits, no.
     *
     * Els dos amfitrions són les dues API que el mòdul distingeix i que no es
     * poden confondre: previsió (fins a 16 dies) i reanàlisi ERA5 (des de 1940).
     */
    licence: 'CC BY 4.0',
    hosts: ['api.open-meteo.com', 'archive-api.open-meteo.com', 'open-meteo.com'],
  },
  {
    what: { ca: 'Seguretat ocular', es: 'Seguridad ocular' },
    who: 'AAS · ISO 12312-2',
    url: 'https://eclipse.aas.org/eye-safety',
    /*
     * Una norma i les recomanacions d'una societat astronòmica: no és una dada
     * amb llicència, és el criteri amb què està escrita la comporta de
     * `core/timer/safety.ts`.
     */
    licence: null,
    hosts: ['eclipse.aas.org', 'www.iso.org'],
  },
];

/**
 * La frase de privadesa i el títol de les fonts.
 *
 * Viuen aquí i no a la pantalla que els pinta pel mateix motiu que `CREDITS`:
 * el peu, «Com funciona» i el diàleg del mapa han de dir LA MATEIXA frase, no
 * tres frases bessones que un dia divergeixen.
 */
/**
 * LA FRASE DE PRIVADESA, I PER QUÈ VA CANVIAR.
 *
 * Deia «Els càlculs es fan al teu dispositiu. La teva ubicació no surt d'aquí»
 * i LA SEGONA MEITAT ERA FALSA. L'app envia les coordenades a dos serveis
 * sense cap gest addicional: a Photon (OSM) per posar nom al punt —amb cinc
 * decimals, un metre— i a Open-Meteo per la previsió de núvols. I les
 * tessel·les de relleu de zoom 12 situen el punt a uns trenta metres. Aquest
 * mateix fitxer declara els tres amfitrions a `CREDITS`: la contradicció cabia
 * en una pantalla de l'editor, i qualsevol podia desmentir la frase amb les
 * eines de desenvolupament obertes en deu segons.
 *
 * Era la frase que signa el peu de TOTES les pantalles i la que l'usuari va
 * demanar explícitament. En un producte que té la porta de privadesa de
 * l'analítica escrita com a codi provat (`core/analytics/sanitize.ts`), no es
 * pot prometre de paraula una cosa més forta del que el codi garanteix.
 *
 * El que ara diu és el que de debò passa, i segueix sent una bona notícia: el
 * CÀLCUL no surt —cap servidor no et calcula res— i les coordenades només van
 * als dos serveis nominats, no es desen enlloc i no arriben mai a l'analítica.
 */
export const PRIVACY_NOTE: Record<Locale, string> = {
  ca: 'Els càlculs es fan al teu dispositiu: cap servidor no els fa per tu. Les coordenades només surten per posar nom al lloc i per la previsió, i no arriben mai a l’analítica.',
  es: 'Los cálculos se hacen en tu dispositivo: ningún servidor los hace por ti. Las coordenadas solo salen para poner nombre al lugar y para la previsión, y nunca llegan a la analítica.',
};

export const SOURCES_HEADING: Record<Locale, string> = {
  ca: 'D’on surten les dades',
  es: 'De dónde salen los datos',
};

/**
 * Capçalera del bloc dels punts d'observació oficials i la frase que l'explica.
 *
 * Van amb els crèdits i no amb els textos de «Com funciona» perquè les dues
 * pantalles que llisten els punts —la pàgina i el diàleg del mapa— han de dir
 * el mateix, i el diàleg del mapa no llegeix els textos de `features/about`.
 */
export const OBSERVATION_SOURCES_HEADING: Record<Locale, string> = {
  ca: 'Qui publica els punts oficials',
  es: 'Quién publica los puntos oficiales',
};

export const OBSERVATION_SOURCES_NOTE: Record<Locale, string> = {
  ca: 'Els recintes habilitats no els posem nosaltres: cada punt és d’una administració, i aquí hi ha totes les que n’han publicat per a aquest eclipsi.',
  es: 'Los recintos habilitados no los ponemos nosotros: cada punto es de una administración, y aquí están todas las que han publicado alguno para este eclipse.',
};
