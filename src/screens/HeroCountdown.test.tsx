/**
 * Les dues xifres de la portada, muntades alhora i amb el temps aturat trenta
 * segons dins de la totalitat.
 *
 * QUÈ PROVA, I PER QUÈ AQUÍ. La prova pura (`heroTarget.test.ts`) ja recorre
 * tot l'eclipsi i exigeix que el titular i `resolveCountdown()` triïn la
 * mateixa fita. El que aquella no pot veure és si el que arriba a la PANTALLA
 * és aquella decisió: el titular té un rellotge propi, `CountdownView` en té un
 * altre, i tot el defecte original consistia justament en dues peces que per
 * separat eren correctes. Aquí es munten les dues de debò i es demana que
 * anomenin la mateixa fita.
 *
 * ELS DOS COMPONENTS I NO LA PANTALLA SENCERA. `CountdownScreen` arrossega
 * MapLibre, un Worker i la crida del temps; el que es contradeia no era la
 * pantalla sinó aquestes dues peces, i són elles les que han de coincidir. Si
 * algun dia una tercera peça ensenya una fita, aquesta prova s'ha d'ampliar.
 *
 * COM S'ATURA EL TEMPS: pel camí de producció i no amb cap doble. `useNow` no
 * llegeix `Date.now()` sinó el rellotge monòton compartit, que va ancorar-se
 * quan es va importar el mòdul; l'única cosa que el torna a ancorar és el
 * `clock.resync()` que dispara `visibilitychange`, que és exactament el que
 * passa al telèfon quan es desbloqueja la pantalla. Per això aquí hi ha
 * `vi.setSystemTime()` i tot seguit l'esdeveniment: sense l'esdeveniment, el
 * titular seguiria comptant amb l'hora de debò i la prova provaria el rellotge
 * de la màquina que la corre.
 */

import { act, render, within } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { computeLocalCircumstances } from '../core/astro/contacts';
import { CountdownView } from '../features/countdown';
import { HeroCountdown } from './HeroCountdown';
import { s } from './strings';

/** Sòria: dins de la franja, amb C2 i C3 de debò. El mateix punt que la prova pura. */
const SORIA = { lat: 41.7665, lon: -2.479, elevation: 1063 };

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Munta les dues peces amb el rellotge congelat a `atMs` i les torna per
 * separat, perquè cada asserció digui de quina de les dues parla.
 */
function mountBoth(atMs: number) {
  /*
   * L'HORA ES CONGELA ABANS DE CALCULAR LES CIRCUMSTÀNCIES, i no és un detall
   * d'ordre: `vi.setSystemTime` substitueix la classe `Date` global, i
   * astronomy-engine comprova `instanceof Date` a cada crida. Amb els contactes
   * calculats abans, les seves dates són de la classe VELLA i el motor peta amb
   * «Argument must be a Date object» al primer render que en llegeixi una (el
   * guió de la totalitat en llegeix unes quantes). El càlcul no depèn de quina
   * hora és, o sigui que fer-lo després no canvia cap xifra.
   *
   * També ha de passar abans de muntar res: el reproductor d'avisos ancora el
   * seu rellotge quan es crea i `Countdown` llegeix `Date.now()` a la primera
   * pintada.
   */
  vi.setSystemTime(atMs);

  const circumstances = computeLocalCircumstances('2026-08-12', SORIA);
  const contacts = circumstances.contacts;

  const hero = render(
    <HeroCountdown
      contacts={contacts}
      kind={circumstances.kind}
      baseTargetMs={(contacts.c2 ?? contacts.max).time.getTime()}
      baseLabel={s('home.untilTotality', 'ca')}
      locale="ca"
    />,
  );
  const view = render(<CountdownView circumstances={circumstances} locale="ca" centralPhaseVisible />);

  // El rellotge compartit de `useNow` encara està ancorat a l'hora real: el
  // torna a ancorar el mateix camí que fa servir el telèfon en despertar-se.
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });

  return { circumstances, hero, view };
}

describe('la portada, trenta segons dins de la totalitat', () => {
  it('el titular i el compte enrere del costat anomenen la mateixa fita', () => {
    const c2 = computeLocalCircumstances('2026-08-12', SORIA).contacts.c2!.time.getTime();
    const { hero, view } = mountBoth(c2 + 30_000);

    /*
     * LA FITA ÉS EL FINAL DE LA TOTALITAT, no el començament que ja ha passat.
     * Aquesta és la frase que abans només deia el rellotge del costat, mentre
     * el titular comptava cap amunt amb «Ha passat fa».
     */
    expect(within(hero.container).getByText('Fi de la totalitat')).toBeTruthy();
    expect(
      within(view.container).getByRole('heading', { level: 2 }).textContent,
    ).toBe('Fi de la totalitat');

    // I la frase de l'objectiu fix no pot ser enlloc: era l'altra meitat de la
    // contradicció.
    expect(within(hero.container).queryByText(s('home.past', 'ca'))).toBeNull();
    expect(within(hero.container).queryByText(s('home.untilTotality', 'ca'))).toBeNull();
  });

  it('les dues xifres compten el mateix, amb l’esbiaix d’un segon que està escrit', () => {
    const c2 = computeLocalCircumstances('2026-08-12', SORIA).contacts.c2!.time.getTime();
    const { hero, view } = mountBoth(c2 + 30_000);

    /*
     * El titular reparteix el temps en grups amb la seva unitat («01 min 10 s»)
     * i el rellotge del costat l'escriu «01:10»: es comparen els segons, no les
     * cadenes. La tolerància d'un segon NO és folgança per si de cas: el
     * titular arrodoneix cap avall i `formatCountdown` cap amunt (vegeu
     * `splitDuration`), i a més els dos rellotges monòtons poden estar separats
     * fins a un segon. És l'esbiaix que la capçalera de `HeroCountdown.tsx`
     * declara com a acceptat.
     */
    const heroDigits = (within(hero.container).getByRole('timer').textContent ?? '')
      .match(/\d+/g)!
      .map(Number);
    expect(heroDigits).toHaveLength(2);
    const heroSeconds = heroDigits[0] * 60 + heroDigits[1];

    // La xifra gran de `CountdownView` és la primera d'aquest format del seu
    // arbre: el bloc del rellotge va abans que la secció «Durant».
    const viewText = within(view.container).getAllByText(/^\d{1,2}:\d{2}$/)[0].textContent!;
    const [minutes, seconds] = viewText.split(':').map(Number);
    const viewSeconds = minutes * 60 + seconds;

    expect(Math.abs(heroSeconds - viewSeconds)).toBeLessThanOrEqual(1);
    // I que no siguin totes dues zero per una pantalla que no s'ha actualitzat.
    expect(heroSeconds).toBeGreaterThan(0);
  });
});
