/**
 * QUÈ COMPARA EL BLOC DE CLIMATOLOGIA AMB LA REALITAT.
 *
 * És la pregunta que `CLAUDE.md` diu que s'ha de fer davant de qualsevol cosa
 * nova, i aquí té resposta perquè les tres coses que el bloc pot fer malament
 * es poden mesurar contra un fitxer que hi ha al disc:
 *
 * 1. Publicar la cel·la equivocada. Es comprova agafant la cel·la que dona
 *    `climCellAt()` per a unes coordenades i exigint que TOTS els seus números
 *    surtin al text —no una mostra, tots.
 * 2. Inflar la sèrie. La graella és de 2011-2023 i té 12 o 13 anys per cel·la,
 *    i `CLAUDE.md` posa aquest cas com a exemple textual del que no es pot fer:
 *    «una climatologia de 12 anys no s'anuncia com una de 15». Es compta cel·la
 *    per cel·la.
 * 3. Prometre el bloc on no hi ha dada. El 2027 i el 2028 no tenen graella i
 *    hi ha llocs del 2026 que cauen fora del rectangle. Aquí es comprova que
 *    l'única porta —que `climCellAt()` trobi cel·la— es tanca de veritat.
 *
 * PER QUÈ LA PROVA NO CRIDA EL GENERADOR: `scripts/build-seo-pages.ts` fa
 * `await main()` en carregar-se, o sigui que importar-lo des d'aquí voldria dir
 * generar 1.592 pàgines a cada `vitest run`. Per això tota la composició del
 * bloc viu a `seoClimatology()` i el generador només l'embolcalla amb etiquetes:
 * el que es podia equivocar és aquí i es prova aquí.
 */
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ECLIPSES } from '../../core/eclipses/catalog';
import { climCellAt, climGridFileName, parseCloudClimGrid } from '../../core/weather/climGrid';
import { CLIMATOLOGY_YEARS, confidenceForYears } from '../../core/weather/outlook';
import { pointsForEclipse } from '../../data/observation-points/catalog';
import { SEO_CITIES } from './cities';
import { SEO_LOCALES, seoClimatology, seoStrings } from './strings';
import type { SeoClimatologyValues } from './strings';

const DATA = resolve('public/data');
const ECLIPSE_2026 = '2026-08-12';

const gridPath = (eclipseId: string) => resolve(DATA, climGridFileName(eclipseId));
const grid = parseCloudClimGrid(JSON.parse(readFileSync(gridPath(ECLIPSE_2026), 'utf8')));

const city = (id: string) => {
  const found = SEO_CITIES.find((entry) => entry.id === id);
  if (!found) throw new Error(`La prova demana la ciutat «${id}» i el catàleg no la té`);
  return found;
};

/** Els valors del bloc per a unes coordenades, tal com els munta el generador. */
function valuesAt(lat: number, lon: number): SeoClimatologyValues {
  const cell = climCellAt(grid, lat, lon);
  if (!cell) throw new Error(`No hi ha cel·la a ${lat}, ${lon}`);
  return {
    score: cell.score,
    clearPercent: cell.clearFraction * 100,
    cloudyPercent: cell.cloudyFraction * 100,
    years: cell.years,
    firstYear: grid.firstYear,
    lastYear: grid.lastYear,
    samples: cell.sampleCount,
    windowDays: grid.windowDays,
    stepDeg: grid.stepDeg,
    cellLat: cell.lat,
    cellLon: cell.lon,
  };
}

describe('la climatologia de les fitxes editorials', () => {
  it('publica els números de la cel·la que dona el motor, i no uns altres', () => {
    const barcelona = city('barcelona');
    const cell = climCellAt(grid, barcelona.lat, barcelona.lon);
    expect(cell).not.toBeNull();
    const copy = seoClimatology('en', valuesAt(barcelona.lat, barcelona.lon));

    /*
     * Els tres valors són enters i es formaten igual als quatre idiomes, o
     * sigui que es poden comparar amb el número del motor sense passar per cap
     * `Intl`. Comparar-los contra una còpia formatada per la prova mateixa
     * seria assertar damunt del propi simulacre.
     */
    expect(copy.figures.map((figure) => figure.value)).toEqual([
      `${cell!.score} / 100`,
      `${Math.round(cell!.clearFraction * 100)} %`,
      `${Math.round(cell!.cloudyFraction * 100)} %`,
    ]);

    // I la resta de xifres de la cel·la, que viuen a la nota de procedència.
    expect(copy.note).toContain(String(cell!.sampleCount));
    expect(copy.note).toContain(String(cell!.years));
    expect(copy.note).toContain(`${grid.firstYear}-${grid.lastYear}`);
  });

  it('diu el centre de la cel·la, que no és el punt de la fitxa', () => {
    /*
     * AQUESTA ÉS LA MENTIDA PER OMISSIÓ QUE EL BLOC HA D'EVITAR.
     *
     * Barcelona és a 41,39° i la seva cel·la té el centre a 41,50°: la xifra
     * que la fitxa publica és d'un punt a dotze quilòmetres al nord. Si el
     * bloc no en digués el centre, un «78» damunt del nom d'una ciutat es
     * llegiria com una mesura d'aquella ciutat.
     */
    const barcelona = city('barcelona');
    const cell = climCellAt(grid, barcelona.lat, barcelona.lon)!;
    expect(cell.lat).not.toBe(barcelona.lat);
    const copy = seoClimatology('en', valuesAt(barcelona.lat, barcelona.lon));
    expect(copy.note).toContain(cell.lat.toFixed(2));
    expect(copy.note).toContain(cell.lon.toFixed(2));
  });

  it('publica la mida de la cel·la en tots quatre idiomes', () => {
    const barcelona = city('barcelona');
    const values = valuesAt(barcelona.lat, barcelona.lon);
    expect(SEO_LOCALES).toHaveLength(4);
    for (const locale of SEO_LOCALES) {
      const copy = seoClimatology(locale, values);
      // 0,25° en tres idiomes i 0.25° en anglès: el que ha de sortir sempre és
      // el grau, i a més una distància, perquè un grau no diu res a ningú.
      expect(copy.note).toMatch(/0[.,]25°/);
      expect(copy.note).toMatch(/\b2[0-9]\b/);
      expect(copy.note.toLowerCase()).toContain('km');
      expect(copy.note).toContain('Open-Meteo');
    }
  });

  it('una climatologia de dotze anys no s’anuncia com una de quinze', () => {
    expect(grid.cells.years.length).toBeGreaterThan(0);
    const distinct = new Set(grid.cells.years);
    expect([...distinct].toSorted((a, b) => a - b)).toEqual([12, 13]);
    // La constant de l'app és 15 i és la de la consulta en directe, no la
    // d'aquest fitxer: el bloc no la pot fer servir mai.
    expect(CLIMATOLOGY_YEARS).toBe(15);

    const barcelona = city('barcelona');
    const values = valuesAt(barcelona.lat, barcelona.lon);
    for (const locale of SEO_LOCALES) {
      const copy = seoClimatology(locale, values);
      expect(copy.caveat).toContain(String(values.years));
      expect(copy.caveat).not.toContain(String(CLIMATOLOGY_YEARS));
    }
  });

  it('l’avís diu que això NO és una previsió, i ho diu en majúscules', () => {
    const values = valuesAt(city('barcelona').lat, city('barcelona').lon);
    const shouted: Record<string, string> = { ca: 'NO', es: 'NO', en: 'NOT', fr: 'PAS' };
    for (const locale of SEO_LOCALES) {
      const copy = seoClimatology(locale, values);
      expect(copy.caveat).toContain(shouted[locale]);
      /*
       * L'avís ha de ser una frase de debò i no un rètol: la seva feina és
       * aturar algú que està a punt de fer sis-cents quilòmetres. Vuitanta
       * caràcters és el llindar per sota del qual això ja no és possible.
       */
      expect(copy.caveat.length).toBeGreaterThan(80);
    }
  });

  it('la fiabilitat que publica és la que classifica el motor', () => {
    // 12 i 13 anys donen tots dos «mitjana», i és el que ha de sortir escrit:
    // si algú mogués els llindars de `confidenceForYears`, aquesta prova cau
    // abans que la pàgina publiqui una paraula que el mapa contradiu.
    expect(confidenceForYears(12)).toBe('medium');
    expect(confidenceForYears(13)).toBe('medium');
    const copy = seoClimatology('ca', valuesAt(city('barcelona').lat, city('barcelona').lon));
    expect(copy.note).toContain('mitjana');
  });

  it('fa servir els rètols que hi havia escrits i que no feia servir ningú', () => {
    /*
     * Aquestes quatre cadenes existien en els quatre idiomes i tenien ZERO
     * usos: una capa sencera de codi mort. La prova les lliga al bloc perquè
     * ningú no les pugui tornar a deixar òrfenes sense que això es vegi.
     */
    const values = valuesAt(city('barcelona').lat, city('barcelona').lon);
    for (const locale of SEO_LOCALES) {
      const s = seoStrings(locale);
      const copy = seoClimatology(locale, values);
      expect(copy.heading).toBe(s.climatology);
      expect(copy.figures.map((figure) => figure.label)).toEqual([
        s.skyScore,
        s.clearYears,
        s.cloudyYears,
      ]);
    }
  });

  it('el 2027 i el 2028 no tenen graella, i per això no en poden portar bloc', () => {
    /*
     * ÉS LA PROVA DE LA PORTA, i mira el disc a posta. El generador no porta
     * cap any escrit a mà: ensenya el bloc quan `climCellAt()` troba cel·la, i
     * per trobar-ne cal que hi hagi fitxer. Si algun dia se'n generés un per al
     * 2027, aquesta prova cauria i obligaria a decidir-ho explícitament en
     * comptes de descobrir-ho publicat.
     */
    const withGrid = ECLIPSES.filter((eclipse) => existsSync(gridPath(eclipse.id)));
    expect(withGrid.map((eclipse) => eclipse.id)).toEqual([ECLIPSE_2026]);
    expect(ECLIPSES.length).toBeGreaterThan(1);
  });

  it('un punt fora del rectangle de la graella tampoc no en porta', () => {
    // Tarifa és a 36,0° i la graella comença a 37,4°: el 2026 la franja no hi
    // arriba i no n'hi ha climatologia. La fitxa existeix igualment i el que hi
    // falta és el bloc, no una xifra inventada.
    const tarifa = city('tarifa');
    expect(climCellAt(grid, tarifa.lat, tarifa.lon)).toBeNull();
  });

  it('la immensa majoria dels llocs del 2026 sí que en tenen', () => {
    /*
     * Sense aquesta comprovació, un canvi que trenqués la lectura de la graella
     * deixaria el bloc fora de les 1.592 pàgines sense que res es queixés: el
     * bloc buit és una cadena buida i una pàgina sense bloc és vàlida. Els
     * números són els mesurats avui —278 de 280 punts oficials i 21 de 37
     * ciutats, perquè setze del catàleg són del sud i el 2026 no hi passa.
     */
    const points = pointsForEclipse(ECLIPSE_2026);
    expect(points.length).toBe(280);
    const covered = points.filter((point) => climCellAt(grid, point.lat, point.lon) !== null);
    expect(covered.length).toBe(278);

    const cities = SEO_CITIES.filter((entry) => climCellAt(grid, entry.lat, entry.lon) !== null);
    expect(cities.length).toBe(21);
  });
});
