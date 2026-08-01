/**
 * Estat del service worker per a la interfície.
 *
 * `useSyncExternalStore` i no `useState`+`useEffect`: el registre passa fora de
 * React (a `main.tsx`, abans del primer render) i els esdeveniments poden
 * arribar entre el render i l'efecte. Amb el magatzem extern no hi ha finestra
 * on la interfície ensenyi un estat vell.
 */

import { useSyncExternalStore } from 'react';
import {
  getServiceWorkerState,
  subscribeServiceWorker,
  type ServiceWorkerState,
} from './registerServiceWorker';

export function useServiceWorker(): ServiceWorkerState {
  return useSyncExternalStore(
    subscribeServiceWorker,
    getServiceWorkerState,
    // Servidor / prerender: mai hi ha service worker.
    getServiceWorkerState,
  );
}
