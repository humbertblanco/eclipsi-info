/**
 * La invariant de la porta de seguretat, escombrada per força bruta.
 *
 * PER QUÈ AQUEST FITXER, SI JA HI HA `safety.test.ts` I `schedule.test.ts`.
 * Aquells proven casos concrets: l'anular, el parcial, la totalitat tapada pel
 * terreny. Cadascun demostra que una entrada dolenta no obre la porta. El que
 * cap d'ells no demostra és que NO N'HI HAGI CAP MÉS: que de tot l'espai
 * d'entrades possibles, les úniques que autoritzen a treure's el filtre siguin
 * exactament les que ho han de fer.
 *
 * Aquí es recorre la graella sencera —tipus d'eclipsi × durada de la fase
 * central × estat del terreny— i es comprova una sola equivalència, en tots dos
 * sentits:
 *
 *     hi ha avís de treure's el filtre  ⟺  kind = total
 *                                          i durada ≥ 20 s
 *                                          i el terreny no la tapa
 *
 * L'equivalència, i no la implicació, és el que importa: la implicació cap a
 * l'esquerra impedeix el dany a la retina; la implicació cap a la dreta
 * impedeix que un canvi ben intencionat deixi mut el guió d'algú que sí que hi
 * és a dins, i que aquell dia no ho sabrà fins que sigui tard.
 *
 * La graella hi posa a propòsit combinacions incoherents —un eclipsi «parcial»
 * amb segon i tercer contacte, un «anular» de quatre minuts— perquè la porta
 * no es pugui basar en què tenen C2 i C3, sinó en què són.
 */

import { describe, it, expect } from 'vitest';
import { buildAlertSchedule } from './schedule';
import { canRemoveFilter, MIN_TOTALITY_FOR_FILTER_OFF_SEC } from './safety';
import { filterOff } from './phrases';
import type { EclipseKind } from '../astro/types';
import type { ContactTimesMs } from './types';

const C1 = Date.UTC(2026, 7, 12, 18, 30, 0);
const C2 = Date.UTC(2026, 7, 12, 19, 30, 0);

const KINDS: EclipseKind[] = ['none', 'partial', 'annular', 'total'];
/** Zero vol dir sense C2 ni C3. La resta envolta el llindar dels vint segons. */
const CENTRAL_SEC = [0, 1, 19, 20, 21, 100, 240];
const TERRAIN: (boolean | undefined)[] = [undefined, true, false];

function contactsOf(centralSec: number): ContactTimesMs {
  if (centralSec <= 0) return { c1: C1, max: C2, c4: C2 + 3600_000 };
  const c3 = C2 + centralSec * 1000;
  return { c1: C1, c2: C2, max: C2 + (centralSec * 1000) / 2, c3, c4: c3 + 3600_000 };
}

/** L'única condició, escrita a mà i independent de la implementació. */
function shouldAllow(kind: EclipseKind, centralSec: number, terrain: boolean | undefined): boolean {
  return kind === 'total' && centralSec >= MIN_TOTALITY_FOR_FILTER_OFF_SEC && terrain !== false;
}

describe('la porta de seguretat, sobre tot l’espai d’entrades', () => {
  const cases: { kind: EclipseKind; centralSec: number; terrain: boolean | undefined }[] = [];
  for (const kind of KINDS) {
    for (const centralSec of CENTRAL_SEC) {
      for (const terrain of TERRAIN) cases.push({ kind, centralSec, terrain });
    }
  }

  it('recorre les combinacions que diu que recorre', () => {
    expect(cases).toHaveLength(KINDS.length * CENTRAL_SEC.length * TERRAIN.length);
  });

  it('la porta s’obre exactament quan ha d’obrir-se, i mai en cap altre cas', () => {
    for (const { kind, centralSec, terrain } of cases) {
      const gate = canRemoveFilter({
        kind,
        contacts: contactsOf(centralSec),
        centralPhaseVisible: terrain,
      });
      expect(gate.allowed, `${kind} · ${centralSec} s · terreny ${String(terrain)}`).toBe(
        shouldAllow(kind, centralSec, terrain),
      );
      // El motiu mai queda buit: la interfície l'ha de poder explicar.
      expect(gate.reason === 'ok').toBe(gate.allowed);
    }
  });

  it('l’avís de treure el filtre existeix si i només si la porta l’ha obert', () => {
    for (const { kind, centralSec, terrain } of cases) {
      const schedule = buildAlertSchedule({
        kind,
        contacts: contactsOf(centralSec),
        centralPhaseVisible: terrain,
      });
      const label = `${kind} · ${centralSec} s · terreny ${String(terrain)}`;
      const kinds = schedule.alerts.map((a) => a.kind);
      const expected = shouldAllow(kind, centralSec, terrain);

      expect(kinds.includes('filter-off'), label).toBe(expected);
      // I els avisos de tornar-se'l a posar van sempre aparellats amb ell: dir
      // «posa-te'l» sense haver dit mai «treu-te'l» sembra el dubte que en
      // algun moment tocava treure-se'l.
      expect(kinds.includes('filter-on'), label).toBe(expected);
    }
  });

  it('el text que autoritza no apareix enlloc quan la porta és tancada', () => {
    const authorising = filterOff();
    for (const { kind, centralSec, terrain } of cases) {
      if (shouldAllow(kind, centralSec, terrain)) continue;
      const schedule = buildAlertSchedule({
        kind,
        contacts: contactsOf(centralSec),
        centralPhaseVisible: terrain,
      });
      for (const alert of schedule.alerts) {
        expect(alert.speech.ca).not.toBe(authorising.speech.ca);
        expect(alert.speech.es).not.toBe(authorising.speech.es);
        expect(alert.speech.ca).not.toMatch(/pots treure/i);
        expect(alert.speech.es).not.toMatch(/puedes quitar/i);
        expect(alert.label.ca).not.toMatch(/filtre fora/i);
        expect(alert.label.es).not.toMatch(/filtro fuera/i);
      }
    }
  });

  it('quan la porta és oberta, l’ordre dels tres avisos és sempre el mateix', () => {
    for (const { kind, centralSec, terrain } of cases) {
      if (!shouldAllow(kind, centralSec, terrain)) continue;
      const contacts = contactsOf(centralSec);
      const schedule = buildAlertSchedule({ kind, contacts, centralPhaseVisible: terrain });
      const at = (id: string): number => {
        const found = schedule.alerts.find((a) => a.id === id);
        if (!found) throw new Error(`falta ${id} a ${kind} · ${centralSec} s`);
        return found.atMs;
      };

      const c2 = contacts.c2 as number;
      const c3 = contacts.c3 as number;
      expect(at('filter-off')).toBeGreaterThan(c2);
      expect(at('filter-off')).toBeLessThan(at('filter-on-15'));
      expect(at('filter-on-15')).toBeLessThan(at('filter-on-5'));
      expect(at('filter-on-5')).toBeLessThan(c3);
      // I l'autorització caduca abans del primer avís de seguretat, passi el
      // que passi amb la durada.
      expect(at('filter-off') + schedule.alerts.find((a) => a.id === 'filter-off')!.validForMs)
        .toBeLessThanOrEqual(at('filter-on-15'));
    }
  });
});
