/**
 * Mapa de la franja de centralitat amb MapLibre GL.
 *
 * Dues decisions que expliquen com està fet:
 *
 * 1. Fons de mapa SENSE clau d'API. Estil mínim definit aquí mateix, amb la
 *    cartografia fosca de CARTO sobre dades d'OpenStreetMap. Cap servei de
 *    pagament, cap registre, cap token que caduqui. L'atribució d'OSM és
 *    obligatòria per llicència i és visible sempre, igual que la de les
 *    efemèrides de la NASA.
 *
 * 2. En tocar el mapa, les circumstàncies es calculen al moment i de manera
 *    síncrona. `computeLocalCircumstances` triga uns 10 ms: posar-hi un worker
 *    o un estat de càrrega només afegiria latència percebuda i codi.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatObscurationPercent } from '../../core/astro/obscuration';
import { BASEMAP } from '../../offline/config';
import {
  type GeoJSONSource,
  LngLatBounds,
  Marker,
  NavigationControl,
  ScaleControl,
  MapLibreMap,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './map.css';

import { Icon } from '../../ui';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import type { EclipseSample, GeoLocation } from '../../core/astro/types';
import { getEclipse } from '../../core/eclipses/catalog';
import {
  computeEclipsePath,
  eclipsePathToGeoJson,
  ESPENAK_ATTRIBUTION,
  type EclipsePathGeoJson,
} from '../../core/eclipses/path';

interface Props {
  eclipseId: string;
  /**
   * Es crida amb el punt tocat. L'elevació arriba a zero: qui té l'estat de
   * l'observador és qui ha de resoldre-la contra el model del terreny, que és
   * una operació de xarxa i no toca fer-la des d'aquí.
   */
  onPickLocation?: (loc: GeoLocation) => void;
}

/** Atribució d'OSM, obligatòria per llicència. */
const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

/**
 * Cartografia base fosca de CARTO.
 *
 * DUES RAONS PER NO FER SERVIR LES TESSEL·LES D'OPENSTREETMAP DIRECTAMENT:
 *
 * 1. DE DISSENY. Les d'OSM són clares, i aquesta app es mira al capvespre amb
 *    l'ull adaptat a la foscor. Abans les apagàvem per força bruta amb
 *    `raster-brightness-max: 0.62`, i el resultat era una cartografia enfangada
 *    amb els topònims a mig llegir: no és el mateix apagar un mapa clar que fer
 *    servir un mapa dissenyat per ser fosc. El sistema de disseny especifica
 *    CARTO dark, i el kit de referència també.
 *
 * 2. DE POLÍTICA D'ÚS. La política de tessel·les d'OpenStreetMap prohibeix
 *    explícitament que les aplicacions les consumeixin del seu servidor sense
 *    permís, i bloqueja per volum. Els seus servidors els paga una fundació amb
 *    donacions; no són una API pública.
 *
 * L'atribució d'OpenStreetMap segueix sent obligatòria: les dades són seves,
 * el que canvia és qui serveix les imatges.
 */
const BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    basemap: {
      type: 'raster',
      /*
       * UN SOL AMFITRIÓ, I SURT DE `offline/config`.
       *
       * Aquí hi havia les tres còpies amb subdomini rotatiu (a/b/c). Cada una
       * és una URL diferent, i les memòries cau es claven a la URL sencera: el
       * que la precàrrega desava per al viatge no el trobava mai ningú. El
       * rotatiu de subdominis va servir de res des que existeix HTTP/2, que
       * multiplexa sobre una sola connexió.
       */
      tiles: [BASEMAP.urlTemplate],
      tileSize: 256,
      maxzoom: BASEMAP.maxZoom,
      attribution: OSM_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: 'basemap',
      type: 'raster',
      source: 'basemap',
      // Ja és fosca de mena: només se li puja una mica el contrast perquè la
      // franja ambre hi destaqui sense haver d'enfosquir res.
      paint: {
        'raster-contrast': 0.08,
      },
    },
  ],
};

const BAND_SOURCE = 'eclipse-band';
const LIMITS_SOURCE = 'eclipse-limits';
const CENTER_SOURCE = 'eclipse-center';

/*
 * Els colors del sistema de disseny, repetits aquí perquè MapLibre pinta en
 * WebGL i no veu les variables de CSS. Han de coincidir amb els tokens.
 *
 * Un sol accent ambre per pantalla: aquí és la franja, que és l'única cosa del
 * mapa que respon la pregunta del producte. La línia central va en to corona i
 * no en un segon color, i el tipus d'eclipsi (total o anular) es diu amb
 * lletres al panell en comptes de codificar-lo amb un color més.
 */
/** --sun-500 */
const COLOR_BAND = '#FFA51F';
/** --corona-100 */
const COLOR_CENTER = '#F5F0E4';

/** Enquadrament inicial: Península, Balears i el llindar de l'Estret. */
const IBERIA_BOUNDS = new LngLatBounds([-10.2, 34.8], [4.6, 44.2]);

const emptyFeatureCollection = {
  type: 'FeatureCollection' as const,
  features: [],
};

/**
 * Aboca la franja al mapa, creant les capes si encara no hi són.
 *
 * Aquesta funció és el punt únic on es toca l'estil, i és idempotent a posta.
 * MapLibre només accepta capes quan l'estil ja ha carregat, i React amb
 * StrictMode munta el component dues vegades: si la creació de les capes i
 * l'assignació de les dades visquessin en efectes separats coordinats per un
 * estat, hi hauria una carrera en què el `load` d'un mapa ja destruït marca com
 * a llest un mapa nou que encara no té les fonts. El resultat és un mapa que
 * carrega però es queda sense franja, i sense cap error a la consola.
 */
function applyPath(map: MapLibreMap, geojson: EclipsePathGeoJson): void {
  if (map.getSource(BAND_SOURCE) === undefined) {
    map.addSource(BAND_SOURCE, { type: 'geojson', data: emptyFeatureCollection });
    map.addSource(LIMITS_SOURCE, { type: 'geojson', data: emptyFeatureCollection });
    map.addSource(CENTER_SOURCE, { type: 'geojson', data: emptyFeatureCollection });

    map.addLayer({
      id: 'band-fill',
      type: 'fill',
      source: BAND_SOURCE,
      paint: { 'fill-color': COLOR_BAND, 'fill-opacity': 0.16 },
    });
    map.addLayer({
      id: 'band-edge',
      type: 'line',
      source: LIMITS_SOURCE,
      paint: { 'line-color': COLOR_BAND, 'line-width': 1.5, 'line-opacity': 0.95 },
    });
    map.addLayer({
      id: 'center-line',
      type: 'line',
      source: CENTER_SOURCE,
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': COLOR_CENTER,
        'line-width': 1.5,
        'line-opacity': 0.85,
        'line-dasharray': [3, 3],
      },
    });
  }

  (map.getSource(BAND_SOURCE) as GeoJSONSource).setData(geojson.band);
  (map.getSource(LIMITS_SOURCE) as GeoJSONSource).setData(geojson.limits);
  (map.getSource(CENTER_SOURCE) as GeoJSONSource).setData(geojson.centerLine);
}

export function EclipseMap({ eclipseId, onPickLocation }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [picked, setPicked] = useState<GeoLocation | null>(null);

  // El handler del clic es registra una sola vegada; el callback del pare pot
  // canviar a cada render, així que hi arriba per referència.
  const onPickRef = useRef(onPickLocation);
  onPickRef.current = onPickLocation;

  const eclipse = getEclipse(eclipseId);

  // La franja només depèn de l'eclipsi. Generar-la val ~30 ms: es memoritza
  // perquè no es refaci a cada clic.
  const geojson = useMemo(
    () => eclipsePathToGeoJson(computeEclipsePath(eclipseId)),
    [eclipseId],
  );

  // El `load` del mapa pot arribar abans o després d'un canvi d'eclipsi; agafa
  // sempre la darrera franja calculada, no la que hi havia quan es va crear.
  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;

  const circumstances = useMemo(
    () => (picked === null ? null : computeLocalCircumstances(eclipseId, picked)),
    [eclipseId, picked],
  );

  // --- Creació del mapa (una sola vegada) ---
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        // L'estil es clona: MapLibre es reserva el dret de modificar l'objecte
        // que rep, i aquest és una constant compartida entre muntatges.
        style: structuredClone(BASEMAP_STYLE),
        bounds: IBERIA_BOUNDS,
        fitBoundsOptions: { padding: 16 },
        // L'atribució per defecte es plega en un botó "i" en pantalles
        // estretes; aquí la volem sempre desplegada perquè és obligatòria.
        attributionControl: {
          compact: false,
          customAttribution: ESPENAK_ATTRIBUTION,
        },
      });
    } catch (err) {
      setMapError(
        `No s'ha pogut inicialitzar el mapa (cal WebGL): ${(err as Error).message}`,
      );
      return;
    }

    mapRef.current = map;

    /*
     * REDIMENSIONAR QUAN CANVIÏ LA CAIXA, I NO NOMÉS QUAN CANVIÏ LA FINESTRA.
     *
     * MapLibre només escolta el `resize` de la finestra. Al mòbil això no
     * n'hi ha prou i el símptoma és brutal: si el contenidor arriba a existir
     * amb alçada zero —perquè la cadena de flexbox encara no s'ha resolt, o
     * perquè la barra d'adreces del navegador encara s'està plegant— el mapa
     * es construeix amb una transformació degenerada, no demana cap tessel·la
     * i no torna a intentar-ho mai. El resultat és un mapa en blanc, sense cap
     * error a la consola, que a l'escriptori no passa perquè allà la caixa ja
     * té mida des del primer instant.
     *
     * Amb un observador de mida, cada canvi de caixa el reajusta i n'hi ha
     * prou amb un per treure'l del clot.
     */
    /*
     * I L'ENQUADRAMENT ES REFÀ, QUE ÉS LA MEITAT QUE FALTAVA.
     *
     * `resize()` ajusta el llenç però NO toca el centre ni el zoom: els va
     * calcular `fitBounds` a la construcció, contra la caixa que hi havia
     * llavors. Mesurat al navegador amb la pantalla del mapa acabada d'obrir:
     * centre a 10,41° O / 36,78° N i zoom 4,55 —o sigui l'oceà al sud-oest de
     * Portugal— quan l'enquadrament bo de la Península és 2,80° O / 39,66° N a
     * zoom 5,68. La franja quedava fora de la vista i el mapa semblava trencat.
     *
     * Per això no n'hi ha prou d'observar la mida: el primer cop que la caixa
     * té una mida creïble s'ha de tornar a enquadrar. Després ja no, que seria
     * arrabassar-li el mapa a qui l'estigui movent.
     */
    let framed = container.clientWidth > 100 && container.clientHeight > 100;
    let sizeWatcher: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      sizeWatcher = new ResizeObserver(() => {
        map.resize();
        if (framed) return;
        if (container.clientWidth <= 100 || container.clientHeight <= 100) return;
        framed = true;
        map.fitBounds(IBERIA_BOUNDS, { padding: 16, duration: 0 });
      });
      sizeWatcher.observe(container);
    }

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');

    // `style.load` arriba tan bon punt l'estil és utilitzable; `load` espera a
    // més que hi hagi tessel·les carregades i, si la xarxa va justa, pot trigar
    // molt o no arribar mai. La franja no ha d'esperar les tessel·les.
    map.on('style.load', () => applyPath(map, geojsonRef.current));

    /*
     * ELS ERRORS DEL MAPA ES DEIXEN VEURE.
     *
     * No hi havia cap `error`: sense xarxa, o amb el proveïdor de tessel·les
     * caigut, el mapa es quedava negre i no ho deia. Un mapa en blanc és
     * indistingible d'un mapa trencat, i l'usuari no té manera de saber si ha
     * d'esperar, reintentar o mirar-s'ho d'una altra manera.
     *
     * Les tessel·les que fallen no compten: n'hi ha centenars i que en falli
     * alguna als marges és normal. El que es diu és quan falla l'estil, que és
     * quan de veritat no hi ha mapa.
     */
    map.on('error', (event) => {
      const source = (event as { sourceId?: string }).sourceId;
      if (source !== undefined) return;
      setMapError('No s’ha pogut carregar la cartografia. Comprova la connexió.');
    });

    map.on('click', (event) => {
      const { lat, lng } = event.lngLat;
      // La longitud pot venir de una còpia del món si l'usuari ha arrossegat
      // fora de ±180°; es normalitza abans de calcular res.
      const lon = ((((lng + 180) % 360) + 360) % 360) - 180;
      const location: GeoLocation = { lat, lon, elevation: 0 };

      setPicked(location);
      onPickRef.current?.(location);

      if (markerRef.current === null) {
        const element = document.createElement('div');
        element.className = 'map__pin';
        markerRef.current = new Marker({ element }).setLngLat([lng, lat]).addTo(map);
      } else {
        markerRef.current.setLngLat([lng, lat]);
      }
    });

    return () => {
      sizeWatcher?.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- Canvi d'eclipsi ---
  useEffect(() => {
    const map = mapRef.current;
    // Si encara no hi ha font, l'estil no ha carregat i ja se n'encarregarà el
    // handler de `style.load`, que llegeix la franja per referència.
    if (map === null || map.getSource(BAND_SOURCE) === undefined) return;
    applyPath(map, geojson);
  }, [geojson]);

  const central = eclipse.kind === 'annular' ? 'anularitat' : 'totalitat';

  return (
    <div className="map">
      <div className="map__canvas" ref={containerRef} />

      {mapError !== null && <p className="warn">{mapError}</p>}

      <div className="map__legend">
        <span className="map__legend-item">
          <span className="map__swatch" aria-hidden="true" />
          Franja de {central}
        </span>
        <span className="map__legend-item">
          <span className="map__swatch map__swatch--line" aria-hidden="true" />
          Línia central
        </span>
      </div>

      <p className="map__credits">
        Cartografia {'© '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          col·laboradors d’OpenStreetMap
        </a>
        {' · '}
        {ESPENAK_ATTRIBUTION}
      </p>

      {circumstances === null ? (
        <p className="map__hint">
          <Icon name="crosshair" size={18} aria-hidden="true" />
          <span>
            Toca qualsevol punt del mapa i hi calcularem l’eclipsi: si hi ha{' '}
            {central}, quanta estona dura i a quina hora. Dins de la franja
            pintada la fase central és visible; fora, l’eclipsi és només parcial.
          </span>
        </p>
      ) : (
        <CircumstancesPanel
          circumstances={circumstances}
          annular={circumstances.kind === 'annular'}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panell de resultats
// ---------------------------------------------------------------------------

const fmtTime = (d: Date) =>
  d.toLocaleTimeString('ca-ES', {
    timeZone: 'Europe/Madrid',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const fmtDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m} min ${s.toString().padStart(2, '0')} s` : `${s} s`;
};

const KIND_LABEL: Record<string, string> = {
  total: 'Total',
  annular: 'Anular',
  partial: 'Parcial',
  none: 'No visible',
};

interface PanelProps {
  circumstances: ReturnType<typeof computeLocalCircumstances>;
  annular: boolean;
}

/**
 * Panell de circumstàncies del punt tocat.
 *
 * No defineix cap targeta pròpia: reutilitza `.verdict` i `.contacts` de
 * `src/index.css`, que són les mateixes que fa servir la vista de simulació.
 * Que les dues pantalles responguin igual la mateixa pregunta no és estalvi de
 * CSS, és que hagin de ser reconeixibles com la mateixa dada.
 */
function CircumstancesPanel({ circumstances, annular }: PanelProps) {
  const { contacts, kind, location } = circumstances;
  const central = kind === 'total' || kind === 'annular';

  const rows: [string, EclipseSample | undefined][] = [
    ['C1 · inici parcial', contacts.c1],
    [annular ? 'C2 · inici anularitat' : 'C2 · inici totalitat', contacts.c2],
    ['Màxim', contacts.max],
    [annular ? 'C3 · fi anularitat' : 'C3 · fi totalitat', contacts.c3],
    ['C4 · fi parcial', contacts.c4],
  ];

  return (
    <section>
      <header className={`verdict verdict--${kind}`}>
        <span className="verdict__kind">{KIND_LABEL[kind]}</span>
        {central && (
          <span className="verdict__dur">
            {fmtDuration(circumstances.centralDurationSec)}
          </span>
        )}
        <span className="verdict__obsc">
          {formatObscurationPercent(contacts.max.obscuration, central)} del disc solar tapat al màxim
        </span>
      </header>

      <p className="map__coords">
        {location.lat.toFixed(4)}° {location.lon.toFixed(4)}° · al nivell del mar
      </p>

      {kind === 'none' ? (
        <p className="note">Des d’aquest punt no es veu res de l’eclipsi.</p>
      ) : (
        <>
          <table className="contacts">
            <tbody>
              {rows.map(([label, sample]) =>
                sample ? (
                  <tr key={label}>
                    <td className="contacts__label">{label}</td>
                    <td className="contacts__time">{fmtTime(sample.time)}</td>
                    <td className="contacts__alt">
                      {sample.sun.altitudeApparent.toFixed(1)}°
                    </td>
                    <td className="contacts__az">{sample.sun.azimuth.toFixed(0)}°</td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
          <p className="map__footnote">
            Hores locals peninsulars. Les dues darreres columnes són l’altura i
            l’azimut del Sol.
          </p>
        </>
      )}

      {circumstances.sunBelowHorizonDuringEvent && (
        <p className="warn">
          Alguna de les fases passa amb el Sol sota l’horitzó: des d’aquí no es
          veurà l’eclipsi sencer.
        </p>
      )}

      {central && contacts.max.sun.altitudeApparent < 10 && (
        <p className="warn">
          Sol a {contacts.max.sun.altitudeApparent.toFixed(1)}° al màxim. A aquesta
          altura mana el relleu cap a ponent, no el mapa: cal comprovar l’horitzó
          real del punt.
        </p>
      )}
    </section>
  );
}
