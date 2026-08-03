/**
 * L'emissor: que arribi el que ha d'arribar, que no arribi res més, i que no
 * peti mai — sobretot quan no hi ha ningú a l'altra banda.
 *
 * EL CAS SENSE FRONTERA NO ÉS UN CAS DE PROVA: ÉS EL CAS NORMAL. Corre així a
 * cada test d'aquest projecte, a cada script de mesura, dins de cada Worker, i
 * al navegador de qualsevol que tingui un bloquejador o que hagi obert l'app al
 * cim d'una muntanya sense cobertura — que és exactament l'usuari per al qual
 * està feta. Si `track()` peta o fa soroll en aquest cas, l'analítica passa de
 * no servir per a res a fer mal.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  analyticsInstalled,
  installAnalytics,
  track,
  type AnalyticsTransport,
} from './track';
import type { RejectionReason } from './sanitize';

/**
 * La mateixa funció, vista com la veu qui té pressa: sense tipus. És l'única
 * manera de provar la porta des d'aquí — amb els tipus posats, tot el que
 * hauria de fallar no compilaria, que és justament el primer pany.
 */
const trackSenseTipus = track as unknown as (name: string, params: unknown) => string;

interface Rebut {
  name: string;
  params: Record<string, string>;
}

function espia(): { transport: AnalyticsTransport; rebuts: Rebut[]; refusats: string[] } {
  const rebuts: Rebut[] = [];
  const refusats: string[] = [];
  return {
    rebuts,
    refusats,
    transport: {
      send: (name, params) => {
        rebuts.push({ name, params: { ...params } });
      },
      onRejected: (name, reason: RejectionReason, detail) => {
        refusats.push(`${name}:${reason}:${detail}`);
      },
    },
  };
}

afterEach(() => {
  installAnalytics(null);
});

describe('sense frontera instal·lada', () => {
  it('no hi ha frontera per defecte', () => {
    expect(analyticsInstalled()).toBe(false);
  });

  it('enviar no peta i ho diu sense fer soroll', () => {
    expect(() =>
      track('map_layer_toggle', { layer: 'hillshade', state: 'on' }),
    ).not.toThrow();
    expect(track('map_layer_toggle', { layer: 'cone', state: 'off' })).toBe(
      'no_transport',
    );
  });

  it('la porta s’aplica igualment', () => {
    // Que el comportament sigui el mateix amb navegador i sense és el que fa
    // que un test verd digui alguna cosa sobre producció.
    expect(trackSenseTipus('map_layer_toggle', { layer: 41.38, state: 'on' })).toBe(
      'rejected',
    );
  });
});

describe('amb frontera instal·lada', () => {
  it('un esdeveniment bo hi arriba net', () => {
    const { transport, rebuts } = espia();
    installAnalytics(transport);

    expect(track('map_view_open', { view: 'spots', via: 'cta' })).toBe('sent');
    expect(rebuts).toEqual([
      { name: 'map_view_open', params: { view: 'spots', via: 'cta' } },
    ]);
  });

  it('el que la porta rebutja no hi arriba MAI', () => {
    const { transport, rebuts, refusats } = espia();
    installAnalytics(transport);

    const dolents: [string, unknown][] = [
      ['map_view_open', { view: 'spots', via: 'cta', lat: '41' }],
      ['map_view_open', { view: 41.3809, via: 'cta' }],
      ['map_view_open', { view: 'Peníscola', via: 'cta' }],
      ['point_set', { method: 'gps', had_point: 'yes', place: 'peniscola' }],
      ['lloc_triat', { rank: 'first' }],
      ['page_view', {}],
    ];

    for (const [name, params] of dolents) {
      expect(trackSenseTipus(name, params), name).toBe('rejected');
    }
    expect(rebuts).toEqual([]);
    // I qui programa se n'assabenta, amb el nom del paràmetre i mai el valor.
    expect(refusats.length).toBe(dolents.length);
    expect(refusats.join(' ')).not.toContain('41.3809');
    expect(refusats.join(' ')).not.toContain('Peníscola');
  });

  it('una frontera que peta no s’emporta res per davant', () => {
    // El cas real: hi ha bloquejadors que no treuen `gtag`, el substitueixen
    // per un tros de codi que llança.
    installAnalytics({
      send: () => {
        throw new Error('bloquejador');
      },
    });

    expect(() => track('spot_pick', { rank: 'first' })).not.toThrow();
    expect(track('spot_pick', { rank: 'first' })).toBe('transport_failed');
  });

  it('un diagnòstic que peta tampoc', () => {
    installAnalytics({
      send: () => undefined,
      onRejected: () => {
        throw new Error('paf');
      },
    });

    expect(() => trackSenseTipus('spot_pick', { rank: 41 })).not.toThrow();
  });

  it('retirar-la torna l’app al silenci', () => {
    const { transport, rebuts } = espia();
    installAnalytics(transport);
    track('spot_pick', { rank: 'first' });
    installAnalytics(null);
    track('spot_pick', { rank: 'top_three' });

    expect(analyticsInstalled()).toBe(false);
    expect(rebuts.length).toBe(1);
  });

  /*
   * EL PRIMER PANY ÉS EL COMPILADOR, I AQUEST BLOC EL VIGILA.
   *
   * Vitest no comprova tipus: transpila i corre. Però `tsconfig.app.json`
   * inclou `src` sencer, tests inclosos, o sigui que `tsc -b` SÍ que llegeix
   * aquestes línies — i un `@ts-expect-error` damunt d'una línia que ha
   * DEIXAT de fer error és un error de compilació. Dit d'una altra manera:
   * si un dia el vocabulari s'afluixa i qualsevol cosa hi passa, això no
   * compilarà i el desplegament s'aturarà. És el mateix truc del daurat de
   * `circumstances.test.ts`: escriure la garantia allà on el pot trencar.
   *
   * Les crides corren igualment, i cada una ha de tornar `rejected`: els dos
   * panys, el del compilador i el de la porta, comprovats a la mateixa línia.
   */
  it('el compilador rebutja el que la porta rebutjaria', () => {
    const { transport, rebuts } = espia();
    installAnalytics(transport);

    // @ts-expect-error un valor que no és al vocabulari
    expect(track('map_layer_toggle', { layer: 'hillshade', state: 'maybe' })).toBe('rejected');
    // @ts-expect-error un esdeveniment que no existeix
    expect(track('lloc_triat', { rank: 'first' })).toBe('rejected');
    // @ts-expect-error hi falta un paràmetre declarat
    expect(track('map_layer_toggle', { layer: 'hillshade' })).toBe('rejected');
    // @ts-expect-error una latitud, que és el que tot això existeix per aturar
    expect(track('map_layer_toggle', { layer: 'hillshade', state: 'on', lat: 41.38 })).toBe('rejected');
    // @ts-expect-error una xifra on hi ha d'anar una franja
    expect(track('spot_pick', { rank: 3 })).toBe('rejected');
    // @ts-expect-error el topònim de l'usuari, pel camí curt
    expect(track('point_set', { method: 'gps', had_point: 'yes', place: 'peniscola' })).toBe('rejected');

    expect(rebuts).toEqual([]);
  });

  it('la frontera rep un objecte propi, no el de qui ha cridat', () => {
    const { transport, rebuts } = espia();
    installAnalytics(transport);

    const params = { layer: 'hillshade', state: 'on' } as const;
    track('map_layer_toggle', params);
    expect(rebuts[0].params).not.toBe(params);
    expect(rebuts[0].params).toEqual({ layer: 'hillshade', state: 'on' });
  });
});
