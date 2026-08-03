/**
 * Tests del rellotge de simulació.
 *
 * El que aquí es vigila NO és que la barra es mogui —això es veu a ull— sinó
 * els tres casos que només passen quan no mires: arribar al final reproduint,
 * canviar de velocitat a mig camí i el fotograma gegant de la pestanya que
 * tornava de segon pla. I un quart que és de seguretat i no de mecànica: que
 * cap camí no pugui moure el temps i seguir dient «temps real».
 *
 * Els números són ms d'època arbitraris però amb la forma d'un eclipsi de debò:
 * la finestra fa 105 minutos —la del 2026 des de Palma fa 104,5— i la fase
 * central 96 s, que és la mesurada allà mateix.
 */

import { describe, expect, it } from 'vitest';
import {
  activeMarkIndex,
  createTimeline,
  isPlayable,
  markTime,
  offsetFromNowMs,
  sampleIndexForTime,
  timelineFromContacts,
  timelineProgress,
  timelineReduce,
  MAX_FRAME_MS,
  NUDGE_MS,
} from './playback';
import type { TimelineAction, TimelineState } from './types';

const C1 = Date.UTC(2026, 7, 12, 18, 30, 0);
const C2 = C1 + 52 * 60_000;
const MAX = C2 + 48_000;
const C3 = C2 + 96_100;
const C4 = C1 + 105 * 60_000;
const CONTACTS = { c1: C1, c2: C2, max: MAX, c3: C3, c4: C4 };

/** Un instant qualsevol molt anterior a l'eclipsi: el «avui» de qui l'estudia. */
const NOW_BEFORE = C1 - 400 * 24 * 3600_000;

function fresh(overrides: Partial<TimelineState> = {}): TimelineState {
  const { window, marks } = timelineFromContacts(CONTACTS);
  return { ...createTimeline({ window, marks, nowMs: NOW_BEFORE }), ...overrides };
}

/** Reprodueix una llista d'accions, com faria el bucle de fotogrames. */
function run(state: TimelineState, actions: TimelineAction[]): TimelineState {
  return actions.reduce(timelineReduce, state);
}

/** `n` fotogrames de `ms` reals, que és el que fa `requestAnimationFrame`. */
function frames(state: TimelineState, count: number, ms: number): TimelineState {
  let out = state;
  for (let i = 0; i < count; i++) {
    out = timelineReduce(out, { type: 'frame', deltaMs: ms, nowMs: NOW_BEFORE });
  }
  return out;
}

describe('timelineFromContacts', () => {
  it('la finestra va de C1 a C4 i les fites surten en ordre físic', () => {
    const { window, marks } = timelineFromContacts(CONTACTS);
    expect(window).toEqual({ startMs: C1, endMs: C4 });
    expect(marks.map((m) => m.id)).toEqual(['c1', 'c2', 'max', 'c3', 'c4']);
  });

  it('un eclipsi parcial no inventa C2 ni C3', () => {
    const { marks } = timelineFromContacts({ c1: C1, max: MAX, c4: C4 });
    expect(marks.map((m) => m.id)).toEqual(['c1', 'max', 'c4']);
    expect(markTime(marks, 'c2')).toBeNull();
  });

  it('sense contactes parcials la finestra es col·lapsa al màxim', () => {
    const { window, marks } = timelineFromContacts({ max: MAX });
    expect(window).toEqual({ startMs: MAX, endMs: MAX });
    expect(marks).toHaveLength(1);
    expect(isPlayable(createTimeline({ window, marks, nowMs: MAX }))).toBe(false);
  });
});

describe('arrencada', () => {
  it('per defecte s’obre en TEMPS REAL, amb l’hora que és', () => {
    const state = fresh();
    expect(state.source).toBe('live');
    expect(state.timeMs).toBe(NOW_BEFORE);
    expect(state.playing).toBe(false);
  });

  it('en temps real l’instant NO es capa a la finestra', () => {
    // L'eclipsi és d'aquí a més d'un any: l'hora que s'ensenya és la d'ara, no C1.
    const state = timelineReduce(fresh(), {
      type: 'frame',
      deltaMs: 1000,
      nowMs: NOW_BEFORE + 1000,
    });
    expect(state.timeMs).toBe(NOW_BEFORE + 1000);
    expect(timelineProgress(state)).toBe(0);
  });

  it('arrencant ja en simulació, l’instant entra dins de la finestra', () => {
    const { window, marks } = timelineFromContacts(CONTACTS);
    const state = createTimeline({ window, marks, nowMs: NOW_BEFORE, source: 'sim' });
    expect(state.timeMs).toBe(C1);
  });
});

describe('reproducció', () => {
  // La tolerància d'una dècima de mil·lisegon no és laxitud: és la precisió del
  // `double` a la magnitud d'un instant d'època, i el test de sota la mesura.
  it('a 1× un segon real és un segon d’eclipsi', () => {
    const state = frames(run(fresh(), [{ type: 'jump', mark: 'c1' }, { type: 'play' }]), 60, 1000 / 60);
    expect(state.timeMs - C1).toBeCloseTo(1000, 1);
  });

  it('a 60× un segon real són seixanta segons d’eclipsi', () => {
    const start = run(fresh(), [
      { type: 'jump', mark: 'c1' },
      { type: 'setRate', rate: 60 },
      { type: 'play' },
    ]);
    expect(frames(start, 60, 1000 / 60).timeMs - C1).toBeCloseTo(60_000, 1);
  });

  it('l’instant és flotant a posta: truncar-lo faria el simulador lent', () => {
    // 3600 fotogrames de 16,666… ms són un minut exacte. En flotant, la deriva
    // acumulada mesurada és de 0,29 ms al cap d'aquell minut: la precisió del
    // `double` a la magnitud d'un instant d'època (uns 0,0004 ms) multiplicada
    // per 3.600 sumes esbiaixades cap al mateix cantó.
    const start = run(fresh(), [{ type: 'jump', mark: 'c1' }, { type: 'play' }]);
    const drift = frames(start, 3600, 1000 / 60).timeMs - C1 - 60_000;
    expect(Math.abs(drift)).toBeLessThan(0.5);

    // I la variant amb enters, escrita aquí per si algú vol «netejar» el
    // flotant algun dia: el que es perd no és mig mil·lisegon sinó 2,4 s per
    // cada minut reproduït, perquè cada fotograma llença la seva fracció.
    let integer = C1;
    for (let i = 0; i < 3600; i++) integer = Math.trunc(integer + 1000 / 60);
    expect(integer - C1 - 60_000).toBe(-2400);
  });

  it('canviar de velocitat a mig camí canvia el pendent, no l’instant', () => {
    const half = frames(run(fresh(), [{ type: 'jump', mark: 'c1' }, { type: 'play' }]), 60, 100);
    const at = half.timeMs;

    const faster = timelineReduce(half, { type: 'setRate', rate: 300 });
    expect(faster.timeMs).toBe(at); // cap salt en canviar
    expect(faster.playing).toBe(true);

    expect(frames(faster, 1, 100).timeMs - at).toBe(30_000);
  });

  it('en pausa, un fotograma retorna EL MATEIX objecte', () => {
    // Identitat referencial: si no, React repinta el mapa seixanta cops per
    // segon amb la reproducció aturada.
    const paused = run(fresh(), [{ type: 'jump', mark: 'c1' }]);
    expect(timelineReduce(paused, { type: 'frame', deltaMs: 16, nowMs: NOW_BEFORE })).toBe(paused);
  });
});

describe('el final de la finestra', () => {
  it('arribar al final reproduint atura CLAVAT a C4', () => {
    const start = run(fresh(), [
      { type: 'jump', mark: 'c3' },
      { type: 'setRate', rate: 600 },
      { type: 'play' },
    ]);
    const end = frames(start, 500, 1000 / 60);
    expect(end.timeMs).toBe(C4);
    expect(end.playing).toBe(false);
  });

  it('no es passa ni fa la volta', () => {
    const start = run(fresh(), [{ type: 'seek', timeMs: C4 - 10 }, { type: 'setRate', rate: 600 }, { type: 'play' }]);
    const end = frames(start, 10, 100);
    expect(end.timeMs).toBe(C4);
    expect(timelineProgress(end)).toBe(1);
  });

  it('prémer «reprodueix» amb la barra al final rebobina', () => {
    const end = run(fresh(), [{ type: 'seek', timeMs: C4 }]);
    const again = timelineReduce(end, { type: 'play' });
    expect(again.timeMs).toBe(C1);
    expect(again.playing).toBe(true);
  });

  it('la reproducció no sobreviu al final per cap camí', () => {
    // El cas real és «avança un minut a trenta segons de C4»: la barra es planta
    // al final i el botó de pausa ha de quedar en pausa, no reproduint contra un
    // instant que ja no es mou.
    const playing = run(fresh(), [{ type: 'seek', timeMs: C4 - 30_000 }, { type: 'play' }]);
    expect(timelineReduce(playing, { type: 'nudge', deltaMs: NUDGE_MS }).playing).toBe(false);
    expect(timelineReduce(playing, { type: 'nudge', deltaMs: NUDGE_MS }).timeMs).toBe(C4);
    expect(timelineReduce(playing, { type: 'jump', mark: 'c4' }).playing).toBe(false);
    expect(timelineReduce(playing, { type: 'seek', timeMs: C4 }).playing).toBe(false);
  });

  it('amb la finestra col·lapsada no es pot reproduir res', () => {
    const { window, marks } = timelineFromContacts({ max: MAX });
    const state = createTimeline({ window, marks, nowMs: MAX });
    expect(timelineReduce(state, { type: 'play' })).toBe(state);
    expect(timelineReduce(state, { type: 'replay' })).toBe(state);
    expect(timelineReduce(state, { type: 'toggle' })).toBe(state);
  });
});

describe('la pestanya que torna de segon pla', () => {
  it('un fotograma gegant NO fa saltar l’eclipsi sencer', () => {
    // Tres minuts amagada a 600×: sense el límit, 108.000 s d'eclipsi de cop,
    // disset vegades la finestra, i la barra apareixeria clavada a C4.
    const start = run(fresh(), [
      { type: 'jump', mark: 'c1' },
      { type: 'setRate', rate: 600 },
      { type: 'play' },
    ]);
    const back = timelineReduce(start, { type: 'frame', deltaMs: 180_000, nowMs: NOW_BEFORE });

    expect(back.playing).toBe(true);
    expect(back.timeMs).toBe(C1 + MAX_FRAME_MS * 600);
    // El pitjor salt possible és el 2,4 % de la finestra, no el 100 %.
    expect(timelineProgress(back)).toBeLessThan(0.025);
  });

  it('a 1× el límit no es nota', () => {
    const start = run(fresh(), [{ type: 'jump', mark: 'c1' }, { type: 'play' }]);
    expect(timelineReduce(start, { type: 'frame', deltaMs: 200, nowMs: NOW_BEFORE }).timeMs).toBe(
      C1 + 200,
    );
  });

  it('un delta negatiu no fa recular la reproducció', () => {
    const start = run(fresh(), [{ type: 'jump', mark: 'max' }, { type: 'play' }]);
    expect(timelineReduce(start, { type: 'frame', deltaMs: -5000, nowMs: NOW_BEFORE })).toBe(start);
  });
});

describe('salts i passos', () => {
  it('el salt a un contacte hi cau exacte', () => {
    expect(timelineReduce(fresh(), { type: 'jump', mark: 'c2' }).timeMs).toBe(C2);
    expect(timelineReduce(fresh(), { type: 'jump', mark: 'max' }).timeMs).toBe(MAX);
  });

  it('saltar a un contacte que aquest eclipsi no té no fa res', () => {
    const { window, marks } = timelineFromContacts({ c1: C1, max: MAX, c4: C4 });
    const partial = createTimeline({ window, marks, nowMs: NOW_BEFORE, source: 'sim' });
    expect(timelineReduce(partial, { type: 'jump', mark: 'c2' })).toBe(partial);
  });

  it('el pas d’un minut no atura la reproducció', () => {
    const playing = run(fresh(), [{ type: 'jump', mark: 'c1' }, { type: 'play' }]);
    const nudged = timelineReduce(playing, { type: 'nudge', deltaMs: NUDGE_MS });
    expect(nudged.timeMs).toBe(C1 + NUDGE_MS);
    expect(nudged.playing).toBe(true);
  });

  it('arrossegar la barra SÍ que atura: el dit pren el control', () => {
    const playing = run(fresh(), [{ type: 'jump', mark: 'c1' }, { type: 'play' }]);
    expect(timelineReduce(playing, { type: 'seek', timeMs: MAX }).playing).toBe(false);
  });

  it('els passos i els arrossegaments es capen als extrems', () => {
    const atStart = run(fresh(), [{ type: 'jump', mark: 'c1' }]);
    expect(timelineReduce(atStart, { type: 'nudge', deltaMs: -NUDGE_MS }).timeMs).toBe(C1);
    expect(timelineReduce(atStart, { type: 'seek', timeMs: C1 - 10 * NUDGE_MS }).timeMs).toBe(C1);
    expect(timelineReduce(atStart, { type: 'seek', timeMs: C4 + 10 * NUDGE_MS }).timeMs).toBe(C4);
  });

  it('«torna a començar» rebobina i reprodueix d’una sola acció', () => {
    const state = timelineReduce(run(fresh(), [{ type: 'seek', timeMs: C3 }]), { type: 'replay' });
    expect(state.timeMs).toBe(C1);
    expect(state.playing).toBe(true);
  });
});

describe('temps real contra simulació', () => {
  it('qualsevol gest que mogui el temps commuta a simulació', () => {
    for (const action of [
      { type: 'play' },
      { type: 'toggle' },
      { type: 'replay' },
      { type: 'seek', timeMs: MAX },
      { type: 'nudge', deltaMs: NUDGE_MS },
      { type: 'jump', mark: 'c2' },
      { type: 'enterSim' },
    ] satisfies TimelineAction[]) {
      const state = timelineReduce(fresh(), action);
      expect(state.source, `${action.type} hauria de sortir del temps real`).toBe('sim');
    }
  });

  it('sortir del temps real entra dins de la finestra', () => {
    // Amb l'eclipsi d'aquí a un any, «avança un minut» no pot deixar-te a un any
    // i un minut vista: entrar a la simulació és entrar a la finestra.
    expect(timelineReduce(fresh(), { type: 'nudge', deltaMs: NUDGE_MS }).timeMs).toBe(C1 + NUDGE_MS);
  });

  it('entrar a la simulació et deixa a l’hora d’ara duta dins de la finestra', () => {
    const sim = timelineReduce(fresh(), { type: 'enterSim' });
    expect(sim.source).toBe('sim');
    expect(sim.playing).toBe(false);
    expect(sim.timeMs).toBe(C1);

    // I el dia de l'eclipsi, amb l'hora real ja dins de la finestra, no es mou:
    // s'entra a la simulació exactament on és el món.
    const during = timelineReduce(timelineReduce(fresh(), { type: 'goLive', nowMs: MAX }), {
      type: 'enterSim',
    });
    expect(during.timeMs).toBe(MAX);
    expect(during.source).toBe('sim');
  });

  it('només «torna a ara» recupera el temps real, i atura', () => {
    const simulating = run(fresh(), [{ type: 'jump', mark: 'c2' }, { type: 'play' }]);
    const live = timelineReduce(simulating, { type: 'goLive', nowMs: NOW_BEFORE + 5000 });
    expect(live.source).toBe('live');
    expect(live.playing).toBe(false);
    expect(live.timeMs).toBe(NOW_BEFORE + 5000);
  });

  it('en temps real la reproducció mai no corre', () => {
    const live = fresh();
    expect(live.playing).toBe(false);
    // I un fotograma en directe no la pot encendre.
    expect(
      timelineReduce(live, { type: 'frame', deltaMs: 1000, nowMs: NOW_BEFORE + 1000 }).playing,
    ).toBe(false);
  });

  it('l’instant del màxim en temps real NO es pot distingir per la xifra', () => {
    // El cas que justifica que `source` sigui estat explícit: a l'hora del
    // màxim, temps real i simulació ensenyen el mateix número. Si la distinció
    // es deduís de la xifra, diria «temps real» just quan costa un ull.
    const atMax = timelineReduce(fresh(), { type: 'goLive', nowMs: MAX });
    const simAtMax = timelineReduce(fresh(), { type: 'jump', mark: 'max' });
    expect(simAtMax.timeMs).toBe(atMax.timeMs);
    expect(offsetFromNowMs(atMax, MAX)).toBe(0);
    expect(offsetFromNowMs(simAtMax, MAX)).toBe(0);
    expect(atMax.source).not.toBe(simAtMax.source);
  });

  it('l’allunyament de l’hora real surt amb signe', () => {
    const ahead = timelineReduce(fresh(), { type: 'jump', mark: 'c2' });
    expect(offsetFromNowMs(ahead, C2 - 90_000)).toBe(90_000);
    expect(offsetFromNowMs(ahead, C2 + 90_000)).toBe(-90_000);
  });
});

describe('canvi de lloc o d’eclipsi', () => {
  const OTHER = { startMs: C1 + 30_000, endMs: C4 + 30_000 };

  it('conserva l’instant absolut, no la fracció recorreguda', () => {
    const simulating = run(fresh(), [{ type: 'jump', mark: 'max' }]);
    const moved = timelineReduce(simulating, { type: 'setWindow', window: OTHER, marks: [] });
    expect(moved.timeMs).toBe(MAX);
  });

  it('capa l’instant si la finestra nova ja no l’inclou', () => {
    const simulating = run(fresh(), [{ type: 'jump', mark: 'c1' }]);
    const moved = timelineReduce(simulating, { type: 'setWindow', window: OTHER, marks: [] });
    expect(moved.timeMs).toBe(OTHER.startMs);
  });

  it('no toca l’instant si s’està en temps real', () => {
    const moved = timelineReduce(fresh(), { type: 'setWindow', window: OTHER, marks: [] });
    expect(moved.timeMs).toBe(NOW_BEFORE);
    expect(moved.source).toBe('live');
  });

  it('una finestra idèntica retorna EL MATEIX objecte', () => {
    // Sense això, l'efecte del hook que vigila els contactes es despertaria a
    // cada render i tornaria a despatxar: bucle infinit de renders.
    const state = fresh();
    const same = timelineReduce(state, {
      type: 'setWindow',
      window: { ...state.window },
      marks: state.marks.map((m) => ({ ...m })),
    });
    expect(same).toBe(state);
  });
});

describe('selectors de pintat', () => {
  it('la fracció recorreguda va de 0 a 1 i es capa', () => {
    expect(timelineProgress(run(fresh(), [{ type: 'jump', mark: 'c1' }]))).toBe(0);
    expect(timelineProgress(run(fresh(), [{ type: 'jump', mark: 'c4' }]))).toBe(1);
    expect(timelineProgress(run(fresh(), [{ type: 'seek', timeMs: C1 + (C4 - C1) / 2 }]))).toBeCloseTo(0.5, 9);
  });

  it('abans del primer contacte l’índex de fita és −1, no 0', () => {
    const { marks } = timelineFromContacts(CONTACTS);
    expect(activeMarkIndex(marks, C1 - 1)).toBe(-1);
    expect(activeMarkIndex(marks, C1)).toBe(0);
    expect(activeMarkIndex(marks, MAX)).toBe(2);
    expect(activeMarkIndex(marks, C4 + 3600_000)).toBe(4);
  });

  it('durant la totalitat la fita activa és C2 i no el màxim', () => {
    const { marks } = timelineFromContacts(CONTACTS);
    expect(activeMarkIndex(marks, C2 + 1000)).toBe(1);
  });
});

describe('sampleIndexForTime', () => {
  const COUNT = 241; // 240 intervals: el que retorna `trajectorySamples`

  it('els extrems cauen exactes a la primera i a l’última mostra', () => {
    expect(sampleIndexForTime(C1, C1, C4, COUNT)).toBe(0);
    expect(sampleIndexForTime(C4, C1, C4, COUNT)).toBe(COUNT - 1);
  });

  it('fora de la finestra es capa, no dona un índex inexistent', () => {
    expect(sampleIndexForTime(C1 - 3600_000, C1, C4, COUNT)).toBe(0);
    expect(sampleIndexForTime(C4 + 3600_000, C1, C4, COUNT)).toBe(COUNT - 1);
  });

  it('una finestra col·lapsada o una sola mostra no divideixen per zero', () => {
    expect(sampleIndexForTime(MAX, MAX, MAX, COUNT)).toBe(0);
    expect(sampleIndexForTime(MAX, C1, C4, 1)).toBe(0);
  });

  it('el mig cau al mig', () => {
    expect(sampleIndexForTime(C1 + (C4 - C1) / 2, C1, C4, COUNT)).toBe(120);
  });
});
