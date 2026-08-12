/**
 * Tres coses han de dir el mateix idioma: el TEXT, la VEU i el `lang`.
 *
 * Aquest fitxer és la primera prova que ha tingut mai `speech.ts`, i el motiu
 * és el de sempre en aquest projecte: hi havia una cascada de recanvi d'idioma
 * que ningú no havia comparat mai amb res. Amb quatre idiomes a l'app, deia
 * `locale === 'ca' ? 'es' : 'ca'` — o sigui que a un usuari en anglès o en
 * francès sense veu del seu idioma se li parlava en CATALÀ — i el `lang` de la
 * locució només sabia posar `ca-ES` o `es-ES`, que és el que fa que un motor
 * sense veu assignada tregui una veu castellana per llegir text anglès.
 *
 * L'INVARIANT que es prova aquí, i que val per a qualsevol combinació futura:
 * l'idioma del text que se li dona a la locució, l'idioma de la veu que s'hi
 * assigna i l'etiqueta `lang` han de coincidir SEMPRE. Si es desaparellen, algú
 * sent un idioma llegit amb la fonètica d'un altre, i el dia de l'eclipsi això
 * passa mentre mira el Sol.
 *
 * COM S'HI ARRIBA SENSE NAVEGADOR: `createAnnouncer` llegeix
 * `globalThis.speechSynthesis` i `globalThis.AudioContext` dins del cos de la
 * funció, no al mòdul, i per això `vi.stubGlobal` hi entra. La matriu és de
 * quatre idiomes per cinc inventaris de veus, que són els que es troben de
 * veritat: un iOS amb els quatre idiomes, un Android venut a Espanya amb només
 * `es-ES`, un telèfon només anglès, un només francès i un sense cap veu.
 *
 * LES EXPECTATIVES ESTAN ESCRITES A MÀ, una per una, i no calculades tornant a
 * recórrer la llista de veus. Una taula que es calculés amb la mateixa regla que
 * el codi que prova passaria igual amb la regla equivocada.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnnouncer } from './speech';
import type { LocalisedText, TimerLocale } from '../../core/timer';

/**
 * Text dels quatre idiomes, tots diferents entre ells a propòsit: si dos
 * s'assemblessin, la prova no distingiria quin s'ha triat.
 */
const TEXT: LocalisedText = {
  ca: 'Torna a posar-te el filtre',
  es: 'Vuelve a ponerte el filtro',
  en: 'Put your filter back on',
  fr: 'Remets ton filtre',
};

interface VeuFalsa {
  name: string;
  lang: string;
  localService: boolean;
}

/** Locució tal com ha quedat quan el codi l'ha entregada al motor. */
interface Locucio {
  text: string;
  lang: string;
  veu: string | null;
  veuLang: string | null;
}

/** El que ha passat pel navegador simulat. */
interface Navegador {
  locucions: Locucio[];
  /** Quants oscil·ladors s'han engegat: un per bip. */
  bips: () => number;
}

/**
 * Munta un navegador de mentida amb l'inventari de veus que se li digui.
 * Amb `veus === null` no hi ha ni `speechSynthesis`: el cas del navegador que
 * no en té gens.
 */
function muntaNavegador(veus: readonly VeuFalsa[] | null): Navegador {
  const locucions: Locucio[] = [];
  let oscilladors = 0;

  class LocucioFalsa {
    text: string;
    lang = '';
    voice: VeuFalsa | null = null;
    volume = 1;
    rate = 1;
    pitch = 1;
    constructor(text: string) {
      this.text = text;
    }
  }
  vi.stubGlobal('SpeechSynthesisUtterance', LocucioFalsa);

  if (veus !== null) {
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => veus,
      speak(u: LocucioFalsa) {
        // El primer `speak` de `unlock()` és la locució buida que desbloqueja
        // el motor a iOS. No és un avís i no s'ha de comptar.
        if (u.volume === 0) return;
        locucions.push({
          text: u.text,
          lang: u.lang,
          veu: u.voice?.name ?? null,
          veuLang: u.voice?.lang ?? null,
        });
      },
      cancel: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    });
  }

  // Prou `AudioContext` per als bips: el que compta és quants n'arrenquen.
  vi.stubGlobal(
    'AudioContext',
    class {
      state = 'suspended';
      currentTime = 0;
      destination = {};
      async resume(): Promise<void> {
        this.state = 'running';
      }
      async close(): Promise<void> {}
      createOscillator() {
        oscilladors++;
        const node = {
          type: '',
          frequency: { value: 0 },
          connect: (dest: unknown) => dest,
          start: () => {},
          stop: () => {},
        };
        return node;
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: () => {},
            linearRampToValueAtTime: () => {},
          },
          connect: (dest: unknown) => dest,
        };
      }
    },
  );

  return { locucions, bips: () => oscilladors };
}

const IOS_COMPLET: VeuFalsa[] = [
  { name: 'Núria', lang: 'ca-ES', localService: true },
  { name: 'Mónica', lang: 'es-ES', localService: true },
  { name: 'Samantha', lang: 'en-US', localService: true },
  { name: 'Amélie', lang: 'fr-FR', localService: true },
];
const ANDROID_CASTELLA: VeuFalsa[] = [
  { name: 'es-ES-language', lang: 'es-ES', localService: true },
];
const NOMES_ANGLES: VeuFalsa[] = [{ name: 'Samantha', lang: 'en-US', localService: true }];
const NOMES_FRANCES: VeuFalsa[] = [{ name: 'Amélie', lang: 'fr-FR', localService: true }];

interface Cas {
  inventari: string;
  veus: VeuFalsa[] | null;
  locale: TimerLocale;
  /** Idioma que s'ha de sentir. Val per al text, per a la veu i per al `lang`. */
  parla: TimerLocale;
  /** Etiqueta exacta que ha de dur la locució. */
  lang: string;
  /** Nom de la veu que s'ha de triar, o `null` si el sistema no en té cap. */
  veu: string | null;
}

/** La matriu sencera, escrita a mà: 4 idiomes × 5 inventaris. */
const MATRIU: Cas[] = [
  // (a) iOS amb els quatre idiomes: cadascú sent el seu.
  { inventari: 'iOS complet', veus: IOS_COMPLET, locale: 'ca', parla: 'ca', lang: 'ca-ES', veu: 'Núria' },
  { inventari: 'iOS complet', veus: IOS_COMPLET, locale: 'es', parla: 'es', lang: 'es-ES', veu: 'Mónica' },
  { inventari: 'iOS complet', veus: IOS_COMPLET, locale: 'en', parla: 'en', lang: 'en-US', veu: 'Samantha' },
  { inventari: 'iOS complet', veus: IOS_COMPLET, locale: 'fr', parla: 'fr', lang: 'fr-FR', veu: 'Amélie' },

  // (b) Android venut a Espanya, només `es-ES`: tothom baixa al castellà.
  { inventari: 'Android només amb castellà', veus: ANDROID_CASTELLA, locale: 'ca', parla: 'es', lang: 'es-ES', veu: 'es-ES-language' },
  { inventari: 'Android només amb castellà', veus: ANDROID_CASTELLA, locale: 'es', parla: 'es', lang: 'es-ES', veu: 'es-ES-language' },
  { inventari: 'Android només amb castellà', veus: ANDROID_CASTELLA, locale: 'en', parla: 'es', lang: 'es-ES', veu: 'es-ES-language' },
  { inventari: 'Android només amb castellà', veus: ANDROID_CASTELLA, locale: 'fr', parla: 'es', lang: 'es-ES', veu: 'es-ES-language' },

  // (c) Només anglès: és l'últim graó de la cascada del català i del castellà,
  // i tot i així s'hi ha d'arribar en comptes de quedar-se sense veu.
  { inventari: 'només anglès', veus: NOMES_ANGLES, locale: 'ca', parla: 'en', lang: 'en-US', veu: 'Samantha' },
  { inventari: 'només anglès', veus: NOMES_ANGLES, locale: 'es', parla: 'en', lang: 'en-US', veu: 'Samantha' },
  { inventari: 'només anglès', veus: NOMES_ANGLES, locale: 'en', parla: 'en', lang: 'en-US', veu: 'Samantha' },
  { inventari: 'només anglès', veus: NOMES_ANGLES, locale: 'fr', parla: 'en', lang: 'en-US', veu: 'Samantha' },

  // (d) Només francès.
  { inventari: 'només francès', veus: NOMES_FRANCES, locale: 'ca', parla: 'fr', lang: 'fr-FR', veu: 'Amélie' },
  { inventari: 'només francès', veus: NOMES_FRANCES, locale: 'es', parla: 'fr', lang: 'fr-FR', veu: 'Amélie' },
  { inventari: 'només francès', veus: NOMES_FRANCES, locale: 'en', parla: 'fr', lang: 'fr-FR', veu: 'Amélie' },
  { inventari: 'només francès', veus: NOMES_FRANCES, locale: 'fr', parla: 'fr', lang: 'fr-FR', veu: 'Amélie' },

  // (e) Cap veu instal·lada. Aquí el `lang` és l'única cosa que li diu al motor
  // quina veu per defecte ha de treure: si s'equivoca, es llegeix el text d'un
  // idioma amb la fonètica d'un altre i no hi ha res que ho aturi.
  { inventari: 'cap veu', veus: [], locale: 'ca', parla: 'ca', lang: 'ca-ES', veu: null },
  { inventari: 'cap veu', veus: [], locale: 'es', parla: 'es', lang: 'es-ES', veu: null },
  { inventari: 'cap veu', veus: [], locale: 'en', parla: 'en', lang: 'en-US', veu: null },
  { inventari: 'cap veu', veus: [], locale: 'fr', parla: 'fr', lang: 'fr-FR', veu: null },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Deixa dita una frase informativa i torna com ha quedat la locució. */
async function diuUnAvis(cas: Cas): Promise<{ locucio: Locucio; parlat: TimerLocale }> {
  const navegador = muntaNavegador(cas.veus);
  const anunciador = createAnnouncer({ locale: cas.locale });
  await anunciador.unlock();
  anunciador.announce(TEXT, 'info');
  const parlat = anunciador.spokenLocale();
  anunciador.dispose();
  expect(navegador.locucions).toHaveLength(1);
  return { locucio: navegador.locucions[0], parlat };
}

describe('la veu del compte enrere parla un sol idioma alhora', () => {
  it('la matriu cobreix els quatre idiomes per cadascun dels cinc inventaris', () => {
    // Sense això, esborrar mitja taula deixaria la resta de proves en verd.
    expect(MATRIU).toHaveLength(20);
    for (const locale of ['ca', 'es', 'en', 'fr'] as const) {
      expect(MATRIU.filter((c) => c.locale === locale)).toHaveLength(5);
    }
  });

  for (const cas of MATRIU) {
    it(`amb un telèfon «${cas.inventari}», a qui llegeix en «${cas.locale}» se li parla en «${cas.parla}»`, async () => {
      const { locucio, parlat } = await diuUnAvis(cas);

      // 1) El text: el de l'idioma que de veritat es parlarà, no el demanat.
      expect(locucio.text).toBe(TEXT[cas.parla]);
      // 2) La veu.
      expect(locucio.veu).toBe(cas.veu);
      // 3) L'etiqueta de la locució.
      expect(locucio.lang).toBe(cas.lang);
      // I les tres coses han de coincidir també amb el que l'app ensenya.
      expect(parlat).toBe(cas.parla);
      if (locucio.veuLang !== null) {
        expect(locucio.veuLang.toLowerCase().startsWith(cas.parla)).toBe(true);
        expect(locucio.lang).toBe(locucio.veuLang);
      }
    });
  }

  it('a qui llegeix en francès amb un telèfon que només té català i castellà, no se li parla en català', async () => {
    // La regressió amb nom propi. Amb la cascada vella, `locale === 'ca' ? 'es'
    // : 'ca'` feia que qualsevol idioma que no fos el català caigués al català:
    // un francès sentia «Torna a posar-te el filtre» amb veu catalana.
    const { locucio, parlat } = await diuUnAvis({
      inventari: 'català i castellà',
      veus: [IOS_COMPLET[0], IOS_COMPLET[1]],
      locale: 'fr',
      parla: 'es',
      lang: 'es-ES',
      veu: 'Mónica',
    });

    expect(parlat).toBe('es');
    expect(locucio.text).toBe(TEXT.es);
    expect(locucio.text).not.toBe(TEXT.ca);
    expect(locucio.veu).toBe('Mónica');
    expect(locucio.lang).toBe('es-ES');
  });

  it('amb una veu britànica, la locució no diu que parla americà', async () => {
    // Aquesta és l'única prova que distingeix «el `lang` surt de la veu» de «el
    // `lang` surt d'una taula d'idiomes»: hi ha motors que tracten `en-GB` i
    // `en-US` com a coses diferents i deixen caure la veu si el `lang` no hi va.
    const { locucio } = await diuUnAvis({
      inventari: 'només anglès britànic',
      veus: [{ name: 'Daniel', lang: 'en-GB', localService: true }],
      locale: 'en',
      parla: 'en',
      lang: 'en-GB',
      veu: 'Daniel',
    });

    expect(locucio.lang).toBe('en-GB');
  });

  it('canviar d’idioma al selector canvia el text, la veu i el lang alhora', async () => {
    // `setLocale` torna a triar veu: si no ho fes, es quedaria dient el text
    // vell amb la veu vella i ningú no ho veuria fins a l'eclipsi.
    const navegador = muntaNavegador(IOS_COMPLET);
    const anunciador = createAnnouncer({ locale: 'ca' });
    await anunciador.unlock();

    anunciador.announce(TEXT, 'info');
    anunciador.setLocale('fr');
    anunciador.announce(TEXT, 'info');
    anunciador.dispose();

    expect(navegador.locucions).toHaveLength(2);
    expect(navegador.locucions[0]).toMatchObject({
      text: TEXT.ca,
      lang: 'ca-ES',
      veu: 'Núria',
    });
    expect(navegador.locucions[1]).toMatchObject({
      text: TEXT.fr,
      lang: 'fr-FR',
      veu: 'Amélie',
    });
  });
});

describe('el to de seguretat no depèn de la veu', () => {
  it('un avís de seguretat fa els tres bips encara que no hi hagi cap veu instal·lada', async () => {
    // La capçalera de `speech.ts` promet que el to NO és un recurs de segona.
    // Ningú no ho vigilava.
    vi.useFakeTimers();
    const navegador = muntaNavegador([]);
    const anunciador = createAnnouncer({ locale: 'ca' });
    await anunciador.unlock();

    expect(anunciador.status()).toBe('tone-only');
    anunciador.announce(TEXT, 'safety');
    expect(navegador.bips()).toBe(3);

    // I la frase espera que el to s'acabi abans de començar, que és l'altra
    // meitat de la decisió: si surten alhora, la primera paraula queda tapada.
    expect(navegador.locucions).toHaveLength(0);
    vi.advanceTimersByTime(700);
    expect(navegador.locucions[0]).toMatchObject({ text: TEXT.ca, lang: 'ca-ES', veu: null });

    anunciador.dispose();
  });

  it('un avís de seguretat fa els tres bips en un navegador sense cap motor de veu', async () => {
    const navegador = muntaNavegador(null);
    const anunciador = createAnnouncer({ locale: 'en' });
    await anunciador.unlock();

    anunciador.announce(TEXT, 'safety');
    expect(navegador.bips()).toBe(3);
    // I un d'informatiu, un de sol: si no, els tres bips no voldrien dir res.
    anunciador.announce(TEXT, 'info');
    expect(navegador.bips()).toBe(4);

    anunciador.dispose();
  });
});
