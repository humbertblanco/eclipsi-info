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

import { useEffect } from 'react';

import type { GeoLocation } from '../../core/astro/types';
import type { SpotResult } from '../../core/spots/types';
import type { SpotsWorkerOptions } from '../../workers/spots.worker';
import type { Locale } from '../../i18n';
import { Button, Card } from '../../ui';
import { SpotFunnelCost } from './SpotFunnelCost';
import { SpotList } from './SpotList';
import { durationText, formatPercent } from './format';
import { sp, spotSearchFailureText } from './strings';
import { useSpotSearch } from './useSpotSearch';
import './spots.css';

export interface SpotSearchPanelProps {
  eclipseId: string;
  locale: Locale;
  /** `null` mentre no se sap on és l'usuari. El panell ho diu i espera. */
  origin: GeoLocation | null;
  /** Durada visible i teòrica al punt actual, per comparar cada recomanació. */
  currentVisibleSec?: number | null;
  currentTotalSec?: number | null;
  /** Paràmetres de l'embut. Es llegeixen en prémer el botó. */
  options?: SpotsWorkerOptions;
  /** Fer d'un resultat el punt de l'app. Es passa avall fins a cada targeta. */
  onSelect?: (spot: SpotResult) => void;
  /**
   * Els resultats, cap amunt, perquè el mapa els pugui marcar amb el mateix
   * número que la llista. `null` quan no n'hi ha (cerca nova, cancel·lada o
   * sense resultats): el mapa treu les xinxetes i no queda cap òrfena d'una
   * cerca vella.
   */
  onResults?: (spots: { lat: number; lon: number; index: number }[] | null) => void;
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
  currentVisibleSec,
  currentTotalSec,
  options,
  onSelect,
  onResults,
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

  /*
   * Els resultats pugen al pare quan canvien: el mapa marca cada candidat amb
   * el número de la seva targeta (mateixa numeració, mateixa lectura). `null`
   * neteja — una cerca nova o buida no ha de deixar xinxetes velles al mapa.
   * El pare ja retira les xinxetes en sortir de la vista, així que aquí només
   * cal dir la veritat de l'última cerca.
   */
  useEffect(() => {
    if (onResults === undefined) return;
    const results = outcome?.results ?? null;
    onResults(
      results === null || results.length === 0
        ? null
        : results.map((spot, i) => ({ lat: spot.lat, lon: spot.lon, index: i + 1 })),
    );
  }, [outcome, onResults]);

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

      {origin !== null && currentTotalSec !== undefined && currentTotalSec !== null && (
        <Card tone="inset" padding="var(--sp-4)" className="spotpanel__origin">
          <p className="spotpanel__originlabel">{sp('panel.origin', locale)}</p>
          <p className="spotpanel__originvalue">
            {currentTotalSec > 0
              ? currentVisibleSec === undefined || currentVisibleSec === null
                ? sp('panel.originPending', locale, { total: durationText(currentTotalSec) })
                : sp('panel.originVisible', locale, {
                    visible: durationText(currentVisibleSec),
                    total: durationText(currentTotalSec),
                  })
              : sp('panel.originNoCentral', locale)}
          </p>
        </Card>
      )}

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
          {/*
            EL MOTIU, TRADUÏT.

            Abans aquí s'hi interpolava el `message` cru del motor, escrit en
            català dins de `core/spots/search.ts`: la frase de fora sortia en
            castellà i el motiu —«Comprova la connexió», l'única part
            accionable— en català. Ara el motiu és un codi i el text surt de
            `strings.ts`, com l'etapa del progrés.
          */}
          {error !== null && (
            <p className="spotpanel__error">{spotSearchFailureText(error, locale)}</p>
          )}
        </>
      )}

      {outcome && (
        <SpotList
          outcome={outcome}
          locale={locale}
          eclipseId={eclipseId}
          baselineVisibleSec={currentVisibleSec}
          onSelect={onSelect}
        />
      )}

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
