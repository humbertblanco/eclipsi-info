/**
 * El format de les xifres de les pantalles.
 *
 * PER QUÈ AQUEST FITXER NO EXISTIA I HAURIA D'HAVER EXISTIT. `screens/format.ts`
 * és per on passen totes les xifres que llegeix l'usuari, i no tenia cap prova.
 * El símptoma va ser `formatDegrees`, que escrivia el punt anglosaxó tres
 * línies per sota del comentari que explica per què no s'ha de fer servir
 * `toFixed`: a la portada es llegia «ALTURA DEL SOL 4.5°» amb punt al costat de
 * «40,3581°, 0,4067°» amb coma, dins de la mateixa targeta.
 *
 * L'equivalent de `features/spots/format.ts` sí que tenia proves, i és
 * exactament per això que aquella còpia estava bé i aquesta no.
 */

import { describe, expect, it } from 'vitest';
import { formatDecimal, formatDegrees, formatPercent, NO_DATA } from './format';

describe('decimals', () => {
  it('escriu coma en català i en castellà, mai punt', () => {
    expect(formatDecimal(4.5, 1, 'ca')).toBe('4,5');
    expect(formatDecimal(4.5, 1, 'es')).toBe('4,5');
    expect(formatDecimal(4.5, 1, 'ca')).not.toContain('.');
  });

  it('respecta els decimals que li demanen', () => {
    expect(formatDecimal(24.32, 1, 'ca')).toBe('24,3');
    expect(formatDecimal(24.32, 2, 'ca')).toBe('24,32');
    // Un enter també porta la seva dècima: si no, una columna de xifres balla.
    expect(formatDecimal(24, 1, 'ca')).toBe('24,0');
  });
});

describe('graus', () => {
  it('van amb coma, com la resta de la pantalla', () => {
    expect(formatDegrees(4.5)).toBe('4,5°');
    expect(formatDegrees(4.5, 'es')).toBe('4,5°');
    expect(formatDegrees(12.34)).toBe('12,3°');
  });

  /*
   * Aquest és el cas que es veia a la portada i que aquest fitxer tanca: cap
   * xifra de cap pantalla pot dur el punt anglosaxó. En castellà el punt ÉS el
   * separador de milers, o sigui que «1.250» tant pot llegir-se mil dos-cents
   * cinquanta com u coma dos-cents cinquanta.
   */
  it('mai el punt anglosaxó', () => {
    for (const v of [0, 0.1, 4.5, 12.34, 99.95, 180, -7.7]) {
      expect(formatDegrees(v)).not.toContain('.');
    }
  });

  it('els negatius conserven el signe: un marge sota l’horitzó no és el mateix que a sobre', () => {
    expect(formatDegrees(-7.7)).toBe('-7,7°');
  });

  it('un valor que no és número es diu amb el guió de l’app, no com a «NaN°»', () => {
    expect(formatDegrees(Number.NaN)).toBe(NO_DATA);
    expect(formatDegrees(Number.POSITIVE_INFINITY)).toBe(NO_DATA);
  });
});

describe('percentatges', () => {
  /*
   * L'espai abans del signe és DUR (U+00A0), no un espai normal. No és
   * tipografia per gust: amb un espai normal, «88» i «%» es poden separar de
   * línia i deixar un número orfe al final d'una fila amb el signe sol al
   * principi de la següent. És invisible fins que es veu al mòbil.
   */
  it('porten espai dur abans del signe, no un espai normal', () => {
    expect(formatPercent(0.88)).toBe('88\u00a0%');
    expect(formatPercent(0.88)).not.toContain('88 %');
  });
});
