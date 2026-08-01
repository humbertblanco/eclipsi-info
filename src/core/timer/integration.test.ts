/**
 * Prova d'extrem a extrem amb el motor astronòmic de debò.
 *
 * Els altres tests fabriquen contactes a mà, que és el que toca per provar la
 * lògica. Aquest agafa coordenades reals, hi passa `computeLocalCircumstances`
 * i comprova què se sent des de cada lloc. Serveix per validar l'adaptador i,
 * sobretot, per tenir escrit i executable el cas que ho justifica tot:
 *
 *   BARCELONA, 12 D'AGOST DE 2026. La Lluna en tapa el 99,8 %. Es fa fosc, es
 *   nota el fred, tothom del voltant crida. I queda fotosfera visible tota
 *   l'estona. Aquesta és la persona que no pot sentir mai «treu-te el filtre»,
 *   i és exactament la que més ho voldria sentir.
 */

import { describe, it, expect } from 'vitest';
import { computeLocalCircumstances } from '../astro/contacts';
import { scheduleFromCircumstances } from './schedule';
import type { AlertSchedule } from './types';

/** Cap avís, en cap idioma, no pot autoritzar a treure's res. */
function expectNoFilterRemoval(schedule: AlertSchedule): void {
  const kinds = schedule.alerts.map((a) => a.kind);
  expect(kinds).not.toContain('filter-off');
  expect(kinds).not.toContain('filter-on');
  for (const alert of schedule.alerts) {
    expect(alert.speech.ca).not.toMatch(/pots treure/i);
    expect(alert.speech.es).not.toMatch(/puedes quitarte/i);
  }
}

describe('eclipsi total del 12 d’agost de 2026', () => {
  it('des de Sòria, dins la franja, canta la totalitat sencera', () => {
    const circumstances = computeLocalCircumstances('2026-08-12', {
      lat: 41.7665,
      lon: -2.479,
      elevation: 1063,
    });
    expect(circumstances.kind).toBe('total');

    const schedule = scheduleFromCircumstances(circumstances);
    expect(schedule.filterGate.allowed).toBe(true);

    const ids = schedule.alerts.map((a) => a.id);
    expect(ids).toContain('c1-600');
    expect(ids).toContain('filter-off');
    expect(ids).toContain('filter-on-15');
    expect(ids).toContain('filter-on-5');

    // L'ordre no negociable: treure el filtre sempre després de C2, tornar-lo a
    // posar sempre abans de C3.
    const c2 = circumstances.contacts.c2!.time.getTime();
    const c3 = circumstances.contacts.c3!.time.getTime();
    const at = (id: string) => schedule.alerts.find((a) => a.id === id)!.atMs;
    expect(at('filter-off')).toBeGreaterThan(c2);
    expect(at('filter-on-15')).toBeLessThan(c3);
    expect(at('filter-on-5')).toBeLessThan(c3);
    expect(at('filter-off')).toBeLessThan(at('filter-on-15'));
  });

  it('des de Barcelona, amb el 99,8 % tapat, no diu mai que et treguis el filtre', () => {
    const circumstances = computeLocalCircumstances('2026-08-12', {
      lat: 41.3874,
      lon: 2.1686,
      elevation: 12,
    });
    // Gairebé total, però parcial: no hi ha ni C2 ni C3.
    expect(circumstances.kind).toBe('partial');
    expect(circumstances.contacts.max.obscuration).toBeGreaterThan(0.99);

    const schedule = scheduleFromCircumstances(circumstances);
    expect(schedule.filterGate.allowed).toBe(false);
    expect(schedule.filterGate.reason).toBe('partial-only');
    expectNoFilterRemoval(schedule);

    // I ho diu explícitament al màxim, que és quan la temptació és més forta.
    const max = schedule.alerts.find((a) => a.kind === 'max')!;
    expect(max.speech.ca).toMatch(/No et treguis el filtre/i);
  });
});

describe('eclipsi anular del 26 de gener de 2028', () => {
  it('des de València, dins la franja anular, el filtre no es treu mai', () => {
    const circumstances = computeLocalCircumstances('2028-01-26', {
      lat: 39.4699,
      lon: -0.3763,
      elevation: 15,
    });
    expect(circumstances.kind).toBe('annular');
    // Set minuts d'anularitat: temps de sobres perquè algú s'ho repensi.
    expect(circumstances.centralDurationSec).toBeGreaterThan(300);

    const schedule = scheduleFromCircumstances(circumstances);
    expect(schedule.filterGate.reason).toBe('annular');
    expectNoFilterRemoval(schedule);
    expect(schedule.alerts.find((a) => a.id === 'central-start')!.speech.ca).toMatch(
      /filtre es queda posat/i,
    );
  });
});

describe('el terreny també tanca la porta', () => {
  it('una totalitat tapada per una muntanya no genera cap avís de filtre fora', () => {
    const circumstances = computeLocalCircumstances('2026-08-12', {
      lat: 41.7665,
      lon: -2.479,
      elevation: 1063,
    });
    const schedule = scheduleFromCircumstances(circumstances, { centralPhaseVisible: false });
    expect(schedule.filterGate.reason).toBe('central-blocked-by-terrain');
    expectNoFilterRemoval(schedule);
  });
});
