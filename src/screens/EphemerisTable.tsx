import { horizonAltitudeAt } from '../core/horizon/profile';
import type { EclipseSample } from '../core/astro/types';
import type { EclipseContext } from './context';
import { s, type StringKey } from './strings';
import { formatClock, formatDegrees } from './format';
import './screens.css';

export interface EphemerisTableProps {
  circumstances: EclipseContext['circumstances'];
  horizon: EclipseContext['horizon'];
  locale: EclipseContext['locale'];
}

/**
 * Taula d'efemèrides del punt de l'usuari.
 *
 * PER QUÈ EXISTEIX I NOMÉS ES VEU A L'ESCRIPTORI: la versió web del sistema
 * (`design-reference/ui_kits/web/HeroSection.jsx`) ensenya els cinc contactes
 * SENCERS, sense cap desplegable al davant, perquè a 1440 px hi ha espai i les
 * xifres són el contingut. A 390 px no hi caben cinc files de tres columnes, i
 * per això al mòbil la mateixa informació la dona `TimelineTrack`, en
 * horitzontal. Qui decideix quina de les dues es pinta és `screens.css`, no
 * aquest fitxer: així no hi ha dues fonts de veritat sobre el punt de tall.
 *
 * LA TERCERA COLUMNA NO ÉS A LA REFERÈNCIA i és el que aquesta app hi afegeix:
 * el marge del Sol sobre el TERRENY en aquell instant. És la diferència entre
 * saber a quina hora passa una cosa i saber si la veuràs. En vermell quan és
 * negatiu, que vol dir que en aquell contacte el Sol és darrere una carena.
 */
export function EphemerisTable({ circumstances, horizon, locale }: EphemerisTableProps) {
  if (circumstances === null) return null;

  const annular = circumstances.kind === 'annular';
  const { c1, c2, max, c3, c4 } = circumstances.contacts;

  const rows: { key: StringKey; sample: EclipseSample | undefined; accent: boolean }[] = [
    { key: 'web.c1', sample: c1, accent: false },
    { key: annular ? 'web.c2annular' : 'web.c2total', sample: c2, accent: true },
    { key: 'web.max', sample: max, accent: false },
    { key: annular ? 'web.c3annular' : 'web.c3total', sample: c3, accent: false },
    { key: 'web.c4', sample: c4, accent: false },
  ];

  return (
    <table className="ephemeris">
      <tbody>
        {rows.map(({ key, sample, accent }) => {
          if (sample === undefined) return null;

          // Marge sobre el terreny. Sense perfil no és zero: no se sap, i la
          // cel·la es queda amb l'altura astronòmica sense veredicte.
          const terrain =
            horizon === null ? null : horizonAltitudeAt(horizon, sample.sun.azimuth);
          const clearance =
            terrain === null ? null : sample.sun.altitudeApparent - terrain;

          return (
            <tr
              key={key}
              className={
                accent ? 'ephemeris__row ephemeris__row--key' : 'ephemeris__row'
              }
            >
              <td className="ephemeris__label">{s(key, locale)}</td>
              <td className="ephemeris__time">{formatClock(sample.time, locale)}</td>
              <td
                className={
                  clearance !== null && clearance < 0
                    ? 'ephemeris__clear ephemeris__clear--lost'
                    : 'ephemeris__clear'
                }
              >
                {clearance === null
                  ? formatDegrees(sample.sun.altitudeApparent)
                  : `${clearance >= 0 ? '+' : ''}${formatDegrees(clearance)}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
