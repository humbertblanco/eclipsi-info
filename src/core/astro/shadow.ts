/**
 * D'on arriba l'ombra, i a quina velocitat.
 *
 * PER QUÈ. L'ombra de la Lluna travessa el terra a velocitat supersònica —
 * entre dos mil i tres mil quilòmetres per hora a latituds ibèriques. Durant
 * els últims segons abans de la totalitat es pot VEURE venir: una paret de
 * foscor que s'acosta per l'horitzó i que t'engoleix. Qui hi ha estat ho
 * recorda tant o més que la corona.
 *
 * I gairebé ningú no la veu, perquè no sap cap a on mirar. Aquest mòdul
 * respon exactament això: **per on arriba, per on marxa, i quant triga**.
 *
 * COM. `centralLineAt` diu on cau l'eix de l'ombra en cada instant. Mostrejant
 * al voltant de la teva fase central es té la trajectòria del centre, i d'aquí
 * surten el rumb d'arribada i la velocitat.
 *
 * MATÍS IMPORTANT sobre el que es veu de veritat: amb el Sol molt baix, com
 * passa el 2026 i el 2028 a Espanya, l'ombra arriba molt rasant i la paret de
 * foscor és espectacular però també més difusa i més difícil de destriar del
 * capvespre. Amb el Sol alt es veu molt més neta. La interfície ho ha de dir
 * en comptes de prometre el mateix a tothom.
 */

import { centralLineAt } from '../eclipses/path';
import { approxDistanceKm, bearingDeg } from '../spots/grid';
import type { LocalCircumstances } from './types';

/**
 * Quant abans i després es mostreja per als RUMBS.
 *
 * Un minut: prou lluny perquè el rumb cap al centre de l'ombra sigui el de la
 * direcció d'arribada i no soroll, prou a prop perquè encara sigui la mateixa
 * geometria.
 */
const BEARING_LEAD_MS = 60_000;

/**
 * Interval per a la VELOCITAT. Molt més curt que el dels rumbs, i no és un
 * caprici.
 *
 * Espanya cau al final del recorregut de l'ombra, perquè l'eclipsi s'hi acaba
 * amb la posta de Sol. Amb el Sol rasant, la velocitat de l'ombra sobre el
 * terra s'accelera moltíssim —tendeix a infinit al punt on l'eix deixa de
 * tocar la Terra—, i una mitjana sobre minuts barreja velocitats molt diferents
 * i dona un número que no és el de cap instant.
 *
 * Amb deu segons centrats al màxim, el que surt és la velocitat instantània al
 * teu pas.
 */
const SPEED_HALF_WINDOW_MS = 5_000;

export interface ShadowMotion {
  /**
   * Rumb per on arriba l'ombra, en graus (0 = nord). És cap on has de mirar
   * els segons previs a la totalitat.
   */
  arrivalBearing: number;
  /** Rumb per on marxa, un cop t'ha passat per sobre. */
  departureBearing: number;
  /**
   * Velocitat del centre de l'ombra sobre el terra, en km/h.
   *
   * A Espanya surt entre 6.000 i 11.000 km/h, no els ~2.000 que se citen
   * sempre. La xifra popular correspon al mig del recorregut, on l'ombra cau
   * de ple sobre la superfície; Espanya és al FINAL, on el Sol es pon i l'ombra
   * hi arriba rasant, i llavors s'accelera moltíssim.
   *
   * Verificat contra la taula de trajectòria del GSFC: les nostres velocitats
   * instantànies emmarquen correctament les mitjanes de dos minuts publicades
   * (6.318 contra 5.880 a les 18:26; 10.882 contra 9.027 a les 18:30), amb la
   * diferència que toca perquè la velocitat està creixent dins de cada
   * interval.
   */
  speedKmh: number;
  /**
   * Cert quan la velocitat ja no és una xifra útil.
   *
   * Al punt on l'eix de l'ombra deixa de tocar la Terra, la velocitat sobre el
   * terra tendeix a infinit. A les 18:32 UT del 12-08-2026, amb el Sol a 2°,
   * ja passa dels 40.000 km/h. És físicament correcte i no vol dir res per a
   * ningú: en aquest cas s'ha de dir "molt ràpida" i no un número.
   */
  speedDiverging: boolean;
  /**
   * Instant a partir del qual val la pena mirar cap al rumb d'arribada.
   * Uns segons abans de C2: abans encara hi ha massa llum.
   */
  watchFromUtc: Date;
  /**
   * Cert quan el Sol és prou baix perquè la paret d'ombra sigui difusa i
   * costi de destriar del capvespre. No és un error: és el que passarà.
   */
  lowSunCaveat: boolean;
  /** Altura del Sol al màxim, en graus, per poder-ho explicar. */
  sunAltitudeDeg: number;
}

/**
 * Moviment de l'ombra vist des del punt de l'observador.
 * Torna null si des d'aquest punt no hi ha fase central.
 */
export function computeShadowMotion(
  eclipseId: string,
  circumstances: LocalCircumstances,
): ShadowMotion | null {
  const { c2, c3, max } = circumstances.contacts;
  if (!c2 || !c3) return null;

  const { lat, lon } = circumstances.location;

  const before = centralLineAt(eclipseId, c2.time.getTime() - BEARING_LEAD_MS);
  const after = centralLineAt(eclipseId, c3.time.getTime() + BEARING_LEAD_MS);
  if (!before || !after) return null;

  // El rumb cap al punt on és el centre de l'ombra un minut abans de la teva
  // totalitat és, amb molt bona aproximació, la direcció per on te la veuràs
  // venir.
  const arrivalBearing = bearingDeg(lat, lon, before.lat, before.lon);
  const departureBearing = bearingDeg(lat, lon, after.lat, after.lon);

  // Velocitat instantània: interval curt centrat al màxim.
  const maxMs = max.time.getTime();
  const s0 = centralLineAt(eclipseId, maxMs - SPEED_HALF_WINDOW_MS);
  const s1 = centralLineAt(eclipseId, maxMs + SPEED_HALF_WINDOW_MS);
  if (!s0 || !s1) return null;

  const km = approxDistanceKm(s0.lat, s0.lon, s1.lat, s1.lon);
  const hours = (s1.timeMs - s0.timeMs) / 3_600_000;
  const speedKmh = hours > 0 ? km / hours : 0;

  // Vint segons abans de C2: prou perquè el contrast ja hi sigui, prou tard
  // perquè no et passis un minut mirant una cosa que encara no arriba.
  const watchFromUtc = new Date(c2.time.getTime() - 20_000);

  const sunAltitudeDeg = max.sun.altitudeApparent;

  return {
    arrivalBearing,
    departureBearing,
    speedKmh,
    // Per sobre d'aquest llindar la xifra ja no informa de res: som al tram on
    // l'ombra abandona la Terra.
    speedDiverging: speedKmh > 20_000 || sunAltitudeDeg < 4,
    watchFromUtc,
    // Per sota d'uns vuit graus el capvespre ja domina l'horitzó de ponent i
    // la paret d'ombra s'hi confon.
    lowSunCaveat: sunAltitudeDeg < 8,
    sunAltitudeDeg,
  };
}

/**
 * Quant triga l'ombra a passar-te per sobre de punta a punta.
 *
 * No és el mateix que la durada de la teva totalitat: això és el temps que la
 * franja sencera —els seus 290 km d'amplada— triga a travessar el teu punt, i
 * és el que explica per què a cent quilòmetres de tu encara hi ha ple sol
 * mentre tu ets a les fosques.
 */
export function bandCrossingSeconds(
  bandWidthKm: number,
  speedKmh: number,
): number | null {
  if (speedKmh <= 0) return null;
  return (bandWidthKm / speedKmh) * 3600;
}
