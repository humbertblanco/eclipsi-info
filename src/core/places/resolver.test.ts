/**
 * Memòria cau, antirebot i cua, amb el client simulat.
 *
 * Aquestes tres coses són el que separa un ús acceptable d'un abús que ens
 * faria bloquejar. Es proven comptant PETICIONS, no comprovant resultats: el
 * que importa aquí no és què es torna, sinó quantes vegades s'ha preguntat.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheKeyFor, createPlaceCache, snapCoordinate, type PlaceCacheStorage } from './cache';
import { createRequestQueue, createSettler, SUPERSEDED } from './queue';
import { createPlaceResolver } from './resolver';
import { buildPlaceName } from './nearest';

/* ----------------------------------------------------------- eines de prova */

/** Magatzem fals amb la mateixa interfície que `localStorage`. */
function fakeStorage(): PlaceCacheStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

/** Resposta de Photon amb un sol nucli, a les coordenades que es donin. */
function photonBody(name: string, lat: number, lon: number): string {
  return JSON.stringify({
    features: [
      {
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          name,
          osm_id: 1,
          osm_type: 'N',
          osm_key: 'place',
          osm_value: 'village',
          county: 'Segarra',
          state: 'Catalunya',
          countrycode: 'ES',
        },
      },
    ],
  });
}

/** `fetch` simulat que compta crides i desa les URL demanades. */
function spyFetch(name = 'Cervera') {
  const urls: string[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    const params = new URL(url).searchParams;
    const lat = Number(params.get('lat') ?? 0);
    const lon = Number(params.get('lon') ?? 0);
    return new Response(photonBody(name, lat, lon), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return { impl: impl as unknown as typeof fetch, urls, calls: () => impl.mock.calls.length };
}

/** Resolutor sense espaiat entre peticions: aquí no és el que es prova. */
function testResolver(fetchImpl: typeof fetch, settleMs = 500) {
  return createPlaceResolver({
    cache: createPlaceCache(fakeStorage()),
    queue: createRequestQueue(0),
    settleMs,
    searchSettleMs: settleMs,
    fetchImpl,
  });
}

/* ------------------------------------------------------------ memòria cau */

describe('memòria cau', () => {
  it('indexa a la cel·la d’uns 100 m', () => {
    // Tres decimals: 111 m de nord a sud, uns 82 m d'est a oest a 43° N.
    expect(cacheKeyFor(43.36194, -5.84941)).toBe('43.362,-5.849');
    // Moure's 30 m no canvia de cel·la…
    expect(cacheKeyFor(43.3621, -5.8494)).toBe(cacheKeyFor(43.36194, -5.84941));
    // …i moure's 200 m sí que en canvia.
    expect(cacheKeyFor(43.3639, -5.8494)).not.toBe(cacheKeyFor(43.36194, -5.84941));
  });

  it('no deixa que el −0 faci una clau diferent del 0', () => {
    expect(snapCoordinate(-0.0001)).toBe(0);
    expect(cacheKeyFor(0, -0.0002)).toBe('0.000,0.000');
  });

  it('sobreviu a un JSON trencat sense llançar', () => {
    const storage = fakeStorage();
    storage.setItem('eclipsi.places.v1', '{no és json');
    const cache = createPlaceCache(storage);
    expect(cache.read(43.362, -5.849)).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it('funciona sense magatzem persistent, en memòria', () => {
    const cache = createPlaceCache(null);
    const place = buildPlaceName([], 43.362, -5.849, 1000);
    cache.write(43.362, -5.849, place);
    expect(cache.read(43.362, -5.849)?.precision).toBe('none');
  });

  it('caduca abans un “aquí no hi ha res” que un nom trobat', () => {
    const cache = createPlaceCache(fakeStorage());
    const empty = buildPlaceName([], 42, 1, 0);
    cache.write(42, 1, empty, 0);

    // Als deu dies el buit ja ha caducat (TTL de set dies)…
    const tenDays = 10 * 24 * 3_600_000;
    expect(cache.read(42, 1, tenDays)).toBeNull();

    // …mentre que un nom trobat aguanta noranta dies.
    const found = buildPlaceName(
      [
        {
          name: 'Cervera',
          rank: 'town',
          lat: 41.6704,
          lon: 1.268,
          county: 'Segarra',
          state: 'Catalunya',
          countryCode: 'es',
          osmId: 'N1',
        },
      ],
      41.67,
      1.268,
      0,
    );
    cache.write(41.67, 1.268, found, 0);
    expect(cache.read(41.67, 1.268, tenDays)?.settlement?.name).toBe('Cervera');
  });
});

describe('la memòria cau estalvia peticions', () => {
  it('no torna a preguntar pel mateix punt', async () => {
    const fetcher = spyFetch();
    const resolver = testResolver(fetcher.impl);

    const first = await resolver.resolve(41.6704, 1.268);
    expect(first?.settlement?.name).toBe('Cervera');
    expect(fetcher.calls()).toBe(1);
    expect(first?.cached).toBe(false);

    const second = await resolver.resolve(41.6704, 1.268);
    expect(fetcher.calls()).toBe(1);
    expect(second?.cached).toBe(true);
  });

  it('tampoc no torna a preguntar per un punt de la mateixa cel·la', async () => {
    const fetcher = spyFetch();
    const resolver = testResolver(fetcher.impl);

    await resolver.resolve(41.67012, 1.26801);
    // Uns 35 m més enllà: el tremolor típic d'un GPS. Mateixa cel·la.
    await resolver.resolve(41.67043, 1.26838);
    expect(fetcher.calls()).toBe(1);
  });

  it('sí que pregunta quan et mous de debò', async () => {
    const fetcher = spyFetch();
    const resolver = testResolver(fetcher.impl);

    await resolver.resolve(41.6704, 1.268);
    await resolver.resolve(41.7204, 1.268); // 5,5 km més al nord
    expect(fetcher.calls()).toBe(2);
  });

  it('desa també els punts on no hi ha res, i no els torna a demanar', async () => {
    const empty = vi.fn(async () => new Response('{"features":[]}', { status: 200 }));
    const resolver = testResolver(empty as unknown as typeof fetch);

    const first = await resolver.resolve(43.78, -7.05);
    expect(first?.precision).toBe('none');
    await resolver.resolve(43.78, -7.05);
    expect(empty.mock.calls.length).toBe(1);
  });

  it('ajunta dues peticions simultànies del mateix punt en una', async () => {
    const fetcher = spyFetch();
    const resolver = testResolver(fetcher.impl);

    const [a, b] = await Promise.all([
      resolver.resolve(41.6704, 1.268),
      resolver.resolve(41.6704, 1.268),
    ]);
    expect(fetcher.calls()).toBe(1);
    expect(a?.settlement?.name).toBe(b?.settlement?.name);
  });

  it('demana sempre la mateixa URL per a la mateixa cel·la', async () => {
    const fetcher = spyFetch();
    const resolver = testResolver(fetcher.impl);

    await resolver.resolve(41.67012, 1.26809);
    await resolver.resolve(41.72, 1.268);
    await resolver.resolve(41.67038, 1.26795, { forceRefresh: true });

    // La primera i la tercera són la mateixa cel·la: URL idèntica, o sigui
    // que fins i tot la memòria cau HTTP del navegador les ajunta.
    expect(fetcher.urls[0]).toBe(fetcher.urls[2]);
    expect(fetcher.urls[0]).not.toBe(fetcher.urls[1]);
  });

  it('`peek` mira la memòria cau i no toca mai la xarxa', async () => {
    const fetcher = spyFetch();
    const resolver = testResolver(fetcher.impl);

    expect(resolver.peek(41.6704, 1.268)).toBeNull();
    await resolver.resolve(41.6704, 1.268);
    expect(resolver.peek(41.6704, 1.268)?.settlement?.name).toBe('Cervera');
    expect(fetcher.calls()).toBe(1);
  });
});

/* --------------------------------------------------------------- antirebot */

describe('antirebot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('no pregunta res mentre el dit encara es mou', async () => {
    const fetcher = spyFetch();
    const resolver = testResolver(fetcher.impl, 500);

    // Sis posicions en mig segon: el gest d'arrossegar el mapa.
    const promises = [
      resolver.resolveWhenSettled(41.6, 1.2),
      resolver.resolveWhenSettled(41.62, 1.22),
      resolver.resolveWhenSettled(41.64, 1.24),
      resolver.resolveWhenSettled(41.66, 1.26),
      resolver.resolveWhenSettled(41.68, 1.28),
      resolver.resolveWhenSettled(41.6704, 1.268),
    ];

    // Encara no ha passat l'espera: no s'ha demanat res.
    await vi.advanceTimersByTimeAsync(400);
    expect(fetcher.calls()).toBe(0);

    await vi.advanceTimersByTimeAsync(200);
    const results = await Promise.all(promises);

    // Una sola petició, i és la de l'últim punt.
    expect(fetcher.calls()).toBe(1);
    expect(fetcher.urls[0]).toContain('lat=41.67000');

    // Les cinc primeres queden marcades com a substituïdes, no com a error.
    expect(results.slice(0, 5)).toEqual([
      SUPERSEDED,
      SUPERSEDED,
      SUPERSEDED,
      SUPERSEDED,
      SUPERSEDED,
    ]);
    expect(results[5]).not.toBe(SUPERSEDED);
  });

  it('si el punt ja és desat, respon a l’instant i no espera', async () => {
    const fetcher = spyFetch();
    const resolver = testResolver(fetcher.impl, 500);

    // La cua fa servir `setTimeout` fins i tot amb interval zero, i amb
    // rellotges falsos cal deixar-la córrer.
    const first = resolver.resolve(41.6704, 1.268);
    await vi.advanceTimersByTimeAsync(10);
    await first;
    expect(fetcher.calls()).toBe(1);

    // Sense avançar cap rellotge: ha de respondre igualment.
    const again = await resolver.resolveWhenSettled(41.6704, 1.268);
    expect(again).not.toBe(SUPERSEDED);
    expect(fetcher.calls()).toBe(1);
  });

  it('`cancel` deixa la feina pendent sense executar', async () => {
    const fetcher = spyFetch();
    const resolver = testResolver(fetcher.impl, 500);

    const pending = resolver.resolveWhenSettled(41.6, 1.2);
    resolver.cancel();
    await vi.advanceTimersByTimeAsync(1000);

    expect(await pending).toBe(SUPERSEDED);
    expect(fetcher.calls()).toBe(0);
  });

  it('el cercador no consulta res mentre s’escriu', async () => {
    const fetcher = spyFetch();
    const resolver = testResolver(fetcher.impl, 320);

    const promises = ['Ce', 'Cer', 'Cerv', 'Cerve', 'Cervera'].map((q) =>
      resolver.searchWhenSettled(q),
    );

    await vi.advanceTimersByTimeAsync(200);
    expect(fetcher.calls()).toBe(0);

    await vi.advanceTimersByTimeAsync(200);
    const results = await Promise.all(promises);
    expect(fetcher.calls()).toBe(1);
    expect(fetcher.urls[0]).toContain('q=Cervera');
    expect(results.slice(0, 4).every((r) => r === SUPERSEDED)).toBe(true);
  });

  it('esborrar el camp anul·la la consulta que anava a sortir', async () => {
    const fetcher = spyFetch();
    const resolver = testResolver(fetcher.impl, 320);

    const typed = resolver.searchWhenSettled('Cervera');
    const cleared = await resolver.searchWhenSettled('');
    await vi.advanceTimersByTimeAsync(1000);

    expect(cleared).toEqual([]);
    expect(await typed).toBe(SUPERSEDED);
    expect(fetcher.calls()).toBe(0);
  });
});

/* -------------------------------------------------------------------- cua */

describe('cua de peticions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('no deixa passar dues peticions en menys de l’interval', async () => {
    const queue = createRequestQueue(1000);
    const started: number[] = [];
    const task = () => {
      started.push(Date.now());
      return Promise.resolve(true);
    };

    const all = Promise.all([queue.run(task), queue.run(task), queue.run(task)]);
    await vi.advanceTimersByTimeAsync(5000);
    await all;

    expect(started).toHaveLength(3);
    expect(started[1] - started[0]).toBeGreaterThanOrEqual(1000);
    expect(started[2] - started[1]).toBeGreaterThanOrEqual(1000);
  });

  it('una petició que falla no bloqueja la cua', async () => {
    const queue = createRequestQueue(0);
    // L'expectativa s'enganxa ABANS d'avançar el rellotge: si no, la promesa
    // es rebutja sense ningú escoltant i Node ho canta com a error no tractat.
    const failing = expect(queue.run(() => Promise.reject(new Error('xarxa')))).rejects.toThrow(
      'xarxa',
    );
    const following = queue.run(() => Promise.resolve('bé'));

    await vi.advanceTimersByTimeAsync(100);
    await failing;
    expect(await following).toBe('bé');
  });

  it('l’antirebot substitueix, no acumula', async () => {
    const settler = createSettler(300);
    const ran: string[] = [];

    const a = settler.run(async () => {
      ran.push('a');
      return 'a';
    });
    const b = settler.run(async () => {
      ran.push('b');
      return 'b';
    });

    await vi.advanceTimersByTimeAsync(500);
    expect(await a).toBe(SUPERSEDED);
    expect(await b).toBe('b');
    expect(ran).toEqual(['b']);
  });
});

/* ------------------------------------------------------------- degradació */

describe('degradació sense xarxa', () => {
  it('una fallada de xarxa torna null i no llança', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const resolver = testResolver(failing as unknown as typeof fetch);
    await expect(resolver.resolve(41.67, 1.268)).resolves.toBeNull();
  });

  it('un error HTTP torna null i no es desa res', async () => {
    const storage = fakeStorage();
    const resolver = createPlaceResolver({
      cache: createPlaceCache(storage),
      queue: createRequestQueue(0),
      fetchImpl: (async () =>
        new Response('rate limited', { status: 429 })) as unknown as typeof fetch,
    });

    expect(await resolver.resolve(41.67, 1.268)).toBeNull();
    // Res desat: demà pot funcionar i no volem recordar una fallada.
    expect(storage.data.size).toBe(0);
  });

  it('el cercador propaga la fallada en comptes de dir «cap resultat»', async () => {
    // ABANS TORNAVA `[]`. La pantalla no podia distingir «el servei no respon»
    // de «aquest poble no existeix», i ensenyava la mateixa frase per als dos
    // casos: l'usuari sense cobertura reescrivia el nom convençut que
    // s'equivocava ell. Qui crida (`searchPlaces`) ja separa `failed` i
    // `offline` d'`empty`; només li faltava rebre l'error.
    const failing = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const resolver = testResolver(failing as unknown as typeof fetch);
    await expect(resolver.search('Cervera')).rejects.toThrow(/Photon/);
  });

  it('una fallada no es memoritza: el següent intent torna a demanar-ho', async () => {
    // Un error de xarxa no és una resposta. Si es desés a la memòria de
    // cerques, la consulta quedaria condemnada a fallar la resta de la sessió
    // encara que la cobertura tornés dos segons després.
    let fail = true;
    const fetcher = vi.fn(async (...args: unknown[]) => {
      if (fail) throw new TypeError('Failed to fetch');
      return spyFetch().impl(...(args as Parameters<typeof fetch>));
    });
    const resolver = testResolver(fetcher as unknown as typeof fetch);
    await expect(resolver.search('Cervera')).rejects.toThrow();
    fail = false;
    await resolver.search('Cervera');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('el biaix forma part de la clau: dues Cerveres no comparteixen resposta', async () => {
    // Els dos pobles són a 480 km i un cau fora de la franja del 2026. Si la
    // clau ignora el biaix, la segona cerca rep l'ordre de la primera i el
    // primer resultat de la llista decideix el viatge.
    const fetcher = spyFetch();
    const resolver = testResolver(fetcher.impl);
    await resolver.search('Cervera', { biasLat: 41.67, biasLon: 1.27 });
    await resolver.search('Cervera', { biasLat: 43.0, biasLon: -4.5 });
    expect(fetcher.calls()).toBe(2);
    // I el mateix biaix sí que reaprofita.
    await resolver.search('Cervera', { biasLat: 41.67, biasLon: 1.27 });
    expect(fetcher.calls()).toBe(2);
  });

  it('una consulta massa curta no gasta cap petició', async () => {
    const fetcher = spyFetch();
    const resolver = testResolver(fetcher.impl);
    expect(await resolver.search('C')).toEqual([]);
    expect(await resolver.search('  ')).toEqual([]);
    expect(fetcher.calls()).toBe(0);
  });
});
