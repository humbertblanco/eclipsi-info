/**
 * L'INTERVAL QUE LLEGEIX GOOGLE CONTRA EL QUE IMPRIMEIX LA PÀGINA.
 *
 * La prova que hi havia (`seo.test.ts`, «cada interval global conté el màxim de
 * l'eclipsi») comprovava que `start < màxim global < end`. Amb una finestra de
 * quatre hores desplaçada dues, això segueix sent cert — i era exactament el
 * cas del 2028, que declarava un inici 142 minuts abans que el primer contacte
 * que la seva pròpia taula de ciutats publica.
 *
 * Aquí es compara amb el que la pàgina ENSENYA: els contactes de les ciutats i
 * dels punts oficials que hi surten llistats. Si algun dia el JSON-LD i la
 * taula es tornen a contradir, se sabrà aquí i no a Search Console.
 */

import { describe, expect, it } from 'vitest';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import { ECLIPSES } from '../../core/eclipses/catalog';
import { pointsForEclipse } from '../../data/observation-points/catalog';
import { SEO_CITIES } from './cities';
import { SEO_EVENT_WINDOWS } from './events';
import { SEO_LOCALES } from './strings';

describe('l’interval que es publica com a Event', () => {
  for (const eclipse of ECLIPSES) {
    describe(eclipse.id, () => {
      const window = SEO_EVENT_WINDOWS[eclipse.id];

      it('existeix i té els quatre idiomes', () => {
        expect(window).toBeDefined();
        for (const locale of SEO_LOCALES) expect(window.area[locale]).not.toBe('');
      });

      it('conté tots els contactes que la mateixa pàgina imprimeix', () => {
        const start = Date.parse(window.start);
        const end = Date.parse(window.end);
        expect(end).toBeGreaterThan(start);

        const fora: string[] = [];
        const llocs = [
          ...SEO_CITIES.map((city) => ({
            id: city.id,
            lat: city.lat,
            lon: city.lon,
            elevation: 0,
          })),
          ...pointsForEclipse(eclipse.id).map((point) => ({
            id: point.id,
            lat: point.lat,
            lon: point.lon,
            elevation: point.elevationM ?? 0,
          })),
        ];

        for (const lloc of llocs) {
          const c = computeLocalCircumstances(eclipse.id, lloc);
          if (c.kind === 'none') continue;
          if (c.contacts.c1 && c.contacts.c1.time.getTime() < start) {
            fora.push(`${lloc.id}: C1 ${c.contacts.c1.time.toISOString()} < ${window.start}`);
          }
          if (c.contacts.c4 && c.contacts.c4.time.getTime() > end) {
            fora.push(`${lloc.id}: C4 ${c.contacts.c4.time.toISOString()} > ${window.end}`);
          }
        }

        expect(
          fora,
          'El JSON-LD declara un interval que deixa fora contactes que la mateixa ' +
            'pàgina publica a la taula de ciutats i de punts oficials.',
        ).toEqual([]);
      });

      it('cau dins del mateix dia que el màxim global, i prou', () => {
        /*
         * AQUÍ HI HAVIA «conté el màxim global de l'eclipsi», I ERA FALS.
         *
         * L'assercció venia de `seo.test.ts` i semblava òbvia. No ho és: el
         * màxim global de l'anular del 26 de gener del 2028 és a les 15:08:59
         * UTC, i el primer contacte entre tots els llocs que publiquem és a les
         * 15:32:13 — vint-i-quatre minuts DESPRÉS. L'ombra ja fa estona que
         * corre quan arriba a la península.
         *
         * O sigui que exigir que la finestra contingui el màxim global és
         * exigir que sigui MÉS AMPLA que el fenomen al lloc que descriu. És
         * justament el que feia que la finestra escrita a mà del 2028 comencés
         * dues hores i mitja abans que cap contacte, i el motiu pel qual la
         * prova antiga passava en verd amb un interval mal posat.
         *
         * L'`Event` que publiquem porta `location` amb la franja peninsular:
         * un esdeveniment en un lloc comença quan comença EN AQUELL LLOC. El
         * que sí que té sentit comprovar és que no ens n'hàgim anat de dia,
         * que és el que passaria amb un error de fus o de format.
         */
        const maximum = Date.parse(eclipse.greatestEclipseUtc);
        const SIS_HORES = 6 * 60 * 60 * 1000;
        expect(Math.abs(Date.parse(window.start) - maximum)).toBeLessThan(SIS_HORES);
        expect(Math.abs(Date.parse(window.end) - maximum)).toBeLessThan(SIS_HORES);
      });

      it('no s’allarga inventant temps que no hi ha', () => {
        /*
         * La comprovació inversa, i és la que hauria caçat el 2028 pel cantó
         * contrari: un interval prou ample sempre conté tots els contactes. El
         * que es demana és que sigui AJUSTAT — que comenci amb el primer
         * contacte i acabi amb l'últim, amb un minut de marge per a
         * l'arrodoniment, i no dues hores abans «per si de cas».
         */
        const start = Date.parse(window.start);
        const end = Date.parse(window.end);
        let first = Number.POSITIVE_INFINITY;
        let last = Number.NEGATIVE_INFINITY;
        const llocs = [
          ...SEO_CITIES.map((city) => ({ lat: city.lat, lon: city.lon, elevation: 0 })),
          ...pointsForEclipse(eclipse.id).map((point) => ({
            lat: point.lat,
            lon: point.lon,
            elevation: point.elevationM ?? 0,
          })),
        ];
        for (const lloc of llocs) {
          const c = computeLocalCircumstances(eclipse.id, lloc);
          if (c.kind === 'none') continue;
          if (c.contacts.c1) first = Math.min(first, c.contacts.c1.time.getTime());
          if (c.contacts.c4) last = Math.max(last, c.contacts.c4.time.getTime());
        }
        expect(Math.abs(start - first)).toBeLessThan(60_000);
        expect(Math.abs(end - last)).toBeLessThan(60_000);
      });
    });
  }
});
