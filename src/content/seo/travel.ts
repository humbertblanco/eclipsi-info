/**
 * «I SI DES D'AQUÍ NO S'HI VEU, ON HE D'ANAR?»
 *
 * ── PER QUÈ EXISTEIX ────────────────────────────────────────────────────────
 *
 * Una fitxa de ciutat responia mitja pregunta. Deia «99,8 % del disc tapat,
 * fase parcial» —que és cert i és el que el motor calcula— i s'aturava allà. La
 * persona que la llegeix, però, no ha vingut a saber un tant per cent: ha
 * vingut a decidir on es planta el 12 d'agost. I la resposta útil per a una
 * ciutat fora de la franja no és el seu número, és la distància al número bo.
 *
 * Aquest mòdul dona aquesta segona meitat: quant queda fins a la línia central
 * i quina és la ciutat publicada més propera on la fase central sí que hi és,
 * amb els seus segons.
 *
 * ── NOMÉS DIU EL QUE PODEM SOSTENIR ─────────────────────────────────────────
 *
 * La distància és en línia recta i el mòdul ho diu així: no és temps de
 * trajecte, i convertir-la en «una hora i mitja de cotxe» seria inventar-se una
 * carretera. Tampoc no proposa cap punt que no tingui pàgina pròpia: si algú hi
 * va, ha de poder-hi obrir la fitxa i comprovar-ho.
 *
 * ── I NOMÉS QUAN VAL LA PENA MOURE'S ────────────────────────────────────────
 *
 * Dos llindars, i tots dos van néixer mirant el que sortia:
 *
 *   · `MILLORA_MINIMA_SEC` evita el consell absurd pel cantó petit. Sense ell,
 *     una ciutat amb 58 segons de totalitat rebria la recomanació d'anar-se'n
 *     setanta quilòmetres per guanyar-ne dos, i el consell honest allà és el
 *     contrari: ja hi ets, no et moguis. Un eclipsi no es juga als segons de
 *     marge sinó als núvols i a l'horitzó.
 *
 *   · `MAX_DESPLACAMENT_KM` l'evita pel cantó gros. La primera versió deia a
 *     Tarifa que, per veure l'eclipsi del 2026, se n'anés a València: 599 km.
 *     És literalment cert i no serveix a ningú — a aquella distància ja no és
 *     un desplaçament, és un viatge, i la decisió és una altra.
 *
 * ── I QUAN NO HI HA ON ANAR, QUE ÉS EL CAS INTERESSANT ──────────────────────
 *
 * A Tarifa la resposta bona per al 2026 no és cap distància: és que el 2 d'agost
 * del 2027 la totalitat li passa pel damunt, quatre minuts i mig, sense moure's
 * de casa. Per això `betterEclipse` mira els ALTRES eclipsis del catàleg EN
 * AQUEST MATEIX PUNT. És la informació que fa que la pàgina d'una ciutat fora
 * de la franja deixi de ser un carreró sense sortida.
 */

import { computeLocalCircumstances } from '../../core/astro/contacts';
import { computeEclipsePath, distanceToCenterLineKm } from '../../core/eclipses/path';
import type { SeoCity } from './types';

/**
 * Guany mínim, en segons, perquè valgui la pena recomanar un desplaçament a qui
 * ja té fase central. Trenta segons és mig minut de totalitat: prou per
 * justificar una hora de cotxe, i prou perquè no es recomani per dos.
 */
const MILLORA_MINIMA_SEC = 30;

/**
 * Més enllà d'això, «on anar» deixa de ser una recomanació.
 *
 * 250 km és el que es fa d'anada i tornada en un dia sense que el viatge sigui
 * el pla. A partir d'aquí la decisió ja no és quin mirador es tria: és si es fa
 * el viatge, i això no ho decideix una fitxa de ciutat.
 */
const MAX_DESPLACAMENT_KM = 250;

export interface TravelTarget {
  /** Identificador de la ciutat, per construir-ne l'enllaç. */
  id: string;
  /** Distància en línia recta, en quilòmetres. */
  km: number;
  /** Segons de fase central confirmats en aquell punt. */
  durationSec: number;
}

/** Un altre eclipsi del catàleg que, en AQUEST punt, sí que dona fase central. */
export interface BetterEclipse {
  eclipseId: string;
  durationSec: number;
  /** Cert si és una totalitat; fals si és l'anell d'un anular. */
  total: boolean;
}

export interface TravelAdvice {
  /**
   * Distància a la línia central, en km. `null` quan l'eclipsi no dibuixa cap
   * línia central visible (un parcial pur des de tot arreu, o un càlcul que no
   * la troba): en aquell cas no hi ha cap direcció que valgui la pena.
   */
  centerLineKm: number | null;
  /**
   * La ciutat publicada més propera on val la pena anar, si n'hi ha cap. `null`
   * vol dir que ja hi ets o que moure's no compensa, i totes dues coses són una
   * resposta.
   */
  target: TravelTarget | null;
  /**
   * Quan des d'aquí no hi ha fase central i no hi ha cap lloc raonable on anar,
   * l'eclipsi que sí que hi funciona. `null` si no n'hi ha cap.
   */
  betterEclipse: BetterEclipse | null;
}

/*
 * LES CIRCUMSTÀNCIES D'UN PUNT ES CALCULEN UN COP.
 *
 * `travelAdvice()` recorre totes les ciutats publicades a cada crida, i el
 * generador la crida un cop per fitxa: amb 37 ciutats i 3 eclipsis això són més
 * de quatre mil resolucions de contactes, i cada una busca mínims per bisecció.
 * Mesurat: el fitxer de proves passava de dos segons a vuitanta.
 *
 * La memòria és segura perquè `computeLocalCircumstances` és PURA —mateixes
 * coordenades i mateix eclipsi, mateix resultat, sempre— i el procés que la fa
 * servir és el build, que neix i mor. La clau porta les coordenades a cinc
 * decimals: prou per no confondre dos punts que la resta del projecte tracta
 * com a diferents, i prou per encertar quan la mateixa ciutat es consulta des
 * de dues fitxes.
 */
const CIRCUMSTANCES = new Map<string, ReturnType<typeof computeLocalCircumstances>>();
function circumstancesAt(eclipseId: string, lat: number, lon: number) {
  const key = `${eclipseId}|${lat.toFixed(5)}|${lon.toFixed(5)}`;
  const cached = CIRCUMSTANCES.get(key);
  if (cached) return cached;
  const computed = computeLocalCircumstances(eclipseId, { lat, lon, elevation: 0 });
  CIRCUMSTANCES.set(key, computed);
  return computed;
}

/** Distància del cercle màxim, en quilòmetres. */
function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const radius = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

/**
 * On anar des d'aquest punt, i si val la pena.
 *
 * `cities` són les ciutats que aquest lloc publica: la recomanació sempre ha de
 * ser un lloc amb fitxa pròpia, perquè el següent pas de qui la llegeix és
 * obrir-la.
 */
export function travelAdvice(
  eclipseId: string,
  from: { lat: number; lon: number },
  cities: readonly SeoCity[],
  otherEclipseIds: readonly string[] = [],
): TravelAdvice {
  const here = circumstancesAt(eclipseId, from.lat, from.lon);
  const hereSec = here.edgeUncertain ? 0 : here.centralDurationSec;
  const centerLineKm = distanceToCenterLineKm(from, computeEclipsePath(eclipseId).center);

  let target: TravelTarget | null = null;
  for (const city of cities) {
    // El mateix punt no es recomana a si mateix.
    const km = distanceKm(from.lat, from.lon, city.lat, city.lon);
    if (km < 1) continue;

    const there = circumstancesAt(eclipseId, city.lat, city.lon);
    // Al caire no es recomana ningú: el motor no pot confirmar-hi la totalitat i
    // enviar-hi algú seria vendre com a segur el que hem dit que no ho és.
    if (there.edgeUncertain || there.centralDurationSec <= 0) continue;
    if (there.centralDurationSec < hereSec + MILLORA_MINIMA_SEC) continue;
    if (km > MAX_DESPLACAMENT_KM) continue;

    // Entre dues que compleixen, la més propera. A igual distància, la de més
    // durada: si has de fer el mateix camí, val més que sigui pel millor punt.
    if (
      target === null ||
      km < target.km - 0.5 ||
      (Math.abs(km - target.km) <= 0.5 && there.centralDurationSec > target.durationSec)
    ) {
      target = { id: city.id, km, durationSec: there.centralDurationSec };
    }
  }

  /*
   * L'altre eclipsi només es busca quan aquest no serveix i no hi ha on anar:
   * si ja tens fase central, o si la tens a menys de dues-centes cinquanta
   * quilòmetres, la pàgina ja ha respost i afegir-hi una data del 2028 seria
   * distreure't de la decisió que has vingut a prendre.
   */
  let betterEclipse: BetterEclipse | null = null;
  if (hereSec <= 0 && target === null) {
    for (const other of otherEclipseIds) {
      if (other === eclipseId) continue;
      const there = circumstancesAt(other, from.lat, from.lon);
      if (there.edgeUncertain || there.centralDurationSec <= 0) continue;
      // El més aviat possible: qui llegeix això vol saber la propera ocasió, no
      // la millor de la dècada.
      if (betterEclipse === null || other < betterEclipse.eclipseId) {
        betterEclipse = {
          eclipseId: other,
          durationSec: there.centralDurationSec,
          total: there.kind === 'total',
        };
      }
    }
  }

  return { centerLineKm, target, betterEclipse };
}
