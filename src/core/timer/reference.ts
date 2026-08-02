/**
 * Quant s'equivoca el rellotge del dispositiu contra una referència externa.
 *
 * PER QUÈ NO N'HI HA PROU AMB `driftMs()` de `clock.ts`. Aquella funció compara
 * el rellotge de paret amb el monòton i detecta SALTS durant la sessió: una
 * sincronització NTP a mig eclipsi, un canvi d'hora a mà. No detecta —ni ho pot
 * fer— que el telèfon porti tot el dia trenta segons endarrerit: els dos
 * rellotges van d'acord entre ells i tots dos van malament. Per al desfasament
 * ABSOLUT no hi ha cap manera de saber-ho des de dins; cal preguntar-ho a fora.
 *
 * PER QUÈ IMPORTA AQUÍ I NO EN UNA APP QUALSEVOL. Els avisos de veu es
 * programen contra el rellotge del telèfon i els marges de la comporta de
 * seguretat són de segons: l'últim «posa't el filtre» es dona 5 s abans de C3
 * (`FILTER_ON_WARNING_SEC` a `schedule.ts`) i l'autorització per treure'l, 12 s
 * després de C2 (`FILTER_OFF_DELAY_SEC`). Amb el rellotge trenta segons
 * endarrerit, aquell avís sona vint-i-cinc segons DESPRÉS de C3: amb el Sol ja
 * tornat i l'ull adaptat a la foscor.
 *
 * AQUEST FITXER NOMÉS FA LA MATEMÀTICA. Ni `fetch` ni DOM: rep tres lectures i
 * en treu un número amb la seva barra d'error. Qui va a la xarxa és
 * `features/clock/`, perquè `src/core` no hi va mai.
 *
 * EL MODEL DE MESURA, i d'on surt cada terme de l'error:
 *
 *   1. Es llegeix el rellotge del dispositiu just abans d'enviar la petició
 *      (`sentAtMs`) i just quan arriben les capçaleres (`receivedAtMs`). El
 *      servidor va escriure la seva hora en algun instant d'entremig, i el
 *      millor que en podem dir sense saber si l'anada i la tornada són
 *      simètriques és que va ser al mig: d'aquí surt ±RTT/2. És el mateix que
 *      fa NTP amb quatre marques de temps, amb una de sola i pitjor.
 *
 *   2. La capçalera HTTP `Date` té resolució de SEGON (IMF-fixdate, RFC 9110):
 *      «19:30:07» vol dir un instant qualsevol de l'interval [07,000 · 08,000).
 *      El punt central de l'interval és la millor estimació i la meitat de
 *      l'interval, ±500 ms, és l'error de quantització. Fer servir el segon tal
 *      qual introduiria un biaix sistemàtic de mig segon cap al mateix costat
 *      sempre.
 *
 * I LA CONSEQÜÈNCIA HONESTA: si la incertesa és més gran que la desviació
 * mesurada, la resposta no és el número, és que no ho sabem. Un rellotge que
 * marca 0,6 s de diferència amb ±0,9 s d'error no ha demostrat res, i dir
 * «vas 0,6 s endarrerit» seria inventar precisió. Vegeu `clockDriftLevel`.
 */

/**
 * Resolució de la capçalera `Date`, en ms. La data HTTP s'escriu amb segons
 * enters i truncant, mai arrodonint: l'instant real és dins del segon que diu.
 */
export const HTTP_DATE_RESOLUTION_MS = 1000;

/**
 * Anada i tornada per damunt de la qual la mesura es llença, en ms.
 *
 * No és per precisió —una incertesa gran ja es reflecteix sola a la barra
 * d'error i el veredicte ja en fa cas—, és perquè el MODEL deixa de valdre.
 * Deu segons entre les dues lectures no són deu segons de xarxa: són una
 * pestanya que el sistema ha congelat a mitja petició (iOS ho fa en passar a
 * segon pla) i llavors el servidor no va respondre «al mig» de res. Amb una
 * hipòtesi de simetria falsa, el número que en surt és brossa amb aparença de
 * mesura.
 */
export const MAX_USEFUL_ROUND_TRIP_MS = 10_000;

/**
 * Desfasament, en ms, a partir del qual val la pena avisar l'usuari.
 *
 * CINC SEGONS, I SURT DE LA COMPORTA DE SEGURETAT, no del confort. El marge més
 * estret de tot el programa d'avisos és l'últim «posa't el filtre», que es dona
 * a C3 − 5 s. Un rellotge cinc segons endarrerit el desplaça exactament fins a
 * C3: l'avís deixa d'anticipar el retorn de la fotosfera i passa a acompanyar-lo
 * o a arribar-hi tard. Per sota d'aquests cinc segons, l'error del rellotge
 * encara és més petit que el que ja assumeix la comporta pel seu compte —±3,5 s
 * de residu d'efemèrides, ±2 s de relleu del limbe lunar, que és per què el
 * retard de treure's el filtre és de dotze i no de dos—, i avisar-ne només
 * competiria per l'atenció amb els avisos que sí que fan falta.
 *
 * A l'altra banda hi ha el terra de la mesura: amb ±500 ms de quantització i
 * una anada i tornada mòbil de mig segon, la incertesa típica és d'uns 0,75 s.
 * Cinc segons hi queden molt per damunt, o sigui que el llindar es pot
 * distingir de debò i no fa cridar el llop.
 */
export const CLOCK_DRIFT_ALERT_MS = 5000;

/** Les tres lectures d'una consulta. Totes en ms d'època. */
export interface ClockProbe {
  /** Rellotge del DISPOSITIU just abans d'enviar la petició. */
  sentAtMs: number;
  /** Rellotge del DISPOSITIU just quan arriben les capçaleres de la resposta. */
  receivedAtMs: number;
  /** Capçalera `Date` de la resposta, ja convertida a ms (segon truncat). */
  serverDateMs: number;
}

/** Per què una consulta no ha donat cap número utilitzable. */
export type ClockProbeProblem =
  /** Alguna lectura no és un número finit: no hi ha res a calcular. */
  | 'invalid-reading'
  /** La resposta ha arribat abans d'enviar-se: el rellotge ha saltat entremig. */
  | 'reversed'
  /** Massa estona entre les dues lectures; vegeu `MAX_USEFUL_ROUND_TRIP_MS`. */
  | 'round-trip-too-long';

export interface ClockOffsetMeasured {
  known: true;
  /**
   * Rellotge del dispositiu menys referència, en ms.
   * Positiu = el telèfon va AVANÇAT (els avisos sonarien abans d'hora).
   * Negatiu = el telèfon va ENDARRERIT (els avisos sonarien tard: el cas dolent).
   */
  offsetMs: number;
  /** Mitja amplada de la barra d'error: RTT/2 + 500 ms de quantització. */
  uncertaintyMs: number;
  /** Temps entre les dues lectures del dispositiu. */
  roundTripMs: number;
  /** Desfasament mínim compatible amb la mesura: max(0, |offset| − incertesa). */
  atLeastMs: number;
  /** Desfasament màxim compatible amb la mesura: |offset| + incertesa. */
  atMostMs: number;
}

export interface ClockOffsetUnknown {
  known: false;
  problem: ClockProbeProblem;
}

export type ClockOffset = ClockOffsetMeasured | ClockOffsetUnknown;

/**
 * Converteix una capçalera `Date` a ms d'època. `null` si no n'hi ha o no
 * s'entén.
 *
 * Viu aquí i no a la capa de xarxa perquè és pura i perquè és on es pot provar:
 * una capçalera absent i una capçalera amb escombraries han de donar el mateix
 * «no ho sé», i no un `NaN` que després viatgi disfressat de número.
 */
export function parseHttpDate(header: string | null | undefined): number | null {
  if (!header) return null;
  const ms = Date.parse(header);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Desfasament del rellotge del dispositiu a partir d'una consulta.
 *
 * Vegeu el model de mesura a la capçalera del fitxer.
 */
export function estimateClockOffset(probe: ClockProbe): ClockOffset {
  const { sentAtMs, receivedAtMs, serverDateMs } = probe;

  if (
    !Number.isFinite(sentAtMs) ||
    !Number.isFinite(receivedAtMs) ||
    !Number.isFinite(serverDateMs)
  ) {
    return { known: false, problem: 'invalid-reading' };
  }

  const roundTripMs = receivedAtMs - sentAtMs;
  if (roundTripMs < 0) return { known: false, problem: 'reversed' };
  if (roundTripMs > MAX_USEFUL_ROUND_TRIP_MS) {
    return { known: false, problem: 'round-trip-too-long' };
  }

  // El punt mig de les dues lectures és la nostra estimació de quin instant
  // marcava el dispositiu quan el servidor escrivia la seva hora.
  const deviceAtStamp = (sentAtMs + receivedAtMs) / 2;
  // I el centre del segon que diu la capçalera, la del servidor.
  const referenceAtStamp = serverDateMs + HTTP_DATE_RESOLUTION_MS / 2;

  const offsetMs = deviceAtStamp - referenceAtStamp;
  const uncertaintyMs = roundTripMs / 2 + HTTP_DATE_RESOLUTION_MS / 2;

  return {
    known: true,
    offsetMs,
    uncertaintyMs,
    roundTripMs,
    atLeastMs: Math.max(0, Math.abs(offsetMs) - uncertaintyMs),
    atMostMs: Math.abs(offsetMs) + uncertaintyMs,
  };
}

/**
 * De diverses consultes, la que val.
 *
 * ES TRIA PER INCERTESA I NO ES FA CAP MITJANA. La font d'error dominant és
 * l'asimetria de la xarxa, que no és aleatòria ni centrada: promitjar tres
 * consultes amb anades i tornades de 80, 400 i 2.000 ms no dona res millor que
 * la de 80: dona la de 80 contaminada per les altres dues. És el mateix criteri
 * que fa servir NTP per triar mostra.
 *
 * Si cap consulta no ha donat número, torna el primer problema, que és el que
 * la interfície ha de saber explicar.
 */
export function bestClockOffset(offsets: readonly ClockOffset[]): ClockOffset {
  let best: ClockOffsetMeasured | null = null;
  for (const offset of offsets) {
    if (!offset.known) continue;
    if (best === null || offset.uncertaintyMs < best.uncertaintyMs) best = offset;
  }
  if (best !== null) return best;
  return offsets[0] ?? { known: false, problem: 'invalid-reading' };
}

/**
 * Què se'n pot dir, del rellotge d'aquest telèfon.
 *
 * Quatre respostes i no dues, perquè «no ho sé» no és «va bé»:
 *
 *  - `unknown`: no hi ha mesura. Sense xarxa és aquest, sempre.
 *  - `aligned`: fins i tot pel cantó pitjor de la barra d'error, el desfasament
 *    no arriba al llindar. Això sí que és una afirmació: el rellotge va prou bé.
 *  - `inconclusive`: la barra d'error trepitja el llindar pels dos costats. La
 *    mesura no pot ni confirmar ni descartar un desfasament que faci mal, i
 *    ensenyar el número central com si fos la resposta seria inventar precisió.
 *  - `off`: fins i tot pel cantó millor de la barra d'error, el desfasament
 *    arriba al llindar. Aquí sí que hi ha alguna cosa a dir a l'usuari.
 */
export type ClockDriftLevel = 'unknown' | 'aligned' | 'inconclusive' | 'off';

export function clockDriftLevel(
  offset: ClockOffset,
  thresholdMs: number = CLOCK_DRIFT_ALERT_MS,
): ClockDriftLevel {
  if (!offset.known) return 'unknown';
  if (offset.atLeastMs >= thresholdMs) return 'off';
  if (offset.atMostMs < thresholdMs) return 'aligned';
  return 'inconclusive';
}
