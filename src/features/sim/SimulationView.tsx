import { useEffect, useMemo, useRef, useState } from 'react';
import { computeLocalCircumstances, findSunset } from '../../core/astro/contacts';
import { STANDARD_ATMOSPHERE } from '../../core/astro/constants';
import type { GeoLocation } from '../../core/astro/types';
import { getEclipse } from '../../core/eclipses/catalog';
import { horizonSampler, type HorizonProfile } from '../../core/horizon/profile';
import { computeVisibility } from '../../core/visibility/verdict';
import { renderEclipseSky } from './renderSky';
import { renderTrajectory } from './renderTrajectory';
import { TRAJECTORY_SAMPLES, trajectorySamples } from './samples';
import {
  formatObscurationPercent,
  partialCaveat,
} from '../../core/astro/obscuration';
import type { Locale } from '../../i18n';
import { s } from '../../screens/strings';
import { verdictSummary } from '../../screens/verdictSummary';
import { EphemerisTable } from '../../screens/EphemerisTable';
import {
  formatClock,
  formatDecimal,
  formatDuration,
  NO_DATA,
} from '../../screens/format';

interface Props {
  location: GeoLocation;
  eclipseId: string;
  locale: Locale;
  /** Perfil d'horitzó del terreny. Sense ell, el veredicte és optimista. */
  horizon: HorizonProfile | null;
}

/*
 * LES MOSTRES DEL RECORREGUT VIUEN A `samples.ts`.
 *
 * Estaven aquí dins, en un `useMemo`, i per això la miniatura de l'historial no
 * podia obtenir la corba d'un punt sense muntar aquesta pantalla sencera. El
 * nombre de passos de la barra de temps és el mateix `TRAJECTORY_SAMPLES` a
 * posta: així el marcador de l'instant cau damunt d'una mostra i no entre dues.
 */

/*
 * NI HORES NI DURADES PRÒPIES: TOT VE DE `screens/format`.
 *
 * Aquí hi havia un `fmtTime` clavat a `Europe/Madrid` —a les Canàries donava
 * una hora de més que la taula d'efemèrides de la mateixa pantalla— i un
 * `fmtDuration` que escrivia «3 min 00 s» on `formatDuration` escriu «3 min».
 * Dues maneres d'escriure la mateixa xifra a la mateixa vista és exactament el
 * que fa dubtar de totes dues.
 *
 * La lliçó que sí que valia la pena del `fmtDuration` d'abans —arrodonir el
 * total ABANS de repartir-lo, perquè si no surt «3 min 60 s» amb 239,526 s, que
 * és la totalitat del 2027 a l'estret de Gibraltar— ja la incorpora
 * `formatDuration`.
 */

export function SimulationView({ location, eclipseId, locale, horizon }: Props) {
  const eclipse = getEclipse(eclipseId);

  const circumstances = useMemo(
    () => computeLocalCircumstances(eclipseId, location),
    [eclipseId, location],
  );

  const horizonProfile = useMemo(
    () => (horizon ? horizonSampler(horizon) : undefined),
    [horizon],
  );

  const samples = useMemo(
    () => trajectorySamples(circumstances, location),
    [circumstances, location],
  );

  const sunset = useMemo(
    () => findSunset(location, circumstances.contacts.max.time),
    [location, circumstances],
  );

  // El veredicte: quants segons de la fase central veuràs REALMENT des d'aquí,
  // un cop tingut en compte el relleu que tens al davant. És l'única xifra que
  // de veritat decideix si val la pena el viatge.
  const verdict = useMemo(
    () => (horizon ? computeVisibility(circumstances, horizon, samples) : null),
    [circumstances, horizon, samples],
  );

  // Posició de la línia temporal, de 0 a 1 sobre l'interval C1-C4.
  const [progress, setProgress] = useState(0.5);

  const current = useMemo(() => {
    const idx = Math.round(progress * (samples.length - 1));
    return samples[Math.max(0, Math.min(samples.length - 1, idx))];
  }, [progress, samples]);

  const skyRef = useRef<HTMLCanvasElement>(null);
  const trajRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = skyRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setupHiDpi(canvas, ctx);
    renderEclipseSky(ctx, current, canvas.clientWidth, canvas.clientHeight, {
      fovDeg: 3.2,
      atmosphere: STANDARD_ATMOSPHERE,
      showHorizon: true,
      horizonProfile,
    });
  }, [current, horizonProfile]);

  useEffect(() => {
    const canvas = trajRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setupHiDpi(canvas, ctx);
    renderTrajectory(
      ctx,
      circumstances,
      samples,
      canvas.clientWidth,
      canvas.clientHeight,
      { currentTime: current.time, locale, horizonProfile },
    );
  }, [circumstances, samples, current, locale, horizonProfile]);

  const c = circumstances.contacts;
  const isCentral = circumstances.kind === 'total' || circumstances.kind === 'annular';

  // El marge entre el final de l'eclipsi i la posta és la xifra que decideix
  // si val la pena el viatge. Amb l'horitzó pla; amb muntanyes, pitjor.
  const sunsetMargin =
    sunset && c.c4 ? (sunset.getTime() - c.c4.time.getTime()) / 60000 : null;

  return (
    <div className="sim">
      <header className="sim__head">
        <h2>{eclipse.label[locale]}</h2>
        <p className="muted">
          {formatDecimal(location.lat, 4, locale)}°,{' '}
          {formatDecimal(location.lon, 4, locale)}° ·{' '}
          {Math.round(location.elevation)} m
        </p>
      </header>

      <div className={`verdict verdict--${circumstances.kind}`}>
        {/* `.verdict__kind` ja ho posa en versaletes des del CSS: aquí va el
            nom del tipus d'eclipsi tal com l'escriu la resta de l'app. */}
        <span className="verdict__kind">
          {s(`kind.${circumstances.kind}` as 'kind.total', locale)}
        </span>

        {isCentral && verdict ? (
          // Amb perfil de terreny, la xifra gran és la que veuràs DE VERITAT.
          // La teòrica queda al costat, perquè entenguis què et roba el relleu.
          <>
            <span className="verdict__dur">
              {formatDuration(verdict.centralVisibleSec)}
            </span>
            {verdict.centralLostSec > 1 && (
              <span className="verdict__lost">
                {s('sim.terrainSteals', locale, {
                  total: formatDuration(verdict.centralTotalSec),
                  lost: formatDuration(verdict.centralLostSec),
                })}
              </span>
            )}
          </>
        ) : (
          isCentral && (
            <span className="verdict__dur">
              {formatDuration(circumstances.centralDurationSec)}
            </span>
          )
        )}

        <span className="verdict__obsc">
          {s('sim.obscuredArea', locale, {
            pct: formatObscurationPercent(
              verdict?.maxVisibleObscuration ?? c.max.obscuration,
              isCentral,
            ),
          })}
        </span>
      </div>

      {!isCentral && partialCaveat(c.max.obscuration, locale) && (
        <p className="warn">{partialCaveat(c.max.obscuration, locale)}</p>
      )}

      {verdict && (
        <p className={verdict.centralLostSec > 1 ? 'warn' : 'note'}>
          {verdictSummary(verdict, locale)}
        </p>
      )}

      {verdict?.climbToRecoverM != null && verdict.centralLostSec > 1 && (
        <p className="note">
          {s('sim.climb', locale, {
            // La distància a l'obstacle pot no saber-se encara que sí que se
            // sàpiga quant s'ha de pujar: un guió, mai un zero que sembli mesura.
            km:
              verdict.blockingDistanceKm === null
                ? NO_DATA
                : formatDecimal(verdict.blockingDistanceKm, 1, locale),
            deficit: `${formatDecimal(verdict.altitudeDeficitDeg, 2, locale)}°`,
            climb: formatDecimal(Math.round(verdict.climbToRecoverM), 0, locale),
          })}
        </p>
      )}

      {!horizon && <p className="note">{s('sim.terrainPending', locale)}</p>}

      <canvas ref={skyRef} className="canvas canvas--sky" />

      <input
        className="scrub"
        type="range"
        min={0}
        max={1}
        step={1 / TRAJECTORY_SAMPLES}
        value={progress}
        onChange={(e) => setProgress(Number(e.target.value))}
        aria-label={s('sim.timeline', locale)}
      />
      <div className="scrub__readout">
        <strong>{formatClock(current.time, locale)}</strong>
        <span>
          {s('sim.readoutAlt', locale, {
            deg: `${formatDecimal(current.sun.altitudeApparent, 2, locale)}°`,
          })}
        </span>
        <span>
          {s('sim.readoutAz', locale, {
            deg: `${formatDecimal(current.sun.azimuth, 1, locale)}°`,
          })}
        </span>
        <span>
          {s('sim.readoutObsc', locale, {
            pct: formatObscurationPercent(
              current.obscuration,
              current.obscuration >= 1,
            ),
          })}
        </span>
      </div>

      <canvas ref={trajRef} className="canvas canvas--traj" />

      {/*
        ELS CINC CONTACTES ELS PINTA `EphemerisTable`, NO UNA TAULA D'AQUÍ.
        N'hi havia una de pròpia amb les mateixes cinc files, i les dues
        discrepaven: hores en zona peninsular contra hores del dispositiu, i
        «3 min 00 s» contra «3 min». Amb una sola taula ja no hi ha res a
        conciliar, i a més aquesta hi afegeix el marge sobre el terreny.

        La posta no hi cap —no és un contacte de l'eclipsi— i queda a la línia
        de sota, que és on ja estava el seu avís.
      */}
      <EphemerisTable circumstances={circumstances} horizon={horizon} locale={locale} />

      {sunset && (
        <p className="note">
          {s('sim.sunset', locale, { time: formatClock(sunset, locale) })}
        </p>
      )}

      {sunsetMargin !== null && sunsetMargin < 0 && (
        <p className="warn">
          {/* En durada i no en «X minuts»: així no surt mai «1 minuts», i un
              marge de 40 s no s'escriu com un 0. */}
          {s('sim.sunsetBefore', locale, {
            gap: formatDuration(Math.abs(sunsetMargin) * 60),
          })}
        </p>
      )}

      {eclipse.lowSunOverSpain && (
        <p className="note">
          {s('sim.lowSun', locale, {
            alt: `${formatDecimal(c.max.sun.altitudeApparent, 1, locale)}°`,
          })}
        </p>
      )}
    </div>
  );
}

/**
 * Ajusta el canvas a la densitat de píxels del dispositiu. Sense això, en un
 * mòbil els discos surten pixelats i la simulació perd tota la credibilitat.
 */
function setupHiDpi(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
