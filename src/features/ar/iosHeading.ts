/**
 * El rumb d'iOS, desacoblat del pitch.
 *
 * ── EL PROBLEMA ─────────────────────────────────────────────────────────────
 *
 * A iOS l'`alpha` de `deviceorientation` és RELATIVA (origen arbitrari, però
 * contínua i neta: surt del giroscopi), i l'única font absoluta és
 * `webkitCompassHeading`. La solució de sempre era substituir-la per
 * esdeveniment: `alpha = 360 − heading`. Aquesta identitat només és exacta
 * amb el telèfon pla: WebKit defineix el heading sobre la projecció
 * horitzontal d'un eix del dispositiu, i a mesura que el mòbil s'inclina cap
 * al cel la geometria de la projecció canvia i el número que arriba es
 * desplaça EN FUNCIÓ DEL PITCH. A la pantalla es veia com l'azimut lliscant
 * mentre s'inclinava — l'eix que es movia no era el que l'usuari tocava.
 * I de propina, cada actualització asíncrona del magnetòmetre entrava com un
 * esglaó sencer d'alpha, soroll que el filtre havia d'empassar-se.
 *
 * ── LA SOLUCIÓ ──────────────────────────────────────────────────────────────
 *
 * Es capgira la dependència: el quaternió es construeix amb l'ALPHA RELATIVA
 * — contínua, sense salts, amb el pitch net — i el compass només serveix per
 * aprendre l'OFFSET entre aquella alpha i el nord:
 *
 *     offset = (360 − webkitCompassHeading) − alphaRelativa
 *
 * passat per un passabaixos circular (τ = 3 s) i PESAT PER LA POSTURA: pes
 * ple fins a 20° d'altura de càmera, res a partir de 35°. Amb el mòbil pla o
 * gairebé, la identitat del compass és bona i l'offset s'afina; apuntant
 * amunt — on el compass menteix en funció del pitch — l'offset queda
 * congelat i el rumb el porta el giroscopi.
 *
 * La deriva del giroscopi (graus per minut) queda coberta per dues bandes:
 * els eclipsis d'aquesta app passen amb el Sol a pocs graus de l'horitzó, o
 * sigui que la postura de treball és per sota del llindar i l'offset es va
 * refrescant; i quan hi ha terreny a la vista, el biaix de brúixola de la
 * fusió (`poseFusion`) absorbeix el que quedi.
 *
 * Sense DOM: números entren, números surten, i el banc ho pot clavar.
 */

import { normalizeDelta } from './poseFusion';

/** Constant de temps del passabaixos de l'offset, en segons. */
const TAU_SEC = 3;

/** Fins aquí (altura de càmera, graus) el compass es creu del tot. */
const ALT_FULL_DEG = 20;

/** A partir d'aquí l'offset queda congelat i mana el giroscopi. */
const ALT_FREEZE_DEG = 35;

export class IosYawOffset {
  private offsetDeg: number | null = null;

  /**
   * Aprèn de l'esdeveniment i torna l'offset vigent, o `null` mentre encara
   * no se n'ha pogut fixar cap (l'app s'ha obert apuntant amunt): llavors el
   * cridador ha de recórrer a la substitució de sempre, que en aquella
   * postura no és pitjor del que era.
   */
  update(
    headingDeg: number,
    alphaRelDeg: number,
    cameraAltitudeDeg: number,
    dtSec: number,
  ): number | null {
    const target = normalizeDelta(360 - headingDeg - alphaRelDeg);
    const tilt = Math.abs(cameraAltitudeDeg);
    const weight = Math.max(
      0,
      Math.min(1, (ALT_FREEZE_DEG - tilt) / (ALT_FREEZE_DEG - ALT_FULL_DEG)),
    );

    if (this.offsetDeg === null) {
      // La primera fixació només amb una postura de confiança: fixar-la
      // apuntant al cel seria endur-se l'error del compass d'aquella postura
      // per a tota l'estona que trigui el passabaixos a menjar-se'l.
      if (weight > 0.5) this.offsetDeg = target;
      return this.offsetDeg;
    }

    if (weight > 0 && dtSec > 0) {
      const k = 1 - Math.exp(-(dtSec * weight) / TAU_SEC);
      this.offsetDeg = normalizeDelta(
        this.offsetDeg + k * normalizeDelta(target - this.offsetDeg),
      );
    }
    return this.offsetDeg;
  }

  get value(): number | null {
    return this.offsetDeg;
  }

  reset(): void {
    this.offsetDeg = null;
  }
}
