/**
 * Tests del compte enrere: cap a quina fita es compta i com s'escriu.
 */

import { describe, it, expect } from 'vitest';
import { formatCountdown, resolveCountdown, splitDuration } from './countdown';
import type { ContactTimesMs } from './types';

const C1 = Date.UTC(2026, 7, 12, 18, 30, 0);
const C2 = Date.UTC(2026, 7, 12, 19, 30, 0);
const C3 = C2 + 100_000;
const C4 = C3 + 3600_000;
const CONTACTS: ContactTimesMs = { c1: C1, c2: C2, max: C2 + 50_000, c3: C3, c4: C4 };

describe('resolveCountdown', () => {
  it('abans de tot compta cap a C1', () => {
    const target = resolveCountdown({ contacts: CONTACTS, kind: 'total' }, C1 - 90_000);
    expect(target.phase).toBe('before');
    expect(target.anchor).toBe('c1');
    expect(target.remainingMs).toBe(90_000);
    expect(target.label.ca).toBe('Primer contacte');
  });

  it('durant la parcial creixent compta cap a C2', () => {
    const target = resolveCountdown({ contacts: CONTACTS, kind: 'total' }, C1 + 60_000);
    expect(target.phase).toBe('partial-rising');
    expect(target.anchor).toBe('c2');
    expect(target.label.ca).toBe('Totalitat');
  });

  it('dins la totalitat compta cap a C3, no cap al final de l’eclipsi', () => {
    // És la decisió que fa útil el número: el que et queda de corona.
    const target = resolveCountdown({ contacts: CONTACTS, kind: 'total' }, C2 + 40_000);
    expect(target.phase).toBe('central');
    expect(target.anchor).toBe('c3');
    expect(target.remainingMs).toBe(60_000);
    expect(target.label.ca).toBe('Fi de la totalitat');
  });

  it('canvia el nom de la fase per als anulars', () => {
    expect(resolveCountdown({ contacts: CONTACTS, kind: 'annular' }, C1 + 10).label.ca).toBe(
      'Anularitat',
    );
    expect(resolveCountdown({ contacts: CONTACTS, kind: 'annular' }, C2 + 10).label.ca).toBe(
      'Fi de l’anularitat',
    );
  });

  it('després de C3 compta cap a C4', () => {
    const target = resolveCountdown({ contacts: CONTACTS, kind: 'total' }, C3 + 1000);
    expect(target.phase).toBe('partial-falling');
    expect(target.anchor).toBe('c4');
  });

  it('quan s’ha acabat no compta enlloc', () => {
    const target = resolveCountdown({ contacts: CONTACTS, kind: 'total' }, C4 + 1);
    expect(target.phase).toBe('after');
    expect(target.anchor).toBeUndefined();
    expect(target.remainingMs).toBe(0);
  });

  it('sense fase central compta cap al màxim', () => {
    const partial: ContactTimesMs = { c1: C1, max: C2, c4: C4 };
    const target = resolveCountdown({ contacts: partial, kind: 'partial' }, C1 + 1000);
    expect(target.anchor).toBe('max');
    expect(target.label.ca).toBe('Màxim');
  });

  it('sense eclipsi no hi ha res a comptar', () => {
    const target = resolveCountdown({ contacts: { max: C2 }, kind: 'none' }, C1);
    expect(target.phase).toBe('after');
    expect(target.label.ca).toBe('Sense eclipsi');
  });

  it('no torna mai un temps restant negatiu', () => {
    const target = resolveCountdown({ contacts: CONTACTS, kind: 'total' }, C3 - 1);
    expect(target.remainingMs).toBeGreaterThanOrEqual(0);
  });
});

describe('splitDuration i formatCountdown', () => {
  it('arrodoneix cap amunt: no ensenya zero abans d’hora', () => {
    // Mig segon abans de C3 encara queda «1», no «0». Un compte enrere que
    // arriba a zero abans d'hora és el que fa que la gent es tregui el filtre
    // massa aviat.
    expect(splitDuration(500).totalSeconds).toBe(1);
    expect(splitDuration(1).seconds).toBe(1);
    expect(splitDuration(0).totalSeconds).toBe(0);
    expect(splitDuration(-5000).totalSeconds).toBe(0);
  });

  it('descompon hores, minuts i segons', () => {
    const parts = splitDuration(3_723_000);
    expect(parts).toMatchObject({ hours: 1, minutes: 2, seconds: 3 });
  });

  it('manté l’amplada del text mentre baixa', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(5000)).toBe('00:05');
    expect(formatCountdown(65_000)).toBe('01:05');
    expect(formatCountdown(600_000)).toBe('10:00');
    expect(formatCountdown(3_600_000)).toBe('1:00:00');
    expect(formatCountdown(3_723_000)).toBe('1:02:03');
  });
});

describe('el compte enrere de dies', () => {
  /*
   * L'usuari ho va veure a la pantalla: onze dies abans de l'eclipsi, la
   * targeta del primer contacte deia «265:52:17» i se sortia de la caixa. Nou
   * caràcters de xifra en cos gran no hi caben, i dues-centes seixanta-cinc
   * hores no les tradueix ningú a dies de cap.
   */
  it('per damunt del dia compta en dies i sense segons', () => {
    const ms = (11 * 24 + 2) * 3_600_000 + 48 * 60_000 + 17_000;
    expect(formatCountdown(ms)).toBe('11 d 02:48');
  });

  it('just per sota de vint-i-quatre hores encara no hi surten dies', () => {
    expect(formatCountdown(23 * 3_600_000 + 59 * 60_000 + 59_000)).toBe('23:59:59');
  });

  it('a partir de vint-i-quatre hores clavades ja hi surten', () => {
    expect(formatCountdown(24 * 3_600_000)).toBe('1 d 00:00');
  });

  it('el mode del dia de l’eclipsi no s’ha tocat', () => {
    expect(formatCountdown(3_600_000 + 2 * 60_000 + 3_000)).toBe('1:02:03');
    expect(formatCountdown(2 * 60_000 + 3_000)).toBe('02:03');
    expect(formatCountdown(0)).toBe('00:00');
  });

  it('cap format no passa d’onze caràcters', () => {
    // Onze és el pitjor cas real: l'eclipsi del 2028 a un any i mig vista dona
    // «543 d 12:34». La CSS dimensiona les xifres contra la seva caixa comptant
    // amb aquest sostre; si algú l'apuja, s'ha de tornar a mirar allà.
    const spans = [0, 59_000, 3_600_000, 86_399_000, 86_400_000, 700 * 86_400_000];
    for (const ms of spans) expect(formatCountdown(ms).length).toBeLessThanOrEqual(11);
  });
});
