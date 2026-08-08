/**
 * EL CONSELL, CONTRA EL MOTOR I CONTRA EL SENTIT COMÚ.
 *
 * `travel.ts` és l'única part d'aquestes pàgines que no descriu: RECOMANA. Una
 * xifra malament és un error; un consell malament fa que algú condueixi cinc
 * hores el dia de l'eclipsi. Per això aquí no n'hi ha prou de comprovar que els
 * números quadrin: es comprova també que el consell tingui sentit.
 *
 * Els dos casos que van néixer mirant el que sortia de debò:
 *
 *   · a Tarifa, per al 2026, la primera versió recomanava anar a València —599
 *     km— perquè era, literalment, la ciutat publicada més propera amb fase
 *     central. Cert i inútil.
 *   · a Palma, per al 2026, calia que NO recomanés res: hi ha 96 segons de
 *     totalitat i marxar-ne seria absurd.
 */

import { describe, expect, it } from 'vitest';
import { ECLIPSES } from '../../core/eclipses/catalog';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import { SEO_CITIES } from './cities';
import { travelAdvice } from './travel';

const ALL = ECLIPSES.map((eclipse) => eclipse.id);
const at = (id: string) => {
  const city = SEO_CITIES.find((candidate) => candidate.id === id);
  expect(city, `la ciutat ${id} hauria de ser al catàleg`).toBeDefined();
  return { lat: city!.lat, lon: city!.lon };
};

describe('on anar', () => {
  it('des d’una ciutat fora de la franja, apunta a una de dins i a prop', () => {
    const advice = travelAdvice('2026-08-12', at('barcelona'), SEO_CITIES, ALL);
    expect(advice.target).not.toBeNull();
    expect(advice.target!.km).toBeLessThan(250);
    // I el que recomana ha de tenir de debò fase central: la comparació que
    // importa és contra el motor, no contra una llista.
    const there = computeLocalCircumstances('2026-08-12', {
      ...at(advice.target!.id),
      elevation: 0,
    });
    expect(there.centralDurationSec).toBeGreaterThan(0);
    expect(there.edgeUncertain).toBe(false);
    expect(advice.target!.durationSec).toBeCloseTo(there.centralDurationSec, 1);
  });

  it('mai no recomana res a més de 250 km', () => {
    // El cas de Tarifa: cert i inútil. A aquella distància la decisió és una
    // altra i la pàgina no l'ha de prendre.
    for (const eclipse of ALL) {
      for (const city of SEO_CITIES) {
        const advice = travelAdvice(eclipse, { lat: city.lat, lon: city.lon }, SEO_CITIES, ALL);
        if (advice.target) {
          expect(advice.target.km, `${eclipse} · ${city.id} → ${advice.target.id}`).toBeLessThanOrEqual(250);
        }
      }
    }
  });

  it('no fa moure ningú que ja hi sigui per un grapat de segons', () => {
    const advice = travelAdvice('2026-08-12', at('palma'), SEO_CITIES, ALL);
    const here = computeLocalCircumstances('2026-08-12', { ...at('palma'), elevation: 0 });
    expect(here.centralDurationSec).toBeGreaterThan(0);
    expect(advice.target).toBeNull();
    expect(advice.betterEclipse).toBeNull();
  });

  it('mai no recomana un punt amb menys durada que la que ja tens', () => {
    for (const eclipse of ALL) {
      for (const city of SEO_CITIES) {
        const here = computeLocalCircumstances(eclipse, {
          lat: city.lat,
          lon: city.lon,
          elevation: 0,
        });
        const hereSec = here.edgeUncertain ? 0 : here.centralDurationSec;
        const advice = travelAdvice(eclipse, { lat: city.lat, lon: city.lon }, SEO_CITIES, ALL);
        if (advice.target) {
          expect(
            advice.target.durationSec,
            `${eclipse} · ${city.id}: ${hereSec}s aquí i ${advice.target.durationSec}s allà`,
          ).toBeGreaterThan(hereSec);
        }
      }
    }
  });

  it('mai no recomana un punt que és al caire de la franja', () => {
    // Al caire el motor diu que no pot confirmar la totalitat. Enviar-hi algú
    // seria vendre com a segur el que la pàgina d'aquell punt es nega a dir.
    for (const eclipse of ALL) {
      for (const city of SEO_CITIES) {
        const advice = travelAdvice(eclipse, { lat: city.lat, lon: city.lon }, SEO_CITIES, ALL);
        if (!advice.target) continue;
        const there = computeLocalCircumstances(eclipse, {
          ...at(advice.target.id),
          elevation: 0,
        });
        expect(there.edgeUncertain, `${eclipse} · ${advice.target.id}`).toBe(false);
      }
    }
  });
});

describe('quan no hi ha on anar', () => {
  it('a Tarifa el 2026 no proposa cap viatge i sí el seu propi eclipsi del 2027', () => {
    const advice = travelAdvice('2026-08-12', at('tarifa'), SEO_CITIES, ALL);
    expect(advice.target).toBeNull();
    expect(advice.betterEclipse).not.toBeNull();
    expect(advice.betterEclipse!.eclipseId).toBe('2027-08-02');
    expect(advice.betterEclipse!.total).toBe(true);
    // I la durada que anuncia és la d'AQUELL punt, no la d'un altre.
    const there = computeLocalCircumstances('2027-08-02', { ...at('tarifa'), elevation: 0 });
    expect(advice.betterEclipse!.durationSec).toBeCloseTo(there.centralDurationSec, 1);
  });

  it('a Sevilla el 2026 remet a l’anular del 2028, que hi passa pel damunt', () => {
    const advice = travelAdvice('2026-08-12', at('sevilla'), SEO_CITIES, ALL);
    expect(advice.target).toBeNull();
    expect(advice.betterEclipse?.eclipseId).toBe('2028-01-26');
    expect(advice.betterEclipse?.total).toBe(false);
  });

  it('l’altre eclipsi només surt quan aquest no té resposta', () => {
    // Si ja hi ha fase central aquí, o un destí a prop, distreure amb una data
    // del 2028 és treure la persona de la decisió que ha vingut a prendre.
    for (const eclipse of ALL) {
      for (const city of SEO_CITIES) {
        const here = computeLocalCircumstances(eclipse, {
          lat: city.lat,
          lon: city.lon,
          elevation: 0,
        });
        const advice = travelAdvice(eclipse, { lat: city.lat, lon: city.lon }, SEO_CITIES, ALL);
        if (advice.betterEclipse) {
          expect(advice.target, `${eclipse} · ${city.id}`).toBeNull();
          expect(here.edgeUncertain || here.centralDurationSec <= 0).toBe(true);
        }
      }
    }
  });

  it('cada eclipsi té alguna ciutat publicada amb fase central', () => {
    /*
     * La comprovació que hauria caçat el defecte d'origen: el catàleg es va
     * triar per a la franja del 2026 i es publicava igual per als tres, de
     * manera que la pàgina del 2027 llistava setze ciutats i cap no era a la
     * franja. Amb aquesta prova, afegir un eclipsi sense afegir-hi les seves
     * ciutats es veu de seguida.
     */
    for (const eclipse of ALL) {
      const central = SEO_CITIES.filter((city) => {
        const c = computeLocalCircumstances(eclipse, {
          lat: city.lat,
          lon: city.lon,
          elevation: 0,
        });
        return c.centralDurationSec > 0 && !c.edgeUncertain;
      });
      expect(central.length, `${eclipse} no té cap ciutat publicada dins de la franja`).toBeGreaterThan(2);
    }
  });
});
