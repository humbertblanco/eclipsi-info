/**
 * Rutes humanes per als llocs que l'aplicació coneix de manera canònica.
 *
 * Quan algú comparteix el seu punt i aquell punt cau damunt d'una ciutat o d'un
 * emplaçament oficial que ja té pàgina, l'enllaç surt amb el camí d'aquella
 * pàgina en comptes de l'arrel. Les coordenades de `?p=` hi van igualment i
 * segueixen sent l'única font de precisió: el camí identifica el lloc, no el
 * mesura. Així una adreça es pot llegir en veu alta sense convertir un topònim
 * —ni una coordenada oficial estimada— en una promesa de precisió.
 *
 * ── HI HAVIA DUES DECISIONS ESCRITES AQUÍ DINS I NOMÉS UNA ERA CERTA ────────
 *
 * El fitxer declarava un camp `slug: Record<Locale, string>` per a cada lloc,
 * amb els topònims traduïts convertits a slug i amb una desambiguació per
 * col·lisions entre traduccions. Res no el llegia: `readablePlacePath()`
 * construeix el camí amb `place.id`, que és el que fa el generador estàtic i
 * el que fa que una adreça compartida no es trenqui el dia que algú retoqui una
 * traducció.
 *
 * La prova que ho havia de vigilar es deia «usa el slug traduït» i comprovava
 * que `readablePlacePath(barcelona, 'fr')` fos `/fr/ville/barcelona/…`. Passava
 * per casualitat: el nom francès de Barcelona és «Barcelone» i el seu slug
 * seria `barcelone`, però l'id val `barcelona`. Amb A Coruña —id `a-coruna`,
 * nom francès «La Corogne»— la mateixa prova hauria fallat, i el que hauria
 * fallat és la prova, no el codi.
 *
 * Ara la decisió és una: **l'id estable mana**. El camp `slug`, la funció que
 * el calculava i la desambiguació han marxat, i la prova compara els dos casos
 * on l'id i el topònim traduït difereixen de debò.
 *
 * ── I EL CAMÍ NOMÉS VA EN UNA DIRECCIÓ ──────────────────────────────────────
 *
 * També hi havia un `resolveReadablePlacePath()` que llegia una d'aquestes
 * rutes i en tornava el lloc, amb tres proves. No el cridava ningú: quan algú
 * arriba a `/ciutat/tarragona/12-08-2026/`, qui l'envia a l'app és la pàgina
 * estàtica amb el seu `?p=`, i l'app llegeix les coordenades com sempre. Una
 * segona manera d'entrar-hi, sense cap crida, és codi que sembla que funciona
 * i que ningú no ha vist funcionar mai. Fora.
 */
import {
  OBSERVATION_ECLIPSE_IDS,
  pointsForEclipse,
} from '../../data/observation-points/catalog';
import { SEO_CITIES } from '../../content/seo/cities';
import { eclipseDateSlug } from '../../content/seo/dateSlug';
import { seoPath, seoPrefix, type SeoKind } from '../../content/seo/routes';
import type { Locale } from '../../i18n';
import { buildShareLink, type ShareLinkParams } from './link';

export type ReadablePlaceKind = 'city' | 'official';

export interface ReadablePlace {
  kind: ReadablePlaceKind;
  /** Identificador estable, independent del text traduït. */
  id: string;
  eclipseId: string | null;
  lat: number;
  lon: number;
  label: Record<Locale, string>;
}

const CITY_PLACES: readonly ReadablePlace[] = SEO_CITIES.map((city) => ({
  id: city.id,
  lat: city.lat,
  lon: city.lon,
  label: city.name,
  kind: 'city',
  eclipseId: null,
}));

/** L'id d'un punt oficial ja és únic dins del seu eclipsi: no cal res més. */
function officialPlaces(): ReadablePlace[] {
  const result: ReadablePlace[] = [];
  for (const eclipseId of OBSERVATION_ECLIPSE_IDS) {
    for (const point of pointsForEclipse(eclipseId)) {
      result.push({
        kind: 'official',
        id: point.id,
        eclipseId,
        lat: point.lat,
        lon: point.lon,
        label: point.name,
      });
    }
  }
  return result;
}

export const READABLE_PLACES: readonly ReadablePlace[] = [
  ...CITY_PLACES,
  ...officialPlaces(),
];

/*
 * Aquesta taula era la cinquena còpia dels mateixos segments d'URL, i la
 * duplicació d'aquesta llista ja va costar que 1.328 pàgines quedessin
 * invisibles tres dies (vegeu la capçalera de `content/seo/routes.ts`). Ara el
 * camí el construeix `seoPath()`, que és qui el genera de debò; aquí només
 * queda la traducció d'un nom de mena a l'altre, perquè aquest mòdul en diu
 * «official» i el generador «point».
 */
const KIND_TO_ROUTE: Record<ReadablePlaceKind, SeoKind> = { city: 'city', official: 'point' };

/** Distància suficient per reconèixer el punt, però no per canviar-lo. */
const MATCH_METRES = 20;

function distanceMetres(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const latScale = 111_320;
  const meanLat = ((aLat + bLat) / 2) * (Math.PI / 180);
  const dx = (aLon - bLon) * latScale * Math.cos(meanLat);
  const dy = (aLat - bLat) * latScale;
  return Math.hypot(dx, dy);
}

export function findReadablePlace(params: ShareLinkParams): ReadablePlace | null {
  const candidates = READABLE_PLACES.filter(
    (place) => place.eclipseId === null || place.eclipseId === params.eclipseId,
  );
  let best: ReadablePlace | null = null;
  let bestDistance = Infinity;
  for (const place of candidates) {
    const distance = distanceMetres(params.lat, params.lon, place.lat, place.lon);
    if (distance <= MATCH_METRES && distance < bestDistance) {
      best = place;
      bestDistance = distance;
    }
  }
  return best;
}

/** Path localitzat, sense domini ni query. */
export function readablePlacePath(
  place: ReadablePlace,
  locale: Locale,
  eclipseId?: string | null,
): string {
  const event = place.eclipseId ?? eclipseId ?? null;
  if (event === null) return `/${seoPrefix(locale)}`;
  // Els ids coincideixen amb els del generador estàtic i són estables encara
  // que canviï una traducció del topònim: una adreça compartida no s'ha de
  // trencar perquè algú hagi retocat un nom.
  return seoPath(locale, {
    kind: KIND_TO_ROUTE[place.kind],
    slug: place.id,
    eclipseSlug: eclipseDateSlug(event),
  });
}

/**
 * URL humana quan el punt és curat; URL actual quan és lliure. En tots dos
 * casos `?p=` conserva exactament el punt que l'usuari ha compartit.
 */
export function buildReadableShareUrl(
  params: ShareLinkParams,
  currentUrl: string,
  locale: Locale,
  destinationHash?: string,
): string {
  const url = new URL(currentUrl);
  const place = findReadablePlace(params);
  if (place) url.pathname = readablePlacePath(place, locale, params.eclipseId);
  url.search = buildShareLink(params);
  url.hash = destinationHash ?? url.hash;
  return url.toString();
}
