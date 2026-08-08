/**
 * LA PARAULA CONTRA EL MOTOR.
 *
 * Aquest projecte ha comès tres vegades el mateix error, i les tres vegades el
 * que faltava era aquesta prova:
 *
 *   · el mapa va dibuixar una franja que deixava València fora amb 62 segons de
 *     totalitat — ningú comparava el que es dibuixa amb el que es calcula;
 *   · el text va anunciar «Galícia» d'una franja que no passa ni per Vigo ni per
 *     Santiago — ningú comparava el text amb el motor;
 *   · les fitxes de ciutat van publicar «Eclipsi total 2026 a Barcelona» amb un
 *     99,8 % parcial dues pantalles més avall — ningú comparava el títol amb les
 *     circumstàncies del punt.
 *
 * Aquí es compara. Per a cada ciutat, cada eclipsi i cada idioma es genera el
 * títol i l'encapçalament EXACTAMENT com els genera `build-seo-pages.ts` —amb
 * les mateixes funcions, no amb una imitació— i es demana que la paraula
 * «total» (i «totalidad», «totality», «totalité») no hi surti si el motor no
 * dona fase central confirmada en aquell punt.
 *
 * PER QUÈ NO ES PROVA L'HTML GENERAT. Perquè `build-seo-pages.ts` acaba amb un
 * `await main()` que escriu 1.316 fitxers: importar-lo des d'una prova voldria
 * dir generar-los tots per llegir-ne tres. El que s'ha de vigilar és la
 * COMPOSICIÓ del text, i la composició són aquestes funcions. Qui les canviï
 * per una plantilla escrita a mà dins del generador tornarà a obrir el forat, i
 * per això `scripts/check-built-html.ts` també mira el resultat publicat.
 */

import { describe, expect, it } from 'vitest';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import { ECLIPSES } from '../../core/eclipses/catalog';
import { pointsForEclipse } from '../../data/observation-points/catalog';
import { SEO_CITIES } from './cities';
import { SEO_LOCALES, seoLocalHeading, seoLocalTitle, seoVerdict } from './strings';
import { admetsTotality, seoOutcome } from './verdict';

/** Les quatre maneres de dir «totalitat» que es publiquen. */
const PARAULA_TOTAL = /\b(total|totalitat|totalidad|totality|totalité|totale)\b/i;

const fmt = (locale: string, value: number) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(
    value,
  );

/** El text que la pàgina publicarà per a un punt, compost com al generador. */
function textPublicat(eclipseId: string, name: string, lat: number, lon: number, elevation = 0) {
  const circumstances = computeLocalCircumstances(eclipseId, { lat, lon, elevation });
  const outcome = seoOutcome(circumstances);
  return SEO_LOCALES.map((locale) => {
    const verdict = seoVerdict(locale, outcome, {
      duration: fmt(locale, circumstances.centralDurationSec),
      obscuration: fmt(locale, circumstances.contacts.max.obscuration * 100),
      total: circumstances.kind === 'total',
    });
    return {
      locale,
      circumstances,
      outcome,
      title: seoLocalTitle(locale, eclipseId.slice(0, 4), name, verdict.summary),
      heading: seoLocalHeading(locale, '12 d’agost del 2026', name),
      verdict,
    };
  });
}

describe('cap fitxa promet una totalitat que el motor no dona', () => {
  it('les ciutats, als tres eclipsis i als quatre idiomes', () => {
    const mentides: string[] = [];
    for (const eclipse of ECLIPSES) {
      for (const city of SEO_CITIES) {
        for (const page of textPublicat(eclipse.id, city.name.ca, city.lat, city.lon)) {
          const potDirTotal = admetsTotality(page.circumstances);
          for (const [camp, text] of [
            ['títol', page.title],
            ['encapçalament', page.heading],
          ] as const) {
            if (!potDirTotal && PARAULA_TOTAL.test(text)) {
              mentides.push(`${eclipse.id} · ${city.id} · ${page.locale} · ${camp}: «${text}»`);
            }
          }
        }
      }
    }
    expect(
      mentides,
      'Aquests textos diuen «total» on el motor no dona fase central confirmada. ' +
        'És l’error de Barcelona: el qualificador ha de sortir de ' +
        'computeLocalCircumstances(), no del catàleg d’eclipsis.',
    ).toEqual([]);
  });

  it('els punts oficials, inclosos els dotze que només tenen fase parcial', () => {
    const mentides: string[] = [];
    for (const eclipse of ECLIPSES) {
      for (const point of pointsForEclipse(eclipse.id)) {
        for (const page of textPublicat(
          eclipse.id,
          point.name.ca,
          point.lat,
          point.lon,
          point.elevationM ?? 0,
        )) {
          if (!admetsTotality(page.circumstances) && PARAULA_TOTAL.test(page.title)) {
            mentides.push(`${point.id} · ${page.locale}: «${page.title}»`);
          }
        }
      }
    }
    expect(mentides).toEqual([]);
  });

  it('i, al revés, on SÍ que n’hi ha, la xifra és la del motor', () => {
    // Una prova que només mirés que no es diu «total» la passaria un generador
    // que no digués mai res. Aquesta exigeix que, quan n'hi ha, la durada
    // publicada sigui la calculada i no una altra.
    const tarragona = pointsForEclipse('2026-08-12').find((point) =>
      point.id.includes('tarragona'),
    );
    expect(tarragona, 'el catàleg del 2026 hauria de tenir punts a Tarragona').toBeDefined();

    const pages = textPublicat(
      '2026-08-12',
      tarragona!.name.ca,
      tarragona!.lat,
      tarragona!.lon,
      tarragona!.elevationM ?? 0,
    );
    const ca = pages.find((page) => page.locale === 'ca')!;
    expect(ca.outcome).toBe('central');
    expect(ca.verdict.figure).toBe(`${fmt('ca', ca.circumstances.centralDurationSec)} s`);
    expect(ca.title).toMatch(PARAULA_TOTAL);
  });
});

describe('el veredicte diu el mateix en els quatre idiomes', () => {
  it('cap forma es queda sense text ni cau cap al genèric', () => {
    const valors = { duration: '48,3', obscuration: '99,8', total: true };
    for (const outcome of ['central', 'edge', 'partial', 'none'] as const) {
      const textos = SEO_LOCALES.map((locale) => seoVerdict(locale, outcome, valors));
      for (const copy of textos) {
        expect(copy.figure).not.toBe('');
        expect(copy.unit).not.toBe('');
        expect(copy.summary).not.toBe('');
        // Les frases són el que explica la conseqüència: si una es queda curta
        // és que algú l'ha deixada a mitges en un idioma i no en els altres.
        expect(copy.sentence.length).toBeGreaterThan(80);
      }
      // Cap idioma no pot compartir la frase amb un altre: seria una traducció
      // que no s'ha fet.
      expect(new Set(textos.map((copy) => copy.sentence)).size).toBe(SEO_LOCALES.length);
    }
  });

  it('al caire no es publica cap durada, ni tan sols la que el motor calcula', () => {
    // La regla 2 en la seva forma més concreta: al caire de la franja el motor
    // dona un número positiu petit que NO es pot garantir. Publicar-lo com si
    // fos una mesura és vestir una estimació de mesura.
    for (const locale of SEO_LOCALES) {
      const copy = seoVerdict(locale, 'edge', { duration: '2,4', obscuration: '100,0', total: true });
      expect(copy.figure).not.toMatch(/\d/);
      expect(copy.summary).not.toMatch(/\d/);
    }
  });
});
