/**
 * Tests del generador d'avisos.
 *
 * Es proven tres coses: que hi siguin les fites que hi han de ser, que estiguin
 * a l'instant correcte, i —el que de veritat importa— que els avisos de treure
 * el filtre NO apareguin enlloc on no toca.
 */

import { describe, it, expect } from 'vitest';
import { buildAlertSchedule } from './schedule';
import { FILTER_OFF_DELAY_SEC } from './safety';
import type { AlertKind, ContactTimesMs, VoiceAlert } from './types';

const C1 = Date.UTC(2026, 7, 12, 18, 30, 0);
const C2 = Date.UTC(2026, 7, 12, 19, 30, 0);

/** Contactes d'una totalitat de la durada demanada, a partir de C1/C2 fixos. */
function totalContacts(centralSec: number): ContactTimesMs {
  const c3 = C2 + centralSec * 1000;
  return { c1: C1, c2: C2, max: C2 + (centralSec * 1000) / 2, c3, c4: c3 + 3600_000 };
}

function ids(alerts: VoiceAlert[]): string[] {
  return alerts.map((a) => a.id);
}

function kinds(alerts: VoiceAlert[]): AlertKind[] {
  return alerts.map((a) => a.kind);
}

function byId(alerts: VoiceAlert[], id: string): VoiceAlert {
  const found = alerts.find((a) => a.id === id);
  if (!found) throw new Error(`No hi ha cap avís amb id ${id}: ${ids(alerts).join(', ')}`);
  return found;
}

describe('buildAlertSchedule — totalitat des de dins de la franja', () => {
  const schedule = buildAlertSchedule({ kind: 'total', contacts: totalContacts(100) });

  it('canta les tres fites prèvies a C1 a 10, 5 i 1 minut', () => {
    expect(byId(schedule.alerts, 'c1-600').atMs).toBe(C1 - 600_000);
    expect(byId(schedule.alerts, 'c1-300').atMs).toBe(C1 - 300_000);
    expect(byId(schedule.alerts, 'c1-60').atMs).toBe(C1 - 60_000);
    expect(byId(schedule.alerts, 'c1').atMs).toBe(C1);
  });

  it('treu el filtre uns segons DESPRÉS del C2 calculat, mai abans', () => {
    const filterOff = byId(schedule.alerts, 'filter-off');
    expect(filterOff.atMs).toBe(C2 + FILTER_OFF_DELAY_SEC * 1000);
    expect(filterOff.atMs).toBeGreaterThan(C2);
    expect(filterOff.severity).toBe('safety');
  });

  it('posa els dos avisos de seguretat a 15 i 5 segons de C3', () => {
    const c3 = totalContacts(100).c3!;
    expect(byId(schedule.alerts, 'filter-on-15').atMs).toBe(c3 - 15_000);
    expect(byId(schedule.alerts, 'filter-on-5').atMs).toBe(c3 - 5_000);
    expect(byId(schedule.alerts, 'filter-on-15').severity).toBe('safety');
    expect(byId(schedule.alerts, 'filter-on-5').severity).toBe('safety');
  });

  it('l’avís de treure el filtre caduca abans del primer avís de seguretat', () => {
    // Si la pestanya es congela i es desperta tard, «ja et pots treure el
    // filtre» no s'ha de dir mai a tocar de C3.
    const filterOff = byId(schedule.alerts, 'filter-off');
    const firstSafety = byId(schedule.alerts, 'filter-on-15');
    expect(filterOff.atMs + filterOff.validForMs).toBeLessThanOrEqual(firstSafety.atMs);
  });

  it('l’últim avís de seguretat caduca abans de C3', () => {
    const c3 = totalContacts(100).c3!;
    const last = byId(schedule.alerts, 'filter-on-5');
    expect(last.atMs + last.validForMs).toBeLessThanOrEqual(c3);
  });

  it('torna la llista ordenada per instant', () => {
    const times = schedule.alerts.map((a) => a.atMs);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('el text de treure el filtre només surt a l’avís de treure el filtre', () => {
    const authorising = schedule.alerts.filter((a) => /pots treure/i.test(a.speech.ca));
    expect(ids(authorising)).toEqual(['filter-off']);
  });
});

describe('buildAlertSchedule — el filtre no es treu mai quan no toca', () => {
  const withoutFilterOff = (alerts: VoiceAlert[]) => {
    expect(kinds(alerts)).not.toContain('filter-off');
    expect(kinds(alerts)).not.toContain('filter-on');
    // Cap text, en cap dels dos idiomes, no pot autoritzar res.
    for (const alert of alerts) {
      expect(alert.speech.ca).not.toMatch(/pots treure/i);
      expect(alert.speech.es).not.toMatch(/puedes quitarte/i);
    }
  };

  it('eclipsi anular: mai, encara que tingui C2 i C3', () => {
    const schedule = buildAlertSchedule({ kind: 'annular', contacts: totalContacts(240) });
    expect(schedule.filterGate.reason).toBe('annular');
    withoutFilterOff(schedule.alerts);
    // Però sí que avisa que comença l'anularitat, amb el filtre posat.
    expect(byId(schedule.alerts, 'central-start').speech.ca).toMatch(/filtre es queda posat/i);
  });

  it('eclipsi parcial: mai', () => {
    const schedule = buildAlertSchedule({
      kind: 'partial',
      contacts: { c1: C1, max: C2, c4: C2 + 3600_000 },
      maxObscuration: 0.87,
    });
    expect(schedule.filterGate.reason).toBe('partial-only');
    withoutFilterOff(schedule.alerts);
    expect(byId(schedule.alerts, 'max').speech.ca).toMatch(/87 per cent/);
  });

  it('fora de la franja de totalitat el pla és el d’un parcial', () => {
    // «Fora de la franja» és exactament això: des d'aquest punt l'eclipsi és
    // parcial, no hi ha C2 ni C3, i per tant no hi ha res a treure's.
    const schedule = buildAlertSchedule({
      kind: 'partial',
      contacts: { c1: C1, max: C2, c4: C2 + 3600_000 },
    });
    withoutFilterOff(schedule.alerts);
    expect(kinds(schedule.alerts)).toContain('max');
  });

  it('totalitat rasant al límit de la franja: mai', () => {
    const schedule = buildAlertSchedule({ kind: 'total', contacts: totalContacts(8) });
    expect(schedule.filterGate.reason).toBe('totality-too-short');
    withoutFilterOff(schedule.alerts);
    // Ho ha de dir clarament en comptes de callar.
    expect(byId(schedule.alerts, 'central-start').speech.ca).toMatch(/no es treu/i);
  });

  it('totalitat tapada pel terreny: mai', () => {
    const schedule = buildAlertSchedule({
      kind: 'total',
      contacts: totalContacts(100),
      centralPhaseVisible: false,
    });
    expect(schedule.filterGate.reason).toBe('central-blocked-by-terrain');
    withoutFilterOff(schedule.alerts);
  });

  it('sense eclipsi no s’emet cap avís', () => {
    const schedule = buildAlertSchedule({ kind: 'none', contacts: { max: C2 } });
    expect(schedule.alerts).toEqual([]);
  });
});

describe('buildAlertSchedule — encaix dels avisos dins la totalitat', () => {
  it('no anuncia temps restant si no cap entre el filtre fora i el primer avís', () => {
    // Amb 41 s de totalitat i el retard de seguretat de 12 s, el filtre no surt
    // fins al segon 12, i «queden 30 segons» cauria al segon 11: abans que el
    // filtre hagi sortit, o sigui que no té sentit i s'ha de descartar.
    //
    // Aquest test feia servir 25 s, però la durada mínima per autoritzar treure
    // el filtre ha pujat de 20 a 40 s (vegeu `safety.ts`: el retard de dotze
    // segons deixava una totalitat de vint amb només vuit d'útils). Amb 25 s la
    // comporta ara denega i no hi ha cap avís de filtre a comprovar, que no és
    // el que aquest test vol mesurar.
    const schedule = buildAlertSchedule({ kind: 'total', contacts: totalContacts(41) });
    expect(ids(schedule.alerts)).not.toContain('central-remaining-30');
    expect(ids(schedule.alerts)).not.toContain('central-remaining-60');
    // Els de seguretat hi són igualment: són els que no es poden perdre.
    expect(ids(schedule.alerts)).toContain('filter-on-15');
    expect(ids(schedule.alerts)).toContain('filter-on-5');
  });

  it('amb dos minuts de totalitat sí que anuncia el temps restant', () => {
    const schedule = buildAlertSchedule({ kind: 'total', contacts: totalContacts(120) });
    expect(ids(schedule.alerts)).toContain('central-remaining-60');
    expect(ids(schedule.alerts)).toContain('central-remaining-30');
  });

  it('cap avís informatiu no cau damunt d’un avís de seguretat', () => {
    for (const centralSec of [20, 25, 40, 100, 120, 240]) {
      const schedule = buildAlertSchedule({ kind: 'total', contacts: totalContacts(centralSec) });
      const safety = schedule.alerts.filter((a) => a.severity === 'safety');
      const info = schedule.alerts.filter((a) => a.severity === 'info');
      for (const s of safety) {
        for (const i of info) {
          expect(Math.abs(s.atMs - i.atMs)).toBeGreaterThanOrEqual(1000);
        }
      }
    }
  });

  it('tots els avisos tenen identificador únic', () => {
    const schedule = buildAlertSchedule({ kind: 'total', contacts: totalContacts(100) });
    expect(new Set(ids(schedule.alerts)).size).toBe(schedule.alerts.length);
  });

  it('cada avís té text en els dos idiomes', () => {
    const schedule = buildAlertSchedule({ kind: 'total', contacts: totalContacts(100) });
    for (const alert of schedule.alerts) {
      expect(alert.speech.ca.length).toBeGreaterThan(0);
      expect(alert.speech.es.length).toBeGreaterThan(0);
      expect(alert.label.ca.length).toBeGreaterThan(0);
      expect(alert.label.es.length).toBeGreaterThan(0);
    }
  });
});
