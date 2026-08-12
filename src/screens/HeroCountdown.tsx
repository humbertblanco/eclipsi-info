/**
 * El titular de la portada: la xifra gran i la línia que diu què compta.
 *
 * PER QUÈ ÉS UN COMPONENT A PART I NO QUATRE LÍNIES DINS DE `CountdownScreen`.
 * Perquè aquí hi ha una subscripció al rellotge que es desperta cada segon, i
 * si visqués a la pantalla, cada segon repintaria també `SimulationView`,
 * `MiniMap`, `EclipseFingerprint` i la targeta del temps — tot l'arbre de la
 * portada, inclosos els components que dibuixen. Com a fulla, el tic només
 * arriba fins aquí i el `Countdown` que hi ha a sota. La decisió de cap a on
 * es compta ES PREN AQUÍ i no a la pantalla precisament per això.
 *
 * DOS RELLOTGES, I NO ES BARREGEN. Aquest component llegeix `useNow()` —el
 * monòton compartit de `state/useNow`, un interval lliure— només per DECIDIR
 * quina és la fita vigent; els dígits els mou el `useClock` de dins de
 * `Countdown`, que cau al límit del segon de paret. NO es passa `nowMs` al
 * `Countdown` per unificar-los, i és a posta:
 *
 *   - El rellotge del reproductor d'avisos (`runner`) no es re-ancora dins de
 *     la finestra protegida de la totalitat, o sigui que no hi ha un sol
 *     «ara» que tothom pugui compartir sense tocar `core/timer/safety.ts` ni
 *     res del que hi arriba.
 *   - `useNow` és un interval lliure: els seus tics cauen on van caure quan es
 *     va muntar, no al canvi de segon. Alimentar-hi els dígits faria que el
 *     número gros es quedés quequejant —repetint o saltant-se un segon— durant
 *     TOTES les hores que la portada està oberta, a canvi de res.
 *
 * L'ESBIAIX QUE S'ACCEPTA, escrit perquè ningú el descobreixi com un error:
 * aquest titular i `CountdownView` llegeixen dos rellotges monòtons diferents,
 * ancorats en instants diferents. A la frontera d'una fita, un pot girar fins a
 * un segon abans que l'altre. És un segon cosmètic, un cop per fita, contra els
 * dos minuts llargs de contradicció oberta que hi havia abans (i les dues hores
 * de parcial decreixent, per a qui és fora de la franja). Vegeu la capçalera de
 * `heroTarget.ts`.
 */

import { Countdown } from '../ui/eclipse/Countdown';
import { useNow } from '../state/useNow';
import { resolveHeroTarget } from './heroTarget';
import { s } from './strings';
import type { Contacts, EclipseKind } from '../core/astro/types';
import type { Locale } from '../i18n';

export interface HeroCountdownProps {
  contacts: Contacts;
  kind: EclipseKind;
  /**
   * L'objectiu de sempre: C2 si hi ha fase central des d'aquí, si no el màxim.
   * El decideix la pantalla, que és qui sap si hi ha ubicació.
   */
  baseTargetMs: number | null;
  /** «Fins a la totalitat» / «Fins a l'anularitat» / «Fins al màxim». */
  baseLabel: string;
  locale: Locale;
  className?: string;
}

export function HeroCountdown({
  contacts,
  kind,
  baseTargetMs,
  baseLabel,
  locale,
  className,
}: HeroCountdownProps) {
  const nowMs = useNow();

  const target = resolveHeroTarget(
    {
      contacts: {
        c1: contacts.c1?.time.getTime(),
        c2: contacts.c2?.time.getTime(),
        max: contacts.max.time.getTime(),
        c3: contacts.c3?.time.getTime(),
        c4: contacts.c4?.time.getTime(),
      },
      kind,
      baseTargetMs,
      baseLabel,
      locale,
    },
    nowMs,
  );

  return (
    <Countdown
      className={className}
      size="md"
      label={target.label}
      /*
       * «Ha passat fa» només té sentit en el règim antic, i allà es queda: el
       * titular hi arribava quan l'objectiu fix quedava enrere. En règim de
       * `resolveCountdown` l'objectiu és sempre futur o inexistent, i l'única
       * manera d'ensenyar-lo és l'esbiaix d'un segon de la capçalera; quan
       * passi, val més que la línia digui el mateix que deia el segon abans que
       * no pas que es giri per a un sol tic.
       */
      pastLabel={target.mode === 'base' ? s('home.past', locale) : target.label}
      targetMs={target.targetMs}
    />
  );
}
