/**
 * Cua de peticions i antirebot.
 *
 * DOS PROBLEMES DIFERENTS, i es resolen per separat perquè ho són:
 *
 * 1. L'ANTIREBOT evita PREGUNTAR mentre l'usuari encara mou el dit. Mentre el
 *    mapa es desplaça, el punt del centre canvia a cada fotograma; cap d'aquells
 *    punts intermedis interessa a ningú. Només el darrer, quan para.
 *
 * 2. LA CUA evita preguntar MASSA DE PRESSA quan sí que cal preguntar. Photon no
 *    publica cap límit i diu que l'ús excessiu es bloqueja; agafem el sostre
 *    publicat de Nominatim —una petició per segon com a màxim absolut— perquè
 *    és l'única xifra de la família OpenStreetMap i és la més estricta.
 *
 * Amb els dos junts, la seqüència real d'algú comparant llocs al mapa —desenes
 * de canvis de posició per minut— es queda en una petició cada vegada que para
 * mig segon, i mai dues en menys d'un segon.
 *
 * Tots dos fan servir `setTimeout` de l'entorn, o sigui que els rellotges
 * falsos de Vitest els controlen sense haver d'injectar res.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en Node.
 */

/** Espera mínima entre dues peticions, en ms. Vegeu la capçalera. */
export const MIN_REQUEST_INTERVAL_MS = 1_000;

/**
 * Espera de l'antirebot del mapa, en ms.
 *
 * Mig segon és el temps que una persona triga a aixecar el dit i quedar-se
 * mirant. Més curt dispara peticions enmig del gest; més llarg fa que el nom
 * arribi tard i sembli que l'app va endarrerida.
 */
export const MAP_SETTLE_MS = 500;

/**
 * Espera de l'antirebot del cercador, en ms.
 *
 * Més curta que la del mapa perquè escrivint s'espera resposta abans: 320 ms és
 * just per sota de la pausa natural entre paraules.
 */
export const SEARCH_SETTLE_MS = 320;

export interface RequestQueue {
  /**
   * Encua una feina. Es reparteixen d'una en una i mai dues de seguides sense
   * que hagi passat `MIN_REQUEST_INTERVAL_MS`.
   */
  run<T>(task: () => Promise<T>): Promise<T>;
  /** Feines esperant torn. Per a proves. */
  pending(): number;
}

/**
 * Cua sèrie amb espaiat mínim.
 *
 * És FIFO i d'un sol fil a posta: la política de Nominatim, que és la que ens
 * marca el sostre, diu explícitament «limit your requests to a single thread».
 */
export function createRequestQueue(
  minIntervalMs: number = MIN_REQUEST_INTERVAL_MS,
): RequestQueue {
  const waiting: (() => void)[] = [];
  let busy = false;
  let lastStartMs = Number.NEGATIVE_INFINITY;

  function pump(): void {
    if (busy) return;
    const next = waiting.shift();
    if (!next) return;

    busy = true;
    const wait = Math.max(0, lastStartMs + minIntervalMs - Date.now());
    setTimeout(() => {
      lastStartMs = Date.now();
      next();
    }, wait);
  }

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        waiting.push(() => {
          task()
            .then(resolve, reject)
            .finally(() => {
              busy = false;
              pump();
            });
        });
        pump();
      });
    },
    pending() {
      return waiting.length;
    },
  };
}

/** Una crida substituïda per una de posterior. Vegeu `createSettler`. */
export const SUPERSEDED = Symbol('superseded');
export type Superseded = typeof SUPERSEDED;

export interface Settler {
  /**
   * Espera que l'usuari pari i llavors executa `task`.
   *
   * Cada crida ANUL·LA l'anterior: la promesa de la crida substituïda es resol
   * amb `SUPERSEDED` i la seva feina no s'arriba a executar mai. Es resol i no
   * es rebutja a posta: que t'hagin avançat no és cap error i obligar tothom a
   * capturar-ho ompliria el codi de `catch` buits.
   */
  run<T>(task: () => Promise<T>): Promise<T | Superseded>;
  /** Anul·la el que hi hagi esperant, sense executar-lo. */
  cancel(): void;
  /** Cert si hi ha una feina esperant que l'usuari pari. */
  isWaiting(): boolean;
}

/** Antirebot: només s'executa l'última feina demanada, i quan tot para. */
export function createSettler(delayMs: number): Settler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let abandonPending: (() => void) | null = null;

  function cancel(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    const abandon = abandonPending;
    abandonPending = null;
    abandon?.();
  }

  return {
    run<T>(task: () => Promise<T>): Promise<T | Superseded> {
      cancel();
      return new Promise<T | Superseded>((resolve, reject) => {
        abandonPending = () => resolve(SUPERSEDED);
        timer = setTimeout(() => {
          timer = null;
          abandonPending = null;
          task().then(resolve, reject);
        }, delayMs);
      });
    },
    cancel,
    isWaiting() {
      return timer !== null;
    },
  };
}
