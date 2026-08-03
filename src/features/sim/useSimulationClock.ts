/**
 * El rellotge de debò damunt de la màquina d'estats de `core/timeline`.
 *
 * TOT EL QUE DECIDEIX ALGUNA COSA ÉS A `core/timeline/playback.ts`. Aquí només
 * hi ha les tres coses que no es poden provar a Node i que, precisament per
 * això, val la pena tenir juntes, curtes i llegibles d'una passada:
 *
 *   1. Qui crida el reductor seixanta cops per segon (`requestAnimationFrame`).
 *   2. Què passa quan la pestanya s'amaga.
 *   3. Què passa amb `prefers-reduced-motion`.
 *
 * D'ON SURT L'HORA REAL. De `state/useNow`, que és el rellotge MONÒTON de
 * l'app (`core/timer/clock.ts`): `Date.now()` salta quan el telèfon sincronitza
 * per NTP, i un salt de dos segons a mig eclipsi mouria el compte enrere
 * endavant o —pitjor— enrere. Reaprofitar-lo no és estalvi de línies: és el que
 * fa que aquesta línia de temps i el compte enrere de la portada diguin la
 * mateixa hora, que és tota la gràcia d'un sol rellotge per pantalla.
 *
 * EL COST QUE S'ACCEPTA. `useNow(1000)` fa que qui munti aquest hook repinti un
 * cop per segon encara que la simulació estigui aturada. És deliberat: sense
 * l'hora real fresca, la xifra que diu quant s'allunya la simulació del món
 * envelliria en silenci, i aquesta xifra és justament la que evita confondre
 * simulació amb temps real el dia de l'eclipsi. Un reconciliat per segon és
 * barat; una etiqueta de temps que menteix, no.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  createTimeline,
  timelineReduce,
  NUDGE_MS,
  type ContactId,
  type PlaybackRate,
  type TimelineMark,
  type TimelineSource,
  type TimelineState,
  type TimelineWindow,
} from '../../core/timeline';
import { nowMs as readNowMs, useNow } from '../../state/useNow';
import { useMediaQuery } from '../../ui';

/**
 * Pas mínim entre fotogrames amb `prefers-reduced-motion`, en mil·lisegons.
 *
 * AIXÒ ÉS UN JUDICI, NO UNA MESURA, i val més dir-ho. La norma (WCAG 2.3.3)
 * parla d'animació NO essencial i disparada sola; aquí el moviment és el
 * contingut i el dispara la persona prement un botó que també el pot aturar, o
 * sigui que apagar la reproducció seria treure la funció a qui l'ha demanada.
 * El que sí que es pot fer és treure-li la CONTINUÏTAT: a 8 fotogrames per
 * segon el cel simulat es llegeix com una successió d'estats i no com un
 * moviment fluid, que és la propietat que molesta a qui demana menys moviment.
 *
 * El factor de velocitat no es toca: 60× segueix sent 60×, amb menys
 * fotogrames. Un ajust que canviés també la velocitat faria que el número del
 * control mentís, i d'això ja se'n parla a `MAX_FRAME_MS`.
 */
export const REDUCED_MOTION_FRAME_MS = 125;

export interface UseSimulationClockOptions {
  /** La finestra recorrible. Normalment de C1 a C4 (`timelineFromContacts`). */
  window: TimelineWindow;
  /** Els contactes saltables. Es poden passar sense memoritzar: vegeu sota. */
  marks?: readonly TimelineMark[];
  /** Amb què s'arrenca. Per defecte, temps real. */
  initialSource?: TimelineSource;
  initialRate?: PlaybackRate;
  /**
   * Instant d'arrencada, només si s'arrenca en simulació.
   *
   * El fa servir la pantalla de simulació, que s'obre al màxim perquè és
   * l'instant que la persona ha vingut a veure. En directe s'ignora: allà
   * l'instant és l'hora que és i no hi ha res a triar.
   */
  initialTimeMs?: number;
}

export interface SimulationClock {
  /** L'estat sencer, per si la vista necessita més que l'instant. */
  state: TimelineState;
  /** L'instant a dibuixar, en ms d'època. És el que va a `timeMs`. */
  timeMs: number;
  /** L'hora de debò, del rellotge monòton de l'app. */
  realNowMs: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Torna a C1 i reprodueix: l'autoplay de C1 a C4 d'una sola acció. */
  replay: () => void;
  setRate: (rate: PlaybackRate) => void;
  /** Gest continu: posiciona i atura. */
  seek: (timeMs: number) => void;
  /** Gest discret: ±1 minut per defecte, sense aturar. */
  nudge: (deltaMs?: number) => void;
  jump: (mark: ContactId) => void;
  /** Deixa de mirar el rellotge de paret, sense reproduir res. */
  enterSim: () => void;
  /** L'única sortida de la simulació. */
  goLive: () => void;
}

export function useSimulationClock(options: UseSimulationClockOptions): SimulationClock {
  const { window: win, marks, initialSource, initialRate, initialTimeMs } = options;

  const realNowMs = useNow(1000);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  /*
   * L'HORA REAL, LLEGIBLE SENSE SER DEPENDÈNCIA.
   *
   * `goLive` ha de dir quin instant és, i si ho fes amb una lectura fresca del
   * rellotge tindríem DUES hores en directe: la que acaba de llegir i la de
   * `useNow`, que pot ser fins a un segon més vella. L'efecte de sota
   * l'escriuria tot seguit i el rellotge de la pantalla faria un salt ENRERE
   * d'un segon en tornar al temps real —justament el que `core/timer/clock.ts`
   * es va escriure per evitar. Amb la referència, l'hora en directe d'aquest
   * hook és sempre la mateixa i només pot avançar.
   */
  const nowRef = useRef(realNowMs);
  nowRef.current = realNowMs;

  const [state, dispatch] = useReducer(
    timelineReduce,
    null,
    (): TimelineState =>
      createTimeline({
        window: win,
        marks,
        nowMs: readNowMs(),
        source: initialSource,
        rate: initialRate,
        timeMs: initialTimeMs,
      }),
  );

  /*
   * LA FINESTRA POT CANVIAR sota els peus: es mou el punt, es tria un altre
   * eclipsi. L'efecte es desperta amb els VALORS i no amb la identitat dels
   * objectes, perquè si depengués de `marks` un component que les construeixi
   * en línia el despertaria a cada render. El reductor ho absorbiria —una
   * finestra idèntica retorna el mateix estat—, però és feina de franc, i la
   * signatura de cinc contactes costa menys que la comparació que evita.
   */
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const marksKey = marks === undefined ? '' : marks.map((m) => `${m.id}:${m.atMs}`).join('|');

  useEffect(() => {
    dispatch({
      type: 'setWindow',
      window: { startMs: win.startMs, endMs: win.endMs },
      marks: marksRef.current ?? [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.startMs, win.endMs, marksKey]);

  /*
   * EN TEMPS REAL NO CAL CAP BUCLE DE FOTOGRAMES. El Sol es mou 0,004° per
   * segon: refrescar-lo seixanta cops per segon no ensenyaria res que no
   * ensenyi un cop per segon, i el dia de l'eclipsi el mòbil ja té la càmera
   * oberta i el seu propi bucle de dibuix corrent. L'instant en directe surt,
   * doncs, del mateix `useNow` que ja fa servir la resta de l'app.
   */
  useEffect(() => {
    if (state.source !== 'live') return;
    dispatch({ type: 'frame', deltaMs: 0, nowMs: realNowMs });
  }, [state.source, realNowMs]);

  /*
   * EL BUCLE, que només corre mentre es reprodueix.
   *
   * LA PESTANYA AMAGADA ES TRACTA DOS COPS, i no és redundància per gust:
   *
   *   · aquí, cancel·lant el bucle i REANCORANT `last` en tornar, perquè el
   *     primer fotograma de la tornada no arribi amb els tres minuts que ha
   *     durat l'absència;
   *   · i al reductor, amb `MAX_FRAME_MS`, que capa qualsevol delta vingui d'on
   *     vingui.
   *
   * La segona és la que val, perquè és la que es pot provar. La primera evita
   * que el cas arribi a passar, que és millor que absorbir-lo: `requestAnimationFrame`
   * ja no corre amagat en la majoria de navegadors, però n'hi ha que el deixen
   * a un fotograma per segon i llavors el delta no és gegant, és sospitós.
   */
  useEffect(() => {
    if (!state.playing) return;
    if (typeof requestAnimationFrame !== 'function') return;

    const minFrameMs = reducedMotion ? REDUCED_MOTION_FRAME_MS : 0;
    let handle = 0;
    let last = performance.now();

    const frame = (stamp: number): void => {
      handle = requestAnimationFrame(frame);
      const delta = stamp - last;
      // Amb `minFrameMs` a zero la condició no s'activa mai i el bucle va al
      // ritme de la pantalla, que és el que ha de fer per defecte.
      if (delta < minFrameMs) return;
      last = stamp;
      // `nowMs` només el mira la branca en directe del reductor, i aquest bucle
      // no corre mai en directe. Va igualment, i és el mateix que veu la resta
      // del hook: una acció amb dades a mitges és una trampa esperant.
      dispatch({ type: 'frame', deltaMs: delta, nowMs: nowRef.current });
    };

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        if (handle !== 0) return;
        last = performance.now();
        handle = requestAnimationFrame(frame);
      } else if (handle !== 0) {
        cancelAnimationFrame(handle);
        handle = 0;
      }
    };

    if (document.visibilityState === 'visible') handle = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (handle !== 0) cancelAnimationFrame(handle);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [state.playing, reducedMotion]);

  /*
   * Les accions es donen fetes i amb identitat estable perquè qui les rebi les
   * pugui passar a un `onClick` sense refer el component a cada render.
   */
  const actions = useMemo(
    () => ({
      play: () => dispatch({ type: 'play' as const }),
      pause: () => dispatch({ type: 'pause' as const }),
      toggle: () => dispatch({ type: 'toggle' as const }),
      replay: () => dispatch({ type: 'replay' as const }),
      setRate: (rate: PlaybackRate) => dispatch({ type: 'setRate' as const, rate }),
      seek: (timeMs: number) => dispatch({ type: 'seek' as const, timeMs }),
      nudge: (deltaMs: number = NUDGE_MS) => dispatch({ type: 'nudge' as const, deltaMs }),
      jump: (mark: ContactId) => dispatch({ type: 'jump' as const, mark }),
      enterSim: () => dispatch({ type: 'enterSim' as const }),
    }),
    [],
  );

  // `goLive` no pot anar al lot de sobre perquè és l'única que necessita l'hora
  // real, i l'ha de llegir en prémer i no en muntar el component.
  const goLive = useCallback(() => {
    dispatch({ type: 'goLive', nowMs: nowRef.current });
  }, []);

  return { state, timeMs: state.timeMs, realNowMs, ...actions, goLive };
}
