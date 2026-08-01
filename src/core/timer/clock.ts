/**
 * Referència de temps monòtona amb correcció de deriva.
 *
 * EL PROBLEMA. Hi ha dos rellotges i cap dels dos serveix tot sol:
 *
 *  - `Date.now()` està lligat a UTC (que és el que necessitem: els contactes
 *    són instants UTC) però NO és monòton. El telèfon sincronitza per NTP, i
 *    una correcció de dos segons a mig eclipsi faria saltar el compte enrere
 *    endavant o —pitjor— enrere. També salta si l'usuari canvia l'hora a mà o
 *    si el sistema aplica un canvi de zona horària.
 *  - `performance.now()` és monòton i immune a tot això, però compta des d'un
 *    origen arbitrari i deriva lentament respecte d'UTC (el cristall del
 *    dispositiu no és perfecte: un error d'unes desenes de ppm són desenes de
 *    mil·lisegons per hora).
 *
 * LA SOLUCIÓ. Ancorem una vegada els dos rellotges i a partir d'aquí llegim
 * sempre el monòton:
 *
 *     now() = ancoratgeUTC + (performance.now() − ancoratgeMonòton)
 *
 * i re-ancorem NOMÉS quan la diferència amb `Date.now()` supera una tolerància
 * I no som a prop de cap fita. Així el compte enrere no fa mai un salt visible
 * en el moment crític, i alhora no acumula la deriva del cristall al llarg de
 * les hores que l'app pot estar oberta abans de l'eclipsi.
 *
 * Sense DOM: `performance` i `Date` existeixen igual a Node i als Workers.
 */

/** Font de temps. Injectable perquè els tests puguin moure el rellotge a mà. */
export interface ClockSources {
  /** Rellotge de paret lligat a UTC. Per defecte `Date.now`. */
  wallNow: () => number;
  /** Rellotge monòton. Per defecte `performance.now`, amb recurs a `Date.now`. */
  monotonicNow: () => number;
}

export interface MonotonicClockOptions extends Partial<ClockSources> {
  /**
   * Diferència, en ms, a partir de la qual val la pena re-ancorar.
   * Per sota d'aquest llindar el salt faria més mal que la deriva.
   */
  toleranceMs?: number;
}

export interface MonotonicClock {
  /** Instant actual a l'escala UTC, en ms des de l'època. */
  now(): number;
  /**
   * Diferència entre el rellotge de paret i el nostre, en ms.
   * Positiva vol dir que el sistema va per davant del que nosaltres comptem.
   */
  driftMs(): number;
  /**
   * Torna a ancorar si la deriva supera la tolerància.
   * @param force re-ancora sempre. Només s'ha de fer servir lluny de cap fita.
   * @returns cert si s'ha re-ancorat.
   */
  resync(force?: boolean): boolean;
}

/** `performance.now` si hi és; si no, el rellotge de paret (millor això que res). */
function defaultMonotonic(): () => number {
  const perf = globalThis.performance;
  if (perf && typeof perf.now === 'function') return () => perf.now();
  return () => Date.now();
}

/** Tolerància per defecte: mig segon. Per sota no es nota i no compensa el salt. */
export const DEFAULT_RESYNC_TOLERANCE_MS = 500;

export function createMonotonicClock(options: MonotonicClockOptions = {}): MonotonicClock {
  const wallNow = options.wallNow ?? (() => Date.now());
  const monotonicNow = options.monotonicNow ?? defaultMonotonic();
  const toleranceMs = options.toleranceMs ?? DEFAULT_RESYNC_TOLERANCE_MS;

  let anchorWall = wallNow();
  let anchorMono = monotonicNow();

  const now = (): number => anchorWall + (monotonicNow() - anchorMono);
  const driftMs = (): number => wallNow() - now();

  return {
    now,
    driftMs,
    resync(force = false): boolean {
      const drift = driftMs();
      if (!force && Math.abs(drift) < toleranceMs) return false;
      anchorWall = wallNow();
      anchorMono = monotonicNow();
      return true;
    },
  };
}
