/**
 * Reproductor d'una programació d'avisos, amb correcció de deriva.
 *
 * PER QUÈ NO S'ENCADENEN `setTimeout`. La manera evident de fer això és
 * programar el següent avís amb el temps que falta des de l'anterior:
 *
 *     setTimeout(() => { dir(a[i]); setTimeout(..., a[i+1].t − a[i].t) }, ...)
 *
 * i és exactament la manera de fallar. `setTimeout` no és puntual: el
 * navegador el serveix tard (4 ms de mínim per especificació quan hi ha
 * imbricació, molt més si el fil principal està ocupat pintant el mapa, i fins
 * a un minut o més si la pestanya passa a segon pla). Encadenant, cada retard
 * s'afegeix al següent: un compte enrere de tres hores acumula segons. Els
 * avisos de C3 arribarien tard. Tard, aquí, vol dir amb el Sol ja a fora.
 *
 * COM ES RESOL:
 *
 *  1. Cada avís té un INSTANT ABSOLUT a l'escala UTC. No hi ha durades
 *     relatives enlloc.
 *  2. Cada vegada que es rearma el temporitzador, el retard es torna a calcular
 *     com `objectiu − rellotge.now()`. Un error en un despertar no es propaga:
 *     el següent càlcul ja el compensa. L'error no s'acumula mai, per llarga
 *     que sigui la sessió.
 *  3. El rellotge és el monòton de `clock.ts`, immune als salts de NTP.
 *  4. El temporitzador es programa una mica ABANS de l'objectiu i, en
 *     despertar, si encara no hi som es rearma amb el que queda. Són dos o tres
 *     viatges de més i deixa l'error final en pocs mil·lisegons, en comptes dels
 *     4-15 ms de retard sistemàtic d'un `setTimeout` servit tard.
 *  5. Hi ha un batec màxim: encara que la propera fita sigui d'aquí a una hora,
 *     el bucle es desperta cada segon. Serveix per refrescar la pantalla, per
 *     detectar que el sistema ens ha congelat i per re-ancorar el rellotge quan
 *     som lluny de qualsevol fita.
 *  6. En cada despertar es revisa TOTA la llista, no només el següent avís. Si
 *     el sistema ens ha tingut congelats trenta segons, en tornar hi pot haver
 *     tres avisos vençuts: els que encara són certs (dins de `validForMs`)
 *     s'emeten, els que ja no ho són es descarten i s'informa. Aquesta és la
 *     part que impedeix que en despertar es digui «ja et pots treure el filtre»
 *     quan el Sol ja ha tornat.
 *
 * Sense DOM. Els temporitzadors s'injecten i per defecte fa servir els globals,
 * que existeixen igual a Node, al navegador i als Workers.
 */

import type { MonotonicClock } from './clock';
import { createMonotonicClock } from './clock';
import type { VoiceAlert } from './types';

/** Handle opac d'un temporitzador. Opac a propòsit: Node i el navegador no coincideixen. */
export type TimerHandle = unknown;

export interface TimerFns {
  setTimer: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer: (handle: TimerHandle) => void;
}

/** Per què no s'ha emès un avís. */
export type SkipReason =
  /** Ja havia caducat quan hem pogut mirar-lo (pestanya congelada, per exemple). */
  | 'expired'
  /** Ja havia passat abans d'arrencar el reproductor. */
  | 'already-past';

export interface AlertEvent {
  alert: VoiceAlert;
  /** Retard real respecte de l'instant previst, en ms. Pot ser negatiu. */
  lateByMs: number;
  /** Instant en què s'ha emès, a l'escala del rellotge monòton. */
  atMs: number;
}

export interface RunnerOptions {
  alerts: readonly VoiceAlert[];
  /** S'invoca quan un avís s'ha de dir. */
  onAlert: (event: AlertEvent) => void;
  /** S'invoca quan un avís es descarta. Serveix per ensenyar-ho i per depurar. */
  onSkip?: (alert: VoiceAlert, reason: SkipReason) => void;
  /** Batec: s'invoca a cada despertar amb l'instant actual. Refresca la pantalla. */
  onTick?: (nowMs: number) => void;
  clock?: MonotonicClock;
  timers?: TimerFns;
  /** Període màxim entre despertars, en ms. Per defecte 1000. */
  heartbeatMs?: number;
  /**
   * Marge, en ms, amb què es considera que un avís «ja toca».
   * Emetre 8 ms abans d'hora no és cap problema; esperar un altre viatge de
   * temporitzador per 8 ms, sí.
   */
  fireToleranceMs?: number;
  /**
   * Si és cert, els avisos que ja havien passat quan s'arrenca es descarten en
   * silenci en comptes d'emetre'ls encara que siguin dins de la seva finestra.
   * Per defecte és fals: si obres l'app dos segons després de C2, vols sentir
   * l'avís.
   */
  skipPastOnStart?: boolean;
}

export interface AlertRunner {
  start(): void;
  stop(): void;
  /**
   * Revisa la llista ara mateix i rearma. S'ha de cridar en tornar de segon
   * pla: el temporitzador pendent pot haver quedat congelat.
   */
  poll(): void;
  /** Instant actual segons el rellotge del reproductor. */
  now(): number;
  /** Identificadors dels avisos ja resolts (emesos o descartats). */
  resolvedIds(): ReadonlySet<string>;
  running(): boolean;
}

const DEFAULT_HEARTBEAT_MS = 1000;
const DEFAULT_FIRE_TOLERANCE_MS = 15;
/**
 * Quant abans de l'objectiu es demana el despertar. Absorbeix el retard típic
 * del temporitzador sense fer voltes en va: en despertar es comprova si encara
 * falta i, si falta, es rearma amb el que queda.
 */
const EARLY_WAKE_MS = 25;
/**
 * Distància mínima a la propera fita per permetre re-ancorar el rellotge.
 * Re-ancorar mou el temps: no es fa mai a prop d'un avís.
 */
const RESYNC_GUARD_MS = 60_000;

const defaultTimers: TimerFns = {
  setTimer: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimer: (handle) => {
    if (handle !== undefined && handle !== null) {
      globalThis.clearTimeout(handle as Parameters<typeof clearTimeout>[0]);
    }
  },
};

export function createAlertRunner(options: RunnerOptions): AlertRunner {
  const clock = options.clock ?? createMonotonicClock();
  const timers = options.timers ?? defaultTimers;
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  const fireToleranceMs = options.fireToleranceMs ?? DEFAULT_FIRE_TOLERANCE_MS;

  // Còpia ordenada pròpia: el reproductor no ha de dependre que qui li passa la
  // llista l'hagi ordenat, i no ha de mutar-la.
  const alerts = [...options.alerts].sort((a, b) => a.atMs - b.atMs);
  const resolved = new Set<string>();

  let handle: TimerHandle;
  let active = false;
  let started = false;

  function clearPending(): void {
    if (handle !== undefined) {
      timers.clearTimer(handle);
      handle = undefined;
    }
  }

  /** Instant del proper avís pendent, o `undefined` si no en queda cap. */
  function nextPendingAt(): number | undefined {
    for (const alert of alerts) {
      if (!resolved.has(alert.id)) return alert.atMs;
    }
    return undefined;
  }

  /**
   * Emet o descarta tot el que ja toca. Recorre tota la llista perquè després
   * d'una congelació poden haver vençut diversos avisos alhora.
   */
  function drain(nowMs: number): void {
    for (const alert of alerts) {
      if (resolved.has(alert.id)) continue;
      if (nowMs + fireToleranceMs < alert.atMs) break; // la llista està ordenada

      const lateByMs = nowMs - alert.atMs;
      resolved.add(alert.id);

      if (lateByMs > alert.validForMs) {
        // Ja no és cert. Callar és la resposta correcta: un avís de temps dit
        // fora de la seva finestra desinforma justament quan no toca.
        options.onSkip?.(alert, started ? 'expired' : 'already-past');
        continue;
      }
      if (!started && options.skipPastOnStart && lateByMs > 0) {
        options.onSkip?.(alert, 'already-past');
        continue;
      }
      options.onAlert({ alert, lateByMs, atMs: nowMs });
    }
  }

  function arm(): void {
    clearPending();
    if (!active) return;

    const nowMs = clock.now();
    const nextAt = nextPendingAt();

    // Re-ancorar només lluny de qualsevol fita: un salt de mig segon a mig
    // compte enrere de totalitat és pitjor que la deriva que corregeix.
    if (nextAt === undefined || nextAt - nowMs > RESYNC_GUARD_MS) clock.resync();

    if (nextAt === undefined) {
      // No queda res per dir, però el batec continua mentre el reproductor
      // estigui actiu: la pantalla segueix comptant fins al final de l'eclipsi.
      handle = timers.setTimer(tick, heartbeatMs);
      return;
    }

    // AQUÍ ÉS ON NO S'ACUMULA LA DERIVA: el retard es recalcula sempre com a
    // diferència respecte de l'instant absolut, mai sumant intervals.
    const untilNext = nextAt - nowMs;

    // A prop de l'objectiu s'apunta a l'instant exacte; lluny, una mica abans,
    // per absorbir el retard del temporitzador amb un segon despertar. El
    // llindar és el doble del marge: si es restés el marge també a prop, el
    // despertar cauria sempre just abans de l'objectiu, no arribaria a la
    // finestra d'emissió i el bucle es rearmaria amb retard zero indefinidament.
    const delay =
      untilNext > EARLY_WAKE_MS * 2
        ? Math.min(heartbeatMs, untilNext - EARLY_WAKE_MS)
        : Math.max(0, untilNext);
    handle = timers.setTimer(tick, delay);
  }

  function tick(): void {
    handle = undefined;
    if (!active) return;
    const nowMs = clock.now();
    drain(nowMs);
    started = true;
    options.onTick?.(nowMs);
    arm();
  }

  return {
    start(): void {
      if (active) return;
      active = true;
      // Primera passada immediata: si l'app s'obre enmig de l'eclipsi, la
      // pantalla ha d'ensenyar l'estat correcte sense esperar un batec.
      const nowMs = clock.now();
      drain(nowMs);
      started = true;
      options.onTick?.(nowMs);
      arm();
    },
    stop(): void {
      active = false;
      clearPending();
    },
    poll(): void {
      if (!active) return;
      /*
       * AQUÍ ES RE-ANCORA SEMPRE, I ÉS L'ÚNIC LLOC ON ES FA A LA FORÇA.
       *
       * `poll()` només el crida el `visibilitychange` de `useEclipseTimer`, o
       * sigui que arribar aquí vol dir que la pestanya TORNA de segon pla. I
       * aquell és exactament el moment en què el rellotge d'aquest reproductor
       * pot haver perdut temps: `performance.now()` NO AVANÇA MENTRE L'APARELL
       * DORM, ni a iOS ni a Android. Un mòbil bloquejat un minut torna amb
       * `clock.now()` un minut endarrerit.
       *
       * `arm()` no ho pot arreglar: el seu `clock.resync()` està condicionat a
       * `RESYNC_GUARD_MS`, i aquella guarda existeix per un bon motiu —un salt
       * de mig segon a mig compte enrere de totalitat és pitjor que la deriva
       * que corregeix— però té una conseqüència que no s'havia vist: amb els
       * avisos de C2−60, C2−10, C2+12, C3−60, C3−30, C3−15, C3−5 i C3+3, LA
       * FINESTRA DE LA TOTALITAT NO ES RE-ANCORA MAI. Justament allà.
       *
       * El cas concret, i és de seguretat ocular: algú es guarda el mòbil a la
       * butxaca durant l'última parcial i el treu amb la totalitat començada.
       * Sense això, «posa't el filtre» (C3−15 s) li arriba tants segons tard com
       * hagi dormit l'aparell, i les finestres de validesa no el protegeixen
       * perquè `lateByMs` es mesura contra el mateix rellotge estancat.
       *
       * Per què és segur fer-ho a la força: `Date.now()` d'un mòbil va per NTP,
       * el salt s'aplica UN cop i fora de qualsevol batec, i el `drain()` que ve
       * tot seguit torna a decidir amb l'hora bona — descartant el que de debò
       * ha caducat en comptes d'emetre-ho tard. La guarda d'`arm()` es queda
       * tal com és: aquí no hi ha cap compte enrere corrent, hi ha una tornada.
       */
      clock.resync(true);
      tick();
    },
    now: () => clock.now(),
    resolvedIds: () => resolved,
    running: () => active,
  };
}
