/**
 * El que es prova aquí és la tesi del mòdul: que un cel tapat de cirrus i un
 * cel tapat d'estrats NO donen la mateixa resposta. Si algun dia algú
 * "simplifica" la puntuació a la nuvolositat total, aquests tests han de
 * petar.
 */

import { describe, expect, it } from 'vitest';
import {
  BAND_CLEAR_MIN,
  LAYER_OPACITY,
  averageLayers,
  bandForScore,
  estimateHaze,
  scoreCloudLayers,
} from './layers';
import type { CloudLayers } from './types';

const layers = (low: number, mid: number, high: number): CloudLayers => ({
  low,
  mid,
  high,
  total: 100 * (1 - (1 - low / 100) * (1 - mid / 100) * (1 - high / 100)),
});

describe('scoreCloudLayers', () => {
  it('dona 100 amb el cel completament net', () => {
    expect(scoreCloudLayers(layers(0, 0, 0)).score).toBe(100);
  });

  it('separa capes: 100 % de cirrus és molt millor que 100 % d’estrats', () => {
    const cirrus = scoreCloudLayers(layers(0, 0, 100));
    const stratus = scoreCloudLayers(layers(100, 0, 0));

    expect(cirrus.score).toBeGreaterThan(60);
    expect(stratus.score).toBeLessThan(10);
    // La distància entre els dos casos és tot el sentit del mòdul.
    expect(cirrus.score - stratus.score).toBeGreaterThan(50);
  });

  it('amb el cel tapat de núvols mitjans el disc encara passa una mica', () => {
    const score = scoreCloudLayers(layers(0, 100, 0)).score;
    expect(score).toBeGreaterThan(15);
    expect(score).toBeLessThan(30);
  });

  it('ordena les tres capes per gravetat', () => {
    const high = scoreCloudLayers(layers(0, 0, 80)).score;
    const mid = scoreCloudLayers(layers(0, 80, 0)).score;
    const low = scoreCloudLayers(layers(80, 0, 0)).score;
    expect(high).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(low);
  });

  it('combina capes amb superposició aleatòria', () => {
    const score = scoreCloudLayers(layers(50, 50, 50));
    const expected =
      (1 - 0.5 * LAYER_OPACITY.low) *
      (1 - 0.5 * LAYER_OPACITY.mid) *
      (1 - 0.5 * LAYER_OPACITY.high);
    expect(score.score).toBe(Math.round(100 * expected));
  });

  it('reparteix el bloqueig entre capes sense perdre’n gens', () => {
    const score = scoreCloudLayers(layers(30, 40, 90));
    const sum =
      score.attribution.low + score.attribution.mid + score.attribution.high;
    expect(sum).toBeCloseTo(score.blocked, 10);
  });

  it('identifica la capa que més tapa', () => {
    // 60 % d'estrats tapa més que un vel sencer de cirrus: 0,58 contra 0,35.
    expect(scoreCloudLayers(layers(60, 0, 100)).dominant).toBe('low');
    expect(scoreCloudLayers(layers(0, 0, 100)).dominant).toBe('high');
    expect(scoreCloudLayers(layers(0, 0, 0)).dominant).toBeNull();
  });

  it('marca quan ha hagut de puntuar només amb la cobertura total', () => {
    const score = scoreCloudLayers({ low: 0, mid: 0, high: 0, total: 100 }, false);
    expect(score.fromTotalOnly).toBe(true);
    expect(score.score).toBe(Math.round(100 * (1 - LAYER_OPACITY.mid)));
  });

  it('aguanta valors absents o fora de rang sense petar', () => {
    const broken = { low: NaN, mid: -20, high: 400, total: NaN } as CloudLayers;
    const score = scoreCloudLayers(broken);
    expect(Number.isFinite(score.score)).toBe(true);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });
});

describe('bandForScore', () => {
  it('fa servir els llindars documentats', () => {
    expect(bandForScore(100)).toBe('clear');
    expect(bandForScore(BAND_CLEAR_MIN)).toBe('clear');
    expect(bandForScore(BAND_CLEAR_MIN - 1)).toBe('partial');
    expect(bandForScore(34)).toBe('cloudy');
  });

  it('un vel sencer de cirrus no es pinta mai com a cel tapat', () => {
    expect(scoreCloudLayers(layers(0, 0, 100)).band).not.toBe('cloudy');
  });
});

describe('estimateHaze', () => {
  it('torna null si el model no ha donat visibilitat', () => {
    expect(estimateHaze(null, 5)).toBeNull();
    expect(estimateHaze(undefined, 5)).toBeNull();
  });

  it('el Sol baix travessa molta més atmosfera que el Sol alt', () => {
    const low = estimateHaze(30_000, 3);
    const high = estimateHaze(30_000, 60);
    expect(low).not.toBeNull();
    expect(high).not.toBeNull();
    expect(low!.airmass).toBeGreaterThan(15);
    expect(high!.airmass).toBeLessThan(1.3);
    expect(low!.transmission).toBeLessThan(high!.transmission);
  });

  it('amb aire net i Sol alt gairebé no hi ha extinció', () => {
    const haze = estimateHaze(80_000, 70);
    expect(haze!.transmission).toBeGreaterThan(0.9);
  });
});

describe('averageLayers', () => {
  it('promitja capa a capa', () => {
    const avg = averageLayers([layers(0, 0, 0), layers(100, 50, 20)]);
    expect(avg.low).toBe(50);
    expect(avg.mid).toBe(25);
    expect(avg.high).toBe(10);
  });

  it('amb la llista buida torna cel net i no divideix per zero', () => {
    expect(averageLayers([])).toEqual({ low: 0, mid: 0, high: 0, total: 0 });
  });
});
