/**
 * Un lloc de la llista.
 *
 * Respon quatre preguntes i en aquest ordre, que és l'ordre en què es fan:
 *
 *   1. Quants segons hi veuràs DE VERITAT. És la xifra gran, i al costat hi va
 *      sempre quants n'hi ha en teoria: «1:41 de 1:41» i «0:29 de 1:41» són
 *      dues respostes molt diferents i s'han de poder comparar sense pensar.
 *   2. Què et tapa i a quina distància. Amb la distància, perquè «una carena a
 *      3 km» i «una serralada a 60 km» demanen decisions oposades.
 *   3. Quant hauries de pujar per recuperar-ho, si es pot recuperar.
 *   4. Com s'hi arriba: rumb, distància, cota i coordenades.
 *
 * ELS BADGES NO SÓN DECORACIÓ. `Estimació` vol dir que el número l'ha tret el
 * garbell amb terreny gruixut i pot equivocar-se en desenes de segons.
 * `Vora de la franja` vol dir que el marge umbral és més petit que l'error de
 * les efemèrides i que ningú —ni nosaltres— pot dir honestament si hi haurà
 * totalitat. Amagar-ho seria mentir amb més estil.
 */

import { useState } from 'react';
import { Badge, Button, Card, Stat, type Tone } from '../../ui';
import type { SpotResult } from '../../core/spots/types';
import type { Locale } from '../../i18n';
import {
  bearingPhrase,
  durationText,
  formatClock,
  formatCoords,
  formatDegrees,
  formatDistance,
  formatDuration,
  formatMetres,
  formatPercent,
  mapUrl,
} from './format';
import { sp } from './strings';
import './spots.css';

export interface SpotCardProps {
  spot: SpotResult;
  /** Posició a la llista, començant per 1. */
  rank: number;
  locale: Locale;
  /**
   * Fa que aquest punt passi a ser el de l'app.
   *
   * SENSE AIXÒ LA FITXA ÉS UN CUL-DE-SAC: el cercador et diu que a 14 km al
   * nord-oest hi ha 41 segons més, i l'única manera d'anar-hi era copiar les
   * coordenades i tornar-les a enganxar a la fulla d'ubicació. Amb el botó, el
   * punt es fa teu i totes les pantalles es recalculen —incloent-hi el perfil
   * d'horitzó de veritat, que és més fi que el del cercador.
   */
  onSelect?: (spot: SpotResult) => void;
  className?: string;
}

/**
 * To de la insígnia principal.
 *
 * `cloudy` per al que queda tapat i no `danger`: el sistema reserva el vermell
 * per al perill físic (mirar el Sol sense filtre), i una carena al davant no
 * fa mal a ningú.
 */
function verdictTone(spot: SpotResult): Tone {
  if (spot.centralTotalSec <= 0) return 'cloudy';
  if (spot.centralVisibleSec <= 0) return 'cloudy';
  if (spot.centralVisibleSec >= spot.centralTotalSec - 0.5) return 'clear';
  return 'partial';
}

function verdictLabel(spot: SpotResult, locale: Locale): string {
  if (spot.centralTotalSec <= 0) return sp('card.verdict.none', locale);
  if (spot.centralVisibleSec <= 0) return sp('card.verdict.blocked', locale);
  if (spot.centralVisibleSec >= spot.centralTotalSec - 0.5) return sp('card.verdict.full', locale);
  return sp('card.verdict.partial', locale);
}

/** Què et tapa, a quina distància, i per quant. */
function blockingText(spot: SpotResult, locale: Locale): string {
  const altitude = formatDegrees(spot.horizonAltitudeDeg, locale);
  const distance =
    spot.blockingDistanceKm === null
      ? ''
      : sp('card.at', locale, { distance: formatDistance(spot.blockingDistanceKm, locale) });

  if (spot.clearanceDeg >= 0) {
    return sp('card.blocking', locale, {
      altitude,
      distance,
      clearance: formatDegrees(spot.clearanceDeg, locale),
    });
  }
  return sp('card.blockingEats', locale, {
    altitude,
    distance,
    clearance: formatDegrees(-spot.clearanceDeg, locale),
  });
}

/** Botó de copiar amb confirmació breu. Al camp es prem amb guants i sense mirar. */
function CopyCoords({ lat, lon, locale }: { lat: number; lon: number; locale: Locale }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const text = formatCoords(lat, lon);
    const clipboard = navigator.clipboard;
    if (!clipboard) return;
    void clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button variant="secondary" size="sm" icon="crosshair" onClick={copy}>
      {copied ? sp('card.copied', locale) : sp('card.copy', locale)}
    </Button>
  );
}

export function SpotCard({ spot, rank, locale, onSelect, className }: SpotCardProps) {
  const visible = formatDuration(spot.centralVisibleSec);
  const total = formatDuration(spot.centralTotalSec);
  const perdut = spot.centralLostSec;

  return (
    <Card
      tone="default"
      padding="var(--sp-5)"
      className={['spotcard', `spotcard--${verdictTone(spot)}`, className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <header className="spotcard__head">
        <span
          className="spotcard__rank eclipsi-data"
          aria-label={sp('card.rank', locale, { n: rank })}
        >
          {rank}
        </span>
        <p className="spotcard__where">
          {formatDistance(spot.distanceKm, locale)} {bearingPhrase(spot.bearingDeg, locale)}
          <span className="spotcard__alt"> · {formatMetres(spot.elevation, locale)}</span>
        </p>
        <span className="spotcard__badges">
          <Badge tone={verdictTone(spot)} dot>
            {verdictLabel(spot, locale)}
          </Badge>
        </span>
      </header>

      <div className="spotcard__figures">
        <Stat
          className="spotcard__headline"
          label={sp('card.willSee', locale)}
          value={visible.value}
          unit={visible.unit}
          size="lg"
        />
        <Stat label={sp('card.thereIs', locale)} value={total.value} unit={total.unit} />
        <Stat
          label={sp('card.clearance', locale)}
          value={formatDegrees(spot.clearanceDeg, locale)}
        />
      </div>

      <p className="spotcard__blocking">{blockingText(spot, locale)}</p>

      {perdut > 0.5 && (
        <p className="spotcard__climb">
          {spot.climbToRecoverM === null
            ? sp('card.lostNoClimb', locale, { lost: durationText(perdut) })
            : sp('card.lostClimb', locale, {
                lost: durationText(perdut),
                climb: formatMetres(spot.climbToRecoverM, locale),
              })}
        </p>
      )}

      <dl className="spotcard__meta">
        <div>
          <dt>{sp('card.coords', locale)}</dt>
          <dd className="eclipsi-data">{formatCoords(spot.lat, spot.lon)}</dd>
        </div>
        <div>
          <dt>{sp('card.midCentral', locale)}</dt>
          <dd className="eclipsi-data">{formatClock(spot.midCentralMs, locale)}</dd>
        </div>
        <div>
          <dt>{sp('card.sun', locale)}</dt>
          <dd className="eclipsi-data">
            {formatDegrees(spot.sunAltitudeDeg, locale)} · {Math.round(spot.sunAzimuthDeg)}°
          </dd>
        </div>
      </dl>

      <div className="spotcard__notes">
        {spot.detail === 'sieve' && <Badge tone="cloudy">{sp('card.sieve', locale)}</Badge>}
        {spot.edgeUncertain && (
          <Badge tone="cloudy" dot>
            {sp('card.edge', locale)}
          </Badge>
        )}
        {spot.coverage < 0.999 && (
          <Badge tone="cloudy">
            {sp('card.coverage', locale, { percent: formatPercent(spot.coverage, locale) })}
          </Badge>
        )}
      </div>

      <div className="spotcard__actions">
        {onSelect && (
          <Button variant="secondary" size="sm" icon="map-pin" onClick={() => onSelect(spot)}>
            {sp('card.makeMine', locale)}
          </Button>
        )}
        <CopyCoords lat={spot.lat} lon={spot.lon} locale={locale} />
        <a
          className="spotcard__map"
          href={mapUrl(spot.lat, spot.lon)}
          target="_blank"
          rel="noreferrer"
        >
          {sp('card.openMap', locale)}
        </a>
      </div>
    </Card>
  );
}
