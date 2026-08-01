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
import type { Locale } from '../../i18n';
import { s, type StringKey } from '../../screens/strings';
import { formatClock, formatDecimal, formatDuration } from '../../screens/format';
import {
  computeEclipsePath,
  eclipsePathToGeoJson,
  ESPENAK_ATTRIBUTION,
  type EclipsePathGeoJson,
} from '../../core/eclipses/path';

interface Props {
  eclipseId: string;
  /**
   * Idioma actiu. Arriba per propietat i no d'un hook perquè aquest component
   * el munta `MapScreen`, que ja el té: passar-lo avall és una línia i evita
   * que el mapa depengui d'un context que als tests no sempre hi és.
   */
  locale: Locale;
  /**
   * Es crida amb el punt tocat. L'elevació arriba a zero: qui té l'estat de
   * l'observador és qui ha de resoldre-la contra el model del terreny, que és
   * una operació de xarxa i no toca fer-la des d'aquí.
   */
  onPickLocation?: (loc: GeoLocation) => void;
  /**
   * On és l'usuari, si ja ho ha dit.
   *
   * Serveix per a l'enquadrament inicial: si el seu punt queda fora de la
   * franja —que és el cas en què el mapa serveix de debò, perquè llavors ha de
   * decidir si s'hi acosta— ha de sortir a la vista juntament amb la banda.
   */
  observer?: GeoLocation | null;
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

/** Marc de referència: Península, Balears i el llindar de l'Estret. */
const IBERIA_BOUNDS = new LngLatBounds([-10.2, 34.8], [4.6, 44.2]);

/**
 * Enquadrament que ensenya LA FRANJA, no el país.
 *
 * PER QUÈ NO N'HI HA PROU AMB LA PENÍNSULA. La franja és una diagonal estreta
 * que en creua un tros; enquadrant tot Espanya, la banda queda com un fil en un
 * racó i el mapa no respon la pregunta que se li fa, que és «per on passa i
 * quant en queda lluny». S'enquadra el tros de franja que cau dins del marc de
 * referència, i si el punt de l'usuari en queda fora —que és el cas
 * interessant, perquè llavors ha de decidir si s'hi acosta— també s'hi inclou.
 *
 * Si la franja no toca la finestra (l'eclipsi del 2027 passa molt al sud), es
 * cau al marc de sempre en comptes d'enquadrar el no-res.
 */
function frameFor(
  geojson: EclipsePathGeoJson,
  observer: GeoLocation | null,
): LngLatBounds {
  const bounds = new LngLatBounds();
  let any = false;

  for (const [lon, lat] of geojson.band.geometry.coordinates[0] ?? []) {
    if (lon < -10.2 || lon > 4.6 || lat < 34.8 || lat > 44.2) continue;
    bounds.extend([lon, lat]);
    any = true;
  }

  if (!any) return IBERIA_BOUNDS;
  if (observer) bounds.extend([observer.lon, observer.lat]);
  return bounds;
}

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

/**
 * Què ha fallat del mapa.
 *
 * ES GUARDA LA CAUSA, NO LA FRASE. El mapa es construeix dins d'un efecte que
 * s'executa una sola vegada, així que una frase ja traduïda hi quedaria clavada
 * a l'idioma que hi havia en aquell instant: canviar de llengua deixava l'avís
 * en català per sempre. Amb la causa, el text el decideix el render.
 */
type MapFailure = { reason: 'webgl'; detail: string } | { reason: 'tiles' };

export function EclipseMap({
  eclipseId,
  locale,
  onPickLocation,
  observer = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [mapError, setMapError] = useState<MapFailure | null>(null);
  const [picked, setPicked] = useState<GeoLocation | null>(null);

  // El handler del clic es registra una sola vegada; el callback del pare pot
  // canviar a cada render, així que hi arriba per referència.
  const onPickRef = useRef(onPickLocation);
  onPickRef.current = onPickLocation;
  const observerRef = useRef(observer);
  observerRef.current = observer;

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
        /*
         * NO S'ENQUADRA A LA CONSTRUCCIÓ. MAI.
         *
         * `bounds` + `fitBoundsOptions` es resolen amb la caixa que hi hagi en
         * aquell instant, i al mòbil aquella caixa sovint encara no existeix.
         * Amb amplada zero i un marge de quaranta píxels, l'espai disponible
         * surt negatiu i el centre i el zoom surten indefinits: el mapa neix
         * trencat i no se'n recupera. Es neix amb un centre i un zoom
         * qualssevol però VÀLIDS, i s'enquadra de debò quan la caixa existeix
         * (vegeu l'observador de mida, unes línies més avall).
         */
        center: [-3.5, 40.0],
        zoom: 5,
        // L'atribució per defecte es plega en un botó "i" en pantalles
        // estretes; aquí la volem sempre desplegada perquè és obligatòria.
        attributionControl: {
          compact: false,
          customAttribution: ESPENAK_ATTRIBUTION,
        },
      });
    } catch (err) {
      setMapError({ reason: 'webgl', detail: (err as Error).message });
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
    let framed = false;
    const frameIfPossible = (): void => {
      if (framed) return;
      // Marge inclòs: enquadrar contra una caixa que amb prou feines hi cap
      // dona el mateix problema que enquadrar contra una de buida.
      if (container.clientWidth <= 120 || container.clientHeight <= 120) return;
      framed = true;
      map.fitBounds(frameFor(geojsonRef.current, observerRef.current), {
        // Amb la franja enquadrada de costat a costat, setze píxels la
        // deixaven tocant les vores.
        padding: 40,
        duration: 0,
      });
    };

    frameIfPossible();
    let sizeWatcher: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      sizeWatcher = new ResizeObserver(() => {
        map.resize();
        frameIfPossible();
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
      setMapError({ reason: 'tiles' });
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

  const annular = eclipse.kind === 'annular';
  const central = s(annular ? 'map.centralAnnular' : 'map.centralTotal', locale);

  return (
    <div className="map">
      <div className="map__canvas" ref={containerRef} />

      {mapError !== null && (
        <p className="warn">
          {mapError.reason === 'webgl'
            ? s('map.webglFailed', locale, { error: mapError.detail })
            : s('map.tilesFailed', locale)}
        </p>
      )}

      <div className="map__legend">
        <span className="map__legend-item">
          <span className="map__swatch" aria-hidden="true" />
          {s(annular ? 'map.legendBandAnnular' : 'map.legendBandTotal', locale)}
        </span>
        <span className="map__legend-item">
          <span className="map__swatch map__swatch--line" aria-hidden="true" />
          {s('map.legend.center', locale)}
        </span>
      </div>

      <p className="map__credits">
        {s('map.creditsMap', locale)} {'© '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          {s('map.creditsOsm', locale)}
        </a>
        {' · '}
        {ESPENAK_ATTRIBUTION}
      </p>

      {circumstances === null ? (
        <p className="map__hint">
          <Icon name="crosshair" size={18} aria-hidden="true" />
          <span>{s('map.pickPrompt', locale, { central })}</span>
        </p>
      ) : (
        <CircumstancesPanel
          circumstances={circumstances}
          annular={circumstances.kind === 'annular'}
          locale={locale}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panell de resultats
// ---------------------------------------------------------------------------

/*
 * AQUÍ HI HAVIA UN `fmtTime` I UN `fmtDuration` PROPIS, i els dos mentien.
 *
 * El primer clavava `Europe/Madrid`: a les Canàries el mateix contacte sortia
 * amb una hora de més que a la taula d'efemèrides de la fitxa del costat, o
 * sigui dues hores diferents per al mateix instant a la mateixa pantalla. El
 * segon escrivia «3 min 00 s» on la resta de l'app escriu «3 min».
 *
 * Ara tot passa per `screens/format`, que és on viu la regla. Vegeu-hi el
 * comentari de `formatClock` sobre per què la zona és la del dispositiu.
 */

interface PanelProps {
  circumstances: ReturnType<typeof computeLocalCircumstances>;
  annular: boolean;
  locale: Locale;
}

/**
 * Panell de circumstàncies del punt tocat.
 *
 * No defineix cap targeta pròpia: reutilitza `.verdict` i `.contacts` de
 * `src/index.css`, que són les mateixes que fa servir la vista de simulació.
 * Que les dues pantalles responguin igual la mateixa pregunta no és estalvi de
 * CSS, és que hagin de ser reconeixibles com la mateixa dada.
 */
function CircumstancesPanel({ circumstances, annular, locale }: PanelProps) {
  const { contacts, kind, location } = circumstances;
  const central = kind === 'total' || kind === 'annular';

  // Les etiquetes dels contactes són les mateixes que fa servir la taula
  // d'efemèrides de les pantalles: la mateixa fila no es pot dir de dues
  // maneres segons quin component la pinti.
  const rows: [StringKey, EclipseSample | undefined][] = [
    ['web.c1', contacts.c1],
    [annular ? 'web.c2annular' : 'web.c2total', contacts.c2],
    ['web.max', contacts.max],
    [annular ? 'web.c3annular' : 'web.c3total', contacts.c3],
    ['web.c4', contacts.c4],
  ];

  return (
    <section>
      <header className={`verdict verdict--${kind}`}>
        <span className="verdict__kind">{s(`kind.${kind}` as 'kind.total', locale)}</span>
        {central && (
          <span className="verdict__dur">
            {formatDuration(circumstances.centralDurationSec)}
          </span>
        )}
        <span className="verdict__obsc">
          {s('map.obscuredAtMax', locale, {
            pct: formatObscurationPercent(contacts.max.obscuration, central),
          })}
        </span>
      </header>

      <p className="map__coords">
        {formatDecimal(location.lat, 4, locale)}°{' '}
        {formatDecimal(location.lon, 4, locale)}° · {s('map.seaLevel', locale)}
      </p>

      {kind === 'none' ? (
        <p className="note">{s('map.nothingVisible', locale)}</p>
      ) : (
        <>
          <table className="contacts">
            <tbody>
              {rows.map(([key, sample]) =>
                sample ? (
                  <tr key={key}>
                    <td className="contacts__label">{s(key, locale)}</td>
                    <td className="contacts__time">{formatClock(sample.time, locale)}</td>
                    <td className="contacts__alt">
                      {formatDecimal(sample.sun.altitudeApparent, 1, locale)}°
                    </td>
                    <td className="contacts__az">
                      {formatDecimal(sample.sun.azimuth, 0, locale)}°
                    </td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
          <p className="map__footnote">{s('map.contactsNote', locale)}</p>
        </>
      )}

      {circumstances.sunBelowHorizonDuringEvent && (
        <p className="warn">{s('map.sunBelowHorizon', locale)}</p>
      )}

      {central && contacts.max.sun.altitudeApparent < 10 && (
        <p className="warn">
          {s('map.lowSun', locale, {
            alt: `${formatDecimal(contacts.max.sun.altitudeApparent, 1, locale)}°`,
          })}
        </p>
      )}
    </section>
  );
}
