/**
 * Les frases. Es proven perquè són l'única part del mòdul que pot dir una
 * cosa falsa sense que cap càlcul falli.
 */

import { describe, expect, it } from 'vitest';
import {
  BAND_MEANING,
  BAND_TITLE,
  describeAge,
  describeAgeSince,
  describeDominantLayer,
  describeHaze,
  describeLead,
  describeLineOfSight,
} from './describe';
import { estimateHaze, scoreCloudLayers } from './layers';
import { planLineOfSight } from './lineOfSight';
import type { CloudLayers, ForecastOutlook, LocalisedText } from './types';

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

/* ------------------------------------------------------------------ castellà
 *
 * El bloc existeix perquè la manera de trencar això és afegir una frase nova i
 * traduir-ne només la meitat. Cada prova mira que la frase castellana NO sigui
 * la catalana, no només que existeixi: una taula amb `es` copiat del `ca`
 * passa qualsevol prova que només comprovi que hi ha text.
 */

const LOCALES = ['ca', 'es'] as const;

/** Cap taula pot tenir claus a mitges: totes les entrades, tots els idiomes. */
function expectComplete(table: Record<string, LocalisedText>): void {
  for (const [key, entry] of Object.entries(table)) {
    for (const locale of LOCALES) {
      expect(typeof entry[locale], `${key}.${locale}`).toBe('string');
      expect(entry[locale].length, `${key}.${locale}`).toBeGreaterThan(0);
    }
    expect(entry.ca, `${key} no s’ha traduït`).not.toBe(entry.es);
  }
}

const layers = (low: number, mid: number, high: number): CloudLayers => ({
  low,
  mid,
  high,
  total: 100 * (1 - (1 - low / 100) * (1 - mid / 100) * (1 - high / 100)),
});

/**
 * Un resultat de previsió creïble. Amb el Sol a 4° i cap al ONO, que és la
 * geometria real de l'eclipsi del 2026 des de Sòria: és el cas on la línia de
 * visió té alguna cosa a dir.
 */
function forecast(cover: CloudLayers, visibilityM: number | null = null): ForecastOutlook {
  return {
    mode: 'forecast',
    location: { lat: 41.5, lon: -2.5, elevation: 1100 },
    targetTimeMs: Date.UTC(2026, 7, 12, 20, 30),
    fetchedAtMs: Date.UTC(2026, 7, 12, 18, 30),
    stale: false,
    layers: cover,
    score: scoreCloudLayers(cover),
    sampling: planLineOfSight(41.5, -2.5, 285, 4),
    confidence: 'high',
    caveat: '',
    leadDays: 0.08,
    validAtMs: Date.UTC(2026, 7, 12, 20, 0),
    haze: estimateHaze(visibilityM, 4),
  };
}

describe('les taules de frases', () => {
  it('no tenen cap clau a mitges', () => {
    expectComplete(BAND_TITLE);
    expectComplete(BAND_MEANING);
  });
});

describe('describeAge en castellà', () => {
  it('escala igual, amb les paraules de l’altre idioma', () => {
    expect(describeAge(0, 'es')).toBe('ahora mismo');
    expect(describeAge(3 * 60_000, 'es')).toBe('hace 3 min');
    expect(describeAge(3 * 3_600_000, 'es')).toBe('hace 3 h');
    expect(describeAge(26 * 3_600_000, 'es')).toBe('hace 1 día');
    expect(describeAge(3 * 86_400_000, 'es')).toBe('hace 3 días');
  });

  it('el defecte segueix sent el català', () => {
    expect(describeAge(0)).toBe(describeAge(0, 'ca'));
    expect(describeAge(0, 'ca')).not.toBe(describeAge(0, 'es'));
  });
});

describe('describeAgeSince en castellà', () => {
  it('no elideix mai: en castellà la preposició és sempre "de"', () => {
    expect(describeAgeSince(0, 'es')).toBe('de ahora mismo');
    expect(describeAgeSince(5 * 60_000, 'es')).toBe('de hace 5 min');
    // La regla catalana no s'ha d'escolar cap aquí: "d'ahora" no existeix.
    expect(describeAgeSince(0, 'es')).not.toContain('’');
  });
});

describe('describeLead en castellà', () => {
  it('canvia d’unitat igual', () => {
    expect(describeLead(-1, 'es')).toBe('ya ha pasado');
    expect(describeLead(0.01, 'es')).toBe('dentro de menos de una hora');
    expect(describeLead(1, 'es')).toBe('dentro de 24 h');
    expect(describeLead(6, 'es')).toBe('dentro de 6 días');
  });
});

describe('les frases llargues', () => {
  it('describeLineOfSight surt en tots dos idiomes i diu la mateixa xifra', () => {
    const outlook = forecast(layers(0, 0, 80));
    const ca = describeLineOfSight(outlook, 'ca');
    const es = describeLineOfSight(outlook, 'es');
    expect(ca).toContain('El Sol estarà a 4°');
    expect(es).toContain('El Sol estará a 4°');
    // La direcció és la mateixa sigla en tots dos idiomes, i ha de sortir.
    expect(ca).toContain('ONO');
    expect(es).toContain('ONO');
  });

  it('describeDominantLayer concorda el gènere en cada idioma', () => {
    // En català l'adjectiu va amb "núvols" (masculí) i en castellà amb "nubes"
    // (femení). És el defecte més fàcil de deixar-hi: traduir l'etiqueta de la
    // barra i heretar-ne la concordança dins de la frase.
    const outlook = forecast(layers(90, 0, 0));
    expect(describeDominantLayer(outlook, 'ca')).toContain('els núvols baixos');
    expect(describeDominantLayer(outlook, 'es')).toContain('las nubes bajas');
  });

  it('describeDominantLayer calla en tots dos idiomes amb el cel net', () => {
    const outlook = forecast(layers(0, 0, 0));
    expect(describeDominantLayer(outlook, 'ca')).toBeNull();
    expect(describeDominantLayer(outlook, 'es')).toBeNull();
  });

  it('describeHaze surt en tots dos idiomes quan la boirina compta', () => {
    // 3 km de visibilitat amb el Sol a 4°: transmissió molt per sota del 60 %.
    const outlook = forecast(layers(0, 0, 0), 3000);
    const ca = describeHaze(outlook, 'ca');
    const es = describeHaze(outlook, 'es');
    expect(ca).toContain('masses d’aire');
    expect(es).toContain('masas de aire');
  });

  it('describeHaze calla en tots dos idiomes amb l’aire net', () => {
    const outlook = forecast(layers(0, 0, 0), 200_000);
    expect(describeHaze(outlook, 'ca')).toBeNull();
    expect(describeHaze(outlook, 'es')).toBeNull();
  });
});
