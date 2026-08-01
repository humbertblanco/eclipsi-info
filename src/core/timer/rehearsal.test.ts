/**
 * Tests del mode d'assaig.
 *
 * El que s'ha de garantir és que l'assaig sigui una compressió FIDEL: el mateix
 * conjunt d'avisos, en el mateix ordre i amb la mateixa porta de seguretat.
 * Un assaig que digués coses que el dia real no es diran (o al revés) seria
 * pitjor que no tenir-ne.
 */

import { describe, it, expect } from 'vitest';
import { buildRehearsalSchedule, rehearsalDurationMs } from './rehearsal';
import { buildAlertSchedule } from './schedule';
import type { ContactTimesMs } from './types';

const C1 = Date.UTC(2026, 7, 12, 18, 30, 0);
const C2 = Date.UTC(2026, 7, 12, 19, 30, 0);
const START = Date.UTC(2026, 6, 1, 10, 0, 0);

function totalContacts(centralSec: number): ContactTimesMs {
  const c3 = C2 + centralSec * 1000;
  return { c1: C1, c2: C2, max: C2 + (centralSec * 1000) / 2, c3, c4: c3 + 3600_000 };
}

const real = buildAlertSchedule({ kind: 'total', contacts: totalContacts(100) });
const rehearsal = buildRehearsalSchedule(real, { startMs: START });

describe('buildRehearsalSchedule', () => {
  it('marca la programació com a assaig i l’anuncia al principi i al final', () => {
    expect(rehearsal.rehearsal).toBe(true);
    expect(rehearsal.alerts[0].kind).toBe('rehearsal-note');
    expect(rehearsal.alerts[rehearsal.alerts.length - 1].kind).toBe('rehearsal-note');
  });

  it('conserva tots els avisos reals i el seu ordre', () => {
    const compressed = rehearsal.alerts
      .filter((a) => a.kind !== 'rehearsal-note')
      .map((a) => a.id.replace('rehearsal:', ''));
    expect(compressed).toEqual(real.alerts.map((a) => a.id));
  });

  it('cap identificador no es pot confondre amb el d’un avís real', () => {
    for (const a of rehearsal.alerts) expect(a.id.startsWith('rehearsal:')).toBe(true);
  });

  it('dura aproximadament un minut', () => {
    const duration = rehearsalDurationMs(rehearsal);
    expect(duration).toBeGreaterThan(45_000);
    expect(duration).toBeLessThan(90_000);
  });

  it('respecta la separació mínima perquè la veu no es trepitgi', () => {
    for (let i = 1; i < rehearsal.alerts.length; i++) {
      expect(rehearsal.alerts[i].atMs - rehearsal.alerts[i - 1].atMs).toBeGreaterThanOrEqual(2500);
    }
  });

  it('escurça les finestres de validesa a la nova cadència', () => {
    // Amb els avisos a dos segons i mig, una finestra de trenta segons deixaria
    // que un avís endarrerit es digués damunt del següent.
    for (const a of rehearsal.alerts.filter((x) => x.kind !== 'rehearsal-note')) {
      expect(a.validForMs).toBeLessThanOrEqual(2000);
    }
  });

  it('la compressió logarítmica manté reconeixible la cadència de seguretat', () => {
    // Als avisos reals, entre C3−15 i C3−5 hi ha 10 s i entre C1 i C2 gairebé
    // una hora. Comprimit, el buit llarg no pot ser més de vint vegades el
    // curt, o el bloc de seguretat quedaria reduït a un espetec.
    const at = (id: string) => {
      const found = rehearsal.alerts.find((a) => a.id === `rehearsal:${id}`);
      if (!found) throw new Error(`falta ${id}`);
      return found.atMs;
    };
    const safetyGap = at('filter-on-5') - at('filter-on-15');
    const longGap = at('c2-60') - at('c1');
    expect(safetyGap).toBeGreaterThanOrEqual(2500);
    expect(longGap / safetyGap).toBeLessThan(20);
  });

  it('hereta la porta de seguretat: fora de la franja no assaja el filtre fora', () => {
    // La propietat crítica de tot aquest mode: l'assaig no pot ensenyar a
    // treure's el filtre a qui el dia real no se l'ha de treure.
    const partial = buildAlertSchedule({
      kind: 'partial',
      contacts: { c1: C1, max: C2, c4: C2 + 3600_000 },
    });
    const assaig = buildRehearsalSchedule(partial, { startMs: START });
    expect(assaig.filterGate.allowed).toBe(false);
    expect(assaig.alerts.map((a) => a.kind)).not.toContain('filter-off');
    for (const a of assaig.alerts) expect(a.speech.ca).not.toMatch(/pots treure/i);
  });

  it('no peta amb una programació buida', () => {
    const buit = buildAlertSchedule({ kind: 'none', contacts: { max: C2 } });
    const assaig = buildRehearsalSchedule(buit, { startMs: START });
    expect(assaig.alerts).toHaveLength(2);
  });
});
