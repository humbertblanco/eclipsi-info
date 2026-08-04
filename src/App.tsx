/**
 * Estructura de l'aplicació: quatre pestanyes, dues barres fixes de vidre.
 *
 * COM ESTÀ MUNTAT I PER QUÈ. El muntatge original del sistema
 * (`design-reference/ui_kits/app/index.html`) fixa tres coses que aquí es
 * respecten al peu de la lletra:
 *
 *   1. Capçalera de 56 px i barra de pestanyes de 64 px, totes dues de vidre i
 *      CLAVADES, amb el contingut desplaçant-s'hi per sota. A la portada la
 *      capçalera porta el logotip; a la resta de pestanyes, el nom de la
 *      pantalla.
 *   2. Quatre pestanyes: Compte enrere, Mapa, Cel, Guia. En aquest ordre, que
 *      és el de les preguntes que es fa la gent.
 *   3. Dues pantalles es desplacen (compte enrere i guia) i dues no (mapa i
 *      cel): un mapa que llisca sota el dit i alhora arrossega la pàgina és
 *      inservible, i la càmera ha d'omplir el marc sencer.
 *
 * PER QUÈ EL CÀLCUL PESAT VIU AQUÍ. `computeLocalCircumstances` fa una cerca
 * d'arrels amb centenars de crides a efemèrides i `computeVisibility` escombra
 * la fase central segon a segon. Les dues depenen NOMÉS del lloc i de
 * l'eclipsi, o sigui que fer-ho a cada pantalla voldria dir refer-ho a cada
 * canvi de pestanya per obtenir exactament el mateix resultat. Es calcula un
 * cop i es reparteix per `EclipseContext`.
 *
 * ESCRIPTORI. A partir de --bp-rail la barra inferior deixa de tenir sentit
 * (el polze no arriba a la part de baix d'una pantalla de 27") i passa a ser
 * un carril lateral; apareix la franja de dades editorial de la versió web i
 * les pantalles amb dues coses per ensenyar les posen de costat. La feina la fa
 * `screens.css`: aquí només es marca quina pantalla és quina.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatObscurationPercent } from './core/astro/obscuration';
import {
  BackTopBar,
  Button,
  ErrorBoundary,
  IconButton,
  Select,
  TabBar,
  TopBar,
  useMediaQuery,
  type TabBarItem,
} from './ui';
import { CountdownScreen } from './screens/CountdownScreen';

/*
 * LES TRES PANTALLES QUE NO SÓN LA PRIMERA, MANDROSES.
 *
 * El compte enrere és la primera pintada i es queda al paquet principal; el
 * mapa (que arrossega MapLibre), el cel (la vista de RA sencera) i la guia
 * es porten el seu tros de paquet i només es baixen quan es toquen. El dia
 * de l'eclipsi, amb la cel·la saturada, cada kB del camí crític es paga en
 * segons — i aquests tres no hi pinten res fins que algú els obre.
 *
 * ELS SEUS CHUNKS ES QUEDEN AL PRECACHE del service worker, i és una decisió:
 * la garantia offline és el producte (vite.config: globPatterns ho escombra
 * tot). El que es guanya aquí és el camí crític de la primera visita, no el
 * total de bytes de la instal·lació — i és el guany que compta.
 */
import { lazy, Suspense } from 'react';
const MapScreen = lazy(() =>
  import('./screens/MapScreen').then((m) => ({ default: m.MapScreen })),
);
const SkyScreen = lazy(() =>
  import('./screens/SkyScreen').then((m) => ({ default: m.SkyScreen })),
);
const AboutScreen = lazy(() =>
  import('./features/about').then((m) => ({ default: m.AboutScreen })),
);
const GuideScreen = lazy(() =>
  import('./screens/GuideScreen').then((m) => ({ default: m.GuideScreen })),
);
import type { EclipseContext } from './screens/context';
import { s } from './screens/strings';
import { formatCoords, formatDuration, NO_DATA } from './screens/format';
import { useHorizon } from './features/sim/useHorizon';
import { horizonFailureText, horizonProgressText } from './features/sim/strings';
import {
  LocationBar,
  LocationGate,
  LocationSheet,
  ls,
  useComparison,
  usePlaceName,
} from './features/location';
/*
 * S'importa del fitxer i no del barril a posta: és la condició interna de
 * l'avís de punt d'exemple, no una peça pública del selector. Vegeu el
 * comentari del col·lapse en scroll, més avall.
 */
import { isDefaultFix } from './features/location/LocationBar';
import { computeLocalCircumstances } from './core/astro/contacts';
import { computeVisibility } from './core/visibility/verdict';
import { durationBucket, horizonReason, terrainBucket, track } from './core/analytics';
import { ECLIPSES } from './core/eclipses/catalog';
import { buildShareLink, parseShareLink, type SharedPoint } from './features/share';
import { useObserver } from './state/useObserver';
import { UpdatePrompt } from './offline/UpdatePrompt';
import { ConsentBanner } from './features/consent/ConsentBanner';
import { useConsent } from './features/consent/useConsent';
import { ConnectionBadge } from './offline/ConnectionBadge';
import { useOnlineStatus } from './offline/useOnlineStatus';
import { LOCALES } from './i18n';
import { SiteFooter } from './screens/SiteFooter';
import { useCameraSupport } from './features/ar/useCameraSupport';
import { LocaleProvider, useTranslation } from './i18n';
import './screens/screens.css';

/*
 * `about` és una pestanya SENSE lloc a la barra: la pantalla «Com funciona»
 * hi arriba pel peu, pel diàleg de crèdits o per l'adreça #/com-funciona.
 * Passar-la pel mateix tipus que la resta és el que fa que l'historial, la
 * capçalera i el peu la tractin com qualsevol altra pantalla sense cap cas
 * especial.
 */
type Tab = 'countdown' | 'map' | 'sky' | 'guide' | 'about';

/**
 * Logotip. La ruta es compon amb `BASE_URL` perquè l'app viu en un subdirectori
 * (`/eclipsi/`) i una ruta absoluta hi trencaria.
 */
const LOGO_SRC = `${import.meta.env.BASE_URL}brand/logo.svg`;

/** Les pestanyes que no es desplacen: omplen el marc i el gestionen elles. */
const FIXED_TABS: readonly Tab[] = ['map', 'sky'];

/**
 * Data curta de cada eclipsi per al selector de la capçalera.
 *
 * Les etiquetes llargues del catàleg ("Eclipsi total del 12 d'agost de 2026")
 * no caben en una barra de 56 px al costat del logotip. La data en mono
 * tabular sí, i és la que la gent fa servir per referir-s'hi.
 */
function shortDate(id: string): string {
  const [year, month, day] = id.split('-');
  return `${day}.${month}.${year}`;
}

/**
 * Amplada per sota de la qual la capçalera no admet etiquetes llargues.
 *
 * A 390 px —la mida de mòbil més venuda— les tres accions demanaven 301,6 px
 * rígids d'una barra que, tret dels marges, en té 350: al títol li'n quedaven
 * quaranta-vuit i el logotip es llegia «eclip», tallat pel selector de data. A
 * 320 px, el botó d'ubicació sortia directament de la pantalla.
 *
 * El llindar és 480 i no 390 perquè el que no hi cap no hi cap una mica abans
 * de trencar-se: a 430 ja hi ha frec.
 */
const NARROW_HEADER = '(max-width: 480px)';

/**
 * Quan la franja de dades (Dateline) és visible i ja porta el lloc (el nom si
 * en té, les coordenades si no): repetir-lo al subtítol de la capçalera seria
 * dir la mateixa dada dues vegades a un pam de distància.
 *
 * LA GUARDA D'ALÇADA NO ÉS OPCIONAL: és la MATEIXA consulta que fa aparèixer
 * la franja a `screens.css` (un mòbil apaïsat passa els 900 d'amplada però no
 * té franja), i si les dues consultes divergissin hi hauria una finestra on
 * les coordenades no serien enlloc.
 */
const DATELINE_VISIBLE = '(min-width: 900px) and (min-height: 500px)';

/**
 * Amplada a partir de la qual la barra d'ubicació va SEMPRE compacta: a
 * l'escriptori el Dateline ja diu les coordenades i la barra sencera només
 * repetiria metadades que ja són a la vista. Mateixa guarda d'alçada que
 * DATELINE_VISIBLE i pel mateix motiu: sense franja, res no repeteix res.
 */
const DESKTOP_WIDE = '(min-width: 1180px) and (min-height: 500px)';

/*
 * LLINDARS DEL COL·LAPSE EN SCROLL DE LA BARRA D'UBICACIÓ.
 *
 * La barra és sticky i, sencera, són dues línies i mitja de crom permanent en
 * un mòbil de vuit: qui llegeix la guia o el compte enrere es passeja amb un
 * quart de pantalla ocupat per una dada que ja ha llegit. Passats uns píxels
 * de desplaçament es plega al format compacte (una línia, el nom i el botó),
 * i tocar-la segueix obrint la fulla de tria.
 *
 * DOS LLINDARS I NO UN, A POSTA (histèresi): amb un de sol, qui s'atura just
 * a sobre veu la barra obrir-se i tancar-se a cada píxel de rebot del dit.
 * Es col·lapsa passats 48 px i no es torna a obrir fins a tornar gairebé a
 * dalt de tot: entre l'un i l'altre, l'estat que hi hagi es queda.
 */
const LOC_COLLAPSE_Y = 48;
const LOC_EXPAND_Y = 8;

/**
 * L'any, quan la data sencera no hi cap.
 *
 * No és ambigu: el catàleg té un eclipsi per any i la data sencera surt a la
 * franja de dades i a la portada. La regla d'ESTAT.md de no canviar de paraula
 * segons l'amplada és per als NOMS —dues persones han d'anomenar igual la
 * mateixa pestanya—, i «2026» i «12.08.2026» no són dos noms: són la mateixa
 * data amb dues precisions.
 */
function shortYear(id: string): string {
  return id.split('-')[0];
}

/**
 * El punt que portava l'adreça, llegit UN SOL COP en muntar l'aplicació.
 *
 * PER QUÈ UNA SOLA LECTURA I NO UNA PER CONSUMIDOR. De l'enllaç en surten dues
 * coses que han d'anar juntes —el LLOC i l'ECLIPSI— i les fa servir gent
 * diferent: el lloc se l'endú `useObserver` i l'eclipsi es queda aquí, a l'estat
 * de l'estructura. Llegint l'URL dues vegades no passaria res avui, però el dia
 * que la lectura canviï en un dels dos llocs i no a l'altre, l'app quedaria
 * ensenyant l'eclipsi d'un enllaç al punt d'un altre — que és exactament la mena
 * de desaparellament que tot `state/location.ts` existeix per evitar.
 *
 * ES LLEGEIX EN UN INICIALITZADOR MANDRÓS (`useState(fn)`) I NO A L'ARREL DEL
 * MÒDUL: a l'arrel s'executaria en importar el fitxer, i llavors qualsevol prova
 * o eina que carregui `App` fora d'un navegador hi petaria per no tenir
 * `window`. Aquí només corre quan hi ha una aplicació muntant-se de debò.
 *
 * I NOMÉS A LA PRIMERA PINTADA. Un cop l'app funciona, qui mana és l'usuari:
 * l'URL passa a ser el reflex del que ell tria (vegeu l'efecte que l'escriu més
 * avall), no la font. Tornar-lo a llegir el faria manar dues vegades i el punt
 * de l'enllaç ressuscitaria damunt de la tria de l'usuari.
 */
function readSharedPoint(): SharedPoint | null {
  if (typeof window === 'undefined') return null;
  return parseShareLink(window.location.search);
}

/*
 * LA PESTANYA, AL FRAGMENT DE L'ADREÇA.
 *
 * Fins ara l'URL deia ON (el punt, a la consulta ?p=...) però no QUÈ s'estava
 * mirant: la pestanya no es podia enllaçar i el botó d'enrere del navegador
 * sortia de l'app sencera. El fragment és el lloc natural per a això: no
 * viatja al servidor (l'app viu darrere d'un start_url net, vegeu el
 * manifest), i conviu amb la consulta del punt sense tocar-la.
 *
 * LA PORTADA NO TÉ FRAGMENT, a posta: l'arrel neta és l'adreça canònica que
 * surt impresa i compartida, i «#/compte-enrere» seria un segon nom per a la
 * mateixa porta d'entrada.
 */
const HASH_BY_TAB: Record<Tab, string> = {
  countdown: '',
  map: '#/mapa',
  sky: '#/cel',
  guide: '#/guia',
  about: '#/com-funciona',
};

/*
 * LA VISTA DEL MAPA, AL SEGON SEGMENT DEL FRAGMENT (`#/mapa/llocs`), amb el
 * mateix contracte que les seccions de la guia (`#/guia/<seccio>`): el nom
 * públic és en català —és una adreça que la gent llegeix i comparteix— i el
 * nom intern és cosa del codi. `#/mapa` a seques és la franja, que és la
 * vista per defecte i per això no porta segment (la mateixa regla que fa que
 * la portada no porti fragment: el cas per defecte té el nom net).
 *
 * LA TAULA VIU AQUÍ I NO A MapScreen pel paquet: el fragment es llegeix a la
 * primera pintada i MapScreen és un tros mandrós que potser no es baixa mai.
 * És MapScreen qui la importa d'aquí per ESCRIURE el fragment quan es canvia
 * de vista — en la direcció contrària, una importació estàtica de MapScreen
 * des d'App fondria el tros sencer al paquet principal.
 */
export type MapView = 'band' | 'clouds' | 'move' | 'spots' | 'align';

export const MAP_SEGMENT_BY_VIEW: Record<MapView, string> = {
  band: 'franja',
  clouds: 'nuvols',
  move: 'durada',
  spots: 'llocs',
  align: 'enquadra',
};

/** La taula de dalt, girada per llegir el fragment. Una i prou: si fossin
    dues escrites a mà, un dia divergirien i una adreça deixaria d'obrir-se. */
const MAP_VIEW_BY_SEGMENT = new Map<string, MapView>(
  (Object.entries(MAP_SEGMENT_BY_VIEW) as [MapView, string][]).map(
    ([view, segment]) => [segment, view],
  ),
);

/** El que diu el fragment: quina pestanya i, si és la guia, quina secció. */
interface HashRoute {
  tab: Tab;
  /** Clau de contingut de la guia (`safety`, `phases`…), o `null`. */
  section: string | null;
  /** Vista de la fitxa del mapa, o `null` si la ruta no és del mapa. */
  view: MapView | null;
}

/*
 * Llegeix el fragment amb la mateixa desconfiança que `parseShareLink` llegeix
 * la consulta: el fragment l'escriu qualsevol. Una ruta desconeguda no és un
 * error a ensenyar, és la portada: l'enllaç d'una versió futura amb una
 * pantalla que aquesta versió no té ha d'obrir l'app, no una pàgina d'error.
 */
function parseHashRoute(hash: string): HashRoute {
  if (hash === HASH_BY_TAB.map) return { tab: 'map', section: null, view: 'band' };
  if (hash === HASH_BY_TAB.sky) return { tab: 'sky', section: null, view: null };
  if (hash === HASH_BY_TAB.about) return { tab: 'about', section: null, view: null };
  if (hash === `${HASH_BY_TAB.about}/premsa`)
    return { tab: 'about', section: 'premsa', view: null };
  if (hash === HASH_BY_TAB.guide) return { tab: 'guide', section: null, view: null };
  // La secció viatja SENSE el prefix «guia-» de l'àncora del DOM: el fragment
  // és una adreça pública i el prefix és un detall del marcatge. Si la clau no
  // existeix a la guia, la pantalla l'ignora en silenci (getElementById nul).
  const guideSection = /^#\/guia\/([\w-]+)$/.exec(hash);
  if (guideSection !== null)
    return { tab: 'guide', section: guideSection[1], view: null };
  // La vista del mapa, amb la mateixa desconfiança: un segment que aquesta
  // versió no coneix obre el mapa a la franja, EN SILENCI — l'enllaç d'una
  // versió futura amb una vista nova ha d'obrir el mapa, no una pantalla buida.
  const mapView = /^#\/mapa\/([\w-]+)$/.exec(hash);
  if (mapView !== null)
    return {
      tab: 'map',
      section: null,
      view: MAP_VIEW_BY_SEGMENT.get(mapView[1]) ?? 'band',
    };
  return { tab: 'countdown', section: null, view: null };
}

/**
 * La ruta amb què arrenca l'app, llegida UN SOL COP al costat de
 * `readSharedPoint` i pel mateix motiu: després de la primera pintada, el
 * fragment és el reflex del que l'usuari navega, no la font.
 */
function readInitialRoute(): HashRoute {
  if (typeof window === 'undefined')
    return { tab: 'countdown', section: null, view: null };
  return parseHashRoute(window.location.hash);
}

export default function App() {
  return (
    <LocaleProvider>
      <Shell />
    </LocaleProvider>
  );
}

function Shell() {
  const { locale, setLocale, t } = useTranslation();
  const narrowHeader = useMediaQuery(NARROW_HEADER);
  const datelineVisible = useMediaQuery(DATELINE_VISIBLE);
  const desktopWide = useMediaQuery(DESKTOP_WIDE);

  /*
   * EL COL·LAPSE EN SCROLL. Escoltador passiu + requestAnimationFrame: llegir
   * `scrollY` a cada esdeveniment de scroll és exactament la feina que fa
   * saltar fotogrames, o sigui que es llegeix un cop per fotograma i prou.
   * La histèresi és als llindars (vegeu LOC_COLLAPSE_Y / LOC_EXPAND_Y).
   */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        setScrolled((prev) => (prev ? y > LOC_EXPAND_Y : y > LOC_COLLAPSE_Y));
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    // La primera lectura, ara mateix: una pàgina restaurada a mig desplaçament
    // no ha d'esperar el primer gest per plegar la barra.
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);
  const camera = useCameraSupport();
  const { online } = useOnlineStatus();
  const [shared] = useState(readSharedPoint);
  const observer = useObserver({ shared });
  /*
   * LA PESTANYA ARRENCA DEL FRAGMENT: obrir `?p=...#/mapa` ha d'aterrar al
   * mapa amb el punt carregat, que és la forma que té un enllaç de dir «mira
   * AIXÒ des d'AQUÍ». Si el fragment demana el cel i aquest aparell no en té
   * (useCameraSupport), la guarda de més avall el torna a la portada — sense
   * apilar res a l'historial, perquè l'usuari no hi ha navegat: hi ha caigut.
   */
  const [route] = useState(readInitialRoute);
  const [tab, setTab] = useState<Tab>(route.tab);
  /*
   * EL CONSENTIMENT DE COOKIES. Viu aquí i no dins del bàner perquè el peu
   * també l'ha de tocar: qui ja ha contestat necessita poder canviar d'opinió,
   * i un consentiment que no es pot retirar tan fàcilment com es dona no és
   * vàlid. Dos components, un sol estat — que és la mateixa lliçó del
   * commutador de la fitxa i el plafó de capes del mapa.
   */
  const consent = useConsent();
  /*
   * La secció de guia demanada pel fragment (`#/guia/safety`). És un encàrrec
   * d'ATERRATGE, no l'estat dels <details> —d'aquell n'és amo el navegador
   * (vegeu GuideView)—: la pantalla de la guia el rep, obre la secció, hi fa
   * scroll, i a partir d'aquí qui mana és el dit de l'usuari.
   */
  const [guideSection, setGuideSection] = useState<string | null>(route.section);
  /*
   * La vista del mapa demanada per una navegació (`#/mapa/llocs`, la crida a
   * l'acció del compte enrere, l'enrere del navegador). Mateix contracte que
   * `guideSection`: un encàrrec d'ATERRATGE, no l'estat de la fitxa — d'aquell
   * n'és amo el commutador de MapScreen, que quan l'usuari canvia de vista
   * reescriu el fragment pel seu compte (amb `replaceState`, vegeu-lo allà).
   */
  const [mapView, setMapView] = useState<MapView>(route.view ?? 'band');
  /*
   * QUANTES ENTRADES D'HISTORIAL HA APILAT L'APP en aquesta sessió. La fletxa
   * d'enrere de la capçalera només pot fer `history.back()` si darrere hi ha
   * una entrada NOSTRA: si l'usuari ha aterrat directament a `#/mapa` des d'un
   * missatge, darrere hi ha el WhatsApp d'on venia, i «enrere» l'expulsaria de
   * l'app pel gest que dins de l'app vol dir «torna a la portada». És un ref i
   * no estat perquè comptar navegacions no ha de repintar res.
   */
  const appPushes = useRef(0);
  /*
   * MODE IMMERSIU: la pantalla del cel amb la càmera oberta demana la
   * pantalla sencera i el marc s'aparta — capçalera, barra d'ubicació i
   * pestanyes fora. La sortida és el botó de tancar de la càmera, i
   * qualsevol camí que la tanqui (error, permís, crash de la vista, canviar
   * de pestanya) ho restaura: el booleà viu lligat a l'estat REAL de la
   * càmera via onState/onImmersiveChange, no a cap record.
   */
  const [skyImmersive, setSkyImmersive] = useState(false);
  // L'eclipsi de l'enllaç, si en portava un de reconeixible. `parseShareLink` ja
  // n'ha descartat els que no són del catàleg: aquí no pot arribar un id que
  // faci llançar `getEclipse` i s'endugui la pantalla sencera.
  const [eclipseId, setEclipseId] = useState(shared?.eclipseId ?? ECLIPSES[0].id);
  const [sheetOpen, setSheetOpen] = useState(false);

  // El perfil d'horitzó es calcula un sol cop per ubicació i el comparteixen
  // totes les pantalles: són uns 150 tessel·les de terreny i 2,6 milions de
  // mostres, no és cosa de fer-ho dues vegades.
  // 1,6 m: ulls d'una persona dreta. El model de terreny posa l'observador
  // arran de terra, i aquell metre i mig llarg és un desplaçament vertical
  // sistemàtic de l'horitzó a prop — petit al veredicte (dècimes de grau a un
  // quilòmetre), però l'ancoratge de la càmera compara siluetes al detall i
  // se'l menjava com a biaix. Canviar-ho invalida la memòria cau de perfils
  // una vegada (l'altura entra a la signatura) i es recalculen sols.
  const horizon = useHorizon(observer.location, { heightAboveGroundM: 1.6 });

  const circumstances = useMemo(
    () =>
      observer.location === null
        ? null
        : computeLocalCircumstances(eclipseId, observer.location),
    [eclipseId, observer.location],
  );

  // Sense perfil del terreny NO hi ha veredicte. Podríem fer-lo amb horitzó pla
  // i seria optimista sense dir-ho; les pantalles prefereixen ensenyar la xifra
  // teòrica i avisar que el relleu encara no hi entra.
  const verdict = useMemo(
    () =>
      circumstances === null || horizon.profile === null
        ? null
        : computeVisibility(circumstances, horizon.profile),
    [circumstances, horizon.profile],
  );

  /*
    EL NOM DEL LLOC, ENGANXAT AL PUNT.

    `usePlaceName` (de `features/location/PlaceName.tsx`, que resol topònims
    contra `src/core/places/`) es munta AQUÍ i no dins d'una pantalla, i el que
    troba va a parar a l'estat de l'observador. La diferència no és
    d'arquitectura, és de comportament: així el nom surt a la barra, entra a
    l'historial i etiqueta la comparació de llocs. Muntat dins d'una pantalla,
    el nom només existiria mentre aquella pantalla estigués oberta i
    l'historial s'ompliria de coordenades sense nom.

    NOMÉS S'APLIQUEN ELS NOMS QUE EXISTEIXEN. Un `null` vol dir «no s'ha pogut
    resoldre», i no ha de trepitjar el nom que ja tingui el punt: si l'usuari ha
    triat «Peníscola» de la cerca i després es queda sense xarxa, el nom que va
    triar ell no es pot esborrar.
  */
  const { setLabel } = observer;
  const onPlaceResolved = useCallback(
    (label: string | null) => {
      if (label !== null) setLabel(label);
    },
    [setLabel],
  );
  usePlaceName(observer.location, { locale, onResolved: onPlaceResolved });

  // El segon lloc de la comparació. Viu aquí i no dins de la fulla perquè
  // tancar-la i tornar-la a obrir no ha de perdre la comparació que s'estava
  // mirant: comparar dos llocs vol anar i tornar del mapa.
  const comparison = useComparison(
    eclipseId,
    circumstances,
    observer.fix?.label ?? null,
  );

  const context: EclipseContext = {
    eclipseId,
    locale,
    location: observer.location,
    // El nom del lloc ja no és `null` fix: ve del punt triat, que és qui el sap.
    placeLabel: observer.fix?.label ?? null,
    circumstances,
    verdict,
    horizon: horizon.profile,
  };

  // Etiquetes curtes: a la barra, cada pestanya té una quarta part de 390 px.
  // Al carril de l'escriptori hi cabria el nom llarg, però canviar de paraula
  // segons l'amplada faria que dues persones no anomenessin igual la mateixa
  // pestanya.
  /*
   * LA PESTANYA DEL CEL NOMÉS SURT ON POT FUNCIONAR.
   *
   * Demana una càmera que miri cap ENFORA i sensors d'orientació. En un
   * ordinador de sobretaula la càmera mira l'usuari i no hi ha giroscopi: la
   * funció no és pitjor, és una altra cosa que no serveix per a res, i qui la
   * prova conclou que l'app està trencada. Vegeu `useCameraSupport`, que
   * pregunta per capacitats i no pel «user agent».
   */
  const tabs: readonly TabBarItem<Tab>[] = [
    { value: 'countdown', label: s('tab.countdown', locale), icon: 'timer' },
    { value: 'map', label: s('tab.map', locale), icon: 'map' },
    ...(camera.supported
      ? [{ value: 'sky' as const, label: s('tab.sky', locale), icon: 'camera' as const }]
      : []),
    { value: 'guide', label: s('tab.guide', locale), icon: 'book-open' },
  ];

  const titles: Record<Tab, string> = {
    countdown: s('common.eclipse', locale),
    map: s('title.map', locale),
    sky: s('title.sky', locale),
    guide: s('title.guide', locale),
    about: s('title.about', locale),
  };

  /*
   * NAVEGAR DE PESTANYA APILA UNA ENTRADA (`pushState`), i és el contrari
   * exacte del `replaceState` del punt de més avall: moure el punt no és
   * navegar, però canviar de pantalla SÍ. Amb l'entrada apilada, el botó
   * d'enrere del navegador torna a la pantalla anterior en comptes de sortir
   * de l'app, que és el que fa a qualsevol web.
   *
   * LA CONSULTA ES CONSERVA INTACTA: el punt (?p&e&n) és ortogonal a la
   * pestanya i canviar de pantalla no ha de fer perdre el lloc de l'enllaç.
   */
  /*
   * EL SEGON PARÀMETRE ÉS NOU I OPCIONAL: la vista del mapa amb què s'ha
   * d'obrir la pestanya («porta'm al mapa, A LA VISTA DE LLOCS»). Qui no el
   * passa —la barra de pestanyes, totes les crides velles— navega com sempre.
   */
  const navigateTab = useCallback(
    (next: Tab, mapViewTarget?: MapView) => {
      /*
       * Tocar «Mapa» quan ja s'hi és no és anar enlloc, i aquí NI ES TOCA el
       * fragment: del segment de vista n'és amo el commutador de MapScreen, i
       * reescriure'l des d'aquí diria «franja» damunt d'una vista que potser
       * és una altra. (Amb destí explícit sí que es navega: és una vista nova.)
       */
      if (next === 'map' && tab === 'map' && mapViewTarget === undefined) return;
      setTab(next);
      // Navegació nova de la barra: sense secció encarregada. Si no es netegés,
      // sortir de la guia i tornar-hi repetiria l'scroll a la secció de l'enllaç.
      setGuideSection(null);
      // La vista amb què s'obre el mapa: la demanada, o la franja. Tornar-hi
      // per la barra obre sempre la vista per defecte, com ha fet sempre.
      if (next === 'map') {
        setMapView(mapViewTarget ?? 'band');
        // Amb destí explícit ve d'una crida a l'acció; sense, de la barra. La
        // diferència separa un problema de descobriment d'un de demanda.
        track('map_view_open', {
          view: mapViewTarget ?? 'band',
          via: mapViewTarget === undefined ? 'tab' : 'cta',
        });
      }
      const fragment =
        next === 'map' && mapViewTarget !== undefined && mapViewTarget !== 'band'
          ? `${HASH_BY_TAB.map}/${MAP_SEGMENT_BY_VIEW[mapViewTarget]}`
          : HASH_BY_TAB[next];
      const target = `${window.location.pathname}${window.location.search}${fragment}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      // Tocar la pestanya on ja s'és no és anar enlloc: sense la guarda,
      // cada toc redundant apilaria una entrada que fa l'enrere més llarg.
      if (target === current) return;
      window.history.pushState(null, '', target);
      appPushes.current += 1;
    },
    [tab],
  );

  /*
   * Tornada a la portada SENSE apilar res: és el destí de les caigudes (el cel
   * que desapareix, la fletxa quan no hi ha historial nostre), no d'una
   * navegació. El fragment que quedi es neteja amb `replaceState` perquè
   * l'adreça no digui una pantalla que ja no s'està mirant.
   */
  const resetToCountdown = useCallback(() => {
    setTab('countdown');
    setGuideSection(null);
    if (window.location.hash !== '') {
      window.history.replaceState(
        // L'estat que hi hagi es conserva: no és nostre.
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}`,
      );
    }
  }, []);

  /*
   * EL BOTÓ D'ENRERE DEL NAVEGADOR, ESCOLTAT. Quan l'historial es mou
   * (enrere o endavant), el fragment ja ha canviat: aquí només es llegeix i
   * s'hi posa la pantalla a joc, SENSE tornar a apilar res — apilar dins de
   * `popstate` és la recepta clàssica de l'historial que no es buida mai.
   *
   * El comptador d'entrades nostres baixa aquí i no distingeix enrere
   * d'endavant (l'API no ho diu): és una fita conservadora — com a molt fa que
   * la fletxa de la capçalera caigui al camí segur (portada directa) un cop
   * de més, mai que expulsi ningú de l'app.
   */
  useEffect(() => {
    const onPopState = () => {
      appPushes.current = Math.max(0, appPushes.current - 1);
      const next = parseHashRoute(window.location.hash);
      // El cel d'un historial vell en un aparell sense càmera: mateixa regla
      // que la guarda de sota, la portada i sense tocar l'historial.
      if (next.tab === 'sky' && !camera.unknown && !camera.supported) {
        setTab('countdown');
        setGuideSection(null);
        return;
      }
      setTab(next.tab);
      // `section` també és l'encàrrec d'aterratge de «Premsa». El nom històric
      // de l'estat es conserva per no escampar un canvi purament mecànic.
      setGuideSection(next.tab === 'guide' || next.tab === 'about' ? next.section : null);
      // La vista del mapa d'aquella entrada: així «enrere» no torna només a la
      // pestanya sinó a la vista que s'hi estava mirant.
      if (next.view !== null) {
        setMapView(next.view);
        track('map_view_open', { view: next.view, via: 'link' });
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [camera.unknown, camera.supported]);

  /*
   * L'ATERRATGE, mesurat un sol cop. `route` i `shared` surten
   * d'inicialitzadors de `useState` i no canvien mai: això corre una vegada
   * (dues en desenvolupament, per l'StrictMode). Un enllaç compartit que obre
   * una vista concreta del mapa és el camí que decideix si la targeta per punt
   * val la pena, i fins ara no en sabíem res.
   */
  useEffect(() => {
    if (route.tab === 'map' && route.view !== null) {
      track('map_view_open', { view: route.view, via: 'link' });
    }
    if (shared !== null) track('point_set', { method: 'shared_link', had_point: 'no' });
  }, [route, shared]);

  /*
   * EL VEREDICTE SENCER, amb el terreny ja comptat: quants segons en queden i
   * quants se n'ha menjat el relleu. És l'única xifra que fa aquesta app i no
   * en fa cap altra, i si resulta que el relleu roba segons a molta gent, ha
   * de deixar de ser un detall de la fitxa i passar a ser el titular.
   */
  useEffect(() => {
    if (circumstances === null || verdict === null) return;
    track('verdict_shown', {
      kind: circumstances.kind,
      duration: durationBucket(verdict.centralVisibleSec),
      terrain: terrainBucket(circumstances.centralDurationSec, verdict.centralVisibleSec),
    });
  }, [circumstances, verdict]);

  useEffect(() => {
    if (horizon.error === null) return;
    const reason = horizonReason(horizon.error.code);
    // Nul vol dir «cancel·lat»: no és cap avaria i no s'ha de comptar.
    if (reason !== null) track('horizon_failed', { reason });
  }, [horizon.error]);

  /*
   * Si la pestanya del cel desapareix mentre s'hi és —una sessió restaurada en
   * un altre aparell, o el navegador que canvia de resposta— no s'hi pot quedar
   * ningú mirant una pantalla que ja no és a la barra. També és el camí de
   * l'aterratge a `#/cel` des d'un aparell sense càmera: caiguda, no navegació,
   * o sigui `resetToCountdown` i cap `pushState`.
   */
  useEffect(() => {
    if (!camera.unknown && !camera.supported && tab === 'sky') resetToCountdown();
  }, [camera.unknown, camera.supported, tab, resetToCountdown]);

  /*
    L'ADREÇA SEGUEIX EL PUNT.

    PER QUÈ. Sense això, compartir seria una funció a part amb un botó propi, i
    una funció a part és una funció que no es fa servir: el gest que la gent fa
    de debò per enviar el que està mirant és copiar l'adreça de la barra del
    navegador. Que l'adreça digui sempre on ets vol dir que aquell gest ja
    funciona sense haver-lo d'aprendre — i de passada, recarregar la pàgina,
    afegir-la a favorits o desar-la a la pantalla d'inici conserven el lloc.

    `replaceState` I MAI `pushState`. Moure el punt no és navegar: si cada tria
    apilés una entrada a l'historial, tocar deu punts del mapa per comparar-los
    deixaria el botó d'enrere amb deu passes enrere que no porten enlloc, i
    l'usuari que el prem per sortir de l'app es quedaria dins fent marxa enrere
    pels seus propis clics. Amb `replaceState`, «enrere» segueix volent dir el
    que l'usuari espera: la pàgina d'on venia.

    LA RUTA SURT DE `location.pathname` I NO DE `BASE_URL`. L'app viu en un
    subdirectori (`/eclipsi/`) i una ruta absoluta escrita a mà el perdria; però
    compondre-la amb `import.meta.env.BASE_URL` tampoc no és exacte, perquè el
    servidor pot estar servint `/eclipsi/index.html` i llavors la ruta de
    `BASE_URL` no és la que hi ha a la barra. `pathname` ja porta el subdirectori
    per definició, sigui quin sigui. El fragment (`#`) es conserva pel mateix
    motiu: no és nostre i no tenim cap dret a esborrar-lo.

    NOMÉS S'ESCRIU SI CANVIA. Sense la comparació, cada dibuix tornaria a cridar
    `replaceState` amb el mateix text; no és car, però Safari limita les crides a
    l'API d'historial i acaba llançant, i seria una excepció per no fer res.
  */
  useEffect(() => {
    if (observer.location === null) return;

    const search = buildShareLink({
      lat: observer.location.lat,
      lon: observer.location.lon,
      eclipseId,
      // El nom viatja amb l'enllaç perquè qui l'obri dalt d'un port de muntanya
      // no té xarxa per resoldre el topònim, i sense ell la barra li diria unes
      // coordenades on hauria de dir el nom del lloc on heu quedat.
      label: observer.fix?.label ?? null,
    });
    if (search === window.location.search) return;

    window.history.replaceState(
      // L'estat que hi hagi es conserva: no és nostre.
      window.history.state,
      '',
      `${window.location.pathname}${search}${window.location.hash}`,
    );
  }, [observer.location, observer.fix?.label, eclipseId]);

  const fixed = FIXED_TABS.includes(tab);

  // Les accions de la capçalera són les mateixes a totes les pestanyes: el
  // selector d'eclipsi i el botó d'ubicar-se. Es declaren un cop perquè la
  // portada i les pantalles interiors fan servir capçaleres diferents i, si
  // s'escrivissin dues vegades, acabarien divergint.
  const headerActions = (
    <>
      <Select
        className="shell__eclipse"
        aria-label={s('shell.eclipse', locale)}
        value={eclipseId}
        onChange={setEclipseId}
        options={ECLIPSES.map((e) => ({
          value: e.id,
          // A la roda desplegada hi ha lloc de sobra i s'hi vol la data
          // sencera; el que no hi cap a 390 px és l'etiqueta TANCADA. Com que
          // les dues surten de la mateixa `<option>`, es tria per amplada.
          label: narrowHeader ? shortYear(e.id) : shortDate(e.id),
        }))}
      />
      {/*
        L'IDIOMA, QUE FINS ARA NO ES PODIA CANVIAR.

        Les dues traduccions hi eren senceres, `setLocale` estava escrit i
        provat, i `locale.switch` / `locale.ca` / `locale.es` esperaven al
        diccionari des del primer dia. No els cridava ningú: l'app era catalana
        i prou, i l'única manera d'arribar al castellà era editar
        `localStorage` a mà. Per a una app que es fa servir a tot Espanya,
        això no és un detall.

        Va a la capçalera i no dins d'un menú d'ajustos perquè no n'hi ha, i
        perquè és una tria que es fa un cop i es recorda.
      */}
      <Select
        className="shell__locale"
        aria-label={t('locale.switch')}
        value={locale}
        onChange={(next) => setLocale(next as typeof locale)}
        options={LOCALES.map((code) => ({
          value: code,
          // El codi en majúscules quan no hi cap el nom. És el que fan servir
          // els navegadors i els teclats, i qui busca l'idioma el reconeix.
          label: narrowHeader ? code.toUpperCase() : t(`locale.${code}`),
        }))}
      />
      {/*
        ABANS AQUEST BOTÓ DISPARAVA EL GPS directament, i era l'únic camí cap a
        la ubicació fora de la càmera. Dos problemes: el diàleg del navegador
        sortia sense haver explicat res, i «on ets» no és la pregunta que fa qui
        planifica. Ara obre la fulla de tria, que conté el GPS i tres maneres
        més de dir on seràs.
      */}
      <IconButton
        className="shell__locate"
        icon="map-pin"
        variant="ghost"
        label={ls('bar.open', locale)}
        onClick={() => setSheetOpen(true)}
      />
    </>
  );

  /*
   * LA PORTA DE LA UBICACIÓ ÉS OBERTA?
   *
   * Es calcula un sol cop i la fan servir DOS llocs: la porta mateixa i el
   * bàner de cookies, que no ha de sortir mentre aquella hi és. La condició
   * estava escrita en línia dins del JSX i s'ha pujat aquí precisament perquè
   * ara la necessita algú altre: dues còpies de la mateixa condició són dues
   * coses que un dia discreparan.
   */
  const introOpen = observer.needsIntro && observer.fix === null;

  return (
    <div
      className={
        tab === 'sky' && skyImmersive
          ? 'shell shell--fixed shell--immersive'
          : fixed
            ? 'shell shell--fixed'
            : 'shell'
      }
    >
      {/*
        L'AVÍS DE VERSIÓ NOVA, A L'ARREL.

        Existia i estava muntat dins d'`OfflinePanel`, que no es munta enlloc:
        o sigui que la versió nova s'instal·lava, es quedava esperant, i no hi
        havia cap manera d'activar-la. És exactament per això que calia obrir
        l'app en una pestanya privada per veure els canvis.
      */}
      <UpdatePrompt locale={locale} />

      <header className="shell__header">
        {/*
          Portada amb LOGOTIP, la resta amb FLETXA D'ENRERE. És la distinció que
          fa el muntatge del sistema (`design-reference/ui_kits/app/index.html`)
          i no és decorativa: diu quina és la pantalla d'inici de les quatre. La
          barra de pestanyes diu ON ETS; la fletxa diu D'ON HAS SORTIT, que amb
          una pantalla de mapa o de càmera a pantalla completa deixa de ser
          evident.
        */}
        {tab === 'countdown' ? (
          // A la portada el títol no es veu —hi ha el logotip—, o sigui que
          // aquí no ha de ser l'etiqueta curta de la pestanya sinó la frase
          // que descriu l'app: és l'`h1` del document.
          <TopBar logo logoSrc={LOGO_SRC} title={s('home.h1', locale)} right={headerActions} />
        ) : (
          <BackTopBar
            title={titles[tab]}
            backLabel={s('nav.countdown', locale)}
            /*
              LA FLETXA DESFÀ EL CAMÍ DE VERITAT quan n'hi ha: si l'app ha
              apilat entrades en aquesta sessió, `history.back()` fa que la
              fletxa i el gest d'enrere del sistema siguin EL MATEIX moviment
              (el popstate de dalt farà el canvi de pantalla). Si no n'hi ha
              cap —aterratge directe a `#/mapa`—, darrere hi ha la pàgina d'on
              venia l'usuari i la fletxa cau al camí segur: la portada.
            */
            onBack={() => {
              if (appPushes.current > 0) window.history.back();
              else resetToCountdown();
            }}
            /*
              EL LLOC, només mentre el Dateline no el diu: a partir de
              --bp-rail la franja de dades és visible i el porta, i la mateixa
              dada dues vegades a un pam fa dubtar de si és la mateixa dada.
              I EL NOM MANA: quan el punt en té, el subtítol diu el nom — les
              coordenades queden per a quan encara no n'hi ha (resolent-se o
              offline), sense parpelleig, com pertot.
            */
            subtitle={
              datelineVisible || observer.location === null
                ? undefined
                : (observer.fix?.label ??
                    formatCoords(observer.location.lat, observer.location.lon))
            }
            right={headerActions}
          />
        )}
      </header>

      <Dateline
        context={context}
        eclipseId={eclipseId}
        locale={locale}
      />

      <main className={fixed ? 'shell__main shell__main--fixed' : 'shell__main'}>
        {/*
          LA UBICACIÓ, LA PRIMERA COSA I A TOTES LES PANTALLES.

          Va aquí i no dins de cada pantalla per una raó de fons: les quatre
          pantalles ensenyen xifres que depenen del punt, i si l'estat de la
          ubicació fos de cada pantalla, n'hi hauria alguna que se'l deixaria i
          allà es tornarien a poder llegir hores d'un altre lloc sense saber-ho.
          Muntada un sol cop a l'estructura, això no pot passar.
        */}
        {/*
          A LA PANTALLA DE LA CÀMERA VA COMPACTA.

          És la mateixa barra i el mateix estat —no se'n pot fer una altra, per
          la raó de sobre—, però allà ocupava dues línies i mitja de les vuit
          que té un mòbil, i el que ha d'ocupar la pantalla és el cel. En
          format compacte queda en una línia: el nom del lloc i el botó de
          canviar-lo, que és l'únic que s'hi fa.
        */}
        {/*
          L'ESTAT DE LA XARXA, NOMÉS QUAN NO N'HI HA.

          La insígnia existia (`offline/ConnectionBadge`) i no la muntava
          ningú: al camp, sense cobertura, l'app no deia enlloc si allò era
          una avaria o el cas previst. Es munta a l'estructura i no dins d'una
          pantalla perquè la pregunta «em funcionarà sense xarxa?» no és de cap
          pestanya concreta — al cim se la faran davant de la càmera, a casa
          davant del mapa.

          NOMÉS APAREIX SENSE XARXA, a posta: en línia és l'estat normal i una
          píndola permanent que digui «EN LÍNIA» a cada pantalla seria soroll
          (i a 390 px, la capçalera ja va justa: vegeu NARROW_HEADER). El que
          la insígnia distingeix quan surt és el que importa: «desat» (l'app
          funcionarà) o «no desat» (no hi ha res a fer sense xarxa).
        */}
        {!online && (
          <div className="off-connection">
            <ConnectionBadge locale={locale} />
          </div>
        )}

        {/*
          QUAN VA COMPACTA: a la pantalla de la càmera (el cel mana), passats
          uns píxels de scroll (vegeu LOC_COLLAPSE_Y) i a l'escriptori ample,
          on el Dateline ja diu les coordenades.

          L'EXCEPCIÓ ÉS OBLIGADA: mentre les xifres surten del punt d'exemple,
          la barra porta l'avís `loc__warn`, que és PART DE LA DADA — i el
          format compacte l'amaga. `isDefaultFix` és exactament la condició
          que fa sortir l'avís (exportada de LocationBar perquè no divergeixi):
          quan és certa, la barra no es plega mai, es miri des d'on es miri.
        */}
        <LocationBar
          fix={observer.fix}
          locale={locale}
          loading={observer.loading}
          error={observer.error}
          /*
            AL MAPA, SEMPRE COMPACTA (report de camp amb un telèfon de debò).
            La barra desplegada ocupa dues línies —nom, distintiu de GPS,
            coordenades, precisió— i al mapa aquelles dues línies són mapa que
            no es veu. A més, la informació que treu és la que el mapa ja
            ensenya: on ets ho diu la diana, i les coordenades exactes són a la
            fitxa. Es desplega igualment tocant-la, que és el gest de sempre.
          */
          compact={
            !isDefaultFix(observer.fix) &&
            (tab === 'sky' || tab === 'map' || scrolled || desktopWide)
          }
          onOpen={() => setSheetOpen(true)}
        />

        {/*
          Estat de la maquinària: el terreny. Va abans de la pantalla perquè
          condiciona tot el que hi surt.

          L'ERROR D'UBICACIÓ JA NO ES PINTA AQUÍ: ara és un codi i no un text,
          i el tradueix `LocationBar`, que és on l'usuari mira quan es pregunta
          què ha passat amb el seu lloc. Repetir-lo en dos llocs feia que el
          mateix problema semblés dos problemes.

          PER QUÈ NO SÓN `Toast` NI `SafetyNotice`: el `Toast` és una
          confirmació transitòria d'una línia i sense accions, i el
          `SafetyNotice` està reservat a la seguretat ocular. Això altre és un
          estat persistent de l'app amb una acció de reintent, o sigui un bloc
          propi. Porta el color a tota la caixa i no a una vora esquerra, que el
          sistema prohibeix.
        */}
        {(horizon.loading || horizon.error) && (
          <div className="shell__status">
            {horizon.loading && (
              <div className="shell__progress">
                <div className="shell__progressbar">
                  <div
                    className="shell__progressfill"
                    style={{ width: `${Math.round(horizon.progress * 100)}%` }}
                  />
                </div>
                <span className="screen__note">
                  {/*
                    El progrés arriba com a CODI (el nucli no sap idiomes) i
                    la frase es compon aquí, en l'idioma de l'usuari.
                  */}
                  {horizon.progressCode
                    ? horizonProgressText(horizon.progressCode, locale)
                    : s('horizon.computing', locale)}
                </span>
              </div>
            )}
            {horizon.error && (
              <div className="shell__alert">
                {/*
                  EL MOTIU, EN L'IDIOMA DE QUI LLEGEIX. Aquí hi havia el text
                  que arribava del càlcul, i el càlcul l'escrivia en català:
                  l'usuari en castellà rebia «Només s'han pogut baixar 12 de
                  64 tessel·les» tal qual. Ara el nucli dona un CODI amb les
                  seves xifres i la frase la munta la capa de vista, que és
                  l'única que sap en quin idioma s'està parlant.
                */}
                <span>{horizonFailureText(horizon.error, locale)}</span>
                <Button variant="ghost" size="sm" onClick={horizon.reload}>
                  {s('horizon.retry', locale)}
                </Button>
              </div>
            )}
          </div>
        )}

        {/*
          Barrera d'error al voltant de la pantalla activa, mai al voltant de
          l'estructura. Si una pantalla cau, la capçalera i la barra de
          pestanyes segueixen dretes i l'usuari pot marxar-ne; sense això, una
          excepció deixa la finestra negra i l'única sortida és recarregar, que
          el dia de l'eclipsi amb la xarxa saturada pot voler dir perdre-se'l.
          La clau de rearmament és la pestanya: tornar-hi torna a provar-ho.
        */}
        <ErrorBoundary
          resetKey={tab}
          message={s('shell.crashed', locale)}
          retryLabel={s('shell.retry', locale)}
        >
          {tab === 'countdown' && (
            <CountdownScreen
              {...context}
              /*
                LA CRIDA A L'ACCIÓ SEGUEIX LA MATEIXA REGLA QUE LA PESTANYA.

                Si el Cel no és a la barra perquè aquest aparell no el pot
                ensenyar, el botó que hi porta tampoc no hi ha de ser: posava
                `tab` a `sky`, l'efecte de sota el retornava a `countdown` a
                l'instant i el resultat era un botó primari gran que no feia
                res. `camera.unknown` compta com a no disponible mentre no se
                sap: val més ensenyar el mapa un moment que un botó que potser
                és mort.
              */
              /*
                Les crides a l'acció naveguen pel MATEIX camí que la barra de
                pestanyes: si el botó gran canviés la pantalla sense apilar
                entrada, l'enrere del navegador es comportaria diferent segons
                per on s'hagués entrat al mapa, i això no ho pot explicar ningú.
              */
              onOpenCamera={camera.supported ? () => navigateTab('sky') : undefined}
              onOpenMap={() => navigateTab('map')}
              /*
                «Busca un lloc millor a prop» navega al mapa AMB el cercador de
                llocs obert: mateix camí que la barra (una entrada d'historial,
                l'enrere torna al compte enrere), amb el segment que diu el
                destí. La pantalla només l'ensenya quan el terreny roba temps
                de debò: la condició viu al costat del veredicte, allà.
              */
              onOpenSpots={() => navigateTab('map', 'spots')}
            />
          )}
          {/*
            El fallback és un marc buit amb l'estil de pantalla, no un
            rodet: el chunk arriba en dècimes i un parpelleig de contingut
            fals és pitjor que una espera curta i quieta.
          */}
          {tab === 'map' && (
            <Suspense fallback={<div className="screen screen--full" />}>
              <MapScreen
                {...context}
                /*
                  La vista que el fragment o una crida a l'acció han encarregat
                  d'obrir, com `initialSection` a la guia. A partir d'aquí, del
                  commutador (i del fragment) n'és amo MapScreen.
                */
                initialView={mapView}
                onPickLocation={(lat, lon) => {
                  track('point_set', {
                    method: 'map_tap',
                    had_point: observer.fix === null ? 'no' : 'yes',
                  });
                  observer.setManual(lat, lon);
                }}
                onOpenCountdown={() => navigateTab('countdown')}
              />
            </Suspense>
          )}
          {tab === 'sky' && (
            // Ja no dispara el GPS a seques: obre la fulla, que és on hi ha
            // les quatre maneres de dir on seràs. El dia de l'eclipsi el GPS és
            // el primer botó de la fulla i el gest segueix essent curt.
            <Suspense fallback={<div className="screen screen--full" />}>
              <SkyScreen
                {...context}
                onRequestLocation={() => setSheetOpen(true)}
                onImmersiveChange={setSkyImmersive}
              />
            </Suspense>
          )}
          {tab === 'guide' && (
            <Suspense fallback={<div className="screen screen--full" />}>
              <GuideScreen
                {...context}
                /*
                  La secció que el fragment ha encarregat d'obrir, si n'hi ha:
                  la pantalla la desplega i hi fa scroll en aterrar-hi.
                */
                initialSection={guideSection}
                onOpenCountdown={() => navigateTab('countdown')}
              />
            </Suspense>
          )}
          {tab === 'about' && (
            <Suspense fallback={<div className="screen screen--full" />}>
              <AboutScreen
                locale={locale}
                initialSection={guideSection}
                /*
                  L'enllaç de seguretat de la pàgina porta a la SECCIÓ de la
                  guia, no a la pestanya a seques: aterrar al principi d'una
                  pàgina llarga i haver de buscar «seguretat» seria perdre el
                  lector just on més importa no perdre'l.
                */
                onOpenGuideSafety={() => {
                  setGuideSection('safety');
                  navigateTab('guide');
                }}
              />
            </Suspense>
          )}
        </ErrorBoundary>
        {/*
          EL PEU, DINS DEL `main` I NO A FORA.

          A la pantalla de la càmera i a la del mapa el contingut ocupa tota
          l'alçada i no s'hi desplaça: si el peu fos germà del `main`, allà
          reduiria la imatge. Aquí baixa amb el contingut de les pantalles que
          es desplacen i no existeix a les que no.
        */}
        {tab !== 'sky' && tab !== 'map' && (
          <SiteFooter
            locale={locale}
            /*
              LA PORTA PER CANVIAR D'OPINIÓ. Només es pinta quan ja hi ha una
              resposta desada: mentre el bàner és a la pantalla, un segon
              comandament que obre el mateix bàner no és res.
            */
            consentState={consent.state}
            onChangeConsent={consent.reopen}
          />
        )}
      </main>

      {/*
        LA PRIMERA PREGUNTA. Surt un sol cop, abans que el navegador demani res,
        i només mentre no hi ha cap lloc: qui torna a obrir l'app ja té el seu i
        no se li ha de tornar a preguntar.
      */}
      {introOpen && (
        <LocationGate
          locale={locale}
          onUseGps={() => {
            // La porta només es pinta sense punt: `had_point` hi és exacte.
            track('point_set', { method: 'gps', had_point: 'no' });
            observer.dismissIntro();
            observer.locate();
          }}
          onPickPlace={() => {
            observer.dismissIntro();
            setSheetOpen(true);
          }}
          onSkip={() => {
            track('point_set', { method: 'example', had_point: 'no' });
            observer.dismissIntro();
            void observer.useDefaultLocation();
          }}
          onClose={observer.dismissIntro}
        />
      )}

      {sheetOpen && (
        <LocationSheet
          locale={locale}
          /*
            L'ECLIPSI TRIAT ARRIBA A LA FULLA per les miniatures de l'historial:
            dibuixen el camí del Sol d'aquell dia sobre l'horitzó de cada punt, i
            sense això sempre dibuixarien el del 2026 encara que la capçalera
            digués 2028. Dues dates a la vista alhora fan dubtar de les dues.
          */
          eclipseId={eclipseId}
          observer={observer}
          comparison={comparison}
          onClose={() => setSheetOpen(false)}
          onGoToMap={() => navigateTab('map')}
        />
      )}

      {/*
        EL BÀNER DE COOKIES, I LA CONDICIÓ QUE L'ACOMPANYA.

        NO SURT MENTRE HI HA LA PORTA DE LA UBICACIÓ. Aquella és «la primera
        pregunta» i té pantalla sencera; posar-n'hi una segona a sota seria
        rebre algú amb dos formularis abans d'haver-li ensenyat ni un segon de
        totalitat. El bàner espera: sense resposta es mesura sense galeta, que
        és el cas segur, i la pregunta arriba quan l'app ja ha dit per a què
        serveix.

        Va DESPRÉS del contingut i de la porta en l'ordre del DOM, i abans de la
        barra de pestanyes. Amb `position: fixed` això no canvia on es pinta,
        però sí l'ordre en què ho troba un lector de pantalla i el tabulador: la
        resposta que ha vingut a buscar l'usuari, primer.
      */}
      {consent.asking && !introOpen && (
        <ConsentBanner locale={locale} onDecide={consent.decide} />
      )}

      <div className="shell__nav">
        <TabBar
          value={tab}
          onChange={navigateTab}
          items={tabs}
          label={s('nav.label', locale)}
        />
      </div>
    </div>
  );
}

/**
 * Franja de dades tècniques de la versió d'escriptori.
 *
 * PER QUÈ NOMÉS A L'ESCRIPTORI (ho amaga `screens.css`): a 390 px, quatre dades
 * en mono no caben en una línia i partides deixen de ser una franja. A 1440 sí,
 * i llavors fan la feina que el sistema els demana — dir de què va la pantalla
 * abans que ningú llegeixi res.
 *
 * UN SOL ACCENT: l'ambre és per a la durada de la fase central, que és la xifra
 * que decideix si val la pena moure's. La resta va en apagat.
 */
function Dateline({
  context,
  eclipseId,
  locale,
}: {
  context: EclipseContext;
  eclipseId: string;
  locale: EclipseContext['locale'];
}) {
  const { circumstances, verdict, location, placeLabel } = context;
  const central = circumstances?.kind === 'total' || circumstances?.kind === 'annular';
  const durationSec = verdict
    ? verdict.centralVisibleSec
    : (circumstances?.centralDurationSec ?? 0);

  return (
    <div className="shell__dateline">
      <span>
        {s(`kind.${circumstances?.kind ?? 'none'}` as 'kind.total', locale)} ·{' '}
        {shortDate(eclipseId)}
      </span>
      {/*
        EL LLOC: EL NOM MANA I LES COORDENADES NO ES PERDEN. Quan el punt té
        nom, el camp diu el nom — que és com l'usuari es refereix al seu lloc —
        i les coordenades passen al `title`: en una franja d'overline en mono i
        majúscules amb `overflow: hidden`, nom i parella de coordenades junts
        es retallaven abans que ningú els llegís. Sense nom (resolent-se o
        offline), les coordenades es queden al camp com sempre, sense
        parpelleig: al camp són or.
      */}
      <span
        title={
          placeLabel !== null && location !== null
            ? formatCoords(location.lat, location.lon)
            : undefined
        }
      >
        {location
          ? (placeLabel ?? formatCoords(location.lat, location.lon))
          : s('common.unknownPlace', locale)}
      </span>
      <span className="shell__dateline-accent">
        {/* El valor de la durada, amb classe pròpia: `screens.css` l'estila. */}
        {central ? (
          <span className="shell__dateline-val">{formatDuration(durationSec)}</span>
        ) : circumstances ? (
          formatObscurationPercent(circumstances.contacts.max.obscuration, central)
        ) : (
          NO_DATA
        )}
      </span>
      <span>{s('shell.open', locale)}</span>
    </div>
  );
}
