/**
 * Les frases. Es proven perquè són l'única part del mòdul que pot dir una
 * cosa falsa sense que cap càlcul falli.
 */

import { describe, expect, it } from 'vitest';
import { describeAge, describeAgeSince, describeLead } from './describe';

describe('describeAge', () => {
  it('escala de minuts a dies', () => {
    expect(describeAge(0)).toBe('ara mateix');
    expect(describeAge(3 * 60_000)).toBe('fa 3 min');
    expect(describeAge(3 * 3_600_000)).toBe('fa 3 h');
    expect(describeAge(26 * 3_600_000)).toBe('fa 1 dia');
    expect(describeAge(3 * 86_400_000)).toBe('fa 3 dies');
  });
});

describe('describeAgeSince', () => {
  it('resol l’elisió: "de ara mateix" no és català', () => {
    expect(describeAgeSince(0)).toBe('d’ara mateix');
    expect(describeAgeSince(5 * 60_000)).toBe('de fa 5 min');
  });
});

describe('describeLead', () => {
  it('canvia d’unitat segons l’antelació', () => {
    expect(describeLead(-1)).toBe('ja ha passat');
    expect(describeLead(0.01)).toBe('d’aquí a menys d’una hora');
    expect(describeLead(1)).toBe('d’aquí a 24 h');
    expect(describeLead(6)).toBe('d’aquí a 6 dies');
  });
});
