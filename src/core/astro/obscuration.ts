/**
 * Com es diu l'obscuració. Regla única per a tot el projecte.
 *
 * Això sembla format i és domini. L'obscuració és la fracció de l'ÀREA del
 * disc solar tapada, i l'àrea creix molt de pressa al final: amb una magnitud
 * de 0,999 —gairebé tot el diàmetre, però no tot— l'àrea tapada és del 99,99%.
 * Arrodonit a un decimal, s'imprimeix «100,0%».
 *
 * Posat al costat de la paraula «parcial», el conjunt és una mentida: si fos el
 * 100% no seria parcial. I la conclusió que en treu qui ho llegeix és que ho
 * veurà tot.
 *
 * LA DIFERÈNCIA IMPORTA MOLTÍSSIM. Amb el 99,99% tapat encara queda una
 * escletxa de fotosfera, que és milers de vegades més brillant que la corona.
 * No es fa fosc, no surten estrelles, no es veu la corona, i **no et pots
 * treure el filtre en cap moment**. Un eclipsi del 99,9% i un de total no
 * s'assemblen en res, i la intuïció de tothom diu el contrari.
 *
 * PER QUÈ VIU AQUÍ I NO A LA CAPA DE PRESENTACIÓ. Perquè es formatava a NOU
 * llocs diferents —dues vistes, dues pantalles, el mapa, la superposició, els
 * avisos de veu i el guió de la totalitat— cadascun amb la seva regla. Es va
 * corregir a dos i va seguir mentint als altres set. Una regla que ha de valer
 * a tot arreu no pot viure a la capa que la mostra.
 */

/** Cert quan el disc lunar cobreix del tot el solar. */
export function isCentralPhase(
  separation: number,
  sunRadius: number,
  moonRadius: number,
): boolean {
  return separation <= Math.abs(moonRadius - sunRadius) && moonRadius >= sunRadius;
}

/**
 * Percentatge d'obscuració a text.
 *
 * Fora de la fase central s'afegeixen decimals fins que la xifra deixa de
 * llegir-se com un 100. No s'arrodoneix cap avall per amagar-ho: això també
 * seria enganyar. El que es fa és ensenyar la precisió que fa falta.
 *
 * @param isCentral cert només si hi ha totalitat o anularitat de veritat en
 *   aquest instant i des d'aquest punt.
 * @param decimals decimals de partida quan no cal afegir-ne més.
 */
export function formatObscurationPercent(
  fraction: number,
  isCentral: boolean,
  decimals = 1,
): string {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;

  if (isCentral) return `${pct.toFixed(decimals).replace('.', ',')} %`;

  for (let d = decimals; d <= decimals + 3; d++) {
    const text = pct.toFixed(d);
    if (Number.parseFloat(text) < 100) return `${text.replace('.', ',')} %`;
  }

  // Ni amb decimals de més es distingeix de 100: es diu amb paraules, que és
  // més honest que qualsevol xifra.
  return 'quasi el 100 %';
}

/**
 * Percentatge com a NÚMERO, per als llocs que no poden rebre text — els avisos
 * de veu, per exemple, que interpolen la xifra en una frase.
 *
 * Fora de la fase central mai arriba a 100: es queda a 99, perquè dir «cent per
 * cent» amb veu quan encara hi ha fotosfera és exactament l'error que aquest
 * mòdul existeix per evitar.
 */
export function obscurationPercentValue(fraction: number, isCentral: boolean): number {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  if (isCentral) return Math.round(pct);
  return Math.min(99, Math.round(pct));
}

/**
 * L'avís que de veritat necessita algú que és fora de la franja.
 *
 * El percentatge tot sol no li diu res útil, perquè la intuïció —«el 99% ja deu
 * ser gairebé com el 100%»— és falsa. El que li ha de quedar clar és què NO
 * veurà.
 */
export function partialCaveat(
  obscuration: number,
  locale: Locale = 'ca',
): string | null {
  if (obscuration < 0.5) return null;
  const caveats: Record<Locale, string> = {
    ca: "No és una totalitat petita: és una altra cosa. Amb una escletxa de fotosfera visible no es fa fosc, no surt la corona, no es veuen els planetes, i el filtre no se't pot treure en cap moment.",
    es: 'No es una totalidad pequeña: es otra cosa. Con una rendija de fotosfera visible no oscurece, no aparece la corona, no se ven los planetas, y el filtro no te lo puedes quitar en ningún momento.',
    en: 'This is not a smaller totality: it is a different phenomenon. While even a sliver of the photosphere remains visible, the sky does not go dark, the corona and planets do not appear, and you must keep your solar filter on at all times.',
  };
  return caveats[locale];
}
import type { Locale } from '../../i18n';
