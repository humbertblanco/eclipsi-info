/**
 * Càlcul dels contactes C1-C4 i de les circumstàncies locals.
 *
 * Enfocament: en comptes d'implementar la teoria besseliana, resolem
 * directament l'equació de la separació angular. És més senzill de validar,
 * funciona igual per a qualsevol punt del planeta i per a qualsevol eclipsi del
 * catàleg, i no depèn de tenir els elements besselians tabulats de cada
 * esdeveniment.
 *
 *   C1, C4:  sep(t) = R☉ + R☾      (els discos es toquen exteriorment)
 *   C2, C3:  sep(t) = |R☉ − R☾|    (un disc és tangent interior a l'altre)
 *   Màxim:   mínim de sep(t)
 *
 * Els elements besselians es reserven per generar la franja de totalitat al
 * mapa, on sí que són molt més barats que fer això milers de vegades.
 *
 * ── FINS ON ARRIBA LA PRECISIÓ D'AQUEST MÒDUL ────────────────────────────────
 *
 * NO BUSQUIS UN ERROR ALS ~3,5 SEGONS QUE ENS SEPAREN DE L'IGN: no n'hi ha cap.
 * És el sostre d'`astronomy-engine` i està mesurat.
 *
 * Comparant les posicions aparents topocèntriques que ens dona la biblioteca
 * amb les de JPL Horizons (efemèrides DE441, que són la referència):
 *
 *   12-08-2026, des de Sòria, A Coruña i Madrigal de las Altas Torres
 *      error de posició de la Lluna   ~1,05″
 *      error de posició del Sol       ~1,40″
 *      error de la posició RELATIVA   (+1,54″, −1,34″)
 *      → desplaçament previst −3,3 s · mesurat −3,6 a −3,9 s
 *
 *   08-04-2024, des de la línia central a Mèxic
 *      error de la posició RELATIVA   (−1,89″, −0,95″)
 *      → desplaçament previst +4,95 s · mesurat +4,4 s (contra Horizons)
 *
 * El que compta és l'error RELATIU, perquè un eclipsi només depèn d'on és la
 * Lluna respecte del Sol. Es tradueix a temps dividint la seva component al
 * llarg del moviment relatiu per la velocitat relativa (0,4-0,6″/s segons
 * l'eclipsi). Els números previstos i els mesurats quadren en els dos casos.
 *
 * Dues coses a retenir. Dins d'un mateix eclipsi l'error és PLA (varia menys de
 * 0,05″ en quatre minuts): és un biaix sistemàtic, no soroll. Però entre
 * eclipsis canvia de mòdul i de SIGNE, o sigui que no es pot compensar amb una
 * constant. Corregir-ho de debò demanaria una biblioteca amb DE440/DE441; no hi
 * ha res a tocar aquí.
 *
 * Les dues causes que SÍ que eren nostres ja estan corregides i valien molt
 * més: el radi lunar dels contactes umbrals (vegeu `constants.ts`) i el model
 * de ΔT (vegeu `deltaT.ts`).
 *
 * ── ON AIXÒ ES NOTA DE VERITAT: EL CAIRE DE LA FRANJA ────────────────────────
 *
 * Al bell mig de la franja, 3,5 s de desviació no els nota ningú. Al caire, sí:
 * allà la totalitat dura pocs segons i el marge geomètric que separa veure-la
 * de no veure-la és de dècimes de segon d'arc — menys que el nostre error de
 * posició relativa. Resultat: hi ha una franja d'uns 2-3 km a cada vora on
 * aquest motor NO pot dir amb fiabilitat si hi haurà totalitat o no.
 *
 * Als 12 municipis del caire que fem servir per validar, l'IGN en dona 12 amb
 * totalitat i nosaltres n'encertem 5. La resta ens surten parcials per un
 * marge d'entre 0,13″ i 0,22″. No és un error del codi: és el límit físic de
 * les efemèrides que tenim. Qui presenti aquesta informació a l'usuari hauria
 * de dir-li que a la vora de la franja la predicció té incertesa, en comptes
 * de donar un sí o un no que no ens podem permetre.
 */

import { STANDARD_ATMOSPHERE, STANDARD_SUNSET_ALTITUDE_DEG } from './constants';
import { sampleAt, separationMinusLimit } from './ephemeris';
import { getEclipse } from '../eclipses/catalog';
import type {
  Atmosphere,
  Contacts,
  EclipseKind,
  EclipseSample,
  GeoLocation,
  LocalCircumstances,
} from './types';

/**
 * Error de posició relativa Sol-Lluna d'`astronomy-engine`, en segons d'arc.
 *
 * Mesurat contra JPL Horizons (DE441) en dos eclipsis independents: (+1,54″,
 * −1,34″) el 2026 i (−1,89″, −0,95″) el 2024. Dins d'un mateix eclipsi és un
 * biaix pla, no soroll — però canvia de signe entre eclipsis, així que no es
 * pot compensar amb cap constant.
 *
 * Serveix per saber quan NO podem decidir si hi haurà fase central.
 */
const RELATIVE_POSITION_ERROR_ARCSEC = 2.0;

/** Mitja amplada de la finestra de cerca al voltant del màxim global. */
const SEARCH_WINDOW_MS = 6 * 3600 * 1000;
/** Pas del escombrat gruixut. Cap contacte pot passar desapercebut a 30 s. */
const COARSE_STEP_MS = 30 * 1000;
/** Precisió objectiu de la bisecció, en mil·lisegons. */
const REFINE_TOLERANCE_MS = 1;

/**
 * Bisecció sobre un interval on la funció canvia de signe.
 * No cal res més sofisticat: cada iteració val dues crides a efemèrides i amb
 * un bracket de 30 s n'hi ha prou amb ~15 iteracions per baixar del mil·lisegon.
 */
function bisect(
  f: (tMs: number) => number,
  loMs: number,
  hiMs: number,
): number {
  let lo = loMs;
  let hi = hiMs;
  let fLo = f(lo);

  for (let i = 0; i < 60 && hi - lo > REFINE_TOLERANCE_MS; i++) {
    const mid = (lo + hi) / 2;
    const fMid = f(mid);
    if (fMid === 0) return mid;
    if (fLo < 0 === fMid < 0) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Cerca ternària del mínim de la separació angular.
 *
 * Important: minimitzem la SEPARACIÓ, no la magnitud. Durant la totalitat la
 * magnitud es queda plana (val R☾/R☉ constant mentre un disc conté l'altre) i
 * una cerca ternària sobre una funció plana no convergeix a res útil. La
 * separació, en canvi, és estrictament unimodal al voltant del màxim.
 */
function findMinimumSeparation(
  location: GeoLocation,
  loMs: number,
  hiMs: number,
): number {
  const sep = (tMs: number) => separationMinusLimit(tMs, location, false);

  let lo = loMs;
  let hi = hiMs;
  for (let i = 0; i < 100 && hi - lo > REFINE_TOLERANCE_MS; i++) {
    const a = lo + (hi - lo) / 3;
    const b = hi - (hi - lo) / 3;
    if (sep(a) < sep(b)) hi = b;
    else lo = a;
  }
  return (lo + hi) / 2;
}

/**
 * Busca el primer canvi de signe de `f` recorrent l'interval amb pas gruixut,
 * i el refina.
 * @param descending si és cert busquem el pas de positiu a negatiu (C1, C2);
 *                   si no, de negatiu a positiu (C3, C4)
 */
function findCrossing(
  f: (tMs: number) => number,
  fromMs: number,
  toMs: number,
  descending: boolean,
): number | undefined {
  const step = fromMs < toMs ? COARSE_STEP_MS : -COARSE_STEP_MS;
  let prevT = fromMs;
  let prevF = f(prevT);

  const done = (t: number) => (step > 0 ? t > toMs : t < toMs);

  for (let t = fromMs + step; !done(t); t += step) {
    const curF = f(t);
    const crossed = descending ? prevF > 0 && curF <= 0 : prevF < 0 && curF >= 0;
    // El signe de la funció no depèn de la direcció del recorregut, així que
    // acceptem qualsevol canvi de signe dins del bracket.
    if (crossed || (prevF < 0) !== (curF < 0)) {
      const lo = Math.min(prevT, t);
      const hi = Math.max(prevT, t);
      return bisect(f, lo, hi);
    }
    prevT = t;
    prevF = curF;
  }
  return undefined;
}

/**
 * Circumstàncies locals completes de l'eclipsi per a un punt concret.
 *
 * Tot — hores, magnitud, obscuració, durada i altura del Sol — surt d'aquí i
 * depèn només de (lat, lon, altitud). No hi ha cap taula de ciutats: si et
 * mous cinc quilòmetres, tot es recalcula.
 */
export function computeLocalCircumstances(
  eclipseId: string,
  location: GeoLocation,
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): LocalCircumstances {
  const eclipse = getEclipse(eclipseId);
  const centerMs = new Date(eclipse.greatestEclipseUtc).getTime();
  const windowStart = centerMs - SEARCH_WINDOW_MS;
  const windowEnd = centerMs + SEARCH_WINDOW_MS;

  const outer = (tMs: number) => separationMinusLimit(tMs, location, false);
  const inner = (tMs: number) => separationMinusLimit(tMs, location, true);

  const maxMs = findMinimumSeparation(location, windowStart, windowEnd);
  const max = sampleAt(new Date(maxMs), location, atmosphere);

  // Si al moment de màxima aproximació els discos encara no es toquen, des
  // d'aquest punt no hi ha eclipsi de cap mena.
  if (outer(maxMs) > 0) {
    return {
      eclipseId,
      location,
      atmosphere,
      kind: 'none',
      contacts: { max },
      centralDurationSec: 0,
      partialDurationSec: 0,
      sunBelowHorizonDuringEvent: false,
      umbralMarginArcsec: inner(maxMs) * 3600,
      edgeUncertain: false,
    };
  }

  const c1Ms = findCrossing(outer, maxMs, windowStart, false);
  const c4Ms = findCrossing(outer, maxMs, windowEnd, false);

  let kind: EclipseKind = 'partial';
  let c2Ms: number | undefined;
  let c3Ms: number | undefined;

  if (inner(maxMs) <= 0) {
    kind = max.moon.angularRadius >= max.sun.angularRadius ? 'total' : 'annular';
    c2Ms = findCrossing(inner, maxMs, windowStart, false);
    c3Ms = findCrossing(inner, maxMs, windowEnd, false);
  }

  const s = (ms: number | undefined): EclipseSample | undefined =>
    ms === undefined ? undefined : sampleAt(new Date(ms), location, atmosphere);

  const contacts: Contacts = {
    c1: s(c1Ms),
    c2: s(c2Ms),
    max,
    c3: s(c3Ms),
    c4: s(c4Ms),
  };

  const centralDurationSec =
    c2Ms !== undefined && c3Ms !== undefined ? (c3Ms - c2Ms) / 1000 : 0;
  const partialDurationSec =
    c1Ms !== undefined && c4Ms !== undefined ? (c4Ms - c1Ms) / 1000 : 0;

  const phases = [contacts.c1, contacts.c2, max, contacts.c3, contacts.c4].filter(
    (p): p is EclipseSample => p !== undefined,
  );
  const sunBelowHorizonDuringEvent = phases.some(
    (p) => p.sun.altitudeApparent < 0,
  );

  // Distància al límit de la franja, expressada com el marge umbral al màxim.
  const umbralMarginArcsec = inner(maxMs) * 3600;

  // Si el marge és més petit que l'error de les efemèrides, la resposta que
  // donaríem seria una moneda a l'aire. Val més dir-ho.
  //
  // Aquesta és també la franja on el motor es podria contradir sol: `kind` surt
  // del radi lunar UMBRAL i la magnitud del PENOMBRAL, i entre els dos hi ha
  // ~0,8″. Sense aquest indicador, la interfície podria arribar a ensenyar
  // «parcial» al costat d'un 100% d'obscuració.
  const edgeUncertain =
    Math.abs(umbralMarginArcsec) < RELATIVE_POSITION_ERROR_ARCSEC;

  return {
    eclipseId,
    location,
    atmosphere,
    kind,
    contacts,
    centralDurationSec,
    partialDurationSec,
    sunBelowHorizonDuringEvent,
    umbralMarginArcsec,
    edgeUncertain,
  };
}

/**
 * Instant de la posta de Sol astronòmica (centre del disc a -0,833°).
 *
 * És només una referència: la posta REAL des d'un lloc concret la determina el
 * perfil d'horitzó del terreny, que sovint arriba molt abans. En un eclipsi amb
 * el Sol a 3° d'altura, la diferència entre la posta teòrica i la que et dona
 * una serralada a l'oest pot ser de mitja hora.
 */
export function findSunset(
  location: GeoLocation,
  aroundUtc: Date,
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): Date | undefined {
  const f = (tMs: number) =>
    sampleAt(new Date(tMs), location, atmosphere).sun.altitudeTrue -
    STANDARD_SUNSET_ALTITUDE_DEG;

  const start = aroundUtc.getTime() - 6 * 3600 * 1000;
  const end = aroundUtc.getTime() + 12 * 3600 * 1000;

  const step = 5 * 60 * 1000;
  let prevT = start;
  let prevF = f(prevT);
  for (let t = start + step; t < end; t += step) {
    const curF = f(t);
    if (prevF > 0 && curF <= 0) return new Date(bisect(f, prevT, t));
    prevT = t;
    prevF = curF;
  }
  return undefined;
}
