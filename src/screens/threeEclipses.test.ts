/**
 * Els tres eclipsis calculats per a un punt.
 *
 * QUÈ VIGILA, per ordre de gravetat:
 *
 *  1. Que la comporta de seguretat ocular sigui la de `core/timer` i digui que
 *     NO per al 2028 des de dins de la franja anular. Aquest és el cas exacte
 *     que ja va fallar una vegada a la pantalla de la guia (ESTAT.md §3.1):
 *     un eclipsi anular té C2 i C3 i té durada de fase central, o sigui que
 *     qualsevol regla escrita a mà del tipus «hi ha fase central → es pot
 *     mirar» hi passa i anuncia set minuts segurs davant d'un anell de
 *     fotosfera. Si algú torna a escriure aquella regla, aquest test es posa
 *     vermell.
 *  2. Que el perfil d'horitzó, que depèn NOMÉS del lloc, s'apliqui als tres
 *     eclipsis i no només al seleccionat — que és tota la gràcia del widget.
 *  3. Que sense perfil d'horitzó els camps que en depenen siguin `null` i no
 *     zero: un zero es llegiria com «el terreny no et pren res» sense
 *     haver-ho mirat.
 *
 * PER QUÈ IMPORTA D'UN `.tsx`: la lògica de `buildEclipseRows` viu al costat
 * del component que la pinta però no toca ni el DOM ni React. Vitest corre amb
 * entorn `node` i pot importar-la igualment; si algun dia aquesta importació
 * comença a arrossegar el DOM, voldrà dir que el càlcul i la pintura s'han
 * barrejat, i aleshores el test que falla és l'avís.
 */

import { describe, expect, it } from 'vitest';
import { buildEclipseRows } from './ThreeEclipses';
import { ECLIPSES } from '../core/eclipses/catalog';
import { flatHorizonProfile } from '../core/horizon/profile';
import type { GeoLocation } from '../core/astro/types';

/**
 * Sòria. Punt escollit perquè és dins de la franja de totalitat del 2026 i fora
 * de la del 2027 i de la del 2028: en una sola crida hi ha els tres casos que
 * la targeta ha de saber dir (fase central, parcial i parcial).
 */
const SORIA: GeoLocation = { lat: 41.7636, lon: -2.4649, elevation: 1063 };

/**
 * València. És dins de la franja d'anularitat del 2028, que és on la comporta
 * de seguretat s'ha de negar tot i haver-hi fase central i minuts de sobres.
 */
const VALENCIA: GeoLocation = { lat: 39.4699, lon: -0.3763, elevation: 15 };

/** Horitzó pla, que és el cas optimista i no amaga mai el Sol. */
const flat = (loc: GeoLocation) =>
  flatHorizonProfile(loc.lat, loc.lon, loc.elevation, 0);

/**
 * Una carena de 6° tot al voltant. Amb el Sol del 2026 arran d'horitzó això se
 * n'emporta una part de la totalitat; amb el del 2027, que és al matí i alt, no
 * hauria de tocar res. És la comparació que el producte diu poder fer i que cap
 * altra app no fa.
 */
const ridge = (loc: GeoLocation) =>
  flatHorizonProfile(loc.lat, loc.lon, loc.elevation, 6);

describe('buildEclipseRows', () => {
  it('torna una fila per eclipsi del catàleg i en el mateix ordre', () => {
    const rows = buildEclipseRows(SORIA, null);
    expect(rows.map((r) => r.id)).toEqual(ECLIPSES.map((e) => e.id));
  });

  it('sense perfil d’horitzó deixa en null tot el que depèn del terreny', () => {
    const rows = buildEclipseRows(SORIA, null);
    for (const row of rows) {
      expect(row.centralVisibleSec).toBeNull();
      expect(row.centralLostSec).toBeNull();
      expect(row.horizonAltitudeAtMaxDeg).toBeNull();
      expect(row.maxVisible).toBeNull();
      expect(row.visibleObscuration).toBeNull();
    }
  });

  it('des de Sòria el 2026 és total i els altres dos no tenen fase central', () => {
    const rows = buildEclipseRows(SORIA, null);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

    expect(byId['2026-08-12'].kind).toBe('total');
    expect(byId['2026-08-12'].hasCentral).toBe(true);
    expect(byId['2026-08-12'].centralTotalSec).toBeGreaterThan(0);

    expect(byId['2027-08-02'].hasCentral).toBe(false);
    expect(byId['2027-08-02'].centralTotalSec).toBe(0);
    expect(byId['2028-01-26'].hasCentral).toBe(false);
  });

  /*
   * LA COMPARACIÓ QUE JUSTIFICA EL WIDGET.
   *
   * El 2026 el Sol és arran d'horitzó i el 2027 és alt: no és una opinió
   * editorial, és una diferència de desenes de graus que surt del càlcul. El
   * llindar de 20° és deliberadament folgat perquè el test no es converteixi en
   * una còpia del motor: el que ha de vigilar és que els dos números no
   * s'intercanviïn ni s'aplanin, no quant valen.
   */
  it('des de Sòria el Sol del 2027 és molt més alt que el del 2026', () => {
    const rows = buildEclipseRows(SORIA, null);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId['2027-08-02'].sunAltitudeDeg).toBeGreaterThan(
      byId['2026-08-12'].sunAltitudeDeg + 20,
    );
  });

  it('el mateix perfil d’horitzó s’aplica als tres eclipsis', () => {
    const rows = buildEclipseRows(SORIA, flat(SORIA));
    for (const row of rows) {
      expect(row.centralVisibleSec).not.toBeNull();
      expect(row.horizonAltitudeAtMaxDeg).toBeCloseTo(0, 6);
    }
  });

  /*
   * Aquest és el cas que el text del producte promet: «des d'aquí, el 2026 el
   * terreny te'n menja una part; el 2027 el Sol és alt i el relleu no compta».
   * Amb la mateixa carena de 6°, els dos eclipsis han de reaccionar diferent.
   */
  it('una carena de 6° roba totalitat el 2026 i no toca el Sol alt del 2027', () => {
    const rows = buildEclipseRows(SORIA, ridge(SORIA));
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

    const y2026 = byId['2026-08-12'];
    expect(y2026.centralLostSec).not.toBeNull();
    expect(y2026.centralLostSec as number).toBeGreaterThan(0);
    expect(y2026.centralVisibleSec as number).toBeLessThan(y2026.centralTotalSec);

    // El 2027, al matí i amb el Sol desenes de graus per damunt de la carena.
    expect(byId['2027-08-02'].maxVisible).toBe(true);
  });

  /*
   * Amb horitzó pla no es perd ni un segon de totalitat: `centralVisibleSec` ha
   * de coincidir amb la teòrica. Serveix de control del cas anterior — si la
   * carena i el pla donessin el mateix, el perfil no s'estaria aplicant.
   */
  it('amb horitzó pla la totalitat del 2026 sobreviu sencera', () => {
    const rows = buildEclipseRows(SORIA, flat(SORIA));
    const y2026 = rows.find((r) => r.id === '2026-08-12');
    expect(y2026).toBeDefined();
    expect(y2026?.centralLostSec).toBeCloseTo(0, 1);
  });
});

describe('la comporta de seguretat ocular de cada fila', () => {
  /*
   * EL DEFECTE QUE JA VA PASSAR UNA VEGADA. Des de València, el 26 de gener del
   * 2028 hi ha fase central de veritat i dura minuts. Qualsevol regla del tipus
   * «hi ha fase central → es pot mirar» hi diria que sí. La comporta ha de dir
   * que no, i el motiu ha de ser explícitament l'anularitat.
   */
  it('nega treure el filtre en l’eclipsi anular encara que hi hagi fase central', () => {
    const rows = buildEclipseRows(VALENCIA, null);
    const y2028 = rows.find((r) => r.id === '2028-01-26');
    expect(y2028?.hasCentral).toBe(true);
    expect(y2028?.centralTotalSec).toBeGreaterThan(60);
    expect(y2028?.gate.allowed).toBe(false);
    expect(y2028?.gate.reason).toBe('annular');
  });

  it('nega treure el filtre allà on l’eclipsi és només parcial', () => {
    const rows = buildEclipseRows(SORIA, null);
    const y2027 = rows.find((r) => r.id === '2027-08-02');
    expect(y2027?.gate.allowed).toBe(false);
    expect(y2027?.gate.reason).toBe('partial-only');
  });

  it('autoritza el 2026 des de dins de la franja i amb horitzó lliure', () => {
    const rows = buildEclipseRows(SORIA, flat(SORIA));
    const y2026 = rows.find((r) => r.id === '2026-08-12');
    expect(y2026?.gate.allowed).toBe(true);
    expect(y2026?.gate.reason).toBe('ok');
  });

  /*
   * I la retira quan el terreny se la menja sencera. La carena de 25° tapa el
   * Sol del 2026 des de molt abans de la totalitat: el que es veuria en tornar
   * a aparèixer per damunt seria fotosfera.
   */
  it('retira l’autorització quan el terreny tapa la fase central', () => {
    const wall = flatHorizonProfile(SORIA.lat, SORIA.lon, SORIA.elevation, 25);
    const rows = buildEclipseRows(SORIA, wall);
    const y2026 = rows.find((r) => r.id === '2026-08-12');
    expect(y2026?.centralVisibleSec).toBe(0);
    expect(y2026?.gate.allowed).toBe(false);
    expect(y2026?.gate.reason).toBe('central-blocked-by-terrain');
  });
});

describe('els consells del catàleg', () => {
  /*
   * El camp és opcional (les entrades de validació de `tests/golden/` no en
   * tenen), però els tres eclipsis de producció n'han de portar en tots dos
   * idiomes: una llista buida en castellà voldria dir una fila muda per a mig
   * públic, que és el defecte que ESTAT.md §4 documenta amb `verdict.summary`.
   */
  it('els tres eclipsis de producció en tenen en català i en castellà', () => {
    for (const entry of ECLIPSES) {
      expect(entry.tips).toBeDefined();
      expect(entry.tips?.ca.length).toBeGreaterThan(0);
      expect(entry.tips?.es.length).toBe(entry.tips?.ca.length);
    }
  });

  /*
   * SÓN QUALITATIUS I HO HAN DE SEGUIR SENT. La regla del catàleg és que tot el
   * que és local es calcula i no es llegeix d'aquí. Un consell amb una xifra
   * («el Sol serà a 4,5°», «tindràs 96 s») competiria amb la que el motor
   * calcula per a les coordenades de qui llegeix, i com que aquestes xifres
   * canvien cada pocs quilòmetres, la de catàleg gairebé sempre seria la
   * falsa. Es permeten els números escrits amb lletra i les xifres que formen
   * part d'un nom (ISO 12312-2), no les magnituds.
   */
  it('no contenen cap magnitud numèrica', () => {
    // Xifres seguides —opcionalment— d'una unitat: graus, segons, minuts, %, km.
    const magnitude = /\d+(?:[.,]\d+)?\s*(?:°|%|s\b|min\b|km\b|m\b)/i;
    for (const entry of ECLIPSES) {
      for (const locale of ['ca', 'es'] as const) {
        for (const tip of entry.tips?.[locale] ?? []) {
          expect(tip, `${entry.id} · ${locale} · ${tip}`).not.toMatch(magnitude);
        }
      }
    }
  });
});
