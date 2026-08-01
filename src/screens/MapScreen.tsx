import { formatObscurationPercent } from '../core/astro/obscuration';
import { useMemo, useState } from 'react';
import {
  Badge,
  Card,
  SegmentedControl,
  Stat,
  VisibilityMeter,
  type Tone,
} from '../ui';
import { EclipseMap } from '../features/map/EclipseMap';
import { useCloudOutlook } from '../features/weather';
import {
  bearingToCardinal,
  computeDurationGradient,
  type DurationGradient,
} from '../core/astro/gradient';
import type { GeoLocation } from '../core/astro/types';
import type { EclipseContext } from './context';
import { s } from './strings';
import {
  formatAge,
  formatDegrees,
  formatDuration,
  NO_DATA,
} from './format';
import './screens.css';

export interface MapScreenProps extends EclipseContext {
  /**
   * Recalcula-ho tot des del punt tocat. Rep només les coordenades: la cota
   * l'ha de resoldre contra el model del terreny qui té l'estat de
   * l'observador, perquè és una operació de xarxa.
   */
  onPickLocation: (lat: number, lon: number) => void;
}

/** Què respon la fitxa de sota del mapa. */
type View = 'band' | 'clouds' | 'move';

/**
 * Pantalla "Mapa".
 *
 * QUÈ CONSERVA DE LA REFERÈNCIA (`design-reference/ui_kits/app/MapScreen.jsx`):
 * cartografia base REAL amb la franja dibuixada a sobre, un control segmentat
 * flotant i una fitxa de vidre a baix amb el veredicte del punt seleccionat.
 *
 * QUÈ CANVIA, I PER QUÈ:
 *
 *  · La referència feia servir el segmentat per commutar CAPES del mapa (ombra
 *    / núvols / durada). `EclipseMap` només dibuixa la franja i afegir-hi capes
 *    és territori de `src/features/map/`, que aquesta tasca no toca. Aquí el
 *    segmentat commuta què respon la FITXA, que és la mateixa pregunta feta
 *    des de l'altre costat: on soc, quin cel hi haurà i em convé moure'm.
 *
 *  · No hi ha camp de cerca de llocs. No tenim geocodificador, i un camp que
 *    accepta un nom de poble i no en sap fer res és pitjor que no tenir-lo. El
 *    gest de triar lloc és tocar el mapa, que sí que funciona i a més funciona
 *    sense xarxa. Les xinxetes de ciutats inventades de la referència tampoc hi
 *    són per la mateixa raó: no tenim base de topònims amb coordenades.
 *
 *  · Un sol accent ambre: és la franja pintada al mapa. Per això cap element
 *    d'aquesta pantalla porta `tone="accent"` ni cap botó `solid`.
 */
export function MapScreen({
  eclipseId,
  locale,
  location,
  placeLabel,
  circumstances,
  verdict,
  onPickLocation,
}: MapScreenProps) {
  const [view, setView] = useState<View>('band');

  const contacts = circumstances?.contacts ?? null;
  const central = circumstances?.kind === 'total' || circumstances?.kind === 'annular';

  const clouds = useCloudOutlook({
    location,
    targetTimeMs: contacts?.max.time.getTime() ?? null,
    sunAzimuthDeg: contacts?.max.sun.azimuth ?? null,
    sunAltitudeDeg: contacts?.max.sun.altitudeApparent ?? null,
  });

  // El gradient són quatre càlculs de circumstàncies locals a un quilòmetre de
  // distància. Val unes desenes de mil·lisegons, però només es demana quan la
  // fitxa el mostra: no té sentit pagar-lo cada cop que algú toca el mapa per
  // mirar una altra cosa.
  const gradient = useMemo(
    () =>
      view === 'move' && location !== null
        ? computeDurationGradient(eclipseId, location)
        : null,
    [view, eclipseId, location],
  );

  const handlePick = (loc: GeoLocation) => onPickLocation(loc.lat, loc.lon);

  return (
    <div className="screen screen--full screen--split screen--flush">
      <div className="screen__col screen__col--main">
        <div className="mapscreen__stage">
          <EclipseMap eclipseId={eclipseId} observer={location} onPickLocation={handlePick} />

          {/* Llegenda pròpia. La d'`EclipseMap` viu sota el llenç i aquí el
              llenç ocupa el marc sencer, així que quedaria fora de vista. */}
          <div className="mapscreen__legend">
            <span className="mapscreen__legenditem">
              <span className="mapscreen__swatch" aria-hidden="true" />
              {s('map.legend.band', locale)}
            </span>
            <span className="mapscreen__legenditem">
              <span
                className="mapscreen__swatch mapscreen__swatch--line"
                aria-hidden="true"
              />
              {s('map.legend.center', locale)}
            </span>
          </div>
        </div>
      </div>

      <div className="screen__col screen__col--side">
        <Card tone="glass" className="mapscreen__sheet">
          <SegmentedControl
            value={view}
            onChange={setView}
            label={s('map.compare', locale)}
            options={[
              { value: 'band', label: s('map.view.band', locale) },
              { value: 'clouds', label: s('map.view.clouds', locale) },
              { value: 'move', label: s('map.view.move', locale) },
            ]}
          />

          {circumstances === null || contacts === null ? (
            <p className="screen__note">{s('map.compareNote', locale)}</p>
          ) : view === 'band' ? (
            <>
              <div className="mapscreen__badges">
                <Badge tone={bandTone(circumstances.edgeUncertain, central)} dot>
                  {circumstances.edgeUncertain
                    ? s('map.edge', locale)
                    : central
                      ? s('map.inBand', locale)
                      : s('map.outOfBand', locale)}
                </Badge>
                <span className="screen__note">
                  {s(`kind.${circumstances.kind}` as 'kind.total', locale)}
                </span>
              </div>

              <div className="mapscreen__stats">
                <Stat
                  label={
                    verdict
                      ? s('home.visibleDuration', locale)
                      : s('home.theoreticalDuration', locale)
                  }
                  value={
                    central
                      ? formatDuration(
                          verdict ? verdict.centralVisibleSec : circumstances.centralDurationSec,
                        )
                      : NO_DATA
                  }
                />
                <Stat
                  label={s('home.obscuration', locale)}
                  // `formatObscurationPercent` i no `formatPercent`: aquest
                  // últim arrodoneix, i un 99,97 % sortia com a «100 %» just al
                  // costat del distintiu «Fora de la franja». És la xifra que
                  // decideix si algú es mou o no, i la que no pot mentir.
                  value={formatObscurationPercent(
                    verdict ? verdict.maxVisibleObscuration : contacts.max.obscuration,
                    circumstances.kind === 'total' || circumstances.kind === 'annular',
                  )}
                />
                <Stat
                  label={s('home.sunAltitude', locale)}
                  value={formatDegrees(contacts.max.sun.altitudeApparent)}
                />
              </div>

              {circumstances.edgeUncertain && (
                <p className="screen__note">{s('map.edgeNote', locale)}</p>
              )}
              {!central && <p className="screen__note">{s('map.noCentral', locale)}</p>}
              <p className="screen__note">{s('map.compareNote', locale)}</p>
            </>
          ) : view === 'clouds' ? (
            <VisibilityMeter
              place={placeLabel ?? s('common.here', locale)}
              value={clouds.outlook ? clouds.outlook.score.score : null}
              state={clouds.outlook ? clouds.outlook.score.band : 'unknown'}
              caption={
                clouds.outlook
                  ? clouds.outlook.caveat
                  : clouds.loading
                    ? s('sky.cloudsLoading', locale)
                    : (clouds.error ?? s('sky.cloudsOffline', locale))
              }
              age={
                clouds.outlook
                  ? formatAge(clouds.nowMs - clouds.outlook.fetchedAtMs)
                  : undefined
              }
            />
          ) : (
            <MoveAdvice gradient={gradient} locale={locale} />
          )}

          <p className="screen__note">{s('map.attribution', locale)}</p>
        </Card>
      </div>
    </div>
  );
}

/** El to de la insígnia de franja. El caire no és ni un sí ni un no. */
function bandTone(edgeUncertain: boolean, central: boolean): Tone {
  if (edgeUncertain) return 'partial';
  return central ? 'clear' : 'cloudy';
}

/**
 * Val la pena moure's?
 *
 * És la pregunta que de veritat es fa qui mira un mapa d'eclipsi, i la resposta
 * canvia brutalment segons on siguis: al mig de la franja, un quilòmetre no et
 * dona ni un segon; a tres quilòmetres del límit, te'n pot donar quinze. Quan
 * el gradient és massa petit per tenir direcció, es diu que no cal moure's en
 * comptes d'inventar-se un rumb.
 */
function MoveAdvice({
  gradient,
  locale,
}: {
  gradient: DurationGradient | null;
  locale: EclipseContext['locale'];
}) {
  if (gradient === null) {
    return <p className="screen__note">{s('map.compareNote', locale)}</p>;
  }

  if (!gradient.worthMoving || gradient.bearingDeg === null) {
    return (
      <>
        <Stat
          label={s('home.theoreticalDuration', locale)}
          value={gradient.centralSec > 0 ? formatDuration(gradient.centralSec) : NO_DATA}
        />
        <p className="screen__note">{s('map.gradientFlat', locale)}</p>
      </>
    );
  }

  return (
    <>
      <div className="mapscreen__stats">
        <Stat
          label={s('home.theoreticalDuration', locale)}
          value={formatDuration(gradient.centralSec)}
        />
        <Stat
          label={s('map.view.move', locale)}
          value={`+${gradient.secondsPerKm.toFixed(1)}`}
          unit="s/km"
        />
      </div>
      <p className="screen__note">
        {s('map.gradientMove', locale, {
          dir: bearingToCardinal(gradient.bearingDeg, locale),
          rate: gradient.secondsPerKm.toFixed(1),
        })}
      </p>
      {gradient.approxKmToBest !== null && gradient.approxBestSec !== null && (
        <p className="screen__note">
          {s('map.gradientBest', locale, {
            km: Math.round(gradient.approxKmToBest),
            best: formatDuration(gradient.approxBestSec),
          })}
        </p>
      )}
    </>
  );
}
