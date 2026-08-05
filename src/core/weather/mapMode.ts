/**
 * Què ha d'ensenyar la capa de nuvolositat del mapa, i amb quina cara.
 *
 * ── LA REGLA D'OR, ARA TAMBÉ AL MAPA ────────────────────────────────────────
 *
 * `outlook.ts` obre amb la norma que aguanta tot el mòdul del temps: una
 * previsió i una climatologia no són la mateixa cosa i no s'han d'ensenyar mai
 * amb la mateixa cara. A la fitxa d'un punt això es resol amb el `caveat` —una
 * frase amb el «NO» en majúscules que impedeix llegir quinze anys d'estadística
 * com si fos un butlletí. En un MAPA, aquella frase no serveix: el que l'usuari
 * mira és una taca de color, i una taca de color no porta text.
 *
 * Per això aquí la distinció no és només d'etiqueta sinó de TEXTURA. La
 * climatologia es pinta amb trama i la previsió amb color ple. La diferència
 * s'ha de poder veure de reüll, sense llegir res i sense mirar la llegenda,
 * perquè el gest normal amb un mapa és mirar-lo mig segon i decidir. Si les
 * dues fonts es pintessin igual, el 12 de juliol algú veuria un mapa verd sobre
 * Sòria i creuria que sap què farà el cel d'aquí a un mes. No ho sap ningú.
 *
 * ── QUAN CANVIA ─────────────────────────────────────────────────────────────
 *
 * El tall no és un número rodó triat aquí: és `outlookMode`, el mateix que ja
 * decideix la font de la fitxa del punt. A partir de setze dies vista no hi ha
 * model numèric —ni el nostre ni el de ningú— i el que queda és l'arxiu. Per
 * sota, hi ha previsió i el mapa ha de passar a dada viva. Cridar `outlookMode`
 * en comptes de repetir-ne la condició és el que garanteix que el mapa i la
 * fitxa no puguin ensenyar fonts diferents el mateix dia, que seria el defecte
 * més difícil d'explicar de tots.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import { MAX_FORECAST_DAYS } from './openMeteo';
import {
  CLIMATOLOGY_YEARS,
  confidenceForLead,
  confidenceForYears,
  leadDays,
  outlookMode,
} from './outlook';
import type { Confidence, LocalisedText, OutlookMode } from './types';

/**
 * Com es pinta la taca.
 *
 * `hatch` és la trama de la climatologia i `solid` el color ple de la previsió.
 * Els noms descriuen la FORMA i no la font a posta: qui pinta la capa no ha de
 * tornar a decidir res, només llegir aquest camp. Si algun dia s'afegeix una
 * tercera font, la taula de textures és l'únic lloc que s'ha de tocar.
 */
export type CloudMapTexture = 'hatch' | 'solid';

export interface CloudMapPlan {
  /** D'on ha de sortir la dada de la capa. */
  mode: OutlookMode;
  /** Dies fins a l'eclipsi. Negatiu si ja ha passat. */
  leadDays: number;
  /** Quant se'n pot refiar l'usuari. Es diu sempre, no s'amaga. */
  confidence: Confidence;
  /** Com s'ha de pintar, perquè les dues fonts no es confonguin de reüll. */
  texture: CloudMapTexture;
  /** Nom curt de la font, per a la llegenda. */
  label: LocalisedText;
  /** Una línia que diu què és exactament el que s'està mirant. */
  caption: LocalisedText;
  /**
   * Cert quan la previsió viva encara no existeix. La interfície ho pot fer
   * servir per dir «torna-hi quan falti menys» en comptes de deixar l'usuari
   * buscant un botó que no hi és.
   */
  awaitingForecast: boolean;
}

/** Trama per a l'estadística, ple per al model. Vegeu la capçalera. */
const TEXTURE_BY_MODE: Record<OutlookMode, CloudMapTexture> = {
  climatology: 'hatch',
  forecast: 'solid',
};

const LABEL_BY_MODE: Record<OutlookMode, LocalisedText> = {
  climatology: { ca: 'Climatologia', es: 'Climatología', en: 'Climatology', fr: 'Climatologie' },
  forecast: { ca: 'Previsió', es: 'Previsión', en: 'Forecast', fr: 'Prévision' },
};

/**
 * Dies d'antelació a partir dels quals ja no hi ha model.
 *
 * Es deriva de `MAX_FORECAST_DAYS` i no s'escriu a mà perquè és la mateixa
 * frontera que fa servir `outlookMode`; aquí només s'exposa perquè la
 * interfície pugui dir la xifra sense inventar-se-la.
 */
export const FORECAST_HORIZON_DAYS = MAX_FORECAST_DAYS - 1;

/**
 * Punts que la capa pot consultar en directe d'una sola tacada.
 *
 * NO ÉS UNA MESURA, ÉS UN PRESSUPOST, i s'ha de llegir com a tal. Open-Meteo
 * accepta diverses coordenades en una sola petició —és el que fa viable el
 * mostreig de la línia de visió—, o sigui que vuitanta punts són UNA petició i
 * no vuitanta.
 *
 * D'on surt el número: `openMeteo.ts` té mesurat que set punts i cinc hores són
 * 4 kB, és a dir uns 115 B per punt i hora. Vuitanta punts per les tres hores
 * que demana `buildForecast` són uns 28 kB, que amb dades mòbils al camp encara
 * és una espera curta, i vuitanta cel·les cobreixen la franja sobre Espanya amb
 * una malla d'uns 60 km — prou per decidir cap a on moure's, que és tot el que
 * es demana a un mapa. Si algú vol pujar-lo, que mesuri el pes de la resposta
 * abans i no després.
 */
export const LIVE_FORECAST_MAX_POINTS = 80;

/** Frase de la climatologia. Diu els anys perquè els anys són tot el que val. */
function climatologyCaption(years: number): LocalisedText {
  return {
    ca:
      `El que va fer el cel aquests mateixos dies els últims ${years} anys. ` +
      'NO és una previsió: serveix per triar on vas.',
    es:
      `Lo que hizo el cielo estos mismos días los últimos ${years} años. ` +
      'NO es una previsión: sirve para elegir adónde vas.',
    en:
      `What the sky was like on these dates over the past ${years} years. ` +
      'This is NOT a forecast: use it to choose where to go.',
    fr: `L’état du ciel à ces mêmes dates pendant les ${years} dernières années. Ce n’est PAS une prévision : utilisez-le pour choisir votre destination.`,
  };
}

/** Frase de la previsió. Diu l'antelació perquè l'antelació és tot el que val. */
function forecastCaption(lead: number): LocalisedText {
  const days = Math.max(0, lead).toFixed(1);
  return {
    ca: `Previsió del model per a l’hora de l’eclipsi. Falten ${days} dies.`,
    es: `Previsión del modelo para la hora del eclipse. Faltan ${days} días.`,
    en: `Model forecast for the time of the eclipse. ${days} days remaining.`,
    fr: `Prévision du modèle pour l’heure de l’éclipse. Encore ${days} jours.`,
  };
}

export interface CloudMapPlanOptions {
  /**
   * Anys d'arxiu que hi ha darrere de la graella. Si no es diu, s'assumeix la
   * sèrie completa; passar-hi els anys REALS de la graella és el que fa que la
   * fiabilitat de la llegenda no sigui optimista quan alguna cel·la en té menys.
   */
  years?: number;
}

/**
 * Quina font toca, com s'ha d'etiquetar i quant se'n pot refiar l'usuari.
 *
 * És tota la decisió de la capa en una funció pura, i està aquí i no dins del
 * component per la raó de sempre en aquest projecte: és l'única part d'això que
 * es pot equivocar sense que la pantalla ho canti, i aquí es pot provar.
 */
export function planCloudMap(
  targetTimeMs: number,
  nowMs: number,
  options: CloudMapPlanOptions = {},
): CloudMapPlan {
  const mode = outlookMode(targetTimeMs, nowMs);
  const lead = leadDays(targetTimeMs, nowMs);
  const years = options.years ?? CLIMATOLOGY_YEARS;

  return {
    mode,
    leadDays: lead,
    confidence:
      mode === 'forecast'
        ? confidenceForLead(Math.max(0, lead))
        : confidenceForYears(years),
    texture: TEXTURE_BY_MODE[mode],
    label: LABEL_BY_MODE[mode],
    caption: mode === 'forecast' ? forecastCaption(lead) : climatologyCaption(years),
    // Només s'espera previsió si l'eclipsi encara ha d'arribar. Passat
    // l'eclipsi, `outlookMode` també torna a la climatologia, i allà no hi ha
    // res a esperar: ja ha passat.
    awaitingForecast: mode === 'climatology' && lead > FORECAST_HORIZON_DAYS,
  };
}
