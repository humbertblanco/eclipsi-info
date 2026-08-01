/**
 * Pantalla d'offline: què hi ha desat, què falta, i el botó que ho baixa tot.
 *
 * L'ordre de la informació no és casual. Primer l'estat de la connexió i el
 * botó (el que la persona ha vingut a fer), després l'inventari (el que li
 * dona confiança per marxar de casa) i al final l'espai i les limitacions
 * (el que només consulta si alguna cosa no li quadra).
 */

import { useEffect, useMemo, useRef } from 'react';
import type { GeoLocation } from '../core/astro/types';
import { roundCoordinate } from '../core/horizon/cache';
import { ConnectionBadge } from './ConnectionBadge';
import { UpdatePrompt } from './UpdatePrompt';
import { installHint } from './ios';
import { formatBytes, planPrepare } from './plan';
import { defaultPlaceLabel } from './prepare';
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
  /** Es crida quan un punt acaba de quedar preparat. */
  onPrepared?: (place: PreparedPlace) => void;
  className?: string;
}

const dateFormat = new Intl.DateTimeFormat('ca-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Dies sencers transcorreguts. Serveix per avisar de l'esborrat d'iOS. */
function daysSince(ms: number): number {
  return Math.floor((Date.now() - ms) / 86_400_000);
}

export function OfflinePanel({
  location,
  placeLabel,
  onPrepared,
  className,
}: OfflinePanelProps) {
  const { online } = useOnlineStatus();
  const inventory = useOfflineInventory();
  const prepare = usePrepare();

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

  const hint = installHint();
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
      <UpdatePrompt />

      <header className="off-panel__head">
        <h3 className="off-panel__title">Preparar per anar-hi</h3>
        <ConnectionBadge />
      </header>

      <p className="off-panel__lede">
        El dia de l’eclipsi la xarxa mòbil estarà saturada. Baixa ara el
        terreny, el mapa i els càlculs del punt on aniràs: després l’app
        funciona sencera sense connexió.
      </p>

      {plan === null ? (
        <p className="off-note">Tria un punt al mapa o localitza’t per poder preparar-lo.</p>
      ) : (
        <>
          <dl className="off-figures">
            <div className="off-figures__item">
              <dt className="off-figures__key">Punt</dt>
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
              <dt className="off-figures__key">Tessel·les</dt>
              <dd className="off-figures__val off-num">{plan.totalTiles}</dd>
            </div>
            <div className="off-figures__item">
              <dt className="off-figures__key">Pes estimat</dt>
              <dd className="off-figures__val off-num">{formatBytes(plan.estimatedBytes)}</dd>
            </div>
            <div className="off-figures__item">
              <dt className="off-figures__key">Radi del relleu</dt>
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
                aria-label="Progrés de la preparació"
              >
                <div className="off-progress__fill" style={{ width: `${percent}%` }} />
              </div>
              <div className="off-progress__row">
                <span className="off-progress__msg">
                  {progress?.message ?? 'Preparant…'}
                </span>
                <span className="off-num off-progress__pct">{percent}%</span>
              </div>
              <div className="off-progress__row">
                <span className="off-progress__msg">
                  Deixa l’app oberta i la pantalla encesa.
                </span>
                <span className="off-num off-progress__bytes">
                  {formatBytes(progress?.bytes ?? 0)}
                </span>
              </div>
              <button className="off-btn off-btn--quiet" onClick={prepare.cancel}>
                Atura
              </button>
            </div>
          ) : (
            <div className="off-actions">
              <button
                className="off-btn off-btn--accent"
                disabled={!online}
                onClick={() =>
                  location &&
                  prepare.start(location, { label: placeLabel })
                }
              >
                {alreadySaved ? 'Torna a preparar aquest punt' : 'Prepara’m per anar-hi'}
              </button>
              {!online && (
                <p className="off-note off-note--warn">
                  Sense xarxa no es pot baixar res. El que ja tinguis desat
                  segueix disponible.
                </p>
              )}
            </div>
          )}

          {prepare.error && (
            <p className="off-note off-note--danger">
              No s’ha pogut completar la preparació: {prepare.error}
            </p>
          )}

          {prepare.result && (
            <p className="off-note off-note--ok">
              Punt preparat. {formatBytes(prepare.result.place.bytes)} desats
              {prepare.result.failedTiles > 0
                ? `, amb ${prepare.result.failedTiles} tessel·les que no han baixat.`
                : '.'}
            </p>
          )}
        </>
      )}

      <section className="off-section">
        <h4 className="off-section__title">Desat al telèfon</h4>

        {inventory.places.length === 0 ? (
          <p className="off-note">
            {inventory.loading
              ? 'Consultant què hi ha desat…'
              : 'Encara no has preparat cap punt.'}
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
                      tessel·les
                    </span>
                    {place.failedTiles > 0 && (
                      <span className="off-list__warn">
                        {place.failedTiles} tessel·les no baixades: l’horitzó pot
                        tenir forats.
                      </span>
                    )}
                    {hint !== null && age >= 6 && (
                      <span className="off-list__warn">
                        Fa {age} dies que és desat i l’app no està instal·lada:
                        el navegador el pot esborrar.
                      </span>
                    )}
                  </div>
                  <button
                    className="off-btn off-btn--ghost"
                    onClick={() => void inventory.forget(place.id)}
                    aria-label={`Treu ${place.label} de la llista`}
                  >
                    Treu
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <dl className="off-figures off-figures--compact">
          <div className="off-figures__item">
            <dt className="off-figures__key">Relleu desat</dt>
            <dd className="off-figures__val off-num">{inventory.tiles.terrain}</dd>
          </div>
          <div className="off-figures__item">
            <dt className="off-figures__key">Mapa desat</dt>
            <dd className="off-figures__val off-num">{inventory.tiles.basemap}</dd>
          </div>
          <div className="off-figures__item">
            <dt className="off-figures__key">Espai ocupat</dt>
            <dd className="off-figures__val off-num">
              {inventory.storage.supported ? formatBytes(inventory.storage.usageBytes) : '—'}
            </dd>
          </div>
          <div className="off-figures__item">
            <dt className="off-figures__key">Espai disponible</dt>
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
            Allibera l’espai de les tessel·les
          </button>
        )}
      </section>

      {hint !== null && (
        <section className="off-section">
          <h4 className="off-section__title">Instal·la l’app</h4>
          <p className="off-note">{hint.reason}</p>
          <ol className="off-steps">
            {hint.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      )}

      <details className="off-details">
        <summary className="off-details__summary">Què pot fallar</summary>
        <ul className="off-details__list">
          <li>
            El relleu i el mapa es desen tal com són avui. No canvien mai, per
            això es guarden un any sense tornar-los a demanar.
          </li>
          <li>
            A l’iPhone, si l’app no està instal·lada a la pantalla d’inici, el
            sistema pot esborrar tot el que hi ha desat després de set dies
            sense obrir-la.
          </li>
          <li>
            La baixada només avança amb l’app en primer pla: iOS congela les
            pestanyes de fons i no hi ha manera de continuar en segon terme.
          </li>
          <li>
            Si el telèfon va just d’espai, el navegador pot alliberar aquestes
            dades sense avisar. Comprova aquesta pantalla abans de sortir.
          </li>
        </ul>
      </details>
    </section>
  );
}
