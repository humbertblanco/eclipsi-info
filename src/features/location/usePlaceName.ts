/**
 * Enganxa el mòdul de topònims amb React.
 *
 * VIU EN UN FITXER A PART I NO DINS DE `PlaceName.tsx` perquè el projecte
 * separa els ganxos dels components (com `usePlaceSearch.ts` i
 * `useCloudOutlook.ts`): un fitxer que exporta les dues coses trenca la
 * recàrrega en calent de Vite i deixa de refrescar la pantalla mentre es toca.
 *
 * DUES COSES QUE SEMBLEN DETALLS I NO HO SÓN:
 *
 * 1. Les coordenades s'ARRODONEIXEN a la cel·la de la memòria cau abans
 *    d'entrar a les dependències de l'efecte. El GPS et fa ballar la posició
 *    uns metres cada segon; sense arrodonir, cada tremolor tornaria a disparar
 *    l'efecte i la memòria cau no serviria de res.
 *
 * 2. Quan el punt canvia i encara no en sabem el nom, el nom d'abans
 *    S'ESBORRA. Deixar-lo mentre carrega el nou sembla més suau i és pitjor:
 *    durant uns segons la pantalla diu que ets en un lloc on ja no ets.
 */

import { useEffect, useRef, useState } from 'react';
import type { GeoLocation } from '../../core/astro/types';
import {
  SUPERSEDED,
  describePlace,
  peekPlaceName,
  reverseGeocodeWhenSettled,
  snapCoordinate,
  type PlaceLabel,
  type PlaceName,
} from '../../core/places';
import type { Locale } from '../../i18n';

export interface UsePlaceNameOptions {
  /** Cert mentre l'usuari encara mou el dit pel mapa: no es demana res. */
  moving?: boolean;
  locale?: Locale;
  /** Es crida amb el nom cada cop que canvia, per desar-lo a l'estat. */
  onResolved?: (label: string | null) => void;
}

export interface PlaceNameState {
  /** Resultat cru, amb distància i comarca. `null` si encara no se sap. */
  place: PlaceName | null;
  /** El mateix, ja redactat. `null` quan no hi ha res a dir. */
  label: PlaceLabel | null;
  /** Cert mentre s'espera resposta. Per a `aria-busy`, no per pintar res. */
  loading: boolean;
}

export function usePlaceName(
  location: GeoLocation | null,
  options: UsePlaceNameOptions = {},
): PlaceNameState {
  const { moving = false, locale = 'ca', onResolved } = options;

  const lat = location ? snapCoordinate(location.lat) : null;
  const lon = location ? snapCoordinate(location.lon) : null;

  const [place, setPlace] = useState<PlaceName | null>(() =>
    lat !== null && lon !== null ? peekPlaceName(lat, lon) : null,
  );
  const [loading, setLoading] = useState(false);

  // La crida de sortida es guarda en una referència perquè canviar-ne la
  // identitat a cada render no torni a disparar la consulta.
  const report = useRef(onResolved);
  report.current = onResolved;

  useEffect(() => {
    if (lat === null || lon === null) {
      setPlace(null);
      setLoading(false);
      return;
    }

    // Ja el sabem: al mateix fotograma i sense tocar la xarxa.
    const known = peekPlaceName(lat, lon);
    if (known) {
      setPlace(known);
      setLoading(false);
      return;
    }

    setPlace(null);

    // Mentre el dit encara es mou no es pregunta res.
    if (moving) return;

    let alive = true;
    const controller = new AbortController();
    setLoading(true);

    void reverseGeocodeWhenSettled(lat, lon, { signal: controller.signal }).then((result) => {
      if (!alive) return;
      // Substituïda per una consulta més nova: no toquem la pantalla, que ja
      // n'hi ha una altra de camí.
      if (result === SUPERSEDED) return;
      setPlace(result);
      setLoading(false);
    });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [lat, lon, moving]);

  // El mòdul de topònims declara els seus idiomes a part per no dependre de
  // React; quan l'app n'afegeixi (anglès, francès), aquesta línia és on es
  // decidirà a quina de les redaccions que hi ha escrites cauen.
  const label = describePlace(place, locale);

  // Avisa qui vulgui desar el nom a l'estat de la ubicació. Va dins d'un
  // efecte i no al cos del render perquè escriure a un estat de fora mentre es
  // renderitza és exactament el que React no deixa fer. La dependència és el
  // TEXT i no l'objecte: `describePlace` en fabrica un de nou a cada render.
  const primaryText = label ? label.primary : null;
  const lastReported = useRef<string | null>(null);
  useEffect(() => {
    if (primaryText === lastReported.current) return;
    lastReported.current = primaryText;
    report.current?.(primaryText);
  }, [primaryText]);

  return { place, label, loading };
}
