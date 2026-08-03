/**
 * Tipus del rellotge de simulació: què és un estat de reproducció d'eclipsi.
 *
 * PER QUÈ SÓN AQUÍ I NO DINS DEL COMPONENT. La línia de temps l'han de compartir
 * tres pantalles que avui tenen tres rellotges diferents: la simulació
 * (`features/sim`), el cel amb la càmera (`features/ar`, que ja rep `timeMs` i
 * `onTimeChange` del pare) i el mapa (el con de visió de
 * `features/map/layers/viewCone.ts` accepta un `timeMs` opcional des del primer
 * dia esperant justament això). Si l'estat viu dins d'un component, la segona
 * pantalla que el vulgui se'l copia, i a la tercera ja hi ha tres definicions de
 * «quin instant s'està mirant» que divergeixen el dia que una afegeix un cas.
 *
 * TOT SÓN MIL·LISEGONS D'ÈPOCA, mai `Date`. Els objectes `Date` no es poden
 * comparar amb `===`, i aquest estat s'ha de poder comparar per identitat perquè
 * React no repinti quan no ha canviat res. La conversió a `Date` és cosa de qui
 * dibuixa.
 *
 * `TimerLocale` i `ContactTimesMs` es reaprofiten de `core/timer`: els contactes
 * d'un eclipsi ja tenen una forma canònica en aquest projecte i inventar-ne una
 * segona seria com tenir dues taules d'efemèrides a la mateixa pantalla.
 */

import type { ContactId, ContactTimesMs } from '../timer/types';

export type { ContactId, ContactTimesMs };

/** La finestra que es pot recórrer. Normalment de C1 a C4. */
export interface TimelineWindow {
  startMs: number;
  endMs: number;
}

/** Una fita saltable dins de la finestra: els cinc contactes clàssics. */
export interface TimelineMark {
  id: ContactId;
  atMs: number;
}

/**
 * Els factors de velocitat, els mateixos que fa servir la competència
 * (app.treseclipses.es): 1×, 60×, 300× i 600×.
 *
 * NO SÓN QUATRE VELOCITATS PER MIRAR, i això s'ha mesurat. La finestra C1-C4
 * dels tres eclipsis del catàleg va de 104,5 min (2026 des de Palma) a 149,2 min
 * (2028 des de Burgos). O sigui:
 *
 *   · 1×   — temps real.
 *   ·  60× — l'eclipsi sencer en 105-149 s.
 *   · 300× — en 21-30 s.
 *   · 600× — en 10,5-15 s.
 *
 * I la totalitat del 2026 des de Palma dura 96,1 s: a 600× són 0,16 s, menys de
 * deu fotogrames. Les velocitats altes serveixen per ARRIBAR-HI, no per
 * mirar-la. Qui vulgui veure la fase central hi salta amb el botó del contacte i
 * la mira a 1×. La interfície ho ha de deixar clar, i per això `TimelineControls`
 * posa els salts a contacte al costat de les velocitats i no en una altra fila.
 */
export const PLAYBACK_RATES = [1, 60, 300, 600] as const;

export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

/**
 * D'on surt l'instant que s'està mirant.
 *
 * AIXÒ ÉS SEGURETAT, NO ORNAMENT, i és el motiu pel qual viu dins de l'estat pur
 * i no en un booleic de la vista. Aquesta app té un compte enrere de debò i una
 * veu que autoritza a treure's el filtre solar. El dia de l'eclipsi, algú que
 * ha deixat el simulador a l'hora de la totalitat i creu que està mirant el
 * rellotge de veritat pot decidir treure's el filtre dos minuts abans d'hora.
 *
 * Per això la distinció no és derivable («si l'instant no és el d'ara, deu ser
 * simulació»): a l'hora exacta del màxim els dos instants coincideixen i la
 * regla derivada diria «temps real» justament en el moment que costa un ull.
 * És estat explícit, i qualsevol gest que mogui el temps el commuta a `sim`.
 */
export type TimelineSource = 'live' | 'sim';

/** L'estat sencer d'una reproducció. Es compara per identitat: vegeu `playback.ts`. */
export interface TimelineState {
  /**
   * L'instant que s'està mirant, en ms d'època.
   *
   * ÉS UN FLOTANT A POSTA. A 1× i 60 fotogrames per segon cada fotograma avança
   * 16,67 ms; arrodonir a l'enter a cada pas perdria 0,67 ms per fotograma, que
   * són 40 ms per segon: el simulador aniria un 4 % lent i al cap de mitja hora
   * de reproducció duria set segons de retard sobre el que diu el seu propi
   * factor de velocitat. Qui necessiti un enter (`new Date(...)`) ja el trunca.
   */
  timeMs: number;
  /** Cert mentre la reproducció avança sola. En `live` és sempre fals. */
  playing: boolean;
  rate: PlaybackRate;
  window: TimelineWindow;
  /** Ordenades per instant i sense les que l'eclipsi d'aquest lloc no té. */
  marks: readonly TimelineMark[];
  source: TimelineSource;
}

/**
 * Tot el que pot passar-li a una línia de temps.
 *
 * `frame` porta les DUES dades de temps perquè el reductor no en pugui llegir
 * cap pel seu compte: `deltaMs` és el temps real transcorregut des de l'últim
 * fotograma i `nowMs` l'instant real d'ara. Un reductor que cridés `Date.now()`
 * seria impossible de provar sense simulacres, i aquest mòdul existeix
 * precisament per poder provar els casos lletjos amb números.
 */
export type TimelineAction =
  /** Un fotograma: `deltaMs` de temps real ha passat i ara són `nowMs`. */
  | { type: 'frame'; deltaMs: number; nowMs: number }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  /** Torna al principi de la finestra i comença a reproduir (C1 → C4). */
  | { type: 'replay' }
  | { type: 'setRate'; rate: PlaybackRate }
  /** Gest continu (arrossegar la barra): posiciona i atura. */
  | { type: 'seek'; timeMs: number }
  /** Gest discret (±1 minut): posiciona i NO atura. */
  | { type: 'nudge'; deltaMs: number }
  /** Salt a un contacte. Si aquest eclipsi no el té, no passa res. */
  | { type: 'jump'; mark: ContactId }
  /** Torna al temps real. `nowMs` és l'instant de debò. */
  | { type: 'goLive'; nowMs: number }
  /**
   * Entra a la simulació sense moure res més: l'altra meitat de `goLive`.
   *
   * Existeix perquè el commutador de la interfície tingui les dues direccions
   * escrites amb el mateix nom que fa. Es podria aconseguir amb un `nudge` de
   * zero mil·lisegons —fa exactament això—, i aquell dia el codi de la vista
   * diria «avança zero minuts» allà on l'usuari ha premut «Simulació».
   */
  | { type: 'enterSim' }
  /** Canvi de lloc o d'eclipsi: la finestra i les fites són unes altres. */
  | { type: 'setWindow'; window: TimelineWindow; marks: readonly TimelineMark[] };
