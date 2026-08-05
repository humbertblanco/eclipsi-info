/**
 * Proves dels punts oficials d'observació amb un doble de mapa.
 *
 * PER QUÈ ES POT PROVAR SENSE NAVEGADOR, com a `hillshade.test.ts`: el mòdul
 * no importa MapLibre, només n'importa els TIPUS, que s'esborren en compilar.
 * Tot el que fa és cridar mitja dotzena de mètodes d'un objecte que rep per
 * paràmetre.
 *
 * QUÈ PROVA. Les tres coses que es poden trencar en silenci i que a la pantalla
 * no es veurien fins que fos tard: que en tocar un punt torni el punt SENCER
 * —amb la font i l'enllaç, que és una regla d'aquest producte i no un detall—,
 * que la crida es pugui repetir a cada render sense duplicar capes ni
 * escoltadors, i que la coordenada estimada no es dibuixi com una d'exacta.
 * NO prova que es vegi bé: això demana una GPU i una persona mirant.
 */

import { describe, expect, it, vi } from 'vitest';
import type { MapLibreMap } from 'maplibre-gl';
import {
  POI_DOT_LAYER,
  POI_HALO_LAYER,
  POI_HIT_LAYER,
  POI_INTERACTIVE_LAYERS,
  applyPois,
  estimatedHaloPx,
  removePois,
} from './pois';
import {
  pointsForEclipse,
  type ObservationPoint,
} from '../../../data/observation-points/catalog';
import { readPalette } from '../../../styles/palette';

type Spec = Record<string, unknown>;
type Listener = (event: unknown) => void;

/**
 * El mínim que `applyPois` demana d'un mapa. Deliberadament tonto: si algun dia
 * el mòdul necessita més superfície de MapLibre, aquest doble s'ha de quedar
 * curt i fer soroll, no dissimular-ho.
 */
class FakeMap {
  sources = new Map<string, Spec & { data?: unknown }>();
  layers = new Map<string, Spec>();
  beforeIds: Array<string | undefined> = [];
  listeners: Array<[string, string, Listener]> = [];

  getSource(id: string): (Spec & { setData(data: unknown): void }) | undefined {
    const source = this.sources.get(id);
    if (source === undefined) return undefined;
    return Object.assign(source, {
      setData: (data: unknown) => {
        source.data = data;
      },
    });
  }
  getLayer(id: string): Spec | undefined {
    return this.layers.get(id);
  }
  addSource(id: string, spec: Spec): void {
    if (this.sources.has(id)) throw new Error(`font duplicada: ${id}`);
    this.sources.set(id, { ...spec });
  }
  addLayer(spec: Spec & { id: string }, beforeId?: string): void {
    if (this.layers.has(spec.id)) throw new Error(`capa duplicada: ${spec.id}`);
    this.layers.set(spec.id, spec);
    this.beforeIds.push(beforeId);
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
  /** L'estil del llenç, per al canvi de punter. Es comparteix i no es copia. */
  canvasStyle = { cursor: '' };

  getCanvas(): { style: { cursor: string } } {
    return { style: this.canvasStyle };
  }

  asMap(): MapLibreMap {
    return this as unknown as MapLibreMap;
  }

  /** Dispara el que hi hagi registrat per a un esdeveniment i una capa. */
  fire(type: string, layer: string, event: unknown): number {
    const matching = this.listeners.filter(([t, l]) => t === type && l === layer);
    for (const [, , handler] of matching) handler(event);
    return matching.length;
  }

  /** Les dades que hi ha ara a la font, com a col·lecció de GeoJSON. */
  data(): { features: Array<{ properties: Record<string, unknown> }> } {
    return this.sources.get('observation-points')?.data as never;
  }
}

const palette = readPalette();

function point(over: Partial<ObservationPoint> = {}): ObservationPoint {
  return {
    id: 'x1',
    name: { ca: 'Un lloc', es: 'Un sitio', en: 'A place' },
    lat: 41.5,
    lon: 1.5,
    precision: 'exact',
    phase: 'central',
    kind: 'official',
    source: { who: 'Generalitat de Catalunya', url: 'https://exemple.cat/punts' },
    ...over,
  };
}

/** Els tres canals d'un color, sense opacitat. Vegeu `hillshade.test.ts`. */
function rgbTriple(color: string): string {
  const hex = color.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)).join(',');
  }
  const rgb = color.trim().match(/^rgba?\(([^)]+)\)$/);
  if (rgb) return rgb[1].split(/[,\s/]+/).filter(Boolean).slice(0, 3).join(',');
  return color.trim();
}

describe('applyPois', () => {
  it('pinta una xinxeta per punt, amb el seu identificador', () => {
    const map = new FakeMap();
    applyPois(map.asMap(), palette, [point({ id: 'a' }), point({ id: 'b', lat: 42 })]);

    const features = map.data().features;
    expect(features).toHaveLength(2);
    expect(features.map((f) => f.properties.id)).toEqual(['a', 'b']);
  });

  it('es pot cridar a cada render sense duplicar capes ni escoltadors', () => {
    // El doble peta si es repeteix una font o una capa, que és el que faria
    // MapLibre. I els escoltadors duplicats no petarien enlloc: obririen la
    // fitxa dues vegades per toc, que és pitjor perquè no ho diria ningú.
    const map = new FakeMap();
    for (let i = 0; i < 3; i++) applyPois(map.asMap(), palette, [point()]);

    expect(map.sources.size).toBe(1);
    expect(map.layers.size).toBe(3);
    expect(map.listeners.filter(([t]) => t === 'click')).toHaveLength(1);
  });

  it('l’halo és només per a la coordenada estimada', () => {
    /*
     * De 222 punts del 2026, 60 surten d'un nom de lloc buscat a OSM i poden
     * ballar un quilòmetre. Si el filtre es perdés, o bé tots portarien halo
     * —dient que tot és aproximat— o bé cap, que és la mentida que aquesta
     * capa existeix per no dir.
     */
    const map = new FakeMap();
    applyPois(map.asMap(), palette, [
      point({ id: 'exacte' }),
      point({ id: 'estimat', precision: 'estimated' }),
    ]);

    expect(map.layers.get(POI_HALO_LAYER)?.filter).toEqual([
      '==',
      ['get', 'estimated'],
      1,
    ]);
    const props = map.data().features.map((f) => f.properties.estimated);
    expect(props).toEqual([0, 1]);
  });

  it('la diana del dit és més gran que el disc i no es veu', () => {
    const map = new FakeMap();
    applyPois(map.asMap(), palette, [point()]);

    const dot = map.layers.get(POI_DOT_LAYER)?.paint as Record<string, unknown>;
    const hit = map.layers.get(POI_HIT_LAYER)?.paint as Record<string, number>;

    /*
     * EL DISC ARA ENCONGEIX AMB EL ZOOM i el seu radi és una expressió de
     * MapLibre, no un número: amb 274 punts a escala de país es formava una
     * taca blava sòlida. La comparació segueix sent la mateixa —el dit no pot
     * tenir una diana més petita que el dibuix— però s'ha de fer contra el
     * radi MÀXIM que arriba a prendre l'expressió, que és l'últim graó de la
     * interpolació.
     */
    // L'expressió és ['interpolate', <corba>, ['zoom'], z1, r1, z2, r2, …]:
    // els radis són els elements PARELLS a partir del quart. Prendre'ls tots
    // barrejats faria passar la prova comparant el dit amb un nivell de zoom,
    // que és el mateix error que aquest fitxer existeix per caçar.
    const expression = dot['circle-radius'] as unknown[];
    expect(expression[0], 'el radi del disc ja no és una interpolació').toBe('interpolate');
    const radii = expression
      .slice(3)
      .filter((_, i) => i % 2 === 1)
      .filter((v): v is number => typeof v === 'number');
    expect(radii.length).toBeGreaterThanOrEqual(2);
    expect(hit['circle-radius']).toBeGreaterThan(Math.max(...radii));
    // 36 px de diàmetre és el mínim d'un objectiu tàctil.
    expect(hit['circle-radius'] * 2).toBeGreaterThanOrEqual(36);
    expect(hit['circle-opacity']).toBe(0);
  });

  it('la capa de toc va per damunt del disc', () => {
    // MapLibre resol el toc amb la capa de més amunt. Si la diana quedés a
    // sota, el disc se li menjaria els tocs del centre —justament els que
    // l'usuari encerta— i només funcionarien els de la vora.
    const map = new FakeMap();
    applyPois(map.asMap(), palette, [point()]);
    const order = [...map.layers.keys()];
    expect(order.indexOf(POI_HIT_LAYER)).toBeGreaterThan(order.indexOf(POI_DOT_LAYER));
  });

  it('la llista de capes que atrapen el dit és la de veritat', () => {
    /*
     * `POI_INTERACTIVE_LAYERS` la fa servir `EclipseMap` per no canviar el punt
     * de l'usuari quan el toc anava a una xinxeta. Si la llista i les capes se
     * separessin, el defecte seria mut i doble: la fitxa s'obriria I el punt es
     * mouria, i qui ho patís no sabria dir què ha passat.
     */
    const map = new FakeMap();
    applyPois(map.asMap(), palette, [point()]);

    for (const id of POI_INTERACTIVE_LAYERS) expect(map.layers.has(id)).toBe(true);
    const ambClic = map.listeners.filter(([t]) => t === 'click').map(([, l]) => l);
    expect(ambClic.sort()).toEqual([...POI_INTERACTIVE_LAYERS].sort());
  });

  it('el punter diu que allò es pot tocar', () => {
    const map = new FakeMap();
    applyPois(map.asMap(), palette, [point()]);

    map.fire('mouseenter', POI_HIT_LAYER, {});
    expect(map.canvasStyle.cursor).toBe('pointer');
    map.fire('mouseleave', POI_HIT_LAYER, {});
    expect(map.canvasStyle.cursor).toBe('');
  });

  it('en tocar-ne un torna el punt SENCER, amb la font i l’enllaç', () => {
    /*
     * LA REGLA DEL PRODUCTE, provada. La capçalera de la fitxa ha de poder
     * ensenyar qui ha anunciat el punt i on ho diu sense anar-ho a buscar. Amb
     * un identificador o unes coordenades, el dia que la cerca fallés hi
     * hauria una fitxa sense font, i un punt oficial sense font no és res.
     */
    const map = new FakeMap();
    const onPick = vi.fn();
    const target = point({
      id: 'navarra-1',
      precision: 'estimated',
      kind: 'event',
      source: { who: 'Govern de Navarra', url: 'https://exemple.nav/eclipsi' },
    });
    applyPois(map.asMap(), palette, [point({ id: 'altre' }), target], { onPick });

    const preventDefault = vi.fn();
    map.fire('click', POI_HIT_LAYER, {
      features: [{ properties: { id: 'navarra-1' } }],
      preventDefault,
    });

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(target);
    const received = onPick.mock.calls[0][0] as ObservationPoint;
    expect(received.source.who).toBe('Govern de Navarra');
    expect(received.source.url).toBe('https://exemple.nav/eclipsi');
    // I el clic no arriba al mapa: si hi arribés, tocar una xinxeta obriria la
    // fitxa I canviaria el punt de l'usuari a la coordenada del dit.
    expect(preventDefault).toHaveBeenCalled();
  });

  it('el toc llegeix sempre l’última llista i l’últim callback', () => {
    /*
     * L'escoltador es registra una sola vegada, però la llista i el callback
     * canvien a cada render. Si l'escoltador hagués tancat sobre els primers,
     * es quedaria mirant per sempre l'eclipsi que hi havia en muntar el mapa.
     */
    const map = new FakeMap();
    const primer = vi.fn();
    const segon = vi.fn();
    applyPois(map.asMap(), palette, [point({ id: 'vell' })], { onPick: primer });

    const nou = point({ id: 'nou', lat: 40 });
    applyPois(map.asMap(), palette, [nou], { onPick: segon });

    map.fire('click', POI_HIT_LAYER, {
      features: [{ properties: { id: 'nou' } }],
      preventDefault: () => undefined,
    });

    expect(primer).not.toHaveBeenCalled();
    expect(segon).toHaveBeenCalledWith(nou);
  });

  it('un toc sobre un identificador desconegut no fa res', () => {
    // Pot passar de debò: canviar d'eclipsi buida la llista i el toc que ja
    // estava en camí encara porta l'identificador de l'anterior.
    const map = new FakeMap();
    const onPick = vi.fn();
    applyPois(map.asMap(), palette, [point({ id: 'a' })], { onPick });

    expect(() =>
      map.fire('click', POI_HIT_LAYER, {
        features: [{ properties: { id: 'fantasma' } }],
        preventDefault: () => undefined,
      }),
    ).not.toThrow();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('una llista buida buida les dades sense desmuntar la capa', () => {
    // El 2027 i el 2028 encara no tenen cap punt oficial, i és una resposta
    // legítima: la capa hi ha de continuar sent, buida.
    const map = new FakeMap();
    applyPois(map.asMap(), palette, [point()]);
    applyPois(map.asMap(), palette, []);

    expect(map.data().features).toHaveLength(0);
    expect(map.layers.size).toBe(3);
  });

  it('els colors surten de la paleta i cap d’ells no és l’ambre', () => {
    /*
     * Les dues regles del sistema que es poden trencar sense adonar-se'n: cap
     * color escrit a mà i cap ambre, perquè al mapa l'ambre és de la FRANJA i
     * un punt oficial no és cap veredicte. El test no fixa quin blau ni amb
     * quanta opacitat: això s'ajusta mirant el mapa.
     */
    const map = new FakeMap();
    applyPois(map.asMap(), palette, [point()]);

    const deLaPaleta = new Set(
      Object.values(palette)
        .filter((value) => /^#|^rgba?\(/.test(value))
        .map(rgbTriple),
    );
    const ambres = new Set(
      [palette.accent, palette.accentHover, palette.sun200, palette.sun400].map(rgbTriple),
    );

    let comprovats = 0;
    for (const [id, layer] of map.layers) {
      const paint = (layer.paint ?? {}) as Record<string, unknown>;
      for (const [key, value] of Object.entries(paint)) {
        if (!key.endsWith('-color') || typeof value !== 'string') continue;
        const triple = rgbTriple(value);
        expect(deLaPaleta.has(triple), `${id}/${key} no surt de la paleta`).toBe(true);
        expect(ambres.has(triple), `${id}/${key} és ambre, i l'ambre és de la franja`).toBe(
          false,
        );
        comprovats += 1;
      }
    }
    expect(comprovats).toBeGreaterThan(0);
  });

  it('pinta el catàleg real del 2026 sense tocar-lo', () => {
    // Integració petita, però la que compta: el que es pinta són els punts que
    // hi ha de debò, amb la forma que tenen de debò.
    const map = new FakeMap();
    const reals = pointsForEclipse('2026-08-12');
    expect(reals.length).toBeGreaterThan(100);

    applyPois(map.asMap(), palette, reals);
    expect(map.data().features).toHaveLength(reals.length);
    for (const feature of map.data().features) {
      expect(typeof feature.properties.id).toBe('string');
      expect([0, 1]).toContain(feature.properties.estimated);
    }
  });
});

describe('estimatedHaloPx', () => {
  it('un quilòmetre creix amb el zoom, com qualsevol cosa mesurada en metres', () => {
    // Si no creixés, l'halo seria un adorn de mida fixa i deixaria de voler dir
    // «el punt és aquí dins».
    expect(estimatedHaloPx(9)).toBeGreaterThan(estimatedHaloPx(6));
    expect(estimatedHaloPx(12)).toBeGreaterThan(estimatedHaloPx(9));
    // A z10, un quilòmetre a la latitud de la Península són uns 8-9 px.
    expect(estimatedHaloPx(10)).toBeGreaterThan(7);
    expect(estimatedHaloPx(10)).toBeLessThan(11);
  });

  it('té sostre, perquè un halo de pantalla sencera ja no diu res', () => {
    expect(estimatedHaloPx(18)).toBe(estimatedHaloPx(22));
    expect(estimatedHaloPx(22)).toBeLessThanOrEqual(96);
  });
});

describe('removePois', () => {
  it('treu capes, font i escoltadors', () => {
    const map = new FakeMap();
    applyPois(map.asMap(), palette, [point()], { onPick: vi.fn() });
    removePois(map.asMap());

    expect(map.layers.size).toBe(0);
    expect(map.sources.size).toBe(0);
    expect(map.listeners).toHaveLength(0);
  });

  it('no es queixa si no hi havia res', () => {
    // Es crida des de la neteja d'un efecte de React, que pot arribar amb el
    // mapa ja buit o després d'un canvi d'estil que s'ho ha endut tot.
    const map = new FakeMap();
    expect(() => removePois(map.asMap())).not.toThrow();
  });

  it('apagar i tornar a encendre no deixa dos escoltadors', () => {
    /*
     * El defecte que aquesta prova vigila no peta ni deixa traça: després de
     * tres cicles d'interruptor, cada toc obriria la fitxa quatre vegades.
     */
    const map = new FakeMap();
    const onPick = vi.fn();
    for (let i = 0; i < 3; i++) {
      applyPois(map.asMap(), palette, [point()], { onPick });
      removePois(map.asMap());
    }
    applyPois(map.asMap(), palette, [point()], { onPick });

    const disparats = map.fire('click', POI_HIT_LAYER, {
      features: [{ properties: { id: 'x1' } }],
      preventDefault: () => undefined,
    });
    expect(disparats).toBe(1);
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});
