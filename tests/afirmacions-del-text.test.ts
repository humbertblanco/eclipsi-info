/**
 * EL TEXT CONTRA EL MOTOR. La peça que faltava.
 *
 * PER QUÈ EXISTEIX AQUEST FITXER. El 3 d'agost de 2026 es va descobrir que
 * `catalog.ts` deia del 2026 «Franja de NO a SE: Galícia, Astúries, Lleó,
 * Burgos, Sòria, Saragossa, Peníscola i Balears» mentre el nostre propi motor
 * dona a València 62 SEGONS de totalitat amb un marge umbral de −6,5″ — ben
 * endins de la franja, no al caire. La ciutat més poblada que la franja
 * travessa no sortia a la frase que algú de València llegeix per decidir si es
 * mou. I la mateixa frase deia «Galícia» sencera quan el motor en deixa fora
 * Vigo (99,40 %), Pontevedra (99,62 %) i Ourense (99,89 %).
 *
 * Cap test va fallar perquè no n'hi havia cap: el projecte prova el motor
 * contra l'IGN i contra la NASA amb daurats de desenes de municipis, i el text
 * —que és el que la gent llegeix— no el comparava ningú amb res. Aquest fitxer
 * tanca aquell forat. Torna a calcular amb el motor TOTES les afirmacions
 * numèriques i geogràfiques del contingut i comprova que el text encara les
 * digui bé.
 *
 * COM S'ACTUALITZA QUAN ES POSA VERMELL. La regla del projecte és explícita
 * (`src/content/guide.ts`, entrada [MOTOR]): guanya el motor. Si aquest fitxer
 * es posa vermell perquè el motor ha canviat, el que s'edita és el TEXT, i s'hi
 * escriu al costat d'on surt la xifra nova. Retocar la tolerància perquè torni
 * a passar és desfer exactament la feina que aquest test fa.
 *
 * LES TOLERÀNCIES NO SÓN GENEROSES PER COMODITAT. Són el gruix del text: quan
 * la guia diu «uns 12°» no es pot exigir 12,03; quan diu «62 segons», sí que
 * es pot exigir 62 ± 3. Cada tolerància va amb el motiu escrit.
 *
 * NO IMPORTA `core/eclipses/path.ts`, I ÉS A POSTA. Els límits de la franja i
 * la línia central són l'altre motor —elements besselians, ΔT pròpia— i tenen
 * el seu daurat contra les taules de la NASA. Aquí, fins i tot els punts que
 * surten de la línia central (la costa asturiana per on entra al 2026, el punt
 * de màxima durada d'Egipte al 2027) hi entren com a COORDENADES FIXES i es
 * tornen a resoldre amb `computeLocalCircumstances`. Així, si algú toca el
 * traçat de la franja, aquest test no es posa vermell per una cosa que no
 * mira; i si el motor de punts es mou, sí.
 *
 * Cap dependència del DOM: entorn node, com tota la resta.
 */

import { describe, it, expect } from 'vitest';

import { computeLocalCircumstances } from '../src/core/astro/contacts';
import { ECLIPSES, getEclipse } from '../src/core/eclipses/catalog';
import { getGuide, getEclipseHighlight } from '../src/content/guide';
import type { GuideBlock } from '../src/content/guide';
import type { Locale } from '../src/i18n';
import {
  clearSkyIlluminanceLux,
  eclipseIlluminance,
  luminousFractionFromObscuration,
} from '../src/core/sky';

/* --------------------------------------------------------------- bastida */

interface Place {
  ca: string;
  es: string;
  lat: number;
  lon: number;
  elevation: number;
}

/**
 * Els llocs que el text anomena. Les coordenades són del centre urbà i
 * l'altitud, del model de terreny — no del GPS (vegeu `GeoLocation`).
 *
 * NO SÓN UNA TAULA DE RESULTATS: aquí no hi ha ni un segon ni un grau escrit.
 * Tot el que es compara amb el text es calcula a cada execució.
 */
const PLACES = {
  coruna: { ca: 'A Coruña', es: 'A Coruña', lat: 43.3623, lon: -8.4115, elevation: 20 },
  malpica: { ca: 'Malpica', es: 'Malpica', lat: 43.323, lon: -8.806, elevation: 20 },
  oviedo: { ca: 'Oviedo', es: 'Oviedo', lat: 43.3619, lon: -5.8494, elevation: 232 },
  gijon: { ca: 'Gijón', es: 'Gijón', lat: 43.5322, lon: -5.6611, elevation: 20 },
  santander: { ca: 'Santander', es: 'Santander', lat: 43.4623, lon: -3.81, elevation: 15 },
  lleo: { ca: 'Lleó', es: 'León', lat: 42.5987, lon: -5.5671, elevation: 837 },
  burgos: { ca: 'Burgos', es: 'Burgos', lat: 42.3439, lon: -3.6969, elevation: 860 },
  valladolid: { ca: 'Valladolid', es: 'Valladolid', lat: 41.6523, lon: -4.7245, elevation: 698 },
  logronyo: { ca: 'Logronyo', es: 'Logroño', lat: 42.465, lon: -2.4456, elevation: 384 },
  vitoria: { ca: 'Vitòria', es: 'Vitoria', lat: 42.8467, lon: -2.6716, elevation: 525 },
  soria: { ca: 'Sòria', es: 'Soria', lat: 41.7665, lon: -2.479, elevation: 1063 },
  saragossa: { ca: 'Saragossa', es: 'Zaragoza', lat: 41.6488, lon: -0.8891, elevation: 208 },
  tarragona: { ca: 'Tarragona', es: 'Tarragona', lat: 41.1189, lon: 1.2445, elevation: 68 },
  castello: { ca: 'Castelló', es: 'Castellón', lat: 39.9864, lon: -0.0513, elevation: 27 },
  valencia: { ca: 'València', es: 'Valencia', lat: 39.4699, lon: -0.3763, elevation: 15 },
  palma: { ca: 'Palma', es: 'Palma', lat: 39.5696, lon: 2.6502, elevation: 13 },
  mao: { ca: 'Maó', es: 'Mahón', lat: 39.8885, lon: 4.2658, elevation: 45 },
  eivissa: { ca: 'Eivissa', es: 'Ibiza', lat: 38.9089, lon: 1.4328, elevation: 10 },
  illaAire: { ca: 'Illa de l’Aire', es: 'Isla del Aire', lat: 39.8003, lon: 4.2947, elevation: 5 },
  barcelona: { ca: 'Barcelona', es: 'Barcelona', lat: 41.3874, lon: 2.1686, elevation: 12 },
  madrid: { ca: 'Madrid', es: 'Madrid', lat: 40.4168, lon: -3.7038, elevation: 667 },
  santiago: {
    ca: 'Santiago',
    es: 'Santiago',
    lat: 42.8782,
    lon: -8.5448,
    elevation: 260,
  },
  pamplona: { ca: 'Pamplona', es: 'Pamplona', lat: 42.8125, lon: -1.6458, elevation: 449 },
  vigo: { ca: 'Vigo', es: 'Vigo', lat: 42.2406, lon: -8.7207, elevation: 20 },
  girona: { ca: 'Girona', es: 'Girona', lat: 41.9794, lon: 2.8214, elevation: 70 },
  huelva: { ca: 'Huelva', es: 'Huelva', lat: 37.2614, lon: -6.9447, elevation: 54 },
  ayamonte: { ca: 'Ayamonte', es: 'Ayamonte', lat: 37.21, lon: -7.405, elevation: 15 },
  sevilla: { ca: 'Sevilla', es: 'Sevilla', lat: 37.3891, lon: -5.9845, elevation: 7 },
  cadis: { ca: 'Cadis', es: 'Cádiz', lat: 36.5297, lon: -6.2927, elevation: 11 },
  cordova: { ca: 'Còrdova', es: 'Córdoba', lat: 37.8882, lon: -4.7794, elevation: 106 },
  jaen: { ca: 'Jaén', es: 'Jaén', lat: 37.7796, lon: -3.7849, elevation: 573 },
  granada: { ca: 'Granada', es: 'Granada', lat: 37.1773, lon: -3.5986, elevation: 738 },
  malaga: { ca: 'Màlaga', es: 'Málaga', lat: 36.7213, lon: -4.4214, elevation: 11 },
  albacete: { ca: 'Albacete', es: 'Albacete', lat: 38.9943, lon: -1.8585, elevation: 686 },
  murcia: { ca: 'Múrcia', es: 'Murcia', lat: 37.9922, lon: -1.1307, elevation: 43 },
  alacant: { ca: 'Alacant', es: 'Alicante', lat: 38.3452, lon: -0.481, elevation: 3 },
  almeria: { ca: 'Almeria', es: 'Almería', lat: 36.834, lon: -2.4637, elevation: 25 },
  tarifa: { ca: 'Tarifa', es: 'Tarifa', lat: 36.0143, lon: -5.6044, elevation: 20 },
  ceuta: { ca: 'Ceuta', es: 'Ceuta', lat: 35.8894, lon: -5.3213, elevation: 30 },
  melilla: { ca: 'Melilla', es: 'Melilla', lat: 35.2923, lon: -2.9381, elevation: 47 },
} satisfies Record<string, Place>;

type PlaceKey = keyof typeof PLACES;

const circ = (eclipseId: string, key: PlaceKey) =>
  computeLocalCircumstances(eclipseId, {
    lat: PLACES[key].lat,
    lon: PLACES[key].lon,
    elevation: PLACES[key].elevation,
  });

/** Segons de fase central que el motor dona en aquell punt. */
const central = (eclipseId: string, key: PlaceKey) => circ(eclipseId, key).centralDurationSec;

/** Altura APARENT del Sol al màxim. És la que es compara amb l'horitzó. */
const sunAlt = (eclipseId: string, key: PlaceKey) =>
  circ(eclipseId, key).contacts.max.sun.altitudeApparent;

/**
 * Tot el text visible d'una guia, aplanat, per poder-hi buscar frases.
 * Hi entren títols, entradetes, paràgrafs, llistes, definicions, avisos i
 * taules: si una xifra és a la pantalla, és en aquesta cadena.
 */
function guideText(locale: Locale, eclipseId?: string): string {
  const parts: string[] = [];
  const push = (b: GuideBlock) => {
    switch (b.kind) {
      case 'p':
        parts.push(b.text);
        break;
      case 'list':
        parts.push(...b.items);
        break;
      case 'defs':
        parts.push(...b.items.map((i) => `${i.term} ${i.text}`));
        break;
      case 'callout':
        parts.push(b.title, b.text);
        break;
      case 'table':
        parts.push(...b.head, ...b.rows.flat(), b.caption ?? '');
        break;
    }
  };
  for (const section of getGuide(locale, eclipseId)) {
    parts.push(section.title, section.lead);
    section.blocks.forEach(push);
  }
  return parts.join('\n');
}

const spainText = (eclipseId: string, locale: Locale) => getEclipse(eclipseId).spain[locale];

const LOCALES: Locale[] = ['ca', 'es'];

/* ================================================================== */
/* 1. LA LLISTA DE LLOCS DE LA FRANJA                                  */
/* ================================================================== */

/**
 * Els llocs que cada entrada del catàleg AFIRMA que són dins de la franja, i
 * els que afirma que en queden fora. Cada nom d'aquesta taula ha de sortir
 * literalment al camp `spain` en els dos idiomes, i el motor l'ha de confirmar.
 */
const BAND_CLAIMS: Record<string, { inside: PlaceKey[]; outside: PlaceKey[] }> = {
  '2026-08-12': {
    inside: [
      'coruna',
      'oviedo',
      'gijon',
      'santander',
      'lleo',
      'burgos',
      'valladolid',
      'logronyo',
      'vitoria',
      'soria',
      'saragossa',
      'tarragona',
      'castello',
      'valencia',
    ],
    // Madrid NO hi és: el motor no el pot situar (marge +1,85″, `edgeUncertain`).
    // Té clàusula pròpia al catàleg i prova pròpia més avall.
    outside: ['barcelona', 'pamplona', 'vigo'],
  },
  '2027-08-02': {
    inside: ['cadis', 'malaga', 'ceuta', 'melilla'],
    outside: [],
  },
  '2028-01-26': {
    inside: [
      'huelva',
      'sevilla',
      'cadis',
      'cordova',
      'jaen',
      'granada',
      'malaga',
      'albacete',
      'murcia',
      'alacant',
      'valencia',
      'castello',
      'tarragona',
      'barcelona',
    ],
    outside: ['madrid', 'saragossa', 'almeria'],
  },
};

describe('la llista de llocs del catàleg', () => {
  for (const [eclipseId, claim] of Object.entries(BAND_CLAIMS)) {
    describe(eclipseId, () => {
      for (const key of claim.inside) {
        it(`${PLACES[key].ca} surt escrit i el motor li dona fase central`, () => {
          for (const locale of LOCALES) {
            expect(spainText(eclipseId, locale)).toContain(PLACES[key][locale]);
          }
          const c = circ(eclipseId, key);
          expect(c.centralDurationSec).toBeGreaterThan(0);
          // I no al caire: publicar un lloc amb `edgeUncertain` és vendre una
          // moneda a l'aire com si fos una predicció. Per això Bilbao (23 s,
          // marge −0,8″), Lleida (20 s, −0,6″) i Zamora (30 s, −1,3″) NO són
          // a la llista encara que el motor els doni totalitat.
          expect(c.edgeUncertain).toBe(false);
        });
      }

      for (const key of claim.outside) {
        it(`${PLACES[key].ca} surt escrit com a fora, i el motor ho confirma`, () => {
          for (const locale of LOCALES) {
            expect(spainText(eclipseId, locale)).toContain(PLACES[key][locale]);
          }
          const c = circ(eclipseId, key);
          expect(c.centralDurationSec).toBe(0);
          /*
           * I EL MOTOR HO HA DE PODER DECIDIR, exactament com s'exigeix a la
           * llista de DINS unes línies més amunt.
           *
           * AQUESTA LÍNIA NO HI ERA, i l'asimetria era la trampa: la prova
           * exigia `edgeUncertain === false` per entrar a la llista de dins i
           * no demanava res per entrar a la de fora. Amb això, el catàleg
           * afirmava «Madrid en queda fora» quan el motor li dona marge
           * +1,85″ i `edgeUncertain: true` —o sigui que NO ho sap—, i el
           * producte es contradeia a si mateix: un madrileny llegia «queda
           * fora» amb lletra impresa i, tocant el mapa al seu punt, la
           * mateixa app li deia «just al caire, ves-hi amb marge».
           *
           * Un lloc que el càlcul no pot situar no va a cap de les dues
           * llistes: va a la clàusula que diu que no se sap.
           */
          expect(c.edgeUncertain).toBe(false);
        });
      }
    });
  }

  it('les Balears hi són senceres el 2026 i el 2028, perquè el motor les hi posa', () => {
    for (const eclipseId of ['2026-08-12', '2028-01-26']) {
      for (const key of ['palma', 'mao', 'eivissa'] as PlaceKey[]) {
        expect(central(eclipseId, key)).toBeGreaterThan(0);
      }
      expect(spainText(eclipseId, 'ca')).toContain('Balears');
      expect(spainText(eclipseId, 'es')).toContain('Baleares');
    }
  });

  /**
   * LA REGRESSIÓ QUE VA OBRIR TOT AIXÒ. Si algun dia València torna a
   * desaparèixer d'aquesta frase mentre el motor li dona fase central, aquest
   * test ho diu abans que ho digui un valencià que s'ha quedat a casa.
   */
  /**
   * Els llocs que el càlcul NO pot situar no van a cap de les dues llistes.
   *
   * Madrid i Santiago tenen marges de +1,85″ i +1,67″ amb `edgeUncertain`:
   * afirmar-ne res, ni dins ni fora, és vendre una moneda a l'aire com si fos
   * una predicció. El catàleg els dona una clàusula pròpia i aquesta prova
   * vigila que hi segueixin: si algun dia el motor els decideix, això es
   * posarà vermell i algú haurà de moure'ls a la llista que toqui.
   */
  it('Madrid i Santiago es queden a la ratlla, i el text ho diu', () => {
    for (const key of ['madrid', 'santiago'] as const) {
      const c = circ('2026-08-12', key);
      expect(c.edgeUncertain, `${key} ja no és al caire`).toBe(true);
    }
    expect(spainText('2026-08-12', 'ca')).toContain('a la ratlla mateixa');
    expect(spainText('2026-08-12', 'es')).toContain('en la raya misma');
    // I no poden sortir a cap de les dues enumeracions.
    for (const claim of [BAND_CLAIMS['2026-08-12'].inside, BAND_CLAIMS['2026-08-12'].outside]) {
      expect(claim).not.toContain('madrid');
      expect(claim).not.toContain('santiago');
    }
  });

  it('València no pot tornar a caure de la llista del 2026', () => {
    const c = circ('2026-08-12', 'valencia');
    expect(c.kind).toBe('total');
    expect(c.centralDurationSec).toBeGreaterThan(45);
    expect(c.edgeUncertain).toBe(false);
    expect(spainText('2026-08-12', 'ca')).toContain('València');
    expect(spainText('2026-08-12', 'es')).toContain('Valencia');
  });

  /**
   * I la cara complementària: mentre el motor deixi Vigo fora, la frase no pot
   * tornar a dir «Galícia» com si la comunitat hi fos sencera.
   */
  it('cap etiqueta de comunitat sencera on el motor només agafa un tros', () => {
    expect(central('2026-08-12', 'vigo')).toBe(0);
    expect(spainText('2026-08-12', 'ca')).not.toContain('Galícia');
    expect(spainText('2026-08-12', 'es')).not.toContain('Galicia');
  });
});

/* ================================================================== */
/* 2. ELS RANGS D'ALTURA DEL SOL                                       */
/* ================================================================== */

describe('els rangs d’altura del Sol a la fase central', () => {
  it('el 2026 va de 12° a menys de 2°, i el text ho diu així', () => {
    // Extrems mesurats sobre la franja: Malpica i la Corunya per dalt, Maó i
    // l'Illa de l'Aire per baix. Tolerància 0,3°: el text escriu graus enters.
    expect(sunAlt('2026-08-12', 'malpica')).toBeGreaterThan(12);
    expect(sunAlt('2026-08-12', 'coruna')).toBeCloseTo(12, 0);
    expect(sunAlt('2026-08-12', 'mao')).toBeGreaterThan(1);
    expect(sunAlt('2026-08-12', 'mao')).toBeLessThan(2);
    expect(sunAlt('2026-08-12', 'illaAire')).toBeLessThan(2);

    // La frase de catàleg i les dues de la guia han de dir el mateix rang.
    expect(spainText('2026-08-12', 'ca')).toContain('de 12° a menys de 2°');
    expect(spainText('2026-08-12', 'es')).toContain('de 12° a menos de 2°');
    expect(guideText('ca', '2026-08-12')).toContain('de 12° a menys de 2°');
    expect(guideText('es', '2026-08-12')).toContain('de 12° a menos de 2°');
    expect(getEclipseHighlight('2026-08-12', 'ca')?.text).toContain('de 12° a menys de 2°');
    expect(getEclipseHighlight('2026-08-12', 'es')?.text).toContain('de 12° a menos de 2°');
  });

  it('el 2026 el mínim NO arrodoneix a 1°, que és el que deia abans', () => {
    // El text va dir «poc més d'1°» durant mesos. El mínim sobre terra
    // habitada és 1,7-1,8°, que s'escriu «menys de 2°», no «poc més d'1°».
    expect(sunAlt('2026-08-12', 'illaAire')).toBeGreaterThan(1.5);
    for (const locale of LOCALES) {
      expect(guideText(locale, '2026-08-12')).not.toContain('poc més d’1°');
      expect(guideText(locale, '2026-08-12')).not.toContain('poco más de 1°');
    }
  });

  it('el 2028 arrenca a uns 8°, no a 7°', () => {
    expect(sunAlt('2028-01-26', 'ayamonte')).toBeGreaterThan(8);
    expect(sunAlt('2028-01-26', 'huelva')).toBeGreaterThan(7.9);
    expect(sunAlt('2028-01-26', 'sevilla')).toBeCloseTo(7.3, 1);
    expect(spainText('2028-01-26', 'ca')).toContain('8°');
    expect(spainText('2028-01-26', 'es')).toContain('8°');
  });

  it('el 2028 acaba amb el Sol POST al nord-est, i el text ho diu', () => {
    // Aquest era l'error gros del 2028: la guia deia «amb prou feines 2°» quan
    // a Barcelona el Sol és a 0,2° al màxim i es pon abans de C3, i a Girona i
    // a Maó ja s'ha post quan comença l'anularitat.
    const bcn = circ('2028-01-26', 'barcelona');
    expect(bcn.contacts.max.sun.altitudeApparent).toBeLessThan(0.5);
    expect(bcn.contacts.max.sun.altitudeApparent).toBeGreaterThan(0);
    expect(bcn.contacts.c3?.sun.altitudeApparent).toBeLessThan(0);
    expect(bcn.centralDurationSec).toBeGreaterThan(0);

    expect(sunAlt('2028-01-26', 'girona')).toBeLessThan(0);
    expect(sunAlt('2028-01-26', 'mao')).toBeLessThan(0);
    expect(circ('2028-01-26', 'palma').contacts.c3?.sun.altitudeApparent).toBeLessThan(0.1);

    for (const locale of LOCALES) {
      const highlight = getEclipseHighlight('2028-01-26', locale)?.text ?? '';
      expect(highlight).not.toContain('apenas 2°');
      expect(highlight).not.toContain('amb prou feines 2°');
      expect(highlight).toContain('8°');
    }
    expect(spainText('2028-01-26', 'ca')).toContain('ran d’horitzó');
    expect(spainText('2028-01-26', 'es')).toContain('ras del horizonte');
  });

  it('el 2027 és l’únic amb el Sol alt', () => {
    for (const key of ['cadis', 'tarifa', 'ceuta', 'melilla', 'malaga'] as PlaceKey[]) {
      expect(sunAlt('2027-08-02', key)).toBeGreaterThan(35);
    }
    expect(getEclipse('2027-08-02').lowSunOverSpain).toBe(false);
    expect(getEclipse('2026-08-12').lowSunOverSpain).toBe(true);
    expect(getEclipse('2028-01-26').lowSunOverSpain).toBe(true);
  });
});

/* ================================================================== */
/* 3. LES DURADES                                                      */
/* ================================================================== */

/**
 * Punt de la línia central del 2026 just on entra a terra per la costa
 * asturiana. És el màxim de durada que Espanya arriba a tenir: cap a
 * l'oceà creix, però allà no s'hi pot plantar ningú.
 */
const ASTURIES_CENTRAL = { lat: 43.607, lon: -6.596, elevation: 0 };

describe('les durades de la fase central', () => {
  it('el màxim del 2026 sobre terra espanyola és 1 min 50 s, no dos minuts', () => {
    const best = computeLocalCircumstances('2026-08-12', ASTURIES_CENTRAL).centralDurationSec;
    // ±3 s: el text escriu «1 min 50 s» i el motor en dona 110,1.
    expect(best).toBeGreaterThan(107);
    expect(best).toBeLessThan(113);
    // Cap ciutat provada no el pot superar: si això falla, el «màxim» ja no
    // és el màxim i la frase de la guia ha canviat de sentit.
    for (const key of Object.keys(PLACES) as PlaceKey[]) {
      expect(central('2026-08-12', key)).toBeLessThanOrEqual(best);
    }
    for (const locale of LOCALES) {
      expect(guideText(locale, '2026-08-12')).toContain('1 min 50 s');
    }
  });

  it('el 2026, moltes ciutats de la franja no arriben ni al minut i quart', () => {
    // La frase antiga («entre un minut i mig i dos minuts») era falsa sobretot
    // per aquí sota: aquests quatre llocs són ben endins de la franja.
    expect(central('2026-08-12', 'valencia')).toBeCloseTo(62, -0.5);
    expect(central('2026-08-12', 'mao')).toBeCloseTo(68, -0.5);
    expect(central('2026-08-12', 'tarragona')).toBeCloseTo(58, -0.5);
    expect(central('2026-08-12', 'santander')).toBeCloseTo(60, -0.5);
    for (const locale of LOCALES) {
      const text = guideText(locale, '2026-08-12');
      expect(text).toContain('62');
      expect(text).not.toContain('entre un minut i mig i dos minuts');
      expect(text).not.toContain('entre un minuto y medio y dos minutos');
    }
  });

  it('el 2027 dona uns 4 min i mig a l’Estret, com diu el catàleg', () => {
    const tarifa = central('2027-08-02', 'tarifa');
    expect(tarifa).toBeGreaterThan(265); // 4 min 25 s
    expect(tarifa).toBeLessThan(290); // 4 min 50 s
    expect(central('2027-08-02', 'ceuta')).toBeGreaterThan(270);
    expect(spainText('2027-08-02', 'ca')).toContain('4 min i mig');
    expect(spainText('2027-08-02', 'es')).toContain('4 min y medio');
  });

  it('el màxim global del 2027 és de 6 min 23 s i cau a Egipte', () => {
    // El punt és el de màxima durada de la línia central, trobat escombrant-la
    // amb `centralLineAt`: 26,83 N / 31,11 E, vall del Nil.
    const egipte = computeLocalCircumstances('2027-08-02', {
      lat: 26.831,
      lon: 31.108,
      elevation: 0,
    }).centralDurationSec;
    expect(egipte).toBeGreaterThan(382);
    expect(egipte).toBeLessThan(384);
    expect(Math.round(egipte)).toBe(6 * 60 + 23);
    expect(spainText('2027-08-02', 'ca')).toContain('6 min 23 s');
    expect(spainText('2027-08-02', 'es')).toContain('6 min 23 s');
    // I que segueixi doblant el 2026, que és el que la frase promet.
    expect(egipte).toBeGreaterThan(2 * central('2026-08-12', 'oviedo'));
  });

  it('l’anular del 2028 dura minuts sencers, com diu el consell', () => {
    // El tip diu «l'anell aguanta minuts sencers». Que segueixi sent cert.
    for (const key of ['sevilla', 'valencia', 'barcelona', 'albacete'] as PlaceKey[]) {
      expect(central('2028-01-26', key)).toBeGreaterThan(240);
    }
  });
});

/* ================================================================== */
/* 4. ELS CONTACTES                                                    */
/* ================================================================== */

const minutesBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;

describe('els buits entre contactes', () => {
  it('C1→C2 va de cinquanta-cinc minuts (2026) a una hora i quart llarga (2028)', () => {
    const gap = (eclipseId: string, key: PlaceKey) => {
      const c = circ(eclipseId, key).contacts;
      return minutesBetween(c.c1!.time, c.c2!.time);
    };
    expect(gap('2026-08-12', 'coruna')).toBeGreaterThan(54);
    expect(gap('2026-08-12', 'coruna')).toBeLessThan(59);
    expect(gap('2026-08-12', 'palma')).toBeLessThan(55);
    expect(gap('2027-08-02', 'cadis')).toBeCloseTo(65, -0.5);
    expect(gap('2028-01-26', 'sevilla')).toBeGreaterThan(75);

    for (const locale of LOCALES) {
      const text = guideText(locale, '2026-08-12');
      expect(text).not.toContain('entorn d’una hora i quart');
      expect(text).not.toContain('alrededor de una hora y cuarto');
    }
  });

  it('el 2026 i el 2028 el Sol es pon abans de C4 a gairebé tota la franja', () => {
    // La definició de C4 prometia «una altra hora llarga després de C3» i no
    // deia que la majoria de la gent no el veurà mai.
    const altAtC4 = (eclipseId: string, key: PlaceKey) =>
      circ(eclipseId, key).contacts.c4!.sun.altitudeApparent;

    expect(altAtC4('2026-08-12', 'valencia')).toBeLessThan(-3);
    expect(altAtC4('2026-08-12', 'palma')).toBeLessThan(-5);
    expect(altAtC4('2026-08-12', 'burgos')).toBeLessThan(0);
    expect(altAtC4('2028-01-26', 'barcelona')).toBeLessThan(-11);
    expect(altAtC4('2028-01-26', 'sevilla')).toBeLessThan(-4);
    // El 2027 sí que s'hi arriba, i ben alt: per això és el fàcil dels tres.
    expect(altAtC4('2027-08-02', 'cadis')).toBeGreaterThan(45);

    for (const locale of LOCALES) {
      const text = guideText(locale, '2026-08-12');
      expect(text).not.toContain('Una altra hora llarga després de C3.');
      expect(text).not.toContain('Otra hora larga después de C3.');
    }
  });

  it('el 2027 passa al matí i el 2026 i el 2028 al capvespre', () => {
    const localHour = (eclipseId: string, key: PlaceKey) =>
      Number(
        new Intl.DateTimeFormat('ca-ES', {
          timeZone: 'Europe/Madrid',
          hour: '2-digit',
          hour12: false,
        }).format(circ(eclipseId, key).contacts.max.time),
      );
    expect(localHour('2027-08-02', 'cadis')).toBeLessThan(12);
    expect(localHour('2026-08-12', 'burgos')).toBeGreaterThan(18);
    expect(localHour('2028-01-26', 'sevilla')).toBeGreaterThan(16);
    // El consell del repel·lent de mosquits diu que el 2027 és de matí.
    expect(guideText('ca')).toContain('El 2027 també és a l’agost però passa al matí');
  });
});

/* ================================================================== */
/* 5. LA LLUM                                                          */
/* ================================================================== */

describe('les xifres de llum del model del projecte', () => {
  const lux = (obscuration: number, altDeg: number) =>
    eclipseIlluminance(luminousFractionFromObscuration(obscuration), altDeg).totalLux;

  it('el cel serè a 12° dona uns 17.000 lux', () => {
    const clear = clearSkyIlluminanceLux(12);
    expect(clear).toBeGreaterThan(16_000);
    expect(clear).toBeLessThan(17_500);
    for (const locale of LOCALES) {
      expect(guideText(locale)).toContain('17 000');
    }
  });

  it('amb el Sol a 12°, el 90% deixa uns 1.200 lux i el 99%, un centenar', () => {
    expect(lux(0.9, 12)).toBeCloseTo(1240, -2);
    expect(lux(0.99, 12)).toBeCloseTo(99.5, 0);
    for (const locale of LOCALES) {
      expect(guideText(locale)).toContain('1 200');
    }
  });

  it('amb el Sol alt, el 99% dona 570 lux i la totalitat, 7', () => {
    expect(lux(0.99, 60)).toBeCloseTo(571, -1);
    expect(lux(1, 60)).toBeCloseTo(7.1, 0);
    expect(clearSkyIlluminanceLux(60)).toBeCloseTo(97_330, -3);
  });

  it('del 99% a la totalitat la caiguda és de 40 a 80 vegades, no de 50 a 100', () => {
    // Aquesta era l'errada: el cas espanyol (Sol baix) queda per SOTA del 50
    // que el text donava com a mínim.
    const factor = (alt: number) => lux(0.99, alt) / lux(1, alt);
    expect(factor(60)).toBeGreaterThan(75);
    expect(factor(60)).toBeLessThan(85);
    expect(factor(12)).toBeGreaterThan(40);
    expect(factor(12)).toBeLessThan(50);
    expect(factor(2)).toBeGreaterThan(38);
    for (const locale of LOCALES) {
      const text = guideText(locale);
      expect(text).not.toContain('entre cinquanta i cent vegades');
      expect(text).not.toContain('entre cincuenta y cien veces');
    }
  });
});

/* ================================================================== */
/* 6. LA GEOMETRIA QUE LA GUIA FA SERVIR PER TRIAR EL LLOC             */
/* ================================================================== */

describe('la geometria del consell de Sol baix', () => {
  it('el radi del Sol és 0,26° a l’agost, no 0,27°', () => {
    const r2026 = circ('2026-08-12', 'burgos').contacts.max.sun.angularRadius;
    const r2027 = circ('2027-08-02', 'cadis').contacts.max.sun.angularRadius;
    const r2028 = circ('2028-01-26', 'sevilla').contacts.max.sun.angularRadius;
    expect(r2026).toBeCloseTo(0.263, 3);
    expect(r2027).toBeCloseTo(0.263, 3);
    // Al gener la Terra és prop del periheli i el Sol es veu més gran.
    expect(r2028).toBeCloseTo(0.271, 3);

    // I l'halo de 4-6 radis solars: d'1,05° a 1,58°, no «un grau i mig o dos».
    expect(4 * r2026).toBeGreaterThan(1);
    expect(6 * r2026).toBeLessThan(1.6);
    for (const locale of LOCALES) {
      const text = guideText(locale, '2026-08-12');
      expect(text).not.toContain('un halo d’un grau i mig o dos');
      expect(text).not.toContain('un halo de grado y medio o dos');
    }
  });

  it('una serra de 500 m a deu quilòmetres ocupa 2,9°, no 10°', () => {
    const deg = (Math.atan2(500, 10_000) * 180) / Math.PI;
    expect(deg).toBeCloseTo(2.9, 1);
    // I l'edifici de sis plantes a cent metres, que sí que en fa deu.
    expect((Math.atan2(18, 100) * 180) / Math.PI).toBeCloseTo(10.2, 1);
    expect(guideText('ca', '2026-08-12')).toContain('n’ocupa 2,9');
    expect(guideText('es', '2026-08-12')).toContain('ocupa 2,9');
  });
});

/* ================================================================== */
/* 7. INVARIANTS DEL CATÀLEG                                           */
/* ================================================================== */

describe('invariants del catàleg', () => {
  it('el motor confirma el tipus d’eclipsi de cada entrada', () => {
    const witness: Record<string, PlaceKey> = {
      '2026-08-12': 'oviedo',
      '2027-08-02': 'tarifa',
      '2028-01-26': 'sevilla',
    };
    for (const eclipse of ECLIPSES) {
      expect(circ(eclipse.id, witness[eclipse.id]!).kind).toBe(eclipse.kind);
    }
  });

  it('cap consell del catàleg no escriu una xifra local', () => {
    // La regla de capçalera de `catalog.ts`: els `tips` són qualitatius. Una
    // xifra allà competiria amb la que el motor calcula per a qui llegeix.
    for (const eclipse of ECLIPSES) {
      for (const locale of LOCALES) {
        for (const tip of eclipse.tips?.[locale] ?? []) {
          expect(tip).not.toMatch(/\d+\s*(°|s\b|segons|segundos|min\b)/);
        }
      }
    }
  });
});
