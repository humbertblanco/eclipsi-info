import { useMemo, type CSSProperties } from 'react';
import { formatObscurationPercent } from '../core/astro/obscuration';
import {
  Badge,
  Button,
  Card,
  PhaseDial,
  Stat,
  TimelineTrack,
  VisibilityMeter,
  type TimelineContact,
  type Tone,
} from '../ui';
import { SimulationView } from '../features/sim/SimulationView';
import { MiniMap } from '../features/map/MiniMap';
import { ClockDriftNotice } from '../features/clock';
import { ShareButton } from '../features/share';
import { CountdownView } from '../features/countdown';
import { useCloudOutlook } from '../features/weather';
import { Countdown } from '../ui/eclipse/Countdown';
import { skyStateFromSample, toCss } from '../core/sky';
import { getEclipse } from '../core/eclipses/catalog';
import type { EclipseSample } from '../core/astro/types';
import type { EclipseContext } from './context';
import { EphemerisTable } from './EphemerisTable';
import { s } from './strings';
import { verdictSummary } from './verdictSummary';
import {
  formatAge,
  formatClockShort,
  formatCoords,
  formatDegrees,
  formatDuration,
  formatStamp,
  NO_DATA,
} from './format';
import './screens.css';

export interface CountdownScreenProps extends EclipseContext {
  /**
   * Porta l'usuari a la pestanya de la càmera.
   *
   * `undefined` quan aquest aparell no la pot ensenyar —cap càmera cap enfora,
   * cap giroscopi—, i llavors la portada NO pinta el botó: hi posa el de mapa.
   * Abans es pintava sempre i a l'escriptori no feia res, perquè posava la
   * pestanya a `sky`, que allà no existeix, i un efecte de `App` la retornava a
   * `countdown` a l'instant.
   */
  onOpenCamera?: () => void;
  /** Porta l'usuari al mapa. És l'acció principal quan no hi ha càmera. */
  onOpenMap: () => void;
  /**
   * Porta l'usuari al cercador de llocs del mapa (la vista «Llocs»). Només es
   * crida quan el veredicte diu que el terreny roba fase central de debò:
   * és la resposta a la frase que ho diu, no una porta permanent al mapa —
   * d'aquella ja en fa `onOpenMap`.
   */
  onOpenSpots?: () => void;
}

/** El tipus d'eclipsi mana el color de tot el que en depèn. */
const KIND_TONE: Record<string, Tone> = {
  total: 'clear',
  annular: 'partial',
  partial: 'cloudy',
  none: 'neutral',
};

/**
 * Pantalla "Compte enrere" — la portada.
 *
 * Respon en aquest ordre, que és el de les preguntes que es fa la gent:
 * quant falta, quant en veuràs TU des d'aquí, quin cel hi haurà, i a quina
 * hora passa cada cosa. La simulació detallada va al final: qui hi arriba ja
 * ha decidit que hi va.
 */
export function CountdownScreen({
  eclipseId,
  locale,
  location,
  placeLabel,
  circumstances,
  verdict,
  horizon,
  onOpenCamera,
  onOpenMap,
  onOpenSpots,
}: CountdownScreenProps) {
  const eclipse = getEclipse(eclipseId);
  const contacts = circumstances?.contacts ?? null;

  // L'instant que de veritat s'espera: el segon contacte si hi ha fase central,
  // i el màxim si des d'aquí només hi ha parcial. Comptar enrere fins a un C2
  // que no existeix seria comptar fins a res.
  const target = contacts?.c2 ?? contacts?.max ?? null;
  const central = circumstances?.kind === 'total' || circumstances?.kind === 'annular';

  /*
   * SI EL DIBUIX POT ENSENYAR CORONA.
   *
   * Tres condicions, i cap és l'obscuració. Ha de ser un eclipsi TOTAL —d'un
   * anular no se'n veu mai, hi queda anell de fotosfera—, i el relleu no se
   * l'ha de menjar: amb veredicte mana el veredicte, i mentre no n'hi ha es fa
   * servir la xifra teòrica, que és la mateixa cascada que fan les xifres del
   * costat. Un 99,7 % de parcial pur no en veu, i era el cas que dibuixava
   * corona.
   */
  const showsCorona =
    circumstances?.kind === 'total' &&
    // I AL CAIRE DE LA FRANJA, TAMPOC. Amb `edgeUncertain` el motor declara
    // que no pot decidir si des d'aquí hi haurà fase central —la banda de dos
    // o tres quilòmetres on el nostre error de posició és més gran que el
    // marge—, i la comporta de seguretat hi respon que no. Que la imatge
    // prometi una corona que la comporta nega és la contradicció que aquesta
    // pantalla existeix per no tenir.
    !circumstances.edgeUncertain &&
    (verdict ? verdict.centralVisibleSec > 0 : (circumstances.centralDurationSec ?? 0) > 0);

  const countdownLabel = central
    ? s(circumstances?.kind === 'annular' ? 'home.untilAnnularity' : 'home.untilTotality', locale)
    : s('home.untilMax', locale);

  // La nuvolositat es consulta una sola vegada per pantalla. El panell detallat
  // de capes viu al mapa: dos consumidors del mateix hook alhora voldria dir
  // dues peticions a una API gratuïta per la mateixa dada.
  const clouds = useCloudOutlook({
    location,
    targetTimeMs: contacts?.max.time.getTime() ?? null,
    sunAzimuthDeg: contacts?.max.sun.azimuth ?? null,
    sunAltitudeDeg: contacts?.max.sun.altitudeApparent ?? null,
  });

  const timeline = useMemo<TimelineContact[]>(() => {
    if (!contacts) return [];
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
        // Hora curta i formatada per `Intl`, no retallada d'una data llarga.
        // Partir la data pel «, » funcionava en català i en castellà donava
        // guions: `Intl` hi escriu «12 de agosto de 2026 a las 20:27:57», sense
        // coma, i el tall no trobava res. Cinc guions on hi ha d'haver cinc
        // hores és la mena d'error que ningú no reporta i tothom veu.
        time: formatClockShort(sample.time, locale),
      }));
  }, [contacts, locale]);

  /*
   * EL CEL DEL TEU PUNT, AL FONS DEL CARD DEL COMPTE ENRERE.
   *
   * El motor de llum (core/sky) ja sap de quin color serà l'horitzó mirant el
   * Sol al màxim DES D'AQUEST PUNT: el capvespre daurat del 2026, el matí alt
   * del 2027. El card l'insinua com a tint, no com a il·lustració — el sistema
   * és fosc i l'única llicència és un matís a la base. A la totalitat profunda
   * el color és negre de debò i el tint desapareix: aquell cel JA és el card.
   *
   * VIU AQUÍ DALT, AMB ELS ALTRES GANXOS: més avall hi ha un retorn anticipat
   * (sense lloc no hi ha pantalla) i un ganxo després d'un retorn condicional
   * és exactament el «Rendered more hooks» que va tombar la pantalla.
   */
  const skyTint = useMemo(() => {
    if (!contacts) return null;
    const sky = skyStateFromSample(contacts.max);
    const horizon = sky.palette.horizonSunward;
    if (Math.max(horizon.r, horizon.g, horizon.b) < 24) return null;
    return toCss(horizon);
  }, [contacts]);

  if (!location || !circumstances || !contacts) {
    return (
      <div className="screen">
        <div className="screen__empty">
          <span>{s('common.unknownPlace', locale)}</span>
          <span>{s('common.locateCta', locale)}</span>
        </div>
      </div>
    );
  }

  // La durada bona és la que sobreviu al relleu. Mentre no hi ha perfil, es
  // diu que la xifra és la teòrica en comptes de fer-la passar per la bona.
  const durationSec = verdict ? verdict.centralVisibleSec : circumstances.centralDurationSec;
  const obscuration = verdict
    ? verdict.maxVisibleObscuration
    : contacts.max.obscuration;

  /*
   * QUAN ES PROPOSA BUSCAR UN LLOC MILLOR: només quan el terreny roba fase
   * central DE DEBÒ. La condició és la mateixa que fa que `decideStatus`
   * (core/visibility/verdict.ts) no declari `central-visible`: hi ha fase
   * central teòrica des d'aquí i el que en sobreviu queda a més d'un segon de
   * la sencera — el mateix marge d'un segon, perquè alarmar per una dècima
   * que és dins de l'error del model del terreny seria mentir. Cobreix el
   * tros robat (central-partial), la fase central sencera darrere el relleu
   * (central-blocked) i el Sol amagat del tot (sun-blocked): en tots tres
   * casos la resposta honesta a «i doncs, què faig?» és moure's, i el
   * cercador de llocs és l'eina que ho respon. Sense veredicte encara no se
   * sap si el terreny roba res, i no es promet una solució a un problema no
   * diagnosticat.
   */
  const terrainRobsCentral =
    verdict !== null &&
    verdict.centralTotalSec > 0 &&
    verdict.centralVisibleSec < verdict.centralTotalSec - 1;

  const outlook = clouds.outlook;

  return (
    <div className="screen screen--split">
      <div className="screen__col screen__col--main">
        <section
          className="home__hero"
          style={
            skyTint !== null
              ? ({ '--home-sky': skyTint } as CSSProperties)
              : undefined
          }
        >
          <div className="home__herohead">
            <span className="screen__overline">
              {formatStamp(contacts.max.time, locale)}
            </span>
            <Badge tone={KIND_TONE[circumstances.kind] ?? 'neutral'} dot>
              {s(`kind.${circumstances.kind}` as 'kind.total', locale)}
            </Badge>
          </div>
          <Countdown
            className="home__countdown"
            size="md"
            label={countdownLabel}
            pastLabel={s('home.past', locale)}
            targetMs={target ? target.time.getTime() : null}
          />
        </section>

        <Card className="home__phase">
          <PhaseDial obscuration={obscuration} totality={showsCorona} size={96} />
          <div className="home__stats">
            <Stat
              label={
                verdict
                  ? s('home.visibleDuration', locale)
                  : s('home.theoreticalDuration', locale)
              }
              value={central ? formatDuration(durationSec) : NO_DATA}
              size="lg"
              tone="accent"
            />
            <Stat label={s('home.obscuration', locale)} value={formatObscurationPercent(obscuration, central)} />
            <Stat
              label={s('home.sunAltitude', locale)}
              value={formatDegrees(contacts.max.sun.altitudeApparent)}
            />
          </div>
        </Card>

        {!horizon && <p className="screen__note">{s('home.terrainPending', locale)}</p>}
        {verdict && <p className="screen__note">{verdictSummary(verdict, locale)}</p>}
        {/*
          Just sota la frase que diu què roba el terreny, la sortida: el
          cercador de llocs del mapa, que és l'única part de l'app que respon
          «i doncs, què faig?» amb llocs concrets. En fantasma i mai en ambre:
          l'accent d'aquesta pantalla ja el té la durada visible, aquí dalt.
        */}
        {onOpenSpots !== undefined && terrainRobsCentral && (
          <Button variant="ghost" size="sm" icon="search" onClick={onOpenSpots}>
            {s('home.findSpot', locale)}
          </Button>
        )}

        {/*
          Els cinc contactes, al mòbil: la línia horitzontal que diu «per on
          anem». La taula amb les hores i el marge sobre el terreny —la lectura
          d'escriptori de la mateixa informació— viu al final de la columna
          dreta, on equilibra les dues columnes; aquesta targeta s'hi amaga
          sencera. Qui decideix quina de les dues es pinta és `screens.css` a
          --bp-split, i com que la taula al mòbil no es pinta mai, separar-les
          no canvia l'ordre de lectura de la pila.
        */}
        <Card className="home__timelinecard">
          <span className="screen__overline">{s('home.contacts', locale)}</span>
          <TimelineTrack
            style={{ marginTop: 'var(--sp-6)' }}
            contacts={timeline}
            activeIndex={timeline.findIndex((c) => c.label === 'Màx')}
          />
        </Card>

        {/* La simulació completa i el veredicte llarg. Qui hi arriba ja vol el detall. */}
        <SimulationView
          location={location}
          eclipseId={eclipseId}
          locale={locale}
          horizon={horizon}
        />
      </div>

      <div className="screen__col screen__col--side">
        <Card>
          <VisibilityMeter
            place={placeLabel ?? s('common.here', locale)}
            value={outlook ? outlook.score.score : null}
            state={outlook ? outlook.score.band : 'unknown'}
            caption={
              outlook
                ? outlook.caveat
                : clouds.loading
                  ? s('sky.cloudsLoading', locale)
                  : (clouds.error ?? s('sky.cloudsOffline', locale))
            }
            age={outlook ? formatAge(clouds.nowMs - outlook.fetchedAtMs) : undefined}
          />
        </Card>

        {/* El compte enrere amb veu, assaig i pantalla desperta. */}
        <CountdownView
          circumstances={circumstances}
          locale={locale}
          centralPhaseVisible={verdict ? verdict.centralVisibleSec > 0 : undefined}
        />

        {/*
          La deriva del rellotge del telèfon, JUST SOTA dels avisos de veu i no
          a la columna principal. És on aporta: aquests avisos es programen amb
          l'hora del sistema i amb marges de segons, o sigui que és aquí on
          saber que el rellotge va malament canvia alguna cosa. I a la columna
          estreta no li pren protagonisme a la xifra del compte enrere, que és
          el que la gent hi ve a mirar. Quan el rellotge està comprovat i va bé
          no pinta res.
        */}
        <ClockDriftNotice locale={locale} />

        {onOpenCamera ? (
          <>
            {/*
              LA CÀMERA ÉS LA FUNCIÓ QUE CAP ALTRA APP TÉ, i un botó pelat no
              ho deia: una línia a sobre explica QUÈ hi guanyes abans de
              demanar-te el gest. No és una targeta sencera perquè l'acció ja
              és el botó primari — l'aparador és la frase, no una caixa més.
            */}
            <p className="home__camerapitch">{s('home.cameraPitch', locale)}</p>
            <Button size="lg" icon="camera" fullWidth onClick={onOpenCamera}>
              {s('home.openCamera', locale)}
            </Button>
          </>
        ) : (
          <Button size="lg" icon="map" fullWidth onClick={onOpenMap}>
            {s('home.openMap', locale)}
          </Button>
        )}

        {/*
          COMPARTIR EL PUNT, SOTA L'ACCIÓ PRINCIPAL I EN `ghost`.

          Va aquí perquè és la pantalla que respon «quants segons veuràs des
          d'aquí», que és exactament el que s'envia. I va en fantasma perquè no
          compet amb el botó gran: qui obre l'app ve a mirar la seva xifra, no a
          enviar-la; compartir-la ve després.

          Envia l'enllaç amb el punt i, si el sistema ho permet, la targeta amb
          la silueta del teu horitzó com a fitxer — que és l'única manera que
          una previsualització de veritat arribi a una conversa, perquè un lloc
          estàtic no pot tenir una `og:image` diferent per punt.
        */}
        <ShareButton
          eclipseId={eclipseId}
          locale={locale}
          location={location}
          label={placeLabel}
          circumstances={circumstances}
          profile={horizon}
          verdict={verdict}
        />

        {/*
          EL MINI-MAPA: on és la franja i on ets tu, d'un cop d'ull i sense
          MapLibre — imatge base cuita + canvas (vegeu MiniMap.tsx). És una
          porta al mapa de debò, no un mapa: per això és un botó.
        */}
        <MiniMap
          eclipseId={eclipseId}
          location={location}
          label={s('home.minimap', locale)}
          onOpen={onOpenMap}
        />

        {/*
          LA TAULA DELS CONTACTES, NOMÉS A L'ESCRIPTORI I AL FINAL D'AQUESTA
          COLUMNA. És la parella de la targeta de la línia de la columna
          principal: la mateixa pregunta amb la lectura d'escriptori. Va aquí i
          no al costat de la línia perquè és el que equilibra les dues columnes
          a --bp-split — sense ella, la columna del compte enrere s'acabava a
          mig camí i deixava un buit negre fins al peu. Al mòbil aquesta
          targeta no existeix (`screens.css` l'amaga), o sigui que la pila no
          guanya cap bloc repetit.
        */}
        <Card className="home__ephemeriscard">
          <span className="screen__overline">{s('home.contacts', locale)}</span>
          <EphemerisTable
            circumstances={circumstances}
            horizon={horizon}
            locale={locale}
          />
        </Card>

        {/*
          LA LÍNIA DEL LLOC: EL NOM MANA, LES COORDENADES NO ES PERDEN.
          Quan el punt té nom, la línia diu «Reinosa · 807 m» — que és com
          l'usuari anomena el seu lloc — i les coordenades queden darrere, en
          el mateix to apagat de la nota. Van dins d'un span que no es parteix
          (`home__coords`): si no hi caben, baixen SENCERES de línia en lloc
          de trencar la parella pel mig. Sense nom (resolent-se o offline),
          les coordenades es queden al capdavant com sempre, sense parpelleig:
          al camp són or.
        */}
        <p className="screen__note">
          {placeLabel ?? formatCoords(location.lat, location.lon)} ·{' '}
          {Math.round(location.elevation)} m
          {placeLabel !== null && (
            <span className="home__coords">
              {' · '}
              {formatCoords(location.lat, location.lon)}
            </span>
          )}
        </p>
        <p className="screen__note">{eclipse.spain[locale]}</p>
        <p className="screen__note">{s('home.sources', locale)}</p>
      </div>
    </div>
  );
}
