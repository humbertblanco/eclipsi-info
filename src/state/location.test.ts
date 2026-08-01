/**
 * Proves del model de la ubicació.
 *
 * El que es comprova aquí no és aritmètica: és que l'app no pugui fingir
 * precisió. Dos punts a cinquanta metres NO són dos llocs, i una altitud del
 * GPS que discrepa de la del terreny s'ha de dir en comptes d'amagar-se.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCATION,
  ELEVATION_DISAGREEMENT_M,
  SAME_PLACE_M,
  distanceM,
  elevationDisagrees,
  isPlaceholder,
  isSamePlace,
  type FixedLocation,
} from './location';

const at = (lat: number, lon: number, elevation = 0) => ({ lat, lon, elevation });

describe('distància', () => {
  it('coincideix amb la referència que ja fa servir el nucli', () => {
    // El mateix parell i el mateix número que `core/spots/grid.test.ts`, que
    // el documenta com «119,30 km per la fórmula d'haversine». Si les dues
    // implementacions divergeixen, aquesta prova ho canta.
    const soria = at(41.7665, -2.479);
    const burgos = at(42.3439, -3.6969);
    expect(distanceM(soria, burgos) / 1000).toBeCloseTo(119.3, 1);
  });

  it('un grau de latitud són 111,2 km', () => {
    expect(distanceM(at(0, 0), at(1, 0)) / 1000).toBeCloseTo(111.195, 2);
  });

  it('Barcelona a Madrid són uns 505 km', () => {
    expect(distanceM(at(41.3851, 2.1734), at(40.4168, -3.7038)) / 1000).toBeCloseTo(
      505.4,
      0,
    );
  });

  it('el mateix punt és zero', () => {
    expect(distanceM(at(41.3851, 2.1734), at(41.3851, 2.1734))).toBe(0);
  });
});

describe('el mateix lloc', () => {
  it('cent metres són el mateix lloc', () => {
    // 0,0009° de latitud són 100 m. Per sota del llindar de 150.
    expect(isSamePlace(at(41.3851, 2.1734), at(41.386, 2.1734))).toBe(true);
  });

  it('mig quilòmetre ja són dos llocs', () => {
    expect(isSamePlace(at(41.3851, 2.1734), at(41.3896, 2.1734))).toBe(false);
  });

  it('el llindar és el que està documentat', () => {
    // Si algú el toca sense refer el raonament (15 s/km al caire de la franja
    // contra ±3,4 s d'incertesa de les efemèrides), això falla i el fa llegir.
    expect(SAME_PLACE_M).toBe(150);
  });
});

describe('altitud', () => {
  const base: FixedLocation = {
    location: at(43.3619, -5.8494, 230),
    origin: 'gps',
    label: null,
    accuracyM: 8,
    elevationSource: 'dem',
    gpsElevationM: 245,
    atMs: 0,
    restored: false,
  };

  it('quinze metres de diferència són soroll normal i no es diuen', () => {
    expect(elevationDisagrees(base)).toBe(false);
  });

  it('per damunt del llindar sí que es diu', () => {
    expect(
      elevationDisagrees({ ...base, gpsElevationM: 230 + ELEVATION_DISAGREEMENT_M + 1 }),
    ).toBe(true);
  });

  it('sense altitud del GPS no hi ha res a comparar', () => {
    expect(elevationDisagrees({ ...base, gpsElevationM: null })).toBe(false);
  });

  it("si l'altitud no ve del model del terreny, la comparació no vol dir res", () => {
    // Amb `gps` o `assumed`, les dues xifres són la mateixa o cap: comparar-les
    // donaria un avís que no informa de res.
    expect(
      elevationDisagrees({ ...base, elevationSource: 'gps', gpsElevationM: 900 }),
    ).toBe(false);
  });
});

describe('punt d’exemple', () => {
  it('sense lloc i amb el punt per defecte, les xifres no són teves', () => {
    expect(isPlaceholder(null)).toBe(true);
    expect(
      isPlaceholder({
        location: DEFAULT_LOCATION,
        origin: 'default',
        label: null,
        accuracyM: null,
        elevationSource: 'dem',
        gpsElevationM: null,
        atMs: 0,
        restored: false,
      }),
    ).toBe(true);
  });

  it('un lloc triat per l’usuari no ho és', () => {
    expect(
      isPlaceholder({
        location: at(42.3439, -3.6969, 860),
        origin: 'search',
        label: 'Burgos',
        accuracyM: null,
        elevationSource: 'dem',
        gpsElevationM: null,
        atMs: 0,
        restored: false,
      }),
    ).toBe(false);
  });
});
