/**
 * Elements besselians dels tres eclipsis del catàleg.
 *
 * Font: "Five Millennium Canon of Solar Eclipses: -1999 to +3000",
 * Fred Espenak i Jean Meeus, NASA/TP-2006-214141.
 *
 * Els coeficients i el ΔT són els que publica avui el GSFC a les pàgines
 * SEbeselm2001/SE<data>beselm.html, no els del recull en CSV que circula per
 * GitHub. La diferència no és cosmètica:
 *
 *  - ΔT: el recull antic dona 75,4 / 76,0 / 76,3 s (extrapolació del Canon de
 *    2006). El GSFC ha revisat aquestes prediccions a 71,4 / 71,7 / 71,9 s.
 *    Quatre segons de ΔT desplacen el punt de l'ombra fins a 55 km respecte de
 *    les taules de trajectòria de la NASA, perquè el ΔT és justament el que
 *    lliga l'hora TDT dels elements amb la rotació de la Terra en UT.
 *  - x0, y0: el recull antic difereix en ~8·10⁻⁵ radis terrestres, que a la
 *    cua de la franja (Sol molt baix, incidència rasant) s'amplifica fins a
 *    8 km d'error.
 *
 * Amb aquests valors, `core/eclipses/path.ts` reprodueix les coordenades
 * publicades del 12-08-2026 amb un error màxim de ~0,4 km — que és el mateix
 * ordre que l'arrodoniment a 0,1' de les taules (185 m).
 *
 * ATRIBUCIÓ OBLIGATÒRIA: "Eclipse Predictions by Fred Espenak, NASA's GSFC"
 *
 * Aquestes dades NO s'usen per a les circumstàncies locals — aquelles es
 * resolen numèricament a `core/astro/contacts.ts`, que és més precís i no
 * depèn de tenir cada eclipsi tabulat. Serveixen només per generar la franja
 * de totalitat del mapa, on la via besseliana és molt més barata que escombrar
 * el territori punt a punt.
 */

export interface BesselianElements {
  /** Dia julià de l'instant de referència t0. */
  jd: number;
  /** Hora TDT de referència, en hores. */
  t0: number;
  /** ΔT en segons, per convertir entre TDT i UT. */
  deltaT: number;
  /** Coeficients polinòmics en (t - t0), t en hores. */
  x: [number, number, number, number];
  y: [number, number, number, number];
  /** Declinació de l'eix de l'ombra, en graus. */
  d: [number, number, number];
  /** Angle horari efemèride, en graus. */
  mu: [number, number, number];
  /** Radi del con de penombra al pla fonamental. */
  l1: [number, number, number];
  /** Radi del con d'ombra al pla fonamental. Negatiu = eclipsi total. */
  l2: [number, number, number];
  tanF1: number;
  tanF2: number;
}

export const BESSELIAN: Record<string, BesselianElements> = {
  '2026-08-12': {
    jd: 2461265.241032,
    t0: 18.0,
    deltaT: 71.4,
    x: [0.475593, 0.5189288, -7.73e-5, -8.8e-6],
    y: [0.771161, -0.2301664, -0.0001245, 3.7e-6],
    d: [14.79667, -0.012065, -3e-6],
    mu: [88.74776, 15.003093, 0.0],
    l1: [0.537954, 9.4e-5, -1.21e-5],
    l2: [-0.008142, 9.35e-5, -1.21e-5],
    tanF1: 0.0046141,
    tanF2: 0.0045911,
  },
  '2027-08-02': {
    jd: 2461619.9221,
    t0: 10.0,
    deltaT: 71.7,
    x: [-0.019645, 0.5447105, -4.44e-5, -9.1e-6],
    y: [0.160063, -0.2111569, -0.0001217, 3.7e-6],
    d: [17.76247, -0.010181, -4e-6],
    mu: [328.42249, 15.002093, 0.0],
    l1: [0.530596, 1.38e-5, -1.28e-5],
    l2: [-0.015464, 1.37e-5, -1.28e-5],
    tanF1: 0.0046064,
    tanF2: 0.0045834,
  },
  '2028-01-26': {
    jd: 2461797.131231,
    t0: 15.0,
    deltaT: 71.9,
    x: [-0.205226, 0.4742711, -3.77e-5, -7e-6],
    y: [0.340278, 0.1738579, 9.68e-5, -2e-6],
    d: [-18.72825, 0.010073, 5e-6],
    mu: [41.8912, 14.998972, 0.0],
    l1: [0.574116, 4.2e-5, -9.9e-6],
    l2: [0.027839, 4.18e-5, -9.9e-6],
    tanF1: 0.0047501,
    tanF2: 0.0047264,
  },
};

/** Avalua un polinomi en (t - t0), amb t en hores TDT. */
export function evalPoly(coeffs: readonly number[], hoursFromT0: number): number {
  let result = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = result * hoursFromT0 + coeffs[i];
  }
  return result;
}
