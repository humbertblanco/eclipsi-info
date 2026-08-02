/**
 * La memòria de postures: interpolació circular, extrems i oblit.
 */

import { describe, expect, it } from 'vitest';
import { PoseHistory, type TimedPose } from './poseHistory';

function pose(tMs: number, azimuth: number, altitude = 10, roll = 0): TimedPose {
  return { tMs, azimuth, altitude, roll, screenAngle: 0 };
}

describe('la memòria de postures', () => {
  it('buida diu null; una sola mostra es retorna tal qual', () => {
    const h = new PoseHistory();
    expect(h.at(100)).toBeNull();
    h.push(pose(100, 250));
    expect(h.at(50)!.azimuth).toBe(250);
    expect(h.at(150)!.azimuth).toBe(250);
  });

  it('interpola linealment entre mostres', () => {
    const h = new PoseHistory();
    h.push(pose(100, 250, 10));
    h.push(pose(200, 254, 12));
    const mid = h.at(150)!;
    expect(mid.azimuth).toBeCloseTo(252, 9);
    expect(mid.altitude).toBeCloseTo(11, 9);
  });

  it('l’azimut interpola per la costura 359→1 sense passar per 180', () => {
    const h = new PoseHistory();
    h.push(pose(100, 359));
    h.push(pose(200, 1));
    expect(((h.at(150)!.azimuth % 360) + 360) % 360).toBeCloseTo(0, 9);
  });

  it('fora de rang no s’extrapola: es retorna l’extrem', () => {
    const h = new PoseHistory();
    h.push(pose(100, 250));
    h.push(pose(200, 260));
    expect(h.at(90)!.azimuth).toBe(250);
    expect(h.at(500)!.azimuth).toBe(260);
  });

  it('la capacitat fa oblidar el més vell', () => {
    const h = new PoseHistory();
    for (let i = 0; i < 40; i++) h.push(pose(i * 10, i));
    expect(h.size).toBe(32);
    // El més vell que queda és el 8: demanar abans dona aquell extrem.
    expect(h.at(0)!.azimuth).toBe(8);
  });

  it('un temps que recula buida la memòria en comptes d’interpolar un forat', () => {
    const h = new PoseHistory();
    h.push(pose(1000, 100));
    h.push(pose(1016, 101));
    h.push(pose(50, 200)); // la pàgina ha tornat d'un fons: rellotge nou
    expect(h.size).toBe(1);
    expect(h.at(60)!.azimuth).toBe(200);
  });
});
