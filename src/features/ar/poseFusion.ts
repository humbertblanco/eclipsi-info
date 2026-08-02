/**
 * Fusió de la postura: la imatge per al curt termini, el sensor per al llarg.
 *
 * LES DUES FONTS I EL QUE FA MALAMENT CADASCUNA.
 *
 *  · El sensor sap on és el nord i on és amunt, i no deriva mai. A canvi
 *    tremola entre mig grau i tres graus, i el filtre que li treu el tremolor
 *    li introdueix retard.
 *  · L'ancoratge visual no sap on és el nord ni on és amunt —només sap quant
 *    ha girat des de l'últim fotograma— però aquest "quant" el mesura sobre la
 *    mateixa imatge damunt la qual dibuixem, i per tant no té ni retard ni
 *    tremolor. A canvi deriva: cada mesura hi deixa un error petit que
 *    s'acumula, i si la focal no és exacta la deriva és proporcional al que
 *    s'ha girat.
 *
 * Són complementaris i la fusió és directa: la postura segueix els increments
 * de la imatge, i el sensor l'estira cap a ell a poc a poc.
 *
 * EL SIGNE. `VisualTracker` torna el gir de la CÀMERA, no el desplaçament de la
 * imatge: la inversió (si el paisatge llisca cap a l'esquerra és perquè la
 * càmera ha girat cap a la dreta) ja està feta dins del model de flux. Aquí,
 * doncs, els increments visuals se SUMEN. Si es restessin, la superposició es
 * mouria el doble en comptes de quedar-se clavada, que és un símptoma molt
 * concret i molt fàcil de confondre amb un problema d'escala. La telemetria en
 * publica la concordança justament perquè al camp es pugui distingir: +1 vol
 * dir que les dues fonts diuen el mateix, −1 que el signe està invertit.
 *
 * Cap dependència de DOM: això es prova amb escenes sintètiques.
 */

import type { VisualRotation } from './visualTracker';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Per sota d'aquesta confiança la mesura visual no s'usa. */
const MIN_CONFIDENCE = 0.35;

/**
 * Constant de temps de l'estirada del sensor amb el telèfon QUIET, en segons.
 *
 * Amb el telèfon quiet el sensor no té retard i és la veritat: es pot estirar
 * fort. El que hi entra de soroll és el del sensor multiplicat per
 * √(p/(2−p)), i amb 0,35 s a 60 Hz això són 0,15 — o sigui que un sensor amb
 * mig grau de tremolor n'aporta set centèsimes. Molt per sota del criteri de
 * mig grau amb el mòbil damunt la taula.
 */
const PULL_TAU_STILL_SEC = 0.35;

/**
 * ... i amb el telèfon girant de pressa.
 *
 * Girant, el sensor filtrat va endarrerit. Estirar cap a ell amb força seria
 * arrossegar la superposició cap enrere justament quan l'usuari està movent el
 * telèfon i mirant si la silueta es desenganxa. Es deixa manar la imatge, que
 * no té retard.
 */
const PULL_TAU_MOVING_SEC = 4;

/** Velocitats entre les quals es passa d'una constant a l'altra, en graus/s. */
const PULL_SPEED_LOW = 5;
const PULL_SPEED_HIGH = 40;

/**
 * Separació màxima tolerada entre la postura fusionada i el sensor, en graus.
 *
 * L'ancoratge visual pot fugir: prou textura repetitiva, un camió que ocupa
 * mitja imatge, o simplement una focal molt equivocada. Passat aquest llindar
 * es torna a estirar fort encara que el telèfon s'estigui movent — val més un
 * moviment una mica arrossegat que una superposició que se'n va del paisatge.
 * Vuit graus són quinze diàmetres solars: molt abans que això es noti.
 */
const MAX_DRIFT_DEG = 8;

/** Constant de temps de la finestra amb què es mesura la concordança. */
const AGREEMENT_TAU_SEC = 2;

/**
 * Temps sense cap fotograma de càmera a partir del qual es deixa de creure en
 * l'ancoratge visual, en segons.
 *
 * Amb l'ancoratge actiu, entre fotogrames de vídeo la postura es CONGELA a
 * posta. Si el flux s'atura —l'usuari canvia d'aplicació, una trucada
 * interromp la càmera, el sistema en pren el control— aquell "entre fotogrames"
 * no s'acabaria mai i la superposició es quedaria clavada a la pantalla mentre
 * l'usuari mou el telèfon: exactament el contrari del que ha de fer. Passat
 * aquest temps es torna a integrar el sensor a cada fotograma de dibuix.
 *
 * Quatre dècimes són dotze fotogrames de vídeo a 30 Hz: prou per no
 * confondre-ho amb una caiguda puntual de la freqüència.
 */
const FRAME_TIMEOUT_SEC = 0.4;

export interface FusionInput {
  /** Azimut del sensor, ja filtrat, en graus. */
  sensorAzimuthDeg: number;
  /** Altura del sensor, ja filtrada, en graus. */
  sensorAltitudeDeg: number;
  /**
   * Gir de la imatge respecte a l'horitzó: `roll + screenAngle`, en graus.
   *
   * És el mateix angle que aplica `projectToScreen`. Sense ell, el gir mesurat
   * sobre la imatge s'atribuiria als eixos equivocats i inclinar el telèfon amb
   * el canell es llegiria com un canvi d'azimut.
   */
  imageRollDeg: number;
  /**
   * Cert si la càmera ha lliurat un fotograma NOU des de l'última crida.
   *
   * Aquesta bandera no és cosmètica: sense ella la postura avança dues vegades
   * pel mateix interval. El bucle de dibuix va a 60 Hz i la càmera a 30, i la
   * mesura visual d'un fotograma cobreix els DOS fotogrames de dibuix que han
   * passat des de l'anterior. Si entremig s'hi ha sumat també l'increment del
   * sensor, aquell interval s'ha comptat dues vegades i la superposició es mou
   * una vegada i mitja del que toca — un símptoma pràcticament idèntic al de
   * tenir el signe invertit, i molt més difícil de veure.
   */
  newFrame: boolean;
  /** Mesura visual d'aquest fotograma, o null si no n'hi ha cap de nova. */
  visual: VisualRotation | null;
  /** Velocitat angular que veu el sensor, en graus per segon. */
  sensorSpeedDegPerSec: number;
  /** Temps des de l'última crida, en segons. */
  dtSec: number;
  /**
   * Mesura ABSOLUTA de cap on apunta la càmera, si n'hi ha.
   *
   * Ve d'aparellar la silueta del terreny que es veu amb la que el model
   * digital del terreny diu que hi ha (`skyline.ts`). És d'una altra
   * naturalesa que `visual`: allò és un increment i això és una posició. Un
   * increment només pot frenar la deriva; una posició la corregeix.
   *
   * `confidence` va de 0 a 1 i decideix quanta estirada se li dona. No
   * s'aplica de cop mai: un salt visible és pitjor que un error petit, i si
   * l'aparellament s'equivoca —una carena confosa amb una altra— val més que
   * es noti poc i que el fotograma següent el desmenteixi.
   */
  anchor?: {
    azimuthDeg: number;
    altitudeDeg: number;
    confidence: number;
    /**
     * Cert quan el fix ve d'un horitzó pla: l'altura és bona però l'azimut no
     * s'ha pogut determinar. Llavors només s'estira l'altura, i el biaix
     * d'azimut NI S'APRÈN NI ES TOCA — amb un dAz inventat de zero, l'error
     * d'azimut semblaria nul i un biaix de brúixola ben après es desfaria en
     * silenci.
     */
    altitudeOnly?: boolean;
  } | null;
  /**
   * Error de l'ancoratge mesurat A LA CAPTURA: `sensorAtCaptura − fix`.
   *
   * És d'una naturalesa diferent que `anchor`: allò diu ON ETS i només val
   * mentre el mòbil no s'ha mogut de la postura on es va mesurar; això diu
   * QUANT MENTEIX EL SENSOR, que és una propietat del lloc i no de la postura.
   * Per això pot seguir ensenyant el biaix mentre el mòbil gira — just quan
   * `anchor` s'ha d'invalidar. Sense aquesta separació, el biaix només
   * s'aprenia amb el telèfon quiet, i el gest d'inclinar-lo el deixava orfe.
   */
  anchorBias?: {
    errAzDeg: number;
    errAltDeg: number;
    confidence: number;
    altitudeOnly?: boolean;
  } | null;
}

export interface FusedPose {
  azimuthDeg: number;
  altitudeDeg: number;
}

export interface FusionTelemetry {
  /**
   * Correlació entre el gir que diu la imatge i el que diu el sensor, de −1 a
   * +1, sobre els últims segons.
   *
   * És LA xifra de diagnòstic d'aquesta pantalla. A prop de +1 les dues fonts
   * es confirmen. A prop de 0 la imatge no aporta res (paret llisa, poca llum).
   * NEGATIVA vol dir que el signe està invertit en algun lloc, i llavors la
   * superposició es mou el doble en comptes de quedar-se quieta.
   */
  agreement: number;
  /** Cert si la postura la porta la imatge i no el sensor. */
  usingVisual: boolean;
  /** Separació actual entre la postura fusionada i la del sensor, en graus. */
  driftDeg: number;
  /** Constant de temps de l'estirada que s'està aplicant, en segons. */
  pullTauSec: number;
  /** Gir de l'últim increment visual acceptat, en graus. */
  lastVisualStepDeg: number;
  /** Gir de l'últim increment del sensor, en graus. */
  lastSensorStepDeg: number;
  /** Biaix de brúixola après, en graus. Diagnòstic de camp. */
  biasAzDeg: number;
  /** Biaix d'altura après, en graus. Si s'acosta al sostre d'1,5°, sospita. */
  biasAltDeg: number;
}

const INITIAL_TELEMETRY: FusionTelemetry = {
  agreement: 0,
  usingVisual: false,
  driftDeg: 0,
  pullTauSec: PULL_TAU_STILL_SEC,
  lastVisualStepDeg: 0,
  lastSensorStepDeg: 0,
  biasAzDeg: 0,
  biasAltDeg: 0,
};

/** Diferència d'angles normalitzada a (−180, 180]. */
export function normalizeDelta(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * Converteix un gir mesurat sobre la IMATGE en increments d'azimut i altura.
 *
 * La imatge està girada respecte a l'horitzó per `imageRollDeg`, que és el
 * mateix angle que aplica la projecció. Desfer-lo aquí és el que fa que
 * inclinar el telèfon amb el canell no es confongui amb un canvi de rumb.
 *
 * S'exporta perquè el banc de proves hi pugui entrar directament.
 */
export function rotationToPoseDelta(
  rotation: Pick<VisualRotation, 'pitchRad' | 'yawRad'>,
  imageRollDeg: number,
  altitudeDeg: number,
): { dAzDeg: number; dAltDeg: number } {
  const r = imageRollDeg * DEG;
  const cosR = Math.cos(r);
  const sinR = Math.sin(r);

  // Component horitzontal i vertical del gir, ja en el marc del món.
  const horizontal = rotation.yawRad * cosR + rotation.pitchRad * sinR;
  const vertical = -rotation.yawRad * sinR + rotation.pitchRad * cosR;

  // A prop del zenit un grau d'azimut és molt menys d'un grau de cel: cal
  // dividir per cos(altura). El sostre evita que la divisió exploti quan
  // s'apunta amunt del tot.
  const cosAlt = Math.max(0.2, Math.cos(altitudeDeg * DEG));

  return {
    dAzDeg: (horizontal * RAD) / cosAlt,
    dAltDeg: vertical * RAD,
  };
}

/**
 * Inversa de `rotationToPoseDelta`: d'increments d'azimut i altura al gir que
 * hauria vist la càmera sobre els seus propis eixos.
 *
 * Serveix per alimentar l'estimador de focal, que ha de comparar el gir que diu
 * la imatge amb el que diu el sensor, i els dos han d'estar expressats sobre els
 * mateixos eixos. Sense aquesta conversió, amb el telèfon una mica tombat la
 * comparació barrejaria eixos i la focal en sortiria falsa.
 */
export function poseDeltaToRotation(
  dAzDeg: number,
  dAltDeg: number,
  imageRollDeg: number,
  altitudeDeg: number,
): { pitchRad: number; yawRad: number } {
  const r = imageRollDeg * DEG;
  const cosR = Math.cos(r);
  const sinR = Math.sin(r);
  const horizontal = dAzDeg * Math.max(0.2, Math.cos(altitudeDeg * DEG)) * DEG;
  const vertical = dAltDeg * DEG;
  return {
    yawRad: horizontal * cosR - vertical * sinR,
    pitchRad: horizontal * sinR + vertical * cosR,
  };
}

/**
 * Postura fusionada, amb estat.
 *
 * Una instància per sessió de càmera. `reset()` quan es canvia d'objectiu o es
 * reprèn després d'una pausa: seguir acumulant increments a partir d'un estat
 * de fa un minut faria travessar mig cel a la superposició.
 */
/**
 * Constant de temps de l'estirada cap a l'ancoratge de terreny, en segons.
 *
 * Mig segon amb confiança plena. Vegeu el bloc d'`update` que l'aplica.
 */
const ANCHOR_TAU_SEC = 0.5;

/**
 * Constant de temps amb què s'aprèn el biaix de la brúixola, en segons.
 *
 * Molt més lenta que la de l'ancoratge (0,5 s) a posta: la correcció de postura
 * ha de ser ràpida perquè l'usuari no vegi la superposició fora de lloc, però
 * el BIAIX és una propietat del magnetòmetre en aquell lloc, canvia a escala de
 * minuts, i aprendre'l de pressa el faria ballar amb cada aparellament mediocre.
 */
const BIAS_TAU_SEC = 4;

/**
 * Fins on es dona per bo un biaix de brúixola, en graus.
 *
 * Un magnetòmetre de mòbil vora un cotxe, un trípode o una barana se'n va
 * fàcilment 10 o 20 graus. Per damunt de quaranta ja no és biaix: és que
 * l'aparellament amb el terreny s'ha equivocat de carena, i val més quedar-se
 * amb la brúixola dolenta que amb una correcció inventada.
 */
const MAX_BIAS_DEG = 40;

/**
 * Sostre del biaix d'ALTURA, molt més estret que el d'azimut. En graus.
 *
 * L'asimetria és física, no de gust. En azimut, el sensor és un magnetòmetre
 * que vora metall menteix 10 o 20 graus: el biaix gros és versemblant i val la
 * pena recordar-lo. En altura, el sensor és l'acceleròmetre llegint la
 * gravetat, que va fi a dècimes de grau: un "biaix" d'altura gran no pot ser
 * del sensor. És l'error de REFERÈNCIA de l'ancoratge — arbres i teulades que
 * el model de terreny nu no té, una focal una mica falsa, un núvol pres per
 * carena — i restar-lo del canal bo és injectar l'error d'una font dolenta a
 * la única font que no s'equivoca. Grau i mig cobreix el que és legítim
 * (alçada d'ulls, refracció, dàtum del model) i no deixa passar res més.
 */
const MAX_BIAS_ALT_DEG = 1.5;

/**
 * Constant de temps amb què el biaix d'altura CADUCA sense ancoratge, en segons.
 *
 * El biaix d'azimut no caduca mai: la brúixola segueix mentint igual quan el
 * terreny surt del quadre, i oblidar-ho seria tornar a l'error que es va
 * corregir. El d'altura sí, i pel mateix argument físic del sostre: el que
 * codifica és sobretot l'error de la referència del terreny, i quan aquesta
 * referència desapareix — apuntant al cel, que és el que l'app demana — qui té
 * raó és l'acceleròmetre. Dotze segons: prou lent per no oscil·lar entre dos
 * fixos a 5 Hz, prou ràpid perquè mitja passada de núvols no deixi empremta.
 */
const BIAS_ALT_DECAY_TAU_SEC = 12;

export class PoseFusion {
  private azimuth: number | null = null;
  private altitude = 0;
  /** Postura del sensor l'últim cop que es va avançar la postura fusionada. */
  private sensorAtLastStep: { az: number; alt: number } | null = null;
  /*
   * BIAIX DEL SENSOR: quant va desviada la brúixola respecte de la veritat.
   *
   * PER QUE CALIA. L'estirada d'aqui sota portava la postura cap al sensor CRU,
   * i l'ancoratge al terreny la portava cap a la veritat. Com que l'estirada es
   * mes forta (tau 0,35 s quiet) que l'ancoratge (tau 0,5 s), guanyava
   * l'estirada i el sistema es quedava en un punt d'equilibri entremig.
   *
   * Mesurat abans d'aquest canvi, amb la bruixola 10 graus fora, el terreny
   * sempre a la vista i confianca 1: despres de vint segons quiet la postura es
   * quedava a 5,74 graus de la veritat —deu diametres solars i mig— i no s'hi
   * acostava mes. ESTAT.md diu que l'ancoratge recupera un error de bruixola de
   * 10 graus fins a menys de 0,5: al banc si, pero a la vista no hi arribava
   * mai, perque la mesura absoluta es corregia i tot seguit es desfeia.
   *
   * Amb el biaix, l'ancoratge ja no ha de guanyar una batalla a cada fotograma:
   * ensenya a la fusio cap a on menteix la bruixola, i l'estirada passa a
   * portar cap al sensor CORREGIT. Les dues forces deixen d'estirar en
   * direccions contraries.
   */
  private biasAz = 0;
  private biasAlt = 0;
  /**
   * Cert mentre la imatge porta la postura.
   *
   * Amb l'ancoratge actiu, entre dos fotogrames de vídeo NO s'avança res: la
   * imatge que es veu tampoc no ha canviat, i la superposició ha d'anar
   * clavada a la imatge que es veu, no a la que vindrà. Quan la imatge deixa
   * de servir —paret llisa, poca llum, gir massa ràpid— es torna a integrar el
   * sensor a cada fotograma de dibuix.
   */
  private visualActive = false;
  /** Fotogrames de vídeo seguits sense mesura útil. */
  private visualMisses = 0;
  /** Temps des de l'últim fotograma de càmera, en segons. */
  private sinceFrameSec = 0;

  // Sumes per a la correlació entre les dues fonts, amb oblit exponencial.
  private sumVS = 0;
  private sumVV = 0;
  private sumSS = 0;

  private telemetryState: FusionTelemetry = INITIAL_TELEMETRY;

  reset(): void {
    this.azimuth = null;
    this.sensorAtLastStep = null;
    this.biasAz = 0;
    this.biasAlt = 0;
    this.visualActive = false;
    this.visualMisses = 0;
    this.sinceFrameSec = 0;
    this.sumVS = 0;
    this.sumVV = 0;
    this.sumSS = 0;
    this.telemetryState = INITIAL_TELEMETRY;
  }

  get telemetry(): FusionTelemetry {
    return this.telemetryState;
  }

  update(input: FusionInput): FusedPose {
    const dt = input.dtSec > 0 && input.dtSec < 1 ? input.dtSec : 1 / 60;

    if (this.azimuth === null || this.sensorAtLastStep === null) {
      this.azimuth = input.sensorAzimuthDeg;
      this.altitude = input.sensorAltitudeDeg;
      this.sensorAtLastStep = {
        az: input.sensorAzimuthDeg,
        alt: input.sensorAltitudeDeg,
      };
      return { azimuthDeg: this.azimuth, altitudeDeg: this.altitude };
    }

    // Increment que ha vist el sensor des de l'últim avanç, que no és
    // necessàriament l'últim fotograma de dibuix.
    const sensorDAz = normalizeDelta(input.sensorAzimuthDeg - this.sensorAtLastStep.az);
    const sensorDAlt = input.sensorAltitudeDeg - this.sensorAtLastStep.alt;

    const visual = input.visual;
    const usable =
      input.newFrame &&
      visual !== null &&
      visual.confidence >= MIN_CONFIDENCE &&
      !visual.saturated;

    if (input.newFrame) {
      this.sinceFrameSec = 0;
      if (usable) {
        this.visualActive = true;
        this.visualMisses = 0;
      } else if (this.visualActive) {
        // Dos fotogrames seguits sense res: la imatge ha deixat de servir.
        this.visualMisses++;
        if (this.visualMisses > 2) this.visualActive = false;
      }
    } else {
      this.sinceFrameSec += dt;
      // Vigilància del flux aturat: sense això, la superposició es quedaria
      // congelada per sempre esperant un fotograma que no arribarà.
      if (this.sinceFrameSec > FRAME_TIMEOUT_SEC) this.visualActive = false;
    }

    let dAz = 0;
    let dAlt = 0;
    let stepped = false;
    let visualStepDeg = 0;

    if (usable && visual) {
      const step = rotationToPoseDelta(visual, input.imageRollDeg, this.altitude);
      // Barreja proporcional a la confiança: entre "la imatge no diu res" i
      // "la imatge ho diu tot" no hi ha d'haver cap salt, perquè la confiança
      // baixa i puja sola segons la textura que hi hagi al davant.
      const w = Math.min(1, (visual.confidence - MIN_CONFIDENCE) / (1 - MIN_CONFIDENCE));
      dAz = w * step.dAzDeg + (1 - w) * sensorDAz;
      dAlt = w * step.dAltDeg + (1 - w) * sensorDAlt;
      stepped = true;
      visualStepDeg = Math.hypot(step.dAzDeg * cosAltFactor(this.altitude), step.dAltDeg);

      // Correlació entre les dues fonts, amb oblit exponencial. Es fa sobre el
      // parell (horitzontal, vertical) i no sobre les magnituds: el que s'ha de
      // detectar és una inversió de signe, i una magnitud no en té.
      const decay = Math.exp(-dt / AGREEMENT_TAU_SEC);
      const vh = step.dAzDeg * cosAltFactor(this.altitude);
      const vv = step.dAltDeg;
      const sh = sensorDAz * cosAltFactor(this.altitude);
      const sv = sensorDAlt;
      this.sumVS = this.sumVS * decay + vh * sh + vv * sv;
      this.sumVV = this.sumVV * decay + vh * vh + vv * vv;
      this.sumSS = this.sumSS * decay + sh * sh + sv * sv;
    } else if (!this.visualActive || input.newFrame) {
      // Sense ancoratge visual s'integra el sensor a cada fotograma; amb
      // ancoratge actiu però un fotograma de vídeo sense mesura, s'hi recorre
      // només per aquell interval.
      dAz = sensorDAz;
      dAlt = sensorDAlt;
      stepped = true;
    }

    if (stepped) {
      this.azimuth += dAz;
      this.altitude += dAlt;
      this.sensorAtLastStep = {
        az: input.sensorAzimuthDeg,
        alt: input.sensorAltitudeDeg,
      };
    }

    /*
     * Deriva respecte del sensor CORREGIT, que es qui no deriva mai.
     *
     * El sensor no deriva, pero pot estar desplacat: una bruixola vora metall
     * es queda deu graus fora tota l'estona. Estirar cap al valor cru era
     * estirar cap a un error constant, i desfeia l'ancoratge al terreny a cada
     * fotograma. El biaix s'apren mes avall, quan hi ha ancoratge.
     */
    const sensorAz = input.sensorAzimuthDeg - this.biasAz;
    const sensorAlt = input.sensorAltitudeDeg - this.biasAlt;
    const driftAz = normalizeDelta(sensorAz - this.azimuth);
    const driftAlt = sensorAlt - this.altitude;
    const driftDeg = Math.hypot(driftAz * cosAltFactor(this.altitude), driftAlt);

    // Força de l'estirada: fort quiet, fluix movent-se, i fort altre cop si la
    // deriva s'ha escapat.
    const speed = Math.abs(input.sensorSpeedDegPerSec);
    const moving = clamp01((speed - PULL_SPEED_LOW) / (PULL_SPEED_HIGH - PULL_SPEED_LOW));
    const runaway = clamp01(driftDeg / MAX_DRIFT_DEG);
    const blend = moving * (1 - runaway);
    const tau = PULL_TAU_STILL_SEC + (PULL_TAU_MOVING_SEC - PULL_TAU_STILL_SEC) * blend;
    const pull = 1 - Math.exp(-dt / tau);

    this.azimuth += pull * driftAz;
    this.altitude += pull * driftAlt;

    // Sostre dur. L'estirada gradual sola té un punt d'equilibri: si
    // l'ancoratge visual s'equivoca de manera sostinguda —textura repetitiva,
    // un vehicle que ocupa mitja imatge— la deriva s'atura on la correcció
    // iguala l'error, i amb un error de mig grau per fotograma això passa als
    // 10,6°. Vint diàmetres solars és massa. Aquí es limita del tot: val més un
    // salt petit que una superposició que se'n va del paisatge.
    const excess = 1 - MAX_DRIFT_DEG / Math.max(MAX_DRIFT_DEG, driftDeg);
    if (excess > 0) {
      this.azimuth += excess * driftAz;
      this.altitude += excess * driftAlt;
    }

    /*
     * L'ANCORATGE AL TERRENY, L'ÚLTIM I PER DAMUNT DE TOT.
     *
     * Va al final a posta: tot el que hi ha abans és relatiu —el sensor diu
     * quant s'ha girat, la imatge diu quant s'ha girat— i això diu ON ETS. Que
     * l'última paraula la tingui una mesura absoluta és el que fa que la
     * deriva no s'acumuli mai: cada cop que el terreny és a la vista, el
     * comptador es torna a posar a zero.
     *
     * S'aplica com una fracció de la diferència, no de cop. Amb confiança 1 la
     * constant de temps és de mig segon: prou ràpid perquè obrir l'app amb la
     * brúixola deu graus fora es corregeixi sol abans que l'usuari se n'adoni,
     * i prou lent perquè un aparellament dolent no faci saltar res.
     */
    const anchor = input.anchor ?? null;
    if (anchor !== null && anchor.confidence > 0) {
      const pull = Math.min(1, (dt / ANCHOR_TAU_SEC) * anchor.confidence);
      // Un fix d'horitzó pla sap l'altura però s'ha inventat l'azimut (dAz=0):
      // d'aquell azimut no se n'estira res.
      if (!anchor.altitudeOnly) {
        this.azimuth += pull * normalizeDelta(anchor.azimuthDeg - this.azimuth);
      }
      this.altitude += pull * (anchor.altitudeDeg - this.altitude);
      // El sensor és la referència de la qual es mesuren els increments: si no
      // s'hi mou també, l'estirada següent la desfaria comptant com a deriva
      // el que acabem de corregir a posta.
      this.sensorAtLastStep = {
        az: input.sensorAzimuthDeg,
        alt: input.sensorAltitudeDeg,
      };
    }

    /*
     * EL BIAIX S'APRÈN A PART DE LA POSTURA, i d'una mesura feta A LA CAPTURA.
     *
     * L'ancoratge diu on apuntes de debò; el sensor diu on es pensa que
     * apuntes. La diferència és el biaix, i sense recordar-lo cada correcció
     * s'havia de tornar a guanyar al fotograma següent. S'aprèn a poc a poc
     * perquè és una propietat del lloc, no una mesura instantània.
     *
     * PER QUÈ NO DINS DEL BLOC DE DALT. La postura absoluta caduca quan el
     * mòbil es mou — per això `anchor` desapareix als 3° — però l'ERROR entre
     * el fix i el sensor d'aquell mateix instant no caduca: és independent de
     * cap on s'apunti ara. Aprendre'l només amb el mòbil quiet volia dir que
     * el gest d'inclinar-lo — el gest de l'app — deixava el biaix orfe i la
     * tornada del gest queia sobre un sensor sense corregir.
     */
    const bias = input.anchorBias ?? null;
    if (bias !== null && bias.confidence > 0) {
      const biasPull = Math.min(1, (dt / BIAS_TAU_SEC) * bias.confidence);
      if (!bias.altitudeOnly) {
        this.biasAz = clampBias(
          normalizeDelta(this.biasAz + biasPull * normalizeDelta(bias.errAzDeg - this.biasAz)),
          MAX_BIAS_DEG,
        );
      }
      this.biasAlt = clampBias(
        this.biasAlt + biasPull * (bias.errAltDeg - this.biasAlt),
        MAX_BIAS_ALT_DEG,
      );
    } else {
      // Sense mesura de terreny recent, el biaix d'ALTURA caduca: el que
      // codificava era sobretot l'error de la referència, no del sensor, i
      // sense referència qui mana és l'acceleròmetre. El d'azimut es queda:
      // la brúixola menteix igual encara que no es vegi cap carena.
      this.biasAlt *= Math.exp(-dt / BIAS_ALT_DECAY_TAU_SEC);
    }

    this.altitude = Math.max(-90, Math.min(90, this.altitude));
    this.azimuth = ((this.azimuth % 360) + 360) % 360;

    const norm = Math.sqrt(this.sumVV * this.sumSS);
    this.telemetryState = {
      agreement: norm > 1e-9 ? Math.max(-1, Math.min(1, this.sumVS / norm)) : 0,
      usingVisual: this.visualActive,
      driftDeg,
      pullTauSec: tau,
      lastVisualStepDeg: visualStepDeg,
      lastSensorStepDeg: Math.hypot(sensorDAz * cosAltFactor(this.altitude), sensorDAlt),
      biasAzDeg: this.biasAz,
      biasAltDeg: this.biasAlt,
    };

    return { azimuthDeg: this.azimuth, altitudeDeg: this.altitude };
  }
}

function cosAltFactor(altitudeDeg: number): number {
  return Math.max(0.2, Math.cos(altitudeDeg * DEG));
}

/** El biaix es dona per bo fins al sostre del seu eix; mes enlla no es biaix. */
function clampBias(deg: number, maxDeg: number): number {
  return Math.max(-maxDeg, Math.min(maxDeg, deg));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
