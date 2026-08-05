/**
 * Tipus del programador d'avisos del dia de l'eclipsi.
 *
 * Aquest mòdul (i tot `src/core/timer/**`) no toca el DOM: ha de poder córrer
 * en un Worker i sota Node per als tests. Per això declara el seu propi tipus
 * d'idioma en comptes d'importar-lo de `src/i18n`, que arrossega React.
 */

/** Els mateixos dos idiomes que `src/i18n`, sense dependre'n. */
export type TimerLocale = 'ca' | 'es' | 'en';

/** Text que s'ha de dir o ensenyar, en els dos idiomes. */
export interface LocalisedText {
  ca: string;
  es: string;
  en: string;
}

/** Contacte de referència d'un avís. */
export type ContactId = 'c1' | 'c2' | 'max' | 'c3' | 'c4';

/**
 * Àncora d'un avís. Els avisos reals pengen d'un contacte; les locucions de
 * context del mode d'assaig no pengen de res i tenen la seva pròpia àncora,
 * perquè no es puguin confondre amb una fita de l'eclipsi.
 */
export type AlertAnchor = ContactId | 'rehearsal';

/**
 * Gravetat de l'avís.
 *
 * `safety` NO és una etiqueta decorativa: el reproductor està obligat a
 * emetre'n el to encara que la veu no estigui disponible, a no encavalcar-lo
 * amb res i a no deixar-lo mai en cua darrere d'un avís informatiu.
 */
export type AlertSeverity = 'info' | 'safety';

/**
 * Què diu l'avís. Serveix per decidir com es presenta (color, to, prioritat) i
 * per als tests, que comproven presència i absència de tipus concrets.
 */
export type AlertKind =
  /** Compte enrere abans del primer contacte (10, 5 i 1 minut). */
  | 'c1-countdown'
  /** El primer contacte, ja passat. */
  | 'c1'
  /** Compte enrere cap a la fase central (encara amb filtre posat). */
  | 'c2-countdown'
  /**
   * Comença la fase central en un cas en què el filtre NO es treu: anularitat,
   * o totalitat que des d'aquest punt no es pot garantir.
   */
  | 'central-start'
  /**
   * L'únic avís de tota l'aplicació que autoritza a treure's el filtre.
   * Només es genera si `canRemoveFilter` ho aprova.
   */
  | 'filter-off'
  /** Temps que queda de fase central, sense implicació de seguretat. */
  | 'central-remaining'
  /** Avís de SEGURETAT: torna a posar-te el filtre abans que aparegui el Sol. */
  | 'filter-on'
  /** El Sol ja ha tornat: recordatori que el filtre es queda posat. */
  | 'sun-returned'
  /** Màxim de l'eclipsi (el que es fa servir quan no hi ha fase central). */
  | 'max'
  /** Quart contacte: s'ha acabat. */
  | 'c4'
  /** Locució de context del mode d'assaig, no correspon a cap fita real. */
  | 'rehearsal-note'
  /**
   * Fita del guió de la totalitat (`src/content/totality-script.ts`): què has
   * de mirar i quan.
   *
   * És contingut, no seguretat. Les fites del guió que SÍ que toquen el filtre
   * no fan servir aquest tipus sinó `filter-off` i `filter-on`, precisament
   * perquè el reproductor i la fusió amb la programació real les puguin
   * distingir sense llegir cap text.
   */
  | 'script-cue';

/** Un avís concret, amb el seu instant absolut i el seu text. */
export interface VoiceAlert {
  /** Identificador estable i únic dins d'una programació. */
  id: string;
  /** Instant en què s'ha de dir, en mil·lisegons des de l'època (UTC). */
  atMs: number;
  /** Fita respecte de la qual es defineix. */
  anchor: AlertAnchor;
  /** Desplaçament respecte de l'àncora, en segons. Negatiu = abans. */
  offsetSec: number;
  kind: AlertKind;
  severity: AlertSeverity;
  /**
   * Finestra, en mil·lisegons, durant la qual encara és CORRECTE dir-ho tard.
   *
   * Existeix perquè el navegador pot congelar la pestanya (pantalla apagada,
   * canvi d'aplicació) i despertar-se amb avisos pendents. Dir «quinze segons
   * per al tercer contacte» tres segons DESPRÉS del tercer contacte no és un
   * retard: és informació falsa en el moment més perillós. Passada la finestra,
   * l'avís es descarta en comptes d'emetre's.
   */
  validForMs: number;
  /** Text per llegir en veu alta. */
  speech: LocalisedText;
  /** Etiqueta curta per a la pantalla. */
  label: LocalisedText;
}

/**
 * Per què no s'emeten els avisos de treure's el filtre.
 *
 * Es torna sempre, encara que el motiu sigui `ok`, perquè la interfície pugui
 * explicar-ho i perquè els tests puguin distingir «no hi ha avís perquè no toca»
 * de «no hi ha avís perquè s'ha perdut pel camí».
 */
export type FilterGateReason =
  /** Es pot treure: hi ha totalitat de veritat des d'aquest punt. */
  | 'ok'
  /** Des d'aquí no hi ha eclipsi. */
  | 'no-eclipse'
  /** Només fase parcial: sempre queda fotosfera a la vista. */
  | 'partial-only'
  /** Anular: l'anell és fotosfera pura. El filtre no es treu mai. */
  | 'annular'
  /** Hi hauria d'haver fase central però falten C2 o C3. */
  | 'missing-central-contacts'
  /**
   * Ets al caire de la franja, on el motor NO pot decidir si hi haurà fase
   * central. Vegeu `edgeUncertain` a `LocalCircumstances`: el marge geomètric
   * que separa veure la totalitat de no veure-la hi és més petit que l'error
   * de posició de les efemèrides. Amb la resposta a l'aire, no s'autoritza
   * treure cap filtre.
   */
  | 'edge-uncertain'
  /**
   * La totalitat calculada és tan curta que ets pràcticament damunt del límit
   * de la franja, on la incertesa del perfil lunar supera la durada.
   */
  | 'totality-too-short'
  /** El terreny tapa la fase central des d'aquest punt. */
  | 'central-blocked-by-terrain';

/** Resultat de la comprovació de seguretat, amb el motiu sempre explícit. */
export interface FilterGate {
  allowed: boolean;
  reason: FilterGateReason;
  /** Durada de la fase central considerada, en segons. Zero si no n'hi ha. */
  centralDurationSec: number;
}

/** Programació completa d'avisos per a un lloc i un eclipsi. */
export interface AlertSchedule {
  /** Avisos ordenats per instant creixent. */
  alerts: VoiceAlert[];
  /** Resultat de la comprovació de seguretat que autoritza treure el filtre. */
  filterGate: FilterGate;
  /** Cert si és una programació d'assaig i no els avisos reals. */
  rehearsal: boolean;
}

/** Fase en què es troba l'esdeveniment respecte de l'instant actual. */
export type TimerPhase =
  /** Encara no ha començat res. */
  | 'before'
  /** Fase parcial creixent: entre C1 i la fase central (o el màxim). */
  | 'partial-rising'
  /** Dins de la fase central (totalitat o anularitat). */
  | 'central'
  /** Fase parcial decreixent: entre la fase central (o el màxim) i C4. */
  | 'partial-falling'
  /** Ja s'ha acabat. */
  | 'after';

/** Cap a on compta el rellotge en aquest moment. */
export interface CountdownTarget {
  phase: TimerPhase;
  /** Contacte cap al qual es compta. `undefined` quan ja no queda res. */
  anchor?: ContactId;
  /** Instant de l'objectiu, en ms des de l'època. */
  atMs?: number;
  /** Temps que hi falta, en mil·lisegons. Mai negatiu. */
  remainingMs: number;
  /** Etiqueta del que s'està comptant. */
  label: LocalisedText;
}

/** Instants dels contactes en ms des de l'època. `max` sempre existeix. */
export interface ContactTimesMs {
  c1?: number;
  c2?: number;
  max: number;
  c3?: number;
  c4?: number;
}
