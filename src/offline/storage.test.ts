/**
 * La promesa de capçalera del mòdul offline: CAP funció llança.
 *
 * Node no té `navigator.storage` ni `caches`, que és exactament l'aspecte
 * que té un navegador vell, un iframe amb l'emmagatzematge bloquejat o el
 * mode privat de Safari. Aquests tests claven els valors de retirada
 * documentats: si algú hi afegeix una crida sense guarda, peta aquí i no al
 * camp, sense connexió, el dia 12.
 */

import { describe, expect, it } from 'vitest';
import {
  countCachedTiles,
  countCacheEntries,
  estimateStorage,
  requestPersistentStorage,
} from './storage';

describe('storage sense APIs de navegador', () => {
  it("estimateStorage torna l'estimació buida amb supported:false", async () => {
    await expect(estimateStorage()).resolves.toEqual({
      supported: false,
      usageBytes: 0,
      quotaBytes: 0,
      persisted: false,
    });
  });

  it('requestPersistentStorage torna fals, com a iOS', async () => {
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('comptar tessel·les sense Cache Storage dona zeros, no un error', async () => {
    await expect(countCacheEntries('appeclipsi-terrain')).resolves.toBe(0);
    await expect(countCachedTiles()).resolves.toEqual({ terrain: 0, basemap: 0 });
  });
});
