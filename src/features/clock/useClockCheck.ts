/**
 * Pregunta l'hora a fora per saber si el rellotge del telèfon va bé.
 *
 * AQUÍ HI HA LA XARXA I NOMÉS AQUÍ. La matemàtica —punt mig, quantització de la
 * capçalera, barra d'error, veredicte— viu a `core/timer/reference.ts`, que no
 * toca ni el DOM ni la xarxa. Aquest fitxer només aconsegueix les tres lectures
 * i les hi passa.
 *
 * PER QUÈ UN `HEAD` I NO UN `GET`. Tres motius que se sumen:
 *
 *  1. No baixa cos. El que ens interessa és una capçalera, i el dia de
 *     l'eclipsi la cel·la estarà saturada: gastar-hi l'`index.html` sencer per
 *     llegir-ne la data seria mal educat amb la xarxa i amb la bateria.
 *  2. La promesa de `fetch` es resol quan arriben les CAPÇALERES. Sense cos, la
 *     lectura del rellotge d'arribada queda enganxada al moment que volem
 *     mesurar i no al final d'una descàrrega.
 *  3. **El service worker no l'intercepta.** Workbox només registra rutes per a
 *     `GET`: una petició `HEAD` se salta el precache i el `navigateFallback` i
 *     va a la xarxa de debò. Això no és un detall d'eficiència, és la
 *     correcció: una resposta servida de la memòria cau porta la capçalera
 *     `Date` de quan es va desar, i comparar-hi el rellotge donaria un
 *     desfasament de dies. Amb `cache: 'no-store'` i un paràmetre irrepetible
 *     a la URL també queda fora de la memòria cau HTTP del navegador.
 *
 * PER QUÈ CONTRA EL MATEIX ORIGEN i no contra un servei d'hora: perquè no fa
 * falta cap permís de CORS per llegir-ne les capçaleres, perquè no afegeix cap
 * tercer que pugui caure o desaparèixer, i perquè l'app no envia res enlloc.
 * Un servidor web qualsevol està sincronitzat per NTP amb molt més marge del
 * que necessitem: aquí busquem segons, no mil·lisegons.
 *
 * PRECISIÓ QUE NO TENIM I NO CAL: aquesta mesura no serveix per corregir cap
 * hora, només per dir a l'usuari que se la miri. Vegeu `ClockDriftNotice`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bestClockOffset,
  clockDriftLevel,
  estimateClockOffset,
  parseHttpDate,
  type ClockDriftLevel,
  type ClockOffset,
} from '../../core/timer';

/**
 * Consultes per comprovació.
 *
 * Tres, i no una: la incertesa la domina l'anada i tornada, que en una xarxa
 * mòbil varia molt d'una petició a l'altra. `bestClockOffset` es queda la més
 * estreta. Tres tampoc no són moltes: són tres capçaleres, sense cos.
 */
const PROBE_COUNT = 3;

/** Per què no s'ha pogut comprovar. Cada motiu té un text diferent a l'usuari. */
export type ClockCheckProblem =
  /** El navegador diu que no hi ha xarxa. */
  | 'offline'
  /** La petició no ha arribat enlloc, o ha tornat un error. */
  | 'failed'
  /** Ha respost, però sense capçalera `Date` llegible. */
  | 'no-date-header';

export interface ClockCheckState {
  /** Què se'n pot dir. `'aligned'` vol dir que el rellotge va prou bé. */
  level: ClockDriftLevel;
  /** La mesura amb la seva barra d'error, o `null` si no n'hi ha cap. */
  offset: ClockOffset | null;
  /** Cert mentre hi ha consultes en marxa. */
  checking: boolean;
  /** Motiu quan `level` és `'unknown'`. `null` en qualsevol altre cas. */
  problem: ClockCheckProblem | null;
  /** Torna a comprovar-ho. Serveix perquè l'usuari validi que ja ho ha arreglat. */
  recheck: () => void;
}

/**
 * L'arrel de l'app. En producció és el subdirectori `/eclipsi/`, en
 * desenvolupament l'arrel; en tots dos casos hi ha alguna cosa que respon.
 */
function probeUrl(): string {
  const url = new URL(import.meta.env.BASE_URL, window.location.href);
  // Irrepetible perquè cap intermediari no la pugui donar de memòria.
  url.searchParams.set('h', `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
  return url.toString();
}

/** Una consulta. `null` si ha respost però sense data llegible. */
async function probeOnce(url: string, signal: AbortSignal): Promise<ClockOffset | null> {
  // Les dues lectures han d'abraçar la petició i res més: cap `await`
  // intermedi, cap càlcul entremig. Tot el que hi hagi al mig és error.
  const sentAtMs = Date.now();
  const response = await fetch(url, { method: 'HEAD', cache: 'no-store', signal });
  const receivedAtMs = Date.now();

  const serverDateMs = parseHttpDate(response.headers.get('Date'));
  if (serverDateMs === null) return null;
  return estimateClockOffset({ sentAtMs, receivedAtMs, serverDateMs });
}

export function useClockCheck(): ClockCheckState {
  const [level, setLevel] = useState<ClockDriftLevel>('unknown');
  const [offset, setOffset] = useState<ClockOffset | null>(null);
  const [problem, setProblem] = useState<ClockCheckProblem | null>(null);
  // Comença a CERT encara que no hi hagi cap petició en marxa: l'efecte que la
  // llança corre després de la primera pintada, i sense això aquella pintada
  // diria «no s'ha pogut comprovar» abans d'haver-ho intentat.
  const [checking, setChecking] = useState(true);

  // Perquè el desmuntatge i una segona comprovació avortin la que hi hagi en
  // marxa: si no, una resposta que arriba tard escriuria damunt d'una de nova.
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      // `navigator.onLine` menteix sovint cap al costat optimista (vegeu
      // `offline/useOnlineStatus`), però quan diu que NO hi ha xarxa acostuma a
      // tenir raó, i estalviar-se tres peticions condemnades val la pena.
      setLevel('unknown');
      setOffset(null);
      setProblem('offline');
      setChecking(false);
      return;
    }

    setChecking(true);
    const url = probeUrl();
    const results: ClockOffset[] = [];
    let responded = false;

    try {
      for (let i = 0; i < PROBE_COUNT; i++) {
        const result = await probeOnce(url, controller.signal);
        responded = true;
        if (result !== null) results.push(result);
      }
    } catch {
      // Xarxa caiguda, petició avortada o resposta d'error: no hi ha mesura.
      // No es distingeix el motiu perquè a l'usuari li diríem el mateix.
    }

    if (controller.signal.aborted) return;
    setChecking(false);

    if (results.length === 0) {
      setLevel('unknown');
      setOffset(null);
      setProblem(responded ? 'no-date-header' : 'failed');
      return;
    }

    const best = bestClockOffset(results);
    setOffset(best);
    setLevel(clockDriftLevel(best));
    setProblem(null);
  }, []);

  useEffect(() => {
    void run();

    // Quan torna la xarxa val la pena tornar-ho a mirar: el cas típic és obrir
    // l'app al camp sense cobertura i recuperar-la més tard.
    const onOnline = () => void run();
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      abortRef.current?.abort();
    };
  }, [run]);

  const recheck = useCallback(() => void run(), [run]);

  return { level, offset, checking, problem, recheck };
}
