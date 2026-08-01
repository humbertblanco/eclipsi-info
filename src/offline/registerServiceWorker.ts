/**
 * Registre del service worker i estat de les actualitzacions.
 *
 * Un petit magatzem observable en comptes d'un hook: el registre s'ha de fer
 * una sola vegada a l'arrencada (des de `main.tsx`), abans que React munti res,
 * i qualsevol component que ho vulgui ensenyar s'hi subscriu després.
 *
 * PER QUÈ NO ACTUALITZEM SOLS: quan un service worker nou pren el control, la
 * pàgina es recarrega. Durant la totalitat del 12-08-2026 hi ha dos minuts
 * escassos i irrepetibles; una recàrrega en aquell instant és inacceptable.
 * Amb `registerType: 'prompt'` la versió nova espera i l'usuari decideix.
 */

import { registerSW } from 'virtual:pwa-register';

export interface ServiceWorkerState {
  /** Cert quan l'esquelet ja és desat i l'app s'obrirà sense connexió. */
  offlineReady: boolean;
  /** Cert quan hi ha una versió nova esperant que l'usuari l'accepti. */
  needRefresh: boolean;
  /** Cert si el navegador admet service workers i n'hem registrat un. */
  registered: boolean;
}

let state: ServiceWorkerState = {
  offlineReady: false,
  needRefresh: false,
  registered: false,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<ServiceWorkerState>): void {
  // Objecte nou a cada canvi: `useSyncExternalStore` compara per identitat.
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let started = false;

/**
 * Registra el service worker. Idempotent: cridar-la dues vegades no fa res
 * (StrictMode munta els efectes per duplicat en desenvolupament).
 */
export function initServiceWorker(): void {
  if (started) return;
  started = true;

  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  updateSW = registerSW({
    immediate: true,
    onOfflineReady() {
      setState({ offlineReady: true, registered: true });
    },
    onNeedRefresh() {
      setState({ needRefresh: true, registered: true });
    },
    onRegisteredSW() {
      setState({ registered: true });
    },
    onRegisterError() {
      // Sense service worker l'app segueix funcionant amb xarxa. No hi ha res
      // que l'usuari pugui fer amb aquest error, així que no l'hi ensenyem.
      setState({ registered: false });
    },
  });
}

export function getServiceWorkerState(): ServiceWorkerState {
  return state;
}

export function subscribeServiceWorker(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Aplica la versió nova: el service worker que espera pren el control i la
 * pàgina es recarrega. Només s'ha de cridar des d'una acció explícita.
 */
export async function applyUpdate(): Promise<void> {
  if (!updateSW) return;
  await updateSW(true);
  setState({ needRefresh: false });
}

/** Amaga l'avís d'actualització fins a la propera obertura. */
export function dismissUpdate(): void {
  setState({ needRefresh: false });
}
