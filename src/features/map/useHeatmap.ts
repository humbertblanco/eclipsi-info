/**
 * Enganxa el mapa de calor de visibilitat amb React.
 *
 * El motor és `workers/heat.worker.ts` i el que pinta és
 * `features/map/layers/heatmap.ts`. Aquest fitxer és el que hi ha entremig:
 * escolta el moviment del mapa, decideix QUAN val la pena demanar una passada,
 * i va acumulant el que el Worker publica.
 *
 * ── QUATRE DECISIONS, I CAP ÉS COSMÈTICA ────────────────────────────────────
 *
 * 1. LA PASSADA NO ARRENCA MENTRE EL DIT ES MOU (debounce de 400 ms). Una
 *    passada són fins a 800 cel·les, milions de mostres de terreny i uns quants
 *    megabytes de tessel·les. Arrossegar un mapa emet desenes d'esdeveniments
 *    per segon: sense escanyar-ho, un gest de mig segon encarregaria vint
 *    passades i se n'aprofitaria una. Els 400 ms són el que triga una mà a
 *    aturar-se de debò després d'un desplaçament; per sota, el mapa demana
 *    feina a mig gest, i per sobre es nota com a mandra.
 *
 * 2. MOURE'S CANCEL·LA. La passada anterior es cancel·la amb el missatge
 *    `cancel` del Worker, no deixant-la morir sola: si no, el Worker seguiria
 *    baixant tessel·les d'un enquadrament que ja no mira ningú — les dades
 *    mòbils de l'usuari, al camp, gastades en un mapa que ha marxat de la
 *    pantalla.
 *
 * 3. LA MEMÒRIA CAU ES MIRA AQUÍ, ABANS DE DEMANAR RES. `computeHeat` ja la
 *    mira dins del Worker, i tot i així es torna a mirar al fil principal per
 *    una raó de producte: el Worker es crea mandrós i el seu mòdul s'ha de
 *    carregar, i mentrestant el mapa estaria en blanc. Mirant-la aquí, la zona
 *    que vas mirar a casa es REPINTA A L'INSTANT, amb els números de relleu,
 *    abans que el Worker existeixi. I si la memòria cau les té TOTES —que és el
 *    cas del camp sense cobertura— no s'arriba a demanar mai res: zero xarxa,
 *    zero Worker, zero espera. Això és exactament la promesa de la capçalera de
 *    `core/heat/cache.ts`, i aquest és el lloc on es compleix.
 *
 *    EL PREU, DIT CLAR: la graella s'ha de generar també aquí (`cellsForViewport`),
 *    i la primera crida per a un eclipsi calcula l'anell de la franja, que val
 *    entre 108 i 147 ms mesurats. És un cop per eclipsi i per fil, i es paga dins
 *    del debounce —o sigui, amb el dit ja aturat— i no a mig gest. La graella no
 *    és feina de més: la memòria cau desa números i no geometria, i sense les
 *    cel·les d'ara no hi hauria polígon on posar-los.
 *
 * 4. LES CEL·LES SE SUBSTITUEIXEN PER `id`, MAI S'ACUMULEN. Ho diu el contracte
 *    del Worker: una cel·la arriba dues vegades, primer com a teoria i després
 *    com a mesura. Acumulant-les, el mapa pintaria la teoria per damunt de la
 *    mesura la meitat de les vegades, i seria impossible saber quina de les dues
 *    s'està veient.
 *
 * ── L'ERROR QUE AQUEST FITXER EVITA I QUE NO ES VEU VENIR ───────────────────
 *
 * Les cel·les de passades velles es conserven en canviar d'enquadrament (val més
 * un mapa incomplet que un mapa que parpelleja a cada moviment), PERÒ NOMÉS LES
 * DEL MATEIX ZOOM DE CEL·LA. Un identificador és `z/x/y`: una cel·la de zoom 10
 * conté exactament quatre de zoom 11 i totes cinc són identificadors diferents i
 * legítims. Barrejant-les, el mapa dibuixaria polígons superposats de mides
 * diferents amb farciments semitransparents — i el resultat no és «una mica
 * lleig», és un color que no vol dir res: el de la cel·la gruixuda sumat al de
 * la fina. En canviar de zoom de cel·la, l'acumulador es buida.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { track, waitBucket } from '../../core/analytics';
import { readCachedHeatCells } from '../../core/heat/cache';
import type { HeatCellValue, HeatCost, HeatProgress } from '../../core/heat/compute';
import { cellsForViewport, type HeatBbox } from '../../core/heat/grid';
import type {
  HeatWorkerMessage,
  HeatWorkerOptions,
  HeatWorkerResponse,
} from '../../workers/heat.worker';
import { rampCeilingSec } from './layers/heatmap';

/** L'enquadrament del mapa, tal com el pot donar `map.getBounds()`. */
export interface HeatViewport {
  bbox: HeatBbox;
  zoom: number;
}

export type HeatmapStatus = 'idle' | 'running' | 'done' | 'error';

/**
 * Per què s'ha aturat, com a CODI i no com a frase.
 *
 * Mateix criteri que `useSpotSearch`: el `message` del motor és català escrit
 * dins de `core/`, i el `message` d'un `ErrorEvent` és anglès que parla de
 * fitxers i línies. Ni l'un ni l'altre es poden ensenyar a ningú dins d'una
 * frase traduïda. El text el posa `screens/strings.ts`.
 */
export type HeatmapFailureCode = 'compute' | 'worker' | 'no-worker';

/** D'on han sortit les cel·les de l'última passada. Vocabulari d'analítica. */
export type HeatmapSource = 'cache' | 'computed' | 'mixed';

export interface UseHeatmapParams {
  eclipseId: string;
  /** Fals: capa apagada. No es demana res i les cel·les es buiden. */
  enabled: boolean;
  /** L'enquadrament d'ara. `null` mentre el mapa no n'hagi donat cap. */
  viewport: HeatViewport | null;
  /** Opcions del Worker. Han de ser estables: es llegeixen a cada passada. */
  options?: HeatWorkerOptions;
  /** Espera abans de demanar la passada. Per defecte 400 ms. */
  debounceMs?: number;
}

export interface UseHeatmapResult {
  /** Les cel·les pintables d'ara, llestes per a `applyHeatmap`. */
  cells: HeatCellValue[];
  /** Sostre de la rampa de color, en segons. Només puja. */
  maxSec: number;
  status: HeatmapStatus;
  /** Etapa i tant per u de la passada viva. `null` si no n'hi ha cap. */
  progress: HeatProgress | null;
  /** Codi de la fallada; el text el posa la pantalla. */
  error: HeatmapFailureCode | null;
  /** Cost de l'última passada acabada, per si es vol ensenyar. */
  cost: HeatCost | null;
  /** Cert mentre hi ha una passada demanada o en marxa. */
  busy: boolean;
  /** Atura la passada viva sense apagar la capa. */
  cancel: () => void;
}

/**
 * Espera per defecte abans de demanar una passada, en ms. Vegeu la capçalera.
 */
export const DEFAULT_HEAT_DEBOUNCE_MS = 400;

/**
 * Cel·les que es conserven entre passades.
 *
 * Tres passades senceres. Prou perquè fer un pas enrere amb el mapa retrobi el
 * que hi havia pintat, i prou poc perquè una tarda de navegar no acabi amb
 * desenes de milers de polígons a la font de GeoJSON —que és el que fa que
 * MapLibre comenci a saltar fotogrames en arrossegar.
 */
const MAX_KEPT_CELLS = 2_400;

/** El zoom de cel·la que porta un identificador `z/x/y`. */
export function cellZoomOf(id: string): number {
  const slash = id.indexOf('/');
  if (slash <= 0) return Number.NaN;
  const zoom = Number.parseInt(id.slice(0, slash), 10);
  return Number.isFinite(zoom) ? zoom : Number.NaN;
}

/**
 * D'on ha sortit una passada, a partir del cost que torna el motor.
 *
 * Sense cel·les no es diu res: `cache` amb zero encerts sobre zero cel·les
 * inflaria l'única mètrica que ha de dir si la memòria cau serveix de debò.
 */
export function heatSourceOf(cost: HeatCost): HeatmapSource | null {
  if (cost.cells <= 0) return null;
  if (cost.fromCache >= cost.cells) return 'cache';
  if (cost.fromCache <= 0) return 'computed';
  return 'mixed';
}

/**
 * Clau estable d'un enquadrament.
 *
 * Quatre decimals són ~11 m: per sota, dues lectures del mateix mapa aturat
 * (que MapLibre pot donar amb un microdesplaçament de la inèrcia) es veurien
 * com a enquadraments diferents i encarregarien dues passades idèntiques.
 *
 * El zoom s'ARRODONEIX perquè és l'únic que en fa servir la graella
 * (`resolutionForZoom` fa `Math.round`): amb el zoom cru, passar de 10,2 a 10,4
 * seria una clau nova per a exactament la mateixa resolució de cel·la.
 */
function viewportKey(viewport: HeatViewport): string {
  const { west, south, east, north } = viewport.bbox;
  return [west, south, east, north]
    .map((value) => value.toFixed(4))
    .concat(String(Math.round(viewport.zoom)))
    .join('|');
}

export function useHeatmap(params: UseHeatmapParams): UseHeatmapResult {
  const {
    eclipseId,
    enabled,
    viewport,
    options,
    debounceMs = DEFAULT_HEAT_DEBOUNCE_MS,
  } = params;

  const [cells, setCells] = useState<HeatCellValue[]>([]);
  const [maxSec, setMaxSec] = useState(0);
  const [status, setStatus] = useState<HeatmapStatus>('idle');
  const [progress, setProgress] = useState<HeatProgress | null>(null);
  const [error, setError] = useState<HeatmapFailureCode | null>(null);
  const [cost, setCost] = useState<HeatCost | null>(null);

  const workerRef = useRef<Worker | null>(null);
  /** Identificador de la passada d'ara. Les respostes tardanes es descarten. */
  const requestRef = useRef(0);
  /** Identificador de la passada que el Worker encara podria estar fent. */
  const inFlightRef = useRef(0);
  /** Instant en què es va demanar, per saber quant s'ha esperat la gent. */
  const startedAtRef = useRef(0);

  /** L'acumulador: per identificador, i s'hi SUBSTITUEIX. Vegeu la capçalera. */
  const cellsRef = useRef(new Map<string, HeatCellValue>());
  /** Zoom de cel·la del que hi ha acumulat, per no barrejar resolucions. */
  const cellZoomRef = useRef<number | null>(null);
  const ceilingRef = useRef(0);

  // Les entrades viuen en referències perquè les crides de retorn no canviïn
  // d'identitat a cada render.
  const inputRef = useRef({ eclipseId, options });
  inputRef.current = { eclipseId, options };

  /** Aboca l'acumulador a l'estat de React. Una sola còpia per bloc. */
  const flush = useCallback((): void => {
    setCells([...cellsRef.current.values()]);
    setMaxSec(ceilingRef.current);
  }, []);

  /**
   * Publica un bloc de cel·les.
   *
   * Fa tres coses en aquest ordre i cap és opcional: buidar si el zoom de
   * cel·la ha canviat, substituir per identificador, i podar les més velles si
   * l'acumulador s'ha desbordat.
   */
  const publish = useCallback(
    (block: readonly HeatCellValue[]): void => {
      if (block.length === 0) return;

      const zoom = cellZoomOf(block[0].id);
      if (Number.isFinite(zoom) && cellZoomRef.current !== zoom) {
        cellsRef.current.clear();
        cellZoomRef.current = zoom;
      }

      const store = cellsRef.current;
      const arriving = new Set<string>();
      for (const cell of block) {
        store.set(cell.id, cell);
        arriving.add(cell.id);
      }

      // Poda per ordre d'arribada, i mai del bloc que acaba d'entrar: el que
      // s'ha de perdre és el territori que ja no es mira, no el que s'acaba de
      // calcular.
      if (store.size > MAX_KEPT_CELLS) {
        for (const key of store.keys()) {
          if (store.size <= MAX_KEPT_CELLS) break;
          if (arriving.has(key)) continue;
          store.delete(key);
        }
      }

      ceilingRef.current = rampCeilingSec(block, ceilingRef.current);
      flush();
    },
    [flush],
  );

  const ensureWorker = useCallback((): Worker | null => {
    if (workerRef.current) return workerRef.current;
    if (typeof Worker === 'undefined') return null;

    const worker = new Worker(new URL('../../workers/heat.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.addEventListener('message', (event: MessageEvent<HeatWorkerResponse>) => {
      const message = event.data;
      // Resposta d'una passada que ja no interessa: es llença sense sorolls.
      if (message.id !== requestRef.current) return;

      if (message.type === 'block') {
        publish(message.cells);
        return;
      }
      if (message.type === 'progress') {
        setProgress(message.progress);
        return;
      }
      if (message.type === 'done') {
        inFlightRef.current = 0;
        setCost(message.outcome.cost);
        setProgress(null);
        setStatus('done');
        const source = heatSourceOf(message.outcome.cost);
        if (source !== null) {
          track('heat_render', {
            source,
            wait: waitBucket(Date.now() - startedAtRef.current),
          });
        }
        return;
      }
      inFlightRef.current = 0;
      setProgress(null);
      setError('compute');
      setStatus('error');
    });

    worker.addEventListener('error', () => {
      inFlightRef.current = 0;
      setProgress(null);
      setError('worker');
      setStatus('error');
    });

    workerRef.current = worker;
    return worker;
  }, [publish]);

  /** Atura la passada que el Worker pugui tenir viva. */
  const abortInFlight = useCallback((): void => {
    const worker = workerRef.current;
    if (worker === null || inFlightRef.current === 0) return;
    const message: HeatWorkerMessage = { type: 'cancel', id: inFlightRef.current };
    worker.postMessage(message);
    inFlightRef.current = 0;
  }, []);

  const cancel = useCallback((): void => {
    abortInFlight();
    // La passada següent tindrà un identificador nou i el que ja fos en camí
    // quedarà orfe: cap resposta tardana no repintarà res.
    requestRef.current += 1;
    setProgress(null);
    setStatus((current) => (current === 'running' ? 'idle' : current));
  }, [abortInFlight]);

  // Canviar d'eclipsi ho invalida tot: les cel·les d'un eclipsi pintades sobre
  // un altre serien números correctes de la pregunta equivocada.
  useEffect(() => {
    cellsRef.current.clear();
    cellZoomRef.current = null;
    ceilingRef.current = 0;
    setCells([]);
    setMaxSec(0);
    setCost(null);
  }, [eclipseId]);

  const viewKey = viewport === null ? null : viewportKey(viewport);
  // El `bbox` és un objecte nou a cada esdeveniment del mapa; l'efecte ha de
  // dependre de la CLAU i llegir el valor d'una referència, o es tornaria a
  // executar a cada fotograma d'un desplaçament.
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  /*
   * APAGAR LA CAPA HO ATURA TOT I BUIDA EL QUE HI HAGI PINTAT.
   *
   * Va en un efecte PROPI, que depèn només d'`enabled`, i no dins del de la
   * passada. Amb la capa apagada, la pantalla continua enviant enquadraments a
   * cada moviment del mapa: si el buidatge visqués a l'altre efecte, cada
   * arrossegada amb el mapa de calor APAGAT faria un `setCells([])` amb una
   * llista nova, i per tant un render sencer per fotograma per no pintar res.
   *
   * Els `set…` amb el mateix valor no fan re-renderitzar (React els compara amb
   * `Object.is`), i per això la sortida ràpida només cal per a les cel·les, que
   * són l'únic que és una referència nova cada vegada.
   */
  useEffect(() => {
    if (enabled) return;
    abortInFlight();
    requestRef.current += 1;
    setProgress(null);
    setError(null);
    setStatus('idle');
    if (cellsRef.current.size === 0) return;
    cellsRef.current.clear();
    cellZoomRef.current = null;
    setCells([]);
  }, [enabled, abortInFlight]);

  useEffect(() => {
    if (!enabled) return;
    if (viewKey === null) return;

    // Qualsevol moviment mata la passada anterior ABANS d'esperar el debounce:
    // si no, el Worker seguiria baixant tessel·les durant tota l'espera.
    abortInFlight();

    let cancelled = false;
    const timer = setTimeout(() => {
      const current = viewportRef.current;
      if (current === null || cancelled) return;

      const { eclipseId: id, options: opts } = inputRef.current;
      const { clipToBand = true, maxCells, marginKm } = opts ?? {};
      const zoom = Math.round(current.zoom);

      requestRef.current += 1;
      const pass = requestRef.current;
      startedAtRef.current = Date.now();
      setStatus('running');
      setError(null);

      /*
       * LA MATEIXA CRIDA QUE FARÀ EL WORKER, amb les mateixes opcions. Ha de
       * ser la mateixa o els identificadors no coincidirien i la memòria cau
       * respondria per unes cel·les que després no es demanarien mai.
       */
      const grid = cellsForViewport(
        current.bbox,
        zoom,
        clipToBand ? id : undefined,
        { maxCells, marginKm },
      );

      if (grid.length === 0) {
        // Fora de la franja no hi ha res a calcular i la resposta ja la sabem.
        // No es buida el que hi ha pintat: segueix sent cert allà on és.
        setProgress(null);
        setStatus('done');
        return;
      }

      void (async () => {
        /*
         * LA MEMÒRIA CAU, PRIMER. Un error d'IndexedDB no pot deixar ningú
         * sense mapa: `readCachedHeatCells` no llança mai i, si no en troba
         * cap, tornem exactament al camí de sempre.
         */
        const known = await readCachedHeatCells(
          id,
          grid.map((cell) => cell.id),
        );
        if (cancelled || pass !== requestRef.current) return;

        if (known.size > 0) {
          // La memòria cau desa números, no geometria: el polígon el torna a
          // posar la graella d'ara.
          publish(
            grid
              .filter((cell) => known.has(cell.id))
              .map((cell) => ({
                ...(known.get(cell.id) as HeatCellValue),
                id: cell.id,
                poly: cell.poly,
              })),
          );
        }

        if (known.size >= grid.length) {
          // Tot el tros ja estava calculat i mesurat: ni Worker ni xarxa.
          // Aquest és el cas del camp sense cobertura, i és la raó per la qual
          // aquesta memòria cau existeix.
          setProgress(null);
          setStatus('done');
          track('heat_render', {
            source: 'cache',
            wait: waitBucket(Date.now() - startedAtRef.current),
          });
          return;
        }

        const worker = ensureWorker();
        if (worker === null) {
          setError('no-worker');
          setStatus('error');
          return;
        }

        inFlightRef.current = pass;
        const request: HeatWorkerMessage = {
          type: 'heat',
          id: pass,
          eclipseId: id,
          bbox: current.bbox,
          zoom,
          options: opts,
        };
        worker.postMessage(request);
      })();
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, viewKey, eclipseId, debounceMs, abortInFlight, ensureWorker, publish]);

  /*
   * EL WORKER VIU MENTRE VISQUI EL COMPONENT, i no s'apaga en apagar la capa.
   * Les tessel·les descodificades hi són a dins i són el que costa car:
   * encendre i apagar el mapa de calor —que és un gest de tres segons— tornaria
   * a pagar tota la xarxa cada vegada. Quan no li queda cap feina, el Worker
   * ja allibera les tessel·les tot sol (`releaseTiles`, vegeu `heat.worker.ts`).
   */
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return {
    cells,
    maxSec,
    status,
    progress,
    error,
    cost,
    busy: status === 'running',
    cancel,
  };
}
