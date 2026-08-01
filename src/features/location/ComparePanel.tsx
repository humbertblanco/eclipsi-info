/**
 * Dos llocs, un al costat de l'altre.
 *
 * ÉS LA DECISIÓ REAL de qui planifica: no «hi vaig», sinó «hi vaig O hi vaig
 * allà». La xifra que decideix són els segons de fase central, i per això és
 * l'única cosa d'aquest panell que porta l'accent ambre. La distància i la
 * diferència d'hora hi van en apagat: informen, no decideixen.
 *
 * QUAN NO ES POT DECIDIR, ES DIU. `compare.ts` explica per què la diferència
 * entre dos llocs és més fiable que cap de les dues durades per separat (el
 * biaix de les efemèrides és comú i es cancel·la en restar) i també per què
 * deixa de ser-ho arran del límit de la franja, on la durada fa un esglaó.
 * Allà aquest panell no dona un guanyador: diu que no es pot decidir i què cal
 * fer per sortir-ne.
 */

import { Button, Stat } from '../../ui';
import type { Locale } from '../../i18n';
import { formatDuration } from '../../screens/format';
import { ls } from './strings';
import type { PlaceComparison } from './compare';
import './location.css';

export interface ComparePanelProps {
  locale: Locale;
  result: PlaceComparison;
  /** Nom del lloc actiu i del lloc comparat. Null vol dir «sense nom». */
  aLabel: string | null;
  bLabel: string | null;
  /** Fa del segon lloc el lloc actiu. */
  onUseOther: () => void;
  onClear: () => void;
}

export function ComparePanel({
  locale,
  result,
  aLabel,
  bLabel,
  onUseOther,
  onClear,
}: ComparePanelProps) {
  const aName = aLabel ?? ls('compare.here', locale);
  const bName = bLabel ?? ls('compare.other', locale);
  const winner = result.better === 'b' ? bName : aName;

  return (
    <section className="loc-cmp">
      <div className="loc-cmp__row">
        <Stat
          label={aName}
          value={
            result.aCentralSec > 0
              ? formatDuration(result.aCentralSec)
              : ls('compare.noCentral', locale)
          }
        />
        <Stat
          label={bName}
          value={
            result.bCentralSec > 0
              ? formatDuration(result.bCentralSec)
              : ls('compare.noCentral', locale)
          }
        />
      </div>

      <div className="loc-cmp__row">
        {/*
          L'ÚNIC ACCENT del panell. El signe hi va sempre, també el «+»: una
          diferència sense signe obliga a recordar quin costat era quin.
        */}
        <Stat
          label={ls('compare.delta', locale)}
          tone={result.worthMoving ? 'accent' : 'default'}
          value={
            result.decidable
              ? `${result.deltaSec > 0 ? '+' : ''}${Math.round(result.deltaSec)}`
              : '—'
          }
          unit="s"
        />
        <Stat
          label={ls('compare.distance', locale)}
          value={
            result.distanceKm < 10
              ? result.distanceKm.toFixed(1)
              : String(Math.round(result.distanceKm))
          }
          unit="km"
        />
      </div>

      <p className="loc__note">{verdict(result, winner, locale)}</p>

      {/*
        La diferència d'hora del màxim. No decideix res —no es pot ser als dos
        llocs— però és la pregunta que tothom fa en veure dos punts, i la xifra
        la tanca. Només surt quan passa del minut: per sota és soroll de
        geometria i llegir-la faria pensar que es pot arribar a temps.
      */}
      {Math.abs(result.deltaMaxTimeSec) >= 60 && (
        <p className="loc__note">
          {ls('compare.timeGap', locale, {
            sec: Math.abs(Math.round(result.deltaMaxTimeSec)),
            when: ls(
              result.deltaMaxTimeSec > 0 ? 'compare.later' : 'compare.earlier',
              locale,
            ),
          })}
        </p>
      )}

      <div className="loc-cmp__actions">
        <Button variant="ghost" size="sm" onClick={onUseOther}>
          {ls('compare.swap', locale)}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear}>
          {ls('compare.clear', locale)}
        </Button>
      </div>
    </section>
  );
}

/** La frase que resumeix la comparació. Una sola, i sempre n'hi ha una. */
function verdict(result: PlaceComparison, winner: string, locale: Locale): string {
  if (!result.decidable) return ls('compare.edge', locale);
  if (result.changesKind) return ls('compare.kind', locale, { place: winner });
  if (!result.worthMoving) return ls('compare.tie', locale);
  return ls('compare.gain', locale, {
    place: winner,
    sec: Math.abs(Math.round(result.deltaSec)),
  });
}
