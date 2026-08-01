/**
 * Tests de la porta de seguretat.
 *
 * Aquests tests protegeixen la propietat més important de tota l'aplicació: que
 * l'avís de treure's el filtre no es pugui emetre des d'un punt on encara hi ha
 * fotosfera visible. Si algun dia algun d'aquests tests falla, la resposta
 * correcta no és ajustar-lo: és desfer el canvi que l'ha trencat.
 */

import { describe, it, expect } from 'vitest';
import { canRemoveFilter, MIN_TOTALITY_FOR_FILTER_OFF_SEC } from './safety';
import type { ContactTimesMs } from './types';

const T0 = Date.UTC(2026, 7, 12, 19, 30, 0);

/** Joc de contactes amb una fase central de la durada que es demani. */
function contacts(centralSec: number): ContactTimesMs {
  const c2 = T0 + 3600_000;
  return {
    c1: T0,
    c2,
    max: c2 + (centralSec * 1000) / 2,
    c3: c2 + centralSec * 1000,
    c4: c2 + centralSec * 1000 + 3600_000,
  };
}

describe('canRemoveFilter', () => {
  it('autoritza una totalitat normal', () => {
    const gate = canRemoveFilter({ kind: 'total', contacts: contacts(100) });
    expect(gate.allowed).toBe(true);
    expect(gate.reason).toBe('ok');
    expect(gate.centralDurationSec).toBe(100);
  });

  it('no autoritza mai un eclipsi anular, encara que tingui C2 i C3', () => {
    // L'anell que queda a la vista és fotosfera. Aquest és el cas que més
    // fàcilment s'escaparia d'una comprovació feta amb «té C2 i C3?».
    const gate = canRemoveFilter({ kind: 'annular', contacts: contacts(240) });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe('annular');
  });

  it('no autoritza un eclipsi només parcial', () => {
    const gate = canRemoveFilter({
      kind: 'partial',
      contacts: { c1: T0, max: T0 + 3600_000, c4: T0 + 7200_000 },
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe('partial-only');
  });

  it('no autoritza res on no hi ha eclipsi', () => {
    const gate = canRemoveFilter({ kind: 'none', contacts: { max: T0 } });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe('no-eclipse');
  });

  it('no autoritza una totalitat sense C2 o sense C3', () => {
    expect(
      canRemoveFilter({ kind: 'total', contacts: { c1: T0, max: T0 + 100, c3: T0 + 200 } }).reason,
    ).toBe('missing-central-contacts');
    expect(
      canRemoveFilter({ kind: 'total', contacts: { c1: T0, c2: T0 + 100, max: T0 + 150 } }).reason,
    ).toBe('missing-central-contacts');
  });

  it('no autoritza una totalitat massa curta: som damunt del límit de la franja', () => {
    const gate = canRemoveFilter({
      kind: 'total',
      contacts: contacts(MIN_TOTALITY_FOR_FILTER_OFF_SEC - 1),
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe('totality-too-short');
  });

  it('autoritza just al llindar', () => {
    const gate = canRemoveFilter({
      kind: 'total',
      contacts: contacts(MIN_TOTALITY_FOR_FILTER_OFF_SEC),
    });
    expect(gate.allowed).toBe(true);
  });

  it('no autoritza si el terreny tapa la fase central', () => {
    const gate = canRemoveFilter({
      kind: 'total',
      contacts: contacts(100),
      centralPhaseVisible: false,
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe('central-blocked-by-terrain');
  });

  it('assumeix horitzó lliure quan no se li diu res del terreny', () => {
    // Per defecte `true`: si fos `false`, qui encara no hagi calculat el perfil
    // del terreny es quedaria sense avisos sense saber per què.
    expect(canRemoveFilter({ kind: 'total', contacts: contacts(100) }).allowed).toBe(true);
  });

  it('rebutja C3 anterior a C2 en comptes de calcular una durada negativa', () => {
    const c2 = T0 + 3600_000;
    const gate = canRemoveFilter({
      kind: 'total',
      contacts: { c1: T0, c2, max: c2, c3: c2 - 5000, c4: c2 + 3600_000 },
    });
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe('totality-too-short');
  });
});
