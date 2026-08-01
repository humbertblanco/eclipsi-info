/**
 * Tests de `illuminance.ts`.
 *
 * Van contra els valors publicats que el model ha de reproduir:
 *
 *   Sol directe amb el Sol alt      ~100.000 lx
 *   Global horitzontal al zenit     ~110.000-120.000 lx
 *   Posta (Sol a 0°)                ~400 lx
 *   Final del crepuscle civil (−6°)  3,4 lx
 *   Final del crepuscle nàutic (−12°) 0,008 lx
 *   Nit sense lluna                  ~0,002 lx
 *   Totalitat                        entre 1 i 10 lx
 *
 * (taula canònica d'il·luminàncies, IESNA / Allen; totalitat: Möllmann &
 * Vollmer 2006 i mesures publicades de l'eclipsi del 21 d'agost de 2017)
 */

import { describe, it, expect } from 'vitest';
import {
  airMass,
  beamTransmittance,
  clearSkyIlluminanceLux,
  diffuseHorizontalIlluminanceLux,
  directHorizontalIlluminanceLux,
  directNormalIlluminanceLux,
  eclipseIlluminance,
  equivalentSunAltitudeDeg,
  umbralLeakageFraction,
  verticalOpticalDepth,
} from './illuminance';
import { EXTRATERRESTRIAL_ILLUMINANCE_LUX, NIGHT_SKY_LUX } from './constants';

describe('airMass', () => {
  it('val 1 al zenit i 37,92 a l’horitzó', () => {
    // Els dos valors de referència de la taula de Kasten & Young (1989).
    //
    // AL ZENIT NO DONA 1 EXACTE, I NO POT DONAR-LO: la fórmula és un AJUST, no
    // una identitat. Amb h = 90 el terme 0,50572·(90 + 6,07995)^−1,6364 encara
    // val 2,88·10⁻⁴ i el denominador surt 1,000288, o sigui m(90) = 0,99971.
    // Aquest 0,03% és el preu que paga l'ajust per clavar la massa d'aire a
    // l'horitzó, que és exactament on aquesta aplicació la necessita (Sol entre
    // 1° i 12° el 2026 i el 2028). Demanar-li 1 amb sis decimals seria demanar
    // precisió a un lloc on la fórmula no en promet: la mateixa Kasten & Young
    // declara un error de fins al 0,1% respecte de les taules integrades.
    //
    // La tolerància és, doncs, la desviació estructural de la fórmula, no un
    // marge triat per fer passar el test. El 0,03% queda a més molt per sota de
    // la incertesa del gruix òptic real d'un dia qualsevol (els aerosols sols ja
    // el mouen desenes de per cent).
    expect(airMass(90)).toBeCloseTo(1, 3);
    expect(Math.abs(airMass(90) - 1)).toBeLessThan(3e-4);
    expect(airMass(0)).toBeCloseTo(37.92, 2);
  });

  it('a les altures dels eclipsis espanyols dona masses d’aire enormes', () => {
    // Aquest és el motiu pel qual el mòdul no pot fer servir 1/sin(h).
    expect(airMass(2)).toBeGreaterThan(19);
    expect(airMass(2)).toBeLessThan(20);
    expect(airMass(5)).toBeCloseTo(10.31, 1);
    expect(airMass(12)).toBeCloseTo(4.71, 1);
  });

  it('s’aparta molt de 1/sin(h) prop de l’horitzó', () => {
    // A 2°, 1/sin(h) donaria 28,7 en comptes de 19,4: un 48% de més.
    const naive = 1 / Math.sin((2 * Math.PI) / 180);
    expect(naive / airMass(2)).toBeGreaterThan(1.4);
    // Amunt, en canvi, les dues fórmules coincideixen.
    expect(airMass(60)).toBeCloseTo(1 / Math.sin((60 * Math.PI) / 180), 2);
  });

  it('creix de manera monòtona en baixar', () => {
    let previous = 0;
    for (let h = 90; h >= 0; h -= 0.5) {
      const m = airMass(h);
      expect(m).toBeGreaterThan(previous);
      previous = m;
    }
  });
});

describe('extinció atmosfèrica', () => {
  it('el gruix òptic vertical estàndard val 0,26', () => {
    expect(verticalOpticalDepth()).toBeCloseTo(0.26, 6);
  });

  it('només la part de Rayleigh escala amb la pressió', () => {
    const highAltitude = verticalOpticalDepth({ pressureMb: 505, temperatureC: 0 });
    // Es perd mitja atmosfera de Rayleigh (0,10 → 0,05) i res més.
    expect(highAltitude).toBeCloseTo(0.21, 6);
  });

  it('amb el Sol entre 2° i 12° l’extinció ja s’ho menja gairebé tot', () => {
    // El fet que obliga a modelar l'extinció en aquesta aplicació.
    expect(beamTransmittance(12)).toBeLessThan(0.45);
    expect(beamTransmittance(5)).toBeLessThan(0.20);
    expect(beamTransmittance(2)).toBeLessThan(0.07);
    // A l'horitzó en queda menys de l'1%.
    expect(beamTransmittance(0)).toBeLessThan(0.01);
  });

  it('al zenit encara es perd una quarta part de la llum', () => {
    // exp(−τ₀) és l'extinció al zenit SI la massa d'aire hi valgués 1 exacte.
    // Kasten & Young hi dona 0,99971 (vegeu el test de `airMass`), i amb
    // l'exponent de Forbes el gruix efectiu queda 0,26·0,99977: la
    // transmitància surt 6·10⁻⁵ RELATIU per damunt d'exp(−0,26). La tolerància
    // d'aquest test és aquesta desviació heretada, no un marge d'excusa.
    expect(beamTransmittance(90)).toBeCloseTo(Math.exp(-0.26), 3);
    expect(Math.abs(beamTransmittance(90) / Math.exp(-0.26) - 1)).toBeLessThan(
      1e-4,
    );
    expect(beamTransmittance(90)).toBeGreaterThan(0.75);
  });

  it('l’aire més enrarit deixa passar més llum', () => {
    const sea = beamTransmittance(5, { pressureMb: 1010, temperatureC: 10 });
    const mountain = beamTransmittance(5, { pressureMb: 780, temperatureC: 5 });
    expect(mountain).toBeGreaterThan(sea);
  });
});

describe('clearSkyIlluminanceLux', () => {
  it('el Sol directe al zenit dona uns 100.000 lux', () => {
    // La xifra clàssica de "llum solar directa".
    const dn = directNormalIlluminanceLux(90);
    expect(dn).toBeGreaterThan(95_000);
    expect(dn).toBeLessThan(110_000);
  });

  it('el global horitzontal al zenit ronda els 115.000 lux', () => {
    // Directa + cel. És més que els 100.000 de la llum directa sola, i és el
    // que mesura un luxímetre apuntant amunt un dia serè.
    const global = clearSkyIlluminanceLux(90);
    expect(global).toBeGreaterThan(100_000);
    expect(global).toBeLessThan(130_000);
  });

  it('reprodueix els ancoratges publicats de posta i crepuscles', () => {
    expect(clearSkyIlluminanceLux(0)).toBeCloseTo(400, 6);
    expect(clearSkyIlluminanceLux(-6)).toBeCloseTo(3.4, 6);
    expect(clearSkyIlluminanceLux(-12)).toBeCloseTo(0.008, 6);
  });

  it('de nit es planta al fons d’estrelles i airglow', () => {
    expect(clearSkyIlluminanceLux(-18)).toBeCloseTo(NIGHT_SKY_LUX, 9);
    expect(clearSkyIlluminanceLux(-40)).toBeCloseTo(NIGHT_SKY_LUX, 9);
  });

  it('creix de manera monòtona amb l’altura del Sol', () => {
    // És el que permet invertir-la per trobar l'altura equivalent.
    let previous = 0;
    for (let h = -18; h <= 90; h += 0.25) {
      const e = clearSkyIlluminanceLux(h);
      expect(e).toBeGreaterThan(previous);
      previous = e;
    }
  });

  it('per sota de l’horitzó tota la llum és del cel', () => {
    expect(directHorizontalIlluminanceLux(-1)).toBe(0);
    expect(directNormalIlluminanceLux(-1)).toBe(0);
    expect(clearSkyIlluminanceLux(-3)).toBe(diffuseHorizontalIlluminanceLux(-3));
  });

  it('mai no supera la il·luminància de fora de l’atmosfera', () => {
    for (let h = 0; h <= 90; h += 1) {
      expect(clearSkyIlluminanceLux(h)).toBeLessThan(
        EXTRATERRESTRIAL_ILLUMINANCE_LUX,
      );
    }
  });
});

describe('eclipseIlluminance', () => {
  it('sense eclipsi, coincideix amb el cel serè', () => {
    const e = eclipseIlluminance(1, 45);
    // La fuita hi suma un 0,006%: irrellevant, però hi és per continuïtat.
    expect(e.totalLux / e.clearSkyLux).toBeCloseTo(1, 3);
  });

  it('la totalitat amb el Sol alt dona entre 1 i 10 lux', () => {
    // El valor que demanaven les mesures publicades.
    for (const h of [90, 60, 45, 30]) {
      const e = eclipseIlluminance(0, h);
      expect(e.totalLux).toBeGreaterThan(1);
      expect(e.totalLux).toBeLessThan(10);
    }
  });

  it('durant la totalitat mana la fuita, no la corona', () => {
    // Contra la intuïció (i contra com se sol explicar): la corona hi posa
    // ~0,1 lux, mig plenilluni. Els altres 7 lux vénen de l'atmosfera
    // il·luminada de fora de l'ombra.
    const e = eclipseIlluminance(0, 90);
    expect(e.coronaLux).toBeGreaterThan(0.05);
    expect(e.coronaLux).toBeLessThan(0.3);
    expect(e.leakageLux).toBeGreaterThan(e.coronaLux * 20);
  });

  it('doblar la corona amb prou feines canvia la llum de terra', () => {
    const min = eclipseIlluminance(0, 60, { coronaFactor: 0.7 });
    const max = eclipseIlluminance(0, 60, { coronaFactor: 1.4 });
    expect(max.totalLux / min.totalLux).toBeLessThan(1.02);
  });

  it('una totalitat amb el Sol baix és molt més fosca', () => {
    // Cas dels eclipsis espanyols: el 12 d'agost de 2026 el Sol estarà entre
    // 2° i 12°. No serà la totalitat de manual, serà bastant més fosca.
    const high = eclipseIlluminance(0, 60).totalLux;
    const low = eclipseIlluminance(0, 3).totalLux;
    expect(low).toBeLessThan(high / 10);
    expect(low).toBeGreaterThan(0.05);
  });

  it('l’anularitat no s’acosta ni de bon tros a la foscor', () => {
    // Amb un 5% del flux encara hi ha milers de lux amb el Sol raonablement alt.
    const annular = eclipseIlluminance(0.052, 20);
    expect(annular.totalLux).toBeGreaterThan(1000);
  });

  it('la llum baixa de manera monòtona amb la fracció de flux', () => {
    let previous = -Infinity;
    for (let f = 0; f <= 1; f += 0.01) {
      const lux = eclipseIlluminance(f, 40).totalLux;
      expect(lux).toBeGreaterThanOrEqual(previous);
      previous = lux;
    }
  });

  it('mai no baixa del fons de nit', () => {
    expect(eclipseIlluminance(0, -10).totalLux).toBeGreaterThanOrEqual(
      NIGHT_SKY_LUX,
    );
  });

  it('accepta altura geomètrica i hi aplica la refracció', () => {
    // A 2° la refracció puja el Sol 0,28°, i allà baix això és molta llum.
    const geometric = eclipseIlluminance(1, 2, { altitudeIsGeometric: true });
    const apparent = eclipseIlluminance(1, 2);
    expect(geometric.totalLux).toBeGreaterThan(apparent.totalLux * 1.05);
  });

  it('la fuita relativa creix amb el Sol baix', () => {
    expect(umbralLeakageFraction(3)).toBeGreaterThan(umbralLeakageFraction(60));
    expect(umbralLeakageFraction(90)).toBeCloseTo(6e-5, 9);
  });
});

describe('equivalentSunAltitudeDeg', () => {
  it('tradueix la llum a una hora del dia que la gent coneix', () => {
    // Una totalitat amb el Sol alt té la llum del final del crepuscle civil.
    expect(equivalentSunAltitudeDeg(7)).toBeGreaterThan(-6);
    expect(equivalentSunAltitudeDeg(7)).toBeLessThan(-4);
    // I 3,4 lux són, per definició, el crepuscle civil.
    expect(equivalentSunAltitudeDeg(3.4)).toBeCloseTo(-6, 1);
    // 400 lux són la posta.
    expect(equivalentSunAltitudeDeg(400)).toBeCloseTo(0, 1);
  });

  it('és la inversa de `clearSkyIlluminanceLux`', () => {
    for (const h of [-12, -6, -1, 0, 2, 5, 10, 30, 60]) {
      const lux = clearSkyIlluminanceLux(h);
      expect(equivalentSunAltitudeDeg(lux)).toBeCloseTo(h, 3);
    }
  });

  it('se satura als extrems en comptes de disparar-se', () => {
    expect(equivalentSunAltitudeDeg(0)).toBe(-18);
    expect(equivalentSunAltitudeDeg(1e9)).toBe(90);
  });
});
