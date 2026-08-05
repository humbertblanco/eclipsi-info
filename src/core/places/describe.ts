/**
 * El text: de la distància a la frase.
 *
 * PER QUÈ LA FRASE ES DECIDEIX AQUÍ I NO A LA INTERFÍCIE. Perquè triar entre
 * "Cervera" i "a 4 km de Cervera" no és una decisió tipogràfica: és una
 * afirmació sobre què sabem i què no. La forma de la frase ÉS la dada, i per
 * això es prova amb la resta del motor.
 *
 * L'IDIOMA ES DECLARA AQUÍ I NO S'IMPORTA de `src/i18n`, tot i que el tipus és
 * el mateix. El mòdul d'i18n arrossega React, i `src/core/**` no pot dependre
 * de cap component.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en Node.
 */

import type { PlaceName } from './types';

/** Els idiomes que l'app té escrits. Català per defecte; el castellà és una tria. */
export type PlaceLocale = 'ca' | 'es' | 'en';

/**
 * Frase feta, ja partida per pintar-la.
 *
 * Ve en dues peces i no en una perquè a 390 px d'amplada la comarca no sempre
 * hi cap, i qui pinta ha de poder deixar-la anar sense haver de retallar text
 * amb punts suspensius.
 */
export interface PlaceLabel {
  /** Línia principal: "Cervera", "a 4 km de Cervera" o la comarca. */
  primary: string;
  /** Comarca i comunitat. `null` quan ja són a `primary` o quan no n'hi ha. */
  secondary: string | null;
  /** Quanta precisió té el que s'hi diu. Serveix per graduar-ne l'estil. */
  precision: PlaceName['precision'];
}

/**
 * Distància escrita.
 *
 * Per sota de deu quilòmetres, un decimal: entre 2,4 i 2,9 km hi ha deu minuts
 * a peu i la diferència es nota. A partir de deu, cap decimal: dir "17,3 km"
 * és fingir una precisió que la posició del node del poble no té.
 *
 * Coma decimal, que és com s'escriu en català i en castellà. No es fa servir
 * `Intl` a posta: `src/core/**` no ha de dependre de la configuració regional
 * de l'aparell, i totes dues llengües fan servir la mateixa coma.
 */
export function formatDistanceKm(km: number, locale: PlaceLocale = 'ca'): string {
  if (km < 10) return `${locale === 'en' ? km.toFixed(1) : km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}

/** Vocals i hac, per decidir si toca apòstrof. */
const VOWEL_OR_H = /^[aeiouàáèéêíïòóúüh]/i;

/**
 * "de" + nom, en català.
 *
 * Tres regles i totes tres surten a la pantalla:
 *  · davant de vocal o hac, apòstrof: "d'Oviedo", "d'Osca", "d'Huesca".
 *  · davant dels articles catalans en minúscula, contracció: "el Masnou" →
 *    "del Masnou", "els Hostalets" → "dels Hostalets". "la" i "les" no
 *    contrauen: "de la Valldan", "de les Oluges".
 *  · davant de "l'", res: "de l'Hospitalet".
 *
 * Els articles en MAJÚSCULA no es toquen ("El Espinar", "Las Rozas"): són noms
 * castellans on l'article forma part del nom i contreure'l seria escriure
 * malament el topònim.
 */
export function catalanOf(name: string): string {
  if (name.startsWith('els ')) return `dels ${name.slice(4)}`;
  if (name.startsWith('el ')) return `del ${name.slice(3)}`;
  if (name.startsWith("l'") || name.startsWith('la ') || name.startsWith('les ')) {
    return `de ${name}`;
  }
  return VOWEL_OR_H.test(name) ? `d’${name}` : `de ${name}`;
}

/** "de" + nom, en castellà. Aquí no hi ha ni apòstrof ni contracció amb "el". */
function spanishOf(name: string): string {
  return `de ${name}`;
}

function englishOf(name: string): string {
  return `from ${name}`;
}

const OF: Record<PlaceLocale, (name: string) => string> = {
  ca: catalanOf,
  es: spanishOf,
  en: englishOf,
};

/**
 * Redacta el nom del lloc.
 *
 * Els tres llindars, tal com els mana el projecte:
 *  · a menys de 1,5 km de la VORA del nucli (`AT_PLACE_KM`) → "Cervera"
 *  · fins a 25 km (`REGION_ONLY_KM`) → "a 4 km de Cervera"
 *  · més enllà → només la comarca, que és l'única cosa que encara és veritat
 *
 * Torna `null` quan no hi ha res a dir. Qui crida ha d'ensenyar les
 * coordenades i prou: el nom és un extra i no pot generar cap error.
 */
export function describePlace(
  place: PlaceName | null,
  locale: PlaceLocale = 'ca',
): PlaceLabel | null {
  if (!place) return null;

  const { settlement, precision, region } = place;

  if (!settlement || precision === 'none') {
    return region ? { primary: region, secondary: null, precision: 'region' } : null;
  }

  if (precision === 'region') {
    return region ? { primary: region, secondary: null, precision: 'region' } : null;
  }

  if (precision === 'at') {
    return { primary: settlement.name, secondary: region, precision: 'at' };
  }

  // `near`: la xifra que es pinta és la distància REAL al nucli, no la
  // distància a la vora amb què s'ha decidit la frase. Escurçar-la seria
  // afalagar l'usuari amb un número que no és.
  const km = place.distanceKm ?? 0;
  return {
    primary:
      locale === 'en'
        ? `${formatDistanceKm(km, locale)} ${OF[locale](settlement.name)}`
        : `a ${formatDistanceKm(km, locale)} ${OF[locale](settlement.name)}`,
    secondary: region,
    precision: 'near',
  };
}
