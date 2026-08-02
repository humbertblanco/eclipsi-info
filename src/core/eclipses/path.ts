/**
 * Generació de la franja de centralitat (totalitat o anularitat) a partir dels
 * elements besselians.
 *
 * Mètode: Meeus, *Astronomical Algorithms*, cap. 54-55, i l'*Explanatory
 * Supplement to the Astronomical Almanac*, §8.36. Aquí no s'escombra el
 * territori punt a punt: es fa la inversa, que és el que fa barata la via
 * besseliana. Per a cada instant es resol on cau l'eix de l'ombra i on l'ombra
 * és tangent a la superfície, i el resultat ja és directament la franja.
 *
 * Zero dependències del DOM: aquest mòdul ha de córrer igual a Node (els tests
 * el validen contra les taules de la NASA) i al navegador.
 *
 * ATRIBUCIÓ OBLIGATÒRIA de les dades d'entrada:
 * "Eclipse Predictions by Fred Espenak, NASA's GSFC".
 *
 * ---
 *
 * Dues coses que, si es fan malament, desplacen la franja quilòmetres:
 *
 * 1. GEODÈSIA. El pla fonamental besselià treballa amb la Terra com a esferoide
 *    aplanat. Un observador hi entra amb ρ·sin φ' i ρ·cos φ' (coordenades
 *    GEOCÈNTRIQUES), no amb la latitud geodèsica. Tractar la Terra com una
 *    esfera introdueix un error de fins a ~20 km a latituds mitjanes, perquè
 *    φ − φ' arriba a 11,5'. La transformació clàssica (η₁ = η/ρ₁, angle
 *    auxiliar d₁) converteix l'el·lipsoide en una esfera unitat i deixa
 *    l'aritmètica tan senzilla com el cas esfèric, però correcta.
 *
 * 2. TDT ↔ UT. Els elements estan tabulats en TDT. La Terra, en canvi, gira
 *    segons UT. La longitud geogràfica surt de la longitud referida al
 *    "meridià efemèride" més la rotació terrestre durant ΔT. Amb ΔT mal posat,
 *    tota la franja llisca en longitud: 4 s de ΔT ja són ~50 km.
 */

import { BESSELIAN, evalPoly, type BesselianElements } from './besselian';
import { getEclipse } from './catalog';
import type { Feature, LineString, MultiLineString, Polygon } from 'geojson';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/**
 * Raó entre el semieix polar i l'equatorial de la WGS84 (b/a = 1 − f).
 * És el factor que converteix la latitud geodèsica en la reduïda.
 */
const POLAR_RATIO = 0.996647189335;
/** Primera excentricitat al quadrat de la WGS84. */
const ECC_SQUARED = 1 - POLAR_RATIO * POLAR_RATIO;

/**
 * Rotació de la Terra en graus per cada segon de ΔT.
 * 1,00273791 és la raó entre el dia solar i el sidèria: la Terra gira
 * 360,9856°/dia respecte de les estrelles, no 360°.
 */
const EARTH_ROTATION_DEG_PER_SEC = (1.00273791 * 15) / 3600;

/** Radi mitjà terrestre (IUGG R1), només per mesurar distàncies entre punts. */
const EARTH_MEAN_RADIUS_KM = 6371.0088;

/** Un punt de la franja, amb l'instant en què hi passa l'ombra. */
export interface PathPoint {
  /** Latitud geodèsica WGS84, en graus nord. */
  lat: number;
  /**
   * Longitud geogràfica en graus est.
   * Dins d'una polilínia NO està reduïda a ±180°: es desenrotlla perquè el
   * traçat sigui continu i no aparegui una ratlla travessant tot el mapa quan
   * la franja creua l'antimeridià.
   */
  lon: number;
  /** Instant UT en què l'ombra hi passa, en ms des de l'època Unix. */
  timeMs: number;
}

export interface EclipsePath {
  eclipseId: string;
  kind: 'total' | 'annular';
  /** Línia central: on cau l'eix de l'ombra. */
  center: PathPoint[];
  /** Límit nord de la franja. */
  northLimit: PathPoint[];
  /** Límit sud de la franja. */
  southLimit: PathPoint[];
  /** Primer i darrer contacte de l'ombra central amb la Terra, en ms UT. */
  startMs: number;
  endMs: number;
}

export interface PathOptions {
  /**
   * Pas del mostreig temporal, en segons. Per defecte 60 s, que sobre Espanya
   * dona un punt cada ~60 km de franja: prou per dibuixar-la suau a qualsevol
   * escala útil en un mòbil.
   */
  stepSeconds?: number;
}

// ---------------------------------------------------------------------------
// Avaluació dels elements
// ---------------------------------------------------------------------------

interface EvaluatedElements {
  /** Coordenades de l'eix de l'ombra al pla fonamental, en radis equatorials. */
  x: number;
  y: number;
  /** Declinació de l'eix de l'ombra. */
  sinD: number;
  cosD: number;
  /** Angle horari efemèride, en graus. */
  mu: number;
  /** Radi del con d'ombra al pla fonamental (negatiu = eclipsi total). */
  l2: number;
  /** Factors de la transformació esferoide → esfera. */
  rho1: number;
  sinD1: number;
  cosD1: number;
}

function evaluateAt(el: BesselianElements, tdtHours: number): EvaluatedElements {
  const t = tdtHours - el.t0;
  const d = evalPoly(el.d, t) * DEG;
  const sinD = Math.sin(d);
  const cosD = Math.cos(d);

  // ρ₁ i l'angle auxiliar d₁: aplanen l'el·lipsoide fins a fer-lo una esfera
  // unitat en el sistema (ξ, η₁, ζ₁). Vegeu Meeus cap. 54.
  const rho1 = Math.sqrt(1 - ECC_SQUARED * cosD * cosD);

  return {
    x: evalPoly(el.x, t),
    y: evalPoly(el.y, t),
    sinD,
    cosD,
    mu: evalPoly(el.mu, t),
    l2: evalPoly(el.l2, t),
    rho1,
    sinD1: sinD / rho1,
    cosD1: (POLAR_RATIO * cosD) / rho1,
  };
}

function elementsFor(eclipseId: string): BesselianElements {
  const el = BESSELIAN[eclipseId];
  if (!el) throw new Error(`No hi ha elements besselians per a l'eclipsi ${eclipseId}`);
  return el;
}

/**
 * Instant UT (ms Unix) corresponent a una hora TDT del dia de l'eclipsi.
 *
 * L'identificador del catàleg és la data UTC de l'eclipsi i t0 és una hora TDT
 * d'aquesta mateixa data — per als tres eclipsis del catàleg la conversió mai
 * no salta de dia, així que n'hi ha prou amb restar ΔT.
 */
function tdtHoursToUtcMs(eclipseId: string, el: BesselianElements, tdtHours: number): number {
  const [year, month, day] = eclipseId.split('-').map(Number);
  const midnight = Date.UTC(year, month - 1, day);
  return midnight + (tdtHours - el.deltaT / 3600) * 3600 * 1000;
}

function utcMsToTdtHours(eclipseId: string, el: BesselianElements, utcMs: number): number {
  const [year, month, day] = eclipseId.split('-').map(Number);
  const midnight = Date.UTC(year, month - 1, day);
  return (utcMs - midnight) / 3600000 + el.deltaT / 3600;
}

// ---------------------------------------------------------------------------
// Geometria: superfície ↔ pla fonamental
// ---------------------------------------------------------------------------

interface SurfacePoint {
  lat: number;
  /** Longitud est reduïda a [−180°, 180°). */
  lon: number;
  /** Distància del punt al pla fonamental, en radis equatorials. */
  zeta: number;
}

/**
 * Punt de la superfície de la Terra que hi ha «sota» les coordenades (ξ, η) del
 * pla fonamental, és a dir el de la cara il·luminada (ζ > 0).
 *
 * Retorna null si (ξ, η) cau fora del disc terrestre.
 */
function surfacePoint(
  ev: EvaluatedElements,
  deltaT: number,
  xi: number,
  eta: number,
): SurfacePoint | null {
  const eta1 = eta / ev.rho1;
  const zeta1Sq = 1 - xi * xi - eta1 * eta1;
  if (zeta1Sq < 0) return null;
  const zeta1 = Math.sqrt(zeta1Sq);

  // En el sistema aplanat, l'angle "u" és la latitud reduïda i θ l'angle horari
  // respecte del meridià efemèride.
  const sinU = eta1 * ev.cosD1 + zeta1 * ev.sinD1;
  const cosUcosTheta = zeta1 * ev.cosD1 - eta1 * ev.sinD1;
  const theta = Math.atan2(xi, cosUcosTheta) * RAD;
  const u = Math.asin(Math.min(1, Math.max(-1, sinU)));

  // De latitud reduïda a geodèsica: tan u = (b/a) · tan φ.
  const lat = Math.atan2(Math.sin(u), POLAR_RATIO * Math.cos(u)) * RAD;

  // ζ real (sense aplanar), que és el que cal per corregir el radi del con.
  const zeta = POLAR_RATIO * sinU * ev.sinD + cosUcosTheta * ev.cosD;

  return { lat, lon: normalizeLon(theta - ev.mu + EARTH_ROTATION_DEG_PER_SEC * deltaT), zeta };
}

/** Coordenades (ξ, η, ζ) d'un punt geodèsic al pla fonamental. */
function fundamentalCoords(
  ev: EvaluatedElements,
  deltaT: number,
  lat: number,
  lon: number,
): { xi: number; eta: number; zeta: number } {
  const u = Math.atan(POLAR_RATIO * Math.tan(lat * DEG));
  const rhoCos = Math.cos(u);
  const rhoSin = POLAR_RATIO * Math.sin(u);
  const theta = (ev.mu - EARTH_ROTATION_DEG_PER_SEC * deltaT + lon) * DEG;
  const cosTheta = Math.cos(theta);

  return {
    xi: rhoCos * Math.sin(theta),
    eta: rhoSin * ev.cosD - rhoCos * cosTheta * ev.sinD,
    zeta: rhoSin * ev.sinD + rhoCos * cosTheta * ev.cosD,
  };
}

/**
 * Funció d'ombra: negativa dins de l'ombra central, zero al seu contorn.
 *
 * És la distància al quadrat entre el punt i l'eix de l'ombra, menys el radi
 * del con a l'altura ζ del punt. El radi es contreu amb ζ perquè el con
 * convergeix cap al vèrtex.
 */
function shadowFunction(
  el: BesselianElements,
  ev: EvaluatedElements,
  lat: number,
  lon: number,
): number {
  const p = fundamentalCoords(ev, el.deltaT, lat, lon);
  const radius = ev.l2 - p.zeta * el.tanF2;
  const dx = p.xi - ev.x;
  const dy = p.eta - ev.y;
  return dx * dx + dy * dy - radius * radius;
}

function normalizeLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

// ---------------------------------------------------------------------------
// Línia central
// ---------------------------------------------------------------------------

/**
 * Punt de la línia central en un instant UT: on l'eix de l'ombra talla la
 * superfície. Retorna null si en aquell moment l'eix no toca la Terra.
 */
export function centralLineAt(eclipseId: string, utcMs: number): PathPoint | null {
  const el = elementsFor(eclipseId);
  const ev = evaluateAt(el, utcMsToTdtHours(eclipseId, el, utcMs));
  // L'eix té ξ = x i η = y per definició: és paral·lel a l'eix ζ.
  const p = surfacePoint(ev, el.deltaT, ev.x, ev.y);
  return p === null ? null : { lat: p.lat, lon: p.lon, timeMs: utcMs };
}

// ---------------------------------------------------------------------------
// Límits nord i sud
// ---------------------------------------------------------------------------

/**
 * Punt del contorn de l'ombra a l'angle ψ, projectat sobre la superfície.
 *
 * El radi del con depèn de ζ i ζ depèn del punt, així que cal iterar.
 *
 * La llavor NO pot ser ζ = 0. Prop del limbe, on la projecció és rasant, el
 * radi que surt de ζ = 0 s'equivoca per un quilòmetre i llença el punt fora del
 * disc terrestre; el resultat és que el contorn de l'ombra sembla acabar abans
 * d'hora i la franja es queda curta justament al final del recorregut — que és,
 * per als eclipsis del 2026 i del 2028, el tram que passa per Espanya. Amb la ζ
 * de l'eix com a llavor això no passa, perquè l'ombra fa tot just uns pocs
 * centèsims de radi terrestre d'amplada.
 */
function umbraEdgePoint(
  el: BesselianElements,
  ev: EvaluatedElements,
  psi: number,
  seedZeta: number,
): SurfacePoint | null {
  const cos = Math.cos(psi);
  const sin = Math.sin(psi);
  let zeta = seedZeta;
  let point: SurfacePoint | null = null;

  for (let i = 0; i < 8; i++) {
    const radius = Math.abs(ev.l2 - zeta * el.tanF2);
    point = surfacePoint(ev, el.deltaT, ev.x + radius * cos, ev.y + radius * sin);
    if (point === null) return null;
    if (Math.abs(point.zeta - zeta) < 1e-11) break;
    zeta = point.zeta;
  }
  return point;
}

/** Pas per a les derivades numèriques respecte del temps: un segon. */
const DERIVATIVE_STEP_HOURS = 1 / 3600;

/**
 * Nombre de sectors de l'escombrat inicial en ψ. Amb 120 (3° de resolució) els
 * dos zeros queden sempre separats per diversos sectors.
 */
const PSI_SCAN_STEPS = 120;

/**
 * Límits nord i sud de la franja en un instant UT.
 *
 * La franja és la unió de les ombres de tots els instants; el seu contorn és
 * doncs l'ENVOLUPANT d'aquesta família de corbes. Un punt del contorn compleix
 * alhora dues condicions: és a la vora de l'ombra (F = 0) i hi és tangent
 * (dF/dt = 0). Si no s'imposa la segona, el que surt no és el límit de la
 * franja sinó el contorn instantani de l'ombra, que amb el Sol baix és una
 * el·lipse esbiaixada de centenars de quilòmetres — l'error típic.
 *
 * Per això aquí es recorre el contorn de l'ombra (F = 0 per construcció) i es
 * busquen els dos angles ψ on dF/dt canvia de signe.
 *
 * LÍMIT CONEGUT: al primer i al darrer instant del recorregut l'ombra arriba
 * completament rasant i la franja deixa d'estar limitada per una tangència per
 * estar-ho pel limbe. Allà qualsevol punt d'un tros de limbe de centenars de km
 * compleix la condició igual de bé, i la tria d'aquí pot divergir un centenar
 * de quilòmetres de la del GSFC — que en alguns d'aquests instants directament
 * publica un guió. A partir del segon instant tabulat l'acord torna a ser de
 * menys de mig quilòmetre. Vegeu `path.test.ts`.
 */
export function pathLimitsAt(
  eclipseId: string,
  utcMs: number,
): { north: PathPoint | null; south: PathPoint | null } {
  const el = elementsFor(eclipseId);
  const tdtHours = utcMsToTdtHours(eclipseId, el, utcMs);
  const ev = evaluateAt(el, tdtHours);

  // Els elements de t±1 s només depenen del temps, no de ψ: s'avaluen un sol
  // cop i s'estalvien un parell de milers de polinomis per instant.
  const evBefore = evaluateAt(el, tdtHours - DERIVATIVE_STEP_HOURS);
  const evAfter = evaluateAt(el, tdtHours + DERIVATIVE_STEP_HOURS);

  // Llavor de la iteració del radi del con: la ζ del peu de l'eix de l'ombra.
  const axis = surfacePoint(ev, el.deltaT, ev.x, ev.y);
  const seedZeta = axis === null ? 0 : axis.zeta;

  /**
   * Derivada temporal de la funció d'ombra en un punt FIX de la Terra, per
   * diferència centrada d'un segon. La funció és suau i l'error de truncament
   * queda molt per sota del que ens importa.
   */
  const rateAt = (psi: number): { point: SurfacePoint; rate: number } | null => {
    const point = umbraEdgePoint(el, ev, psi, seedZeta);
    if (point === null) return null;
    const a = shadowFunction(el, evBefore, point.lat, point.lon);
    const b = shadowFunction(el, evAfter, point.lat, point.lon);
    return { point, rate: (b - a) / (2 * DERIVATIVE_STEP_HOURS) };
  };

  let north: PathPoint | null = null;
  let south: PathPoint | null = null;

  const assign = (point: SurfacePoint) => {
    const candidate: PathPoint = { lat: point.lat, lon: point.lon, timeMs: utcMs };
    if (isNorthOfPath(el, ev, evBefore, evAfter, point)) north ??= candidate;
    else south ??= candidate;
  };

  /** Busca el zero de dF/dt entre dos angles on la derivada canvia de signe. */
  const bisectRoot = (loPsi: number, loRate: number, hiPsi: number, hiRate: number) => {
    if (loRate < 0 === hiRate < 0) return;

    let lo = loPsi;
    let hi = hiPsi;
    let loNegative = loRate < 0;
    let solution: SurfacePoint | null = null;

    for (let k = 0; k < 40 && hi - lo > 1e-13; k++) {
      const mid = (lo + hi) / 2;
      const probe = rateAt(mid);
      if (probe === null) break;
      solution = probe.point;
      if (probe.rate < 0 === loNegative) {
        lo = mid;
        loNegative = probe.rate < 0;
      } else {
        hi = mid;
      }
    }

    if (solution !== null) assign(solution);
  };

  /**
   * Punts on el contorn de l'ombra surt del disc terrestre. Serveixen de
   * recanvi: cap al final del recorregut hi ha instants en què la franja ja no
   * està limitada per una tangència sinó pel mateix limbe.
   */
  const limbPoints: SurfacePoint[] = [];

  let previousPsi = 0;
  let previous = rateAt(0);

  for (let i = 1; i <= PSI_SCAN_STEPS; i++) {
    const psi = (2 * Math.PI * i) / PSI_SCAN_STEPS;
    const current = rateAt(psi);

    if (previous !== null && current !== null) {
      bisectRoot(previousPsi, previous.rate, psi, current.rate);
    } else if (previous !== null || current !== null) {
      // Vora del tros de contorn que cau sobre la Terra. S'hi afina l'angle
      // extrem perquè just allà, on la projecció és rasant, hi pot haver un
      // zero de dF/dt comprimit en una franja d'angle minúscula que
      // l'escombrat regular es menja. Al 2028 és exactament el cas del darrer
      // minut, que és quan la franja travessa la Península.
      const inside = previous === null ? psi : previousPsi;
      const outside = previous === null ? previousPsi : psi;
      const edge = refineLimbCrossing(el, ev, seedZeta, inside, outside);

      const known = previous ?? current;
      const edgeRate = edge === null ? null : rateAt(edge.psi);

      if (edge !== null && edgeRate !== null && known !== null) {
        limbPoints.push(edge.point);
        const knownPsi = previous === null ? psi : previousPsi;
        bisectRoot(edge.psi, edgeRate.rate, knownPsi, known.rate);
      }
    }

    previousPsi = psi;
    previous = current;
  }

  for (const point of limbPoints) assign(point);

  return { north, south };
}

/**
 * Refina el punt on el contorn de l'ombra creua el limbe terrestre: el darrer
 * angle ψ que encara cau sobre la Terra entre un de vàlid i un que ja no ho és.
 */
function refineLimbCrossing(
  el: BesselianElements,
  ev: EvaluatedElements,
  seedZeta: number,
  insidePsi: number,
  outsidePsi: number,
): { psi: number; point: SurfacePoint } | null {
  let inside = insidePsi;
  let outside = outsidePsi;
  let best = umbraEdgePoint(el, ev, inside, seedZeta);
  if (best === null) return null;

  for (let i = 0; i < 40 && Math.abs(outside - inside) > 1e-13; i++) {
    const mid = (inside + outside) / 2;
    const probe = umbraEdgePoint(el, ev, mid, seedZeta);
    if (probe === null) {
      outside = mid;
    } else {
      inside = mid;
      best = probe;
    }
  }

  return { psi: inside, point: best };
}

/**
 * Distingeix quin dels dos punts de tangència és el límit nord.
 *
 * Al pla fonamental l'eix +η apunta cap al pol nord celeste (per al pol nord
 * terrestre, η = (b/a)·cos d > 0). El punt de tangència queda a 90° del vector
 * velocitat del terreny respecte de l'ombra: el que queda a l'esquerra d'aquest
 * moviment és el límit nord. No es pot decidir simplement per latitud, perquè
 * amb el Sol molt baix el punt de tangència "nord" pot estar centenars de
 * quilòmetres per davant i quedar més al sud que la línia central del moment.
 */
function isNorthOfPath(
  el: BesselianElements,
  ev: EvaluatedElements,
  evBefore: EvaluatedElements,
  evAfter: EvaluatedElements,
  point: SurfacePoint,
): boolean {
  const a = fundamentalCoords(evBefore, el.deltaT, point.lat, point.lon);
  const b = fundamentalCoords(evAfter, el.deltaT, point.lat, point.lon);

  // Velocitat del punt del terreny relativa a l'eix de l'ombra.
  const vx = b.xi - evAfter.x - (a.xi - evBefore.x);
  const vy = b.eta - evAfter.y - (a.eta - evBefore.y);

  const now = fundamentalCoords(ev, el.deltaT, point.lat, point.lon);
  const rx = now.xi - ev.x;
  const ry = now.eta - ev.y;

  return vx * ry - vy * rx < 0;
}

// ---------------------------------------------------------------------------
// Franja completa
// ---------------------------------------------------------------------------

/** Marge de cerca dels extrems de la franja al voltant de t0, en hores. */
const PATH_SEARCH_HOURS = 4;

/**
 * Instants UT del primer i darrer contacte de l'eix de l'ombra amb la Terra.
 * S'escombra a pas gruixut i es refina per bisecció sobre la condició
 * ξ² + η₁² = 1 (l'eix tangent al limbe terrestre).
 */
function findPathEnds(eclipseId: string, el: BesselianElements): [number, number] | null {
  const axisMargin = (tdtHours: number): number => {
    const ev = evaluateAt(el, tdtHours);
    const eta1 = ev.y / ev.rho1;
    return 1 - ev.x * ev.x - eta1 * eta1;
  };

  const step = 1 / 60; // un minut
  let first: number | null = null;
  let last: number | null = null;
  for (let t = el.t0 - PATH_SEARCH_HOURS; t <= el.t0 + PATH_SEARCH_HOURS; t += step) {
    if (axisMargin(t) >= 0) {
      if (first === null) first = t;
      last = t;
    }
  }
  if (first === null || last === null) return null;

  const refine = (inside: number, outside: number): number => {
    let a = inside;
    let b = outside;
    for (let i = 0; i < 40; i++) {
      const mid = (a + b) / 2;
      if (axisMargin(mid) >= 0) a = mid;
      else b = mid;
    }
    return a;
  };

  return [
    tdtHoursToUtcMs(eclipseId, el, refine(first, first - step)),
    tdtHoursToUtcMs(eclipseId, el, refine(last, last + step)),
  ];
}

/**
 * Desenrotlla la longitud perquè la polilínia sigui contínua: cada punt es porta
 * a menys de 180° de l'anterior. Sense això, una franja que creua l'antimeridià
 * es dibuixa com una ratlla que travessa tot el mapa.
 */
function unwrap(points: PathPoint[]): PathPoint[] {
  let offset = 0;
  let previous: number | null = null;
  return points.map((p) => {
    if (previous !== null) {
      const delta = p.lon + offset - previous;
      if (delta > 180) offset -= 360;
      else if (delta < -180) offset += 360;
    }
    const lon = p.lon + offset;
    previous = lon;
    return { ...p, lon };
  });
}

/** Interval màxim entre punts consecutius d'una corba, en km. */
const MAX_SEGMENT_KM = 30;
/** Interval temporal mínim al qual es deixa arribar el refinament, en ms. */
const MIN_REFINE_MS = 50;
/** Sostre de punts per corba, per si la geometria es torna patològica. */
const MAX_POINTS = 2000;

/**
 * Mostreja una corba amb pas uniforme i després la refina on cal.
 *
 * El pas uniforme no serveix sol. Als extrems de la franja l'ombra arriba
 * rasant i la seva velocitat sobre el terreny se'n va a l'infinit: l'anular del
 * 2028, per exemple, travessa tota la península en els darrers 57 segons de
 * recorregut, i amb un punt cada minut la franja hi surt com un triangle recte
 * de Sevilla a Barcelona. Es parteix per la meitat tot segment que superi
 * MAX_SEGMENT_KM fins que la corba queda igual de fina a tot arreu.
 */
function sampleCurve(
  evaluate: (timeMs: number) => PathPoint | null,
  startMs: number,
  endMs: number,
  stepMs: number,
): PathPoint[] {
  let points: PathPoint[] = [];
  for (let t = startMs; t < endMs; t += stepMs) {
    const p = evaluate(t);
    if (p !== null) points.push(p);
  }
  const last = evaluate(endMs);
  if (last !== null) points.push(last);

  for (let pass = 0; pass < 16 && points.length < MAX_POINTS; pass++) {
    const refined: PathPoint[] = [];
    let changed = false;

    for (let i = 0; i < points.length; i++) {
      refined.push(points[i]);
      const next = points[i + 1];
      if (next === undefined) continue;

      const gap = next.timeMs - points[i].timeMs;
      if (gap <= MIN_REFINE_MS) continue;
      if (approxDistanceKm(points[i], next) <= MAX_SEGMENT_KM) continue;

      const mid = evaluate((points[i].timeMs + next.timeMs) / 2);
      if (mid !== null) {
        refined.push(mid);
        changed = true;
      }
    }

    points = refined;
    if (!changed) break;
  }

  return points;
}

/**
 * Franja de centralitat completa de l'eclipsi: línia central, límit nord i
 * límit sud.
 */
export function computeEclipsePath(eclipseId: string, options: PathOptions = {}): EclipsePath {
  const el = elementsFor(eclipseId);
  const kind = getEclipse(eclipseId).kind;
  const stepMs = (options.stepSeconds ?? 60) * 1000;

  const ends = findPathEnds(eclipseId, el);
  if (ends === null) {
    throw new Error(`L'ombra central de ${eclipseId} no toca la Terra`);
  }
  const [startMs, endMs] = ends;

  const sample = (pick: (timeMs: number) => PathPoint | null) =>
    unwrap(sampleCurve(pick, startMs, endMs, stepMs));

  return {
    eclipseId,
    kind,
    center: sample((t) => centralLineAt(eclipseId, t)),
    northLimit: sample((t) => pathLimitsAt(eclipseId, t).north),
    southLimit: sample((t) => pathLimitsAt(eclipseId, t).south),
    startMs,
    endMs,
  };
}

// ---------------------------------------------------------------------------
// GeoJSON
// ---------------------------------------------------------------------------

export interface EclipsePathProperties {
  eclipseId: string;
  kind: 'total' | 'annular';
  /** Atribució obligatòria de les efemèrides d'origen. */
  attribution: string;
}

export const ESPENAK_ATTRIBUTION = "Eclipse Predictions by Fred Espenak, NASA's GSFC";

export interface EclipsePathGeoJson {
  /** Línia central. */
  centerLine: Feature<LineString, EclipsePathProperties>;
  /** Franja tancada entre el límit nord i el sud. */
  band: Feature<Polygon, EclipsePathProperties>;
  /**
   * Els dos límits com a línies independents.
   *
   * No és redundant amb `band`: el polígon s'ha de tancar amb una corda recta
   * entre els extrems dels dos límits, i aquesta corda no és cap límit real de
   * res. Dibuixant les vores des d'aquí, la corda no es pinta.
   */
  limits: Feature<MultiLineString, EclipsePathProperties>;
}

const toCoords = (points: PathPoint[]): [number, number][] =>
  points.map((p) => [p.lon, p.lat]);

/**
 * Latitud per damunt de la qual el polígon deixa de ser dibuixable.
 *
 * Web Mercator —la projecció de qualsevol mapa de tessel·les— talla a ±85,05°:
 * la latitud 90 hi queda a distància infinita. Per sota de 80 hi ha marge de
 * sobres i encara es veu tot el que a algú li pugui interessar.
 */
const DRAWABLE_LAT_LIMIT = 80;

/** Salt de longitud a partir del qual dos punts seguits no són seguits. */
const LON_JUMP_LIMIT = 90;

/**
 * Trosseja una línia en els trams que es poden dibuixar.
 *
 * PER QUÈ CAL, I NO ÉS UNA PRECAUCIÓ ABSTRACTA. La franja del 12 d'agost de
 * 2026 comença a Sibèria, passa PEL POL i baixa cap a Islàndia i la Península:
 * de 731 punts de l'anell, 188 són per damunt dels 80° de latitud i arriba als
 * 89,1°. Un polígon així, en Mercator, no és una figura estirada: és una figura
 * indefinida, i el trossejador de tessel·les del mapa no en dibuixava res. El
 * resultat era el mapa amb la cartografia i sense franja — que és justament
 * l'única cosa que aquell mapa ha d'ensenyar.
 *
 * També es talla quan la longitud fa un salt: passat el pol, dos punts seguits
 * de la trajectòria poden ser a quinze graus l'un de l'altre, i unir-los amb
 * una recta dibuixa una banda que no existeix.
 */
function drawableRuns(points: readonly [number, number][]): [number, number][][] {
  const runs: [number, number][][] = [];
  let run: [number, number][] = [];

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const usable = Math.abs(point[1]) <= DRAWABLE_LAT_LIMIT;
    const jumped =
      run.length > 0 && Math.abs(point[0] - run[run.length - 1][0]) > LON_JUMP_LIMIT;

    if (!usable || jumped) {
      if (run.length > 1) runs.push(run);
      run = usable ? [point] : [];
      continue;
    }
    run.push(point);
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

/** El tram més llarg, que és el que travessa el mapa que es mira. */
function longestRun(points: readonly [number, number][]): [number, number][] {
  const runs = drawableRuns(points);
  if (runs.length === 0) return [];
  return runs.reduce((best, run) => (run.length > best.length ? run : best));
}

/**
 * Converteix la franja a GeoJSON. El polígon es tanca recorrent el límit nord
 * en el sentit del temps i el sud en sentit invers, que és exactament l'ordre
 * que descriu el contorn de la franja sense creuar-se.
 */
export function eclipsePathToGeoJson(path: EclipsePath): EclipsePathGeoJson {
  const properties: EclipsePathProperties = {
    eclipseId: path.eclipseId,
    kind: path.kind,
    attribution: ESPENAK_ATTRIBUTION,
  };

  /*
   * L'ANELL ES CONSTRUEIX AMB LA PART DIBUIXABLE, I NOMÉS AMB AQUESTA.
   *
   * Vegeu `drawableRuns`: la franja del 2026 passa pel pol, i un polígon que
   * hi passa no és dibuixable en Mercator. Es pren de cada límit el tram més
   * llarg que sí que ho és —el que travessa la part del món que aquest mapa
   * ensenya— i amb els dos es tanca el contorn.
   */
  const north = longestRun(toCoords(path.northLimit));
  const south = longestRun(toCoords(path.southLimit));
  const ring = [...north, ...south.reverse()];
  // Un anell de GeoJSON ha de ser explícitament tancat.
  if (ring.length > 0) ring.push(ring[0]);

  return {
    centerLine: {
      type: 'Feature',
      properties,
      geometry: { type: 'LineString', coordinates: longestRun(toCoords(path.center)) },
    },
    band: {
      type: 'Feature',
      properties,
      geometry: { type: 'Polygon', coordinates: [ring] },
    },
    limits: {
      type: 'Feature',
      properties,
      geometry: {
        type: 'MultiLineString',
        // Els límits també: una línia que passa pel pol es dibuixa igual de
        // malament que un polígon que hi passa.
        coordinates: [
          ...drawableRuns(toCoords(path.northLimit)),
          ...drawableRuns(toCoords(path.southLimit)),
        ],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Utilitats
// ---------------------------------------------------------------------------

/**
 * Distància aproximada entre dues coordenades, en km.
 *
 * Aproximació equirectangular: n'hi ha prou de sobres per comparar franges
 * (errors per sota del metre en distàncies de desenes de km) i evita
 * l'aritmètica delicada de la fórmula d'haversine amb angles minúsculs.
 */
/** Km per grau de latitud: constant de l'el·lipsoide, prou fina aquí. */
const KM_PER_DEG_LAT = 111.32;

/**
 * Distància mínima d'un punt a la línia central DIBUIXADA, en km.
 *
 * És geometria sobre la polilínia del mapa i no una derivada del marge umbral
 * a posta: el número ha de coincidir amb la línia que l'usuari té davant, i la
 * linealització marge/gradient es queda curta lluny del límit. Equirectangular
 * local al punt amb projecció sobre cada segment: la línia és suau i els
 * segments fan ~60 km, o sigui que prop del mínim —que és l'únic tram que
 * decideix res— l'error és de metres.
 *
 * Vivia a MapScreen amb una nota que demanava mudar-se aquí, al costat
 * d'`approxDistanceKm`. Feta la mudança, tal qual.
 */
export function distanceToCenterLineKm(
  point: { lat: number; lon: number },
  line: readonly PathPoint[],
): number | null {
  if (line.length === 0) return null;
  const kmPerDegLon = KM_PER_DEG_LAT * Math.cos(point.lat * DEG);

  // Coordenades locals en km. La longitud del camí ve DESENROTLLADA (aquest
  // fitxer no la redueix a ±180° per poder creuar l'antimeridià sense
  // ratlles); la diferència es normalitza perquè el punt tocat sí que arriba
  // normalitzat.
  const xy = line.map((q) => {
    const dLon = ((((q.lon - point.lon + 180) % 360) + 360) % 360) - 180;
    return { x: dLon * kmPerDegLon, y: (q.lat - point.lat) * KM_PER_DEG_LAT };
  });

  let best = Infinity;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i];
    best = Math.min(best, Math.hypot(a.x, a.y));

    const b = xy[i + 1];
    if (b === undefined) continue;
    // Si la normalització ha partit el segment per l'antimeridià, projectar-hi
    // dibuixaria una corda falsa travessant mig món. Es salta, i hi queden les
    // distàncies als dos extrems, que allà són la resposta honesta.
    if (Math.abs(b.x - a.x) > 90 * kmPerDegLon) continue;

    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    if (len2 < 1e-9) continue;
    const t = -(a.x * abx + a.y * aby) / len2;
    if (t <= 0 || t >= 1) continue;
    best = Math.min(best, Math.hypot(a.x + t * abx, a.y + t * aby));
  }
  return Number.isFinite(best) ? best : null;
}

export function approxDistanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const meanLat = ((a.lat + b.lat) / 2) * DEG;
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = normalizeLon(b.lon - a.lon) * DEG * Math.cos(meanLat);
  return EARTH_MEAN_RADIUS_KM * Math.hypot(dLat, dLon);
}
