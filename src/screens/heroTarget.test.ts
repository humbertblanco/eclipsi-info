/**
 * Que el titular de la portada i el rellotge del costat no puguin discrepar.
 *
 * LA COMPARACIÓ ÉS EL PUNT. La regla d'aquest projecte diu que una cosa nova
 * s'ha de comparar amb la realitat, no amb ella mateixa: aquí la realitat és
 * `resolveCountdown()`, la funció que ja decideix cap a on compta
 * `CountdownView`. Per això el bucle no comprova que el titular digui una cosa
 * raonable sinó que digui EXACTAMENT la mateixa fita que ja diu l'altre
 * rellotge, instant per instant.
 *
 * AMB CIRCUMSTÀNCIES DE DEBÒ i no contactes fabricats: Sòria (dins de la
 * franja, amb C2 i C3) i Barcelona (99,8 % tapat i cap fase central), que és el
 * cas de la immensa majoria del trànsit. Es mostreja cada 5 s des de deu minuts
 * abans de C1 fins a deu minuts després de C4, o sigui que la passada creua
 * totes les frontères: C1, C2, el màxim, C3 i C4.
 *
 * ELS COMPTADORS NO SÓN DECORACIÓ. Un bucle que no corre cap vegada és una
 * prova verda que no ha provat res, i aquesta en té dos règims: si el compte de
 * mostres d'abans de la fita o el de després fos zero, la meitat de la prova
 * seria mentida. Per això es compten i s'exigeixen tots dos.
 */

import { describe, expect, it } from 'vitest';
import { computeLocalCircumstances } from '../core/astro/contacts';
import { resolveCountdown } from '../core/timer';
import type { ContactTimesMs } from '../core/timer';
import type { LocalCircumstances } from '../core/astro/types';
import { resolveHeroTarget } from './heroTarget';

const SAMPLE_MS = 5_000;
const MARGIN_MS = 10 * 60 * 1000;

/** L'etiqueta de sempre del titular; el text real surt de `strings.ts`. */
const BASE_LABEL = 'Fins a la totalitat';

function toContactMs(c: LocalCircumstances): ContactTimesMs {
  const { c1, c2, max, c3, c4 } = c.contacts;
  return {
    c1: c1?.time.getTime(),
    c2: c2?.time.getTime(),
    max: max.time.getTime(),
    c3: c3?.time.getTime(),
    c4: c4?.time.getTime(),
  };
}

/** El mateix objectiu fix que calcula la portada: C2 si n'hi ha, si no el màxim. */
function baseTargetOf(c: LocalCircumstances): number {
  return (c.contacts.c2 ?? c.contacts.max).time.getTime();
}

interface WalkCounts {
  before: number;
  after: number;
  /** Mostres en què ja no queda cap fita: passat C4. */
  exhausted: number;
}

/**
 * Recorre tot l'eclipsi i exigeix les dues meitats del contracte: abans de la
 * fita esperada, el titular no es mou del que ja feia; després, diu el mateix
 * que `resolveCountdown()`.
 */
function walkEclipse(circumstances: LocalCircumstances): WalkCounts {
  const contacts = toContactMs(circumstances);
  const { kind } = circumstances;
  const baseTargetMs = baseTargetOf(circumstances);

  const from = (circumstances.contacts.c1 ?? circumstances.contacts.max).time.getTime() - MARGIN_MS;
  const to = (circumstances.contacts.c4 ?? circumstances.contacts.max).time.getTime() + MARGIN_MS;

  const counts: WalkCounts = { before: 0, after: 0, exhausted: 0 };

  for (let nowMs = from; nowMs <= to; nowMs += SAMPLE_MS) {
    const hero = resolveHeroTarget(
      { contacts, kind, baseTargetMs, baseLabel: BASE_LABEL, locale: 'ca' },
      nowMs,
    );

    if (nowMs < baseTargetMs) {
      // La regla dura: aquí no canvia res respecte del que la pantalla ja feia.
      expect(hero.mode).toBe('base');
      expect(hero.targetMs).toBe(baseTargetMs);
      expect(hero.label).toBe(BASE_LABEL);
      counts.before += 1;
      continue;
    }

    const timer = resolveCountdown({ contacts, kind }, nowMs);
    expect(hero.mode).toBe('timer');
    expect(hero.targetMs).toBe(timer.atMs ?? null);
    expect(hero.label).toBe(timer.label.ca);
    counts.after += 1;
    if (hero.targetMs === null) counts.exhausted += 1;
  }

  return counts;
}

describe('el titular de la portada i el rellotge del costat', () => {
  it('des de Sòria, dins la franja, no ensenyen mai dues fites diferents', () => {
    const circumstances = computeLocalCircumstances('2026-08-12', {
      lat: 41.7665,
      lon: -2.479,
      elevation: 1063,
    });
    expect(circumstances.kind).toBe('total');
    expect(circumstances.contacts.c2).toBeDefined();
    expect(circumstances.contacts.c3).toBeDefined();
    expect(circumstances.contacts.c4).toBeDefined();

    const counts = walkEclipse(circumstances);
    // Un eclipsi sencer mostrejat cada 5 s: centenars de mostres a cada règim.
    expect(counts.before).toBeGreaterThan(100);
    expect(counts.after).toBeGreaterThan(100);
    expect(counts.exhausted).toBeGreaterThan(0);
  });

  it('des de Barcelona, només amb parcial, tampoc', () => {
    const circumstances = computeLocalCircumstances('2026-08-12', {
      lat: 41.3874,
      lon: 2.1686,
      elevation: 12,
    });
    // Sense fase central l'objectiu fix era el màxim, i és per això que la
    // contradicció la veia tothom qui és fora de la franja.
    expect(circumstances.kind).toBe('partial');
    expect(circumstances.contacts.c2).toBeUndefined();

    const counts = walkEclipse(circumstances);
    expect(counts.before).toBeGreaterThan(100);
    expect(counts.after).toBeGreaterThan(100);
  });
});

describe('les fites concretes que abans es contradeien', () => {
  const soria = computeLocalCircumstances('2026-08-12', {
    lat: 41.7665,
    lon: -2.479,
    elevation: 1063,
  });
  const contacts = toContactMs(soria);
  const input = {
    contacts,
    kind: soria.kind,
    baseTargetMs: baseTargetOf(soria),
    baseLabel: BASE_LABEL,
    locale: 'ca' as const,
  };

  it('trenta segons dins de la totalitat compta cap a C3 i no cap amunt des de C2', () => {
    const target = resolveHeroTarget(input, contacts.c2! + 30_000);
    expect(target.targetMs).toBe(contacts.c3);
    expect(target.label).toBe('Fi de la totalitat');
  });

  it('un segon abans de C2 el titular és exactament el d’abans d’aquest canvi', () => {
    const target = resolveHeroTarget(input, contacts.c2! - 1_000);
    expect(target.mode).toBe('base');
    expect(target.targetMs).toBe(contacts.c2);
    expect(target.label).toBe(BASE_LABEL);
  });

  it('entre C3 i C4 compta cap al final de l’eclipsi', () => {
    const target = resolveHeroTarget(input, contacts.c3! + 60_000);
    expect(target.targetMs).toBe(contacts.c4);
    expect(target.label).toBe('Fi de l’eclipsi');
  });

  it('passat C4 diu «Eclipsi acabat», que és el que diu l’altre rellotge, i cap número', () => {
    const nowMs = contacts.c4! + 5 * 60 * 1000;
    const target = resolveHeroTarget(input, nowMs);
    expect(target.targetMs).toBeNull();
    expect(target.label).toBe('Eclipsi acabat');
    // La comparació que importa: la mateixa frase que ensenya `CountdownView`.
    expect(target.label).toBe(resolveCountdown({ contacts, kind: soria.kind }, nowMs).label.ca);
  });
});
