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

type Entry = { ca: string; es: string };

const STRINGS = {
  /* --- insígnia de connexió ---------------------------------------------
   * En majúscules d'overline via CSS. «desat» i no «llest»: la insígnia no
   * pot saber si hi ha CAP punt preparat, només si l'esquelet de l'app
   * respondrà sense xarxa.                                                  */
  'badge.online': { ca: 'En línia', es: 'En línea' },
  'badge.offlineSaved': { ca: 'Sense xarxa · desat', es: 'Sin red · guardado' },
  'badge.offlineUnsaved': { ca: 'Sense xarxa · no desat', es: 'Sin red · no guardado' },

  /* --- avís de versió nova ----------------------------------------------- */
  'update.ready': {
    ca: 'Hi ha una versió nova de l’app, ja baixada.',
    es: 'Hay una versión nueva de la app, ya descargada.',
  },
  'update.later': { ca: 'Ara no', es: 'Ahora no' },
  'update.apply': { ca: 'Actualitza', es: 'Actualiza' },

  /* --- panell: capçalera i pla ------------------------------------------- */
  'panel.title': { ca: 'Preparar per anar-hi', es: 'Preparar para ir' },
  'panel.lede': {
    ca: 'El dia de l’eclipsi la xarxa mòbil estarà saturada. Baixa ara el terreny, el mapa i els càlculs del punt on aniràs: després l’app funciona sencera sense connexió.',
    es: 'El día del eclipse la red móvil estará saturada. Descarga ahora el terreno, el mapa y los cálculos del punto al que irás: después la app funciona entera sin conexión.',
  },
  'panel.needPoint': {
    ca: 'Tria un punt al mapa o localitza’t per poder preparar-lo.',
    es: 'Elige un punto en el mapa o localízate para poder prepararlo.',
  },
  'figures.point': { ca: 'Punt', es: 'Punto' },
  'figures.tiles': { ca: 'Tessel·les', es: 'Teselas' },
  'figures.weight': { ca: 'Pes estimat', es: 'Peso estimado' },
  'figures.range': { ca: 'Radi del relleu', es: 'Radio del relieve' },

  /* --- progrés ------------------------------------------------------------
   * Les frases de fase es componen AQUÍ i no a `prepare.ts`: el motor no sap
   * l'idioma de la interfície i no l'ha de saber.                           */
  'progress.label': { ca: 'Progrés de la preparació', es: 'Progreso de la preparación' },
  'progress.keepOpen': {
    ca: 'Deixa l’app oberta i la pantalla encesa.',
    es: 'Deja la app abierta y la pantalla encendida.',
  },
  'progress.stop': { ca: 'Atura', es: 'Detén' },
  'phase.inici': {
    ca: 'Preparant la llista del que cal baixar…',
    es: 'Preparando la lista de lo que hay que descargar…',
  },
  'phase.relleu': { ca: 'Baixant el relleu…', es: 'Descargando el relieve…' },
  'phase.mapa': { ca: 'Baixant el mapa…', es: 'Descargando el mapa…' },
  'phase.calcul': { ca: 'Calculant l’horitzó…', es: 'Calculando el horizonte…' },
  'phase.desat': { ca: 'Desant els càlculs…', es: 'Guardando los cálculos…' },
  'phase.fet': { ca: 'Llest per anar-hi', es: 'Listo para ir' },

  /* --- accions i resultat ------------------------------------------------- */
  'action.prepare': { ca: 'Prepara’m per anar-hi', es: 'Prepárame para ir' },
  'action.again': { ca: 'Torna a preparar aquest punt', es: 'Vuelve a preparar este punto' },
  'note.offline': {
    ca: 'Sense xarxa no es pot baixar res. El que ja tinguis desat segueix disponible.',
    es: 'Sin red no se puede descargar nada. Lo que ya tengas guardado sigue disponible.',
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
  },
  'error.horizonTiles': {
    ca: 'El terreny ha baixat a mitges i amb un horitzó incomplet el resultat no seria de fiar. Comprova la connexió i torna-ho a provar.',
    es: 'El terreno se ha descargado a medias y con un horizonte incompleto el resultado no sería fiable. Comprueba la conexión y vuelve a intentarlo.',
  },
  'error.horizon': {
    ca: 'El terreny s’ha desat, però no s’ha pogut calcular l’horitzó d’aquest punt.',
    es: 'El terreno se ha guardado, pero no se ha podido calcular el horizonte de este punto.',
  },
  'error.unknown': {
    ca: 'No s’ha pogut completar la preparació.',
    es: 'No se ha podido completar la preparación.',
  },
  'note.done': { ca: 'Punt preparat. {bytes} desats.', es: 'Punto preparado. {bytes} guardados.' },
  'note.doneFailed': {
    ca: 'Punt preparat. {bytes} desats, amb {n} tessel·les que no han baixat.',
    es: 'Punto preparado. {bytes} guardados, con {n} teselas que no se han descargado.',
  },
  'note.already': {
    ca: 'Aquest punt ja el tens preparat: {date}, {bytes} desats.',
    es: 'Este punto ya lo tienes preparado: {date}, {bytes} guardados.',
  },

  /* --- inventari ----------------------------------------------------------- */
  'saved.title': { ca: 'Desat al telèfon', es: 'Guardado en el teléfono' },
  'saved.loading': { ca: 'Consultant què hi ha desat…', es: 'Consultando qué hay guardado…' },
  'saved.empty': {
    ca: 'Encara no has preparat cap punt.',
    es: 'Todavía no has preparado ningún punto.',
  },
  'saved.tiles': { ca: 'tessel·les', es: 'teselas' },
  'saved.holes': {
    ca: '{n} tessel·les no baixades: l’horitzó pot tenir forats.',
    es: '{n} teselas sin descargar: el horizonte puede tener huecos.',
  },
  'saved.expiry': {
    ca: 'Fa {n} dies que és desat i l’app no està instal·lada: el navegador el pot esborrar.',
    es: 'Hace {n} días que está guardado y la app no está instalada: el navegador lo puede borrar.',
  },
  'saved.remove': { ca: 'Treu', es: 'Quita' },
  'saved.removeLabel': { ca: 'Treu {label} de la llista', es: 'Quita {label} de la lista' },
  'figures.terrain': { ca: 'Relleu desat', es: 'Relieve guardado' },
  'figures.basemap': { ca: 'Mapa desat', es: 'Mapa guardado' },
  'figures.used': { ca: 'Espai ocupat', es: 'Espacio ocupado' },
  'figures.free': { ca: 'Espai disponible', es: 'Espacio disponible' },
  'saved.clear': {
    ca: 'Allibera l’espai de les tessel·les',
    es: 'Libera el espacio de las teselas',
  },

  /* --- instal·lació i limitacions ------------------------------------------ */
  'install.title': { ca: 'Instal·la l’app', es: 'Instala la app' },
  'limits.title': { ca: 'Què pot fallar', es: 'Qué puede fallar' },
  'limits.immutable': {
    ca: 'El relleu i el mapa es desen tal com són avui. No canvien mai, per això es guarden un any sense tornar-los a demanar.',
    es: 'El relieve y el mapa se guardan tal como son hoy. No cambian nunca, por eso se guardan un año sin volver a pedirlos.',
  },
  'limits.iosSevenDays': {
    ca: 'A l’iPhone, si l’app no està instal·lada a la pantalla d’inici, el sistema pot esborrar tot el que hi ha desat després de set dies sense obrir-la.',
    es: 'En el iPhone, si la app no está instalada en la pantalla de inicio, el sistema puede borrar todo lo guardado tras siete días sin abrirla.',
  },
  'limits.foreground': {
    ca: 'La baixada només avança amb l’app en primer pla: iOS congela les pestanyes de fons i no hi ha manera de continuar en segon terme.',
    es: 'La descarga solo avanza con la app en primer plano: iOS congela las pestañas de fondo y no hay manera de continuar en segundo plano.',
  },
  'limits.eviction': {
    ca: 'Si el telèfon va just d’espai, el navegador pot alliberar aquestes dades sense avisar. Comprova aquesta pantalla abans de sortir.',
    es: 'Si el teléfono va justo de espacio, el navegador puede liberar estos datos sin avisar. Comprueba esta pantalla antes de salir.',
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
