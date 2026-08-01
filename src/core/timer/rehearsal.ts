/**
 * Mode d'assaig: tota la seqüència d'avisos comprimida en un minut.
 *
 * PER QUÈ EXISTEIX. El dia de l'eclipsi no és el dia de descobrir com sona
 * l'app. L'assaig serveix per saber QUANTS avisos sentiràs, amb quina veu, a
 * quin volum i —sobretot— quins NO sentiràs: si ets fora de la franja de
 * totalitat, l'assaig no dirà mai «treu-te el filtre», i això és una cosa que
 * val la pena comprovar amb quinze dies d'antelació i no amb quinze segons.
 *
 * PER QUÈ ES COMPRIMEIX LA PROGRAMACIÓ REAL I NO SE'N FABRICA UNA DE FALSA:
 * així l'assaig hereta la porta de seguretat sencera. No hi ha cap camí de codi
 * pel qual l'assaig pugui dir una cosa que la programació real no diria.
 *
 * COM ES COMPRIMEIX. Una compressió lineal no serviria: entre C1 i C2 hi ha una
 * hora i entre els dos avisos de seguretat hi ha deu segons; escalant-ho tot
 * pel mateix factor, els avisos de seguretat quedarien a mil·lisegons l'un de
 * l'altre i l'assaig no ensenyaria res del que importa. Els buits es reparteixen
 * amb un pes logarítmic:
 *
 *     pes = log(1 + buit_real / 10 s)
 *
 * Una hora pesa 5,9 i deu segons pesen 0,69: només vuit vegades més, en comptes
 * de tres-centes seixanta. La cadència del bloc de seguretat es reconeix, i les
 * esperes llargues no s'emporten el minut.
 *
 * Pur i sense DOM.
 */

import * as phrases from './phrases';
import type { AlertSchedule, VoiceAlert } from './types';

export interface RehearsalOptions {
  /** Instant en què comença l'assaig, en ms des de l'època (escala del rellotge). */
  startMs: number;
  /** Durada objectiu. Per defecte un minut. */
  durationMs?: number;
  /**
   * Separació mínima entre avisos. Per sota d'això la veu es trepitja: una
   * frase de les nostres es diu en uns dos segons.
   */
  minGapMs?: number;
}

const DEFAULT_DURATION_MS = 60_000;
const DEFAULT_MIN_GAP_MS = 2_500;
/** Buit de referència de la compressió logarítmica. */
const REFERENCE_GAP_MS = 10_000;
/** Temps entre la locució d'obertura i el primer avís real. */
const LEAD_IN_MS = 3_000;

/**
 * Comprimeix una programació real en una seqüència d'assaig.
 *
 * Els identificadors es prefixen amb `rehearsal:` perquè un reproductor no
 * pugui confondre un avís d'assaig ja emès amb el seu equivalent real.
 *
 * LIMITACIÓ CONEGUDA: si la programació té més avisos dels que caben al minut
 * respectant la separació mínima, l'assaig dura més d'un minut. És deliberat:
 * val més un assaig de setanta segons que dues frases superposades, que és
 * precisament el defecte que l'assaig ha de detectar.
 */
export function buildRehearsalSchedule(
  schedule: AlertSchedule,
  options: RehearsalOptions,
): AlertSchedule {
  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
  const minGapMs = options.minGapMs ?? DEFAULT_MIN_GAP_MS;
  const source = [...schedule.alerts].sort((a, b) => a.atMs - b.atMs);

  const intro = note('rehearsal-start', options.startMs, phrases.rehearsalStart());

  if (source.length === 0) {
    return {
      alerts: [intro, note('rehearsal-end', options.startMs + minGapMs, phrases.rehearsalEnd())],
      filterGate: schedule.filterGate,
      rehearsal: true,
    };
  }

  // Pes de cada buit real. `log1p` perquè un buit de zero pesi zero i no −∞.
  const weights: number[] = [];
  for (let i = 1; i < source.length; i++) {
    weights.push(Math.log1p(Math.max(0, source[i].atMs - source[i - 1].atMs) / REFERENCE_GAP_MS));
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);

  // El que queda per repartir un cop reservats l'entrada i el comiat.
  const budgetMs = Math.max(0, durationMs - LEAD_IN_MS - minGapMs);

  const gaps = weights.map((w) =>
    Math.max(minGapMs, weightSum > 0 ? (budgetMs * w) / weightSum : budgetMs / weights.length),
  );

  const alerts: VoiceAlert[] = [intro];
  let at = options.startMs + LEAD_IN_MS;

  for (let i = 0; i < source.length; i++) {
    if (i > 0) at += gaps[i - 1];
    const original = source[i];
    alerts.push({
      ...original,
      id: `rehearsal:${original.id}`,
      atMs: Math.round(at),
      // La finestra de validesa també s'encongeix: amb els avisos a dos segons
      // i mig, una finestra de trenta segons deixaria que un avís endarrerit es
      // digués damunt del següent.
      validForMs: Math.min(original.validForMs, Math.max(0, minGapMs - 500)),
    });
  }

  alerts.push(note('rehearsal-end', Math.round(at) + minGapMs, phrases.rehearsalEnd()));

  return { alerts, filterGate: schedule.filterGate, rehearsal: true };
}

/** Locució de context de l'assaig. No correspon a cap fita de l'eclipsi. */
function note(id: string, atMs: number, text: phrases.AlertText): VoiceAlert {
  return {
    id: `rehearsal:${id}`,
    atMs,
    anchor: 'rehearsal',
    offsetSec: 0,
    kind: 'rehearsal-note',
    severity: 'info',
    validForMs: 5_000,
    speech: text.speech,
    label: text.label,
  };
}

/** Durada real d'un assaig ja construït, en ms. Útil per ensenyar-ho i per provar-ho. */
export function rehearsalDurationMs(schedule: AlertSchedule): number {
  if (schedule.alerts.length === 0) return 0;
  const first = schedule.alerts[0].atMs;
  const last = schedule.alerts[schedule.alerts.length - 1].atMs;
  return last - first;
}
