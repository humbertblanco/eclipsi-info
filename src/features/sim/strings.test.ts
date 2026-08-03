/**
 * Tests dels textos de la línia de temps.
 *
 * Només es prova el que DECIDEIX alguna cosa: on cauen els llindars de la
 * diferència amb l'hora real i que la frase de cada banda sigui la que toca. Un
 * test que comprovés que «Simulació» diu «Simulació» no vigilaria res.
 */

import { describe, expect, it } from 'vitest';
import {
  contactJumpLabel,
  contactShortLabel,
  formatTimeGap,
  hs,
  timeGapText,
  NEAR_REAL_TIME_MS,
} from './strings';

describe('formatTimeGap', () => {
  it('per sota del minut, segons', () => {
    expect(formatTimeGap(45_000)).toBe('45 s');
    expect(formatTimeGap(-45_000)).toBe('45 s'); // el signe el diu la frase
  });

  it('per sota de l’hora, minuts arrodonits', () => {
    expect(formatTimeGap(12 * 60_000)).toBe('12 min');
    expect(formatTimeGap(90_000)).toBe('2 min');
  });

  it('a partir d’una hora, els segons sobren', () => {
    expect(formatTimeGap(3 * 3600_000 + 12 * 60_000 + 30_000)).toBe('3 h 13 min');
    expect(formatTimeGap(2 * 3600_000)).toBe('2 h');
  });

  it('a partir d’un dia, els minuts també', () => {
    expect(formatTimeGap(412 * 24 * 3600_000 + 3 * 3600_000)).toBe('412 d 3 h');
    expect(formatTimeGap(2 * 24 * 3600_000)).toBe('2 d');
  });
});

describe('timeGapText', () => {
  it('per davant i per darrere es diuen diferent', () => {
    expect(timeGapText(3 * 3600_000, 'ca')).toBe('3 h per davant de l’hora real');
    expect(timeGapText(-3 * 3600_000, 'ca')).toBe('3 h enrere de l’hora real');
    expect(timeGapText(3 * 3600_000, 'es')).toBe('3 h por delante de la hora real');
  });

  it('a tocar de l’hora real ho diu amb totes les lletres', () => {
    // El cas perillós: la simulació ensenya gairebé l'hora que és. Aquí és on
    // una etiqueta muda faria que algú confongués el simulador amb el rellotge.
    for (const offset of [0, NEAR_REAL_TIME_MS - 1, -(NEAR_REAL_TIME_MS - 1)]) {
      expect(timeGapText(offset, 'ca')).toBe('just a l’hora real, però simulada');
      expect(timeGapText(offset, 'es')).toBe('justo a la hora real, pero simulada');
    }
  });

  it('just al llindar ja diu la xifra', () => {
    expect(timeGapText(NEAR_REAL_TIME_MS, 'ca')).toBe('30 s per davant de l’hora real');
  });
});

describe('etiquetes de contacte', () => {
  it('els números de contacte no es tradueixen; l’abreviatura de màxim, sí', () => {
    expect(contactShortLabel('c1', 'ca')).toBe('C1');
    expect(contactShortLabel('c1', 'es')).toBe('C1');
    expect(contactShortLabel('max', 'ca')).toBe('màx');
    expect(contactShortLabel('max', 'es')).toBe('máx');
  });

  it('cada salt té un nom d’acció en imperatiu per al lector de pantalla', () => {
    expect(contactJumpLabel('c2', 'ca')).toBe('Salta a l’inici de la fase central');
    expect(contactJumpLabel('c4', 'es')).toBe('Salta al último contacto');
  });
});

describe('les dues paraules que no es poden confondre', () => {
  it('temps real i simulació es diuen així en totes dues llengües', () => {
    expect(hs('timeline.live', 'ca')).toBe('Temps real');
    expect(hs('timeline.live', 'es')).toBe('Tiempo real');
    expect(hs('timeline.sim', 'ca')).toBe('Simulació');
    expect(hs('timeline.sim', 'es')).toBe('Simulación');
  });
});
