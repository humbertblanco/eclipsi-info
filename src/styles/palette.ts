/**
 * La paleta del sistema de disseny, llegible des d'un canvas.
 *
 * EL PROBLEMA QUE RESOL. El CSS pot dir `var(--accent)`; un canvas no. Els
 * renderitzadors necessiten cadenes de color de debò, i per això havien anat
 * acumulant literals: noranta colors hexadecimals i noranta-dos `rgba()`
 * escrits a mà, repartits entre cinc fitxers. El resultat és que la part de
 * l'app que la persona mira de veritat —el cel simulat, el recorregut, la
 * superposició de la càmera— era justament la que quedava fora del sistema.
 * Hi havia blau de Tailwind al costat del blau del sistema, i tres accents
 * càlids competint quan la regla n'admet un.
 *
 * COM ES RESOL. Els tokens es llegeixen UNA vegada de les variables CSS de
 * l'arrel del document i es passen als renderitzadors com a dades. Així:
 *
 *  · el sistema de disseny segueix sent l'única font de veritat, i canviar un
 *    token canvia també els llenços;
 *  · els mòduls de render segueixen sense dependre del DOM, perquè reben la
 *    paleta en comptes d'anar-la a buscar;
 *  · es poden provar amb una paleta sintètica.
 *
 * Es llegeix un sol cop perquè `getComputedStyle` obliga el navegador a
 * recalcular estils, i fer-ho a seixanta fotogrames per segon costaria més que
 * dibuixar.
 */

export interface Palette {
  /* Superfícies */
  bgPage: string;
  bgInset: string;
  surfaceCard: string;
  borderHairline: string;
  borderSubtle: string;

  /* Text */
  textPrimary: string;
  textBody: string;
  textSecondary: string;
  textMuted: string;

  /* L'accent, que és un i prou */
  accent: string;
  accentHover: string;
  sun200: string;
  sun400: string;

  /* Semàntics de visibilitat: la dada central del producte */
  statusClear: string;
  statusPartial: string;
  statusCloudy: string;
  statusDanger: string;
  statusInfo: string;

  /* Tipografia per a `ctx.font` */
  fontMono: string;
  fontBody: string;
}

/**
 * Valors de reserva.
 *
 * Han de coincidir amb `src/styles/tokens/colors.css`. Només s'usen fora del
 * navegador —tests i workers—, on no hi ha document del qual llegir. Si algun
 * dia divergeixen, el que mana és el CSS: aquí no es decideix res.
 */
const FALLBACK: Palette = {
  bgPage: '#05060B',
  bgInset: '#04050A',
  surfaceCard: '#121623',
  borderHairline: 'rgba(201,209,226,.10)',
  borderSubtle: 'rgba(201,209,226,.16)',

  textPrimary: '#FBF8F1',
  textBody: '#C9D1E2',
  textSecondary: '#9AA5BC',
  textMuted: '#6E7A94',

  accent: '#FFA51F',
  accentHover: '#FFC257',
  sun200: '#FFE0A8',
  sun400: '#FFC257',

  statusClear: '#2FD3A3',
  statusPartial: '#FFA51F',
  statusCloudy: '#6E7A94',
  statusDanger: '#FF5A45',
  statusInfo: '#4FA8E8',

  fontMono: "'IBM Plex Mono', ui-monospace, monospace",
  fontBody: "'IBM Plex Sans', system-ui, sans-serif",
};

/** Correspondència entre els camps de la paleta i els tokens del sistema. */
const TOKENS: Record<keyof Palette, string> = {
  bgPage: '--bg-page',
  bgInset: '--bg-inset',
  surfaceCard: '--surface-card',
  borderHairline: '--border-hairline',
  borderSubtle: '--border-subtle',

  textPrimary: '--text-primary',
  textBody: '--text-body',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',

  accent: '--accent',
  accentHover: '--accent-hover',
  sun200: '--sun-200',
  sun400: '--sun-400',

  statusClear: '--status-clear',
  statusPartial: '--status-partial',
  statusCloudy: '--status-cloudy',
  statusDanger: '--status-danger',
  statusInfo: '--status-info',

  fontMono: '--font-mono',
  fontBody: '--font-body',
};

let cached: Palette | null = null;

/**
 * La paleta viva del document, o la de reserva si no hi ha document.
 *
 * El resultat es memoritza. Si mai s'afegeix canvi de tema en calent, caldrà
 * invalidar-lo amb `resetPalette()`.
 */
export function readPalette(): Palette {
  if (cached) return cached;

  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
    cached = FALLBACK;
    return cached;
  }

  const style = getComputedStyle(document.documentElement);
  const out = { ...FALLBACK };

  for (const key of Object.keys(TOKENS) as Array<keyof Palette>) {
    const value = style.getPropertyValue(TOKENS[key]).trim();
    if (value) out[key] = value;
  }

  cached = out;
  return cached;
}

export function resetPalette(): void {
  cached = null;
}

/**
 * Un color de la paleta amb una opacitat donada.
 *
 * Els renderitzadors necessiten sovint la mateixa tinta a mitja transparència
 * —una vora suau, una traça esmorteïda— i escriure-la a mà torna a treure-la
 * del sistema. Accepta hexadecimal de 3 o 6 dígits i `rgb()`/`rgba()`, que és
 * el que poden retornar els tokens.
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));

  const hex = color.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    const h = hex[1];
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const r = Number.parseInt(full.slice(0, 2), 16);
    const g = Number.parseInt(full.slice(2, 4), 16);
    const b = Number.parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  const rgb = color.trim().match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(/[,\s/]+/).filter(Boolean);
    const [r, g, b] = parts;
    return `rgba(${r},${g},${b},${a})`;
  }

  // Nom de color o funció que no sabem desmuntar: es retorna tal qual. Val més
  // perdre la transparència que pintar res.
  return color;
}

/** Cadena per a `ctx.font` amb la tipografia i les mides del sistema. */
export function canvasFont(
  palette: Palette,
  sizePx: number,
  options: { weight?: number; mono?: boolean } = {},
): string {
  const { weight = 400, mono = true } = options;
  return `${weight} ${sizePx}px ${mono ? palette.fontMono : palette.fontBody}`;
}
