/**
 * Estat de la connexió.
 *
 * LÍMIT IMPORTANT: `navigator.onLine` només diu si el dispositiu està enganxat
 * a alguna xarxa, no si aquella xarxa arriba enlloc. El 12 d'agost de 2026,
 * amb desenes de milers de persones sota la mateixa antena, el cas típic no
 * serà "sense cobertura" sinó "quatre barretes i res que carrega": el telèfon
 * dirà que està en línia i no ho estarà.
 *
 * Per això NO fem cap sondeig periòdic a la xarxa per comprovar-ho de veritat:
 * gastaria bateria i dades precisament quan les dues coses són crítiques, i el
 * resultat seria igual de poc fiable. La resposta correcta és una altra: que
 * l'app no depengui de la xarxa per a res, i que la interfície digui què té
 * desat en comptes de prometre què podria baixar.
 */

import { useEffect, useState } from 'react';

export interface OnlineStatus {
  /** Cert si el navegador creu que hi ha xarxa. Vegeu l'avís de dalt. */
  online: boolean;
  /** Instant del darrer canvi d'estat, per poder dir "sense xarxa des de…". */
  changedAtMs: number;
}

function readOnline(): boolean {
  // Sense l'API (Node, entorns de prova) assumim que sí: val més intentar
  // baixar i fallar que bloquejar funcions per una suposició.
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function useOnlineStatus(): OnlineStatus {
  const [status, setStatus] = useState<OnlineStatus>(() => ({
    online: readOnline(),
    changedAtMs: Date.now(),
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => {
      const online = readOnline();
      setStatus((previous) =>
        previous.online === online ? previous : { online, changedAtMs: Date.now() },
      );
    };

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    // Tornar a l'app després d'una estona: iOS congela les pestanyes en segon
    // pla i pot no haver disparat cap dels dos esdeveniments mentrestant.
    document.addEventListener('visibilitychange', update);

    update();

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return status;
}
