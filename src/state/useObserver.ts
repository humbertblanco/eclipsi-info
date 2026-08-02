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
 *     poder dir que ve d'una altra estona i no del gest d'ara. I si l'altitud
 *     que en torna no ve del model del terreny, es torna a demanar: desada una
 *     vegada, una altitud suposada no la revisava mai ningú.
 *
 * L'ALTITUD MAI DEL GPS. L'error vertical d'un GPS de mòbil és de ±10 a ±30 m,
 * i trenta metres desplacen l'horitzó visible prou com per canviar el veredicte
 * de si una muntanya et tapa el Sol. La posició HORITZONTAL del GPS sí que és
 * bona (±5 m) i amb ella el model del terreny dona l'altitud molt millor que el
 * propi GPS. La del GPS es guarda igualment a `gpsElevationM`, però només per
 * poder avisar quan les dues discrepen molt — i ni tan sols això es pot fer a
 * la babalà, perquè no es compten des de la mateixa superfície (vegeu
 * `elevationDisagrees` a `location.ts`).
 *
 * L'ORDRE DE LES DUES PASSADES —primer la posició, després l'altitud— viu a
 * `observerFlow.ts`, sense React, que és l'únic lloc on es pot provar.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { elevationAt } from '../core/horizon/elevation';
import type { GeoLocation } from '../core/astro/types';
import {
  DEFAULT_LOCATION,
  isSamePlace,
  type ElevationSource,
  type FixedLocation,
} from './location';
import {
  fixAndResolve,
  fixFromPick,
  fixFromPosition,
  planBoot,
  toRecent,
  type FixFlow,
  type FixPhase,
  type LinkedPoint,
  type PlacePick,
  type ResolvedElevation,
} from './observerFlow';
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
export type { LinkedPoint, PlacePick } from './observerFlow';

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
  location: GeoLocation,
  gpsElevationM: number | null,
): Promise<ResolvedElevation> {
  try {
    return { elevation: await elevationAt(location.lon, location.lat), source: 'dem' };
  } catch {
    if (gpsElevationM !== null) return { elevation: gpsElevationM, source: 'gps' };
    return { elevation: 0, source: 'assumed' };
  }
}

/** Què li pot dir qui munta el hook. Tot opcional: sense res, l'app arrenca igual. */
export interface ObserverOptions {
  /**
   * El punt que portava l'URL, ja llegit i validat.
   *
   * ARRIBA JA ANALITZAT I NO ES LLEGEIX AQUÍ DINS. Qui munta el hook (`App`) ja
   * ha hagut d'obrir l'URL per saber quin eclipsi s'hi demanava, i és qui
   * l'escriu quan el punt canvia. Llegir-lo dues vegades, en dos llocs, obre la
   * porta a la única cosa que no pot passar amb un enllaç: que la part de
   * l'adreça que decideix el LLOC i la que decideix l'ECLIPSI es llegeixin de
   * maneres diferents i acabin desaparellades.
   *
   * NOMÉS ES MIRA A L'ARRENCADA. Canviar-lo després no fa res: un cop l'app té
   * un punt, qui mana és l'usuari, i l'URL passa a ser el reflex del que ell fa,
   * no la font.
   */
  shared?: LinkedPoint | null;
}

export function useObserver(options?: ObserverOptions): ObserverApi {
  const shared = options?.shared ?? null;

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

  /**
   * Posa la llista a la referència I a l'estat, en aquest ordre.
   *
   * La referència no pot esperar el proper dibuix. Entre `setRecents` i el
   * render que l'aplica hi caben coses: en arrencar, el retorn de la tessel·la
   * del terreny arriba just després de carregar l'historial, i si llegís la
   * referència vella escriuria al disc la llista buida de fa un moment. O sigui
   * que l'historial sencer desapareixeria per haver anat a buscar una altitud.
   */
  const applyRecents = useCallback((next: readonly RecentPlace[]) => {
    recentsRef.current = next;
    setRecents(next);
  }, []);

  const commit = useCallback(
    (fix: FixedLocation, remember: boolean) => {
      // La referència, abans que l'estat i pel mateix motiu: la segona passada
      // (la de l'altitud) llegeix `fixRef` per no perdre el nom que hagi pogut
      // arribar mentrestant, i no pot dependre de quan React torni a dibuixar.
      fixRef.current = fix;
      setState({ fix, error: null, loading: false });
      if (!remember) return;
      const entry = toRecent(fix);
      const next = mergeRecent(recentsRef.current, entry);
      writeLastPlace(entry);
      writeRecents(next);
      applyRecents(next);
    },
    [applyRecents],
  );

  /**
   * Munta el context d'una petició: on va el resultat, qui resol l'altitud i
   * com se sap que la petició ja no interessa.
   *
   * `remember` va per passades perquè no totes dues volen el mateix. En
   * restaurar l'últim lloc, la primera passada NO s'ha de tornar a desar —ve
   * justament d'allà— però l'altitud que s'aconsegueix després SÍ, o cada
   * arrencada tornaria a demanar la mateixa tessel·la per sempre.
   */
  const flowFor = useCallback(
    (mine: number, remember: Record<FixPhase, boolean>): FixFlow => ({
      commit: (fix, phase) => commit(fix, remember[phase]),
      resolve: resolveElevation,
      stale: () => ticket.current !== mine,
      current: () => fixRef.current,
    }),
    [commit],
  );

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
   * tal amb `elevationSource: 'pending'`. L'ordre exacte és a `observerFlow.ts`,
   * que és on es pot provar sense navegador.
   */
  const setPlace = useCallback(
    async (pick: PlacePick) => {
      const mine = ++ticket.current;
      // El punt d'exemple no és un lloc de l'usuari i no ha d'embrutar
      // l'historial ni tornar sol la propera vegada.
      const remember = pick.origin !== 'default';
      await fixAndResolve(
        fixFromPick(pick, Date.now()),
        flowFor(mine, { placed: remember, elevation: remember }),
      );
    },
    [flowFor],
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

  /**
   * «On soc ara».
   *
   * LA POSICIÓ DEL GPS ES DONA PER BONA EN EL MOMENT QUE ARRIBA, igual que a
   * `setPlace` i pel mateix motiu. Abans aquí s'esperava la tessel·la del
   * terreny abans de fixar res, i el cas que ho va destapar és el pitjor
   * possible: el dia de l'eclipsi, amb cobertura dolenta, el GPS respon als
   * 12 s i la tessel·la triga 8 s més. Durant vint segons sencers la barra deia
   * «Cercant el senyal…» i `fix` era `null` —cap hora, cap compte enrere— quan
   * la posició ja se sabia des del segon dotze. L'altitud arriba després i, si
   * no arriba, el punt es queda igualment amb la font dient què li falta.
   */
  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({ ...s, error: 'unsupported', loading: false }));
      return;
    }
    const mine = ++ticket.current;
    setState((s) => ({ ...s, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // El permís s'apunta encara que la resposta arribi tard i s'acabi
        // descartant: que l'usuari hagi dit que sí segueix essent cert.
        setPermission('granted');
        const { latitude, longitude, accuracy, altitude } = pos.coords;
        void fixAndResolve(
          fixFromPosition(
            {
              lat: latitude,
              lon: longitude,
              accuracyM: accuracy,
              // L'altitud del GPS no calcula res: només serveix per poder
              // avisar quan discrepa molt del model (vegeu `elevationDisagrees`).
              gpsElevationM: altitude ?? null,
            },
            Date.now(),
          ),
          flowFor(mine, { placed: true, elevation: true }),
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
  }, [flowFor]);

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
  const setLabel = useCallback(
    (label: string | null) => {
      const current = fixRef.current;
      if (current === null || current.label === label) return;

      const fix: FixedLocation = { ...current, label };
      fixRef.current = fix;
      setState((s) => (s.fix === null ? s : { ...s, fix: { ...s.fix, label } }));

      // EL PUNT D'EXEMPLE NO ES DESA, TAMPOC AQUÍ. Posar-li el nom és una crida
      // de xarxa com qualsevol altra i abans arribava i escrivia l'últim lloc
      // sense mirar res, saltant-se la regla de `setPlace`. N'hi havia prou amb
      // obrir l'app un cop, deixar que resolgués el nom del punt d'Astúries, i
      // a partir d'aquell moment l'app arrencava sempre allà: xifres perfectes
      // d'un lloc on l'usuari no ha estat mai, i sense el cartell que ho digués,
      // perquè en tornar del disc `origin` ja no era `default`.
      if (current.origin === 'default') return;

      writeLastPlace(toRecent(fix));

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
      applyRecents(next);
    },
    [applyRecents],
  );

  const forget = useCallback(
    (target: GeoLocation) => {
      const next = removeRecent(recentsRef.current, target);
      writeRecents(next);
      applyRecents(next);
    },
    [applyRecents],
  );

  const dismissIntro = useCallback(() => {
    writeAsked();
    setNeedsIntro(false);
  }, []);

  /* --- arrencada --------------------------------------------------------- */

  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    // L'HISTORIAL, ABANS DE FIXAR RES. Si el punt de l'enllaç es desés amb la
    // llista encara buida a `recentsRef`, `mergeRecent` en fabricaria una de
    // nova amb una sola entrada i l'historial sencer desapareixeria del disc per
    // haver obert un enllaç.
    applyRecents(readRecents().slice(0, MAX_RECENTS));

    /*
      QUI MANA EN ARRENCAR. L'enllaç guanya el disc, i el disc guanya el buit.
      Les tres branques i el perquè de cadascuna són a `planBoot`
      (`observerFlow.ts`), que és pura i es prova; aquí només se n'aplica el
      resultat.

      EL QUE ES DECIDEIX AQUÍ NO ÉS NOMÉS EL PUNT: també si surt la pantalla
      d'introducció. Amb un punt vingut d'un enllaç no ha de sortir mai —seria
      l'app posant-se al davant del missatge que algú acaba de rebre—, i això no
      és cap cas especial afegit a fora sinó una conseqüència del pla.

      L'ÚLTIM LLOC DEL DISC, QUAN GUANYA, TORNA MARCAT: ve d'una altra estona i
      les condicions (i els plans de l'usuari) poden haver canviat. I si
      l'altitud desada no ve del model del terreny, es torna a demanar: una
      altitud `assumed` o `gps` vol dir que aquell dia no hi va haver tessel·la,
      i restaurar-la tal qual la fa eterna. El zero d'un punt que és a 1.520 m
      se n'aniria a les hores dels contactes i al veredicte d'horitzó sense que
      res ho tornés a mirar mai.
    */
    const plan = planBoot({
      link: shared,
      stored: readLastPlace(),
      asked: readAsked(),
      nowMs: Date.now(),
    });
    setNeedsIntro(plan.needsIntro);
    if (plan.fix !== null) {
      void fixAndResolve(plan.fix, flowFor(++ticket.current, plan.remember));
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
    // Les dues primeres són estables (`useCallback` sense dependències
    // canviants) i `shared` es llegeix un sol cop; hi són perquè la llista sigui
    // certa, no perquè l'efecte s'hagi de repetir: d'això ja se n'encarrega
    // `bootstrapped`. Si algun dia `shared` canviés de valor a mitja sessió,
    // aquesta guarda és justament el que impedeix que un enllaç vell torni a
    // moure l'usuari de lloc.
  }, [applyRecents, flowFor, shared]);

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
