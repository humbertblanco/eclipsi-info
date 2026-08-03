/**
 * Proves dels miradors: la càrrega mandrosa i la pintura agrupada.
 *
 * DUES MEITATS I DUES MANERES DE PROVAR-LES.
 *
 * La CÀRREGA es prova amb un `fetch` postís. El que hi ha en joc no és que
 * baixi un fitxer —això ho fa el navegador— sinó tres decisions que no es
 * veurien fallar: que no es demani abans d'encendre la capa, que apagar i
 * encendre tres vegades seguides no siguin tres peticions, i que una caiguda de
 * xarxa no deixi la capa morta per a tota la sessió.
 *
 * La PINTURA es prova amb un doble de mapa, com a `hillshade.test.ts`. Aquí el
 * que compta és que l'agrupació la faci MapLibre (i no nosaltres), que el
 * veredicte fi NO es reparteixi a l'engròs, i que tocar un mirador en torni un
 * de sencer per poder-hi oferir «Calcula-ho des d'aquí».
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapLibreMap } from 'maplibre-gl';
import {
  VIEWPOINT_CLUSTER_LAYER,
  VIEWPOINT_DOT_LAYER,
  VIEWPOINT_HIT_LAYER,
  VIEWPOINT_INTERACTIVE_LAYERS,
  ViewpointsLoadError,
  applyViewpoints,
  forgetViewpoints,
  loadViewpoints,
  removeViewpoints,
} from './viewpoints';
import { OSM_ODBL_ATTRIBUTION, type Viewpoint } from '../../../core/places/viewpoints';
import { viewpointsDataUrl } from '../../../offline/config';
import { readPalette } from '../../../styles/palette';

type Spec = Record<string, unknown>;
type Listener = (event: unknown) => void;

/** El mínim que `applyViewpoints` demana d'un mapa. Vegeu `pois.test.ts`. */
class FakeMap {
  sources = new Map<string, Spec & { data?: unknown }>();
  layers = new Map<string, Spec>();
  listeners: Array<[string, string, Listener]> = [];
  eased: Array<Record<string, unknown>> = [];
  expansionZoom = 9;

  getSource(id: string): Spec | undefined {
    const source = this.sources.get(id);
    if (source === undefined) return undefined;
    return Object.assign(source, {
      setData: (data: unknown) => {
        source.data = data;
      },
      getClusterExpansionZoom: (_clusterId: number) => Promise.resolve(this.expansionZoom),
    });
  }
  getLayer(id: string): Spec | undefined {
    return this.layers.get(id);
  }
  addSource(id: string, spec: Spec): void {
    if (this.sources.has(id)) throw new Error(`font duplicada: ${id}`);
    this.sources.set(id, { ...spec });
  }
  addLayer(spec: Spec & { id: string }): void {
    if (this.layers.has(spec.id)) throw new Error(`capa duplicada: ${spec.id}`);
    this.layers.set(spec.id, spec);
  }
  removeLayer(id: string): void {
    this.layers.delete(id);
  }
  removeSource(id: string): void {
    this.sources.delete(id);
  }
  on(type: string, layer: string, handler: Listener): void {
    this.listeners.push([type, layer, handler]);
  }
  off(type: string, layer: string, handler: Listener): void {
    const at = this.listeners.findIndex(
      ([t, l, h]) => t === type && l === layer && h === handler,
    );
    if (at >= 0) this.listeners.splice(at, 1);
  }
  easeTo(options: Record<string, unknown>): void {
    this.eased.push(options);
  }
  getCanvas(): { style: { cursor: string } } {
    return { style: { cursor: '' } };
  }

  asMap(): MapLibreMap {
    return this as unknown as MapLibreMap;
  }

  fire(type: string, layer: string, event: unknown): number {
    const matching = this.listeners.filter(([t, l]) => t === type && l === layer);
    for (const [, , handler] of matching) handler(event);
    return matching.length;
  }

  data(): { features: Array<{ properties: Record<string, unknown> }> } {
    return this.sources.get('viewpoints')?.data as never;
  }
}

const palette = readPalette();

function viewpoint(over: Partial<Viewpoint> = {}): Viewpoint {
  return { id: 'n1', name: 'Mirador de prova', lat: 41.5, lon: 1.5, kind: 'viewpoint', ...over };
}

/** Un fitxer de catàleg mínim però vàlid per a `parseViewpointFile`. */
function fileBody(viewpoints: Viewpoint[] = [viewpoint()]): Record<string, unknown> {
  return {
    eclipseId: '2026-08-12',
    generatedAt: '2026-08-03T10:00:00.000Z',
    attribution: OSM_ODBL_ATTRIBUTION,
    count: viewpoints.length,
    viewpoints,
  };
}

afterEach(() => {
  forgetViewpoints();
  vi.unstubAllGlobals();
});

describe('loadViewpoints', () => {
  it('demana la URL d’`offline/config`, i no una escrita a mà', () => {
    /*
     * L'acord de la URL vist des del mapa, com el que ja vigila el relleu
     * (`terrain-agreement.test.ts`). El service worker desa per URL sencera: si
     * aquí es compongués el camí a mà, el dia que canviï el prefix la capa
     * seria l'única cosa de l'app que no funciona sense cobertura — justament
     * la que existeix per funcionar-hi.
     */
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(fileBody()), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    void loadViewpoints('2026-08-12');
    expect(fetchMock.mock.calls[0][0]).toBe(viewpointsDataUrl('2026-08-12'));
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/data\/[^/]+\.json$/);
  });

  it('respecta el subdirectori del desplegament', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(fileBody()), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await loadViewpoints('2026-08-12', { baseUrl: '/eclipsi/' });
    expect(fetchMock.mock.calls[0][0]).toBe('/eclipsi/data/viewpoints-2026-08-12.json');
  });

  it('tres encesos seguits són una sola petició', async () => {
    // Encendre i apagar l'interruptor mentre la primera petició encara vola no
    // pot multiplicar la descàrrega: són 225 kB i el dia de l'eclipsi la cel·la
    // està saturada.
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(fileBody()), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const [a, b, c] = await Promise.all([
      loadViewpoints('2026-08-12'),
      loadViewpoints('2026-08-12'),
      loadViewpoints('2026-08-12'),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a.viewpoints).toHaveLength(1);
  });

  it('valida el que arriba en comptes de creure’s-ho', async () => {
    /*
     * El fitxer pot venir d'una memòria cau de fa mesos i d'una versió anterior
     * de l'app. `parseViewpointFile` descarta entrada a entrada el que no
     * quadri: un fitxer a mitges val més que cap, però un `as` seria creure
     * l'usuari sobre paraula i acabar pintant xinxetes a l'oceà.
     */
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          ...fileBody([viewpoint({ id: 'bo' })]),
          viewpoints: [
            viewpoint({ id: 'bo' }),
            { id: 'sense-nom', lat: 41, lon: 1, kind: 'peak' },
            { id: 'fora-de-mon', name: 'X', lat: 999, lon: 1, kind: 'peak' },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const file = await loadViewpoints('2026-08-12');
    expect(file.viewpoints.map((v) => v.id)).toEqual(['bo']);
  });

  it('un 404 és «network», i el fitxer pot no existir encara', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadViewpoints('2027-08-02')).rejects.toMatchObject({
      name: 'ViewpointsLoadError',
      code: 'network',
    });
  });

  it('un fitxer il·legible és «format», no «network»', async () => {
    // La diferència importa a la pantalla: d'una caiguda de xarxa se'n pot
    // sortir tornant-ho a provar; d'un fitxer trencat, no.
    const fetchMock = vi.fn<typeof fetch>(async () => new Response('{"res": true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const error = await loadViewpoints('2026-08-12').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ViewpointsLoadError);
    expect((error as ViewpointsLoadError).code).toBe('format');
  });

  it('una caiguda de xarxa no deixa la capa morta per a tota la sessió', async () => {
    /*
     * Si la promesa rebutjada es quedés a la memòria, mig segon de túnel es
     * convertiria en una capa que ja no torna mai. El reintent ha de ser un
     * reintent de debò.
     */
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('xarxa caiguda'))
      .mockResolvedValueOnce(new Response(JSON.stringify(fileBody()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadViewpoints('2026-08-12')).rejects.toBeInstanceOf(ViewpointsLoadError);
    const file = await loadViewpoints('2026-08-12');
    expect(file.viewpoints).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('applyViewpoints', () => {
  it('l’agrupació la fa MapLibre, a la font', () => {
    // Agrupar milers de punts a mà seria reescriure supercluster, que és el que
    // MapLibre ja porta a dins i corre al seu worker.
    const map = new FakeMap();
    applyViewpoints(map.asMap(), palette, [viewpoint()]);

    const source = map.sources.get('viewpoints');
    expect(source?.cluster).toBe(true);
    expect(source?.clusterMaxZoom).toBeGreaterThan(8);
    expect(source?.clusterRadius).toBeGreaterThan(0);
  });

  it('cap capa demana text, perquè l’estil base no porta tipografia', () => {
    /*
     * L'estil d'`EclipseMap` és cartografia rasteritzada i NO declara `glyphs`.
     * Una capa `symbol` amb `text-field` —el número dins del grup, el nom al
     * costat del punt— no pintaria res i ompliria la consola d'errors. És una
     * línia fàcil d'afegir amb bona intenció i impossible de veure fallar en un
     * mapa que ja va ple de coses.
     */
    const map = new FakeMap();
    applyViewpoints(map.asMap(), palette, [viewpoint()]);

    for (const [id, layer] of map.layers) {
      expect(layer.type, `${id} és una capa de símbols`).not.toBe('symbol');
      const layout = (layer.layout ?? {}) as Record<string, unknown>;
      expect(layout['text-field'], `${id} demana text`).toBeUndefined();
    }
  });

  it('sense durada teòrica, el mapa no diu res de cap lloc', () => {
    /*
     * LA PUNTUACIÓ EN DOS TEMPS, provada pel costat que importa: el veredicte
     * no es regala a l'engròs. Sense `theoreticalSeconds`, tots els discs són
     * iguals i cap color diu si des d'allà es veurà res.
     */
    const map = new FakeMap();
    applyViewpoints(map.asMap(), palette, [
      viewpoint({ id: 'a' }),
      viewpoint({ id: 'b', kind: 'peak', ele: 1200 }),
    ]);

    for (const feature of map.data().features) expect(feature.properties.sec).toBe(0);
  });

  it('amb durada teòrica, només canvia la mida', () => {
    // I la durada TEÒRICA és aritmètica sobre la trajectòria: no mira el
    // relleu i per tant no és el veredicte. Es diu amb la mida i no amb cap
    // color de visibilitat, que és el que la faria passar per allò que no és.
    const map = new FakeMap();
    applyViewpoints(map.asMap(), palette, [viewpoint({ id: 'a' })], {
      theoreticalSeconds: new Map([['a', 104.4]]),
    });

    expect(map.data().features[0].properties.sec).toBe(104);
    const paint = map.layers.get(VIEWPOINT_DOT_LAYER)?.paint as Record<string, unknown>;
    expect(JSON.stringify(paint['circle-radius'])).toContain('sec');
    expect(JSON.stringify(paint)).not.toContain(palette.statusClear);
    expect(JSON.stringify(paint)).not.toContain(palette.statusDanger);
  });

  it('el mirador senyalitzat i el cim es distingeixen sense un segon color', () => {
    /*
     * Un `tourism=viewpoint` té accés i sovint aparcament; un `natural=peak`
     * potser només s'hi arriba a peu. Qui hi va en cotxe amb temps comptat ho
     * ha de distingir sense obrir res — però amb la FORMA, perquè la regla
     * d'aquest mapa és un sol accent i aquí no n'hi ha cap.
     */
    const map = new FakeMap();
    applyViewpoints(map.asMap(), palette, [
      viewpoint({ id: 'senyalitzat' }),
      viewpoint({ id: 'cim', kind: 'peak', ele: 900 }),
    ]);

    expect(map.data().features.map((f) => f.properties.signposted)).toEqual([1, 0]);
    const paint = map.layers.get(VIEWPOINT_DOT_LAYER)?.paint as Record<string, unknown>;
    // Un sol to per als dos, amb farciment diferent: la distinció és de forma.
    const colors = JSON.stringify(paint['circle-color']);
    expect(colors).toContain('case');
  });

  it('es pot cridar a cada render sense duplicar capes ni escoltadors', () => {
    const map = new FakeMap();
    for (let i = 0; i < 3; i++) applyViewpoints(map.asMap(), palette, [viewpoint()]);

    expect(map.sources.size).toBe(1);
    expect(map.layers.size).toBe(3);
    expect(map.listeners.filter(([t, l]) => t === 'click' && l === VIEWPOINT_HIT_LAYER))
      .toHaveLength(1);
  });

  it('la llista de capes que atrapen el dit és la de veritat', () => {
    // Vegeu la mateixa prova a `pois.test.ts`: la fa servir `EclipseMap` per no
    // canviar el punt de l'usuari quan el toc anava a un mirador o a un grup.
    const map = new FakeMap();
    applyViewpoints(map.asMap(), palette, [viewpoint()]);

    for (const id of VIEWPOINT_INTERACTIVE_LAYERS) expect(map.layers.has(id)).toBe(true);
    const ambClic = map.listeners.filter(([t]) => t === 'click').map(([, l]) => l);
    expect(ambClic.sort()).toEqual([...VIEWPOINT_INTERACTIVE_LAYERS].sort());
  });

  it('tocar un mirador en torna un de sencer, per poder-hi calcular', () => {
    // La fitxa hi ha d'oferir «Calcula-ho des d'aquí»: necessita el nom, les
    // coordenades i la cota, no un identificador.
    const map = new FakeMap();
    const onPick = vi.fn();
    const cim = viewpoint({ id: 'n42', name: 'Puig de la Mola', kind: 'peak', ele: 1104 });
    applyViewpoints(map.asMap(), palette, [viewpoint(), cim], { onPick });

    map.fire('click', VIEWPOINT_HIT_LAYER, {
      features: [{ properties: { id: 'n42' } }],
      preventDefault: () => undefined,
    });

    expect(onPick).toHaveBeenCalledWith(cim);
  });

  it('tocar un grup l’obre', async () => {
    // Sense això, un grup és una taca que no fa res i l'usuari es queda sense
    // manera d'arribar als punts que hi ha a dins.
    const map = new FakeMap();
    map.expansionZoom = 10.5;
    applyViewpoints(map.asMap(), palette, [viewpoint()]);

    map.fire('click', VIEWPOINT_CLUSTER_LAYER, {
      features: [{ properties: { cluster_id: 7, point_count: 12 } }],
      lngLat: { lng: 1.5, lat: 41.5 },
      preventDefault: () => undefined,
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(map.eased).toHaveLength(1);
    expect(map.eased[0].zoom).toBe(10.5);
  });

  it('null i llista buida buiden les dades sense desmuntar la capa', () => {
    const map = new FakeMap();
    applyViewpoints(map.asMap(), palette, [viewpoint()]);
    applyViewpoints(map.asMap(), palette, null);

    expect(map.data().features).toHaveLength(0);
    expect(map.layers.size).toBe(3);
  });
});

describe('removeViewpoints', () => {
  it('treu capes, font i escoltadors', () => {
    const map = new FakeMap();
    applyViewpoints(map.asMap(), palette, [viewpoint()], { onPick: vi.fn() });
    removeViewpoints(map.asMap());

    expect(map.layers.size).toBe(0);
    expect(map.sources.size).toBe(0);
    expect(map.listeners).toHaveLength(0);
  });

  it('no es queixa si no hi havia res', () => {
    const map = new FakeMap();
    expect(() => removeViewpoints(map.asMap())).not.toThrow();
  });

  it('apagar i tornar a encendre no deixa dos escoltadors', () => {
    const map = new FakeMap();
    const onPick = vi.fn();
    for (let i = 0; i < 3; i++) {
      applyViewpoints(map.asMap(), palette, [viewpoint()], { onPick });
      removeViewpoints(map.asMap());
    }
    applyViewpoints(map.asMap(), palette, [viewpoint()], { onPick });

    const disparats = map.fire('click', VIEWPOINT_HIT_LAYER, {
      features: [{ properties: { id: 'n1' } }],
      preventDefault: () => undefined,
    });
    expect(disparats).toBe(1);
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});
