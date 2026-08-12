/**
 * Tests del reproductor i del rellotge monòton.
 *
 * Es proven amb un entorn de temps virtual: un rellotge que avança quan
 * nosaltres volem i uns temporitzadors que podem servir tard a propòsit. Sense
 * això no es pot demostrar la propietat que ens importa —que l'error no
 * s'acumula— sense esperar hores de rellotge real.
 */

import { describe, it, expect, vi } from 'vitest';
import { createMonotonicClock } from './clock';
import type { MonotonicClock } from './clock';
import { createAlertRunner } from './runner';
import type { TimerFns } from './runner';
import type { VoiceAlert } from './types';

const T0 = Date.UTC(2026, 7, 12, 19, 0, 0);

function alert(id: string, atMs: number, validForMs = 30_000): VoiceAlert {
  return {
    id,
    atMs,
    anchor: 'c2',
    offsetSec: 0,
    kind: 'central-remaining',
    severity: 'info',
    validForMs,
    speech: { ca: id, es: id, en: id, fr: id },
    label: { ca: id, es: id, en: id, fr: id },
  };
}

interface FakeEnv {
  timers: TimerFns;
  clock: MonotonicClock;
  /** Avança el temps servint els temporitzadors, opcionalment amb retard. */
  advance: (ms: number, lagMs?: number) => void;
  /** Avança el temps SENSE servir res: simula una pestanya congelada. */
  freeze: (ms: number) => void;
}

function createFakeEnv(startMs: number): FakeEnv {
  let now = startMs;
  let seq = 0;
  let pending: { id: number; at: number; cb: () => void }[] = [];

  const timers: TimerFns = {
    setTimer: (cb, delayMs) => {
      const id = ++seq;
      pending.push({ id, at: now + Math.max(0, delayMs), cb });
      return id;
    },
    clearTimer: (handle) => {
      pending = pending.filter((p) => p.id !== handle);
    },
  };

  const clock: MonotonicClock = {
    now: () => now,
    driftMs: () => 0,
    resync: () => false,
  };

  return {
    timers,
    clock,
    advance(ms, lagMs = 0) {
      const target = now + ms;
      for (let guard = 0; guard < 100_000; guard++) {
        pending.sort((a, b) => a.at - b.at);
        const next = pending[0];
        if (!next || next.at > target) break;
        pending.shift();
        // El navegador serveix el temporitzador tard: aquest és el retard que
        // un encadenament de `setTimeout` aniria acumulant.
        now = Math.max(now, next.at + lagMs);
        next.cb();
      }
      now = Math.max(now, target);
    },
    freeze(ms) {
      now += ms;
    },
  };
}

describe('createAlertRunner — puntualitat', () => {
  it('no acumula error encara que cada temporitzador arribi tard', () => {
    const env = createFakeEnv(T0);
    // Deu fites separades deu segons: prou perquè un encadenament acumulés
    // desenes de retards abans de l'última.
    const alerts = Array.from({ length: 10 }, (_, i) => alert(`a${i}`, T0 + (i + 1) * 10_000));
    const fired: { id: string; lateByMs: number }[] = [];

    const runner = createAlertRunner({
      alerts,
      clock: env.clock,
      timers: env.timers,
      onAlert: (e) => fired.push({ id: e.alert.id, lateByMs: e.lateByMs }),
    });

    runner.start();
    env.advance(120_000, 30); // cada despertar arriba 30 ms tard

    expect(fired.map((f) => f.id)).toEqual(alerts.map((a) => a.id));
    // Cap avís no arriba amb més retard que el d'un sol temporitzador. Si es
    // rearmés sumant intervals, l'últim arribaria amb segons de retard.
    for (const f of fired) expect(f.lateByMs).toBeLessThanOrEqual(35);
    // I l'últim no va pitjor que el primer: no hi ha deriva.
    expect(fired[fired.length - 1].lateByMs).toBeLessThanOrEqual(fired[0].lateByMs + 5);
    runner.stop();
  });

  it('emet en ordre i resol cada avís una sola vegada', () => {
    const env = createFakeEnv(T0);
    const alerts = [alert('c', T0 + 30_000), alert('a', T0 + 10_000), alert('b', T0 + 20_000)];
    const fired: string[] = [];

    const runner = createAlertRunner({
      alerts,
      clock: env.clock,
      timers: env.timers,
      onAlert: (e) => fired.push(e.alert.id),
    });
    runner.start();
    env.advance(60_000);

    expect(fired).toEqual(['a', 'b', 'c']);
    expect(runner.resolvedIds().size).toBe(3);
    runner.stop();
  });

  it('bat encara que no quedi cap avís pendent', () => {
    const env = createFakeEnv(T0);
    const onTick = vi.fn();
    const runner = createAlertRunner({
      alerts: [],
      clock: env.clock,
      timers: env.timers,
      heartbeatMs: 1000,
      onAlert: () => {},
      onTick,
    });
    runner.start();
    env.advance(5000);
    // Un batec inicial i un per segon: la pantalla ha de continuar comptant.
    expect(onTick.mock.calls.length).toBeGreaterThanOrEqual(5);
    runner.stop();
  });
});

describe('createAlertRunner — pestanya congelada', () => {
  it('descarta els avisos que ja no són certs i emet els que encara ho són', () => {
    const env = createFakeEnv(T0);
    const caduc = alert('caduc', T0 + 10_000, 3000);
    const vigent = alert('vigent', T0 + 20_000, 60_000);
    const fired: string[] = [];
    const skipped: string[] = [];

    const runner = createAlertRunner({
      alerts: [caduc, vigent],
      clock: env.clock,
      timers: env.timers,
      onAlert: (e) => fired.push(e.alert.id),
      onSkip: (a) => skipped.push(a.id),
    });
    runner.start();

    // El sistema ens congela mig minut: quan tornem, tots dos han vençut.
    env.freeze(30_000);
    runner.poll();

    expect(skipped).toEqual(['caduc']);
    expect(fired).toEqual(['vigent']);
    runner.stop();
  });

  it('no diu mai «treu-te el filtre» fora de la seva finestra', () => {
    // Aquest és el cas real: la pantalla s'apaga durant la totalitat i el
    // navegador ens desperta quan el Sol ja ha tornat.
    const env = createFakeEnv(T0);
    const filterOff = alert('filter-off', T0 + 5000, 3000);
    const fired: string[] = [];
    const skipped: { id: string; reason: string }[] = [];

    const runner = createAlertRunner({
      alerts: [filterOff],
      clock: env.clock,
      timers: env.timers,
      onAlert: (e) => fired.push(e.alert.id),
      onSkip: (a, reason) => skipped.push({ id: a.id, reason }),
    });
    runner.start();
    env.freeze(60_000);
    runner.poll();

    expect(fired).toEqual([]);
    expect(skipped).toEqual([{ id: 'filter-off', reason: 'expired' }]);
    runner.stop();
  });

  it('en arrencar tard emet el que encara és vigent', () => {
    const env = createFakeEnv(T0 + 2000);
    const fired: string[] = [];
    const runner = createAlertRunner({
      alerts: [alert('recent', T0, 30_000), alert('vell', T0 - 300_000, 30_000)],
      clock: env.clock,
      timers: env.timers,
      onAlert: (e) => fired.push(e.alert.id),
    });
    runner.start();
    expect(fired).toEqual(['recent']);
    runner.stop();
  });

  it('atura els temporitzadors en parar', () => {
    const env = createFakeEnv(T0);
    const fired: string[] = [];
    const runner = createAlertRunner({
      alerts: [alert('a', T0 + 10_000)],
      clock: env.clock,
      timers: env.timers,
      onAlert: (e) => fired.push(e.alert.id),
    });
    runner.start();
    runner.stop();
    env.advance(60_000);
    expect(fired).toEqual([]);
    expect(runner.running()).toBe(false);
  });
});

describe('createMonotonicClock', () => {
  it('ignora els salts del rellotge del sistema', () => {
    let wall = T0;
    let mono = 1000;
    const clock = createMonotonicClock({ wallNow: () => wall, monotonicNow: () => mono });

    mono += 5000;
    wall += 5000;
    expect(clock.now()).toBe(T0 + 5000);

    // Sincronització NTP: el sistema salta dos segons endavant. El nostre
    // rellotge no s'ha de moure, o el compte enrere faria un bot.
    wall += 2000;
    expect(clock.now()).toBe(T0 + 5000);
    expect(clock.driftMs()).toBe(2000);
  });

  it('re-ancora quan la deriva supera la tolerància', () => {
    let wall = T0;
    let mono = 0;
    const clock = createMonotonicClock({
      wallNow: () => wall,
      monotonicNow: () => mono,
      toleranceMs: 500,
    });

    mono += 1000;
    wall += 2000; // el sistema se n'ha anat un segon respecte del nostre comptador
    expect(clock.resync()).toBe(true);
    expect(clock.now()).toBe(T0 + 2000);
    expect(clock.driftMs()).toBe(0);
  });

  it('no re-ancora per una deriva petita', () => {
    let wall = T0;
    let mono = 0;
    const clock = createMonotonicClock({
      wallNow: () => wall,
      monotonicNow: () => mono,
      toleranceMs: 500,
    });
    mono += 1000;
    wall += 1100;
    expect(clock.resync()).toBe(false);
    expect(clock.now()).toBe(T0 + 1000);
  });
});

/*
 * EL MÒBIL QUE DORM A LA BUTXACA.
 *
 * Aquest bloc no fa servir el rellotge fals de dalt: fa servir
 * `createMonotonicClock` DE DEBÒ amb els seus dos rellotges injectats. És a
 * posta. El simulacre de `createFakeEnv` porta `resync: () => false`, o sigui
 * que una prova del re-ancoratge escrita amb ell s'estaria assertant damunt del
 * seu propi doble i passaria igual amb el codi trencat.
 *
 * El que es reprodueix aquí és el que fan iOS i Android de veritat:
 * `performance.now()` NO AVANÇA MENTRE L'APARELL DORM. Es simula deixant quiet
 * el rellotge monòton mentre el de paret avança.
 */
describe('createAlertRunner — l’aparell ha dormit', () => {
  /** Temporitzadors que anoten i no disparen mai: aquí manen `poll()` i el rellotge. */
  function inertTimers(): TimerFns {
    let seq = 0;
    return { setTimer: () => ++seq, clearTimer: () => undefined };
  }

  it('en tornar de segon pla no diu tard el que ja no toca', () => {
    let wall = T0;
    let mono = 0;
    const clock = createMonotonicClock({ wallNow: () => wall, monotonicNow: () => mono });

    // Un avís curt de debò: els de seguretat en tenen entre 3 i 10 segons.
    const filtre = alert('posa-t-el-filtre', T0 + 30_000, 5_000);
    const fired: string[] = [];
    const skipped: string[] = [];

    const runner = createAlertRunner({
      alerts: [filtre],
      clock,
      timers: inertTimers(),
      onAlert: (e) => fired.push(e.alert.id),
      onSkip: (a) => skipped.push(a.id),
    });
    runner.start();
    expect(fired).toEqual([]);

    // Dos minuts a la butxaca: el món avança, el rellotge monòton no.
    wall += 120_000;
    expect(clock.now()).toBe(T0);

    runner.poll();

    // El rellotge ha de tornar a l'hora de debò...
    expect(runner.now()).toBe(T0 + 120_000);
    // ...i l'avís, que fa 85 segons que ha caducat, s'ha de descartar.
    // Sense el re-ancoratge sonaria com si fos ara, amb la fotosfera a fora.
    expect(fired).toEqual([]);
    expect(skipped).toEqual(['posa-t-el-filtre']);
  });

  it('el que encara és cert després de dormir, es diu', () => {
    let wall = T0;
    let mono = 0;
    const clock = createMonotonicClock({ wallNow: () => wall, monotonicNow: () => mono });

    // Marge ample: «el Sol ha tornat» val un minut sencer.
    const tornada = alert('el-sol-ha-tornat', T0 + 30_000, 60_000);
    const fired: string[] = [];
    const skipped: string[] = [];

    const runner = createAlertRunner({
      alerts: [tornada],
      clock,
      timers: inertTimers(),
      onAlert: (e) => fired.push(e.alert.id),
      onSkip: (a) => skipped.push(a.id),
    });
    runner.start();

    wall += 45_000;
    runner.poll();

    expect(fired).toEqual(['el-sol-ha-tornat']);
    expect(skipped).toEqual([]);
  });
});
