/**
 * Les frases. Curtes, declaratives, de tu, i sense amagar la incertesa.
 *
 * Viuen al nucli i no al component per una raó pràctica: són l'única part
 * d'aquesta funcionalitat que es pot equivocar sense que cap test se n'adoni,
 * i aquí es poden provar. També perquè el dia que hi hagi una vista impresa o
 * una notificació, el text ja serà on toca.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import { LAYER_LABEL } from './layers';
import { compassLabel } from './lineOfSight';
import type { CloudOutlook, SkyBand } from './types';

/** Titular de la puntuació. Tres estats i prou. */
export const BAND_TITLE: Record<SkyBand, string> = {
  clear: 'Cel net',
  partial: 'Cel a mitges',
  cloudy: 'Cel tapat',
};

/** Què vol dir cada estat per a l'eclipsi. */
export const BAND_MEANING: Record<SkyBand, string> = {
  clear: 'Ho hauries de veure tot.',
  partial: 'El veuràs a estones, o a través d’un vel.',
  cloudy: 'Molt probablement no veuràs res. Mou-te.',
};

/** Edat d'una dada en text. Sempre s'ensenya: la incertesa es diu. */
export function describeAge(ageMs: number): string {
  const minutes = Math.round(ageMs / 60000);
  if (minutes < 1) return 'ara mateix';
  if (minutes < 60) return `fa ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `fa ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'fa 1 dia' : `fa ${days} dies`;
}

/**
 * L'edat precedida de preposició, amb l'elisió resolta.
 *
 * "de ara mateix" no és català. Com que l'edat pot començar per vocal o per
 * consonant segons quant temps hagi passat, la preposició s'ha de decidir aquí
 * i no a la plantilla, que no sap què li tocarà.
 */
export function describeAgeSince(ageMs: number): string {
  const age = describeAge(ageMs);
  return /^[aeiouàèéíòóúh]/i.test(age) ? `d’${age}` : `de ${age}`;
}

/** Antelació en text natural. */
export function describeLead(days: number): string {
  if (days < 0) return 'ja ha passat';
  const hours = days * 24;
  if (hours < 1) return 'd’aquí a menys d’una hora';
  if (hours < 48) return `d’aquí a ${Math.round(hours)} h`;
  return `d’aquí a ${Math.round(days)} dies`;
}

/**
 * On és, de veritat, el núvol que et pot tapar.
 *
 * És la frase que justifica tot el mòdul de la línia de visió: amb el Sol a
 * 3°, dir "a Sòria hi ha cirrus" no vol dir res, perquè els cirrus que et
 * taparan són damunt de Valladolid.
 */
export function describeLineOfSight(outlook: CloudOutlook): string {
  const { sampling } = outlook;
  const dir = compassLabel(sampling.sunAzimuthDeg);

  if (!sampling.slanted) {
    return `El Sol estarà a ${sampling.sunAltitudeDeg.toFixed(0)}°. Prou alt: els núvols que compten són damunt teu.`;
  }

  if (!sampling.lineOfSightUsed) {
    return `El Sol estarà a ${sampling.sunAltitudeDeg.toFixed(0)}° cap al ${dir}. La climatologia només s’ha calculat al teu punt.`;
  }

  const farthest = sampling.points.reduce(
    (a, b) => (b.groundDistanceKm > a.groundDistanceKm ? b : a),
    sampling.points[0],
  );
  const km = Math.round(farthest.groundDistanceKm);
  return `El Sol estarà a ${sampling.sunAltitudeDeg.toFixed(0)}° cap al ${dir}. Els núvols alts que et taparien són a ${km} km d’aquí, en aquella direcció.`;
}

/** Frase de la capa que més tapa. */
export function describeDominantLayer(outlook: CloudOutlook): string | null {
  const { dominant, band } = outlook.score;
  // Amb el cel donat per net, aquesta frase el contradiria: "Ho hauries de
  // veure tot" seguit de "el disc es veurà lletós" no és matisar, és dubtar.
  // Quan la resposta és "sí", es diu que sí i prou.
  if (!dominant || band === 'clear') return null;
  // La frase parla del RISC, no d'un fet consumat: amb un 20 % de cobertura
  // baixa, dir "està tapat" seria fals, però dir que és el que més et pot
  // fastiguejar és exactament el que passa.
  const label = LAYER_LABEL[dominant].toLowerCase();
  if (dominant === 'high') {
    return `El que més pesa són els núvols ${label}. Són prims: la corona encara passa.`;
  }
  if (dominant === 'mid') {
    return `El que més pesa són els núvols ${label}. El disc es veurà lletós.`;
  }
  return `El que més pesa són els núvols ${label}. On n’hi hagi, no veuràs res.`;
}

/** Frase de l'extinció per boirina, si n'hi ha i si val la pena dir-la. */
export function describeHaze(outlook: CloudOutlook): string | null {
  if (outlook.mode !== 'forecast' || !outlook.haze) return null;
  const { transmission, airmass, visibilityKm } = outlook.haze;
  // Per damunt del 60 % de transmissió no cal dir res: qualsevol posta de sol
  // està per sota d'aquest valor i ningú en diu res.
  if (transmission > 0.6) return null;

  const km = visibilityKm < 1 ? visibilityKm.toFixed(1) : String(Math.round(visibilityKm));
  const head = `Amb ${km} km de visibilitat i ${airmass.toFixed(0)} masses d’aire`;

  // Per sota del 10 % ja no és "esmorteït": és que no arriba llum. Dir-ho amb
  // la frase suau seria contradictori amb la xifra que hi ha al costat.
  if (transmission < 0.1) {
    return `${head}, gairebé no arribarà llum al disc. La boirina de ponent el pot fer desaparèixer abans de tocar l’horitzó.`;
  }

  return `${head}, al disc li arribarà un ${Math.round(transmission * 100)} % de la llum. Es veurà, però vermell i esmorteït.`;
}
