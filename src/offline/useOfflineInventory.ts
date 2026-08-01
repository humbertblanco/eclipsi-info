/**
 * Inventari del que hi ha desat: punts preparats, tessel·les i espai ocupat.
 *
 * És la resposta a la pregunta que es fa l'usuari abans de sortir de casa
 * ("què tinc, i què em falta?") i, sobretot, la que es fa al camp quan no
 * carrega res. Per això es rellegeix quan l'app torna a primer pla: entre una
 * cosa i l'altra el navegador pot haver buidat mitja memòria cau.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  countCachedTiles,
  estimateStorage,
  clearTileCaches,
  type CachedTileCounts,
  type StorageSummary,
} from './storage';
import {
  deletePreparedPlace,
  listPreparedPlaces,
  type PreparedPlace,
} from './store';

export interface OfflineInventory {
  places: PreparedPlace[];
  storage: StorageSummary;
  tiles: CachedTileCounts;
  loading: boolean;
  /** Torna a llegir-ho tot. */
  refresh: () => void;
  /** Treu un punt de la llista (les tessel·les es queden: són compartides). */
  forget: (id: string) => Promise<void>;
  /** Esborra totes les tessel·les desades. L'app seguirà obrint-se offline. */
  clearTiles: () => Promise<void>;
}

const EMPTY_STORAGE: StorageSummary = {
  supported: false,
  usageBytes: 0,
  quotaBytes: 0,
  persisted: false,
};

export function useOfflineInventory(): OfflineInventory {
  const [places, setPlaces] = useState<PreparedPlace[]>([]);
  const [storage, setStorage] = useState<StorageSummary>(EMPTY_STORAGE);
  const [tiles, setTiles] = useState<CachedTileCounts>({ terrain: 0, basemap: 0 });
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      const [nextPlaces, nextStorage, nextTiles] = await Promise.all([
        listPreparedPlaces(),
        estimateStorage(),
        countCachedTiles(),
      ]);
      if (cancelled) return;
      setPlaces(nextPlaces);
      setStorage(nextStorage);
      setTiles(nextTiles);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const forget = useCallback(
    async (id: string) => {
      await deletePreparedPlace(id);
      refresh();
    },
    [refresh],
  );

  const clear = useCallback(async () => {
    await clearTileCaches();
    refresh();
  }, [refresh]);

  return { places, storage, tiles, loading, refresh, forget, clearTiles: clear };
}
