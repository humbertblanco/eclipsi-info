/**
 * Validació contra els valors de prova oficials del WMM2025 (NOAA/NCEI).
 *
 * Aquesta suite és l'única cosa que separa una implementació correcta d'una
 * que sembla correcta. El desenvolupament en harmònics esfèrics té mitja
 * dotzena de convenis de signe i de normalització, i equivocar-ne un dona
 * declinacions plausibles — de l'ordre de graus, amb el signe que toca a mig
 * món — però falses. Els números de sota són els publicats amb el model.
 */

import { describe, expect, it } from 'vitest';
import { magneticField, decimalYear } from './wmm';
import { declination, MAGNETIC_DECLINATION_UNAVAILABLE } from './declination';

/** [any decimal, altitud km, latitud, longitud, declinació, inclinació, Z] */
const OFFICIAL: ReadonlyArray<readonly [number, number, number, number, number, number, number]> = [
  [2025, 28, 89, -121, -99.77, 88.47, 56194.288771],
  [2025, 51, -33, 109, -5.49, -67.5, -52710.00392],
  [2025, 66, 14, 143, -0.19, 12.82, 7966.315182],
  [2025.5, 69, 38, -144, 12.93, 56.97, 35525.990264],
  [2025.5, 22, -37, 140, 9.28, -68.62, -55397.58776],
  [2026, 74, -57, 3, -22.51, -58.65, -23576.062921],
  [2026, 47, -72, -22, -6.32, -61.16, -33397.48616],
  [2026, 34, -19, 43, -14.98, -52.33, -26182.86233],
  [2026.5, 44, -46, -42, -11.36, -54.39, -19744.304022],
  [2026.5, 12, -79, 115, -137.58, -77.37, -58104.306533],
  [2027, 37, -66, -5, -17.22, -59.04, -28608.243575],
  [2027, 57, -43, 50, -48.27, -63.13, -33221.366617],
  [2027, 61, 59, -77, -16.48, 78.68, 54397.713552],
  [2027.5, 98, -5, 159, 7.79, -23.22, -14525.780052],
  [2027.5, 96, -46, -85, 17.93, -47.37, -21631.434316],
  [2028, 49, 20, 167, 5.1, 26.82, 15295.611788],
  [2028, 30, -36, -64, -4.65, -40.08, -14639.967305],
  [2028, 45, -46, -41, -11.68, -54.96, -19816.196211],
  [2028.5, 39, -65, -88, 29.45, -60.2, -35982.872979],
  [2028.5, 55, 86, 70, 67.64, 87.57, 55926.154052],
  [2029, 95, -60, -59, 8.58, -55.17, -26011.845842],
  [2029, 57, 34, -13, -1.89, 45.74, 28997.458189],
  [2029, 41, 42, -19, -4.13, 56.44, 36929.897501],
  [2029.5, 51, -76, 40, -56.34, -66.22, -42018.541264],
  [2029.5, 18, 9, -172, 9.24, 15.85, 8779.472279],
];

/** Data UTC corresponent a un any decimal, per no dependre del fus local. */
function dateFromDecimalYear(year: number): Date {
  const y = Math.floor(year);
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return new Date(start + (year - y) * (end - start));
}

describe('WMM2025', () => {
  it('reprodueix els valors de prova oficials', () => {
    for (const [year, altKm, lat, lon, decl, incl, z] of OFFICIAL) {
      const field = magneticField(lat, lon, altKm * 1000, dateFromDecimalYear(year));
      // Els valors publicats van arrodonits a la centèsima de grau; el marge
      // recull l'arrodoniment més la conversió d'any decimal a data.
      expect(field.declinationDeg).toBeCloseTo(decl, 1);
      expect(field.inclinationDeg).toBeCloseTo(incl, 1);
      // La component vertical val desenes de milers de nT: un marge relatiu
      // d'un nanotesla per mil ja detecta qualsevol error estructural.
      expect(Math.abs(field.zNt - z)).toBeLessThan(Math.abs(z) * 1e-3 + 5);
    }
  });

  it('any decimal correcte en anys de traspàs', () => {
    expect(decimalYear(new Date(Date.UTC(2025, 0, 1)))).toBeCloseTo(2025, 6);
    // 2028 és de traspàs: l'1 de juliol és el dia 183 de 366, no de 365.
    expect(decimalYear(new Date(Date.UTC(2028, 6, 1)))).toBeCloseTo(2028.4973, 3);
  });
});

describe('declinació a Espanya', () => {
  // Valors de referència calculats de manera independent amb dues
  // implementacions del WMM2025 (`geomagnetism` i `magvar`), que coincideixen
  // entre elles a la centèsima de grau. Serveixen per detectar que no hem
  // trencat res: el rang real a la península és −0,9° a +2,2°, i el signe
  // CANVIA a Galícia. Qualsevol implementació que doni sempre positiu és
  // incorrecta.
  const CASES: ReadonlyArray<readonly [string, number, number, number]> = [
    ['Barcelona', 41.3874, 2.1686, 2.07],
    ['Palma', 39.5696, 2.6502, 2.14],
    ['Madrid', 40.4168, -3.7038, 0.63],
    ['A Coruña', 43.3623, -8.4115, -0.87],
    ['Santa Cruz de Tenerife', 28.4636, -16.2518, -3.51],
  ];

  const when = new Date(Date.UTC(2026, 7, 1));

  it('coincideix amb les implementacions de referència', () => {
    for (const [, lat, lon, expected] of CASES) {
      const result = declination({ lat, lon, elevation: 0 }, when);
      expect(result.status).toBe('ok');
      expect(result.declinationDeg).toBeCloseTo(expected, 1);
    }
  });

  it('marca com a caducat el que cau fora de la validesa del model', () => {
    const result = declination(
      { lat: 41.3874, lon: 2.1686, elevation: 0 },
      new Date(Date.UTC(2031, 0, 1)),
    );
    expect(result.status).toBe('expired');
    // Segueix donant un número: extrapolar cinc anys és pitjor que el model
    // però molt millor que assumir zero. El que no pot fer és callar-ho.
    expect(Number.isFinite(result.declinationDeg)).toBe(true);
  });

  it('una posició impossible no llança, torna no-disponible', () => {
    const result = declination({ lat: Number.NaN, lon: 0, elevation: 0 }, when);
    expect(result).toEqual(MAGNETIC_DECLINATION_UNAVAILABLE);
    expect(result.declinationDeg).toBe(0);
  });
});
