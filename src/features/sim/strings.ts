/**
 * Textos de la pantalla de simulació —el càlcul de l'horitzó i la línia de
 * temps—, en català i castellà.
 *
 * PER QUÈ EXISTEIX: el progrés («Baixant el relleu…», «Traçant l'horitzó…»)
 * naixia com a frase en català dins de `core/horizon/raycast.ts` i pujava
 * fins a la pantalla tal qual: l'usuari amb l'app en castellà veia el càlcul
 * parlar-li en català. Ara el nucli emet CODIS (`HorizonProgressStatus`) i
 * les paraules es posen aquí, que és territori de pantalla i sap l'idioma.
 * El rellotge de simulació (`core/timeline`) segueix exactament la mateixa
 * regla i per això comparteix fitxer: cap dels dos mòduls purs sap parlar.
 *
 * ELS ERRORS HAN FET EL MATEIX CAMÍ, I MÉS TARD DEL QUE TOCAVA. El progrés ja
 * eren codis mentre la fallada seguia sent prosa catalana («Només s'han pogut
 * baixar 3 de 150 tessel·les…»), o sigui que l'app parlava castellà fins al
 * moment exacte en què s'espatllava. Ara la fallada també és un codi
 * (`core/horizon/errors.ts`) i la frase surt d'aquí: vegeu
 * `horizonFailureText`.
 *
 * PER QUÈ NO VAN A `src/i18n/*.json`: mateix motiu que
 * `features/weather/strings.ts`, que és el model d'aquest fitxer — les taules
 * `{ ca, es }` dins del mòdul són el patró de tota l'app, i el dia que
 * l'i18n es consolidi s'aboquen als JSON tal com estan.
 *
 * TO: pla, curt, de tu. Els parèntesis amb xifres van en mono a la pantalla
 * i no es tradueixen: són la dada.
 */

import type { ContactId } from '../../core/timeline';
import type { Locale } from '../../i18n';
import type { HorizonFailureCode, HorizonProgressCode } from './useHorizon';
import type { HorizonFailure } from '../../core/horizon/errors';

type Entry = { ca: string; es: string; en: string };

const STRINGS = {
  /* Un codi d'estat per clau: `progress.<stage>`. */
  'progress.tiles': {
    ca: 'Baixant el relleu ({done} de {total} tessel·les)',
    es: 'Descargando el relieve ({done} de {total} teselas)',
    en: 'Downloading terrain ({done} of {total} tiles)',
  },
  'progress.trace': {
    ca: 'Traçant l’horitzó ({pct} %)',
    es: 'Trazando el horizonte ({pct} %)',
    en: 'Tracing the horizon ({pct}%)',
  },
  'progress.done': { ca: 'Horitzó llest', es: 'Horizonte listo', en: 'Horizon ready' },
  'progress.cache': {
    ca: 'Horitzó recuperat de la memòria',
    es: 'Horizonte recuperado de la memoria',
    en: 'Horizon restored from memory',
  },
  'progress.preparing': {
    ca: 'Preparant el càlcul de l’horitzó…',
    es: 'Preparando el cálculo del horizonte…',
    en: 'Preparing horizon calculation…',
  },

  /* --- la fallada, una clau per codi -------------------------------------
   *
   * TO: QUÈ ha passat, QUÈ VOL DIR i QUÈ POTS FER, en aquest ordre. Cap
   * «error», cap codi tècnic i cap culpa a l'usuari. La versió amb xifres
   * existeix perquè «3 de 150» és el que fa entendre de cop que el problema és
   * la connexió i no l'app; quan les xifres no arriben —el camí que passa pel
   * Worker, que encara no les envia— es diu el mateix sense elles.
   *
   * LA CLÀUSULA DEL MIG NO ES POT TREURE. Sense perfil del terreny no hi ha
   * veredicte (`App.tsx` el deixa a `null` a posta) i el que es veu és la
   * durada TEÒRICA, amb horitzó pla: optimista. Dir-ho és la mateixa regla que
   * fa que `MIN_TILE_COVERAGE` existeixi. S'escriu amb les mateixes paraules
   * que `sim.terrainPending` de `screens/strings.ts` perquè la mateixa
   * situació, dita en dos llocs, no soni a dos problemes diferents.
   *
   * LA FRASE NO PROMET RES. «Un horitzó a mitges no és de fiar» és el
   * raonament de `MIN_TILE_COVERAGE`, dit a l'usuari: val més no donar
   * veredicte que donar-ne un d'optimista i fals.                            */
  'failed.tilesIncomplete': {
    ca: 'Falta relleu per baixar ({loaded} de {total} tessel·les) i un horitzó a mitges no és de fiar. Sense el perfil del terreny, la durada que es mostra és la teòrica, amb horitzó pla. Comprova la connexió.',
    es: 'Falta relieve por descargar ({loaded} de {total} teselas) y un horizonte a medias no es fiable. Sin el perfil del terreno, la duración que se muestra es la teórica, con horizonte plano. Comprueba la conexión.',
    en: 'Some terrain is still missing ({loaded} of {total} tiles), and a partial horizon is not reliable. Without the terrain profile, the duration shown is theoretical and assumes a flat horizon. Check your connection.',
  },
  'failed.tilesIncompleteBare': {
    ca: 'Falta relleu per baixar i un horitzó a mitges no és de fiar. Sense el perfil del terreny, la durada que es mostra és la teòrica, amb horitzó pla. Comprova la connexió.',
    es: 'Falta relieve por descargar y un horizonte a medias no es fiable. Sin el perfil del terreno, la duración que se muestra es la teórica, con horizonte plano. Comprueba la conexión.',
    en: 'Some terrain is still missing, and a partial horizon is not reliable. Without the terrain profile, the duration shown is theoretical and assumes a flat horizon. Check your connection.',
  },
  'failed.noTerrain': {
    ca: 'No ha arribat cap tessel·la del terreny. Sense el perfil del terreny, la durada que es mostra és la teòrica, amb horitzó pla. Comprova la connexió.',
    es: 'No ha llegado ninguna tesela del terreno. Sin el perfil del terreno, la duración que se muestra es la teórica, con horizonte plano. Comprueba la conexión.',
    en: 'No terrain tiles were received. Without the terrain profile, the duration shown is theoretical and assumes a flat horizon. Check your connection.',
  },
  'failed.worker': {
    ca: 'El càlcul de l’horitzó s’ha aturat sol. Sense el perfil del terreny, la durada que es mostra és la teòrica, amb horitzó pla. Torna-ho a provar; si es repeteix, tanca i torna a obrir l’app.',
    es: 'El cálculo del horizonte se ha parado solo. Sin el perfil del terreno, la duración que se muestra es la teórica, con horizonte plano. Vuelve a intentarlo; si se repite, cierra y vuelve a abrir la app.',
    en: 'The horizon calculation stopped unexpectedly. Without the terrain profile, the duration shown is theoretical and assumes a flat horizon. Try again; if it keeps happening, close and reopen the app.',
  },
  'failed.unknown': {
    ca: 'No s’ha pogut calcular l’horitzó d’aquest punt. Sense el perfil del terreny, la durada que es mostra és la teòrica, amb horitzó pla.',
    es: 'No se ha podido calcular el horizonte de este punto. Sin el perfil del terreno, la duración que se muestra es la teórica, con horizonte plano.',
    en: 'The horizon could not be calculated for this point. Without the terrain profile, the duration shown is theoretical and assumes a flat horizon.',
  },

  /* --- la línia de temps ------------------------------------------------
   *
   * LES DUES PRIMERES CLAUS SÓN LES IMPORTANTS. «Temps real» i «Simulació» han
   * de ser dues paraules que no es puguin confondre llegides de reüll, amb el
   * mòbil al sol i el pols accelerat. Per això no són «Directe»/«Assaig» ni
   * cap parell enginyós: són les dues paraules planes que diuen exactament
   * què és cada cosa. El dia de l'eclipsi, algú que cregui que mira el
   * rellotge de debò quan mira el simulador es pot treure el filtre solar dos
   * minuts abans d'hora.
   */
  'timeline.live': { ca: 'Temps real', es: 'Tiempo real', en: 'Real time' },
  'timeline.sim': { ca: 'Simulació', es: 'Simulación', en: 'Simulation' },
  'timeline.mode': { ca: 'Quin rellotge mires', es: 'Qué reloj miras', en: 'Which clock you are viewing' },
  /*
   * En temps real, la barra no pot dir on ets amb la seva posició: si l'eclipsi
   * és d'aquí a un any, el botó es queda clavat a C1 i sembla que l'estiguis
   * mirant. Per això la frase de sota diu SEMPRE en quin dels tres moments
   * som, i el dia bo n'hi ha una que només surt aquell dia.
   */
  'timeline.liveBefore': {
    ca: 'l’hora que és ara · l’eclipsi encara no ha començat',
    es: 'la hora que es ahora · el eclipse aún no ha empezado',
    en: 'the current time · the eclipse has not started yet',
  },
  'timeline.liveDuring': {
    ca: 'l’hora que és ara · l’eclipsi està passant',
    es: 'la hora que es ahora · el eclipse está pasando',
    en: 'the current time · the eclipse is happening now',
  },
  'timeline.liveAfter': {
    ca: 'l’hora que és ara · l’eclipsi ja s’ha acabat',
    es: 'la hora que es ahora · el eclipse ya ha terminado',
    en: 'the current time · the eclipse has ended',
  },
  /* Amb signe i unitats, perquè «Simulació» sigui comprovable i no una etiqueta. */
  'timeline.ahead': {
    ca: '{gap} per davant de l’hora real',
    es: '{gap} por delante de la hora real',
    en: '{gap} ahead of real time',
  },
  'timeline.behind': {
    ca: '{gap} enrere de l’hora real',
    es: '{gap} por detrás de la hora real',
    en: '{gap} behind real time',
  },
  'timeline.atNow': {
    ca: 'just a l’hora real, però simulada',
    es: 'justo a la hora real, pero simulada',
    en: 'exactly at the real time, but simulated',
  },

  'timeline.scrub': { ca: 'Instant de l’eclipsi', es: 'Instante del eclipse', en: 'Eclipse time' },
  'timeline.play': { ca: 'Reprodueix', es: 'Reproduce', en: 'Play' },
  'timeline.pause': { ca: 'Pausa', es: 'Pausa', en: 'Pause' },
  'timeline.back': { ca: 'Un minut enrere', es: 'Un minuto atrás', en: 'Back one minute' },
  'timeline.forward': { ca: 'Un minut endavant', es: 'Un minuto adelante', en: 'Forward one minute' },
  'timeline.rate': { ca: 'Velocitat', es: 'Velocidad', en: 'Speed' },

  'timeline.contacts': { ca: 'Salta a un contacte', es: 'Salta a un contacto', en: 'Jump to a contact' },
  'timeline.jump.c1': { ca: 'Salta al primer contacte', es: 'Salta al primer contacto', en: 'Jump to first contact' },
  'timeline.jump.c2': {
    ca: 'Salta a l’inici de la fase central',
    es: 'Salta al inicio de la fase central',
    en: 'Jump to the start of the central phase',
  },
  'timeline.jump.max': { ca: 'Salta al màxim', es: 'Salta al máximo', en: 'Jump to maximum eclipse' },
  'timeline.jump.c3': {
    ca: 'Salta al final de la fase central',
    es: 'Salta al final de la fase central',
    en: 'Jump to the end of the central phase',
  },
  'timeline.jump.c4': { ca: 'Salta a l’últim contacte', es: 'Salta al último contacto', en: 'Jump to last contact' },

  /* Xifres curtes per a les pastilles. «C1»…«C4» no es tradueixen: són
     nomenclatura astronòmica, igual a totes dues llengües i a totes les taules
     publicades. L'única que canvia és l'abreviatura de màxim. */
  'timeline.short.c1': { ca: 'C1', es: 'C1', en: 'C1' },
  'timeline.short.c2': { ca: 'C2', es: 'C2', en: 'C2' },
  'timeline.short.max': { ca: 'màx', es: 'máx', en: 'max' },
  'timeline.short.c3': { ca: 'C3', es: 'C3', en: 'C3' },
  'timeline.short.c4': { ca: 'C4', es: 'C4', en: 'C4' },
} as const satisfies Record<string, Entry>;

export type SimStringKey = keyof typeof STRINGS;

/**
 * Text d'una clau en l'idioma actiu. Mateixa signatura i mateixos marcadors
 * `{nom}` que `ws()` de `features/weather/strings.ts` i `ls()` de
 * `features/location/strings.ts`, perquè el dia que l'i18n es consolidi la
 * substitució sigui mecànica.
 */
export function hs(
  key: SimStringKey,
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

/**
 * Del codi de progrés a la frase, en un sol lloc.
 *
 * El `switch` és exhaustiu a posta: si algun dia el nucli o el hook
 * inventen un estat nou, TypeScript farà petar aquesta funció en compilar
 * en comptes de deixar que la pantalla ensenyi un forat.
 */
export function horizonProgressText(code: HorizonProgressCode, locale: Locale): string {
  switch (code.stage) {
    case 'tiles':
      return hs('progress.tiles', locale, { done: code.done ?? 0, total: code.total ?? 0 });
    case 'trace':
      return hs('progress.trace', locale, { pct: code.pct ?? 0 });
    case 'done':
      return hs('progress.done', locale);
    case 'cache':
      return hs('progress.cache', locale);
    case 'preparing':
      return hs('progress.preparing', locale);
  }
}

/**
 * De la fallada a la frase, en un sol lloc i amb `switch` exhaustiu.
 *
 * MATEIX CONTRACTE QUE EL PROGRÉS: si algun dia s'afegeix un codi a
 * `HorizonErrorCode`, això deixa de compilar i algú ha d'escriure les dues
 * frases. És l'única manera que tenim que el castellà no arribi tard.
 *
 * `cancelled` NO ES PINTA MAI i per això no té frase: qui cancel·la ja no vol
 * el resultat, i ensenyar-li un error seria acusar-lo d'una cosa que ha
 * demanat ell. Els hooks el filtren abans d'arribar aquí; si tot i així hi
 * arribés, val més la frase genèrica que un buit a la pantalla.
 */
export function horizonFailureText(
  failure: { code: HorizonFailureCode } & Omit<HorizonFailure, 'code'>,
  locale: Locale,
): string {
  switch (failure.code) {
    case 'tiles-incomplete':
      return failure.loaded === undefined || failure.total === undefined
        ? hs('failed.tilesIncompleteBare', locale)
        : hs('failed.tilesIncomplete', locale, {
            loaded: failure.loaded,
            total: failure.total,
          });
    case 'no-terrain':
      return hs('failed.noTerrain', locale);
    case 'worker':
      return hs('failed.worker', locale);
    case 'cancelled':
    case 'unknown':
      return hs('failed.unknown', locale);
  }
}

/* ------------------------------------------------------ la línia de temps --- */

/** Etiqueta curta de cada contacte, per a les pastilles de salt. */
const SHORT_KEY: Record<ContactId, SimStringKey> = {
  c1: 'timeline.short.c1',
  c2: 'timeline.short.c2',
  max: 'timeline.short.max',
  c3: 'timeline.short.c3',
  c4: 'timeline.short.c4',
};

/** Nom de l'acció de saltar-hi, en imperatiu, per al lector de pantalla. */
const JUMP_KEY: Record<ContactId, SimStringKey> = {
  c1: 'timeline.jump.c1',
  c2: 'timeline.jump.c2',
  max: 'timeline.jump.max',
  c3: 'timeline.jump.c3',
  c4: 'timeline.jump.c4',
};

export const contactShortLabel = (id: ContactId, locale: Locale): string =>
  hs(SHORT_KEY[id], locale);

export const contactJumpLabel = (id: ContactId, locale: Locale): string => hs(JUMP_KEY[id], locale);

/**
 * Per sota d'aquesta diferència es diu que la simulació és «just a l'hora
 * real», amb totes les lletres.
 *
 * MITJA MINUT I NO ZERO. Amb un llindar de zero, la frase de sota canviaria de
 * «10 s per davant» a «10 s enrere» passant per un instant, i el cas que
 * importa —que algú miri una simulació que ensenya gairebé l'hora que és i la
 * confongui amb el rellotge de debò— es quedaria sense frase pròpia. Trenta
 * segons és, a més, l'ordre de magnitud dels marges de seguretat del filtre
 * (`FILTER_ON_MARGIN_SEC`): per sota d'això les dues hores són indistingibles
 * a efectes pràctics i el que cal dir és justament que allò NO és el rellotge.
 */
export const NEAR_REAL_TIME_MS = 30_000;

/**
 * Una diferència de temps escrita curta: «45 s», «12 min», «3 h 12 min», «412 d».
 *
 * NO ES TRADUEIX perquè no hi ha res a traduir: «d», «h», «min» i «s» són
 * símbols del SI i s'escriuen igual en català i en castellà. La frase que
 * l'envolta sí que canvia, i és la que passa per la taula de dalt.
 *
 * A partir d'una hora es deixa de dir els segons, i a partir d'un dia els
 * minuts: qui mira un eclipsi d'aquí a un any no necessita saber que en falten
 * 412 dies, 3 hores i 47 minuts.
 */
export function formatTimeGap(ms: number): string {
  const total = Math.abs(ms);
  if (total < 60_000) return `${Math.round(total / 1000)} s`;

  const minutes = Math.round(total / 60_000);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0 ? `${days} d` : `${days} d ${restHours} h`;
}

/**
 * La frase que diu quant s'allunya del món l'instant que s'està mirant.
 *
 * És la peça que la competència no té: allà una línia de temps ensenya una
 * hora i prou, i el dia de l'eclipsi aquella hora i l'hora que és s'assemblen
 * massa. Aquí sempre hi ha una frase que ho desfà.
 */
export function timeGapText(offsetMs: number, locale: Locale): string {
  if (Math.abs(offsetMs) < NEAR_REAL_TIME_MS) return hs('timeline.atNow', locale);
  const gap = formatTimeGap(offsetMs);
  return hs(offsetMs > 0 ? 'timeline.ahead' : 'timeline.behind', locale, { gap });
}
