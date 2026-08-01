/**
 * Comparar dos llocs.
 *
 * PER QUÈ ÉS LA FUNCIÓ CENTRAL DE QUI PLANIFICA. Ningú no decideix «vaig a
 * Burgos»: decideix «vaig a Burgos O a Sòria», i el que ho decideix és una
 * xifra, els segons de fase central que hi guanya o hi perd. Aquesta és la
 * pantalla que la dona.
 *
 * ═══ PER QUÈ ENS PODEM PERMETRE ENSENYAR UNA DIFERÈNCIA DE SIS SEGONS ═══════
 *
 * Sembla una contradicció amb `core/astro/uncertainty.ts`, que documenta que
 * les efemèrides que fem servir tenen ±2,0″ d'error de posició relativa
 * Sol-Lluna i que això són ±3,4 s d'incertesa sobre QUALSEVOL hora de contacte
 * el 2026 (±4,3 s el 2027, ±4,7 s el 2028). Si cada durada absoluta va amb
 * aquesta barra, com pot ser fiable una diferència més petita?
 *
 * Perquè l'error NO és soroll: és un BIAIX. El mateix mòdul ho mesura i ho diu
 * amb totes les lletres — dins d'un mateix eclipsi el vector d'error varia
 * menys de 0,05″ en quatre minuts. És un vector fix i desconegut, no una
 * variable aleatòria que es torni a tirar a cada punt.
 *
 * Dos llocs a desenes de quilòmetres l'un de l'altre comparteixen aquell
 * vector. Si el paràmetre d'impacte de tots dos es desplaça la MATEIXA
 * quantitat e⊥, la diferència de durades només en pateix a segon ordre: el que
 * queda és D''·e⊥·(m_B − m_A), i no el D'·e⊥ que domina cada durada per
 * separat. El biaix comú es cancel·la en restar.
 *
 * ON DEIXA DE CANCEL·LAR-SE, I PER AIXÒ HI HA `decidable`. Si un dels dos punts
 * és al caire de la franja (`edgeUncertain`), allà la durada no és una funció
 * suau del biaix sinó un esglaó: segons el signe de e⊥ hi ha vint segons de
 * totalitat o no n'hi ha cap. Llavors ni el SIGNE de la diferència està
 * garantit, i dir «Sòria és millor per set segons» seria mentir amb precisió.
 * En aquest cas es diu que no es pot decidir i s'aconsella entrar cap endins.
 */

import type { LocalCircumstances } from '../../core/astro/types';
import { distanceM } from '../../state/location';

/**
 * Diferència a partir de la qual val la pena moure's, en segons.
 *
 * D'ON SURT EL 5. És la incertesa de les efemèrides sobre una hora de contacte,
 * arrodonida cap amunt: ±3,4 s el 2026, ±4,3 s el 2027, ±4,7 s el 2028. Per
 * sota d'aquesta xifra no estem dient una diferència entre dos llocs, estem
 * dient una diferència més petita que el que sabem prometre sobre qualsevol
 * instant d'aquest eclipsi, i fer conduir ningú per això és fer-lo conduir per
 * res. Cinc segons en una totalitat espanyola de 2026, que ronda els cent, són
 * el 5 % de l'esdeveniment: per damunt d'això ja és una decisió de debò.
 */
export const WORTH_MOVING_SEC = 5;

/** Un dels dos costats de la comparació. */
export interface ComparedPlace {
  label: string | null;
  circumstances: LocalCircumstances;
}

export interface PlaceComparison {
  /** Distància entre els dos punts, en quilòmetres. */
  distanceKm: number;
  /** Durada de la fase central a cada punt, en segons. Zero vol dir que no n'hi ha. */
  aCentralSec: number;
  bCentralSec: number;
  /** B menys A. Positiu vol dir que B és millor. */
  deltaSec: number;
  /** Obscuració màxima a cada punt, de 0 a 1. */
  aObscuration: number;
  bObscuration: number;
  /** Altura aparent del Sol al màxim, en graus. Mana per saber si el relleu tapa. */
  aSunAltitudeDeg: number;
  bSunAltitudeDeg: number;
  /**
   * Diferència d'instant del màxim, en segons. Positiu vol dir que a B passa
   * més tard. Serveix per saber si es pot arribar d'un lloc a l'altre: no es
   * pot, mai, però la gent ho pregunta i la xifra ho respon sense discussió.
   */
  deltaMaxTimeSec: number;
  /**
   * Cert quan els dos punts no són de la mateixa mena d'eclipsi: en un hi ha
   * fase central i a l'altre no. És la diferència més gran que hi pot haver i
   * no és una qüestió de segons.
   */
  changesKind: boolean;
  /**
   * Cert quan la comparació es pot sostenir. Fals quan algun dels dos punts és
   * al caire de la franja, on ni el signe de la diferència està garantit.
   */
  decidable: boolean;
  /** Cert quan la diferència és prou gran per justificar el desplaçament. */
  worthMoving: boolean;
  /** Quin dels dos guanya. `null` quan no es pot decidir o quan empaten. */
  better: 'a' | 'b' | null;
}

function centralSec(c: LocalCircumstances): number {
  return c.kind === 'total' || c.kind === 'annular' ? c.centralDurationSec : 0;
}

/**
 * Compara dos llocs per al mateix eclipsi.
 *
 * Les circumstàncies han d'estar calculades per al MATEIX `eclipseId`: comparar
 * el 2026 amb el 2027 dona un número que sembla una diferència i no ho és.
 * S'hi posa un `console` no; s'hi posa una condició, i el resultat és
 * `decidable: false`.
 */
export function comparePlaces(a: ComparedPlace, b: ComparedPlace): PlaceComparison {
  const ca = a.circumstances;
  const cb = b.circumstances;

  const aCentralSec = centralSec(ca);
  const bCentralSec = centralSec(cb);
  const deltaSec = bCentralSec - aCentralSec;

  const sameEclipse = ca.eclipseId === cb.eclipseId;
  const edge = ca.edgeUncertain || cb.edgeUncertain;
  const decidable = sameEclipse && !edge;

  const worthMoving = decidable && Math.abs(deltaSec) >= WORTH_MOVING_SEC;

  return {
    distanceKm: distanceM(ca.location, cb.location) / 1000,
    aCentralSec,
    bCentralSec,
    deltaSec,
    aObscuration: ca.contacts.max.obscuration,
    bObscuration: cb.contacts.max.obscuration,
    aSunAltitudeDeg: ca.contacts.max.sun.altitudeApparent,
    bSunAltitudeDeg: cb.contacts.max.sun.altitudeApparent,
    deltaMaxTimeSec:
      (cb.contacts.max.time.getTime() - ca.contacts.max.time.getTime()) / 1000,
    changesKind: (aCentralSec === 0) !== (bCentralSec === 0),
    decidable,
    worthMoving,
    better: !decidable || deltaSec === 0 ? null : deltaSec > 0 ? 'b' : 'a',
  };
}
