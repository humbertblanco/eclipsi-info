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
import './spots.css';

export interface SpotCardProps {
  spot: SpotResult;
  /** Posició a la llista, començant per 1. */
  rank: number;
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

function verdictLabel(spot: SpotResult): string {
  if (spot.centralTotalSec <= 0) return 'Sense fase central';
  if (spot.centralVisibleSec <= 0) return 'Tapat';
  if (spot.centralVisibleSec >= spot.centralTotalSec - 0.5) return 'Sencera';
  return 'A mitges';
}

/** Què et tapa, a quina distància, i per quant. */
function blockingText(spot: SpotResult): string {
  const altura = formatDegrees(spot.horizonAltitudeDeg);
  const distancia =
    spot.blockingDistanceKm === null ? '' : ` a ${formatDistance(spot.blockingDistanceKm)}`;

  if (spot.clearanceDeg >= 0) {
    return `El terreny arriba a ${altura}${distancia}. El Sol hi passa ${formatDegrees(
      spot.clearanceDeg,
    )} per damunt.`;
  }
  return `El terreny arriba a ${altura}${distancia} i se’t menja el Sol per ${formatDegrees(
    -spot.clearanceDeg,
  )}.`;
}

/** Botó de copiar amb confirmació breu. Al camp es prem amb guants i sense mirar. */
function CopyCoords({ lat, lon }: { lat: number; lon: number }) {
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
      {copied ? 'Copiades' : 'Copia les coordenades'}
    </Button>
  );
}

export function SpotCard({ spot, rank, className }: SpotCardProps) {
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
        <span className="spotcard__rank eclipsi-data" aria-label={`Posició ${rank}`}>
          {rank}
        </span>
        <p className="spotcard__where">
          {formatDistance(spot.distanceKm)} {bearingPhrase(spot.bearingDeg)}
          <span className="spotcard__alt"> · {formatMetres(spot.elevation)}</span>
        </p>
        <span className="spotcard__badges">
          <Badge tone={verdictTone(spot)} dot>
            {verdictLabel(spot)}
          </Badge>
        </span>
      </header>

      <div className="spotcard__figures">
        <Stat
          className="spotcard__headline"
          label="Hi veuràs"
          value={visible.value}
          unit={visible.unit}
          size="lg"
        />
        <Stat label="N’hi ha" value={total.value} unit={total.unit} />
        <Stat label="Marge sobre el terreny" value={formatDegrees(spot.clearanceDeg)} />
      </div>

      <p className="spotcard__blocking">{blockingText(spot)}</p>

      {perdut > 0.5 && (
        <p className="spotcard__climb">
          {spot.climbToRecoverM === null
            ? `Se’n perden ${durationText(perdut)} i des d’aquí no es recuperen pujant.`
            : `Se’n perden ${durationText(perdut)}. Pujant ${formatMetres(
                spot.climbToRecoverM,
              )} els recuperaries.`}
        </p>
      )}

      <dl className="spotcard__meta">
        <div>
          <dt>Coordenades</dt>
          <dd className="eclipsi-data">{formatCoords(spot.lat, spot.lon)}</dd>
        </div>
        <div>
          <dt>Mig de la fase central</dt>
          <dd className="eclipsi-data">{formatClock(spot.midCentralMs)}</dd>
        </div>
        <div>
          <dt>Sol</dt>
          <dd className="eclipsi-data">
            {formatDegrees(spot.sunAltitudeDeg)} · {Math.round(spot.sunAzimuthDeg)}°
          </dd>
        </div>
      </dl>

      <div className="spotcard__notes">
        {spot.detail === 'sieve' && (
          <Badge tone="cloudy">Estimació amb terreny gruixut</Badge>
        )}
        {spot.edgeUncertain && (
          <Badge tone="cloudy" dot>
            Vora de la franja
          </Badge>
        )}
        {spot.coverage < 0.999 && (
          <Badge tone="cloudy">
            Relleu incomplet ({formatPercent(spot.coverage)})
          </Badge>
        )}
      </div>

      <div className="spotcard__actions">
        <CopyCoords lat={spot.lat} lon={spot.lon} />
        <a
          className="spotcard__map"
          href={mapUrl(spot.lat, spot.lon)}
          target="_blank"
          rel="noreferrer"
        >
          Obre al mapa
        </a>
      </div>
    </Card>
  );
}
