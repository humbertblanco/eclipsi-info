/**
 * Puntuació d'un lloc.
 *
 * Quatre termes, tots normalitzats de 0 a 1, i uns pesos que sumen 1. La nota
 * final va de 0 a 100. Els pesos són una decisió editorial i s'han d'entendre,
 * no ajustar a ull, així que aquí hi ha el perquè de cada un.
 *
 * ── 0,60 · SEGONS DE FASE CENTRAL REALMENT VISIBLES ─────────────────────────
 *
 * Mana, i per força. És l'única cosa que no es pot recuperar: un cel tapat es
 * pot obrir, un lloc lleig es pot aguantar, però la totalitat que se't menja
 * una carena no torna. La resta de termes decideixen empats.
 *
 * Es normalitza contra la MILLOR durada teòrica de tota la zona de cerca, no
 * contra la del propi candidat. Si es fes contra la pròpia, un lloc amb 10 s de
 * totalitat vistos sencers puntuaria més que un amb 100 s dels quals se'n
 * perden 5 — que és exactament el consell contrari del bo.
 *
 * ── 0,20 · MARGE DE L'HORITZÓ SOTA EL SOL ───────────────────────────────────
 *
 * És l'assegurança, i el terme que separa aquest cercador d'un full de càlcul.
 *
 * Dos llocs poden donar tots dos el 100 % de la totalitat, un amb 0,05° de
 * marge sobre la carena i l'altre amb 2°. No són el mateix lloc ni de bon tros.
 * Les tessel·les del model són de TERRENY NU: no hi ha ni arbres ni edificis, i
 * una filera de pollancres a 500 m val 2°. El model té metres d'error vertical.
 * La refracció terrestre que fem servir (k = 0,13) puja a 0,25 en una inversió
 * tèrmica i baixa en una tarda calorosa. Amb 0,05° de marge, qualsevol
 * d'aquestes tres coses et deixa sense eclipsi; amb 2°, cap.
 *
 * Es satura a `CLEARANCE_FULL_DEG` = 1,5°, que és on el marge ja cobreix tots
 * tres efectes junts. Per damunt no s'hi guanya res i seguir premiant faria
 * pujar cims innecessàriament lluny.
 *
 * ── 0,15 · PROXIMITAT ───────────────────────────────────────────────────────
 *
 * Un lloc perfecte a 40 km, el dia de l'eclipsi, amb trànsit i sense
 * aparcament, no és un lloc perfecte. El terme val 1 on ets i 0 a la vora del
 * radi de cerca, de manera lineal. Lineal i no quadràtic perquè el cost real de
 * desplaçar-se també ho és a aquestes distàncies.
 *
 * Es queda en 0,15 i no més: si pesés massa, el cercador et recomanaria el teu
 * propi carrer, que és justament la resposta que ja tenies.
 *
 * ── 0,05 · ALTURA GUANYADA ──────────────────────────────────────────────────
 *
 * Pujar és bo per raons que els altres termes no capturen: per damunt de la
 * vall hi ha menys boira i menys calitja, els arbres i les cases que el model
 * no coneix queden més avall, i l'error de la cota del model pesa relativament
 * menys. Però la major part del benefici de ser alt JA ÉS DINS del marge
 * d'horitzó, i comptar-lo dues vegades faria que el cercador enviés la gent al
 * cim més alt encara que un turó de la vora ja fos perfecte. Per això és el pes
 * més petit dels quatre.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en un Worker o en Node.
 */

import type { SpotScoreParts, SpotScoreWeights } from './types';

export const DEFAULT_SPOT_WEIGHTS: SpotScoreWeights = {
  centralSeconds: 0.6,
  clearance: 0.2,
  closeness: 0.15,
  altitude: 0.05,
};

/** Marge d'horitzó a partir del qual el terme d'assegurança ja val 1. */
export const CLEARANCE_FULL_DEG = 1.5;

/**
 * Desnivell, en metres, que fa valer 1 el terme d'altura.
 *
 * Tres-cents metres per damunt d'on ets és el salt típic entre el fons d'una
 * vall i el coll o el turó que la domina. Més amunt el guany real s'aplana i
 * el que creix és el temps de conducció, que ja penalitza la proximitat.
 */
export const ALTITUDE_FULL_M = 300;

/**
 * Metres per sota dels quals el terme d'altura val 0. Baixar cap al fons de la
 * vall és el moviment equivocat i el marcador ho ha de dir.
 */
export const ALTITUDE_ZERO_M = -100;

export interface SpotScoreInput {
  /** Segons de fase central que es veuen de debò des del candidat. */
  centralVisibleSec: number;
  /** Millor durada teòrica de fase central de tota la zona de cerca, en segons. */
  bestCentralSec: number;
  /** Marge mínim del centre del Sol sobre el terreny durant la fase central, en graus. */
  clearanceDeg: number;
  distanceKm: number;
  /** Radi de la cerca, en km. És on el terme de proximitat val 0. */
  radiusKm: number;
  /** Cota del candidat, en metres. */
  elevationM: number;
  /** Cota d'on ets ara, en metres. */
  originElevationM: number;
  weights?: SpotScoreWeights;
}

export interface SpotScore {
  /** Nota de 0 a 100. */
  score: number;
  parts: SpotScoreParts;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Nota d'un candidat.
 *
 * Quan `bestCentralSec` és zero — dins del radi no hi arriba la franja — el
 * primer terme val 0 per a tothom i la classificació la decideixen l'horitzó i
 * la distància. És el comportament honest: no hi ha totalitat a repartir i el
 * marcador no se la pot inventar. Qui crida ha de dir-ho a l'usuari.
 */
export function scoreSpot(input: SpotScoreInput): SpotScore {
  const weights = input.weights ?? DEFAULT_SPOT_WEIGHTS;

  const centralSeconds =
    input.bestCentralSec > 0
      ? clamp01(input.centralVisibleSec / input.bestCentralSec)
      : 0;

  const clearance = clamp01(input.clearanceDeg / CLEARANCE_FULL_DEG);

  const closeness =
    input.radiusKm > 0 ? clamp01(1 - input.distanceKm / input.radiusKm) : 1;

  const gainM = input.elevationM - input.originElevationM;
  const altitude = clamp01(
    (gainM - ALTITUDE_ZERO_M) / (ALTITUDE_FULL_M - ALTITUDE_ZERO_M),
  );

  const parts: SpotScoreParts = { centralSeconds, clearance, closeness, altitude };

  const total =
    weights.centralSeconds * centralSeconds +
    weights.clearance * clearance +
    weights.closeness * closeness +
    weights.altitude * altitude;

  const weightSum =
    weights.centralSeconds + weights.clearance + weights.closeness + weights.altitude;

  return {
    score: weightSum > 0 ? (100 * total) / weightSum : 0,
    parts,
  };
}

/**
 * Ordre de la llista final.
 *
 * A igualtat de nota guanya el més a prop: el desempat ha de ser el criteri
 * que l'usuari pot comprovar tot sol i que no depèn de cap model.
 */
export function compareSpots(
  a: { score: number; distanceKm: number },
  b: { score: number; distanceKm: number },
): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.distanceKm - b.distanceKm;
}
