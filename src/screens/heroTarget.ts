/**
 * Cap a on compta la xifra gran de la portada.
 *
 * EL DEFECTE QUE ARREGLA, i és el pitjor tipus: dues xifres a la mateixa
 * pantalla dient coses diferents. La portada tenia un objectiu FIX —el segon
 * contacte si des d'aquí hi ha fase central, si no el màxim— i el titular no en
 * sortia mai. Passada aquella fita, el número gros es girava i comptava cap
 * AMUNT amb «Ha passat fa», mentre `CountdownView`, que és a la mateixa
 * pantalla i fa servir `resolveCountdown()`, ja comptava cap AVALL cap a la
 * fita següent. Dins de la franja això vol dir el titular comptant els segons
 * des de C2 mentre el rellotge del costat compta els que queden fins a C3: el
 * moment de l'eclipsi en què la xifra importa més és exactament aquell en què
 * es contradeien.
 *
 * I AFECTA MÉS GENT DEL QUE SEMBLA. Per a tothom qui és FORA de la franja
 * —que és la immensa majoria del trànsit d'aquesta app— l'objectiu fix era el
 * màxim, o sigui que el 12-8-2026 a partir de les 20.29 la contradicció la veia
 * tothom, amb dues hores llargues de parcial decreixent encara per endavant.
 *
 * LA REGLA DURA, I ÉS EL QUE FA QUE AQUEST CANVI SIGUI BARAT: mentre
 * `now < baseTargetMs` no canvia absolutament res. El titular segueix comptant
 * cap a la totalitat (o cap al màxim) amb la mateixa cadena de sempre, i les
 * hores prèvies a l'eclipsi la pantalla és idèntica a la que ja s'ha vist i
 * provat. Només un cop passada aquella fita el titular passa a seguir
 * `resolveCountdown()` — LA MATEIXA funció que mou `CountdownView`, no una
 * còpia que un dia divergiria.
 *
 * PASSAT C4, `resolveCountdown` no dona cap fita: ni instant ni àncora. El
 * titular no s'inventa cap número —guions— i diu «Eclipsi acabat», que és
 * literalment la mateixa etiqueta que ensenya `CountdownView`. Si aquí hi
 * quedés «Ha passat fa», tornaríem a tenir dues frases per al mateix moment,
 * que és el defecte que aquest fitxer existeix per treure.
 *
 * PUR I SENSE DOM, i a posta: la comparació amb `resolveCountdown()` s'ha de
 * poder córrer a Node instant per instant al llarg de tot l'eclipsi
 * (`heroTarget.test.ts`). L'etiqueta entra i surt ja resolta en un idioma:
 * qui sap en quin idioma es parla és la capa de vista, no aquesta funció.
 */

import { resolveCountdown } from '../core/timer';
import type { ContactTimesMs, TimerLocale } from '../core/timer';
import type { EclipseKind } from '../core/astro/types';

export interface HeroTargetInput {
  /** Els contactes en ms, tal com els demana `resolveCountdown`. */
  contacts: ContactTimesMs;
  kind: EclipseKind;
  /**
   * L'objectiu de sempre: C2 si des d'aquí hi ha fase central, si no el màxim.
   * `null` només mentre encara no se sap on serà l'usuari, i llavors el
   * titular ensenya guions exactament com abans d'aquest canvi.
   */
  baseTargetMs: number | null;
  /** «Fins a la totalitat», «Fins a l'anularitat» o «Fins al màxim». */
  baseLabel: string;
  locale: TimerLocale;
}

export interface HeroTarget {
  /**
   * `base` mentre no s'ha arribat a la fita esperada, `timer` un cop passada.
   * Es retorna perquè la vista pugui distingir els dos règims sense tornar a
   * comparar instants pel seu compte, i perquè la prova pugui exigir que el
   * primer duri exactament fins a `baseTargetMs`.
   */
  mode: 'base' | 'timer';
  /** Instant al qual compta el titular. `null` quan ja no queda cap fita. */
  targetMs: number | null;
  label: string;
}

/**
 * Quin instant ha d'ensenyar el titular de la portada i amb quina etiqueta.
 *
 * Es decideix comparant amb `nowMs` i prou: el resultat no depèn de quantes
 * hores fa que l'app està oberta ni de per on ha passat abans, que és la
 * mateixa propietat que fa auditable `resolveCountdown`.
 */
export function resolveHeroTarget(
  input: HeroTargetInput,
  nowMs: number,
): HeroTarget {
  const { contacts, kind, baseTargetMs, baseLabel, locale } = input;

  if (baseTargetMs === null || nowMs < baseTargetMs) {
    return { mode: 'base', targetMs: baseTargetMs, label: baseLabel };
  }

  const target = resolveCountdown({ contacts, kind }, nowMs);
  // `atMs` és `undefined` quan ja no queda res per esperar (passat C4, o sense
  // eclipsi des d'aquí). Es tradueix a `null`, que és com el component del
  // compte enrere diu «encara no hi ha número» amb guions.
  return { mode: 'timer', targetMs: target.atMs ?? null, label: target.label[locale] };
}
