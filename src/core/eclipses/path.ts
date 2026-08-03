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
 *
 * 3. LA FRANJA NO ÉS «LÍMIT NORD + LÍMIT SUD». Ho és mentre l'ombra és estreta i
 *    travessera, i deixa de ser-ho als dos extrems del recorregut, on l'ombra
 *    arriba de gairell i la petjada queda tallada pel TERMINADOR. Allà la vora
 *    és la ratlla de la posta —o de l'alba— i s'ha de calcular a part: són les
 *    TAPES. Tancar el polígon amb una recta entre els dos límits, que és el que
 *    es feia, dibuixava una corda de 810 km al 12-08-2026 que deixava València,
 *    Castelló, Peníscola i les Balears FORA d'una franja on tenen entre un
 *    minut i un minut i mig de totalitat. Vegeu `capPointsAt`.
 *
 * La franja, doncs, té QUATRE corbes de vora i no dues: `northLimit`,
 * `southLimit`, `startCap` i `endCap`. `band-agreement.test.ts` comprova que el
 * polígon que en surt i el motor de circumstàncies locals diguin el mateix.
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
  /**
   * Tapes del principi i del final: el tros de vora on la franja no acaba en
   * cap tangència sinó contra el terminador. Buides si l'ombra hi entra i en
   * surt sense arribar a tocar-lo. Vegeu `capPointAt`.
   */
  startCap: PathPoint[];
  endCap: PathPoint[];
  /**
   * Primer i darrer contacte de l'EIX de l'ombra amb la Terra, en ms UT. La
   * franja dura una mica més a cada banda (l'ombra té amplada): vegeu
   * `findUmbraEnds`.
   */
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
  return surfaceFrom(ev, deltaT, xi, eta1, Math.sqrt(zeta1Sq));
}

/**
 * El mateix, però amb el punt ja donat en coordenades del sistema APLANAT
 * (ξ, η₁, ζ₁), on la Terra és l'esfera unitat.
 *
 * Existeix a part perquè el terminador és exactament ζ₁ = 0, i entrar-hi per
 * `surfacePoint` obligaria a arribar a l'arrel quadrada d'un zero que, amb
 * aritmètica de coma flotant, tant pot sortir 0 com −1·10⁻¹⁷ — i llavors la
 * funció retorna null just als punts que més ens interessen.
 */
function surfaceFrom(
  ev: EvaluatedElements,
  deltaT: number,
  xi: number,
  eta1: number,
  zeta1: number,
): SurfacePoint {
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
): { xi: number; eta: number; zeta: number; zeta1: number } {
  const u = Math.atan(POLAR_RATIO * Math.tan(lat * DEG));
  const rhoCos = Math.cos(u);
  const rhoSin = POLAR_RATIO * Math.sin(u);
  const theta = (ev.mu - EARTH_ROTATION_DEG_PER_SEC * deltaT + lon) * DEG;
  const cosTheta = Math.cos(theta);

  return {
    xi: rhoCos * Math.sin(theta),
    eta: rhoSin * ev.cosD - rhoCos * cosTheta * ev.sinD,
    zeta: rhoSin * ev.sinD + rhoCos * cosTheta * ev.cosD,
    /*
     * ζ₁: la mateixa component, però al sistema APLANAT, on la Terra és
     * l'esfera unitat. És el que diu si al punt hi toca el Sol: positiu de
     * dia, zero al terminador, negatiu de nit.
     *
     * NO serveix la ζ de sobre, i la diferència no és cosmètica: al terminador
     * la ζ geocèntrica val ~1,6·10⁻³ i no pas zero, perquè el terminador d'un
     * el·lipsoide és on la NORMAL de la superfície és perpendicular a l'eix de
     * l'ombra, no on ho és el radi vector. Són ~0,2° d'altura del Sol, unes
     * desenes de km sobre el terreny.
     *
     * Tampoc no serveix `1 − ξ² − η₁²`, que val ζ₁² i per tant no canvia mai de
     * signe: amb aquell criteri la derivada al terminador surt del soroll de
     * segon ordre i les tapes es cusen a l'atzar. Ja va passar.
     */
    zeta1: (rhoSin / POLAR_RATIO) * ev.sinD1 + rhoCos * cosTheta * ev.cosD1,
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
 *
 * I QUAN L'EIX JA NO TOCA LA TERRA no queda aquella llavor, i el problema torna
 * amplificat: el radi del con varia un 56 % entre ζ = 0 i ζ = 1 (de 0,0081 a
 * 0,0127 radis terrestres el 2026), o sigui que una llavor dolenta llença un
 * iterat fora del disc i fa avortar la cerca encara que l'arrel hi sigui. Això
 * deixava el límit nord del 12-08-2026 mort a les 18:30:10 quan la tangència
 * viu fins a les 18:30:18 — set segons que, amb l'ombra rasant, són 186 km de
 * vora. La solució no és aquí sinó a qui crida: `pathLimitsAt` amb
 * `trackToLimb` passa la ζ d'un angle ψ al següent, que és la millor llavor que
 * hi pot haver perquè el contorn és continu en ψ.
 *
 * (Es va provar també una escala de llavors de recanvi per a quan la iteració
 * avorta. No canviava CAP número mesurable —ni la graella de veritat, ni els
 * daurats, ni els 41 punts de `band-agreement.test.ts`— i es va treure: la
 * continuació sola ja ho resol i val més un sol mecanisme que dos.)
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
  const { north, south } = limitsAt(eclipseId, utcMs);
  return { north: north?.point ?? null, south: south?.point ?? null };
}

/**
 * Un punt de límit amb la memòria de COM s'ha obtingut.
 *
 * `tangency` distingeix una arrel de l'envolupant (dF/dt = 0) d'un tall del
 * contorn de l'ombra amb el terminador. La distinció decideix si el punt és de
 * veritat a la vora de la franja: vegeu `computeEclipsePath`.
 */
interface LimitPoint {
  point: PathPoint;
  tangency: boolean;
}

/**
 * `trackToLimb` demana que el contorn de l'ombra se segueixi FINS AL LIMBE, amb
 * la llavor de la iteració passada d'un angle ψ al següent. Vegeu el comentari
 * de `carrySeed`: sense això, la tangència es perd uns segons abans d'arribar al
 * terminador i la vora es queda curta.
 *
 * NO és el comportament per defecte, i la raó és de contenció, no de
 * conveniència. `pathLimitsAt` és pública i, a més dels tests contra les taules
 * del GSFC, la fa servir `core/astro/uncertainty.ts` per localitzar el límit
 * PUBLICAT més proper. Aquella cerca és molt sensible al darrer minut del
 * recorregut —allà la resposta ja no és cap tangència sinó un tall de limbe, i
 * salta de branca fins a 200 km d'un segon al següent, també amb el codi
 * antic—, i amb el seguiment activat el punt que en treu per a València el
 * 26-01-2028 passa de 163,6 km a 142,9 km, contra els 162,1 que en diu el
 * gradient del marge. Fer-ho bé demana revisar aquella cerca sencera i
 * revalidar-la contra l'IGN, que és una altra feina i no aquesta. Mentrestant,
 * qui dibuixa la franja demana el seguiment i qui busca el límit publicat es
 * queda amb la resposta de sempre, bit a bit.
 */
function limitsAt(
  eclipseId: string,
  utcMs: number,
  trackToLimb = false,
): { north: LimitPoint | null; south: LimitPoint | null } {
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

  /*
   * LA LLAVOR ES PASSA D'UN ANGLE AL SEGÜENT.
   *
   * Quan l'eix ja no toca la Terra no hi ha cap ζ de l'eix per llavor, i la que
   * queda (zero) és justament la dolenta: prop del limbe l'iterat se'n va fora
   * del disc i la cerca avorta encara que l'arrel hi sigui. El contorn de
   * l'ombra, en canvi, és continu en ψ, i la ζ del punt anterior és sempre una
   * llavor excel·lent del següent.
   *
   * Amb això, el contorn del 12-08-2026 a les 18:30:15 arriba fins a 5,99°E en
   * lloc de quedar-se a 4,40°E: 135 km més de contorn, que és on viu la
   * tangència nord d'aquells segons. Sense la continuació, el límit nord moria
   * a les 18:30:11 i la vora quedava 186 km curta.
   */
  let carrySeed = seedZeta;

  /**
   * Derivada temporal de la funció d'ombra en un punt FIX de la Terra, per
   * diferència centrada d'un segon. La funció és suau i l'error de truncament
   * queda molt per sota del que ens importa.
   */
  const rateAt = (psi: number): { point: SurfacePoint; rate: number } | null => {
    const point = umbraEdgePoint(el, ev, psi, trackToLimb ? carrySeed : seedZeta);
    if (point === null) return null;
    if (trackToLimb) carrySeed = point.zeta;
    const a = shadowFunction(el, evBefore, point.lat, point.lon);
    const b = shadowFunction(el, evAfter, point.lat, point.lon);
    return { point, rate: (b - a) / (2 * DERIVATIVE_STEP_HOURS) };
  };

  /**
   * Candidats a límit, amb el seu desplaçament transversal signat respecte de
   * l'eix (negatiu = costat nord) i amb la memòria de QUÈ és cadascun: arrel
   * de tangència (dF/dt = 0) o tall del contorn amb el limbe. La distinció no
   * és decorativa: a la tria final la tangència mana sobre el limbe.
   */
  const candidates: { point: SurfacePoint; offset: number; tangency: boolean }[] = [];

  const consider = (point: SurfacePoint, tangency: boolean) => {
    candidates.push({
      point,
      tangency,
      offset: transverseOffset(el, ev, evBefore, evAfter, point),
    });
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

    if (solution !== null) consider(solution, true);
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
      const edge = refineLimbCrossing(el, ev, trackToLimb ? carrySeed : seedZeta, inside, outside);

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

  for (const point of limbPoints) consider(point, false);

  /*
   * LA TRIA, en dos esglaons per a cada costat.
   *
   * 1) MENTRE HI HA TANGÈNCIA, MANA LA TANGÈNCIA. dF/dt = 0 és la definició
   *    mateixa de l'envolupant: mentre l'arrel viu, el límit és ella, i cap
   *    tall de limbe no la pot desbancar. Semblava que el criteri de l'extrem
   *    transversal ja ho garantia sol, i el 26-01-2028 va demostrar que no: a
   *    les 16:57:08 UT, amb la tangència sud ben viva a 36,77°N −3,10°E,
   *    l'extrem posterior de l'arc de terminador eclipsat (39,04°N 2,85°E,
   *    650 km més enllà i interior de la franja) la superava en desplaçament
   *    transversal per 2·10⁻⁶ radis terrestres — tretze metres. I és que el
   *    desplaçament es mesura respecte de la recta del moviment LOCAL de cada
   *    punt: entre punts separats centenars de quilòmetres sobre un camí
   *    corbat, la comparació de magnituds ja no ordena res. El límit sud
   *    saltava 650 km d'un segon al següent i es posava a recular, i la cerca
   *    del límit publicat d'`uncertainty.ts`, en refinar el tram del salt, es
   *    quedava el punt de la branca equivocada: 283 km de València en lloc
   *    dels 162 de l'arrel de veritat.
   *
   * 2) SENSE TANGÈNCIA AL COSTAT, EL MÉS EXTREM DELS TALLS DE LIMBE. És el
   *    cas de la dent del 2026: entre les 18:30:10 i les 18:30:33 UT del
   *    12-08-2026 la tangència nord llisca fora del disc terrestre i el
   *    contorn queda tallat pel terminador en DOS punts, tots dos al costat
   *    nord. Un és la continuació real del límit (18:30:12: 40,31°N 4,34°E,
   *    amb dF/dt +4,2·10⁻⁴, la tangència perduda just a l'altra banda del
   *    limbe); l'altre és l'extrem posterior de l'arc eclipsat del terminador
   *    (39,94°N 4,18°E, dF/dt −7,4·10⁻³), un punt que un instant després
   *    queda DINS de l'ombra — interior de la franja, no pas vora. Amb el
   *    "primer de cada costat" que hi havia abans, quan l'espuri queia abans
   *    en l'ordre d'escombrat de ψ guanyava ell, i el límit nord saltava
   *    40 km al sud i tornava: la dent de serra al sud-est de Menorca. Entre
   *    talls de limbe la comparació sí que és de fiar: tots dos són extrems
   *    del mateix arc curt, i el transversalment més extrem és la vora de la
   *    unió d'ombres — qualsevol altre queda entre els dos límits, és a dir,
   *    dins.
   */
  const pick = (side: 1 | -1): LimitPoint | null => {
    let best: { point: SurfacePoint; offset: number; tangency: boolean } | null = null;
    for (const candidate of candidates) {
      // El costat nord és el d'offset negatiu; `side` reorienta perquè
      // "més extrem" sigui sempre "més gran".
      if (candidate.offset * side <= 0) continue;
      const wins =
        best === null ||
        (candidate.tangency !== best.tangency
          ? candidate.tangency
          : candidate.offset * side > best.offset * side);
      if (wins) best = candidate;
    }
    return best === null
      ? null
      : {
          point: { lat: best.point.lat, lon: best.point.lon, timeMs: utcMs },
          tangency: best.tangency,
        };
  };

  return { north: pick(-1), south: pick(1) };
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
 * Desplaçament transversal signat d'un punt respecte de l'eix de l'ombra, al
 * pla fonamental: la component del vector eix→punt perpendicular al moviment
 * del terreny respecte de l'ombra. NEGATIU al costat nord del camí (a
 * l'esquerra del moviment), positiu al sud.
 *
 * No és un simple booleà nord/sud a posta: la MAGNITUD també decideix, però
 * NOMÉS entre talls de limbe. Quan el contorn de l'ombra queda tallat pel
 * terminador i cap tangència no viu en un costat, hi pot haver dos talls de
 * limbe en aquell costat, i llavors el límit de la franja és el
 * transversalment més extrem — l'altre queda dins (vegeu la tria a
 * `pathLimitsAt`). Contra una tangència viva, en canvi, la magnitud no és cap
 * argument: es mesura respecte de la recta del moviment local de cada punt, i
 * entre punts separats centenars de quilòmetres sobre un camí corbat pot
 * donar l'ordre equivocat per metres (26-01-2028, 16:57:08). Tampoc no es
 * pot decidir per latitud: amb el Sol molt baix el punt de tangència "nord"
 * pot estar centenars de quilòmetres per davant i quedar més al sud que la
 * línia central del moment.
 */
function transverseOffset(
  el: BesselianElements,
  ev: EvaluatedElements,
  evBefore: EvaluatedElements,
  evAfter: EvaluatedElements,
  point: SurfacePoint,
): number {
  const a = fundamentalCoords(evBefore, el.deltaT, point.lat, point.lon);
  const b = fundamentalCoords(evAfter, el.deltaT, point.lat, point.lon);

  // Velocitat del punt del terreny relativa a l'eix de l'ombra.
  const vx = b.xi - evAfter.x - (a.xi - evBefore.x);
  const vy = b.eta - evAfter.y - (a.eta - evBefore.y);
  const speed = Math.hypot(vx, vy);
  if (speed === 0) return 0;

  const now = fundamentalCoords(ev, el.deltaT, point.lat, point.lon);
  const rx = now.xi - ev.x;
  const ry = now.eta - ev.y;

  // Producte vectorial normalitzat: distància signada a la recta del moviment.
  return (vx * ry - vy * rx) / speed;
}

// ---------------------------------------------------------------------------
// La TAPA: on la franja no acaba en punxa sinó contra la nit
// ---------------------------------------------------------------------------

/*
 * EL DEFECTE QUE VA OBLIGAR A ESCRIURE AIXÒ, i és el pitjor que ha tingut mai
 * el mapa.
 *
 * La franja es dibuixava com "límit nord endavant + límit sud invertit", i els
 * dos extrems es cusien amb una recta. Mentre l'ombra és estreta i travessera
 * la recta fa pocs quilòmetres i no la veu ningú. Al final del recorregut del
 * 12-08-2026, no: el límit nord acabava a 39,123°N 5,597°E (a llevant de
 * Mallorca) i el sud a 40,538°N −3,713°E (vora Madrid), i la corda que els
 * unia feia 810 km i travessava la Mediterrània en diagonal. No era un
 * artefacte del mostreig — amb pas de 60, 10 i 2 s la corda feia els mateixos
 * 810 km.
 *
 * El que quedava FORA d'aquella recta, segons `core/astro/contacts.ts`, que és
 * un motor independent:
 *
 *   València (39,47 / −0,38)      TOTAL,  61,6 s
 *   Palma (39,57 / 2,65)          TOTAL,  96,1 s
 *   Maó (39,89 / 4,27)            TOTAL,  68,4 s
 *   Peníscola (40,36 / 0,40)      TOTAL,  99,2 s
 *   (39,40 / 1,50)                TOTAL,  91,4 s
 *   (38,40 / 4,40)                TOTAL,  84,6 s
 *
 * O sigui: el mapa deixava fora de la franja la zona més poblada de tot el
 * tram espanyol, amb un minut i mig de totalitat. La mateixa recta hi és al
 * 2027 (608 i 632 km) i al 2028 (829 i 773 km — i la del 2028 talla la
 * Península de Lleida a la Costa del Sol).
 *
 * PER QUÈ PASSA. La franja és la UNIÓ de les petjades de l'ombra al llarg del
 * temps. La seva vora és l'envolupant d'aquestes petjades —d'aquí surten el
 * límit nord i el sud— MENTRE la petjada sencera cau sobre la cara
 * il·luminada. Als extrems del recorregut no hi cau: l'ombra arriba de gairell
 * i la petjada queda tallada pel TERMINADOR. Allà la vora de la franja ja no
 * és cap tangència, és la ratlla de la posta (o de l'alba), i la unió
 * s'acaba contra la nit amb una corba, no amb una punxa. Cosir els dos límits
 * amb una recta és negar aquella corba.
 *
 * Mesurat, per al 12-08-2026 (F = funció d'ombra, min sobre instants amb el
 * punt il·luminat; F = 0 vol dir «exactament a la vora de la unió»):
 *
 *   límit NORD   a la vora fins a les 18:30:10; a les 18:30:20 ja és INTERIOR
 *                (F = −1,8·10⁻⁶) i a les 18:32:50, −6,5·10⁻⁵. La tangència
 *                nord mor cap a les 18:30:12 i el que `pathLimitsAt` retorna
 *                a partir d'allà és un tall de limbe, que és vora de la
 *                petjada de l'instant però interior de la unió.
 *   límit SUD    a la vora fins a les 18:33:50 — o sigui 101 s DESPRÉS que
 *                l'eix de l'ombra deixi la Terra (18:32:09). Simplement no
 *                s'estava mostrejant.
 *   la TAPA      va de (39,44 / 6,23) a les 18:30:15 fins a (37,69 / 4,56) a
 *                les 18:33:52, i cada punt seu és un punt del terminador que
 *                l'ombra toca just quan s'hi pon el Sol.
 *
 * COM ES CALCULA. El terminador és la silueta de l'el·lipsoide vista des de
 * l'eix de l'ombra: en el sistema aplanat és exactament ζ₁ = 0, o sigui la
 * circumferència ξ² + η₁² = 1. Es recorre amb un angle φ i s'hi busquen les
 * arrels de la funció d'ombra. Dels dos talls que hi ha a cada instant, només
 * un és vora de la unió: aquell on l'ombra encara ESTÀ ARRIBANT quan el punt
 * es fa fosc (l'altre ja l'havia cobert, i per tant és interior).
 *
 * El criteri és un producte de dos signes i no demana cap cas particular per a
 * l'alba i per a la posta: si `m = 1 − ξ² − η₁²` (positiu de dia) i F és la
 * funció d'ombra, el punt és a la vora quan dm/dt i dF/dt tenen el MATEIX
 * signe. A la posta dm/dt < 0 i cal que F encara baixi; a l'alba dm/dt > 0 i
 * cal que F ja pugi. Un sol producte cobreix els dos extrems del recorregut.
 *
 * ALTERNATIVES DESCARTADES, amb el número que les descarta:
 *
 *  - "Unió de quadrilàters escombrats [nord(t), sud(t), sud(t+dt), nord(t+dt)]".
 *    Provat amb pas de 250 ms (22.473 quadrilàters): València i (38,40 / 4,40)
 *    segueixen FORA. Dues raons. La petjada de l'instant, al capvespre, és una
 *    llentia CORBADA de centenars de km contra el terminador, i la corda entre
 *    els seus dos extrems no arriba a la panxa. I `pathLimitsAt` deixa de donar
 *    la vora bona molt abans que s'acabi la franja (vegeu els números de dalt),
 *    o sigui que l'escombrada s'atura on encara hi ha territori.
 *  - "Tancar amb el contorn de la petjada de l'instant final". La petjada final
 *    no conté la unió: entre les 18:32:09 i les 18:34:05 cada petjada n'afegeix
 *    de nova pel sud-est i n'abandona pel nord-oest.
 */

/** Punt del terminador a l'angle φ, i la funció d'ombra que hi val. */
function terminatorPoint(
  el: BesselianElements,
  ev: EvaluatedElements,
  phi: number,
): { point: SurfacePoint; f: number } {
  const xi = Math.cos(phi);
  const eta1 = Math.sin(phi);
  const point = surfaceFrom(ev, el.deltaT, xi, eta1, 0);
  const radius = ev.l2 - point.zeta * el.tanF2;
  const dx = xi - ev.x;
  const dy = eta1 * ev.rho1 - ev.y;
  return { point, f: dx * dx + dy * dy - radius * radius };
}

/**
 * Mig arc de terminador que s'escombra buscant els talls, en radians.
 *
 * Els talls són sempre a menys d'un radi umbral de l'angle del centre de
 * l'ombra, i el radi umbral val ~0,008 radis terrestres als tres eclipsis del
 * catàleg. 0,08 rad és deu vegades això: prou marge per a l'aplanament i per a
 * la variació del radi del con, i encara deixa el pas de l'escombrat a ~3 km.
 */
const TERMINATOR_SCAN_HALF_WIDTH = 0.08;
const TERMINATOR_SCAN_STEPS = 320;

/**
 * Els DOS talls de l'ombra amb el terminador en un instant, separats per quin
 * costat del centre de l'ombra cauen. Null on no n'hi ha.
 *
 * PER QUÈ DOS I NO UN. Quan l'ombra comença a sortir per la nit, el seu contorn
 * talla el terminador en dos punts que neixen junts i se separen. Tots dos
 * dibuixen vora de la franja, cadascun cap a un límit: mesurat al 26-01-2028,
 * neixen a (40,96 / 2,67) a les 16:53:22 i d'allà una branca puja fins a
 * trobar la tangència nord a les 16:56:02 i l'altra baixa fins a la sud a les
 * 16:57:40. Amb una sola branca, la tapa del 2028 es deixava 240 km de vora i
 * el polígon no tancava. Al 12-08-2026 la branca curta fa només ~35 km —
 * l'ombra és tres vegades més estreta i frega el terminador molt menys estona—,
 * i per això el defecte hi passava més desapercebut.
 *
 * `side` tria l'extrem del recorregut: 'set' és la posta (el punt es fa fosc,
 * dζ₁/dt < 0) i 'rise' l'alba.
 */
function capPointsAt(
  eclipseId: string,
  utcMs: number,
  side: 'rise' | 'set',
): { before: PathPoint | null; after: PathPoint | null } {
  const el = elementsFor(eclipseId);
  const tdtHours = utcMsToTdtHours(eclipseId, el, utcMs);
  const ev = evaluateAt(el, tdtHours);
  const evBefore = evaluateAt(el, tdtHours - DERIVATIVE_STEP_HOURS);
  const evAfter = evaluateAt(el, tdtHours + DERIVATIVE_STEP_HOURS);

  // L'angle del centre de l'ombra sobre la circumferència del terminador. Els
  // talls, si n'hi ha, hi són a tocar.
  const phi0 = Math.atan2(ev.y / ev.rho1, ev.x);

  /** Positiu si al punt hi toca el Sol; zero al terminador. */
  const daylight = (e: EvaluatedElements, point: SurfacePoint): number =>
    fundamentalCoords(e, el.deltaT, point.lat, point.lon).zeta1;

  const found: { before: PathPoint | null; after: PathPoint | null } = {
    before: null,
    after: null,
  };
  const rate = { before: 0, after: 0 };

  let previous = terminatorPoint(el, ev, phi0 - TERMINATOR_SCAN_HALF_WIDTH);
  for (let i = 1; i <= TERMINATOR_SCAN_STEPS; i++) {
    const phi =
      phi0 -
      TERMINATOR_SCAN_HALF_WIDTH +
      (2 * TERMINATOR_SCAN_HALF_WIDTH * i) / TERMINATOR_SCAN_STEPS;
    const current = terminatorPoint(el, ev, phi);

    if (previous.f > 0 !== current.f > 0) {
      let lo =
        phi0 -
        TERMINATOR_SCAN_HALF_WIDTH +
        (2 * TERMINATOR_SCAN_HALF_WIDTH * (i - 1)) / TERMINATOR_SCAN_STEPS;
      let hi = phi;
      let loPositive = previous.f > 0;
      let root = current;
      let rootPhi = phi;
      for (let k = 0; k < 50 && hi - lo > 1e-14; k++) {
        const mid = (lo + hi) / 2;
        root = terminatorPoint(el, ev, mid);
        rootPhi = mid;
        if (root.f > 0 === loPositive) {
          lo = mid;
          loPositive = root.f > 0;
        } else {
          hi = mid;
        }
      }

      // Els dos signes que decideixen. Es mesuren al punt FIX de la Terra, per
      // diferència centrada d'un segon, igual que la tangència.
      const dDaylight = daylight(evAfter, root.point) - daylight(evBefore, root.point);
      const dShadow =
        shadowFunction(el, evAfter, root.point.lat, root.point.lon) -
        shadowFunction(el, evBefore, root.point.lat, root.point.lon);

      const wantedSign = side === 'set' ? -1 : 1;
      const onBoundary = dDaylight * dShadow > 0;
      const rightEnd = dDaylight * wantedSign > 0;

      // La branca es tria pel costat del centre de l'ombra on cau l'arrel. Les
      // dues arrels neixen juntes a φ₀ i se'n separen cadascuna cap a la seva
      // banda, o sigui que el signe de (φ − φ₀) és una etiqueta estable al
      // llarg de tot el recorregut de la tapa.
      const branch = rootPhi < phi0 ? 'before' : 'after';
      if (onBoundary && rightEnd && Math.abs(dShadow) >= rate[branch]) {
        rate[branch] = Math.abs(dShadow);
        found[branch] = { lat: root.point.lat, lon: root.point.lon, timeMs: utcMs };
      }
    }

    previous = current;
  }

  return found;
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
 * Instants UT en què l'OMBRA —no el seu eix— toca la Terra per primer i darrer
 * cop.
 *
 * `findPathEnds` dona quan hi toca l'EIX, que és el que tabula el GSFC i el que
 * limita la línia central. Però l'ombra té amplada: al 12-08-2026 encara cobreix
 * territori 116 s després que l'eix hagi marxat (fins a les 18:34:05), i 118 s
 * abans que hi arribi. Al 2028 són 216 s a cada banda i al 2027, 96. Aquells
 * segons no són cap detall: és quan la franja passa per València i les Balears.
 *
 * La condició és que el disc de l'ombra encara talli el de la Terra al pla
 * fonamental. Al sistema aplanat la Terra és el cercle unitat i l'ombra hi és
 * gairebé un cercle de radi |l₂| (el radi del con a ζ = 0, que és on toca el
 * limbe); l'aplanament el deforma menys de 200 m, i com que erra pel cantó
 * generós només afegeix un parell de mostres buides.
 */
function findUmbraEnds(eclipseId: string, el: BesselianElements): [number, number] | null {
  const margin = (tdtHours: number): number => {
    const ev = evaluateAt(el, tdtHours);
    const radius = Math.abs(ev.l2) / ev.rho1;
    return 1 + radius - Math.hypot(ev.x, ev.y / ev.rho1);
  };

  const step = 1 / 60;
  let first: number | null = null;
  let last: number | null = null;
  for (let t = el.t0 - PATH_SEARCH_HOURS; t <= el.t0 + PATH_SEARCH_HOURS; t += step) {
    if (margin(t) >= 0) {
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
      if (margin(mid) >= 0) a = mid;
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
  if (points.length === 0) return points;

  /*
   * ELS CAPS DE LA CORBA TAMBÉ S'HAN DE BUSCAR.
   *
   * El mostreig uniforme deixa la corba acabada a l'última mostra que ha sortit
   * bé, i la següent —la que ja no existeix— pot ser un pas sencer més enllà.
   * Amb l'ombra rasant, un pas de 60 s val centenars de km: el límit nord del
   * 12-08-2026 mor a les 18:30:18 i la mostra bona més tardana era la de les
   * 18:30:06, o sigui 245 km abans d'on de veritat s'acaba. La tapa començava
   * igual de tard i entre les dues hi quedava un forat que després es cosia amb
   * una recta — el mateix defecte, un ordre de magnitud més petit.
   *
   * Es bisecta dins de l'últim pas, on la validesa sí que és un interval.
   */
  const findEdge = (validMs: number, emptyMs: number): PathPoint | null => {
    let good = validMs;
    let bad = emptyMs;
    let found: PathPoint | null = null;
    while (Math.abs(bad - good) > MIN_REFINE_MS) {
      const mid = (good + bad) / 2;
      const p = evaluate(mid);
      if (p === null) bad = mid;
      else {
        good = mid;
        found = p;
      }
    }
    return found;
  };

  const head = findEdge(points[0].timeMs, Math.max(startMs - stepMs, points[0].timeMs - stepMs));
  if (head !== null && head.timeMs < points[0].timeMs) points.unshift(head);
  const tailFrom = points[points.length - 1].timeMs;
  const tail = findEdge(tailFrom, Math.min(endMs + stepMs, tailFrom + stepMs));
  if (tail !== null && tail.timeMs > tailFrom) points.push(tail);

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
 * Finestra, a cada extrem del recorregut, dins la qual es vigila que un límit
 * no reculi, en ms. El reculament només pot passar als trams on la franja ja
 * no està limitada per una tangència sinó pel terminador, que als tres
 * eclipsis del catàleg duren ben bé un parell de minuts; cinc minuts els
 * cobreixen amb marge i mantenen el criteri local (lluny dels extrems, una
 * trajectòria que dona la volta al món pot tornar a "avançar" respecte de la
 * direcció final sense que això sigui cap defecte).
 */
const TRIM_WINDOW_MS = 5 * 60 * 1000;

/**
 * Retalla el cap i la cua d'un límit quan es posen a recular.
 *
 * EL PERQUÈ. Als extrems del recorregut el límit ja no és cap tangència sinó
 * l'extrem de l'arc de terminador eclipsat (vegeu `pathLimitsAt`), i aquest
 * arc creix i s'encongeix a mesura que l'ombra entra i surt de la Terra:
 *
 *  - A la CUA, quan l'arc s'encongeix, el seu extrem RETROCEDEIX pel damunt
 *    de territori que la franja ja ha cobert: al 2028, el límit nord surt
 *    fins a (42,12°N 1,44°E) i després desfà uns 30 km cap al sud-oest.
 *    Aquells punts de tornada són interiors de la franja —cada un queda dins
 *    de la unió d'ombres ja escombrada— i dibuixar-los feia un ganxo de ~180°
 *    a la vora del polígon.
 *  - Al CAP passa el mirall exacte: al 2028 el límit nord comença reculant
 *    40 km cap a l'oest (l'extrem de l'arc de l'alba s'estén enrere) abans
 *    que la tangència prengui el relleu 650 km més enllà, i la polilínia feia
 *    una banya amb un gir de ~170° a la punta.
 *
 * El criteri és la monotonia del paràmetre de recorregut: es projecta cada
 * extrem sobre la direcció local de la línia central (que és estrictament
 * monòtona, perquè l'eix no recula mai) i es talla la cua al punt de
 * projecció màxima i el cap al de projecció mínima. Amb un extrem sa el
 * màxim/mínim és l'últim/primer punt i no es retalla res — és el cas del
 * 2026 i del 2027.
 */
function trimRetrogradeEnds(points: PathPoint[], center: PathPoint[]): PathPoint[] {
  if (points.length < 3 || center.length < 2) return points;

  /** Projecció local en km sobre la direcció d'un segment de la central. */
  const alongTrack = (a: PathPoint, b: PathPoint): ((p: PathPoint) => number) | null => {
    const kmPerDegLon = KM_PER_DEG_LAT * Math.cos(b.lat * DEG);
    let ux = (b.lon - a.lon) * kmPerDegLon;
    let uy = (b.lat - a.lat) * KM_PER_DEG_LAT;
    const norm = Math.hypot(ux, uy);
    if (norm === 0) return null;
    ux /= norm;
    uy /= norm;
    return (p) => (p.lon - b.lon) * kmPerDegLon * ux + (p.lat - b.lat) * KM_PER_DEG_LAT * uy;
  };

  let first = 0;
  let last = points.length - 1;

  const tailAlong = alongTrack(center[center.length - 2], center[center.length - 1]);
  if (tailAlong !== null) {
    const cutoffMs = points[last].timeMs - TRIM_WINDOW_MS;
    let best = -Infinity;
    for (let i = points.length - 1; i >= 0 && points[i].timeMs >= cutoffMs; i--) {
      const along = tailAlong(points[i]);
      // Estrictament major: entre empats es queda el punt més tardà, que és
      // el que ja duu el refinament temporal fet.
      if (along > best) {
        best = along;
        last = i;
      }
    }
  }

  const headAlong = alongTrack(center[0], center[1]);
  if (headAlong !== null) {
    const cutoffMs = points[0].timeMs + TRIM_WINDOW_MS;
    let best = Infinity;
    for (let i = 0; i <= last && points[i].timeMs <= cutoffMs; i++) {
      const along = headAlong(points[i]);
      if (along < best) {
        best = along;
        first = i;
      }
    }
  }

  return points.slice(first, last + 1);
}

/**
 * LA MEMÒRIA DE LA FRANJA, UNA I COMPARTIDA.
 *
 * Aquest càlcul val entre 108 i 147 ms (mesurat, no estimat: 117,7 ms per al
 * 2026, 144,3 per al 2027 i 133,1 per al 2028) i el demanen quatre llocs
 * diferents —el mini-mapa de la portada, el mapa gran, la distància a la línia
 * central i la graella del mapa de calor—, cada un amb la seva memòria pròpia.
 * Quatre memòries volen dir que obrir la portada i després el mapa el paga dues
 * vegades, i que el primer moviment del mapa de calor el torna a pagar.
 *
 * Es memoritza AQUÍ, al mòdul que el produeix, perquè és l'únic lloc on tots
 * quatre hi passen. La clau porta el pas de mostreig: `stepSeconds` canvia la
 * geometria i dues crides amb passos diferents no són la mateixa resposta.
 *
 * No es poda mai: són tres eclipsis i el mòdul viu tant com la pestanya.
 */
const pathCache = new Map<string, EclipsePath>();

/**
 * Franja de centralitat completa de l'eclipsi: línia central, límit nord i
 * límit sud.
 *
 * MEMORITZADA: vegeu `pathCache`. Si necessites forçar el càlcul —una prova
 * que mesuri el cost, per exemple— demana-la amb un `stepSeconds` explícit
 * diferent, o buida la memòria amb `resetPathCache()`.
 */
export function computeEclipsePath(eclipseId: string, options: PathOptions = {}): EclipsePath {
  const key = `${eclipseId}@${options.stepSeconds ?? 60}`;
  const cached = pathCache.get(key);
  if (cached !== undefined) return cached;
  const fresh = computeEclipsePathUncached(eclipseId, options);
  pathCache.set(key, fresh);
  return fresh;
}

/** Buida la memòria de franges. Només per a proves que mesurin el cost. */
export function resetPathCache(): void {
  pathCache.clear();
}

function computeEclipsePathUncached(
  eclipseId: string,
  options: PathOptions = {},
): EclipsePath {
  const el = elementsFor(eclipseId);
  const kind = getEclipse(eclipseId).kind;
  const stepMs = (options.stepSeconds ?? 60) * 1000;

  const ends = findPathEnds(eclipseId, el);
  if (ends === null) {
    throw new Error(`L'ombra central de ${eclipseId} no toca la Terra`);
  }
  const [startMs, endMs] = ends;
  const [umbraStartMs, umbraEndMs] = findUmbraEnds(eclipseId, el) ?? ends;

  const sample = (
    pick: (timeMs: number) => PathPoint | null,
    fromMs: number,
    toMs: number,
  ) => unwrap(sampleCurve(pick, fromMs, toMs, stepMs));

  /*
   * LA GRAELLA DE MOSTREIG S'ANCORA A `startMs`, NO AL PRINCIPI DE LA FINESTRA.
   *
   * Els límits ara es mostregen sobre la finestra de l'OMBRA, que comença abans
   * que la de l'eix (116 s abans al 2026). Si es comencés a comptar des d'allà,
   * TOTES les mostres quedarien desplaçades mig pas respecte de les d'abans:
   * la corba seria la mateixa però els vèrtexs, uns altres, i qualsevol mesura
   * de distància a la polilínia canviaria uns centenars de metres. No és cap
   * hipòtesi — el mirador «Alto de la Mora» (40,5801 / −4,27327) és a 20,1 km
   * del límit sud del 2026, just al llindar dels 20 km amb què es publiquen els
   * miradors, i el desplaçament de la graella el feia saltar a fora.
   *
   * Ancorant la graella a `startMs`, tots els instants que es mostrejaven abans
   * se segueixen mostrejant i els nous només s'hi afegeixen. El canvi és
   * estrictament additiu: cap distància a la polilínia no pot créixer.
   */
  const alignedStart = (fromMs: number): number =>
    startMs - Math.ceil((startMs - fromMs) / stepMs) * stepMs;

  // La línia central existeix només mentre l'EIX toca la Terra: la seva
  // finestra no es toca, i és la que fixen les taules del GSFC.
  const center = sample((t) => centralLineAt(eclipseId, t), startMs, endMs);

  /*
   * ELS LÍMITS, ARA NOMÉS ALLÀ ON SÓN LÍMIT DE VERITAT.
   *
   * Es mostregen sobre la finestra de l'OMBRA, no la de l'eix: al 12-08-2026
   * el límit sud segueix essent la vora de la franja fins a les 18:33:50, 101 s
   * després que l'eix marxi, i abans això no es mirava.
   *
   * I es queden NOMÉS les arrels de tangència. Quan la tangència mor —perquè
   * llisca fora del disc terrestre—, `pathLimitsAt` retorna el tall de limbe
   * més extrem, que és una tria correcta per a la petjada d'aquell instant
   * però NO és vora de la unió: mesurat al 2026, el «límit nord» de les
   * 18:30:20 té F = −1,8·10⁻⁶ i el de les 18:32:50, −6,5·10⁻⁵ — cada cop més
   * endins. Dibuixar-los estirava la vora nord per dins de la franja i deixava
   * la tapa sense on agafar-se. A partir d'allà mana la tapa (vegeu
   * `capPointAt`).
   */
  const tangencyOnly = (side: 'north' | 'south') => (t: number) => {
    const limit = limitsAt(eclipseId, t, true)[side];
    return limit === null || !limit.tangency ? null : limit.point;
  };

  const northLimit = trimRetrogradeEnds(
    sample(tangencyOnly('north'), alignedStart(umbraStartMs), umbraEndMs),
    center,
  );
  const southLimit = trimRetrogradeEnds(
    sample(tangencyOnly('south'), alignedStart(umbraStartMs), umbraEndMs),
    center,
  );

  /*
   * LA TAPA, COSIDA PEL PUNT ON LES DUES BRANQUES ES TOQUEN.
   *
   * Les branques neixen juntes i se separen —o se separen i es tornen a
   * trobar—, i quin dels dos casos toca depèn de l'extrem del recorregut: a la
   * CUA neixen a l'instant en què l'ombra arriba al terminador i divergeixen; al
   * CAP convergeixen a l'instant en què l'ombra hi acaba d'entrar (al 26-01-2028
   * es troben a les 13:22:00, a 26 km l'una de l'altra). Encadenar-les sempre en
   * el mateix ordre cosia el cap per l'extrem equivocat i hi obria un forat de
   * 360 km.
   *
   * Per no haver de saber quin cas toca, es proven les quatre maneres
   * d'encadenar-les i es queda la que deixa el salt més petit al mig: la
   * geometria decideix sola.
   */
  const cap = (side: 'rise' | 'set'): PathPoint[] => {
    const branch = (which: 'before' | 'after') =>
      sample((t) => capPointsAt(eclipseId, t, side)[which], alignedStart(umbraStartMs), umbraEndMs);
    const first = branch('before');
    const second = branch('after');
    if (first.length === 0) return second;
    if (second.length === 0) return first;

    let best: PathPoint[] = [];
    let bestGap = Infinity;
    for (const a of [first, [...first].reverse()]) {
      for (const b of [second, [...second].reverse()]) {
        const gap = approxDistanceKm(a[a.length - 1], b[0]);
        if (gap < bestGap) {
          bestGap = gap;
          best = [...a, ...b];
        }
      }
    }
    return best;
  };

  return {
    eclipseId,
    kind,
    center,
    northLimit,
    southLimit,
    startCap: cap('rise'),
    endCap: cap('set'),
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
   * La vora de la franja com a línies independents: els dos límits i les dues
   * tapes.
   *
   * No és redundant amb `band`. L'anell del polígon és una figura tancada que
   * el retall polar pot haver partit i tornat a cosir; aquí cada tros de vora
   * es dibuixa pel seu compte, sense cap segment de tancament.
   */
  limits: Feature<MultiLineString, EclipsePathProperties>;
}

// `readonly` a posta: les tapes arriben com a llistes immutables i aquesta
// funció només llegeix. Demanar-les mutables obligava a copiar-les per no res.
const toCoords = (points: readonly PathPoint[]): [number, number][] =>
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

  /*
   * LES TAPES ES COSEN PER PROXIMITAT, i només si de veritat tanquen.
   *
   * Cada tapa surt ordenada en el temps, però quin dels seus dos extrems toca
   * el límit nord i quin el sud depèn de quina tangència mor primer, i això
   * canvia d'eclipsi a eclipsi. Es gira perquè el seu primer punt sigui el del
   * costat nord; així el recorregut de l'anell (nord endavant → tapa final →
   * sud enrere → tapa inicial) no es creua mai.
   *
   * I s'hi posa NOMÉS si de veritat cau ENTRE els dos extrems: cada un dels dos
   * trossets que queden per cosir ha de ser més curt que la corda que hi hauria
   * sense tapa. És un criteri sense cap constant en quilòmetres —s'escala sol
   * amb la mida de la franja— i rebutja l'únic cas real on la tapa no toca:
   * el cap del 2026, que passa pel pol. Allà el retall de Mercator deixa els
   * límits tallats a 80° de latitud i la tapa es queda a l'altra banda del pol,
   * a 3.700 km; la corda del retall és la resposta honesta, perquè no és cap
   * vora de la franja sinó el tall del mapa.
   *
   * (Es va provar abans amb «si escurça el tancament sumant els dos trossets»,
   * i no serveix: hi va haver un estat del codi on al 2028 la suma donava
   * 431 km contra una corda de 439 i la tapa entrava per un 2 %, i un altre on
   * al 2026 donava 327 contra 271 i la tapa NO entrava —justament la que porta
   * la franja a les Balears—. Un criteri que decideix per la longitud total és
   * massa fàcil de fer bascular; el que ha de valdre és si la tapa cau entre
   * els dos extrems.)
   *
   * Els trossets que queden avui, mesurats: 47 i 143 km al 2026, 51 i 219 km al
   * 2027, 104 i 117 km al 2028. Són trams on la tangència mor uns segons abans
   * d'arribar al terminador, i allà la vora real ja és gairebé recta: la corda
   * se n'aparta 0,4 km al 2026, 0,2 km al costat nord del 2028 i 1,3 km al sud
   * — per sota dels 2,9 km amb què els dos motors del projecte situen la franja
   * (ESTAT.md §5), o sigui invisible i honest.
   */
  const spliceCap = (
    points: readonly PathPoint[],
    from: [number, number] | undefined,
    to: [number, number] | undefined,
  ): [number, number][] => {
    const cap = longestRun(toCoords(points));
    if (cap.length < 2 || from === undefined || to === undefined) return [];
    const forward =
      coordDistanceKm(from, cap[0]) + coordDistanceKm(cap[cap.length - 1], to);
    const backward =
      coordDistanceKm(from, cap[cap.length - 1]) + coordDistanceKm(cap[0], to);
    const oriented = backward < forward ? [...cap].reverse() : cap;
    const chord = coordDistanceKm(from, to);
    const gapIn = coordDistanceKm(from, oriented[0]);
    const gapOut = coordDistanceKm(oriented[oriented.length - 1], to);
    return gapIn < chord && gapOut < chord ? oriented : [];
  };

  const endCap = spliceCap(path.endCap, north[north.length - 1], south[south.length - 1]);
  const startCap = spliceCap(path.startCap, north[0], south[0]);

  /*
   * LES TRES CAPES SURTEN D'AQUÍ, I NOMÉS D'AQUÍ.
   *
   * El mapa pinta el farciment (`band`), les vores (`limits`) i la central
   * (`centerLine`) com a capes separades. Si les vores es calculen a part del
   * polígon, n'hi ha prou que una es retalli i l'altra no perquè quedi un tros
   * de vora surant sense res a sota: va passar exactament això —un arc taronja
   * sol enmig del Mediterrani, cap a 38,5°N 5°E— quan la tapa es dibuixava com
   * a límit però no s'havia arribat a cosir dins de l'anell.
   *
   * Per això `pieces` es calcula UN COP: l'anell és la concatenació d'aquests
   * trossos i `limits` són aquests mateixos trossos, ni un més. Si un tros no
   * entra al polígon, tampoc no es pinta com a vora.
   */
  const pieces = [north, endCap, south, startCap].filter((piece) => piece.length > 1);

  const ring = [
    ...north,
    ...endCap,
    ...[...south].reverse(),
    ...[...startCap].reverse(),
  ];
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
      // Exactament els trossos de què està fet l'anell, cadascun com una línia.
      // Res que no sigui vora del polígon no es pinta com a vora.
      geometry: { type: 'MultiLineString', coordinates: pieces },
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

/** El mateix, sobre parells en ordre GeoJSON ([longitud, latitud]). */
function coordDistanceKm(a: readonly [number, number], b: readonly [number, number]): number {
  return approxDistanceKm({ lon: a[0], lat: a[1] }, { lon: b[0], lat: b[1] });
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
