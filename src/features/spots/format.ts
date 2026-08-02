/**
 * Text de les xifres del cercador.
 *
 * Viu a la capa d'interfície i no al nucli perquè és una decisió d'idioma i de
 * to, no de física. Dues regles que es respecten a tot arreu:
 *
 *  - No s'arrodoneix per fer bonic. Si el motor sap que són 41 segons, es diu
 *    41, no «uns tres quarts de minut». La precisió que es perd aquí no la
 *    recupera ningú.
 *  - Els decimals els decideix la magnitud, no el gust. Un marge d'horitzó té
 *    sentit a la dècima de grau; una distància de conducció, no.
 */

import { compassName } from '../../core/spots/grid';
import type { Locale } from '../../i18n';

/**
 * Espai dur entre la xifra i la unitat.
 *
 * No és un caprici tipogràfic: en una targeta estreta, «1.083» i «m» separats
 * de línia deixen un número orfe al final d'una fila i una unitat sola al
 * principi de la següent. Amb l'espai dur no passa mai. Els tests el
 * comproven, perquè un espai normal aquí és invisible fins que es veu al mòbil.
 */
export const NBSP = '\u00a0';

/**
 * Etiqueta BCP-47 de cada idioma de l'app.
 *
 * Català i castellà escriuen els números igual —punt de milers i coma
 * decimal—, o sigui que això no canvia cap xifra d'aquest fitxer avui. Es fa
 * igualment perquè el dia que entri una tercera llengua, la que sigui,
 * l'alternativa és descobrir-ho amb un «1,083 m» a la pantalla d'algú.
 */
const INTL: Record<Locale, string> = { ca: 'ca-ES', es: 'es-ES' };

const enterFmt: Partial<Record<Locale, Intl.NumberFormat>> = {};
const decimalFmt: Partial<Record<Locale, Intl.NumberFormat>> = {};

/** Enters amb separador de milers. Es memoritza: `Intl` no és barat. */
function enter(locale: Locale): Intl.NumberFormat {
  return (enterFmt[locale] ??= new Intl.NumberFormat(INTL[locale], {
    maximumFractionDigits: 0,
  }));
}

/** Una dècima, sempre. */
function decimal(locale: Locale): Intl.NumberFormat {
  return (decimalFmt[locale] ??= new Intl.NumberFormat(INTL[locale], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }));
}

/**
 * Durada com a `m:ss`.
 *
 * Els segons de totalitat es compten en minuts i segons perquè és com se'n
 * parla: «un minut i quaranta-un». Per sota d'un minut es diu la xifra sola,
 * que és més curta de llegir i no menteix.
 */
export function formatDuration(seconds: number): { value: string; unit: string } {
  if (!Number.isFinite(seconds) || seconds <= 0) return { value: '0', unit: 's' };
  const total = Math.round(seconds);
  if (total < 60) return { value: String(total), unit: 's' };
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return { value: `${minutes}:${String(rest).padStart(2, '0')}`, unit: 'min' };
}

/** Durada en una sola cadena, per posar dins d'una frase. */
export function durationText(seconds: number): string {
  const { value, unit } = formatDuration(seconds);
  return `${value}${NBSP}${unit}`;
}

/**
 * Rumb en paraules: «cap al nord-est», «cap a l’oest-nord-oest».
 *
 * L'article s'apostrofa davant de vocal, i set dels setze rumbs de la rosa
 * catalana en comencen per una. Amb un «cap al» fix, gairebé la meitat de la
 * llista sortiria mal escrita — i una llista mal escrita costa de creure encara
 * que els números siguin bons.
 *
 * En castellà no hi ha apòstrof i els setze rumbs porten el mateix article:
 * «hacia el oeste-noroeste». La regla no és compartida, per això cada idioma té
 * la seva línia i no s'intenta una fórmula única.
 */
export function bearingPhrase(degrees: number, locale: Locale = 'ca'): string {
  const name = compassName(degrees, locale);
  if (locale === 'es') return `hacia el ${name}`;
  return /^[aeiou]/.test(name) ? `cap a l’${name}` : `cap al ${name}`;
}

/** Graus amb una dècima i el signe explícit quan és negatiu. */
export function formatDegrees(value: number, locale: Locale = 'ca'): string {
  if (!Number.isFinite(value)) return '—';
  return `${decimal(locale).format(value)}°`;
}

/**
 * Distància llegible.
 *
 * Per sota d'un quilòmetre es diu en metres: «a 400 m» és una distància que es
 * camina i «a 0,4 km» sona a xifra de full de càlcul.
 */
export function formatDistance(km: number, locale: Locale = 'ca'): string {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${enter(locale).format(Math.round(km * 100) * 10)}${NBSP}m`;
  if (km < 10) return `${decimal(locale).format(km)}${NBSP}km`;
  return `${enter(locale).format(km)}${NBSP}km`;
}

/** Metres, sempre enters: el model del terreny no en sap més. */
export function formatMetres(metres: number, locale: Locale = 'ca'): string {
  if (!Number.isFinite(metres)) return '—';
  return `${enter(locale).format(Math.round(metres))}${NBSP}m`;
}

/**
 * Coordenades amb cinc decimals.
 *
 * Cinc decimals és un metre. És la precisió amb què el cercador treballa i la
 * que s'ha d'ensenyar: retallar-ne un mouria el punt onze metres, que en una
 * carena és la diferència entre veure-ho i no veure-ho.
 */
export function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/** Hora local, amb segons: aquí els segons són tot el tema. */
export function formatClock(timeMs: number, locale: Locale = 'ca'): string {
  if (!Number.isFinite(timeMs)) return '—';
  return new Intl.DateTimeFormat(INTL[locale], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timeMs));
}

/**
 * Enllaç a un mapa.
 *
 * OpenStreetMap i no cap servei de navegació: és la mateixa font oberta que fa
 * servir la resta de l'aplicació, funciona a qualsevol navegador i no obliga
 * ningú a tenir una aplicació concreta instal·lada. Per anar-hi de debò, el que
 * es fa servir són les coordenades — per això es poden copiar amb un botó.
 */
export function mapUrl(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lon.toFixed(
    5,
  )}#map=15/${lat.toFixed(5)}/${lon.toFixed(5)}`;
}

/** Milers amb separador, per als comptadors de cost. */
export function formatCount(value: number, locale: Locale = 'ca'): string {
  if (!Number.isFinite(value)) return '—';
  return enter(locale).format(value);
}

/**
 * Ordres de magnitud entre dos números.
 *
 * El guany de l'embut es diu en vegades i no en percentatge: «1.100 vegades
 * menys» s'entén d'una llambregada i «un 99,91 % menys» no.
 */
export function formatRatio(better: number, worse: number, locale: Locale = 'ca'): string {
  if (!Number.isFinite(better) || !Number.isFinite(worse) || better <= 0) return '—';
  const ratio = worse / better;
  if (ratio < 10) return `${decimal(locale).format(ratio)}×`;
  return `${enter(locale).format(ratio)}×`;
}

/** Mil·lisegons com a segons quan passen del segon. */
export function formatMs(ms: number, locale: Locale = 'ca'): string {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${enter(locale).format(ms)}${NBSP}ms`;
  return `${decimal(locale).format(ms / 1000)}${NBSP}s`;
}

/** Percentatge amb l'espai fi abans del signe, com mana la tipografia catalana. */
export function formatPercent(fraction: number, locale: Locale = 'ca'): string {
  if (!Number.isFinite(fraction)) return '—';
  return `${enter(locale).format(Math.round(fraction * 100))}${NBSP}%`;
}

/**
 * Dades de xarxa.
 *
 * Va amb coma decimal com la resta de xifres de l'aplicació: un «10.1 GB» al
 * costat d'un «5,7 km» delata que algú ha fet servir `toFixed` i trenca la
 * confiança en tota la taula.
 */
export function formatBytes(bytes: number, locale: Locale = 'ca'): string {
  if (!Number.isFinite(bytes)) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${decimal(locale).format(mb / 1024)}${NBSP}GB`;
  if (mb >= 10) return `${enter(locale).format(mb)}${NBSP}MB`;
  return `${decimal(locale).format(mb)}${NBSP}MB`;
}
