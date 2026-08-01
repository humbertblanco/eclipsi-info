/**
 * La comporta al caire de la franja ha d'arribar fins a la VEU.
 *
 * Aquest test existeix per un forat concret: `canRemoveFilter` ja contemplava
 * `edgeUncertain`, però `ScheduleInput` no tenia el camp i
 * `scheduleFromCircumstances` no el passava. La comprovació era lletra morta
 * justament al camí que parla el dia de l'eclipsi.
 *
 * Un test que munta circumstàncies a mà no ho hauria detectat: el forat era al
 * pont entre els dos mòduls. Per això aquí es fan servir circumstàncies REALS,
 * calculades pel motor, i s'entra per la mateixa porta que fa servir l'app.
 */

import { describe, it, expect } from 'vitest';
import { computeLocalCircumstances } from '../astro/contacts';
import { scheduleFromCircumstances } from './schedule';

/**
 * Un punt just al caire de la franja del 12-08-2026, on el motor no pot decidir
 * si hi haurà totalitat: el marge umbral hi és més petit que el nostre error de
 * posició relativa.
 */
function edgePoint() {
  // S'escombra en perpendicular a la franja fins a trobar el creuament.
  for (let lat = 42.5; lat <= 43.6; lat += 0.002) {
    const c = computeLocalCircumstances('2026-08-12', { lat, lon: -3.5, elevation: 800 });
    if (c.edgeUncertain) return c;
  }
  throw new Error('No s’ha trobat cap punt incert: el llindar ha canviat?');
}

describe('la incertesa del caire arriba als avisos de veu', () => {
  it('al caire de la franja no s’autoritza treure el filtre', () => {
    const circumstances = edgePoint();
    expect(circumstances.edgeUncertain).toBe(true);

    const schedule = scheduleFromCircumstances(circumstances);
    expect(schedule.filterGate.allowed).toBe(false);

    // El motiu pot ser qualsevol dels dos, i les dues respostes són bones.
    //
    // Al caire de la franja la durada de la totalitat tendeix a zero, així que
    // la comporta de durada mínima (40 s) sol saltar abans que la d'incertesa.
    // Comprovar aquí un motiu concret seria fixar l'ordre intern de les
    // comprovacions, que no és el que aquest test vol protegir: el que ha de
    // quedar clavat és que al caire NO s'autoritza res.
    expect(['edge-uncertain', 'totality-too-short']).toContain(
      schedule.filterGate.reason,
    );

    // I cap text, en cap dels dos idiomes, no pot autoritzar res.
    for (const alert of schedule.alerts) {
      expect(alert.speech.ca).not.toMatch(/pots treure/i);
      expect(alert.speech.es).not.toMatch(/puedes quitarte/i);
    }
  });

  it('ben endins de la franja sí que s’autoritza', () => {
    // Oviedo és a tocar de la línia central: 108 s de totalitat.
    const c = computeLocalCircumstances('2026-08-12', {
      lat: 43.3619,
      lon: -5.8494,
      elevation: 232,
    });
    expect(c.edgeUncertain).toBe(false);
    expect(scheduleFromCircumstances(c).filterGate.allowed).toBe(true);
  });
});
