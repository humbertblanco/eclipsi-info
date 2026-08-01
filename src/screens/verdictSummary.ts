/**
 * Redacció del veredicte del terreny, en l'idioma actiu.
 *
 * PER QUÈ VIU AQUÍ I NO AL MOTOR: `computeVisibility` tenia un camp `summary`
 * redactat en català per construcció, i les pantalles el pintaven tal qual.
 * Qui tenia l'app en castellà llegia en català justament la conclusió del
 * producte — quants segons de fase central sobreviuen al relleu. El motor ara
 * torna només dades i la frase es munta aquí, amb el diccionari i els formats
 * de la resta de pantalles.
 *
 * De passada, les xifres han deixat d'anar per lliure: el `summary` del motor
 * escrivia «0.52°» amb punt on tota l'app escriu la coma (`formatDecimal`), i
 * «1 min 5 s» on `formatDuration` escriu «1 min 05 s».
 */

import { obscurationPercentValue } from '../core/astro/obscuration';
import type { VisibilityVerdict } from '../core/visibility/verdict';
import type { Locale } from '../i18n';
import { formatDecimal, formatDuration } from './format';
import { s } from './strings';

/** La frase que resumeix el veredicte, llesta per pintar. */
export function verdictSummary(verdict: VisibilityVerdict, locale: Locale): string {
  // Mateixa tria que feia el motor: tot el que no és anular es diu totalitat.
  const annular = verdict.kind === 'annular';

  // El suggeriment de guanyar altura només existeix quan hi ha un obstacle
  // mesurat, i només s'afegeix a les frases on el terreny roba temps: amb la
  // fase central sencera no hi ha res a recuperar.
  const climb =
    verdict.climbToRecoverM !== null && verdict.blockingDistanceKm !== null
      ? ' ' +
        s('verdict.climb', locale, {
          deficit: `${formatDecimal(verdict.altitudeDeficitDeg, 2, locale)}°`,
          climb: formatDecimal(Math.round(verdict.climbToRecoverM), 0, locale),
          km: formatDecimal(verdict.blockingDistanceKm, 1, locale),
        })
      : '';

  // Com a NÚMERO (`obscurationPercentValue`) i no amb `formatObscurationPercent`:
  // el «quasi el 100 %» que aquella funció pot tornar no encaixa dins de
  // «fins a un {pct} %». La regla que importa —fora de fase central mai no
  // s'escriu 100— la garanteix igualment el mateix mòdul, que aquí es queda a 99.
  const pct = obscurationPercentValue(verdict.maxVisibleObscuration, false);

  switch (verdict.status) {
    case 'no-eclipse':
      return s('verdict.noEclipse', locale);
    case 'sun-blocked':
      return s('verdict.sunBlocked', locale) + climb;
    case 'central-blocked':
      return (
        s(
          annular ? 'verdict.centralBlockedAnnular' : 'verdict.centralBlockedTotal',
          locale,
          { total: formatDuration(verdict.centralTotalSec), pct },
        ) + climb
      );
    case 'central-partial':
      return (
        s(
          annular ? 'verdict.centralPartialAnnular' : 'verdict.centralPartialTotal',
          locale,
          {
            total: formatDuration(verdict.centralTotalSec),
            visible: formatDuration(verdict.centralVisibleSec),
            lost: formatDuration(verdict.centralLostSec),
          },
        ) + climb
      );
    case 'central-visible':
      return s(
        annular ? 'verdict.centralVisibleAnnular' : 'verdict.centralVisibleTotal',
        locale,
        { visible: formatDuration(verdict.centralVisibleSec) },
      );
    case 'partial-only':
      return s('verdict.partialOnly', locale, { pct });
  }
}
