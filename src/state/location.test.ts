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
  GEOID_UNDULATION_M,
  SAME_PLACE_M,
  distanceM,
  elevationDisagrees,
  isElevationSource,
  isLocationOrigin,
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

  it('una discrepància de debò es diu', () => {
    // 200 m per damunt del terreny no quadren amb cap lectura possible: ni com
    // a ortomètrica ni descomptant el geoide. Això és el que l'avís busca.
    expect(elevationDisagrees({ ...base, gpsElevationM: 430 })).toBe(true);
  });

  it('per sota del terreny també', () => {
    expect(elevationDisagrees({ ...base, gpsElevationM: 110 })).toBe(true);
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

describe('altitud: els dos datums', () => {
  /*
   * EL CAS QUE HO VA DESTAPAR. `coords.altitude` és, segons el W3C, l'altura
   * sobre l'EL·LIPSOIDE WGS84, i Android la dona així. El model del terreny és
   * ortomètric: a Barcelona-el Prat dona 4,0 m i la cota topogràfica de la pista
   * és 4 m. A Ibèria, entre les dues superfícies hi ha de +49 a +56 m, que és
   * just la mida del llindar d'avís. Resultat: gairebé la meitat dels Android
   * de la Península rebien un avís de «el GPS i el model del terreny no
   * coincideixen» sense que passés absolutament res.
   */

  const base: FixedLocation = {
    location: { lat: 41.2974, lon: 2.0833, elevation: 4 },
    origin: 'gps',
    label: 'Barcelona-el Prat',
    accuracyM: 8,
    elevationSource: 'dem',
    gpsElevationM: null,
    atMs: 0,
    restored: false,
  };

  it('la constant està dins de l’interval mesurat a Ibèria', () => {
    // Si algú la toca sense refer el raonament, això el fa llegir.
    expect(GEOID_UNDULATION_M).toBeGreaterThanOrEqual(49);
    expect(GEOID_UNDULATION_M).toBeLessThanOrEqual(56);
  });

  it('un Android a la pista de l’aeroport no rep cap avís', () => {
    // El xip diu 56 m sobre l'el·lipsoide per a un lloc que és a 4 m sobre el
    // mar. Els 52 de diferència són tot geoide i no informen de res.
    expect(elevationDisagrees({ ...base, gpsElevationM: 4 + GEOID_UNDULATION_M })).toBe(
      false,
    );
  });

  it('un iPhone al mateix lloc tampoc', () => {
    // CoreLocation ja resta el geoide: el número que arriba és comparable tal
    // qual. Si restéssim sempre l'ondulació, l'avís sortiria a tots els iPhone
    // en comptes de a tots els Android, que no és cap millora.
    expect(elevationDisagrees({ ...base, gpsElevationM: 4 })).toBe(false);
  });

  it('un error de debò salta el llegeixis com el llegeixis', () => {
    // Dins d'un edifici alt, o amb el GPS rebotat contra una façana: 300 m no
    // quadren ni com a ortomètrics (296) ni descomptant el geoide (244).
    expect(elevationDisagrees({ ...base, gpsElevationM: 300 })).toBe(true);
  });

  it('la zona cega està aquí escrita i és el preu que es paga', () => {
    // Entre 50 i 102 m per damunt del terreny no s'avisa, perquè llegit com a
    // el·lipsoïdal quadraria. Preferim callar aquest cas abans que cridar el
    // llop a mig Ibèria: un avís que surt per no res deixa de llegir-se, i
    // llavors tampoc no serveix el dia que és bo.
    expect(elevationDisagrees({ ...base, gpsElevationM: 4 + 80 })).toBe(false);
    expect(
      elevationDisagrees({
        ...base,
        gpsElevationM: 4 + GEOID_UNDULATION_M + ELEVATION_DISAGREEMENT_M + 1,
      }),
    ).toBe(true);
  });
});

describe('valors que arriben del disc', () => {
  /*
   * Un valor desconegut aquí no és un detall: la barra de la ubicació el fa
   * servir per anar a buscar un text i, si no el troba, peta fora de
   * l'`ErrorBoundary` i deixa l'app en blanc a cada arrencada.
   */

  it('els orígens de debò es reconeixen', () => {
    for (const origin of ['gps', 'map', 'search', 'recent', 'default']) {
      expect(isLocationOrigin(origin)).toBe(true);
    }
  });

  it('qualsevol altra cosa no', () => {
    expect(isLocationOrigin('HACK')).toBe(false);
    expect(isLocationOrigin('')).toBe(false);
    expect(isLocationOrigin(null)).toBe(false);
    expect(isLocationOrigin(42)).toBe(false);
    // I res que vingui de la cadena de prototipus: `'toString'` és una propietat
    // de qualsevol objecte i amb un `in` mal fet passaria per bona.
    expect(isLocationOrigin('toString')).toBe(false);
    expect(isLocationOrigin('constructor')).toBe(false);
  });

  it('les fonts d’altitud, igual', () => {
    for (const source of ['dem', 'gps', 'assumed', 'pending']) {
      expect(isElevationSource(source)).toBe(true);
    }
    expect(isElevationSource('moon')).toBe(false);
    expect(isElevationSource(undefined)).toBe(false);
    expect(isElevationSource('toString')).toBe(false);
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
