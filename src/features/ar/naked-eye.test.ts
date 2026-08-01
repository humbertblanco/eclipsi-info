/**
 * La superposició de la càmera no pot autoritzar res des d'una barra.
 *
 * EL DEFECTE QUE ES TANCA AQUÍ. El rètol de seguretat de la vista de RA es
 * disparava amb `isTotality`, que surt de `currentSample`, que surt de la
 * POSICIÓ D'UNA BARRA que l'usuari arrossega. Arrossegar una barra no fa fosc.
 * El rètol es pinta damunt de la imatge de la càmera, en present i en
 * imperatiu —«Ara sí: mira-ho sense filtre»— mentre la persona apunta el
 * telèfon al Sol de debò. Dos dels cent seixanta-un passos del recorregut a
 * Oviedo satisfeien la condició, i el marcador de sota et diu on parar.
 *
 * La regla que substitueix allò té tres condicions i totes tres es proven
 * aquí: la comporta ha d'autoritzar, el rellotge de PARET ha de ser dins de la
 * finestra segura, i la barra no hi pinta res.
 */

import { describe, expect, it } from 'vitest';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import { canRemoveFilter, FILTER_OFF_DELAY_SEC } from '../../core/timer';
import type { LocalCircumstances } from '../../core/astro/types';

/** La mateixa condició que aplica `ARView`, extreta per poder-la provar. */
function nakedEyeAt(circumstances: LocalCircumstances, nowMs: number): boolean {
  const gate = canRemoveFilter({
    kind: circumstances.kind,
    contacts: {
      c1: circumstances.contacts.c1?.time.getTime(),
      c2: circumstances.contacts.c2?.time.getTime(),
      max: circumstances.contacts.max.time.getTime(),
      c3: circumstances.contacts.c3?.time.getTime(),
      c4: circumstances.contacts.c4?.time.getTime(),
    },
    edgeUncertain: circumstances.edgeUncertain,
  });
  if (!gate.allowed) return false;
  const c2 = circumstances.contacts.c2?.time.getTime();
  const c3 = circumstances.contacts.c3?.time.getTime();
  if (c2 === undefined || c3 === undefined) return false;
  return nowMs >= c2 + FILTER_OFF_DELAY_SEC * 1000 && nowMs <= c3 - 15_000;
}

/** Oviedo, a tocar de la línia central del 12-08-2026: 108 s de totalitat. */
const OVIEDO = computeLocalCircumstances('2026-08-12', {
  lat: 43.3619,
  lon: -5.8494,
  elevation: 232,
});

/** València, dins de l'anular del 26-01-2028: set minuts d'anell. */
const VALENCIA = computeLocalCircumstances('2028-01-26', {
  lat: 39.4699,
  lon: -0.3763,
  elevation: 15,
});

describe('quan es pot mirar sense filtre des de la vista de càmera', () => {
  const c2 = OVIEDO.contacts.c2!.time.getTime();
  const c3 = OVIEDO.contacts.c3!.time.getTime();

  it('al mig de la totalitat, sí', () => {
    expect(nakedEyeAt(OVIEDO, (c2 + c3) / 2)).toBe(true);
  });

  it('un dia abans, no —encara que la barra digui «totalitat»', () => {
    // Aquest és el cas de l'usuari que obre l'app per planificar i mou la
    // barra fins al màxim per veure com quedarà. Abans, això encenia el rètol.
    expect(nakedEyeAt(OVIEDO, c2 - 24 * 3600_000)).toBe(false);
  });

  it('a C2 clavat, encara no', () => {
    // El C2 calculat va sistemàticament avançat respecte del real; per això
    // hi ha dotze segons de marge, i per això aquest test existeix.
    expect(nakedEyeAt(OVIEDO, c2)).toBe(false);
    expect(nakedEyeAt(OVIEDO, c2 + FILTER_OFF_DELAY_SEC * 1000 - 500)).toBe(false);
    expect(nakedEyeAt(OVIEDO, c2 + FILTER_OFF_DELAY_SEC * 1000 + 500)).toBe(true);
  });

  it('quinze segons abans de C3, ja no', () => {
    expect(nakedEyeAt(OVIEDO, c3 - 16_000)).toBe(true);
    expect(nakedEyeAt(OVIEDO, c3 - 14_000)).toBe(false);
    expect(nakedEyeAt(OVIEDO, c3 + 1000)).toBe(false);
  });

  it('en un eclipsi ANULAR, mai, ni al mig de l’anell', () => {
    // L'anell que queda a la vista és fotosfera. La comporta ho para abans de
    // mirar cap rellotge.
    const a2 = VALENCIA.contacts.c2?.time.getTime();
    const a3 = VALENCIA.contacts.c3?.time.getTime();
    expect(VALENCIA.kind).toBe('annular');
    expect(a2).toBeDefined();
    expect(nakedEyeAt(VALENCIA, (a2! + a3!) / 2)).toBe(false);
  });

  it('al caire de la franja, tampoc', () => {
    // Sierra de Grazalema, 02-08-2027: el motor no pot decidir si hi haurà
    // totalitat, i la durada calculada (69 s) no faria saltar la comporta dels
    // quaranta segons. El que la fa saltar és la incertesa.
    const edge = computeLocalCircumstances('2027-08-02', {
      lat: 36.726,
      lon: -5.5,
      elevation: 100,
    });
    expect(edge.edgeUncertain).toBe(true);
    const e2 = edge.contacts.c2?.time.getTime();
    const e3 = edge.contacts.c3?.time.getTime();
    if (e2 !== undefined && e3 !== undefined) {
      expect(nakedEyeAt(edge, (e2 + e3) / 2)).toBe(false);
    }
  });
});
