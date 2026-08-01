/**
 * Coeficients de Gauss del World Magnetic Model 2025.
 *
 * ORIGEN I LLICÈNCIA. Són els coeficients oficials del WMM2025, produïts per
 * la NOAA/NCEI amb el British Geological Survey. El programari i els
 * coeficients del WMM són obra del govern dels Estats Units i estan en domini
 * públic: es poden redistribuir sense restriccions. Els hem transcrit aquí en
 * comptes d'afegir una dependència de npm perquè són 168 números que no
 * canvien fins al desembre de 2029, i una taula que no canvia no val una
 * dependència.
 *
 * PER QUÈ NO ARRODONIM. Els valors van amb la precisió publicada (una dècima
 * de nanotesla). Retallar-la desplaçaria la declinació a la quarta xifra, que
 * no importa, però trencaria la validació contra els valors de prova oficials,
 * que sí que importa: és l'única manera que tenim de saber que la
 * implementació no té un error de signe.
 *
 * CADUCITAT. El model és vàlid del 2024-11-13 al 2029-11-13. Fora d'aquest
 * interval el camp real ja s'ha desviat prou del model per notar-se, i
 * `declination()` marca el resultat com a caducat en comptes de mentir. El
 * WMM2030 surt el desembre de 2029.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

/** Grau màxim del desenvolupament en harmònics esfèrics. */
export const WMM_MAX_DEGREE = 12;

/** Època del model, en anys decimals. */
export const WMM_EPOCH = 2025.0;

/** Inici de la validesa declarada, en anys decimals (2024-11-13). */
export const WMM_VALID_FROM = 2024.87;
/** Final de la validesa declarada, en anys decimals (2029-11-13). */
export const WMM_VALID_TO = 2029.87;

/**
 * Les quatre taules van aplanades en l'ordre (n=1..12, m=0..n), que és el que
 * recorre el bucle de l'avaluació. `index(n, m) = n(n+1)/2 + m − 1`.
 */
export function coefficientIndex(n: number, m: number): number {
  return (n * (n + 1)) / 2 + m - 1;
}

/** g(n,m) a l'època, en nT. */
export const WMM_G: readonly number[] = [
  -29351.8, -1410.8,
  -2556.6, 2951.1, 1649.3,
  1361, -2404.1, 1243.8, 453.6,
  895, 799.5, 55.7, -281.1, 12.1,
  -233.2, 368.9, 187.2, -138.7, -142, 20.9,
  64.4, 63.8, 76.9, -115.7, -40.9, 14.9, -60.7,
  79.5, -77, -8.8, 59.3, 15.8, 2.5, -11.1, 14.2,
  23.2, 10.8, -17.5, 2, -21.7, 16.9, 15, -16.8, 0.9,
  4.6, 7.8, 3, -0.2, -2.5, -13.1, 2.4, 8.6, -8.7, -12.9,
  -1.3, -6.4, 0.2, 2, -1, -0.6, -0.9, 1.5, 0.9, -2.7, -3.9,
  2.9, -1.5, -2.5, 2.4, -0.6, -0.1, -0.6, -0.1, 1.1, -1, -0.2, 2.6,
  -2, -0.2, 0.3, 1.2, -1.3, 0.6, 0.6, 0.5, -0.1, -0.4, -0.2, -1.3, -0.7,
];

/** h(n,m) a l'època, en nT. Sempre zero per a m = 0. */
export const WMM_H: readonly number[] = [
  0, 4545.4,
  0, -3133.6, -815.1,
  0, -56.6, 237.5, -549.5,
  0, 278.6, -133.9, 212, -375.6,
  0, 45.4, 220.2, -122.9, 43, 106.1,
  0, -18.4, 16.8, 48.8, -59.8, 10.9, 72.7,
  0, -48.9, -14.4, -1, 23.4, -7.4, -25.1, -2.3,
  0, 7.1, -12.6, 11.4, -9.7, 12.7, 0.7, -5.2, 3.9,
  0, -24.8, 12.2, 8.3, -3.3, -5.2, 7.2, -0.6, 0.8, 10,
  0, 3.3, 0, 2.4, 5.3, -9.1, 0.4, -4.2, -3.8, 0.9, -9.1,
  0, 0, 2.9, -0.6, 0.2, 0.5, -0.3, -1.2, -1.7, -2.9, -1.8, -2.3,
  0, -1.3, 0.7, 1, -1.4, 0, 0.6, -0.1, 0.8, 0.1, -1, 0.1, 0.2,
];

/** Variació secular de g, en nT/any. */
export const WMM_G_DOT: readonly number[] = [
  12, 9.7,
  -11.6, -5.2, -8,
  -1.3, -4.2, 0.4, -15.6,
  -1.6, -2.4, -6, 5.6, -7,
  0.6, 1.4, 0, 0.6, 2.2, 0.9,
  -0.2, -0.4, 0.9, 1.2, -0.9, 0.3, 0.9,
  0, -0.1, -0.1, 0.5, -0.1, -0.8, -0.8, 0.8,
  -0.1, 0.2, 0, 0.5, -0.1, 0.3, 0.2, 0, 0.2,
  0, -0.1, 0.1, 0.3, -0.3, 0, 0.3, -0.1, 0.1, -0.1,
  0.1, 0, 0.1, 0.1, 0, -0.3, 0, -0.1, -0.1, 0, 0,
  0, 0, 0, 0, 0, -0.1, 0, 0, -0.1, -0.1, -0.1, -0.1,
  0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, -0.1, 0, -0.1,
];

/** Variació secular de h, en nT/any. */
export const WMM_H_DOT: readonly number[] = [
  0, -21.5,
  0, -27.7, -12.1,
  0, 4, -0.3, -4.1,
  0, -1.1, 4.1, 1.6, -4.4,
  0, -0.5, 2.2, 0.4, 1.7, 1.9,
  0, 0.3, -1.6, -0.4, 0.9, 0.7, 0.9,
  0, 0.6, 0.5, -0.8, 0, -1, 0.6, -0.2,
  0, -0.2, 0.5, -0.4, 0.4, -0.5, -0.6, 0.3, 0.2,
  0, -0.3, 0.3, -0.3, 0.3, 0.2, -0.1, -0.2, 0.4, 0.1,
  0, 0, 0, -0.2, 0.1, -0.1, 0.1, 0, -0.1, 0.2, 0,
  0, 0, 0.1, 0, 0.1, 0, 0, 0.1, 0, 0, 0, 0,
  0, 0, 0, -0.1, 0.1, 0, 0, 0, 0, 0, 0, 0, -0.1,
];

/** Radi geomagnètic de referència del model, en metres. */
export const WMM_REFERENCE_RADIUS_M = 6_371_200;

/** Semieix major del WGS84, en metres. */
export const WGS84_SEMI_MAJOR_M = 6_378_137;
/** Aplanament del WGS84. */
export const WGS84_FLATTENING = 1 / 298.257223563;
