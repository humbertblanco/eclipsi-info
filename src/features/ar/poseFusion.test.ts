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
    usedBlocks: 15,
    saturated: false,
    residualPx: 0.02,
    pitchDegraded: false,
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

  it('amb el pitch degradat, la vertical recula cap al sensor', () => {
    // El cel s'ha menjat les files de dalt: el pitch de la imatge és el
    // desplaçament vertical comú amb un altre nom, i un biaix vertical
    // (exposició, un núvol) hi entra 1:1. La vertical ha de seguir el sensor;
    // el yaw no en té culpa i es queda com estava.
    const run = (degraded: boolean): number => {
      const fusion = new PoseFusion();
      fusion.update({ sensorAzimuthDeg: 100, sensorAltitudeDeg: 10, newFrame: true, ...NO_VISUAL });
      let out = { azimuthDeg: 0, altitudeDeg: 0 };
      for (let i = 0; i < 30; i++) {
        out = fusion.update({
          sensorAzimuthDeg: 100,
          sensorAltitudeDeg: 10,
          imageRollDeg: 0,
          newFrame: true,
          visual: { ...visual(0, 0.4), pitchDegraded: degraded },
          sensorSpeedDegPerSec: 0,
          dtSec: 1 / 60,
        });
      }
      return Math.abs(out.altitudeDeg - 10);
    };

    const withFlag = run(true);
    const withoutFlag = run(false);
    expect(withFlag).toBeLessThan(withoutFlag / 2.5);
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

/*
 * LA PROMESA DE L'APP: LA MUNTANYA GUANYA A LA BRÚIXOLA.
 *
 * ESTAT.md diu que l'ancoratge al terreny «recupera un error de brúixola de 10°
 * fins a menys de 0,5°». Al banc de `skyline.ts` això era cert, però a la vista
 * no hi arribava mai: l'estirada cap al sensor (τ 0,35 s quiet) és més forta
 * que l'ancoratge (τ 0,5 s), i el sistema es quedava en un punt d'equilibri
 * entremig. Mesurat: 5,74° de residu permanent amb confiança 1 —deu diàmetres
 * solars i mig— amb el terreny sempre a la vista i vint segons de marge.
 *
 * La correcció absoluta s'aplicava i es desfeia al fotograma següent, perquè la
 * fusió no recordava que la brúixola menteix. Ara n'aprèn el biaix.
 *
 * Aquest test és el que impedeix tornar-hi: si algú treu el biaix o el fa
 * aprendre massa lent, el residu torna a pujar i això es posa vermell.
 */
describe('la brúixola desviada i el terreny', () => {
  const VERITAT_AZ = 100;
  const SENSOR_AZ = 110; // deu graus fora, el cas de vora un cotxe o un trípode
  const ALT = 5;

  function convergeix(confidence: number, segons = 20): number {
    const fusion = new PoseFusion();
    let out = { azimuthDeg: 0, altitudeDeg: 0 };
    const dt = 1 / 60;
    for (let i = 0; i < segons * 60; i++) {
      out = fusion.update({
        sensorAzimuthDeg: SENSOR_AZ,
        sensorAltitudeDeg: ALT,
        imageRollDeg: 0,
        newFrame: i % 2 === 0,
        visual: null,
        sensorSpeedDegPerSec: 0,
        dtSec: dt,
        anchor: { azimuthDeg: VERITAT_AZ, altitudeDeg: ALT, confidence },
        // El mateix parell que envia ARView: l'error del fix mesurat a la
        // captura, del qual s'aprèn el biaix.
        anchorBias: {
          errAzDeg: SENSOR_AZ - VERITAT_AZ,
          errAltDeg: 0,
          confidence,
        },
      });
    }
    return Math.abs(out.azimuthDeg - VERITAT_AZ);
  }

  it('amb el terreny a la vista, el residu baixa de mig grau', () => {
    // Mig grau és el número d'ESTAT.md, i és menys d'un diàmetre solar.
    expect(convergeix(1)).toBeLessThan(0.5);
    expect(convergeix(0.8)).toBeLessThan(0.5);
  });

  it('amb un ancoratge mediocre encara guanya, però amb menys marge', () => {
    // Confiança 0,5 és un aparellament just: ha de corregir igualment, però no
    // se li pot exigir la mateixa precisió.
    expect(convergeix(0.5)).toBeLessThan(1.5);
  });

  it('sense terreny a la vista, la brúixola mana i l’error es queda', () => {
    // El contrast que dona sentit al de dalt: sense ancoratge no hi ha res que
    // pugui saber que la brúixola menteix, i la superposició ha d'anar on el
    // sensor diu. Si això fallés, voldria dir que ens estem inventant un nord.
    const fusion = new PoseFusion();
    let out = { azimuthDeg: 0, altitudeDeg: 0 };
    for (let i = 0; i < 20 * 60; i++) {
      out = fusion.update({
        sensorAzimuthDeg: SENSOR_AZ,
        sensorAltitudeDeg: ALT,
        imageRollDeg: 0,
        newFrame: i % 2 === 0,
        visual: null,
        sensorSpeedDegPerSec: 0,
        dtSec: 1 / 60,
        anchor: null,
      });
    }
    expect(Math.abs(out.azimuthDeg - SENSOR_AZ)).toBeLessThan(0.5);
  });
});

/*
 * LA REGLA DE LA QUIETUD: quan el mòbil no es mou, la superposició no es mou.
 *
 * Les correccions — l'estirada cap al sensor, l'ancoratge a 5 Hz — segueixen
 * actuant, però retallades a una velocitat que l'ull no distingeix d'estar
 * clavada (0,3°/s). El límit s'obre amb la velocitat, amb la seva cua i amb
 * l'excés de desalineació, perquè ni el gest ni l'arrencada amb la brúixola
 * desviada es tornin lents.
 */
describe('la regla de la quietud', () => {
  const dt = 1 / 60;

  it('quiet vol dir quiet: ni el soroll del sensor ni el ball dels fixos es veuen', () => {
    const fusion = new PoseFusion();
    const rnd = (() => {
      let s = 12345;
      return () => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
      };
    })();

    let prev: { azimuthDeg: number; altitudeDeg: number } | null = null;
    let maxStep = 0;
    let maxError = 0;
    let fix = { azimuthDeg: 250, altitudeDeg: 20, confidence: 1 };
    for (let i = 0; i < 20 * 60; i++) {
      const noiseAz = (rnd() - 0.5) * 0.6;
      const noiseAlt = (rnd() - 0.5) * 0.6;
      if (i % 12 === 0) {
        // Cada fix balla una mica, com els de debò.
        fix = {
          azimuthDeg: 250 + (rnd() - 0.5) * 0.6,
          altitudeDeg: 20 + (rnd() - 0.5) * 0.6,
          confidence: 1,
        };
      }
      const out = fusion.update({
        sensorAzimuthDeg: 250 + noiseAz,
        sensorAltitudeDeg: 20 + noiseAlt,
        imageRollDeg: 0,
        newFrame: i % 2 === 0,
        visual: i % 2 === 0 ? visual(0, 0) : null,
        sensorSpeedDegPerSec: 0,
        dtSec: dt,
        anchor: fix,
        anchorBias: {
          errAzDeg: noiseAz - (fix.azimuthDeg - 250),
          errAltDeg: noiseAlt - (fix.altitudeDeg - 20),
          confidence: 1,
        },
      });
      if (i > 120) {
        if (prev) {
          // El pas es mesura ANGULAR (l'azimut escalat per cos alt), que és el
          // que limita el règim de quietud i el que l'ull veu.
          const cosAlt = Math.cos((20 * Math.PI) / 180);
          maxStep = Math.max(
            maxStep,
            Math.hypot(
              (out.azimuthDeg - prev.azimuthDeg) * cosAlt,
              out.altitudeDeg - prev.altitudeDeg,
            ),
          );
        }
        maxError = Math.max(
          maxError,
          Math.abs(out.azimuthDeg - 250),
          Math.abs(out.altitudeDeg - 20),
        );
      }
      prev = out;
    }

    // El moviment per fotograma no pot passar del règim de quietud (0,3°/s).
    // El marge és de coma flotant, no de disseny.
    expect(maxStep).toBeLessThanOrEqual(0.3 * dt * 1.001 + 1e-6);
    // I la postura es queda on toca, no passejant pel soroll.
    expect(maxError).toBeLessThan(0.5);
  });

  it('una mesura visual grollera no injecta més que el retall', () => {
    const fusion = new PoseFusion();
    fusion.update({ sensorAzimuthDeg: 100, sensorAltitudeDeg: 0, newFrame: true, ...NO_VISUAL });
    // La imatge diu 5° quan el sensor n'ha vist 0,1: correspondència falsa que
    // ha passat els filtres. Abans entrava sencera.
    const out = fusion.update({
      sensorAzimuthDeg: 100.1,
      sensorAltitudeDeg: 0,
      newFrame: true,
      imageRollDeg: 0,
      visual: visual(5, 0),
      sensorSpeedDegPerSec: 0,
      dtSec: dt,
    });
    expect(out.azimuthDeg).toBeLessThan(100.1 + 1.5 + 0.05);
  });

  it('les correccions no passegen la postura: fixos que ballen ±0,4°', () => {
    const fusion = new PoseFusion();
    fusion.update({ sensorAzimuthDeg: 100, sensorAltitudeDeg: 10, newFrame: true, ...NO_VISUAL });
    let prev: number | null = null;
    let maxStep = 0;
    for (let i = 0; i < 10 * 60; i++) {
      const fixAlt = 10 + (Math.floor(i / 12) % 2 === 0 ? 0.4 : -0.4);
      const out = fusion.update({
        sensorAzimuthDeg: 100,
        sensorAltitudeDeg: 10,
        imageRollDeg: 0,
        newFrame: i % 2 === 0,
        visual: null,
        sensorSpeedDegPerSec: 0,
        dtSec: dt,
        anchor: { azimuthDeg: 100, altitudeDeg: fixAlt, confidence: 1 },
        anchorBias: { errAzDeg: 0, errAltDeg: 10 - fixAlt, confidence: 1 },
      });
      if (i > 60 && prev !== null) {
        maxStep = Math.max(maxStep, Math.abs(out.altitudeDeg - prev));
      }
      prev = out.altitudeDeg;
    }
    expect(maxStep).toBeLessThanOrEqual(0.3 * dt + 1e-6);
  });

  it('l’obertura per desalineació no fa lenta l’arrencada amb la brúixola fora', () => {
    // Amb 10° d'error inicial, el límit s'obre (0,3 + 4·excés ≈ 36°/s) i la
    // correcció gran va de pressa; només el refinat final va al pas de quietud.
    const fusion = new PoseFusion();
    let out = { azimuthDeg: 0, altitudeDeg: 0 };
    for (let i = 0; i < 10 * 60; i++) {
      out = fusion.update({
        sensorAzimuthDeg: 110,
        sensorAltitudeDeg: 5,
        imageRollDeg: 0,
        newFrame: i % 2 === 0,
        visual: null,
        sensorSpeedDegPerSec: 0,
        dtSec: dt,
        anchor: { azimuthDeg: 100, altitudeDeg: 5, confidence: 1 },
        anchorBias: { errAzDeg: 10, errAltDeg: 0, confidence: 1 },
      });
    }
    expect(Math.abs(out.azimuthDeg - 100)).toBeLessThan(1);
  });

  it('un error d’escala sostingut queda retingut pel sostre i es recupera en parar', () => {
    // Obturador rodant caricaturitzat: la imatge sempre un 15% més gran que el
    // sensor, dos segons de gir seguit. La deriva no pot passar del sostre, i
    // en parar — quan l'ancoratge torna — s'ha de recollir de seguida.
    const fusion = new PoseFusion();
    let az = 100;
    fusion.update({ sensorAzimuthDeg: az, sensorAltitudeDeg: 0, newFrame: true, ...NO_VISUAL });
    for (let i = 0; i < 2 * 60; i++) {
      az += 0.5; // 30°/s
      fusion.update({
        sensorAzimuthDeg: az,
        sensorAltitudeDeg: 0,
        imageRollDeg: 0,
        newFrame: i % 2 === 0,
        visual: i % 2 === 0 ? visual(1.15, 0) : null, // sensor 1°/fotograma, imatge 1,15°
        sensorSpeedDegPerSec: 30,
        dtSec: dt,
      });
      expect(fusion.telemetry.driftDeg).toBeLessThanOrEqual(8.5);
    }
    // Es para: el sensor es queda quiet i l'ancoratge torna a veure el terreny.
    let out = { azimuthDeg: 0, altitudeDeg: 0 };
    for (let i = 0; i < 2 * 60; i++) {
      out = fusion.update({
        sensorAzimuthDeg: az,
        sensorAltitudeDeg: 0,
        imageRollDeg: 0,
        newFrame: i % 2 === 0,
        visual: i % 2 === 0 ? visual(0, 0) : null,
        sensorSpeedDegPerSec: 0,
        dtSec: dt,
        anchor: { azimuthDeg: az, altitudeDeg: 0, confidence: 1 },
        anchorBias: { errAzDeg: 0, errAltDeg: 0, confidence: 1 },
      });
    }
    expect(Math.abs(out.azimuthDeg - az)).toBeLessThan(0.5);
  });
});

/*
 * LA FÍSICA ASIMÈTRICA DEL BIAIX.
 *
 * El biaix d'azimut corregeix el magnetòmetre, que vora metall menteix desenes
 * de graus i menteix igual quan el terreny surt del quadre: s'aprèn fins a
 * ±40° i NO caduca mai. El d'altura corregeix... res: l'acceleròmetre va fi a
 * dècimes de grau, i el que l'ancoratge mesura en aquell eix és sobretot
 * l'error de la SEVA referència (arbres i teulades que el model de terreny nu
 * no té). Per això es capa a ±1,5° i caduca quan l'ancoratge desapareix.
 *
 * Abans d'aquest canvi, una silueta falsa podia ensenyar fins a 40° de biaix
 * d'altura que es restaven de l'acceleròmetre PER SEMPRE — i es feia visible
 * justament en inclinar el mòbil amunt, quan l'àncora ja no hi era per
 * dissimular-ho. És el «queda tort i no es recupera» que es veia al camp.
 */
describe('la física asimètrica del biaix', () => {
  const dt = 1 / 60;
  const AZ = 100;
  const ALT_VERITAT = 5; // l'acceleròmetre és la veritat en aquest eix

  function stepStill(
    fusion: PoseFusion,
    i: number,
    anchor: { azimuthDeg: number; altitudeDeg: number; confidence: number } | null,
    anchorBias: { errAzDeg: number; errAltDeg: number; confidence: number } | null,
  ) {
    return fusion.update({
      sensorAzimuthDeg: AZ,
      sensorAltitudeDeg: ALT_VERITAT,
      imageRollDeg: 0,
      newFrame: i % 2 === 0,
      visual: null,
      sensorSpeedDegPerSec: 0,
      dtSec: dt,
      anchor,
      anchorBias,
    });
  }

  it('el biaix d’altura no queda enverinat per una silueta falsa', () => {
    const fusion = new PoseFusion();
    // Una teulada que el model no té: el fix diu que apuntes 2° més avall del
    // que dius. 20 segons d'aprendre'n.
    const fix = { azimuthDeg: AZ, altitudeDeg: ALT_VERITAT - 2, confidence: 0.8 };
    const bias = { errAzDeg: 0, errAltDeg: 2, confidence: 0.8 };
    for (let i = 0; i < 20 * 60; i++) stepStill(fusion, i, fix, bias);

    // El sostre: mai més d'un grau i mig, ni amb el fix davant.
    expect(Math.abs(fusion.telemetry.biasAltDeg)).toBeLessThanOrEqual(1.5);

    // El terreny surt del quadre (s'apunta al cel): el fix i el seu error
    // desapareixen, i l'acceleròmetre ha de recuperar l'autoritat.
    let out = { azimuthDeg: 0, altitudeDeg: 0 };
    for (let i = 0; i < 20 * 60; i++) out = stepStill(fusion, i, null, null);
    expect(Math.abs(out.altitudeDeg - ALT_VERITAT)).toBeLessThan(0.5);

    for (let i = 0; i < 20 * 60; i++) out = stepStill(fusion, i, null, null);
    expect(Math.abs(out.altitudeDeg - ALT_VERITAT)).toBeLessThan(0.15);
    expect(Math.abs(fusion.telemetry.biasAltDeg)).toBeLessThan(0.15);
  });

  it('el biaix d’altura es limita a un grau i mig encara que el fix digui deu', () => {
    const fusion = new PoseFusion();
    const fix = { azimuthDeg: AZ, altitudeDeg: ALT_VERITAT - 10, confidence: 1 };
    const bias = { errAzDeg: 0, errAltDeg: 10, confidence: 1 };
    for (let i = 0; i < 30 * 60; i++) stepStill(fusion, i, fix, bias);
    expect(Math.abs(fusion.telemetry.biasAltDeg)).toBeLessThanOrEqual(1.5);

    // I en desaparèixer el fix, la postura torna a l'acceleròmetre.
    let out = { azimuthDeg: 0, altitudeDeg: 0 };
    for (let i = 0; i < 30 * 60; i++) out = stepStill(fusion, i, null, null);
    expect(Math.abs(out.altitudeDeg - ALT_VERITAT)).toBeLessThan(0.2);
  });

  it('el biaix d’azimut NO caduca: la brúixola menteix igual sense terreny', () => {
    // El comportament pel qual es va crear el biaix (la muntanya guanya a la
    // brúixola) ha de sobreviure a perdre el terreny de vista.
    const fusion = new PoseFusion();
    const fix = { azimuthDeg: AZ - 10, altitudeDeg: ALT_VERITAT, confidence: 1 };
    const bias = { errAzDeg: 10, errAltDeg: 0, confidence: 1 };
    for (let i = 0; i < 20 * 60; i++) stepStill(fusion, i, fix, bias);
    expect(fusion.telemetry.biasAzDeg).toBeGreaterThan(8);

    let out = { azimuthDeg: 0, altitudeDeg: 0 };
    for (let i = 0; i < 30 * 60; i++) out = stepStill(fusion, i, null, null);
    // Mig minut apuntant al cel: el nord après no s'ha d'haver esvaït.
    expect(Math.abs(out.azimuthDeg - (AZ - 10))).toBeLessThan(1);
    expect(fusion.telemetry.biasAzDeg).toBeGreaterThan(8);
  });

  it('el biaix segueix aprenent durant el gest, quan l’àncora de postura ja no val', () => {
    // El mòbil escombra a 30°/s: `anchor` (postura) és null perquè el gating
    // de moviment el mata, però `anchorBias` (error a la captura) continua.
    const fusion = new PoseFusion();
    const bias = { errAzDeg: 10, errAltDeg: 0, confidence: 1 };
    let az = 100;
    fusion.update({
      sensorAzimuthDeg: az,
      sensorAltitudeDeg: 5,
      imageRollDeg: 0,
      newFrame: true,
      visual: null,
      sensorSpeedDegPerSec: 30,
      dtSec: dt,
      anchor: null,
      anchorBias: null,
    });
    for (let i = 0; i < 10 * 60; i++) {
      az += 30 * dt * (i % 400 < 200 ? 1 : -1); // vaivé de ±30°/s
      fusion.update({
        sensorAzimuthDeg: az,
        sensorAltitudeDeg: 5,
        imageRollDeg: 0,
        newFrame: i % 2 === 0,
        visual: null,
        sensorSpeedDegPerSec: 30,
        dtSec: dt,
        anchor: null,
        anchorBias: bias,
      });
    }
    expect(fusion.telemetry.biasAzDeg).toBeGreaterThan(7);
  });

  it('un ancoratge només d’altura no toca l’azimut ni el seu biaix', () => {
    const fusion = new PoseFusion();
    // Primer s'aprèn un biaix d'azimut legítim amb un fix complet.
    const fullFix = { azimuthDeg: AZ - 10, altitudeDeg: ALT_VERITAT, confidence: 1 };
    const fullBias = { errAzDeg: 10, errAltDeg: 0, confidence: 1 };
    for (let i = 0; i < 20 * 60; i++) stepStill(fusion, i, fullFix, fullBias);
    const learned = fusion.telemetry.biasAzDeg;
    expect(learned).toBeGreaterThan(8);

    // Després arriba un horitzó pla: fix amb altitudeOnly. El seu dAz=0 diria
    // «la brúixola no menteix» — i és mentida, és que no ho pot saber.
    const flatFix = {
      azimuthDeg: AZ,
      altitudeDeg: ALT_VERITAT - 1,
      confidence: 1,
      altitudeOnly: true,
    };
    const flatBias = { errAzDeg: 0, errAltDeg: 1, confidence: 1, altitudeOnly: true };
    let out = { azimuthDeg: 0, altitudeDeg: 0 };
    for (let i = 0; i < 20 * 60; i++) {
      out = fusion.update({
        sensorAzimuthDeg: AZ,
        sensorAltitudeDeg: ALT_VERITAT,
        imageRollDeg: 0,
        newFrame: i % 2 === 0,
        visual: null,
        sensorSpeedDegPerSec: 0,
        dtSec: dt,
        anchor: flatFix,
        anchorBias: flatBias,
      });
    }
    // El biaix d'azimut après ha de quedar INTACTE, i la postura d'azimut al
    // lloc corregit; l'altura sí que segueix el fix pla.
    expect(fusion.telemetry.biasAzDeg).toBeCloseTo(learned, 1);
    expect(Math.abs(out.azimuthDeg - (AZ - 10))).toBeLessThan(1);
    expect(out.altitudeDeg).toBeLessThan(ALT_VERITAT - 0.4);
  });
});
