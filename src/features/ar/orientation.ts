/**
 * De l'esdeveniment `deviceorientation` a "cap a on apunta la càmera".
 *
 * El navegador ens dona tres angles d'Euler (alpha, beta, gamma) que
 * descriuen l'orientació del telèfon. El que necessitem nosaltres és una cosa
 * diferent: l'azimut i l'altura del punt del cel cap on mira l'objectiu de la
 * càmera del darrere, més el gir de la imatge.
 *
 * Convenis:
 *  - Marc del dispositiu: x cap a la dreta de la pantalla, y cap amunt de la
 *    pantalla, z surt de la pantalla cap a l'usuari. La càmera del darrere
 *    mira, doncs, cap a -z.
 *  - Marc del món (W3C): X est, Y nord, Z amunt.
 */

import { DEFAULT_SENSOR_FOV_DEG, type Viewport } from './cameraGeometry';
import { quaternionNormalize, type Quaternion } from './quaternion';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export interface CameraPointing {
  /** Azimut cap on mira la càmera, en graus (0 = nord, 90 = est). */
  azimuth: number;
  /** Altura sobre l'horitzó de l'eix òptic, en graus. */
  altitude: number;
  /**
   * Gir de la imatge respecte a l'horitzó, en graus. Cal per dibuixar
   * l'overlay dret quan l'usuari inclina el telèfon.
   */
  roll: number;
  /**
   * `screen.orientation.angle`, en graus.
   *
   * L'eix òptic de la càmera no depèn de com estigui girada la pantalla, però
   * el canvas on dibuixem sí: es dibuixa al marc CSS, que el navegador gira
   * amb el dispositiu. Sense aquest terme, en apaisat la superposició queda
   * girada 90° respecte a la imatge.
   */
  screenAngle: number;
}

type Matrix3 = [number, number, number, number, number, number, number, number, number];

/**
 * Matriu de rotació del marc del dispositiu al marc del món, a partir dels
 * angles d'Euler en l'ordre ZXY que fixa l'especificació del W3C.
 */
export function rotationMatrix(alpha: number, beta: number, gamma: number): Matrix3 {
  const z = alpha * DEG;
  const x = beta * DEG;
  const y = gamma * DEG;

  const cX = Math.cos(x);
  const cY = Math.cos(y);
  const cZ = Math.cos(z);
  const sX = Math.sin(x);
  const sY = Math.sin(y);
  const sZ = Math.sin(z);

  return [
    cZ * cY - sZ * sX * sY,
    -cX * sZ,
    cY * sZ * sX + cZ * sY,

    cY * sZ + cZ * sX * sY,
    cZ * cX,
    sZ * sY - cZ * cY * sX,

    -cX * sY,
    sX,
    cX * cY,
  ];
}

/**
 * La mateixa matriu a partir d'un quaternió, per al camí filtrat.
 *
 * Ha de descriure exactament la mateixa rotació que `rotationMatrix` per als
 * mateixos angles. Si divergissin, l'overlay faria un salt en activar o
 * desactivar el filtre de soroll, i aquest salt seria indistingible d'un error
 * del sensor. Ho comprova `quaternion.test.ts`.
 */
export function rotationMatrixFromQuaternion(q: Quaternion): Matrix3 {
  const [x, y, z, w] = quaternionNormalize(q);

  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;

  return [
    1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy),
    2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx),
    2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy),
  ];
}

/**
 * Direcció de la càmera i gir de la imatge.
 *
 * @param alpha rotació al voltant de l'eix z, en graus, ABSOLUTA respecte al
 *              nord MAGNÈTIC. A iOS cal derivar-la de `webkitCompassHeading`,
 *              perquè l'alpha que dona Safari és relativa i no serveix per a
 *              res que tingui a veure amb la realitat augmentada. El pas de
 *              nord magnètic a geogràfic el fa la declinació, a `core/geomag`,
 *              i s'aplica abans d'arribar aquí.
 */
export function cameraPointing(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngle = 0,
): CameraPointing {
  return pointingFromMatrix(rotationMatrix(alpha, beta, gamma), screenAngle);
}

/** El mateix a partir d'un quaternió: és el camí que fa servir el filtre. */
export function cameraPointingFromQuaternion(
  q: Quaternion,
  screenAngle = 0,
): CameraPointing {
  return pointingFromMatrix(rotationMatrixFromQuaternion(q), screenAngle);
}

function pointingFromMatrix(m: Matrix3, screenAngle: number): CameraPointing {
  // L'eix òptic de la càmera del darrere és -z del dispositiu; en coordenades
  // del món és menys la tercera columna de la matriu.
  const fE = -m[2];
  const fN = -m[5];
  const fU = -m[8];

  const azimuth = (Math.atan2(fE, fN) * RAD + 360) % 360;
  const altitude = Math.asin(Math.max(-1, Math.min(1, fU))) * RAD;

  // Gir: angle entre el "amunt" del món projectat al pla de la imatge i el
  // "amunt" de la pantalla, mesurat al voltant de l'eix òptic.
  const upE = m[1];
  const upN = m[4];
  const upU = m[7];

  // Projecció del vertical del món sobre el pla perpendicular a l'eix òptic.
  const dot = fU; // (0,0,1) · f
  const pE = -dot * fE;
  const pN = -dot * fN;
  const pU = 1 - dot * fU;
  const pLen = Math.hypot(pE, pN, pU);

  let roll = 0;
  if (pLen > 1e-6) {
    const nE = pE / pLen;
    const nN = pN / pLen;
    const nU = pU / pLen;

    const cross = [
      nN * upU - nU * upN,
      nU * upE - nE * upU,
      nE * upN - nN * upE,
    ];
    const sin = cross[0] * fE + cross[1] * fN + cross[2] * fU;
    const cos = nE * upE + nN * upN + nU * upU;
    roll = Math.atan2(sin, cos) * RAD;
  }

  return { azimuth, altitude, roll, screenAngle };
}

export interface Calibration {
  /**
   * Correcció d'azimut, en graus, a sumar a la lectura de la brúixola.
   *
   * Aquest és el paràmetre que salva el projecte. El magnetòmetre d'un mòbil
   * s'equivoca típicament entre 10° i 20°, i molt més a prop d'un cotxe, una
   * barana o un altaveu. No és un problema del navegador: ARKit amb
   * `.gravityAndHeading` arrossega exactament el mateix error. Es corregeix
   * fent que l'usuari toqui el Sol a la pantalla i resolent l'offset, perquè
   * la posició real del Sol la sabem amb precisió d'arcminut.
   */
  azimuthOffset: number;
  /** Correcció d'altura. Sol ser petita: l'acceleròmetre és molt bo. */
  altitudeOffset: number;
  /**
   * Camp de visió horitzontal del SENSOR, en graus.
   *
   * Compte: no és el camp de visió del que es veu a la pantalla. El vídeo es
   * mostra retallat, i la conversió la fa `cameraGeometry.ts`, que en treu la
   * distància focal en píxels. La projecció treballa sempre amb aquesta focal,
   * mai amb aquest angle.
   */
  sensorFovDeg: number;
}

export const DEFAULT_CALIBRATION: Calibration = {
  azimuthOffset: 0,
  altitudeOffset: 0,
  sensorFovDeg: DEFAULT_SENSOR_FOV_DEG,
};

export interface ScreenProjection {
  x: number;
  y: number;
  /** Fals si el punt queda darrere de la càmera i no s'ha de dibuixar. */
  visible: boolean;
}

/**
 * Projecció gnomònica d'una direcció del cel a coordenades de pantalla.
 *
 * És la projecció correcta per a una càmera amb objectiu rectilini: els raigs
 * que arriben al sensor es projecten com una perspectiva de debò, no com una
 * simple regla d'angles per píxel. La diferència amb l'aproximació lineal ja
 * es nota als extrems de la imatge amb un camp de 66°.
 */
export function projectToScreen(
  targetAz: number,
  targetAlt: number,
  camera: CameraPointing,
  calibration: Calibration,
  viewport: Viewport,
): ScreenProjection {
  const { width, height, focalPx: focal } = viewport;
  const az = camera.azimuth + calibration.azimuthOffset;
  const alt = camera.altitude + calibration.altitudeOffset;

  // Vector unitari cap a l'objectiu, en coordenades del món.
  const t = sphericalToVector(targetAz, targetAlt);

  // Base ortonormal de la càmera: endavant, dreta i amunt.
  const fwd = sphericalToVector(az, alt);
  const worldUp: [number, number, number] = [0, 0, 1];
  let right = cross(fwd, worldUp);
  const rightLen = Math.hypot(...right);
  if (rightLen < 1e-6) {
    // La càmera apunta al zenit o al nadir: la referència horitzontal es perd.
    right = [1, 0, 0];
  } else {
    right = [right[0] / rightLen, right[1] / rightLen, right[2] / rightLen];
  }
  const up = cross(right, fwd);

  const depth = dot(t, fwd);
  if (depth <= 1e-4) {
    return { x: 0, y: 0, visible: false };
  }

  // Coordenades al pla de la imatge, en unitats de distància focal.
  const cx = dot(t, right) / depth;
  const cy = dot(t, up) / depth;

  // Gir de la imatge.
  //
  // COMPTE AMB EL SIGNE: aquí hi havia un menys, i feia que tota la
  // superposició girés el DOBLE del que toca. Amb el telèfon dret l'error és
  // zero i no salta a la vista, però amb 15° d'inclinació de mà la marca de C1
  // queia a 38 píxels del lloc correcte, i amb 30° a 13,7 graus. Verificat
  // contra una projecció estenopeica de referència sobre 19.599 postures: amb
  // el signe correcte l'error màxim és de 5·10⁻¹³ px.
  //
  // També s'hi suma l'angle de la pantalla. L'eix òptic no depèn de com estigui
  // girada la pantalla, però el canvas es dibuixa al marc CSS, que el navegador
  // sí que gira. Sense aquest terme, en apaisat l'error arriba als 27°, i el
  // calibratge per toc no ho pot salvar: un gir al voltant de l'eix òptic no es
  // compensa amb desplaçaments d'azimut ni d'altura.
  const r = (camera.roll + camera.screenAngle) * DEG;
  const cosR = Math.cos(r);
  const sinR = Math.sin(r);
  const px = cx * cosR - cy * sinR;
  const py = cx * sinR + cy * cosR;

  return {
    x: width / 2 + px * focal,
    y: height / 2 - py * focal,
    visible: true,
  };
}

/**
 * Inversa exacta de `projectToScreen`: de píxel de pantalla a direcció del cel.
 *
 * Reconstrueix el raig desfent la mateixa geometria 3D que fa la projecció.
 *
 * Abans això es feia convertint el desplaçament en pantalla a dos angles amb
 * `atan` i sumant-los a l'azimut i l'altura, amb un factor `1/cos(altura)`
 * posat a ull. Només coincideix amb la projecció a primer ordre i quan es toca
 * just al centre: amb sensors PERFECTES i el Sol a 30° d'altura, tocar-lo
 * deixava un salt de 4,36°. I el calibratge es fa amb el Sol de l'instant en
 * què s'obre l'app, que a Espanya sovint és a 50-70° d'altura, o sigui de ple
 * dins la zona on això fallava.
 *
 * Amb la reconstrucció del raig l'error és de 0,000000° a tot l'escombrat.
 */
export function unprojectFromScreen(
  screenX: number,
  screenY: number,
  camera: CameraPointing,
  calibration: Calibration,
  viewport: Viewport,
): { azimuth: number; altitude: number } {
  const { width, height, focalPx: focal } = viewport;

  // Desfem el gir amb la rotació INVERSA de la que aplica la projecció.
  const r = -(camera.roll + camera.screenAngle) * DEG;
  const dx = (screenX - width / 2) / focal;
  const dy = (height / 2 - screenY) / focal;
  const cosR = Math.cos(r);
  const sinR = Math.sin(r);
  const px = dx * cosR - dy * sinR;
  const py = dx * sinR + dy * cosR;

  const az = camera.azimuth + calibration.azimuthOffset;
  const alt = camera.altitude + calibration.altitudeOffset;

  const fwd = sphericalToVector(az, alt);
  const worldUp: [number, number, number] = [0, 0, 1];
  let right = cross(fwd, worldUp);
  const rightLen = Math.hypot(...right);
  if (rightLen < 1e-6) {
    right = [1, 0, 0];
  } else {
    right = [right[0] / rightLen, right[1] / rightLen, right[2] / rightLen];
  }
  const up = cross(right, fwd);

  const rayE = fwd[0] + px * right[0] + py * up[0];
  const rayN = fwd[1] + px * right[1] + py * up[1];
  const rayU = fwd[2] + px * right[2] + py * up[2];
  const len = Math.hypot(rayE, rayN, rayU);

  return {
    azimuth: (Math.atan2(rayE / len, rayN / len) * RAD + 360) % 360,
    altitude: Math.asin(Math.max(-1, Math.min(1, rayU / len))) * RAD,
  };
}

/*
 * Aquí hi havia `calibrateFromTap`, la resolució del calibratge per toc sobre
 * el Sol. La interfície que el cridava es va treure (vegeu la nota d'ARView
 * sobre el calibratge per toc) i la funció va quedar exportada sense cap
 * cridador durant mesos — codi mort que semblava una funcionalitat. La seva
 * feina la fa l'ancoratge al terreny, que no demana res a ningú. Els offsets
 * de `Calibration` es queden: són el punt d'entrada de qualsevol correcció
 * futura i la projecció ja els aplica.
 */

/** Separació angular entre dues direccions del cel, en graus. */
export function angularSeparationDeg(
  az1: number,
  alt1: number,
  az2: number,
  alt2: number,
): number {
  const a = sphericalToVector(az1, alt1);
  const b = sphericalToVector(az2, alt2);
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * RAD;
}

function sphericalToVector(azDeg: number, altDeg: number): [number, number, number] {
  const az = azDeg * DEG;
  const alt = altDeg * DEG;
  const cosAlt = Math.cos(alt);
  // X est, Y nord, Z amunt.
  return [cosAlt * Math.sin(az), cosAlt * Math.cos(az), Math.sin(alt)];
}

function cross(
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function normalizeAngle(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}
