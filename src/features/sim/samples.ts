/**
 * Les mostres del recorregut del Sol durant l'eclipsi, com a funció pura.
 *
 * PER QUÈ SURT DE `SimulationView`. Estava dins d'un `useMemo` del component, o
 * sigui que l'única manera d'obtenir el recorregut d'un punt era muntar la
 * pantalla de la simulació sencera. La miniatura de l'historial
 * (`features/share/thumbnail.ts`) necessita exactament el mateix recorregut per
 * a vuit punts que no es pinten enlloc, i la targeta compartible també. Copiar
 * el bucle hauria estat el començament de dues corbes que divergeixen: n'hi ha
 * prou que una faci servir 240 mostres i l'altra 241 perquè la miniatura i el
 * gràfic gran no acabin al mateix lloc.
 *
 * Aquí no hi ha res del DOM ni de React: es pot provar en entorn Node, que és
 * on corren els tests d'aquest projecte.
 */

import { sampleAt } from '../../core/astro/ephemeris';
import type {
  EclipseSample,
  GeoLocation,
  LocalCircumstances,
} from '../../core/astro/types';

/**
 * Nombre de mostres del recorregut a la pantalla de simulació.
 *
 * 240 dona una corba suau sense penalitzar. També és el nombre de passos de la
 * barra de temps: la barra i la corba comparteixen graella a posta, perquè el
 * marcador de l'instant actual caigui sempre damunt d'una mostra i no entre
 * dues.
 */
export const TRAJECTORY_SAMPLES = 240;

/**
 * Mostres de la miniatura.
 *
 * D'ON SURT EL 48. La miniatura fa uns 56 px d'ample: amb 240 mostres es
 * dibuixarien cinc segments per píxel, o sigui quatre efemèrides de cada cinc
 * llençades. 48 deixa un segment per píxel i prou, i el que es veu és el mateix.
 * Importa perquè l'historial en pinta vuit alhora mentre s'obre una fulla.
 */
export const MINI_TRAJECTORY_SAMPLES = 48;

/**
 * La finestra que cobreix el recorregut: de C1 a C4.
 *
 * Quan no hi ha contactes parcials —un punt des d'on l'eclipsi no arriba a
 * començar abans de la posta, o un catàleg sense C1— la finestra es col·lapsa
 * al màxim. Qui la rep ha de saber tractar `startMs === endMs`.
 */
export function trajectoryWindowMs(circumstances: LocalCircumstances): {
  startMs: number;
  endMs: number;
} {
  const { c1, c4, max } = circumstances.contacts;
  return {
    startMs: (c1 ?? max).time.getTime(),
    endMs: (c4 ?? max).time.getTime(),
  };
}

/**
 * Els instants de mostreig, repartits uniformement i amb els dos extrems
 * inclosos. `count` és el nombre d'INTERVALS, no de punts: en surten `count + 1`.
 *
 * Va a part de `trajectorySamples` perquè és l'única part que es pot comprovar
 * sense cridar efemèrides: que el primer instant sigui exactament C1, l'últim
 * exactament C4 i que no hi hagi acumulació d'error al mig.
 */
export function sampleTimesMs(
  startMs: number,
  endMs: number,
  count: number,
): number[] {
  const steps = Math.max(1, Math.round(count));
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    // Interpolació sobre l'índex i no acumulació d'un pas: sumar `dt` 240
    // vegades desplaça l'últim instant respecte de C4.
    out.push(startMs + ((endMs - startMs) * i) / steps);
  }
  return out;
}

/**
 * El recorregut sencer: una mostra d'efemèrides per instant.
 *
 * L'ATMOSFERA VE DE LES CIRCUMSTÀNCIES i no del valor per defecte de
 * `sampleAt`. Avui donen el mateix —les dues bandes cauen a `STANDARD_ATMOSPHERE`
 * quan ningú diu res—, però l'altura APARENT del Sol depèn de la refracció, i
 * és l'altura aparent la que es compara amb el perfil del terreny per decidir
 * si una carena et tapa la totalitat. Que els contactes es calculin amb una
 * atmosfera i la corba amb una altra és la mena de discrepància que només es
 * nota el dia que algú toqui el valor per defecte.
 *
 * La ubicació es passa a part perquè és el paràmetre que de veritat mana; ha de
 * ser la mateixa amb què s'han calculat les circumstàncies.
 */
export function trajectorySamples(
  circumstances: LocalCircumstances,
  location: GeoLocation,
  count: number = TRAJECTORY_SAMPLES,
): EclipseSample[] {
  const { startMs, endMs } = trajectoryWindowMs(circumstances);

  // Sense finestra no hi ha corba: es torna el màxim tot sol, que és l'única
  // mostra que existeix segur. Retornar una llista buida faria que el
  // renderitzador no dibuixés res i la vista es quedés en negre sense explicar
  // per què.
  if (endMs <= startMs) return [circumstances.contacts.max];

  return sampleTimesMs(startMs, endMs, count).map((tMs) =>
    sampleAt(new Date(tMs), location, circumstances.atmosphere),
  );
}
