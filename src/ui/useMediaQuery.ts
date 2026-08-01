/**
 * Una consulta de mitjans llegida des de JavaScript.
 *
 * PER QUÈ EXISTEIX, SI EL DISSENY EL FA EL CSS. Perquè hi ha una cosa que el
 * CSS no pot tocar: el text que ensenya un `<select>` natiu quan està tancat.
 * El sistema fa servir el desplegable del sistema a posta —al mòbil obre la
 * roda, que es maneja amb el polze i a les fosques molt millor que qualsevol
 * llista pròpia, i ja ve traduïda—, i el preu és que l'etiqueta visible surt de
 * l'`<option>` seleccionada. Amb `max-width` no s'escurça: es retalla, i queda
 * «12.08.20⌄6».
 *
 * O sigui que per fer cabre la capçalera a 390 px cal decidir el TEXT segons
 * l'amplada, i això només es pot fer des d'aquí. Fora d'aquest cas, la mida la
 * mana `screens.css`.
 *
 * Es fa amb `useSyncExternalStore` i no amb estat i un efecte perquè el primer
 * render ja ha de tenir la resposta bona: amb estat, la capçalera es pintaria
 * un fotograma amb l'etiqueta llarga i se la veuria saltar.
 */

import { useCallback, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  const get = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  // El servidor no en té cap: aquesta app no es renderitza al servidor, però
  // `useSyncExternalStore` el demana i mentir-hi seria demanar un salt.
  return useSyncExternalStore(subscribe, get, () => false);
}
