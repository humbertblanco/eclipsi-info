import { useEffect, useMemo, useRef, useState } from 'react';
import { computeLocalCircumstances, findSunset } from '../../core/astro/contacts';
import { sampleAt } from '../../core/astro/ephemeris';
import { STANDARD_ATMOSPHERE } from '../../core/astro/constants';
import type { GeoLocation } from '../../core/astro/types';
import { getEclipse } from '../../core/eclipses/catalog';
import { horizonSampler, type HorizonProfile } from '../../core/horizon/profile';
import { computeVisibility } from '../../core/visibility/verdict';
import { renderEclipseSky } from './renderSky';
import { renderTrajectory } from './renderTrajectory';
import {
  formatObscurationPercent,
  partialCaveat,
} from '../../core/astro/obscuration';

interface Props {
  location: GeoLocation;
  eclipseId: string;
  locale: 'ca' | 'es';
  /** Perfil d'horitzó del terreny. Sense ell, el veredicte és optimista. */
  horizon: HorizonProfile | null;
}

/** Nombre de mostres del recorregut. 240 dona una corba suau sense penalitzar. */
const TRAJECTORY_SAMPLES = 240;

const fmtTime = (d: Date) =>
  d.toLocaleTimeString('ca-ES', {
    timeZone: 'Europe/Madrid',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

/**
 * Durada a text.
 *
 * S'arrodoneix PRIMER el total i després es reparteix. Fer-ho a l'inrevés
 * —minuts amb `floor` i segons amb `round` per separat— produeix «3 min 60 s»,
 * que no és cap durada: passa amb 239,526 s, que és exactament la totalitat de
 * l'eclipsi del 2027 a l'estret de Gibraltar. Ho va caçar una auditoria, i el
 * paràgraf de sota d'aquella xifra deia «4 min», o sigui que la mateixa
 * pantalla es contradeia.
 */
const fmtDuration = (sec: number) => {
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} min ${s.toString().padStart(2, '0')} s` : `${s} s`;
};

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

  const samples = useMemo(() => {
    const { c1, c4, max } = circumstances.contacts;
    const start = (c1 ?? max).time.getTime();
    const end = (c4 ?? max).time.getTime();
    if (end <= start) return [max];

    const out = [];
    for (let i = 0; i <= TRAJECTORY_SAMPLES; i++) {
      const t = start + ((end - start) * i) / TRAJECTORY_SAMPLES;
      out.push(sampleAt(new Date(t), location));
    }
    return out;
  }, [circumstances, location]);

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
          {location.lat.toFixed(4)}°, {location.lon.toFixed(4)}° · {Math.round(location.elevation)} m
        </p>
      </header>

      <div className={`verdict verdict--${circumstances.kind}`}>
        <span className="verdict__kind">
          {circumstances.kind === 'total' && 'TOTAL'}
          {circumstances.kind === 'annular' && 'ANULAR'}
          {circumstances.kind === 'partial' && 'PARCIAL'}
          {circumstances.kind === 'none' && 'NO VISIBLE'}
        </span>

        {isCentral && verdict ? (
          // Amb perfil de terreny, la xifra gran és la que veuràs DE VERITAT.
          // La teòrica queda al costat, perquè entenguis què et roba el relleu.
          <>
            <span className="verdict__dur">{fmtDuration(verdict.centralVisibleSec)}</span>
            {verdict.centralLostSec > 1 && (
              <span className="verdict__lost">
                de {fmtDuration(verdict.centralTotalSec)} · el terreny te'n roba{' '}
                {fmtDuration(verdict.centralLostSec)}
              </span>
            )}
          </>
        ) : (
          isCentral && (
            <span className="verdict__dur">{fmtDuration(circumstances.centralDurationSec)}</span>
          )
        )}

        <span className="verdict__obsc">
          {formatObscurationPercent(verdict?.maxVisibleObscuration ?? c.max.obscuration, isCentral)}{' '}
          de l'àrea solar tapada
        </span>
      </div>

      {!isCentral && partialCaveat(c.max.obscuration) && (
        <p className="warn">{partialCaveat(c.max.obscuration)}</p>
      )}

      {verdict && (
        <p className={verdict.centralLostSec > 1 ? 'warn' : 'note'}>{verdict.summary}</p>
      )}

      {verdict?.climbToRecoverM != null && verdict.centralLostSec > 1 && (
        <p className="note">
          El que et tapa és a {verdict.blockingDistanceKm?.toFixed(1)} km i et falten{' '}
          {verdict.altitudeDeficitDeg.toFixed(2)}° d'altura. Des d'aquí, això vol dir
          pujar uns {Math.round(verdict.climbToRecoverM)} m.
        </p>
      )}

      {!horizon && (
        <p className="note">
          Encara no s'ha calculat el perfil del terreny d'aquest punt: la durada que
          es mostra és la teòrica, amb horitzó pla.
        </p>
      )}

      <canvas ref={skyRef} className="canvas canvas--sky" />

      <input
        className="scrub"
        type="range"
        min={0}
        max={1}
        step={1 / TRAJECTORY_SAMPLES}
        value={progress}
        onChange={(e) => setProgress(Number(e.target.value))}
        aria-label="Línia temporal de l'eclipsi"
      />
      <div className="scrub__readout">
        <strong>{fmtTime(current.time)}</strong>
        <span>alt {current.sun.altitudeApparent.toFixed(2)}°</span>
        <span>az {current.sun.azimuth.toFixed(1)}°</span>
        <span>obsc {formatObscurationPercent(current.obscuration, current.obscuration >= 1)}</span>
      </div>

      <canvas ref={trajRef} className="canvas canvas--traj" />

      <table className="contacts">
        <tbody>
          {([['C1', c.c1], ['C2', c.c2], ['Màxim', c.max], ['C3', c.c3], ['C4', c.c4]] as const).map(
            ([label, sample]) =>
              sample ? (
                <tr key={label}>
                  <td className="contacts__label">{label}</td>
                  <td className="contacts__time">{fmtTime(sample.time)}</td>
                  <td className="contacts__alt">{sample.sun.altitudeApparent.toFixed(2)}°</td>
                  <td className="contacts__az">{sample.sun.azimuth.toFixed(1)}°</td>
                </tr>
              ) : null,
          )}
          {sunset && (
            <tr className="contacts--sunset">
              <td className="contacts__label">Posta</td>
              <td className="contacts__time">{fmtTime(sunset)}</td>
              <td colSpan={2}>horitzó pla</td>
            </tr>
          )}
        </tbody>
      </table>

      {sunsetMargin !== null && sunsetMargin < 0 && (
        <p className="warn">
          El Sol es pon {Math.abs(sunsetMargin).toFixed(0)} minuts abans que acabi
          l'eclipsi. I això comptant un horitzó pla de mar: amb qualsevol relleu a
          ponent, en perdràs més.
        </p>
      )}

      {eclipse.lowSunOverSpain && (
        <p className="note">
          Sol a {c.max.sun.altitudeApparent.toFixed(1)}° sobre l'horitzó al màxim.
          A aquesta altura el terreny cap a l'oest decideix el que veuràs — el
          perfil real d'aquest punt encara no està calculat.
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
