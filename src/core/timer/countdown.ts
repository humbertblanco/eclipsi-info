/**
 * Cap a quina fita es compta i com s'escriu el número.
 *
 * Separat del generador d'avisos perquè són dues coses diferents: la veu canta
 * fites puntuals, la pantalla ha d'ensenyar contínuament quant falta per a la
 * fita que ARA importa. Durant la totalitat, la fita que importa no és el
 * final de l'eclipsi: és C3, perquè és quan torna la fotosfera.
 *
 * Pur i sense DOM: es prova amb números, no amb un rellotge real.
 */

import type { EclipseKind } from '../astro/types';
import type { ContactTimesMs, CountdownTarget, LocalisedText } from './types';

const LABELS = {
  c1: { ca: 'Primer contacte', es: 'Primer contacto', en: 'First contact' },
  totality: { ca: 'Totalitat', es: 'Totalidad', en: 'Totality' },
  annularity: { ca: 'Anularitat', es: 'Anularidad', en: 'Annularity' },
  central: { ca: 'Fase central', es: 'Fase central', en: 'Central phase' },
  totalityEnd: { ca: 'Fi de la totalitat', es: 'Fin de la totalidad', en: 'End of totality' },
  annularityEnd: { ca: 'Fi de l’anularitat', es: 'Fin de la anularidad', en: 'End of annularity' },
  centralEnd: { ca: 'Fi de la fase central', es: 'Fin de la fase central', en: 'End of the central phase' },
  max: { ca: 'Màxim', es: 'Máximo', en: 'Maximum' },
  end: { ca: 'Fi de l’eclipsi', es: 'Fin del eclipse', en: 'End of the eclipse' },
  done: { ca: 'Eclipsi acabat', es: 'Eclipse acabado', en: 'Eclipse finished' },
  none: { ca: 'Sense eclipsi', es: 'Sin eclipse', en: 'No eclipse' },
} satisfies Record<string, LocalisedText>;

export interface CountdownInput {
  contacts: ContactTimesMs;
  kind: EclipseKind;
}

/**
 * Quina fita toca ara i quant hi falta.
 *
 * El pas d'una fase a la següent es decideix comparant amb l'instant del
 * contacte, no acumulant durades: així el resultat només depèn de `nowMs` i és
 * el mateix tant si l'app fa deu hores que està oberta com si s'acaba d'obrir.
 */
export function resolveCountdown(input: CountdownInput, nowMs: number): CountdownTarget {
  const { contacts, kind } = input;
  const { c1, c2, c3, c4, max } = contacts;

  if (kind === 'none') {
    return { phase: 'after', remainingMs: 0, label: LABELS.none };
  }

  const hasCentral = c2 !== undefined && c3 !== undefined && c3 > c2;
  const centralLabel =
    kind === 'annular' ? LABELS.annularity : kind === 'total' ? LABELS.totality : LABELS.central;
  const centralEndLabel =
    kind === 'annular'
      ? LABELS.annularityEnd
      : kind === 'total'
        ? LABELS.totalityEnd
        : LABELS.centralEnd;

  const target = (
    phase: CountdownTarget['phase'],
    anchor: NonNullable<CountdownTarget['anchor']>,
    atMs: number,
    label: LocalisedText,
  ): CountdownTarget => ({
    phase,
    anchor,
    atMs,
    remainingMs: Math.max(0, atMs - nowMs),
    label,
  });

  if (c1 !== undefined && nowMs < c1) return target('before', 'c1', c1, LABELS.c1);

  if (hasCentral && c2 !== undefined && c3 !== undefined) {
    if (nowMs < c2) return target('partial-rising', 'c2', c2, centralLabel);
    // Dins de la fase central es compta cap a C3: el número que hi ha a la
    // pantalla és el temps que et queda de corona, no el que fa que ha començat.
    if (nowMs < c3) return target('central', 'c3', c3, centralEndLabel);
  } else if (nowMs < max) {
    return target('partial-rising', 'max', max, LABELS.max);
  }

  if (c4 !== undefined && nowMs < c4) return target('partial-falling', 'c4', c4, LABELS.end);

  return { phase: 'after', remainingMs: 0, label: LABELS.done };
}

/** Hores, minuts i segons d'una durada, ja arrodonits cap avall. */
export interface DurationParts {
  hours: number;
  minutes: number;
  seconds: number;
  /** Total de segons, arrodonit cap amunt: un compte enrere no ensenya mai 0 abans d'hora. */
  totalSeconds: number;
}

/**
 * Descompon una durada.
 *
 * Arrodoneix cap AMUNT: si falten 500 ms, la pantalla ha de dir 1 i no 0. Un
 * compte enrere que arriba a zero abans que la cosa passi és el defecte més
 * comú d'aquests rellotges i el que fa que la gent es tregui el filtre abans
 * d'hora.
 */
export function splitDuration(ms: number): DurationParts {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
  };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Compte enrere en text: `Nd HH:MM` per damunt del dia, `H:MM:SS` per damunt de
 * l'hora, `MM:SS` per sota.
 *
 * PER QUÈ ELS DIES. Sense aquesta branca, les hores s'acumulaven: onze dies
 * abans de l'eclipsi el rellotge deia `265:52:17`, que són nou caràcters de
 * xifra en un cos gran i se n'anava fora de la caixa. I a més no es llegeix:
 * ningú no sap quants dies són dues-centes seixanta-cinc hores. Els segons
 * cauen alhora, que a onze dies vista no informen de res i només fan bategar
 * el bloc.
 *
 * PER SOTA DE VINT-I-QUATRE HORES NO CANVIA RES, i és a posta: aquell és el
 * mode que es mira el dia de l'eclipsi, l'han vist i provat així, i no s'ha
 * escurçat mai a `M:SS` ni a `SS` a mesura que baixa perquè amb xifres mono
 * tabulars mantenir el nombre de caràcters evita que el bloc balli d'amplada
 * cada cop que es creua un múltiple de deu, que és justament quan la gent hi
 * mira.
 */
export function formatCountdown(ms: number): string {
  const { hours, minutes, seconds } = splitDuration(ms);
  if (hours >= 24) return `${Math.floor(hours / 24)} d ${pad(hours % 24)}:${pad(minutes)}`;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
