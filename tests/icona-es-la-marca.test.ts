/**
 * La icona que publiquem és la mitja lluna de la marca, i no una figura
 * qualsevol.
 *
 * PER QUÈ EXISTEIX AQUEST FITXER, amb tota la història perquè no es repeteixi.
 *
 * Durant setmanes Google va pintar a la SERP d'eclipsi.info el llamp lila de la
 * plantilla de Vite. Es va revisar tot: les icones es servien amb 200 i amb el
 * checksum del repositori, les 1.605 pàgines les declaraven, `/vite.svg` feia
 * 301. Tot correcte. I la pregunta que ningú no s'havia fet era una altra:
 *
 *     QUÈ COMPARA LA ICONA QUE PUBLIQUEM AMB LA MARCA?
 *
 * La resposta era «res». `actius-binaris.test.ts` mesura els PNG per
 * lluminositat (màxim, mitjana, desviació) i llença el color a la línia on
 * calcula la luma; dels SVG només en llegeix el MARCATGE amb expressions
 * regulars —`formesPintades()` no rasteritza mai res— i `favicon.ico` no
 * s'obria: era una cadena dins d'una llista.
 *
 * Traduït: **un llamp lila de 48×48 amb prou contrast passava totes i cadascuna
 * de les proves d'aquest projecte.** No hi havia cap error a corregir; hi havia
 * una comprovació que no existia, que és pitjor, perquè no fa soroll.
 *
 * QUÈ VIGILA, I PER QUÈ AIXÒ I NO ALTRA COSA:
 *
 *  · QUE EL `.ico` SIGUI LA MATEIXA IMATGE que `favicon-48.png`. És el camí que
 *    els cercadors miren per defecte i el que entenen els clients vells. Es
 *    descodifica de debò —vegeu `tests/imatges.ts` per les tres trampes del
 *    format— perquè comparar només les mides deixaria passar una icona del
 *    revés o amb els colors intercanviats, i totes dues coses continuen
 *    semblant una mitja lluna.
 *  · QUE LA MITJA LLUNA SIGUI UNA MITJA LLUNA. La marca es construeix sempre
 *    igual: un cercle clar i un altre que l'oculta, desplaçat amunt i a la
 *    dreta i una mica més petit. Si el cercle que es pinta deixa de calcar el
 *    de la màscara, el dibuix i el retall se separen i surt qualsevol cosa.
 *  · QUE EL COLOR SIGUI EL DE LA MARCA, llegit de `readPalette()` i no escrit a
 *    mà aquí (regla 3 del CLAUDE.md). Els PNG del favicon han de ser ambre de
 *    debò: és el tall que un llamp lila no passa de cap manera.
 *  · QUE LES RUTES QUE EL MÓN DEMANA SENSE LLEGIR L'HTML segueixin cobertes.
 *
 * L'excepció, dita perquè consti: `app-icons/icon.svg` NO és una mitja lluna i
 * no ha de ser-ho. És l'eclipsi vist de cara —corona i disc— per a la pantalla
 * d'inici, on la icona es veu gran i la silueta fina desapareixeria. Té la seva
 * pròpia comprovació més avall en comptes de forçar-la a un motlle que no és
 * el seu.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPalette } from '../src/styles/palette';
import { pixelsIco, pixelsPng } from './imatges';

const ROOT = join(import.meta.dirname, '..');
const PUBLIC = join(ROOT, 'public');

const palette = readPalette();

/* ── Llegir cercles d'un SVG ─────────────────────────────────────────────── */

interface Cercle {
  cx: number;
  cy: number;
  r: number;
  fill: string;
}

function cercles(svg: string): Cercle[] {
  const out: Cercle[] = [];
  for (const tag of svg.match(/<circle\b[^>]*>/g) ?? []) {
    const num = (name: string): number => Number(new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? NaN);
    out.push({
      cx: num('cx'),
      cy: num('cy'),
      r: num('r'),
      fill: /\bfill="([^"]*)"/.exec(tag)?.[1] ?? '',
    });
  }
  return out;
}

/** El contingut del primer `<mask>`, que és on viu el retall de la marca. */
function mascara(svg: string): string {
  return /<mask\b[^>]*>([\s\S]*?)<\/mask>/.exec(svg)?.[1] ?? '';
}

/** Tot el que queda fora de `<defs>`: el dibuix de debò. */
function foraDeDefs(svg: string): string {
  return svg.replace(/<defs\b[\s\S]*?<\/defs>/g, '');
}

/**
 * Els fitxers que porten la mitja lluna, i el color que se'ls exigeix.
 *
 * `fill: null` vol dir que aquell fitxer canvia el color a posta i el que se li
 * exigeix és només la forma: la variant monocroma és per a fons on l'ambre no
 * es llegeix, i la de dia porta l'ambre fosc de `--sun-600` (que viu als tokens
 * del CSS i no a la paleta de reserva, per això aquí no s'hi compara).
 */
const MITGES_LLUNES: { path: string; role: string; fill: string | null }[] = [
  { path: 'favicon.svg', role: 'icona de la pestanya', fill: palette.accent },
  { path: 'brand/favicon.svg', role: 'favicon de marca amb URL pròpia', fill: palette.accent },
  { path: 'brand/logo-mark.svg', role: 'la marca sola', fill: palette.accent },
  { path: 'brand/logo.svg', role: 'logotip amb el nom', fill: palette.accent },
  { path: 'brand/logo-mark-mono.svg', role: 'marca monocroma', fill: palette.corona100 },
  { path: 'brand/logo-daylight.svg', role: 'logotip sobre fons clar', fill: null },
];

describe('la mitja lluna de la marca', () => {
  for (const asset of MITGES_LLUNES) {
    describe(`${asset.path} — ${asset.role}`, () => {
      const source = readFileSync(join(PUBLIC, asset.path), 'utf8');
      const delMask = cercles(mascara(source));
      const pintats = cercles(foraDeDefs(source)).filter((c) => c.fill !== 'none' && c.fill !== '');

      it('es retalla amb dos cercles: el clar i el que l’oculta', () => {
        // Un de blanc (el que es veu) i un de negre (el que se'n menja un tros).
        // Amb un de sol surt un disc ple; amb tres, ja no és la marca.
        expect(delMask).toHaveLength(2);
        expect(delMask[0].fill.toLowerCase()).toBe('#fff');
        expect(delMask[1].fill.toLowerCase()).toBe('#000');
      });

      it('l’ocultador va amunt i a la dreta, i és més petit', () => {
        const [clar, ocultador] = delMask;
        // Aquesta és la mitja lluna creixent de la marca, oberta cap a baix a
        // l'esquerra. Si el desplaçament canvia de signe, la lluna es gira i
        // deixa de ser el nostre logotip encara que segueixi sent una lluna.
        expect(ocultador.cx).toBeGreaterThan(clar.cx);
        expect(ocultador.cy).toBeLessThan(clar.cy);
        expect(ocultador.r).toBeLessThan(clar.r);
        // I no gaire més petit: amb un ocultador massa petit el que surt és un
        // disc mossegat, i amb un de massa gran, un fil.
        expect(ocultador.r).toBeGreaterThan(clar.r * 0.8);
      });

      it('el que es pinta calca el cercle de la màscara', () => {
        // El defecte que això vigila: que algú retoqui el dibuix i s'oblidi de
        // la màscara (o al revés). Se separen sense fer soroll i el resultat és
        // una llesca que no és de ningú.
        const [clar] = delMask;
        const disc = pintats.find((c) => c.r === clar.r);
        expect(disc, 'cap cercle pintat amb el radi de la màscara').toBeDefined();
        expect([disc!.cx, disc!.cy]).toEqual([clar.cx, clar.cy]);
      });

      if (asset.fill !== null) {
        it('va pintada amb el color de la marca', () => {
          const [clar] = delMask;
          const disc = pintats.find((c) => c.r === clar.r)!;
          expect(disc.fill.toUpperCase()).toBe(asset.fill!.toUpperCase());
        });
      }
    });
  }
});

/* ── El contenidor ICO ───────────────────────────────────────────────────── */

describe('favicon.ico — el camí que els cercadors miren per defecte', () => {
  const ico = pixelsIco(readFileSync(join(PUBLIC, 'favicon.ico')));
  const png = pixelsPng(readFileSync(join(PUBLIC, 'favicon-48.png')));

  it('declara una imatge de 48 px, que és el que promet l’HTML', () => {
    // `index.html` diu `sizes="48x48"`, i la documentació de Google demana un
    // quadrat múltiple de 48. Si el contenidor i l'etiqueta discrepen, el
    // cercador tria a cegues.
    expect(ico.entries).toHaveLength(1);
    expect([ico.entries[0].width, ico.entries[0].height]).toEqual([48, 48]);
    expect(ico.entries[0].bitsPerPixel).toBe(32);
  });

  it('porta exactament la mateixa imatge que favicon-48.png', () => {
    // Els dos fitxers són la mateixa icona en dos embolcalls. Si algú en
    // regenera un i no l'altre, el lloc ensenya dues icones diferents segons
    // qui pregunti — i ningú no se n'assabenta, perquè totes dues són vàlides.
    expect([ico.image.width, ico.image.height]).toEqual([png.width, png.height]);
    expect(Buffer.from(ico.image.pixels)).toEqual(Buffer.from(png.pixels));
  });
});

/* ── El color, que és el tall que un llamp no passa ──────────────────────── */

describe('els favicons de píxels són ambre de debò', () => {
  const AMBRE = palette.accent;
  const rgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];

  for (const path of ['favicon-48.png', 'brand/favicon-google-96.png']) {
    it(`${path} té l’ambre de la marca a la immensa majoria de píxels opacs`, () => {
      const { pixels } = pixelsPng(readFileSync(join(PUBLIC, path)));
      const [r, g, b] = rgb(AMBRE);

      let opacs = 0;
      let ambre = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] <= 250) continue;
        opacs++;
        if (pixels[i] === r && pixels[i + 1] === g && pixels[i + 2] === b) ambre++;
      }

      // Mesurat l'11-8-2026: 352 de 354 al de 48, i 1.176 de 1.196 al de 96.
      // El que no arriba a l'ambre exacte és la vora suavitzada, i per això el
      // tall és el 95 % i no el 100 %.
      expect(opacs, 'una icona sense píxels opacs no és una icona').toBeGreaterThan(100);
      expect(ambre / opacs).toBeGreaterThan(0.95);
    });
  }
});

/* ── La icona de la pantalla d'inici, que NO és una mitja lluna ──────────── */

describe('app-icons/icon.svg — l’eclipsi vist de cara', () => {
  const source = readFileSync(join(PUBLIC, 'app-icons', 'icon.svg'), 'utf8');

  it('és el disc sobre el fons del sistema, amb la corona de la marca', () => {
    // Aquesta icona es veu gran i plena; la silueta fina del favicon s'hi
    // perdria. El que se li exigeix és que sigui la nostra: el fons del
    // manifest, el disc centrat i la corona en ambre.
    const manifest = JSON.parse(readFileSync(join(PUBLIC, 'manifest.webmanifest'), 'utf8')) as {
      background_color: string;
    };
    expect(source).toContain(manifest.background_color);
    expect(source.toUpperCase()).toContain(palette.accent.toUpperCase());

    const disc = cercles(foraDeDefs(source));
    expect(disc, 'sense disc no hi ha eclipsi').toHaveLength(1);
    const box = /viewBox="0 0 (\d+) \1"/.exec(source);
    expect(box, 'la icona del manifest ha de ser quadrada').not.toBeNull();
    expect(disc[0].cx).toBe(Number(box![1]) / 2);
    expect(disc[0].cy).toBe(Number(box![1]) / 2);
  });
});

/* ── El que el món demana sense llegir mai l'HTML ────────────────────────── */

describe('les rutes d’icona per convenció', () => {
  const htaccess = readFileSync(join(PUBLIC, '.htaccess'), 'utf8');

  /**
   * Els noms de debò que van demanar els clients, presos dels registres de
   * l'origen de l'11-8-2026 (finestra del 2 a l'11). No són un invent: cadascun
   * va respondre 404 milers de vegades perquè només existia
   * `/app-icons/apple-touch-icon.png`, que és el que declara l'HTML i que
   * aquests clients no arriben a llegir mai.
   */
  const DEMANADES = [
    'apple-touch-icon.png',
    'apple-touch-icon-precomposed.png',
    'apple-touch-icon-120x120.png',
    'apple-touch-icon-120x120-precomposed.png',
    'apple-touch-icon-152x152.png',
    'apple-touch-icon-167x167-precomposed.png',
    'apple-touch-icon-240x240.png',
  ];

  it('la regla cobreix tots els noms que van fer 404 de debò', () => {
    // Es prova la DECISIÓ, no el text: s'agafa el patró que hi ha escrit al
    // fitxer i se li passen els noms reals. Si algú el retoca i en deixa un
    // fora, això suspèn amb el nom del que ha quedat despenjat.
    const regla = /RewriteRule\s+\^(apple-touch-icon[^\s]*)\s+(\S+)/.exec(htaccess);
    expect(regla, 'no hi ha cap regla per a apple-touch-icon').not.toBeNull();

    const patro = new RegExp(`^${regla![1]}`);
    for (const nom of DEMANADES) {
      expect(patro.test(nom), `${nom} es quedaria sense icona`).toBe(true);
    }
  });

  it('la regla apunta a una icona que existeix i no és cap redirecció', () => {
    const regla = /RewriteRule\s+\^apple-touch-icon[^\s]*\s+(\S+)\s*\[([^\]]*)\]/.exec(htaccess)!;
    const desti = regla[1].replace(/^\//, '');
    expect(() => readFileSync(join(PUBLIC, desti))).not.toThrow();
    // iOS no segueix redireccions per a aquest recurs: se'n va amb les mans
    // buides. Ha de ser reescriptura interna, no 301.
    expect(regla[2]).not.toMatch(/R=|redirect/i);
  });

  it('el llamp de Vite continua tenint la seva 301', () => {
    // El senyal més fort que es pot enviar des del servidor: «aquell recurs ara
    // és aquest altre». Si algú neteja el fitxer i se l'endú, tornem al 404,
    // que per a un cercador vol dir «ja tornaré» i es queda amb la còpia vella.
    const regla = /RewriteRule\s+\^vite\\?\.svg\$?\s+(\S+)\s*\[([^\]]*)\]/.exec(htaccess);
    expect(regla, 'ha desaparegut la redirecció de vite.svg').not.toBeNull();
    expect(regla![2]).toMatch(/R=301/);
    expect(() => readFileSync(join(PUBLIC, regla![1].replace(/^\//, '')))).not.toThrow();
  });
});

/* ── Les 1.592 pàgines que es generen ────────────────────────────────────── */

describe('les pàgines editorials declaren les mateixes icones que la portada', () => {
  it('cap plantilla no inventa una ruta d’icona que no existeixi', () => {
    // Les pàgines SEO les escup `build-seo-pages.ts` amb el seu propi `<head>`,
    // separat del d'`index.html`. Són 1.592 documents: si la seva plantilla
    // declarés una icona morta, seria el 99 % del lloc apuntant enlloc, i la
    // prova d'icones declarades —que només mira la portada i la 404— no se
    // n'assabentaria.
    const plantilla = readFileSync(join(ROOT, 'scripts', 'build-seo-pages.ts'), 'utf8');
    const declarades = [...plantilla.matchAll(/<link rel="icon"[^>]*href="([^"]+)"/g)].map((m) => m[1]);

    expect(declarades.length, 'la plantilla editorial no declara cap icona').toBeGreaterThan(0);
    for (const href of declarades) {
      const path = href.replace(/^\//, '');
      expect(() => readFileSync(join(PUBLIC, path)), `${href} no existeix a public/`).not.toThrow();
    }
  });
});
