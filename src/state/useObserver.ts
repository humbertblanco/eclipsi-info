/**
 * Ubicació de l'observador: posició horitzontal triada per l'usuari (GPS, mapa,
 * cerca o historial) + altitud SEMPRE treta del model digital del terreny.
 *
 * QUÈ HA CANVIAT I PER QUÈ. Abans aquest hook arrencava tot sol sobre la línia
 * central a Astúries i no distingia aquell punt de cap altre. L'app quedava
 * plena d'hores, azimuts i durades perfectament calculats d'un lloc on l'usuari
 * no seria mai, i res no ho deia. Ara:
 *
 *   · No hi ha arrencada silenciosa. Sense lloc triat, `fix` és `null` i les
 *     pantalles ja saben ensenyar l'estat buit. El punt d'exemple existeix però
 *     s'ha de demanar (`useDefaultLocation`) i queda marcat amb `origin`
 *     `'default'` perquè la interfície l'hagi de cantar.
 *   · Cada punt porta enganxat D'ON HA SORTIT, quina precisió té i quan es va
 *     fixar. Sense això no es pot ser honest, perquè l'etiqueta i les xifres
 *     podrien anar desaparellades.
 *   · L'últim lloc es recupera en obrir l'app, però marcat amb `restored` per
 *     poder dir que ve d'una altra estona i no del gest d'ara.
 *
 * L'ALTITUD MAI DEL GPS. L'error vertical d'un GPS de mòbil és de ±10 a ±30 m,
 * i trenta metres desplacen l'horitzó visible prou com per canviar el veredicte
 * de si una muntanya et tapa el Sol. La posició HORITZONTAL del GPS sí que és
 * bona (±5 m) i amb ella el model del terreny dona l'altitud molt millor que el
 * propi GPS. La del GPS es guarda igualment a `gpsElevationM`, però només per
 * poder avisar quan les dues discrepen molt (vegeu `elevationDisagrees`).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { elevationAt } from '../core/horizon/elevation';
import type { GeoLocation } from '../core/astro/types';
import {
  DEFAULT_LOCATION,
  isSamePlace,
  type ElevationSource,
  type FixedLocation,
  type LocationOrigin,
} from './location';
import {
  MAX_RECENTS,
  readAsked,
  readLastPlace,
  readRecents,
  mergeRecent,
  removeRecent,
  writeAsked,
  writeLastPlace,
  writeRecents,
  type RecentPlace,
} from './recentPlaces';

export type { ElevationSource } from './location';

/**
 * Per què ha fallat la ubicació.
 *
 * ÉS UN CODI I NO UN TEXT a posta. El missatge que dona el navegador ve en
 * anglès i és inservible («User denied Geolocation»), i aquest hook no sap en
 * quin idioma està l'app. El codi el tradueix la capa d'interfície, que sí que
 * ho sap, i de passada pot dir coses diferents segons el cas: «has dit que no»
 * demana anar als ajustos del navegador, i «no s'ha pogut situar» demana sortir
 * a fora o esperar.
 */
export type LocationErrorCode =
  | 'unsupported'
  | 'denied'
  | 'unavailable'
  | 'timeout';

/** Estat del permís de geolocalització, quan el navegador el sap dir. */
export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

/** Un lloc que es demana fixar. L'altitud la resol aquest hook, no qui el crida. */
export interface PlacePick {
  lat: number;
  lon: number;
  origin: LocationOrigin;
  /** Nom, si qui el tria ja el sap (per exemple un resultat de la cerca). */
  label?: string | null;
}

export interface ObserverApi {
  /** El punt actiu amb tot el seu context. `null` mentre no n'hi ha cap. */
  fix: FixedLocation | null;

  /* --- dreceres de sempre, perquè les crides existents no s'hagin de tocar - */
  location: GeoLocation | null;
  elevationSource: ElevationSource;
  accuracy: number | null;

  error: LocationErrorCode | null;
  loading: boolean;
  permission: PermissionState;

  /** Els últims llocs, el més recent primer. */
  recents: readonly RecentPlace[];

  /**
   * Cert mentre no s'hagi explicat a l'usuari per què cal la ubicació.
   * Mentre sigui cert, la interfície ha d'ensenyar l'explicació ABANS de
   * disparar el diàleg del navegador.
   */
  needsIntro: boolean;

  locate: () => void;
  /** Compatibilitat: un punt tocat al mapa. */
  setManual: (lat: number, lon: number) => Promise<void>;
  setPlace: (pick: PlacePick) => Promise<void>;
  /** Fixa el punt d'exemple. Queda marcat com a tal. */
  useDefaultLocation: () => Promise<void>;
  /** Posa o treu el nom del punt actiu sense recalcular res. */
  setLabel: (label: string | null) => void;
  /** Treu un lloc de l'historial. */
  forget: (target: GeoLocation) => void;
  /** Marca l'explicació com a vista, hagi dit que sí o que no. */
  dismissIntro: () => void;
}

interface State {
  fix: FixedLocation | null;
  error: LocationErrorCode | null;
  loading: boolean;
}

/** Tradueix el codi numèric de l'API de geolocalització al nostre. */
function errorCode(err: GeolocationPositionError): LocationErrorCode {
  if (err.code === err.PERMISSION_DENIED) return 'denied';
  if (err.code === err.TIMEOUT) return 'timeout';
  return 'unavailable';
}

/**
 * Resol l'altitud contra el model del terreny.
 *
 * Sense xarxa i sense tessel·la a la memòria cau, ens quedem sense: l'error que
 * introdueix assumir zero és petit comparat amb no tenir res, i `elevationSource`
 * ho diu perquè la interfície ho pugui matisar.
 */
async function resolveElevation(
  lat: number,
  lon: number,
  gpsElevationM: number | null,
): Promise<{ elevation: number; source: ElevationSource }> {
  try {
    return { elevation: await elevationAt(lon, lat), source: 'dem' };
  } catch {
    if (gpsElevationM !== null) return { elevation: gpsElevationM, source: 'gps' };
    return { elevation: 0, source: 'assumed' };
  }
}

function toRecent(fix: FixedLocation): RecentPlace {
  return {
    lat: fix.location.lat,
    lon: fix.location.lon,
    elevation: fix.location.elevation,
    elevationSource: fix.elevationSource,
    label: fix.label,
    origin: fix.origin,
    atMs: fix.atMs,
  };
}

export function useObserver(): ObserverApi {
  const [state, setState] = useState<State>({
    fix: null,
    error: null,
    loading: false,
  });
  const [recents, setRecents] = useState<readonly RecentPlace[]>([]);
  const [needsIntro, setNeedsIntro] = useState(false);
  const [permission, setPermission] = useState<PermissionState>('unknown');

  /**
   * Número de sèrie de l'última petició.
   *
   * PER QUÈ CAL. Resoldre l'altitud és una crida de xarxa i pot trigar segons.
   * Si algú toca dos punts del mapa seguits, la primera resposta pot arribar
   * després de la segona i deixar l'app calculant-ho tot des del punt que
   * l'usuari ja ha descartat, sense que res ho digui. Només s'aplica el
   * resultat de la petició més recent.
   */
  const ticket = useRef(0);

  /**
   * Còpies vives de l'estat, per poder-lo llegir fora d'un actualitzador.
   *
   * PER QUÈ NO ES FA TOT DINS DELS ACTUALITZADORS de `setState`: perquè hi
   * hauria d'anar l'escriptura a `localStorage`, i un actualitzador ha de ser
   * una funció pura. En mode estricte React els invoca DUES vegades a posta per
   * destapar precisament això, i a més s'executen més tard, quan el component
   * torna a dibuixar-se. Encadenar-ne dos i esperar que el segon vegi el que ha
   * fet el primer funciona per l'ordre en què React buida les cues, que és un
   * detall d'implementació i no una promesa. Amb referències, l'ordre és el
   * d'aquest fitxer i es veu llegint-lo.
   */
  const fixRef = useRef<FixedLocation | null>(null);
  fixRef.current = state.fix;
  const recentsRef = useRef<readonly RecentPlace[]>([]);
  recentsRef.current = recents;

  const commit = useCallback((fix: FixedLocation, remember: boolean) => {
    setState({ fix, error: null, loading: false });
    if (!remember) return;
    const entry = toRecent(fix);
    const next = mergeRecent(recentsRef.current, entry);
    writeLastPlace(entry);
    writeRecents(next);
    setRecents(next);
  }, []);

  /**
   * Fixa el lloc triat.
   *
   * LA POSICIÓ HORITZONTAL ES FIXA DE SEGUIDA I L'ALTITUD ARRIBA DESPRÉS.
   *
   * Abans això esperava la tessel·la del terreny ABANS de canviar el punt, i
   * `elevationAt` fa una petició de xarxa sense temps màxim. Mentrestant la
   * fulla de selecció ja s'havia tancat. El resultat era el pitjor que pot fer
   * aquesta app: la barra deia «Oviedo», el compte enrere deia 108 segons, i
   * l'usuari creia que estava mirant Burgos. Amb la xarxa dolenta —que és
   * exactament la del dia de l'eclipsi— el lloc no canviava MAI.
   *
   * Ara es fa al revés: el punt canvia a l'instant amb l'altitud encara per
   * resoldre, i quan la tessel·la arriba s'hi afegeix. Les xifres que es veuen
   * mentrestant són les d'ON HAS TRIAT, que és el que l'usuari espera; l'error
   * que hi introdueix no tenir encara l'altitud és petit i està marcat com a
   * tal amb `elevationSource: 'pending'`.
   */
  const setPlace = useCallback(
    async (pick: PlacePick) => {
      const mine = ++ticket.current;
      const remember = pick.origin !== 'default';

      // 1. El punt, ja. Sense esperar res.
      commit(
        {
          location: { lat: pick.lat, lon: pick.lon, elevation: 0 },
          origin: pick.origin,
          label: pick.label ?? null,
          accuracyM: null,
          elevationSource: 'pending',
          gpsElevationM: null,
          atMs: Date.now(),
          restored: false,
        },
        // El punt d'exemple no és un lloc de l'usuari i no ha d'embrutar
        // l'historial ni tornar sol la propera vegada.
        remember,
      );

      // 2. L'altitud, quan es pugui. Si falla, el punt es queda igualment i el
      //    veredicte d'horitzó dirà que l'altitud no està verificada.
      const { elevation, source } = await resolveElevation(pick.lat, pick.lon, null);
      if (ticket.current !== mine) return;

      const current = fixRef.current;
      if (current === null) return;
      commit({ ...current, location: { ...current.location, elevation }, elevationSource: source }, remember);
    },
    [commit],
  );

  const setManual = useCallback(
    (lat: number, lon: number) => setPlace({ lat, lon, origin: 'map' }),
    [setPlace],
  );

  const useDefaultLocation = useCallback(
    () =>
      setPlace({
        lat: DEFAULT_LOCATION.lat,
        lon: DEFAULT_LOCATION.lon,
        origin: 'default',
      }),
    [setPlace],
  );

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, error: 'unsupported', loading: false }));
      return;
    }
    const mine = ++ticket.current;
    setState((s) => ({ ...s, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy, altitude } = pos.coords;
        const gpsElevationM = altitude ?? null;
        const { elevation, source } = await resolveElevation(
          latitude,
          longitude,
          gpsElevationM,
        );
        if (ticket.current !== mine) return;
        setPermission('granted');
        commit(
          {
            location: { lat: latitude, lon: longitude, elevation },
            origin: 'gps',
            label: null,
            accuracyM: accuracy,
            elevationSource: source,
            gpsElevationM,
            atMs: Date.now(),
            restored: false,
          },
          true,
        );
      },
      (err) => {
        if (ticket.current !== mine) return;
        const code = errorCode(err);
        if (code === 'denied') setPermission('denied');
        setState((s) => ({ ...s, loading: false, error: code }));
      },
      // 15 s de marge: un GPS fred sota arbres o dins d'un cotxe en necessita
      // deu llargs. `maximumAge` a un minut evita tornar a encendre el xip si
      // ja hi ha una posició fresca, que al camp val bateria de debò.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }, [commit]);

  /**
   * Posa el nom al punt actiu.
   *
   * El nom arriba d'una consulta de xarxa que pot tardar segons, i mentrestant
   * l'usuari pot haver canviat de lloc. Per això a l'historial NO s'etiqueta la
   * primera entrada sinó la que és el MATEIX LLOC que el punt actiu: si el punt
   * actiu és el d'exemple (que no entra a l'historial) o si l'usuari ja s'ha
   * mogut, etiquetar «la primera» posaria el nom d'un lloc damunt d'un altre, i
   * un nom equivocat a l'historial és pitjor que cap nom — perquè s'hi torna
   * confiant en ell.
   */
  const setLabel = useCallback((label: string | null) => {
    const current = fixRef.current;
    if (current === null || current.label === label) return;

    const fix: FixedLocation = { ...current, label };
    writeLastPlace(toRecent(fix));
    setState((s) => (s.fix === null ? s : { ...s, fix: { ...s.fix, label } }));

    // A l'historial s'etiqueta l'entrada que és EL MATEIX LLOC que el punt
    // actiu, no la primera. Si el punt actiu és el d'exemple (que no entra a
    // l'historial) o si l'usuari ja s'ha mogut mentre el nom viatjava per la
    // xarxa, etiquetar «la primera» posaria el nom d'un lloc damunt d'un altre.
    // Un nom equivocat a l'historial és pitjor que cap nom: s'hi torna confiant
    // en ell.
    let touched = false;
    const next = recentsRef.current.map((item) => {
      const same = isSamePlace(
        { lat: item.lat, lon: item.lon, elevation: item.elevation },
        current.location,
      );
      if (!same) return item;
      touched = true;
      return { ...item, label };
    });
    if (!touched) return;
    writeRecents(next);
    setRecents(next);
  }, []);

  const forget = useCallback((target: GeoLocation) => {
    const next = removeRecent(recentsRef.current, target);
    writeRecents(next);
    setRecents(next);
  }, []);

  const dismissIntro = useCallback(() => {
    writeAsked();
    setNeedsIntro(false);
  }, []);

  /* --- arrencada --------------------------------------------------------- */

  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    setRecents(readRecents().slice(0, MAX_RECENTS));
    setNeedsIntro(!readAsked());

    // L'últim lloc torna, però marcat: ve d'una altra estona i les condicions
    // (i els plans de l'usuari) poden haver canviat des de llavors.
    const last = readLastPlace();
    if (last !== null) {
      setState({
        fix: {
          location: { lat: last.lat, lon: last.lon, elevation: last.elevation },
          origin: last.origin,
          label: last.label,
          accuracyM: null,
          // La font que es va desar, i no una de suposada. Les entrades
          // antigues no la porten: llavors no se sap i es diu que no se sap,
          // que és millor que afirmar que ve del model sense saber-ho.
          elevationSource: last.elevationSource ?? 'assumed',
          gpsElevationM: null,
          atMs: last.atMs,
          restored: true,
        },
        error: null,
        loading: false,
      });
    }

    // Estat del permís, quan el navegador el sap dir. Serveix per no oferir
    // «Ubica'm» com si res quan l'usuari ja ha dit que no: allà el botó no fa
    // absolutament res i la culpa sembla de l'app.
    const permissions = navigator.permissions;
    if (permissions?.query) {
      permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          setPermission(status.state);
          status.onchange = () => setPermission(status.state);
        })
        .catch(() => {
          /* Safari antic no en sap. Ens quedem amb 'unknown'. */
        });
    }
  }, []);

  return {
    fix: state.fix,
    location: state.fix?.location ?? null,
    elevationSource: state.fix?.elevationSource ?? 'assumed',
    accuracy: state.fix?.accuracyM ?? null,
    error: state.error,
    loading: state.loading,
    permission,
    recents,
    needsIntro,
    locate,
    setManual,
    setPlace,
    useDefaultLocation,
    setLabel,
    forget,
    dismissIntro,
  };
}
