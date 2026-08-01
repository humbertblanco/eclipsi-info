/**
 * La comporta del caire ha d'arribar al ganxo que de veritat parla.
 *
 * PER QUÈ AQUEST TEST I NO EL DE `core/timer`. Ja n'hi havia un
 * (`core/timer/edge-gate.test.ts`) que entrava per `scheduleFromCircumstances`
 * i passava. Però `scheduleFromCircumstances` no el crida ningú fora d'aquell
 * test: el camí que corre el dia de l'eclipsi és `useEclipseTimer`, que muntava
 * la llista a mà amb `buildAlertSchedule` i es deixava `edgeUncertain`. El
 * forat s'havia mogut una capa enfora i el test el mirava des de dins.
 *
 * Aquí es reprodueix el que fa el ganxo amb circumstàncies REALS d'un punt
 * mesurat al caire de la franja del 2027, on la durada calculada són 69 s i,
 * per tant, la comporta dels 40 segons NO emmascara res.
 */

import { describe, expect, it } from 'vitest';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import { buildAlertSchedule } from '../../core/timer';

/** Tal com les munta `useEclipseTimer`, camp per camp. */
function scheduleLikeTheHook(circumstances: ReturnType<typeof computeLocalCircumstances>) {
  const { c1, c2, max, c3, c4 } = circumstances.contacts;
  return buildAlertSchedule({
    kind: circumstances.kind,
    contacts: {
      c1: c1?.time.getTime(),
      c2: c2?.time.getTime(),
      max: max.time.getTime(),
      c3: c3?.time.getTime(),
      c4: c4?.time.getTime(),
    },
    maxObscuration: max.obscuration,
    centralPhaseVisible: true,
    edgeUncertain: circumstances.edgeUncertain,
  });
}

describe('la comporta del caire al ganxo del compte enrere', () => {
  it('a la Sierra de Grazalema, el 2027, no autoritza res', () => {
    const c = computeLocalCircumstances('2027-08-02', {
      lat: 36.726,
      lon: -5.5,
      elevation: 100,
    });

    expect(c.edgeUncertain).toBe(true);
    // La durada supera els 40 s: si la comporta salta, és per la incertesa i
    // no per la durada. Sense aquesta comprovació el test podria passar per
    // la raó equivocada.
    expect(c.centralDurationSec).toBeGreaterThan(40);

    const schedule = scheduleLikeTheHook(c);
    expect(schedule.filterGate.allowed).toBe(false);
    expect(schedule.filterGate.reason).toBe('edge-uncertain');

    for (const alert of schedule.alerts) {
      expect(alert.speech.ca).not.toMatch(/pots treure/i);
      expect(alert.speech.es).not.toMatch(/puedes quitarte/i);
    }
  });

  it('ben endins de la franja el mateix camí sí que autoritza', () => {
    const c = computeLocalCircumstances('2026-08-12', {
      lat: 43.3619,
      lon: -5.8494,
      elevation: 232,
    });
    expect(c.edgeUncertain).toBe(false);
    expect(scheduleLikeTheHook(c).filterGate.allowed).toBe(true);
  });
});
