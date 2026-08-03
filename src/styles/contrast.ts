/**
 * El contrast del sistema, mesurat en comptes d'afirmat.
 *
 * ── EL PROBLEMA QUE RESOL ───────────────────────────────────────────────────
 *
 * El sistema de disseny ja porta ràtios escrites: `colors.css` diu que
 * --slate-400 sobre --surface-card mesura 4,18:1 i que per això existeix
 * --slate-350, i `ui.css` diu que el gris de núvol sobre el seu fons apagat es
 * queda a 3,38:1. Són números BONS, però es van calcular una vegada, a mà, en
 * una altra finestra, i no els torna a mirar ningú. La capçalera de
 * `palette.ts` explica què passa llavors: --text-muted va pujar de --slate-400
 * a --slate-350 i la còpia de reserva es va quedar enrere. Amb els contrastos
 * passa el mateix, però pitjor, perquè el número és una AFIRMACIÓ dins d'un
 * comentari i no hi ha res que la desmenteixi quan deixa de ser certa.
 *
 * ── LA DECISIÓ: EL CONTRAST ES CALCULA SOBRE UNA PILA OPACA ─────────────────
 *
 * Un color translúcid NO TÉ ràtio. `--surface-glass` és rgba(18,22,35,.62): la
 * pregunta «quant contrasta el text de la llegenda» no té resposta fins que no
 * es diu QUÈ HI HA A SOTA. Per això aquí no hi ha cap funció que prengui dos
 * colors i prou: es prenen PILES, de baix a dalt, amb el fons opac a la base, i
 * es composen amb `source-over` en espai sRGB —que és exactament el que fa el
 * navegador quan pinta una capa translúcida damunt d'una altra.
 *
 * Això és el que fa que l'eina serveixi per al cromatge de vidre del mapa, que
 * és justament el cas que cap comprovador automàtic sap mirar: no hi ha un fons
 * darrere el text, hi ha una cartografia viva.
 *
 * ── EL SOSTRE NO ÉS LA MESURA (honestedat radical) ──────────────────────────
 *
 * `backdrop-filter: blur(18px)` fa MITJANA del que hi ha a sota: el píxel més
 * clar de la tessel·la mai no arriba sencer al vidre. Mesurar contra el píxel
 * més clar dona un SOSTRE, no una mesura del que es veurà. La conseqüència
 * pràctica, que és el que importa:
 *
 *   · si el pitjor cas PASSA, és una garantia: sota el vidre no hi pot haver
 *     res pitjor i el text passa sempre;
 *   · si el pitjor cas FALLA, no vol dir que es vegi malament sempre — vol dir
 *     que hi ha llocs del mapa on es veu malament, i el número dels llocs
 *     concrets s'ha de mesurar amb el fons concret.
 *
 * Qui llegeixi un informe fet amb això ha de saber de quina de les dues coses
 * parla cada línia. Una estimació no es vesteix mai de mesura.
 *
 * ── SENSE DOM ───────────────────────────────────────────────────────────────
 *
 * Els tokens arriben com a TEXT (`parseTokens`), no de `getComputedStyle`: la
 * mateixa disciplina que `src/core/**`, perquè l'eina s'ha de poder executar en
 * un test de Node que llegeix `src/styles/tokens/*.css` del disc. `readPalette()`
 * llegeix el document viu i és per als llenços; això llegeix el fitxer i és per
 * a les proves. Les dues fonts han de dir el mateix, i si divergeixen el test
 * de tokens ho canta.
 */

/** Component RGB en 0–255 amb alfa en 0–1, que és com pinta el navegador. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Llindars de la WCAG 2.2, nivell AA. */
export const AA_TEXT = 4.5;
/** Text gran: ≥24 px, o ≥18,66 px si és negreta. */
export const AA_LARGE = 3;
/** Components d'interfície i objectes gràfics (1.4.11). */
export const AA_UI = 3;
/** Nivell AAA per a text normal. */
export const AAA_TEXT = 7;

/** Què és el que es mesura, que decideix el llindar. */
export type ContrastKind = 'text' | 'large' | 'ui';

const THRESHOLD: Record<ContrastKind, number> = {
  text: AA_TEXT,
  large: AA_LARGE,
  ui: AA_UI,
};

/* ─────────────────────────── Lectura de colors ─────────────────────────── */

const NAMED: Record<string, Rgba> = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
};

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/** `120`, `47%` o `.14` → número en la unitat que toqui. */
function numeric(token: string, scale: number): number | null {
  const t = token.trim();
  if (t.endsWith('%')) {
    const pct = Number.parseFloat(t.slice(0, -1));
    return Number.isFinite(pct) ? (pct / 100) * scale : null;
  }
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Talla per comes respectant els parèntesis.
 *
 * Cal per a `color-mix(in srgb, rgba(1,2,3,.4) 14%, transparent)`: una divisió
 * ingènua per comes parteix l'`rgba()` pel mig i el resultat és silenciosament
 * un altre color, que és la pitjor manera de fallar en una eina de mesura.
 */
function splitTopLevel(input: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i += 1) {
    const c = input[i];
    if (c === '(') depth += 1;
    else if (c === ')') depth -= 1;
    else if (c === ',' && depth === 0) {
      out.push(input.slice(start, i));
      start = i + 1;
    }
  }
  out.push(input.slice(start));
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Un color CSS → components.
 *
 * Cobreix el que el sistema fa servir de debò: hexadecimal de 3, 4, 6 o 8
 * dígits, `rgb()`/`rgba()` amb comes o amb espais i barra, els tres noms que
 * apareixen als tokens, i `color-mix(in srgb, …)` amb dos operands — que és el
 * que hi ha a `base.css` (el subratllat del vincle) i a `screens.css` (la
 * mostra del con de visió). El que no sap llegir retorna `null` en comptes
 * d'endevinar: un color mal entès és una ràtio inventada.
 */
export function parseColor(input: string): Rgba | null {
  const value = input.trim();
  if (value.length === 0) return null;

  const named = NAMED[value.toLowerCase()];
  if (named) return { ...named };

  const hex = value.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hex) {
    const h = hex[1];
    if (h.length === 3 || h.length === 4) {
      const full = h
        .split('')
        .map((c) => c + c)
        .join('');
      return hexToRgba(full);
    }
    if (h.length === 6 || h.length === 8) return hexToRgba(h);
    return null;
  }

  const fn = value.match(/^(rgba?|color-mix)\((.*)\)$/is);
  if (!fn) return null;
  const name = fn[1].toLowerCase();
  const args = fn[2];

  if (name === 'rgb' || name === 'rgba') {
    // `rgb(1 2 3 / 40%)` i `rgba(1,2,3,.4)` són la mateixa cosa escrita de dues
    // maneres, i els tokens del sistema fan servir la segona.
    const parts = args.includes('/')
      ? [...args.split('/')[0].trim().split(/[\s,]+/), args.split('/')[1]]
      : splitTopLevel(args).flatMap((p) => p.split(/\s+/));
    if (parts.length < 3) return null;
    const r = numeric(parts[0], 255);
    const g = numeric(parts[1], 255);
    const b = numeric(parts[2], 255);
    const a = parts.length > 3 ? numeric(parts[3], 1) : 1;
    if (r === null || g === null || b === null || a === null) return null;
    return {
      r: clamp(r, 0, 255),
      g: clamp(g, 0, 255),
      b: clamp(b, 0, 255),
      a: clamp(a, 0, 1),
    };
  }

  return parseColorMix(args);
}

function hexToRgba(h: string): Rgba {
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? Number.parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

/**
 * `color-mix(in srgb, A p%, B q%)`.
 *
 * La barreja va PREMULTIPLICADA, que és el que diu la especificació i el que
 * fa que `color-mix(in srgb, var(--corona-100) 14%, transparent)` doni corona
 * al 14 % d'alfa i no un gris fosc al 100 %. Fer-ho sense premultiplicar és
 * l'error clàssic i dona un color que existeix però no és el que es pinta.
 */
function parseColorMix(args: string): Rgba | null {
  const parts = splitTopLevel(args);
  if (parts.length !== 3) return null;
  if (!/^in\s+srgb$/i.test(parts[0])) return null;

  const read = (spec: string): { color: Rgba; weight: number | null } | null => {
    const m = spec.match(/^(.*?)(?:\s+([0-9.]+)%)?$/s);
    if (!m) return null;
    const color = parseColor(m[1].trim());
    if (color === null) return null;
    return { color, weight: m[2] === undefined ? null : Number.parseFloat(m[2]) / 100 };
  };

  const first = read(parts[1]);
  const second = read(parts[2]);
  if (first === null || second === null) return null;

  let w1 = first.weight;
  let w2 = second.weight;
  if (w1 === null && w2 === null) {
    w1 = 0.5;
    w2 = 0.5;
  } else if (w1 === null) w1 = 1 - (w2 as number);
  else if (w2 === null) w2 = 1 - w1;
  const sum = (w1 as number) + (w2 as number);
  if (sum <= 0) return null;
  const k1 = (w1 as number) / sum;
  const k2 = (w2 as number) / sum;

  const a = first.color.a * k1 + second.color.a * k2;
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (x: 'r' | 'g' | 'b'): number =>
    (first.color[x] * first.color.a * k1 + second.color[x] * second.color.a * k2) / a;
  return { r: mix('r'), g: mix('g'), b: mix('b'), a };
}

/* ─────────────────────────── Tokens del sistema ────────────────────────── */

/** Els tokens d'un bloc de CSS, sense resoldre els `var()`. */
export type TokenMap = ReadonlyMap<string, string>;

/**
 * Llegeix les variables d'un selector d'un full de CSS.
 *
 * Els comentaris es treuen ABANS de res: `colors.css` en porta un que diu
 * «mesura 4.18:1», i els dos punts d'aquella ràtio farien néixer un token
 * fantasma que després es resoldria a un color inventat.
 */
export function parseTokens(css: string, selector = ':root'): Map<string, string> {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Map<string, string>();

  const needle = selector.trim();
  let from = 0;
  for (;;) {
    const at = clean.indexOf(needle, from);
    if (at === -1) break;
    const open = clean.indexOf('{', at);
    if (open === -1) break;
    // Que entre el selector i la clau només hi hagi espais: així `:root` no
    // enganxa `.eclipsi-daylight :root-cosa`.
    if (clean.slice(at + needle.length, open).trim().length > 0) {
      from = at + needle.length;
      continue;
    }
    let depth = 1;
    let i = open + 1;
    while (i < clean.length && depth > 0) {
      if (clean[i] === '{') depth += 1;
      else if (clean[i] === '}') depth -= 1;
      i += 1;
    }
    const body = clean.slice(open + 1, i - 1);
    for (const decl of body.split(';')) {
      const sep = decl.indexOf(':');
      if (sep === -1) continue;
      const key = decl.slice(0, sep).trim();
      if (!key.startsWith('--')) continue;
      out.set(key, decl.slice(sep + 1).trim());
    }
    from = i;
  }
  return out;
}

/** Uneix els mapes de diversos fitxers; l'últim mana, com al CSS. */
export function mergeTokens(...maps: TokenMap[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of maps) for (const [k, v] of m) out.set(k, v);
  return out;
}

/**
 * Segueix la cadena de `var()` fins a un valor literal.
 *
 * El sistema encadena de veritat: `--text-muted` → `--slate-350` → `#7D89A2`.
 * El límit de salts evita quedar-se penjat si algú tanca un cicle.
 */
export function resolveToken(tokens: TokenMap, name: string, hops = 12): string | null {
  // Anotat a posta: sense el tipus, TypeScript no pot inferir `value` dins del
  // bucle que se'l reassigna a si mateix i el dona per `any`.
  let value: string | undefined = tokens.get(name);
  if (value === undefined) return null;
  for (let i = 0; i < hops; i += 1) {
    const m: RegExpMatchArray | null = value
      .trim()
      .match(/^var\(\s*(--[\w-]+)\s*(?:,([\s\S]*))?\)$/);
    if (m === null) return value.trim();
    const next = tokens.get(m[1]);
    if (next === undefined) {
      if (m[2] === undefined) return null;
      value = m[2];
      continue;
    }
    value = next;
  }
  return null;
}

/** El color d'un token del sistema, amb els `var()` ja resolts. */
export function tokenColor(tokens: TokenMap, name: string): Rgba | null {
  const raw = resolveToken(tokens, name);
  return raw === null ? null : parseColor(raw);
}

/* ────────────────────────── Composició i ràtio ─────────────────────────── */

/**
 * `source-over` en espai sRGB: el color de dalt damunt del de sota.
 *
 * Es composa amb els valors TAL COM ESTAN, sense linealitzar. No és un
 * descuit: és el que fa el navegador per a la barreja normal, i linealitzar
 * aquí donaria un compost més clar del que es veu a la pantalla —o sigui, un
 * informe optimista, que és el pitjor error que pot cometre aquesta eina.
 */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (x: 'r' | 'g' | 'b'): number =>
    (top[x] * top.a + bottom[x] * bottom.a * (1 - top.a)) / a;
  return { r: mix('r'), g: mix('g'), b: mix('b'), a };
}

/**
 * Aplana una pila —el primer element és el fons, l'últim el de més amunt— fins
 * a un color opac. Si la base no és opaca, no hi ha resposta: retorna `null` en
 * comptes de suposar negre, perquè suposar negre és precisament la trampa que
 * fa que el vidre sembli que passa AA quan no se sap què hi ha a sota.
 */
export function flatten(stack: readonly Rgba[]): Rgba | null {
  if (stack.length === 0) return null;
  if (stack[0].a < 1) return null;
  let out = stack[0];
  for (let i = 1; i < stack.length; i += 1) out = over(stack[i], out);
  return out;
}

/** Linealització sRGB de la WCAG (§ definició de relative luminance). */
function channel(v: number): number {
  const c = clamp(v, 0, 255) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Lluminància relativa, 0 (negre) a 1 (blanc). */
export function relativeLuminance(color: Rgba): number {
  return (
    0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
  );
}

/** Ràtio de contrast WCAG entre dos colors OPACS. De 1:1 a 21:1. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * La ràtio d'una tinta damunt d'una pila.
 *
 * `ink` pot ser translúcid (un text al 60 % d'opacitat també és una tinta
 * translúcida) i `backdrop` va de baix a dalt amb el fons opac a la base.
 * Retorna `null` si la pila no arrenca opaca, pel mateix motiu que `flatten`.
 */
export function ratioOn(ink: Rgba, backdrop: readonly Rgba[]): number | null {
  const base = flatten(backdrop);
  if (base === null) return null;
  const front = flatten([base, ink]);
  if (front === null) return null;
  return contrastRatio(front, base);
}

/** Passa el llindar AA que li correspon? */
export function passesAA(ratio: number, kind: ContrastKind): boolean {
  return ratio + 1e-9 >= THRESHOLD[kind];
}

/** El llindar que s'aplica a cada cas, per si l'informe l'ha d'escriure. */
export function threshold(kind: ContrastKind): number {
  return THRESHOLD[kind];
}

/** La ràtio arrodonida com s'escriu als informes: dos decimals. */
export function round2(ratio: number): number {
  return Math.round(ratio * 100) / 100;
}

/* ───────────────────── El fons que no és cap token ─────────────────────── */

/**
 * `raster-contrast` de MapLibre, escrit com a funció.
 *
 * VIU AQUÍ I NO A `features/map/` per una raó de mesura: la llegenda de vidre
 * i el plafó de capes no es llegeixen damunt d'un token, es llegeixen damunt
 * de la CARTOGRAFIA, i la cartografia que arriba a la pantalla no és la
 * tessel·la que baixa del servidor —`EclipseMap` li aplica
 * `'raster-contrast': 0.08`. Auditar el vidre contra el píxel cru seria
 * auditar una imatge que ningú no veu.
 *
 * El shader treballa amb els valors sRGB tal com vénen (la capa ràster no fa
 * gestió de color), i el factor és 1/(1−c) per a c positiu. Amb c = 0,08 els
 * tons foscos baixen: #444444 → #3F3F3F. O sigui que aquest 0,08 AJUDA el
 * contrast del cromatge clar, i convé tenir-ho comptat i no de memòria.
 */
export function rasterContrast(color: Rgba, amount: number): Rgba {
  const factor = amount > 0 ? 1 / (1 - amount) : 1 + amount;
  const adjust = (v: number): number => clamp((v / 255 - 0.5) * factor + 0.5, 0, 1) * 255;
  return { r: adjust(color.r), g: adjust(color.g), b: adjust(color.b), a: color.a };
}
