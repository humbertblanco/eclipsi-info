import { useMemo } from 'react';
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
import { CountdownView } from '../features/countdown';
import { useCloudOutlook } from '../features/weather';
import { Countdown } from '../ui/eclipse/Countdown';
import { getEclipse } from '../core/eclipses/catalog';
import type { EclipseSample } from '../core/astro/types';
import type { EclipseContext } from './context';
import { EphemerisTable } from './EphemerisTable';
import { s } from './strings';
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
  /** Porta l'usuari a la pestanya de la càmera. */
  onOpenCamera: () => void;
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
}: CountdownScreenProps) {
  const eclipse = getEclipse(eclipseId);
  const contacts = circumstances?.contacts ?? null;

  // L'instant que de veritat s'espera: el segon contacte si hi ha fase central,
  // i el màxim si des d'aquí només hi ha parcial. Comptar enrere fins a un C2
  // que no existeix seria comptar fins a res.
  const target = contacts?.c2 ?? contacts?.max ?? null;
  const central = circumstances?.kind === 'total' || circumstances?.kind === 'annular';

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

  const outlook = clouds.outlook;

  return (
    <div className="screen screen--split">
      <div className="screen__col screen__col--main">
        <section className="home__hero">
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
          <PhaseDial obscuration={obscuration} size={96} />
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
        {verdict && <p className="screen__note">{verdict.summary}</p>}

        {/*
          Els cinc contactes. Al mòbil, la línia horitzontal; a l'escriptori, la
          taula sencera amb el marge sobre el terreny a cada instant. No és el
          mateix component perquè no és la mateixa lectura: la línia diu «per on
          anem», la taula diu «a quina hora i si ho veuràs». Qui decideix quina
          es pinta és `screens.css` a --bp-split.
        */}
        <Card>
          <span className="screen__overline">{s('home.contacts', locale)}</span>
          <div className="home__timeline">
            <TimelineTrack
              style={{ marginTop: 'var(--sp-6)' }}
              contacts={timeline}
              activeIndex={timeline.findIndex((c) => c.label === 'Màx')}
            />
          </div>
          <EphemerisTable
            circumstances={circumstances}
            horizon={horizon}
            locale={locale}
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

        <Button size="lg" icon="camera" fullWidth onClick={onOpenCamera}>
          {s('home.openCamera', locale)}
        </Button>

        <p className="screen__note">
          {formatCoords(location.lat, location.lon)} ·{' '}
          {Math.round(location.elevation)} m
        </p>
        <p className="screen__note">{eclipse.spain[locale]}</p>
        <p className="screen__note">{s('home.sources', locale)}</p>
      </div>
    </div>
  );
}
