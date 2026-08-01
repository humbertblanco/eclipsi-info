/**
 * Avaluació del World Magnetic Model: de (latitud, longitud, altitud, data) al
 * vector del camp magnètic terrestre, i d'aquí a la declinació.
 *
 * PER QUÈ HO NECESSITEM. La brúixola d'un mòbil apunta al nord MAGNÈTIC, i
 * nosaltres projectem el Sol amb azimuts GEOGRÀFICS. La diferència, la
 * declinació, val de −0,9° a Galícia a +2,2° a Catalunya, i −3,5° a Tenerife.
 * El diàmetre aparent del Sol és 0,53°: a Canàries, ignorar-la desplaça la
 * superposició set diàmetres solars. No és un refinament.
 *
 * COM ESTÀ VALIDAT. `wmm.test.ts` passa els cent valors de prova oficials del
 * WMM2025 (NOAA/NCEI) per aquesta funció. Aquesta és tota la garantia que hi
 * ha: la matemàtica del desenvolupament en harmònics esfèrics té una desena de
 * llocs on un signe canviat dona resultats que semblen raonables i són
 * falsos, i l'única defensa és comparar amb els números publicats.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import {
  WGS84_FLATTENING,
  WGS84_SEMI_MAJOR_M,
  WMM_EPOCH,
  WMM_G,
  WMM_G_DOT,
  WMM_H,
  WMM_H_DOT,
  WMM_MAX_DEGREE,
  WMM_REFERENCE_RADIUS_M,
  coefficientIndex,
} from './wmm2025';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Els set elements clàssics del camp geomagnètic en un punt. */
export interface MagneticField {
  /** Declinació: angle del nord magnètic respecte del geogràfic, en graus. Est positiu. */
  declinationDeg: number;
  /** Inclinació: angle del camp respecte de l'horitzontal, en graus. Avall positiu. */
  inclinationDeg: number;
  /** Component nord, en nT. */
  xNt: number;
  /** Component est, en nT. */
  yNt: number;
  /** Component vertical cap avall, en nT. */
  zNt: number;
  /** Intensitat horitzontal, en nT. */
  horizontalNt: number;
  /** Intensitat total, en nT. */
  totalNt: number;
}

/**
 * Any decimal a partir d'una data.
 *
 * Es fa amb el dia de l'any i no amb una divisió de mil·lisegons perquè els
 * anys de traspàs desplacen el resultat prou com per moure la declinació a la
 * tercera xifra. No importa gaire, però costa el mateix fer-ho bé.
 */
export function decimalYear(date: Date): number {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return year + (date.getTime() - start) / (end - start);
}

/**
 * Funcions associades de Legendre semi-normalitzades de Schmidt i la seva
 * derivada respecte de la colatitud.
 *
 * La normalització de Schmidt té una excepció que és font clàssica d'errors:
 * el factor sectorial porta un √2 addicional NOMÉS al pas de n=0 a n=1. Sense
 * aquest √2 tot el model queda escalat i la declinació surt plausible però
 * equivocada en graus.
 */
function legendre(
  cosTheta: number,
  sinTheta: number,
  maxDegree: number,
): { p: Float64Array; dp: Float64Array } {
  const size = ((maxDegree + 1) * (maxDegree + 2)) / 2;
  const p = new Float64Array(size);
  const dp = new Float64Array(size);

  // Índex intern que inclou n=0, a diferència del de les taules de coeficients.
  const idx = (n: number, m: number): number => (n * (n + 1)) / 2 + m;

  p[idx(0, 0)] = 1;
  dp[idx(0, 0)] = 0;

  for (let n = 1; n <= maxDegree; n++) {
    for (let m = 0; m <= n; m++) {
      if (n === m) {
        // Terme sectorial, amb el √2 de Schmidt només al primer pas.
        const factor = Math.sqrt((2 * n - 1) / (2 * n)) * (n === 1 ? Math.SQRT2 : 1);
        const prev = idx(n - 1, n - 1);
        p[idx(n, n)] = factor * sinTheta * p[prev];
        dp[idx(n, n)] = factor * (sinTheta * dp[prev] + cosTheta * p[prev]);
      } else {
        const a = 2 * n - 1;
        const b = Math.sqrt((n - 1) * (n - 1) - m * m);
        const c = Math.sqrt(n * n - m * m);
        const i1 = idx(n - 1, m);
        const i2 = n - 2 >= m ? idx(n - 2, m) : -1;
        const p2 = i2 >= 0 ? p[i2] : 0;
        const dp2 = i2 >= 0 ? dp[i2] : 0;
        p[idx(n, m)] = (a * cosTheta * p[i1] - b * p2) / c;
        dp[idx(n, m)] =
          (a * (cosTheta * dp[i1] - sinTheta * p[i1]) - b * dp2) / c;
      }
    }
  }

  return { p, dp };
}

/**
 * Camp magnètic terrestre en un punt i una data.
 *
 * @param latDeg latitud geodèsica en graus, positiva al nord.
 * @param lonDeg longitud en graus, positiva a l'est.
 * @param heightM altitud sobre l'el·lipsoide, en metres. A Espanya la
 *   diferència entre altitud sobre el geoide i sobre l'el·lipsoide és de
 *   cinquanta metres, que en declinació no es nota: no val la pena convertir.
 * @param date instant. La variació secular val fins a 0,2°/any i sí que es nota.
 */
export function magneticField(
  latDeg: number,
  lonDeg: number,
  heightM: number,
  date: Date,
): MagneticField {
  const t = decimalYear(date) - WMM_EPOCH;

  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;

  // Geodèsic a geocèntric esfèric sobre el WGS84.
  const f = WGS84_FLATTENING;
  const e2 = f * (2 - f);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const rc = WGS84_SEMI_MAJOR_M / Math.sqrt(1 - e2 * sinLat * sinLat);
  const px = (rc + heightM) * cosLat;
  const pz = (rc * (1 - e2) + heightM) * sinLat;
  const r = Math.hypot(px, pz);
  const geocentricLat = Math.asin(pz / r);

  const cosTheta = Math.sin(geocentricLat); // cos(colatitud) = sin(latitud)
  const sinTheta = Math.cos(geocentricLat);

  const { p, dp } = legendre(cosTheta, sinTheta, WMM_MAX_DEGREE);
  const idx = (n: number, m: number): number => (n * (n + 1)) / 2 + m;

  // Sinus i cosinus de mλ per recurrència: dotze crides trigonomètriques menys.
  const cosM = new Float64Array(WMM_MAX_DEGREE + 1);
  const sinM = new Float64Array(WMM_MAX_DEGREE + 1);
  cosM[0] = 1;
  sinM[0] = 0;
  const cosLon = Math.cos(lon);
  const sinLon = Math.sin(lon);
  for (let m = 1; m <= WMM_MAX_DEGREE; m++) {
    cosM[m] = cosM[m - 1] * cosLon - sinM[m - 1] * sinLon;
    sinM[m] = sinM[m - 1] * cosLon + cosM[m - 1] * sinLon;
  }

  const ratio = WMM_REFERENCE_RADIUS_M / r;

  // Components en el marc GEOCÈNTRIC esfèric.
  let xp = 0;
  let yp = 0;
  let zp = 0;

  for (let n = 1; n <= WMM_MAX_DEGREE; n++) {
    const rn = Math.pow(ratio, n + 2);
    for (let m = 0; m <= n; m++) {
      const k = coefficientIndex(n, m);
      const g = WMM_G[k] + t * WMM_G_DOT[k];
      const h = WMM_H[k] + t * WMM_H_DOT[k];

      const gc = g * cosM[m] + h * sinM[m];
      const gs = g * sinM[m] - h * cosM[m];

      const pi = idx(n, m);
      // La component nord és −∂V/∂φ' i la derivada de Legendre la calculem
      // respecte de la COLATITUD, que va al revés de la latitud: els dos
      // signes negatius s'anul·len i queda una suma.
      xp += rn * gc * dp[pi];
      zp -= rn * (n + 1) * gc * p[pi];

      if (m > 0) {
        // P/sinθ té una singularitat al pol. Prop del pol s'hi arriba amb el
        // límit; a Espanya aquesta branca no s'executa mai, però un usuari amb
        // una posició falsejada no ha de fer petar l'aplicació.
        //
        // EL SIGNE DEPÈN DE QUIN POL. El límit de P_n¹(cosθ)/sinθ val +dP/dθ al
        // pol NORD i −dP/dθ al pol SUD, perquè sinθ hi arriba a zero per l'altra
        // banda. Sense el factor `sign(cosθ)`, la declinació al pol sud saltava
        // 63,53° respecte del punt a una desena de mil·lèsima de grau al costat,
        // i encara es donava per bona.
        const pOverSin =
          Math.abs(sinTheta) > 1e-10
            ? p[pi] / sinTheta
            : m === 1
              ? dp[pi] * Math.sign(cosTheta)
              : 0;
        yp += rn * m * gs * pOverSin;
      }
    }
  }

  // Del marc geocèntric al geodèsic: girar per la diferència de latituds.
  const dLat = geocentricLat - lat;
  const cosD = Math.cos(dLat);
  const sinD = Math.sin(dLat);
  const x = xp * cosD - zp * sinD;
  const y = yp;
  const z = xp * sinD + zp * cosD;

  const horizontal = Math.hypot(x, y);

  return {
    declinationDeg: Math.atan2(y, x) * RAD,
    inclinationDeg: Math.atan2(z, horizontal) * RAD,
    xNt: x,
    yNt: y,
    zNt: z,
    horizontalNt: horizontal,
    totalNt: Math.hypot(horizontal, z),
  };
}
