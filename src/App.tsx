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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatObscurationPercent } from './core/astro/obscuration';
import {
  BackTopBar,
  Button,
  ErrorBoundary,
  IconButton,
  Select,
  TabBar,
  TopBar,
  type TabBarItem,
} from './ui';
import { CountdownScreen } from './screens/CountdownScreen';
import { MapScreen } from './screens/MapScreen';
import { SkyScreen } from './screens/SkyScreen';
import { GuideScreen } from './screens/GuideScreen';
import type { EclipseContext } from './screens/context';
import { s } from './screens/strings';
import { formatCoords, formatDuration, NO_DATA } from './screens/format';
import { useHorizon } from './features/sim/useHorizon';
import {
  LocationBar,
  LocationGate,
  LocationSheet,
  ls,
  useComparison,
  usePlaceName,
} from './features/location';
import { computeLocalCircumstances } from './core/astro/contacts';
import { computeVisibility } from './core/visibility/verdict';
import { ECLIPSES } from './core/eclipses/catalog';
import { useObserver } from './state/useObserver';
import { UpdatePrompt } from './offline/UpdatePrompt';
import { LOCALES } from './i18n';
import { SiteFooter } from './screens/SiteFooter';
import { useCameraSupport } from './features/ar/useCameraSupport';
import { LocaleProvider, useTranslation } from './i18n';
import './screens/screens.css';

type Tab = 'countdown' | 'map' | 'sky' | 'guide';

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

export default function App() {
  return (
    <LocaleProvider>
      <Shell />
    </LocaleProvider>
  );
}

function Shell() {
  const { locale, setLocale, t } = useTranslation();
  const camera = useCameraSupport();
  const observer = useObserver();
  const [tab, setTab] = useState<Tab>('countdown');
  const [eclipseId, setEclipseId] = useState(ECLIPSES[0].id);
  const [sheetOpen, setSheetOpen] = useState(false);

  // El perfil d'horitzó es calcula un sol cop per ubicació i el comparteixen
  // totes les pantalles: són uns 150 tessel·les de terreny i 2,6 milions de
  // mostres, no és cosa de fer-ho dues vegades.
  const horizon = useHorizon(observer.location);

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
  };

  /*
   * Si la pestanya del cel desapareix mentre s'hi és —una sessió restaurada en
   * un altre aparell, o el navegador que canvia de resposta— no s'hi pot quedar
   * ningú mirant una pantalla que ja no és a la barra.
   */
  useEffect(() => {
    if (!camera.unknown && !camera.supported && tab === 'sky') setTab('countdown');
  }, [camera.unknown, camera.supported, tab]);

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
          label: shortDate(e.id),
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
        options={LOCALES.map((code) => ({ value: code, label: t(`locale.${code}`) }))}
      />
      {/*
        ABANS AQUEST BOTÓ DISPARAVA EL GPS directament, i era l'únic camí cap a
        la ubicació fora de la càmera. Dos problemes: el diàleg del navegador
        sortia sense haver explicat res, i «on ets» no és la pregunta que fa qui
        planifica. Ara obre la fulla de tria, que conté el GPS i tres maneres
        més de dir on seràs.
      */}
      <IconButton
        icon="map-pin"
        variant="ghost"
        label={ls('bar.open', locale)}
        onClick={() => setSheetOpen(true)}
      />
    </>
  );

  return (
    <div className={fixed ? 'shell shell--fixed' : 'shell'}>
      {/*
        L'AVÍS DE VERSIÓ NOVA, A L'ARREL.

        Existia i estava muntat dins d'`OfflinePanel`, que no es munta enlloc:
        o sigui que la versió nova s'instal·lava, es quedava esperant, i no hi
        havia cap manera d'activar-la. És exactament per això que calia obrir
        l'app en una pestanya privada per veure els canvis.
      */}
      <UpdatePrompt />

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
          <TopBar logo logoSrc={LOGO_SRC} title={titles[tab]} right={headerActions} />
        ) : (
          <BackTopBar
            title={titles[tab]}
            backLabel={s('nav.countdown', locale)}
            onBack={() => setTab('countdown')}
            subtitle={
              observer.location === null
                ? undefined
                : formatCoords(observer.location.lat, observer.location.lon)
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
        <LocationBar
          fix={observer.fix}
          locale={locale}
          loading={observer.loading}
          error={observer.error}
          compact={tab === 'sky'}
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
                  {horizon.progressMessage || s('horizon.computing', locale)}
                </span>
              </div>
            )}
            {horizon.error && (
              <div className="shell__alert">
                <span>{s('horizon.failed', locale)}</span>
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
            <CountdownScreen {...context} onOpenCamera={() => setTab('sky')} />
          )}
          {tab === 'map' && (
            <MapScreen {...context} onPickLocation={observer.setManual} />
          )}
          {tab === 'sky' && (
            // Ja no dispara el GPS a seques: obre la fulla, que és on hi ha
            // les quatre maneres de dir on seràs. El dia de l'eclipsi el GPS és
            // el primer botó de la fulla i el gest segueix essent curt.
            <SkyScreen {...context} onRequestLocation={() => setSheetOpen(true)} />
          )}
          {tab === 'guide' && (
            <GuideScreen {...context} onOpenCountdown={() => setTab('countdown')} />
          )}
        </ErrorBoundary>
        {/*
          EL PEU, DINS DEL `main` I NO A FORA.

          A la pantalla de la càmera i a la del mapa el contingut ocupa tota
          l'alçada i no s'hi desplaça: si el peu fos germà del `main`, allà
          reduiria la imatge. Aquí baixa amb el contingut de les pantalles que
          es desplacen i no existeix a les que no.
        */}
        {tab !== 'sky' && tab !== 'map' && <SiteFooter locale={locale} />}
      </main>

      {/*
        LA PRIMERA PREGUNTA. Surt un sol cop, abans que el navegador demani res,
        i només mentre no hi ha cap lloc: qui torna a obrir l'app ja té el seu i
        no se li ha de tornar a preguntar.
      */}
      {observer.needsIntro && observer.fix === null && (
        <LocationGate
          locale={locale}
          onUseGps={() => {
            observer.dismissIntro();
            observer.locate();
          }}
          onPickPlace={() => {
            observer.dismissIntro();
            setSheetOpen(true);
          }}
          onSkip={() => {
            observer.dismissIntro();
            void observer.useDefaultLocation();
          }}
          onClose={observer.dismissIntro}
        />
      )}

      {sheetOpen && (
        <LocationSheet
          locale={locale}
          observer={observer}
          comparison={comparison}
          onClose={() => setSheetOpen(false)}
          onGoToMap={() => setTab('map')}
        />
      )}

      <div className="shell__nav">
        <TabBar
          value={tab}
          onChange={setTab}
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
  const { circumstances, verdict, location } = context;
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
      <span>
        {location ? formatCoords(location.lat, location.lon) : s('common.unknownPlace', locale)}
      </span>
      <span className="shell__dateline-accent">
        {central
          ? formatDuration(durationSec)
          : circumstances
            ? formatObscurationPercent(circumstances.contacts.max.obscuration, central)
            : NO_DATA}
      </span>
      <span>{s('shell.open', locale)}</span>
    </div>
  );
}
