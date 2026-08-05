/**
 * En quin lloc ets, dit amb paraules.
 *
 * EL PROBLEMA QUE RESOL. L'app ensenyava "43,3619° N, 5,8494° O · 238 m". És
 * exacte i no serveix de res: ningú no sap de memòria quin poble és aquell
 * número, i el número és justament el que decideix l'hora dels contactes, si
 * ets dins la franja i si el terreny et tapa. La xifra ha de continuar-hi —és
 * la dada— però al davant hi ha d'anar una frase que una persona pugui dir en
 * veu alta: "Oviedo / Uviéu" o "a 2,4 km de San Isidro".
 *
 * EL NOM ÉS UN EXTRA I ES NOTA EN COM ESTÀ FET AIXÒ:
 *  · Mentre no se sap, es pinten les coordenades a la línia de dalt. No hi ha
 *    cap buit, cap filadora que ocupi la línia ni cap "carregant…" que la faci
 *    saltar quan arribi el text de debò.
 *  · Si el servei falla o no hi ha xarxa, es queden les coordenades i prou.
 *    Aquest component NO ensenya mai cap error: el nom no és una cosa que
 *    l'usuari pugui arreglar ni que li faci falta per decidir res.
 *  · Cap altra part de la pantalla depèn del que passi aquí.
 *
 * ANTIREBOT. Mentre el mapa es mou no es demana res. La política de ritme viu
 * al mòdul de topònims (`src/core/places/`) i aquí només se li diu si l'usuari
 * encara té el dit a sobre.
 *
 * ATRIBUCIÓ. Surt per defecte i no és decoració: la llicència de les dades
 * l'exigeix, igual que la d'OpenStreetMap al mapa i la de Fred Espenak a les
 * efemèrides. Només es pot apagar quan la pantalla ja la té en un altre lloc
 * visible, i per això hi ha `PlaceNameSource` per posar-la al peu.
 *
 * ACCENT. No en fa servir cap. És estructura, com la barra d'ubicació, i el
 * sistema només deixa un ambre per pantalla, que li toca a la xifra important.
 */

import type { GeoLocation } from '../../core/astro/types';
import { PLACES_ATTRIBUTION } from '../../core/places';
import type { Locale } from '../../i18n';
import { formatCoords, formatDecimal } from '../../screens/format';
import { usePlaceName } from './usePlaceName';
import './PlaceName.css';

/*
 * El ganxo es reexporta des d'aquí perquè el barril del mòdul l'espera en
 * aquest fitxer. Viu a `usePlaceName.ts` i no aquí dins perquè un fitxer que
 * exporta components I funcions trenca la recàrrega en calent de Vite; la
 * reexportació de tipus no en té, de cost.
 */
export { usePlaceName } from './usePlaceName';
export type { PlaceNameState, UsePlaceNameOptions } from './usePlaceName';

/**
 * L'únic text propi d'aquest component.
 *
 * No va a `strings.ts` a posta: és un, i posar-lo al diccionari compartit
 * mentre una altra tasca hi està escrivint només serviria per xocar-hi.
 */
const SEARCHING: Record<Locale, string> = {
  ca: 'Buscant el nom del lloc',
  es: 'Buscando el nombre del lugar',
  en: 'Searching for the place name',
  fr: 'Recherche du nom du lieu',
};

function placeDecimal(value: number, digits: number, locale: Locale): string {
  if (locale !== 'fr') return formatDecimal(value, digits, locale);
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function placeCoords(location: GeoLocation, locale: Locale): string {
  if (locale !== 'fr') return formatCoords(location.lat, location.lon, locale);
  return `${placeDecimal(Math.abs(location.lat), 4, locale)}° ${location.lat >= 0 ? 'N' : 'S'}, ${placeDecimal(Math.abs(location.lon), 4, locale)}° ${location.lon >= 0 ? 'E' : 'O'}`;
}

export interface PlaceNameProps {
  /** `null` mentre no se sap on és l'usuari. Llavors no es pinta res. */
  location: GeoLocation | null;
  locale?: Locale;
  /** Cert mentre l'usuari encara mou el dit pel mapa: no es demana res. */
  moving?: boolean;
  /** Ensenya les coordenades exactes sota el nom. Per defecte, sí. */
  showCoords?: boolean;
  /** Ensenya l'altitud del model del terreny al costat de les coordenades. */
  showElevation?: boolean;
  /** Ensenya l'atribució del servei. Per defecte, sí. Vegeu la capçalera. */
  showSource?: boolean;
  /** Es crida amb el nom cada cop que canvia, per desar-lo a l'estat. */
  onResolved?: (label: string | null) => void;
  className?: string;
}

export function PlaceName({
  location,
  locale = 'ca',
  moving = false,
  showCoords = true,
  showElevation = true,
  showSource = true,
  onResolved,
  className,
}: PlaceNameProps) {
  const { label, loading } = usePlaceName(location, { moving, locale, onResolved });

  if (!location) return null;

  const root = className ? `pname ${className}` : 'pname';
  const coords = placeCoords(location, locale);
  const elevation = showElevation
    ? `${placeDecimal(Math.round(location.elevation), 0, locale)} m`
    : null;

  // Sense nom, les coordenades PUGEN a la línia principal. Així la línia de
  // dalt sempre diu on ets, amb les paraules que hi hagi en aquell moment.
  const primary = label ? label.primary : coords;
  const detail = [label?.secondary ?? null, label ? coords : null, elevation].filter(
    (part): part is string => part !== null && part !== '',
  );

  return (
    <div className={root} aria-busy={loading || undefined}>
      <p className={label ? 'pname__primary' : 'pname__primary eclipsi-data'}>{primary}</p>

      {showCoords && detail.length > 0 && (
        <p className="pname__detail eclipsi-data">{detail.join(' · ')}</p>
      )}

      {/*
        Mentre es busca no es diu "carregant": es diu què s'està fent, i només
        per als lectors de pantalla. A la vista ja hi ha les coordenades, que
        són la resposta bona fins que n'arribi una de millor.
      */}
      {loading && <span className="pname__sr">{SEARCHING[locale]}</span>}

      {showSource && label && <p className="pname__source">{PLACES_ATTRIBUTION}</p>}
    </div>
  );
}

/**
 * L'atribució, sola.
 *
 * Perquè una pantalla la pugui posar al peu, al costat de la d'OpenStreetMap i
 * la de Fred Espenak, en comptes de repetir-la sota de cada nom.
 */
export function PlaceNameSource({ className }: { className?: string }) {
  return (
    <p className={className ? `pname__source ${className}` : 'pname__source'}>
      {PLACES_ATTRIBUTION}
    </p>
  );
}
