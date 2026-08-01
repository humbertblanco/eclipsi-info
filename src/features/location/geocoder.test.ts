/**
 * Proves de l'endoll del cercador de topònims.
 *
 * CAP D'AQUESTES PROVES TOCA LA XARXA. Totes substitueixen el client amb
 * `setPlaceSearch`: una suite que depèn d'un servei gratuït d'un tercer falla
 * els dies que aquell servei va lent, i llavors deixa de dir res sobre el
 * nostre codi. Del client de debò se n'encarreguen les proves de
 * `src/core/places/`.
 *
 * QUÈ ES PROVA DE VERITAT: que l'app segueixi sencera quan els noms de lloc no
 * hi són. La regla del producte és que el terreny i les efemèrides funcionen
 * sense xarxa i els noms no; això només és acceptable si la falta de noms és un
 * estat NORMAL i explicat, i no una excepció que trenca la fulla de tria.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MIN_QUERY_LENGTH,
  SEARCH_LIMIT,
  resetPlaceSearch,
  searchPlaces,
  setPlaceSearch,
  type PlaceHit,
} from './geocoder';

afterEach(() => {
  resetPlaceSearch();
  vi.unstubAllGlobals();
});

const hit: PlaceHit = {
  id: 'R343063',
  name: 'Peníscola / Peñíscola',
  detail: 'el Baix Maestrat · Comunitat Valenciana',
  lat: 40.3578,
  lon: 0.4074,
  kind: 'settlement',
};

describe('consultes massa curtes', () => {
  it('no gasten cap petició', async () => {
    let calls = 0;
    setPlaceSearch(async () => {
      calls++;
      return [hit];
    });
    expect(MIN_QUERY_LENGTH).toBe(2);
    expect(await searchPlaces('P')).toEqual({ status: 'empty' });
    expect(await searchPlaces('  ')).toEqual({ status: 'empty' });
    expect(calls).toBe(0);
  });
});

describe('cerques que van bé', () => {
  it('tornen els resultats', async () => {
    setPlaceSearch(async () => [hit]);
    expect(await searchPlaces('Peníscola')).toEqual({ status: 'ok', hits: [hit] });
  });

  it('cap resultat no és un error', async () => {
    setPlaceSearch(async () => []);
    expect(await searchPlaces('Xyzzy')).toEqual({ status: 'empty' });
  });

  it('retalla els espais abans de buscar', async () => {
    let seen = '';
    setPlaceSearch(async (query) => {
      seen = query;
      return [hit];
    });
    await searchPlaces('  Peníscola  ');
    expect(seen).toBe('Peníscola');
  });

  it('el límit i el biaix arriben al client', async () => {
    let opts: Record<string, unknown> = {};
    setPlaceSearch(async (_query, options) => {
      opts = { ...options };
      return [hit];
    });
    await searchPlaces('Cervera', { biasLat: 42.3439, biasLon: -3.6969 });
    expect(opts.limit).toBe(SEARCH_LIMIT);
    // El biaix no és cosmètic: hi ha tres Cervera a la península.
    expect(opts.biasLat).toBe(42.3439);
    expect(opts.biasLon).toBe(-3.6969);
  });
});

describe('cerques que van malament', () => {
  it('sense xarxa no s’intenta la petició', async () => {
    // Deixar-la sortir voldria dir que l'usuari es menja el temps d'espera
    // sencer mirant una filadora, en comptes de llegir què pot fer.
    let calls = 0;
    setPlaceSearch(async () => {
      calls++;
      return [hit];
    });
    vi.stubGlobal('navigator', { onLine: false });
    expect(await searchPlaces('Peníscola')).toEqual({ status: 'offline' });
    expect(calls).toBe(0);
  });

  it('un servei que peta es diu, no s’amaga', async () => {
    setPlaceSearch(async () => {
      throw new Error('500');
    });
    expect(await searchPlaces('Peníscola')).toEqual({ status: 'failed' });
  });

  it('una cerca cancel·lada no és un error', async () => {
    // Passa contínuament: l'usuari segueix escrivint i la petició anterior es
    // talla. Ensenyar-hi «ha fallat» seria mentir sobre el que ha passat, i
    // buidar la llista faria pampallugues a cada tecla.
    setPlaceSearch(async () => {
      throw new DOMException('aborted', 'AbortError');
    });
    expect(await searchPlaces('Peníscola')).toEqual({ status: 'superseded' });
  });
});
