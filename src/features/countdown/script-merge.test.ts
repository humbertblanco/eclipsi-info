/**
 * El guió de la totalitat ha d'arribar a la veu que de veritat sona.
 *
 * PER QUÈ AQUEST TEST. `src/content/totality-script.ts` va estar 1.600 línies
 * escrit i provat sense que cap camí de codi el cridés: els seus tests passaven
 * tots i cap usuari no en sentia mai una frase. El camí que corre el dia de
 * l'eclipsi és `useEclipseTimer`, i aquest fitxer reprodueix, camp per camp, la
 * programació que aquell ganxo munta —`buildAlertSchedule` més
 * `mergeScriptIntoSchedule`— amb circumstàncies reals. Si algú desfà la fusió,
 * el guió torna a ser lletra morta i això es posa vermell.
 *
 * El mateix estil que `timer-gate.test.ts`, i pel mateix motiu: els tests de
 * `src/content` entren pel guió directament i no vigilen qui el crida.
 */

import { describe, expect, it } from 'vitest';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import { buildAlertSchedule } from '../../core/timer';
import type { AlertSchedule } from '../../core/timer';
import {
  buildScriptRehearsal,
  buildTotalityScript,
  mergeScriptIntoSchedule,
} from '../../content/totality-script';
import type { TotalityScript } from '../../content/totality-script';

/** Tal com ho munta `useEclipseTimer`, camp per camp. */
function scheduleLikeTheHook(
  circumstances: ReturnType<typeof computeLocalCircumstances>,
  centralPhaseVisible = true,
): { base: AlertSchedule; script: TotalityScript; merged: AlertSchedule } {
  const { c1, c2, max, c3, c4 } = circumstances.contacts;
  const base = buildAlertSchedule({
    kind: circumstances.kind,
    contacts: {
      c1: c1?.time.getTime(),
      c2: c2?.time.getTime(),
      max: max.time.getTime(),
      c3: c3?.time.getTime(),
      c4: c4?.time.getTime(),
    },
    maxObscuration: max.obscuration,
    centralPhaseVisible,
    edgeUncertain: circumstances.edgeUncertain,
  });
  const script = buildTotalityScript({ circumstances, centralPhaseVisible });
  return { base, script, merged: mergeScriptIntoSchedule(base, script) };
}

describe('el guió de la totalitat entra a la programació del ganxo', () => {
  it('ben endins de la franja del 2026, les fites del guió sonen', () => {
    const c = computeLocalCircumstances('2026-08-12', {
      lat: 43.3619,
      lon: -5.8494,
      elevation: 232,
    });
    const { base, script, merged } = scheduleLikeTheHook(c);

    expect(script.variant).toBe('totality');

    // La fusió ha d'afegir fites de contingut de veritat, no tornar la
    // programació tal qual: això és exactament el que passava abans.
    const cues = merged.alerts.filter((a) => a.id.startsWith('script:'));
    expect(cues.length).toBeGreaterThan(0);
    expect(merged.alerts.length).toBeGreaterThan(base.alerts.length);

    // La corona és la fita que justifica el guió sencer i és essencial: si
    // s'ha perdut pel camí, la fusió descarta massa.
    const corona = merged.alerts.find((a) => a.id === 'script:corona');
    expect(corona).toBeDefined();

    // I arriba DESPRÉS de l'autorització de treure's el filtre, mai abans.
    const filterOff = merged.alerts.find((a) => a.kind === 'filter-off');
    expect(filterOff).toBeDefined();
    expect(corona!.atMs).toBeGreaterThan(filterOff!.atMs);

    // Els avisos de filtre són de la programació i el guió no els duplica:
    // dues veus dient «filtre» a instants diferents és el pitjor resultat
    // possible de la fusió.
    expect(merged.alerts.filter((a) => a.kind === 'filter-off')).toHaveLength(1);
    expect(merged.alerts.filter((a) => a.kind === 'filter-on')).toHaveLength(
      base.alerts.filter((a) => a.kind === 'filter-on').length,
    );

    // El reproductor recorre la llista en ordre; una fusió desordenada
    // canviaria l'ordre en què es parla.
    for (let i = 1; i < merged.alerts.length; i++) {
      expect(merged.alerts[i].atMs).toBeGreaterThanOrEqual(merged.alerts[i - 1].atMs);
    }

    // Cap fita del guió no pot trepitjar un avís de SEGURETAT: 3 s és
    // MERGE_SAFETY_GAP_MS a `totality-script.ts`.
    for (const cue of cues) {
      for (const alert of base.alerts) {
        if (alert.severity !== 'safety') continue;
        expect(Math.abs(alert.atMs - cue.atMs)).toBeGreaterThanOrEqual(3000);
      }
    }
  });

  it('al caire incert de Grazalema 2027, el guió no diu mai «treu-te el filtre»', () => {
    const c = computeLocalCircumstances('2027-08-02', {
      lat: 36.726,
      lon: -5.5,
      elevation: 100,
    });
    expect(c.edgeUncertain).toBe(true);

    const { script, merged } = scheduleLikeTheHook(c);

    // El guió sap per què no autoritza i ho diu, en comptes de callar.
    expect(script.variant).toBe('filtered');
    expect(merged.alerts.some((a) => a.id === 'script:why-filtered')).toBe(true);

    for (const alert of merged.alerts) {
      expect(alert.speech.ca).not.toMatch(/pots treure/i);
      expect(alert.speech.es).not.toMatch(/puedes quitarte/i);
    }
  });

  it("l'assaig del guió es construeix amb el mateix guió que sona en directe", () => {
    const inside = computeLocalCircumstances('2026-08-12', {
      lat: 43.3619,
      lon: -5.8494,
      elevation: 232,
    });
    const rehearsal = buildScriptRehearsal(scheduleLikeTheHook(inside).script, { startMs: 0 });

    expect(rehearsal.rehearsal).toBe(true);
    expect(rehearsal.alerts.some((a) => a.id === 'rehearsal:script:corona')).toBe(true);
    // L'assaig hereta la porta: dins de la franja, l'autorització hi és.
    expect(rehearsal.alerts.some((a) => /pots treure/i.test(a.speech.ca))).toBe(true);

    // I al punt on la porta no autoritza, l'assaig tampoc no la inventa.
    const edge = computeLocalCircumstances('2027-08-02', {
      lat: 36.726,
      lon: -5.5,
      elevation: 100,
    });
    const edgeRehearsal = buildScriptRehearsal(scheduleLikeTheHook(edge).script, { startMs: 0 });
    for (const alert of edgeRehearsal.alerts) {
      expect(alert.speech.ca).not.toMatch(/pots treure/i);
      expect(alert.speech.es).not.toMatch(/puedes quitarte/i);
    }
  });
});
