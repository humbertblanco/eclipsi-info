/**
 * L'estat del consentiment dins de React, i l'únic lloc que el desa.
 *
 * ── EL REPARTIMENT DE FEINA, QUE TÉ TRES CAPES I NO DUES ────────────────────
 *
 *   `core/analytics/consent.ts`   decideix   què val i què no (i corre a Node)
 *   aquest fitxer                 recorda    la resposta (i toca localStorage)
 *   `analytics/gtag.ts`           aplica     la resposta a Google
 *
 * La separació no és cerimònia: la primera capa es prova sencera en
 * mil·lisegons sense navegador, i és la que conté totes les maneres d'equivocar-
 * se (JSON trencat, data al futur, consentiment caducat). Aquí baix només hi ha
 * canonada.
 *
 * ── QUÈ PASSA SI LOCALSTORAGE NO ES POT ESCRIURE ────────────────────────────
 *
 * Passa més del que sembla: Safari en navegació privada, emmagatzematge
 * desactivat per política, quota plena. La decisió és **honorar el sí ara i no
 * recordar-lo**: s'aplica el consentiment a la sessió en curs i el bàner
 * tornarà a sortir la pròxima vegada. L'alternativa —no aplicar-lo perquè no
 * s'ha pogut desar— seria ignorar una resposta explícita de l'usuari per un
 * problema que és nostre.
 *
 * L'ordre de les tres línies de `decide()` no és casual i per això va comentat
 * allà baix.
 *
 * ── PER QUÈ NO HI HA CAP MANERA DE TANCAR EL BÀNER SENSE CONTESTAR ──────────
 *
 * No hi ha aspa. Una aspa que tanca sense desar res fa que el bàner torni a
 * cada pantalla i acaba cansant fins que algú accepta per fer-lo callar, que és
 * un consentiment obtingut per esgotament. I una aspa que desa un «sí» és
 * directament falsa. Dues respostes, totes dues vàlides, totes dues igual de
 * fàcils: `denied` també es desa i també fa callar el bàner per un any.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  CONSENT_STORAGE_KEY,
  needsDecision,
  parseConsent,
  serializeConsent,
  type ConsentChoice,
  type ConsentState,
} from '../../core/analytics';
import { updateConsent } from '../../analytics/gtag';

/**
 * Llegeix el que hi ha desat.
 *
 * El `try` cobreix el cas real que `localStorage` existeixi però llançar en
 * llegir-lo (política d'empresa, cookies de tercers bloquejades en un iframe).
 * Qualsevol error és `'unknown'`, que és el mateix que diu el nucli per a tota
 * la resta de coses estranyes.
 */
export function readStoredConsent(nowMs: number): ConsentState {
  try {
    return parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY), nowMs);
  } catch {
    return 'unknown';
  }
}

/** Desa la resposta. Torna cert si de debò s'ha pogut desar. */
export function writeStoredConsent(choice: ConsentChoice, nowMs: number): boolean {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, serializeConsent(choice, nowMs));
    return true;
  } catch {
    return false;
  }
}

export interface ConsentController {
  /** L'estat desat. `'unknown'` vol dir que no s'ha contestat mai (o ha caducat). */
  state: ConsentState;
  /** Cert quan s'ha de pintar el bàner. */
  asking: boolean;
  /** Contesta i aplica. Serveix tant per al bàner com per a canviar d'opinió. */
  decide: (choice: ConsentChoice) => void;
  /** Torna a obrir el bàner per canviar una resposta ja donada. */
  reopen: () => void;
}

export function useConsent(): ConsentController {
  /*
   * L'estat inicial es llegeix UNA vegada, amb la funció d'inicialització de
   * `useState` i no a cos de component: llegir localStorage a cada render seria
   * un accés síncron a disc a cada tecla que l'usuari toqui.
   */
  const [state, setState] = useState<ConsentState>(() => readStoredConsent(Date.now()));

  /*
   * «M'ho he repensat». Va separat de `state` a posta: qui reobre el bàner ja té
   * una resposta desada i no l'ha de perdre pel fet d'obrir-lo. Si `reopen()`
   * esborrés la clau, tancar sense contestar el deixaria sense consentiment.
   */
  const [reopened, setReopened] = useState(false);

  const decide = useCallback((choice: ConsentChoice): void => {
    const now = Date.now();
    /*
     * PRIMER DESAR, DESPRÉS APLICAR. Si s'aplicés primer i el desat fallés,
     * l'usuari tindria la galeta posada i el bàner tornaria a sortir la propera
     * vegada preguntant una cosa que ja té resposta. Al revés —desat que va bé,
     * aplicació que no perquè un bloquejador s'ha menjat `gtag`— no passa res:
     * no mesurar és el cas segur.
     */
    writeStoredConsent(choice, now);
    updateConsent(choice);
    setState(choice);
    setReopened(false);
  }, []);

  const reopen = useCallback((): void => setReopened(true), []);

  const asking = needsDecision(state) || reopened;

  return useMemo(
    () => ({ state, asking, decide, reopen }),
    [state, asking, decide, reopen],
  );
}
