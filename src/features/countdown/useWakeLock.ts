/**
 * Manté la pantalla encesa amb la Screen Wake Lock API.
 *
 * PER QUÈ CAL: si la pantalla s'apaga, el navegador congela els temporitzadors
 * de la pestanya. Els avisos deixarien d'arribar puntuals i, en tornar,
 * l'aplicació hauria de descartar-los per caducats (ho fa: vegeu `runner.ts`).
 * O sigui que sense pantalla encesa no hi ha avisos fiables.
 *
 * COMPORTAMENT A iOS — llegiu-ho abans de tocar res:
 *
 *  - Safari implementa la Screen Wake Lock a partir d'iOS 16.4. Per sota (i a
 *    qualsevol navegador de iOS antic, que per força és WebKit) `navigator.
 *    wakeLock` no existeix i no hi ha res a fer des del web: cal dir-li a
 *    l'usuari que desactivi el bloqueig automàtic a Configuració > Pantalla.
 *    És exactament el que fa la interfície quan `supported` és fals.
 *  - El permís es perd cada vegada que la pestanya deixa de ser visible
 *    (canviar d'app, bloquejar el telèfon, obrir el commutador de pestanyes) i
 *    NO es recupera sol. Per això aquí es torna a demanar a cada
 *    `visibilitychange` que ens torna a fer visibles.
 *  - Demanar-lo requereix un document visible: cridar-lo des d'un efecte de
 *    muntatge amb la pestanya amagada rebota amb `NotAllowedError`. Es tracta
 *    com un estat normal, no com un error.
 *  - A iOS instal·lat com a PWA a la pantalla d'inici el comportament és el
 *    mateix que a Safari: el bloqueig no sobreviu a passar a segon pla.
 *  - No es fa servir el truc del vídeo silenciós en bucle: pesa, escalfa el
 *    dispositiu i tampoc no funciona quan l'app passa a segon pla, que és el
 *    cas que preocupa.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Contracte mínim de l'API. Es declara aquí en comptes de dependre que la
 * versió de `lib.dom.d.ts` del projecte porti `WakeLockSentinel`.
 */
interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
  removeEventListener(type: 'release', listener: () => void): void;
}

interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

function getWakeLock(): WakeLockLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as unknown as { wakeLock?: WakeLockLike };
  return nav.wakeLock ?? null;
}

export interface WakeLockState {
  /** Cert si el navegador té l'API. A iOS < 16.4 és fals. */
  supported: boolean;
  /** Cert si ara mateix la pantalla es manté encesa per petició nostra. */
  active: boolean;
  /** Motiu de l'últim fracàs, si n'hi ha hagut. */
  error: string | null;
}

/**
 * @param enabled quan passa a cert es demana el bloqueig; quan passa a fals
 *   s'allibera. Ha d'anar lligat a l'activació dels avisos: mantenir la
 *   pantalla encesa sense necessitat és una manera de buidar la bateria abans
 *   que arribi l'eclipsi.
 */
export function useWakeLock(enabled: boolean): WakeLockState {
  const [state, setState] = useState<WakeLockState>(() => ({
    supported: getWakeLock() !== null,
    active: false,
    error: null,
  }));
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  const release = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    if (!sentinel || sentinel.released) return;
    try {
      await sentinel.release();
    } catch {
      // Alliberar-lo dues vegades llança. No té cap conseqüència.
    }
  }, []);

  useEffect(() => {
    const api = getWakeLock();
    if (!api) {
      setState({ supported: false, active: false, error: null });
      return;
    }

    let cancelled = false;

    const acquire = async (): Promise<void> => {
      if (!enabled || cancelled) return;
      if (sentinelRef.current && !sentinelRef.current.released) return;
      // Amb el document amagat la petició rebota sempre: no val la pena
      // provar-ho i escriure un error que no és cap error.
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

      try {
        const sentinel = await api.request('screen');
        if (cancelled) {
          void sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        const onRelease = (): void => {
          sentinel.removeEventListener('release', onRelease);
          if (!cancelled) setState((s) => ({ ...s, active: false }));
        };
        sentinel.addEventListener('release', onRelease);
        setState({ supported: true, active: true, error: null });
      } catch (error) {
        if (cancelled) return;
        setState({
          supported: true,
          active: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    const onVisibility = (): void => {
      // El sistema ens ha tret el bloqueig en amagar-nos. Tornar-lo a demanar
      // en reaparèixer és l'única manera de mantenir-lo entre canvis d'app.
      if (document.visibilityState === 'visible') void acquire();
    };

    if (enabled) {
      void acquire();
      document.addEventListener('visibilitychange', onVisibility);
    } else {
      void release();
      setState((s) => ({ ...s, active: false }));
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void release();
    };
  }, [enabled, release]);

  return state;
}
