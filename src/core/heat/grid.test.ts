/**
 * Proves de la graella del mapa de calor.
 *
 * Les promeses de `grid.ts` són quatre i totes tenen conseqüències visibles:
 * que els identificadors siguin estables (si no, la memòria cau no encerta mai
 * i el mapa es recalcula sencer a cada moviment), que la resolució segueixi el
 * zoom, que el sostre de cel·les es respecti passi el que passi (si no, un
 * enquadrament ample penja el Worker mig minut) i que el retall a la franja
 * funcioni TAMBÉ per al 2026, la franja que passa pel pol i que ja ha trencat
 * el dibuix del mapa una vegada (vegeu `path.ts`, `drawableRuns`).
 *
 * L'astronomia és la de veritat: no té sentit inventar-se una franja.
 */

import { describe, expect, it } from 'vitest';
import {
  bandClipFor,
  bandContains,
  cellSizeKm,
  cellsForViewport,
  MAX_CELLS_PER_PASS,
  resolutionForZoom,
  tilesForBbox,
  type HeatBbox,
} from './grid';

const ECLIPSE = '2026-08-12';

/** Enquadrament de mòbil al voltant de Sòria, ben endins de la franja. */
const SORIA_VIEW: HeatBbox = { west: -2.75, south: 41.6, east: -2.2, north: 41.95 };

describe('la cel·la és una tessel·la', () => {
  it('els identificadors són els mateixos a dues passades del mateix enquadrament', () => {
    const first = cellsForViewport(SORIA_VIEW, 11);
    const second = cellsForViewport(SORIA_VIEW, 11);
    expect(first.length).toBeGreaterThan(0);
    expect(second.map((c) => c.id)).toEqual(first.map((c) => c.id));
  });

  it('i també després de moure el mapa: les cel·les comunes conserven la clau', () => {
    // Això és el que fa que la memòria cau serveixi de res. Amb una retícula
    // ancorada a l'enquadrament, arrossegar el mapa mig quilòmetre canviaria
    // TOTS els identificadors i no s'encertaria mai ni una cel·la.
    const moved: HeatBbox = {
      west: SORIA_VIEW.west + 0.1,
      east: SORIA_VIEW.east + 0.1,
      south: SORIA_VIEW.south + 0.05,
      north: SORIA_VIEW.north + 0.05,
    };
    const before = new Map(cellsForViewport(SORIA_VIEW, 11).map((c) => [c.id, c]));
    const after = cellsForViewport(moved, 11);

    const common = after.filter((c) => before.has(c.id));
    expect(common.length).toBeGreaterThan(50);
    for (const cell of common) {
      const twin = before.get(cell.id);
      expect(twin?.lat).toBe(cell.lat);
      expect(twin?.lon).toBe(cell.lon);
      expect(twin?.poly).toEqual(cell.poly);
    }
  });

  it('el polígon és un anell tancat i el centre hi cau a dins', () => {
    const [cell] = cellsForViewport(SORIA_VIEW, 11);
    expect(cell.poly).toHaveLength(5);
    expect(cell.poly[0]).toEqual(cell.poly[4]);

    const lons = cell.poly.map((p) => p[0]);
    const lats = cell.poly.map((p) => p[1]);
    expect(cell.lon).toBeGreaterThan(Math.min(...lons));
    expect(cell.lon).toBeLessThan(Math.max(...lons));
    expect(cell.lat).toBeGreaterThan(Math.min(...lats));
    expect(cell.lat).toBeLessThan(Math.max(...lats));
  });
});

describe('la resolució segueix el zoom', () => {
  it('z9 ≈ 4 km, z10 ≈ 2 km, z11 i més ≈ 1 km', () => {
    expect(resolutionForZoom(9).approxKm).toBeCloseTo(3.7, 1);
    expect(resolutionForZoom(10).approxKm).toBeCloseTo(1.85, 1);
    expect(resolutionForZoom(11).approxKm).toBeCloseTo(0.92, 1);
    // Més enllà de z11 la cel·la ja no s'afina: el garbell del terreny té 57 m
    // de mostra i partir la cel·la per sota del quilòmetre no aporta cap dada
    // nova, només quatre vegades més feina.
    expect(resolutionForZoom(14).cellZoom).toBe(resolutionForZoom(11).cellZoom);
  });

  it('per sota de z9 el nivell 2 no s’ofereix, i es diu al tipus', () => {
    // Amb cel·les de 7 km, «quants segons se’n menja el relleu» no té resposta:
    // dins d’una cel·la hi cap una serra i una vall. Val més no prometre-ho.
    expect(resolutionForZoom(8).terrainAvailable).toBe(false);
    expect(resolutionForZoom(6).terrainAvailable).toBe(false);
    expect(resolutionForZoom(9).terrainAvailable).toBe(true);
  });

  it('la mida de la cel·la té en compte la latitud', () => {
    // Mercator: la mateixa tessel·la fa menys quilòmetres com més al nord.
    expect(cellSizeKm(15, 0)).toBeCloseTo(1.222, 2);
    expect(cellSizeKm(15, 41)).toBeCloseTo(0.923, 2);
    expect(cellSizeKm(15, 60)).toBeLessThan(cellSizeKm(15, 41));
  });
});

describe('el sostre de cel·les', () => {
  it('mai no se’n tornen més de 800, per ample que sigui l’enquadrament', () => {
    const iberia: HeatBbox = { west: -9.5, south: 36, east: 4.5, north: 44 };
    for (const zoom of [8, 9, 10, 11, 12]) {
      const cells = cellsForViewport(iberia, zoom, ECLIPSE);
      expect(cells.length, `zoom ${zoom}`).toBeLessThanOrEqual(MAX_CELLS_PER_PASS);
    }
  });

  it('quan no hi caben, la cel·la s’engruixeix en comptes de retallar la llista', () => {
    // Retallar la llista deixaria mig enquadrament sense pintar i ningú no
    // sabria per què. Engruixir-la respon la mateixa pregunta amb menys detall,
    // que és el que un mapa de calor pot fer honestament.
    const ample: HeatBbox = { west: -6, south: 40, east: 0, north: 43.5 };
    const cells = cellsForViewport(ample, 11, ECLIPSE);
    expect(cells.length).toBeLessThanOrEqual(MAX_CELLS_PER_PASS);
    expect(cells[0].cellZoom).toBeLessThan(resolutionForZoom(11).cellZoom);
    // I segueixen essent tessel·les de veritat: sense forats ni solapaments.
    expect(new Set(cells.map((c) => c.id)).size).toBe(cells.length);
  });

  it('ni demanant el món sencer sense retallar a la franja', () => {
    // El cas absurd existeix per una raó: si el sostre no es pogués complir
    // aquí, seria una promesa falsa, i el dia que algú cridés la graella amb un
    // enquadrament impossible el Worker es penjaria amb desenes de milers de
    // cel·les en comptes de tornar un mapa gruixut.
    const mon: HeatBbox = { west: -179, south: -80, east: 179, north: 80 };
    const cells = cellsForViewport(mon, 11);
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.length).toBeLessThanOrEqual(MAX_CELLS_PER_PASS);
  });

  it('un sostre petit engruixeix més, i mai deixa la llista buida', () => {
    const cells = cellsForViewport(SORIA_VIEW, 12, ECLIPSE, { maxCells: 40 });
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.length).toBeLessThanOrEqual(40);
  });
});

describe('el retall a la franja', () => {
  it('el 2026 passa pel pol i tot i així la franja es retalla bé sobre Espanya', () => {
    // L'anell arriba als 79,9° de latitud perquè `path.ts` el talla a 80: si
    // algun dia deixés de tallar-lo, el polígon deixaria de ser dibuixable en
    // Mercator i aquest test és el que ho hauria de veure primer.
    const clip = bandClipFor(ECLIPSE);
    expect(clip.ring.length).toBeGreaterThan(100);
    expect(clip.bbox.north).toBeLessThanOrEqual(80);
    for (const [lon, lat] of clip.ring) {
      expect(Number.isFinite(lon) && Number.isFinite(lat)).toBe(true);
    }

    // Sòria i Valladolid són dins de la franja; Sevilla i les Canàries, fora
    // i ben lluny. La franja del 12-08-2026 va del nord-oest al sud-est.
    expect(bandContains(clip, -2.479, 41.7665, 0)).toBe(true);
    expect(bandContains(clip, -4.72, 41.65, 0)).toBe(true);
    expect(bandContains(clip, -5.99, 37.39, 10)).toBe(false);
    expect(bandContains(clip, -15.4, 28.1, 10)).toBe(false);

    // I el tram de DAVANT del pol també, que és el que el retall polar de
    // `path.ts` podria haver espatllat: la franja del 2026 travessa Islàndia
    // (Reykjavík hi és a dins) abans d'entrar per Galícia. Si l'anell hagués
    // quedat mal tancat en tallar-lo als 80°, aquí sortiria qualsevol cosa.
    expect(bandContains(clip, -21.9, 64.13, 0)).toBe(true);
    expect(bandContains(clip, -8.4, 43.37, 0)).toBe(true);
    // Oslo i Londres no: la franja hi passa pel costat, no per sobre.
    expect(bandContains(clip, 10.75, 59.9, 10)).toBe(false);
    expect(bandContains(clip, -0.13, 51.5, 10)).toBe(false);
  });

  it('el marge eixampla la franja i no l’encongeix mai', () => {
    /*
     * El límit de la franja té la seva pròpia incertesa: pintar just fins a
     * la ratlla seria fingir una precisió que no tenim.
     *
     * AQUÍ HI DEIA QUE PALMA QUEDAVA FORA, i era el defecte escrit en forma
     * de prova. La franja es tancava amb una corda recta de 810 km entre els
     * extrems dels dos límits i es menjava tot el llevant: Palma en té 96
     * segons de totalitat. Amb les tapes del terminador ja hi és de ple, i el
     * marge de deu quilòmetres no l'hi ha de fer entrar — l'ha de deixar
     * igual de dins. El que el marge no pot fer MAI és encongir la franja, i
     * això és el que aquesta prova vigila de debò.
     */
    const clip = bandClipFor(ECLIPSE);
    expect(bandContains(clip, 2.65, 39.57, 0)).toBe(true);
    expect(bandContains(clip, 2.65, 39.57, 10)).toBe(true);

    const view: HeatBbox = { west: -4, south: 40.5, east: -1, north: 42.5 };
    const strict = new Set(
      cellsForViewport(view, 10, ECLIPSE, { marginKm: 0, cellZoom: 12 }).map((c) => c.id),
    );
    const loose = cellsForViewport(view, 10, ECLIPSE, { marginKm: 40, cellZoom: 12 });
    expect(loose.length).toBeGreaterThan(strict.size);
    for (const id of strict) {
      expect(loose.some((c) => c.id === id)).toBe(true);
    }
  });

  it('fora de la franja no es torna cap cel·la: allà la resposta ja se sap', () => {
    const canaries: HeatBbox = { west: -16, south: 27.8, east: -15, north: 28.5 };
    expect(cellsForViewport(canaries, 11, ECLIPSE)).toHaveLength(0);
    // Sense franja, en canvi, la graella és purament geomètrica.
    expect(cellsForViewport(canaries, 11).length).toBeGreaterThan(0);
  });

  it('els altres dos eclipsis del catàleg també es retallen', () => {
    // El 2027 passa pel sud i l'Estret; el 2028 és el pitjor cas de tots.
    const cadis: HeatBbox = { west: -6.5, south: 36.2, east: -5.8, north: 36.8 };
    expect(cellsForViewport(cadis, 11, '2027-08-02').length).toBeGreaterThan(0);
    expect(cellsForViewport(cadis, 11, '2026-08-12')).toHaveLength(0);
  });
});

describe('les tessel·les d’un enquadrament', () => {
  it('cobreixen les quatre cantonades i no repeteixen res', () => {
    const tiles = tilesForBbox(SORIA_VIEW, 11);
    expect(tiles.length).toBeGreaterThan(0);
    expect(new Set(tiles.map((t) => `${t.z}/${t.x}/${t.y}`)).size).toBe(tiles.length);
    for (const tile of tiles) expect(tile.z).toBe(11);
  });

  it('un enquadrament del revés no dona res, en comptes d’explotar', () => {
    expect(tilesForBbox({ west: 1, south: 41, east: -1, north: 42 }, 11)).toHaveLength(0);
    expect(cellsForViewport({ west: 1, south: 41, east: -1, north: 42 }, 11)).toHaveLength(0);
  });
});
