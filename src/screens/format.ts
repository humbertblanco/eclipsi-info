/**
 * Format de les xifres que surten a les pantalles.
 *
 * PER QUÈ VIU AQUÍ I NO A `src/core/`: `src/core/**` no pot dependre del DOM ni
 * de la configuració regional del navegador, i tot això és `Intl`, que és
 * exactament la capa de presentació. Els números els calcula el motor; aquí
 * només es decideix com s'escriuen.
 *
 * REGLA DEL SISTEMA QUE AQUEST FITXER FA COMPLIR: tota xifra és EXACTA. No hi
 * ha cap funció que arrodoneixi a "aproximadament"; quan no se sap una dada, es
 * torna un guió, mai un zero que sembli una mesura.
 */

import type { Locale } from '../i18n';

/** Guió llarg. És el que es pinta quan una dada encara no existeix. */
export const NO_DATA = '—';

const tag = (locale: Locale): string => (locale === 'es' ? 'es-ES' : 'ca-ES');

/**
 * Hora amb segons.
 *
 * PER QUÈ LA ZONA HORÀRIA ÉS LA DEL DISPOSITIU i no `Europe/Madrid` fix: els
 * eclipsis del catàleg també es veuen des de les Canàries, que van una hora
 * enrere. Clavar la zona peninsular faria que a Tenerife tot es llegís amb una
 * hora de més, que és l'error més fàcil de no detectar i el més car de tots.
 * Per això sempre s'ensenya al costat el nom de la zona.
 */
export function formatClock(date: Date, locale: Locale, timeZone?: string): string {
  return new Intl.DateTimeFormat(tag(locale), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone,
  }).format(date);
}

/**
 * Hora sense segons: "20:29".
 *
 * PER A LA LÍNIA DE CONTACTES, on hi ha cinc hores en 390 px d'amplada. Amb
 * segons no hi caben i se solapen; la línia serveix per situar-se, i el segon
 * exacte el dona la taula d'efemèrides, que és on es va a mirar.
 */
export function formatClockShort(date: Date, locale: Locale, timeZone?: string): string {
  return new Intl.DateTimeFormat(tag(locale), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(date);
}

/**
 * Marca de temps compacta per a overlines: "12.08.2026 · 20:29:47".
 *
 * PER QUÈ NO LA DATA LLARGA: el sistema demana que a les overlines la data vagi
 * "mono i curta"; la llarga ocupa dues línies a 390 px i deixa de ser una
 * overline. La data va amb punts i no amb barres perquè és com s'escriu una
 * data numèrica en català i en castellà.
 */
export function formatStamp(date: Date, locale: Locale, timeZone?: string): string {
  const day = new Intl.DateTimeFormat(tag(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone,
  })
    .format(date)
    .replace(/\//g, '.');
  return `${day} · ${formatClock(date, locale, timeZone)}`;
}

/** Data llarga amb hora i nom de zona: "12 d'agost de 2026, 20:29:47 CEST". */
export function formatDateTime(date: Date, locale: Locale, timeZone?: string): string {
  return new Intl.DateTimeFormat(tag(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
    timeZone,
  }).format(date);
}

/**
 * Durada en segons → "1 min 41 s".
 *
 * Els segons no s'arrodoneixen a minuts: la diferència entre 95 i 101 segons de
 * totalitat és el que decideix si val la pena moure's tres quilòmetres.
 */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m} min` : `${m} min ${String(s).padStart(2, '0')} s`;
}

/**
 * Xifra decimal amb COMA.
 *
 * Les dues llengües de l'app escriuen els decimals amb coma, així que el
 * separador no és cap tria d'estil: és l'ortografia. Els decimals els decideix
 * qui crida, perquè «24,3°» d'altura i «24,32°» no diuen el mateix i aquest
 * fitxer no és qui per triar-ho.
 *
 * PER QUÈ NO `toFixed`: `toFixed` sempre escriu el punt anglosaxó. A part de
 * quedar com una dada importada d'un altre lloc enmig d'una pantalla on tota la
 * resta va amb coma, en castellà el punt ÉS el separador de milers: «1.250»
 * tant pot llegir-se mil dos-cents cinquanta com u coma dos-cents cinquanta.
 */
export function formatDecimal(value: number, digits: number, locale: Locale): string {
  return new Intl.NumberFormat(tag(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Percentatge amb espai fi dur abans del signe, com mana la tipografia catalana. */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)} %`;
}

/**
 * Graus amb un decimal. Un decimal és el que distingeix veure-ho de no veure-ho.
 *
 * AQUESTA FUNCIÓ ESCRIVIA EL PUNT ANGLOSAXÓ, tres línies per sota del comentari
 * de `formatDecimal` que explica per què no s'ha de fer servir `toFixed`. El
 * resultat es veia a la portada: «ALTURA DEL SOL 4.5°» amb punt, al costat de
 * «40,3581°, 0,4067°» amb coma, a la mateixa targeta. I el projecte ja tenia la
 * versió bona escrita i provada a `features/spots/format.ts`, que ningú no
 * podia importar des d'aquí.
 *
 * L'IDIOMA VE AMB VALOR PER DEFECTE a posta: les dues llengües de l'app
 * escriuen el decimal amb coma, o sigui que avui la tria no canvia el resultat,
 * i posar-lo obligatori voldria dir tocar cinc pantalles per a un canvi que no
 * en mou cap píxel. Qui el tingui a mà que el passi; el dia que hi hagi una
 * tercera llengua, el paràmetre ja hi és.
 *
 * I EL NO-NÚMERO ES DIU AMB EL GUIÓ DE L'APP. Abans, un valor no finit sortia
 * com «NaN°» a la pantalla.
 */
export function formatDegrees(deg: number, locale: Locale = 'ca'): string {
  if (!Number.isFinite(deg)) return NO_DATA;
  return `${formatDecimal(deg, 1, locale)}°`;
}

/**
 * Coordenades amb el punt cardinal, com es diuen en veu alta.
 * Quatre decimals són uns 11 m: la precisió que de veritat té el GPS d'un mòbil.
 */
export function formatCoords(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'O';
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lon).toFixed(4)}° ${ew}`;
}

/**
 * Antiguitat d'una dada: "ara mateix", "fa 12 min", "fa 3 h", "fa 2 d".
 *
 * El sistema exigeix que la incertesa es digui SEMPRE amb la seva antiguitat.
 * Una probabilitat de cel clar de fa sis hores no és la mateixa dada que una
 * de fa cinc minuts, i amagar-ho és mentir per omissió.
 */
export function formatAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 1) return 'ara mateix';
  if (minutes < 60) return `fa ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `fa ${hours} h`;
  return `fa ${Math.floor(hours / 24)} d`;
}
