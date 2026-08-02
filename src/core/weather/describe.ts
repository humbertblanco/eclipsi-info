/**
 * Les frases. Curtes, declaratives, de tu, i sense amagar la incertesa.
 *
 * Viuen al nucli i no al component per una raó pràctica: són l'única part
 * d'aquesta funcionalitat que es pot equivocar sense que cap test se n'adoni,
 * i aquí es poden provar. També perquè el dia que hi hagi una vista impresa o
 * una notificació, el text ja serà on toca.
 *
 * BILINGÜE, I AMB EL CATALÀ PER DEFECTE. Cada funció accepta `locale` com a
 * últim paràmetre amb valor per defecte `'ca'`. El defecte no és comoditat: és
 * el que permet que qui ja cridava aquestes funcions —tests inclosos— no hagi
 * de canviar res, i que afegir un idioma no sigui una migració. Les taules
 * segueixen el patró de `FILTER_GATE_NOTE` a `core/timer/phrases.ts`.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import { LAYER_LABEL } from './layers';
import { compassLabel } from './lineOfSight';
import type { CloudOutlook, LocalisedText, SkyBand, WeatherLocale } from './types';

/** Titular de la puntuació. Tres estats i prou. */
export const BAND_TITLE: Record<SkyBand, LocalisedText> = {
  clear: { ca: 'Cel net', es: 'Cielo despejado' },
  partial: { ca: 'Cel a mitges', es: 'Cielo a medias' },
  cloudy: { ca: 'Cel tapat', es: 'Cielo cubierto' },
};

/** Què vol dir cada estat per a l'eclipsi. */
export const BAND_MEANING: Record<SkyBand, LocalisedText> = {
  clear: { ca: 'Ho hauries de veure tot.', es: 'Deberías verlo todo.' },
  partial: {
    ca: 'El veuràs a estones, o a través d’un vel.',
    es: 'Lo verás a ratos, o a través de un velo.',
  },
  cloudy: {
    ca: 'Molt probablement no veuràs res. Mou-te.',
    es: 'Muy probablemente no verás nada. Muévete.',
  },
};

/** Edat d'una dada en text. Sempre s'ensenya: la incertesa es diu. */
export function describeAge(ageMs: number, locale: WeatherLocale = 'ca'): string {
  const minutes = Math.round(ageMs / 60000);
  const es = locale === 'es';
  if (minutes < 1) return es ? 'ahora mismo' : 'ara mateix';
  if (minutes < 60) return es ? `hace ${minutes} min` : `fa ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return es ? `hace ${hours} h` : `fa ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return es ? 'hace 1 día' : 'fa 1 dia';
  return es ? `hace ${days} días` : `fa ${days} dies`;
}

/**
 * L'edat precedida de preposició, amb l'elisió resolta.
 *
 * "de ara mateix" no és català. Com que l'edat pot començar per vocal o per
 * consonant segons quant temps hagi passat, la preposició s'ha de decidir aquí
 * i no a la plantilla, que no sap què li tocarà.
 *
 * UNA LÍNIA PER IDIOMA, i no una fórmula única amb la regla catalana
 * parametritzada. En castellà la preposició és sempre «de» i no s'elideix mai:
 * «de ahora mismo» i «de hace 5 min» són tots dos correctes. Escriure-ho amb
 * una sola expressió obligaria a inventar-se una regla d'elisió buida per al
 * castellà, i el dia que algú toqués la regex catalana per afegir-hi una vocal
 * hi tocaria també el castellà sense adonar-se'n.
 */
export function describeAgeSince(ageMs: number, locale: WeatherLocale = 'ca'): string {
  const age = describeAge(ageMs, locale);
  if (locale === 'es') return `de ${age}`;
  return /^[aeiouàèéíòóúh]/i.test(age) ? `d’${age}` : `de ${age}`;
}

/** Antelació en text natural. */
export function describeLead(days: number, locale: WeatherLocale = 'ca'): string {
  const es = locale === 'es';
  if (days < 0) return es ? 'ya ha pasado' : 'ja ha passat';
  const hours = days * 24;
  if (hours < 1) {
    return es ? 'dentro de menos de una hora' : 'd’aquí a menys d’una hora';
  }
  if (hours < 48) {
    return es ? `dentro de ${Math.round(hours)} h` : `d’aquí a ${Math.round(hours)} h`;
  }
  return es ? `dentro de ${Math.round(days)} días` : `d’aquí a ${Math.round(days)} dies`;
}

/**
 * On és, de veritat, el núvol que et pot tapar.
 *
 * És la frase que justifica tot el mòdul de la línia de visió: amb el Sol a
 * 3°, dir "a Sòria hi ha cirrus" no vol dir res, perquè els cirrus que et
 * taparan són damunt de Valladolid.
 */
export function describeLineOfSight(
  outlook: CloudOutlook,
  locale: WeatherLocale = 'ca',
): string {
  const { sampling } = outlook;
  const dir = compassLabel(sampling.sunAzimuthDeg, locale);
  const alt = sampling.sunAltitudeDeg.toFixed(0);
  const es = locale === 'es';

  if (!sampling.slanted) {
    return es
      ? `El Sol estará a ${alt}°. Bastante alto: las nubes que cuentan están encima de ti.`
      : `El Sol estarà a ${alt}°. Prou alt: els núvols que compten són damunt teu.`;
  }

  if (!sampling.lineOfSightUsed) {
    return es
      ? `El Sol estará a ${alt}° hacia el ${dir}. La climatología solo se ha calculado en tu punto.`
      : `El Sol estarà a ${alt}° cap al ${dir}. La climatologia només s’ha calculat al teu punt.`;
  }

  const farthest = sampling.points.reduce(
    (a, b) => (b.groundDistanceKm > a.groundDistanceKm ? b : a),
    sampling.points[0],
  );
  const km = Math.round(farthest.groundDistanceKm);
  return es
    ? `El Sol estará a ${alt}° hacia el ${dir}. Las nubes altas que te taparían están a ${km} km de aquí, en esa dirección.`
    : `El Sol estarà a ${alt}° cap al ${dir}. Els núvols alts que et taparien són a ${km} km d’aquí, en aquella direcció.`;
}

/** Frase de la capa que més tapa. */
export function describeDominantLayer(
  outlook: CloudOutlook,
  locale: WeatherLocale = 'ca',
): string | null {
  const { dominant, band } = outlook.score;
  // Amb el cel donat per net, aquesta frase el contradiria: "Ho hauries de
  // veure tot" seguit de "el disc es veurà lletós" no és matisar, és dubtar.
  // Quan la resposta és "sí", es diu que sí i prou.
  if (!dominant || band === 'clear') return null;
  // La frase parla del RISC, no d'un fet consumat: amb un 20 % de cobertura
  // baixa, dir "està tapat" seria fals, però dir que és el que més et pot
  // fastiguejar és exactament el que passa.
  const label = LAYER_LABEL[dominant][locale].toLowerCase();
  const es = locale === 'es';
  // El subjecte concorda amb el nom del núvol de cada idioma: «els núvols
  // baixos» contra «las nubes bajas». Per això `LAYER_LABEL` no és la mateixa
  // paraula traduïda sinó la mateixa paraula CONCORDADA (vegeu `layers.ts`).
  const head = es ? `Lo que más pesa son las nubes ${label}.` : `El que més pesa són els núvols ${label}.`;
  if (dominant === 'high') {
    return es
      ? `${head} Son finas: la corona todavía pasa.`
      : `${head} Són prims: la corona encara passa.`;
  }
  if (dominant === 'mid') {
    return es ? `${head} El disco se verá lechoso.` : `${head} El disc es veurà lletós.`;
  }
  return es
    ? `${head} Donde las haya, no verás nada.`
    : `${head} On n’hi hagi, no veuràs res.`;
}

/** Frase de l'extinció per boirina, si n'hi ha i si val la pena dir-la. */
export function describeHaze(
  outlook: CloudOutlook,
  locale: WeatherLocale = 'ca',
): string | null {
  if (outlook.mode !== 'forecast' || !outlook.haze) return null;
  const { transmission, airmass, visibilityKm } = outlook.haze;
  // Per damunt del 60 % de transmissió no cal dir res: qualsevol posta de sol
  // està per sota d'aquest valor i ningú en diu res.
  if (transmission > 0.6) return null;

  const es = locale === 'es';
  const km = visibilityKm < 1 ? visibilityKm.toFixed(1) : String(Math.round(visibilityKm));
  const head = es
    ? `Con ${km} km de visibilidad y ${airmass.toFixed(0)} masas de aire`
    : `Amb ${km} km de visibilitat i ${airmass.toFixed(0)} masses d’aire`;

  // Per sota del 10 % ja no és "esmorteït": és que no arriba llum. Dir-ho amb
  // la frase suau seria contradictori amb la xifra que hi ha al costat.
  if (transmission < 0.1) {
    return es
      ? `${head}, casi no llegará luz al disco. La bruma de poniente puede hacerlo desaparecer antes de tocar el horizonte.`
      : `${head}, gairebé no arribarà llum al disc. La boirina de ponent el pot fer desaparèixer abans de tocar l’horitzó.`;
  }

  const pct = Math.round(transmission * 100);
  return es
    ? `${head}, al disco le llegará un ${pct} % de la luz. Se verá, pero rojo y apagado.`
    : `${head}, al disc li arribarà un ${pct} % de la llum. Es veurà, però vermell i esmorteït.`;
}
