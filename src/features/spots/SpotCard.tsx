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
 * A SOBRE DE TOT, QUAN LA XARXA HO PERMET, EL NOM DEL LLOC. «Coll de la
 * Ventosa» es pot dir per telèfon i buscar al GPS del cotxe; «11 km cap al
 * sud-oest» no. El nom arriba amb mandra i sense blocar res: la targeta surt
 * sencera amb la direcció i la distància —que són la informació robusta i
 * fora de línia del dia de l'eclipsi— i el títol apareix quan el servei
 * respon. Sense xarxa, no apareix i no hi ha cap error.
 *
 * ELS BADGES NO SÓN DECORACIÓ. `Estimació` vol dir que el número l'ha tret el
 * garbell amb terreny gruixut i pot equivocar-se en desenes de segons.
 * `Vora de la franja` vol dir que el marge umbral és més petit que l'error de
 * les efemèrides i que ningú —ni nosaltres— pot dir honestament si hi haurà
 * totalitat. Amagar-ho seria mentir amb més estil.
 */

import { useState } from 'react';
import { track } from '../../core/analytics';
import { Badge, Button, Card, Stat, type Tone } from '../../ui';
import type { SpotResult } from '../../core/spots/types';
import type { Locale } from '../../i18n';
import {
  bearingPhrase,
  durationText,
  formatClock,
  coordsForCopy,
  formatCoords,
  formatDegrees,
  formatDistance,
  formatDuration,
  formatMetres,
  formatPercent,
  mapUrl,
} from './format';
import { buildShareLink, isAbortError } from '../share';
import { sp } from './strings';
import { DEFAULT_SPOT_WEIGHTS } from '../../core/spots/score';
import { useSpotPlaceName } from './useSpotPlaceName';
import './spots.css';

export interface SpotCardProps {
  spot: SpotResult;
  /** Posició a la llista, començant per 1. */
  rank: number;
  locale: Locale;
  /**
   * L'eclipsi del càlcul, per poder compartir el candidat amb enllaç propi:
   * «mira, anem aquí» amb el punt, l'eclipsi i el nom ja posats.
   */
  eclipseId: string;
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
  baselineVisibleSec?: number | null;
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
    const text = coordsForCopy(lat, lon);
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

/**
 * Comparteix el candidat amb enllaç propi. Mateixa escala de gestos que el
 * botó de compartir de la portada: primer el full nadiu, i si no n'hi ha (o
 * l'usuari el tanca sense triar, que no és cap error), el porta-retalls amb
 * la confirmació de dos segons.
 *
 * AQUÍ NOMÉS HI HA DOS ESGLAONS I TOTS DOS SÓN D'ENLLAÇ: aquest camí no dibuixa
 * cap targeta, perquè la simulació del cel es fa des del punt de l'usuari i
 * aquest encara no ho és. Per això els dos esdeveniments que en poden sortir
 * són `native_link` i `clipboard_link` — i és informació, no un descuit: si
 * `surface: spot` pesa a l'informe, la targeta per candidat es guanya el cost.
 */
function ShareSpot({
  lat,
  lon,
  eclipseId,
  label,
  locale,
}: {
  lat: number;
  lon: number;
  eclipseId: string;
  label: string | null;
  locale: Locale;
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}${buildShareLink(
      { lat, lon, eclipseId, label },
    )}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url });
        track('share_done', { surface: 'spot', channel: 'native_link' });
        return;
      } catch (error) {
        if (isAbortError(error)) return;
        // Si el full nadiu falla per una altra cosa, es prova el porta-retalls.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      track('share_done', { surface: 'spot', channel: 'clipboard_link' });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sense porta-retalls (permís negat) no queda cap camí silenciós bo:
      // el botó simplement no confirma, i les coordenades segueixen al costat.
    }
  };

  return (
    <Button variant="secondary" size="sm" icon="share-2" onClick={() => void share()}>
      {copied ? sp('card.linkCopied', locale) : sp('card.share', locale)}
    </Button>
  );
}

export function SpotCard({
  spot,
  rank,
  locale,
  eclipseId,
  onSelect,
  baselineVisibleSec,
  className,
}: SpotCardProps) {
  const visible = formatDuration(spot.centralVisibleSec);
  const total = formatDuration(spot.centralTotalSec);
  const perdut = spot.centralLostSec;

  // El topònim, demanat amb mandra i sense blocar res: la targeta surt sencera
  // amb la direcció, la distància i la cota —que funcionen sense xarxa— i el
  // nom apareix quan arriba. Sense xarxa no apareix i no passa res més.
  const placeLabel = useSpotPlaceName(spot.lat, spot.lon, locale);

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
        {/*
          La identitat del lloc, en dues línies com a molt. Amb nom, el nom fa
          de títol i la direcció baixa a subtítol; sense nom, la direcció es
          queda de títol tal com estava. La direcció no marxa mai: és el que
          es pot seguir amb brúixola quan el nom no ha arribat.
        */}
        <div className="spotcard__id">
          {placeLabel && <p className="spotcard__name">{placeLabel.primary}</p>}
          <p className={placeLabel ? 'spotcard__where spotcard__where--sub' : 'spotcard__where'}>
            {formatDistance(spot.distanceKm, locale)} {bearingPhrase(spot.bearingDeg, locale)}
            <span className="spotcard__alt"> · {formatMetres(spot.elevation, locale)}</span>
          </p>
        </div>
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

      {baselineVisibleSec !== undefined &&
        baselineVisibleSec !== null &&
        spot.centralVisibleSec > baselineVisibleSec + 0.5 && (
          <p className="spotcard__gain">
            {sp('card.gain', locale, {
              duration: durationText(spot.centralVisibleSec - baselineVisibleSec),
            })}
          </p>
        )}

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

      <details className="spotcard__score">
        <summary>
          <span>{sp('card.score', locale)}</span>
          <strong className="eclipsi-data">{Math.round(spot.score)}/100</strong>
        </summary>
        <p>{sp('card.scoreIntro', locale)}</p>
        <div className="spotcard__scoreparts">
          {(
            [
              ['centralSeconds', 'card.scoreSeconds', DEFAULT_SPOT_WEIGHTS.centralSeconds],
              ['clearance', 'card.scoreClearance', DEFAULT_SPOT_WEIGHTS.clearance],
              ['closeness', 'card.scoreDistance', DEFAULT_SPOT_WEIGHTS.closeness],
              ['altitude', 'card.scoreAltitude', DEFAULT_SPOT_WEIGHTS.altitude],
            ] as const
          ).map(([part, label, weight]) => {
            const points = spot.parts[part] * weight * 100;
            return (
              <div key={part}>
                <span>{sp(label, locale)}</span>
                <span className="spotcard__scorebar" aria-hidden="true">
                  <i style={{ width: `${spot.parts[part] * 100}%` }} />
                </span>
                <strong className="eclipsi-data">+{Math.round(points)}</strong>
              </div>
            );
          })}
        </div>
        <p>{sp('card.scoreWeather', locale)}</p>
      </details>

      <div className="spotcard__actions">
        {onSelect && (
          <Button variant="secondary" size="sm" icon="map-pin" onClick={() => onSelect(spot)}>
            {sp('card.makeMine', locale)}
          </Button>
        )}
        <CopyCoords lat={spot.lat} lon={spot.lon} locale={locale} />
        <ShareSpot
          lat={spot.lat}
          lon={spot.lon}
          eclipseId={eclipseId}
          label={placeLabel ? placeLabel.primary : null}
          locale={locale}
        />
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
