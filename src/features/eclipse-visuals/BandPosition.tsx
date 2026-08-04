/** Secció transversal de la franja; les xifres escrites continuen manant. */

import type { Locale } from '../../i18n';
import type { BandLimitDistance } from '../../core/astro/uncertainty';
import { buildBandPositionModel } from './model';
import { vs } from './strings';
import './eclipse-visuals.css';

export interface BandPositionProps {
  limit: BandLimitDistance;
  toCenterKm: number | null;
  limitUncertaintyKm: number;
  locale: Locale;
}

export function BandPosition({ limit, toCenterKm, limitUncertaintyKm, locale }: BandPositionProps) {
  const model = buildBandPositionModel(limit, toCenterKm, limitUncertaintyKm);
  const x = (0.07 + model.point * 0.86) * 100;
  const centerX = (0.07 + model.center * 0.86) * 100;
  const uncertainty = model.uncertaintyFraction * 86;

  return (
    <section className="evis bandpos" aria-label={vs('band.title', locale)}>
      <div className="evis__head">
        <h3 className="evis__title">{vs('band.title', locale)}</h3>
        <span className="evis__note">{vs(model.inside ? 'band.inside' : 'band.outside', locale)}</span>
      </div>
      <div className="bandpos__plot" role="img" aria-label={`${vs(model.inside ? 'band.inside' : 'band.outside', locale)}; ${model.distanceToLimitKm.toFixed(1)} km`}>
        <div className="bandpos__track">
          {uncertainty > 0 && <>
            <span className="bandpos__uncertainty" style={{ left: 0, width: `${uncertainty}%` }} />
            <span className="bandpos__uncertainty" style={{ right: 0, width: `${uncertainty}%` }} />
          </>}
          <span className="bandpos__center" style={{ left: `${model.center * 100}%` }} />
        </div>
        <span className="bandpos__markerlabel" style={{ left: `${x}%` }}>{vs('band.here', locale)}</span>
        <span className="bandpos__marker" style={{ left: `${x}%` }} />
        <span className="bandpos__centerlabel" style={{ left: `${centerX}%` }}>{vs('band.center', locale)}</span>
        <span className="bandpos__edge bandpos__edge--n">{vs('band.north', locale)}</span>
        <span className="bandpos__edge bandpos__edge--s">{vs('band.south', locale)}</span>
      </div>
      {model.uncertaintyFraction > 0 && <p className="evis__note">{vs('band.edge', locale)}</p>}
    </section>
  );
}
