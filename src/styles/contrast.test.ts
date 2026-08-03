/**
 * L'auditoria de contrast del sistema, escrita com a prova.
 *
 * ── PER QUÈ AQUEST FITXER EXISTEIX ──────────────────────────────────────────
 *
 * Perquè les ràtios del sistema vivien en comentaris. `colors.css` diu que
 * --slate-400 sobre --surface-card mesura 4,18:1; `ui.css` diu que el gris de
 * núvol es queda a 3,38:1 damunt del seu fons apagat. Un comentari no es pot
 * equivocar en veu alta: quan un token es mou, la frase segueix allà dient el
 * número vell. Aquí aquells mateixos números són ASSERCIONS, i el dia que algú
 * toqui un to, el que fallarà serà una prova i no la vista d'una persona amb
 * poca visió al capvespre.
 *
 * ── EL QUE ES MESURA I EL QUE NO ────────────────────────────────────────────
 *
 * Els fons del mapa NO són tokens: són tessel·les. Els que hi ha aquí es van
 * MESURAR de tessel·les reals de `basemaps.cartocdn.com/dark_all` i del model
 * d'elevació terrarium, passades pel `raster-contrast: 0.08` d'`EclipseMap`,
 * pel relleu ombrejat amb els colors de `layers/hillshade.ts` i pel
 * `blur(18px)` del vidre — que és el que decideix de debò què arriba sota la
 * llegenda, perquè fa mitjana i s'empassa els carrers clars. La procedència de
 * cada número és a `MAP_BACKDROPS`. Si algú canvia el proveïdor de tessel·les,
 * l'exageració del relleu o el radi del desenfocament, aquests valors deixen de
 * valer i s'han de tornar a mesurar: són dades d'una mesura, no constants del
 * sistema, i el comentari de cada un ho ha de dir.
 *
 * ── EL QUE FALLA TAMBÉ ES PROVA ─────────────────────────────────────────────
 *
 * Hi ha combinacions que avui NO passen AA. No es callen ni es marquen com a
 * pendents: es fixa el número que donen, amb el defecte explicat al costat.
 * Quan es corregeixin, la prova saltarà i dirà exactament quina línia de
 * l'informe s'ha quedat vella. Una suite que només afirma el que ja va bé no
 * vigila res.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AA_TEXT,
  AA_UI,
  contrastRatio,
  flatten,
  mergeTokens,
  parseColor,
  parseTokens,
  rasterContrast,
  ratioOn,
  relativeLuminance,
  resolveToken,
  round2,
  tokenColor,
  type Rgba,
} from './contrast';
import { readPalette, withAlpha, type Palette } from './palette';

const here = dirname(fileURLToPath(import.meta.url));
const css = (name: string): string => readFileSync(join(here, 'tokens', name), 'utf8');

/** Els tokens vius del sistema, llegits del disc. */
const TOKENS = mergeTokens(parseTokens(css('colors.css')));
/** L'àmbit clar, que fan servir la fitxa de seguretat i la impressió. */
const DAYLIGHT = mergeTokens(TOKENS, parseTokens(css('colors.css'), '.eclipsi-daylight'));

const color = (name: string, from = TOKENS): Rgba => {
  const value = tokenColor(from, name);
  if (value === null) throw new Error(`El token ${name} no resol a cap color`);
  return value;
};
const literal = (value: string): Rgba => {
  const parsed = parseColor(value);
  if (parsed === null) throw new Error(`No es pot llegir el color ${value}`);
  return parsed;
};
const stack = (...layers: Rgba[]): Rgba => {
  const out = flatten(layers);
  if (out === null) throw new Error('La pila no arrenca amb un color opac');
  return out;
};
/** La ràtio d'una tinta damunt d'una pila, arrodonida com a l'informe. */
const measure = (ink: Rgba, ...backdrop: Rgba[]): number => {
  const r = ratioOn(ink, backdrop);
  if (r === null) throw new Error('La pila no arrenca amb un color opac');
  return round2(r);
};

/* ══════════════════════════════ L'eina ══════════════════════════════════ */

describe('la ràtio de contrast', () => {
  it('els dos extrems de la WCAG', () => {
    const black = literal('#000');
    const white = literal('#fff');
    expect(round2(contrastRatio(black, white))).toBe(21);
    expect(round2(contrastRatio(white, white))).toBe(1);
    expect(relativeLuminance(white)).toBeCloseTo(1, 10);
    expect(relativeLuminance(black)).toBeCloseTo(0, 10);
  });

  it('el gris més fosc que encara passa AA sobre blanc és #767676', () => {
    // El valor de referència de la WCAG: 4,54:1. Un pas més clar (#777777) ja
    // no arriba. Si aquesta prova falla, el que està malament és la
    // linealització sRGB, no el sistema de disseny.
    const white = literal('#FFFFFF');
    expect(round2(contrastRatio(literal('#767676'), white))).toBe(4.54);
    expect(contrastRatio(literal('#777777'), white)).toBeLessThan(AA_TEXT);
  });

  it('la ràtio és simètrica', () => {
    const a = color('--text-body');
    const b = color('--surface-card');
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 12);
  });
});

describe('la lectura de colors', () => {
  it('llegeix les formes que fa servir el sistema', () => {
    expect(parseColor('#FFA51F')).toEqual({ r: 255, g: 165, b: 31, a: 1 });
    expect(parseColor('#fa1')).toEqual({ r: 255, g: 170, b: 17, a: 1 });
    expect(parseColor('rgba(201,209,226,.10)')).toEqual({
      r: 201, g: 209, b: 226, a: 0.1,
    });
    expect(parseColor('rgb(18 22 35 / 62%)')).toEqual({ r: 18, g: 22, b: 35, a: 0.62 });
    expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('no endevina: el que no sap llegir retorna null', () => {
    // Una eina de mesura que improvisa un color és pitjor que una que calla.
    expect(parseColor('rebeccapurple')).toBeNull();
    expect(parseColor('lab(50% 40 59.5)')).toBeNull();
    expect(parseColor('var(--accent)')).toBeNull();
  });

  it('color-mix va premultiplicat: el con de visió de la llegenda', () => {
    // `screens.css` pinta la mostra del con amb
    // `color-mix(in srgb, var(--corona-100) 14%, transparent)`. Sense
    // premultiplicar sortiria un gris fosc opac; el que es pinta és corona amb
    // un 14 % d'alfa, i la diferència a la ràtio és de més de quatre punts.
    const mixed = literal('color-mix(in srgb, #F5F0E4 14%, transparent)');
    expect(mixed.a).toBeCloseTo(0.14, 6);
    expect(Math.round(mixed.r)).toBe(245);
    expect(Math.round(mixed.g)).toBe(240);
    expect(Math.round(mixed.b)).toBe(228);
  });

  it('la barreja de dos colors opacs cau al mig', () => {
    const half = literal('color-mix(in srgb, #000000 50%, #FFFFFF)');
    expect(Math.round(half.r)).toBe(128);
    expect(half.a).toBe(1);
  });
});

describe('els tokens del sistema', () => {
  it('segueix les cadenes de var() fins al color', () => {
    // --text-muted → --slate-350 → #7D89A2, que són dos salts.
    expect(resolveToken(TOKENS, '--text-muted')).toBe('#7D89A2');
    expect(resolveToken(TOKENS, '--accent')).toBe('#FFA51F');
    expect(resolveToken(TOKENS, '--surface-glass')).toBe('rgba(18,22,35,.62)');
  });

  it('els comentaris no fabriquen tokens fantasma', () => {
    // El comentari de --slate-350 conté «4.18:1» i «5.13:1». Si els comentaris
    // no es traguessin abans de partir per `;` i `:`, això naixerien tokens.
    for (const key of TOKENS.keys()) expect(key).toMatch(/^--[a-z0-9-]+$/);
    expect(TOKENS.has('--slate-350')).toBe(true);
  });

  it('l\'àmbit clar es llegeix a part i no contamina el fosc', () => {
    expect(resolveToken(TOKENS, '--bg-page')).toBe('#05060B');
    expect(resolveToken(DAYLIGHT, '--bg-page')).toBe('#FBF8F1');
  });
});

describe('la paleta de reserva calca els tokens', () => {
  /*
   * AIXÒ JA VA PASSAR I ÉS EL MOTIU DE LA PROVA. `palette.ts` porta una còpia
   * dels tokens per als llenços i els workers, on no hi ha document del qual
   * llegir. Quan --text-muted va pujar de --slate-400 a --slate-350 per passar
   * AA, la còpia es va quedar enrere: el mapa i les targetes compartides
   * seguien pintant el to que no passava, i cap prova en parlava. Fora del
   * navegador `readPalette()` retorna justament aquella còpia, o sigui que
   * comparar-la amb el CSS és comparar les dues fonts de veritat.
   */
  const FIELDS: Array<[keyof Palette, string]> = [
    ['bgPage', '--bg-page'],
    ['bgInset', '--bg-inset'],
    ['surfaceCard', '--surface-card'],
    ['borderHairline', '--border-hairline'],
    ['borderSubtle', '--border-subtle'],
    ['textPrimary', '--text-primary'],
    ['textBody', '--text-body'],
    ['textSecondary', '--text-secondary'],
    ['textMuted', '--text-muted'],
    ['accent', '--accent'],
    ['accentHover', '--accent-hover'],
    ['sun200', '--sun-200'],
    ['sun400', '--sun-400'],
    ['corona100', '--corona-100'],
    ['statusClear', '--status-clear'],
    ['statusPartial', '--status-partial'],
    ['statusCloudy', '--status-cloudy'],
    ['statusDanger', '--status-danger'],
    ['statusInfo', '--status-info'],
  ];

  it.each(FIELDS)('%s diu el mateix que %s', (field, token) => {
    const palette = readPalette();
    expect(parseColor(palette[field])).toEqual(color(token));
  });
});

describe('withAlpha i la composició', () => {
  it('el que retorna withAlpha es pot mesurar', () => {
    // És el pont entre els llenços i aquesta eina: `hillshade.ts` pinta la llum
    // del relleu amb `withAlpha(palette.corona100, 0.32)`, i si aquí no es
    // pogués llegir, la capa que més canvia el fons del mapa quedaria fora de
    // l'auditoria.
    const glow = literal(withAlpha('#F5F0E4', 0.32));
    expect(glow).toEqual({ r: 245, g: 240, b: 228, a: 0.32 });
    expect(literal(withAlpha('rgba(201,209,226,.10)', 0.5)).a).toBe(0.5);
  });

  it('el negre al 50 % sobre blanc dona el gris del mig', () => {
    const composed = stack(literal('#FFFFFF'), literal('rgba(0,0,0,.5)'));
    expect(Math.round(composed.r)).toBe(128);
  });

  it('una pila que no arrenca opaca no té resposta', () => {
    // Suposar negre a sota seria fer passar el vidre per AA sense saber què hi
    // ha, que és exactament l'error que aquesta eina ha d'impedir.
    expect(flatten([literal('rgba(0,0,0,.5)')])).toBeNull();
    expect(ratioOn(color('--text-muted'), [color('--surface-glass')])).toBeNull();
  });
});

/* ═══════════════════════ Els números que ja hi eren ═════════════════════ */

describe('les ràtios que el sistema té escrites als comentaris', () => {
  const CARD = color('--surface-card');
  const CARD_HOVER = color('--surface-card-hover');

  it('--slate-400 sobre --surface-card: els 4,18:1 que van justificar --slate-350', () => {
    expect(measure(color('--slate-400'), CARD)).toBe(4.18);
  });

  it('--slate-350 (=--text-muted) passa AA a les dues superfícies', () => {
    expect(measure(color('--text-muted'), CARD)).toBe(5.13);
    expect(measure(color('--text-muted'), CARD_HOVER)).toBe(4.55);
  });

  it('--slate-300 (=--text-secondary) es manté un graó per damunt', () => {
    expect(measure(color('--text-secondary'), CARD)).toBe(7.28);
  });

  it('la insígnia de núvol: per què el text no és --status-cloudy', () => {
    // `ui.css` diu 3,38:1 i 5,87:1 aproximant el compost per #232937. El
    // compost exacte és #232837, un pèl més fosc, i per això aquí surten 3,41 i
    // 5,93. La conclusió no canvia: --status-cloudy no arriba a AA i --slate-300
    // sí, amb prou marge.
    const quiet = color('--status-cloudy-quiet');
    expect(measure(color('--status-cloudy'), CARD, quiet)).toBe(3.41);
    expect(measure(color('--slate-300'), CARD, quiet)).toBe(5.93);
  });
});

/* ════════════════════ Els fons del mapa, mesurats ═══════════════════════ */

/**
 * El que hi ha sota el vidre, mesurat i no suposat.
 *
 * Cada valor és el PUNT MÉS CLAR d'una tessel·la real després de la cadena
 * sencera: `raster-contrast: 0.08` → relleu ombrejat (exageració 0,6, llum de
 * l'azimut del Sol) → franja ambre al 16 % → `blur(18px)` del vidre. El
 * desenfocament és la part que la intuïció es menja: el píxel més clar d'una
 * tessel·la de CARTO és #444444, i després de la mitjana no en queda res
 * (#1E1E1E al pitjor cas mesurat). El que SÍ que sobreviu al desenfocament és
 * el que ocupa àrea: el relleu d'un massís i el farciment de la franja.
 */
const MAP_BACKDROPS = {
  /** Cartografia sola. z6 sobre Ibèria, la tessel·la amb més topònims. */
  bare: literal('#1E1E1E'),
  /** z9 Pirineu amb relleu encès i el Sol a 290°. */
  relief: literal('#2F3233'),
  /** z12 Pirineu: relleu + franja. El pitjor fons mesurat de tots. */
  worst: literal('#564A35'),
} as const;

describe('les tessel·les crues i el que en fa el mapa', () => {
  it('el píxel més clar de CARTO dark s\'enfosqueix amb el raster-contrast', () => {
    // 0,08 de contrast fa factor 1/0,92: els tons foscos baixen. O sigui que
    // aquell 0,08 posat per fer destacar la franja també AJUDA el cromatge
    // clar, i convé tenir-ho comptat.
    const brightest = literal('#444444');
    const painted = rasterContrast(brightest, 0.08);
    expect(Math.round(painted.r)).toBe(63); // #3F3F3F
    expect(relativeLuminance(painted)).toBeLessThan(relativeLuminance(brightest));
  });
});

/* ═════════════════════════ L'auditoria pròpiament ═══════════════════════ */

describe('text sobre targeta', () => {
  const CARD = color('--surface-card');
  it.each([
    ['--text-primary', 17],
    ['--text-body', 11.76],
    ['--text-secondary', 7.28],
    ['--text-muted', 5.13],
    ['--text-accent', 11.25],
  ])('%s passa AA sobre --surface-card (%s:1)', (token, expected) => {
    const r = measure(color(token), CARD);
    expect(r).toBe(expected);
    expect(r).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('text sobre vidre, amb el mapa mesurat a sota', () => {
  const GLASS = color('--surface-glass');

  it('la llegenda (--text-secondary, 14 px) passa AA amb i sense relleu', () => {
    expect(measure(color('--text-secondary'), MAP_BACKDROPS.bare, GLASS)).toBe(7.09);
    expect(measure(color('--text-secondary'), MAP_BACKDROPS.relief, GLASS)).toBe(6.53);
    expect(measure(color('--text-secondary'), MAP_BACKDROPS.worst, GLASS)).toBe(5.78);
  });

  it('--text-primary i --text-body no s\'acosten mai al llindar', () => {
    for (const bg of Object.values(MAP_BACKDROPS)) {
      expect(measure(color('--text-primary'), bg, GLASS)).toBeGreaterThan(13);
      expect(measure(color('--text-body'), bg, GLASS)).toBeGreaterThan(9);
    }
  });

  it('DEFECTE: --text-muted cau per sota d\'AA quan s\'encén el relleu', () => {
    /*
     * És el text de la DESCRIPCIÓ dels interruptors del plafó de capes
     * (`.ui-switch__desc`, 14 px) i el text apagat de la fitxa flotant. Sobre
     * la cartografia sola aguanta; amb el relleu encès i la franja a sota, no.
     * El culpable no és el to —passa 5,13:1 sobre targeta— sinó el vidre: el
     * 62 % d'opacitat deixa passar prou llum del relleu per pujar el fons.
     */
    expect(measure(color('--text-muted'), MAP_BACKDROPS.bare, GLASS)).toBe(4.99);
    expect(measure(color('--text-muted'), MAP_BACKDROPS.relief, GLASS)).toBe(4.6);
    const worst = measure(color('--text-muted'), MAP_BACKDROPS.worst, GLASS);
    expect(worst).toBe(4.07);
    expect(worst).toBeLessThan(AA_TEXT);
  });
});

describe('les insígnies d\'estat sobre el seu fons apagat', () => {
  const CARD = color('--surface-card');
  const GLASS = color('--surface-glass');

  // Text de 11 px en majúscules (--text-overline): text normal, 4,5:1.
  it.each([
    ['clear', '--status-clear', '--status-clear-quiet', 7.24],
    ['partial', '--status-partial', '--status-partial-quiet', 7.12],
    ['cloudy', '--slate-300', '--status-cloudy-quiet', 5.93],
    ['danger', '--status-danger', '--status-danger-quiet', 4.95],
    ['info', '--status-info', '--status-info-quiet', 5.57],
    ['neutral', '--text-secondary', '--border-hairline', 5.88],
  ])('%s passa AA sobre targeta (%s → %s:1)', (_name, ink, quiet, expected) => {
    const r = measure(color(ink), CARD, color(quiet));
    expect(r).toBe(expected);
    expect(r).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('DEFECTE: sobre la fitxa de vidre del mapa, danger i info no arriben', () => {
    /*
     * Al mòbil `.mapscreen__sheet` és una targeta de vidre que sura damunt del
     * mapa, i les insígnies de `MapScreen` hi viuen. Amb el relleu i la franja
     * a sota, el fons apagat de la insígnia ja no descansa sobre #121623 sinó
     * sobre #2C2A2A: --status-danger (el vermell d'alerta, que és justament el
     * que no es pot perdre) es queda a 3,87:1.
     */
    const danger = measure(
      color('--status-danger'), MAP_BACKDROPS.worst, GLASS, color('--status-danger-quiet'),
    );
    const info = measure(
      color('--status-info'), MAP_BACKDROPS.worst, GLASS, color('--status-info-quiet'),
    );
    expect(danger).toBe(3.87);
    expect(info).toBe(4.38);
    expect(danger).toBeLessThan(AA_TEXT);
    expect(info).toBeLessThan(AA_TEXT);
  });

  it('a --bp-split la fitxa deixa de ser de vidre i tot torna a passar', () => {
    // `screens.css` la torna `--surface-card` a l'escriptori. Val la pena
    // deixar-ho provat: és la raó per la qual el defecte és només de mòbil.
    expect(
      measure(color('--status-danger'), CARD, color('--status-danger-quiet')),
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('la llegenda del mapa: les mostres són objectes gràfics (3:1)', () => {
  const GLASS = color('--surface-glass');
  const CORONA = color('--corona-100');
  const on = (ink: Rgba, bg: Rgba): number => measure(ink, stack(bg, GLASS));

  it('la vora de la franja i la línia central es veuen sempre', () => {
    for (const bg of Object.values(MAP_BACKDROPS)) {
      expect(on(color('--accent'), bg)).toBeGreaterThanOrEqual(AA_UI);
      expect(on(CORONA, bg)).toBeGreaterThanOrEqual(AA_UI);
      expect(on({ ...CORONA, a: 0.55 }, bg)).toBeGreaterThanOrEqual(AA_UI);
    }
    expect(on(color('--accent'), MAP_BACKDROPS.worst)).toBe(7.26);
    expect(on(CORONA, MAP_BACKDROPS.worst)).toBe(12.58);
  });

  it('DEFECTE: els farciments de les mostres no es distingeixen del plafó', () => {
    /*
     * `.mapscreen__swatch` és --accent-quiet (ambre al 14 %) dins d'una vora
     * ambre, i `.mapscreen__swatch--cone` és corona al 14 % dins d'una vora
     * corona al 55 %. Els farciments no arriben ni a 1,6:1 contra el vidre.
     * NO és un incompliment per si sol —la VORA de cada mostra sí que passa i
     * és la que la fa identificable—, però vol dir que la mostra de la franja i
     * la del con es distingeixen entre elles NOMÉS pel to de la vora, i sobre
     * un fons que canvia. Qui no distingeixi ambre de crema veu dos rectangles
     * iguals.
     */
    expect(on(color('--accent-quiet'), MAP_BACKDROPS.worst)).toBe(1.32);
    expect(on({ ...CORONA, a: 0.14 }, MAP_BACKDROPS.worst)).toBe(1.51);
    const bandEdge = stack(MAP_BACKDROPS.worst, GLASS, color('--accent'));
    const coneEdge = stack(MAP_BACKDROPS.worst, GLASS, { ...CORONA, a: 0.55 });
    expect(round2(contrastRatio(bandEdge, coneEdge))).toBe(1.48);
  });
});

describe('el plafó de capes', () => {
  const GLASS = color('--surface-glass');

  it('l\'etiqueta de l\'interruptor passa AA a tot arreu', () => {
    for (const bg of Object.values(MAP_BACKDROPS)) {
      expect(measure(color('--text-primary'), bg, GLASS)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('els interruptors: encès i apagat es distingeixen', () => {
    // La regla de l'ambre únic obliga aquest plafó a encendre en to corona.
    // El que no es pot perdre pel camí és que l'estat es llegeixi: la via
    // encesa i l'apagada s'han de separar 3:1 l'una de l'altra.
    const on = stack(MAP_BACKDROPS.relief, GLASS, color('--corona-100'));
    const off = stack(MAP_BACKDROPS.relief, GLASS, color('--ink-600'));
    expect(round2(contrastRatio(on, off))).toBeGreaterThanOrEqual(AA_UI);
    // I el botó clar sobre la via apagada, que és el que es veu de reüll.
    expect(measure(color('--mist-200'), off)).toBeGreaterThanOrEqual(AA_UI);
  });

  it('DEFECTE: la via apagada no es distingeix del plafó', () => {
    /*
     * --ink-600 (#2A3247) damunt del vidre és pràcticament el mateix valor que
     * el vidre. Amb el relleu encès, 1,14:1. La conseqüència concreta: un
     * interruptor apagat, a les fosques, és un botó clar surant sense via —no
     * es llegeix com un interruptor, i per tant no es llegeix com una cosa que
     * es pugui encendre.
     */
    expect(measure(color('--ink-600'), MAP_BACKDROPS.relief, GLASS)).toBe(1.27);
    expect(measure(color('--ink-600'), MAP_BACKDROPS.worst, GLASS)).toBe(1.12);
  });

  it('DEFECTE: la vora del plafó no el separa del mapa', () => {
    /*
     * `--border-subtle` és blanc al 16 %: damunt d'un mapa clar el compost de
     * la vora coincideix amb el mapa. Amb el pitjor fons mesurat, 1,11:1 — o
     * sigui que el plafó de vidre no té contorn i el seu límit el marca només
     * la diferència de valor amb el mapa, que és d'1,65:1.
     */
    const edge = stack(MAP_BACKDROPS.worst, GLASS, color('--border-subtle'));
    const inside = stack(MAP_BACKDROPS.worst, GLASS);
    expect(round2(contrastRatio(edge, MAP_BACKDROPS.worst))).toBe(1.11);
    expect(round2(contrastRatio(inside, MAP_BACKDROPS.worst))).toBe(1.65);
  });
});

describe('l\'anell de focus damunt del mapa', () => {
  it('el doble anell garanteix el contrast vingui el fons que vingui', () => {
    /*
     * `--ring-focus` són dos anells: 2 px de --bg-page i 2 px de --sun-400. El
     * de dins és quasi negre i el de fora és ambre, i entre ells hi ha 12,63:1
     * SEMPRE, perquè cap dels dos depèn del fons. Per això aquest indicador es
     * pot donar per bo damunt d'una cartografia viva: encara que l'anell ambre
     * s'acosti al color del mapa, la vora interna segueix marcant-lo.
     */
    const inner = color('--bg-page');
    const outer = color('--focus-ring');
    expect(round2(contrastRatio(outer, inner))).toBe(12.63);
    expect(round2(contrastRatio(outer, inner))).toBeGreaterThanOrEqual(AA_UI);
    // I contra el pitjor mapa mesurat, l'anell ambre encara hi destaca sol.
    expect(round2(contrastRatio(outer, MAP_BACKDROPS.worst))).toBe(5.4);
  });
});

describe('el remei: vidre opac quan el sistema el demana', () => {
  /*
   * La proposta de `prefers-reduced-transparency` i `prefers-contrast` és
   * substituir --surface-glass per una superfície OPACA i treure el
   * desenfocament. Aquí es comprova que el remei cura de debò les combinacions
   * que fallen, i amb quin marge; si algú tria una altra superfície, aquesta
   * prova dirà si aguanta.
   */
  const OPAQUE = color('--ink-900');

  it('amb el vidre opac, tot el que fallava passa', () => {
    expect(measure(color('--text-muted'), OPAQUE)).toBe(5.55);
    expect(
      measure(color('--status-danger'), OPAQUE, color('--status-danger-quiet')),
    ).toBe(5.46);
    expect(measure(color('--status-info'), OPAQUE, color('--status-info-quiet'))).toBe(6.22);
    for (const r of [
      measure(color('--text-muted'), OPAQUE),
      measure(color('--status-danger'), OPAQUE, color('--status-danger-quiet')),
      measure(color('--status-info'), OPAQUE, color('--status-info-quiet')),
    ]) {
      expect(r).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('i el plafó passa a tenir contorn contra el mapa', () => {
    // Una vora de --mist-200 opaca contra el pitjor fons mesurat.
    const edge = color('--mist-200');
    expect(round2(contrastRatio(edge, MAP_BACKDROPS.worst))).toBe(5.65);
    expect(round2(contrastRatio(edge, MAP_BACKDROPS.worst))).toBeGreaterThanOrEqual(AA_UI);
    // I ATENCIÓ: la superfície opaca SOLA no arriba a 3:1 contra el pitjor
    // fons mesurat (2,26:1). O sigui que fer el vidre opac no basta per donar
    // contorn al plafó: la vora clara no és decoració, és la que el separa.
    expect(round2(contrastRatio(OPAQUE, MAP_BACKDROPS.worst))).toBe(2.26);
    expect(round2(contrastRatio(OPAQUE, MAP_BACKDROPS.worst))).toBeLessThan(AA_UI);
  });

  it('cap vora d\'un sol color pot garantir 3:1 contra un mapa viu', () => {
    /*
     * --mist-200 al 42 % és el mínim que dona 3:1 damunt de la targeta, i
     * damunt del pitjor fons de mapa mesurat es queda a 1,35:1 — perquè el
     * compost i el mapa hi tenen, per casualitat, la mateixa lluminància. No
     * és mala sort: sobre un fons que pot ser QUALSEVOL color, cap color sol
     * no té resposta.
     */
    const edge = stack(OPAQUE, literal('rgba(201,209,226,.42)'));
    expect(round2(contrastRatio(edge, MAP_BACKDROPS.worst))).toBe(1.35);
  });

  it('la vora doble sí que la garanteix, i es pot demostrar', () => {
    /*
     * EL MATEIX TRUC QUE JA FA `--ring-focus`: dos anells d'un píxel, un clar i
     * un de fosc. Si els dos es separen R:1 entre ells, contra QUALSEVOL fons
     * el millor dels dos mesura com a mínim √R — perquè les dues ràtios,
     * multiplicades, no poden baixar de R. Amb --mist-200 i --bg-page, R val
     * 13,21 i l'arrel val 3,63: per damunt del 3:1 que demana la WCAG, vingui
     * la cartografia que vingui. La prova ho recorre gris per gris en comptes
     * de creure's l'àlgebra.
     */
    const light = color('--mist-200');
    const dark = color('--bg-page');
    const between = contrastRatio(light, dark);
    expect(round2(between)).toBe(13.21);

    let worstOfTheBest = Infinity;
    for (let v = 0; v <= 255; v += 1) {
      const backdrop: Rgba = { r: v, g: v, b: v, a: 1 };
      const best = Math.max(
        contrastRatio(light, backdrop),
        contrastRatio(dark, backdrop),
      );
      worstOfTheBest = Math.min(worstOfTheBest, best);
    }
    expect(worstOfTheBest).toBeGreaterThanOrEqual(Math.sqrt(between) - 1e-9);
    expect(worstOfTheBest).toBeGreaterThanOrEqual(AA_UI);
    expect(round2(worstOfTheBest)).toBe(3.64);
  });
});

describe('l\'àmbit clar, que és el de la fitxa de seguretat i la impressió', () => {
  /*
   * `.eclipsi-daylight` es va quedar fora de la revisió que va crear
   * --slate-350. Val la pena mirar-s'ho perquè aquest àmbit no és decoració:
   * és el que fa servir la FITXA DE SEGURETAT, el document que diu com no
   * quedar-se cec mirant el Sol, i el que surt per la impressora.
   */
  const WHITE_CARD = color('--surface-card', DAYLIGHT);

  it('el text principal, el cos i el secundari van sobrats', () => {
    expect(measure(color('--text-primary', DAYLIGHT), WHITE_CARD)).toBe(20.24);
    expect(measure(color('--text-body', DAYLIGHT), WHITE_CARD)).toBe(16.01);
    expect(measure(color('--text-secondary', DAYLIGHT), WHITE_CARD)).toBe(7.11);
  });

  it('DEFECTE: --text-muted no arriba a AA a l\'àmbit clar', () => {
    // --slate-400 sobre blanc. És el mateix to que a l'àmbit fosc es va
    // considerar insuficient i es va substituir per --slate-350; aquí encara
    // hi és, i sobre blanc mesura encara menys que allà.
    const r = measure(color('--text-muted', DAYLIGHT), WHITE_CARD);
    expect(r).toBe(4.31);
    expect(r).toBeLessThan(AA_TEXT);
  });

  it('DEFECTE GREU: --text-link de l\'àmbit clar es queda a 2,73:1', () => {
    /*
     * --sun-600 (#E8830A) sobre blanc. És --text-accent I --text-link alhora:
     * els vincles de la fitxa de seguretat. No arriba ni al 3:1 dels elements
     * d'interfície, i el subratllat que porta tot vincle en deriva («35 % de
     * l'accent»), o sigui que tampoc no el salva.
     */
    const r = measure(color('--text-accent', DAYLIGHT), WHITE_CARD);
    expect(r).toBe(2.73);
    expect(r).toBeLessThan(AA_UI);
  });
});
