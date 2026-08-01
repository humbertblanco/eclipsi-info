/**
 * Generació de la llista d'avisos a partir dels contactes.
 *
 * Entrada: els instants C1-C2-màxim-C3-C4 i el tipus d'eclipsi des d'aquest
 * punt. Sortida: una llista ordenada d'avisos, cadascun amb el seu instant
 * absolut, el seu text en els dos idiomes i la seva finestra de validesa.
 *
 * Tot és pur: cap rellotge, cap temporitzador, cap DOM. Qui compta el temps és
 * `runner.ts`; qui parla és la capa de `features/`. Aquesta separació és el que
 * fa que la part que decideix QUÈ es diu i QUAN es pugui provar sencera en
 * mil·lisegons amb Vitest, incloent-hi el cas que importa: que des d'un punt
 * fora de la franja no es generi mai un avís de treure's el filtre.
 */

import type { EclipseKind, LocalCircumstances } from '../astro/types';
import * as phrases from './phrases';
import type { AlertText, CentralMode } from './phrases';
import { canRemoveFilter, FILTER_OFF_DELAY_SEC } from './safety';
import type {
  AlertAnchor,
  AlertKind,
  AlertSchedule,
  AlertSeverity,
  ContactTimesMs,
  VoiceAlert,
} from './types';

const SEC = 1000;

/** Fites del compte enrere previ al primer contacte, en segons. */
const C1_COUNTDOWN_SEC = [600, 300, 60] as const;
/** Fites del compte enrere previ a la fase central, en segons. */
const CENTRAL_COUNTDOWN_SEC = [60, 10] as const;
/** Temps restant de fase central que s'anuncia, en segons. */
const CENTRAL_REMAINING_SEC = [60, 30] as const;
/**
 * Avisos de SEGURETAT abans del tercer contacte, en segons.
 * Dos i no un: el primer per anar a buscar el filtre, el segon per tenir-lo
 * posat. Un de sol obliga a encertar el temps de reacció de tothom alhora.
 */
const FILTER_ON_WARNING_SEC = [15, 5] as const;
/** Segons després de C3 en què es confirma que el Sol ha tornat. */
const SUN_RETURN_DELAY_SEC = 3;

/**
 * Separació mínima, en ms, entre un avís informatiu i el següent avís de
 * seguretat. Un avís de seguretat no ha d'esperar mai que acabi de parlar-se
 * cap altre.
 */
const SAFETY_CLEARANCE_MS = 1000;

export interface ScheduleInput {
  /** Tipus d'eclipsi DES D'AQUEST PUNT, no el tipus global de l'esdeveniment. */
  kind: EclipseKind;
  contacts: ContactTimesMs;
  /** Obscuració al màxim (0-1). Només s'usa quan no hi ha fase central. */
  maxObscuration?: number;
  /** Cert si el terreny no tapa la fase central. Vegeu `safety.ts`. */
  centralPhaseVisible?: boolean;
  /**
   * Cert quan el motor no pot decidir si des d'aquest punt hi haurà fase
   * central. Ve d'`edgeUncertain` a `LocalCircumstances`.
   *
   * SENSE AIXÒ, LA VEU AUTORITZAVA AL CAIRE DE LA FRANJA. La comporta de
   * `safety.ts` ja el contemplava, però aquest camp no existia i mai no hi
   * arribava: era lletra morta justament al camí que parla el dia mateix.
   */
  edgeUncertain?: boolean;
}

interface AlertSpec {
  id: string;
  atMs: number;
  anchor: AlertAnchor;
  offsetSec: number;
  kind: AlertKind;
  severity: AlertSeverity;
  validForMs: number;
  text: AlertText;
}

function toAlert(spec: AlertSpec): VoiceAlert {
  return {
    id: spec.id,
    atMs: spec.atMs,
    anchor: spec.anchor,
    offsetSec: spec.offsetSec,
    kind: spec.kind,
    severity: spec.severity,
    validForMs: Math.max(0, Math.round(spec.validForMs)),
    speech: spec.text.speech,
    label: spec.text.label,
  };
}

/**
 * Construeix la programació d'avisos.
 *
 * L'ordre de les comprovacions no és casual: la porta de seguretat es consulta
 * ABANS de generar res de la fase central, i el seu resultat és l'única cosa
 * que permet afegir l'avís de treure el filtre. Si algun dia algú afegeix una
 * fita nova, per afegir-hi «treu-te el filtre» haurà de passar per aquí.
 */
export function buildAlertSchedule(input: ScheduleInput): AlertSchedule {
  const { kind, contacts } = input;
  const { c1, c2, c3, c4, max } = contacts;

  const filterGate = canRemoveFilter({
    kind,
    contacts,
    centralPhaseVisible: input.centralPhaseVisible,
    edgeUncertain: input.edgeUncertain,
  });

  const specs: AlertSpec[] = [];

  if (kind === 'none') {
    // Des d'aquí no passa res. Cap avís: fer sonar el telèfon en un lloc on no
    // hi ha eclipsi només serveix per ensenyar a ignorar-lo.
    return { alerts: [], filterGate, rehearsal: false };
  }

  // ---------------------------------------------------------------- C1 -----
  if (c1 !== undefined) {
    for (const sec of C1_COUNTDOWN_SEC) {
      specs.push({
        id: `c1-${sec}`,
        atMs: c1 - sec * SEC,
        anchor: 'c1',
        offsetSec: -sec,
        kind: 'c1-countdown',
        severity: 'info',
        // Un «falten deu minuts» dit mig minut tard segueix sent cert; un
        // «falta un minut» dit mig minut tard, no.
        validForMs: sec >= 300 ? 30 * SEC : 10 * SEC,
        text: phrases.c1Countdown(sec),
      });
    }
    specs.push({
      id: 'c1',
      atMs: c1,
      anchor: 'c1',
      offsetSec: 0,
      kind: 'c1',
      severity: 'info',
      validForMs: 20 * SEC,
      text: phrases.c1Start(),
    });
  }

  // ------------------------------------------------------- fase central ----
  const hasCentral = c2 !== undefined && c3 !== undefined && c3 > c2;

  if (hasCentral && c2 !== undefined && c3 !== undefined) {
    const mode: CentralMode =
      kind === 'annular' ? 'annular' : filterGate.allowed ? 'total' : 'no-filter-off';

    // Instant de l'única autorització a treure el filtre. Es calcula encara que
    // la porta estigui tancada perquè serveix de frontera per als altres
    // avisos: res informatiu no pot caure entre aquí i el primer avís de
    // seguretat.
    const filterOffAt = c2 + FILTER_OFF_DELAY_SEC * SEC;
    const firstSafetyAt = c3 - FILTER_ON_WARNING_SEC[0] * SEC;

    for (const sec of CENTRAL_COUNTDOWN_SEC) {
      specs.push({
        id: `c2-${sec}`,
        atMs: c2 - sec * SEC,
        anchor: 'c2',
        offsetSec: -sec,
        kind: 'c2-countdown',
        severity: 'info',
        validForMs: sec >= 60 ? 10 * SEC : 3 * SEC,
        text: phrases.centralCountdown(sec, mode),
      });
    }

    if (mode === 'total') {
      // ————— L'ÚNIC avís que autoritza a treure's el filtre —————
      specs.push({
        id: 'filter-off',
        atMs: filterOffAt,
        anchor: 'c2',
        offsetSec: FILTER_OFF_DELAY_SEC,
        kind: 'filter-off',
        severity: 'safety',
        // Es talla abans del primer avís de seguretat: si la pestanya s'ha
        // congelat i es desperta a mig camí, «ja et pots treure el filtre» dit
        // tard és exactament l'error que aquest mòdul existeix per evitar.
        validForMs: Math.min(10 * SEC, firstSafetyAt - filterOffAt),
        text: phrases.filterOff(),
      });
    } else {
      specs.push({
        id: 'central-start',
        atMs: c2,
        anchor: 'c2',
        offsetSec: 0,
        kind: 'central-start',
        severity: 'info',
        validForMs: 10 * SEC,
        text: phrases.centralStart(mode === 'annular' ? 'annular' : 'no-filter-off'),
      });
    }

    // Temps restant. Només si cap dins la fase central sense fregar ni el
    // començament ni el primer avís de seguretat.
    for (const sec of CENTRAL_REMAINING_SEC) {
      const atMs = c3 - sec * SEC;
      const roomBefore = atMs > filterOffAt + SAFETY_CLEARANCE_MS;
      const roomAfter = atMs < firstSafetyAt - SAFETY_CLEARANCE_MS;
      if (!roomBefore || !roomAfter) continue;
      specs.push({
        id: `central-remaining-${sec}`,
        atMs,
        anchor: 'c3',
        offsetSec: -sec,
        kind: 'central-remaining',
        severity: 'info',
        validForMs: Math.min(5 * SEC, firstSafetyAt - SAFETY_CLEARANCE_MS - atMs),
        text: phrases.centralRemaining(sec, mode),
      });
    }

    // ————— Avisos de seguretat abans de C3 —————
    // Només tenen sentit si abans s'ha autoritzat treure el filtre: si no s'ha
    // tret mai, dir «posa-te'l» sembra el dubte que en algun moment tocava
    // treure-se'l.
    if (mode === 'total') {
      for (let i = 0; i < FILTER_ON_WARNING_SEC.length; i++) {
        const sec = FILTER_ON_WARNING_SEC[i];
        const atMs = c3 - sec * SEC;
        const next = FILTER_ON_WARNING_SEC[i + 1];
        specs.push({
          id: `filter-on-${sec}`,
          atMs,
          anchor: 'c3',
          offsetSec: -sec,
          kind: 'filter-on',
          severity: 'safety',
          // L'últim avís caduca uns segons abans de C3: passat aquest punt el
          // Sol ja pot ser a fora i el text correcte seria un altre.
          validForMs:
            next === undefined
              ? Math.max(0, sec * SEC - 2 * SEC)
              : (sec - next) * SEC - SAFETY_CLEARANCE_MS,
          text: phrases.filterOn(sec),
        });
      }
    }

    specs.push({
      id: 'sun-returned',
      atMs: c3 + SUN_RETURN_DELAY_SEC * SEC,
      anchor: 'c3',
      offsetSec: SUN_RETURN_DELAY_SEC,
      kind: 'sun-returned',
      severity: mode === 'total' ? 'safety' : 'info',
      validForMs: 60 * SEC,
      text: phrases.sunReturned(mode),
    });
  } else {
    // Sense fase central el màxim és la fita que val la pena cantar: és quan la
    // llum canvia i quan la gent vol mirar.
    specs.push({
      id: 'max',
      atMs: max,
      anchor: 'max',
      offsetSec: 0,
      kind: 'max',
      severity: 'info',
      validForMs: 60 * SEC,
      text: phrases.maximum(input.maxObscuration),
    });
  }

  // ---------------------------------------------------------------- C4 -----
  if (c4 !== undefined) {
    specs.push({
      id: 'c4',
      atMs: c4,
      anchor: 'c4',
      offsetSec: 0,
      kind: 'c4',
      severity: 'info',
      validForMs: 120 * SEC,
      text: phrases.eclipseEnd(),
    });
  }

  const alerts = specs
    .map(toAlert)
    // Ordre estable: per instant i, a igualtat d'instant, els de seguretat
    // primer. Que dos avisos coincideixin no hauria de passar mai amb les
    // constants actuals, però si passa la veu ha de dir primer el que protegeix.
    .sort((a, b) => a.atMs - b.atMs || severityRank(a) - severityRank(b));

  return { alerts, filterGate, rehearsal: false };
}

function severityRank(alert: VoiceAlert): number {
  return alert.severity === 'safety' ? 0 : 1;
}

/**
 * Adaptador des de les circumstàncies locals que calcula `core/astro`.
 *
 * Existeix perquè `buildAlertSchedule` treballa amb una entrada mínima (cinc
 * números) i així es pot provar sense muntar cap efemèride, però l'aplicació
 * té a la mà l'objecte gros i no ha de desmuntar-lo a mà.
 */
export function scheduleFromCircumstances(
  circumstances: LocalCircumstances,
  options: { centralPhaseVisible?: boolean } = {},
): AlertSchedule {
  const { contacts } = circumstances;
  const ms = (sample: { time: Date } | undefined): number | undefined =>
    sample === undefined ? undefined : sample.time.getTime();

  return buildAlertSchedule({
    kind: circumstances.kind,
    contacts: {
      c1: ms(contacts.c1),
      c2: ms(contacts.c2),
      max: contacts.max.time.getTime(),
      c3: ms(contacts.c3),
      c4: ms(contacts.c4),
    },
    maxObscuration: contacts.max.obscuration,
    centralPhaseVisible: options.centralPhaseVisible,
    // Surt directament de les circumstàncies: qui crida aquesta funció no se'n
    // pot oblidar, que és exactament el que havia passat.
    edgeUncertain: circumstances.edgeUncertain,
  });
}
