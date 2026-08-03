/**
 * Què ha arribat a ancorar una sessió de càmera, resumit en una paraula.
 *
 * ── PER QUÈ ÉS UN MÒDUL A PART I NO TRES LÍNIES DINS D'`ARView` ─────────────
 *
 * Perquè `ARView.tsx` fa 90 kB i no té ni una prova: tot el que s'hi escriu
 * queda fora de la xarxa. Això d'aquí és una acumulació monòtona i una taula de
 * precedències —lògica pura, sense DOM i sense React—, i traient-la fora es pot
 * provar a Node amb la resta del nucli. La regla del projecte és la de sempre:
 * les parts pures es proven, el pintar queda al protocol manual.
 *
 * ── PER QUÈ NO SERVEIX `anchorSourceRef` I CALIA ACUMULAR ───────────────────
 *
 * `ARView` ja porta un `anchorSourceRef` amb qui mana l'àncora ARA, i seria el
 * que tothom agafaria. No serveix per a dues raons independents:
 *
 *   · ÉS INSTANTANI I CADUCA. Als `ANCHOR_MAX_AGE_MS` sense cap fix torna a
 *     `null`. Llegit al tancament diria «cap àncora» de gairebé totes les
 *     sessions, perquè el gest normal d'acabar és abaixar el braç: l'última
 *     cosa que veu la càmera abans que la tanquis és el terra. L'esdeveniment
 *     `camera_session` pregunta si l'ancoratge S'ARRIBA A ENGANXAR mai en
 *     aparells de debò, i per a això el que compta és el màxim de la sessió, no
 *     el que passava a l'últim fotograma.
 *   · CONFON LA LLUNA AMB EL SOL. Quan hi ha astre i terreny alhora val
 *     `'both'`, i llavors ja no es pot saber quin astre era. Per això aquí
 *     s'acumulen els FETS CRUS del fotograma (quin astre ha ancorat, si el
 *     terreny hi era) i la paraula es decideix al final, un sol cop.
 *
 * ── LA PRECEDÈNCIA, I PER QUÈ EL SOL GUANYA LA LLUNA ────────────────────────
 *
 * Una sessió pot haver ancorat de tres maneres al llarg de la seva vida i només
 * n'envia una paraula. L'ordre és: terreny + qualsevol astre → `both`; si no,
 * Sol; si no, Lluna; si no, terreny; si no, `none`. El Sol passa davant de la
 * Lluna perquè és la condició de llum que decideix el dia de l'eclipsi — la
 * Lluna sobre cel negre és el cas fàcil, i una sessió que hagi encertat les
 * dues coses ha demostrat la difícil.
 */

import type { AnalyticsParams } from '../../core/analytics';

/** La paraula que el vocabulari declara per a l'àncora d'una sessió. */
export type SessionAnchor = AnalyticsParams<'camera_session'>['anchor'];

/** Quin astre ha posat el fix d'aquest fotograma, si n'hi ha posat cap. */
export type AnchorBody = 'sun' | 'moon';

/** Els fets d'un fotograma que ha arribat a ancorar. */
export interface AnchorFrame {
  /** L'astre que hi ha entrat, o `null` si el fix era només de terreny. */
  readonly body: AnchorBody | null;
  /** Si la silueta del terreny hi ha entrat (i era fresca). */
  readonly terrain: boolean;
}

/** El que una sessió ha vist fins ara. Només creix. */
export interface AnchorsSeen {
  readonly sun: boolean;
  readonly moon: boolean;
  readonly terrain: boolean;
}

/** Com arrenca tota sessió: sense haver ancorat res. */
export const NO_ANCHORS_SEEN: AnchorsSeen = {
  sun: false,
  moon: false,
  terrain: false,
};

/**
 * Suma un fotograma al que la sessió ja havia vist.
 *
 * MAI RESTA. Un fotograma sense àncora no esborra res, igual que dins de la
 * fusió un miss aïllat no és una pèrdua: la pregunta és si allò s'ha arribat a
 * enganxar mai, i una resposta que oscil·li amb l'últim fotograma no la
 * contesta. Retorna l'objecte d'entrada quan no hi ha res de nou, que al bucle
 * de dibuix estalvia una assignació per fotograma a 30 Hz.
 */
export function foldAnchors(seen: AnchorsSeen, frame: AnchorFrame): AnchorsSeen {
  const sun = seen.sun || frame.body === 'sun';
  const moon = seen.moon || frame.body === 'moon';
  const terrain = seen.terrain || frame.terrain;
  if (sun === seen.sun && moon === seen.moon && terrain === seen.terrain) return seen;
  return { sun, moon, terrain };
}

/**
 * La paraula final de la sessió. Vegeu la precedència a la capçalera.
 */
export function sessionAnchor(seen: AnchorsSeen): SessionAnchor {
  const body = seen.sun || seen.moon;
  if (body && seen.terrain) return 'both';
  if (seen.sun) return 'sun';
  if (seen.moon) return 'moon';
  if (seen.terrain) return 'terrain';
  return 'none';
}
