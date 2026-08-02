/**
 * Geometria de la línia de visió. El que hem de garantir és que amb el Sol
 * baix els punts de mostreig se'n van de debò cap a ponent i a la distància
 * correcta, i que amb el Sol alt col·lapsen sobre l'observador i no gastem
 * peticions per no res.
 */

import { describe, expect, it } from 'vitest';
import {
  DEDUPE_DISTANCE_KM,
  MAX_SAMPLE_DISTANCE_KM,
  SLANT_ALTITUDE_THRESHOLD_DEG,
  angularFromGroundM,
  compassLabel,
  destinationPoint,
  groundDistanceToHeightKm,
  planLineOfSight,
  pointsForLayer,
} from './lineOfSight';

describe('groundDistanceToHeightKm', () => {
  it('amb el Sol al zenit la línia de visió no s’allunya', () => {
    expect(groundDistanceToHeightKm(90, 9000)).toBeCloseTo(0, 6);
  });

  it('a 45° la distància és de l’ordre de l’alçada', () => {
    // Amb la Terra plana serien exactament 9 km; la curvatura els retalla poc.
    const d = groundDistanceToHeightKm(45, 9000);
    expect(d).toBeGreaterThan(7.5);
    expect(d).toBeLessThan(9.1);
  });

  it('a 5° els cirrus ja són a un centenar de quilòmetres', () => {
    const d = groundDistanceToHeightKm(5, 9000);
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(102);
  });

  it('a 2° la línia de visió travessa mig país', () => {
    const d = groundDistanceToHeightKm(2, 9000);
    expect(d).toBeGreaterThan(170);
    expect(d).toBeLessThan(200);
  });

  it('la curvatura escurça la distància respecte de la Terra plana', () => {
    // Aquesta és la raó de no fer servir z/tan(h): a 2° s’equivoca molt.
    const spherical = groundDistanceToHeightKm(2, 9000);
    const flat = 9 / Math.tan((2 * Math.PI) / 180);
    expect(flat).toBeGreaterThan(spherical * 1.2);
  });

  it('creix de manera monòtona quan el Sol baixa', () => {
    let previous = 0;
    for (const alt of [30, 20, 12, 8, 5, 3, 2]) {
      const d = groundDistanceToHeightKm(alt, 4000);
      expect(d).toBeGreaterThan(previous);
      previous = d;
    }
  });
});

describe('destinationPoint', () => {
  it('cap a l’oest baixa la longitud i deixa la latitud gairebé igual', () => {
    const angle = angularFromGroundM(groundDistanceToHeightKm(3, 9000) * 1000);
    const target = destinationPoint(41.5, -2.5, 270, angle);
    expect(target.lon).toBeLessThan(-2.5);
    expect(Math.abs(target.lat - 41.5)).toBeLessThan(0.05);
  });

  it('cap al nord puja la latitud', () => {
    const target = destinationPoint(41.5, -2.5, 0, 100 / 6378.1366);
    expect(target.lat).toBeGreaterThan(41.5);
  });

  it('manté la longitud dins del rang que accepta l’API', () => {
    const target = destinationPoint(41.5, -179.9, 270, 200 / 6378.1366);
    expect(target.lon).toBeGreaterThan(-180);
    expect(target.lon).toBeLessThanOrEqual(180);
  });
});

describe('planLineOfSight', () => {
  it('amb el Sol alt tots els punts col·lapsen sobre l’observador', () => {
    const plan = planLineOfSight(41.5, -2.5, 250, SLANT_ALTITUDE_THRESHOLD_DEG + 10);
    expect(plan.slanted).toBe(false);
    expect(plan.points).toHaveLength(1);
    expect(plan.maxDistanceKm).toBe(0);
  });

  it('amb el Sol baix mostreja diversos punts cap a l’azimut del Sol', () => {
    const plan = planLineOfSight(41.5, -2.5, 285, 4);
    expect(plan.slanted).toBe(true);
    expect(plan.points.length).toBeGreaterThan(3);
    // Tots els punts allunyats han d'anar cap a ponent.
    for (const point of plan.points.slice(1)) {
      expect(point.lon).toBeLessThan(-2.5);
    }
  });

  it('llegeix cada capa on la línia de visió la travessa de veritat', () => {
    const plan = planLineOfSight(41.5, -2.5, 285, 4);
    const lowIdx = pointsForLayer(plan, 'low');
    const highIdx = pointsForLayer(plan, 'high');
    const lowMax = Math.max(...lowIdx.map((i) => plan.points[i].groundDistanceKm));
    const highMin = Math.min(...highIdx.map((i) => plan.points[i].groundDistanceKm));
    expect(highMin).toBeGreaterThan(lowMax);
  });

  it('no consulta dos cops la mateixa cel·la del model', () => {
    const plan = planLineOfSight(41.5, -2.5, 285, 12);
    for (let i = 0; i < plan.points.length; i++) {
      for (let j = i + 1; j < plan.points.length; j++) {
        const gap = Math.abs(
          plan.points[i].groundDistanceKm - plan.points[j].groundDistanceKm,
        );
        expect(gap).toBeGreaterThanOrEqual(DEDUPE_DISTANCE_KM * 0.5);
      }
    }
  });

  it('retalla al límit de distància i ho marca', () => {
    const plan = planLineOfSight(41.5, -2.5, 270, 1);
    expect(plan.truncated).toBe(true);
    expect(plan.maxDistanceKm).toBeLessThanOrEqual(MAX_SAMPLE_DISTANCE_KM + 1e-6);
  });

  it('el primer punt és sempre l’observador', () => {
    for (const alt of [1, 3, 8, 20, 60]) {
      const plan = planLineOfSight(41.5, -2.5, 285, alt);
      expect(plan.points[0].lat).toBe(41.5);
      expect(plan.points[0].lon).toBe(-2.5);
      expect(plan.points[0].groundDistanceKm).toBe(0);
    }
  });

  it('cada capa té sempre almenys un punt on llegir-se', () => {
    const plan = planLineOfSight(41.5, -2.5, 285, 3);
    for (const layer of ['low', 'mid', 'high'] as const) {
      expect(pointsForLayer(plan, layer).length).toBeGreaterThan(0);
    }
  });
});

describe('compassLabel', () => {
  it('dona el punt cardinal en català', () => {
    expect(compassLabel(0)).toBe('N');
    expect(compassLabel(90)).toBe('E');
    expect(compassLabel(180)).toBe('S');
    expect(compassLabel(270)).toBe('O');
    expect(compassLabel(292.5)).toBe('ONO');
    expect(compassLabel(360)).toBe('N');
  });

  it('accepta idioma i té les setze direccions en tots dos', () => {
    // Les sigles catalanes i castellanes coincideixen (cap dels dos idiomes
    // fa servir la W), i per això aquí es comprova que la llista castellana hi
    // sigui SENCERA i no que digui coses diferents: el que es vol evitar és
    // una taula amb dotze entrades i quatre `undefined`.
    for (let az = 0; az < 360; az += 22.5) {
      const es = compassLabel(az, 'es');
      expect(es, `azimut ${az}`).toMatch(/^[NSEO]{1,3}$/);
      expect(es).toBe(compassLabel(az, 'ca'));
    }
  });
});
