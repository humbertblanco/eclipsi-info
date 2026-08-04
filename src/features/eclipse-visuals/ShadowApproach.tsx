/** La direcció de la paret d'ombra, enganxada al mateix rellotge que els avisos. */

import { useEffect, useState } from 'react';
import type { Locale } from '../../i18n';
import type { LocalCircumstances } from '../../core/astro/types';
import type { ShadowMotion } from '../../core/astro/shadow';
import { bearingToCardinal } from '../../core/astro/gradient';
import { Stat } from '../../ui';
import { formatClockShort, formatDecimal } from '../../screens/format';
import { buildShadowApproachModel, polarPoint } from './model';
import { vs } from './strings';
import './eclipse-visuals.css';

export interface ShadowApproachProps {
  motion: ShadowMotion;
  circumstances: LocalCircumstances;
  /** Rellotge injectable per a proves; en producció el mòdul s'actualitza sol. */
  nowMs?: number;
  locale: Locale;
}

export function ShadowApproach({ motion, circumstances, nowMs, locale }: ShadowApproachProps) {
  const [liveNowMs, setLiveNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (nowMs !== undefined) return;
    const timer = window.setInterval(() => setLiveNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [nowMs]);

  const currentMs = nowMs ?? liveNowMs;
  const model = buildShadowApproachModel(motion, circumstances, currentMs);
  if (model === null) return null;
  const from = polarPoint(model.arrivalBearing, 35);
  const progressOffset = 30 - model.progress * 30;
  const temporalExplanation = currentMs < model.watchFromMs
    ? 'shadow.explain.before'
    : currentMs < model.c2Ms
      ? 'shadow.explain.approaching'
      : 'shadow.explain.arrived';

  return (
    <section className="evis shadowvis" aria-label={vs('shadow.title', locale)}>
      <h3 className="evis__title">
        {vs(model.kind === 'annular' ? 'shadow.annularTitle' : 'shadow.title', locale)}
      </h3>
      <div className="shadowvis__body">
        <svg className="shadowvis__dial" viewBox="0 0 100 100" role="img" aria-label={bearingToCardinal(model.arrivalBearing, locale)}>
          <defs>
            <clipPath id="shadow-dial-clip"><circle cx="50" cy="50" r="44" /></clipPath>
          </defs>
          <circle className="shadowvis__face" cx="50" cy="50" r="44" />
          <g clipPath="url(#shadow-dial-clip)" transform={`rotate(${model.arrivalBearing} 50 50)`}>
            <path className="shadowvis__front" d="M 8 8 H 42 Q 60 50 42 92 H 8 Z" transform={`translate(${progressOffset} 0)`} />
          </g>
          <line className="shadowvis__arrow" x1={from.x} y1={from.y} x2="50" y2="50" />
          <circle className="shadowvis__dot" cx="50" cy="50" r="4" />
        </svg>
        <div className="shadowvis__stats">
          <Stat label={vs('shadow.from', locale)} value={bearingToCardinal(model.arrivalBearing, locale)} />
          <Stat
            label={vs('shadow.speed', locale)}
            value={model.speedKmh === null ? vs('shadow.fast', locale) : formatDecimal(model.speedKmh, 0, locale)}
            unit={model.speedKmh === null ? undefined : 'km/h'}
          />
          <Stat
            className="shadowvis__watch"
            label={vs('shadow.watch', locale)}
            value={formatClockShort(new Date(model.watchFromMs), locale)}
          />
        </div>
      </div>
      <ul className="shadowvis__legend">
        <li>{vs(model.kind === 'annular' ? 'shadow.explain.annular' : 'shadow.explain.total', locale)}</li>
        <li>{vs(temporalExplanation, locale)}</li>
        {model.speedKmh === null && <li>{vs('shadow.explain.diverging', locale)}</li>}
      </ul>
      {model.lowSunCaveat && model.kind === 'total' && <p className="evis__note">{vs('shadow.low', locale)}</p>}
    </section>
  );
}
