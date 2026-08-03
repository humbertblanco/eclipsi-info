/**
 * Pantalla d'offline: què hi ha desat, què falta, i el botó que ho baixa tot.
 *
 * L'ordre de la informació no és casual. Primer l'estat de la connexió i el
 * botó (el que la persona ha vingut a fer), després l'inventari (el que li
 * dona confiança per marxar de casa) i al final l'espai i les limitacions
 * (el que només consulta si alguna cosa no li quadra).
 *
 * JA NO MUNTA `UpdatePrompt`: l'avís de versió nova viu a l'arrel de l'app
 * des que es va arreglar que no es veiés mai (vegeu el comentari a `App.tsx`).
 * Mantenir-lo també aquí faria sortir l'avís dues vegades a la mateixa
 * pantalla el dia que el panell es munta de debò — que és avui.
 */

import { useEffect, useMemo, useRef } from 'react';
import type { GeoLocation } from '../core/astro/types';
import type { Locale } from '../i18n';
import { roundCoordinate } from '../core/horizon/cache';
import { ConnectionBadge } from './ConnectionBadge';
import { installHint } from './ios';
import { formatBytes, planPrepare } from './plan';
import { defaultPlaceLabel, type PreparePhase } from './prepare';
import { os, prepareFailureText, type OfflineStringKey } from './strings';
import { useOfflineInventory } from './useOfflineInventory';
import { useOnlineStatus } from './useOnlineStatus';
import { usePrepare } from './usePrepare';
import type { PreparedPlace } from './store';
// Els estils viatgen amb el component, com a la resta de vistes del projecte:
// qui el munti no ha de recordar cap import extra.
import './offline.css';

export interface OfflinePanelProps {
  /** Punt que es prepararà. Sense punt no hi ha res a baixar. */
  location: GeoLocation | null;
  /** Nom del lloc per a la llista. Si no n'hi ha, s'hi posen les coordenades. */
  placeLabel?: string;
  locale: Locale;
  /** Es crida quan un punt acaba de quedar preparat. */
  onPrepared?: (place: PreparedPlace) => void;
  className?: string;
}

/**
 * La frase de cada fase es tradueix aquí i no es llegeix de
 * `progress.message`: el motor de `prepare.ts` no sap l'idioma de la
 * interfície i no l'ha de saber.
 */
const PHASE_KEY: Record<PreparePhase, OfflineStringKey> = {
  inici: 'phase.inici',
  relleu: 'phase.relleu',
  mapa: 'phase.mapa',
  calcul: 'phase.calcul',
  desat: 'phase.desat',
  fet: 'phase.fet',
};

/** Dies sencers transcorreguts. Serveix per avisar de l'esborrat d'iOS. */
function daysSince(ms: number): number {
  return Math.floor((Date.now() - ms) / 86_400_000);
}

export function OfflinePanel({
  location,
  placeLabel,
  locale,
  onPrepared,
  className,
}: OfflinePanelProps) {
  const { online } = useOnlineStatus();
  const inventory = useOfflineInventory();
  const prepare = usePrepare();

  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'ca-ES', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    [locale],
  );

  const lat = location === null ? null : roundCoordinate(location.lat);
  const lon = location === null ? null : roundCoordinate(location.lon);

  // Enumerar les tessel·les és matemàtica pura i barata, però són ~800
  // objectes: no cal refer-ho a cada render.
  const plan = useMemo(
    () => (lat === null || lon === null ? null : planPrepare(lat, lon)),
    [lat, lon],
  );

  const alreadySaved =
    lat === null || lon === null
      ? undefined
      : inventory.places.find(
          (place) => place.lat === lat && place.lon === lon,
        );

  const hint = installHint(locale);
  const progress = prepare.progress;
  const percent = Math.round((progress?.ratio ?? 0) * 100);

  // Quan acaba una preparació, avisem qui ens ha muntat i rellegim l'inventari.
  // El callback va per referència perquè normalment arriba com a funció en
  // línia: posar-lo a les dependències refaria l'efecte a cada render.
  const notify = useRef(onPrepared);
  notify.current = onPrepared;
  const finished = prepare.result?.place ?? null;
  const finishedKey = finished ? `${finished.id}#${finished.savedAtMs}` : null;
  const refresh = inventory.refresh;

  useEffect(() => {
    if (!finished || finishedKey === null) return;
    notify.current?.(finished);
    refresh();
    // `finished` s'ignora a posta: la identitat de l'objecte canvia a cada
    // render, i el que identifica una preparació nova és la clau.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishedKey, refresh]);

  return (
    <section className={className ? `off-panel ${className}` : 'off-panel'}>
      <header className="off-panel__head">
        <h3 className="off-panel__title">{os('panel.title', locale)}</h3>
        <ConnectionBadge locale={locale} />
      </header>

      <p className="off-panel__lede">{os('panel.lede', locale)}</p>

      {plan === null ? (
        <p className="off-note">{os('panel.needPoint', locale)}</p>
      ) : (
        <>
          <dl className="off-figures">
            <div className="off-figures__item">
              <dt className="off-figures__key">{os('figures.point', locale)}</dt>
              {/* Mono només quan hi ha xifres: un topònim en mono no és una
                  dada, és soroll. */}
              <dd
                className={
                  placeLabel ? 'off-figures__val' : 'off-figures__val off-num'
                }
              >
                {placeLabel ?? defaultPlaceLabel(plan.lat, plan.lon)}
              </dd>
            </div>
            <div className="off-figures__item">
              <dt className="off-figures__key">{os('figures.tiles', locale)}</dt>
              <dd className="off-figures__val off-num">{plan.totalTiles}</dd>
            </div>
            <div className="off-figures__item">
              <dt className="off-figures__key">{os('figures.weight', locale)}</dt>
              <dd className="off-figures__val off-num">{formatBytes(plan.estimatedBytes)}</dd>
            </div>
            <div className="off-figures__item">
              <dt className="off-figures__key">{os('figures.range', locale)}</dt>
              <dd className="off-figures__val off-num">{plan.maxRangeKm} km</dd>
            </div>
          </dl>

          {prepare.running ? (
            <div className="off-progress">
              <div
                className="off-progress__track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label={os('progress.label', locale)}
              >
                <div className="off-progress__fill" style={{ width: `${percent}%` }} />
              </div>
              <div className="off-progress__row">
                <span className="off-progress__msg">
                  {os(PHASE_KEY[progress?.phase ?? 'inici'], locale)}
                </span>
                <span className="off-num off-progress__pct">{percent}%</span>
              </div>
              <div className="off-progress__row">
                <span className="off-progress__msg">{os('progress.keepOpen', locale)}</span>
                <span className="off-num off-progress__bytes">
                  {formatBytes(progress?.bytes ?? 0)}
                </span>
              </div>
              <button className="off-btn off-btn--quiet" onClick={prepare.cancel}>
                {os('progress.stop', locale)}
              </button>
            </div>
          ) : (
            <div className="off-actions">
              {/*
                «Si ja està fet» ha de ser una afirmació, no una deducció: el
                canvi d'etiqueta del botó tot sol obligava a comparar la llista
                de sota amb les coordenades del pla per saber si AQUEST punt
                era el preparat. La data i el pes són els de l'inventari, que
                és qui ho sap del cert.
              */}
              {alreadySaved && prepare.result === null && (
                <p className="off-note off-note--ok">
                  {os('note.already', locale, {
                    date: dateFormat.format(new Date(alreadySaved.savedAtMs)),
                    bytes: formatBytes(alreadySaved.bytes),
                  })}
                </p>
              )}
              <button
                className="off-btn off-btn--accent"
                disabled={!online}
                onClick={() =>
                  location &&
                  prepare.start(location, { label: placeLabel })
                }
              >
                {alreadySaved ? os('action.again', locale) : os('action.prepare', locale)}
              </button>
              {!online && (
                <p className="off-note off-note--warn">{os('note.offline', locale)}</p>
              )}
            </div>
          )}

          {/*
            EL MOTIU, TRADUÏT. Abans s'hi interpolava el `message` cru de
            `prepare.ts`, que era català: la frase de fora sortia en castellà i
            el motiu de dins —«Comprova la connexió», l'única part
            accionable— en català. Ara és un codi i el text surt de
            `strings.ts`, com les fases del progrés.
          */}
          {prepare.error && (
            <p className="off-note off-note--danger">
              {prepareFailureText(prepare.error, locale)}
            </p>
          )}

          {prepare.result && (
            <p className="off-note off-note--ok">
              {prepare.result.failedTiles > 0
                ? os('note.doneFailed', locale, {
                    bytes: formatBytes(prepare.result.place.bytes),
                    n: prepare.result.failedTiles,
                  })
                : os('note.done', locale, {
                    bytes: formatBytes(prepare.result.place.bytes),
                  })}
            </p>
          )}
        </>
      )}

      <section className="off-section">
        <h4 className="off-section__title">{os('saved.title', locale)}</h4>

        {inventory.places.length === 0 ? (
          <p className="off-note">
            {inventory.loading ? os('saved.loading', locale) : os('saved.empty', locale)}
          </p>
        ) : (
          <ul className="off-list">
            {inventory.places.map((place) => {
              const age = daysSince(place.savedAtMs);
              return (
                <li className="off-list__item" key={place.id}>
                  <div className="off-list__main">
                    <span className="off-list__label">{place.label}</span>
                    <span className="off-list__meta off-num">
                      {dateFormat.format(new Date(place.savedAtMs))} ·{' '}
                      {formatBytes(place.bytes)} · {place.terrainTiles + place.mapTiles}{' '}
                      {os('saved.tiles', locale)}
                    </span>
                    {place.failedTiles > 0 && (
                      <span className="off-list__warn">
                        {os('saved.holes', locale, { n: place.failedTiles })}
                      </span>
                    )}
                    {hint !== null && age >= 6 && (
                      <span className="off-list__warn">
                        {os('saved.expiry', locale, { n: age })}
                      </span>
                    )}
                  </div>
                  <button
                    className="off-btn off-btn--ghost"
                    onClick={() => void inventory.forget(place.id)}
                    aria-label={os('saved.removeLabel', locale, { label: place.label })}
                  >
                    {os('saved.remove', locale)}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <dl className="off-figures off-figures--compact">
          <div className="off-figures__item">
            <dt className="off-figures__key">{os('figures.terrain', locale)}</dt>
            <dd className="off-figures__val off-num">{inventory.tiles.terrain}</dd>
          </div>
          <div className="off-figures__item">
            <dt className="off-figures__key">{os('figures.basemap', locale)}</dt>
            <dd className="off-figures__val off-num">{inventory.tiles.basemap}</dd>
          </div>
          <div className="off-figures__item">
            <dt className="off-figures__key">{os('figures.used', locale)}</dt>
            <dd className="off-figures__val off-num">
              {inventory.storage.supported ? formatBytes(inventory.storage.usageBytes) : '—'}
            </dd>
          </div>
          <div className="off-figures__item">
            <dt className="off-figures__key">{os('figures.free', locale)}</dt>
            <dd className="off-figures__val off-num">
              {inventory.storage.supported && inventory.storage.quotaBytes > 0
                ? formatBytes(
                    Math.max(0, inventory.storage.quotaBytes - inventory.storage.usageBytes),
                  )
                : '—'}
            </dd>
          </div>
        </dl>

        {(inventory.tiles.terrain > 0 || inventory.tiles.basemap > 0) && (
          <button className="off-btn off-btn--ghost" onClick={() => void inventory.clearTiles()}>
            {os('saved.clear', locale)}
          </button>
        )}
      </section>

      {hint !== null && (
        <section className="off-section">
          <h4 className="off-section__title">{os('install.title', locale)}</h4>
          <p className="off-note">{hint.reason}</p>
          <ol className="off-steps">
            {hint.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      )}

      <details className="off-details">
        <summary className="off-details__summary">{os('limits.title', locale)}</summary>
        <ul className="off-details__list">
          <li>{os('limits.immutable', locale)}</li>
          <li>{os('limits.iosSevenDays', locale)}</li>
          <li>{os('limits.foreground', locale)}</li>
          <li>{os('limits.eviction', locale)}</li>
        </ul>
      </details>
    </section>
  );
}
