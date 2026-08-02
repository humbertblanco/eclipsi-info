/**
 * Quanta LLUM tapa la Lluna, que no és el mateix que quanta ÀREA tapa.
 *
 * El disc del Sol no brilla igual a tot arreu: pel centre mires cap al fons de
 * la fotosfera, que és més calenta, i pel limbe mires de biaix i només veus les
 * capes altes, més fredes. El limbe brilla el ~40% del que brilla el centre.
 *
 * Això té una conseqüència que la gent no s'espera i que aquesta aplicació ha
 * d'ensenyar: la Lluna entra pel limbe (fosc) i acaba tapant el centre
 * (brillant). Per tant
 *
 *   - al principi de l'eclipsi es menja MENYS llum que àrea,
 *   - al final se'n menja MÉS.
 *
 * Amb el 95% de l'àrea tapada no queda el 5% de la llum: en queda un ~3%.
 * Möllmann & Vollmer (2006) ho mesuren i és el motiu pel qual els models
 * ingenus (llum ∝ 1 − obscuració) fallen justament al tram que importa.
 *
 * Cap dependència de DOM.
 */

import { LIMB_DARKENING_U } from './constants';

/**
 * Intensitat de la superfície solar en funció de μ = cos(angle de visió),
 * normalitzada a 1 al centre del disc (μ = 1).
 *
 * Llei lineal I(μ)/I(1) = 1 − u(1 − μ). Amb u = 0,6, el limbe (μ = 0) queda a
 * 0,4. Hi ha lleis quadràtiques més precises, però la diferència en el flux
 * integrat és de l'ordre de l'1% i la llei lineal es pot explicar en una línia.
 */
export function limbDarkenedIntensity(mu: number): number {
  const m = Math.max(0, Math.min(1, mu));
  return 1 - LIMB_DARKENING_U * (1 - m);
}

/**
 * Intensitat a una distància relativa r/R del centre del disc, de 0 a 1.
 * μ = √(1 − (r/R)²) és pura geometria d'esfera.
 */
export function intensityAtRadiusFraction(radiusFraction: number): number {
  const x = Math.max(0, Math.min(1, radiusFraction));
  return limbDarkenedIntensity(Math.sqrt(Math.max(0, 1 - x * x)));
}

/**
 * Flux mitjà del disc respecte del centre. Per a la llei lineal val 1 − u/3.
 * Amb u = 0,6 dona 0,8: el disc sencer brilla el 80% del que brillaria si tot
 * ell fos tan brillant com el centre.
 */
export const MEAN_DISC_INTENSITY = 1 - LIMB_DARKENING_U / 3;

/**
 * Fracció d'un anell de radi `r` centrat al Sol que queda dins del disc lunar
 * (radi `moonRadius`, centre a distància `separation`).
 *
 * Trigonometria de dues circumferències, sense cap aproximació.
 *
 * S'exporta perquè l'àncora de Sol de la càmera (`features/ar/sunAnchor`) la
 * fa servir per calcular el CENTROIDE del creixent durant la parcialitat: el
 * mateix arc cobert que aquí decideix quanta llum falta, allà decideix cap on
 * es desplaça el centre de llum que la càmera veu.
 */
export function ringCoveredFraction(
  r: number,
  separation: number,
  moonRadius: number,
): number {
  if (r <= 0) return separation <= moonRadius ? 1 : 0;
  // L'anell cap sencer dins la Lluna.
  if (r + separation <= moonRadius) return 1;
  // El disc lunar cau sencer dins de l'anell: l'anell no el toca.
  if (r >= separation + moonRadius) return 0;

  const cosHalfArc =
    (separation * separation + r * r - moonRadius * moonRadius) /
    (2 * separation * r);
  return Math.acos(Math.max(-1, Math.min(1, cosHalfArc))) / Math.PI;
}

/**
 * Nombre d'anells de la integració radial.
 *
 * 720 dona un error < 10⁻⁴ en la fracció de flux. L'integrand té un plec allà
 * on la vora de la Lluna talla l'anell i una derivada infinita al limbe, o sigui
 * que no val la pena una quadratura fina: més punts és més barat i més robust.
 */
const RADIAL_STEPS = 720;

/**
 * Fracció del FLUX lluminós del Sol que encara arriba, de 0 a 1.
 *
 * Integra I(r)·r·dr sobre el disc solar descomptant la part tapada. És la
 * magnitud que mana sobre la il·luminància, i és la que s'ha de fer servir
 * sempre que es conegui la geometria.
 *
 * @param separationDeg separació angular dels centres, en graus
 * @param sunRadiusDeg radi angular del Sol, en graus
 * @param moonRadiusDeg radi angular de la Lluna, en graus
 */
export function uncoveredLuminousFraction(
  separationDeg: number,
  sunRadiusDeg: number,
  moonRadiusDeg: number,
): number {
  if (sunRadiusDeg <= 0) return 0;

  const d = Math.abs(separationDeg);
  const rs = sunRadiusDeg;
  const rm = Math.max(0, moonRadiusDeg);

  if (d >= rs + rm) return 1;
  // Totalitat: el disc lunar engoleix el solar.
  if (rm >= rs && d <= rm - rs) return 0;

  let total = 0;
  let covered = 0;
  for (let i = 0; i < RADIAL_STEPS; i++) {
    const x = (i + 0.5) / RADIAL_STEPS;
    const weight = intensityAtRadiusFraction(x) * x;
    total += weight;
    covered += weight * ringCoveredFraction(x * rs, d, rm);
  }

  return Math.max(0, Math.min(1, 1 - covered / total));
}

/**
 * Obscuració (fracció d'ÀREA tapada) per a la mateixa geometria.
 *
 * Existeix aquí, duplicant `core/astro/geometry.ts`, només per poder construir
 * la taula de conversió obscuració → flux sense crear una dependència creuada
 * entre dos nuclis que han de poder viure separats. La fórmula és la mateixa i
 * els tests comproven que els dos mòduls donen el mateix número.
 */
export function coveredAreaFraction(
  separationDeg: number,
  sunRadiusDeg: number,
  moonRadiusDeg: number,
): number {
  const d = Math.abs(separationDeg);
  const r = sunRadiusDeg;
  const R = moonRadiusDeg;

  if (r <= 0) return 0;
  if (d >= r + R) return 0;
  if (d <= Math.abs(R - r)) return Math.min(1, (R * R) / (r * r));

  const alpha = Math.acos(
    Math.max(-1, Math.min(1, (d * d + r * r - R * R) / (2 * d * r))),
  );
  const beta = Math.acos(
    Math.max(-1, Math.min(1, (d * d + R * R - r * r) / (2 * d * R))),
  );
  const triangle =
    0.5 *
    Math.sqrt(
      Math.max(0, (-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R)),
    );

  return Math.min(1, (r * r * alpha + R * R * beta - triangle) / (Math.PI * r * r));
}

/**
 * Taula de conversió obscuració → fracció de flux, per al cas en què només es
 * coneix l'obscuració.
 *
 * Es construeix per a discos IGUALS (radi lunar = radi solar). És la geometria
 * "mitjana": als eclipsis totals la raó de radis va d'1,01 a 1,06 i als anulars
 * de 0,93 a 0,99, i en aquest ventall la corba obscuració → flux amb prou feines
 * es mou (menys d'un 3% de diferència relativa per sota del 90% d'obscuració).
 *
 * APROXIMACIÓ CONEGUDA: als eclipsis ANULARS profunds la taula falla. Allà
 * l'obscuració es planta a k² i el que queda és un anell prim ENGANXAT al
 * limbe, o sigui el tros més fosc de tot el disc; la taula, que suposa una
 * mitja lluna, en dona massa llum. Per això `skyState` accepta la geometria
 * exacta: si la tens, passa-la.
 */
const TABLE_STEPS = 400;

function buildObscurationTable(): { obscuration: number[]; flux: number[] } {
  const obscuration: number[] = [];
  const flux: number[] = [];

  // Recorrem la separació de 2 radis (no hi ha eclipsi) fins a 0 (totalitat),
  // de manera que l'obscuració surt creixent i la taula queda ordenada.
  for (let i = 0; i <= TABLE_STEPS; i++) {
    const d = 2 * (1 - i / TABLE_STEPS);
    obscuration.push(coveredAreaFraction(d, 1, 1));
    flux.push(uncoveredLuminousFraction(d, 1, 1));
  }
  return { obscuration, flux };
}

const OBSCURATION_TABLE = buildObscurationTable();

/**
 * Fracció de flux lluminós que queda, a partir només de l'obscuració.
 *
 * Fes servir `uncoveredLuminousFraction` sempre que puguis; això és el pla B.
 */
export function luminousFractionFromObscuration(obscuration: number): number {
  const o = Math.max(0, Math.min(1, obscuration));
  const { obscuration: xs, flux: ys } = OBSCURATION_TABLE;

  if (o <= xs[0]) return ys[0];
  if (o >= xs[xs.length - 1]) return ys[ys.length - 1];

  // Cerca binària: la taula és monòtona creixent en obscuració.
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= o) lo = mid;
    else hi = mid;
  }

  const span = xs[hi] - xs[lo];
  const t = span > 0 ? (o - xs[lo]) / span : 0;
  return Math.max(0, Math.min(1, ys[lo] + t * (ys[hi] - ys[lo])));
}
