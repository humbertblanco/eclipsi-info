/**
 * EL QUE ES DIBUIXA CONTRA EL QUE ES CALCULA.
 *
 * Aquesta prova hauria d'haver existit des del principi i no hi era: cap test
 * del projecte comparava el POLÍGON DE LA FRANJA amb el motor de circumstàncies
 * locals. Es validava la franja contra les taules de la NASA (`path.test.ts`) i
 * es validava el motor de punts contra la NASA i l'IGN (`tests/golden/`), però
 * ningú no comprovava que les dues coses diguessin el mateix del mateix lloc. I
 * no ho deien.
 *
 * ═══ EL DEFECTE QUE VA OBLIGAR A ESCRIURE-LA ════════════════════════════════
 *
 * El polígon es tancava amb una recta entre els extrems dels dos límits. Al
 * 12-08-2026 aquella recta feia 810 km i anava de llevant de Mallorca fins a
 * vora Madrid. El que deixava a fora, segons `computeLocalCircumstances`:
 *
 *   València (39,47 / −0,38)      TOTAL,  62 s
 *   Palma (39,57 / 2,65)          TOTAL,  96 s
 *   Maó (39,89 / 4,27)            TOTAL,  68 s
 *   Peníscola (40,36 / 0,40)      TOTAL,  99 s
 *   (39,40 / 1,50)                TOTAL,  91 s
 *
 * O sigui la zona més poblada de tot el tram espanyol de la franja. La mateixa
 * recta hi era al 2027 (608 i 632 km) i al 2028 (829 i 773 km, aquesta última
 * travessant la Península de Lleida a la Costa del Sol).
 *
 * ═══ QUÈ ÉS «DINS» PER A CADA UN DELS DOS MOTORS ════════════════════════════
 *
 * Els dos no responen exactament la mateixa pregunta, i el test no seria honest
 * si ho dissimulés.
 *
 * El POLÍGON és la unió de les petjades de l'ombra sobre la cara IL·LUMINADA de
 * la Terra: s'acaba al terminador, igual que els mapes que publiquen el GSFC i
 * l'IGN. `computeLocalCircumstances`, en canvi, resol la separació angular
 * Sol-Lluna i no mira l'horitzó per a res: diu «anular, 325 s» a Girona el
 * 26-01-2028 encara que allà el Sol ja s'hagi post (altura geomètrica −0,59° a
 * C2, i −0,39° d'altura APARENT, o sigui post fins i tot amb refracció). El
 * mateix mòdul ho reconeix a part, amb `sunBelowHorizonDuringEvent`.
 *
 * Per això la pregunta que es compara és **«hi ha fase central I es pot
 * veure?»**, i el criteri d'horitzó és l'altura GEOMÈTRICA del Sol a C2 —
 * l'inici de la fase central. Geomètrica i no aparent perquè és la que fa
 * servir la geometria besseliana; a C2 i no al màxim perquè amb el Sol
 * ponent-se n'hi ha prou que la fase central COMENCI amb el Sol amunt (a
 * Barcelona, el 2028, C2 és a +0,15° i el màxim ja a −0,39°, i el punt és dins
 * de la franja publicada).
 *
 * Mesurat sobre els punts d'aquest test, el criteri separa NET: tots els punts
 * amb altura a C2 positiva cauen dins de la franja besseliana i tots els de
 * negativa, fora, sense cap excepció ni cap cas ambigu. El més just és
 * (37,90 / 5,00) el 2026, amb −0,082°, i cau del cantó correcte.
 *
 * ═══ LA TOLERÀNCIA, I PER QUÈ NO S'HA D'«ARREGLAR» ══════════════════════════
 *
 * Els dos motors situen l'ombra a 2,9 km l'un de l'altre. NO és un error: és
 * una decisió de producte documentada a ESTAT.md §5. La franja del mapa surt
 * dels elements besselians del GSFC (ΔT 71,4-71,9 s) perquè ha de coincidir amb
 * les taules publicades de la NASA i de l'IGN, que és amb qui la compara
 * tothom; el motor de punts fa servir ΔT IERS (69,19-69,32 s) i
 * `astronomy-engine`. La ΔT només explica 0,41 km dels 2,9; la resta és el
 * residu contra DE441, que no és a les nostres mans. `edgeUncertain` i
 * `core/astro/uncertainty.ts` ja diuen a l'usuari «al caire, ves-hi amb marge»
 * exactament on aquests quilòmetres decideixen.
 *
 * Conseqüència per a aquest test: un punt a menys de 3 km de la vora dibuixada
 * pot sortir classificat diferent pels dos motors sense que hi hagi cap defecte,
 * i s'excusa. Els punts de la llista, de fet, no hi arriben mai —el més a prop
 * és Màlaga, a 9,1 km— o sigui que avui el test passa sense fer servir
 * l'excusa. Hi és perquè, si algú n'hi afegeix un de ben arran, el test
 * segueixi dient la veritat en comptes de fallar per una discrepància que sabem
 * que hi és i que no volem tancar.
 */

import { describe, expect, it } from 'vitest';
import { computeEclipsePath, eclipsePathToGeoJson } from './path';
import { computeLocalCircumstances } from '../astro/contacts';

/**
 * Franja de tolerància al caire, en km. És la discrepància mesurada entre els
 * dos motors d'ombra (ESTAT.md §5), arrodonida cap amunt.
 */
const EDGE_TOLERANCE_KM = 3;

const KM_PER_DEG_LAT = 111.32;

type Case = [name: string, lat: number, lon: number];

/** Punt dins d'un anell, per creuaments de semirecta. */
function insideRing(lon: number, lat: number, ring: readonly (readonly number[])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Distància del punt a la vora de l'anell, en km. Equirectangular local. */
function distanceToRingKm(
  lon: number,
  lat: number,
  ring: readonly (readonly number[])[],
): number {
  const kx = KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (let i = 1; i < ring.length; i++) {
    const ax = (ring[i - 1][0] - lon) * kx;
    const ay = (ring[i - 1][1] - lat) * KM_PER_DEG_LAT;
    const bx = (ring[i][0] - lon) * kx;
    const by = (ring[i][1] - lat) * KM_PER_DEG_LAT;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/**
 * El veredicte del motor de punts: hi ha fase central I comença amb el Sol per
 * damunt de l'horitzó geomètric. Vegeu la capçalera.
 */
function engineSaysCentral(eclipseId: string, lat: number, lon: number): {
  central: boolean;
  seconds: number;
  c2AltitudeDeg: number | null;
} {
  const c = computeLocalCircumstances(eclipseId, { lat, lon, elevation: 0 });
  const c2 = c.contacts.c2;
  const altitude = c2 === undefined ? null : c2.sun.altitudeTrue;
  return {
    central: c.centralDurationSec > 0 && altitude !== null && altitude > 0,
    seconds: c.centralDurationSec,
    c2AltitudeDeg: altitude,
  };
}

/*
 * ELS PUNTS. Hi ha de tres menes, a posta:
 *
 *  · llocs de debò, i sobretot els de la zona que la recta de 810 km deixava
 *    fora (València, Castelló, Peníscola, les Balears);
 *  · punts de mar tocant als EXTREMS de cada franja, que és on la construcció
 *    nova ha de ser correcta i on és més fàcil que es quedi curta;
 *  · llocs que han de quedar FORA, i alguns ben a prop de la vora (Madrid,
 *    Barcelona el 2026, Saragossa i Girona el 2028, Alger el 2027), perquè el
 *    test no es pugui passar inflant la franja.
 */
const CASES: Record<string, Case[]> = {
  '2026-08-12': [
    // Els sis punts del report original.
    ['València', 39.47, -0.38],
    ['Peníscola', 40.36, 0.4],
    ['Palma', 39.57, 2.65],
    ['Maó', 39.89, 4.27],
    ['punt de mar 39,40/1,50', 39.4, 1.5],
    ['Madrid', 40.42, -3.7],
    // Balears i la cua, que és on viu la tapa.
    ['Ciutadella', 40.0, 3.84],
    ['Eivissa', 38.91, 1.43],
    ['Formentera', 38.7, 1.43],
    ['Castelló', 39.99, -0.04],
    ['mar 38,40/4,40', 38.4, 4.4],
    ['mar 39,00/5,50', 39.0, 5.5],
    ['mar 38,00/4,00', 38.0, 4.0],
    // El punt més just de tots: el Sol s'hi pon abans que hi arribi l'ombra.
    ['mar 37,90/5,00 (Sol post)', 37.9, 5.0],
    // Cor de la franja i fora clar.
    ['Burgos', 42.34, -3.7],
    ['Oviedo', 43.36, -5.84],
    ['Reykjavík', 64.15, -21.94],
    ['Alacant', 38.35, -0.48],
    ['Barcelona', 41.39, 2.17],
    ['Sevilla', 37.39, -5.99],
  ],
  '2027-08-02': [
    ['Cadis', 36.53, -6.29],
    ['Màlaga', 36.72, -4.42],
    ['Ceuta', 35.89, -5.31],
    ['Tànger', 35.77, -5.8],
    ['Luxor', 25.7, 32.64],
    ['Sfax', 34.74, 10.76],
    // Els dos extrems del recorregut, on abans hi havia cordes de 608 i 632 km.
    ['mar 29,00/-43,00 (cap)', 29.0, -43.0],
    ['mar -12,00/89,50 (cua)', -12.0, 89.5],
    ['Alger', 36.75, 3.06],
    ['Sevilla', 37.39, -5.99],
    ['Casablanca', 33.57, -7.59],
    ['Mogadiscio', 2.04, 45.34],
  ],
  '2028-01-26': [
    ['València', 39.47, -0.38],
    ['Albacete', 38.99, -1.86],
    ['Múrcia', 37.99, -1.13],
    ['Tarragona', 41.12, 1.25],
    ['Lleida', 41.62, 0.62],
    // Barcelona és dins per un pèl i amb el Sol a +0,15° a C2; Girona és fora
    // perquè allà el Sol ja s'ha post. Els dos, a la tapa final.
    ['Barcelona', 41.39, 2.17],
    ['Girona (Sol post)', 41.98, 2.82],
    ['Palma', 39.57, 2.65],
    ['mar 38,50/1,50 (cua)', 38.5, 1.5],
    ['Manaus', -3.12, -60.02],
    ['mar 2,00/-104,00 (cap)', 2.0, -104.0],
    ['Saragossa', 41.65, -0.89],
    ['Madrid', 40.42, -3.7],
    ['Paramaribo', 5.87, -55.17],
  ],
};

describe('el polígon dibuixat i el motor de circumstàncies han de dir el mateix', () => {
  for (const [eclipseId, cases] of Object.entries(CASES)) {
    it(`${eclipseId}: acord en els ${cases.length} punts de la llista`, () => {
      const { band } = eclipsePathToGeoJson(computeEclipsePath(eclipseId));
      const ring = band.geometry.coordinates[0];
      expect(ring.length).toBeGreaterThan(50);

      const disagreements: string[] = [];
      for (const [name, lat, lon] of cases) {
        const verdict = engineSaysCentral(eclipseId, lat, lon);
        const drawn = insideRing(lon, lat, ring);
        if (drawn === verdict.central) continue;

        // Al caire, els dos motors discrepen 2,9 km per decisió de producte.
        const km = distanceToRingKm(lon, lat, ring);
        if (km <= EDGE_TOLERANCE_KM) continue;

        disagreements.push(
          `${name} (${lat}/${lon}): el motor diu ${
            verdict.central ? `fase central de ${verdict.seconds.toFixed(0)} s` : 'sense fase central'
          } (altura del Sol a C2 ${verdict.c2AltitudeDeg?.toFixed(2) ?? '—'}°) i el polígon el dibuixa ${
            drawn ? 'DINS' : 'FORA'
          }, a ${km.toFixed(1)} km de la vora`,
        );
      }

      expect(disagreements, disagreements.join('\n')).toEqual([]);
    });
  }

  /**
   * La regressió concreta, escrita a part perquè si un dia torna es vegi de
   * seguida quina és: aquests cinc punts són els que la corda de 810 km deixava
   * fora, i tenen entre 62 i 99 segons de totalitat. No és cap cas al caire.
   */
  it('2026: la corda de 810 km ja no es menja València ni les Balears', () => {
    const { band } = eclipsePathToGeoJson(computeEclipsePath('2026-08-12'));
    const ring = band.geometry.coordinates[0];
    const victims: Case[] = [
      ['València', 39.47, -0.38],
      ['Peníscola', 40.36, 0.4],
      ['Palma', 39.57, 2.65],
      ['Maó', 39.89, 4.27],
      ['punt de mar 39,40/1,50', 39.4, 1.5],
    ];
    for (const [name, lat, lon] of victims) {
      const seconds = computeLocalCircumstances('2026-08-12', {
        lat,
        lon,
        elevation: 0,
      }).centralDurationSec;
      expect(seconds, `${name} hauria de tenir fase central`).toBeGreaterThan(30);
      expect(insideRing(lon, lat, ring), `${name} ha de caure dins del polígon`).toBe(true);
    }
  });
});

describe('les tres capes del mapa han de ser el mateix objecte', () => {
  /*
   * EL DEFECTE: una corba taronja solta surant al Mediterrani, cap a 38,5°N
   * 5°E, sense cap franja a sota. `eclipsePathToGeoJson` retorna tres coses que
   * el mapa pinta per separat —el farciment (`band`), les vores (`limits`) i la
   * central (`centerLine`)—, i n'hi va haver prou que un tros de vora es
   * calculés a part del polígon perquè quedés dibuixat sense res a sota.
   *
   * La regla, doncs: cada vèrtex de `limits` ha de ser un vèrtex de l'anell. Si
   * un tros de vora no entra al polígon, tampoc no es pinta.
   */
  const IDS = ['2026-08-12', '2027-08-02', '2028-01-26'];

  for (const id of IDS) {
    it(`${id}: cap tros de vora dibuixat fora de l'anell`, () => {
      const { band, limits, centerLine } = eclipsePathToGeoJson(computeEclipsePath(id));
      const ring = new Set(
        band.geometry.coordinates[0].map(([lon, lat]) => `${lon},${lat}`),
      );

      expect(limits.geometry.coordinates.length).toBeGreaterThan(1);
      for (const line of limits.geometry.coordinates) {
        expect(line.length).toBeGreaterThan(1);
        for (const [lon, lat] of line) {
          expect(
            ring.has(`${lon},${lat}`),
            `${id}: el punt ${lat}/${lon} es dibuixa com a vora però no és a l'anell`,
          ).toBe(true);
        }
      }

      // I la central no s'ha quedat enrere pel camí.
      expect(centerLine.geometry.coordinates.length).toBeGreaterThan(50);
    });
  }
});
