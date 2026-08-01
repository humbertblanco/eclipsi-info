/**
 * L'hora actual, però que es mou.
 *
 * PER QUÈ CAL UN HOOK PER A UNA COSA TAN TONTA. `Date.now()` dins d'un
 * `useMemo` es llegeix una vegada i es queda clavat fins que canviï alguna
 * dependència. Quan el que se'n dedueix és «ara pots mirar el Sol sense
 * filtre», clavat vol dir que el rètol s'encén al mig de la totalitat i no
 * s'apaga mai més: després de C3, amb la fotosfera ja tornant, encara autoritza
 * a mirar. El temps no és una dependència que React pugui veure, i per tant ha
 * de ser estat.
 *
 * PER QUÈ EL RELLOTGE MONÒTON I NO `Date.now()` A SEQUES. És el de
 * `core/timer/clock.ts`, i el motiu és seu: `Date.now()` salta quan el
 * dispositiu sincronitza per NTP o canvia de zona, i un salt de dos segons a
 * mig eclipsi mou el compte enrere endavant o enrere. El monòton ancora un cop
 * i només es re-ancora quan val la pena.
 *
 * UNA SOLA INSTÀNCIA per a tota l'app: dos rellotges ancorats en moments
 * diferents donarien dues respostes per al mateix instant, i el dia de
 * l'eclipsi això vol dir dues pantalles amb hores diferents.
 *
 * EL RETORN DE SEGON PLA ES TRACTA A PART. Els navegadors escanyen els
 * temporitzadors de les pestanyes amagades —a mòbil poden aturar-los del tot—,
 * així que en tornar no s'espera al tic següent: es llegeix el rellotge de
 * seguida. Si no, qui bloqueja la pantalla trenta segons i la desbloqueja es
 * troba la interfície dient el que era cert abans de bloquejar-la.
 */

import { useEffect, useState } from 'react';
import { createMonotonicClock } from '../core/timer/clock';

/** El rellotge de l'app. Vegeu «una sola instància» a la capçalera. */
const clock = createMonotonicClock();

/** Llegeix l'hora de l'app sense subscriure-s'hi. Per a càlculs d'un sol tir. */
export function nowMs(): number {
  return clock.now();
}

/**
 * Instant actual en ms UTC, refrescat cada `intervalMs`.
 *
 * Un segon per defecte: les fites de seguretat tenen marges de dotze i quinze
 * segons, i refrescar més sovint només faria renders de més a la pantalla que
 * ja té la càmera oberta i el bucle de dibuix corrent.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(nowMs);

  useEffect(() => {
    const tick = (): void => setNow(clock.now());
    const id = setInterval(tick, intervalMs);

    const onVisible = (): void => {
      if (document.visibilityState !== 'visible') return;
      // Lluny de cap fita el re-ancoratge no es nota, i tornar de segon pla és
      // exactament quan el rellotge monòton pot haver-se separat del de paret.
      clock.resync();
      tick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);

  return now;
}
