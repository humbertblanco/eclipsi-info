/**
 * Hook de lectura dels sensors d'orientació, amb les diferències entre iOS i
 * Android absorbides aquí dins.
 *
 * TRES COSES QUE AQUEST FITXER FA I QUE NO SÓN ÒBVIES:
 *
 *  1. LA POSTURA VIU EN UNA REF, NO EN UN ESTAT DE REACT. Els esdeveniments
 *     arriben fins a 67 vegades per segon. Amb `useState`, cada lectura
 *     provocava un render de tot l'arbre i, pitjor, tornava a crear l'efecte
 *     del bucle de dibuix d'`ARView`, que cancel·lava el `requestAnimationFrame`
 *     pendent abans que s'executés: la superposició es congelava mentre el
 *     vídeo seguia. El bucle de dibuix llegeix `cameraRef`; a l'estat només hi
 *     va el que ha de veure la interfície, i a quatre hertzs.
 *  2. LA LECTURA PASSA PEL FILTRE D'1 EURO sobre quaternions. Els angles
 *     d'Euler no es poden suavitzar directament: alpha salta de 359° a 0° i a
 *     beta = ±90° —que és com es té el telèfon quan s'apunta a l'horitzó— hi ha
 *     bloqueig de cardan.
 *  3. LA DECLINACIÓ MAGNÈTICA S'APLICA A L'AZIMUT FINAL, no a l'alpha. Vegeu
 *     `trueAzimuth` a `core/geomag`: sobre l'alpha el signe va invertit i
 *     l'error es duplicaria en comptes d'anul·lar-se.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cameraPointingFromQuaternion, type CameraPointing } from './orientation';
import { quaternionFromEulerZXY } from './quaternion';
import { IosYawOffset } from './iosHeading';
import {
  AngleWindow,
  OrientationSmoother,
  DEFAULT_SMOOTHING,
  type SmoothingTelemetry,
} from './smoothing';
import { trueAzimuth } from '../../core/geomag';

export type PermissionState = 'unknown' | 'need-gesture' | 'granted' | 'denied' | 'unsupported';

/** D'on surt el rumb absolut, que determina si ens en podem fiar. */
export type HeadingSource =
  | 'ios-compass'      // webkitCompassHeading: absolut i bo
  | 'absolute-alpha'   // deviceorientationabsolute: absolut i bo
  | 'relative-alpha'   // alpha relativa: NO serveix sense calibrar
  | 'none';

/** Ordre de preferència. Mai es baixa d'esglaó un cop s'ha pujat. */
const SOURCE_RANK: Record<HeadingSource, number> = {
  'ios-compass': 3,
  'absolute-alpha': 2,
  'relative-alpha': 1,
  none: 0,
};

/** Cada quant es publica l'estat per a la interfície, en mil·lisegons. */
const UI_REFRESH_MS = 250;

export interface OrientationReading {
  permission: PermissionState;
  /**
   * Postura per a la INTERFÍCIE, refrescada a quatre hertzs.
   *
   * El bucle de dibuix NO ha de fer servir això: ha de llegir `cameraRef`, que
   * s'actualitza a cada lectura del sensor i no provoca cap render.
   */
  camera: CameraPointing | null;
  /** Postura viva, per al bucle de dibuix. */
  cameraRef: React.RefObject<CameraPointing | null>;
  headingSource: HeadingSource;
  /** Precisió declarada pel sistema, en graus. Només iOS la dona. */
  compassAccuracy: number | null;
  /**
   * Dispersió del rumb EN BRUT en els últims segons, en graus. Mesura el soroll
   * real del sensor en aquest lloc concret — a prop de metall es dispara.
   */
  jitter: number;
  /**
   * La mateixa dispersió DESPRÉS del filtre, amb el mateix estimador.
   *
   * La parella de números és el que diu si el filtre serveix d'alguna cosa en
   * aquest telèfon i en aquest lloc. Amb dos estimadors diferents no voldria dir
   * res, i per això tots dos surten de `circularSpreadDeg`.
   */
  jitterFiltered: number;
  /** Freqüència d'arribada d'esdeveniments, en Hz. */
  sampleRate: number;
  /** Què ha fet el filtre en l'última lectura, per a la interfície. */
  smoothing: SmoothingTelemetry;
  /**
   * El mateix, viu, per al bucle de dibuix.
   *
   * La velocitat angular decideix amb quina força el sensor estira la postura
   * fusionada, i aquesta decisió es pren a cada fotograma: llegir-la de l'estat
   * de React la faria arribar fins a un quart de segon tard, que és mig gest.
   */
  smoothingRef: React.RefObject<SmoothingTelemetry>;
  raw: { alpha: number | null; beta: number | null; gamma: number | null };
}

interface IosDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

type PermissionCapableCtor = {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/** iOS exigeix demanar permís explícitament i des d'un gest de l'usuari. */
export function needsPermissionGesture(): boolean {
  const ctor = DeviceOrientationEvent as unknown as PermissionCapableCtor;
  return typeof ctor?.requestPermission === 'function';
}

export function useDeviceOrientation(
  /**
   * Declinació magnètica del lloc, en graus, a sumar a l'azimut. Zero mentre no
   * se sap on som: val més un azimut magnètic que un de fals.
   */
  declinationDeg = 0,
): OrientationReading & { request: () => Promise<void> } {
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      return 'unsupported';
    }
    return needsPermissionGesture() ? 'need-gesture' : 'unknown';
  });

  // Tot el que canvia a la freqüència del sensor viu en refs.
  const cameraRef = useRef<CameraPointing | null>(null);
  const smootherRef = useRef(new OrientationSmoother(DEFAULT_SMOOTHING));
  const rawWindow = useRef(new AngleWindow(90));
  const filteredWindow = useRef(new AngleWindow(90));
  const stamps = useRef<number[]>([]);
  const lastEventMs = useRef<number | null>(null);
  const bestSourceRef = useRef<HeadingSource>('none');
  const accuracyRef = useRef<number | null>(null);
  const rawAnglesRef = useRef<OrientationReading['raw']>({
    alpha: null,
    beta: null,
    gamma: null,
  });
  const declinationRef = useRef(declinationDeg);
  declinationRef.current = declinationDeg;
  const smoothingRef = useRef<SmoothingTelemetry>(smootherRef.current.getTelemetry());
  /** Offset entre l'alpha relativa i el nord, només iOS. Vegeu `iosHeading`. */
  const iosOffsetRef = useRef(new IosYawOffset());

  // I només això arriba a React, quatre vegades per segon.
  const [ui, setUi] = useState<{
    camera: CameraPointing | null;
    headingSource: HeadingSource;
    compassAccuracy: number | null;
    jitter: number;
    jitterFiltered: number;
    sampleRate: number;
    smoothing: SmoothingTelemetry;
    raw: OrientationReading['raw'];
  }>(() => ({
    camera: null,
    headingSource: 'none',
    compassAccuracy: null,
    jitter: 0,
    jitterFiltered: 0,
    sampleRate: 0,
    smoothing: smootherRef.current.getTelemetry(),
    raw: { alpha: null, beta: null, gamma: null },
  }));

  const handle = useCallback((event: DeviceOrientationEvent) => {
    const e = event as IosDeviceOrientationEvent;
    if (e.beta === null || e.gamma === null) return;

    let alpha: number;
    let source: HeadingSource;

    if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
      /*
       * iOS: `alpha` és relativa i el compass és absolut, però substituir
       * l'una per l'altre per esdeveniment (el que es feia abans) només és
       * exacte amb el telèfon PLA: inclinant-lo cap al cel, el heading es
       * desplaça en funció del pitch i l'azimut lliscava mentre l'usuari
       * inclinava. Ara el quaternió es construeix amb l'alpha relativa —
       * contínua i amb el pitch net — més un OFFSET cap al nord que s'aprèn
       * del compass només en postures on el compass és de fiar. Vegeu
       * `iosHeading.ts`.
       */
      source = 'ios-compass';
      if (typeof e.webkitCompassAccuracy === 'number') {
        accuracyRef.current = e.webkitCompassAccuracy >= 0 ? e.webkitCompassAccuracy : null;
      }
      if (e.alpha !== null) {
        // Altura de la càmera des d'AQUEST esdeveniment (no depèn d'alpha):
        // la postura del gate ha de ser la d'ara, no la de fa una lectura.
        const DEG = Math.PI / 180;
        const cosB = Math.cos(e.beta * DEG);
        const cosG = Math.cos(e.gamma * DEG);
        const altitudeDeg =
          Math.asin(Math.max(-1, Math.min(1, -cosB * cosG))) * (180 / Math.PI);
        const nowIos = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const dtIos =
          lastEventMs.current === null ? 0 : (nowIos - lastEventMs.current) / 1000;
        const offset = iosOffsetRef.current.update(
          e.webkitCompassHeading,
          e.alpha,
          altitudeDeg,
          dtIos,
        );
        // Mentre no hi ha offset après (app oberta apuntant amunt), es recorre
        // a la substitució de sempre, que en aquella postura no és pitjor del
        // que era.
        alpha = offset === null ? 360 - e.webkitCompassHeading : e.alpha + offset;
      } else {
        alpha = 360 - e.webkitCompassHeading;
      }
    } else if (e.absolute && e.alpha !== null) {
      alpha = e.alpha;
      source = 'absolute-alpha';
    } else if (e.alpha !== null) {
      alpha = e.alpha;
      source = 'relative-alpha';
    } else {
      return;
    }

    // Només fem cas de la millor font. Un cop hem vist rumb absolut, els
    // esdeveniments relatius es descarten per sempre.
    //
    // Sense això, a Chrome/Android arriben `deviceorientation` i
    // `deviceorientationabsolute` tots dos a uns 60 Hz, un amb rumb ABSOLUT i
    // l'altre amb un origen de guinyada ARBITRARI, i el rumb saltava entre dues
    // bases a cada fotograma: ±47,7° de soroll. I no és una cosa que el
    // calibratge pugui salvar: un offset únic no pot corregir un rumb que
    // alterna entre dos orígens.
    if (SOURCE_RANK[source] < SOURCE_RANK[bestSourceRef.current]) return;
    bestSourceRef.current = source;

    const screenAngle =
      typeof screen !== 'undefined' && screen.orientation ? screen.orientation.angle : 0;

    // dt REAL. `deviceorientation` no arriba a freqüència fixa: va de 67 Hz a
    // 1 Hz segons el model, la càrrega i la brillantor de la pantalla. Amb un
    // dt constant, el mateix codi suavitzaria diferent a cada mòbil.
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dtSec = lastEventMs.current === null ? 0 : (now - lastEventMs.current) / 1000;
    lastEventMs.current = now;

    const q = quaternionFromEulerZXY(alpha, e.beta, e.gamma);
    const rawPointing = cameraPointingFromQuaternion(q, screenAngle);
    const smoothed = cameraPointingFromQuaternion(
      smootherRef.current.push(q, dtSec),
      screenAngle,
    );

    const declination = declinationRef.current;
    cameraRef.current = {
      ...smoothed,
      azimuth: trueAzimuth(smoothed.azimuth, declination),
    };

    smoothingRef.current = smootherRef.current.getTelemetry();
    rawAnglesRef.current = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
    rawWindow.current.push(rawPointing.azimuth);
    filteredWindow.current.push(smoothed.azimuth);

    stamps.current.push(now);
    while (stamps.current.length > 0 && now - stamps.current[0] > 1000) {
      stamps.current.shift();
    }
  }, []);

  // Publicació cap a la interfície, desacoblada de la freqüència del sensor.
  useEffect(() => {
    const id = setInterval(() => {
      setUi({
        camera: cameraRef.current,
        headingSource: bestSourceRef.current,
        compassAccuracy: accuracyRef.current,
        jitter: rawWindow.current.spreadDeg(),
        jitterFiltered: filteredWindow.current.spreadDeg(),
        sampleRate: stamps.current.length,
        smoothing: smootherRef.current.getTelemetry(),
        raw: rawAnglesRef.current,
      });
    }, UI_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const attach = useCallback(() => {
    // `deviceorientationabsolute` és el que dona rumb absolut a Android.
    // Escoltem els dos i deixem que guanyi el que porti dades absolutes.
    window.addEventListener('deviceorientationabsolute', handle as EventListener);
    window.addEventListener('deviceorientation', handle as EventListener);
  }, [handle]);

  const request = useCallback(async () => {
    const ctor = DeviceOrientationEvent as unknown as PermissionCapableCtor;
    if (typeof ctor?.requestPermission === 'function') {
      try {
        const result = await ctor.requestPermission();
        if (result !== 'granted') {
          setPermission('denied');
          return;
        }
      } catch {
        setPermission('denied');
        return;
      }
    }
    setPermission('granted');
    attach();
  }, [attach]);

  useEffect(() => {
    if (permission === 'unsupported' || permission === 'need-gesture') return;
    attach();
    return () => {
      window.removeEventListener('deviceorientationabsolute', handle as EventListener);
      window.removeEventListener('deviceorientation', handle as EventListener);
    };
  }, [permission, attach, handle]);

  return useMemo(
    () => ({
      permission,
      camera: ui.camera,
      cameraRef,
      headingSource: ui.headingSource,
      compassAccuracy: ui.compassAccuracy,
      jitter: ui.jitter,
      jitterFiltered: ui.jitterFiltered,
      sampleRate: ui.sampleRate,
      smoothing: ui.smoothing,
      smoothingRef,
      raw: ui.raw,
      request,
    }),
    [permission, ui, request],
  );
}
