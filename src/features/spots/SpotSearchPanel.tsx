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
import type { SpotResult } from '../../core/spots/types';
import type { SpotsWorkerOptions } from '../../workers/spots.worker';
import type { Locale } from '../../i18n';
import { Button, Card } from '../../ui';
import { SpotFunnelCost } from './SpotFunnelCost';
import { SpotList } from './SpotList';
import { formatPercent } from './format';
import { sp } from './strings';
import { useSpotSearch } from './useSpotSearch';
import './spots.css';

export interface SpotSearchPanelProps {
  eclipseId: string;
  locale: Locale;
  /** `null` mentre no se sap on és l'usuari. El panell ho diu i espera. */
  origin: GeoLocation | null;
  /** Paràmetres de l'embut. Es llegeixen en prémer el botó. */
  options?: SpotsWorkerOptions;
  /** Fer d'un resultat el punt de l'app. Es passa avall fins a cada targeta. */
  onSelect?: (spot: SpotResult) => void;
  /**
   * Ensenya el desglossament del cost de cada etapa. Va destinat a qui toqui
   * els paràmetres, no a qui busca un lloc.
   */
  showCost?: boolean;
  className?: string;
}

export function SpotSearchPanel({
  eclipseId,
  locale,
  origin,
  options,
  onSelect,
  // La taula de cost és un diagnòstic d'enginyeria, no una funció d'usuari:
  // visible a `npm run dev` per mesurar el cercador, fora del build de
  // producció — una app que no demana res sense explicar-ho no planta una
  // taula de set columnes davant d'algú que vol saber on posar-se.
  showCost = import.meta.env.DEV,
  className,
}: SpotSearchPanelProps) {
  // `error` porta el text cru del motor: tècnic i sovint en català. Durant un
  // temps no es llegia a posta per no barrejar idiomes, però un «ha fallat»
  // pelat no deixa distingir una xarxa caiguda d'un relleu corrupte. Es fa com
  // a `OfflinePanel`: el títol traduït a dalt i la causa crua a sota, que val
  // més una pista en l'idioma equivocat que cap pista.
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
          <h3 className="spotpanel__title">{sp('panel.title', locale)}</h3>
          <p className="spotpanel__lead">{sp('panel.lead', locale)}</p>
        </div>
        {running ? (
          <Button variant="secondary" icon="timer" onClick={cancel}>
            {sp('panel.stop', locale)}
          </Button>
        ) : (
          <Button
            variant={teResultats ? 'secondary' : 'primary'}
            icon="crosshair"
            onClick={search}
            disabled={!canSearch}
          >
            {teResultats ? sp('panel.searchAgain', locale) : sp('panel.search', locale)}
          </Button>
        )}
      </header>

      {origin === null && <p className="spotpanel__wait">{sp('panel.needOrigin', locale)}</p>}

      {/* El cost de dades es diu ABANS de prémer, que és quan encara es pot
          decidir. Un cop la cerca corre, l'avís seria una factura. */}
      {origin !== null && !running && outcome === null && (
        <p className="spotpanel__wait">{sp('panel.dataWarning', locale)}</p>
      )}

      {running && progress && (
        <div className="spotpanel__progress">
          <div
            className="spotprogress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.ratio * 100)}
            aria-label={sp('panel.progressLabel', locale)}
          >
            <span
              className="spotprogress__fill"
              style={{ width: `${Math.round(progress.ratio * 100)}%` }}
            />
          </div>
          <p className="spotpanel__stage">
            {/*
              L'ETAPA, NO EL `message` DEL MOTOR.

              `SpotSearchProgress` porta un `message` que `core/spots/search.ts`
              escriu en català. Fer-lo servir aquí posaria una frase catalana a
              la pantalla de qui té l'app en castellà — el mateix defecte que ja
              ha calgut arreglar tres vegades. L'etapa és un codi i el text surt
              de `strings.ts`.
            */}
            <span>{sp(`stage.${progress.stage}`, locale)}</span>
            <span className="eclipsi-data">{formatPercent(progress.ratio, locale)}</span>
          </p>
        </div>
      )}

      {status === 'cancelled' && (
        <p className="spotpanel__wait">{sp('panel.cancelled', locale)}</p>
      )}

      {status === 'error' && (
        <>
          <p className="spotpanel__error">{sp('panel.failed', locale)}</p>
          {error !== null && (
            <p className="spotpanel__error">
              {sp('panel.failedDetail', locale, { error })}
            </p>
          )}
        </>
      )}

      {outcome && <SpotList outcome={outcome} locale={locale} onSelect={onSelect} />}

      {showCost && outcome && (
        <Card tone="inset" padding="var(--sp-4)">
          <SpotFunnelCost
            cost={outcome.cost}
            candidates={outcome.candidates}
            locale={locale}
          />
        </Card>
      )}
    </section>
  );
}
