/**
 * La commutació de la capa del mapa, provada com el que és: una promesa.
 *
 * La promesa és que una climatologia i una previsió no s'ensenyaran mai amb la
 * mateixa cara. Al mapa això no ho pot vigilar cap frase, perquè el que
 * l'usuari mira és una taca de color: ho ha de vigilar la textura. Per tant el
 * test que de veritat importa d'aquest fitxer és el que comprova que les dues
 * fonts MAI no coincideixen ni en etiqueta ni en textura, i que el dia que algú
 * afegeixi una tercera manera de pintar-ho, aquest test se n'adoni.
 */

import { describe, expect, it } from 'vitest';
import { FORECAST_HORIZON_DAYS, LIVE_FORECAST_MAX_POINTS, planCloudMap } from './mapMode';
import { CLIMATOLOGY_YEARS } from './outlook';

/** 12 d'agost de 2026, 18:30 UTC: el màxim sobre Sòria. */
const ECLIPSE_MS = Date.UTC(2026, 7, 12, 18, 30);
const DAY_MS = 86_400_000;

/** L'instant que és `days` dies abans de l'eclipsi. */
const before = (days: number) => ECLIPSE_MS - days * DAY_MS;

describe('quina font toca', () => {
  it('a mesos vista la capa és climatologia, i prou', () => {
    expect(planCloudMap(ECLIPSE_MS, before(200)).mode).toBe('climatology');
    expect(planCloudMap(ECLIPSE_MS, before(40)).mode).toBe('climatology');
  });

  it('a menys de setze dies la capa passa a previsió viva', () => {
    expect(planCloudMap(ECLIPSE_MS, before(15)).mode).toBe('forecast');
    expect(planCloudMap(ECLIPSE_MS, before(3)).mode).toBe('forecast');
    expect(planCloudMap(ECLIPSE_MS, before(0)).mode).toBe('forecast');
  });

  it('el tall és l’horitzó real del model i no un número rodó', () => {
    expect(planCloudMap(ECLIPSE_MS, before(FORECAST_HORIZON_DAYS)).mode).toBe('forecast');
    expect(planCloudMap(ECLIPSE_MS, before(FORECAST_HORIZON_DAYS + 1)).mode).toBe(
      'climatology',
    );
  });

  it('el dia abans de l’eclipsi no hi ha cap manera de tornar a la climatologia', () => {
    for (let hours = 0; hours <= 24; hours++) {
      const plan = planCloudMap(ECLIPSE_MS, ECLIPSE_MS - hours * 3_600_000);
      expect(plan.mode, `${hours} h abans`).toBe('forecast');
    }
  });

  it('passat l’eclipsi ja no s’espera cap previsió', () => {
    const plan = planCloudMap(ECLIPSE_MS, ECLIPSE_MS + 30 * DAY_MS);
    expect(plan.mode).toBe('climatology');
    expect(plan.awaitingForecast).toBe(false);
  });

  it('abans de l’horitzó del model, la interfície pot dir «torna-hi»', () => {
    expect(planCloudMap(ECLIPSE_MS, before(60)).awaitingForecast).toBe(true);
    expect(planCloudMap(ECLIPSE_MS, before(10)).awaitingForecast).toBe(false);
  });
});

describe('les dues fonts no poden tenir la mateixa cara', () => {
  const climatology = planCloudMap(ECLIPSE_MS, before(90));
  const forecast = planCloudMap(ECLIPSE_MS, before(2));

  it('la textura les separa sense haver de llegir res', () => {
    expect(climatology.texture).not.toBe(forecast.texture);
    expect(climatology.texture).toBe('hatch');
    expect(forecast.texture).toBe('solid');
  });

  it('l’etiqueta les separa en tots dos idiomes', () => {
    expect(climatology.label.ca).not.toBe(forecast.label.ca);
    expect(climatology.label.es).not.toBe(forecast.label.es);
    expect(climatology.label.ca).not.toBe(climatology.label.es);
  });

  it('la climatologia diu NO en majúscules, també aquí', () => {
    // És la mateixa salvaguarda que `climatologyCaveat` a la fitxa del punt: si
    // es perd, quinze anys d'estadística passen a llegir-se com un butlletí.
    expect(climatology.caption.ca).toContain('NO és una previsió');
    expect(climatology.caption.es).toContain('NO es una previsión');
    expect(forecast.caption.ca).not.toContain('NO és');
  });

  it('cap text no es queda a mitges en cap dels dos idiomes', () => {
    for (const plan of [climatology, forecast]) {
      for (const text of [plan.label, plan.caption]) {
        expect(text.ca.length).toBeGreaterThan(0);
        expect(text.es.length).toBeGreaterThan(0);
        expect(text.ca).not.toBe(text.es);
      }
    }
  });
});

describe('la fiabilitat', () => {
  it('la previsió cau amb l’antelació i mai puja', () => {
    const order = ['high', 'medium', 'low', 'very-low'];
    let previous = -1;
    for (const days of [0, 1, 2, 3, 4, 6, 7, 9, 14]) {
      const index = order.indexOf(planCloudMap(ECLIPSE_MS, before(days)).confidence);
      expect(index, `${days} dies`).toBeGreaterThanOrEqual(previous);
      previous = index;
    }
  });

  it('la climatologia es qualifica pels anys que té darrere', () => {
    const full = planCloudMap(ECLIPSE_MS, before(90));
    const thin = planCloudMap(ECLIPSE_MS, before(90), { years: 7 });
    const broken = planCloudMap(ECLIPSE_MS, before(90), { years: 3 });
    expect(full.confidence).toBe('medium');
    expect(thin.confidence).toBe('low');
    expect(broken.confidence).toBe('very-low');
  });

  it('sense dir els anys, s’assumeix la sèrie sencera', () => {
    const implicit = planCloudMap(ECLIPSE_MS, before(90));
    const explicit = planCloudMap(ECLIPSE_MS, before(90), { years: CLIMATOLOGY_YEARS });
    expect(implicit.confidence).toBe(explicit.confidence);
    expect(implicit.caption.ca).toBe(explicit.caption.ca);
  });

  it('la frase de la climatologia diu quants anys hi ha darrere', () => {
    expect(planCloudMap(ECLIPSE_MS, before(90), { years: 11 }).caption.ca).toContain(
      '11 anys',
    );
    expect(planCloudMap(ECLIPSE_MS, before(90), { years: 11 }).caption.es).toContain(
      '11 años',
    );
  });

  it('la frase de la previsió diu quants dies falten', () => {
    expect(planCloudMap(ECLIPSE_MS, before(3)).caption.ca).toContain('3.0 dies');
    expect(planCloudMap(ECLIPSE_MS, before(3)).caption.es).toContain('3.0 días');
  });
});

describe('el pressupost de punts en directe', () => {
  it('és un número i té sostre', () => {
    // No és cap mesura i el comentari ho diu; el que sí que ha de ser és
    // prudent. Si algú el puja per damunt d'uns centenars, la petició deixa de
    // ser una espera curta amb dades mòbils i el test l'obliga a passar per
    // aquí i llegir-ho.
    expect(LIVE_FORECAST_MAX_POINTS).toBeGreaterThan(0);
    expect(LIVE_FORECAST_MAX_POINTS).toBeLessThanOrEqual(200);
  });
});
