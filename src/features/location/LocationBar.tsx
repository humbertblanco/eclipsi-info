/**
 * La barra d'ubicació: on ets, d'on ha sortit, i quina precisió té.
 *
 * PER QUÈ ÉS PERSISTENT I SURT A TOTES LES PANTALLES. Tot el que diu aquesta
 * app depèn del punt, i el problema que va aparèixer provant-la al mòbil és
 * que es podia estar una estona llarga llegint hores i durades d'un lloc que no
 * era el teu sense que res ho digués. La solució no és un avís que es descarta:
 * és que la resposta a «de quin lloc són aquestes xifres» estigui SEMPRE a la
 * vista, al mateix lloc, a totes les pantalles, i que tocar-la sigui la manera
 * de canviar-la.
 *
 * PER QUÈ ÉS UN BOTÓ I NO UNA ETIQUETA. Perquè la pregunta «de quin lloc són?»
 * i l'acció «doncs canvia'l» són el mateix gest. Separar-les vol dir que
 * l'etiqueta s'ignora i el botó no es troba.
 *
 * ACCENT. La barra va en apagat a posta: és cromatisme d'estructura i surt a
 * les quatre pantalles, i si portés ambre es menjaria l'únic accent que cada
 * pantalla té dret a fer servir per a la seva xifra important. L'única cosa
 * que sí que porta color és l'avís de punt d'exemple, que és un estat d'app
 * —el mateix tractament que ja fa servir `.shell__alert`— i que desapareix tan
 * bon punt l'usuari diu on serà.
 */

import { Badge, Icon, ICON_SM } from '../../ui';
import type { Locale } from '../../i18n';
import { formatCoords } from '../../screens/format';
import { elevationDisagrees, type FixedLocation } from '../../state/location';
import type { LocationErrorCode } from '../../state/useObserver';
import { ORIGIN_KEY, placeTitle } from './origin';
import { ls } from './strings';
import './location.css';

export interface LocationBarProps {
  fix: FixedLocation | null;
  locale: Locale;
  loading: boolean;
  error: LocationErrorCode | null;
  /**
   * Una sola línia, sense metadades ni avís desplegat.
   *
   * És per a la pantalla de la càmera, on el que ha d'ocupar el mòbil és el
   * cel. L'estat és el mateix: només canvia quant n'ensenya.
   */
  compact?: boolean;
  /** Obre la fulla de tria. */
  onOpen: () => void;
}

export function LocationBar({
  fix,
  locale,
  loading,
  error,
  compact = false,
  onOpen,
}: LocationBarProps) {
  const isDefault = fix === null || fix.origin === 'default';

  return (
    <div className={compact ? 'loc loc--compact' : 'loc'}>
      <button type="button" className="loc__bar" onClick={onOpen}>
        <Icon name="map-pin" size={ICON_SM} aria-hidden />
        <span className="loc__where">
          <span className="loc__name">
            {fix === null ? ls('bar.none', locale) : placeTitle(fix)}
          </span>
          <span className="loc__meta">
            {fix === null ? (
              ls('bar.open', locale)
            ) : (
              <>
                <Badge tone="neutral">{ls(ORIGIN_KEY[fix.origin], locale)}</Badge>
                {fix.label !== null && fix.label !== '' && (
                  <span className="loc__coords">
                    {formatCoords(fix.location.lat, fix.location.lon)}
                  </span>
                )}
                <span className="loc__coords">{precisionText(fix, locale)}</span>
              </>
            )}
          </span>
        </span>
        <span className="loc__cta">
          {loading ? ls('sheet.locating', locale) : ls('bar.change', locale)}
        </span>
      </button>

      {/*
        L'avís de punt d'exemple. Va a tota la caixa i no a una vora esquerra,
        que el sistema prohibeix. No es pot descartar: mentre les xifres no
        siguin del teu lloc, dir-ho no és una notificació, és part de la dada.
      */}
      {isDefault && (
        <div className="loc__warn">
          <strong className="loc__warntitle">{ls('placeholder.title', locale)}</strong>
          <span>{ls('placeholder.body', locale)}</span>
        </div>
      )}

      {fix !== null && fix.restored && !isDefault && (
        <p className="loc__note">{ls('restored.note', locale)}</p>
      )}

      {/*
        Discrepància d'altitud. Surt poquíssim (cal que passin de 50 m, molt per
        damunt del soroll normal de ±32 m), i quan surt vol dir que el terreny
        amb què calculem l'horitzó no és el terreny on ets.
      */}
      {fix !== null && elevationDisagrees(fix) && (
        <p className="loc__note">
          {ls('elevation.disagree', locale, {
            gps: Math.round(fix.gpsElevationM ?? 0),
            dem: Math.round(fix.location.elevation),
          })}
        </p>
      )}

      {fix !== null && fix.elevationSource === 'assumed' && (
        <p className="loc__note">{ls('elevation.assumed', locale)}</p>
      )}
      {fix !== null && fix.elevationSource === 'gps' && (
        <p className="loc__note">{ls('elevation.gps', locale)}</p>
      )}

      {error !== null && <p className="loc__note">{ls(`error.${error}`, locale)}</p>}
    </div>
  );
}

/**
 * La precisió, dita amb el número que hi correspon segons d'on ve el punt.
 *
 * Del GPS, la precisió HORITZONTAL declarada pel dispositiu. D'un punt triat,
 * no n'hi ha de pròpia —el punt és exactament on l'has posat— i el que importa
 * llavors és l'altra xifra que decideix el veredicte: l'altitud del model del
 * terreny, que és la que fa servir el perfil d'horitzó.
 */
function precisionText(fix: FixedLocation, locale: Locale): string {
  if (fix.accuracyM !== null) {
    return ls('accuracy.gps', locale, { m: Math.round(fix.accuracyM) });
  }
  if (fix.elevationSource === 'dem') {
    return ls('elevation.dem', locale, { m: Math.round(fix.location.elevation) });
  }
  return '';
}
