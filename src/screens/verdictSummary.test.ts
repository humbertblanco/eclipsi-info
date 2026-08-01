/**
 * La frase del veredicte s'ha de redactar en l'idioma actiu.
 *
 * EL QUE VIGILA: el motor tenia un camp `summary` en català per construcció i
 * les pantalles el pintaven tal qual — amb l'app en castellà, la conclusió del
 * producte sortia en català. Ara `computeVisibility` torna només dades i la
 * redacció viu a `screens/verdictSummary.ts`; aquests tests claven la frase
 * sencera en tots dos idiomes perquè la regressió no pugui tornar d'amagat.
 *
 * També vigila dues regles de format que el `summary` del motor es saltava:
 * els decimals van amb coma (escrivia «0.52°» amb punt) i el percentatge fora
 * de fase central no s'escriu mai com un 100.
 */

import { describe, expect, it } from 'vitest';
import type { VisibilityVerdict } from '../core/visibility/verdict';
import { verdictSummary } from './verdictSummary';

/** Veredicte de base amb la fase central sencera; cada test canvia el que prova. */
function verdict(over: Partial<VisibilityVerdict> = {}): VisibilityVerdict {
  return {
    status: 'central-visible',
    kind: 'total',
    centralVisibleSec: 100,
    centralTotalSec: 100,
    centralLostSec: 0,
    centralVisibleFraction: 1,
    centralFullDiscVisibleSec: 100,
    partialVisibleSec: 5000,
    partialTotalSec: 5000,
    terrainSunsetUtc: null,
    terrainSunriseUtc: null,
    terrainSunsetAzimuthDeg: null,
    terrainSunsetHorizonDeg: null,
    sunsetAdvanceSec: null,
    altitudeDeficitDeg: 0,
    climbToRecoverM: null,
    blockingDistanceKm: null,
    c1Visible: true,
    c2Visible: true,
    maxVisible: true,
    c3Visible: true,
    c4Visible: true,
    c1Lost: false,
    c4Lost: false,
    maxVisibleObscuration: 1,
    sunAltitudeAtMaxDeg: 10,
    horizonAltitudeAtMaxDeg: 1,
    timeline: [],
    ...over,
  };
}

/** El cas que decideix el producte: el relleu es menja part de la totalitat. */
const partial = verdict({
  status: 'central-partial',
  centralTotalSec: 100,
  centralVisibleSec: 65,
  centralLostSec: 35,
  altitudeDeficitDeg: 0.52,
  climbToRecoverM: 27.4,
  blockingDistanceKm: 3.0,
});

describe('verdictSummary', () => {
  it('redacta el cas central-partial en català, amb la coma decimal', () => {
    expect(verdictSummary(partial, 'ca')).toBe(
      'De 1 min 40 s de totalitat només en veuràs 1 min 05 s: el relleu se’n menja 35 s.' +
        ' Caldria guanyar 0,52° d’altura sobre l’horitzó (uns 27 m amunt, amb l’obstacle a 3,0 km).',
    );
  });

  it('redacta el mateix veredicte en castellà, no en català', () => {
    expect(verdictSummary(partial, 'es')).toBe(
      'De 1 min 40 s de totalidad solo verás 1 min 05 s: el relieve se come 35 s.' +
        ' Haría falta ganar 0,52° de altura sobre el horizonte (unos 27 m de subida, con el obstáculo a 3,0 km).',
    );
  });

  it('apostrofa «anularitat» en català: mai «de anularitat»', () => {
    const annular = verdictSummary(
      verdict({ ...partial, kind: 'annular' }),
      'ca',
    );
    expect(annular).toContain('d’anularitat');
    expect(annular).not.toContain('de anularitat');

    const blocked = verdictSummary(
      verdict({
        status: 'central-blocked',
        kind: 'annular',
        centralVisibleSec: 0,
        centralTotalSec: 100,
        centralLostSec: 100,
        maxVisibleObscuration: 0.87,
      }),
      'ca',
    );
    expect(blocked).toContain('l’anularitat');
  });

  it('cada estat surt diferent en cada idioma', () => {
    const statuses: VisibilityVerdict['status'][] = [
      'no-eclipse',
      'sun-blocked',
      'central-blocked',
      'central-partial',
      'central-visible',
      'partial-only',
    ];
    for (const status of statuses) {
      const v = verdict({ ...partial, status });
      expect(verdictSummary(v, 'ca')).not.toBe(verdictSummary(v, 'es'));
    }
  });

  it('fora de fase central el percentatge mai no s’escriu 100', () => {
    const text = verdictSummary(
      verdict({
        status: 'partial-only',
        kind: 'partial',
        centralTotalSec: 0,
        centralVisibleSec: 0,
        centralVisibleFraction: 0,
        centralFullDiscVisibleSec: 0,
        maxVisibleObscuration: 0.9999,
      }),
      'ca',
    );
    expect(text).toContain('99 %');
    expect(text).not.toContain('100');
  });

  it('amb la fase central sencera no suggereix pujar enlloc', () => {
    const text = verdictSummary(
      verdict({ climbToRecoverM: 12, blockingDistanceKm: 2 }),
      'ca',
    );
    expect(text).toBe('1 min 40 s de totalitat sencers per damunt del terreny.');
  });
});
