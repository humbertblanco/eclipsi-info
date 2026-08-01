/**
 * Mides d'icona del sistema, en píxels.
 *
 * PER QUÈ AQUEST FITXER EXISTEIX: la regla del projecte és que cap mida
 * s'escriu a pèl, i les mides han de sortir dels tokens de `src/styles/tokens/`.
 * Amb les icones no es pot complir literalment: `Icon` rep la mida com a
 * atribut `width`/`height` de l'SVG, i un atribut d'SVG no accepta `var(--sp-6)`
 * — el navegador el descarta i la icona surt a 0 px.
 *
 * La sortida honesta és aquesta: un únic lloc, amb els valors CLAVATS als
 * tokens d'espaiat corresponents. Si algun dia canvia `--sp-6`, es canvia aquí
 * i prou, i no a les cinquanta crides repartides per l'app.
 */

/** Igual a --sp-4 (12 px). Només dins d'insígnies i etiquetes. */
export const ICON_XS = 12;

/** Igual a --sp-5 (16 px). Icones dins de botons petits i files denses. */
export const ICON_SM = 16;

/** Igual a --sp-6 (20 px). Mida per defecte de la barra de pestanyes. */
export const ICON_MD = 20;

/** Igual a --sp-7 (24 px). Icones d'acció i de la barra superior. */
export const ICON_LG = 24;
