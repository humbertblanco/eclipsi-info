/**
 * Filtre d'1 euro aplicat sobre la varietat de rotacions.
 *
 * EL COMPROMÍS QUE RESOL. Un passa-baixos amb constant fixa t'obliga a triar:
 * o l'overlay tremola amb el telèfon quiet, o s'arrossega quan gires. El filtre
 * d'1 euro (Casiez, Roussel i Vogel, CHI 2012) no tria: fa que la freqüència de
 * tall depengui de la velocitat del senyal.
 *
 *     fc = fcmin + beta · |velocitat angular|
 *     tau = 1 / (2π fc)
 *     alpha = 1 / (1 + tau/dt)
 *
 * Quiet, fc és baixa, tau gran, alpha petita: molt suavitzat i zero tremolor.
 * Girant de pressa, fc és alta, alpha s'acosta a 1: gairebé passa directe i
 * zero retard. Funciona perquè explota una asimetria de la percepció: l'ull no
 * veu soroll mentre una cosa es mou de pressa, ni veu retard quan res es mou.
 *
 * PER QUÈ SOBRE QUATERNIONS I NO SOBRE ELS TRES ANGLES. Vegeu la capçalera de
 * `quaternion.ts`: alpha salta de 359° a 0° i prop de beta = ±90°, que és com
 * es té el telèfon quan s'apunta al cel, hi ha bloqueig de cardan. Aquí el
 * filtre es formula com el factor `t` d'una interpolació esfèrica, que és el
 * mateix filtre expressat sobre rotacions.
 *
 * dt REAL, NO CONSTANT. `deviceorientation` no arriba a freqüència fixa: va de
 * 67 Hz a 1 Hz segons el model, la càrrega i si la pantalla té la brillantor
 * baixa. Amb un alpha constant —com el `smoothingFactor` fix d'AR.js/LocAR— el
 * mateix codi suavitza diferent a cada mòbil. Aquí el dt es mesura amb la
 * marca de temps de l'esdeveniment.
 *
 * L'ALGORISME ÉS DE DOMINI PÚBLIC, la implementació és nostra. La de referència
 * (casiez/OneEuroFilter) és BSD-3-Clause; no la vendoritzem perquè adaptar-la a
 * quaternions vol reescriure-la igualment i són cent línies.
 *
 * Cap dependència de DOM.
 */

import {
  quaternionAngle,
  quaternionRotationVector,
  quaternionSlerp,
  type Quaternion,
} from './quaternion';

const RAD = 180 / Math.PI;

export interface SmoothingConfig {
  /** Si és fals, la lectura passa directa. Serveix per mesurar el soroll cru. */
  enabled: boolean;
  /**
   * Freqüència de tall amb el telèfon quiet, en Hz. És el paràmetre que
   * s'ajusta primer, i s'ajusta mirant l'overlay amb el mòbil recolzat: es
   * baixa fins que deixa de tremolar.
   */
  minCutoffHz: number;
  /**
   * Quant s'obre el tall amb la velocitat angular, en Hz per (rad/s). És el
   * paràmetre que s'ajusta segon, girant de pressa: es puja fins que el retard
   * desapareix. S'ajusta multiplicant i dividint per deu, no per dos.
   */
  beta: number;
  /** Tall del filtre que suavitza la pròpia estimació de velocitat, en Hz. */
  derivativeCutoffHz: number;
  /**
   * Banda morta, en graus. Per sota d'aquest angle la lectura s'ignora i
   * l'overlay es congela del tot.
   *
   * Compte a pujar-la: massa alta i els girs molt lents es veuen a saltirons,
   * que és pitjor que un tremolor fi. Dues dècimes de grau és el punt on
   * l'overlay queda clavat amb el telèfon damunt d'una pedra i encara segueix
   * un panoràmic lent sense escalons visibles.
   */
  deadBandDeg: number;
  /**
   * Velocitat angular per sota de la qual es considera que no hi ha moviment,
   * en radians per segon. Es resta abans d'aplicar `beta`.
   *
   * Vegeu el comentari llarg d'`OneEuroQuaternionFilter.filter`: sense això, el
   * soroll de la brúixola obria el tall tot sol i el filtre no arribava mai a
   * la freqüència per a la qual estava dissenyat.
   */
  noiseFloorRadPerSec: number;
}

/**
 * Punt de partida per a un overlay solar, amb el Sol a mig grau de diàmetre.
 *
 * No són valors del paper: el paper els dona per a un cursor de ratolí. Aquests
 * surten de la relació entre el que hem de resoldre (0,53°, el disc del Sol) i
 * el soroll del magnetòmetre (0,5° a 3°). Amb el tall a 1 Hz, un tremolor de
 * mig grau a 30 Hz queda reduït per sota d'una dècima.
 *
 * D'ON SURT `beta` = 20. El retard d'un passa-baixos de primer ordre davant
 * d'un gir a velocitat constant ω és tau·ω = ω/(2π·fc). Amb fc = fcmin + β·ω,
 * quan ω creix el retard tendeix a un sostre que no depèn de la velocitat:
 *
 *     retard_màxim = 1/(2π·β) rad = 57,3/(2π·β) graus
 *
 * El valor anterior, β = 0,02, donava un sostre de 456°: a 60°/s el retard
 * mesurat era de 8,13°, que són quinze diàmetres solars arrossegant-se darrere
 * del paisatge. Amb β = 20 el sostre baixa a 0,46°, per sota del disc del Sol.
 *
 * Pujar β només és segur des que l'estimador de velocitat és VECTORIAL: amb
 * l'escalar rectificat d'abans, el soroll del sensor quiet inflava la velocitat
 * estimada i una β alta hauria obert el tall amb el telèfon damunt la taula,
 * que és el cas contrari del que es vol.
 */
export const DEFAULT_SMOOTHING: SmoothingConfig = {
  enabled: true,
  minCutoffHz: 1,
  /*
   * VINT-I-QUATRE I NO VINT, PER COMPENSAR EL TERRA.
   *
   * El terra resta 10°/s abans d'aplicar la β, o sigui que en un panoràmic de
   * 60°/s el tall s'obre com si en fossin 50 i el retard puja de 0,46° a
   * 0,55°. Pujant la β en la mateixa proporció (20 · 60/50) el retard torna al
   * lloc d'abans i, en repòs, el tall es queda clavat a 1 Hz: millor pels dos
   * extrems alhora, que és el que es buscava.
   */
  beta: 24,
  derivativeCutoffHz: 1,
  deadBandDeg: 0.15,
  // Deu graus per segon: per sobre del que qualsevol brúixola de mòbil
  // s'inventa amb el telèfon quiet, i molt per sota d'un gir intencionat.
  noiseFloorRadPerSec: (10 * Math.PI) / 180,
};

/** Sense filtre: el camí que serveix per mesurar quant soroll hi ha de debò. */
export const RAW_SMOOTHING: SmoothingConfig = { ...DEFAULT_SMOOTHING, enabled: false };

/** El que el filtre ha fet en l'última lectura, per al diagnòstic. */
export interface SmoothingTelemetry {
  /** Freqüència de tall aplicada, en Hz. */
  cutoffHz: number;
  /** Velocitat angular estimada i suavitzada, en graus per segon. */
  angularSpeedDegPerSec: number;
  /** Factor d'interpolació aplicat, de 0 a 1. U vol dir passa directe. */
  alpha: number;
  /** Interval real entre lectures, en segons. */
  dtSec: number;
  /** Cert si la lectura ha caigut dins la banda morta i s'ha ignorat. */
  frozen: boolean;
}

const INITIAL_TELEMETRY: SmoothingTelemetry = {
  cutoffHz: 0,
  angularSpeedDegPerSec: 0,
  alpha: 1,
  dtSec: 0,
  frozen: false,
};

/** Coeficient d'un passa-baixos de primer ordre per a un tall i un dt donats. */
export function lowPassAlpha(cutoffHz: number, dtSec: number): number {
  if (!(dtSec > 0) || !(cutoffHz > 0)) return 1;
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSec);
}

/**
 * Suavitzador d'orientació.
 *
 * Amb estat: guarda l'última orientació filtrada i l'última velocitat angular.
 * Una instància per flux de sensors; `reset()` quan es reprèn després d'una
 * pausa llarga, perquè interpolar entre una orientació de fa un minut i la
 * d'ara faria travessar mig cel a l'overlay.
 */
export class OrientationSmoother {
  private config: SmoothingConfig;
  private smoothed: Quaternion | null = null;
  /**
   * Última lectura EN BRUT.
   *
   * La derivada s'ha de calcular entre dues entrades consecutives, no entre
   * l'entrada i la sortida ja filtrada. Amb la sortida, davant d'un gir la
   * diferència no és la velocitat sinó el propi retard del filtre dividit per
   * dt, que a 60 Hz l'infla per un factor deu: el filtre s'obriria de bat a bat
   * per una raó falsa. És l'estructura del filtre d'1 euro original.
   */
  private lastRaw: Quaternion | null = null;
  /**
   * Velocitat angular estimada com a VECTOR (rad/s), no com a escalar.
   *
   * Amb el telèfon quiet, el soroll del magnetòmetre fa apuntar aquest vector
   * cada fotograma cap a una banda diferent i el passa-baixos el cancel·la. Amb
   * un escalar sempre positiu —que és el que hi havia— el soroll es rectifica,
   * no s'anul·la, i la velocitat estimada d'un telèfon immòbil pujava fins a
   * desenes de graus per segon.
   */
  private speed: [number, number, number] = [0, 0, 0];
  /** Fals fins que hi ha hagut una primera derivada amb què arrencar. */
  private hasSpeed = false;
  private telemetry: SmoothingTelemetry = INITIAL_TELEMETRY;

  constructor(config: SmoothingConfig = DEFAULT_SMOOTHING) {
    this.config = { ...config };
  }

  configure(config: SmoothingConfig): void {
    // Canviar de paràmetres no ha de reiniciar l'estat: l'usuari els mou amb
    // un control lliscant mentre mira l'overlay, i un salt li amagaria
    // justament l'efecte que està intentant jutjar.
    this.config = { ...config };
  }

  reset(): void {
    this.smoothed = null;
    this.lastRaw = null;
    this.speed = [0, 0, 0];
    this.hasSpeed = false;
    this.telemetry = INITIAL_TELEMETRY;
  }

  getTelemetry(): SmoothingTelemetry {
    return this.telemetry;
  }

  /**
   * Incorpora una lectura i torna l'orientació suavitzada.
   *
   * @param dtSec temps transcorregut des de l'última lectura, en segons. S'ha
   *   de mesurar de veritat; passar-hi una constant torna a introduir la
   *   dependència del mòbil que aquest filtre existeix per eliminar.
   */
  push(q: Quaternion, dtSec: number): Quaternion {
    if (!this.config.enabled) {
      this.smoothed = q;
      this.lastRaw = q;
      this.telemetry = { ...INITIAL_TELEMETRY, dtSec };
      return q;
    }

    const previous = this.smoothed;
    const previousRaw = this.lastRaw;
    // La lectura en brut s'actualitza SEMPRE, també quan la sortida es congela
    // per la banda morta: si no, la propera derivada es calcularia contra una
    // lectura vella i sortiria una velocitat inventada.
    this.lastRaw = q;

    if (previous === null || previousRaw === null) {
      this.smoothed = q;
      this.telemetry = { ...INITIAL_TELEMETRY, dtSec };
      return q;
    }

    // Un dt absurd (pestanya en segon pla, sensor que es reprèn) trencaria el
    // filtre. Es tracta com un reinici: val més un salt net que una
    // interpolació amb una velocitat inventada.
    if (!(dtSec > 0) || dtSec > 0.5) {
      this.smoothed = q;
      this.speed = [0, 0, 0];
      this.hasSpeed = false;
      this.telemetry = { ...INITIAL_TELEMETRY, dtSec: dtSec > 0 ? dtSec : 0 };
      return q;
    }

    // Velocitat angular instantània com a vector amb signe, mesurada entre dues
    // lectures EN BRUT consecutives, i suavitzada al seu torn: si no, el propi
    // soroll faria obrir el tall i el filtre es desactivaria a si mateix.
    const step = quaternionRotationVector(previousRaw, q);
    const speedAlpha = lowPassAlpha(this.config.derivativeCutoffHz, dtSec);
    const instant: [number, number, number] = [
      step[0] / dtSec,
      step[1] / dtSec,
      step[2] / dtSec,
    ];

    if (!this.hasSpeed) {
      // Primera derivada: no hi ha res anterior amb què barrejar-la. Arrencar
      // de zero i deixar que el passa-baixos hi pugi introduiria un error de
      // l'1% durant el primer segon, i és justament quan l'usuari acaba
      // d'apuntar el mòbil i està jutjant si això funciona.
      this.speed = instant;
      this.hasSpeed = true;
    } else {
      this.speed = [
        this.speed[0] + speedAlpha * (instant[0] - this.speed[0]),
        this.speed[1] + speedAlpha * (instant[1] - this.speed[1]),
        this.speed[2] + speedAlpha * (instant[2] - this.speed[2]),
      ];
    }

    const speedRadPerSec = Math.hypot(this.speed[0], this.speed[1], this.speed[2]);

    // Banda morta: amb el telèfon quiet, congelar del tot val més que
    // perseguir dècimes de grau de soroll. Es mesura contra la SORTIDA, que és
    // el que l'ull veu moure's.
    const stepRad = quaternionAngle(previous, q);
    if (stepRad * RAD < this.config.deadBandDeg) {
      this.telemetry = {
        cutoffHz: this.config.minCutoffHz,
        angularSpeedDegPerSec: speedRadPerSec * RAD,
        alpha: 0,
        dtSec,
        frozen: true,
      };
      return previous;
    }

    /*
     * TERRA DE SOROLL ABANS DE LA β. AIXÒ ÉS EL QUE FA QUE ES QUEDI QUIET.
     *
     * `speedRadPerSec` és una NORMA. Passar l'estimador a vectorial va treure
     * el biaix de cada component, però la norma d'un vector sorollós de mitjana
     * zero segueix essent estrictament positiva: amb el telèfon damunt la
     * taula, una brúixola amb 1,5° de soroll «es mou» a 7,7°/s segons aquesta
     * norma, i amb β = 20 el tall s'obria fins a 3,7 Hz. El filtre estava
     * dissenyat per tallar a 1 Hz quieta i deixava passar gairebé tot el
     * tremolor: 0,85° mesurats, que són gairebé dos diàmetres solars de
     * batzegada al lloc on el disc no s'ha de moure.
     *
     * Restant un terra, el soroll no obre res i un gir de debò —десenes de
     * graus per segon— gairebé no en nota la resta. Mesurat: el tall en repòs
     * baixa de 3,71 a 1,43 Hz i el tremolor de 0,833° a 0,669°, a canvi de
     * 0,19° més de retard a 47°/s, que és per sota del que l'ull segueix.
     */
    const speedAboveNoise = Math.max(0, speedRadPerSec - this.config.noiseFloorRadPerSec);
    const cutoffHz = this.config.minCutoffHz + this.config.beta * speedAboveNoise;
    const alpha = lowPassAlpha(cutoffHz, dtSec);

    const next = quaternionSlerp(previous, q, alpha);
    this.smoothed = next;
    this.telemetry = {
      cutoffHz,
      angularSpeedDegPerSec: speedRadPerSec * RAD,
      alpha,
      dtSec,
      frozen: false,
    };
    return next;
  }
}

/**
 * Dispersió d'un conjunt d'angles, en graus.
 *
 * Amb estadística circular, no amb una desviació típica normal: amb lectures
 * oscil·lant entre 359° i 1° la fórmula lineal donaria 180° de dispersió quan
 * la real és de 2°. És justament el cas de la brúixola mirant al nord.
 */
export function circularSpreadDeg(anglesDeg: readonly number[]): number {
  if (anglesDeg.length < 2) return 0;
  let sumSin = 0;
  let sumCos = 0;
  for (const a of anglesDeg) {
    const r = (a * Math.PI) / 180;
    sumSin += Math.sin(r);
    sumCos += Math.cos(r);
  }
  const n = anglesDeg.length;
  const R = Math.hypot(sumSin / n, sumCos / n);
  return Math.sqrt(Math.max(0, -2 * Math.log(Math.max(R, 1e-9)))) * RAD;
}

/**
 * Finestra lliscant d'angles per mesurar soroll.
 *
 * Existeix per poder ensenyar el soroll ABANS i DESPRÉS del filtre amb el
 * mateix estimador. Aquesta parella de números és la que decideix si aquest
 * producte pot ser una webapp o ha de ser una aplicació nativa, i comparar-la
 * amb dos estimadors diferents no voldria dir res.
 */
export class AngleWindow {
  private readonly values: number[] = [];
  // Propietat declarada a part i no com a paràmetre del constructor: el
  // projecte té `erasableSyntaxOnly` actiu i les propietats de paràmetre no hi
  // són permeses, perquè no es poden esborrar amb un simple despullat de tipus.
  private readonly capacity: number;

  constructor(capacity = 90) {
    this.capacity = capacity;
  }

  push(angleDeg: number): void {
    this.values.push(angleDeg);
    if (this.values.length > this.capacity) this.values.shift();
  }

  spreadDeg(): number {
    return circularSpreadDeg(this.values);
  }

  clear(): void {
    this.values.length = 0;
  }
}
