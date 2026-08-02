/**
 * La fulla de tria del lloc.
 *
 * QUATRE MANERES DE DIR ON SERÀS, i estan totes quatre aquí perquè cap d'elles
 * serveix sola:
 *
 *   · ON SOC ARA (GPS). Serveix el dia de l'eclipsi, quan ja hi ets. No
 *     serveix per planificar, que és el 99 % del temps que es fa servir l'app.
 *   · CERCAR PEL NOM. És com la gent pensa un lloc («Peníscola»), i depèn de la
 *     xarxa. És la dependència de xarxa que el producte accepta a posta.
 *   · TOCAR EL MAPA. Funciona sense xarxa i és l'única manera d'arribar a un
 *     punt que no té nom: un mirador, un tros de carretera, un cim.
 *   · ESCRIURE LES COORDENADES. Per enganxar-hi un punt que ve d'una altra
 *     banda, i com a xarxa de seguretat de les altres tres.
 *
 * PER QUÈ «ON SOC ARA» NO ÉS EL BOTÓ AMBRE. Perquè no és la resposta bona la
 * majoria de vegades. Tota aquesta app existeix per respondre «què veuràs des
 * d'on SERÀS», i pintar d'accent el botó del GPS diria el contrari. Les tres
 * maneres hi van amb el mateix pes. L'únic accent de la fulla, quan hi és, és
 * la diferència de segons entre dos llocs, que és l'única xifra que decideix
 * alguna cosa.
 */

import { useState, type FormEvent } from 'react';
import { Button, Dialog, IconButton, Input } from '../../ui';
import type { Locale } from '../../i18n';
import { ECLIPSES } from '../../core/eclipses/catalog';
import { PlaceThumbnail } from './PlaceThumbnail';
import { formatCoords } from '../../screens/format';
import type { ObserverApi } from '../../state/useObserver';
import type { RecentPlace } from '../../state/recentPlaces';
import { isSamePlace } from '../../state/location';
import { ComparePanel } from './ComparePanel';
import { ORIGIN_KEY } from './origin';
import { parseCoords } from './coords';
import { ls } from './strings';
import { PLACES_ATTRIBUTION } from './geocoder';
import { usePlaceSearch, type PlaceSearchApi } from './usePlaceSearch';
import type { ComparisonApi } from './useComparison';
import './location.css';

export interface LocationSheetProps {
  locale: Locale;
  observer: ObserverApi;
  comparison: ComparisonApi;
  onClose: () => void;
  /** Porta l'usuari al mapa. Si no es dona, la fulla només ho explica. */
  onGoToMap?: () => void;
  /**
   * Quin eclipsi dibuixen les miniatures de l'historial.
   *
   * `App` JA EL PASSA (segueix el selector de la capçalera); és opcional
   * perquè la fulla també es pugui muntar sola — proves, futurs amfitrions —
   * i llavors el valor per defecte és el primer del catàleg, que és el que
   * mira gairebé tothom que obre l'app.
   */
  eclipseId?: string;
}

export function LocationSheet({
  locale,
  observer,
  comparison,
  onClose,
  onGoToMap,
  eclipseId = ECLIPSES[0].id,
}: LocationSheetProps) {
  // Els resultats s'ordenen prenent com a referència el punt actiu. Hi ha tres
  // Cervera i cinc Villanueva a la península: sense biaix, la primera de la
  // llista és la més poblada, que pot ser a quatre-cents quilòmetres del tros
  // de mapa que estàs mirant.
  const search = usePlaceSearch({
    biasLat: observer.fix?.location.lat,
    biasLon: observer.fix?.location.lon,
  });
  const [coordText, setCoordText] = useState('');
  const [coordError, setCoordError] = useState(false);

  const pick = (
    lat: number,
    lon: number,
    origin: RecentPlace['origin'],
    label: string | null,
  ) => {
    void observer.setPlace({ lat, lon, origin, label });
    onClose();
  };

  const submitCoords = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseCoords(coordText);
    if (parsed === null) {
      setCoordError(true);
      return;
    }
    setCoordError(false);
    pick(parsed.lat, parsed.lon, 'map', null);
  };

  const active = observer.fix?.location ?? null;

  return (
    <Dialog
      title={ls('sheet.title', locale)}
      onClose={onClose}
      closeLabel={ls('sheet.close', locale)}
    >
      <div className="loc-sheet">
        {/* --- 1. el GPS --- */}
        <Button
          variant="secondary"
          icon="crosshair"
          fullWidth
          disabled={observer.loading}
          onClick={observer.locate}
        >
          {observer.loading ? ls('sheet.locating', locale) : ls('sheet.here', locale)}
        </Button>
        {observer.error !== null && (
          <p className="loc__note">{ls(`error.${observer.error}`, locale)}</p>
        )}

        {/* --- 2. el nom --- */}
        <div className="loc-sheet__block">
          <Input
            icon="search"
            type="search"
            label={ls('search.label', locale)}
            placeholder={ls('search.placeholder', locale)}
            value={search.query}
            onChange={search.setQuery}
          />
          {searchNote(search, locale) !== null && (
            <p className="loc__note">{searchNote(search, locale)}</p>
          )}
          {search.hits.length > 0 && (
            <>
              <ul className="loc-list">
                {search.hits.map((hit) => (
                  <li key={hit.id} className="loc-list__item">
                    <button
                      type="button"
                      className="loc-list__main"
                      onClick={() => pick(hit.lat, hit.lon, 'search', hit.name)}
                    >
                      <span className="loc-list__name">{hit.name}</span>
                      <span className="loc-list__meta">
                        {/* El tipus va davant del context: qui busca horitzó
                            de ponent vol distingir el port del poble de la
                            vall abans de llegir la comarca. */}
                        {hit.kind === 'peak' && `${ls('kind.peak', locale)} · `}
                        {hit.detail ?? formatCoords(hit.lat, hit.lon)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {/* Atribució obligatòria per llicència de les dades, igual que
                  la d'OpenStreetMap al mapa i la de Fred Espenak a les
                  efemèrides. Va al costat del que atribueix. */}
              <p className="loc__note">{PLACES_ATTRIBUTION}</p>
            </>
          )}
        </div>

        {/* --- 3. el mapa --- */}
        <div className="loc-sheet__block">
          <p className="loc__note">{ls('sheet.mapHint', locale)}</p>
          {onGoToMap && (
            <Button
              variant="ghost"
              size="sm"
              icon="map"
              onClick={() => {
                onGoToMap();
                onClose();
              }}
            >
              {ls('bar.open', locale)}
            </Button>
          )}
        </div>

        {/* --- 4. les coordenades --- */}
        <form className="loc-sheet__block" onSubmit={submitCoords}>
          <Input
            icon="map-pin"
            label={ls('sheet.coords', locale)}
            placeholder="41.3851, 2.1734"
            hint={ls('sheet.coordsHint', locale)}
            error={coordError ? ls('sheet.coordsBad', locale) : undefined}
            value={coordText}
            onChange={(next) => {
              setCoordText(next);
              setCoordError(false);
            }}
          />
          <Button type="submit" variant="ghost" size="sm">
            {ls('sheet.use', locale)}
          </Button>
        </form>

        {/* --- 5. l'historial --- */}
        <div className="loc-sheet__block">
          <span className="loc-sheet__head">{ls('sheet.recents', locale)}</span>
          {observer.recents.length === 0 ? (
            <p className="loc__note">{ls('sheet.recentsEmpty', locale)}</p>
          ) : (
            <ul className="loc-list">
              {observer.recents.map((place) => {
                const here =
                  active !== null &&
                  isSamePlace(active, {
                    lat: place.lat,
                    lon: place.lon,
                    elevation: place.elevation,
                  });
                return (
                  <li
                    key={`${place.lat},${place.lon}`}
                    className={here ? 'loc-list__item loc-list__item--on' : 'loc-list__item'}
                  >
                    {/*
                      LA MINIATURA VA DINS DEL BOTÓ, no al costat. Fora, seria
                      una imatge que es veu però no es pot prémer, i el dit hi
                      va justament perquè és el que distingeix una fila de
                      l'altra. Dins, la superfície de toc creix en comptes
                      d'encongir-se, i els 44 px d'alçada mínima segueixen
                      sortint de `--tap-min` i no de la mida de la imatge.
                    */}
                    <button
                      type="button"
                      className="loc-list__main loc-list__main--thumb"
                      onClick={() => pick(place.lat, place.lon, 'recent', place.label)}
                    >
                      <PlaceThumbnail
                        place={{
                          lat: place.lat,
                          lon: place.lon,
                          elevation: place.elevation,
                        }}
                        eclipseId={eclipseId}
                        locale={locale}
                      />
                      <span className="loc-list__text">
                        <span className="loc-list__name">
                          {place.label ?? formatCoords(place.lat, place.lon)}
                        </span>
                        <span className="loc-list__meta">
                          {ls(ORIGIN_KEY[place.origin], locale)}
                          {place.label !== null && ` · ${formatCoords(place.lat, place.lon)}`}
                        </span>
                      </span>
                    </button>

                    {/* Comparar amb el lloc actiu. No té sentit comparar-lo
                        amb ell mateix, i per això a la fila activa no hi surt. */}
                    {!here && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => comparison.compareWith(place)}
                      >
                        {ls('sheet.compareWith', locale)}
                      </Button>
                    )}
                    <IconButton
                      icon="x"
                      variant="ghost"
                      size="sm"
                      label={ls('sheet.forget', locale)}
                      onClick={() =>
                        observer.forget({
                          lat: place.lat,
                          lon: place.lon,
                          elevation: place.elevation,
                        })
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* --- 6. la comparació --- */}
        {comparison.other !== null && comparison.result !== null && (
          <ComparePanel
            locale={locale}
            result={comparison.result}
            aLabel={observer.fix?.label ?? null}
            bLabel={comparison.other.label}
            onUseOther={() => {
              const other = comparison.other;
              if (other === null) return;
              comparison.clear();
              pick(other.lat, other.lon, 'recent', other.label);
            }}
            onClear={comparison.clear}
          />
        )}
        {comparison.other === null && observer.recents.length > 1 && (
          <p className="loc__note">{ls('compare.pick', locale)}</p>
        )}
      </div>
    </Dialog>
  );
}

/** La frase que acompanya la cerca. Null quan no cal dir res. */
function searchNote(search: PlaceSearchApi, locale: Locale): string | null {
  if (search.loading) return ls('search.searching', locale);
  switch (search.outcome) {
    case 'offline':
      return ls('search.offline', locale);
    case 'failed':
      return ls('search.failed', locale);
    case 'empty':
      return ls('search.empty', locale);
    default:
      // `ok` no diu res —els resultats parlen sols— i `superseded` tampoc:
      // vol dir que n'hi ha una altra de camí.
      return null;
  }
}
