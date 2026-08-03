/**
 * La frontera, provada a Node i sense navegador.
 *
 * PER QUÈ ES POT PROVAR AIXÒ SI ÉS «LA PART QUE TOCA EL NAVEGADOR». Perquè el
 * que toca són dos globals (`gtag` i `location`) i a Node es poden posar i
 * treure. El que aquí es comprova no és que Google rebi res —això no ho pot
 * comprovar cap test— sinó les tres garanties que aquest fitxer promet: que
 * sense `gtag` calla, que amb `gtag` l'adreça viatja retallada, i que si
 * l'adreça no es pot retallar amb seguretat NO S'ENVIA RES.
 *
 * L'última és la que val la pena tenir escrita: és la diferència entre perdre
 * una mètrica i regalar la ubicació d'algú.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { installGtagAnalytics } from './gtag';
import { installAnalytics, track } from '../core/analytics';

interface Crida {
  command: string;
  name: string;
  params: Record<string, string>;
}

const arrel = globalThis as unknown as {
  gtag?: unknown;
  location?: { href?: unknown };
};

function posaGtag(cridas: Crida[], petar = false): void {
  arrel.gtag = (command: string, name: string, params: Record<string, string>) => {
    if (petar) throw new Error('bloquejador');
    cridas.push({ command, name, params });
  };
}

function posaAdreca(href: unknown): void {
  arrel.location = { href } as { href?: unknown };
}

afterEach(() => {
  delete arrel.gtag;
  delete arrel.location;
  installAnalytics(null);
});

describe('la frontera amb Google Analytics', () => {
  it('sense gtag no envia res i no peta', () => {
    // El cas del bloquejador, del mode privat estricte i del cim sense
    // cobertura: el script extern no és al precache a posta.
    posaAdreca('https://eclipsi.info/#/mapa');
    installGtagAnalytics({ debug: false });

    expect(() => track('map_layer_toggle', { layer: 'hillshade', state: 'on' })).not.toThrow();
    expect(track('map_layer_toggle', { layer: 'hillshade', state: 'on' })).toBe('sent');
    // «sent» vol dir que la frontera ha fet la seva feina, no que Google hagi
    // rebut res: aquesta distinció és tota la gràcia de tenir-les separades.
  });

  it('amb gtag, l’esdeveniment surt amb l’adreça RETALLADA', () => {
    const cridas: Crida[] = [];
    posaGtag(cridas);
    posaAdreca(
      'https://eclipsi.info/?p=41.3809,2.1735&n=Pen%C3%ADscola#/mapa/llocs',
    );
    installGtagAnalytics({ debug: false });

    track('map_layer_toggle', { layer: 'hillshade', state: 'on' });

    expect(cridas).toHaveLength(1);
    expect(cridas[0].command).toBe('event');
    expect(cridas[0].name).toBe('map_layer_toggle');
    expect(cridas[0].params).toEqual({
      layer: 'hillshade',
      state: 'on',
      page_location: 'https://eclipsi.info/#/mapa/llocs',
    });
  });

  it('res del que surt d’aquí porta la ubicació de ningú', () => {
    const cridas: Crida[] = [];
    posaGtag(cridas);
    posaAdreca('https://eclipsi.info/?p=41.3809,2.1735&n=Pen%C3%ADscola#/mapa');
    installGtagAnalytics({ debug: false });

    track('point_set', { method: 'gps', had_point: 'no' });
    track('verdict_shown', { kind: 'total', duration: 'one_to_two_min', terrain: 'trimmed' });

    const tot = JSON.stringify(cridas);
    for (const rastre of ['41.3809', '2.1735', 'Pen', '?p=', '&n=']) {
      expect(tot.includes(rastre), rastre).toBe(false);
    }
  });

  it('si l’adreça no es pot retallar amb seguretat, no surt res', () => {
    const cridas: Crida[] = [];
    posaGtag(cridas);
    installGtagAnalytics({ debug: false });

    for (const href of [undefined, '', 'no és una adreça', 'file:///x/index.html?p=1,2']) {
      posaAdreca(href);
      track('spot_pick', { rank: 'first' });
    }

    expect(cridas).toEqual([]);
  });

  it('un gtag que llança no s’emporta la pantalla', () => {
    posaGtag([], true);
    posaAdreca('https://eclipsi.info/#/mapa');
    installGtagAnalytics({ debug: false });

    expect(() => track('spot_pick', { rank: 'first' })).not.toThrow();
    expect(track('spot_pick', { rank: 'first' })).toBe('sent');
  });

  it('un gtag que no és una funció es tracta com si no hi fos', () => {
    // Alguna extensió deixa un objecte, un `true` o un `null` on hi havia la
    // funció. Comprovar el tipus i no la presència és la diferència entre
    // callar i petar.
    posaAdreca('https://eclipsi.info/#/mapa');
    installGtagAnalytics({ debug: false });

    for (const fals of [true, 42, {}, null, 'gtag']) {
      arrel.gtag = fals;
      expect(() => track('spot_pick', { rank: 'first' })).not.toThrow();
    }
  });
});
