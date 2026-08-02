/**
 * Historial curt de postures del sensor, amb marca de temps.
 *
 * PER QUÈ. El fotograma que la càmera lliura NO és d'ara: la canonada de
 * càmera triga entre 40 i 80 mil·lisegons, i a 30°/s això són fins a dos
 * graus i mig de desfasament entre el que la imatge ensenya i el que el
 * sensor diu EN AQUEST INSTANT. Totes les comparacions imatge-contra-sensor —
 * la pista del seguidor, els parells de l'estimador de focal, l'error dels
 * ancoratges — han de fer-se contra la postura DE QUAN EL FOTOGRAMA ES VA
 * CAPTURAR, no la d'ara. Aquest buffer la recorda; `VideoFrameClock` diu
 * l'instant de captura (exacte on el navegador el dona, estimat on no).
 *
 * Trenta-dues entrades a ~60 Hz són mig segon de memòria: deu vegades la
 * latència més llarga que s'ha vist mai en una canonada de mòbil.
 *
 * Sense DOM, i amb la interpolació circular de l'azimut feta amb compte: la
 * mitjana de 359° i 1° és 0°, no 180°.
 */

import { normalizeDelta } from './poseFusion';

export interface TimedPose {
  tMs: number;
  azimuth: number;
  altitude: number;
  roll: number;
  screenAngle: number;
}

const CAPACITY = 32;

export class PoseHistory {
  private buf: TimedPose[] = [];

  push(pose: TimedPose): void {
    // Un temps que recula (canvi de pestanya, rellotge que fa un bot) buida
    // la memòria: interpolar a través d'un forat seria inventar moviment.
    const last = this.buf[this.buf.length - 1];
    if (last && pose.tMs < last.tMs) this.buf.length = 0;
    this.buf.push(pose);
    if (this.buf.length > CAPACITY) this.buf.shift();
  }

  /**
   * La postura a l'instant demanat, interpolada entre les dues mostres que
   * l'envolten. Fora de rang es retorna l'extrem (mai s'extrapola: el que hi
   * hagi passat després de l'última mostra encara no se sap). Buit → null.
   */
  at(tMs: number): TimedPose | null {
    const n = this.buf.length;
    if (n === 0) return null;
    if (tMs <= this.buf[0].tMs) return this.buf[0];
    if (tMs >= this.buf[n - 1].tMs) return this.buf[n - 1];

    // Cerca lineal des del final: l'instant demanat és gairebé sempre a un
    // parell de mostres de l'última.
    let i = n - 1;
    while (i > 0 && this.buf[i - 1].tMs > tMs) i--;
    const a = this.buf[i - 1];
    const b = this.buf[i];
    const span = b.tMs - a.tMs;
    if (!(span > 0)) return b;
    const f = (tMs - a.tMs) / span;

    return {
      tMs,
      azimuth: a.azimuth + f * normalizeDelta(b.azimuth - a.azimuth),
      altitude: a.altitude + f * (b.altitude - a.altitude),
      roll: a.roll + f * normalizeDelta(b.roll - a.roll),
      // L'angle de pantalla és discret (0/90/180/270): res a interpolar.
      screenAngle: f < 0.5 ? a.screenAngle : b.screenAngle,
    };
  }

  clear(): void {
    this.buf.length = 0;
  }

  get size(): number {
    return this.buf.length;
  }
}
