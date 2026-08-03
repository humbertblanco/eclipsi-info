/**
 * Proves de les peces pures del hook del mapa de calor.
 *
 * QUÈ ES PROVA AQUÍ I QUÈ NO. Un hook de React no es pot muntar en aquest
 * entorn (Vitest corre a Node a posta: `src/core` no toca el DOM i muntar jsdom
 * per a tot seria pagar un peatge per res), i muntar-lo tampoc provaria el que
 * importa: el que decideix si el mapa de calor és correcte no és el cicle de
 * vida de React sinó DUES funcions pures que, si s'equivoquen, s'equivoquen en
 * silenci.
 *
 *  · `cellZoomOf` és la que evita que es barregin resolucions. Un identificador
 *    és `z/x/y` i una cel·la de zoom 10 conté quatre de zoom 11: si aquesta
 *    funció menteix, el mapa dibuixa polígons superposats de mides diferents
 *    amb farciments semitransparents i el color deixa de voler dir res.
 *  · `heatSourceOf` és la que respon si la memòria cau serveix de debò, que és
 *    la pregunta oberta de `core/heat/cache.ts`. Una passada de zero cel·les
 *    comptada com a «tot de memòria cau» inflaria justament la xifra que ha de
 *    decidir si aquell codi val el que costa.
 *
 * La resta —el debounce, la cancel·lació, l'acumulació de blocs— es mira amb el
 * mapa obert i el registre del Worker, que és on es veu.
 */

import { describe, expect, it } from 'vitest';
import type { HeatCost } from '../../core/heat/compute';
import { cellZoomOf, heatSourceOf } from './useHeatmap';

describe('cellZoomOf', () => {
  it('llegeix el zoom de la clau z/x/y', () => {
    expect(cellZoomOf('11/1018/770')).toBe(11);
    expect(cellZoomOf('9/254/192')).toBe(9);
    expect(cellZoomOf('2/1/1')).toBe(2);
  });

  it('una clau que no ho sigui no val zero, val NaN', () => {
    // Tornar zero seria un zoom vàlid i faria buidar l'acumulador cada vegada,
    // o pitjor: no buidar-lo quan tocava.
    expect(Number.isNaN(cellZoomOf(''))).toBe(true);
    expect(Number.isNaN(cellZoomOf('/1/1'))).toBe(true);
    expect(Number.isNaN(cellZoomOf('onze/1/1'))).toBe(true);
  });
});

function cost(over: Partial<HeatCost> = {}): HeatCost {
  return {
    cells: 100,
    fromCache: 0,
    theoryMs: 0,
    tilesMs: 0,
    terrainMs: 0,
    tiles: 0,
    terrainSamples: 0,
    ephemerisCalls: 0,
    totalMs: 0,
    level: 2,
    ...over,
  };
}

describe('heatSourceOf', () => {
  it('distingeix la memòria cau del càlcul i la barreja', () => {
    expect(heatSourceOf(cost({ cells: 100, fromCache: 100 }))).toBe('cache');
    expect(heatSourceOf(cost({ cells: 100, fromCache: 0 }))).toBe('computed');
    expect(heatSourceOf(cost({ cells: 100, fromCache: 40 }))).toBe('mixed');
  });

  it('una passada sense cel·les no diu res', () => {
    // Fora de la franja no hi ha cap cel·la a calcular. Comptar-ho com a
    // encert de memòria cau faria semblar que la promesa del camp sense
    // cobertura es compleix quan no s'ha arribat ni a preguntar.
    expect(heatSourceOf(cost({ cells: 0, fromCache: 0 }))).toBeNull();
  });
});
