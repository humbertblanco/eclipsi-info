/**
 * EL PEU DE LA FOTO, HI CAP O S'ESTRENY? La primera prova que ho pot respondre.
 *
 * PER QUÈ EXISTEIX. `composeCapture()` pinta el peu amb
 * `ctx.fillText(caption, x, y, maxW)` i el quart argument NO RETALLA: CONDENSA.
 * El 12-8-2026 es va descobrir que el peu que es cremava a les fotos
 * compartides sortia esclafat al 87 % en castellà amb topònims llargs, i que
 * ningú no ho podia veure: `tests/dom-setup.ts` anul·lava `getContext()` i el
 * codi de pintar no s'executava mai. Es va escurçar el peu i es va mesurar a
 * mà en un navegador —les cinc xifres són a la capçalera de `caption.ts`—, però
 * la bateria seguia sense poder-hi dir res. Això és el que hi diu.
 *
 * QUÈ COMPARA AMB LA REALITAT, que és la pregunta que mana en aquest projecte:
 *
 *   · LA GEOMETRIA no la calcula aquesta prova: la hi diu `composeCapture()`.
 *     El cos de lletra i la `maxW` surten del quadern de `canvas-apuntador.ts`,
 *     apuntats de la crida de debò. Si algú toca `captionBarHeight()` o el
 *     0,38 del cos, això se n'assabenta; una prova que se'ls recalculés a la
 *     seva panxa no se n'assabentaria mai.
 *
 *   · EL TEXT tampoc: el fa `captureCaption()` amb el topònim que redacta
 *     `describePlace()` i les dates que formata `screens/format.ts`. És la
 *     mateixa cadena de muntatge que fa servir `SkyScreen`.
 *
 *   · L'AMPLADA la dona `tests/amplada-de-text.ts` llegint una font de debò, i
 *     la seva primera prova aquí és contra les cinc amplades que un navegador
 *     va donar el 12-8-2026. Un regle que no s'hagi comparat mai amb res és
 *     exactament el problema que aquest fitxer ve a tancar.
 *
 * QUÈ HA SORTIT DE MESURAR-HO, i és per això que el fitxer acaba amb un
 * `it.fails()`: el peu escurçat hi cap al marc que es va mesurar a mà —una
 * sortida de 810 × 1440, proporció 9:16— i NO hi cap al mòbil d'avui. Amb la
 * vista de 390 × 844 que `capture.test.ts` ja fa servir, el pressupost baixa de
 * 24,4 ems a 20,0 i «a 3,1 km de Valls · 12.08.2026 · 20:29 · eclipsi.info»
 * torna a sortir al 86 %: el mateix esclafament que el canvi d'aquest matí
 * venia a treure, en el cas que més es donarà —el del camp, on el geocodificador
 * diu «a X km de …» en comptes del nom sol.
 *
 * QUÈ SEGUEIX SENSE PODER-SE PROVAR, i val més dir-ho que amagar-ho: el peu es
 * pinta amb `system-ui`, que no és cap font d'aquest repositori —és SF Pro,
 * Roboto o Segoe UI segons l'aparell— i aquí es mesura amb IBM Plex Sans
 * Medium, que és la que l'app publica i el mateix gruix. Contra les cinc
 * mesures del navegador surt entre un 5,1 % i un 6,6 % MÉS AMPLA, sempre cap al
 * mateix costat. Per això aquí no hi ha cap veredicte que es jugui per menys
 * d'un 7 %: tots els «hi cap» i tots els «no hi cap» d'aquest fitxer ho són per
 * un marge més gran que la diferència entre les dues fonts. Tampoc no es prova
 * res de l'alçada del text, ni del color, ni de com queda cap píxel.
 *
 * PER QUÈ ÉS UN `.test.tsx` SENSE GENS DE JSX: perquè `composeCapture()` fa
 * `document.createElement('canvas')` i la meitat `nucli` de `vitest.config.ts`
 * corre a Node pelat. El criteri d'aquell fitxer és «qui necessita un DOM va a
 * la meitat vista», i aquesta prova en necessita un.
 */

import { describe, expect, it } from 'vitest';

import { composeCapture } from './capture';
import { captureCaption } from './caption';
import { describePlace } from '../../core/places';
import type { PlaceName } from '../../core/places';
import type { Locale } from '../../i18n';
import { formatClockShort, formatDateShort } from '../../screens/format';
import { instalaCanvasApuntador } from '../../../tests/canvas-apuntador';
import { ampladaPx } from '../../../tests/amplada-de-text';

/* ------------------------------------------------------------------ marcs */

/**
 * Un marc = el que la càmera dona + el que ocupa la vista a la pantalla.
 *
 * La sortida de `composeCapture()` té SEMPRE les proporcions de la vista
 * (`capture.test.ts`: «les proporcions del retall són les del marc, sempre»), i
 * és aquesta proporció la que decideix quant de peu hi cap: la barra creix amb
 * l'ALÇADA (5,5 %) i l'espai per al text creix amb l'AMPLADA. Com més estreta i
 * alta és la vista, menys peu hi cap. No és un detall: és el motiu pel qual les
 * dues geometries d'aquí sota no donen la mateixa resposta.
 */
interface Marc {
  nom: string;
  /** El flux de la càmera, en píxels de sensor. */
  video: { w: number; h: number };
  /** La vista de RA a la pantalla, en píxels CSS. */
  vista: { w: number; h: number };
}

/**
 * El marc que la capçalera de `caption.ts` va mesurar: sortida de 810 × 1440.
 *
 * Surt d'una vista de 9:16 amb un flux de 1440 línies. La xifra que mana és la
 * SORTIDA —que és l'única cosa que `composeCapture()` mira— i aquesta és la que
 * dona la barra de 79, el cos de 30 i la `maxW` de 731 que la capçalera
 * anuncia; la prova de sota ho comprova en comptes de creure-s'ho.
 */
const MARC_CAPCALERA: Marc = {
  nom: 'el de la capçalera (sortida 810 × 1440)',
  video: { w: 2560, h: 1440 },
  vista: { w: 405, h: 720 },
};

/**
 * El mòbil de debò: la vista de 390 × 844 que `capture.test.ts` ja fa servir
 * (un iPhone d'aquests anys) amb un flux de 1080p, que és el que dona la
 * càmera d'un mòbil sense demanar-li res.
 *
 * ÉS MÉS ESTRET QUE EL DE LA CAPÇALERA I NO PER POC: 9:16 és 0,5625 i aquest és
 * 0,462. La barra es menja el 5,5 % d'una alçada més gran mentre l'amplada
 * disponible és menor, i el pressupost del peu passa de 24,4 a 20,0 ems.
 */
const MARC_MOBIL: Marc = {
  nom: 'el mòbil de capture.test.ts (vista 390 × 844, flux 1080p)',
  video: { w: 1920, h: 1080 },
  vista: { w: 390, h: 844 },
};

/* ------------------------------------------------------------- la maquinària */

/** El que s'ha pintat de debò, tal com ha quedat apuntat. */
interface PeuPintat {
  text: string;
  /** Cos de lletra en píxels, tret del `ctx.font` que hi havia a la crida. */
  cosPx: number;
  /** El quart argument de `fillText`: no retalla, condensa. */
  maxW: number;
  /** Amplada que aquest text demana amb la font de proves. */
  amplada: number;
  /** Alçada de la barra i mida de la sortida, per si algú les vol mirar. */
  barra: number;
  sortida: { w: number; h: number };
}

/** «500 30px system-ui, sans-serif» → 30. */
function cosDe(font: string): number {
  const trobat = /(\d+(?:\.\d+)?)px/.exec(font);
  if (trobat === null) throw new Error(`no hi ha cap cos de lletra a «${font}»`);
  return Number(trobat[1]);
}

/**
 * Fa la captura de debò i torna el que se n'ha apuntat.
 *
 * El vídeo és un element de jsdom amb les mides posades a mà: `videoWidth` i
 * `videoHeight` són de només lectura i jsdom les dona a zero, que és
 * precisament el cas que `composeCapture()` rebutja.
 */
function pinta(caption: string, marc: Marc): PeuPintat {
  const instalat = instalaCanvasApuntador();
  try {
    const video = document.createElement('video');
    Object.defineProperty(video, 'videoWidth', { value: marc.video.w });
    Object.defineProperty(video, 'videoHeight', { value: marc.video.h });

    const overlay = document.createElement('canvas');
    overlay.width = marc.vista.w * 2;
    overlay.height = marc.vista.h * 2;

    const composada = composeCapture(
      video,
      overlay,
      { width: marc.vista.w, height: marc.vista.h, focalPx: marc.vista.w },
      /* El filtre de l'eclipsi i la claror no toquen el peu, però es passen com
         els passa `ARView` perquè el camí sigui el de debò. */
      'brightness(0.35) saturate(0.7)',
      0.35,
      caption,
    );
    if (composada === null) throw new Error('composeCapture() no ha compost res');

    /* Un sol llenç nou per captura: si algun dia n'hi ha dos, això vol dir que
       el peu i la imatge s'han separat i aquesta prova mira el llenç que no és. */
    expect(instalat.contextos).toHaveLength(1);
    const crida = instalat.darrer().unicaCrida('fillText');
    const [text, , , maxW] = crida.args as [string, number, number, number];
    const cosPx = cosDe(crida.estat.font);

    return {
      text,
      cosPx,
      maxW,
      amplada: ampladaPx(text, cosPx),
      /* `maxW` és `outW − barra` i el llenç fa `outW` d'ample: la resta dona
         l'alçada de la barra sense haver de recalcular-la pel nostre compte. */
      barra: composada.width - maxW,
      sortida: { w: composada.width, h: composada.height },
    };
  } finally {
    instalat.restaura();
  }
}

/* --------------------------------------------------------------- els textos */

/**
 * Un resultat de geocodificació inversa, muntat a mà però amb la forma de debò.
 *
 * Els noms dels nuclis arriben de Photon amb `lang: 'default'`
 * (`core/places/photon.ts`), o sigui EN LA LLENGUA DEL LLOC: «Soria» és «Soria»
 * en les quatre llengües de l'app. El que canvia entre llengües no és el
 * topònim, és la redacció que hi posa `describePlace()` al voltant.
 */
function geocodificat(nom: string, precision: 'at' | 'near', km: number): PlaceName {
  return {
    settlement: {
      name: nom,
      rank: 'town',
      lat: 41.766,
      lon: -2.479,
      county: null,
      state: null,
      countryCode: 'es',
      osmId: null,
    },
    distanceKm: km,
    edgeDistanceKm: km,
    precision,
    region: null,
    queriedLat: 41.766,
    queriedLon: -2.479,
    fetchedAtMs: 0,
    cached: false,
  };
}

/** L'instant de la totalitat a la península, que és el que durà la foto. */
const MAXIM = new Date('2026-08-12T18:29:00Z');

/**
 * La zona es fixa a Europe/Madrid a posta. L'app fa servir la de l'aparell
 * (`format.ts` explica per què), però una prova que canviés de resultat segons
 * on corre no mesuraria el peu: mesuraria la màquina.
 */
const ZONA = 'Europe/Madrid';

const LLENGUES: readonly Locale[] = ['ca', 'es', 'en', 'fr'];

/** El peu tal com el munta `SkyScreen`, per a un lloc i una llengua. */
function peuDe(lloc: PlaceName | null, locale: Locale): string {
  return captureCaption({
    placeLabel: lloc === null ? null : (describePlace(lloc, locale)?.primary ?? null),
    date: formatDateShort(MAXIM, locale, ZONA),
    clock: formatClockShort(MAXIM, locale, ZONA),
  });
}

/* ------------------------------------------------------------------ proves */

describe('el regle de mesurar text', () => {
  /**
   * LES CINC AMPLADES QUE UN NAVEGADOR VA DONAR EL 12-8-2026, tal com les
   * escriu la capçalera de `caption.ts`, amb la geometria del marc de la
   * capçalera (cos 30, `maxW` 731).
   *
   * La segona línia d'aquella taula va escurçada amb punts suspensius; el text
   * sencer és el que hi ha aquí. Que doni el mateix desviament que les altres
   * quatre és el que diu que la reconstrucció és bona i no una conjectura.
   */
  const DEL_NAVEGADOR: readonly [string, number][] = [
    ["Eclipsi total del 12 d'agost de 2026 · Sòria · 20:29", 650],
    ['Eclipse total del 12 de agosto de 2026 · a 3,1 km de Valls · 20:29', 841],
    [
      'Eclipse total del 12 de agosto de 2026 · a 3,1 km de Valls · 20:29 · eclipsi.info',
      1002,
    ],
    ['Sòria · 12.08.2026 · 20:29 · eclipsi.info', 508],
    ['a 3,1 km de Valls · 12.08.2026 · 20:29 · eclipsi.info', 656],
  ];

  it('erra sempre cap al mateix costat: més ample, mai més estret', () => {
    // Si algun dia això es posa vermell, el que ha canviat és la font de proves
    // (una versió nova de fontsource) i el que s'ha de revisar és si el marge
    // del 7 % que aquest fitxer es dona segueix cobrint la diferència.
    for (const [text, navegador] of DEL_NAVEGADOR) {
      const meva = ampladaPx(text, 30);
      expect(meva, text).toBeGreaterThan(navegador);
      expect(meva / navegador, text).toBeLessThan(1.07);
    }
    expect(DEL_NAVEGADOR).toHaveLength(5);
  });

  it('dona el mateix veredicte que el navegador a les cinc', () => {
    // El veredicte és l'única cosa que aquest fitxer li demana al regle: dels
    // 731 px de `maxW`, dos d'aquells textos se'n sortien i tres hi cabien.
    const MAX_W = 731;
    const meus = DEL_NAVEGADOR.map(([text]) => ampladaPx(text, 30) <= MAX_W);
    const seus = DEL_NAVEGADOR.map(([, px]) => px <= MAX_W);
    expect(meus).toEqual(seus);
    expect(seus).toEqual([true, false, false, true, true]);
  });

  it('no mesura el que no pot: un caràcter que la font no té peta', () => {
    // Sense això, un topònim amb un caràcter fora del subconjunt llatí —un nom
    // en grec, posem— comptaria zero i faria cabre el que no hi cap.
    expect(() => ampladaPx('Θεσσαλονίκη', 30)).toThrow(/no és a IBM Plex Sans/);
  });
});

describe('el peu que es crema a la foto', () => {
  it('la geometria que la capçalera anuncia és la que fa el codi', () => {
    // La capçalera de `caption.ts` diu «810 × 1440, que dona una barra de 79 px
    // i una font de 30, on `maxW` és 731». Ningú no ho havia tornat a mirar
    // des que es va escriure.
    const peu = pinta(peuDe(geocodificat('Sòria', 'at', 0.4), 'ca'), MARC_CAPCALERA);
    expect(peu.sortida).toEqual({ w: 810, h: 1440 + 79 });
    expect(peu.barra).toBe(79);
    expect(peu.cosPx).toBe(30);
    expect(peu.maxW).toBe(731);
  });

  it('hi cap sense estrènyer, en les quatre llengües, al marc de la capçalera', () => {
    // El pitjor cas que la capçalera declara: la forma «a X km de …», que és la
    // més llarga de les tres que `describePlace()` redacta, amb el topònim que
    // es va mesurar. La capçalera diu 656 px de 731; aquí surt un 6,6 % més
    // ample i encara hi cap.
    const lloc = geocodificat('Valls', 'near', 3.1);
    let comptades = 0;
    for (const locale of LLENGUES) {
      const peu = pinta(peuDe(lloc, locale), MARC_CAPCALERA);
      expect(peu.amplada, `${locale}: «${peu.text}»`).toBeLessThan(peu.maxW);
      comptades++;
    }
    // Un bucle que no entra passa per verd, i aquí hi ha quatre llengües.
    expect(comptades).toBe(LLENGUES.length);
  });

  it('les quatre llengües fan gairebé la mateixa amplada, i això no és casualitat', () => {
    /*
     * QUÈ ES VA APRENDRE MESURANT-HO. Costa d'endevinar-ho llegint el codi: el
     * topònim ve de Photon amb `lang: 'default'` i no es tradueix mai; la data
     * la donen les quatre llengües en xifres i amb dos dígits («12.08.2026»
     * després del `.replace('/', '.')` de `format.ts`), i l'hora igual, perquè
     * les quatre configuracions regionals demanen `hour12: false`. L'única
     * cosa que canvia de llengua a llengua és la preposició de la forma
     * «a X km de …»: «a», «à» i «from». Dotze caràcters en totes quatre.
     *
     * O sigui que el peu no s'estreny en una llengua i en una altra no: o hi
     * cap en totes quatre o no hi cap en cap. Qui hi afegeixi una llengua amb
     * una altra data o una altra preposició, que torni a mirar aquesta xifra.
     */
    const lloc = geocodificat('Valls', 'near', 3.1);
    const amplades = LLENGUES.map((locale) => pinta(peuDe(lloc, locale), MARC_CAPCALERA).amplada);
    const menor = Math.min(...amplades);
    const major = Math.max(...amplades);
    expect(major / menor).toBeLessThan(1.02);
  });

  it('el peu d’abans no hi cabia, i el regle ho veu', () => {
    /*
     * L'ANTI-MIRALL. Sense aquesta prova, totes les de sobre podrien estar
     * passant amb un regle que digués que sempre hi cap. Aquest és el text
     * EXACTE que es publicava fins al 12-8-2026 amb el format llarg, el que la
     * capçalera de `caption.ts` mesura a 841 px de 731: el 87 % que ningú no
     * podia veure. Es dona a mà i no es reconstrueix amb el codi d'avui perquè
     * aquell format ja no existeix — és arqueologia, com el guardià de
     * `caption.test.ts`.
     */
    const elQueSortia = 'Eclipse total del 12 de agosto de 2026 · a 3,1 km de Valls · 20:29';
    const peu = pinta(elQueSortia, MARC_CAPCALERA);
    expect(peu.amplada).toBeGreaterThan(peu.maxW);
    // Condensat a menys del 90 % de l'amplada que li tocaria: no és un pèl,
    // és el que fa que el peu costi de llegir a la foto que es comparteix.
    expect(peu.maxW / peu.amplada).toBeLessThan(0.9);
  });
});

describe('el marc de la capçalera era el més generós de tots', () => {
  /*
   * AQUESTA ÉS LA TROBALLA D'AQUEST FITXER, i s'escriu sencera perquè queda
   * OBERTA: el peu escurçat encara s'estreny, i força.
   *
   * Les cinc amplades de la capçalera de `caption.ts` es van mesurar amb una
   * sortida de 810 × 1440 —proporció 9:16, la d'un mòbil de fa vuit anys— i amb
   * aquella «hi cap». Amb la vista de 390 × 844 que la prova veïna
   * (`capture.test.ts`) ja fa servir com a mòbil d'avui, la sortida és de
   * 499 × 1080, la barra de 59, el cos de 22 i la `maxW` de 440: el pressupost
   * passa de 24,4 ems a 20,0. Allà on «Sòria · 12.08.2026 · 20:29 ·
   * eclipsi.info» sobrava espai, «a 3,1 km de Valls · …» surt al 86 % — el
   * mateix esclafament que el canvi d'aquest matí venia a treure.
   *
   * Que la barra creixi amb l'ALÇADA (5,5 %) i l'espai per al text amb
   * l'AMPLADA vol dir que com més alt i estret és el mòbil, menys peu hi cap; i
   * els mòbils fa vuit anys que s'allarguen.
   */
  const TOPONIMS = [
    /* Els dos que la capçalera de `caption.ts` va mesurar. */
    'Sòria',
    'Valls',
    /* Reals i de mida ben corrent: un poble de la costa de l'Ebre i un de la
       península islandesa de Snæfellsnes. Que són dins de la franja no és una
       impressió: `computeLocalCircumstances` els dona 84,1 s i 109,8 s de
       totalitat. I cap dels dos és un cas rebuscat pel que fa a la llargada —hi
       ha municipis de la franja amb noms molt més llargs, com «Vandellòs i
       l'Hospitalet de l'Infant», que és el veí de l'Ametlla per la costa. */
    "l'Ametlla de Mar",
    'Grundarfjörður',
  ];

  const MARCS = [MARC_CAPCALERA, MARC_MOBIL];
  const FORMES: ('at' | 'near')[] = ['at', 'near'];

  /** Tots els peus que aquesta app pot arribar a pintar amb aquests topònims. */
  function totsElsPeus(): { que: string; peu: PeuPintat }[] {
    const out: { que: string; peu: PeuPintat }[] = [];
    for (const marc of MARCS) {
      for (const forma of FORMES) {
        for (const nom of TOPONIMS) {
          for (const locale of LLENGUES) {
            const peu = pinta(peuDe(geocodificat(nom, forma, 3.1), locale), marc);
            out.push({ que: `${marc.nom} · ${locale} · «${peu.text}»`, peu });
          }
        }
      }
    }
    return out;
  }

  /**
   * AQUESTA PROVA FALLA AVUI, I ESTÀ BÉ QUE HO FACI.
   *
   * És la mateixa marca que fa servir `tests/golden/circumstances.test.ts` per
   * al criteri de ±2 s dels contactes: `it.fails()` afirma «això peta». Mentre
   * `composeCapture()` confiï el retall a `fillText(…, maxW)` —que condensa en
   * comptes de retallar—, la bateria queda verda i el defecte queda escrit
   * aquí amb els seus números. El dia que algú l'arregli (retallant el text
   * amb punts suspensius, o abaixant el cos de lletra fins que hi càpiga)
   * aquesta prova passarà, `it.fails()` es queixarà que no ha petat, i llavors
   * el que toca és treure la marca i deixar-hi l'asserció de debò.
   *
   * No és una tolerància relaxada: és un recordatori que salta sol.
   */
  it.fails('[PENDENT] cap peu no s’estreny, amb cap topònim ni a cap marc', () => {
    const esclafats = totsElsPeus()
      .filter(({ peu }) => peu.amplada > peu.maxW)
      .map(({ que, peu }) => `${que} → ${((peu.maxW / peu.amplada) * 100).toFixed(0)} %`);
    expect(esclafats).toEqual([]);
  });

  it('deixa constància de què hi cap i què no, marc per marc', () => {
    // El registre de la prova de dalt: si algun dia canvia, el que ha canviat
    // és o el peu o la geometria, i s'ha de tornar a mirar tot plegat.
    const hiCaben = (marc: Marc, forma: 'at' | 'near'): string[] =>
      TOPONIMS.filter((nom) => {
        const peu = pinta(peuDe(geocodificat(nom, forma, 3.1), 'ca'), marc);
        return peu.amplada <= peu.maxW;
      });

    // Amb el nom sol, al marc de la capçalera hi caben tots quatre…
    expect(hiCaben(MARC_CAPCALERA, 'at')).toEqual(TOPONIMS);
    // …i amb «a 3,1 km de …» ja només els dos curts.
    expect(hiCaben(MARC_CAPCALERA, 'near')).toEqual(['Sòria', 'Valls']);

    // Al mòbil d'avui, el nom sol ja només hi cap si és curt…
    expect(hiCaben(MARC_MOBIL, 'at')).toEqual(['Sòria', 'Valls']);
    // …i amb «a 3,1 km de …», que és la forma de tot punt que no sigui dins
    // d'un poble —o sigui, la del camp, que és on es va a veure un eclipsi—,
    // no n'hi cap cap.
    expect(hiCaben(MARC_MOBIL, 'near')).toEqual([]);
  });
});
