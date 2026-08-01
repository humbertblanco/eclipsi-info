/**
 * Si aquest aparell pot fer la vista de realitat augmentada.
 *
 * PER QUÈ CAL PREGUNTAR-HO. La pantalla del cel demana tres coses que un
 * ordinador de sobretaula no té: una càmera que miri cap ENFORA (la del portàtil
 * mira l'usuari, i superposar-hi el recorregut del Sol dona una cara amb una
 * corba a sobre), sensors d'orientació que diguin cap on apunta l'aparell, i
 * que l'aparell es pugui moure. Sense això, la funció no és pitjor: és una
 * altra cosa que no serveix per a res, i oferir-la fa que qui la prova pensi
 * que l'app està trencada.
 *
 * NO ES MIRA EL «USER AGENT». Dir qui ets no és el mateix que dir què pots
 * fer: hi ha portàtils amb pantalla tàctil i giroscopi, i hi ha tauletes que
 * es fan passar per ordinadors. Es pregunta per les CAPACITATS, que és el que
 * de veritat decideix si la funció té sentit:
 *
 *   · Que hi hagi esdeveniments d'orientació. És el requisit dur: sense saber
 *     cap on apuntes no hi ha res a superposar.
 *   · Que el punter principal sigui gruixut (un dit) i no fi (un ratolí). És
 *     la manera estàndard de distingir un aparell que s'agafa amb la mà d'un
 *     que és damunt d'una taula.
 *
 * A iOS el permís d'orientació es demana amb un gest i fins llavors no se sap
 * del cert si hi és; per això la presència de l'API ja compta com a sí. Val més
 * oferir-ho i que després calgui un permís que amagar-ho a qui ho podria fer
 * servir.
 */

import { useEffect, useState } from 'react';

export interface CameraSupport {
  /** Cert si té sentit oferir la vista de RA en aquest aparell. */
  supported: boolean;
  /** Cert mentre encara no s'ha pogut mirar (primer render al servidor o tests). */
  unknown: boolean;
}

/** La comprovació, sense React, per poder-la provar i reutilitzar. */
export function detectCameraSupport(): boolean {
  if (typeof window === 'undefined') return false;

  // Sense càmera no hi ha res a fer, i sense `mediaDevices` ni tan sols es pot
  // preguntar. Els navegadors només l'exposen en context segur (https), que és
  // el mateix requisit que té la geolocalització.
  const hasCamera =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function';
  if (!hasCamera) return false;

  const hasOrientation = 'DeviceOrientationEvent' in window;
  if (!hasOrientation) return false;

  // `pointer: coarse` vol dir «el punter principal és un dit». Si el navegador
  // no sap respondre, es dona per bo: el requisit dur ja s'ha comprovat.
  const query = window.matchMedia?.('(pointer: coarse)');
  return query === undefined || query.matches;
}

export function useCameraSupport(): CameraSupport {
  const [state, setState] = useState<CameraSupport>({ supported: false, unknown: true });

  useEffect(() => {
    setState({ supported: detectCameraSupport(), unknown: false });
  }, []);

  return state;
}
