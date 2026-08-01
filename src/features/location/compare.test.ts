/**
 * Proves de la comparació de llocs, amb els números de debò de l'eclipsi del
 * 12 d'agost de 2026.
 *
 * NO SÓN NÚMEROS INVENTATS: surten de `computeLocalCircumstances` per a punts
 * reals, i per això aquestes proves també vigilen que un canvi al motor no
 * canviï en silenci el que el selector de llocs recomana.
 *
 * Durades de la fase central que dona el motor a aquests cinc punts:
 *
 *   Oviedo       43,3619 N   5,8494 O   230 m   →  108,1 s
 *   Burgos       42,3439 N   3,6969 O   860 m   →  103,4 s
 *   Sòria        41,7665 N   2,4790 O  1065 m   →  101,4 s
 *   Valladolid   41,6523 N   4,7245 O   698 m   →   89,2 s
 *   Barcelona    41,3851 N   2,1734 E    12 m   →      0 s  (només parcial)
 *
 * El cas d'Oviedo contra Burgos és el que millor explica per què hi ha llindar:
 * 208 km de cotxe per 4,8 segons. La incertesa de les efemèrides sobre
 * qualsevol hora de contacte d'aquest eclipsi ja és de ±3,4 s. Recomanar aquell
 * viatge seria recomanar-lo per una xifra que amb prou feines sabem sostenir.
 */

import { describe, expect, it } from 'vitest';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import type { LocalCircumstances } from '../../core/astro/types';
import { comparePlaces, WORTH_MOVING_SEC } from './compare';

const ID = '2026-08-12';

const where = (lat: number, lon: number, elevation: number): LocalCircumstances =>
  computeLocalCircumstances(ID, { lat, lon, elevation });

const OVIEDO = where(43.3619, -5.8494, 230);
const BURGOS = where(42.3439, -3.6969, 860);
const VALLADOLID = where(41.6523, -4.7245, 698);
const BARCELONA = where(41.3851, 2.1734, 12);
/** Punt just al caire de la franja: el marge umbral és de −1,06″, dins de σ. */
const EDGE = where(41.0, -4.7245, 700);

const cmp = (a: LocalCircumstances, b: LocalCircumstances) =>
  comparePlaces({ label: 'a', circumstances: a }, { label: 'b', circumstances: b });

describe('la diferència de segons', () => {
  it('la dona signada i en el sentit B menys A', () => {
    const result = cmp(OVIEDO, BURGOS);
    expect(result.aCentralSec).toBeCloseTo(108.14, 1);
    expect(result.bCentralSec).toBeCloseTo(103.37, 1);
    expect(result.deltaSec).toBeCloseTo(-4.77, 1);
    expect(result.better).toBe('a');
  });

  it('la distància és la de veritat', () => {
    expect(cmp(OVIEDO, BURGOS).distanceKm).toBeCloseTo(208.8, 0);
  });
});

describe('quan val la pena moure’s', () => {
  it('quatre segons i vuit dècimes no ho valen', () => {
    // 208 km per 4,8 s, i la incertesa d'una hora de contacte és de ±3,4 s.
    const result = cmp(OVIEDO, BURGOS);
    expect(Math.abs(result.deltaSec)).toBeLessThan(WORTH_MOVING_SEC);
    expect(result.worthMoving).toBe(false);
  });

  it('dinou segons sí', () => {
    const result = cmp(OVIEDO, VALLADOLID);
    expect(result.deltaSec).toBeCloseTo(-18.9, 0);
    expect(result.worthMoving).toBe(true);
    expect(result.better).toBe('a');
  });

  it('el llindar és el que està documentat', () => {
    // Ve de la incertesa de contacte de les efemèrides: ±3,4 s el 2026, ±4,3 s
    // el 2027 i ±4,7 s el 2028, arrodonit cap amunt. Si algú el canvia, que
    // hagi de llegir el perquè.
    expect(WORTH_MOVING_SEC).toBe(5);
  });
});

describe('quan la diferència no és de segons', () => {
  it('a un punt hi ha totalitat i a l’altre no', () => {
    const result = cmp(OVIEDO, BARCELONA);
    expect(result.changesKind).toBe(true);
    expect(result.bCentralSec).toBe(0);
    expect(result.better).toBe('a');
    // Barcelona es queda a un 99,84 % d'ocultació i no veu la corona. La
    // diferència entre 99,84 % i el 100 % no és percentual, és tot l'eclipsi.
    expect(result.bObscuration).toBeGreaterThan(0.99);
  });
});

describe('quan no es pot decidir', () => {
  it('amb un punt al caire de la franja no es dona guanyador', () => {
    // Allà la durada no és una funció suau del biaix de les efemèrides sinó un
    // esglaó: segons el signe de l'error hi ha vint segons de totalitat o cap.
    expect(EDGE.edgeUncertain).toBe(true);
    const result = cmp(BURGOS, EDGE);
    expect(result.decidable).toBe(false);
    expect(result.worthMoving).toBe(false);
    expect(result.better).toBeNull();
  });

  it('comparar dos eclipsis diferents no dona una diferència', () => {
    const other = computeLocalCircumstances('2027-08-02', {
      lat: 36.5271,
      lon: -6.2886,
      elevation: 10,
    });
    const result = cmp(BURGOS, other);
    expect(result.decidable).toBe(false);
    expect(result.better).toBeNull();
  });
});

describe('la diferència d’hora del màxim', () => {
  it('és positiva quan a B passa més tard', () => {
    // El 2026 l'ombra travessa Espanya de nord-oest a sud-est: a Burgos el
    // màxim passa 77,6 s després que a Oviedo.
    expect(cmp(OVIEDO, BURGOS).deltaMaxTimeSec).toBeCloseTo(77.6, 0);
  });
});
