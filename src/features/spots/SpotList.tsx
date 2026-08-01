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

import type { SpotSearchOutcome } from '../../core/spots/types';
import { SpotCard } from './SpotCard';
import { durationText, formatDistance } from './format';
import './spots.css';

export interface SpotListProps {
  outcome: SpotSearchOutcome;
  className?: string;
}

export function SpotList({ outcome, className }: SpotListProps) {
  const { results, radiusKm, candidates, bestCentralSec, centralReachable } = outcome;

  if (results.length === 0) {
    return (
      <p className={['spotlist__empty', className ?? ''].filter(Boolean).join(' ')}>
        Dins de {formatDistance(radiusKm)} no hi ha cap punt des d’on el Sol quedi
        per damunt de l’horitzó durant l’eclipsi. Prova d’eixamplar el radi.
      </p>
    );
  }

  return (
    <div className={['spotlist', className ?? ''].filter(Boolean).join(' ')}>
      <p className="spotlist__context">
        {results.length} {results.length === 1 ? 'lloc' : 'llocs'} de{' '}
        {candidates} punts mirats dins de {formatDistance(radiusKm)}.{' '}
        {centralReachable
          ? `La millor fase central de la zona dura ${durationText(bestCentralSec)}.`
          : 'Dins d’aquest radi no hi arriba la franja de centralitat: la llista ordena per horitzó i per distància, no per segons de totalitat.'}
      </p>

      {outcome.estimatedOnly && (
        <p className="spotlist__estimate">
          Tots aquests números són estimacions del garbell, amb terreny gruixut.
          Es poden equivocar en desenes de segons.
        </p>
      )}

      <ol className="spotlist__items">
        {results.map((spot, index) => (
          <li key={spot.id}>
            <SpotCard spot={spot} rank={index + 1} />
          </li>
        ))}
      </ol>

      <p className="spotlist__caveat">
        El relleu surt d’un model de terra nua: no hi ha arbres, ni edificis, ni
        tanques. Una filera de pollancres a 500 m val 2°. Amb menys de mig grau de
        marge, ves-hi abans i mira-t’ho.
      </p>
    </div>
  );
}
