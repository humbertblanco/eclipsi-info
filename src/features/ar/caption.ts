/*
 * EL PEU QUE VA CREMAT DINS DE LA IMATGE QUE L'USUARI COMPARTIRÀ.
 *
 * PER QUÈ ÉS UN MÒDUL SEPARAT I NO TRES LÍNIES DINS DEL COMPONENT. Perquè hi
 * havia una fuita i ningú la podia veure: el peu es muntava en línia a
 * `SkyScreen.tsx` i deia
 *
 *     placeLabel ?? `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`
 *
 * o sigui que, quan el topònim no s'havia resolt, LA CAPTURA SORTIA AMB LA
 * COORDENADA DE L'USUARI A ~110 m CREMADA ALS PÍXELS. I el cas no era rar: és
 * justament el del camp amb cobertura dolenta, que és on aquesta app es fa
 * servir i on el geocodificador falla. D'allà la imatge se'n va a un grup de
 * WhatsApp, i cap neteja d'EXIF no ho treu, perquè no és metadada: és tinta.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER QUÈ EL PEU ÉS CURT, I ELS NÚMEROS QUE HO DECIDEIXEN.
 *
 * `composeCapture()` pinta aquest text amb `ctx.fillText(caption, x, y, maxW)`,
 * i el quart argument NO RETALLA: ESTRENY. Un peu massa llarg no es talla, es
 * condensa fins que costa de llegir, i com que el canvas no es pot provar per
 * píxels en aquest repositori (`tests/dom-setup.ts` anul·la `getContext` a
 * posta) ningú no ho hauria vist mai.
 *
 * MESURAT el 12-8-2026 amb la geometria real de `composeCapture` per a una foto
 * vertical de mòbil (810 × 1440, que dona una barra de 79 px i una font de 30),
 * on `maxW` és 731 px:
 *
 *     «Eclipsi total del 12 d'agost de 2026 · Sòria · 20:29»         650 px
 *     «Eclipse total del 12 de agosto de 2026 · a 3,1 km de Valls…»  841 px  ← ja s'estrenyia al 87 %
 *     amb el domini afegit al final                                 1002 px ← 73 %, il·legible
 *     «Sòria · 12.08.2026 · 20:29 · eclipsi.info»                    508 px
 *     el pitjor cas d'aquest format, amb topònim llarg               656 px  ← hi cap
 *
 * O sigui que el problema no era el domini: eren els 37 caràcters que gastava a
 * dir «Eclipsi total del 12 d'agost de 2026» DINS D'UNA FOTO D'UN ECLIPSI. Amb
 * la data en xifres hi cap el domini i encara sobra espai, i de passada
 * desapareix l'estrenyiment que el castellà ja patia.
 *
 * La paraula «eclipsi» no es perd: la porta el domini.
 */

/** On es pot anar a saber de què va la foto. Va cremat i també al text de compartir. */
const ORIGEN = 'eclipsi.info';

/** El separador del peu, el mateix que fa servir la resta de la interfície. */
const SEPARADOR = ' · ';

export interface CaptureCaptionParts {
  /** El topònim resolt, o `null` si encara no n'hi ha cap. */
  placeLabel: string | null;
  /** La data en xifres, ja formatada: «12.08.2026». */
  date: string;
  /** L'hora sense segons, ja formatada: «20:29». */
  clock: string;
}

/**
 * El text que `composeCapture()` pinta a la barra de peu de la captura, i que
 * viatja també com a text del full de compartir.
 *
 * MAI conté cap coordenada. Si algú hi torna a posar un recanvi numèric, la
 * prova d'aquest mòdul l'ha d'aturar: comprova que no hi ha tres decimals
 * seguits ni signe de grau, no que la cadena sigui una de concreta.
 */
export function captureCaption({ placeLabel, date, clock }: CaptureCaptionParts): string {
  const place = placeLabel?.trim();
  return [place === '' ? undefined : place, date, clock, ORIGEN]
    .filter((part): part is string => part !== undefined && part !== null && part !== '')
    .join(SEPARADOR);
}
