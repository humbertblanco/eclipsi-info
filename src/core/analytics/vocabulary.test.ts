/**
 * El vocabulari, repassat sencer.
 *
 * PER QUÈ CAL PROVAR UNA TAULA DE CONSTANTS. Perquè la porta de privadesa
 * (`sanitize.ts`) fa complir la taula, però no pot jutjar-la: si algú hi declara
 * `place: ['peniscola', 'montseny', …]`, cada valor té forma de paraula
 * innocent i la porta el deixarà passar tan content. La defensa contra això no
 * és una expressió regular —no n'hi ha cap que distingeixi un topònim d'una
 * categoria— sinó aquest test, que passa per la taula sencera buscant els noms
 * on s'hi amaga una ubicació, i la revisió humana que el llegeix.
 *
 * Un esdeveniment nou queda cobert automàticament: aquí no hi ha cap llista
 * escrita a mà que ningú s'hagi de recordar d'ampliar.
 */

import { describe, it, expect } from 'vitest';
import {
  VOCABULARY,
  declaredParams,
  isAnalyticsEventName,
  type AnalyticsEventName,
} from './vocabulary';
import {
  EVENT_NAME_PATTERN,
  MAX_PARAMS,
  isForbiddenKey,
  isSafeToken,
  sanitizeEvent,
} from './sanitize';

const EVENT_NAMES = Object.keys(VOCABULARY) as AnalyticsEventName[];

describe('la taula del vocabulari', () => {
  it('no és buida i tots els noms es reconeixen', () => {
    expect(EVENT_NAMES.length).toBeGreaterThan(0);
    for (const name of EVENT_NAMES) {
      expect(isAnalyticsEventName(name), name).toBe(true);
    }
  });

  it('res que no sigui a la taula no és un esdeveniment', () => {
    // `toString` hi és perquè viu a la cadena de prototipus de qualsevol
    // objecte: amb un `in` en comptes d'un `hasOwnProperty`, seria un
    // esdeveniment vàlid.
    for (const fals of ['toString', 'constructor', '__proto__', 'lloc_triat', '']) {
      expect(isAnalyticsEventName(fals), fals).toBe(false);
    }
  });

  it('cada nom té la forma que GA4 admet', () => {
    for (const name of EVENT_NAMES) {
      expect(EVENT_NAME_PATTERN.test(name), name).toBe(true);
    }
  });

  it('cap clau de paràmetre no és un lloc disfressat', () => {
    for (const name of EVENT_NAMES) {
      for (const key of Object.keys(declaredParams(name))) {
        expect(isSafeToken(key), `${name}.${key}`).toBe(true);
        expect(isForbiddenKey(key), `${name}.${key}`).toBe(false);
      }
    }
  });

  it('cap valor declarat no té forma de dada de l’usuari', () => {
    for (const name of EVENT_NAMES) {
      for (const [key, values] of Object.entries(declaredParams(name))) {
        for (const value of values) {
          expect(isSafeToken(value), `${name}.${key} = ${value}`).toBe(true);
        }
      }
    }
  });

  it('cap paràmetre no té valors repetits ni llistes buides', () => {
    for (const name of EVENT_NAMES) {
      for (const [key, values] of Object.entries(declaredParams(name))) {
        expect(values.length, `${name}.${key}`).toBeGreaterThan(0);
        expect(new Set(values).size, `${name}.${key} té valors repetits`).toBe(
          values.length,
        );
      }
    }
  });

  it('cap esdeveniment no passa del sostre de paràmetres', () => {
    // El sostre no és tècnic (GA4 n'admet 25): un esdeveniment amb nou
    // dimensions és un bolcat d'estat, i un bolcat d'estat és per on s'escapen
    // les coses.
    for (const name of EVENT_NAMES) {
      expect(Object.keys(declaredParams(name)).length, name).toBeLessThanOrEqual(
        MAX_PARAMS,
      );
    }
  });

  it('cap esdeveniment no demana una xifra amb cara de xifra', () => {
    /*
     * Els noms de paràmetre que anuncien un número: si un dia n'apareix un,
     * vol dir que algú està a punt d'enviar una magnitud contínua, i una
     * magnitud contínua d'un punt de l'usuari és una ubicació amb un altre
     * nom. Les magnituds es diuen en franges (`buckets.ts`) i les franges es
     * diuen amb paraules.
     */
    const SOSPITOSOS = ['km', 'meters', 'metres', 'seconds', 'secs', 'ms', 'count', 'n'];
    for (const name of EVENT_NAMES) {
      for (const key of Object.keys(declaredParams(name))) {
        expect(SOSPITOSOS.includes(key), `${name}.${key}`).toBe(false);
      }
    }
  });

  it('tot esdeveniment declarat és emetible, i cap altre', () => {
    for (const name of EVENT_NAMES) {
      const params: Record<string, string> = {};
      for (const [key, values] of Object.entries(declaredParams(name))) {
        params[key] = values[values.length - 1];
      }
      expect(sanitizeEvent(name, params).ok, name).toBe(true);
    }
  });
});
