/**
 * El rellotge de simulació d'un eclipsi, com a màquina d'estats pura.
 *
 * LA DECISIÓ QUE MANA: AQUÍ DINS NO HI HA CAP RELLOTGE. Ni `Date.now()`, ni
 * `setInterval`, ni `requestAnimationFrame`. Una funció rep l'estat i el que ha
 * passat —tants mil·lisegons reals, tal acció de l'usuari— i retorna l'estat
 * següent. El rellotge de debò el posa `features/sim/useSimulationClock.ts`, que
 * és trenta línies i el que hi pugui fallar es veu a ull nu.
 *
 * PER QUÈ VAL LA PENA LA SEPARACIÓ. Els casos que trenquen una reproducció no
 * són els normals, són tres i tots tres passen fora de la vista del programador:
 *
 *   1. Arribar al final mentre es reprodueix. Ha d'aturar-se CLAVAT a C4, no
 *      passar-se ni fer la volta. Amb un `setInterval` només es comprova
 *      esperant que acabi l'eclipsi simulat.
 *   2. Canviar de velocitat a mig camí. L'instant no pot saltar: només ha de
 *      canviar el pendent. Aquí es garanteix per construcció —el temps
 *      transcorregut no s'acumula enlloc, cada fotograma es multiplica pel
 *      factor que hi ha en aquell moment— i hi ha un test que ho vigila.
 *   3. La pestanya que ha estat en segon pla. `requestAnimationFrame` no corre
 *      amagat i, en tornar, el primer fotograma arriba amb el delta sencer:
 *      tres minuts de fons són 180.000 ms. A 600× això són 108.000 s d'eclipsi
 *      en un sol fotograma, disset vegades l'eclipsi sencer. Vegeu `MAX_FRAME_MS`.
 *
 * Cap dels tres es pot provar amb comoditat des d'un component; tots tres es
 * proven aquí amb números, en entorn Node, i triguen un mil·lisegon.
 *
 * IDENTITAT REFERENCIAL COM A CONTRACTE. Quan una acció no canvia res, es
 * retorna EL MATEIX objecte. La reproducció despatxa un fotograma seixanta cops
 * per segon; si l'estat en pausa tornés un objecte nou a cada fotograma, React
 * repintaria el mapa, el cel i la fitxa seixanta cops per segon per no res.
 */

import type {
  ContactId,
  ContactTimesMs,
  PlaybackRate,
  TimelineAction,
  TimelineMark,
  TimelineState,
  TimelineWindow,
} from './types';
import { PLAYBACK_RATES } from './types';

export { PLAYBACK_RATES };
export type { PlaybackRate, TimelineAction, TimelineMark, TimelineState, TimelineWindow };

/**
 * El delta real màxim que s'accepta d'un fotograma, en mil·lisegons.
 *
 * D'ON SURT EL 250. A 60 fotogrames per segon un fotograma dura 16,7 ms; un
 * mòbil de gamma mitjana redibuixant el mapa i el cel alhora en gasta 100-200 en
 * els pitjors. 250 ms és el més llarg que encara es pot anomenar honestament
 * «un fotograma»: per sobre d'això, el que ha passat no és que el dibuix vagi
 * lent, és que el bucle ha estat aturat.
 *
 * QUÈ ES PERD I QUÈ ES GUANYA. La conseqüència del límit és que a 600× un
 * fotograma llarg pot avançar fins a 150 s d'eclipsi de cop. Sembla molt, i ho
 * és, fins que es compara: la finestra C1-C4 dels eclipsis d'aquest catàleg fa
 * entre 6.270 i 8.950 s, o sigui que el pitjor salt possible és el 2,4 % de
 * l'eclipsi. Sense el límit, el mateix fotograma se'l passa sencer disset
 * vegades i la reproducció apareix aturada a C4 sense que ningú hagi vist res.
 * A 1× el límit no es nota (250 ms), i a 60× són 15 s.
 *
 * NO ES CAPA L'AVANÇ SIMULAT, es capa el temps REAL. Capar els segons d'eclipsi
 * per fotograma faria que en un dispositiu lent 600× no fossin 600×, i un factor
 * de velocitat que menteix sobre el seu propi número és pitjor que un salt.
 */
export const MAX_FRAME_MS = 250;

/** El pas dels botons d'avanç i retrocés: un minut, com la competència. */
export const NUDGE_MS = 60_000;

/** L'ordre físic dels contactes. Cap eclipsi els té mai en un altre ordre. */
const CONTACT_ORDER: readonly ContactId[] = ['c1', 'c2', 'max', 'c3', 'c4'];

/**
 * De la taula de contactes a la finestra i les fites.
 *
 * La finestra és la MATEIXA que la de `features/sim/samples.ts`
 * (`trajectoryWindowMs`): de C1 a C4, i quan no hi ha contactes parcials es
 * col·lapsa al màxim. Que les dues coincideixin no és casualitat sinó requisit —
 * la barra recorre exactament el tram del qual hi ha mostres calculades, i si
 * discrepessin el marcador cauria fora de la corba.
 */
export function timelineFromContacts(contacts: ContactTimesMs): {
  window: TimelineWindow;
  marks: TimelineMark[];
} {
  const startMs = contacts.c1 ?? contacts.max;
  const endMs = contacts.c4 ?? contacts.max;

  const marks: TimelineMark[] = [];
  for (const id of CONTACT_ORDER) {
    const atMs = contacts[id];
    if (atMs !== undefined) marks.push({ id, atMs });
  }

  return { window: { startMs, endMs }, marks };
}

export interface CreateTimelineOptions {
  window: TimelineWindow;
  marks?: readonly TimelineMark[];
  /** L'instant real de la creació: el que s'ensenya si s'arrenca en directe. */
  nowMs: number;
  /**
   * Amb què s'arrenca.
   *
   * EL VALOR PER DEFECTE ÉS `live` A POSTA. Una pantalla que s'obre ja en
   * simulació sense que ningú l'hi hagi posada és exactament la confusió que
   * aquest mòdul intenta evitar: el primer que s'ha de veure sempre és l'hora
   * que és.
   */
  source?: TimelineState['source'];
  rate?: PlaybackRate;
  /**
   * L'instant d'arrencada quan s'arrenca en simulació.
   *
   * S'IGNORA EN DIRECTE, i no és cap descuit: en directe l'instant és l'hora
   * que és, i acceptar-ne un altre seria obrir la porta a una pantalla que diu
   * «temps real» i ensenya una altra cosa. Sense ell, la simulació arrenca a
   * l'hora d'ara duta dins de la finestra.
   */
  timeMs?: number;
}

export function createTimeline(options: CreateTimelineOptions): TimelineState {
  const { window: win, marks = [], nowMs, source = 'live', rate = 1, timeMs } = options;
  return {
    timeMs: source === 'live' ? nowMs : clampToWindow(timeMs ?? nowMs, win),
    playing: false,
    rate,
    window: win,
    marks,
    source,
  };
}

/* ---------------------------------------------------------------- selectors */

/** Cert si la finestra té amplada: sense això no hi ha res a reproduir. */
export function isPlayable(state: TimelineState): boolean {
  return state.window.endMs > state.window.startMs;
}

/** Fracció recorreguda de la finestra, de 0 a 1. Fora de la finestra, capada. */
export function timelineProgress(state: TimelineState): number {
  const { startMs, endMs } = state.window;
  if (endMs <= startMs) return 0;
  return Math.max(0, Math.min(1, (state.timeMs - startMs) / (endMs - startMs)));
}

/**
 * Índex de l'última fita ja passada, o −1 si encara no se n'ha passat cap.
 *
 * El −1 és informació, no un error: vol dir «abans del primer contacte», que és
 * un estat legítim de la barra. Qui pinti el tram recorregut n'haurà de fer un
 * zero, però ha de ser ell qui ho decideixi i no aquesta funció, que si
 * retornés zero diria que C1 ja ha passat quan encara no.
 */
export function activeMarkIndex(marks: readonly TimelineMark[], timeMs: number): number {
  let index = -1;
  for (let i = 0; i < marks.length; i++) {
    if (marks[i].atMs <= timeMs) index = i;
    else break;
  }
  return index;
}

/**
 * Índex de la mostra precalculada que correspon a un instant.
 *
 * PER QUÈ VIU AQUÍ. Les pantalles no dibuixen l'instant: dibuixen una MOSTRA
 * d'efemèrides d'una llista que `features/sim/samples.ts` calcula un cop (240
 * per a la corba, 48 per a la miniatura). La conversió d'instant a índex és,
 * doncs, la juntura entre la línia de temps i tot el que es pinta, i el
 * projecte ja en té dues còpies: aquesta i la de `features/ar/ARView.tsx`. La
 * signatura és deliberadament la MATEIXA que la d'allà perquè el dia que es
 * consolidi n'hi hagi prou de canviar la declaració per l'import.
 *
 * Els dos extrems han de caure exactes a la primera i a l'última mostra: si
 * l'últim instant no donés l'últim índex, el marcador de C4 quedaria un pas
 * abans del final de la corba i les dues coses discreparien a la vista.
 */
export function sampleIndexForTime(
  timeMs: number,
  startMs: number,
  endMs: number,
  count: number,
): number {
  if (count <= 1 || endMs <= startMs) return 0;
  const p = Math.max(0, Math.min(1, (timeMs - startMs) / (endMs - startMs)));
  return Math.round(p * (count - 1));
}

/** L'instant d'una fita, o `null` si aquest eclipsi no la té des d'aquí. */
export function markTime(marks: readonly TimelineMark[], id: ContactId): number | null {
  const found = marks.find((mark) => mark.id === id);
  return found === undefined ? null : found.atMs;
}

/**
 * Quant separa l'instant que es mira de l'hora real, amb signe.
 *
 * Positiu vol dir que la simulació va per davant del món. És la xifra que fa
 * que «SIMULACIÓ» sigui una afirmació comprovable i no una etiqueta: dir
 * «+3 h 12 min sobre l'hora real» no es pot confondre amb el compte enrere de
 * debò ni mirant-s'ho de reüll.
 */
export function offsetFromNowMs(state: TimelineState, nowMs: number): number {
  return state.timeMs - nowMs;
}

/* ----------------------------------------------------------------- reductor */

function clampToWindow(timeMs: number, win: TimelineWindow): number {
  if (win.endMs <= win.startMs) return win.startMs;
  return Math.min(win.endMs, Math.max(win.startMs, timeMs));
}

/**
 * Posiciona la simulació a un instant.
 *
 * LA REGLA D'UNA LÍNIA QUE HO GOVERNA TOT: la reproducció no sobreviu mai al
 * final de la finestra, s'hi arribi com s'hi arribi —reproduint, amb el botó
 * d'un minut o saltant a C4. Tenir-la escrita en un sol lloc és el que evita
 * que el cas «avança un minut just abans de C4» quedi reproduint contra un
 * instant que ja no es mou.
 */
function positioned(state: TimelineState, timeMs: number, playing: boolean): TimelineState {
  const next = clampToWindow(timeMs, state.window);
  const stillPlaying = playing && next < state.window.endMs;

  if (state.source === 'sim' && state.timeMs === next && state.playing === stillPlaying) {
    return state;
  }
  return { ...state, timeMs: next, playing: stillPlaying, source: 'sim' };
}

function sameWindow(a: TimelineWindow, b: TimelineWindow): boolean {
  return a.startMs === b.startMs && a.endMs === b.endMs;
}

function sameMarks(a: readonly TimelineMark[], b: readonly TimelineMark[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((mark, i) => mark.id === b[i].id && mark.atMs === b[i].atMs);
}

/**
 * L'estat següent. Pura: mateix estat i mateixa acció, mateix resultat.
 *
 * QUI TOCA EL TEMPS ENTRA EN SIMULACIÓ. Totes les accions que mouen l'instant
 * (`seek`, `nudge`, `jump`, `play`, `replay`) commuten `source` a `'sim'`, i
 * només `goLive` en surt. No hi ha cap camí per moure el temps i seguir dient
 * que es mira el rellotge de debò, que és el que fa que l'etiqueta de la
 * interfície es pugui creure.
 */
export function timelineReduce(state: TimelineState, action: TimelineAction): TimelineState {
  switch (action.type) {
    case 'frame': {
      if (state.source === 'live') {
        // El temps real NO es capa a la finestra: si l'eclipsi és d'aquí a dos
        // anys, l'hora que s'ensenya ha de ser l'hora que és, no C1.
        if (state.timeMs === action.nowMs) return state;
        return { ...state, timeMs: action.nowMs };
      }
      if (!state.playing) return state;

      const real = Math.min(Math.max(0, action.deltaMs), MAX_FRAME_MS);
      if (real === 0) return state;

      // El factor es llegeix ARA, no s'acumula res: canviar de velocitat a mig
      // camí canvia el pendent i no l'instant.
      const next = state.timeMs + real * state.rate;
      if (next >= state.window.endMs) {
        return { ...state, timeMs: state.window.endMs, playing: false };
      }
      return { ...state, timeMs: next };
    }

    case 'play': {
      if (!isPlayable(state)) return state;
      if (state.playing) return state;
      // Prémer «reprodueix» amb la barra al final rebobina, com qualsevol
      // reproductor. Si no, el botó no fa res i sembla espatllat.
      const base = clampToWindow(state.timeMs, state.window);
      const from = base >= state.window.endMs ? state.window.startMs : base;
      return positioned(state, from, true);
    }

    case 'pause':
      if (!state.playing) return state;
      return { ...state, playing: false };

    case 'toggle':
      return timelineReduce(state, { type: state.playing ? 'pause' : 'play' });

    case 'replay':
      if (!isPlayable(state)) return state;
      return positioned(state, state.window.startMs, true);

    case 'setRate':
      if (state.rate === action.rate) return state;
      return { ...state, rate: action.rate };

    // Arrossegar la barra és prendre el control: si la reproducció continués,
    // el dit i el rellotge es disputarien el mateix instant a cada esdeveniment.
    case 'seek':
      return positioned(state, action.timeMs, false);

    // El botó d'un minut és un gest discret i no atura res: és el «avança una
    // mica» de qualsevol reproductor, no un canvi de mans.
    case 'nudge': {
      const base = state.source === 'live'
        ? clampToWindow(state.timeMs, state.window)
        : state.timeMs;
      return positioned(state, base + action.deltaMs, state.playing);
    }

    case 'jump': {
      const at = markTime(state.marks, action.mark);
      // Un eclipsi parcial no té C2 ni C3. Que el botó no hi sigui és cosa de la
      // vista; que aquí no passi res si algú el demana igualment és cosa nostra.
      if (at === null) return state;
      return positioned(state, at, state.playing);
    }

    case 'goLive':
      if (state.source === 'live' && state.timeMs === action.nowMs && !state.playing) {
        return state;
      }
      return { ...state, timeMs: action.nowMs, playing: false, source: 'live' };

    // Entrar a la simulació no és començar a reproduir: és deixar de mirar el
    // rellotge de paret. L'instant on caus és l'hora d'ara duta dins de la
    // finestra, que és el punt de la simulació més a prop del món de debò.
    case 'enterSim':
      return positioned(state, state.timeMs, false);

    case 'setWindow': {
      if (sameWindow(state.window, action.window) && sameMarks(state.marks, action.marks)) {
        return state;
      }
      const moved: TimelineState = { ...state, window: action.window, marks: action.marks };
      if (state.source === 'live') return moved;
      // Es conserva l'INSTANT ABSOLUT, no la fracció recorreguda: canviar de
      // lloc mou els contactes uns segons, i el que l'usuari està mirant és una
      // hora concreta del dia, no un percentatge.
      return positioned(moved, moved.timeMs, moved.playing);
    }
  }
}
