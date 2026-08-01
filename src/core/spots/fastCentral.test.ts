/**
 * Proves del model barat de la fase central.
 *
 * Tot l'embut descansa sobre una afirmació: que amb quatre crides a efemèrides
 * per candidat es pot ORDENAR una graella igual de bé que amb cinc-centes.
 * Aquí es comprova contra el motor exacte, que és l'única referència que val.
 *
 * El que no s'hi comprova, a posta, és que els números siguin PUBLICABLES: no
 * ho són, i per això els finalistes tornen a passar per `computeLocalCircumstances`.
 * Aquestes proves miren que el garbell no s'equivoqui d'ordre, no que encerti
 * la xifra.
 */

import { describe, expect, it } from 'vitest';
import { computeLocalCircumstances } from '../astro/contacts';
import type { GeoLocation } from '../astro/types';
import { buildCentralSeed, fastCentralPhase, sunTrackAt } from './fastCentral';

const ECLIPSE = '2026-08-12';
const CENTRE: GeoLocation = { lat: 41.7665, lon: -2.479, elevation: 1065 };

/** Graella de 5 × 5 punts sobre uns 55 × 55 km al voltant de Sòria. */
function graella(): GeoLocation[] {
  const punts: GeoLocation[] = [];
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      punts.push({
        lat: CENTRE.lat + i * 0.125,
        lon: CENTRE.lon + j * 0.166,
        elevation: 1000,
      });
    }
  }
  return punts;
}

describe('contra el motor exacte', () => {
  const seed = buildCentralSeed(ECLIPSE, CENTRE);
  const punts = graella();

  it('la durada de la fase central no s’equivoca ni d’un segon', () => {
    let pitjor = 0;
    for (const punt of punts) {
      const barat = fastCentralPhase(punt, seed);
      const exacte = computeLocalCircumstances(ECLIPSE, punt);
      pitjor = Math.max(pitjor, Math.abs(barat.centralSec - exacte.centralDurationSec));
    }
    // La capçalera promet 0,36 s de pitjor error sobre aquesta mateixa zona.
    expect(pitjor).toBeLessThan(1);
  });

  it('l’instant del mig de la fase central cau a segons del màxim exacte', () => {
    for (const punt of punts) {
      const barat = fastCentralPhase(punt, seed);
      const exacte = computeLocalCircumstances(ECLIPSE, punt);
      const maxMs = exacte.contacts.max?.time.getTime();
      if (maxMs === undefined) continue;
      expect(Math.abs(barat.midMs - maxMs) / 1000).toBeLessThan(5);
    }
  });

  it('el marge umbral coincideix en signe: dins de la franja és dins', () => {
    for (const punt of punts) {
      const barat = fastCentralPhase(punt, seed);
      const exacte = computeLocalCircumstances(ECLIPSE, punt);
      if (Math.abs(exacte.umbralMarginArcsec) < 3) continue; // la vora és una moneda
      expect(Math.sign(barat.umbralMarginArcsec)).toBe(
        Math.sign(exacte.umbralMarginArcsec),
      );
    }
  });

  it('només inverteix parelles que estan empatades de veritat', () => {
    // És l'única propietat que el garbell HA de tenir: que la xifra sigui
    // aproximada no importa mentre l'ordre no menteixi. Sí que en gira alguna
    // parella —hi ha 25 punts i el model s'equivoca en dècimes—, i el que es
    // comprova és que quan ho fa, els dos punts es diferencien en menys d'un
    // segon de totalitat. Girar un empat així no canvia cap consell.
    const parells = punts.map((p) => ({
      barat: fastCentralPhase(p, seed).centralSec,
      exacte: computeLocalCircumstances(ECLIPSE, p).centralDurationSec,
    }));

    let inversions = 0;
    for (let i = 0; i < parells.length; i++) {
      for (let j = i + 1; j < parells.length; j++) {
        const dBarat = parells[i].barat - parells[j].barat;
        const dExacte = parells[i].exacte - parells[j].exacte;
        if (dBarat === 0 || dExacte === 0) continue;
        if (Math.sign(dBarat) === Math.sign(dExacte)) continue;
        inversions++;
        expect(Math.abs(dExacte)).toBeLessThan(1);
      }
    }
    // I que no siguin gaires: una inversió de cada cent parelles com a molt.
    expect(inversions).toBeLessThan((parells.length * (parells.length - 1)) / 200);
  });

  it('l’altura aparent del Sol concorda amb la del motor exacte', () => {
    for (const punt of punts) {
      const barat = fastCentralPhase(punt, seed);
      const exacte = computeLocalCircumstances(ECLIPSE, punt);
      const max = exacte.contacts.max;
      if (!max) continue;
      expect(barat.sunAltitudeApparentDeg).toBeCloseTo(max.sun.altitudeApparent, 1);
      expect(barat.sunAzimuthDeg).toBeCloseTo(max.sun.azimuth, 1);
    }
  });
});

describe('cost', () => {
  it('són quatre o cinc crides per candidat, no cinc-centes', () => {
    const seed = buildCentralSeed(ECLIPSE, CENTRE);
    const barat = fastCentralPhase(CENTRE, seed);
    expect(barat.ephemerisCalls).toBeLessThanOrEqual(6);
    // La llavor es paga UN sol cop per a tota la cerca.
    expect(seed.ephemerisCalls).toBeLessThanOrEqual(10);
  });
});

describe('trajectòria del Sol sense tornar a cridar les efemèrides', () => {
  const seed = buildCentralSeed(ECLIPSE, CENTRE);
  const central = fastCentralPhase(CENTRE, seed);

  it('al mig de la fase central coincideix amb el punt de partida', () => {
    const ara = sunTrackAt(seed, central, 0);
    expect(ara.azimuthDeg).toBeCloseTo(central.sunAzimuthDeg, 9);
    expect(ara.altitudeApparentDeg).toBeCloseTo(central.sunAltitudeApparentDeg, 9);
  });

  it('el Sol es pon: al capvespre l’altura baixa i l’azimut avança', () => {
    const abans = sunTrackAt(seed, central, -60);
    const despres = sunTrackAt(seed, central, 60);
    expect(despres.altitudeApparentDeg).toBeLessThan(abans.altitudeApparentDeg);
    expect(despres.azimuthDeg).toBeGreaterThan(abans.azimuthDeg);
  });

  it('la refracció s’aplica DESPRÉS d’extrapolar, i es nota', () => {
    // Prop de l'horitzó la refracció comprimeix el moviment aparent. Si
    // s'extrapolés l'altura aparent amb una velocitat constant, dos minuts
    // separats donarien exactament el mateix descens; amb la refracció ben
    // posada, el segon tram baixa menys que el primer.
    const t0 = sunTrackAt(seed, central, 0).altitudeApparentDeg;
    const t1 = sunTrackAt(seed, central, 600).altitudeApparentDeg;
    const t2 = sunTrackAt(seed, central, 1200).altitudeApparentDeg;
    expect(t0 - t1).toBeGreaterThan(t1 - t2);
  });

  it('cap valor no surt NaN', () => {
    for (const offset of [-3600, -60, 0, 60, 3600]) {
      const track = sunTrackAt(seed, central, offset);
      expect(Number.isFinite(track.azimuthDeg)).toBe(true);
      expect(Number.isFinite(track.altitudeApparentDeg)).toBe(true);
    }
  });
});
