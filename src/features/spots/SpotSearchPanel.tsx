/**
 * El panell del cercador, muntat.
 *
 * ── LA REGLA DE L'ACCENT ────────────────────────────────────────────────────
 *
 * El sistema mana un sol ambre per pantalla. Aquí n'hi ha dos candidats: el
 * botó de cercar i `--status-partial`, que és el color d'una totalitat que es
 * veu a mitges. Es resol pel moment: mentre no hi ha resultats, l'única cosa a
 * la pantalla és el botó i l'ambre és seu; quan n'hi ha, el botó passa a
 * `secondary` —vora fina, sense farciment— i l'ambre queda per a la dada. Així
 * no n'hi ha mai dos alhora.
 *
 * La barra de progrés va en blau (`--status-info`) pel mateix motiu: informa,
 * no és ni una acció ni un veredicte.
 *
 * ── PER QUÈ CAL PRÉMER UN BOTÓ ──────────────────────────────────────────────
 *
 * La cerca baixa desenes de megabytes. Arrencar-la sola en obrir la pantalla
 * seria gastar les dades de l'usuari sense demanar-li permís, i al camp aquest
 * és un cost real.
 */

import type { GeoLocation } from '../../core/astro/types';
import type { SpotsWorkerOptions } from '../../workers/spots.worker';
import { Button, Card } from '../../ui';
import { SpotFunnelCost } from './SpotFunnelCost';
import { SpotList } from './SpotList';
import { formatPercent } from './format';
import { useSpotSearch } from './useSpotSearch';
import './spots.css';

export interface SpotSearchPanelProps {
  eclipseId: string;
  /** `null` mentre no se sap on és l'usuari. El panell ho diu i espera. */
  origin: GeoLocation | null;
  /** Paràmetres de l'embut. Es llegeixen en prémer el botó. */
  options?: SpotsWorkerOptions;
  /**
   * Ensenya el desglossament del cost de cada etapa. Va destinat a qui toqui
   * els paràmetres, no a qui busca un lloc.
   */
  showCost?: boolean;
  className?: string;
}

export function SpotSearchPanel({
  eclipseId,
  origin,
  options,
  showCost = false,
  className,
}: SpotSearchPanelProps) {
  const { status, progress, outcome, error, canSearch, search, cancel } = useSpotSearch({
    eclipseId,
    origin,
    options,
  });

  const running = status === 'running';
  const teResultats = outcome !== null && outcome.results.length > 0;

  return (
    <section className={['spotpanel', className ?? ''].filter(Boolean).join(' ')}>
      <header className="spotpanel__head">
        <div>
          <h3 className="spotpanel__title">On m’he de plantar</h3>
          <p className="spotpanel__lead">
            Escombra el voltant i creua la trajectòria del Sol amb el relleu real
            de cada punt.
          </p>
        </div>
        {running ? (
          <Button variant="secondary" icon="timer" onClick={cancel}>
            Atura
          </Button>
        ) : (
          <Button
            variant={teResultats ? 'secondary' : 'primary'}
            icon="crosshair"
            onClick={search}
            disabled={!canSearch}
          >
            {teResultats ? 'Torna a cercar' : 'Busca llocs'}
          </Button>
        )}
      </header>

      {origin === null && (
        <p className="spotpanel__wait">
          Cal saber on ets per poder buscar-hi al voltant.
        </p>
      )}

      {running && progress && (
        <div className="spotpanel__progress">
          <div
            className="spotprogress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.ratio * 100)}
            aria-label="Progrés de la cerca"
          >
            <span
              className="spotprogress__fill"
              style={{ width: `${Math.round(progress.ratio * 100)}%` }}
            />
          </div>
          <p className="spotpanel__stage">
            <span>{progress.message}</span>
            <span className="eclipsi-data">{formatPercent(progress.ratio)}</span>
          </p>
        </div>
      )}

      {status === 'cancelled' && (
        <p className="spotpanel__wait">Cerca aturada. No s’ha baixat res més.</p>
      )}

      {status === 'error' && error && <p className="spotpanel__error">{error}</p>}

      {outcome && <SpotList outcome={outcome} />}

      {showCost && outcome && (
        <Card tone="inset" padding="var(--sp-4)">
          <SpotFunnelCost cost={outcome.cost} candidates={outcome.candidates} />
        </Card>
      )}
    </section>
  );
}
