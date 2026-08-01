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
 *    pantalla en forma d'hora invàlida, molt lluny d'on es va originar.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_RECENTS,
  mergeRecent,
  parseRecents,
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
