/**
 * Avís de deriva del rellotge del telèfon.
 *
 * QUÈ FA I QUÈ NO FA. Informa i prou. No corregeix cap hora, no desplaça cap
 * contacte i no toca la comporta de seguretat ocular: tots els càlculs i tots
 * els avisos de veu segueixen sortint del rellotge del sistema, exactament com
 * abans. Corregir-los sols voldria dir canviar en silenci el comportament del
 * compte enrere a partir d'una mesura amb ±0,7 s d'error, i ningú no ho ha
 * demanat. El que sí que es pot fer honestament és dir-li a l'usuari que el seu
 * rellotge va malament i on s'arregla.
 *
 * QUAN SURT. Només quan aporta alguna cosa, i són tres casos:
 *
 *  - Desfasament DEMOSTRAT per damunt del llindar (`CLOCK_DRIFT_ALERT_MS`, 5 s,
 *    raonat a `core/timer/reference.ts`): avís sencer, amb la xifra, el motiu i
 *    què s'ha de fer.
 *  - No s'ha pogut comprovar, o la mesura no és concloent: una línia discreta.
 *    Callar aquí seria dir «el rellotge va bé», que és una altra afirmació i no
 *    la tenim. Amb els avisos de seguretat jugant-se cinc segons de marge, la
 *    diferència entre «comprovat» i «no comprovat» s'ha de poder veure.
 *  - Rellotge comprovat i correcte: NO SURT RES. Un component permanent que
 *    digui «tot bé» és soroll, i aquesta pantalla té una xifra que ha de manar.
 *
 * PER QUÈ EL NIVELL ÉS `info` I NO `warning`. El groc de `warning` és
 * `--status-partial`, que és el mateix hexadecimal que `--accent`, i ESTAT.md §5
 * fixa un sol ambre per pantalla: aquí ja el té la durada visible, que és la
 * xifra que decideix. I el vermell és de la comporta ocular i no s'ha de diluir
 * amb res que no sigui «no miris el Sol». El pes de l'avís no el porta el color:
 * el porta el títol, que diu un número concret i no una advertència vaga.
 */

import { Button, SafetyNotice } from '../../ui';
import type { Locale } from '../../i18n';
import { useClockCheck } from './useClockCheck';
import { cs } from './strings';
import './clock.css';

export interface ClockDriftNoticeProps {
  locale: Locale;
  className?: string;
}

/**
 * Segons amb un decimal i coma decimal.
 *
 * Local i no importat de `screens/format`: una vista no ha de dependre d'una
 * pantalla. És la mateixa recepta —`Intl` i mai `toFixed`— pel mateix motiu que
 * hi ha escrit allà: `toFixed` escriu el punt anglosaxó, i en castellà el punt
 * és el separador de milers.
 */
function seconds(ms: number, locale: Locale, digits = 1): string {
  return new Intl.NumberFormat(locale === 'ca' ? 'ca-ES' : 'es-ES', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ms / 1000);
}

export function ClockDriftNotice({ locale, className }: ClockDriftNoticeProps) {
  const { level, offset, checking, problem, recheck } = useClockCheck();

  // Mentre es fa la primera comprovació no es pinta res: un rètol que apareix i
  // desapareix sol en dos segons només fa mirar cap on no toca.
  if (level === 'aligned' || (checking && offset === null && problem === null)) return null;

  const classes = ['clockcheck', className ?? ''].filter(Boolean).join(' ');
  const noteClasses = ['clockcheck__note', className ?? ''].filter(Boolean).join(' ');

  if (level === 'off' && offset?.known) {
    const behind = offset.offsetMs < 0;
    return (
      <div className={classes}>
        <SafetyNotice
          level="info"
          icon="clock"
          title={cs(behind ? 'drift.behind' : 'drift.ahead', locale, {
            sec: seconds(Math.abs(offset.offsetMs), locale, 0),
          })}
        >
          <span className="clockcheck__lines">
            <span>{cs(behind ? 'drift.whyLate' : 'drift.whyEarly', locale)}</span>
            <span>{cs('drift.fix', locale)}</span>
            {/* D'on surt la xifra, amb la barra d'error al costat: la mateixa
                regla que les `origin.*` del selector de lloc. */}
            <span className="clockcheck__origin">
              {cs('drift.measure', locale, {
                sec: seconds(Math.abs(offset.offsetMs), locale),
                err: seconds(offset.uncertaintyMs, locale),
              })}
            </span>
          </span>
        </SafetyNotice>
        <Button size="sm" variant="ghost" onClick={recheck} disabled={checking}>
          {cs(checking ? 'drift.rechecking' : 'drift.recheck', locale)}
        </Button>
      </div>
    );
  }

  // No concloent: hi ha mesura, però la barra d'error trepitja el llindar i
  // ensenyar-ne el número central seria inventar precisió.
  if (level === 'inconclusive' && offset?.known) {
    return (
      <p className={noteClasses}>
        {cs('unchecked.inconclusive', locale, { err: seconds(offset.uncertaintyMs, locale) })}
      </p>
    );
  }

  return (
    <p className={noteClasses}>
      {cs(problem === 'offline' ? 'unchecked.offline' : 'unchecked.failed', locale)}
    </p>
  );
}
