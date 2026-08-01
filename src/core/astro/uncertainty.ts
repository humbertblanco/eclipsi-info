/**
 * Què NO podem saber, i què hi pots fer.
 *
 * PER QUÈ EXISTEIX AQUEST MÒDUL. `contacts.ts` documenta un fet incòmode: les
 * efemèrides que fem servir tenen un error de posició RELATIVA Sol-Lluna d'uns
 * 2 segons d'arc, i al caire de la franja el marge que separa veure la
 * totalitat de no veure-la és de dècimes de segon d'arc. Allà la nostra
 * resposta és una moneda a l'aire. Aquest mòdul posa números a la moneda i,
 * sobretot, la converteix en un consell: quants quilòmetres has de fer, i cap a
 * on, perquè la resposta deixi de dependre d'un error que no podem corregir.
 *
 * La regla de producte que mana per damunt de tot: **al mig de la franja no
 * s'ha de mencionar res**. Una desviació de tres segons i mig en una totalitat
 * de dos minuts no la nota ningú, i fer semblar insegura una app que no ho és
 * és tan dolent com prometre precisió que no tenim. Per això `summary` torna
 * null i `notable` torna fals des de la immensa majoria del territori.
 *
 * ═══ D'ON SURT CADA NÚMERO ══════════════════════════════════════════════════
 *
 * ── 1. L'ERROR D'ENTRADA ────────────────────────────────────────────────────
 *
 * Tot penja d'una sola magnitud mesurada: l'error de la posició RELATIVA
 * Sol-Lluna d'`astronomy-engine` contra JPL Horizons (efemèrides DE441).
 * `contacts.ts` en documenta dues mesures independents:
 *
 *   12-08-2026   (+1,54″, −1,34″)   mòdul 2,04″
 *   08-04-2024   (−1,89″, −0,95″)   mòdul 2,11″
 *
 * El mòdul és estable, la DIRECCIÓ no: canvia entre eclipsis. Dins d'un mateix
 * eclipsi és un biaix pla (varia menys de 0,05″ en quatre minuts), no soroll.
 *
 * Modelem doncs l'error com un VECTOR DE MÒDUL CONEGUT σ = 2,0″ I DIRECCIÓ
 * DESCONEGUDA, uniforme sobre el cercle. No és una excusa estadística: és
 * literalment el que sabem i el que no.
 *
 * σ = 2,0″ és el mateix valor que fa servir `contacts.ts` per a la seva bandera
 * `edgeUncertain`. Es manté idèntic A PROPÒSIT: així `edgeUncertain` i el fet
 * que aquí la confiança no sigui ni 0 ni 1 són exactament la mateixa condició i
 * la interfície no es pot contradir. Les mesures donen 2,04″ i 2,11″; el 2 %
 * de diferència no canvia cap conclusió.
 *
 * ── 2. DESCOMPOSICIÓ: EL TEMPS I L'ESPAI SÓN DUES COSES DIFERENTS ───────────
 *
 * La Lluna es mou respecte del Sol en línia gairebé recta sobre el cel, a una
 * velocitat angular ω que mesurem al lloc i al moment (topocèntrica). Val
 * 0,59″/s el 2026, 0,47″/s el 2027 i 0,42″/s el 2028.
 *
 * Projectem l'error sobre aquesta direcció:
 *
 *   COMPONENT AL LLARG del moviment  →  desplaça TOTS els contactes el mateix,
 *                                       δt = e∥ / ω. NO canvia cap durada:
 *                                       és una traslació pura de l'esdeveniment.
 *
 *   COMPONENT PERPENDICULAR          →  canvia el paràmetre d'impacte, o sigui
 *                                       la separació mínima. Això sí que mou el
 *                                       límit de la franja i canvia la durada.
 *
 * Aquesta separació és tota la clau del mòdul. El component al llarg no
 * s'ensenya mai (no canvia cap decisió: afecta igual tothom i no el nota
 * ningú); el perpendicular és el que decideix si veuràs la totalitat.
 *
 * ── 3. INTERVAL DE LES HORES DE CONTACTE ────────────────────────────────────
 *
 *   semiamplada = σ / ω
 *
 * Amb σ = 2,0″:  2026 → ±3,4 s · 2027 → ±4,3 s · 2028 → ±4,7 s.
 *
 * Contrast amb la realitat: el desplaçament mesurat el 2026 contra la
 * referència va ser de −3,6 a −3,9 s, i el del 2024 de +4,4 s. O sigui que
 * σ/ω és del bon ordre però es queda una mica curt (l'error del 2026 va anar
 * gairebé tot al llarg del moviment). Per això la semiamplada es presenta
 * SEMPRE arrodonida cap amunt al segon sencer, i per això no s'ensenya mai una
 * hora de contacte amb dècimes de segon.
 *
 * ── 4. INTERVAL DE LA DURADA DE LA FASE CENTRAL ─────────────────────────────
 *
 * La fase central és la corda que la Lluna talla dins del cercle de radi
 * L = |R☉ − R☾| (radi umbral), amb un paràmetre d'impacte m = separació mínima:
 *
 *   D(m) = 2·√(L² − m²) / ω
 *
 * L i m surten dels mateixos números que ja tenim, sense cap càlcul nou:
 *   m = contacts.max.separation · 3600            (segons d'arc)
 *   L = m − umbralMarginArcsec                    (perquè marge = m − L)
 *
 * VALIDACIÓ d'aquesta fórmula contra el motor complet (que resol l'equació de
 * la separació numèricament, sense cap hipòtesi de recta):
 *
 *   Burgos 2026    D(m) = 103,5 s   motor 103,5 s
 *   Oviedo 2026    D(m) = 108,0 s   motor 108,0 s
 *   Cadis 2027     D(m) = 167,1 s   motor 167,0 s
 *   València 2028  D(m) = 421,4 s   motor 421,5 s
 *
 * Coincideix a la dècima de segon. La fórmula no és una aproximació grollera:
 * és el mateix que fa el motor, escrit de manera que se'n pot derivar.
 *
 * L'interval surt de perturbar m amb el component perpendicular, que està
 * acotat per σ:
 *
 *   durada màxima = D(max(0, m − σ))     (el biaix t'acosta a la línia central)
 *   durada mínima = D(m + σ)             (t'allunya; 0 si m + σ ≥ L)
 *
 * Al mig de la franja m ≈ 0 i dD/dm ≈ 0: l'interval és de ±1,5 s sobre 103 s.
 * Invisible, i per això no es diu. Al caire m → L i la derivada divergeix:
 * allà l'interval honest va de zero a quaranta segons, i això sí que s'ha de
 * dir.
 *
 * ── 5. CONFIANÇA SOBRE SI HI HAURÀ FASE CENTRAL ─────────────────────────────
 *
 * Hi ha fase central quan m < L, és a dir quan el marge umbral és negatiu.
 * Amb l'error, la condició passa a ser m + e⊥ < L, o sigui e⊥ < −marge.
 *
 * Si e = σ·(cos θ, sin θ) amb θ uniforme, el component sobre qualsevol eix fix
 * és σ·cos θ i té la distribució de l'arcsinus:
 *
 *   P(e⊥ ≤ u) = 1 − arccos(u/σ)/π      per a |u| ≤ σ
 *
 * D'aquí, directament:
 *
 *   P(fase central) = 1 − arccos(−marge/σ)/π
 *
 * Té tres propietats que la fan la tria correcta per a aquesta app:
 *
 *   · Suport ACOTAT. Amb |marge| ≥ σ la probabilitat val exactament 1 o
 *     exactament 0. Fora de la vora, l'app no dubta mai. Una gaussiana hauria
 *     deixat una cua de dubte a tot arreu i hauria calgut un llindar arbitrari
 *     per callar-la.
 *   · Al límit exacte val 0,5, que és el que ha de valer.
 *   · Es deriva en una línia d'una premissa que podem defensar: mòdul mesurat,
 *     direcció desconeguda.
 *
 * ── 6. DE SEGONS D'ARC A QUILÒMETRES ────────────────────────────────────────
 *
 * Un usuari no pensa en segons d'arc. Convertim amb el gradient del marge, que
 * es mesura al lloc per diferència centrada a un quilòmetre (quatre avaluacions
 * de circumstàncies locals, igual que `gradient.ts`).
 *
 * Mesurat: 0,210″/km el 2026, 0,574″/km el 2027, 0,65″/km el 2028. La diferència
 * no és casual: el 2026 la Lluna tot just cobreix el Sol (L ≈ 31″) i la franja
 * fa 299 km, o sigui que el marge canvia molt a poc a poc; el 2028 és anular amb
 * L ≈ 90″ sobre una franja semblant.
 *
 * Conseqüència, i és una conclusió del mòdul que val la pena llegir dues
 * vegades: **la zona on la resposta és una moneda a l'aire no fa el mateix a
 * cada eclipsi**. σ/|∇marge| val
 *
 *   2026 → ±9,5 km     2027 → ±3,5 km     2028 → ±3,1 a ±3,9 km
 *
 * La capçalera de `contacts.ts` parla de 2-3 km a cada vora. Per al 2027 i el
 * 2028 quadra; per al 2026, que és l'eclipsi amb el Sol més baix i el marge més
 * prim, la zona incerta és tres vegades més ampla. Per això aquí no hi ha cap
 * constant en quilòmetres: es mesura cada cop.
 *
 * ── 7. LA COTA MOU EL LÍMIT (i per què el nostre número no és el de l'IGN) ──
 *
 * `pathLimitsAt` dona el límit de la franja al NIVELL DEL MAR, que és el que
 * publiquen el GSFC i l'IGN. Tu no hi ets. Un observador a h metres intercepta
 * el raig que hauria tocat el terra h/tan(alt) més enllà, i amb el Sol a 8° i
 * 700 m de cota això són 4,8 km de desplaçament del límit — més ample que tota
 * la zona incerta del 2027.
 *
 * Verificat: a 43,70°N / −3,70°E amb 700 m de cota, el límit publicat queda a
 * 4,0 km i el que t'aplica a tu a 0,7 km. La diferència és exactament el
 * desplaçament per cota.
 *
 * Per això `km` és la distància al límit TAL COM T'APLICA A TU (surt del teu
 * marge i del teu gradient, i porta a dins la cota, la refracció i la
 * paral·laxi), i `seaLevelKm` es dona a part, per si algú compara amb un mapa
 * publicat i vol saber per què no coincideix.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import { computeLocalCircumstances } from './contacts';
import { DEG, EARTH_EQUATORIAL_RADIUS_KM, RAD } from './constants';
import { sampleAt } from './ephemeris';
import { bearingToCardinal, type DurationGradient } from './gradient';
import { getEclipse } from '../eclipses/catalog';
import { centralLineAt, pathLimitsAt, type PathPoint } from '../eclipses/path';
import { approxDistanceKm, bearingDeg, kmPerDegLon } from '../spots/grid';
import type { Atmosphere, GeoLocation, LocalCircumstances } from './types';

// ---------------------------------------------------------------------------
// Constants derivades de la mesura (vegeu la secció 1 de la capçalera)
// ---------------------------------------------------------------------------

/**
 * Mòdul de l'error de posició relativa Sol-Lluna, en segons d'arc.
 *
 * Mesurat contra JPL Horizons (DE441): 2,04″ el 2026 i 2,11″ el 2024. És el
 * MATEIX valor que `contacts.ts` fa servir per a `edgeUncertain`, i s'ha de
 * mantenir sincronitzat: si els dos se separen, la interfície pot arribar a
 * ensenyar «vora incerta» amb una confiança de l'1 alhora.
 */
export const RELATIVE_POSITION_ERROR_ARCSEC = 2.0;

/** Distància de la diferència centrada per al gradient del marge. */
const MARGIN_STEP_KM = 1;

/**
 * Km d'un grau de latitud. Es deriva del mateix radi equatorial que
 * `kmPerDegLon` de `spots/grid`, perquè els dos eixos de la graella local no
 * quedin a escales diferents.
 */
const KM_PER_DEG_LAT = (Math.PI * EARTH_EQUATORIAL_RADIUS_KM) / 180;

/**
 * Semiamplada de l'interval de durada per sota de la qual no es diu res.
 *
 * Surt de la capçalera de `contacts.ts`: al mig de la franja, tres segons i mig
 * de desviació no els nota ningú.
 */
const NOTABLE_SPREAD_SEC = 3.5;

/**
 * ...i a més ha de ser una fracció apreciable de la durada. Sense aquesta
 * segona condició, una totalitat de dos minuts amb ±4 s (un 4 %) es marcaria
 * com a incerta, que és exactament el que no volem.
 */
const NOTABLE_SPREAD_FRACTION = 0.1;

/** Separació temporal per mesurar la velocitat angular relativa. */
const RATE_HALF_WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// Tipus públics
// ---------------------------------------------------------------------------

export type CentralPhaseConfidence =
  /** Ni amb tot l'error en contra deixaries de veure la fase central. */
  | 'central-certain'
  /** Probable, però ets prou a prop de la vora perquè no ho puguem assegurar. */
  | 'central-likely'
  /** Moneda a l'aire: el motor no ho pot decidir. */
  | 'coin-flip'
  /** Probablement no, però tampoc ho podem descartar. */
  | 'no-central-likely'
  /** Ni amb tot l'error a favor hi arribaries. */
  | 'no-central-certain';

export interface BandLimitDistance {
  /** Quin dels dos límits tens més a prop. */
  side: 'north' | 'south';
  /** Cert si ets DINS de la franja. */
  inside: boolean;
  /**
   * Distància al límit tal com t'aplica a tu, en km: surt del teu marge umbral
   * i del gradient mesurat al teu punt, i per tant ja porta a dins la teva cota.
   *
   * PRECISIÓ: és marge/gradient, o sigui una linealització. Al caire, que és on
   * el número importa, és exacta — a 43,68°N el marge val −0,212″, el gradient
   * mesurat 0,2012″/km i la distància real a l'arrel de marge = 0 són els
   * mateixos 1,05 km. A cent quilòmetres del límit es queda un 8 % curta,
   * perquè el gradient canvia d'un extrem a l'altre de la franja. No és cap
   * problema: allà el número no es mostra ni es fa servir per decidir res.
   */
  km: number;
  /** Rumb cap al límit més proper, en graus (0 = nord). */
  bearingDeg: number;
  /** Rumb cap endins de la franja. És el rumb del consell. */
  inwardBearingDeg: number;
  /** Amplada de la franja al teu través, en km. */
  bandWidthKm: number;
  /**
   * Punt del límit PUBLICAT (nivell del mar) més proper, amb l'instant en què
   * hi passa la vora de l'ombra. Null si la cerca no l'ha pogut acotar.
   */
  seaLevelPoint: PathPoint | null;
  /** Distància a aquell punt, en km. Null si no s'ha pogut acotar. */
  seaLevelKm: number | null;
  /**
   * Quant desplaça la teva cota la vora EFECTIVA de la franja, mesurat a
   * través de la franja, amb signe positiu cap enfora. Negatiu vol dir que la
   * vora et queda més a prop del que diu el mapa publicat.
   *
   * Si ets a dins, `seaLevelKm + elevationShiftKm` és la distància que de
   * veritat t'aplica, i ha de coincidir amb `km` dins de `limitUncertaintyKm`
   * (ho comprova el test: és l'única manera que tenim de contrastar els dos
   * motors que situen la franja).
   *
   * Derivació: el raig que t'arriba a h metres d'alçada hauria tocat el terra
   * h/tan(alt) més enllà, en la direcció oposada al Sol. O sigui que el patró
   * d'ombra que veus és el del nivell del mar desplaçat h/tan(alt) cap a
   * l'azimut del Sol. Només en compta la component a través de la franja:
   * cos(azimut del Sol − rumb cap enfora).
   *
   * Amb el Sol a 8° i 860 m de cota surten 5,9 km de desplaçament, dels quals
   * 2,0 km a través de la franja. Per als eclipsis del 2026 i del 2028, amb el
   * Sol arran d'horitzó, no és un detall.
   */
  elevationShiftKm: number;
}

export interface EclipseUncertainty {
  eclipseId: string;
  location: GeoLocation;

  /** σ emprada, en segons d'arc. Es publica perquè el número sigui traçable. */
  relativeErrorArcsec: number;
  /** Velocitat angular relativa Lluna-Sol al màxim, en segons d'arc per segon. */
  relativeRateArcsecPerSec: number;
  /** Gradient del marge umbral al teu punt, en segons d'arc per km. */
  marginGradientArcsecPerKm: number;
  /** σ traduïda a terreny: amplada de la zona on no podem decidir, en km. */
  limitUncertaintyKm: number;

  /** Semiamplada de l'interval de qualsevol hora de contacte, en segons. */
  contactHalfWidthSec: number;

  /** Durada de la fase central segons el motor, en segons. */
  centralDurationSec: number;
  /** Extrem inferior honest de la durada, en segons. Zero vol dir «potser cap». */
  centralDurationMinSec: number;
  /** Extrem superior honest de la durada, en segons. */
  centralDurationMaxSec: number;

  /** Marge umbral al màxim, en segons d'arc. Negatiu = ets dins. */
  umbralMarginArcsec: number;
  /** Probabilitat que des d'aquest punt hi hagi fase central, de 0 a 1. */
  centralProbability: number;
  confidence: CentralPhaseConfidence;

  /** Distància al límit més proper. Null si el punt no té ni fase parcial. */
  limit: BandLimitDistance | null;

  /**
   * Cert quan no podem decidir si hi haurà fase central. Equival exactament a
   * `LocalCircumstances.edgeUncertain`, i a `0 < centralProbability < 1`.
   */
  centralPhaseUncertain: boolean;
  /** Cert quan l'interval de durada és prou ample per haver-lo de dir. */
  durationUncertain: boolean;
  /**
   * Cert només quan la incertesa canvia el que hauries de fer.
   * Al mig de la franja és fals, i llavors no se n'ha de parlar enlloc.
   */
  notable: boolean;

  /**
   * Quants km hauries de fer perquè la resposta deixi de dependre de l'error,
   * seguint `limit.inwardBearingDeg`. Null quan no cal moure's.
   */
  kmToCertainty: number | null;

  /** Text en català llest per ensenyar. Null quan no s'ha de dir res. */
  summary: string | null;
}

export interface UncertaintyOptions {
  atmosphere?: Atmosphere;
  /**
   * Si és fals, no es busca el punt del límit publicat (estalvia unes tres
   * centes avaluacions de `pathLimitsAt`). La resta del càlcul no en depèn.
   */
  locateSeaLevelLimit?: boolean;
}

// ---------------------------------------------------------------------------
// Geometria de l'error
// ---------------------------------------------------------------------------

/**
 * Velocitat angular del moviment relatiu Lluna-Sol, en segons d'arc per segon.
 *
 * Topocèntrica a propòsit: les hores de contacte també ho són, i la rotació de
 * l'observador hi entra. Es mesura per diferència centrada d'un minut sobre el
 * vector de separació, no sobre la separació escalar — prop del màxim la
 * separació escalar té un mínim i la seva derivada s'hi anul·la.
 */
function relativeRateArcsecPerSec(
  location: GeoLocation,
  atMs: number,
  atmosphere: Atmosphere,
): number {
  const vector = (tMs: number): { x: number; y: number } => {
    const s = sampleAt(new Date(tMs), location, atmosphere);
    // L'ascensió recta va en hores; la diferència és sempre petita, però es
    // normalitza per si el parell cau a banda i banda de les 0 h.
    let dRaHours = s.moon.ra - s.sun.ra;
    if (dRaHours > 12) dRaHours -= 24;
    if (dRaHours < -12) dRaHours += 24;
    return {
      x: dRaHours * 15 * 3600 * Math.cos(s.sun.dec * DEG),
      y: (s.moon.dec - s.sun.dec) * 3600,
    };
  };

  const before = vector(atMs - RATE_HALF_WINDOW_MS);
  const after = vector(atMs + RATE_HALF_WINDOW_MS);
  return (
    Math.hypot(after.x - before.x, after.y - before.y) /
    ((2 * RATE_HALF_WINDOW_MS) / 1000)
  );
}

/**
 * Gradient del marge umbral sobre el terreny, en segons d'arc per km.
 *
 * PER QUÈ NO N'HI HA PROU AMB LA DIFERÈNCIA CENTRADA. El marge és
 * `m = D − R`, on `D` és la distància de l'observador a l'eix de l'ombra i `R`
 * el radi umbral. `D` és un valor absolut i val zero JUSTAMENT sobre la línia
 * central: la superfície del marge no és un pla inclinat, és una V amb el
 * vèrtex sobre la línia. Una diferència centrada que trepitgi el vèrtex resta
 * dos pendents de signe contrari i es cancel·la.
 *
 * I això no és una curiositat numèrica. El mòdul reparteix per aquest gradient:
 * `bandWidthKm = 2R / |∇m|`. A Sevilla, el 26-01-2028, el gradient centrat
 * sortia 0,095″/km en comptes de 0,50″/km i l'app publicava una franja de
 * 1.866 km d'amplada —cinc vegades la real, i sobre una península que en fa
 * mil—, mentre que a Cadis, el mateix eclipsi i a 90 km, en publicava 355. Dos
 * punts del mateix eclipsi no poden donar amplades diferents.
 *
 * COM S'ARREGLA. `D²` sí que és llis al vèrtex: si el camp és localment lineal,
 * `D² = |g|²·(x − x₀)²` és una paràbola exacta i la seva segona diferència val
 * `2·s²·|g|²` sigui on sigui el vèrtex. D'aquí surt `|g|` sense passar mai per
 * la punta. Es fa amb les MATEIXES quatre avaluacions: només cal llegir també
 * el paràmetre d'impacte de cada punt.
 *
 * ES QUEDA EL MÉS GRAN DELS DOS. La diferència centrada és més precisa lluny
 * del vèrtex —`D²` hi ronda els 10⁵ i la segona diferència hi perd xifres— i
 * mai no sobreestima: cancel·lar només resta. L'estimador pel quadrat és exacte
 * al vèrtex. Agafar el màxim tria l'un o l'altre allà on cadascun és bo, i
 * l'error que queda cau del cantó de dir una franja massa estreta i uns
 * quilòmetres de més, que és el cantó que no enganya ningú.
 *
 * La DIRECCIÓ surt sempre de la diferència centrada, que és on el signe viu.
 * Al vèrtex es degenera, però allà els dos límits queden a la mateixa distància
 * i cap consell no en depèn; per si de cas, s'hi cau al signe de la diferència
 * de `D²`, que val `2D·∇D` i conserva el sentit.
 */
function marginGradient(
  eclipseId: string,
  location: GeoLocation,
  atmosphere: Atmosphere,
  /** Paràmetre d'impacte al punt, en segons d'arc. Ja el té qui crida. */
  centreImpactArcsec: number,
): { northward: number; eastward: number; magnitude: number } {
  const lonKm = kmPerDegLon(location.lat);
  const at = (northKm: number, eastKm: number): { margin: number; impact: number } => {
    const c = computeLocalCircumstances(
      eclipseId,
      {
        lat: location.lat + northKm / KM_PER_DEG_LAT,
        lon: location.lon + (lonKm > 1e-6 ? eastKm / lonKm : 0),
        // La cota es manté: aquí volem com canvia el marge desplaçant-te pel
        // pla, no enfilant-te. Enfilar-se és una altra palanca i la tracta el
        // veredicte d'horitzó.
        elevation: location.elevation,
      },
      atmosphere,
    );
    return { margin: c.umbralMarginArcsec, impact: c.contacts.max.separation * 3600 };
  };

  const nPlus = at(MARGIN_STEP_KM, 0);
  const nMinus = at(-MARGIN_STEP_KM, 0);
  const ePlus = at(0, MARGIN_STEP_KM);
  const eMinus = at(0, -MARGIN_STEP_KM);

  const northward = (nPlus.margin - nMinus.margin) / (2 * MARGIN_STEP_KM);
  const eastward = (ePlus.margin - eMinus.margin) / (2 * MARGIN_STEP_KM);
  const centred = Math.hypot(northward, eastward);

  // Estimador pel quadrat de la distància a l'eix. El punt central no costa
  // res: qui crida ja l'ha calculat i el passa.
  const sq = (value: number): number => value * value;
  const twoStepSq = 2 * MARGIN_STEP_KM * MARGIN_STEP_KM;
  const centreSq = sq(centreImpactArcsec);
  const gNorthSq = Math.max(0, (sq(nPlus.impact) + sq(nMinus.impact) - 2 * centreSq) / twoStepSq);
  const gEastSq = Math.max(0, (sq(ePlus.impact) + sq(eMinus.impact) - 2 * centreSq) / twoStepSq);
  const squared = Math.sqrt(gNorthSq + gEastSq);

  const magnitude = Math.max(centred, squared);
  if (magnitude < 1e-9) return { northward: 0, eastward: 0, magnitude: 0 };

  // Els components es reescalen al mòdul bo perquè la direcció es conservi.
  if (centred > 1e-9) {
    const k = magnitude / centred;
    return { northward: northward * k, eastward: eastward * k, magnitude };
  }

  // Vèrtex exacte: el signe es rescata de la diferència de D² (= 2D·∇D).
  const dirNorth = sq(nPlus.impact) - sq(nMinus.impact);
  const dirEast = sq(ePlus.impact) - sq(eMinus.impact);
  const dirLength = Math.hypot(dirNorth, dirEast);
  if (dirLength < 1e-12) return { northward: 0, eastward: magnitude, magnitude };
  return {
    northward: (dirNorth / dirLength) * magnitude,
    eastward: (dirEast / dirLength) * magnitude,
    magnitude,
  };
}

/**
 * Probabilitat que hi hagi fase central, segons la distribució de l'arcsinus
 * del component perpendicular (secció 5 de la capçalera).
 */
export function centralProbabilityFromMargin(
  marginArcsec: number,
  sigmaArcsec: number = RELATIVE_POSITION_ERROR_ARCSEC,
): number {
  const u = -marginArcsec / sigmaArcsec;
  if (u >= 1) return 1;
  if (u <= -1) return 0;
  return 1 - Math.acos(u) / Math.PI;
}

function classify(probability: number): CentralPhaseConfidence {
  if (probability >= 1) return 'central-certain';
  if (probability <= 0) return 'no-central-certain';
  if (probability >= 0.75) return 'central-likely';
  if (probability <= 0.25) return 'no-central-likely';
  return 'coin-flip';
}

/** Corda de la fase central per a un paràmetre d'impacte donat, en segons. */
function chordSeconds(impactArcsec: number, limitArcsec: number, rate: number): number {
  if (rate <= 0) return 0;
  const inside = limitArcsec * limitArcsec - impactArcsec * impactArcsec;
  return inside <= 0 ? 0 : (2 * Math.sqrt(inside)) / rate;
}

// ---------------------------------------------------------------------------
// El límit publicat: cerca sobre pathLimitsAt
// ---------------------------------------------------------------------------

/**
 * Per què no n'hi ha prou amb escombrar el temps a pas fix.
 *
 * L'ombra travessa Espanya al final del seu recorregut, quan la seva velocitat
 * sobre el terra es dispara: l'anular del 2028 creua tota la Península en els
 * darrers 57 segons. Amb un pas d'un minut, tot el tram espanyol del límit cau
 * entre dues mostres i la cerca dona una direcció qualsevol — ho hem vist
 * passar, amb els dos límits sortint per la mateixa banda.
 *
 * Es resol en tres passades. La primera escombra gruixut i mesura la distància
 * al SEGMENT entre mostres consecutives, no a les mostres: així un tram de mil
 * quilòmetres encara diu si passa a prop teu. Les altres dues remostregen els
 * millors trams. Es queden tres candidats i no un perquè, quan la corba es
 * doblega, la corda d'un segment pot enganyar.
 */
const LIMIT_SEARCH_HALF_MS = 40 * 60 * 1000;
const LIMIT_COARSE_STEP_MS = 60 * 1000;
const LIMIT_REFINE_SAMPLES = 60;
const LIMIT_CANDIDATES = 3;

interface TimedPoint {
  timeMs: number;
  lat: number;
  lon: number;
}

/** Coordenades planes locals en km, amb origen a l'observador. */
function toLocalKm(
  origin: GeoLocation,
  lat: number,
  lon: number,
): { x: number; y: number } {
  let dLon = lon - origin.lon;
  dLon = ((((dLon + 180) % 360) + 360) % 360) - 180;
  return {
    x: dLon * kmPerDegLon((origin.lat + lat) / 2),
    y: (lat - origin.lat) * KM_PER_DEG_LAT,
  };
}

/** Distància de l'observador al segment que uneix dos punts del límit, en km. */
function distanceToSegmentKm(origin: GeoLocation, a: TimedPoint, b: TimedPoint): number {
  const p = toLocalKm(origin, a.lat, a.lon);
  const q = toLocalKm(origin, b.lat, b.lon);
  const vx = q.x - p.x;
  const vy = q.y - p.y;
  const len2 = vx * vx + vy * vy;
  if (len2 < 1e-12) return Math.hypot(p.x, p.y);
  // Projecció de l'origen sobre el segment, retallada als extrems.
  const t = Math.max(0, Math.min(1, -(p.x * vx + p.y * vy) / len2));
  return Math.hypot(p.x + t * vx, p.y + t * vy);
}

function sampleLimit(
  eclipseId: string,
  side: 'north' | 'south',
  timeMs: number,
): TimedPoint | null {
  const p = pathLimitsAt(eclipseId, timeMs)[side];
  return p === null ? null : { timeMs, lat: p.lat, lon: p.lon };
}

/** Mostreja un interval i en torna els punts vàlids, en ordre. */
function sampleRange(
  eclipseId: string,
  side: 'north' | 'south',
  fromMs: number,
  toMs: number,
  count: number,
): TimedPoint[] {
  const points: TimedPoint[] = [];
  for (let i = 0; i <= count; i++) {
    const p = sampleLimit(eclipseId, side, fromMs + ((toMs - fromMs) * i) / count);
    if (p !== null) points.push(p);
  }
  return points;
}

interface ScoredInterval {
  from: number;
  to: number;
  km: number;
}

/** Els `keep` trams més propers a l'observador, ordenats de més a prop a més lluny. */
function bestIntervals(
  origin: GeoLocation,
  points: TimedPoint[],
  keep: number,
): ScoredInterval[] {
  const scored: ScoredInterval[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    scored.push({
      from: points[i].timeMs,
      to: points[i + 1].timeMs,
      km: distanceToSegmentKm(origin, points[i], points[i + 1]),
    });
  }
  scored.sort((a, b) => a.km - b.km);
  return scored.slice(0, keep);
}

/**
 * Remostreja un tram i en torna el sub-tram més proper.
 *
 * Es fa tram a tram i mai barrejant candidats: si es tiressin totes les mostres
 * de tots els candidats a la mateixa llista, apareixerien segments que uneixen
 * la fi d'un candidat amb l'inici del següent. Aquests segments no existeixen a
 * la corba i poden guanyar la comparació.
 */
function refineInterval(
  eclipseId: string,
  side: 'north' | 'south',
  origin: GeoLocation,
  interval: ScoredInterval,
): ScoredInterval | null {
  const points = sampleRange(eclipseId, side, interval.from, interval.to, LIMIT_REFINE_SAMPLES);
  const inner = bestIntervals(origin, points, 1);
  return inner.length === 0 ? null : inner[0];
}

/**
 * Punt del límit publicat (nivell del mar) més proper a l'observador.
 * Torna null si en tota la finestra el límit no toca la Terra.
 */
export function nearestSeaLevelLimit(
  eclipseId: string,
  side: 'north' | 'south',
  location: GeoLocation,
  aroundMs: number,
): { point: PathPoint; km: number } | null {
  const coarse: TimedPoint[] = [];
  for (
    let t = aroundMs - LIMIT_SEARCH_HALF_MS;
    t <= aroundMs + LIMIT_SEARCH_HALF_MS;
    t += LIMIT_COARSE_STEP_MS
  ) {
    const p = sampleLimit(eclipseId, side, t);
    if (p !== null) coarse.push(p);
  }
  if (coarse.length === 0) return null;

  const candidates = bestIntervals(location, coarse, LIMIT_CANDIDATES);
  if (candidates.length === 0) {
    // Un sol instant vàlid a tota la finestra: no hi ha tram a refinar.
    const only = coarse[0];
    return {
      point: { lat: only.lat, lon: only.lon, timeMs: only.timeMs },
      km: approxDistanceKm(location.lat, location.lon, only.lat, only.lon),
    };
  }

  // Primera passada: cada candidat es refina pel seu compte i es competeix
  // amb la distància que en surt.
  let winner: ScoredInterval | null = null;
  for (const candidate of candidates) {
    const refined = refineInterval(eclipseId, side, location, candidate);
    if (refined !== null && (winner === null || refined.km < winner.km)) winner = refined;
  }
  if (winner === null) return null;

  // Segona passada sobre el guanyador. De pas gruixut d'un minut es baixa a
  // desenes de mil·lisegons, molt per sota del que la vora del límit es mou.
  winner = refineInterval(eclipseId, side, location, winner) ?? winner;

  // El resultat que es publica és la distància a un PUNT mostrejat de veritat,
  // mai a la corda d'un segment: així no pot sortir més curta del que és.
  const finals = sampleRange(eclipseId, side, winner.from, winner.to, LIMIT_REFINE_SAMPLES);
  let best: TimedPoint | null = null;
  let bestKm = Infinity;
  for (const p of finals) {
    const km = approxDistanceKm(location.lat, location.lon, p.lat, p.lon);
    if (km < bestKm) {
      bestKm = km;
      best = p;
    }
  }
  if (best === null) return null;
  return { point: { lat: best.lat, lon: best.lon, timeMs: best.timeMs }, km: bestKm };
}

/**
 * Quin dels dos límits queda en la direcció donada.
 *
 * No es decideix per latitud ni comparant distàncies: es fa servir el mateix
 * conveni que `pathLimitsAt`, que el límit nord és el que queda a l'ESQUERRA
 * del sentit de marxa de l'ombra. Amb el Sol molt baix el punt de tangència
 * «nord» pot quedar més al sud que la línia central del moment, i qualsevol
 * regla basada en la latitud s'hi equivoca.
 */
function limitSideTowards(
  eclipseId: string,
  outwardBearing: number,
  aroundMs: number,
): 'north' | 'south' {
  const before = centralLineAt(eclipseId, aroundMs - 60_000);
  const after = centralLineAt(eclipseId, aroundMs + 60_000);
  if (before === null || after === null) {
    // Sense sentit de marxa no hi ha esquerra ni dreta; el nord geogràfic és
    // l'única cosa que queda, i és el cas degenerat.
    return outwardBearing < 90 || outwardBearing > 270 ? 'north' : 'south';
  }
  const travel = bearingDeg(before.lat, before.lon, after.lat, after.lon);
  // El costat nord és a 90° a l'esquerra del sentit de marxa.
  const northSide = (travel - 90 + 360) % 360;
  // Diferència angular absoluta entre els dos rumbs, reduïda a [0°, 180°].
  const delta = Math.abs(((outwardBearing - northSide + 540) % 360) - 180);
  return delta <= 90 ? 'north' : 'south';
}

// ---------------------------------------------------------------------------
// Càlcul principal
// ---------------------------------------------------------------------------

export function computeUncertainty(
  eclipseId: string,
  circumstances: LocalCircumstances,
  options: UncertaintyOptions = {},
): EclipseUncertainty {
  const atmosphere = options.atmosphere ?? circumstances.atmosphere;
  const location = circumstances.location;
  const sigma = RELATIVE_POSITION_ERROR_ARCSEC;

  const max = circumstances.contacts.max;
  const maxMs = max.time.getTime();

  const rate = relativeRateArcsecPerSec(location, maxMs, atmosphere);

  // m i L, els dos números de què penja tota la geometria (secció 4).
  const impact = max.separation * 3600;
  const umbralMarginArcsec = circumstances.umbralMarginArcsec;
  const limitRadius = impact - umbralMarginArcsec;

  // ── Hores de contacte ────────────────────────────────────────────────────
  const contactHalfWidthSec = rate > 0 ? sigma / rate : 0;

  // ── Durada de la fase central ────────────────────────────────────────────
  const modelled = chordSeconds(impact, limitRadius, rate);
  const modelledMin = chordSeconds(impact + sigma, limitRadius, rate);
  const modelledMax = chordSeconds(Math.max(0, impact - sigma), limitRadius, rate);

  // L'interval s'ancora a la durada que dona el motor, no a la del model: el
  // model la reprodueix a la dècima de segon, però la xifra que l'usuari veu
  // arreu ha de ser una de sola.
  const centralDurationSec = circumstances.centralDurationSec;
  const scale = modelled > 0 ? centralDurationSec / modelled : 1;
  const centralDurationMinSec = modelledMin * scale;
  const centralDurationMaxSec = modelledMax * scale;

  // ── Confiança ────────────────────────────────────────────────────────────
  const centralProbability = centralProbabilityFromMargin(umbralMarginArcsec, sigma);
  const confidence = classify(centralProbability);
  const centralPhaseUncertain = centralProbability > 0 && centralProbability < 1;

  // ── Traducció a terreny ──────────────────────────────────────────────────
  const gradient = marginGradient(eclipseId, location, atmosphere, impact);
  const limitUncertaintyKm = gradient.magnitude > 1e-6 ? sigma / gradient.magnitude : Infinity;

  const limit = buildLimit({
    eclipseId,
    location,
    maxMs,
    umbralMarginArcsec,
    limitRadius,
    gradient,
    sunAltitudeDeg: max.sun.altitudeApparent,
    sunAzimuthDeg: max.sun.azimuth,
    locate: options.locateSeaLevelLimit !== false,
  });

  // ── Què s'ha de dir, si és que s'ha de dir res ───────────────────────────
  const spread = Math.max(
    centralDurationMaxSec - centralDurationSec,
    centralDurationSec - centralDurationMinSec,
  );
  const durationUncertain =
    centralDurationSec > 0 &&
    spread >= NOTABLE_SPREAD_SEC &&
    spread >= NOTABLE_SPREAD_FRACTION * centralDurationSec;

  const notable = centralPhaseUncertain || durationUncertain;

  // Per deixar de dependre de l'error cal ser a més de σ del límit. Si ets a
  // dins, són els km que et falten; si ets a fora, els que et falten més la
  // distància fins al límit.
  let kmToCertainty: number | null = null;
  if (centralPhaseUncertain && limit !== null && Number.isFinite(limitUncertaintyKm)) {
    kmToCertainty = limit.inside
      ? Math.max(0, limitUncertaintyKm - limit.km)
      : limitUncertaintyKm + limit.km;
  }

  const uncertainty: EclipseUncertainty = {
    eclipseId,
    location,
    relativeErrorArcsec: sigma,
    relativeRateArcsecPerSec: rate,
    marginGradientArcsecPerKm: gradient.magnitude,
    limitUncertaintyKm,
    contactHalfWidthSec,
    centralDurationSec,
    centralDurationMinSec,
    centralDurationMaxSec,
    umbralMarginArcsec,
    centralProbability,
    confidence,
    limit,
    centralPhaseUncertain,
    durationUncertain,
    notable,
    kmToCertainty,
    summary: null,
  };

  uncertainty.summary = describeUncertainty(uncertainty);
  return uncertainty;
}

function buildLimit(input: {
  eclipseId: string;
  location: GeoLocation;
  maxMs: number;
  umbralMarginArcsec: number;
  limitRadius: number;
  gradient: { northward: number; eastward: number; magnitude: number };
  sunAltitudeDeg: number;
  sunAzimuthDeg: number;
  locate: boolean;
}): BandLimitDistance | null {
  const { gradient } = input;
  if (gradient.magnitude < 1e-6) return null;

  // El gradient del marge apunta cap enfora de la franja: el marge creix cap
  // als dos límits i és mínim a la línia central. El límit més proper és doncs
  // el que queda en aquesta direcció, hi siguis a dins o a fora.
  const outwardBearing =
    ((Math.atan2(gradient.eastward, gradient.northward) * RAD) % 360 + 360) % 360;
  const inside = input.umbralMarginArcsec < 0;
  const km = Math.abs(input.umbralMarginArcsec) / gradient.magnitude;

  const side = limitSideTowards(input.eclipseId, outwardBearing, input.maxMs);
  // Ets a `km` d'un límit i a l'amplada sencera menys `km` de l'altre.
  const bandWidthKm = (2 * input.limitRadius) / gradient.magnitude;

  // Component a través de la franja del desplaçament per cota (vegeu el
  // comentari de `elevationShiftKm`).
  const elevationShiftKm =
    input.sunAltitudeDeg > 0.1 && input.location.elevation > 0
      ? ((input.location.elevation / Math.tan(input.sunAltitudeDeg * DEG)) / 1000) *
        Math.cos((input.sunAzimuthDeg - outwardBearing) * DEG)
      : 0;

  let seaLevelPoint: PathPoint | null = null;
  let seaLevelKm: number | null = null;
  if (input.locate) {
    const found = nearestSeaLevelLimit(input.eclipseId, side, input.location, input.maxMs);
    if (found !== null) {
      seaLevelPoint = found.point;
      seaLevelKm = found.km;
    }
  }

  return {
    side,
    inside,
    km,
    bearingDeg: inside ? outwardBearing : (outwardBearing + 180) % 360,
    inwardBearingDeg: (outwardBearing + 180) % 360,
    bandWidthKm,
    seaLevelPoint,
    seaLevelKm,
    elevationShiftKm,
  };
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function formatKm(km: number): string {
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}

function formatSeconds(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

/** La provenença de la xifra. Es diu sempre que es diu la incertesa. */
const ERROR_PROVENANCE =
  'Les efemèrides que fem servir tenen un error de posició relativa Sol-Lluna de' +
  ' 2 segons d’arc, mesurat contra JPL Horizons en dos eclipsis.';

/**
 * Text en català, llest per ensenyar. Null quan no s'ha de dir res.
 *
 * Amb el gradient de durada el text queda complet: on ets, què no sabem, i què
 * has de fer. Sense, es queda al que no sabem.
 */
export function describeUncertainty(
  uncertainty: EclipseUncertainty,
  gradient?: DurationGradient | null,
): string | null {
  if (!uncertainty.notable) return null;

  const central =
    getEclipse(uncertainty.eclipseId).kind === 'annular' ? 'anularitat' : 'totalitat';
  const limit = uncertainty.limit;
  const parts: string[] = [];

  if (limit !== null) {
    const side = limit.side === 'north' ? 'nord' : 'sud';
    parts.push(
      limit.inside
        ? `Ets a ${formatKm(limit.km)} del límit ${side} de la franja.`
        : `Ets a ${formatKm(limit.km)} del límit ${side} de la franja, per fora.`,
    );
  }

  if (uncertainty.centralPhaseUncertain) {
    parts.push(
      Number.isFinite(uncertainty.limitUncertaintyKm)
        ? `${ERROR_PROVENANCE} Sobre el terreny, aquí són ${formatKm(uncertainty.limitUncertaintyKm)}:` +
            ' la vora de la franja pot caure a banda i banda d’on la dibuixem.'
        : ERROR_PROVENANCE,
    );
    parts.push(
      limit !== null && !limit.inside
        ? `Des d’aquest punt no podem descartar la ${central}, ni assegurar-la.`
        : `Des d’aquest punt no podem assegurar que hi hagi ${central}.`,
    );
  } else if (uncertainty.durationUncertain) {
    parts.push(`La ${central} hi dura ${formatSeconds(uncertainty.centralDurationSec)}.`);
    parts.push(
      `${ERROR_PROVENANCE} Aquí deixa la durada entre` +
        ` ${formatSeconds(uncertainty.centralDurationMinSec)} i` +
        ` ${formatSeconds(uncertainty.centralDurationMaxSec)}.`,
    );
  }

  const advice = buildAdvice(uncertainty, gradient ?? null, central);
  if (advice !== null) parts.push(advice);

  return parts.join(' ');
}

/**
 * Precisió de les hores de contacte, en text.
 *
 * NO entra mai a `summary`, i és a propòsit. El desplaçament és el mateix per a
 * tothom, no canvia cap decisió i ningú no nota quatre segons: dir-ho al costat
 * del compte enrere només faria soroll. Aquesta funció és per a una pantalla de
 * metodologia o un peu de pàgina, on algú el vulgui saber.
 *
 * La semiamplada s'arrodoneix cap amunt al segon sencer: σ/ω es queda una mica
 * curta contra els desplaçaments que hem mesurat de veritat (−3,6 a −3,9 s el
 * 2026, +4,4 s el 2024), i val més passar-se que quedar-se curt.
 */
export function describeContactPrecision(uncertainty: EclipseUncertainty): string {
  const seconds = Math.ceil(uncertainty.contactHalfWidthSec);
  return (
    `Les hores de contacte tenen un marge de ${seconds} s. ${ERROR_PROVENANCE}` +
    ` A ${uncertainty.relativeRateArcsecPerSec.toFixed(2).replace('.', ',')} segons d’arc` +
    ' per segon de moviment relatiu, són aquests segons. El desplaçament és el' +
    ' mateix per a tots els contactes: no altera cap durada.'
  );
}

function buildAdvice(
  uncertainty: EclipseUncertainty,
  gradient: DurationGradient | null,
  central: string,
): string | null {
  const limit = uncertainty.limit;
  if (limit === null) return null;

  // El rumb del consell és el que apunta cap endins de la franja. Ha de
  // coincidir amb el del gradient de durada, que apunta sol cap a la línia
  // central; si el tenim, mana el mesurat.
  const bearing = gradient?.bearingDeg ?? limit.inwardBearingDeg;
  const cardinal = bearingToCardinal(bearing, 'ca');

  if (uncertainty.kmToCertainty !== null && uncertainty.kmToCertainty > 0.05) {
    const km = formatKm(uncertainty.kmToCertainty);
    return `Amb ${km} cap al ${cardinal} la resposta deixa de dependre d’aquest error.`;
  }

  if (uncertainty.durationUncertain && gradient !== null && gradient.worthMoving) {
    return (
      `Cap al ${cardinal} guanyes ${gradient.secondsPerKm.toFixed(1).replace('.', ',')} s` +
      ` de ${central} per quilòmetre.`
    );
  }

  return null;
}
