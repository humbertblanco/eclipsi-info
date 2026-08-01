/**
 * Veredicte de visibilitat: creuar les circumstàncies locals de l'eclipsi amb
 * el perfil d'horitzó del terreny.
 *
 * Aquesta és la funció que justifica l'aplicació. Qualsevol web et diu que el
 * 12 d'agost de 2026, des de Sòria, la totalitat dura 1 min 40 s. Cap et diu
 * que des del teu carrer la serralada de ponent se'n menja els últims 35
 * segons, i que caminant 300 m fins al turó els recuperes. Això és el que
 * calculem aquí.
 *
 * DUES REGLES QUE NO ES PODEN TRENCAR:
 *
 * 1. Es compara sempre amb `sun.altitudeApparent`, MAI amb l'altura
 *    geomètrica. A 2° d'altura la refracció val 0,29°, més que el radi del
 *    Sol: usar l'altura geomètrica desplaçaria la posta més d'un minut i mig i
 *    et diria que has perdut una totalitat que en realitat has vist.
 *
 * 2. El perfil d'horitzó ja porta la seva pròpia refracció (la terrestre,
 *    k = 0,13, dins de R_eff). Són dos efectes diferents i tots dos hi han de
 *    ser: un corba el raig que ve del Sol travessant tota l'atmosfera, l'altre
 *    corba el raig que ve del cim a 40 km ran de terra.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import { obscurationPercentValue } from '../astro/obscuration';
import { sampleAt } from '../astro/ephemeris';
import { DEG } from '../astro/constants';
import type { EclipseKind, EclipseSample, LocalCircumstances } from '../astro/types';
import { horizonAltitudeAt, horizonDistanceAt, type HorizonProfile } from '../horizon/profile';

export type VisibilityStatus =
  /** Des d'aquí no hi ha eclipsi. */
  | 'no-eclipse'
  /** El Sol és darrere el terreny durant tot l'esdeveniment. */
  | 'sun-blocked'
  /** Hi ha fase central però el terreny se la menja sencera. */
  | 'central-blocked'
  /** Es veu part de la fase central, però no tota. */
  | 'central-partial'
  /** La fase central es veu sencera. */
  | 'central-visible'
  /** Només fase parcial (no hi ha totalitat ni anularitat des d'aquí). */
  | 'partial-only';

export interface VisibilityPoint {
  timeMs: number;
  /**
   * Marge del centre del Sol sobre el terreny, en graus. Negatiu = amagat.
   * És la corba que val la pena pintar: on creua el zero, s'acaba la festa.
   */
  clearanceDeg: number;
  visible: boolean;
}

export interface VisibilityVerdict {
  status: VisibilityStatus;
  kind: EclipseKind;

  /** Segons de fase central que queden REALMENT per damunt del terreny. */
  centralVisibleSec: number;
  /** Segons de fase central segons les efemèrides, sense mirar el terreny. */
  centralTotalSec: number;
  /** Segons de fase central perduts pel relleu. */
  centralLostSec: number;
  /** Fracció visible de la fase central, de 0 a 1. */
  centralVisibleFraction: number;
  /**
   * Segons de fase central amb el DISC SENCER per damunt del terreny.
   * Durant la totalitat la corona s'estén força més enllà del disc: si la vora
   * inferior ja frega la carena, el que veus és una totalitat mutilada encara
   * que el centre estigui per sobre.
   */
  centralFullDiscVisibleSec: number;

  /** Segons de fase parcial (C1–C4) visibles. */
  partialVisibleSec: number;
  partialTotalSec: number;

  /** Instant en què el centre del Sol es pon DARRERE EL TERRENY. */
  terrainSunsetUtc: Date | null;
  /** Instant en què surt de darrere el terreny, si començava amagat. */
  terrainSunriseUtc: Date | null;
  /** Azimut de la posta real, en graus. */
  terrainSunsetAzimuthDeg: number | null;
  /** Altura del terreny en aquell azimut, en graus. */
  terrainSunsetHorizonDeg: number | null;
  /**
   * Quant s'endarrereix la posta real respecte de l'astronòmica (0°), en
   * segons. Positiu = el terreny et roba temps.
   */
  sunsetAdvanceSec: number | null;

  /**
   * Graus d'altura que et falten per recuperar TOTA la fase central: el pitjor
   * dèficit del Sol respecte del terreny mentre dura la fase central. Zero si
   * no perds res.
   */
  altitudeDeficitDeg: number;
  /**
   * Metres que hauries de pujar, aproximadament, per guanyar aquests graus.
   *
   * Δh ≈ dèficit(rad) × distància a l'obstacle. Val per a l'obstacle concret
   * que et tapa en aquell instant: si el que et tapa és una carena a 3 km,
   * mig grau són 26 m i pots caminar-hi; si és una serralada a 60 km, són 520
   * m i el que has de fer és canviar de província.
   */
  climbToRecoverM: number | null;
  /** Distància de l'obstacle que et tapa en el pitjor moment, en km. */
  blockingDistanceKm: number | null;

  c1Visible: boolean;
  c2Visible: boolean;
  maxVisible: boolean;
  c3Visible: boolean;
  c4Visible: boolean;
  /** Cert si existeix C1 i queda amagat pel terreny. */
  c1Lost: boolean;
  /** Cert si existeix C4 i queda amagat pel terreny. */
  c4Lost: boolean;

  /** Obscuració màxima assolida mentre el Sol es veu, de 0 a 1. */
  maxVisibleObscuration: number;
  /** Altura aparent del Sol al màxim de l'eclipsi, en graus. */
  sunAltitudeAtMaxDeg: number;
  /** Altura del terreny a l'azimut del màxim, en graus. */
  horizonAltitudeAtMaxDeg: number;

  /** Marge sobre el terreny a cada mostra rebuda, per pintar-ho. */
  timeline: VisibilityPoint[];

  /** Resum d'una frase, en català, llest per ensenyar. */
  summary: string;
}

/**
 * Marge del centre del Sol sobre el terreny, en graus.
 * Positiu = el veus. Aquesta resta és tot el mòdul en una línia.
 */
export function sunClearanceDeg(
  sample: EclipseSample,
  profile: HorizonProfile,
): number {
  return sample.sun.altitudeApparent - horizonAltitudeAt(profile, sample.sun.azimuth);
}

/** Marge de la vora inferior del disc solar. */
function lowerLimbClearanceDeg(
  sample: EclipseSample,
  profile: HorizonProfile,
): number {
  return sunClearanceDeg(sample, profile) - sample.sun.angularRadius;
}

interface ScanResult {
  visibleSec: number;
  /** Instants de pas de visible a amagat, en ms. */
  settings: number[];
  /** Instants de pas d'amagat a visible, en ms. */
  risings: number[];
  /** Pitjor dèficit (graus positius) i quan i on ha passat. */
  worstDeficitDeg: number;
  worstDeficitAzimuthDeg: number;
}

/**
 * Recorre un interval de temps mesurant quants segons el marge és positiu.
 *
 * El creuament es refina interpolant LINEALMENT entre dues mostres veïnes en
 * comptes de bisecar: amb el pas d'un segon que fem servir, el marge canvia de
 * forma pràcticament recta (el Sol baixa uns 0,004°/s) i la interpolació ja
 * dona una precisió molt millor que la dècima de segon. Bisecar costaria vint
 * crides a efemèrides per creuament sense guanyar res.
 *
 * Escombrem tot l'interval en comptes de buscar un únic creuament perquè el
 * perfil és dentat: el Sol pot amagar-se darrere una carena, tornar a
 * aparèixer per una collada i tornar-se a amagar. Un únic creuament donaria
 * per perduts segons que sí que es veuen.
 */
function scanVisibility(
  fromMs: number,
  toMs: number,
  stepMs: number,
  clearance: (tMs: number) => { deg: number; azimuth: number },
): ScanResult {
  const result: ScanResult = {
    visibleSec: 0,
    settings: [],
    risings: [],
    worstDeficitDeg: 0,
    worstDeficitAzimuthDeg: 0,
  };
  if (toMs <= fromMs) return result;

  const steps = Math.max(1, Math.ceil((toMs - fromMs) / stepMs));
  const dt = (toMs - fromMs) / steps;

  let prevT = fromMs;
  let prev = clearance(prevT);

  const noteDeficit = (value: { deg: number; azimuth: number }) => {
    if (-value.deg > result.worstDeficitDeg) {
      result.worstDeficitDeg = -value.deg;
      result.worstDeficitAzimuthDeg = value.azimuth;
    }
  };
  noteDeficit(prev);

  for (let i = 1; i <= steps; i++) {
    const t = fromMs + i * dt;
    const cur = clearance(t);
    noteDeficit(cur);

    if (prev.deg >= 0 && cur.deg >= 0) {
      result.visibleSec += dt / 1000;
    } else if (prev.deg < 0 && cur.deg < 0) {
      /* res visible en aquest tram */
    } else {
      const fraction = prev.deg / (prev.deg - cur.deg);
      const crossMs = prevT + fraction * dt;
      if (prev.deg >= 0) {
        result.visibleSec += (crossMs - prevT) / 1000;
        result.settings.push(crossMs);
      } else {
        result.visibleSec += (t - crossMs) / 1000;
        result.risings.push(crossMs);
      }
    }

    prevT = t;
    prev = cur;
  }

  return result;
}

/** Passos d'escombrat: prou fins per als segons que declarem, sense passar-se. */
const CENTRAL_STEP_MS = 1000;
const PARTIAL_STEP_MS = 15000;
/** Finestra addicional per trobar la posta encara que caigui després de C4. */
const SUNSET_MARGIN_MS = 90 * 60 * 1000;

function emptyVerdict(kind: EclipseKind, summary: string): VisibilityVerdict {
  return {
    status: 'no-eclipse',
    kind,
    centralVisibleSec: 0,
    centralTotalSec: 0,
    centralLostSec: 0,
    centralVisibleFraction: 0,
    centralFullDiscVisibleSec: 0,
    partialVisibleSec: 0,
    partialTotalSec: 0,
    terrainSunsetUtc: null,
    terrainSunriseUtc: null,
    terrainSunsetAzimuthDeg: null,
    terrainSunsetHorizonDeg: null,
    sunsetAdvanceSec: null,
    altitudeDeficitDeg: 0,
    climbToRecoverM: null,
    blockingDistanceKm: null,
    c1Visible: false,
    c2Visible: false,
    maxVisible: false,
    c3Visible: false,
    c4Visible: false,
    c1Lost: false,
    c4Lost: false,
    maxVisibleObscuration: 0,
    sunAltitudeAtMaxDeg: 0,
    horizonAltitudeAtMaxDeg: 0,
    timeline: [],
    summary,
  };
}

/**
 * Veredicte complet per a un lloc.
 *
 * @param samples mostres ja calculades (les de la línia de temps de la
 *   simulació, per exemple). Serveixen per tornar la corba de marge sense
 *   recalcular-les; els números del veredicte NO en depenen: es calculen amb
 *   escombrats propis a la resolució que fa falta, perquè declarar "et queden
 *   38 segons" amb mostres cada 30 s seria mentir.
 */
export function computeVisibility(
  circumstances: LocalCircumstances,
  profile: HorizonProfile,
  samples: EclipseSample[] = [],
): VisibilityVerdict {
  const { contacts, kind, location, atmosphere } = circumstances;

  if (kind === 'none') {
    return emptyVerdict(kind, 'Des d’aquest punt no hi ha eclipsi.');
  }

  const at = (tMs: number) => sampleAt(new Date(tMs), location, atmosphere);

  const centreClearance = (tMs: number) => {
    const sample = at(tMs);
    return { deg: sunClearanceDeg(sample, profile), azimuth: sample.sun.azimuth };
  };
  const limbClearance = (tMs: number) => {
    const sample = at(tMs);
    return { deg: lowerLimbClearanceDeg(sample, profile), azimuth: sample.sun.azimuth };
  };

  // --- Fase central ---------------------------------------------------------
  const c2Ms = contacts.c2?.time.getTime();
  const c3Ms = contacts.c3?.time.getTime();
  const hasCentral = c2Ms !== undefined && c3Ms !== undefined;

  const centralScan = hasCentral
    ? scanVisibility(c2Ms, c3Ms, CENTRAL_STEP_MS, centreClearance)
    : null;
  const limbScan = hasCentral
    ? scanVisibility(c2Ms, c3Ms, CENTRAL_STEP_MS, limbClearance)
    : null;

  const centralTotalSec = circumstances.centralDurationSec;
  const centralVisibleSec = centralScan ? Math.min(centralScan.visibleSec, centralTotalSec) : 0;
  const centralLostSec = Math.max(0, centralTotalSec - centralVisibleSec);

  // --- Fase parcial ---------------------------------------------------------
  const c1Ms = contacts.c1?.time.getTime();
  const c4Ms = contacts.c4?.time.getTime();
  const maxMs = contacts.max.time.getTime();

  const partialFrom = c1Ms ?? maxMs;
  const partialTo = c4Ms ?? maxMs;
  const partialScan = scanVisibility(
    partialFrom,
    partialTo,
    PARTIAL_STEP_MS,
    centreClearance,
  );

  // --- Posta real darrere el terreny ---------------------------------------
  // Ampliem la finestra més enllà de C4: als eclipsis de capvespre la posta
  // sovint cau just després del quart contacte, i és una dada que l'usuari vol.
  const sunsetScan = scanVisibility(
    partialFrom - SUNSET_MARGIN_MS,
    partialTo + SUNSET_MARGIN_MS,
    60000,
    centreClearance,
  );
  const rawSunsetMs = sunsetScan.settings.length
    ? sunsetScan.settings[sunsetScan.settings.length - 1]
    : null;
  // El pas d'un minut només serveix per emmarcar; refinem amb un escombrat fi.
  const terrainSunsetMs =
    rawSunsetMs === null
      ? null
      : (scanVisibility(rawSunsetMs - 60000, rawSunsetMs + 60000, 1000, centreClearance)
          .settings[0] ?? rawSunsetMs);

  const terrainSunriseMs = sunsetScan.risings.length ? sunsetScan.risings[0] : null;

  let terrainSunsetAzimuthDeg: number | null = null;
  let terrainSunsetHorizonDeg: number | null = null;
  let sunsetAdvanceSec: number | null = null;
  if (terrainSunsetMs !== null) {
    const sample = at(terrainSunsetMs);
    terrainSunsetAzimuthDeg = sample.sun.azimuth;
    terrainSunsetHorizonDeg = horizonAltitudeAt(profile, sample.sun.azimuth);
    // Quant abans es pon per culpa del relleu: l'altura del terreny dividida
    // per la velocitat vertical del Sol en aquell instant.
    const rateDegPerSec = sunAltitudeRateDegPerSec(at, terrainSunsetMs);
    if (rateDegPerSec < 0) {
      sunsetAdvanceSec = terrainSunsetHorizonDeg / -rateDegPerSec;
    }
  }

  // --- Dèficit d'altura -----------------------------------------------------
  const worstDeficitDeg = centralScan
    ? centralScan.worstDeficitDeg
    : partialScan.worstDeficitDeg;
  const worstAzimuth = centralScan
    ? centralScan.worstDeficitAzimuthDeg
    : partialScan.worstDeficitAzimuthDeg;

  const blockingDistanceKm =
    worstDeficitDeg > 0 ? horizonDistanceAt(profile, worstAzimuth) : null;
  const climbToRecoverM =
    blockingDistanceKm !== null && blockingDistanceKm > 0
      ? worstDeficitDeg * DEG * blockingDistanceKm * 1000
      : null;

  // --- Contactes ------------------------------------------------------------
  const visibleContact = (sample: EclipseSample | undefined): boolean =>
    sample !== undefined && sunClearanceDeg(sample, profile) >= 0;

  const c1Visible = visibleContact(contacts.c1);
  const c2Visible = visibleContact(contacts.c2);
  const maxVisible = visibleContact(contacts.max);
  const c3Visible = visibleContact(contacts.c3);
  const c4Visible = visibleContact(contacts.c4);

  // --- Obscuració màxima realment visible -----------------------------------
  let maxVisibleObscuration = 0;
  const obscurationSteps = 240;
  for (let i = 0; i <= obscurationSteps; i++) {
    const t = partialFrom + ((partialTo - partialFrom) * i) / obscurationSteps;
    const sample = at(t);
    if (sunClearanceDeg(sample, profile) >= 0 && sample.obscuration > maxVisibleObscuration) {
      maxVisibleObscuration = sample.obscuration;
    }
  }

  // --- Corba per pintar -----------------------------------------------------
  const timeline: VisibilityPoint[] = samples.map((sample) => {
    const clearanceDeg = sunClearanceDeg(sample, profile);
    return { timeMs: sample.time.getTime(), clearanceDeg, visible: clearanceDeg >= 0 };
  });

  const centralVisibleFraction =
    centralTotalSec > 0 ? centralVisibleSec / centralTotalSec : 0;

  const status = decideStatus({
    kind,
    hasCentral,
    centralVisibleSec,
    centralTotalSec,
    partialVisibleSec: partialScan.visibleSec,
    maxVisible,
  });

  return {
    status,
    kind,
    centralVisibleSec,
    centralTotalSec,
    centralLostSec,
    centralVisibleFraction,
    centralFullDiscVisibleSec: limbScan
      ? Math.min(limbScan.visibleSec, centralTotalSec)
      : 0,
    partialVisibleSec: partialScan.visibleSec,
    partialTotalSec: circumstances.partialDurationSec,
    terrainSunsetUtc: terrainSunsetMs === null ? null : new Date(terrainSunsetMs),
    terrainSunriseUtc: terrainSunriseMs === null ? null : new Date(terrainSunriseMs),
    terrainSunsetAzimuthDeg,
    terrainSunsetHorizonDeg,
    sunsetAdvanceSec,
    altitudeDeficitDeg: worstDeficitDeg,
    climbToRecoverM,
    blockingDistanceKm,
    c1Visible,
    c2Visible,
    maxVisible,
    c3Visible,
    c4Visible,
    c1Lost: contacts.c1 !== undefined && !c1Visible,
    c4Lost: contacts.c4 !== undefined && !c4Visible,
    maxVisibleObscuration,
    sunAltitudeAtMaxDeg: contacts.max.sun.altitudeApparent,
    horizonAltitudeAtMaxDeg: horizonAltitudeAt(profile, contacts.max.sun.azimuth),
    timeline,
    summary: buildSummary({
      status,
      kind,
      centralVisibleSec,
      centralTotalSec,
      centralLostSec,
      worstDeficitDeg,
      climbToRecoverM,
      blockingDistanceKm,
      maxVisibleObscuration,
    }),
  };
}

/** Velocitat vertical del Sol en graus per segon (negativa si es pon). */
function sunAltitudeRateDegPerSec(
  at: (tMs: number) => EclipseSample,
  tMs: number,
): number {
  const dt = 60000;
  const before = at(tMs - dt).sun.altitudeApparent;
  const after = at(tMs + dt).sun.altitudeApparent;
  return (after - before) / ((2 * dt) / 1000);
}

function decideStatus(input: {
  kind: EclipseKind;
  hasCentral: boolean;
  centralVisibleSec: number;
  centralTotalSec: number;
  partialVisibleSec: number;
  maxVisible: boolean;
}): VisibilityStatus {
  // La comprovació sobre el màxim evita declarar-ho tot perdut en el cas
  // degenerat en què no s'hagi pogut acotar C1 o C4 i l'escombrat parcial no
  // tingui cap interval per recórrer.
  if (input.partialVisibleSec <= 0 && !input.maxVisible) return 'sun-blocked';
  if (!input.hasCentral || input.centralTotalSec <= 0) return 'partial-only';
  if (input.centralVisibleSec <= 0) return 'central-blocked';
  // Un segon de marge: no té sentit alarmar per una dècima perduda, que està
  // dins de l'error del propi model del terreny.
  if (input.centralVisibleSec < input.centralTotalSec - 1) return 'central-partial';
  return 'central-visible';
}

function formatSeconds(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

function buildSummary(input: {
  status: VisibilityStatus;
  kind: EclipseKind;
  centralVisibleSec: number;
  centralTotalSec: number;
  centralLostSec: number;
  worstDeficitDeg: number;
  climbToRecoverM: number | null;
  blockingDistanceKm: number | null;
  maxVisibleObscuration: number;
}): string {
  const central = input.kind === 'annular' ? 'anularitat' : 'totalitat';
  const climb =
    input.climbToRecoverM !== null && input.blockingDistanceKm !== null
      ? ` Caldria guanyar ${input.worstDeficitDeg.toFixed(2)}° d’altura sobre l’horitzó` +
        ` (uns ${Math.round(input.climbToRecoverM)} m amunt, amb l’obstacle a` +
        ` ${input.blockingDistanceKm.toFixed(1)} km).`
      : '';

  switch (input.status) {
    case 'no-eclipse':
      return 'Des d’aquest punt no hi ha eclipsi.';
    case 'sun-blocked':
      return 'El Sol queda darrere el terreny durant tot l’eclipsi: des d’aquí no en veuràs res.' + climb;
    case 'central-blocked':
      return (
        `El terreny tapa la ${central} sencera (${formatSeconds(input.centralTotalSec)}).` +
        ` Com a màxim veuràs un ${obscurationPercentValue(input.maxVisibleObscuration, false)} % del Sol cobert.` +
        climb
      );
    case 'central-partial':
      return (
        `De ${formatSeconds(input.centralTotalSec)} de ${central} només en veuràs` +
        ` ${formatSeconds(input.centralVisibleSec)}: el relleu se’n menja` +
        ` ${formatSeconds(input.centralLostSec)}.` +
        climb
      );
    case 'central-visible':
      return `${formatSeconds(input.centralVisibleSec)} de ${central} sencers per damunt del terreny.`;
    case 'partial-only':
      return `Eclipsi parcial: fins a un ${obscurationPercentValue(input.maxVisibleObscuration, false)} % del Sol cobert per damunt del terreny.`;
  }
}
