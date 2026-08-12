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
 * La regla d'aquesta casa és que la ubicació no surt del dispositiu si no és
 * per posar nom al lloc o per la previsió. Una foto amb les coordenades pintades
 * a sobre se les endú a tot arreu on l'usuari la deixi anar, i sense que ell ho
 * sàpiga: quan mira la pantalla abans de compartir, el peu de la imatge composta
 * no el veu enlloc.
 *
 * QUÈ ES FA EN COMPTES D'AIXÒ: si no hi ha topònim, no es diu el lloc. El peu es
 * queda amb l'eclipsi i l'hora, que és el que dona sentit a la foto d'aquí a un
 * any. Es va valorar de caure a `findReadablePlace()` de `features/share`, i no
 * serveix: aquella llista casa dins d'un radi curt i per a un punt qualsevol de
 * muntanya torna `null` igual.
 *
 * Aquí no hi ha DOM ni cap dependència de React a posta: així la decisió es pot
 * provar, que era l'altra meitat del problema.
 */

export interface CaptureCaptionParts {
  /** Com es diu l'eclipsi, ja traduït. */
  eclipseLabel: string;
  /** El topònim resolt, o `null` si encara no n'hi ha cap. */
  placeLabel: string | null;
  /** L'hora, ja formatada per la capa de vista. */
  clock: string;
}

/** El separador del peu, el mateix que fa servir la resta de la interfície. */
const SEPARATOR = ' · ';

/**
 * El text que `composeCapture()` pinta a la barra de peu de la captura.
 *
 * MAI conté cap coordenada. Si algú hi torna a posar un recanvi numèric, la
 * prova d'aquest mòdul l'ha d'aturar: comprova que no hi ha ni decimals ni
 * signe de grau, no que la cadena sigui una de concreta.
 */
export function captureCaption({ eclipseLabel, placeLabel, clock }: CaptureCaptionParts): string {
  const place = placeLabel?.trim();
  return [eclipseLabel, place === '' ? undefined : place, clock]
    .filter((part): part is string => part !== undefined && part !== null)
    .join(SEPARATOR);
}
