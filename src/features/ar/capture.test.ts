/**
 * La geometria de la captura: el retall visible sota cover, exacte.
 */

import { describe, expect, it } from 'vitest';
import { visibleVideoRect, captionBarHeight } from './capture';

describe('el retall visible de la captura', () => {
  it('vídeo apaïsat dins de marc vertical: es retallen els costats', () => {
    // 1920×1080 dins de 390×844: cover mana l'alçada.
    const r = visibleVideoRect(1920, 1080, { width: 390, height: 844 });
    expect(r.sh).toBeCloseTo(1080, 6);
    expect(r.sy).toBeCloseTo(0, 6);
    expect(r.sw).toBeCloseTo((390 / 844) * 1080, 6);
    expect(r.sx).toBeCloseTo((1920 - r.sw) / 2, 6);
  });

  it('vídeo vertical dins de marc vertical més estret: es retalla amunt i avall', () => {
    const r = visibleVideoRect(1080, 1920, { width: 390, height: 520 });
    // cover = max(390/1080, 520/1920) = 0.3611… → mana l'amplada.
    expect(r.sw).toBeCloseTo(1080, 6);
    expect(r.sx).toBeCloseTo(0, 6);
    expect(r.sh).toBeCloseTo((520 / 390) * 1080, 6);
    expect(r.sy).toBeCloseTo((1920 - r.sh) / 2, 6);
  });

  it('les proporcions del retall són les del marc, sempre', () => {
    for (const [vw, vh, cw, ch] of [
      [1920, 1080, 390, 844],
      [1080, 1920, 390, 520],
      [1280, 720, 800, 600],
    ]) {
      const r = visibleVideoRect(vw, vh, { width: cw, height: ch });
      expect(r.sw / r.sh).toBeCloseTo(cw / ch, 6);
      expect(r.sx).toBeGreaterThanOrEqual(-1e-9);
      expect(r.sy).toBeGreaterThanOrEqual(-1e-9);
      expect(r.sx + r.sw).toBeLessThanOrEqual(vw + 1e-6);
      expect(r.sy + r.sh).toBeLessThanOrEqual(vh + 1e-6);
    }
  });

  it('el peu mai és il·legible', () => {
    expect(captionBarHeight(400)).toBe(44);
    expect(captionBarHeight(1080)).toBe(Math.round(1080 * 0.055));
  });
});
