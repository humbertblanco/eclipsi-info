/**
 * La superposició de la càmera no pot autoritzar res des d'una barra.
 *
 * EL DEFECTE QUE ES TANCA AQUÍ. El rètol de seguretat de la vista de RA es
 * disparava amb `isTotality`, que surt de `currentSample`, que surt de la
 * POSICIÓ D'UNA BARRA que l'usuari arrossega. Arrossegar una barra no fa fosc.
 * El rètol es pinta damunt de la imatge de la càmera, en present i en
 * imperatiu —«Ara sí: mira-ho sense filtre»— mentre la persona apunta el
 * telèfon al Sol de debò. Dos dels cent seixanta-un passos del recorregut a
 * Oviedo satisfeien la condició, i el marcador de sota et diu on parar.
 *
 * La regla que substitueix allò té tres condicions i totes tres es proven
 * aquí: la comporta ha d'autoritzar, el rellotge de PARET ha de ser dins de la
 * finestra segura, i la barra no hi pinta res.
 */

import { describe, expect, it } from 'vitest';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import { FILTER_OFF_DELAY_SEC, nakedEyeAllowedAt } from '../../core/timer';
import type { LocalCircumstances } from '../../core/astro/types';

/*
 * AQUÍ HI HAVIA UNA CÒPIA DE LA CONDICIÓ, I UNA CÒPIA NO VIGILA L'ORIGINAL.
 *
 * Aquesta funció reimplementava a mà el que fa `ARView`, amb el comentari
 * «extreta per poder-la provar». El resultat previsible: el codi de debò
 * llegia `Date.now()` dins d'un `useMemo` amb dependències estàtiques —una
 * sola lectura, en muntar la vista— i el rètol «ara pots mirar sense filtre»
 * es quedava encès després de C3, amb la fotosfera ja tornant. Aquestes sis
 * proves seguien verdes tot aquell temps, perquè provaven la còpia.
 *
 * Ara la composició viu a `core/timer/safety.ts` (`nakedEyeAllowedAt`), la
 * crida la vista i la crida aquest fitxer. Una sola definició.
 */
function nakedEyeAt(circumstances: LocalCircumstances, nowMs: number): boolean {
  return nakedEyeAllowedAt(
    {
      kind: circumstances.kind,
      contacts: {
        c1: circumstances.contacts.c1?.time.getTime(),
        c2: circumstances.contacts.c2?.time.getTime(),
        max: circumstances.contacts.max.time.getTime(),
        c3: circumstances.contacts.c3?.time.getTime(),
        c4: circumstances.contacts.c4?.time.getTime(),
      },
      edgeUncertain: circumstances.edgeUncertain,
    },
    nowMs,
  );
}

/** Oviedo, a tocar de la línia central del 12-08-2026: 108 s de totalitat. */
const OVIEDO = computeLocalCircumstances('2026-08-12', {
  lat: 43.3619,
  lon: -5.8494,
  elevation: 232,
});

/** València, dins de l'anular del 26-01-2028: set minuts d'anell. */
const VALENCIA = computeLocalCircumstances('2028-01-26', {
  lat: 39.4699,
  lon: -0.3763,
  elevation: 15,
});

describe('quan es pot mirar sense filtre des de la vista de càmera', () => {
  const c2 = OVIEDO.contacts.c2!.time.getTime();
  const c3 = OVIEDO.contacts.c3!.time.getTime();

  it('al mig de la totalitat, sí', () => {
    expect(nakedEyeAt(OVIEDO, (c2 + c3) / 2)).toBe(true);
  });

  it('un dia abans, no —encara que la barra digui «totalitat»', () => {
    // Aquest és el cas de l'usuari que obre l'app per planificar i mou la
    // barra fins al màxim per veure com quedarà. Abans, això encenia el rètol.
    expect(nakedEyeAt(OVIEDO, c2 - 24 * 3600_000)).toBe(false);
  });

  it('a C2 clavat, encara no', () => {
    // El C2 calculat va sistemàticament avançat respecte del real; per això
    // hi ha dotze segons de marge, i per això aquest test existeix.
    expect(nakedEyeAt(OVIEDO, c2)).toBe(false);
    expect(nakedEyeAt(OVIEDO, c2 + FILTER_OFF_DELAY_SEC * 1000 - 500)).toBe(false);
    expect(nakedEyeAt(OVIEDO, c2 + FILTER_OFF_DELAY_SEC * 1000 + 500)).toBe(true);
  });

  it('quinze segons abans de C3, ja no', () => {
    expect(nakedEyeAt(OVIEDO, c3 - 16_000)).toBe(true);
    expect(nakedEyeAt(OVIEDO, c3 - 14_000)).toBe(false);
    expect(nakedEyeAt(OVIEDO, c3 + 1000)).toBe(false);
  });

  /*
   * EL RÈTOL S'HA D'APAGAR SOL, I DURANT TOT EL PROJECTE NO HO FEIA.
   *
   * `ARView` calculava això dins d'un `useMemo` amb `Date.now()` a dins i
   * dependències que no es mouen amb el temps: una sola lectura, en muntar la
   * vista. Qui obria la càmera dins de la totalitat —el gest més probable del
   * dia— es quedava amb «ara pots mirar sense filtre» encès a C3, a C4 i una
   * hora després.
   *
   * QUÈ VIGILA AIXÒ I QUÈ NO, que la primera versió d'aquest comentari ho deia
   * malament: vigila la FORMA de la finestra de la funció pura —que hi hagi
   * exactament una encesa i una apagada, i que la durada oberta sigui la
   * totalitat menys els dos marges—. NO pot detectar que algú torni a congelar
   * el rellotge a la vista, perquè la congelació era a `ARView` i aquí el temps
   * entra com a paràmetre. Mentre no hi hagi proves de components (vegeu
   * ESTAT.md: `vitest.config.ts` només inclou `*.test.ts` amb entorn `node`),
   * aquell mode de fallada no el cobreix cap prova.
   */
  it('recorregut sencer: s’encén una vegada i s’apaga sola', () => {
    const answers: boolean[] = [];
    for (let t = c2 - 120_000; t <= c3 + 120_000; t += 1000) {
      answers.push(nakedEyeAt(OVIEDO, t));
    }

    // Ha de canviar de valor: si es congelés, seria tot true o tot false.
    expect(new Set(answers).size).toBe(2);

    // Exactament una encesa i exactament una apagada, en aquest ordre.
    const flips = answers.reduce<number[]>((acc, v, i) => {
      if (i > 0 && v !== answers[i - 1]) acc.push(i);
      return acc;
    }, []);
    expect(flips).toHaveLength(2);
    expect(answers[0]).toBe(false);
    expect(answers.at(-1)).toBe(false);

    // I la finestra oberta ha de ser la totalitat menys els dos marges.
    const openSec = answers.filter(Boolean).length;
    const centralSec = (c3 - c2) / 1000;
    expect(openSec).toBeGreaterThan(0);
    expect(openSec).toBeLessThan(centralSec - FILTER_OFF_DELAY_SEC);
  });

  /*
   * EL TERRENY HA D'ENTRAR A LA COMPORTA DE LA CÀMERA, I NO HI ENTRAVA.
   *
   * `canRemoveFilter` mira el terreny només si algú l'hi passa: per omissió
   * val `true`, perquè un `false` silenciaria els avisos a tothom que encara
   * no tingui el perfil calculat. `ARView` construïa l'entrada sense el camp,
   * i el resultat era que en un punt on el veredicte diu 0 s perquè una carena
   * tapa la totalitat sencera, la veu del compte enrere callava —`CountdownView`
   * sí que l'hi passa— i el rètol de la càmera, damunt de la imatge i en
   * imperatiu, seguia dient «ara pots mirar sense filtre».
   *
   * És el mateix patró que ESTAT.md §3.1 documenta per tercera vegada: la capa
   * que té la dada no la passa avall.
   */
  it('si el terreny tapa la totalitat, no —encara que l’hora hi caigui', () => {
    const migTotalitat = (c2 + c3) / 2;
    const entrada = {
      kind: OVIEDO.kind,
      contacts: {
        c1: OVIEDO.contacts.c1?.time.getTime(),
        c2,
        max: OVIEDO.contacts.max.time.getTime(),
        c3,
        c4: OVIEDO.contacts.c4?.time.getTime(),
      },
      edgeUncertain: OVIEDO.edgeUncertain,
    };

    // Horitzó lliure (o encara sense saber-ho): al mig de la totalitat, sí.
    expect(nakedEyeAllowedAt(entrada, migTotalitat)).toBe(true);
    expect(nakedEyeAllowedAt({ ...entrada, centralPhaseVisible: true }, migTotalitat)).toBe(true);

    // Amb el relleu menjant-se la fase central, mai.
    expect(nakedEyeAllowedAt({ ...entrada, centralPhaseVisible: false }, migTotalitat)).toBe(false);
  });

  it('en un eclipsi ANULAR, mai, ni al mig de l’anell', () => {
    // L'anell que queda a la vista és fotosfera. La comporta ho para abans de
    // mirar cap rellotge.
    const a2 = VALENCIA.contacts.c2?.time.getTime();
    const a3 = VALENCIA.contacts.c3?.time.getTime();
    expect(VALENCIA.kind).toBe('annular');
    expect(a2).toBeDefined();
    expect(nakedEyeAt(VALENCIA, (a2! + a3!) / 2)).toBe(false);
  });

  it('al caire de la franja, tampoc', () => {
    // Sierra de Grazalema, 02-08-2027: el motor no pot decidir si hi haurà
    // totalitat, i la durada calculada (69 s) no faria saltar la comporta dels
    // quaranta segons. El que la fa saltar és la incertesa.
    const edge = computeLocalCircumstances('2027-08-02', {
      lat: 36.726,
      lon: -5.5,
      elevation: 100,
    });
    expect(edge.edgeUncertain).toBe(true);
    const e2 = edge.contacts.c2?.time.getTime();
    const e3 = edge.contacts.c3?.time.getTime();
    if (e2 !== undefined && e3 !== undefined) {
      expect(nakedEyeAt(edge, (e2 + e3) / 2)).toBe(false);
    }
  });
});
