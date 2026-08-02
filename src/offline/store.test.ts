/**
 * L'inventari de punts preparats, provat pel camí de memòria (Node no té
 * IndexedDB i el mòdul promet no llançar mai: aquest és exactament el camí
 * que cau al mode privat o dins d'un iframe bloquejat).
 *
 * EL PRIMER TEST ÉS EL DEL −0, i no per pedanteria: el meridià de Greenwich
 * creua la franja de la totalitat del 2026 pel País Valencià. Un GPS ballant
 * al voltant de lon 0 donava «0.000» o «-0.000» segons el costat del ball, i
 * el mateix mirador sortia dues vegades a la llista de «què tinc desat».
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPreparedPlaces,
  deletePreparedPlace,
  listPreparedPlaces,
  preparedPlaceId,
  savePreparedPlace,
  type PreparedPlace,
} from './store';

function unLloc(partial: Partial<PreparedPlace> & Pick<PreparedPlace, 'lat' | 'lon'>): PreparedPlace {
  return {
    id: preparedPlaceId(partial.lat, partial.lon),
    label: 'prova',
    elevation: 40,
    savedAtMs: 1_000,
    bytes: 1_000_000,
    terrainTiles: 9,
    mapTiles: 12,
    failedTiles: 0,
    maxRangeKm: 60,
    horizonCoverage: 1,
    eclipseIds: ['2026-08-12'],
    ...partial,
  };
}

beforeEach(async () => {
  await clearPreparedPlaces();
});

describe('preparedPlaceId', () => {
  it('els dos costats del meridià de Greenwich cauen a la mateixa clau, sense −0', () => {
    // ±0,0004° de longitud són ±44 m: la mateixa cel·la de ~100 m.
    const oest = preparedPlaceId(39.47, -0.0004);
    const est = preparedPlaceId(39.47, 0.0004);
    expect(oest).toBe(est);
    expect(oest).not.toContain('-0.000');
  });

  it('dins de la mateixa cel·la de ~100 m, el GPS ballant dona la mateixa clau', () => {
    expect(preparedPlaceId(41.6176, 1.8399)).toBe(preparedPlaceId(41.6181, 1.8401));
  });

  it('cel·les diferents, claus diferents', () => {
    expect(preparedPlaceId(41.617, 1.84)).not.toBe(preparedPlaceId(41.619, 1.84));
  });
});

describe("l'inventari en memòria", () => {
  it('desa, llista del més recent al més antic, esborra', async () => {
    await savePreparedPlace(unLloc({ lat: 41.6, lon: 1.84, savedAtMs: 1_000 }));
    await savePreparedPlace(unLloc({ lat: 39.47, lon: -0.38, savedAtMs: 2_000 }));

    const llista = await listPreparedPlaces();
    expect(llista.map((p) => p.savedAtMs)).toEqual([2_000, 1_000]);

    await deletePreparedPlace(llista[0].id);
    expect(await listPreparedPlaces()).toHaveLength(1);
  });

  it('tornar a preparar el mateix punt hi escriu a sobre, no en fa un duplicat', async () => {
    await savePreparedPlace(unLloc({ lat: 41.6176, lon: 1.8399, savedAtMs: 1_000 }));
    await savePreparedPlace(unLloc({ lat: 41.6181, lon: 1.8401, savedAtMs: 2_000 }));

    const llista = await listPreparedPlaces();
    expect(llista).toHaveLength(1);
    expect(llista[0].savedAtMs).toBe(2_000);
  });

  it('una fila vella amb la clau «-0.000» es fon amb la nova i desapareix en llegir', async () => {
    // Fila desada per la versió amb el defecte: clau amb el zero negatiu.
    await savePreparedPlace(
      unLloc({ id: '39.470,-0.000', lat: 39.47, lon: -0.0004, savedAtMs: 1_000 }),
    );
    // La mateixa cel·la tornada a preparar amb la clau bona.
    await savePreparedPlace(unLloc({ lat: 39.47, lon: 0.0004, savedAtMs: 2_000 }));

    const llista = await listPreparedPlaces();
    expect(llista).toHaveLength(1);
    expect(llista[0].savedAtMs).toBe(2_000);

    // La migració és llegir: la fila vella ja no hi és a la segona llegida.
    expect(await listPreparedPlaces()).toHaveLength(1);
  });
});
