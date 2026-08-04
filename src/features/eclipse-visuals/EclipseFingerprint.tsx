/**
 * L'empremta no és un logotip aleatori: el contorn és l'horitzó del punt, els
 * discs són els del màxim a escala entre ells i l'arc exterior és la part de
 * l'esdeveniment que sobreviu al relleu. El text adjacent explica la magnitud
 * de l'arc perquè la forma mai hagi de fer de número.
 */

import { Card } from '../../ui';
import type { Locale } from '../../i18n';
import type { LocalCircumstances } from '../../core/astro/types';
import type { HorizonProfile } from '../../core/horizon/profile';
import type { VisibilityVerdict } from '../../core/visibility/verdict';
import { formatObscurationPercent } from '../../core/astro/obscuration';
import { NO_DATA } from '../../screens/format';
import { buildFingerprintModel, fingerprintPath, polarPoint } from './model';
import { vs } from './strings';
import './eclipse-visuals.css';

export interface EclipseFingerprintProps {
  circumstances: LocalCircumstances;
  horizon: HorizonProfile | null;
  verdict: VisibilityVerdict | null;
  locale: Locale;
  className?: string;
}

const SIZE = 160;
const RING_R = 72;

export function EclipseFingerprint({
  circumstances,
  horizon,
  verdict,
  locale,
  className,
}: EclipseFingerprintProps) {
  const model = buildFingerprintModel(circumstances, horizon, verdict);
  const marker = polarPoint(model.sunAzimuthDeg, 68, 80, 80);
  const central = model.kind === 'total' || model.kind === 'annular';
  const percent = model.metric === null
    ? NO_DATA
    : formatObscurationPercent(model.metric, model.metric >= 1);

  return (
    <Card className={['evis', 'fingerprint', className ?? ''].filter(Boolean).join(' ')}>
      <svg
        className="fingerprint__svg evis__visual"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`${vs('fingerprint.title', locale)}: ${percent} ${vs(central ? 'fingerprint.central' : 'fingerprint.partial', locale)}`}
      >
        <circle className="fingerprint__ring" cx="80" cy="80" r={RING_R} />
        {model.metric !== null && (
          <circle
            className="fingerprint__metricarc"
            cx="80"
            cy="80"
            r={RING_R}
            pathLength="1"
            strokeDasharray={`${model.metric} 1`}
            transform="rotate(-90 80 80)"
          />
        )}
        <path
          className={`fingerprint__terrain fingerprint__terrain--${model.terrain}`}
          d={fingerprintPath(model, SIZE)}
        />
        <circle className="fingerprint__sun" cx="80" cy="80" r={model.sunRadius * SIZE} />
        <circle
          className="fingerprint__moon"
          cx={80 + model.separation * SIZE}
          cy="80"
          r={model.moonRadius * SIZE}
        />
        <circle className="fingerprint__az" cx={marker.x} cy={marker.y} r="3.5" />
      </svg>
      <div className="fingerprint__metric">
        <h2 className="evis__title">{vs('fingerprint.title', locale)}</h2>
        <span className="fingerprint__value">{percent}</span>
        <span className="fingerprint__label">
          {vs(central ? 'fingerprint.central' : 'fingerprint.partial', locale)}
        </span>
        <p className="evis__note">
          {vs(model.terrain === 'measured' ? 'fingerprint.measured' : 'fingerprint.assumed', locale)}
        </p>
      </div>
      <ul className="fingerprint__legend">
        <li>
          {vs(model.terrain === 'measured' ? 'fingerprint.shape.measured' : 'fingerprint.shape.assumed', locale)}
        </li>
        <li>
          {vs(
            central && model.metric === null
              ? 'fingerprint.arc.pending'
              : central
                ? 'fingerprint.arc.central'
                : 'fingerprint.arc.partial',
            locale,
          )}
        </li>
        <li>
          {vs(
            model.kind === 'total'
              ? 'fingerprint.discs.total'
              : model.kind === 'annular'
                ? 'fingerprint.discs.annular'
                : 'fingerprint.discs.partial',
            locale,
          )}
        </li>
        <li>{vs('fingerprint.direction', locale)}</li>
      </ul>
    </Card>
  );
}
