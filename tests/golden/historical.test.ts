/**
 * Control INDEPENDENT del motor contra eclipsis ja passats i ben documentats.
 *
 * `circumstances.test.ts` compara amb l'IGN. Si el motor i l'IGN no coincideixen,
 * amb una sola font no es pot saber qui s'equivoca. Aquest fitxer aporta la
 * segona opinió: les taules de trajectòria de Fred Espenak (NASA/GSFC, Five
 * Millennium Canon) de TRES eclipsis diferents, dos dels quals ja han passat i
 * s'han observat de veritat.
 *
 *   2017-08-21  total, EUA          — el «Great American Eclipse»
 *   2024-04-08  total, Mèxic-EUA-Canadà
 *   2026-08-12  total, Atlàntic-Espanya — el mateix que valida l'IGN
 *
 * Les dades són a `nasa-path-tables.json`. Cada fila diu on és l'eix de l'ombra
 * a una hora UTC concreta, quina durada té la totalitat sobre la línia central i
 * a quina altura hi ha el Sol. Comparar-hi és directe: si posem l'observador
 * exactament al punt de la línia central que la NASA dona per a l'hora T, el
 * màxim de l'eclipsi hi ha de passar a l'hora T.
 *
 * ── QUÈ DEMOSTRA AQUEST FITXER ───────────────────────────────────────────────
 *
 * 1. QUE EL RADI LUNAR UMBRAL ARA ÉS EL BO. Abans que `constants.ts` separés
 *    els dos valors de `k`, la durada de la totalitat sortia llarga en els TRES
 *    eclipsis i sempre entre +2,5 i +5 s (+4,09 / +3,87 / +3,06). Un error que
 *    no depenia ni de l'eclipsi, ni de la latitud, ni de l'any, i que sempre
 *    anava cap al mateix costat, no és soroll: és una constant equivocada.
 *    Amb k = 0,2722810 als contactes umbrals la durada cau a MENYS DE 0,15 s
 *    en tots tres. És el senyal més net de tota la validació.
 *
 * 2. QUE EL MODEL DE ΔT ARA ÉS EL BO. Aquí cal llegir els números amb cura,
 *    perquè cada taula de la NASA porta implícit el ΔT amb què es va generar:
 *
 *      2017 → motor −1,96 s. La taula fa servir el ΔT real; el que queda és
 *             el residu d'efemèrides.
 *      2026 → motor −0,82 s. El millor dels tres.
 *      2024 → motor +7,02 s. Sembla dolent i no ho és: la taula del 2024 està
 *             generada amb el ΔT antic (~74 s) i el valor real d'aquell dia era
 *             69,2 s. Comprovat contra JPL Horizons a la línia central de
 *             Mazatlán: Horizons diu que el màxim va ser a les 18:10:02,6 UTC i
 *             la taula de la NASA diu 18:10:00. La taula va 2,6 s endavantada
 *             respecte de la realitat; nosaltres en quedem +4,4 s, que és el
 *             residu d'efemèrides previst per a aquella geometria (+4,95 s).
 *
 *    Dit d'una altra manera: contra les DUES fonts que fan servir el ΔT correcte
 *    (la taula del 2017 i la del 2026) el motor queda a menys de 2 s.
 *
 * El 2026 encara no ha passat, però el 2017 i el 2024 sí, i les seves taules
 * s'han contrastat amb observacions reals. Que el motor hi encaixi com hi
 * encaixa —durades a 0,12 s i altura del Sol a mig grau— vol dir que la
 * geometria, la refracció i les constants són correctes, i que l'únic que hi
 * queda és la precisió de les efemèrides de la biblioteca.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * El catàleg de producció només té els tres eclipsis d'Espanya, i ha de
 * continuar sent així: si hi afegíssim el 2017 i el 2024, apareixerien al
 * selector de la interfície. Aquí el substituïm només durant aquest fitxer de
 * test, de manera que `computeLocalCircumstances()` s'executa TAL COM ESTÀ, amb
 * el seu codi de producció, però sabent trobar el 2017 i el 2024.
 */
vi.mock('../../src/core/eclipses/catalog', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../src/core/eclipses/catalog')>();
  const { HISTORICAL_ECLIPSES } = await import('./historical-catalog');
  const all = [...actual.ECLIPSES, ...HISTORICAL_ECLIPSES];
  return {
    ...actual,
    ECLIPSES: all,
    getEclipse: (id: string) => {
      const entry = all.find((e) => e.id === id);
      if (!entry) throw new Error(`Eclipsi desconegut: ${id}`);
      return entry;
    },
  };
});

const { computeLocalCircumstances } = await import('../../src/core/astro/contacts');
const { deltaTSeconds, espenakMeeusDeltaT } = await import(
  '../../src/core/astro/deltaT'
);

interface PathRow {
  utc: string;
  lat: number;
  lon: number;
  diamRatio: number;
  sunAltDeg: number;
  sunAzDeg: number;
  pathWidthKm: number;
  durationSec: number;
}

const here = dirname(fileURLToPath(import.meta.url));
const nasa = JSON.parse(
  readFileSync(resolve(here, 'nasa-path-tables.json'), 'utf8'),
) as { rows: Record<string, PathRow[]> };

const ECLIPSE_IDS = ['2017-08-21', '2024-04-08', '2026-08-12'] as const;
type EclipseId = (typeof ECLIPSE_IDS)[number];

interface Comparison {
  row: PathRow;
  maxDelta: number;
  durationDelta: number;
  altitudeDelta: number;
  kind: string;
}

const results = new Map<EclipseId, Comparison[]>();

beforeAll(() => {
  for (const id of ECLIPSE_IDS) {
    const comparisons: Comparison[] = [];
    for (const row of nasa.rows[id]) {
      // Les taules de la NASA són sobre l'el·lipsoide: altitud 0.
      const r = computeLocalCircumstances(id, {
        lat: row.lat,
        lon: row.lon,
        elevation: 0,
      });
      comparisons.push({
        row,
        maxDelta:
          (r.contacts.max.time.getTime() - new Date(row.utc).getTime()) / 1000,
        durationDelta: r.centralDurationSec - row.durationSec,
        altitudeDelta: r.contacts.max.sun.altitudeTrue - row.sunAltDeg,
        kind: r.kind,
      });
    }
    results.set(id, comparisons);
  }
});

function stats(values: number[]): { mean: number; worst: number } {
  return {
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    worst: values.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0),
  };
}

describe('les dades de la NASA són les que esperem', () => {
  it('hi ha files dels tres eclipsis', () => {
    for (const id of ECLIPSE_IDS) {
      expect(nasa.rows[id].length, id).toBeGreaterThanOrEqual(6);
    }
  });

  it('totes les files són de la línia central d’un eclipsi total', () => {
    for (const id of ECLIPSE_IDS) {
      for (const row of nasa.rows[id]) {
        expect(row.diamRatio).toBeGreaterThan(1);
        expect(row.durationSec).toBeGreaterThan(0);
      }
    }
  });
});

describe.each(ECLIPSE_IDS)('eclipsi %s vs taula de la NASA', (id) => {
  it('el motor hi veu totalitat a tota la línia central', () => {
    const wrong = results
      .get(id)!
      .filter((c) => c.kind !== 'total')
      .map((c) => `${c.row.utc}: ${c.kind}`);
    expect(wrong).toEqual([]);
  });

  it('l’altura del Sol quadra amb el grau enter de la taula', () => {
    // La taula només dona graus enters, o sigui ±0,5° d'incertesa pròpia.
    const { worst } = stats(results.get(id)!.map((c) => c.altitudeDelta));
    expect(Math.abs(worst)).toBeLessThanOrEqual(0.5);
  });

  /**
   * Llindars de caracterització, un per eclipsi, perquè cadascun té la seva
   * història (vegeu la capçalera):
   *
   *   2017 → −1,96 s. Residu d'efemèrides, poc més.
   *   2026 → −0,82 s. El millor dels tres.
   *   2024 → +7,02 s. NO és un error nostre: la taula de la NASA del 2024 està
   *          generada amb el ΔT antic. Ho hem comprovat contra JPL Horizons a
   *          la línia central de Mazatlán: Horizons situa el màxim a les
   *          18:10:02,6 i la taula de la NASA diu 18:10:00. El nostre motor diu
   *          18:10:07, o sigui +4,4 s respecte de Horizons, que és exactament
   *          el residu d'efemèrides previst per a aquella geometria (+4,95 s).
   */
  const MAX_TIME_LIMIT: Record<string, number> = {
    '2017-08-21': 3,
    '2024-04-08': 8,
    '2026-08-12': 2,
  };

  it(`l’hora del màxim es desvia menys de ${MAX_TIME_LIMIT[id]} s`, () => {
    const deltas = results.get(id)!.map((c) => c.maxDelta);
    const { mean, worst } = stats(deltas);
    expect(
      Math.abs(worst),
      `${id}: mitjana ${mean.toFixed(2)} s, pitjor ${worst.toFixed(2)} s`,
    ).toBeLessThanOrEqual(MAX_TIME_LIMIT[id]);
  });

  /**
   * LA PROVA QUE EL RADI LUNAR UMBRAL ÉS EL BO.
   *
   * Amb k = 0,2725076 als contactes umbrals, la durada sortia llarga entre
   * +2,5 i +5 s en els tres eclipsis. Amb k = 0,2722810, que és el conveni
   * d'Espenak, cau a menys de 0,15 s — en tres eclipsis separats per nou anys,
   * a latituds i altures del Sol completament diferents.
   *
   * Aquest és el test que hauria de saltar primer si algú toca `constants.ts`.
   */
  it('la durada de la totalitat quadra amb la NASA a menys de 0,15 s', () => {
    const deltas = results.get(id)!.map((c) => c.durationDelta);
    const { mean, worst } = stats(deltas);
    expect(
      Math.abs(worst),
      `${id}: mitjana ${mean.toFixed(3)} s, pitjor ${worst.toFixed(3)} s`,
    ).toBeLessThanOrEqual(0.15);
  });
});

describe('diagnòstic conjunt dels tres eclipsis', () => {
  it('la durada ja no arrossega cap biaix sistemàtic', () => {
    // Abans de corregir el radi lunar umbral, els tres eclipsis donaven un
    // excés de durada gairebé idèntic (+4,09 / +3,87 / +3,06 s): la signatura
    // inconfusible d'una constant equivocada. Ara les mitjanes ronden zero i,
    // sobretot, ja no van totes cap al mateix costat.
    const means = ECLIPSE_IDS.map(
      (id) => stats(results.get(id)!.map((c) => c.durationDelta)).mean,
    );
    const label = `mitjanes: ${means.map((m) => m.toFixed(3)).join(', ')} s`;
    for (const m of means) expect(Math.abs(m), label).toBeLessThan(0.15);
  });

  /**
   * El model de ΔT contra els valors de l'IERS del dia exacte de cada eclipsi
   * del catàleg, calculats com ΔT = 32,184 + 37 − (UT1 − UTC) a partir del
   * fitxer `finals2000A.all` descarregat l'1 d'agost de 2026.
   *
   * El 2028 queda fora de l'abast de les prediccions de l'IERS (que arriben
   * un any vista), així que allà només comprovem que el model dona una cosa
   * raonable i no el disbarat del polinomi antic.
   */
  it('el model de ΔT reprodueix els valors de l’IERS als nostres eclipsis', () => {
    const IERS: Array<[iso: string, deltaT: number | null]> = [
      ['2026-08-12T18:29:00Z', 69.173],
      ['2027-08-02T10:07:00Z', 69.241],
      ['2028-01-26T15:09:00Z', null],
    ];
    const lines: string[] = [];
    for (const [iso, reference] of IERS) {
      const ut =
        (new Date(iso).getTime() - new Date('2000-01-01T12:00:00Z').getTime()) /
        86_400_000;
      const ours = deltaTSeconds(ut);
      const stale = espenakMeeusDeltaT(ut);
      lines.push(
        `${iso.slice(0, 10)}  model ${ours.toFixed(3)} s  ` +
          `IERS ${reference === null ? ' n/d  ' : `${reference.toFixed(3)} s`}  ` +
          `(Espenak-Meeus ${stale.toFixed(2)} s)`,
      );
      if (reference !== null) {
        // Una dècima de segon de ΔT és una dècima de segon a l'hora del
        // contacte: trenta vegades menys que el residu d'efemèrides.
        expect(Math.abs(ours - reference), iso).toBeLessThanOrEqual(0.1);
      }
      // En tots els casos ha d'estar lluny del polinomi antic, que és el que
      // ens desviava sis segons.
      expect(stale - ours, iso).toBeGreaterThan(5);
    }
    process.stdout.write(`\n  ΔT:\n    ${lines.join('\n    ')}\n`);
  });

  it('l’ancoratge de ΔT del 2020 no és el valor absurd que hi havia', () => {
    // Regressió d'un error real: la taula tenia 71,63 s per al 2020,
    // quan l'IERS en dona 69,361. Dos segons i quart de més.
    const ut =
      (new Date('2020-01-01T00:00:00Z').getTime() -
        new Date('2000-01-01T12:00:00Z').getTime()) /
      86_400_000;
    expect(deltaTSeconds(ut)).toBeCloseTo(69.361, 2);
  });

  it('fora de la taula d’ancoratges delega al polinomi d’Espenak-Meeus', () => {
    const ut =
      (new Date('1999-06-15T00:00:00Z').getTime() -
        new Date('2000-01-01T12:00:00Z').getTime()) /
      86_400_000;
    expect(deltaTSeconds(ut)).toBeCloseTo(espenakMeeusDeltaT(ut), 6);
  });

  it('imprimeix el quadre resum', () => {
    const lines: string[] = [];
    for (const id of ECLIPSE_IDS) {
      const c = results.get(id)!;
      const m = stats(c.map((x) => x.maxDelta));
      const d = stats(c.map((x) => x.durationDelta));
      const a = stats(c.map((x) => x.altitudeDelta));
      lines.push(
        `${id}  n=${String(c.length).padStart(2)}  ` +
          `màxim ${m.mean.toFixed(2).padStart(6)} s (pitjor ${m.worst.toFixed(2).padStart(6)})  ` +
          `durada ${d.mean.toFixed(2).padStart(5)} s (pitjor ${d.worst.toFixed(2).padStart(5)})  ` +
          `altura ${a.worst.toFixed(2).padStart(5)}°`,
      );
    }
    process.stdout.write(
      `\n  Motor − NASA/GSFC (línia central):\n    ${lines.join('\n    ')}\n`,
    );
    expect(lines).toHaveLength(3);
  });
});
