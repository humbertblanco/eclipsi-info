/**
 * La llista de llocs.
 *
 * Abans de cap targeta hi ha el context, perquè sense ell les xifres enganyen:
 * si dins del radi no hi arriba la franja de centralitat, la llista segueix
 * existint però ja no ordena segons de totalitat, i això s'ha de dir en primera
 * línia i no en una nota al peu.
 *
 * Al final hi ha l'única cosa que el motor no pot saber: el model del terreny
 * és de TERRA NUA. No hi ha arbres, ni cases, ni la tanca del càmping. Un lloc
 * amb dues dècimes de marge és, a la pràctica, un lloc sense marge.
 */

import { PLACES_ATTRIBUTION } from '../../core/places';
import type { SpotResult, SpotSearchOutcome } from '../../core/spots/types';
import type { Locale } from '../../i18n';
import { SpotCard } from './SpotCard';
import { durationText, formatDistance } from './format';
import { sp } from './strings';
import './spots.css';

export interface SpotListProps {
  outcome: SpotSearchOutcome;
  locale: Locale;
  /** L'eclipsi del càlcul: cada targeta el necessita per compartir-se. */
  eclipseId: string;
  /** Es passa avall a cada targeta: fer d'un resultat el punt de l'app. */
  onSelect?: (spot: SpotResult) => void;
  className?: string;
}

export function SpotList({ outcome, locale, eclipseId, onSelect, className }: SpotListProps) {
  const { results, radiusKm, candidates, bestCentralSec, centralReachable } = outcome;

  if (results.length === 0) {
    return (
      <p className={['spotlist__empty', className ?? ''].filter(Boolean).join(' ')}>
        {sp('list.empty', locale, { radius: formatDistance(radiusKm, locale) })}
      </p>
    );
  }

  return (
    <div className={['spotlist', className ?? ''].filter(Boolean).join(' ')}>
      <p className="spotlist__context">
        {sp(results.length === 1 ? 'list.contextOne' : 'list.contextMany', locale, {
          n: results.length,
          candidates,
          radius: formatDistance(radiusKm, locale),
        })}{' '}
        {centralReachable
          ? sp('list.best', locale, { duration: durationText(bestCentralSec) })
          : sp('list.noCentral', locale)}
      </p>

      {outcome.estimatedOnly && (
        <p className="spotlist__estimate">{sp('list.estimate', locale)}</p>
      )}

      <ol className="spotlist__items">
        {results.map((spot, index) => (
          <li key={spot.id}>
            <SpotCard
              spot={spot}
              rank={index + 1}
              locale={locale}
              eclipseId={eclipseId}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ol>

      <p className="spotlist__caveat">{sp('list.caveat', locale)}</p>

      {/*
        L'atribució del servei de topònims. No és decoració: la llicència de
        les dades l'exigeix allà on es faci servir, igual que la
        d'OpenStreetMap al mapa i la de Fred Espenak a les efemèrides. Va una
        sola vegada al peu de la llista i no sota de cada targeta.
      */}
      <p className="spotlist__source">{PLACES_ATTRIBUTION}</p>
    </div>
  );
}
