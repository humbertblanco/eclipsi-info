/**
 * La màquina d'estats de la fusió.
 *
 * El banc sintètic de `visualTracker.test.ts` prova que els NÚMEROS surten;
 * això prova que la LÒGICA de quan es fa cas a qui és la correcta, que és on hi
 * ha els modes de fallada silenciosos: comptar dues vegades el mateix interval,
 * o quedar-se congelat esperant un fotograma que no arribarà mai.
 */

import { describe, expect, it } from 'vitest';
import { PoseFusion, rotationToPoseDelta, poseDeltaToRotation } from './poseFusion';
import type { VisualRotation } from './visualTracker';

const DEG = Math.PI / 180;

/** Mesura visual perfecta d'un gir donat. */
function visual(yawDeg: number, pitchDeg: number): VisualRotation {
  return {
    pitchRad: pitchDeg * DEG,
    yawRad: yawDeg * DEG,
    rollRad: 0,
    confidence: 1,
    usedBlocks: 9,
    saturated: false,
    residualPx: 0.02,
  };
}

const NO_VISUAL = {
  imageRollDeg: 0,
  visual: null,
  sensorSpeedDegPerSec: 0,
  dtSec: 1 / 60,
};

describe('conversió entre eixos de la imatge i del món', () => {
  it('anar i tornar és la identitat per a qualsevol gir de la imatge', () => {
    for (const roll of [0, 17, 90, -125, 180]) {
      for (const altitude of [0, 35, 70]) {
        const pose = rotationToPoseDelta(
          { pitchRad: 0.7 * DEG, yawRad: -1.3 * DEG },
          roll,
          altitude,
        );
        const back = poseDeltaToRotation(pose.dAzDeg, pose.dAltDeg, roll, altitude);
        expect(back.yawRad).toBeCloseTo(-1.3 * DEG, 12);
        expect(back.pitchRad).toBeCloseTo(0.7 * DEG, 12);
      }
    }
  });
});

describe('qui porta la postura', () => {
  it('sense mesura visual, segueix els increments del sensor', () => {
    const fusion = new PoseFusion();
    fusion.update({ sensorAzimuthDeg: 100, sensorAltitudeDeg: 10, newFrame: true, ...NO_VISUAL });
    for (let i = 1; i <= 60; i++) {
      fusion.update({
        sensorAzimuthDeg: 100 + i * 0.1,
        sensorAltitudeDeg: 10,
        newFrame: i % 2 === 0,
        ...NO_VISUAL,
      });
    }
    const out = fusion.update({
      sensorAzimuthDeg: 106,
      sensorAltitudeDeg: 10,
      newFrame: false,
      ...NO_VISUAL,
    });
    expect(out.azimuthDeg).toBeCloseTo(106, 1);
    expect(fusion.telemetry.usingVisual).toBe(false);
  });

  it('amb ancoratge actiu, ENTRE fotogrames de vídeo la postura no avança', () => {
    // Aquest és el test del defecte de comptar dues vegades. Si entre dos
    // fotogrames de càmera s'hi sumés també l'increment del sensor, la
    // superposició es mouria una vegada i mitja del que toca.
    const fusion = new PoseFusion();
    fusion.update({
      sensorAzimuthDeg: 200,
      sensorAltitudeDeg: 0,
      newFrame: true,
      imageRollDeg: 0,
      visual: null,
      sensorSpeedDegPerSec: 0,
      dtSec: 1 / 60,
    });

    // Fotograma de vídeo amb mesura: la postura avança un grau.
    const afterFrame = fusion.update({
      sensorAzimuthDeg: 201,
      sensorAltitudeDeg: 0,
      newFrame: true,
      imageRollDeg: 0,
      visual: visual(1, 0),
      sensorSpeedDegPerSec: 60,
      dtSec: 1 / 60,
    });
    expect(afterFrame.azimuthDeg).toBeCloseTo(201, 1);

    // Fotograma de dibuix SENSE fotograma de vídeo: el sensor ja ha avançat un
    // grau més, però la imatge que es veu és la mateixa i la superposició no
    // s'hi ha de moure. L'estirada del sensor n'admet una part petita.
    const between = fusion.update({
      sensorAzimuthDeg: 202,
      sensorAltitudeDeg: 0,
      newFrame: false,
      imageRollDeg: 0,
      visual: null,
      sensorSpeedDegPerSec: 60,
      dtSec: 1 / 60,
    });
    expect(between.azimuthDeg - afterFrame.azimuthDeg).toBeLessThan(0.1);
  });

  it('si el flux de càmera s’atura, torna al sensor en menys de mig segon', () => {
    const fusion = new PoseFusion();
    // La primera crida només fixa l'origen; la segona ja és una mesura.
    for (let i = 0; i < 2; i++) {
      fusion.update({
        sensorAzimuthDeg: 200,
        sensorAltitudeDeg: 0,
        newFrame: true,
        imageRollDeg: 0,
        visual: visual(0, 0),
        sensorSpeedDegPerSec: 0,
        dtSec: 1 / 60,
      });
    }
    expect(fusion.telemetry.usingVisual).toBe(true);

    // Mig segon de fotogrames de dibuix sense cap fotograma de càmera.
    for (let i = 0; i < 30; i++) {
      fusion.update({
        sensorAzimuthDeg: 200,
        sensorAltitudeDeg: 0,
        newFrame: false,
        ...NO_VISUAL,
      });
    }
    expect(fusion.telemetry.usingVisual).toBe(false);

    // I a partir d'aquí ha de tornar a seguir el sensor de debò.
    let out = { azimuthDeg: 200, altitudeDeg: 0 };
    for (let i = 1; i <= 60; i++) {
      out = fusion.update({
        sensorAzimuthDeg: 200 + i * 0.1,
        sensorAltitudeDeg: 0,
        newFrame: false,
        ...NO_VISUAL,
      });
    }
    expect(out.azimuthDeg).toBeCloseTo(206, 1);
  });

  it('una mesura sense confiança no s’usa', () => {
    const fusion = new PoseFusion();
    fusion.update({ sensorAzimuthDeg: 10, sensorAltitudeDeg: 0, newFrame: true, ...NO_VISUAL });
    const out = fusion.update({
      sensorAzimuthDeg: 11,
      sensorAltitudeDeg: 0,
      newFrame: true,
      imageRollDeg: 0,
      visual: { ...visual(5, 0), confidence: 0.1 },
      sensorSpeedDegPerSec: 60,
      dtSec: 1 / 60,
    });
    // Ha de seguir el sensor (un grau), no la mesura dolenta (cinc).
    expect(out.azimuthDeg).toBeCloseTo(11, 1);
  });

  it('una mesura saturada tampoc: el número que en surt és massa petit', () => {
    const fusion = new PoseFusion();
    fusion.update({ sensorAzimuthDeg: 10, sensorAltitudeDeg: 0, newFrame: true, ...NO_VISUAL });
    const out = fusion.update({
      sensorAzimuthDeg: 20,
      sensorAltitudeDeg: 0,
      newFrame: true,
      imageRollDeg: 0,
      visual: { ...visual(3, 0), saturated: true },
      sensorSpeedDegPerSec: 600,
      dtSec: 1 / 60,
    });
    expect(out.azimuthDeg).toBeCloseTo(20, 1);
  });

  it('la deriva desbocada torna a acostar la postura al sensor', () => {
    // L'ancoratge visual s'ha equivocat i diu que s'ha girat quinze graus quan
    // el telèfon està quiet. La superposició no se n'ha d'anar del paisatge.
    const fusion = new PoseFusion();
    fusion.update({ sensorAzimuthDeg: 100, sensorAltitudeDeg: 0, newFrame: true, ...NO_VISUAL });
    for (let i = 0; i < 30; i++) {
      fusion.update({
        sensorAzimuthDeg: 100,
        sensorAltitudeDeg: 0,
        newFrame: true,
        imageRollDeg: 0,
        visual: visual(0.5, 0),
        sensorSpeedDegPerSec: 90,
        dtSec: 1 / 60,
      });
    }
    // Amb l'estirada feble hauria arribat als 115°, i amb l'estirada forta sola
    // s'hauria aturat als 10,6°, que segueixen sent vint diàmetres solars. El
    // sostre dur el reté al límit.
    expect(fusion.telemetry.driftDeg).toBeLessThan(8.5);
  });

  it('la concordança denuncia un signe invertit', () => {
    const good = new PoseFusion();
    const bad = new PoseFusion();
    for (const fusion of [good, bad]) {
      fusion.update({ sensorAzimuthDeg: 100, sensorAltitudeDeg: 0, newFrame: true, ...NO_VISUAL });
    }
    for (let i = 1; i <= 40; i++) {
      const sensorAzimuthDeg = 100 + i * 0.5;
      good.update({
        sensorAzimuthDeg,
        sensorAltitudeDeg: 0,
        newFrame: true,
        imageRollDeg: 0,
        visual: visual(0.5, 0),
        sensorSpeedDegPerSec: 30,
        dtSec: 1 / 60,
      });
      bad.update({
        sensorAzimuthDeg,
        sensorAltitudeDeg: 0,
        newFrame: true,
        imageRollDeg: 0,
        visual: visual(-0.5, 0),
        sensorSpeedDegPerSec: 30,
        dtSec: 1 / 60,
      });
    }
    expect(good.telemetry.agreement).toBeGreaterThan(0.95);
    expect(bad.telemetry.agreement).toBeLessThan(-0.95);
  });
});
