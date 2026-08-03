/**
 * De xifra a paraula: l'únic pont autoritzat.
 *
 * ── PER QUÈ ÉS UN MÒDUL I NO TRES LÍNIES A CADA CRIDA ───────────────────────
 *
 * Perquè la porta (`sanitize.ts`) no admet números, i per tant CADA punt de
 * crida hauria de convertir els seus. Amb els llindars escrits a mà a cada
 * lloc passarien dues coses, totes dues garantides: que dos llocs partirien la
 * mateixa escala per llocs diferents —i llavors les columnes del panell no es
 * poden sumar—, i que algú amb pressa se saltaria la conversió i passaria el
 * número directament, que és precisament el gest que la porta ha d'aturar. Amb
 * les franges aquí, el camí fàcil i el camí correcte són el mateix.
 *
 * ── ELS TIPUS SURTEN DEL VOCABULARI, NO A L'INREVÉS ─────────────────────────
 *
 * Cada funció d'aquí retorna EL TIPUS DECLARAT a `vocabulary.ts`, llegit d'allà
 * amb `AnalyticsParams`. Si algú afegeix una franja a la taula i no la
 * contempla aquí, no compila. És el mateix truc que fa servir `App.tsx` per no
 * tenir dues taules de rutes que un dia divergeixen.
 *
 * ── I PER QUÈ LES FRANGES SÓN TAN GRUIXUDES ─────────────────────────────────
 *
 * Perquè una durada fina ÉS una ubicació. La durada de la fase central en un
 * eclipsi donat és una funció contínua del lloc: 97,3 s dibuixa una corba
 * estreta sobre el mapa, i creuada amb dues o tres sessions més acaba assenyalant
 * un punt. «Entre un i dos minuts» és una regió de desenes de milers de
 * quilòmetres quadrats i no assenyala res. La granularitat que hi perdem no
 * canviaria cap decisió; la que hi guanyem és la promesa del peu.
 */

import type { AnalyticsParams } from './vocabulary';

/** Les franges d'espera, tal com les declara el vocabulari. */
export type WaitBucket = AnalyticsParams<'heat_render'>['wait'];
/** Les franges de durada de la fase central. */
export type DurationBucket = AnalyticsParams<'verdict_shown'>['duration'];
/** Què fa el relleu amb la fase central. */
export type TerrainBucket = AnalyticsParams<'verdict_shown'>['terrain'];
/** On queia, a la llista, el lloc que s'ha triat. */
export type RankBucket = AnalyticsParams<'spot_pick'>['rank'];

/**
 * Quant s'ha esperat, en paraules.
 *
 * Els llindars (1 s, 5 s, 15 s) no són rodons per casualitat: un segon és el
 * límit per sota del qual una espera no es percep com a espera; cinc és on la
 * gent comença a tocar altres coses; quinze és on la cerca de llocs viu de
 * ple (6,1 s a Sòria, 14,5 s a Barcelona, mesurats) i on cal saber si algú
 * arriba al final.
 *
 * UNA MESURA IMPOSSIBLE ES DIU `unknown` i no s'arrodoneix cap avall: un NaN
 * comptat com a «menys d'un segon» faria que el mapa de calor semblés més
 * ràpid del que és, i aquesta app no infla xifres ni les seves.
 */
export function waitBucket(ms: number): WaitBucket {
  if (!Number.isFinite(ms) || ms < 0) return 'unknown';
  if (ms < 1_000) return 'under_one_s';
  if (ms < 5_000) return 'one_to_five_s';
  if (ms < 15_000) return 'five_to_fifteen_s';
  return 'over_fifteen_s';
}

/**
 * Quants segons de fase central, en paraules.
 *
 * `none` és literalment «cap segon de fase central», que és el que passa fora
 * de la franja i el que ha de passar amb un número que no es pot llegir: val
 * més comptar de menys que inventar una franja llarga que no s'ha mesurat.
 */
export function durationBucket(seconds: number): DurationBucket {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'none';
  if (seconds < 60) return 'under_one_min';
  if (seconds < 120) return 'one_to_two_min';
  return 'over_two_min';
}

/**
 * Què li fa el relleu a la fase central d'aquest punt.
 *
 * Compara la durada TEÒRICA (`circumstances.centralDurationSec`) amb la que
 * sobreviu al perfil d'horitzó (`verdict.centralVisibleSec`). És la xifra que
 * distingeix aquesta app de totes les altres, i la única raó per la qual
 * l'esdeveniment `verdict_shown` existeix.
 *
 * SENSE FASE CENTRAL NO ÉS `clear`, ÉS `unknown`. En un eclipsi parcial no hi
 * ha res que el relleu pugui robar d'aquesta magnitud, i comptar-ho com «el
 * terreny no molesta» ompliria la columna bona amb casos que no diuen res
 * d'ella. La mitja tolerància de segon absorbeix l'arrodoniment de l'escombrada
 * segon a segon de `computeVisibility`, que no pot donar un empat exacte.
 */
export function terrainBucket(
  theoreticalSec: number | null,
  visibleSec: number | null,
): TerrainBucket {
  if (
    theoreticalSec === null ||
    visibleSec === null ||
    !Number.isFinite(theoreticalSec) ||
    !Number.isFinite(visibleSec)
  ) {
    return 'unknown';
  }
  if (theoreticalSec <= 0) return 'unknown';
  if (visibleSec <= 0) return 'blocked';
  if (visibleSec >= theoreticalSec - 0.5) return 'clear';
  return 'trimmed';
}

/**
 * On queia el resultat triat.
 *
 * L'índex és de base zero, com la llista. Es reparteix en primer / dins dels
 * tres primers / la resta perquè el que ha de decidir és si la nostra
 * puntuació encerta, i per a això «el quart o més avall» ja és tota la
 * resposta. El número exacte, amb prou resultats i prou sessions, comença a
 * dir quin lloc era.
 */
export function rankBucket(index: number): RankBucket {
  if (!Number.isFinite(index) || index < 0) return 'rest';
  if (index === 0) return 'first';
  if (index < 3) return 'top_three';
  return 'rest';
}

/**
 * El codi de fallada de l'horitzó, en la forma que la porta accepta.
 *
 * PER QUÈ CAL TRADUIR-LO. Els codis del nucli (`core/horizon/errors.ts`)
 * s'escriuen amb guionet —`tiles-incomplete`, `no-terrain`— perquè és com
 * s'escriuen els identificadors d'aquell mòdul. La porta de privadesa només
 * deixa passar lletres, xifres i guions baixos, i això no s'afluixa per una
 * mètrica: la regla estreta és la que fa impossible que hi passi una
 * coordenada. Es tradueix aquí, un sol cop i a la vista de tothom, en comptes
 * de relaxar `sanitize.ts` o de repetir el `replace` a cada crida.
 *
 * `cancelled` no és cap fallada i retorna `null`: qui cancel·la ja no volia el
 * resultat, i comptar-lo com a avaria inflaria l'única xifra que ha de servir
 * per decidir si el càlcul del terreny s'aguanta al camp.
 */
export function horizonReason(
  code: 'cancelled' | 'tiles-incomplete' | 'no-terrain' | 'unknown' | 'worker',
): 'tiles_incomplete' | 'no_terrain' | 'worker' | 'unknown' | null {
  switch (code) {
    case 'cancelled':
      return null;
    case 'tiles-incomplete':
      return 'tiles_incomplete';
    case 'no-terrain':
      return 'no_terrain';
    case 'worker':
      return 'worker';
    default:
      return 'unknown';
  }
}
