/**
 * El topònim d'un lloc candidat, demanat amb mandra.
 *
 * EL PROBLEMA QUE RESOL. Una targeta que diu «11 km cap al sud-oest · 435 m»
 * és exacta i no es pot explicar per telèfon ni buscar al GPS del cotxe. El
 * nom del lloc és el que converteix un punt del mapa en un lloc on quedar.
 *
 * CALCA EL CAMÍ DE `features/location/usePlaceName.ts` sobre el mateix motor
 * (`src/core/places/`): primer la memòria cau síncrona, després la xarxa, i
 * el resultat redactat per `describePlace`. Amb una diferència deliberada:
 *
 * AQUÍ ES CRIDA `reverseGeocode` I NO `reverseGeocodeWhenSettled`. La variant
 * «settled» comparteix UN SOL antirebot al resolutor de l'app: està pensada
 * per a un únic punt que es mou (el mapa sota el dit). Vuit targetes
 * cridant-la al mateix fotograma s'anul·larien les unes a les altres i només
 * l'última rebria nom. Les coordenades d'un resultat són definitives —el cas
 * que la documentació del resolutor reserva per a `resolve`— i la cortesia
 * amb el servei ja la posen la cua (una petició per segon), la memòria cau i
 * la deduplicació de peticions en vol.
 *
 * EL NOM ÉS UN EXTRA I ES NOTA EN COM ESTÀ FET:
 *  · La targeta surt sencera amb el que ja té: direcció, distància i cota són
 *    la informació robusta i FORA DE LÍNIA que funciona el dia de l'eclipsi.
 *  · Si el nom arriba, apareix. Si no hi ha xarxa, no apareix res i no hi ha
 *    cap error: el resolutor mai no rebutja per culpa de la xarxa.
 */

import { useEffect, useState } from 'react';
import {
  describePlace,
  peekPlaceName,
  reverseGeocode,
  snapCoordinate,
  type PlaceLabel,
  type PlaceName,
} from '../../core/places';
import type { Locale } from '../../i18n';

/**
 * Nom del lloc més proper a unes coordenades fixes, o `null` mentre no se sap.
 *
 * No exposa cap estat de càrrega a posta: no hi ha res a pintar mentre
 * s'espera, perquè la targeta ja diu tot el que sap sense el nom.
 */
export function useSpotPlaceName(lat: number, lon: number, locale: Locale): PlaceLabel | null {
  // S'arrodoneix a la cel·la de la memòria cau ABANS d'entrar a les
  // dependències de l'efecte: així dos candidats de la mateixa cel·la
  // comparteixen consulta i el mateix punt no es demana mai dues vegades.
  const lat0 = snapCoordinate(lat);
  const lon0 = snapCoordinate(lon);

  const [place, setPlace] = useState<PlaceName | null>(() => peekPlaceName(lat0, lon0));

  useEffect(() => {
    // Ja el sabem: al mateix fotograma i sense tocar la xarxa.
    const known = peekPlaceName(lat0, lon0);
    if (known) {
      setPlace(known);
      return;
    }

    // El punt ha canviat i el nom d'abans ja no és d'aquest lloc.
    setPlace(null);

    let alive = true;
    const controller = new AbortController();

    void reverseGeocode(lat0, lon0, { signal: controller.signal }).then((result) => {
      // `null` vol dir «no ho sabem» (sense xarxa, avortat): es deixa la
      // targeta tal com estava, que ja és una resposta completa.
      if (!alive || result === null) return;
      setPlace(result);
    });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [lat0, lon0]);

  // La redacció («Cervera», «a 4 km de Cervera», la comarca sola) la decideix
  // el motor, que és qui sap què és veritat a cada distància.
  return describePlace(place, locale);
}
