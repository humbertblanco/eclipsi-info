/**
 * La comprovació que autoritza a treure's el filtre solar.
 *
 * AQUEST FITXER ÉS EL MÉS DELICAT DE L'APLICACIÓ. Dir-li a algú que es tregui
 * el filtre quan encara queda fotosfera visible provoca retinopatia solar, que
 * no fa mal mentre passa (la retina no té receptors del dolor) i que pot ser
 * permanent. No hi ha cap altre error d'aquesta app que faci mal físic.
 *
 * REGLA ÚNICA: l'única situació en què es pot mirar el Sol sense filtre és
 * durant la totalitat d'un eclipsi TOTAL, entre C2 i C3, i des d'un punt que
 * sigui realment dins la franja de totalitat. Qualsevol altra cosa —parcial,
 * anular, o un punt fora de la franja— vol dir filtre posat sempre.
 * Font: NASA Eclipse Safety i AAS Solar Eclipse Task Force («the only time
 * that the Sun can be viewed safely with the naked eye is during a total
 * eclipse, when the Moon completely covers the disk of the Sun»). L'anular hi
 * queda explícitament exclòs: l'anell és fotosfera pura.
 *
 * PER QUÈ UNA FUNCIÓ SEPARADA I NO UN `if` dins del generador d'avisos: així
 * la condició es pot provar aïllada, torna sempre el MOTIU (no només un booleà)
 * i el generador no pot «oblidar-se» de consultar-la — sense el seu resultat no
 * pot construir l'avís.
 *
 * Cap dependència del DOM.
 */

import type { EclipseKind } from '../astro/types';
import type { ContactTimesMs, FilterGate } from './types';

/**
 * Durada mínima de totalitat, en segons, per emetre avisos de treure el filtre.
 *
 * PER QUÈ 20 s I NO 0: la durada de la totalitat cau a zero al límit de la
 * franja com D₀·√(1−(x/R)²). Amb els valors espanyols del 2026 (D₀ ≈ 100 s,
 * semiamplada R ≈ 125 km), una totalitat calculada de 20 s vol dir que ets a
 * uns 2,5 km del límit. Just aquí passen tres coses alhora: (a) el límit real
 * el marca el perfil de muntanyes de la Lluna, que aquest motor no modela
 * —fem servir radis mitjans—, i el desplaça centenars de metres; (b) el GPS
 * del telèfon pot mentir desenes de metres i l'usuari pot no haver-lo activat;
 * (c) a la vora, les gotes de Baily duren tota la «totalitat», o sigui que hi
 * ha fotosfera visible tota l'estona encara que la geometria de disc digui que
 * no. En aquesta franja no s'anuncia res: es diu que no és segur i s'acaba.
 *
 * PUJAT DE 20 A 40 SEGONS. Amb el retard de seguretat a dotze segons (vegeu
 * `FILTER_OFF_DELAY_SEC`), una totalitat de vint en deixaria vuit d'útils: prou
 * poc perquè l'avís no compensi el risc de donar-lo. Quaranta segons deixen
 * gairebé mig minut de corona després del retard, i alhora allunyen encara més
 * del caire de la franja, que és on el motor no pot decidir.
 */
export const MIN_TOTALITY_FOR_FILTER_OFF_SEC = 40;

/**
 * Retard, en segons, entre el C2 calculat i l'avís de treure el filtre.
 *
 * AQUÍ HI HAVIA 2 SEGONS I ERA UN ERROR QUE PODIA FER MAL.
 *
 * La justificació antiga només comptava el relleu del limbe lunar (±2 km a
 * 384.000 km, ~1″, que amb un moviment relatiu de 0,5″/s són un parell de
 * segons). Això és cert i és insuficient, perquè deixava fora l'error més gran
 * i el més ben mesurat de tots: **el biaix sistemàtic del nostre propi motor**.
 *
 * El que sabem, mesurat contra les taules de l'IGN en 39 municipis i contra JPL
 * Horizons en dos eclipsis independents:
 *
 *   biaix de C2 contra l'IGN      −4,29 s de mitjana, −9,07 s el pitjor
 *   residu d'efemèrides            ~3,5 s, i CANVIA DE SIGNE entre eclipsis,
 *                                  així que no es pot compensar amb cap constant
 *   relleu del limbe lunar         ±2 s
 *
 * El signe del biaix és el dolent: **el nostre C2 arriba ABANS que el real.**
 * Amb dos segons de retard, l'avís de treure's el filtre queia abans del C2 de
 * referència als 23 municipis on la porta s'obre — sempre, no de tant en tant.
 * I cau amb el Sol a un grau i mig d'altura i l'ull ja adaptat a la foscor, que
 * és la pitjor combinació possible.
 *
 * Dotze segons cobreixen el pitjor biaix mesurat més el limbe amb marge. El
 * preu és perdre'n dotze d'una totalitat que en dura entre seixanta i cent
 * deu: un 12%. És car i s'ha de pagar, perquè l'altra banda de la balança és
 * fotosfera directa a la retina, i el dany és permanent.
 *
 * I LA PROTECCIÓ DE DEBÒ NO ÉS AQUEST NÚMERO. És que l'avís no s'enunciï mai
 * com una ordre basada en el rellotge, sinó com una condició que l'usuari pot
 * comprovar: «si ja s'ha fet fosc i veus la corona, ara pots treure'l». És el
 * que diu l'American Astronomical Society, i és l'única regla que no depèn de
 * la precisió de cap motor. Vegeu `phrases.ts`.
 */
export const FILTER_OFF_DELAY_SEC = 12;

export interface FilterGateInput {
  kind: EclipseKind;
  contacts: ContactTimesMs;
  /**
   * Cert si la fase central es veu de veritat des d'aquest punt, és a dir, si
   * el terreny no la tapa. Ve del mòdul de visibilitat
   * (`computeVisibility(...).centralVisibleSec > 0`).
   *
   * Per defecte és `true` perquè el cas normal és horitzó lliure i perquè un
   * `false` per omissió silenciaria els avisos a tothom que encara no tingui el
   * perfil del terreny calculat. Qui el tingui, l'ha de passar.
   */
  centralPhaseVisible?: boolean;
  /**
   * Cert quan el motor no pot decidir si des d'aquí hi haurà fase central.
   * Ve d'`edgeUncertain` a `LocalCircumstances`.
   *
   * Per defecte fals perquè el cas normal és estar clarament dins o clarament
   * fora. Qui tingui les circumstàncies calculades, l'ha de passar.
   */
  edgeUncertain?: boolean;
}

/**
 * Decideix si aquesta programació pot incloure avisos de treure's el filtre.
 *
 * Torna sempre el motiu perquè la interfície pugui dir-li a l'usuari per què no
 * en sentirà cap, i perquè els tests puguin distingir un «no» intencionat d'un
 * avís perdut per un error.
 */
export function canRemoveFilter(input: FilterGateInput): FilterGate {
  const { kind, contacts } = input;
  const { c2, c3 } = contacts;
  const centralDurationSec = c2 !== undefined && c3 !== undefined ? (c3 - c2) / 1000 : 0;

  const deny = (reason: FilterGate['reason']): FilterGate => ({
    allowed: false,
    reason,
    centralDurationSec: Math.max(0, centralDurationSec),
  });

  // 1. Des d'aquí no hi ha eclipsi de cap mena.
  if (kind === 'none') return deny('no-eclipse');

  // 2. Anular: l'anell que queda visible és fotosfera. Mai, sota cap condició.
  //    Va abans que la comprovació de contactes a propòsit: un eclipsi anular
  //    SÍ que té C2 i C3, i si l'ordre fos l'invers passaria la porta.
  if (kind === 'annular') return deny('annular');

  // 3. Parcial: sempre queda fotosfera a la vista.
  if (kind === 'partial') return deny('partial-only');

  // 4. Total, però sense els dos contactes que delimiten la totalitat: no
  //    sabem quan comença ni quan s'acaba, o sigui que no ho podem dir.
  if (c2 === undefined || c3 === undefined) return deny('missing-central-contacts');

  // 5. Totalitat massa curta: som damunt del límit de la franja (vegeu la
  //    constant). També cobreix el cas absurd de C3 abans que C2.
  if (centralDurationSec < MIN_TOTALITY_FOR_FILTER_OFF_SEC) return deny('totality-too-short');

  // 6. Ets a la franja de dos o tres quilòmetres on el nostre error de posició
  //    relativa (~1,5″) és més gran que el marge que separa veure la totalitat
  //    de no veure-la (0,13″ a 0,22″). Allà la resposta és una moneda a l'aire,
  //    i una moneda a l'aire no autoritza ningú a treure's res.
  //
  //    Sense això, el guió podia contenir alhora «ja et pots treure el filtre»
  //    i «no podem dir si hi haurà fase central».
  if (input.edgeUncertain === true) return deny('edge-uncertain');

  // 7. El terreny se la menja: des d'aquí no veuràs la totalitat, i el que
  //    veuràs quan el Sol torni a aparèixer per la carena és fotosfera.
  if (input.centralPhaseVisible === false) return deny('central-blocked-by-terrain');

  return { allowed: true, reason: 'ok', centralDurationSec };
}

/**
 * Si en aquest instant concret es pot mirar sense filtre.
 *
 * `canRemoveFilter` diu si aquest LLOC i aquest ECLIPSI permeten treure-se'l en
 * algun moment; això diu si AQUEST SEGON hi és. Són dues preguntes diferents i
 * fins ara la segona no vivia enlloc: la componia `ARView` a mà.
 *
 * PER QUÈ BAIXA AQUÍ. La regla d'ESTAT.md §3.1 diu que qualsevol camí que parli
 * de treure's el filtre ha de passar per aquest mòdul, i el rètol de la càmera
 * no hi passava del tot: agafava `canRemoveFilter` i hi afegia la finestra
 * horària pel seu compte. La prova que ho vigilava (`features/ar/naked-eye.test.ts`)
 * s'havia fet una CÒPIA d'aquesta composició per poder-la provar, i una còpia
 * no vigila l'original: el codi de debò llegia `Date.now()` dins d'un `useMemo`
 * amb dependències estàtiques —o sigui, una sola vegada, en muntar la vista— i
 * la prova seguia verda mentre el rètol es quedava encès després de C3.
 *
 * Ara la composició és aquesta funció, la fa servir la vista i la prova la
 * importa. Una sola definició, i vigilada.
 *
 * ELS MARGES són els mateixos que la veu, i pel mateix motiu: dotze segons
 * després de C2 perquè el C2 calculat va sistemàticament avançat, i quinze
 * abans de C3 perquè el que torna és fotosfera i val més sobrar que faltar.
 */
export const FILTER_ON_MARGIN_SEC = 15;

export function nakedEyeAllowedAt(input: FilterGateInput, nowMs: number): boolean {
  if (!canRemoveFilter(input).allowed) return false;
  const { c2, c3 } = input.contacts;
  if (c2 === undefined || c3 === undefined) return false;
  return nowMs >= c2 + FILTER_OFF_DELAY_SEC * 1000 && nowMs <= c3 - FILTER_ON_MARGIN_SEC * 1000;
}
