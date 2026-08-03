/**
 * Proves de la memòria cau del mapa de calor.
 *
 * A Node no hi ha IndexedDB, així que el que s'exercita aquí és la reserva de
 * sessió — i està bé que sigui així: és exactament el camí que corren el mode
 * privat d'alguns navegadors i els iframes amb l'emmagatzematge bloquejat, i és
 * el que no ha de llançar mai.
 *
 * La prova que importa de debò és la de la VERSIÓ. Servir números d'un motor
 * vell barrejats amb números d'un motor nou és el pitjor error possible en
 * aquesta aplicació: no peta res, no es veu res, i el mapa ensenya segons que
 * ningú no pot explicar d'on surten.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { HeatCellValue } from './compute';
import { HEAT_ENGINE_VERSION } from './compute';
import {
  clearHeatCache,
  heatCellKey,
  indexedDbHeatCache,
  readCachedHeatCells,
  writeCachedHeatCells,
} from './cache';

const ECLIPSE = '2026-08-12';

function cell(id: string, overrides: Partial<HeatCellValue> = {}): HeatCellValue {
  return {
    id,
    lat: 41.77,
    lon: -2.48,
    poly: [
      [-2.49, 41.76],
      [-2.47, 41.76],
      [-2.47, 41.78],
      [-2.49, 41.78],
      [-2.49, 41.76],
    ],
    theoreticalSec: 101.5,
    visibleSec: 88.25,
    detail: 'sieve',
    coverage: 1,
    ...overrides,
  };
}

beforeEach(async () => {
  await clearHeatCache();
});

describe('la clau', () => {
  it('porta la versió del motor al davant, i després l’eclipsi i la cel·la', () => {
    expect(heatCellKey(ECLIPSE, '15/16234/12345', 7)).toBe(
      '7|2026-08-12|15/16234/12345',
    );
    expect(heatCellKey(ECLIPSE, '15/16234/12345')).toBe(
      `${HEAT_ENGINE_VERSION}|2026-08-12|15/16234/12345`,
    );
  });

  it('dos eclipsis no comparteixen mai una cel·la', () => {
    expect(heatCellKey('2026-08-12', '15/1/2')).not.toBe(
      heatCellKey('2027-08-02', '15/1/2'),
    );
  });
});

describe('desar i recuperar', () => {
  it('el que s’ha desat es torna a trobar, número per número', async () => {
    await writeCachedHeatCells(ECLIPSE, [cell('15/1/1'), cell('15/1/2')]);
    const found = await readCachedHeatCells(ECLIPSE, ['15/1/1', '15/1/2', '15/9/9']);

    expect(found.size).toBe(2);
    expect(found.get('15/1/1')?.visibleSec).toBe(88.25);
    expect(found.get('15/1/1')?.theoreticalSec).toBe(101.5);
    expect(found.get('15/1/1')?.detail).toBe('sieve');
    // La que no s'ha desat no hi és: qui pregunta la recalcularà.
    expect(found.has('15/9/9')).toBe(false);
  });

  it('no es desa el polígon: la geometria la torna a fer la graella', async () => {
    await writeCachedHeatCells(ECLIPSE, [cell('15/2/2')]);
    const found = await readCachedHeatCells(ECLIPSE, ['15/2/2']);
    expect(found.get('15/2/2')?.poly).toEqual([]);
  });

  it('les cel·les de teoria no es desen: recalcular-les és més barat que llegir-les', async () => {
    await writeCachedHeatCells(ECLIPSE, [
      cell('15/3/3', { detail: 'theory', visibleSec: null }),
    ]);
    const found = await readCachedHeatCells(ECLIPSE, ['15/3/3']);
    expect(found.size).toBe(0);
  });

  it('demanar-ne cap no és cap error', async () => {
    expect((await readCachedHeatCells(ECLIPSE, [])).size).toBe(0);
    await expect(writeCachedHeatCells(ECLIPSE, [])).resolves.toBeUndefined();
  });
});

describe('la versió del motor mana', () => {
  it('una versió vella no serveix mai números nous, ni al revés', async () => {
    await writeCachedHeatCells(ECLIPSE, [cell('15/4/4')], 3);

    // El motor 3 els troba...
    expect((await readCachedHeatCells(ECLIPSE, ['15/4/4'], 3)).size).toBe(1);
    // ...i el 4 no: recalcular és l'única resposta honesta.
    expect((await readCachedHeatCells(ECLIPSE, ['15/4/4'], 4)).size).toBe(0);
    // Ni tampoc el motor d'ara, que és el cas real quan es puja la versió.
    expect((await readCachedHeatCells(ECLIPSE, ['15/4/4'])).size).toBe(0);
  });

  it('el motor nou pot desar la mateixa cel·la sense trepitjar la vella', async () => {
    await writeCachedHeatCells(ECLIPSE, [cell('15/5/5', { visibleSec: 10 })], 3);
    await writeCachedHeatCells(ECLIPSE, [cell('15/5/5', { visibleSec: 20 })], 4);

    expect((await readCachedHeatCells(ECLIPSE, ['15/5/5'], 3)).get('15/5/5')?.visibleSec).toBe(10);
    expect((await readCachedHeatCells(ECLIPSE, ['15/5/5'], 4)).get('15/5/5')?.visibleSec).toBe(20);
  });
});

describe('l’adaptador que rep el motor', () => {
  it('escriu i llegeix amb la versió d’ara, sense que el motor n’hagi de saber res', async () => {
    await indexedDbHeatCache.write(ECLIPSE, [cell('15/6/6')]);
    const found = await indexedDbHeatCache.read(ECLIPSE, ['15/6/6']);
    expect(found.get('15/6/6')?.visibleSec).toBe(88.25);
  });

  it('buidar-la la buida', async () => {
    await indexedDbHeatCache.write(ECLIPSE, [cell('15/7/7')]);
    await clearHeatCache();
    expect((await indexedDbHeatCache.read(ECLIPSE, ['15/7/7'])).size).toBe(0);
  });
});
