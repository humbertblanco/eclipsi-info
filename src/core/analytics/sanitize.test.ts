/**
 * La porta de privadesa, provada com si algú intentés forçar-la.
 *
 * Aquest test no comprova que el codi faci el que diu la seva capçalera:
 * comprova que NO ES POT fer el que el peu de l'app promet que no es fa. La
 * diferència és qui l'escriu — el primer el llegeix qui ja hi està d'acord, i
 * el segon ha de resistir algú amb pressa la nit abans de l'eclipsi.
 *
 * LA PEÇA CENTRAL ÉS L'ESCOMBRADA DE MÉS AVALL: agafa TOTS els esdeveniments
 * del vocabulari, TOTS els seus paràmetres, i hi encasta una bateria de coses
 * que són ubicacions disfressades. Cap no pot passar. Com que recorre la taula
 * en comptes d'una llista escrita a mà, un esdeveniment nou queda cobert el dia
 * que es declara, sense que ningú s'hagi de recordar de venir aquí.
 */

import { describe, it, expect } from 'vitest';
import {
  MAX_PARAMS,
  isForbiddenKey,
  isSafeToken,
  safePageLocation,
  sanitizeEvent,
} from './sanitize';
import { VOCABULARY, declaredParams, type AnalyticsEventName } from './vocabulary';

const EVENT_NAMES = Object.keys(VOCABULARY) as AnalyticsEventName[];

/** Un esdeveniment vàlid: el primer valor declarat de cada paràmetre. */
function baseline(name: AnalyticsEventName): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, values] of Object.entries(declaredParams(name))) {
    params[key] = values[0];
  }
  return params;
}

/**
 * Ubicacions disfressades, en totes les formes en què una s'ha escapat mai
 * d'una aplicació: el número pelat, el número fet cadena, la parella, els graus
 * sexagesimals, el topònim, l'adreça amb consulta, i l'objecte que se'ls
 * emporta a dins.
 */
const PERILLOSOS: readonly unknown[] = [
  41.3809,
  -3.5,
  2.1735,
  0,
  1,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  '41.3809',
  '-3.5',
  '41,3809',
  '41.3809,2.1735',
  '41.3809, 2.1735',
  '41°22′51″N 2°10′24″E',
  'Peníscola',
  'peníscola',
  'el Port de la Selva',
  'Sòria',
  'Penyagolosa',
  'https://eclipsi.info/?p=41.3809,2.1735',
  '?p=41.3809,2.1735&n=Peniscola',
  '/eclipsi/?p=1,2',
  '#/mapa/41.38,2.17',
  'usuari@example.com',
  true,
  false,
  null,
  undefined,
  {},
  [],
  { lat: 41.3809, lon: 2.1735 },
  '',
  ' ',
  'a'.repeat(25),
];

describe('la porta de privadesa', () => {
  it('deixa passar un esdeveniment declarat, sencer i net', () => {
    const result = sanitizeEvent('map_layer_toggle', {
      layer: 'hillshade',
      state: 'on',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.name).toBe('map_layer_toggle');
    expect(result.params).toEqual({ layer: 'hillshade', state: 'on' });
  });

  it('tots els esdeveniments del vocabulari es poden emetre de debò', () => {
    // Si això falla, hi ha una entrada de la taula que no pot travessar la seva
    // pròpia porta: un esdeveniment que s'hauria escrit, s'hauria cablejat i no
    // hauria arribat mai enlloc, en silenci.
    for (const name of EVENT_NAMES) {
      const result = sanitizeEvent(name, baseline(name));
      expect(result.ok, `${name} no passa la seva pròpia porta`).toBe(true);
    }
  });

  describe('cap ubicació no pot sortir, de cap manera', () => {
    it('cap valor perillós no travessa cap paràmetre de cap esdeveniment', () => {
      for (const name of EVENT_NAMES) {
        for (const key of Object.keys(declaredParams(name))) {
          for (const perillos of PERILLOSOS) {
            const params: Record<string, unknown> = baseline(name);
            params[key] = perillos;
            const result = sanitizeEvent(name, params);
            expect(
              result.ok,
              `${name}.${key} ha deixat passar ${String(perillos)}`,
            ).toBe(false);
          }
        }
      }
    });

    it('una latitud és un número, i cap número no passa', () => {
      const result = sanitizeEvent('spot_pick', { rank: 41.3809 });
      expect(result).toMatchObject({ ok: false, reason: 'not_a_string' });
    });

    it('una latitud feta cadena tampoc: no té forma de paraula', () => {
      const result = sanitizeEvent('spot_pick', { rank: '41.3809' });
      expect(result).toMatchObject({ ok: false, reason: 'bad_value' });
    });

    it('una paraula amb forma bona però no declarada tampoc passa', () => {
      // Aquesta és la que atrapa el descuit honest: `on`/`off` existeixen,
      // `maybe` no, i el panell de GA no s'ha d'omplir de valors inventats.
      const result = sanitizeEvent('map_layer_toggle', {
        layer: 'hillshade',
        state: 'maybe',
      });
      expect(result).toMatchObject({ ok: false, reason: 'undeclared_value' });
    });
  });

  describe('les claus on s’amaga una ubicació', () => {
    it('rebutja les que es diuen pel seu nom', () => {
      for (const key of ['lat', 'lon', 'coords', 'place', 'label', 'query', 'url']) {
        expect(isForbiddenKey(key), key).toBe(true);
      }
    });

    it('rebutja les que ho amaguen dins d’un nom més llarg', () => {
      for (const key of ['origin_lat', 'spot_place', 'user_query', 'map_url']) {
        expect(isForbiddenKey(key), key).toBe(true);
      }
    });

    it('no rebutja les claus legítimes del vocabulari', () => {
      // `had_point` és el cas límit: pregunta si hi ha punt, no diu quin. Si un
      // dia la llista de prohibides es fa per trossos i no per coincidència
      // exacta, aquest test es posa vermell abans que el vocabulari es trenqui.
      for (const name of EVENT_NAMES) {
        for (const key of Object.keys(declaredParams(name))) {
          expect(isForbiddenKey(key), `${name}.${key}`).toBe(false);
        }
      }
    });

    it('una clau prohibida cau encara que el valor sigui innocent', () => {
      const result = sanitizeEvent('spot_pick', { rank: 'first', lat: 'first' });
      expect(result).toMatchObject({ ok: false, reason: 'forbidden_key' });
    });

    it('ningú no pot escriure `page_location` des d’un esdeveniment', () => {
      // El camp de l'adreça l'escriu la frontera, amb el valor ja retallat. Que
      // no el pugui escriure ningú més és el que fa que la garantia sigui d'un
      // sol lloc i es pugui comprovar d'un cop d'ull.
      const result = sanitizeEvent('spot_pick', {
        rank: 'first',
        page_location: 'https://eclipsi.info/?p=41.38,2.17',
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('els esdeveniments que no existeixen', () => {
    it('un nom no declarat no passa', () => {
      expect(sanitizeEvent('lloc_triat', { rank: 'first' })).toMatchObject({
        ok: false,
        reason: 'unknown_event',
      });
    });

    it('un nom que GA4 es reserva no passa', () => {
      expect(sanitizeEvent('page_view', {})).toMatchObject({
        ok: false,
        reason: 'reserved_event',
      });
    });

    it('un nom amb majúscules o accents no passa', () => {
      expect(sanitizeEvent('MapLayerToggle', {})).toMatchObject({
        ok: false,
        reason: 'bad_event_name',
      });
    });
  });

  describe('l’esdeveniment ha de ser sencer', () => {
    it('falta un paràmetre declarat: no passa', () => {
      expect(sanitizeEvent('map_layer_toggle', { layer: 'hillshade' })).toMatchObject({
        ok: false,
        reason: 'missing_param',
      });
    });

    it('sobra un paràmetre: no passa', () => {
      expect(
        sanitizeEvent('map_layer_toggle', {
          layer: 'hillshade',
          state: 'on',
          extra: 'foo',
        }),
      ).toMatchObject({ ok: false, reason: 'unknown_param' });
    });

    it('massa paràmetres: no passa', () => {
      const params: Record<string, string> = { rank: 'first' };
      for (let i = 0; i < MAX_PARAMS; i += 1) params[`p${i}`] = 'x';
      expect(sanitizeEvent('spot_pick', params)).toMatchObject({
        ok: false,
        reason: 'too_many_params',
      });
    });
  });

  describe('el que arriba no és de fiar', () => {
    it('uns paràmetres que no són un objecte no passen', () => {
      for (const params of [null, undefined, 'rank=first', 42, ['rank']]) {
        const result = sanitizeEvent('spot_pick', params);
        expect(result.ok, String(params)).toBe(false);
      }
    });

    it('un valor heretat del prototipus no compta com a present', () => {
      // `{ rank: 'first' }` per herència passaria un `in` i no ha de passar:
      // qui munta objectes amb `Object.create` o els treu d'un `JSON.parse`
      // manipulat no ha de poder decidir què s'envia.
      const params = Object.create({ rank: 'first' }) as Record<string, unknown>;
      expect(sanitizeEvent('spot_pick', params)).toMatchObject({
        ok: false,
        reason: 'missing_param',
      });
    });

    it('el resultat és un objecte NOU, sense res que no s’hagi declarat', () => {
      const input = { rank: 'first' };
      const result = sanitizeEvent('spot_pick', input);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.params).not.toBe(input);
      expect(Object.keys(result.params)).toEqual(['rank']);
    });

    it('no llança mai, passi el que passi', () => {
      const explosiu = {
        get rank(): string {
          throw new Error('paf');
        },
      };
      // Un objecte que no es deixa llegir no és un esdeveniment: és un no. I
      // sobretot, no és una excepció que puja fins a la pantalla per una dada
      // que a l'usuari no li serveix de res.
      expect(() => sanitizeEvent('spot_pick', explosiu)).not.toThrow();
      expect(sanitizeEvent('spot_pick', explosiu)).toMatchObject({
        ok: false,
        reason: 'read_failed',
      });
      // La resta d'entrades rares tampoc no han de fer saltar res.
      for (const params of [Symbol('x'), () => 'first', new Date(), NaN]) {
        expect(() => sanitizeEvent('spot_pick', params)).not.toThrow();
      }
    });
  });

  describe('la forma de paraula', () => {
    it('accepta les fitxes en minúscula i prou', () => {
      for (const token of ['band', 'map_tap', 'over_two_min', 'a', 'x9']) {
        expect(isSafeToken(token), token).toBe(true);
      }
    });

    it('rebutja tot el que té forma de dada de l’usuari', () => {
      for (const token of [
        '41.38',
        '2,17',
        'Peníscola',
        'MAP_TAP',
        'map tap',
        '_privat',
        '9lives',
        'https://x',
        'a'.repeat(25),
        '',
      ]) {
        expect(isSafeToken(token), token).toBe(false);
      }
    });
  });
});

describe('l’adreça retallada', () => {
  it('es queda l’origen, el camí i el fragment; la consulta se’n va sencera', () => {
    expect(
      safePageLocation(
        'https://eclipsi.info/?p=41.3809,2.1735&e=2026-08-12&n=Pen%C3%ADscola#/mapa/llocs',
      ),
    ).toBe('https://eclipsi.info/#/mapa/llocs');
  });

  it('conserva el subdirectori del desplegament de llegat', () => {
    expect(safePageLocation('https://lacuinade.estic.online/eclipsi/?p=1,2')).toBe(
      'https://lacuinade.estic.online/eclipsi/',
    );
  });

  it('conserva les rutes de l’app', () => {
    for (const hash of ['#/mapa', '#/cel', '#/guia/safety', '#/com-funciona']) {
      expect(safePageLocation(`https://eclipsi.info/${hash}`)).toBe(
        `https://eclipsi.info/${hash}`,
      );
    }
  });

  it('llença el fragment que no reconeix, encara que hi perdi detall', () => {
    // El dia que algú posi el punt al fragment —una idea que apareix sola quan
    // es vol compartir estat— això ha de caure sol i sense avisar ningú.
    for (const href of [
      'https://eclipsi.info/#/mapa/41.38,2.17',
      'https://eclipsi.info/#/mapa?p=41.38,2.17',
      'https://eclipsi.info/#p=41.38',
      'https://eclipsi.info/#/Peniscola',
    ]) {
      expect(safePageLocation(href), href).toBe('https://eclipsi.info/');
    }
  });

  it('no deixa passar credencials incrustades a l’adreça', () => {
    expect(safePageLocation('https://usuari:clau@eclipsi.info/?p=1,2')).toBe(
      'https://eclipsi.info/',
    );
  });

  it('falla tancat quan l’adreça no és web o no es pot llegir', () => {
    for (const href of [
      'no és una adreça',
      '',
      'file:///Users/algu/eclipsi/index.html?p=41.38,2.17',
      'data:text/html,<h1>hola</h1>',
      'javascript:alert(1)',
    ]) {
      expect(safePageLocation(href), href).toBeNull();
    }
  });

  it('el que en surt no porta mai res de l’usuari', () => {
    const bruta =
      'https://eclipsi.info/?p=41.3809,2.1735&n=Pen%C3%ADscola#/mapa/llocs';
    const neta = safePageLocation(bruta) ?? '';
    for (const rastre of ['?', '&', 'p=', '41.38', '2.17', 'Pen']) {
      expect(neta.includes(rastre), rastre).toBe(false);
    }
  });
});
