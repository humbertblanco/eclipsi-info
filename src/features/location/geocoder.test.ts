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
  subkind: 'town',
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

describe('resultats que es veurien iguals', () => {
  // El cas que ho va destapar: buscant «Burgos», Photon torna la ciutat
  // (place=city) i el terme municipal (boundary=administrative), tots dos
  // «Burgos — Castilla y León». Sense dir què és cadascun, no es pot triar.
  const city: PlaceHit = {
    id: 'N166920565',
    name: 'Burgos',
    detail: 'Castilla y León',
    lat: 42.3439,
    lon: -3.6969,
    kind: 'settlement',
    subkind: 'city',
  };
  const municipality: PlaceHit = {
    id: 'R344165',
    name: 'Burgos',
    detail: 'Castilla y León',
    lat: 42.3506,
    lon: -3.6893,
    kind: 'other',
    subkind: 'municipality',
  };

  it('dues files idèntiques a ull diuen què és cadascuna', async () => {
    setPlaceSearch(async () => [city, municipality]);
    const outcome = await searchPlaces('Burgos');
    expect(outcome).toEqual({
      status: 'ok',
      hits: [
        { ...city, detail: 'Castilla y León · ciutat/ciudad' },
        { ...municipality, detail: 'Castilla y León · municipi/municipio' },
      ],
    });
  });

  it('sense context, el tipus és tot el detail', async () => {
    setPlaceSearch(async () => [
      { ...city, detail: null },
      { ...municipality, detail: null },
    ]);
    const outcome = await searchPlaces('Burgos');
    expect(outcome).toEqual({
      status: 'ok',
      hits: [
        { ...city, detail: 'ciutat/ciudad' },
        { ...municipality, detail: 'municipi/municipio' },
      ],
    });
  });

  it('el mateix objecte OSM repetit es fusiona, no es desempata', async () => {
    // Dues files del mateix lloc són una mentida de l'abundància: si
    // l'identificador coincideix, no hi ha res a distingir.
    setPlaceSearch(async () => [city, { ...city }]);
    expect(await searchPlaces('Burgos')).toEqual({ status: 'ok', hits: [city] });
  });

  it('les files que ja es distingeixen no carreguen el tipus', async () => {
    // El tipus només afegeix soroll quan no fa falta: tres Cervera amb
    // comarques diferents ja es distingeixen soles.
    const cervera = { ...city, id: 'R343956', name: 'Cervera', detail: 'Segarra · Catalunya' };
    const rioAlhama: PlaceHit = {
      id: 'R339888',
      name: 'Cervera',
      detail: 'La Rioja',
      lat: 41.9976,
      lon: -1.9403,
      kind: 'settlement',
      subkind: 'village',
    };
    setPlaceSearch(async () => [cervera, rioAlhama]);
    expect(await searchPlaces('Cervera')).toEqual({
      status: 'ok',
      hits: [cervera, rioAlhama],
    });
  });

  it('un cim no empata amb un poble: la fila ja el marca com a cim', async () => {
    // La interfície prefixa «Cim o coll» als cims; un cim i un poble amb el
    // mateix nom i el mateix context ja es veuen diferents sense tocar res.
    const peak: PlaceHit = {
      ...city,
      id: 'N1249818402',
      kind: 'peak',
      subkind: 'peak',
    };
    setPlaceSearch(async () => [city, peak]);
    expect(await searchPlaces('Burgos')).toEqual({ status: 'ok', hits: [city, peak] });
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
