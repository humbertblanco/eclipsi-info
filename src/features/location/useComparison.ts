/**
 * El segon lloc.
 *
 * PER QUÈ UN HOOK A PART I NO UN SEGON `useObserver`: el punt de comparació NO
 * és una ubicació de l'usuari. No li ha de canviar el perfil d'horitzó, ni la
 * consulta de núvols, ni la vista de càmera, ni s'ha de quedar com a «últim
 * lloc» en tornar a obrir l'app. És una pregunta —«i si anés allà?»— i s'ha de
 * poder fer i desfer sense moure res de tot això. Muntar-hi un segon observador
 * hauria arrossegat les quatre coses.
 *
 * COST. `computeLocalCircumstances` per al segon punt és una cerca d'arrels amb
 * centenars de crides a efemèrides: unes desenes de mil·lisegons. Es fa un sol
 * cop per punt gràcies al `useMemo`, i només mentre hi ha comparació activa.
 * El perfil del terreny del segon punt NO es calcula (són ~150 tessel·les i
 * 2,6 milions de mostres): la comparació es fa amb les durades teòriques, que
 * és el que decideix on vas, i el relleu es mira un cop hi ets.
 */

import { useCallback, useMemo, useState } from 'react';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import type { LocalCircumstances } from '../../core/astro/types';
import type { RecentPlace } from '../../state/recentPlaces';
import { comparePlaces, type PlaceComparison } from './compare';

export interface ComparisonApi {
  /** El segon lloc, o `null` si no s'està comparant res. */
  other: RecentPlace | null;
  /** Circumstàncies del segon lloc. */
  otherCircumstances: LocalCircumstances | null;
  /** El resultat, quan hi ha els dos costats. */
  result: PlaceComparison | null;
  compareWith: (place: RecentPlace | null) => void;
  clear: () => void;
}

export function useComparison(
  eclipseId: string,
  primary: LocalCircumstances | null,
  primaryLabel: string | null,
): ComparisonApi {
  const [other, setOther] = useState<RecentPlace | null>(null);

  const otherCircumstances = useMemo(() => {
    if (other === null) return null;
    return computeLocalCircumstances(eclipseId, {
      lat: other.lat,
      lon: other.lon,
      elevation: other.elevation,
    });
    // Les dependències són els números i no l'objecte: la mateixa entrada de
    // l'historial es torna a crear a cada escriptura de la llista i, amb
    // l'objecte com a dependència, això refaria el càlcul sense cap canvi.
  }, [eclipseId, other]);

  const result = useMemo(() => {
    if (primary === null || otherCircumstances === null || other === null) return null;
    return comparePlaces(
      { label: primaryLabel, circumstances: primary },
      { label: other.label, circumstances: otherCircumstances },
    );
  }, [primary, primaryLabel, other, otherCircumstances]);

  const clear = useCallback(() => setOther(null), []);

  return { other, otherCircumstances, result, compareWith: setOther, clear };
}
