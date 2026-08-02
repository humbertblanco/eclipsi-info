/**
 * La memòria del camp de visió: formats vell i nou, i valors que no valen.
 *
 * El banc corre en entorn node (vegeu vitest.config.ts: jsdom per fer
 * trigonometria seria pagar un peatge per res), o sigui que el `localStorage`
 * és aquest estub de quatre ratlles. El mòdul no distingeix — i és el que es
 * vol provar: el seu contracte amb l'emmagatzematge, no l'emmagatzematge.
 */

import { beforeEach, describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
};
import {
  loadMeasuredFov,
  loadMeasuredFovMeta,
  saveMeasuredFov,
  MIN_FOV_DEG,
  MAX_FOV_DEG,
} from './focalStore';

const KEY = 'eclipsi.ar.fov.v2.1920x1080';

describe('la memòria del camp de visió', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('desa i recupera, amb l’historial al costat', () => {
    saveMeasuredFov(1920, 1080, 68.34, 11);
    expect(loadMeasuredFov(1920, 1080)).toBeCloseTo(68.34, 2);
    const meta = loadMeasuredFovMeta(1920, 1080);
    expect(meta).not.toBeNull();
    expect(meta!.windows).toBe(11);
    expect(meta!.savedAtMs).not.toBeNull();
  });

  it('la clau es normalitza per costat llarg i curt', () => {
    // El mateix objectiu lliurant el flux girat és la mateixa òptica.
    saveMeasuredFov(1080, 1920, 66, 8);
    expect(loadMeasuredFov(1920, 1080)).toBeCloseTo(66, 2);
  });

  it('llegeix el format antic: un número pelat, sense historial', () => {
    localStorage.setItem(KEY, '52.10');
    expect(loadMeasuredFov(1920, 1080)).toBeCloseTo(52.1, 2);
    const meta = loadMeasuredFovMeta(1920, 1080);
    expect(meta!.windows).toBe(0);
    expect(meta!.savedAtMs).toBeNull();
  });

  it('la brossa no passa: JSON trencat, camps que falten, fora de rang', () => {
    localStorage.setItem(KEY, '{no és json');
    expect(loadMeasuredFov(1920, 1080)).toBeNull();

    localStorage.setItem(KEY, JSON.stringify({ n: 5 }));
    expect(loadMeasuredFov(1920, 1080)).toBeNull();

    localStorage.setItem(KEY, JSON.stringify({ f: MIN_FOV_DEG - 1, n: 5, t: 1 }));
    expect(loadMeasuredFov(1920, 1080)).toBeNull();

    localStorage.setItem(KEY, String(MAX_FOV_DEG + 10));
    expect(loadMeasuredFov(1920, 1080)).toBeNull();
  });

  it('no desa res fora del rang d’una càmera de mòbil', () => {
    saveMeasuredFov(1920, 1080, MIN_FOV_DEG - 0.1, 6);
    expect(localStorage.getItem(KEY)).toBeNull();
    saveMeasuredFov(1920, 1080, MAX_FOV_DEG + 0.1, 6);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
