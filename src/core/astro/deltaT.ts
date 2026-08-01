/**
 * ΔT: la diferència entre el temps terrestre (TT) i el temps universal (UT).
 *
 * PER QUÈ AQUEST FITXER EXISTEIX. Les efemèrides es calculen en TT, però on
 * cau l'ombra sobre la Terra depèn de quant ha girat el planeta, que és UT.
 * ΔT és el que lliga les dues coses, i per tant un error en ΔT es tradueix
 * directament en un error en l'hora dels contactes: la Terra gira 15″ per
 * segon, així que cada segon d'error en ΔT desplaça l'ombra uns 460 metres a
 * l'equador i mou les hores locals el mateix segon.
 *
 * EL PROBLEMA. `astronomy-engine` fa servir per defecte el polinomi
 * d'Espenak i Meeus publicat el 2006. Per a l'agost de 2026 aquell polinomi
 * extrapola ΔT = 75,43 s. El valor real, mesurat i predit per l'IERS, és de
 * ~69,2 s: sis segons de diferència. La raó és que el 2006 ningú no podia
 * preveure que la rotació de la Terra s'accelerarien com ho ha fet els últims
 * anys, i el polinomi arrossega la tendència antiga.
 *
 * Contrastat contra JPL Horizons (DE441) per a Sòria el 12-08-2026: amb
 * ΔT = 75,43 s la posició de la Lluna surt desviada 4,43″; amb ΔT = 69,18 s,
 * 1,04″. La desviació de les hores de contacte passava de ~9,4 s a ~3 s.
 *
 * COM ES CALCULA. ΔT = 32,184 s + (TAI − UTC) − (UT1 − UTC).
 *  - 32,184 s és la constant que separa TT de TAI, fixada per definició.
 *  - TAI − UTC són els segons intercalars acumulats: 37 s des del 2017, i no
 *    n'hi ha hagut cap més perquè la Terra ha anat massa de pressa.
 *  - UT1 − UTC és el que publica l'IERS al Bulletin A i el que cal actualitzar.
 *
 * MANTENIMENT. Els valors d'aquesta taula s'han de revisar contra el Bulletin
 * A de l'IERS (https://datacenter.iers.org) abans de cada eclipsi. La
 * predicció a un any vista té una incertesa d'unes dècimes de segon, que per a
 * nosaltres és irrellevant; a deu anys vista ja no ho és.
 */

import * as AstronomyNs from 'astronomy-engine';

const Astronomy = ((AstronomyNs as unknown as { default?: typeof AstronomyNs })
  .default ?? AstronomyNs) as typeof AstronomyNs;

/** 32,184 s (TT − TAI) + 37 s (TAI − UTC des del gener de 2017). */
const TT_MINUS_UTC_BASE = 32.184 + 37;

/**
 * Punts d'ancoratge de ΔT l'1 de gener de cada any, en segons.
 *
 * PROCEDÈNCIA. Extrets del fitxer `finals2000A.all` de l'IERS
 * (https://datacenter.iers.org/data/9/finals2000A.all), descarregat l'1 d'agost
 * de 2026, aplicant ΔT = 32,184 + 37 − (UT1 − UTC) al valor del Bulletin A de
 * l'1 de gener. En aquella descàrrega les dades observades arribaven fins al
 * 30-07-2026 i les prediccions fins al 07-08-2027.
 *
 *   2020-2026 → observats
 *   2027      → predicció de l'IERS
 *   2028-2030 → extrapolació nostra amb el pendent de la predicció de l'IERS
 *               (+0,068 s/any al tram final). A tres anys vista la incertesa
 *               ronda la dècima de segon, que per a nosaltres és irrellevant:
 *               el residu d'efemèrides d'`astronomy-engine` és trenta vegades
 *               més gran.
 *
 * MANTENIMENT. Cal refrescar els valors predits abans de cada eclipsi. Els
 * observats ja no canviaran.
 *
 * COMPTE amb el valor del 2020: no és una continuació suau de la sèrie, perquè
 * el 2020 és justament l'any en què la rotació de la Terra va començar a
 * accelerar-se. Val 69,361 s, no res per sobre de 71.
 */
const ANCHORS: Array<[year: number, deltaT: number]> = [
  [2020.0, 69.361],
  [2021.0, 69.359],
  [2022.0, 69.294],
  [2023.0, 69.204],
  [2024.0, 69.175],
  [2025.0, 69.138],
  [2026.0, 69.110],
  [2027.0, 69.247],
  [2028.0, 69.32],
  [2029.0, 69.38],
  [2030.0, 69.45],
];

/**
 * Comprovació dels tres eclipsis del catàleg contra el valor de l'IERS del dia
 * exacte (la interpolació entre anys deixa un error residual per l'oscil·lació
 * estacional de la rotació terrestre):
 *
 *   2026-08-12  interpolat 69,194 s · IERS 69,173 s → +0,021 s
 *   2027-08-02  interpolat 69,290 s · IERS 69,241 s → +0,049 s
 *   2028-01-26  interpolat 69,324 s · fora de l'abast de l'IERS
 *
 * Cinc centèsimes de segon de ΔT són cinc centèsimes de segon a l'hora del
 * contacte. No val la pena afinar-ho més.
 */

/** Any decimal a partir de la data universal d'astronomy-engine (dies des de J2000). */
function daysToDecimalYear(ut: number): number {
  // J2000.0 = 2000-01-01T12:00 TT. Aquesta aproximació té un error de dies,
  // que per a una magnitud que canvia centèsimes de segon a l'any no compta.
  return 2000 + (ut + 0.5) / 365.25;
}

/**
 * ΔT en segons per a una data universal donada.
 *
 * Dins l'interval de la taula s'interpola linealment. A fora, es delega al
 * polinomi d'Espenak i Meeus, que és perfectament bo per a èpoques llunyanes
 * —que és per a les que va ser dissenyat— i és el que fa servir la NASA a les
 * seves publicacions.
 */
export function deltaTSeconds(ut: number): number {
  const year = daysToDecimalYear(ut);

  const first = ANCHORS[0];
  const last = ANCHORS[ANCHORS.length - 1];
  if (year < first[0] || year > last[0]) {
    return Astronomy.DeltaT_EspenakMeeus(ut);
  }

  for (let i = 1; i < ANCHORS.length; i++) {
    const [y1, d1] = ANCHORS[i];
    if (year <= y1) {
      const [y0, d0] = ANCHORS[i - 1];
      const t = (year - y0) / (y1 - y0);
      return d0 + t * (d1 - d0);
    }
  }
  return last[1];
}

/**
 * Instal·la el model d'ΔT a `astronomy-engine`.
 *
 * És estat global de la biblioteca, així que s'ha de cridar una sola vegada i
 * abans de qualsevol càlcul. `ephemeris.ts` ho fa en carregar-se el mòdul.
 */
let installed = false;
export function installDeltaT(): void {
  if (installed) return;
  installed = true;
  Astronomy.SetDeltaTFunction(deltaTSeconds);
}

/** Per als tests i el diagnòstic: ΔT que fa servir la biblioteca per defecte. */
export function espenakMeeusDeltaT(ut: number): number {
  return Astronomy.DeltaT_EspenakMeeus(ut);
}

/** Segons intercalars acumulats, exposat per si algun dia cal auditar-ho. */
export const TT_MINUS_UTC = TT_MINUS_UTC_BASE;
