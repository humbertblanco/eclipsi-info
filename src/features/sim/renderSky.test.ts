/**
 * La simulació del cel no pot quedar-se en un rectangle negre.
 *
 * PER QUÈ EXISTEIX AQUEST FITXER. Perquè va passar, i a producció. A
 * Valdelavilla (41,9714, −2,2030) —un punt on l'app ja avisa que «el terreny
 * tapa la totalitat sencera»— la vista de simulació s'obria completament
 * negra. No hi havia cap error a la consola i el gràfic de trajectòria del
 * costat pintava perfectament, o sigui que semblava un giny que no havia
 * carregat.
 *
 * No ho era. `drawHorizon()` calcula la línia de terreny amb
 * `y = cy + (altura del Sol − altura de la carena) · escala`, i allà la carena
 * queda 5,77° per damunt del Sol. Amb un camp de visió de 3,2° això són uns
 * cinc-cents píxels per sobre de la vora superior: el polígon del terreny
 * —que va de la cantonada inferior esquerra, puja fins a la carena i baixa a
 * la dreta— **cobria el llenç sencer** i s'omplia de negre per damunt del Sol,
 * de la Lluna i de la corona, que ja s'havien dibuixat.
 *
 * O sigui: el dibuix era correcte i el que es veia era la muntanya. Però era
 * indistingible d'una pantalla trencada, i passava justament a l'instant que
 * la vista obre per defecte (`SimulationView` arrenca al màxim) i justament
 * als punts on el consell de l'app importa més.
 *
 * QUÈ VIGILA, i per què això i no els píxels: no hi ha cap canvas de debò a
 * Node i no cal. La pregunta no és de quin color queda cada píxel —això es
 * mira amb els ulls— sinó una de geomètrica que es pot respondre amb tota la
 * precisió del món: **la carena que es dibuixa, cau dins del llenç?** Si no hi
 * cau, no hi ha res que separi «tens una muntanya al davant» de «això no
 * funciona».
 *
 * El context de mentida és el mateix patró que `features/share/thumbnail.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import { renderEclipseSky, skyFieldOfView } from './renderSky';
import { sampleAt } from '../../core/astro/ephemeris';
import { STANDARD_ATMOSPHERE } from '../../core/astro/constants';
import { flatHorizonProfile, horizonSampler } from '../../core/horizon/profile';

const WIDTH = 280;
const HEIGHT = 160;

/**
 * El punt i l'instant de l'error, tal com es van reproduir en local l'11-8-2026.
 * El Sol és a 7,08° i la carena a 12,85°: 5,77° de desnivell.
 */
const VALDELAVILLA = { lat: 41.9714, lon: -2.20301, elevation: 1119 };
const MAXIM = new Date('2026-08-12T18:29:31Z');

/** Altura de la carena que tapava el Sol, en graus. */
const CARENA_DEG = 12.85;

/**
 * Un context de canvas de mentida que apunta els punts AGRUPATS PER CAMÍ.
 *
 * L'AGRUPACIÓ NO ÉS UN LUXE, I AIXÒ JA VA FALLAR UNA VEGADA. La primera versió
 * d'aquesta prova acumulava tots els `moveTo`/`lineTo` en una sola llista i
 * preguntava si algun queia dins del llenç. Passava amb el codi defectuós, o
 * sigui que no provava res, i per dos motius alhora:
 *
 *   · el polígon del terreny s'ancora a les dues cantonades de baix
 *     —`moveTo(0, height)` i `lineTo(width, height)`—, i aquestes hi cauen
 *     sempre, amb la carena on sigui;
 *   · i `drawCorona()` dibuixa quaranta-vuit serrells radials amb `moveTo` i
 *     `lineTo` al bell mig del llenç, que també hi cauen sempre.
 *
 * Separant per `beginPath()` es pot mirar NOMÉS el polígon del terreny, que és
 * l'últim que es dibuixa, i descartar-ne els dos ancoratges.
 */
function recordingContext(): {
  ctx: CanvasRenderingContext2D;
  paths: Array<Array<[number, number]>>;
  alphas: number[];
} {
  const paths: Array<Array<[number, number]>> = [];
  const alphas: number[] = [];
  let current: Array<[number, number]> = [];
  paths.push(current);

  const ctx = new Proxy(
    {},
    {
      get(_target, key: string) {
        if (key === 'measureText') return (text: string) => ({ width: text.length * 8 });
        if (key === 'createRadialGradient') {
          return () => ({ addColorStop: () => undefined });
        }
        if (key === 'beginPath') {
          return () => {
            current = [];
            paths.push(current);
          };
        }
        if (key === 'moveTo' || key === 'lineTo') {
          return (x: number, y: number) => {
            current.push([x, y]);
          };
        }
        return () => undefined;
      },
      // Els colors i els gruixos s'assignen com a propietats i s'accepten i
      // prou; l'opacitat, en canvi, ES GUARDA: és una decisió, no un adorn.
      set: (_target, key: string, value: unknown) => {
        if (key === 'globalAlpha' && typeof value === 'number') alphas.push(value);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;

  return { ctx, paths, alphas };
}

/**
 * El polígon del terreny, i es tria PEL NOMBRE DE PUNTS, no per l'ordre.
 *
 * La carena es dibuixa mostrejant l'amplada de dos en dos píxels: és, de
 * llarg, el camí amb més punts del llenç. Buscar-lo per posició seria fràgil,
 * perquè quan el terreny tapa el Sol l'ordre de dibuix s'inverteix a posta i
 * els astres passen a anar després.
 *
 * Se'n treuen els dos ancoratges de les cantonades de baix: el que queda és la
 * carena i només la carena.
 */
function carenaDibuixada(paths: Array<Array<[number, number]>>): Array<[number, number]> {
  let terreny: Array<[number, number]> = [];
  for (const path of paths) if (path.length > terreny.length) terreny = path;
  return terreny.slice(1, -1);
}

/** Un perfil pla a l'altura donada, que és la carena que tapa el Sol. */
function carenaA(altitudeDeg: number): (az: number) => number {
  return horizonSampler(
    flatHorizonProfile(
      VALDELAVILLA.lat,
      VALDELAVILLA.lon,
      VALDELAVILLA.elevation,
      altitudeDeg,
    ),
  );
}

describe('la simulació del cel quan el terreny tapa el Sol', () => {
  const sample = sampleAt(MAXIM, VALDELAVILLA);

  it('el cas de partida és el de debò: el Sol per sota de la carena', () => {
    // Si això falla, l'escenari ha deixat de reproduir l'error i les proves de
    // sota ja no proven el que diuen que proven.
    expect(sample.sun.altitudeApparent).toBeLessThan(CARENA_DEG);
    expect(CARENA_DEG - sample.sun.altitudeApparent).toBeGreaterThan(3);
  });

  it('la carena es dibuixa dins del llenç, no cinc-cents píxels més amunt', () => {
    const { ctx, paths } = recordingContext();
    const horizonProfile = carenaA(CARENA_DEG);

    renderEclipseSky(ctx, sample, WIDTH, HEIGHT, {
      fovDeg: skyFieldOfView(sample, horizonProfile, WIDTH, HEIGHT),
      atmosphere: STANDARD_ATMOSPHERE,
      showHorizon: true,
      horizonProfile,
    });

    const carena = carenaDibuixada(paths);
    expect(carena.length, 'no s’ha dibuixat cap línia de terreny').toBeGreaterThan(10);

    const dins = carena.filter(([, y]) => y >= 0 && y <= HEIGHT);
    expect(
      dins.length,
      'la carena queda fora del llenç: el polígon del terreny omple tota la vista i tapa el Sol',
    ).toBeGreaterThan(0);
  });

  it('el Sol es dibuixa igualment, esmorteït darrere la muntanya', () => {
    // Sense això la vista diu «hi ha una carena» però no diu on és el Sol que
    // et perds, que és la meitat de la resposta. El 0,28 és el mateix que fa
    // servir la vista de càmera per al mateix cas.
    const { ctx, alphas } = recordingContext();
    const horizonProfile = carenaA(CARENA_DEG);

    renderEclipseSky(ctx, sample, WIDTH, HEIGHT, {
      fovDeg: skyFieldOfView(sample, horizonProfile, WIDTH, HEIGHT),
      atmosphere: STANDARD_ATMOSPHERE,
      showHorizon: true,
      horizonProfile,
    });

    expect(
      alphas.some((a) => a > 0 && a < 1),
      'els astres no s’han esmorteït: o no es dibuixen o menteixen dient que els veuràs',
    ).toBe(true);
  });

  it('sense obstacle no s’esmorteeix res', () => {
    const { ctx, alphas } = recordingContext();
    const lliure = carenaA(0);

    renderEclipseSky(ctx, sample, WIDTH, HEIGHT, {
      fovDeg: skyFieldOfView(sample, lliure, WIDTH, HEIGHT),
      atmosphere: STANDARD_ATMOSPHERE,
      showHorizon: true,
      horizonProfile: lliure,
    });

    expect(alphas.filter((a) => a < 1)).toEqual([]);
  });

  it('el Sol continua al centre encara que s’obri el camp', () => {
    // Obrir el camp no pot desplaçar el Sol: és l'àncora de tota la vista.
    const horizonProfile = carenaA(CARENA_DEG);
    const fov = skyFieldOfView(sample, horizonProfile, WIDTH, HEIGHT);
    // Amb 5,77° de desnivell cal, com a mínim, veure de la carena al Sol.
    expect(fov).toBeGreaterThan(2 * (CARENA_DEG - sample.sun.altitudeApparent));
  });

  it('sense obstacle el camp no es toca', () => {
    // La vista de sempre no pot canviar d'escala per un canvi que no la mira:
    // un punt amb l'horitzó lliure ha de seguir enquadrat a 3,2°.
    const lliure = carenaA(0);
    expect(skyFieldOfView(sample, lliure, WIDTH, HEIGHT)).toBe(3.2);
    // I sense perfil, igual.
    expect(skyFieldOfView(sample, undefined, WIDTH, HEIGHT)).toBe(3.2);
  });

  it('un obstacle desmesurat no encongeix el Sol fins a fer-lo invisible', () => {
    // Un penya-segat a tocar podria demanar un camp de cent graus, i llavors
    // el Sol seria menys d'un píxel: deixaria de ser una simulació.
    const paret = carenaA(70);
    expect(skyFieldOfView(sample, paret, WIDTH, HEIGHT)).toBeLessThanOrEqual(30);
  });
});
