/**
 * L'ancoratge a la silueta del terreny, mesurat.
 *
 * COM ES PROVA UNA COSA QUE MIRA UNA CÀMERA. Es fa el camí al revés: es parteix
 * d'un perfil d'horitzó conegut i d'una postura VERTADERA, es pinta la imatge
 * que la càmera veuria des d'allà —cel clar a sobre de la carena, terra fosc a
 * sota—, i després es demana a l'ajust que recuperi la postura partint d'una de
 * dolenta. La xifra que importa és quant se n'acosta.
 *
 * Això prova la geometria de debò: la mateixa `projectToScreen` que dibuixa el
 * Sol és la que genera la imatge sintètica i la que fa servir l'ajust.
 */

import { describe, expect, it } from 'vitest';
import { detectSkyline, fitSkyline, predictSkylineY } from './skyline';
import { projectToScreen, unprojectFromScreen, type CameraPointing } from './orientation';
import type { Viewport } from './cameraGeometry';
import type { TrackerGeometry } from './visualTracker';

const CALIBRATION = { azimuthOffset: 0, altitudeOffset: 0, sensorFovDeg: 66 };

const VIEWPORT: Viewport = {
  width: 390,
  height: 640,
  focalPx: 340,
};

const GEOMETRY: TrackerGeometry = {
  gridWidth: 88,
  gridHeight: 176,
  scaleX: VIEWPORT.width / 88,
  scaleY: VIEWPORT.height / 176,
  focalPx: VIEWPORT.focalPx,
};

/** Diferència d'azimuts a (−180, 180]. Comparar-los a pèl dona 360 al voltant del 0. */
function angDiff(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

function pointing(azimuth: number, altitude: number): CameraPointing {
  return { azimuth, altitude, roll: 0, screenAngle: 0 };
}

/**
 * Un perfil d'horitzó amb personalitat.
 *
 * Ha de tenir RELLEU: una línia horitzontal perfecta no determina l'azimut —hi
 * pots girar tant com vulguis i la silueta és la mateixa— i l'ajust ho detecta
 * i es nega a respondre, que és el comportament correcte i es prova a part.
 */
function terrain(azimuthDeg: number): number {
  const a = (azimuthDeg * Math.PI) / 180;
  return 4 + 3 * Math.sin(a * 3) + 1.5 * Math.cos(a * 7);
}

/** Un horitzó pla, per al cas degenerat. */
function flatTerrain(): number {
  return 3;
}

/**
 * Pinta el que la càmera veuria des d'aquesta postura.
 *
 * Cel a 0,85 i terra a 0,15, amb la carena on toca. És el cas dels eclipsis
 * espanyols: Sol baix, terreny retallat en contrallum.
 */
function renderGray(
  camera: CameraPointing,
  profile: (az: number) => number,
): Float32Array {
  const { gridWidth: w, gridHeight: h } = GEOMETRY;
  const gray = new Float32Array(w * h);

  for (let gx = 0; gx < w; gx++) {
    const screenX = VIEWPORT.width / 2 + (gx + 0.5 - w / 2) * GEOMETRY.scaleX;
    // On cau la carena en aquesta columna, amb la mateixa geometria que l'app.
    let skyY = Number.NaN;
    let y = VIEWPORT.height / 2;
    for (let i = 0; i < 4; i++) {
      const ray = unprojectFromScreen(screenX, y, camera, CALIBRATION, VIEWPORT);
      const p = projectToScreen(ray.azimuth, profile(ray.azimuth), camera, CALIBRATION, VIEWPORT);
      if (!p.visible) break;
      y = p.y;
      skyY = p.y;
    }

    for (let gy = 0; gy < h; gy++) {
      const screenY = VIEWPORT.height / 2 + (gy + 0.5 - h / 2) * GEOMETRY.scaleY;
      if (!Number.isFinite(skyY)) {
        gray[gy * w + gx] = 0.85;
        continue;
      }
      /*
       * La vora va SUAVITZADA, i no és un detall del banc: una càmera de debò
       * integra la llum de tot el píxel, o sigui que la fila on cau la carena
       * surt a mig camí entre cel i terra. Pintant-ho a saltirons, el banc
       * quantitzava la silueta a una fila sencera —3,6 px, uns 0,6°— i el que
       * s'hauria mesurat seria l'error del banc i no el de l'algorisme.
       */
      const skyFraction = Math.max(
        0,
        Math.min(1, (skyY - (screenY - GEOMETRY.scaleY / 2)) / GEOMETRY.scaleY),
      );
      gray[gy * w + gx] = 0.15 + 0.7 * skyFraction;
    }
  }
  return gray;
}

describe('detecció de la silueta', () => {
  it('troba la carena a la fila on s’ha pintat', () => {
    const camera = pointing(250, 8);
    const gray = renderGray(camera, terrain);
    const hits = detectSkyline(gray, GEOMETRY, VIEWPORT);

    expect(hits.length).toBeGreaterThan(20);

    for (const hit of hits) {
      const expected = predictSkylineY(hit.x, camera, CALIBRATION, VIEWPORT, terrain);
      if (!Number.isFinite(expected)) continue;
      // Una fila de graella són 3,6 px de pantalla; el subpíxel ha de deixar-ho
      // per sota d'això.
      expect(Math.abs(hit.y - expected)).toBeLessThan(4);
    }
  });

  it('amb el cel sol no s’inventa cap carena', () => {
    const { gridWidth: w, gridHeight: h } = GEOMETRY;
    const gray = new Float32Array(w * h).fill(0.8);
    expect(detectSkyline(gray, GEOMETRY, VIEWPORT)).toHaveLength(0);
  });
});

describe('ajust de la postura contra el terreny', () => {
  /** Quant s'acosta l'ajust a la postura vertadera partint d'una de dolenta. */
  function recover(
    trueAz: number,
    trueAlt: number,
    errorAz: number,
    errorAlt: number,
  ): { az: number; alt: number; confidence: number } | null {
    const gray = renderGray(pointing(trueAz, trueAlt), terrain);
    const guess = pointing(trueAz + errorAz, trueAlt + errorAlt);
    const hits = detectSkyline(gray, GEOMETRY, VIEWPORT);
    const fix = fitSkyline(hits, guess, CALIBRATION, VIEWPORT, terrain);
    return fix === null
      ? null
      : { az: fix.azimuthDeg, alt: fix.altitudeDeg, confidence: fix.confidence };
  }

  it('recupera un error de brúixola de deu graus', () => {
    // Deu graus és un error de brúixola de mòbil de tots els dies: prou ferro
    // a prop, o simplement una calibració que ningú no ha fet mai.
    const got = recover(250, 8, 10, 0);
    expect(got).not.toBeNull();
    expect(Math.abs(angDiff(got!.az, 250))).toBeLessThan(0.5);
    expect(Math.abs(got!.alt - 8)).toBeLessThan(0.5);
  });

  it('recupera un error d’altura de cinc graus', () => {
    const got = recover(250, 8, 0, 5);
    expect(got).not.toBeNull();
    expect(Math.abs(got!.alt - 8)).toBeLessThan(0.5);
  });

  it('recupera els dos eixos alhora, a diversos azimuts', () => {
    for (const az of [120, 200, 250, 300]) {
      const got = recover(az, 6, -7, 3);
      expect(got, `azimut ${az}`).not.toBeNull();
      expect(Math.abs(angDiff(got!.az, az)), `azimut ${az}`).toBeLessThan(0.6);
      expect(Math.abs(got!.alt - 6), `altura a ${az}`).toBeLessThan(0.6);
    }
  });

  it('no empitjora quan la postura ja és bona', () => {
    const got = recover(250, 8, 0, 0);
    expect(got).not.toBeNull();
    expect(Math.abs(angDiff(got!.az, 250))).toBeLessThan(0.3);
    expect(Math.abs(got!.alt - 8)).toBeLessThan(0.2);
  });

  it('amb un horitzó pla es nega a decidir l’azimut', () => {
    // I ÉS EL QUE HA DE FER: sobre una línia horitzontal perfecta, girar en
    // azimut no canvia la imatge. Qualsevol resposta seria inventada.
    const gray = renderGray(pointing(250, 8), flatTerrain);
    const hits = detectSkyline(gray, GEOMETRY, VIEWPORT);
    const fix = fitSkyline(hits, pointing(260, 8), CALIBRATION, VIEWPORT, flatTerrain);
    if (fix !== null) {
      // Si respon, com a mínim no pot haver-se inventat que ha corregit
      // l'azimut: la informació no hi és.
      expect(Math.abs(fix.deltaAzimuthDeg)).toBeLessThan(1);
    }
  });

  it('amb poques columnes no respon', () => {
    expect(fitSkyline([], pointing(250, 8), CALIBRATION, VIEWPORT, terrain)).toBeNull();
  });

  it('no aplica correccions absurdes', () => {
    // Trenta graus fora: el més probable és que s'hagi aparellat una carena
    // amb una altra. Val més quedar-se com s'estava.
    const gray = renderGray(pointing(250, 8), terrain);
    const hits = detectSkyline(gray, GEOMETRY, VIEWPORT);
    const fix = fitSkyline(hits, pointing(250 + 40, 8), CALIBRATION, VIEWPORT, terrain);
    if (fix !== null) expect(Math.abs(fix.deltaAzimuthDeg)).toBeLessThanOrEqual(25);
  });

  it('la confiança baixa quan la silueta és fluixa', () => {
    const gray = renderGray(pointing(250, 8), terrain);
    // Contrast retallat a la desena part: la carena hi és, però amb prou feines.
    const faint = gray.map((v) => 0.5 + (v - 0.5) * 0.12);
    const strong = fitSkyline(
      detectSkyline(gray, GEOMETRY, VIEWPORT),
      pointing(253, 8),
      CALIBRATION,
      VIEWPORT,
      terrain,
    );
    const weak = fitSkyline(
      detectSkyline(faint, GEOMETRY, VIEWPORT),
      pointing(253, 8),
      CALIBRATION,
      VIEWPORT,
      terrain,
    );
    expect(strong).not.toBeNull();
    if (weak !== null) expect(weak.confidence).toBeLessThan(strong!.confidence);
  });
});
