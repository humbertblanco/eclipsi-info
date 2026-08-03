import { formatObscurationPercent } from '../core/astro/obscuration';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
/*
 * Els noms públics de les vistes (#/mapa/llocs → spots) viuen a App i no aquí,
 * pel paquet: App els llegeix a la primera pintada i aquest fitxer és un tros
 * mandrós. La importació en aquest sentit no costa res — App ja és al paquet
 * principal quan aquest tros arriba.
 */
import { MAP_SEGMENT_BY_VIEW, type MapView } from '../App';
import {
  Badge,
  Button,
  Card,
  Dialog,
  IconButton,
  Input,
  SegmentedControl,
  Stat,
  TimelineTrack,
  useMediaQuery,
  VisibilityMeter,
  type TimelineContact,
  type Tone,
} from '../ui';
import { EclipseMap } from '../features/map/EclipseMap';
import {
  LayerControl,
  readStoredLayers,
  type MapLayerState,
} from '../features/map/LayerControl';
import { clampConeRadiusKm, type ViewConeData } from '../features/map/layers/viewCone';
import { useHeatmap, type HeatViewport } from '../features/map/useHeatmap';
import { heatLegendGradient } from '../features/map/layers/heatmap';
import { moveArrowFrom } from '../features/map/layers/moveArrow';
import { pointsForEclipse } from '../data/observation-points/catalog';
import { loadViewpoints } from '../features/map/layers/viewpoints';
import { loadCloudClimGrid } from '../features/map/layers/clouds';
import { allClimCells, type CloudClimGrid } from '../core/weather/climGrid';
import { planCloudMap } from '../core/weather/mapMode';
import type { Viewpoint } from '../core/places/viewpoints';
import type { ObservationPoint } from '../data/observation-points/catalog';
import { readPalette } from '../styles/palette';
import { horizonDistanceAt } from '../core/horizon/profile';
import { track } from '../core/analytics';
import { TrajectoryThumb } from '../features/sim/TrajectoryThumb';
import { ShareButton } from '../features/share';
/*
 * La cerca de topònims és LA MATEIXA que la de la fulla d'ubicació: mateix
 * hook, mateixos missatges tipats de degradació, mateixa atribució de dades.
 * Aquí només canvia què fa triar un resultat: enquadra el mapa, no el punt.
 */
import {
  ls,
  PLACES_ATTRIBUTION,
  usePlaceSearch,
  type PlaceHit,
  type PlaceSearchApi,
} from '../features/location';
import { CREDITS, PRIVACY_NOTE, SOURCES_HEADING } from './SiteFooter';
import type { EclipseSample, GeoLocation } from '../core/astro/types';
import { CloudPanel, useCloudOutlook } from '../features/weather';
import {
  bearingToCardinal,
  computeDurationGradient,
  type DurationGradient,
} from '../core/astro/gradient';
import type { EclipseContext } from './context';
import { computeUncertainty, type BandLimitDistance } from '../core/astro/uncertainty';
import { computeShadowMotion, type ShadowMotion } from '../core/astro/shadow';
import {
  computeEclipsePath,
  distanceToCenterLineKm,
  type PathPoint,
} from '../core/eclipses/path';
import { EphemerisTable } from './EphemerisTable';
import type { Locale } from '../i18n';
import { s } from './strings';
import {
  formatAge,
  formatClockShort,
  formatCoords,
  formatDecimal,
  formatDegrees,
  formatDuration,
  NO_DATA,
} from './format';
import './screens.css';

/*
 * El cercador de llocs, a part del paquet principal.
 *
 * Arrossega el seu worker i tot `core/spots`. `React.lazy` fa que això sigui un
 * tros separat que només baixa qui obre la vista: el dia de l'eclipsi, amb la
 * cel·la saturada, cada kB de la primera pintada es paga en segons.
 */
const SpotSearchPanel = lazy(() =>
  import('../features/spots').then((m) => ({ default: m.SpotSearchPanel })),
);

/*
 * L'alineació Sol–cim, també a part.
 *
 * Arrossega el seu Worker propi i `core/spots/alignment` (1.400 línies). És la
 * funció més diferencial de l'app i alhora la que menys gent obrirà el dia de
 * l'eclipsi, que és exactament el perfil del que ha d'anar en un tros separat.
 */
const AlignPanel = lazy(() =>
  import('../features/align').then((m) => ({ default: m.AlignPanel })),
);

/*
 * El desglossament de núvols, també.
 *
 * El mesurador de la vista de núvols NO és mandrós: és una xifra que ha de
 * sortir de seguida. El panell de capes sí, perquè és el detall que es mira
 * després, i així la seva branca —capes, línia de visió, climatologia— no entra
 * al paquet de la primera pintada.
 */
/*
 * El panell de núvols NO és lazy, a diferència dels dos de sota: el compte
 * enrere — pantalla de primera pintada — ja l'importa estàticament, o sigui
 * que viu al paquet principal tant sí com no; un límit lazy aquí era teatre
 * (el bundler mateix ho avisava: INEFFECTIVE_DYNAMIC_IMPORT).
 */

export interface MapScreenProps extends EclipseContext {
  /**
   * Recalcula-ho tot des d'unes coordenades. Rep només lat/lon: la cota l'ha
   * de resoldre contra el model del terreny qui té l'estat de l'observador,
   * perquè és una operació de xarxa.
   *
   * LA CRIDA EL CLIC AL MAPA, directament: tocar un punt vol dir que aquell
   * punt passa a ser el teu a totes les pantalles. Vegeu el comentari del gest
   * dins del component.
   */
  onPickLocation: (lat: number, lon: number) => void;
  /**
   * Porta al compte enrere, que és on viu la simulació sencera. L'ofereix la
   * miniatura de la trajectòria: l'aparador és aquí, la funció és allà.
   */
  onOpenCountdown?: () => void;
  /**
   * La vista amb què s'obre la fitxa quan una navegació en demana una
   * (`#/mapa/llocs`, la crida a l'acció del compte enrere). Com
   * `initialSection` de la guia: un encàrrec d'aterratge, no l'estat — de
   * l'estat n'és amo el commutador de sota.
   */
  initialView?: View;
}

/** Què respon la fitxa de sota del mapa. Els noms públics del fragment
    (`franja`, `llocs`…) són a `MAP_SEGMENT_BY_VIEW`, a App. */
type View = MapView;



/**
 * La línia central de l'eclipsi, guardada a nivell de mòdul.
 *
 * `computeEclipsePath` val ~30 ms. `EclipseMap` calcula la seva per dibuixar;
 * aquí només en cal la polilínia per mesurar-hi distàncies, i només a partir
 * del primer toc al mapa. No és un `useMemo` a posta: el mòdul sobreviu al
 * component, i canviar de pestanya i tornar no repeteix el càlcul.
 */
let centerLineCache: { eclipseId: string; center: PathPoint[] } | null = null;

function centerLineFor(eclipseId: string): PathPoint[] {
  if (centerLineCache === null || centerLineCache.eclipseId !== eclipseId) {
    centerLineCache = { eclipseId, center: computeEclipsePath(eclipseId).center };
  }
  return centerLineCache.center;
}



/**
 * Pantalla "Mapa".
 *
 * QUÈ CONSERVA DE LA REFERÈNCIA (`design-reference/ui_kits/app/MapScreen.jsx`):
 * cartografia base REAL amb la franja dibuixada a sobre, un control segmentat
 * flotant i una fitxa de vidre a baix amb el veredicte del punt seleccionat.
 *
 * QUÈ CANVIA, I PER QUÈ:
 *
 *  · La referència feia servir el segmentat per commutar CAPES del mapa (ombra
 *    / núvols / durada). `EclipseMap` només dibuixa la franja i afegir-hi capes
 *    és territori de `src/features/map/`, que aquesta tasca no toca. Aquí el
 *    segmentat commuta què respon la FITXA, que és la mateixa pregunta feta
 *    des de l'altre costat: on soc, quin cel hi haurà i em convé moure'm.
 *
 *  · TOCAR EL MAPA ET MOU EL PUNT, A TOTES LES PANTALLES.
 *    Hi va haver una etapa intermèdia en què el clic només obria una fitxa de
 *    previsualització i el canvi de debò el feia un botó «Fes-ne el teu punt».
 *    Es va fer per poder mirar un altre lloc sense perdre el teu, i el preu era
 *    que el gest més natural del mapa no feia el que sembla que fa: la
 *    capçalera, el compte enrere i la guia seguien parlant d'un altre lloc
 *    mentre la fitxa parlava del que acabaves de tocar. Dues xifres diferents a
 *    la vista alhora és el que fa dubtar de totes dues.
 *
 *    Ara el clic crida `onPickLocation` i prou. El que hi vam guanyar amb la
 *    previsualització no es perd: cada punt tocat entra a l'historial, i
 *    comparar-ne dos és el que fa `ComparePanel` des de la fulla d'ubicació,
 *    que a més ho fa amb la cota del model i el perfil del terreny — coses que
 *    la fitxa de previsualització, calculada al nivell del mar, no tenia.
 *
 *  · La cerca de topònims ENQUADRA, no tria. El geocodificador és el mateix
 *    que fa servir la fulla d'ubicació (`features/location`), però aquí
 *    trobar un lloc pel nom només porta la vista del mapa fins a ell: el gest
 *    que canvia el teu punt continua sent un de sol — tocar el mapa—, que a
 *    més funciona sense xarxa. Dues portes al mateix canvi d'estat des de la
 *    mateixa pantalla és com es fabriquen els canvis de punt accidentals.
 *
 *  · Un sol accent ambre: és la franja pintada al mapa. Per això cap element
 *    d'aquesta pantalla porta `tone="accent"` ni cap botó `solid`.
 */
export function MapScreen({
  eclipseId,
  locale,
  location,
  placeLabel,
  circumstances,
  verdict,
  horizon,
  onPickLocation,
  onOpenCountdown,
  initialView,
}: MapScreenProps) {
  const [view, setView] = useState<View>(initialView ?? 'band');
  const [creditsOpen, setCreditsOpen] = useState(false);

  /*
   * LES CAPES DEL MAPA (relleu, con de visió), a part del segmentat: el
   * segmentat commuta la fitxa i aquestes commuten territori, i valen per a
   * totes les vistes alhora. El defecte depèn de la pantalla — el relleu és
   * GPU i dades, i al mòbil s'ofereix apagat — però el que l'usuari triï es
   * recorda i mana per sobre del defecte (localStorage, dins de
   * `LayerControl`).
   */
  const desktop = useMediaQuery('(min-width: 900px) and (min-height: 500px)');
  const [layers, setLayers] = useState<MapLayerState>(() =>
    readStoredLayers({
      hillshade: desktop,
      cone: true,
      // Els punts oficials són contingut, són pocs i porten font: encesos.
      official: true,
      // Els miradors baixen un fitxer de centenars de kB: apagats fins que
      // algú els demani. Res no es baixa sense que es demani.
      viewpoints: false,
      // El mapa de calor baixa relleu i triga segons. Apagat SEMPRE per
      // defecte, també a l'escriptori: es paga en dades de l'usuari.
      heat: false,
    }),
  );

  /*
   * L'ENQUADRAMENT VIU AQUÍ perquè el mapa de calor el necessita i el mapa
   * és qui el sap. `EclipseMap` l'emet a cada `moveend` i a la primera
   * pintada; el hook ja escanya i cancel·la la passada anterior.
   */
  const [viewport, setViewport] = useState<HeatViewport | null>(null);
  const heat = useHeatmap({ eclipseId, enabled: layers.heat, viewport });

  /*
   * Els punts oficials són un catàleg estàtic: es llegeixen del mòdul i prou.
   * Els miradors són un fitxer de centenars de kB i es baixen NOMÉS quan
   * s'encén la capa (`loadViewpoints` ja té la seva memòria de mòdul i el seu
   * calaix al service worker).
   */
  const pois = useMemo(
    () => (layers.official ? pointsForEclipse(eclipseId) : null),
    [layers.official, eclipseId],
  );

  /*
   * LA GRAELLA DE NÚVOLS, i els anys que porta de debò.
   *
   * Es baixa només a la vista «Núvols»: són 36 kB, però són 36 kB que no
   * necessita ningú que estigui mirant la franja. I el nombre d'anys NO és el
   * de la constant: la graella publicada en porta 12 o 13 segons la cel·la
   * —Open-Meteo té sostre horari i la sèrie es va haver de tancar el 2023— i
   * `planCloudMap` ha de rebre el mínim real, no el que voldríem. Amb 15 la
   * llegenda diria una fiabilitat que les dades no aguanten;
   * `confidenceForYears` ja baixa sola per sota de dotze.
   */
  const [cloudGrid, setCloudGrid] = useState<CloudClimGrid | null>(null);
  useEffect(() => {
    if (view !== 'clouds') return;
    let alive = true;
    void loadCloudClimGrid(eclipseId, { baseUrl: import.meta.env.BASE_URL })
      .then((grid) => {
        if (alive) setCloudGrid(grid);
      })
      .catch(() => {
        // Sense graella la capa no pinta res i la fitxa ja ho diu.
        if (alive) setCloudGrid(null);
      });
    return () => {
      alive = false;
    };
  }, [view, eclipseId]);

  const cloudPlan = useMemo(() => {
    if (cloudGrid === null) return null;
    const minYears = cloudGrid.cells.years.reduce(
      (least, y) => (y < least ? y : least),
      Number.POSITIVE_INFINITY,
    );
    // `circumstances` i no `contacts`: aquell es declara més avall i aquí
    // només en cal l'instant del màxim, que és el que decideix si toca
    // climatologia o previsió.
    return planCloudMap(
      circumstances?.contacts.max.time.getTime() ?? Date.now(),
      Date.now(),
      { years: Number.isFinite(minYears) ? minYears : undefined },
    );
  }, [cloudGrid, circumstances]);

  const cloudCells = useMemo(
    () => (view === 'clouds' && cloudGrid !== null ? allClimCells(cloudGrid) : null),
    [view, cloudGrid],
  );

  /*
   * QUI ÉS EL PUNT QUE ESTÀS MIRANT.
   *
   * Tocar una xinxeta recalculava tot des d'aquelles coordenades i LLENÇAVA
   * la resta: el nom, qui l'ha convocat, l'enllaç a la font, si la coordenada
   * és estimada i si allà l'eclipsi és només parcial. L'usuari veia números
   * correctes d'un lloc sense nom, i havia de recordar què acabava de tocar.
   *
   * Això no substitueix el veredicte: hi va A SOBRE. El motor segueix manant
   * sobre les xifres —és el que fem nosaltres i la competència no— i aquesta
   * targeta només diu de qui són.
   *
   * Es buida en tocar el mapa a pèl: aquell gest tria un punt QUALSEVOL, i
   * deixar-hi el nom d'un altre lloc seria la mena de mentida petita que fa
   * dubtar de tota la pantalla.
   */
  const [place, setPlace] = useState<PickedPlace | null>(null);

  const [viewpoints, setViewpoints] = useState<readonly Viewpoint[] | null>(null);
  useEffect(() => {
    if (!layers.viewpoints) {
      setViewpoints(null);
      return;
    }
    let alive = true;
    void loadViewpoints(eclipseId, { baseUrl: import.meta.env.BASE_URL })
      .then((file) => {
        if (alive) setViewpoints(file.viewpoints);
      })
      .catch(() => {
        // El detall el diu la capa; aquí només cal no deixar-hi res a mitges.
        if (alive) setViewpoints(null);
      });
    return () => {
      alive = false;
    };
  }, [layers.viewpoints, eclipseId]);

  /*
   * Si la navegació torna a demanar una vista amb el mapa ja obert —l'enrere
   * del navegador entre dues entrades del mapa—, s'adopta. Mateix contracte
   * que `initialSection` a la guia: la prop és l'encàrrec, no l'estat, i per
   * això només mana quan CANVIA.
   */
  useEffect(() => {
    if (initialView !== undefined) setView(initialView);
  }, [initialView]);

  /*
   * EL COMMUTADOR ESCRIU EL FRAGMENT, I AMB `replaceState`: canviar de vista
   * dins del mapa no és una navegació — és el mateix lloc mirat d'una altra
   * manera — i apilar-hi entrades faria que l'enrere del navegador repassés
   * pestanyetes de la fitxa en comptes de desfer camins de debò. La consulta
   * (?p=...) es conserva intacta, com a totes les escriptures d'adreça de
   * l'app. La franja s'escriu com a `#/mapa` a seques: és la vista per
   * defecte i el nom net és el canònic, igual que la portada va sense
   * fragment. El popstate d'App llegeix aquests fragments quan hi arriba un
   * enllaç o l'historial es mou.
   */
  const switchView = (next: View) => {
    setView(next);
    track('map_view_open', { view: next, via: 'switch' });
    const fragment = next === 'band' ? '#/mapa' : `#/mapa/${MAP_SEGMENT_BY_VIEW[next]}`;
    if (window.location.hash === fragment) return;
    window.history.replaceState(
      // L'estat que hi hagi es conserva: no és nostre.
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}${fragment}`,
    );
  };

  /*
   * ON HA D'ENQUADRAR-SE EL MAPA quan es tria un resultat de la cerca. És un
   * objecte NOU a cada tria, a posta: `EclipseMap` reacciona a la identitat,
   * i triar el mateix lloc dues vegades ha de tornar-hi encara que les
   * coordenades no hagin canviat, perquè entremig pots haver mogut el mapa.
   */
  /*
   * Les xinxetes numerades del cercador de llocs: el panell (fill mandrós) fa
   * pujar els resultats i el mapa els marca amb el número de cada targeta.
   * Només es pinten a la vista «Llocs»: a les altres serien soroll d'una
   * pregunta que ningú no està fent.
   */
  const [spotPins, setSpotPins] = useState<
    { lat: number; lon: number; index: number }[] | null
  >(null);

  const [focus, setFocus] = useState<{
    location: GeoLocation;
    label: string | null;
  } | null>(null);

  // El biaix de la cerca és el teu punt, per la mateixa raó que a la fulla
  // d'ubicació: hi ha tres Cervera a la península, i la que vols és la del
  // tros de mapa que estàs mirant, no la més poblada.
  const search = usePlaceSearch({ biasLat: location?.lat, biasLon: location?.lon });

  const frameHit = (hit: PlaceHit) => {
    // El nom viatja amb el punt: el marcador del mapa l'ensenya perquè
    // l'enquadrament no deixi l'usuari buscant a ull què ha trobat la cerca.
    setFocus({
      location: { lat: hit.lat, lon: hit.lon, elevation: 0 },
      label: hit.name,
    });
    // La llista es replega: el resultat ja és al mapa, que és on s'ha de
    // mirar; deixar-la oberta taparia justament el que s'acaba de demanar.
    search.reset();
  };

  const contacts = circumstances?.contacts ?? null;
  const central = circumstances?.kind === 'total' || circumstances?.kind === 'annular';

  /*
   * EL CON DE VISIÓ: el sector d'azimuts que recorre el Sol de C1 a C4 des
   * del teu punt. El radi arriba fins a l'obstacle que fa d'horitzó al rumb
   * del màxim — si el perfil del terreny ja s'ha calculat — i si no, a un
   * radi de cortesia (dins de `clampConeRadiusKm`). Un eclipsi parcial sense
   * C1/C4 tabulats degrada al rumb del màxim tot sol.
   */
  const cone = useMemo<ViewConeData | null>(() => {
    if (!layers.cone || location === null || contacts === null) return null;
    const maxAzimuthDeg = contacts.max.sun.azimuth;
    return {
      lat: location.lat,
      lon: location.lon,
      c1AzimuthDeg: contacts.c1?.sun.azimuth ?? maxAzimuthDeg,
      maxAzimuthDeg,
      c4AzimuthDeg: contacts.c4?.sun.azimuth ?? maxAzimuthDeg,
      radiusKm: clampConeRadiusKm(
        horizon !== null ? horizonDistanceAt(horizon, maxAzimuthDeg) : Number.NaN,
      ),
    };
  }, [layers.cone, location, contacts, horizon]);

  const clouds = useCloudOutlook({
    location,
    targetTimeMs: contacts?.max.time.getTime() ?? null,
    sunAzimuthDeg: contacts?.max.sun.azimuth ?? null,
    sunAltitudeDeg: contacts?.max.sun.altitudeApparent ?? null,
  });

  // El gradient són quatre càlculs de circumstàncies locals a un quilòmetre de
  // distància. Val unes desenes de mil·lisegons, però només es demana quan la
  // fitxa el mostra: no té sentit pagar-lo cada cop que algú toca el mapa per
  // mirar una altra cosa.
  const gradient = useMemo(
    () =>
      view === 'move' && location !== null
        ? computeDurationGradient(eclipseId, location)
        : null,
    [view, eclipseId, location],
  );

  /** L'etiqueta de la fletxa del mapa: la mateixa xifra que diu la fitxa. */
  const arrowLabel =
    gradient !== null
      ? `+${formatDecimal(gradient.secondsPerKm, 1, locale)} s/km`
      : '';

  /*
   * TOT EL QUE JA SABEM DEL PUNT DE L'USUARI, I NO ENSENYÀVEM.
   *
   * Del punt en sabem molt més del que es veia i ja ho tenim calculat: a
   * quants quilòmetres queda el límit de la franja i cap a on, a quina
   * distància queda la línia central, i per on arribarà l'ombra i a quina
   * velocitat. És exactament el que necessita algú que està decidint on va, que
   * és per a què serveix aquesta pantalla.
   *
   * La distància a la línia central es mesura sobre la polilínia DIBUIXADA, no
   * sobre el marge umbral: ha de coincidir amb la ratlla que l'usuari té
   * davant. Abans només sortia per al punt de previsualització, que ja no
   * existeix; ara és del teu punt, que és de qui havia de ser.
   */
  const detail = useMemo(() => {
    if (view !== 'band' || circumstances === null || location === null) return null;
    const uncertainty = computeUncertainty(eclipseId, circumstances, {
      locateSeaLevelLimit: false,
    });
    const shadow =
      circumstances.kind === 'total' || circumstances.kind === 'annular'
        ? computeShadowMotion(eclipseId, circumstances)
        : null;
    return {
      limit: uncertainty.limit,
      // L'amplada de la incertesa del límit, per pintar-la al mapa: és la
      // mateixa xifra que fa que la fitxa digui «just al caire».
      limitUncertaintyKm: uncertainty.limitUncertaintyKm,
      shadow,
      toCenterKm: distanceToCenterLineKm(location, centerLineFor(eclipseId)),
    };
  }, [view, eclipseId, circumstances, location]);

  /*
   * ELS CINC CONTACTES PER A LA LÍNIA DE TEMPS DEL MÒBIL.
   *
   * Mateixa recepta que la targeta del compte enrere: etiqueta curta i hora
   * SENSE segons, que és el que cap cinc vegades en 390 px. El segon exacte el
   * dona la taula d'efemèrides, que a l'escriptori es pinta en lloc d'aquesta
   * línia — mai totes dues alhora: qui decideix quina es veu és `screens.css`,
   * amb el mateix patró de tall que ja fan servir la targeta de la línia i la
   * de la taula a la portada.
   */
  const timeline = useMemo<TimelineContact[]>(() => {
    if (contacts === null) return [];
    const rows: [string, EclipseSample | undefined][] = [
      ['C1', contacts.c1],
      ['C2', contacts.c2],
      ['Màx', contacts.max],
      ['C3', contacts.c3],
      ['C4', contacts.c4],
    ];
    return rows
      .filter((row): row is [string, EclipseSample] => row[1] !== undefined)
      .map(([label, sample]) => ({
        label,
        time: formatClockShort(sample.time, locale),
      }));
  }, [contacts, locale]);

  return (
    <div className="screen screen--full screen--split screen--flush">
      <div className="screen__col screen__col--main">
        <div className="mapscreen__stage">
          {/*
            LA DIANA ÉS EL TEU PUNT.

            `picked` era el punt de previsualització i ara rep la ubicació de
            l'app: com que tocar el mapa la canvia a l'instant, el marcador
            segueix el dit igual que abans i, a més, ja no pot quedar-se clavat
            en un lloc del qual cap altra pantalla parla.
          */}
          <EclipseMap
            eclipseId={eclipseId}
            locale={locale}
            observer={location}
            picked={location}
            focus={focus}
            spots={view === 'spots' ? spotPins : null}
            hillshade={layers.hillshade}
            /*
              LA LLUM DEL RELLEU VE D'ON SERÀ EL SOL. No és cosmètica: amb el
              Sol a 7° el 12 d'agost, els vessants que el mapa ensenya foscos
              són exactament els que estaran a contrallum, i el pendent que
              et tapa al mapa és el que et taparà al camp. Sense punt encara,
              el relleu s'il·lumina amb el 315° convencional.
            */
            sunAzimuthDeg={contacts?.max.sun.azimuth ?? null}
            cone={cone}
            heatCells={layers.heat ? heat.cells : null}
            heatMaxSec={heat.maxSec}
            onViewportChange={setViewport}
            pois={pois}
            onPickPoi={(poi) => {
              // Un punt oficial es tria com qualsevol altre punt: el motor en
              // calcula les circumstàncies de debò, que és el que hi afegim
              // nosaltres i la competència no. El que NO es perd és qui és:
              // la targeta d'identitat sobreviu al recàlcul.
              setFocus(null);
              setPlace({ from: 'official', point: poi });
              onPickLocation(poi.lat, poi.lon);
            }}
            viewpoints={viewpoints}
            onPickViewpoint={(spot) => {
              setFocus(null);
              setPlace({ from: 'viewpoint', spot });
              onPickLocation(spot.lat, spot.lon);
            }}
            /*
              LA VORA D'INCERTESA, i només a la vista «Franja». És la resposta
              cartogràfica de la pregunta que allà s'està fent («hi soc,
              dins?»), i és el que la competència no pot dibuixar: ells pinten
              el límit com una ratlla dura, que a la vora és una mentida de
              quilòmetres.
            */
            edgeUncertaintyKm={
              view === 'band' ? (detail?.limitUncertaintyKm ?? null) : null
            }
            cloudCells={cloudCells}
            {...(cloudPlan !== null ? { cloudTexture: cloudPlan.texture } : {})}
            {...(view === 'move'
              ? { moveArrow: moveArrowFrom(location, gradient, arrowLabel) }
              : {})}
            onPickLocation={(loc) => {
              // Tocar el mapa tanca el capítol de la cerca: el punt triat ja
              // té el seu marcador propi i el rètol del resultat només faria
              // soroll damunt del gest important. I tanca també el del lloc
              // anterior: aquest gest tria un punt QUALSEVOL, i deixar-hi el
              // nom d'un altre seria mentir.
              setFocus(null);
              setPlace(null);
              onPickLocation(loc.lat, loc.lon);
            }}
          />

          {/*
            EL CONTROL DE CAPES sura sobre el llenç, a l'altre costat de la
            llegenda: la llegenda diu què hi ha pintat i aquest botó decideix
            què s'hi pinta. Va damunt del mapa i no a la fitxa perquè no
            respon cap pregunta de la fitxa — val per a les cinc vistes.
          */}
          <LayerControl
            locale={locale}
            value={layers}
            onChange={(next) => {
              /*
               * El control envia l'estat sencer de les capes; el que decideix
               * res és QUINA s'ha tocat i cap on, i això només es pot saber
               * comparant amb l'anterior, que és aquí. El defecte
               * relleu-sí-a-escriptori i no-a-mòbil és una hipòtesi que ningú
               * no ha comprovat mai amb dades.
               */
              if (next.hillshade !== layers.hillshade) {
                track('map_layer_toggle', {
                  layer: 'hillshade',
                  state: next.hillshade ? 'on' : 'off',
                });
              }
              if (next.cone !== layers.cone) {
                track('map_layer_toggle', {
                  layer: 'cone',
                  state: next.cone ? 'on' : 'off',
                });
              }
              setLayers(next);
            }}
          />

          {/* Llegenda pròpia. La d'`EclipseMap` viu sota el llenç i aquí el
              llenç ocupa el marc sencer, així que quedaria fora de vista. */}
          {/*
            LA LLEGENDA NOMÉS DIU EL QUE HI HA PINTAT. La franja i la línia
            central hi són sempre; el con només quan la capa és encesa. Una
            llegenda que enumera capes apagades fa buscar al mapa coses que no
            hi són.
          */}
          <div className="mapscreen__legend">
            <span className="mapscreen__legenditem">
              <span className="mapscreen__swatch" aria-hidden="true" />
              {s('map.legend.band', locale)}
            </span>
            <span className="mapscreen__legenditem">
              <span
                className="mapscreen__swatch mapscreen__swatch--line"
                aria-hidden="true"
              />
              {s('map.legend.center', locale)}
            </span>
            {cone !== null && (
              <span className="mapscreen__legenditem">
                <span
                  className="mapscreen__swatch mapscreen__swatch--cone"
                  aria-hidden="true"
                />
                {s('map.layers.cone', locale)}
              </span>
            )}
            {layers.heat && heat.cells.length > 0 && (
              <span className="mapscreen__legenditem">
                {/*
                  El degradat de la mostra surt de la MATEIXA taula que pinta
                  el mapa (`heatLegendGradient`), en línia i no en CSS: és
                  l'única manera que llegenda i llenç no puguin divergir.
                */}
                <span
                  className="mapscreen__swatch mapscreen__swatch--heat"
                  aria-hidden="true"
                  style={{ background: heatLegendGradient(readPalette()) }}
                />
                {s('map.heat.legend', locale, { max: formatDuration(heat.maxSec) })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="screen__col screen__col--side">
        <Card tone="glass" className="mapscreen__sheet">
          {/*
            LA CERCA DE TOPÒNIMS, QUE «NO TENÍEM» I SÍ QUE TENÍEM.

            Un comentari d'aquí deia que no hi havia geocodificador; feia
            temps que era fals (`features/location/geocoder.ts`) i la fulla
            d'ubicació ja el feia servir. Va DAMUNT del commutador i no dins
            de cap vista perquè no respon a la fitxa: serveix el MAPA, en
            qualsevol vista. Triar un resultat només enquadra; el punt es
            canvia tocant el mapa, com sempre.

            La llista reutilitza les classes `loc-list` de
            `features/location/location.css`, que és al paquet principal
            perquè `App` importa la fulla estàticament: mateixa cerca, mateix
            aspecte, zero CSS duplicat.
          */}
          <div className="mapscreen__search">
            <Input
              icon="search"
              type="search"
              label={ls('search.label', locale)}
              placeholder={ls('search.placeholder', locale)}
              value={search.query}
              onChange={search.setQuery}
            />
            {searchNote(search, locale) !== null && (
              <p className="screen__note">{searchNote(search, locale)}</p>
            )}
            {search.hits.length > 0 && (
              <>
                <ul className="loc-list">
                  {search.hits.map((hit) => (
                    <li key={hit.id} className="loc-list__item">
                      <button
                        type="button"
                        className="loc-list__main"
                        onClick={() => frameHit(hit)}
                      >
                        <span className="loc-list__name">{hit.name}</span>
                        <span className="loc-list__meta">
                          {/* El tipus davant del context, com a la fulla: el
                              coll i el poble homònims es distingeixen abans
                              de llegir la comarca. */}
                          {hit.kind === 'peak' && `${ls('kind.peak', locale)} · `}
                          {hit.detail ?? formatCoords(hit.lat, hit.lon)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {/* Atribució obligatòria per llicència de les dades, al
                    costat del que atribueix, igual que a la fulla. */}
                <p className="screen__note">{PLACES_ATTRIBUTION}</p>
              </>
            )}
          </div>

          <SegmentedControl
            value={view}
            onChange={switchView}
            /*
              CINC OPCIONS NO CABEN EN UNA FILA de la fitxa d'escriptori. Sense
              `wrap`, «Franja» es llegia «Fr…» i «Enquadra», «E…»; i el salt
              automàtic de `wrap` les partia en un quatre-més-una accidental
              que semblava un error. `wrap` treu les columnes en línia del
              control i `mapscreen__views` (`screens.css`) hi declara el
              trencament a posta: tres a dalt i dues a sota repartint-se
              l'amplada. Les cinc es queden al commutador perquè les cinc són
              modes de la fitxa — «Enquadra» obre un panell (`AlignPanel`) com
              qualsevol altre, no és una acció puntual.
            */
            wrap
            className="mapscreen__views"
            label={s('map.compare', locale)}
            options={[
              { value: 'band', label: s('map.view.band', locale) },
              { value: 'clouds', label: s('map.view.clouds', locale) },
              { value: 'move', label: s('map.view.move', locale) },
              { value: 'spots', label: s('map.view.spots', locale) },
              { value: 'align', label: s('map.view.align', locale) },
            ]}
          />

          {/*
            DE QUI SÓN LES XIFRES. Va damunt del commutador i fora de les
            vistes perquè el lloc que has triat no depèn de quina pregunta
            estiguis fent-li: canviar de «Franja» a «Núvols» no et canvia de
            lloc.
          */}
          {place !== null && (
            <PlaceCard place={place} locale={locale} onClear={() => setPlace(null)} />
          )}

          {circumstances === null || contacts === null ? (
            <p className="screen__note">{s('map.compareNote', locale)}</p>
          ) : view === 'band' ? (
            <>
              <div className="mapscreen__badges">
                <Badge tone={bandTone(circumstances.edgeUncertain, central)} dot>
                  {circumstances.edgeUncertain
                    ? s('map.edge', locale)
                    : central
                      ? s('map.inBand', locale)
                      : s('map.outOfBand', locale)}
                </Badge>
                <span className="screen__note">
                  {s(`kind.${circumstances.kind}` as 'kind.total', locale)}
                </span>
              </div>

              {/*
                LES TRES XIFRES DE CAPÇALERA, EN UNA SOLA FILA AL MÒBIL.
                El modificador `--trio` és qui ho fa (`screens.css`): graella
                de tres i xifra en cos de títol petit, el mateix patró compacte
                que les targetes del cercador de llocs. A l'escriptori la fila
                torna a ser la de sempre.
              */}
              <div className="mapscreen__stats mapscreen__stats--trio">
                <Stat
                  label={
                    verdict
                      ? s('home.visibleDuration', locale)
                      : s('home.theoreticalDuration', locale)
                  }
                  value={
                    central
                      ? formatDuration(
                          verdict ? verdict.centralVisibleSec : circumstances.centralDurationSec,
                        )
                      : NO_DATA
                  }
                />
                <Stat
                  label={s('home.obscuration', locale)}
                  // `formatObscurationPercent` i no `formatPercent`: aquest
                  // últim arrodoneix, i un 99,97 % sortia com a «100 %» just al
                  // costat del distintiu «Fora de la franja». És la xifra que
                  // decideix si algú es mou o no, i la que no pot mentir.
                  value={formatObscurationPercent(
                    verdict ? verdict.maxVisibleObscuration : contacts.max.obscuration,
                    circumstances.kind === 'total' || circumstances.kind === 'annular',
                  )}
                />
                <Stat
                  label={s('home.sunAltitude', locale)}
                  value={formatDegrees(contacts.max.sun.altitudeApparent)}
                />
              </div>

              {/*
                LA LÍNIA DE TEMPS C1–C4, NOMÉS AL MÒBIL I AQUÍ DALT.
                Dins del 45dvh de la fitxa, el primer cop d'ull ha de donar el
                veredicte sencer: distintiu, tres xifres i per on va el dia.
                Per això la línia va enganxada a les xifres i no al fons de la
                fitxa, on viu la taula d'escriptori. És la MATEIXA informació
                que la taula (`mapscreen__ephemeris`, més avall): `screens.css`
                pinta l'una o l'altra segons l'amplada, mai les dues.
              */}
              <div className="mapscreen__block mapscreen__timeline">
                <span className="screen__overline">{s('map.contacts', locale)}</span>
                <TimelineTrack
                  contacts={timeline}
                  activeIndex={timeline.findIndex((c) => c.label === 'Màx')}
                />
              </div>

              {circumstances.edgeUncertain && (
                <p className="screen__note">{s('map.edgeNote', locale)}</p>
              )}
              {!central && <p className="screen__note">{s('map.noCentral', locale)}</p>}

              {/*
                CAP ON I AMB QUANT DE MARGE, i va DESPRÉS de la línia de temps
                a posta. Dins del 45dvh de la fitxa del mòbil, el primer cop
                d'ull ha de ser distintiu + tres xifres + per on va el dia
                (ESTAT.md ho fixa així); posant aquest bloc entremig, la línia
                C1–C4 quedava sota la retallada i calia desplaçar-se per veure
                l'hora del màxim. Això és detall de segona lectura: hi arriba
                qui ja sap que el lloc li serveix i ara vol saber cap on mirar.

                El MARGE és la xifra que decideix, no l'altura: set graus són
                una fortuna en una plana i no res darrere d'una carena. És el
                que la competència ensenya com a «Visible (6,6° sobre
                horitzó)», i nosaltres el calculem amb refracció i contra el
                perfil real d'aquest punt.
              */}
              <SunAtMaxBlock
                azimuthDeg={contacts.max.sun.azimuth}
                clearanceDeg={
                  verdict
                    ? verdict.sunAltitudeAtMaxDeg - verdict.horizonAltitudeAtMaxDeg
                    : null
                }
                locale={locale}
              />

              {/*
                La trajectòria en miniatura: com hi passa el Sol i què li tapa
                el terreny, sense sortir del mapa. La simulació SENCERA —amb
                barra de temps i cel pintat— es queda al compte enrere; això
                és l'aparador que hi porta, no una segona simulació.
              */}
              {location !== null && (
                <div className="mapscreen__block">
                  <span className="screen__overline">{s('map.traj', locale)}</span>
                  <TrajectoryThumb
                    circumstances={circumstances}
                    location={location}
                    horizon={horizon}
                    locale={locale}
                  />
                  {onOpenCountdown !== undefined && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="timer"
                      onClick={onOpenCountdown}
                    >
                      {s('map.trajCta', locale)}
                    </Button>
                  )}
                </div>
              )}

              {/*
                Les hores dels cinc contactes amb el segon exacte i el marge
                sobre el terreny: NOMÉS A L'ESCRIPTORI. Al mòbil el bloc
                sencer desapareix (`mapscreen__ephemeris`, `screens.css`) —
                la mateixa informació ja la diu la línia de temps de dalt, i
                deixar aquí l'overline amb la taula amagada era una etiqueta
                òrfena sobre no res.
              */}
              <div className="mapscreen__block mapscreen__ephemeris">
                <span className="screen__overline">{s('map.contacts', locale)}</span>
                <EphemerisTable circumstances={circumstances} horizon={horizon} locale={locale} />
              </div>

              <LimitBlock
                limit={detail?.limit ?? null}
                toCenterKm={detail?.toCenterKm ?? null}
                locale={locale}
              />
              <ShadowBlock shadow={detail?.shadow ?? null} locale={locale} />

              {/*
                Compartir també des d'aquí: qui compara llocs al mapa és
                exactament qui vol enviar «mira, jo seré aquí». Mateix botó i
                mateixa escala de gestos que a la portada.
              */}
              <ShareButton
                eclipseId={eclipseId}
                locale={locale}
                location={location}
                label={placeLabel}
                circumstances={circumstances}
                profile={horizon}
                verdict={verdict}
                // Sense això el gest no s'apunta enlloc, i és a posta que no
                // tingui valor per omissió: comptar el mapa com a portada
                // seria una fila equivocada, que és pitjor que una que falta.
                surface="map"
              />

              <p className="screen__note">{s('map.pickNote', locale)}</p>
            </>
          ) : view === 'spots' ? (
            /*
              EL CERCADOR DE LLOCS, QUE FINS ARA NO ES PODIA OBRIR.

              El motor (`core/spots`), el seu worker i aquest panell estaven
              acabats i provats des del primer dia, i no els muntava ningú: la
              pregunta «i si em moc?» només tenia resposta en forma de rumb
              (`MoveAdvice`), mai en forma de llocs concrets.

              VA DARRERE DE `React.lazy` perquè arrossega el worker i tota la
              seva branca de codi, i el paquet d'aquesta app ja és el problema
              greu que diu ESTAT.md. Qui no obri aquesta vista no el paga.

              `onSelect` tanca el cercle: triar un resultat és canviar el punt
              de l'app, igual que tocar el mapa.
            */
            <Suspense fallback={<p className="screen__note">{s('map.view.spots', locale)}…</p>}>
              <SpotSearchPanel
                eclipseId={eclipseId}
                locale={locale}
                origin={location}
                onSelect={(spot) => {
                  /*
                   * EL NÚMERO SURT DE LES XINXETES, no d'un índex nou: és
                   * exactament el que porta la xinxeta al mapa i el que diu la
                   * targeta de la llista, i qui torni a la vista «Franja» ha
                   * de poder saber quin dels candidats està mirant. Si el
                   * candidat no és a les xinxetes (llista buida per un canvi
                   * de cerca), es queda sense número en comptes d'inventar-lo.
                   */
                  const pin = spotPins?.find(
                    (p) => p.lat === spot.lat && p.lon === spot.lon,
                  );
                  setPlace({
                    from: 'spot',
                    name: formatCoords(spot.lat, spot.lon),
                    rank: pin?.index ?? 0,
                  });
                  onPickLocation(spot.lat, spot.lon);
                }}
                onResults={setSpotPins}
              />
            </Suspense>
          ) : view === 'align' ? (
            /*
              L'ALINEACIÓ SOL–CIM, QUE MAI NO HAVIA ARRIBAT A LA PANTALLA.

              `core/spots/alignment.ts` fa una cosa que cap altra aplicació fa:
              troba el punt per geometria i després torna a baixar el raig fins
              a l'element per comprovar que des d'allà es vegi de veritat. Amb
              el Sol a 2° —el 12 d'agost del 2026 a llevant— la línia sola
              menteix la meitat de les vegades. Eren 1.400 línies provades que
              no cridava ningú.

              VA AL MAPA i no a la pestanya del Cel perquè allà el marc és per a
              la càmera i aquí hi ha el territori, que és de què parla.
            */
            <Suspense fallback={<p className="screen__note">{s('map.view.align', locale)}…</p>}>
              <AlignPanel
                eclipseId={eclipseId}
                locale={locale}
                origin={location}
                onSelect={onPickLocation}
              />
            </Suspense>
          ) : view === 'clouds' ? (
            <>
              <VisibilityMeter
                place={placeLabel ?? s('common.here', locale)}
                value={clouds.outlook ? clouds.outlook.score.score : null}
                state={clouds.outlook ? clouds.outlook.score.band : 'unknown'}
                caption={
                  clouds.outlook
                    ? clouds.outlook.caveat
                    : clouds.loading
                      ? s('sky.cloudsLoading', locale)
                      : (clouds.error ?? s('sky.cloudsOffline', locale))
                }
                age={
                  clouds.outlook
                    ? formatAge(clouds.nowMs - clouds.outlook.fetchedAtMs)
                    : undefined
                }
              />
              {/*
                EL DESGLOSSAMENT PER CAPES, QUE EXISTIA I NO ES VEIA.

                El mesurador dona una xifra de 0 a 100 i es queda aquí. El
                panell (`features/weather/CloudPanel`) porta el que decideix de
                debò: quina capa pesa, i sobretot ON és el núvol que et taparà.
                Amb el Sol a 5° —que és on serà el 12 d'agost del 2026— el que
                t'ha de preocupar no és el cel de sobre teu sinó el de seixanta
                quilòmetres cap al ponent, i aquesta és l'única part de l'app
                que ho sap dir.

                EL MESURADOR ES QUEDA: és el titular, i el panell el detall.

                SE LI PASSA `clouds`, la consulta que aquesta pantalla JA ha
                fet. Sense això el panell en faria una de pròpia amb els
                mateixos paràmetres: dues peticions a Open-Meteo per ensenyar el
                mateix número dos cops, i dues edats de dada que es podrien
                contradir a la mateixa targeta.
              */}
              {/*
                QUÈ HI HA PINTAT AL MAPA, dit al costat del mesurador. La
                capa de núvols no és el pronòstic del teu punt: és una malla
                grollera i d'una sèrie que no arriba on voldríem, i les dues
                coses s'han de poder llegir sense obrir res.
              */}
              {cloudPlan !== null && cloudCells !== null && (
                <p className="screen__note">
                  {cloudPlan.label[locale]} · {cloudPlan.caption[locale]} ·{' '}
                  {s('map.clouds.grain', locale)}
                </p>
              )}

              <Suspense fallback={null}>
                <CloudPanel
                  locale={locale}
                  location={location}
                  targetTimeMs={contacts.max.time.getTime()}
                  sunAzimuthDeg={contacts.max.sun.azimuth}
                  sunAltitudeDeg={contacts.max.sun.altitudeApparent}
                  outlook={clouds}
                />
              </Suspense>
            </>
          ) : (
            <MoveAdvice gradient={gradient} locale={locale} />
          )}

          {/*
            L'ÚLTIMA LÍNIA DE LA FITXA: l'atribució curta de sempre i, al
            costat, el botó que obre els crèdits sencers. El peu de pàgina no
            arriba mai en aquesta pantalla —és full-bleed, decisió correcta— i
            l'ODbL exigeix que la llicència sigui accessible des d'on es fa
            servir la dada: aquest botó és aquell accés.
          */}
          <div className="mapscreen__foot">
            <p className="screen__note">{s('map.attribution', locale)}</p>
            <IconButton
              icon="info"
              variant="ghost"
              size="sm"
              label={s('map.credits.open', locale)}
              onClick={() => setCreditsOpen(true)}
            />
          </div>
        </Card>
      </div>

      {creditsOpen && (
        <MapCreditsDialog locale={locale} onClose={() => setCreditsOpen(false)} />
      )}
    </div>
  );
}

/**
 * Els crèdits, oberts des del mapa.
 *
 * LA LLISTA ÉS LA DEL PEU (`SiteFooter.CREDITS`), exportada i no copiada: si
 * una font canvia, canvia aquí i al peu alhora. S'hi afegeix només el que el
 * mapa deu i el peu no diu amb aquestes paraules: l'ODbL d'OpenStreetMap.
 */
function MapCreditsDialog({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  return (
    <Dialog
      title={s('map.credits.open', locale)}
      onClose={onClose}
      closeLabel={s('map.credits.close', locale)}
    >
      <div className="map-credits">
        <p className="screen__note">{PRIVACY_NOTE[locale]}</p>

        <div>
          <p className="screen__overline">{SOURCES_HEADING[locale]}</p>
          <ul className="map-credits__list">
            {CREDITS.map((credit) => (
              <li key={credit.url}>
                <span className="map-credits__what">{credit.what[locale]}</span>
                <a href={credit.url} target="_blank" rel="noreferrer noopener">
                  {credit.who}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <p className="screen__note">{s('map.credits.odbl', locale)}</p>
      </div>
    </Dialog>
  );
}

/**
 * La frase que acompanya la cerca. CALCADA de la de `LocationSheet` i tipada
 * contra els mateixos estats del geocodificador: sense xarxa o amb el servei
 * caigut, aquesta cerca ha de degradar amb les mateixes paraules que la de la
 * fulla d'ubicació, perquè per a l'usuari són la mateixa cerca.
 */
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

/**
 * El lloc que has triat, sigui d'on sigui.
 *
 * Una unió i no un objecte amb camps opcionals: un punt oficial SEMPRE té
 * font i un mirador d'OSM no en té cap (l'atribució és del conjunt, no de
 * cada cim), i barrejar-los en una sola forma amb tot opcional acaba amb una
 * targeta que no sap què ha d'ensenyar.
 */
type PickedPlace =
  | { from: 'official'; point: ObservationPoint }
  | { from: 'viewpoint'; spot: Viewpoint }
  | { from: 'spot'; name: string; rank: number };

/**
 * De qui són les xifres que hi ha a sota.
 *
 * VA A SOBRE DEL VEREDICTE I NO EL SUBSTITUEIX. La competència ensenya una
 * fitxa pròpia per als seus punts oficials, amb les seves dades; nosaltres
 * ensenyem la identitat del lloc i, a sota, el veredicte calculat pel motor
 * amb el perfil de terreny d'aquell punt exacte. La font sempre visible és
 * una regla d'aquest producte: si algú ha convocat gent en un lloc, qui hi
 * vagi ha de poder anar a llegir-ho de primera mà.
 */
function PlaceCard({
  place,
  locale,
  onClear,
}: {
  place: PickedPlace;
  locale: Locale;
  onClear: () => void;
}) {
  const overline =
    place.from === 'official'
      ? s('map.place.official', locale)
      : place.from === 'viewpoint'
        ? s(
            place.spot.kind === 'peak' ? 'map.viewpoint.peak' : 'map.viewpoint.viewpoint',
            locale,
          )
        : place.rank > 0
        ? s('map.place.spot', locale, { rank: place.rank })
        : s('map.place.spotNoRank', locale);

  const name =
    place.from === 'official'
      ? place.point.name[locale]
      : place.from === 'viewpoint'
        ? place.spot.name
        : place.name;

  const elevationM =
    place.from === 'official'
      ? place.point.elevationM
      : place.from === 'viewpoint'
        ? place.spot.ele
        : undefined;

  return (
    <div className="mapscreen__place">
      <div className="mapscreen__placehead">
        <div>
          <span className="screen__overline">{overline}</span>
          <p className="mapscreen__placename">{name}</p>
        </div>
        <IconButton
          icon="x"
          variant="ghost"
          size="sm"
          label={s('map.place.clear', locale)}
          onClick={onClear}
        />
      </div>

      {place.from === 'official' && (
        <>
          {/*
            LA FONT, SEMPRE, I AMB ENLLAÇ. Si algú ha convocat gent en un
            lloc, qui hi vagi ha de poder llegir-ho de primera mà: horaris,
            si cal inscripció, si hi ha aparcament. Nosaltres calculem què es
            veurà; qui organitza ho sap tot això i nosaltres no.
          */}
          <p className="screen__note">
            {s('map.layers.source', locale)}: {place.point.source.who}
            {' · '}
            <a href={place.point.source.url} target="_blank" rel="noreferrer noopener">
              {s('map.place.openSource', locale)}
            </a>
          </p>
          {place.point.note !== undefined && (
            <p className="screen__note">{place.point.note[locale]}</p>
          )}
          {/*
            La frase genèrica NOMÉS quan el punt no en porta una de pròpia.
            El catàleg de Madrid ja explica a cada entrada per què la
            coordenada és el nucli del poble, i dir-ho dos cops seguits amb
            paraules diferents fa dubtar de si són dues coses o una.
          */}
          {place.point.precision === 'estimated' && place.point.note === undefined && (
            <p className="screen__note">{s('map.place.estimated', locale)}</p>
          )}
          {place.point.phase === 'partial' && (
            <p className="screen__note">{s('map.layers.officialPartial', locale)}</p>
          )}
        </>
      )}

      {place.from === 'viewpoint' && (
        <p className="screen__note">{s('map.viewpoints.osm', locale)}</p>
      )}

      {elevationM !== undefined && (
        <p className="screen__note">
          {s('map.place.elevation', locale, { m: Math.round(elevationM) })}
        </p>
      )}
    </div>
  );
}

/** El to de la insígnia de franja. El caire no és ni un sí ni un no. */
function bandTone(edgeUncertain: boolean, central: boolean): Tone {
  if (edgeUncertain) return 'partial';
  return central ? 'clear' : 'cloudy';
}

/**
 * On queda el límit de la franja i, si es té, la línia central.
 */
function LimitBlock({
  limit,
  toCenterKm,
  locale,
}: {
  limit: BandLimitDistance | null;
  toCenterKm: number | null;
  locale: Locale;
}) {
  if (limit === null && toCenterKm === null) return null;
  return (
    <div className="mapscreen__block">
      {/* `--pairs`: al mòbil cada Stat es tomba en una línia etiqueta–valor
          (vegeu `screens.css`); a l'escriptori tornen a ser columnes. */}
      <div className="mapscreen__stats mapscreen__pairs">
        {limit !== null && (
          <Stat
            label={s('map.toLimit', locale, {
              side: s(`map.side.${limit.side}` as 'map.side.north', locale),
            })}
            value={`${formatDecimal(limit.km, 1, locale)} km`}
          />
        )}
        {toCenterKm !== null && (
          <Stat
            label={s('map.toCenter', locale)}
            value={`${formatDecimal(toCenterKm, toCenterKm < 10 ? 1 : 0, locale)} km`}
          />
        )}
      </div>
      {limit !== null && (
        <p className="screen__note">
          {s('map.inwardHint', locale, {
            card: bearingToCardinal(limit.inwardBearingDeg, locale),
          })}
        </p>
      )}
    </div>
  );
}

/**
 * Cap on miraràs al màxim, i quant de marge et queda sobre el que tens davant.
 *
 * PER QUÈ EL MARGE I NO L'ALTURA. L'altura del Sol ja surt al trio de dalt, i
 * tota sola no decideix res: set graus són una fortuna en una plana i no res
 * darrere d'una carena a tres quilòmetres. El marge —altura del Sol menys
 * altura del terreny en aquell mateix azimut— és la resta que respon la
 * pregunta, i només es pot escriure quan el perfil d'horitzó del punt ja s'ha
 * calculat: mentre no hi és, aquesta fila no s'inventa cap número.
 *
 * MARGE NEGATIU NO ÉS UNA ALARMA. Vol dir que al minut del màxim el Sol queda
 * darrere del relleu, cosa que passa sovint amb els eclipsis d'aquest catàleg
 * i que no anul·la el lloc: la durada visible del trio de dalt ja diu què en
 * queda. Per això va en to `cloudy` i no en ambre —l'ambre és de la franja— ni
 * en vermell, que aquí vol dir seguretat ocular.
 */
function SunAtMaxBlock({
  azimuthDeg,
  clearanceDeg,
  locale,
}: {
  azimuthDeg: number;
  clearanceDeg: number | null;
  locale: Locale;
}) {
  return (
    <div className="mapscreen__block">
      <div className="mapscreen__stats mapscreen__pairs">
        <Stat
          label={s('map.sunAzimuth', locale)}
          value={bearingToCardinal(azimuthDeg, locale)}
          unit={formatDegrees(azimuthDeg, locale)}
        />
        <Stat
          label={s('map.overTerrain', locale)}
          value={clearanceDeg === null ? NO_DATA : formatDegrees(clearanceDeg, locale)}
        />
      </div>
      {clearanceDeg !== null && clearanceDeg < 0 && (
        <p className="screen__note">{s('map.terrainBlocksMax', locale)}</p>
      )}
    </div>
  );
}

/** Per on arriba l'ombra: el moment que més impressiona i el que gairebé ningú
    no sap cap a on mirar. */
function ShadowBlock({ shadow, locale }: { shadow: ShadowMotion | null; locale: Locale }) {
  if (shadow === null) return null;
  return (
    <div className="mapscreen__block mapscreen__block--pair">
      <Stat
        label={s('map.shadowFrom', locale)}
        value={bearingToCardinal(shadow.arrivalBearing, locale)}
      />
      <Stat
        label={s('map.shadowSpeed', locale)}
        value={`${formatDecimal(shadow.speedKmh, 0, locale)} km/h`}
      />
    </div>
  );
}

/**
 * Val la pena moure's?
 *
 * És la pregunta que de veritat es fa qui mira un mapa d'eclipsi, i la resposta
 * canvia brutalment segons on siguis: al mig de la franja, un quilòmetre no et
 * dona ni un segon; a tres quilòmetres del límit, te'n pot donar quinze. Quan
 * el gradient és massa petit per tenir direcció, es diu que no cal moure's en
 * comptes d'inventar-se un rumb.
 */
function MoveAdvice({
  gradient,
  locale,
}: {
  gradient: DurationGradient | null;
  locale: EclipseContext['locale'];
}) {
  if (gradient === null) {
    return <p className="screen__note">{s('map.compareNote', locale)}</p>;
  }

  if (!gradient.worthMoving || gradient.bearingDeg === null) {
    return (
      <>
        <Stat
          label={s('home.theoreticalDuration', locale)}
          value={gradient.centralSec > 0 ? formatDuration(gradient.centralSec) : NO_DATA}
        />
        <p className="screen__note">{s('map.gradientFlat', locale)}</p>
      </>
    );
  }

  return (
    <>
      <div className="mapscreen__stats">
        <Stat
          label={s('home.theoreticalDuration', locale)}
          value={formatDuration(gradient.centralSec)}
        />
        <Stat
          label={s('map.view.move', locale)}
          value={`+${formatDecimal(gradient.secondsPerKm, 1, locale)}`}
          unit="s/km"
        />
      </div>
      <p className="screen__note">
        {s('map.gradientMove', locale, {
          dir: bearingToCardinal(gradient.bearingDeg, locale),
          rate: formatDecimal(gradient.secondsPerKm, 1, locale),
        })}
      </p>
      {gradient.approxKmToBest !== null && gradient.approxBestSec !== null && (
        <p className="screen__note">
          {s('map.gradientBest', locale, {
            km: Math.round(gradient.approxKmToBest),
            best: formatDuration(gradient.approxBestSec),
          })}
        </p>
      )}
    </>
  );
}
