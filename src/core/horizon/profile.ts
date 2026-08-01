/**
 * Perfil d'horitzó: l'altura aparent del terreny en cada azimut, vista des d'un
 * punt concret.
 *
 * És l'estructura central de l'aplicació. Amb el Sol a 3° d'altura, saber si
 * veuràs la totalitat és exactament la pregunta "què hi ha entre el Sol i jo en
 * aquell azimut, i fins a quina altura puja".
 *
 * Tot són números plans i arrays de números: l'objecte es pot passar per
 * `postMessage` (clonatge estructurat) i es pot desar tal qual a IndexedDB o
 * serialitzar a JSON sense cap transformació. Res de `Date`, `Map` ni classes.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

/**
 * Versió del format. Puja-la quan canviï el significat dels camps: la memòria
 * cau descarta tot el que no coincideixi, cosa que evita que un usuari es quedi
 * mesos amb perfils calculats amb una física antiga.
 *
 * v2: h0 passa a sortir del model del terreny i no de l'altitud que ens passin.
 * Els perfils v1 podien ser horitzons plans falsos de 10-15° si l'altitud que
 * havia arribat no quadrava amb el model, i s'han de llençar tots.
 */
export const HORIZON_PROFILE_VERSION = 2;

export interface HorizonProfile {
  version: number;
  /** Latitud del punt des d'on s'ha calculat, en graus. */
  lat: number;
  /** Longitud del punt des d'on s'ha calculat, en graus. */
  lon: number;
  /**
   * Origen vertical realment usat, en metres sobre el nivell del mar.
   * És `demElevation + heightAboveGroundM`.
   */
  observerElevation: number;
  /** Cota que el model del terreny dona al punt de l'observador, en metres. */
  demElevation: number;
  /** Altitud que ens havia passat qui ha demanat el perfil, en metres. */
  requestedElevation: number;
  /**
   * `requestedElevation − demElevation`, en metres. Si no és petita, l'altitud
   * que ens han passat no ve del model (típicament és del GPS o escrita a mà).
   */
  elevationMismatchM: number;
  /**
   * Cert si el desacord passa del llindar i, per tant, l'altitud rebuda no és
   * de fiar. El perfil segueix sent vàlid — h0 surt del model — però la
   * interfície hauria de dir-ho, perquè vol dir que la resta de càlculs
   * astronòmics es fan amb una altitud dubtosa.
   */
  elevationSuspect: boolean;
  /** D'on ha sortit h0: del model o, si no s'ha pogut llegir, del que ens han passat. */
  elevationSource: 'dem' | 'requested';
  /** Desplaçament de l'observador per damunt del terreny del model, en metres. */
  heightAboveGroundM: number;
  /** Distància per sota de la qual no s'ha mostrejat res, en metres. */
  nearFieldM: number;
  /** Pas azimutal en graus. `altitudes[i]` correspon a l'azimut `i * pas`. */
  azimuthStepDeg: number;
  /**
   * Altura aparent del terreny en graus per azimut, amb curvatura i refracció
   * terrestre ja aplicades. Pot ser negativa: des d'un cim, l'horitzó està per
   * sota de l'horitzontal.
   */
  altitudes: number[];
  /** Distància en km del punt que culmina en cada azimut. Mateixa longitud. */
  distancesKm: number[];
  /** Radi màxim explorat, en km. */
  maxRangeKm: number;
  /** Coeficient de refracció terrestre usat (k de R_eff = R/(1−k)). */
  refractionK: number;
  /** Signatura de la configuració de zooms i pas, per invalidar la memòria cau. */
  ringSignature: string;
  /**
   * Fracció de mostres que han trobat dades de terreny, de 0 a 1. Per sota d'1
   * hi ha forats de cobertura (tessel·les que no s'han pogut baixar) i el
   * perfil pot estar subestimat en algun sector.
   */
  coverage: number;
  /** Instant del càlcul en mil·lisegons des de l'època. */
  computedAtMs: number;
}

/** Nombre de raigs d'un perfil. */
export function rayCount(profile: HorizonProfile): number {
  return profile.altitudes.length;
}

/** Normalitza un azimut a [0, 360). */
export function normalizeAzimuth(azimuthDeg: number): number {
  return ((azimuthDeg % 360) + 360) % 360;
}

/**
 * Altura aparent del terreny en un azimut qualsevol, interpolada linealment
 * entre els dos raigs veïns.
 *
 * La volta de 360°→0° s'ha de tractar amb cura: entre l'últim raig (359,75°) i
 * el primer (0°) hi ha un interval com qualsevol altre, i si es tractés el
 * final de l'array com un extrem obert apareixeria un salt artificial al nord
 * — justament l'azimut on hi passa la trajectòria del Sol als eclipsis d'estiu
 * vistos des del nord peninsular.
 */
export function horizonAltitudeAt(
  profile: HorizonProfile,
  azimuthDeg: number,
): number {
  const n = profile.altitudes.length;
  if (n === 0) return 0;
  if (n === 1) return profile.altitudes[0];

  const step = 360 / n;
  const position = normalizeAzimuth(azimuthDeg) / step;
  const i0 = Math.floor(position) % n;
  const i1 = (i0 + 1) % n;
  const t = position - Math.floor(position);

  return profile.altitudes[i0] * (1 - t) + profile.altitudes[i1] * t;
}

/**
 * Distància en km de l'obstacle que marca l'horitzó en un azimut.
 *
 * Aquí NO interpolem: entre dos raigs veïns l'obstacle culminant pot ser un
 * turó a 2 km en un i una serralada a 60 km en l'altre, i la mitjana de 2 i 60
 * no descriu res que existeixi. Agafem el raig més proper.
 */
export function horizonDistanceAt(
  profile: HorizonProfile,
  azimuthDeg: number,
): number {
  const n = profile.distancesKm.length;
  if (n === 0) return 0;
  const step = 360 / n;
  const index = Math.round(normalizeAzimuth(azimuthDeg) / step) % n;
  return profile.distancesKm[index];
}

/**
 * Adaptador per als renderitzadors, que esperen una funció
 * `(azimuthDeg) => number` i no han de saber res del format del perfil.
 */
export function horizonSampler(
  profile: HorizonProfile,
): (azimuthDeg: number) => number {
  return (azimuthDeg: number) => horizonAltitudeAt(profile, azimuthDeg);
}

/** Punt més alt de tot el perfil, per a titulars del tipus "el que et tapa". */
export function maxHorizonAltitude(profile: HorizonProfile): {
  azimuthDeg: number;
  altitudeDeg: number;
  distanceKm: number;
} {
  let bestIndex = 0;
  for (let i = 1; i < profile.altitudes.length; i++) {
    if (profile.altitudes[i] > profile.altitudes[bestIndex]) bestIndex = i;
  }
  return {
    azimuthDeg: bestIndex * profile.azimuthStepDeg,
    altitudeDeg: profile.altitudes[bestIndex] ?? 0,
    distanceKm: profile.distancesKm[bestIndex] ?? 0,
  };
}

/**
 * Perfil pla artificial, per pintar alguna cosa mentre el de veritat es calcula
 * o quan no hi ha xarxa. L'altura per defecte és 0° (horitzó ideal de mar), que
 * és OPTIMISTA: mai amaga el Sol. Val més ensenyar un veredicte massa bo i
 * marcat com a provisional que un de fals de dolent.
 */
export function flatHorizonProfile(
  lat: number,
  lon: number,
  observerElevation: number,
  altitudeDeg = 0,
  azimuthStepDeg = 1,
): HorizonProfile {
  const n = Math.round(360 / azimuthStepDeg);
  return {
    version: HORIZON_PROFILE_VERSION,
    lat,
    lon,
    observerElevation,
    demElevation: observerElevation,
    requestedElevation: observerElevation,
    elevationMismatchM: 0,
    elevationSuspect: false,
    elevationSource: 'requested',
    heightAboveGroundM: 0,
    nearFieldM: 0,
    azimuthStepDeg: 360 / n,
    altitudes: new Array<number>(n).fill(altitudeDeg),
    distancesKm: new Array<number>(n).fill(0),
    maxRangeKm: 0,
    refractionK: 0,
    ringSignature: 'flat',
    coverage: 0,
    computedAtMs: Date.now(),
  };
}

/**
 * Validació d'un perfil que arriba de fora (IndexedDB, JSON, un altre thread).
 * Comprovem estructura i versió: un registre desat per una versió anterior de
 * l'aplicació pot tenir camps que ja no volen dir el mateix.
 */
export function isHorizonProfile(value: unknown): value is HorizonProfile {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Partial<HorizonProfile>;
  return (
    p.version === HORIZON_PROFILE_VERSION &&
    typeof p.lat === 'number' &&
    typeof p.lon === 'number' &&
    typeof p.observerElevation === 'number' &&
    typeof p.demElevation === 'number' &&
    typeof p.elevationMismatchM === 'number' &&
    typeof p.elevationSuspect === 'boolean' &&
    typeof p.azimuthStepDeg === 'number' &&
    Array.isArray(p.altitudes) &&
    Array.isArray(p.distancesKm) &&
    p.altitudes.length > 0 &&
    p.altitudes.length === p.distancesKm.length &&
    p.altitudes.every((a) => typeof a === 'number' && Number.isFinite(a))
  );
}

export function profileToJson(profile: HorizonProfile): string {
  return JSON.stringify(profile);
}

/** Torna `null` en comptes de llançar: un JSON corrupte només vol dir recalcular. */
export function profileFromJson(text: string): HorizonProfile | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return isHorizonProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
