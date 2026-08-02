/**
 * L'offset de guinyada d'iOS, mesurat.
 *
 * El contracte és triple: en pla, l'offset convergeix cap a la diferència
 * compass−alpha i el resultat és el mateix que la substitució de sempre; a
 * mig camí, s'afina més a poc a poc; apuntant amunt, queda CONGELAT i cap
 * mentida del compass acoblada al pitch no entra al rumb.
 */

import { describe, expect, it } from 'vitest';
import { IosYawOffset } from './iosHeading';
import { normalizeDelta } from './poseFusion';
import { quaternionFromEulerZXY } from './quaternion';
import { cameraPointingFromQuaternion } from './orientation';

const DT = 1 / 60;

describe('l’offset de guinyada d’iOS', () => {
  it('en pla, alphaRel + offset equival a la substitució de sempre', () => {
    const o = new IosYawOffset();
    // Compass a 130°, alpha relativa arrencada a 40°: offset = (360−130)−40.
    const offset = o.update(130, 40, 5, DT);
    expect(offset).not.toBeNull();

    const substituted = quaternionFromEulerZXY(360 - 130, 95, 0);
    const decoupled = quaternionFromEulerZXY(40 + offset!, 95, 0);
    const a = cameraPointingFromQuaternion(substituted, 0);
    const b = cameraPointingFromQuaternion(decoupled, 0);
    expect(Math.abs(normalizeDelta(a.azimuth - b.azimuth))).toBeLessThan(0.1);
  });

  it('segueix la deriva del giroscopi quan el telèfon va pla', () => {
    // L'alpha relativa deriva 1° per minut; el compass no es mou. L'offset ha
    // d'anar-se menjant la deriva perquè el rumb net no se'n vagi.
    const o = new IosYawOffset();
    let alphaRel = 40;
    let offset: number | null = null;
    for (let i = 0; i < 30 * 60; i++) {
      alphaRel += 1 / 60 / 60; // 1°/min a 60 Hz
      offset = o.update(130, alphaRel, 5, DT);
    }
    const heading = normalizeDelta(alphaRel + offset! - (360 - 130));
    expect(Math.abs(heading)).toBeLessThan(0.2);
  });

  it('apuntant amunt queda congelat: la mentida del compass no entra', () => {
    const o = new IosYawOffset();
    o.update(130, 40, 5, DT);
    const before = o.value!;

    // A 50° d'altura el compass diu bestieses acoblades al pitch: +15° de
    // mentida durant deu segons. L'offset no s'ha de moure ni una centèsima.
    for (let i = 0; i < 10 * 60; i++) {
      o.update(115, 40, 50, DT);
    }
    expect(o.value!).toBeCloseTo(before, 6);
  });

  it('a mig camí s’afina, però més a poc a poc que en pla', () => {
    const flat = new IosYawOffset();
    const tilted = new IosYawOffset();
    flat.update(130, 40, 5, DT);
    tilted.update(130, 40, 5, DT);

    // El compass es desplaça 6°: en pla es persegueix amb τ=3 s; a 28°
    // d'altura (pes ≈ 0,47), a mig gas.
    for (let i = 0; i < 3 * 60; i++) {
      flat.update(124, 40, 5, DT);
      tilted.update(124, 40, 28, DT);
    }
    // L'offset comença a 190 (de 360−130−40) i el nou objectiu és 196: sis
    // graus de camí. En pla, a τ=3 s, en 3 segons se n'ha fet la major part;
    // inclinat, part del camí — més que zero (no està congelat), menys que el
    // pla.
    const target = normalizeDelta(360 - 124 - 40);
    const errFlat = Math.abs(normalizeDelta(flat.value! - target));
    const errTilted = Math.abs(normalizeDelta(tilted.value! - target));
    expect(errFlat).toBeLessThan(errTilted);
    expect(errFlat).toBeLessThan(2.5);
    expect(errTilted).toBeLessThan(5);
    expect(errTilted).toBeGreaterThan(errFlat + 0.5);
  });

  it('l’embolcall circular no es trenca vora 0/360', () => {
    const o = new IosYawOffset();
    // Compass a 359° i alpha a 3°: l'offset cau a prop de la costura.
    o.update(359, 3, 5, DT);
    for (let i = 0; i < 60; i++) o.update(1, 5, 5, DT);
    // El rumb net (alpha + offset) ha de quedar vora 360−1 = 359, no a 180.
    const heading = ((5 + o.value!) % 360 + 360) % 360;
    const err = Math.abs(normalizeDelta(heading - 359));
    expect(err).toBeLessThan(3);
  });

  it('si l’app s’obre apuntant amunt, no fixa res i ho diu', () => {
    const o = new IosYawOffset();
    for (let i = 0; i < 60; i++) {
      expect(o.update(130, 40, 50, DT)).toBeNull();
    }
    // En abaixar el mòbil, la primera postura de confiança fixa l'offset.
    expect(o.update(130, 40, 10, DT)).not.toBeNull();
  });
});
