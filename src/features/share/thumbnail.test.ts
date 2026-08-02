/**
 * Proves de la miniatura i de la targeta, en entorn Node.
 *
 * AQUÍ NO HI HA CAP CANVAS. En Node no existeix, i muntar jsdom només per
 * comprovar que s'ha cridat `fillRect` no provaria res: el que pot fallar de
 * debò en aquesta feina no és el dibuix, són tres coses que sí que es poden
 * comprovar sense pintar res:
 *
 *   1. Que la miniatura busqui el perfil amb LA MATEIXA CLAU que fa servir
 *      `useHorizon` per desar-lo. Si divergissin, la miniatura dibuixaria
 *      sempre l'horitzó pla i no ho notaria cap error: només es veuria mirant
 *      amb atenció una imatge de 44 px.
 *   2. Que sense perfil desat es marqui `assumed` i amb perfil `measured`. És
 *      la decisió que separa «aquest és el teu horitzó» de «això encara no s'ha
 *      calculat», i és tota la peça.
 *   3. Que el text de la targeta no digui mai que veuràs una fase central que
 *      ningú ha comprovat contra el relleu, i que el percentatge surti de la
 *      regla del projecte i no d'un `toFixed`.
 */

import { describe, expect, test } from 'vitest';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import { horizonCacheKey } from '../../core/horizon/cache';
import {
  flatHorizonProfile,
  horizonSampler,
  type HorizonProfile,
} from '../../core/horizon/profile';
import {
  clipRings,
  DEFAULT_AZIMUTH_STEP_DEG,
  DEFAULT_RINGS,
  ringSignature,
  TERRESTRIAL_REFRACTION_K,
} from '../../core/horizon/raycast';
import { computeVisibility } from '../../core/visibility/verdict';
import { formatDuration } from '../../screens/format';
import {
  MINI_TRAJECTORY_SAMPLES,
  sampleTimesMs,
  trajectorySamples,
  trajectoryWindowMs,
  TRAJECTORY_SAMPLES,
} from '../sim/samples';
import { renderTrajectory } from '../sim/renderTrajectory';
import {
  buildThumbnailModel,
  resolveThumbnailTerrain,
  THUMB_HEIGHT,
  THUMB_WIDTH,
  thumbnailCacheKey,
  thumbnailCacheKeyFor,
} from './thumbnail';
import { cardFileName, cardText, CARD_HEIGHT, CARD_WIDTH } from './card';

/**
 * Un punt DINS de la franja del 2026 (província de Sòria): hi ha totalitat, i
 * amb el Sol a 7,2° el relleu hi decideix de debò. És el cas que interessa.
 */
const PLACE = { lat: 41.76, lon: -2.47, elevation: 1050 };
const ECLIPSE = '2026-08-12';

/* --- les mostres --------------------------------------------------------- */

describe('mostres del recorregut', () => {
  test('el primer i l’últim instant són exactament els extrems', () => {
    const times = sampleTimesMs(1000, 5000, 4);
    expect(times).toHaveLength(5);
    expect(times[0]).toBe(1000);
    expect(times[times.length - 1]).toBe(5000);
  });

  test('el pas no acumula error al llarg de 240 intervals', () => {
    // Un interval que no és divisible pel nombre de passos: és el cas que
    // delata la suma repetida d'un `dt` arrodonit.
    const times = sampleTimesMs(0, 10_007, TRAJECTORY_SAMPLES);
    expect(times[times.length - 1]).toBe(10_007);
    expect(times[TRAJECTORY_SAMPLES / 2]).toBeCloseTo(10_007 / 2, 9);
  });

  test('una finestra col·lapsada no deixa el gràfic sense res a dibuixar', () => {
    const circumstances = computeLocalCircumstances(ECLIPSE, PLACE);
    const collapsed = {
      ...circumstances,
      contacts: { max: circumstances.contacts.max },
    };
    const samples = trajectorySamples(collapsed, PLACE);
    expect(samples).toHaveLength(1);
    expect(samples[0]).toBe(collapsed.contacts.max);
  });

  test('la corba cobreix de C1 a C4 i té count + 1 mostres', () => {
    const circumstances = computeLocalCircumstances(ECLIPSE, PLACE);
    const { startMs, endMs } = trajectoryWindowMs(circumstances);
    expect(endMs).toBeGreaterThan(startMs);

    const samples = trajectorySamples(circumstances, PLACE, MINI_TRAJECTORY_SAMPLES);
    expect(samples).toHaveLength(MINI_TRAJECTORY_SAMPLES + 1);
    expect(samples[0].time.getTime()).toBe(startMs);
    expect(samples[samples.length - 1].time.getTime()).toBe(endMs);
  });

  test('la miniatura fa servir menys mostres que el gràfic gran', () => {
    // Si això s'iguala, l'historial passa a calcular vuit recorreguts complets
    // mentre s'obre una fulla. La comprovació és per no perdre-ho de vista.
    expect(MINI_TRAJECTORY_SAMPLES).toBeLessThan(TRAJECTORY_SAMPLES);
  });
});

/* --- la clau de la memòria cau ------------------------------------------- */

describe('clau del perfil', () => {
  test('és la mateixa que munta `useHorizon` amb els valors per defecte', () => {
    const expected = horizonCacheKey(
      PLACE.lat,
      PLACE.lon,
      ringSignature(
        DEFAULT_RINGS,
        DEFAULT_AZIMUTH_STEP_DEG,
        TERRESTRIAL_REFRACTION_K,
        0,
      ),
    );
    expect(thumbnailCacheKey(PLACE.lat, PLACE.lon)).toBe(expected);
    expect(thumbnailCacheKeyFor(PLACE.lat, PLACE.lon)).toBe(expected);
  });

  test('el degoteig del GPS no en canvia el resultat', () => {
    // Els perfils es claven a la posició arrodonida a ~100 m. Sense això, la
    // miniatura no trobaria mai el perfil que la pantalla acaba de desar.
    expect(thumbnailCacheKey(42.1201, 1.5698)).toBe(thumbnailCacheKey(42.12, 1.57));
  });

  test('retallar el radi del relleu dona una clau diferent', () => {
    const clipped = thumbnailCacheKeyFor(PLACE.lat, PLACE.lon, { maxRangeKm: 40 });
    expect(clipped).not.toBe(thumbnailCacheKey(PLACE.lat, PLACE.lon));
    expect(clipped).toBe(
      horizonCacheKey(
        PLACE.lat,
        PLACE.lon,
        ringSignature(
          clipRings(40),
          DEFAULT_AZIMUTH_STEP_DEG,
          TERRESTRIAL_REFRACTION_K,
          0,
        ),
      ),
    );
  });
});

/* --- terreny mesurat contra terreny suposat ------------------------------ */

describe('confiança del terreny', () => {
  test('sense perfil desat, l’horitzó pla es marca com a suposat', () => {
    const { profile, terrain } = resolveThumbnailTerrain(PLACE, null);
    expect(terrain).toBe('assumed');
    // La reserva és plana i coberta zero: no ha mesurat res i ho diu.
    expect(profile.coverage).toBe(0);
    expect(profile.altitudes.every((a) => a === 0)).toBe(true);
  });

  test('amb perfil desat es dibuixa el perfil, sense tocar-lo', () => {
    const cached: HorizonProfile = {
      ...flatHorizonProfile(PLACE.lat, PLACE.lon, PLACE.elevation, 6.5),
      coverage: 1,
      ringSignature: 'z12:10|z11:40|z10:150@0.25k0.13e0',
    };
    const { profile, terrain } = resolveThumbnailTerrain(PLACE, cached);
    expect(terrain).toBe('measured');
    expect(profile).toBe(cached);
  });

  test('el model complet arrossega la confiança fins a qui dibuixa', () => {
    const model = buildThumbnailModel(ECLIPSE, PLACE, null, 8);
    expect(model.terrain).toBe('assumed');
    expect(model.samples).toHaveLength(9);
    expect(model.circumstances.location).toEqual(PLACE);
  });

  test('la miniatura cap dins de l’alçada mínima de toc de 44 px', () => {
    // `--tap-min` és 44 px i la fila hi posa `--sp-3` (8 px) de coixí a dalt i
    // a baix. Si aquesta comprovació falla, la fulla deixa de tenir-hi vuit
    // entrades (MAX_RECENTS) i s'ha de moure aquell nombre, no aquest.
    expect(THUMB_HEIGHT).toBeLessThanOrEqual(44 - 8 * 2);
    expect(THUMB_WIDTH).toBeGreaterThan(THUMB_HEIGHT);
  });
});

/* --- el text de la targeta ----------------------------------------------- */

describe('text de la targeta', () => {
  const circumstances = computeLocalCircumstances(ECLIPSE, PLACE);

  test('sense terreny calculat no promet cap fase central visible', () => {
    const text = cardText({
      eclipseId: ECLIPSE,
      place: PLACE,
      label: 'Sant Julià de Vilatorta',
      circumstances,
      verdict: null,
      terrain: 'assumed',
      locale: 'ca',
    });

    expect(text.caveat).not.toBeNull();
    const central = text.figures[1];
    // L'etiqueta ha de dir que la durada NO descompta el relleu, i la xifra no
    // pot portar l'ambre de «això és el que veuràs».
    expect(central.label).toContain('sense terreny');
    expect(central.emphasis).toBeUndefined();
  });

  test('amb terreny calculat, la xifra és la que sobreviu al relleu', () => {
    // Una carena de vuit graus a tot arreu. Amb el Sol del 2026 a 7,2° al
    // màxim des d'aquí, se li menja la fase central sencera: és el cas que
    // justifica tota l'app i el que la targeta no pot amagar.
    const profile = flatHorizonProfile(PLACE.lat, PLACE.lon, PLACE.elevation, 8);
    const verdict = computeVisibility(circumstances, profile);
    const text = cardText({
      eclipseId: ECLIPSE,
      place: PLACE,
      label: 'Sant Julià de Vilatorta',
      circumstances,
      verdict,
      terrain: 'measured',
      locale: 'ca',
    });

    expect(text.caveat).toBeNull();
    const central = text.figures[1];
    expect(central.emphasis).toBe(true);
    // La xifra és la del veredicte i no la teòrica. Aquesta és la comprovació
    // que importa: `centralTotalSec` són més de cent segons que aquí no es
    // veuen, i escriure'ls seria enviar algú a un lloc des d'on no veurà res.
    expect(verdict.centralVisibleSec).toBeLessThan(verdict.centralTotalSec);
    expect(central.value).toBe(formatDuration(verdict.centralVisibleSec));
    expect(central.value).not.toBe(formatDuration(circumstances.centralDurationSec));
  });

  test('les coordenades manen quan el lloc no té nom', () => {
    const named = cardText({
      eclipseId: ECLIPSE,
      place: PLACE,
      label: 'Sant Julià de Vilatorta',
      circumstances,
      verdict: null,
      terrain: 'assumed',
      locale: 'ca',
    });
    expect(named.title).toBe('Sant Julià de Vilatorta');
    expect(named.coords).toContain('41.7600°');

    const anonymous = cardText({
      eclipseId: ECLIPSE,
      place: PLACE,
      label: null,
      circumstances,
      verdict: null,
      terrain: 'assumed',
      locale: 'ca',
    });
    // Sense nom, les coordenades pugen al títol i no es repeteixen a sota.
    expect(anonymous.title).toContain('41.7600°');
    expect(anonymous.coords).toBeNull();
  });

  test('el percentatge segueix la regla del projecte i no arrodoneix a 100', () => {
    // Un punt fora de la franja amb el disc gairebé tapat: la targeta no pot
    // escriure «100,0 %» al costat de la paraula «parcial» (ESTAT.md §3.2).
    const almost = {
      ...circumstances,
      kind: 'partial' as const,
      contacts: {
        ...circumstances.contacts,
        max: { ...circumstances.contacts.max, obscuration: 0.99994 },
      },
    };
    const text = cardText({
      eclipseId: ECLIPSE,
      place: PLACE,
      label: null,
      circumstances: almost,
      verdict: null,
      terrain: 'assumed',
      locale: 'ca',
    });
    const obscured = text.figures[text.figures.length - 1];
    expect(obscured.value).not.toBe('100,0 %');
    expect(obscured.value.replace(',', '.')).toMatch(/^(99\.\d+ %|quasi el 100 %)$/);
  });

  test('el castellà no deixa cap frase en català', () => {
    const text = cardText({
      eclipseId: ECLIPSE,
      place: PLACE,
      label: null,
      circumstances,
      verdict: null,
      terrain: 'assumed',
      locale: 'es',
    });
    expect(text.subtitle).toContain('Eclipse total');
    expect(text.caveat).toContain('El terreno');
  });
});

/* --- el mode mini del renderitzador -------------------------------------- */

/**
 * Un context de canvas de mentida que apunta què se li demana.
 *
 * NO ÉS UN CANVAS i no en fa falta cap: el que s'ha de comprovar no és quins
 * píxels surten —això es mira amb els ulls— sinó que el mode `mini` no cridi
 * les rutines que dibuixen graella, etiquetes i marcador, i que el mode `full`
 * segueixi cridant-les exactament com abans. És l'única part de la feina que
 * podia trencar una pantalla que ja funcionava.
 */
function recordingContext() {
  const calls: string[] = [];
  const points: Array<[number, number]> = [];
  const dashes: number[][] = [];

  const ctx = new Proxy(
    {},
    {
      get(_target, key: string) {
        if (key === 'measureText') return (text: string) => ({ width: text.length * 8 });
        if (key === 'moveTo' || key === 'lineTo') {
          return (x: number, y: number) => {
            points.push([x, y]);
          };
        }
        if (key === 'setLineDash') {
          return (pattern: number[]) => {
            dashes.push(pattern);
          };
        }
        return (...args: unknown[]) => {
          calls.push(`${key}(${args.join(',')})`);
        };
      },
      // Els colors i els gruixos s'assignen com a propietats: s'accepten i prou.
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;

  return { ctx, calls, points, dashes };
}

describe('mode mini del gràfic de trajectòria', () => {
  const circumstances = computeLocalCircumstances(ECLIPSE, PLACE);
  const samples = trajectorySamples(circumstances, PLACE, MINI_TRAJECTORY_SAMPLES);
  const profile = flatHorizonProfile(PLACE.lat, PLACE.lon, PLACE.elevation, 5);
  const horizonProfile = horizonSampler(profile);

  test('no escriu cap etiqueta ni marca cap contacte', () => {
    const { ctx, calls } = recordingContext();
    renderTrajectory(ctx, circumstances, samples, THUMB_WIDTH, THUMB_HEIGHT, {
      locale: 'ca',
      chrome: 'mini',
      terrain: 'measured',
      currentTime: circumstances.contacts.max.time,
      horizonProfile,
    });

    // Cap `fillText`: a 44 px una etiqueta de «C2 totalitat» tapa el dibuix.
    expect(calls.filter((call) => call.startsWith('fillText'))).toHaveLength(0);
    // Cap `arc`: els marcadors de contacte i el de l'instant actual són cercles.
    expect(calls.filter((call) => call.startsWith('arc'))).toHaveLength(0);
  });

  test('la imatge ocupa el llenç sencer, sense marges d’eixos', () => {
    const { ctx, points } = recordingContext();
    renderTrajectory(ctx, circumstances, samples, THUMB_WIDTH, THUMB_HEIGHT, {
      locale: 'ca',
      chrome: 'mini',
      terrain: 'measured',
      horizonProfile,
    });

    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(THUMB_WIDTH);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(THUMB_HEIGHT);
  });

  test('el terreny suposat va en traç discontinu i el mesurat no', () => {
    const assumed = recordingContext();
    renderTrajectory(assumed.ctx, circumstances, samples, THUMB_WIDTH, THUMB_HEIGHT, {
      locale: 'ca',
      chrome: 'mini',
      terrain: 'assumed',
      horizonProfile,
    });
    expect(assumed.dashes.some((pattern) => pattern.length > 0)).toBe(true);

    const measured = recordingContext();
    renderTrajectory(measured.ctx, circumstances, samples, THUMB_WIDTH, THUMB_HEIGHT, {
      locale: 'ca',
      chrome: 'mini',
      terrain: 'measured',
      horizonProfile,
    });
    expect(measured.dashes.every((pattern) => pattern.length === 0)).toBe(true);
  });

  test('el mode complet segueix pintant-ho tot, com sempre', () => {
    // La comprovació que de veritat protegeix: la pantalla de simulació no pot
    // haver perdut res pel camí d'afegir-hi un mode.
    const { ctx, calls, dashes } = recordingContext();
    renderTrajectory(ctx, circumstances, samples, 300, 230, {
      locale: 'ca',
      currentTime: circumstances.contacts.max.time,
      horizonProfile,
    });

    expect(calls.filter((call) => call.startsWith('fillText')).length).toBeGreaterThan(5);
    expect(calls.filter((call) => call.startsWith('arc')).length).toBeGreaterThan(0);
    expect(dashes.every((pattern) => pattern.length === 0)).toBe(true);
  });
});

describe('nom del fitxer', () => {
  test('surt sense accents, sense espais i acabat en .png', () => {
    expect(cardFileName('Peníscola', PLACE, 'ca')).toBe('eclipsi-peniscola.png');
    expect(cardFileName('Coll de Nargó', PLACE, 'ca')).toBe('eclipsi-coll-de-nargo.png');
  });

  test('sense nom, les coordenades', () => {
    expect(cardFileName(null, PLACE, 'ca')).toBe('eclipsi-41-760-2-470.png');
  });

  test('un nom que no deixa cap caràcter aprofitable no genera un nom trencat', () => {
    expect(cardFileName('···', PLACE, 'ca')).toBe('eclipsi.png');
  });

  test('la targeta té la mida que els previsualitzadors no retallen', () => {
    expect(CARD_WIDTH).toBe(1200);
    expect(CARD_HEIGHT).toBe(630);
  });
});
