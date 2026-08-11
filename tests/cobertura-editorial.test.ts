/**
 * CAP MITJÀ DE LA LLISTA POT SORTIR SENSE LOGOTIP, I CAP LOGOTIP POT SER UNA TAPA.
 *
 * PER QUÈ EXISTEIX AQUEST FITXER. Perquè el bloc de cobertura editorial estava
 * fet exactament amb la forma d'error que aquest projecte ja s'ha trobat quatre
 * vegades: una cosa construïda a sobre d'una altra que ningú no havia comparat
 * mai amb res. El `logo` de cada fila era una cadena —`'vilaweb.svg'`— que no
 * havia tocat el disc en cap moment, ni en compilar ni en provar. Una lletra de
 * més i el navegador no diu res: pinta la targeta amb la seva vora, el seu botó
 * i un forat al mig on hi hauria d'haver la marca. És el mini-mapa transparent
 * una altra vegada, amb tretze ocasions de repetir-lo en comptes d'una.
 *
 * ── LES DUES DIRECCIONS ─────────────────────────────────────────────────────
 *
 * Es demanen les dues perquè les llistes d'aquesta mena es podreixen pels dos
 * cantons i no fan soroll per cap:
 *
 *   · CAP FILA SENSE FITXER. És el forat a la targeta.
 *   · CAP FITXER SENSE FILA. És pes mort al paquet publicat: el dia que una
 *     peça caigui de la llista, el seu logotip es quedarà a `public/` i es
 *     baixarà per sempre sense que el demani ningú.
 *
 * ── LA TAPA, QUE ÉS LA PART QUE NO ES VEU VENIR ─────────────────────────────
 *
 * `.about__mentionlogo` pinta amb `grayscale(1) brightness(0) invert(1)`. El
 * filtre no distingeix marques de fons: EMBLANQUINA TOT EL QUE SIGUI OPAC. Un
 * logotip que arribi amb el seu paper —o amb el seu quadrat de marca— no surt
 * blanc sobre el fons fosc, surt un RECTANGLE BLANC dins de la targeta, amb les
 * lletres desaparegudes perquè també són blanques.
 *
 * NO ÉS HIPOTÈTIC: va passar amb els dos logotips de l'11 d'agost de 2026. El
 * de RAC1 porta un `<path d="M0,0h500v500H0"/>` de fons negre —és així com el
 * publica la ràdio— i el de Vilapress es publica sobre paper (254,254,254). Els
 * dos van donar un rectangle blanc a la primera passada, i els dos es van haver
 * de corregir abans d'entrar (vegeu `src/features/about/mentions.ts`).
 *
 * Per això aquí es mira la TINTA, cadascuna com es pot mirar:
 *
 *   · Als PNG, la fracció de píxels opacs. Una silueta no passa del 41 %; una
 *     tapa hi arriba a 1,00. El tall és 0,75, ben lluny de les dues coses.
 *   · Als SVG no hi ha píxels, i per tant es busca la forma que faria de tapa:
 *     una figura que ompli la caixa de dibuix sencera i estigui feta només de
 *     línies rectes d'eix. Cap lletra és això —una lletra porta corbes o
 *     diagonals—, i un fons de marca sempre ho és.
 *
 * ── QUÈ NO VIGILA, DIT PERQUÈ CONSTI ────────────────────────────────────────
 *
 * Que l'enllaç sigui viu i que la peça parli de nosaltres. Això vol sortir a
 * demanar bytes a tretze mitjans cada vegada que algú corri la bateria, i una
 * prova que depèn de la xarxa és una prova que es desactiva el primer dia que
 * un servidor va lent. Es comprova a mà quan s'hi afegeix una fila.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { MEDIA_MENTIONS } from '../src/features/about/mentions';
import { pixelsPng } from './imatges';

const here = dirname(fileURLToPath(import.meta.url));
const LOGOS = join(here, '..', 'public', 'press', 'media-logos');

/** Per sobre d'això, el que hi ha a la caixa és una tapa i no una marca. */
const MAX_FRACCIO_OPACA = 0.75;

/**
 * Si una figura d'un SVG és el rectangle que tapa la caixa de dibuix sencera.
 *
 * ES DEMANEN TRES COSES ALHORA, i cap de les tres per separat vol dir res:
 *
 *   · CAP CORBA. Una C, una S, una Q, una T o una A ja diu que allò és un
 *     dibuix i no una tapa.
 *   · UN SOL TRAÇAT DE QUATRE CANTONADES com a molt. Aquest és el criteri que
 *     de debò separa les dues coses, i el vam haver d'aprendre a la primera
 *     passada: la M de `metadata.svg` és una lletra feta NOMÉS de rectes, amb
 *     dotze traçats, i ocupa la caixa de dalt a baix. Sense comptar els vèrtexs,
 *     aquesta prova la declarava un fons de marca.
 *   · QUE OMPLI LA CAIXA. El fons de RAC1 era `M0,0h500v500H0` amb la caixa
 *     `0 0 500 500`: un traçat, quatre vèrtexs, tota la superfície.
 */
function esTapa(d: string, ampleCaixa: number, altCaixa: number): boolean {
  if (/[csqta]/i.test(d)) return false;
  if ((d.match(/[Mm]/g) ?? []).length !== 1) return false;

  let vertexs = 0;
  let x = 0;
  let y = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let vist = false;

  for (const tros of d.matchAll(/([MLHVZmlhvz])([^MLHVZmlhvz]*)/g)) {
    const ordre = tros[1];
    const nombres = (tros[2].match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
    const relatiu = ordre === ordre.toLowerCase();

    if (ordre === 'Z' || ordre === 'z') continue;
    if (ordre === 'H' || ordre === 'h') {
      for (const n of nombres) {
        x = relatiu ? x + n : n;
        vertexs++;
      }
    } else if (ordre === 'V' || ordre === 'v') {
      for (const n of nombres) {
        y = relatiu ? y + n : n;
        vertexs++;
      }
    } else {
      for (let i = 0; i + 1 < nombres.length; i += 2) {
        x = relatiu ? x + nombres[i] : nombres[i];
        y = relatiu ? y + nombres[i + 1] : nombres[i + 1];
        vertexs++;
      }
    }

    vist = true;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (!vist || vertexs > 5) return false;
  // El 99 % deixa passar l'arrodoniment de qui hagi escrit la caixa a mà.
  return (maxX - minX) >= ampleCaixa * 0.99 && (maxY - minY) >= altCaixa * 0.99;
}

/* ── Les proves ──────────────────────────────────────────────────────────── */

describe('la cobertura editorial', () => {
  it('cada mitjà de la llista té el seu fitxer de logotip al disc', () => {
    const alDisc = new Set(readdirSync(LOGOS));
    for (const mention of MEDIA_MENTIONS) {
      expect(alDisc, `${mention.name} demana ${mention.logo}, que no hi és`).toContain(
        mention.logo,
      );
    }
  });

  it('no hi ha cap logotip al paquet que no demani cap mitjà', () => {
    const demanats = new Set(MEDIA_MENTIONS.map((m) => m.logo));
    for (const fitxer of readdirSync(LOGOS)) {
      expect(demanats, `${fitxer} es publica i no el demana ningú`).toContain(fitxer);
    }
  });

  it('no hi ha cap mitjà, cap enllaç ni cap logotip repetit', () => {
    // Dues files amb el mateix logotip vol dir que algú ha copiat una fila i
    // se n'ha descuidat un camp, i el resultat és una targeta amb la marca
    // equivocada — que és pitjor que no tenir-la.
    for (const camp of ['name', 'url', 'logo'] as const) {
      const valors = MEDIA_MENTIONS.map((m) => m[camp]);
      expect(new Set(valors).size, `hi ha ${camp} repetits`).toBe(valors.length);
    }
  });

  it('cada enllaç és una adreça absoluta i segura', () => {
    for (const mention of MEDIA_MENTIONS) {
      // Un enllaç relatiu obriria una pàgina nostra que no existeix, i un http
      // trencaria el cadenat de la barra a la pantalla que promet privacitat.
      expect(mention.url, mention.name).toMatch(/^https:\/\//);
      expect(() => new URL(mention.url)).not.toThrow();
    }
  });

  it('la primera fila és la que fa de portada, i n’hi ha exactament una', () => {
    // `.about__mention--lead` es dona per índex 0 i ocupa tota l'amplada: si
    // la llista es queda buida, el bloc surt amb títol i sense res a sota.
    expect(MEDIA_MENTIONS.length).toBeGreaterThan(1);
  });

  /*
   * SENSE AQUESTES DUES LÍNIES, LA PROVA DE SOTA NO PROVA RES.
   *
   * Tretze logotips que passen un detector és exactament el que passaria si el
   * detector tornés `false` sempre —i durant una estona ho va fer al revés, va
   * declarar tapa la M de MetaData—, o sigui que el verd de sota no diu si el
   * criteri funciona. Aquí hi ha els dos casos de debò, amb la geometria tal
   * com va arribar: el fons que RAC1 incrusta al seu logotip, que ha de ser
   * tapa, i una lletra recta que ocupa tota la caixa, que no.
   */
  it('el detector caça la tapa de debò i no confon una lletra recta amb un fons', () => {
    expect(esTapa('M0,0h500v500H0', 500, 500), 'el fons negre de RAC1').toBe(true);
    const eme = readFileSync(join(LOGOS, 'metadata.svg'), 'utf8');
    const primera = /<path\b[^>]*\bd="([^"]*)"/.exec(eme)?.[1] ?? '';
    expect(primera, 'la M de MetaData ha de ser al fitxer').not.toBe('');
    expect(esTapa(primera, 780, 109), 'la M de MetaData és una lletra').toBe(false);
  });

  describe('cap logotip no és una tapa que el filtre emblanquini sencera', () => {
    for (const mention of MEDIA_MENTIONS) {
      it(`${mention.name} — ${mention.logo}`, () => {
        const cami = join(LOGOS, mention.logo);

        if (extname(mention.logo) === '.png') {
          const { width, height, pixels } = pixelsPng(readFileSync(cami));
          let opacs = 0;
          for (let i = 3; i < pixels.length; i += 4) if (pixels[i] >= 250) opacs++;
          const fraccio = opacs / (width * height);
          expect(fraccio, 'la tinta omple la caixa: això és un fons, no una marca').toBeLessThan(
            MAX_FRACCIO_OPACA,
          );
          // I que hi hagi tinta: un PNG tot transparent passaria el tall de
          // dalt amb un 0,00 i sortiria com una targeta buida.
          expect(fraccio, 'no hi ha ni un píxel opac').toBeGreaterThan(0);
          return;
        }

        const svg = readFileSync(cami, 'utf8');
        // Fora `<defs>`: el rectangle de retall d'El Periódico hi viu, i un
        // `clipPath` no pinta res.
        const dibuix = svg.replace(/<defs\b[\s\S]*?<\/defs>/g, '');
        const caixa = /viewBox="([^"]*)"/.exec(svg)?.[1];
        expect(caixa, 'un SVG sense viewBox no escala enlloc').toBeDefined();
        const [, , ample, alt] = caixa!.trim().split(/[\s,]+/).map(Number);

        for (const rect of dibuix.matchAll(/<rect\b[^>]*>/g)) {
          const w = Number(/\bwidth="([\d.]+)"/.exec(rect[0])?.[1] ?? 0);
          const h = Number(/\bheight="([\d.]+)"/.exec(rect[0])?.[1] ?? 0);
          expect(
            w >= ample * 0.99 && h >= alt * 0.99,
            `${rect[0]} tapa la caixa sencera`,
          ).toBe(false);
        }

        for (const path of dibuix.matchAll(/<path\b[^>]*\bd="([^"]*)"/g)) {
          expect(
            esTapa(path[1], ample, alt),
            'hi ha una figura recta que omple la caixa: és un fons de marca',
          ).toBe(false);
        }
      });
    }
  });
});
