/**
 * Rutes humanes per als llocs que l'aplicació coneix de manera canònica.
 *
 * El slug només identifica el lloc; les coordenades de `?p=` continuen sent la
 * font de precisió. Així una ruta es pot llegir i compartir sense convertir un
 * topònim (ni una coordenada oficial estimada) en una promesa de precisió.
 */
import {
  OBSERVATION_ECLIPSE_IDS,
  pointsForEclipse,
} from '../../data/observation-points/catalog';
import { SEO_CITIES } from '../../content/seo/cities';
import { eclipseDateSlug, eclipseIdFromSlug } from '../../content/seo/dateSlug';
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
  slug: Record<Locale, string>;
}

/** Slug Unicode determinista. No accepta text de l'URL com a identitat. */
export function readableSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function translatedSlugs(label: Record<Locale, string>): Record<Locale, string> {
  return {
    ca: readableSlug(label.ca),
    es: readableSlug(label.es),
    en: readableSlug(label.en),
    fr: readableSlug(label.fr),
  };
}

const CITY_PLACES: readonly ReadablePlace[] = SEO_CITIES.map((city) => ({
  id: city.id,
  lat: city.lat,
  lon: city.lon,
  label: city.name,
  kind: 'city',
  eclipseId: null,
  slug: translatedSlugs(city.name),
}));

/*
 * Un id oficial ja és únic dins de l'eclipsi. El prefix administratiu evita
 * col·lisions entre dos recintes amb el mateix nom sense embrutar el slug que
 * veu la majoria; només s'afegeix l'id quan la traducció col·lideix.
 */
function officialPlaces(): ReadablePlace[] {
  const result: ReadablePlace[] = [];
  for (const eclipseId of OBSERVATION_ECLIPSE_IDS) {
    const points = pointsForEclipse(eclipseId);
    for (const point of points) {
      const slugs = translatedSlugs(point.name);
      for (const language of ['ca', 'es', 'en', 'fr'] as const) {
        const duplicates = points.filter(
          (candidate) => readableSlug(candidate.name[language]) === slugs[language],
        ).length;
        if (duplicates > 1) slugs[language] = `${slugs[language]}--${point.id}`;
      }
      result.push({
        kind: 'official',
        id: point.id,
        eclipseId,
        lat: point.lat,
        lon: point.lon,
        label: point.name,
        slug: slugs,
      });
    }
  }
  return result;
}

export const READABLE_PLACES: readonly ReadablePlace[] = [
  ...CITY_PLACES,
  ...officialPlaces(),
];

const SEGMENT: Record<Locale, Record<ReadablePlaceKind, string>> = {
  ca: { city: 'ciutat', official: 'punt-oficial' },
  es: { city: 'ciudad', official: 'punto-oficial' },
  en: { city: 'city', official: 'official-site' },
  fr: { city: 'ville', official: 'site-officiel' },
};

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
  const language = locale === 'ca' ? '' : `${locale}/`;
  const event = place.eclipseId ?? eclipseId ?? null;
  if (event === null) return `/${language}`;
  // Els ids coincideixen amb els del generador estàtic i són estables encara
  // que canviï una traducció del topònim.
  return `/${language}${SEGMENT[locale][place.kind]}/${place.id}/${eclipseDateSlug(event)}/`;
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

/** Resol una ruta curada. No llegeix ni confia en cap etiqueta de la query. */
export function resolveReadablePlacePath(pathname: string): {
  place: ReadablePlace;
  locale: Locale;
} | null {
  const clean = `/${pathname.split('/').filter(Boolean).join('/')}/`;
  for (const locale of ['ca', 'es', 'en', 'fr'] as const) {
    for (const kind of ['city', 'official'] as const) {
      const segment = SEGMENT[locale][kind];
      const routePrefix = locale === 'ca' ? `/${segment}/` : `/${locale}/${segment}/`;
      if (!clean.startsWith(routePrefix)) continue;
      const [id, eclipseSlug] = clean.slice(routePrefix.length, -1).split('/');
      const eclipseId = eclipseSlug ? eclipseIdFromSlug(eclipseSlug) : null;
      const place = READABLE_PLACES.find((entry) => entry.kind === kind && entry.id === id);
      if (!place || !eclipseId || (place.eclipseId !== null && place.eclipseId !== eclipseId)) return null;
      return { place, locale };
    }
  }
  return null;
}
