/**
 * Geometria de la línia de visió: on són, de veritat, els núvols que et taparan.
 *
 * EL PROBLEMA. Els tres eclipsis espanyols passen amb el Sol molt baix (el del
 * 12 d'agost de 2026 es veu, des de bona part de la península, entre 2° i 12°
 * sobre l'horitzó). Amb el Sol tan baix, mirar la previsió de la teva
 * coordenada no serveix de gaire: la línia que va del teu ull al Sol no puja
 * gairebé gens, i el núvol que se te'l menjarà pot ser a desenes de
 * quilòmetres cap a ponent, damunt d'un altre poble, amb un cel completament
 * diferent del teu.
 *
 * Uns números perquè es vegi la magnitud. Amb el Sol a 3° d'altura, la línia
 * de visió és a 1 km d'alçada quan ja ha recorregut 19 km de terreny, a 4 km
 * d'alçada quan ha recorregut 73 km, i a 9 km d'alçada quan ha recorregut
 * 155 km. O sigui: els cirrus que et taparan la corona són damunt d'un lloc
 * que és a més de cent quilòmetres teus.
 *
 * LA SOLUCIÓ. Open-Meteo accepta diverses coordenades separades per comes en
 * una sola petició (&latitude=41.6,41.8&longitude=-2.4,-2.9) i torna un array
 * de respostes en el mateix ordre. Això fa que mostrejar la línia de visió
 * sencera costi exactament una petició, i per tant sigui viable. Cada capa es
 * llegeix al punt on la línia de visió travessa la seva pròpia franja
 * d'alçada, que és l'única lectura que té sentit físic.
 *
 * LA GEOMETRIA. Amb el Sol baix la Terra ja no és plana ni de bon tros:
 * z/tan(h) sobreestima la distància en un 25 % a 5° d'altura i en un 36 % a 2°.
 * Fem servir la solució esfèrica exacta amb radi terrestre efectiu
 * R_eff = R/(1−k), k = 0,13, que és la mateixa convenció que el perfil
 * d'horitzó del terreny (`src/core/horizon/raycast.ts`) i que absorbeix la
 * curvatura del raig per refracció.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import { DEG, EARTH_EQUATORIAL_RADIUS_KM, RAD } from '../astro/constants';
import { LAYER_ORDER } from './layers';
import type {
  CloudLayerId,
  LineOfSightPoint,
  SamplingPlan,
  WeatherLocale,
} from './types';

/** Mateixa k que el raycast del terreny: refracció terrestre estàndard. */
export const TERRESTRIAL_REFRACTION_K = 0.13;

const EARTH_RADIUS_M = EARTH_EQUATORIAL_RADIUS_KM * 1000;
const EFFECTIVE_RADIUS_M = EARTH_RADIUS_M / (1 - TERRESTRIAL_REFRACTION_K);

/**
 * Per damunt d'aquesta altura la línia de visió puja prou de pressa perquè
 * els núvols que et tapen siguin, a efectes pràctics, damunt teu: a 15° la
 * capa alta es travessa a 33 km, que és menys de tres cel·les del model
 * europeu. Mostrejar més lluny no aportaria informació nova.
 */
export const SLANT_ALTITUDE_THRESHOLD_DEG = 15;

/**
 * Distància màxima que consultem, en km.
 *
 * A 2° d'altura la capa alta es travessa a més de 250 km. Passat aquest punt
 * el mostreig deixa de ser útil: la meteorologia d'allà ja no té gaire a veure
 * amb la teva, i el més probable és que el punt caigui al mar o a França. Quan
 * hi topem ho marquem i ho diem a la interfície.
 */
export const MAX_SAMPLE_DISTANCE_KM = 260;

/**
 * Dues mostres per capa no serveixen de res si cauen dins de la mateixa
 * cel·la del model. La malla europea d'alta resolució té uns 7 km de pas;
 * agrupem els punts que quedin a menys de 10 km per no gastar peticions en
 * dades idèntiques.
 */
export const DEDUPE_DISTANCE_KM = 10;

/**
 * Alçades on mostregem cada capa, en metres sobre l'observador.
 *
 * Dues per capa perquè la franja és ampla i, amb el Sol baix, la base i el
 * sostre d'una mateixa capa cauen a llocs molt diferents: a 3° d'altura la
 * base dels núvols baixos (500 m) és a 9,5 km i el sostre (2000 m) a 38 km.
 * Amb dues mostres la mitjana de la capa ja recull aquesta franja.
 */
export const LAYER_SAMPLE_HEIGHTS_M: Record<CloudLayerId, readonly number[]> = {
  low: [600, 1800],
  mid: [3000, 5000],
  high: [8000, 11000],
};

/**
 * Distància SOBRE EL TERRENY, en metres, fins al punt on una línia de visió
 * que surt amb elevació `altitudeDeg` arriba a l'alçada `heightM` sobre
 * l'observador.
 *
 * Triangle amb vèrtexs al centre de l'esfera efectiva, a l'observador i al
 * punt buscat. L'angle a l'observador és 90° + h, i el teorema del cosinus
 * dona la corda:
 *
 *     c = √((R+z)² − R²·cos²h) − R·sin h
 *
 * D'aquí surt l'angle central per la llei dels sinus, i la distància sobre el
 * terreny és R_eff·θ. El radi que hi entra és l'EFECTIU de cap a cap: en aquest
 * model el raig és recte i la Terra és més plana, i és la distància
 * horitzontal la que es conserva respecte del món real. Sempre té solució amb
 * z ≥ 0 i h ≥ 0, perquè la línia de visió sempre acaba pujant.
 */
export function groundDistanceToHeightM(altitudeDeg: number, heightM: number): number {
  const h = Math.max(altitudeDeg, 0) * DEG;
  const z = Math.max(heightM, 0);
  const r = EFFECTIVE_RADIUS_M;

  const cosh = Math.cos(h);
  const sinh = Math.sin(h);
  const inner = (r + z) ** 2 - (r * cosh) ** 2;
  const chord = Math.sqrt(Math.max(inner, 0)) - r * sinh;
  if (chord <= 0) return 0;

  // Llei dels sinus: sin(θ)/c = sin(90°+h)/(R+z).
  const sinTheta = (chord * cosh) / (r + z);
  const theta = Math.asin(Math.min(1, Math.max(-1, sinTheta)));
  return theta * r;
}

/** El mateix, en km. */
export function groundDistanceToHeightKm(altitudeDeg: number, heightM: number): number {
  return groundDistanceToHeightM(altitudeDeg, heightM) / 1000;
}

/**
 * Distància sobre el terreny convertida en angle geocèntric, per poder-la
 * passar a la fórmula de navegació. Aquí sí que hi va el radi REAL: caminar
 * cent quilòmetres per terra són cent quilòmetres per terra, i el radi efectiu
 * només servia per doblegar el raig de llum.
 */
export function angularFromGroundM(groundM: number): number {
  return groundM / EARTH_RADIUS_M;
}

/**
 * Punt de destí a partir d'un origen, un azimut i una distància angular.
 * Fórmula directa de navegació ortodròmica sobre esfera.
 */
export function destinationPoint(
  latDeg: number,
  lonDeg: number,
  bearingDeg: number,
  angularDistanceRad: number,
): { lat: number; lon: number } {
  const lat1 = latDeg * DEG;
  const lon1 = lonDeg * DEG;
  const brg = bearingDeg * DEG;
  const d = angularDistanceRad;

  const sinLat2 =
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg);
  const lat2 = Math.asin(Math.min(1, Math.max(-1, sinLat2)));
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brg) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * sinLat2,
    );

  return {
    lat: lat2 * RAD,
    // Normalitza a (-180, 180] perquè l'API rebutja longituds fora de rang.
    lon: (((lon2 * RAD + 540) % 360) - 180),
  };
}

/** Distància aproximada entre dos punts propers, en km. Prou per agrupar. */
function quickDistanceKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const meanLat = ((aLat + bLat) / 2) * DEG;
  const dx = (bLon - aLon) * DEG * Math.cos(meanLat) * EARTH_RADIUS_M;
  const dy = (bLat - aLat) * DEG * EARTH_RADIUS_M;
  return Math.hypot(dx, dy) / 1000;
}

/**
 * Construeix el pla de mostreig.
 *
 * El punt 0 és sempre l'observador: encara que el Sol sigui alt, volem la
 * dada del lloc on hi ha la persona. Amb el Sol per damunt del llindar, tots
 * els punts de les capes col·lapsen sobre l'observador en agrupar-se, i el pla
 * queda amb un sol punt i una sola petició.
 */
export function planLineOfSight(
  latDeg: number,
  lonDeg: number,
  sunAzimuthDeg: number,
  sunAltitudeDeg: number,
): SamplingPlan {
  const slanted = sunAltitudeDeg <= SLANT_ALTITUDE_THRESHOLD_DEG;

  const points: LineOfSightPoint[] = [
    {
      lat: latDeg,
      lon: lonDeg,
      crossingHeightM: 0,
      groundDistanceKm: 0,
      layers: [],
      truncated: false,
    },
  ];

  let truncatedAny = false;

  for (const layer of LAYER_ORDER) {
    for (const heightM of LAYER_SAMPLE_HEIGHTS_M[layer]) {
      let groundKm = slanted ? groundDistanceToHeightKm(sunAltitudeDeg, heightM) : 0;
      let truncated = false;

      if (groundKm > MAX_SAMPLE_DISTANCE_KM) {
        truncated = true;
        truncatedAny = true;
        groundKm = MAX_SAMPLE_DISTANCE_KM;
      }

      const angle = angularFromGroundM(groundKm * 1000);
      const target =
        angle > 0
          ? destinationPoint(latDeg, lonDeg, sunAzimuthDeg, angle)
          : { lat: latDeg, lon: lonDeg };

      // Agrupa amb un punt ja previst si cau dins de la mateixa cel·la del
      // model: la petició seria idèntica i la resposta també.
      const existing = points.find(
        (p) => quickDistanceKm(p.lat, p.lon, target.lat, target.lon) < DEDUPE_DISTANCE_KM,
      );

      if (existing) {
        if (!existing.layers.includes(layer)) existing.layers.push(layer);
        existing.truncated = existing.truncated || truncated;
      } else {
        points.push({
          lat: target.lat,
          lon: target.lon,
          crossingHeightM: heightM,
          groundDistanceKm: groundKm,
          layers: [layer],
          truncated,
        });
      }
    }
  }

  const maxDistanceKm = points.reduce((m, p) => Math.max(m, p.groundDistanceKm), 0);

  return {
    sunAltitudeDeg,
    sunAzimuthDeg,
    slanted,
    points,
    maxDistanceKm,
    truncated: truncatedAny,
    lineOfSightUsed: true,
  };
}

/**
 * Índexs dels punts on s'ha de llegir cada capa. Si cap punt reclama una capa
 * (no hauria de passar mai), es llegeix a l'observador.
 */
export function pointsForLayer(plan: SamplingPlan, layer: CloudLayerId): number[] {
  const indices: number[] = [];
  plan.points.forEach((p, i) => {
    if (p.layers.includes(layer)) indices.push(i);
  });
  return indices.length > 0 ? indices : [0];
}

/**
 * Signatura del pla, per a la clau de la memòria cau. Arrodonim l'azimut a 5°
 * i l'altura a 1° perquè un moviment mínim de l'observador no invalidi la
 * dada desada: la malla del model és molt més grollera que això.
 */
export function planSignature(plan: SamplingPlan): string {
  const az = Math.round(plan.sunAzimuthDeg / 5) * 5;
  const alt = Math.round(plan.sunAltitudeDeg);
  return `${az}/${alt}/${plan.points.length}`;
}

/**
 * Les setze sigles de la rosa dels vents, per idioma.
 *
 * AVUI LES DUES LLISTES SÓN IDÈNTIQUES, i no és un descuit. Català i castellà
 * abreugen igual els quatre punts i les setze direccions perquè les inicials
 * coincideixen (nord/norte, est/este, sud/sur, oest/oeste), i cap dels dos fa
 * servir la W anglesa. La taula hi és igualment perquè l'alternativa és que el
 * dia que entri un idioma on no coincideixin —o que algú decideixi escriure
 * els noms sencers, on ja no coincideixen: «nord-oest» contra «noroeste»— el
 * defecte es descobreixi a la pantalla d'algú. És el mateix criteri que
 * `INTL` a `features/spots/format.ts`.
 */
const COMPASS_NAMES: Record<WeatherLocale, readonly string[]> = {
  ca: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'],
  es: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'],
  en: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'],
};

/** Punt cardinal per a un azimut. Per explicar cap on mirem. */
export function compassLabel(azimuthDeg: number, locale: WeatherLocale = 'ca'): string {
  const names = COMPASS_NAMES[locale];
  const index = Math.round((((azimuthDeg % 360) + 360) % 360) / 22.5) % 16;
  return names[index];
}
