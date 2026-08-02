/**
 * Proves de l'historial.
 *
 * Dues coses hi són crítiques i totes dues es proven aquí:
 *
 * 1. QUE NO S'OMPLI DE REPETICIONS. Prémer «On soc ara» tres vegades seguides
 *    dona tres coordenades lleugerament diferents del mateix banc del parc. Si
 *    entressin com a tres entrades, els llocs de debò —els que algú va buscar
 *    per comparar— cauen pel final de la llista i es perden.
 * 2. QUE UNA ENTRADA CORRUPTA NO S'ENDUGUI L'APP. El contingut de
 *    `localStorage` és de l'usuari i sobreviu a les versions. Una `lat` que és
 *    text acabaria com un `NaN` dins del càlcul d'efemèrides i sortiria a la
 *    pantalla en forma d'hora invàlida, molt lluny d'on es va originar. I un
 *    `origin` que no existeix és pitjor encara: la barra de la ubicació el fa
 *    servir per anar a buscar un text, no el troba, peta, i com que la barra
 *    viu fora de l'`ErrorBoundary` se'n duu l'app sencera — a cada arrencada,
 *    perquè el valor es torna a llegir del disc.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_RECENTS,
  mergeRecent,
  parseLastPlace,
  parseRecents,
  persistedElevationSource,
  removeRecent,
  type RecentPlace,
} from './recentPlaces';

const place = (
  lat: number,
  lon: number,
  extra: Partial<RecentPlace> = {},
): RecentPlace => ({
  lat,
  lon,
  elevation: 0,
  label: null,
  origin: 'map',
  atMs: 1_000,
  ...extra,
});

describe('afegir un lloc', () => {
  it('el més recent va primer', () => {
    const list = mergeRecent(mergeRecent([], place(41, 1)), place(42, 2));
    expect([list[0].lat, list[1].lat]).toEqual([42, 41]);
  });

  it('un punt a cent metres és el mateix lloc i només puja a dalt', () => {
    const list = mergeRecent(
      [place(41.3851, 2.1734), place(42.3439, -3.6969)],
      // 0,0009° de latitud són 100 m: per sota dels 150 m del llindar.
      place(41.386, 2.1734),
    );
    expect(list).toHaveLength(2);
    expect(list[0].lat).toBeCloseTo(41.386, 4);
  });

  it('un punt a mig quilòmetre sí que és un lloc nou', () => {
    const list = mergeRecent([place(41.3851, 2.1734)], place(41.3896, 2.1734));
    expect(list).toHaveLength(2);
  });

  it('en fusionar es queda el nom que ja hi havia', () => {
    // Tocar el mapa damunt d'un lloc que ja tenia nom no li ha de robar el nom:
    // sense xarxa, el nom no es pot tornar a resoldre i es perdria per sempre.
    const list = mergeRecent(
      [place(42.3439, -3.6969, { label: 'Burgos' })],
      place(42.3441, -3.697),
    );
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('Burgos');
  });

  it('un nom nou mana sobre el vell', () => {
    const list = mergeRecent(
      [place(42.3439, -3.6969, { label: 'Burgos' })],
      place(42.3441, -3.697, { label: 'Catedral de Burgos' }),
    );
    expect(list[0].label).toBe('Catedral de Burgos');
  });

  it('la llista es queda al màxim i el que cau és el més antic', () => {
    let list: RecentPlace[] = [];
    for (let i = 0; i < MAX_RECENTS + 3; i++) list = mergeRecent(list, place(40 + i, 0));
    expect(list).toHaveLength(MAX_RECENTS);
    expect(list[0].lat).toBe(40 + MAX_RECENTS + 2);
    expect(list.some((p) => p.lat === 40)).toBe(false);
  });
});

describe('treure un lloc', () => {
  it('el treu per proximitat, no per identitat d’objecte', () => {
    const list = removeRecent(
      [place(41.3851, 2.1734), place(42.3439, -3.6969)],
      { lat: 41.3855, lon: 2.1736, elevation: 0 },
    );
    expect(list).toHaveLength(1);
    expect(list[0].lat).toBe(42.3439);
  });

  it('el que no hi és no en treu cap', () => {
    const list = removeRecent([place(41, 1)], { lat: 0, lon: 0, elevation: 0 });
    expect(list).toHaveLength(1);
  });
});

describe('llegir el que hi ha desat', () => {
  it('res desat és una llista buida', () => {
    expect(parseRecents(null)).toEqual([]);
  });

  it('un text que no és JSON no peta', () => {
    expect(parseRecents('{no')).toEqual([]);
  });

  it('el que no és una llista es descarta', () => {
    expect(parseRecents('{"lat":41}')).toEqual([]);
  });

  it('les entrades malmeses cauen i les bones es queden', () => {
    const raw = JSON.stringify([
      { lat: '41', lon: 2, elevation: 0, label: null, origin: 'map', atMs: 1 },
      { lat: 41, lon: 2, elevation: 0, label: null, origin: 'map', atMs: 1 },
      { lat: 200, lon: 2, elevation: 0, label: null, origin: 'map', atMs: 1 },
      { lat: Number.NaN, lon: 2, elevation: 0, label: null, origin: 'map', atMs: 1 },
    ]);
    const list = parseRecents(raw);
    expect(list).toHaveLength(1);
    expect(list[0].lat).toBe(41);
  });

  it('una llista massa llarga es retalla', () => {
    const raw = JSON.stringify(
      Array.from({ length: 40 }, (_, i) => place(40 + i * 0.1, 0)),
    );
    expect(parseRecents(raw)).toHaveLength(MAX_RECENTS);
  });
});

describe('valors d’enumeració que no existeixen', () => {
  /*
   * Aquests no són casos teòrics. Hi arriba qualsevol versió antiga de l'app
   * amb un valor que després es va treure, qualsevol prova a mig fer, i
   * qualsevol persona que obri les eines del navegador. Fins ara passaven la
   * validació —«és text, doncs endavant»— i el que petava era la pantalla.
   */

  it('un origen inventat es descarta', () => {
    const raw = JSON.stringify([
      { lat: 41, lon: 2, elevation: 0, label: null, origin: 'HACK', atMs: 1 },
    ]);
    expect(parseRecents(raw)).toEqual([]);
  });

  it('una font d’altitud inventada es descarta', () => {
    const raw = JSON.stringify([
      {
        lat: 41,
        lon: 2,
        elevation: 0,
        label: null,
        origin: 'map',
        elevationSource: 'moon',
        atMs: 1,
      },
    ]);
    expect(parseRecents(raw)).toEqual([]);
  });

  it('els sis orígens de debò passen', () => {
    // `'link'` (el punt que ha arribat per un enllaç compartit) hi és des que es
    // pot dir «ens trobem aquí» amb l'app. Es desa com qualsevol altre lloc
    // triat, o sigui que torna del disc i ha de passar per aquí.
    const raw = JSON.stringify(
      (['gps', 'map', 'search', 'recent', 'link', 'default'] as const).map((origin, i) =>
        place(40 + i, 0, { origin }),
      ),
    );
    expect(parseRecents(raw)).toHaveLength(6);
  });

  it('les quatre fonts d’altitud de debò passen', () => {
    const raw = JSON.stringify(
      (['dem', 'gps', 'assumed', 'pending'] as const).map((elevationSource, i) =>
        place(40 + i, 0, { elevationSource }),
      ),
    );
    expect(parseRecents(raw)).toHaveLength(4);
  });

  it('una entrada antiga sense font d’altitud segueix valent', () => {
    // Que el camp no hi sigui és legítim: vol dir «no se sap». El que no pot
    // ser és que hi sigui amb un valor que no sabem interpretar.
    const raw = JSON.stringify([place(41, 2)]);
    expect(parseRecents(raw)).toHaveLength(1);
  });
});

describe('l’últim lloc', () => {
  /*
   * Aquest és l'únic valor que es pinta sense que l'usuari toqui res, o sigui
   * que si no s'entén, l'app peta abans d'ensenyar res i torna a petar a la
   * propera arrencada. La validació ha de ser la mateixa que la de l'historial.
   */

  it('res desat no és cap lloc', () => {
    expect(parseLastPlace(null)).toBeNull();
  });

  it('un text que no és JSON no peta', () => {
    expect(parseLastPlace('{no')).toBeNull();
  });

  it('un origen inventat no arriba mai a la barra', () => {
    const raw = JSON.stringify({
      lat: 41,
      lon: 2,
      elevation: 0,
      label: null,
      origin: 'HACK',
      atMs: 1,
    });
    expect(parseLastPlace(raw)).toBeNull();
  });

  it('una font d’altitud inventada tampoc', () => {
    const raw = JSON.stringify({
      lat: 41,
      lon: 2,
      elevation: 0,
      label: null,
      origin: 'gps',
      elevationSource: 'moon',
      atMs: 1,
    });
    expect(parseLastPlace(raw)).toBeNull();
  });

  it('un lloc bo torna sencer', () => {
    const raw = JSON.stringify(place(42.5, 0.75, { elevationSource: 'dem', label: 'Refugi' }));
    expect(parseLastPlace(raw)).toMatchObject({
      lat: 42.5,
      lon: 0.75,
      label: 'Refugi',
      elevationSource: 'dem',
    });
  });
});

describe('la font de l’altitud que es desa', () => {
  it('«pendent» no es desa mai', () => {
    // Vol dir «hi ha una tessel·la de camí», i cap petició sobreviu a tancar
    // l'app: el que en queda és un zero, i un zero desat com si fos bo posa un
    // punt de 1.520 m al nivell del mar a totes les hores dels contactes.
    expect(persistedElevationSource('pending')).toBe('assumed');
  });

  it('la resta es desen tal com són', () => {
    expect(persistedElevationSource('dem')).toBe('dem');
    expect(persistedElevationSource('gps')).toBe('gps');
    expect(persistedElevationSource('assumed')).toBe('assumed');
  });
});
