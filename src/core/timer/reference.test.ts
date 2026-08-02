/**
 * Tests del desfasament del rellotge contra una referència externa.
 *
 * El que es vigila aquí no és que la resta surti bé: és que el mòdul no doni
 * mai un número quan no en pot donar cap. Un «vas 0,4 s endarrerit» inventat a
 * partir d'una capçalera amb resolució de segon és pitjor que no dir res,
 * perquè convida a no mirar-s'ho més.
 */

import { describe, it, expect } from 'vitest';
import {
  bestClockOffset,
  clockDriftLevel,
  estimateClockOffset,
  parseHttpDate,
  CLOCK_DRIFT_ALERT_MS,
  HTTP_DATE_RESOLUTION_MS,
  MAX_USEFUL_ROUND_TRIP_MS,
  type ClockOffset,
} from './reference';

/** Un instant qualsevol amb el segon clavat, per no barrejar dos efectes. */
const T = Date.UTC(2026, 7, 12, 19, 30, 0);

/**
 * Munta una consulta a partir del que sabríem si ho controléssim tot: quant va
 * malament el rellotge del dispositiu, quant triga l'anada i quant la tornada.
 *
 * El servidor escriu la seva hora TRUNCADA al segon, que és el que fa HTTP.
 */
function probe(driftMs: number, upMs: number, downMs: number, serverTrueMs = T + 250) {
  const sentAtMs = serverTrueMs - upMs + driftMs;
  const receivedAtMs = serverTrueMs + downMs + driftMs;
  return {
    sentAtMs,
    receivedAtMs,
    serverDateMs: Math.floor(serverTrueMs / 1000) * 1000,
  };
}

describe('parseHttpDate', () => {
  it('entén la data HTTP tal com l’escriu un servidor', () => {
    expect(parseHttpDate('Wed, 12 Aug 2026 19:30:00 GMT')).toBe(T);
  });

  it('no inventa cap número quan no hi ha capçalera o no s’entén', () => {
    // Els tres casos han de donar el MATEIX «no ho sé». Un `NaN` que se
    // n'escapi acaba sent un desfasament de `NaN` segons a la pantalla.
    expect(parseHttpDate(null)).toBeNull();
    expect(parseHttpDate(undefined)).toBeNull();
    expect(parseHttpDate('')).toBeNull();
    expect(parseHttpDate('ahir a la tarda')).toBeNull();
  });
});

describe('estimateClockOffset', () => {
  it('amb el rellotge clavat i la xarxa simètrica, el desfasament és zero', () => {
    // El servidor marca T+250 ms i escriu «T». Si el mòdul es cregués el segon
    // truncat tal qual, aquí sortiria mig segon de desfasament fantasma.
    const result = estimateClockOffset(probe(0, 100, 100));
    expect(result.known).toBe(true);
    if (!result.known) return;
    expect(Math.abs(result.offsetMs)).toBeLessThan(HTTP_DATE_RESOLUTION_MS / 2);
  });

  it('el signe diu cap a on: negatiu és el telèfon endarrerit', () => {
    // És el cas d'ESTAT.md: trenta segons endarrerit fa sonar els avisos tard.
    const late = estimateClockOffset(probe(-30_000, 60, 60));
    expect(late.known && late.offsetMs).toBeLessThan(0);
    expect(late.known && Math.round(late.offsetMs / 1000)).toBe(-30);

    const early = estimateClockOffset(probe(+30_000, 60, 60));
    expect(early.known && early.offsetMs).toBeGreaterThan(0);
  });

  it('la barra d’error és la quantització més mitja anada i tornada', () => {
    const result = estimateClockOffset(probe(-30_000, 200, 400));
    expect(result.known).toBe(true);
    if (!result.known) return;
    expect(result.roundTripMs).toBe(600);
    expect(result.uncertaintyMs).toBe(600 / 2 + 500);
  });

  it('el desfasament real sempre cau dins de la barra d’error', () => {
    // La prova de fons: si això falla, el número que ensenyem és més precís del
    // que podem justificar. Es recorren asimetries de xarxa i posicions del
    // segon truncat, que són les dues fonts d'error del model.
    for (const drift of [-45_000, -12_000, -3000, 0, 2500, 17_000]) {
      for (const [up, down] of [
        [30, 30],
        [500, 40],
        [40, 500],
        [1200, 900],
      ]) {
        for (const withinSecond of [0, 250, 999]) {
          const result = estimateClockOffset(probe(drift, up, down, T + withinSecond));
          expect(result.known).toBe(true);
          if (!result.known) continue;
          expect(Math.abs(result.offsetMs - drift)).toBeLessThanOrEqual(result.uncertaintyMs);
        }
      }
    }
  });

  it('no dona número si alguna lectura no és un número', () => {
    expect(
      estimateClockOffset({ sentAtMs: NaN, receivedAtMs: T, serverDateMs: T }),
    ).toEqual({ known: false, problem: 'invalid-reading' });
    expect(
      estimateClockOffset({ sentAtMs: T, receivedAtMs: T, serverDateMs: Number.POSITIVE_INFINITY }),
    ).toEqual({ known: false, problem: 'invalid-reading' });
  });

  it('no dona número si la resposta arriba abans d’haver-se enviat', () => {
    // Passa de debò: el sistema sincronitza per NTP entre les dues lectures.
    expect(estimateClockOffset({ sentAtMs: T + 5000, receivedAtMs: T, serverDateMs: T })).toEqual({
      known: false,
      problem: 'reversed',
    });
  });

  it('no dona número si hi ha massa estona entre les dues lectures', () => {
    // Una pestanya congelada a mitja petició trenca la hipòtesi de simetria, i
    // llavors el resultat no és imprecís: és fals.
    const frozen = estimateClockOffset(probe(0, 1000, MAX_USEFUL_ROUND_TRIP_MS));
    expect(frozen).toEqual({ known: false, problem: 'round-trip-too-long' });
    // I just per sota del límit encara val.
    expect(estimateClockOffset(probe(0, 100, 100)).known).toBe(true);
  });
});

describe('bestClockOffset', () => {
  it('es queda la consulta més estreta i no promitja res', () => {
    const wide = estimateClockOffset(probe(-30_000, 1500, 1500));
    const narrow = estimateClockOffset(probe(-30_000, 40, 40));
    const best = bestClockOffset([wide, narrow]);
    expect(best).toBe(narrow);
  });

  it('ignora les consultes que no han donat número', () => {
    const bad: ClockOffset = { known: false, problem: 'reversed' };
    const good = estimateClockOffset(probe(-8000, 80, 80));
    expect(bestClockOffset([bad, good, bad])).toBe(good);
  });

  it('sense cap consulta bona, torna el problema', () => {
    const bad: ClockOffset = { known: false, problem: 'round-trip-too-long' };
    expect(bestClockOffset([bad])).toBe(bad);
    expect(bestClockOffset([])).toEqual({ known: false, problem: 'invalid-reading' });
  });
});

describe('clockDriftLevel', () => {
  it('sense mesura, no se’n sap res', () => {
    expect(clockDriftLevel({ known: false, problem: 'reversed' })).toBe('unknown');
  });

  it('un rellotge clavat es pot declarar bo', () => {
    expect(clockDriftLevel(estimateClockOffset(probe(0, 60, 60)))).toBe('aligned');
  });

  it('trenta segons endarrerit es diu clar', () => {
    expect(clockDriftLevel(estimateClockOffset(probe(-30_000, 200, 200)))).toBe('off');
  });

  it('quan la incertesa trepitja el llindar, la resposta és que no se sap', () => {
    // Just al llindar amb una anada i tornada normal: la barra d'error el creua
    // pels dos costats i afirmar-hi res seria inventar precisió.
    const level = clockDriftLevel(estimateClockOffset(probe(-CLOCK_DRIFT_ALERT_MS, 300, 300)));
    expect(level).toBe('inconclusive');
  });

  it('la incertesa no pot convertir un rellotge dolent en un de bo', () => {
    // Amb una anada i tornada llarga la barra d'error creix, i el veredicte ha
    // de baixar a «no ho sé», mai quedar-se a «va bé».
    for (const rtt of [100, 1000, 4000, 9000]) {
      const level = clockDriftLevel(estimateClockOffset(probe(-20_000, rtt / 2, rtt / 2)));
      expect(level).toBe('off');
    }
    const marginal = clockDriftLevel(estimateClockOffset(probe(-6000, 4000, 4000)));
    expect(marginal).toBe('inconclusive');
  });

  it('el llindar es pot moure des de fora', () => {
    const offset = estimateClockOffset(probe(-8000, 100, 100));
    expect(clockDriftLevel(offset, 5000)).toBe('off');
    expect(clockDriftLevel(offset, 60_000)).toBe('aligned');
  });
});

describe('el llindar', () => {
  it('no pot passar del marge de l’últim avís de seguretat', () => {
    // L'últim «posa't el filtre» es dona a C3 − 5 s (`FILTER_ON_WARNING_SEC` a
    // schedule.ts). Un llindar més alt que aquell marge voldria dir callar
    // davant d'un rellotge que ja empeny aquell avís fins després de C3.
    expect(CLOCK_DRIFT_ALERT_MS).toBeLessThanOrEqual(5000);
  });

  it('queda per damunt del terra de la mesura', () => {
    // Amb una anada i tornada mòbil raonable la incertesa és inferior a un
    // segon: el llindar s'ha de poder distingir de debò, o l'avís no sortiria
    // mai o sortiria sempre.
    const typical = estimateClockOffset(probe(0, 250, 250));
    expect(typical.known && typical.uncertaintyMs).toBeLessThan(CLOCK_DRIFT_ALERT_MS / 4);
  });
});
