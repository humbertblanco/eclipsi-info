/**
 * Les proves del consentiment.
 *
 * El que es prova aquí és UNA decisió: què compta com a permís per posar una
 * galeta. Per això no hi ha cap test que comprovi que `serializeConsent` escriu
 * JSON —això és el format, no la decisió— i sí que n'hi ha sis que ataquen la
 * clau desada de sis maneres diferents. Totes han d'acabar al mateix lloc.
 */

import { describe, expect, it } from 'vitest';
import {
  CONSENT_FUTURE_TOLERANCE_MS,
  CONSENT_MAX_AGE_MS,
  analyticsStorage,
  needsDecision,
  parseConsent,
  serializeConsent,
} from './consent';

/** Un instant qualsevol amb nom, per no llegir números crus als tests. */
const ARA = Date.UTC(2026, 7, 4, 12, 0, 0);

describe('un sí es recorda, i es recorda amb data', () => {
  it('«el que s’ha desat es torna a llegir igual»', () => {
    const raw = serializeConsent('granted', ARA);
    expect(parseConsent(raw, ARA)).toBe('granted');
  });

  it('«un no també es recorda: no tornar a preguntar és part del respecte»', () => {
    // El cas que és fàcil de fer malament: desar només els «sí» faria que a qui
    // ha dit que no se li repetís el bàner a cada visita.
    const raw = serializeConsent('denied', ARA);
    expect(parseConsent(raw, ARA)).toBe('denied');
    expect(needsDecision(parseConsent(raw, ARA))).toBe(false);
  });
});

describe('tot el que no és un sí viu i vàlid, no és un sí', () => {
  it('«qui no ha contestat res encara no ha contestat»', () => {
    expect(parseConsent(null, ARA)).toBe('unknown');
    expect(parseConsent('', ARA)).toBe('unknown');
    expect(needsDecision(parseConsent(null, ARA))).toBe(true);
  });

  it('«un JSON trencat no autoritza res»', () => {
    expect(parseConsent('{granted', ARA)).toBe('unknown');
    expect(parseConsent('granted', ARA)).toBe('unknown');
    expect(parseConsent('null', ARA)).toBe('unknown');
    expect(parseConsent('[1,2,3]', ARA)).toBe('unknown');
  });

  it('«una resposta que no és de les dues, no és resposta»', () => {
    expect(parseConsent(JSON.stringify({ choice: 'yes', at: ARA }), ARA)).toBe('unknown');
    expect(parseConsent(JSON.stringify({ choice: true, at: ARA }), ARA)).toBe('unknown');
    expect(parseConsent(JSON.stringify({ at: ARA }), ARA)).toBe('unknown');
  });

  it('«sense data no hi ha consentiment, encara que digui que sí»', () => {
    // Aquest és l'atac barat: escriure {"choice":"granted"} a mà a la consola.
    expect(parseConsent(JSON.stringify({ choice: 'granted' }), ARA)).toBe('unknown');
    expect(parseConsent(JSON.stringify({ choice: 'granted', at: 'ahir' }), ARA)).toBe('unknown');
    expect(parseConsent(JSON.stringify({ choice: 'granted', at: Infinity }), ARA)).toBe('unknown');
  });

  it('«un sí del futur és un rellotge trencat, no un sí»', () => {
    const massaEnlla = ARA + CONSENT_FUTURE_TOLERANCE_MS + 1000;
    expect(parseConsent(serializeConsent('granted', massaEnlla), ARA)).toBe('unknown');
  });

  it('«però un rellotge que va un minut avançat no esborra el sí»', () => {
    // Si això fallés, cada mòbil amb l'hora lleugerament desviada perdria el
    // consentiment entre el moment de desar-lo i la següent lectura.
    const unMinutAlFutur = ARA + 60 * 1000;
    expect(parseConsent(serializeConsent('granted', unMinutAlFutur), ARA)).toBe('granted');
  });
});

describe('un consentiment caduca', () => {
  it('«un sí d’ara fa onze mesos encara val»', () => {
    const onzeMesos = ARA - CONSENT_MAX_AGE_MS + 30 * 24 * 60 * 60 * 1000;
    expect(parseConsent(serializeConsent('granted', onzeMesos), ARA)).toBe('granted');
  });

  it('«un sí de fa més d’un any s’ha de tornar a demanar»', () => {
    const faMassa = ARA - CONSENT_MAX_AGE_MS - 1;
    expect(parseConsent(serializeConsent('granted', faMassa), ARA)).toBe('unknown');
    expect(needsDecision(parseConsent(serializeConsent('granted', faMassa), ARA))).toBe(true);
  });

  it('«i un no caducat també es torna a demanar»', () => {
    const faMassa = ARA - CONSENT_MAX_AGE_MS - 1;
    expect(parseConsent(serializeConsent('denied', faMassa), ARA)).toBe('unknown');
  });
});

describe('la traducció a Google només diu que sí quan és que sí', () => {
  it('«només un sí explícit obre la galeta»', () => {
    expect(analyticsStorage('granted')).toBe('granted');
    expect(analyticsStorage('denied')).toBe('denied');
    // El cas que importa: no haver contestat no és consentir.
    expect(analyticsStorage('unknown')).toBe('denied');
  });
});
