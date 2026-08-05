/**
 * Tipus de la previsió de nuvolositat.
 *
 * La nuvolositat és el factor que decideix de veritat si veuràs l'eclipsi.
 * L'astronomia és exacta al segon i no canvia mai; el cel del dia 12 a les
 * 20:30 no el sap ningú. Per això tot el que hi ha aquí porta sempre, dins del
 * mateix objecte, la data de la dada i el seu grau d'incertesa: qui pinti
 * aquests números no ha de poder ensenyar-los sense ensenyar què valen.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import type { GeoLocation } from '../astro/types';

/**
 * Els mateixos dos idiomes que `src/i18n`, sense dependre'n.
 *
 * El tipus s'escriu literal i no s'importa de `src/i18n` per la mateixa raó
 * que a `core/timer/types.ts` i a `core/astro/gradient.ts`: `src/i18n` és un
 * mòdul de React amb context i `import` de JSON, i aquest nucli ha de poder
 * córrer dins d'un Worker i a Node. Si algun dia divergeixen, divergeix una
 * unió de dues cadenes i el compilador ho dirà a tots els llocs alhora.
 */
export type WeatherLocale = 'ca' | 'es' | 'en' | 'fr';

/** Text que ha d'anar a la pantalla, en els dos idiomes. */
export interface LocalisedText {
  ca: string;
  es: string;
  en: string;
  fr: string;
}

/** Les tres capes de núvols que separa qualsevol model meteorològic. */
export type CloudLayerId = 'low' | 'mid' | 'high';

/** Semàntica de visibilitat del sistema de disseny. */
export type SkyBand = 'clear' | 'partial' | 'cloudy';

/**
 * D'on surt la dada. Són dues coses diferents i no s'han de barrejar mai:
 * una previsió diu què passarà, una climatologia diu què sol passar.
 */
export type OutlookMode = 'forecast' | 'climatology';

/** Quant te'n pots refiar. Es diu sempre, no s'amaga. */
export type Confidence = 'high' | 'medium' | 'low' | 'very-low';

/** Cobertura per capa, en tant per cent de 0 a 100. */
export interface CloudLayers {
  /** Núvols baixos: fins a 2 km. Estrats, estratocúmuls, boira. Opacs. */
  low: number;
  /** Núvols mitjans: de 2 a 6 km. Altostrats, altocúmuls. */
  mid: number;
  /** Núvols alts: per damunt de 6 km. Cirrus, cirrostrats. Translúcids. */
  high: number;
  /** Cobertura total que dona el model. Superposició aleatòria de les capes. */
  total: number;
}

/** Extinció per aerosols deduïda de la visibilitat meteorològica. */
export interface HazeEstimate {
  /** Visibilitat meteorològica horitzontal, en km. */
  visibilityKm: number;
  /** Massa d'aire recorreguda respecte del zenit. A 3° d'altura són ~19. */
  airmass: number;
  /** Gruix òptic dels aerosols al llarg de la línia de visió. */
  slantOpticalDepth: number;
  /** Fracció de llum directa que arriba, de 0 a 1. */
  transmission: number;
}

/**
 * Puntuació de visió del cel.
 *
 * `score` va de 0 a 100 i s'ha de llegir com "quina part de l'espectacle
 * t'arriba": 100 és cel net, 65 és un vel de cirrus sencer (encara veus la
 * corona), 3 és un estrat tancat (no veus res).
 */
export interface CloudScore {
  score: number;
  band: SkyBand;
  /** Part del bloqueig total que aporta cada capa, de 0 a 1. Sumen `blocked`. */
  attribution: Record<CloudLayerId, number>;
  /** Bloqueig total, de 0 a 1. `score = 100 · (1 − blocked)`. */
  blocked: number;
  /** Capa que més tapa. `null` si el cel és net. */
  dominant: CloudLayerId | null;
  /**
   * Cert si el model no ha donat les tres capes i hem hagut de puntuar amb la
   * cobertura total. La puntuació és molt més grollera.
   */
  fromTotalOnly: boolean;
}

/** Un punt mostrejat al llarg de la línia de visió cap al Sol. */
export interface LineOfSightPoint {
  lat: number;
  lon: number;
  /** Alçada sobre l'observador on la línia de visió travessa aquest punt, en m. */
  crossingHeightM: number;
  /** Distància sobre el terreny des de l'observador, en km. */
  groundDistanceKm: number;
  /** Capes que s'han de llegir en aquest punt. */
  layers: CloudLayerId[];
  /** Cert si s'ha hagut de retallar la distància al màxim permès. */
  truncated: boolean;
}

/** Com s'ha mostrejat el cel. */
export interface SamplingPlan {
  /** Altura aparent del Sol a l'instant consultat, en graus. */
  sunAltitudeDeg: number;
  /** Azimut del Sol, en graus des del nord cap a l'est. */
  sunAzimuthDeg: number;
  /**
   * Cert quan el Sol és prou baix perquè la línia de visió surti de la
   * vertical de l'observador i valgui la pena consultar punts a ponent.
   */
  slanted: boolean;
  /** Punts previstos. El primer és sempre l'observador. */
  points: LineOfSightPoint[];
  /** Distància del punt més llunyà, en km. */
  maxDistanceKm: number;
  /** Cert si algun punt ha topat amb el límit de distància. */
  truncated: boolean;
  /**
   * Cert si s'han consultat de veritat tots els punts. La climatologia només
   * consulta el punt de l'observador (quinze anys per set punts serien cent
   * peticions), però conserva la geometria per poder-la explicar.
   */
  lineOfSightUsed: boolean;
}

/** Base comuna de tots els resultats. */
interface OutlookBase {
  location: GeoLocation;
  /** Instant per al qual val la dada (màxim de l'eclipsi), en ms d'època. */
  targetTimeMs: number;
  /** Quan s'ha baixat la dada, en ms d'època. */
  fetchedAtMs: number;
  /** Cert si ve de la memòria cau perquè la xarxa ha fallat. */
  stale: boolean;
  layers: CloudLayers;
  score: CloudScore;
  sampling: SamplingPlan;
  confidence: Confidence;
  /** Frase curta que explica què val aquesta dada. Va a la interfície. */
  caveat: string;
}

/** Previsió de model numèric. Només té sentit a pocs dies vista. */
export interface ForecastOutlook extends OutlookBase {
  mode: 'forecast';
  /** Dies entre ara i l'instant previst. Determina la fiabilitat. */
  leadDays: number;
  /** Hora exacta a què correspon la dada (el model és horari). */
  validAtMs: number;
  /** Extinció per aerosols, si el model ha donat visibilitat. */
  haze: HazeEstimate | null;
}

/** Resum estadístic d'una sèrie de puntuacions històriques. */
export interface ClimatologyStats {
  meanScore: number;
  medianScore: number;
  /** Quartils: la meitat dels anys cau entre p25 i p75. */
  p25: number;
  p75: number;
  /** Fracció d'observacions amb cel net, de 0 a 1. */
  clearFraction: number;
  /** Fracció d'observacions amb cel tapat, de 0 a 1. */
  cloudyFraction: number;
  /** Anys d'arxiu que han donat dades. */
  years: number;
  /** Observacions horàries que han entrat a l'estadística. */
  sampleCount: number;
}

/** Climatologia d'arxiu. El que sol passar aquell dia en aquell lloc. */
export interface ClimatologyOutlook extends OutlookBase {
  mode: 'climatology';
  stats: ClimatologyStats;
  /** Primer i últim any de la sèrie, inclosos. */
  firstYear: number;
  lastYear: number;
  /** Dies a banda i banda de la data que entren a la finestra. */
  windowDays: number;
  haze: null;
}

export type CloudOutlook = ForecastOutlook | ClimatologyOutlook;

/** Petició a l'API pública del mòdul. */
export interface CloudOutlookRequest {
  location: GeoLocation;
  /** Instant del màxim de l'eclipsi, en ms d'època. */
  targetTimeMs: number;
  /** Azimut del Sol en aquell instant, en graus. */
  sunAzimuthDeg: number;
  /** Altura APARENT del Sol en aquell instant, en graus (amb refracció). */
  sunAltitudeDeg: number;
}

export interface CloudOutlookOptions {
  /** Per a proves: instant que es considera "ara". */
  nowMs?: number;
  /** Per a proves i per a Node: implementació de `fetch`. */
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  /** Salta la memòria cau i força una consulta nova. */
  forceRefresh?: boolean;
  /**
   * Idioma del `caveat`. Per defecte català, perquè és l'idioma per defecte de
   * l'app i perquè així qui ja cridava això no ha de canviar res.
   */
  locale?: WeatherLocale;
}

/**
 * Per què ha fallat, en un valor que es pot traduir.
 *
 * El `message` de l'error segueix sent català i és per al registre i per a qui
 * llegeixi la consola; el que es pinta a la pantalla surt de `CLOUD_ERROR_TEXT`
 * amb l'idioma actiu. Si es fes servir el `message` directament, un usuari en
 * castellà rebria una frase catalana just al moment en què l'app li ha fallat,
 * que és el pitjor moment per semblar una altra app.
 */
export type CloudErrorCode =
  /** Open-Meteo ha tornat menys punts dels demanats. */
  | 'partial-points'
  /** La graella horària no arriba a l'hora de l'eclipsi. */
  | 'no-hour'
  /** L'arxiu no ha donat prou anys per fer una climatologia honesta. */
  | 'not-enough-years'
  /** Qualsevol altra cosa: xarxa caiguda, JSON trencat, avortament. */
  | 'unknown';

/** El mateix error, dit a l'usuari. Sense culpar-lo i sense parlar d'HTTP. */
export const CLOUD_ERROR_TEXT: Record<CloudErrorCode, LocalisedText> = {
  'partial-points': {
    ca: 'La consulta del cel ha tornat incompleta. Torna-ho a provar.',
    es: 'La consulta del cielo ha vuelto incompleta. Vuelve a probarlo.', en: 'The cloud-data request returned an incomplete result. Try again.',
    fr: 'La requête sur le ciel a renvoyé un résultat incomplet. Réessayez.',
  },
  'no-hour': {
    ca: 'La previsió no arriba a l’hora de l’eclipsi.',
    es: 'La previsión no llega a la hora del eclipse.', en: 'The forecast does not extend to the time of the eclipse.',
    fr: 'La prévision ne couvre pas encore l’heure de l’éclipse.',
  },
  'not-enough-years': {
    ca: 'No hi ha prou anys d’arxiu en aquest punt per dir què hi sol fer.',
    es: 'No hay suficientes años de archivo en este punto para decir qué suele hacer.', en: 'There are not enough years of archive data at this location to establish the usual conditions.',
    fr: 'Il n’y a pas assez d’années d’archives à cet endroit pour établir les conditions habituelles.',
  },
  unknown: {
    ca: 'No s’ha pogut obtenir la nuvolositat.',
    es: 'No se ha podido obtener la nubosidad.', en: 'Cloud cover could not be obtained.',
    fr: 'La couverture nuageuse n’a pas pu être obtenue.',
  },
};

/** Error del mòdul amb prou context per pintar un missatge útil. */
export class CloudOutlookError extends Error {
  /** Per triar la frase que veurà l'usuari, en el seu idioma. */
  readonly code: CloudErrorCode;

  constructor(message: string, code: CloudErrorCode = 'unknown', cause?: unknown) {
    // `cause` per l'opció estàndard d'ES2022: així no trepitgem la propietat
    // de la classe base i la cadena d'errors original no es perd.
    super(message, { cause });
    this.name = 'CloudOutlookError';
    this.code = code;
  }
}
