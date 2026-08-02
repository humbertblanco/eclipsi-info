/**
 * Proves de les coordenades escrites a mà.
 *
 * La prova que mana és la primera: el format que l'app ENSENYA ha de tornar a
 * entrar. Si algú copia el que veu a la barra d'ubicació i el vol enganxar en
 * un altre dispositiu, ha de funcionar; que no funcioni el format propi és la
 * mena d'error que ningú no reporta perquè tothom assumeix que ho ha escrit
 * malament ell.
 */

import { describe, expect, it } from 'vitest';
import { formatCoords } from '../../screens/format';
import { parseCoords } from './coords';

describe('el format que ensenya la mateixa app', () => {
  it('es torna a entendre', () => {
    const text = formatCoords(41.3851, 2.1734);
    // Amb coma: des que formatCoords parla l'idioma de l'app, el camí d'anada
    // i tornada passa pel cas «decimals amb coma» que el parser ja documenta.
    expect(text).toBe('41,3851° N, 2,1734° E');
    expect(parseCoords(text)).toEqual({ lat: 41.3851, lon: 2.1734 });
  });

  it('amb oest i sud, els signes surten dels punts cardinals', () => {
    // `formatCoords` escriu «O» d'oest, que és com es diu en català i castellà.
    expect(parseCoords(formatCoords(43.3619, -5.8494))).toEqual({
      lat: 43.3619,
      lon: -5.8494,
    });
    expect(parseCoords(formatCoords(-33.8688, 151.2093))).toEqual({
      lat: -33.8688,
      lon: 151.2093,
    });
  });
});

describe('formats que arriben enganxats d’un altre lloc', () => {
  it('coma i espai', () => {
    expect(parseCoords('41.3851, 2.1734')).toEqual({ lat: 41.3851, lon: 2.1734 });
  });

  it('coma sense espai', () => {
    expect(parseCoords('41.3851,2.1734')).toEqual({ lat: 41.3851, lon: 2.1734 });
  });

  it('només espai', () => {
    expect(parseCoords('41.3851 2.1734')).toEqual({ lat: 41.3851, lon: 2.1734 });
  });

  it('negatius', () => {
    expect(parseCoords('-33.8688, 151.2093')).toEqual({
      lat: -33.8688,
      lon: 151.2093,
    });
  });

  it('decimals amb coma, com s’escriu aquí', () => {
    expect(parseCoords('41,3851, 2,1734')).toEqual({ lat: 41.3851, lon: 2.1734 });
  });

  it('espais de sobres', () => {
    expect(parseCoords('  41.3851 ,  2.1734  ')).toEqual({
      lat: 41.3851,
      lon: 2.1734,
    });
  });

  it('enters', () => {
    expect(parseCoords('41, 2')).toEqual({ lat: 41, lon: 2 });
  });
});

describe('el que no s’endevina', () => {
  it('buit', () => {
    expect(parseCoords('')).toBeNull();
    expect(parseCoords('   ')).toBeNull();
  });

  it('un sol número', () => {
    expect(parseCoords('41.3851')).toBeNull();
  });

  it('tres números', () => {
    expect(parseCoords('41.3851, 2.1734, 12')).toBeNull();
  });

  it('un nom de poble', () => {
    expect(parseCoords('Peníscola')).toBeNull();
  });

  it('fora del planeta', () => {
    expect(parseCoords('91, 2')).toBeNull();
    expect(parseCoords('41, 181')).toBeNull();
  });

  it('graus, minuts i segons: es rebutgen en comptes d’endevinar-los', () => {
    // «41° 23′ 6″» i «41.23» s'assemblen i no són el mateix punt (hi ha 8 km de
    // diferència). Endevinar-ho és pitjor que dir que no s'entén.
    expect(parseCoords('41° 23\' 6" N, 2° 10\' 24" E')).toBeNull();
  });

  it('un sol punt cardinal és una coordenada a mitges', () => {
    expect(parseCoords('41.3851 N, 2.1734')).toBeNull();
  });

  it('comes decimals sense cap espai són ambigües per a tothom', () => {
    expect(parseCoords('41,3851,2,1734')).toBeNull();
  });
});
