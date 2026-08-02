/**
 * Vista de realitat augmentada.
 *
 * Té dos modes, i el que importa és el primer:
 *
 *  - MIXED: l'eclipsi compost dins de la imatge de la càmera. Els discos a
 *    mida angular real, la corona, la caiguda de llum sobre tota l'escena i la
 *    resplendor de 360° a l'horitzó, tot ancorat al món. És una
 *    previsualització de com es veurà de veritat des d'aquest punt exacte, amb
 *    les teves muntanyes al davant.
 *  - ESQUEMA: la mateixa informació però com a diagrama — recorregut sencer,
 *    marques horàries, contactes i rosa dels vents. Serveix per planificar i
 *    per calibrar.
 *
 * En tots dos casos la superposició està ancorada al MÓN, no a la pantalla:
 * quan mous el telèfon, el Sol simulat es queda clavat allà on estarà de
 * veritat i llisca per la pantalla, com faria el Sol real.
 *
 * ───────────────────────────────────────────────────────────────────────────
 *
 * EL BUCLE DE DIBUIX ES CREA UNA SOLA VEGADA. No és una optimització: és una
 * correcció. Abans l'efecte del bucle depenia d'`orientation.camera`, que era
 * un objecte nou a cada esdeveniment del sensor —fins a 67 per segon—. Cada
 * recreació cancel·lava el `requestAnimationFrame` pendent abans que
 * s'executés, i amb el sensor per damunt de la freqüència de pantalla molts
 * fotogrames no arribaven a dibuixar-se mai: la superposició es congelava
 * mentre el vídeo continuava. Tot el que canvia de pressa viu en refs; React
 * només s'assabenta del que ha de sortir a la interfície, i a poc a poc.
 *
 * LA SUPERPOSICIÓ VA CLAVADA AL FOTOGRAMA QUE ES VEU, no a l'instant. Entre dos
 * fotogrames de càmera —que a 30 Hz són dos fotogrames de dibuix— la imatge de
 * la pantalla no canvia, i per tant la superposició tampoc no s'ha de moure. Si
 * s'hi mogués, es desenganxaria del paisatge i hi tornaria seixanta vegades per
 * segon, que és tremolor pur.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import { formatObscurationPercent } from '../../core/astro/obscuration';
import { sampleAt } from '../../core/astro/ephemeris';
import { visibleBodiesDuringTotality } from '../../core/astro/visibleBodies';
import type { EclipseSample, GeoLocation, LocalCircumstances } from '../../core/astro/types';
import { getEclipse } from '../../core/eclipses/catalog';
import { declination } from '../../core/geomag';
import { horizonSampler, type HorizonProfile } from '../../core/horizon/profile';
import { detectSkyline, fitSkyline, type SkylineFix } from './skyline';
import {
  detectSunBlob,
  sunFixFrom,
  fitSunFix,
  expectedBrightBody,
  mergeAnchors,
  acceptRefinedPeak,
  SunRefiner,
} from './sunAnchor';
import { composeCapture, canvasToJpegBlob } from './capture';
import { nakedEyeAllowedAt, type FilterGateInput } from '../../core/timer';
import { useNow } from '../../state/useNow';
import { Icon, IconButton, ICON_LG } from '../../ui';
import { SafetyBanner } from '../guide/SafetyBanner';
import { renderOverlay } from './renderOverlay';
import { lightState, renderMixed, type SkyBody } from './renderMixed';
import {
  viewportFromElements,
  effectiveFov,
  sensorFovFromFocal,
  type Viewport,
} from './cameraGeometry';
import {
  normalizeAngle,
  projectToScreen,
  angularSeparationDeg,
  DEFAULT_CALIBRATION,
  type CameraPointing,
  type Calibration,
} from './orientation';
import { useDeviceOrientation } from './useDeviceOrientation';
import { openRearCamera, watchLensChange, type CameraOpenResult } from './camera';
import {
  VisualTracker,
  VideoFrameClock,
  FocalEstimator,
  geometryFor,
  type RotationHint,
  type VisualRotation,
} from './visualTracker';
import { PoseFusion, poseDeltaToRotation, type FusionTelemetry } from './poseFusion';
import {
  loadMeasuredFov,
  saveMeasuredFov,
  MIN_FOV_DEG,
  MAX_FOV_DEG,
} from './focalStore';
import { readPalette } from '../../styles/palette';
/*
 * TOT EL TEXT, DEL DICCIONARI; TOTA HORA, DE `screens/format`.
 *
 * Aquí tota la interfície era català clavat al JSX —crida a l'acció, permisos,
 * modes, notes i diagnòstic—: qui triava castellà rebia la pantalla
 * diferencial del producte en català. I l'instant simulat es formatava amb
 * `Europe/Madrid` escrit a mà: a les Canàries sortia una hora per davant del
 * rellotge de l'usuari i diferent de la taula d'efemèrides de la mateixa app.
 */
import { s, type StringKey } from '../../screens/strings';
import { formatClock, formatDecimal, formatDuration, NO_DATA } from '../../screens/format';

interface Props {
  location: GeoLocation;
  eclipseId: string;
  locale: 'ca' | 'es';
  /** Perfil d'horitzó del terreny, quan ja s'ha calculat. */
  horizon: HorizonProfile | null;
  /**
   * Si des d'aquest punt la fase central es veu DE DEBÒ, un cop descomptat el
   * terreny. Ve de `computeVisibility(...).centralVisibleSec > 0`.
   *
   * PER QUÈ ÉS UNA PROP I NO ES DEDUEIX AQUÍ. `canRemoveFilter` mira el
   * terreny, però només si algú l'hi passa: per omissió val `true`, perquè un
   * `false` silenciaria els avisos a tothom que encara no tingui el perfil
   * calculat. Aquesta vista no el passava, i el resultat era que en un punt on
   * el veredicte diu 0 s perquè una carena tapa la totalitat sencera, la veu
   * del compte enrere callava —`CountdownView` sí que l'hi passa— i el rètol
   * de la càmera, damunt de la imatge i en imperatiu, seguia dient «ara pots
   * mirar sense filtre».
   *
   * `undefined` vol dir «encara no se sap», que és el que toca mentre el
   * terreny es baixa: allà mana el valor per omissió.
   */
  centralPhaseVisible?: boolean;
  /**
   * Demana la ubicació. S'invoca des del botó de coordenades de dins de la
   * vista, no des del gest d'obrir la càmera: quan aquesta vista es munta, el
   * lloc ja se sap (`SkyScreen` no la munta sense).
   */
  onRequestLocation?: () => void;
  /**
   * Quanta interfície pròpia es renderitza. Amb `none`, només el marc de la
   * càmera (vídeo + llenç + avís de seguretat + botó de tancar) i els avisos
   * d'error: la pantalla amfitriona posa la resta. És el que enterra el truc
   * de retallar amb `overflow` que hi havia a SkyScreen.
   */
  chrome?: 'full' | 'none';
  /**
   * L'instant a dibuixar, en mil·lisegons d'època. Si es passa, el rellotge
   * el governa QUI CRIDA — un sol rellotge per pantalla — i el control
   * lliscant intern passa a informar `onTimeChange` en comptes de moure's
   * pel seu compte. Dins de la finestra C1-C4 s'usa la mostra precalculada;
   * fora, es calcula la mostra de l'instant — el mode «directe» de debò.
   */
  timeMs?: number;
  onTimeChange?: (ms: number) => void;
  /** Mode de dibuix governat des de fora. Sense ell, els botons interns. */
  mode?: Mode;
  /** Estat que la pantalla amfitriona necessita per decidir el seu embolcall. */
  onState?: (state: {
    cameraOn: boolean;
    calibrated: boolean;
    headingJitterDeg: number;
    /** Qui posa l'àncora absoluta ara mateix, per a la insígnia del HUD. */
    anchorSource: 'sun' | 'moon' | 'terrain' | 'both' | null;
  }) => void;
  /**
   * Punt d'entrada de la CAPTURA: la vista compon vídeo (amb el fosc de
   * l'eclipsi), superposició i peu, i torna el JPEG. El vídeo i el llenç
   * viuen aquí dins; el peu (eclipsi · lloc · hora) el posa qui crida,
   * que és qui sap el lloc. Null mentre la càmera no està oberta.
   */
  captureRef?: { current: ((caption: string) => Promise<Blob | null>) | null };
}

type Mode = 'mixed' | 'diagram';

/**
 * Índex de la mostra precalculada per a un instant, dins de la finestra.
 *
 * Pur i exportat perquè el banc el clavi: els extrems han de caure a la
 * primera i l'última mostra exactes, i una finestra degenerada no pot dividir
 * per zero.
 */
export function sampleIndexForTime(
  timeMs: number,
  startMs: number,
  endMs: number,
  count: number,
): number {
  if (count <= 1 || endMs <= startMs) return 0;
  const p = Math.max(0, Math.min(1, (timeMs - startMs) / (endMs - startMs)));
  return Math.round(p * (count - 1));
}

const PATH_SAMPLES = 160;

/** Cada quant es refresca el panell de diagnòstic, en mil·lisegons. */
const DIAGNOSTICS_MS = 500;

/**
 * Confiança mínima perquè una mesura visual alimenti l'estimador de focal.
 *
 * És més exigent que la de la fusió: una mesura mediocre encara serveix per
 * moure la superposició, però contaminaria un calibratge que després mana sobre
 * tota l'escala.
 */
const FOCAL_MIN_CONFIDENCE = 0.5;

/** Límits del que pot ser el camp de visió d'una càmera de mòbil, en graus. */
/** Quant s'ha de moure el camp mesurat perquè valgui la pena desar-lo. */
const FOV_SAVE_STEP_DEG = 0.2;

/**
 * Cada quants fotogrames de càmera es torna a ancorar al terreny.
 *
 * Tres fotogrames són uns 10 Hz. Es va apujar de 6 (5 Hz) perquè el gating de
 * moviment mata l'ancoratge quan el mòbil s'ha desplaçat més de 3° des de la
 * mesura: a 5 Hz, qualsevol gest per sobre de 15°/s el deixava sense àncora
 * TOT el gest; a 10 Hz la finestra morta es redueix a la meitat. El cost és
 * un ajust de Gauss-Newton més per cada tres fotogrames — desenes de
 * projeccions — i el diagnòstic de ms/fotograma vigila que surti a compte.
 */
const ANCHOR_EVERY_FRAMES = 3;

/**
 * Correcció d'ALTURA màxima que un fix pot afirmar sense quedar descartat, en
 * graus.
 *
 * L'asimetria amb `MAX_CORRECTION_DEG` (25°, dins de l'ajust) és la mateixa
 * física que separa els dos biaixos: en azimut, 25° d'error de brúixola són
 * possibles i corregir-los és la feina de l'ancoratge; en altura, el sensor
 * és l'acceleròmetre i NO POT anar més d'un parell de graus errat. Un fix que
 * digui «apuntes 8° més avall del que dius» no ha trobat la carena: ha trobat
 * una teulada, una línia d'arbres o un banc de núvols — coses que el model de
 * terreny nu no té. És la porta que fa que la ciutat no pugui desplaçar
 * l'overlay en vertical.
 */
const MAX_PLAUSIBLE_ALT_DEG = 3;

/**
 * Quant pot viure un ancoratge sense refrescar-se, en mil·lisegons.
 *
 * Es refresca a uns 5 Hz; mig segon són dues mesures i mitja perdudes, que ja
 * no és una pausa de càlcul sinó que han deixat d'arribar fotogrames.
 */
const ANCHOR_MAX_AGE_MS = 500;

/**
 * Quant es pot haver mogut el mòbil des que es va mesurar, en graus.
 *
 * Per damunt d'això, la postura absoluta que afirma ja no és on apuntes. Tres
 * graus són prop de sis diàmetres solars: prou marge perquè el tremolor normal
 * del pols no l'invalidi, i prou poc perquè una panoràmica sí.
 */
const ANCHOR_MAX_MOVE_DEG = 3;

/**
 * Velocitat màxima del sensor A LA CAPTURA perquè el fix ensenyi biaix, en °/s.
 *
 * La postura absoluta caduca amb el moviment, però l'ERROR entre el fix i el
 * sensor del mateix instant no: és el biaix del lloc, i s'aprofita també en
 * ple gest. Amb un límit: un fix mesurat mentre el mòbil vola porta
 * desenfocament de moviment i el desfasament entre el fotograma i la lectura
 * del sensor (40-80 ms de canonada de càmera), que a 25°/s ja són un parell de
 * graus falsos. Millor aprendre només dels instants raonablement quiets, que a
 * 5 Hz n'hi ha de sobres.
 */
const ANCHOR_BIAS_MAX_SPEED_DEG_PER_SEC = 25;

/**
 * Quant s'empeny endavant la postura dibuixada amb el giroscopi, en ms.
 *
 * És la latència que hi ha entre llegir el sensor i veure el píxel: un
 * fotograma de pantalla llarg. Quiet no s'aplica (per sota del llindar de
 * velocitat la quietud ja és perfecta, i predir seria injectar soroll de
 * giroscopi a una imatge parada); movent-se, és la diferència entre «va bé»
 * i «va clavat».
 */
const PREDICT_AHEAD_MS = 30;

/** Per sota d'aquesta velocitat no es prediu, i s'hi entra amb rampa. */
const PREDICT_MIN_SPEED_DPS = 3;

/**
 * Frescor màxima d'un fix de TERRENY perquè entri a la fusió d'àncores, en ms.
 *
 * El Sol es mesura a cada fotograma; la silueta, al tick (~10 Hz). Fusionar
 * un fix de Sol acabat de fer amb una postura de terreny de fa 200 ms mentre
 * el mòbil gira arrossegaria el resultat cap enrere: el terreny només vota
 * mentre és recent.
 */
const TERRAIN_FIX_MAX_AGE_MS = 250;

/**
 * Per sobre d'aquesta velocitat no es busca el Sol, en °/s.
 *
 * A 45°/s el desenfocament de moviment escampa el bloom i el centroide balla;
 * i tant se val: a aquesta velocitat el gating de moviment descartaria el fix
 * igualment. Estalviar-se la cerca és gratis.
 */
const SUN_TRACK_MAX_SPEED_DPS = 45;

/**
 * Fotogrames seguits sense fix de Sol abans de donar el lock per perdut.
 *
 * Un miss aïllat (un tremolor del llindar, un fotograma fosc) no ha de fer
 * caure el pols de confirmació i tornar-lo a disparar: vuit fotogrames són
 * ~250 ms, que és una pèrdua de debò i no un badall.
 */
const SUN_LOCK_MISS_TOLERANCE = 8;

// Els límits del camp de visió viuen a `focalStore`: UN sol rang per a la
// mesura, la persistència i el control lliscant. N'hi havia dos (25-140 aquí,
// 40-130 al control) i un valor desat de la franja no coberta es podia
// carregar però no corregir a mà.

/*
 * Cada font del rumb, cap a la seva clau del diccionari. Era un
 * `Record<string, string>` amb el text ja escrit, i en un sol idioma. `none`
 * no hi és: sense font es pinta el guió de «dada que no existeix», `NO_DATA`.
 */
const SOURCE_KEYS: Partial<Record<string, StringKey>> = {
  'ios-compass': 'camera.diag.sourceIos',
  'absolute-alpha': 'camera.diag.sourceAbsolute',
  'relative-alpha': 'camera.diag.sourceRelative',
};

/**
 * La paleta del sistema, llegida un sol cop.
 *
 * `getComputedStyle` obliga el navegador a recalcular estils; fer-ho dins del
 * bucle de dibuix costaria més que dibuixar. Els renderitzadors la reben com a
 * dada i així segueixen sense dependre del document.
 */
const PALETTE = readPalette();

/** Tot el que el bucle de dibuix necessita i que canvia amb els renders. */
interface RenderState {
  calibration: Calibration;
  circumstances: LocalCircumstances;
  currentSample: EclipseSample;
  /**
   * La mostra d'efemèrides de L'INSTANT REAL, per a l'àncora de Sol.
   *
   * `currentSample` és l'instant del CONTROL LLISCANT — un instant simulat,
   * potser d'aquí a dos anys. La càmera veu el cel d'ARA: la detecció es
   * compara sempre contra aquesta, mai contra la del simulador.
   */
  liveSample: EclipseSample;
  samples: EclipseSample[];
  bodies: SkyBody[];
  horizonProfile: ((azimuthDeg: number) => number) | undefined;
  locale: 'ca' | 'es';
  mode: Mode;
}

/** El que el bucle mesura i el panell de diagnòstic ensenya. */
interface TrackingDiagnostics {
  confidence: number;
  usedBlocks: number;
  saturated: boolean;
  residualPx: number;
  videoFps: number;
  exactFrameClock: boolean;
  fusion: FusionTelemetry;
  focalWindows: number;
  measuredFovDeg: number | null;
  /** Cert quan el braç de palanca vertical del seguidor està col·lapsat. */
  pitchDegraded: boolean;
  /** L'últim fix de terreny, amb l'edat: el que la fusió està rebent. */
  terrainAnchor: {
    ageMs: number;
    confidence: number;
    used: number;
    altitudeOnly: boolean;
  } | null;
  /** Cost del cos del bucle de dibuix, mitjana mòbil, en mil·lisegons. */
  drawMs: number;
  /** Guany de focal de l'eix d'inclinació: l'empremta de l'obturador rodant. */
  pitchGain: number | null;
  /** L'últim fix de Sol (o Lluna), si n'hi ha. */
  sunAnchor: {
    confidence: number;
    deltaAzDeg: number;
    deltaAltDeg: number;
  } | null;
  /** Qui posa l'àncora vigent. */
  anchorSource: 'sun' | 'moon' | 'terrain' | 'both' | null;
}

const INITIAL_DIAGNOSTICS: TrackingDiagnostics = {
  confidence: 0,
  usedBlocks: 0,
  saturated: false,
  residualPx: 0,
  videoFps: 0,
  exactFrameClock: false,
  pitchDegraded: false,
  terrainAnchor: null,
  drawMs: 0,
  pitchGain: null,
  sunAnchor: null,
  anchorSource: null,
  fusion: {
    agreement: 0,
    usingVisual: false,
    driftDeg: 0,
    pullTauSec: 0,
    lastVisualStepDeg: 0,
    lastSensorStepDeg: 0,
    biasAzDeg: 0,
    biasAltDeg: 0,
    slewDegPerSec: 0,
    slewClamped: false,
  },
  focalWindows: 0,
  measuredFovDeg: null,
};

export function ARView({
  location,
  eclipseId,
  locale,
  horizon,
  centralPhaseVisible,
  onRequestLocation,
  chrome = 'full',
  timeMs,
  onTimeChange,
  mode: modeProp,
  onState,
  captureRef,
}: Props) {
  // La declinació magnètica converteix el nord de la brúixola en el geogràfic.
  // Sense ella l'error és de −3,51° a Tenerife i +2,07° a Barcelona: sistemàtic,
  // i de sis i quatre diàmetres solars respectivament.
  const magneticDeclination = useMemo(
    () => declination(location).declinationDeg,
    [location],
  );
  const orientation = useDeviceOrientation(magneticDeclination);

  // El mostrejador s'obté un cop del perfil: el bucle de dibuix el crida
  // centenars de vegades per fotograma i no ha de reconstruir res.
  const horizonProfile = useMemo(
    () => (horizon ? horizonSampler(horizon) : undefined),
    [horizon],
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /*
   * EL FLUX DE CÀMERA, GUARDAT A PART DEL VÍDEO.
   *
   * La neteja l'anava a buscar a `videoRef.current.srcObject`, i allà no hi és
   * quan cal: React desassigna les refs dels nodes del DOM a la fase de
   * mutació, i les neteges dels efectes passius corren DESPRÉS. Quan
   * s'executava, `videoRef.current` ja era `null`, l'encadenament opcional se
   * l'empassava sense dir res i cap pista s'aturava mai.
   *
   * El resultat: sortir de la pestanya del cel deixava la càmera del mòbil
   * encesa indefinidament —indicador verd o taronja del sistema actiu, bateria
   * cremant-se i la sensació que l'app espia—, i el mateix passava quan la
   * barrera d'error desmuntava la pantalla.
   */
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [calibration, setCalibration] = useState<Calibration>(DEFAULT_CALIBRATION);
  const [modeState, setModeState] = useState<Mode>('mixed');
  // Qui mana el mode: la prop si hi és (pantalla amfitriona), l'estat si no.
  const mode = modeProp ?? modeState;
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [progress, setProgress] = useState(0.5);
  const [fovReadout, setFovReadout] = useState<{ horizontal: number; vertical: number } | null>(
    null,
  );
  const [cameraInfo, setCameraInfo] = useState<CameraOpenResult | null>(null);
  const [diagnostics, setDiagnostics] = useState<TrackingDiagnostics>(INITIAL_DIAGNOSTICS);

  /*
   * L'ESTAT CAP A LA PANTALLA AMFITRIONA (mode immersiu). El callback viu en
   * una ref per no lligar l'efecte a la seva identitat; es dispara només quan
   * canvia alguna cosa (el jitter, quantitzat a dècimes, per no repintar
   * seixanta cops per segon). I el cleanup del desmuntatge dispara
   * cameraOn:false: és el que desencalla l'embolcall immersiu si aquesta
   * vista peta i l'ErrorBoundary se l'empassa — React executa els cleanups
   * també en aquells desmuntatges.
   */
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  const calibrated = diagnostics.measuredFovDeg !== null;
  const headingJitterQ = Math.round(orientation.jitterFiltered * 10) / 10;
  const anchorSourceNow = diagnostics.anchorSource;
  useEffect(() => {
    onStateRef.current?.({
      cameraOn,
      calibrated,
      headingJitterDeg: headingJitterQ,
      anchorSource: anchorSourceNow,
    });
  }, [cameraOn, calibrated, headingJitterQ, anchorSourceNow]);
  useEffect(
    () => () =>
      onStateRef.current?.({
        cameraOn: false,
        calibrated: false,
        headingJitterDeg: 0,
        anchorSource: null,
      }),
    [],
  );

  // La captura es publica com a funció viva: qui la crida posa el peu.
  useEffect(() => {
    if (!captureRef) return;
    captureRef.current = async (caption: string) => {
      const video = videoRef.current;
      const overlay = canvasRef.current;
      const viewport = viewportRef.current;
      if (!video || !overlay || !viewport || !cameraOn) return null;
      const light = lightState(renderRef.current.currentSample);
      const composed = composeCapture(
        video,
        overlay,
        viewport,
        light.cssFilter,
        light.perceived,
        caption,
      );
      return composed ? canvasToJpegBlob(composed) : null;
    };
    return () => {
      captureRef.current = null;
    };
  }, [captureRef, cameraOn]);

  // ---- Ancoratge visual. Tot en refs: s'actualitza a cada fotograma i no ha
  // de provocar cap render de React.
  const trackerRef = useRef<VisualTracker | null>(null);
  const frameClockRef = useRef(new VideoFrameClock());
  const focalRef = useRef(new FocalEstimator());
  const fusionRef = useRef(new PoseFusion());
  const lensWatchRef = useRef<(() => void) | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const diagnosticsRef = useRef<TrackingDiagnostics>(INITIAL_DIAGNOSTICS);
  /** Postura del sensor l'últim cop que va arribar un fotograma de càmera. */
  const sensorAtFrameRef = useRef<{ az: number; alt: number; imageRoll: number } | null>(null);
  const lastDrawMsRef = useRef<number | null>(null);
  /** Mitjana mòbil del cost del cos de dibuix, en ms. És l'àrbitre del 10 Hz. */
  const drawMsRef = useRef(0);
  /** Camp de visió mesurat, en graus sobre el costat llarg del sensor. */
  const measuredFovRef = useRef<number | null>(null);
  /**
   * L'últim camp de visió que s'ha escrit al disc.
   *
   * `saveMeasuredFov` és una escriptura síncrona a `localStorage` i vivia dins
   * de l'interval de mig segon sense cap comparació: dues per segon, tota la
   * sessió, al fil que dibuixa. Ara només s'hi va quan la xifra es mou de debò.
   */
  const savedFovRef = useRef(Number.NaN);
  /** Últim ancoratge a la silueta del terreny. Vegeu `skyline.ts`. */
  const anchorRef = useRef<SkylineFix | null>(null);
  /**
   * Quan es va mesurar l'ancoratge, i cap a on apuntava el sensor llavors.
   *
   * PER QUÈ CAL. L'ancoratge és una postura ABSOLUTA: diu «la càmera apunta a
   * l'azimut X». Es refresca cada sis fotogrames de càmera —uns 5 Hz—, però es
   * tornava a afirmar a cada fotograma de PANTALLA, que en són dotze pel mig, i
   * en dos casos allò deixa de ser cert:
   *
   *   · Escombrant. Entre dues mesures el mòbil s'ha mogut, i la postura vella
   *     estira la fusió cap enrere. És la deriva que arrossega la superposició
   *     darrere del paisatge en una panoràmica.
   *   · Amb la càmera interrompuda —una trucada, canviar d'app, la pista
   *     silenciada—, no arriben fotogrames nous, el bloc que refresca
   *     l'ancoratge no s'executa i l'últim es queda aplicant-se indefinidament
   *     contra un vídeo congelat.
   *
   * Una mesura absoluta té data de caducitat. Aquestes dues refs la hi posen.
   */
  const anchorAtMsRef = useRef(0);
  const anchorSensorRef = useRef<{ az: number; alt: number; speedDegPerSec: number } | null>(
    null,
  );
  /** Compta fotogrames de càmera per no ancorar a cadascun. */
  const anchorTickRef = useRef(0);
  /** L'últim fix de Sol per separat, per al diagnòstic. */
  const sunFixRef = useRef<SkylineFix | null>(null);
  /** Qui ha posat l'àncora vigent: el Sol, el terreny, o tots dos fusionats. */
  const anchorSourceRef = useRef<'sun' | 'moon' | 'terrain' | 'both' | null>(null);
  /** Refinador del centroide del Sol a resolució plena. Es reutilitza. */
  const sunRefinerRef = useRef<SunRefiner | null>(null);
  /** Quan l'àncora de Sol va passar a manar, per al pols de confirmació. */
  const sunLockRef = useRef<number | null>(null);
  /** Misses seguits del lock, per no fer caure el pols per un badall. */
  const sunMissesRef = useRef(0);
  /** L'últim fix de terreny amb la seva data: el terreny va al tick (10 Hz). */
  const terrainFixRef = useRef<SkylineFix | null>(null);
  const terrainFixAtMsRef = useRef(0);
  /**
   * Última postura amb què s'ha DIBUIXAT, que és la fusionada i no la del
   * sensor.
   *
   * El calibratge per toc inverteix la projecció, i ha d'invertir exactament la
   * que ha posat el Sol allà on l'usuari acaba de tocar. Amb la postura del
   * sensor, la correcció s'enduria també la diferència entre el sensor i
   * l'ancoratge visual —fins a un parell de graus— i el calibratge quedaria
   * desviat just en la quantitat que l'ancoratge visual havia corregit bé.
   */
  const drawnCameraRef = useRef<CameraPointing | null>(null);

  const eclipse = getEclipse(eclipseId);

  const circumstances = useMemo(
    () => computeLocalCircumstances(eclipseId, location),
    [eclipseId, location],
  );

  const samples = useMemo(() => {
    const { c1, c4, max } = circumstances.contacts;
    const start = (c1 ?? max).time.getTime();
    const end = (c4 ?? max).time.getTime();
    if (end <= start) return [max];
    const out = [];
    for (let i = 0; i <= PATH_SAMPLES; i++) {
      out.push(sampleAt(new Date(start + ((end - start) * i) / PATH_SAMPLES), location));
    }
    return out;
  }, [circumstances, location]);

  // La finestra C1-C4 en mil·lisegons, per al rellotge governat i el regle.
  const trackWindow = useMemo(() => {
    const { c1, c4, max } = circumstances.contacts;
    return {
      startMs: (c1 ?? max).time.getTime(),
      endMs: (c4 ?? max).time.getTime(),
    };
  }, [circumstances]);

  /*
   * UN SOL RELLOTGE. Amb `timeMs` la pantalla amfitriona governa l'instant:
   * dins de la finestra de l'eclipsi s'usa la mostra precalculada; fora, es
   * calcula la mostra d'AQUELL instant — així el mode «directe» dibuixa el
   * disc on el cel el té ara, que a més fa l'àncora de Sol verificable a ull.
   */
  const controlledSample = useMemo(() => {
    if (timeMs === undefined) return null;
    if (
      samples.length > 1 &&
      timeMs >= trackWindow.startMs &&
      timeMs <= trackWindow.endMs
    ) {
      return samples[
        sampleIndexForTime(timeMs, trackWindow.startMs, trackWindow.endMs, samples.length)
      ];
    }
    return sampleAt(new Date(timeMs), location);
  }, [timeMs, samples, trackWindow, location]);

  const currentSample =
    controlledSample ??
    samples[Math.max(0, Math.min(samples.length - 1, Math.round(progress * (samples.length - 1))))];

  /*
   * SI L'INSTANT SIMULAT CAU DINS DE LA TOTALITAT.
   *
   * Serveix per pintar el cel i per decidir si es dibuixen planetes. NO
   * serveix, i no ha de servir mai, per dir a ningú que es pot treure el
   * filtre: `currentSample` surt de la BARRA que l'usuari arrossega, i
   * arrossegar una barra no fa fosc.
   */
  const isTotality =
    currentSample.separation <=
      Math.abs(currentSample.moon.angularRadius - currentSample.sun.angularRadius) &&
    currentSample.moon.angularRadius >= currentSample.sun.angularRadius;

  /*
   * SI ARA MATEIX, AL MÓN, ES POT MIRAR SENSE FILTRE.
   *
   * AQUÍ HI HAVIA `isTotality` I ERA GREU. El rètol es pintava DAMUNT DE LA
   * IMATGE DE LA CÀMERA, en present i en imperatiu —«Ara sí: mira-ho sense
   * filtre. Treu-te el filtre i mira la corona a ull nu»—, mentre l'usuari
   * apunta el telèfon al Sol de debò. I el que el disparava era la posició
   * d'una barra: dos dels cent seixanta-un passos del recorregut a Oviedo la
   * satisfan, i el marcador de sota et diu on parar.
   *
   * Ara han de coincidir TRES coses: que la comporta de seguretat autoritzi
   * (`canRemoveFilter`, que ja mira l'anular, la durada mínima, el terreny i
   * la incertesa del caire), que el rellotge de PARET sigui dins de la
   * finestra segura, i que la barra no s'estigui fent servir per mirar un
   * altre instant. En simulació, mai.
   */
  // L'entrada de la comporta es memoritza a part perquè la fan servir DUES
  // preguntes diferents —«aquí es podrà, en algun moment?» i «ara mateix?»— i
  // construir-la dues vegades és com les dues respostes es desincronitzen.
  const filterGateInput: FilterGateInput = useMemo(
    () => ({
      kind: circumstances.kind,
      contacts: {
        c1: circumstances.contacts.c1?.time.getTime(),
        c2: circumstances.contacts.c2?.time.getTime(),
        max: circumstances.contacts.max.time.getTime(),
        c3: circumstances.contacts.c3?.time.getTime(),
        c4: circumstances.contacts.c4?.time.getTime(),
      },
      edgeUncertain: circumstances.edgeUncertain,
      // El terreny. Sense això, `canRemoveFilter` el dona per lliure.
      centralPhaseVisible,
    }),
    [circumstances, centralPhaseVisible],
  );


  /*
   * EL RELLOTGE HA DE SER ESTAT, I ABANS NO HO ERA.
   *
   * Aquí hi havia `Date.now()` dins d'aquest mateix `useMemo`, amb
   * `[filterGate.allowed, circumstances]` de dependències: cap de les dues es
   * mou amb el temps, o sigui que la comparació es feia UNA vegada, quan es
   * muntava la vista, i el resultat es quedava clavat tota la sessió.
   *
   * Les dues direccions eren dolentes i una era perillosa. Qui obria la càmera
   * abans de C2 no veia mai el rètol, ni durant la totalitat. I qui l'obria
   * DINS de la finestra segura —el gest més probable del dia: «mira, apunta-hi!»
   * quan ja és fosc— es quedava amb «ara pots mirar sense filtre» encès per
   * sempre: a C3, amb la fotosfera tornant, i a C4, i una hora després.
   *
   * I EL MÉS EMPIPADOR: el rellotge que faltava JA HI ERA. Seixanta línies més
   * avall hi havia un `useState(new Date())` amb el seu interval d'un segon,
   * per moure el Sol del calibratge. Aquesta decisió, que és la que pot fer
   * mal, no el mirava. Ara n'hi ha un de sol, monòton, i el comparteixen totes
   * dues: dos rellotges en una pantalla és com es divergeix sense adonar-se'n.
   */
  const nowMs = useNow(1000);
  const now = useMemo(() => new Date(nowMs), [nowMs]);

  const nakedEyeNow = useMemo(
    () => nakedEyeAllowedAt(filterGateInput, nowMs),
    [filterGateInput, nowMs],
  );

  // Els planetes només es calculen quan de veritat es veuran: durant la resta
  // de l'eclipsi el cel és massa clar i seria informació falsa.
  const bodies = useMemo(
    () => (isTotality ? visibleBodiesDuringTotality(currentSample.time, location) : []),
    [isTotality, currentSample.time, location],
  );

  const light = useMemo(() => lightState(currentSample), [currentSample]);

  // Efemèrides de l'instant REAL, que són la referència del calibratge i de
  // l'àncora de Sol. El rellotge que les mou és el de dalt: aquí hi havia un
  // segon `setInterval` amb el seu propi `new Date()`, i és el que va deixar
  // la comporta de seguretat sense tic. A 1 Hz sobra: el Sol es mou 0,004°/s.
  const liveSample = useMemo(() => sampleAt(now, location), [now, location]);
  const sunNow = liveSample.sun;

  // Mirall del que el bucle de dibuix necessita. S'escriu DESPRÉS de cada
  // render, mai durant: el bucle no s'ha de tornar a crear per això.
  const renderRef = useRef<RenderState>({
    calibration,
    circumstances,
    currentSample,
    liveSample,
    samples,
    bodies,
    horizonProfile,
    locale,
    mode,
  });
  useEffect(() => {
    renderRef.current = {
      calibration,
      circumstances,
      currentSample,
      liveSample,
      samples,
      bodies,
      horizonProfile,
      locale,
      mode,
    };
  });

  /**
   * Apaga la càmera de debò: pistes aturades, vigilància d'objectiu desada i
   * rellotge de fotogrames desenganxat.
   *
   * Un sol camí perquè el desmuntatge, l'error d'obertura i el cas de quedar-se
   * sense element de vídeo no puguin divergir: que la càmera quedi encesa és un
   * dels pocs errors que l'usuari nota al maquinari.
   */
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    lensWatchRef.current?.();
    lensWatchRef.current = null;
    frameClockRef.current.detach();
    if (videoRef.current) videoRef.current.srcObject = null;
    // I la interfície se n'ha d'assabentar: sense això la pantalla es queda
    // dient que la càmera és oberta damunt d'un vídeo que ja no arriba.
    setCameraOn(false);
  }, []);

  const start = useCallback(async () => {
    /*
     * AQUÍ ES DEMANAVA LA UBICACIÓ, I NO CALIA MAI.
     *
     * El comentari deia que els tres permisos es demanen junts des del mateix
     * gest. Però `SkyScreen` no munta aquesta vista fins que `location` no és
     * `null` —abans ensenya la seva pròpia pantalla amb el botó d'ubicar-se—,
     * o sigui que quan s'arriba aquí el lloc SEMPRE se sap i això només obria
     * la fulla «On seràs» per no res.
     *
     * I l'obria damunt de la càmera: el gest estrella del producte, el dia de
     * l'eclipsi, amb una mà, i et surt un full modal competint amb el diàleg
     * de permisos del sistema. Llegeix com una app espatllada justament al
     * moment de màxima pressió.
     *
     * El botó de canviar de lloc segueix existint dins de la vista, on toca
     * (vegeu `onRequestLocation` més avall), per a qui vulgui moure el punt.
     */
    await orientation.request();

    try {
      const opened = await openRearCamera();
      setCameraInfo(opened);

      // Si ja hem mesurat el camp de visió d'aquest objectiu en una sessió
      // anterior, la superposició surt calibrada des del primer fotograma. Si
      // no, es parteix de la conjectura i l'ancoratge visual el mesurarà.
      const remembered = loadMeasuredFov(opened.width, opened.height);
      measuredFovRef.current = remembered;
      setCalibration((c) => ({
        ...c,
        sensorFovDeg: remembered ?? opened.suggestedFovDeg,
      }));

      // Es desa ABANS d'enganxar-lo al vídeo: si el muntatge cau entremig, o si
      // el vídeo encara no hi és, el flux ja té qui l'aturi.
      streamRef.current = opened.stream;

      if (!videoRef.current) {
        // Sense element de vídeo no hi ha res on dibuixar i el permís ja està
        // concedit: deixar el flux obert seria encendre la càmera per a res.
        // Es surt abans de registrar la vigilància d'objectiu, que si no
        // quedaria enganxada a un flux ja mort.
        stopCamera();
        return;
      }

      videoRef.current.srcObject = opened.stream;
      await videoRef.current.play();
      frameClockRef.current.attach(videoRef.current);
      setCameraOn(true);

      // L'iPhone 15 canvia d'objectiu sol a mitja sessió. Quan passa, tot el
      // que havíem mesurat deixa de valer.
      lensWatchRef.current = watchLensChange(opened.stream, (info) => {
        trackerRef.current?.reset();
        focalRef.current.reset();
        fusionRef.current.reset();
        const known = loadMeasuredFov(info.width, info.height);
        measuredFovRef.current = known;
        setCameraInfo((prev) =>
          prev ? { ...prev, width: info.width, height: info.height } : prev,
        );
        if (known !== null) setCalibration((c) => ({ ...c, sensorFovDeg: known }));
      });
    } catch (err) {
      // Si l'obertura ha arribat a donar flux i ha petat després —el `play()`
      // el rebutja iOS quan la pestanya perd el focus a mig gest—, la càmera es
      // quedaria encesa amb la pantalla ensenyant l'error.
      stopCamera();
      setCameraError(err instanceof Error ? err.message : String(err));
    }
  }, [orientation, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // El filtre del vídeo va a part del canvas: el compon la GPU i surt gratis.
  // És el que enfosqueix TOTA l'escena, muntanyes incloses, que és el que
  // passa de veritat durant un eclipsi.
  useEffect(() => {
    if (videoRef.current && mode === 'mixed') {
      videoRef.current.style.filter = light.cssFilter;
    } else if (videoRef.current) {
      videoRef.current.style.filter = '';
    }
  }, [light.cssFilter, mode]);

  // ---- Bucle de dibuix. Es crea UNA vegada i no es torna a crear mai. ----
  const cameraRef = orientation.cameraRef;
  const smoothingRef = orientation.smoothingRef;
  const poseHistoryRef = orientation.poseHistoryRef;
  const predictAheadRef = orientation.predictAheadRef;

  useEffect(() => {
    let frame = 0;

    const draw = () => {
      frame = requestAnimationFrame(draw);

      /*
       * NO ES DIBUIXA AMB LA PÀGINA AMAGADA.
       *
       * El bucle corria sempre, també amb la pestanya al darrere o la pantalla
       * bloquejada. Els navegadors escanyen `requestAnimationFrame` en aquesta
       * situació, però no sempre ni de seguida, i el que es dibuixa no el veu
       * ningú: és bateria i temperatura regalades. El dia 12 d'agost, a ple
       * sol i amb el mòbil a la mà durant una hora, això es nota.
       *
       * També evita el pitjor cas de tornar: acumular un `dt` de trenta segons
       * i passar-lo als filtres com si fos un salt real de postura.
       */
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        lastDrawMsRef.current = null;
        return;
      }

      const canvas = canvasRef.current;
      const camera = cameraRef.current;
      if (!canvas || !camera) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const state = renderRef.current;
      const nowMs = performance.now();
      const dtSec =
        lastDrawMsRef.current === null ? 1 / 60 : (nowMs - lastDrawMsRef.current) / 1000;
      lastDrawMsRef.current = nowMs;
      // El cost del cos es mesura des d'aquí fins després de pintar: és la
      // xifra que decideix si l'àncora a 10 Hz surt a compte en aquest mòbil.
      const bodyStartMs = performance.now();

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      /*
       * S'ARRODONEIX ABANS DE COMPARAR. `canvas.width` és un enter sense
       * signe: assignar-li 1023,75 —que és el que dona un Pixel 6, amb dpr
       * 2,625 i 390 px d'amplada— hi desa 1023. La comparació següent trobava
       * 1023 ≠ 1023,75 i el buffer es tornava a reservar i a buidar A CADA
       * FOTOGRAMA: sis megabytes per fotograma, tres-cents seixanta al segon,
       * amb les pauses del recol·lector que això comporta. I com que les
       * pauses fan irregular el `dtSec`, la fusió estirava a batzegades: el
       * mateix tremolor que es veu a la pantalla.
       *
       * Els iPhone tenen dpr 2 o 3 i no ho pateixen mai, que és per què no
       * surt provant amb un iPhone.
       */
      const bw = Math.round(w * dpr);
      const bh = Math.round(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // El camp de visió MESURAT, un cop convergeix, mana: ja no és una
      // conjectura sobre quin objectiu ens ha tocat, és una mesura feta damunt
      // de la imatge que tenim al davant.
      const fovDeg = measuredFovRef.current ?? state.calibration.sensorFovDeg;
      const viewport = viewportFromElements(videoRef.current, w, h, fovDeg);
      viewportRef.current = viewport;

      const video = videoRef.current;

      // ---- Ancoratge visual, només amb fotograma NOU de càmera -------------
      const framesConsumed = video !== null ? frameClockRef.current.consume() : 0;
      const newFrame = framesConsumed > 0;
      // Dos fotogrames de càmera fosos en un fotograma de dibuix: la mesura
      // cobriria el doble d'interval. Es mesura igualment — cal que el
      // fotograma de referència del seguidor es refresqui — però el resultat
      // es descarta i la fusió integra el sensor, que sí que sap quant temps
      // ha passat.
      const mergedFrames = framesConsumed > 1;
      let visual: VisualRotation | null = null;

      if (newFrame && video) {
        if (!trackerRef.current) trackerRef.current = new VisualTracker();
        const geometry = geometryFor(
          video.videoWidth,
          video.videoHeight,
          w,
          h,
          viewport.focalPx,
        );

        /*
         * LA POSTURA DE QUAN EL FOTOGRAMA ES VA CAPTURAR. La canonada de
         * càmera triga 40-80 ms: el fotograma que arriba ara ensenya el cel
         * de fa un moment, i a 30°/s la diferència són fins a dos graus i
         * mig. Totes les comparacions imatge-contra-sensor d'aquest bloc —
         * la pista, els parells de focal, els errors dels ancoratges — es
         * fan contra la postura de la CAPTURA, treta de la memòria de
         * postures. Sense memòria (primeres lectures), la d'ara.
         */
        const capturePose = poseHistoryRef.current?.at(frameClockRef.current.frameCaptureMs);
        const sensorAtCapture: CameraPointing = capturePose
          ? {
              azimuth: capturePose.azimuth,
              altitude: capturePose.altitude,
              roll: capturePose.roll,
              screenAngle: capturePose.screenAngle,
            }
          : camera;

        if (geometry) {
          // Predicció del gir a partir del sensor: centra la finestra de cerca,
          // i amb això el límit del que es pot mesurar deixa de ser el radi de
          // cerca (uns 100°/s) i passa a ser el desenfocament de moviment. És el
          // seguiment assistit per inercials de qualsevol sistema de RA seriós.
          const previous = sensorAtFrameRef.current;
          const imageRoll = sensorAtCapture.roll + sensorAtCapture.screenAngle;
          let hint: RotationHint | null = null;
          let sensorStep: { pitchRad: number; yawRad: number } | null = null;

          if (previous) {
            sensorStep = poseDeltaToRotation(
              normalizeAngle(sensorAtCapture.azimuth - previous.az),
              sensorAtCapture.altitude - previous.alt,
              imageRoll,
              sensorAtCapture.altitude,
            );
            // El roll també es prediu: el gir de canell acompanya el gest
            // d'inclinar, i sense la seva pista desplaça primer els blocs de
            // les cantonades — els que porten el braç de palanca del pitch.
            // El signe (roll del sensor que creix ⇒ roll que mesura el
            // seguidor) el clava el banc: «un gir de canell es mesura com a
            // roll SIGNAT».
            hint = {
              ...sensorStep,
              rollRad: normalizeAngle(imageRoll - previous.imageRoll) * (Math.PI / 180),
            };
          }

          visual = trackerRef.current.measure(video, geometry, hint);
          if (mergedFrames) visual = null;

          if (
            visual &&
            sensorStep &&
            visual.confidence >= FOCAL_MIN_CONFIDENCE &&
            !visual.saturated
          ) {
            // Cada eix per separat: la focal és la mateixa als dos, però
            // acumular-los junts els faria cancel·lar-se.
            focalRef.current.add(
              0,
              visual.yawRad,
              sensorStep.yawRad,
              viewport.focalPx,
              visual.confidence,
            );
            focalRef.current.add(
              1,
              visual.pitchRad,
              sensorStep.pitchRad,
              viewport.focalPx,
              visual.confidence,
            );
          }

          /*
           * ANCORATGE AL TERRENY.
           *
           * Aquí es tanca el forat que tenia tota la vista: el seguiment
           * visual és RELATIU i necessita textura, i apuntant a cel serè no en
           * troba i retorna `null` — o sigui que justament fent el que l'app
           * demana que facis, la superposició es quedava a mercè de la
           * brúixola. La silueta de la muntanya, en canvi, és el tret amb més
           * contrast de la imatge quan el Sol és baix, i nosaltres sabem on ha
           * de ser: la tenim calculada des del model del terreny per al punt
           * exacte de l'usuari.
           *
           * NO A CADA FOTOGRAMA. L'ajust són unes quantes desenes de
           * projeccions i no cal més sovint: el terreny no es mou, i la deriva
           * que ha de corregir es compta en dècimes de grau per segon. Cada
           * sisè fotograma de càmera són uns 5 Hz.
           */
          /*
           * ELS DOS FARS, CADASCUN AL SEU RITME.
           *
           * La silueta del terreny costa un Gauss-Newton i va al tick
           * (~10 Hz). El Sol és barat de dalt a baix — components connexes
           * d'un llindar altíssim més un retall — i es mesura A CADA
           * FOTOGRAMA DE CÀMERA: l'àncora mai té més de 33 ms i el gating de
           * moviment no la mata fins a ~30-40°/s de gest (la latència de
           * canonada hi compta). És el que fa que, un cop pillat, no el
           * deixi anar: ni deriva durant el gest ni re-assentament en parar.
           * Amb totes les portes senceres cada cop — la cerca completa És
           * l'adquisició i el seguiment alhora, sense màquina d'estats que
           * pugui quedar-se seguint una vora de núvol.
           */
          anchorTickRef.current++;
          if (
            state.horizonProfile &&
            anchorTickRef.current % ANCHOR_EVERY_FRAMES === 0
          ) {
            const hits = detectSkyline(trackerRef.current.lastGray, geometry, viewport);
            let tFix = fitSkyline(
              hits,
              sensorAtCapture,
              state.calibration,
              viewport,
              state.horizonProfile,
            );
            // La porta de plausibilitat: l'acceleròmetre no pot anar tres
            // graus errat d'altura; una silueta que ho afirmi és falsa.
            if (tFix && Math.abs(tFix.deltaAltitudeDeg) > MAX_PLAUSIBLE_ALT_DEG) {
              tFix = null;
            }
            terrainFixRef.current = tFix;
            terrainFixAtMsRef.current = nowMs;
          }

          // ── El Sol (o la Lluna), cada fotograma ──────────────────────────
          let sunFix: SkylineFix | null = null;
          const trackSpeed = smoothingRef.current.angularSpeedDegPerSec;
          const body =
            trackSpeed <= SUN_TRACK_MAX_SPEED_DPS
              ? expectedBrightBody(state.liveSample)
              : null;
          if (body !== null) {
            const predicted = projectToScreen(
              body.body.azimuth,
              body.body.altitudeApparent,
              sensorAtCapture,
              state.calibration,
              viewport,
            );
            let blob = detectSunBlob(
              trackerRef.current.lastGray,
              geometry,
              viewport,
              predicted.visible ? { x: predicted.x, y: predicted.y } : null,
            );
            if (blob !== null) {
              if (!sunRefinerRef.current) sunRefinerRef.current = new SunRefiner();
              const refined = sunRefinerRef.current.refine(
                video,
                { x: blob.screenX, y: blob.screenY },
                viewport,
              );
              // El refinament només s'accepta si el seu pic és comparable al
              // coarse: si surt més fosc, el retall ha anat a una altra cosa.
              if (refined !== null && acceptRefinedPeak(blob.peak, refined.peak)) {
                blob = { ...blob, screenX: refined.x, screenY: refined.y };
              }
            }
            sunFix =
              body.kind === 'sun'
                ? sunFixFrom(
                    blob,
                    sensorAtCapture,
                    state.calibration,
                    viewport,
                    state.liveSample,
                    state.horizonProfile,
                  )
                : blob !== null
                  ? fitSunFix(
                      blob,
                      body.body,
                      sensorAtCapture,
                      state.calibration,
                      viewport,
                      { dAzDeg: 0, dAltDeg: 0 },
                      1,
                      state.horizonProfile,
                    )
                  : null;
          }
          sunFixRef.current = sunFix;

          // ── La fusió dels fars i les estampes ────────────────────────────
          const terrainFresh =
            terrainFixRef.current !== null &&
            nowMs - terrainFixAtMsRef.current <= TERRAIN_FIX_MAX_AGE_MS
              ? terrainFixRef.current
              : null;
          const fix = mergeAnchors(sunFix, terrainFresh);
          if (fix !== null) {
            // Un fotograma sense fix NO esborra l'àncora: la frescor la
            // gestiona ANCHOR_MAX_AGE_MS, i un miss aïllat no és una pèrdua.
            anchorRef.current = fix;
            anchorAtMsRef.current = nowMs;
            anchorSensorRef.current = {
              az: sensorAtCapture.azimuth,
              alt: sensorAtCapture.altitude,
              speedDegPerSec: trackSpeed,
            };
            anchorSourceRef.current =
              sunFix !== null && terrainFresh !== null
                ? 'both'
                : sunFix !== null
                  ? body?.kind === 'moon'
                    ? 'moon'
                    : 'sun'
                  : 'terrain';
          } else if (nowMs - anchorAtMsRef.current > ANCHOR_MAX_AGE_MS) {
            anchorSourceRef.current = null;
          }

          // El pols de confirmació: a l'ADQUISICIÓ, amb tolerància de misses
          // perquè un badall d'un fotograma no el faci caure i redisparar.
          const sunGood = sunFix !== null && sunFix.confidence > 0.6;
          if (sunGood) {
            sunMissesRef.current = 0;
            if (sunLockRef.current === null) sunLockRef.current = nowMs;
          } else if (sunLockRef.current !== null) {
            sunMissesRef.current++;
            if (sunMissesRef.current > SUN_LOCK_MISS_TOLERANCE) {
              sunLockRef.current = null;
              sunMissesRef.current = 0;
            }
          }

          diagnosticsRef.current = {
            ...diagnosticsRef.current,
            confidence: visual?.confidence ?? 0,
            usedBlocks: visual?.usedBlocks ?? 0,
            saturated: visual?.saturated ?? false,
            residualPx: visual?.residualPx ?? 0,
            pitchDegraded: visual?.pitchDegraded ?? false,
          };
        }

        // La referència de la pista s'actualitza a CADA fotograma de càmera,
        // també si la geometria ha sortit nul·la un instant: si no, la pista
        // següent abastaria dos intervals i aniria el doble de lluny del
        // compte — i contaminaria l'estimador de focal amb un parell fals.
        // I amb la postura de CAPTURA, la mateixa vara de mesurar que la
        // pista: barrejar captura i ara faria l'increment coix de latència.
        sensorAtFrameRef.current = {
          az: sensorAtCapture.azimuth,
          alt: sensorAtCapture.altitude,
          imageRoll: sensorAtCapture.roll + sensorAtCapture.screenAngle,
        };
      }

      /*
       * L'ANCORATGE CADUCA. Dues maneres, i totes dues passen de debò:
       *
       *  · PER TEMPS. Si la càmera s'interromp —trucada, canvi d'app, pista
       *    silenciada— deixen d'arribar fotogrames, el bloc que refresca
       *    l'ancoratge no s'executa i l'últim es quedava aplicant-se per sempre
       *    contra una imatge congelada. El llindar és generós respecte del
       *    refresc normal (uns 5 Hz): mig segon són dues mesures i mitja
       *    perdudes, que ja no és una pausa sinó una interrupció.
       *  · PER MOVIMENT. Entre dues mesures el mòbil s'ha pogut moure, i una
       *    postura absoluta vella afirma que apuntes on apuntaves. Aplicada
       *    fotograma rere fotograma durant una panoràmica, estira la
       *    superposició cap enrere: és l'arrossegament que es veu darrere del
       *    paisatge. Passat el llindar val més quedar-se amb el sensor i el
       *    seguiment visual, que sí que saben que t'has mogut, i esperar la
       *    mesura següent, que arriba en dues-centes mil·lèsimes.
       */
      const freshAnchor = () => {
        const fix = anchorRef.current;
        if (fix === null) return null;
        if (nowMs - anchorAtMsRef.current > ANCHOR_MAX_AGE_MS) return null;
        const at = anchorSensorRef.current;
        if (at !== null) {
          // El terme d'azimut s'escala per cos(alt), com a tot arreu de la
          // fusió: a 60° d'altura, un grau d'azimut és mig grau de cel, i
          // sense el factor l'ancoratge s'invalidava el doble de fàcil just
          // apuntant amunt — que és quan més costa recuperar-lo.
          const cosAlt = Math.max(0.2, Math.cos(camera.altitude * (Math.PI / 180)));
          const moved = Math.hypot(
            normalizeAngle(camera.azimuth - at.az) * cosAlt,
            camera.altitude - at.alt,
          );
          if (moved > ANCHOR_MAX_MOVE_DEG) return null;
        }
        return {
          azimuthDeg: fix.azimuthDeg,
          altitudeDeg: fix.altitudeDeg,
          confidence: fix.confidence,
          altitudeOnly: fix.altitudeOnly,
        };
      };

      /*
       * L'ERROR DEL FIX, PER APRENDRE'N EL BIAIX, sobreviu al moviment.
       *
       * `freshAnchor` mor als 3° perquè afirma ON ETS. La diferència entre el
       * fix i el sensor DEL MATEIX INSTANT — totes dues coses guardades a la
       * captura — afirma quant menteix el sensor, i això no canvia per moure's.
       * És el que fa que inclinar el mòbil no deixi el biaix orfe a mig gest.
       */
      const anchorBiasInput = () => {
        const fix = anchorRef.current;
        if (fix === null) return null;
        if (nowMs - anchorAtMsRef.current > ANCHOR_MAX_AGE_MS) return null;
        const at = anchorSensorRef.current;
        if (at === null) return null;
        if (at.speedDegPerSec > ANCHOR_BIAS_MAX_SPEED_DEG_PER_SEC) return null;
        return {
          errAzDeg: normalizeAngle(at.az - fix.azimuthDeg),
          errAltDeg: at.alt - fix.altitudeDeg,
          confidence: fix.confidence,
          altitudeOnly: fix.altitudeOnly,
        };
      };

      const fused = fusionRef.current.update({
        sensorAzimuthDeg: camera.azimuth,
        sensorAltitudeDeg: camera.altitude,
        imageRollDeg: camera.roll + camera.screenAngle,
        newFrame,
        visual,
        sensorSpeedDegPerSec: smoothingRef.current.angularSpeedDegPerSec,
        dtSec,
        anchor: freshAnchor(),
        anchorBias: anchorBiasInput(),
      });

      /*
       * LA PREDICCIÓ, NOMÉS AL DIBUIX. La fusió treballa en el seu temps i no
       * es toca; el que s'empeny endavant és la postura que es PINTA, perquè
       * el píxel arribi a l'ull quan el mòbil ja és allà. La rampa d'entrada
       * evita l'esglaó al llindar.
       */
      let predAz = 0;
      let predAlt = 0;
      const speedNow = smoothingRef.current.angularSpeedDegPerSec;
      if (speedNow > PREDICT_MIN_SPEED_DPS) {
        const pred = predictAheadRef.current?.(nowMs, PREDICT_AHEAD_MS);
        if (pred) {
          const wPred = Math.min(1, (speedNow - PREDICT_MIN_SPEED_DPS) / 3);
          predAz = wPred * pred.dAzDeg;
          predAlt = wPred * pred.dAltDeg;
        }
      }

      const stable: CameraPointing = {
        ...camera,
        azimuth: normalizeAngle(fused.azimuthDeg + predAz),
        altitude: Math.max(-90, Math.min(90, fused.altitudeDeg + predAlt)),
      };
      drawnCameraRef.current = stable;

      if (state.mode === 'mixed') {
        renderMixed(ctx, state.currentSample, {
          viewport,
          camera: stable,
          calibration: state.calibration,
          horizonProfile: state.horizonProfile,
          bodies: state.bodies,
          pathSamples: state.samples,
          locale: state.locale,
          palette: PALETTE,
          guide: {
            label: s('camera.sunArrowLabel', state.locale),
            distanceDeg: angularSeparationDeg(
              stable.azimuth,
              stable.altitude,
              state.currentSample.sun.azimuth,
              state.currentSample.sun.altitudeApparent,
            ),
            sunLockedAtMs: sunLockRef.current,
            nowMs,
          },
        });
      } else {
        renderOverlay(ctx, state.circumstances, state.samples, {
          viewport,
          camera: stable,
          calibration: state.calibration,
          currentTime: state.currentSample.time,
          horizonProfile: state.horizonProfile,
          locale: state.locale,
          palette: PALETTE,
        });
      }

      // Mitjana mòbil exponencial (α=0,1): estable per llegir-la al panell i
      // prou viva per veure una pujada de cost quan passa.
      drawMsRef.current = drawMsRef.current * 0.9 + (performance.now() - bodyStartMs) * 0.1;
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [cameraRef, smoothingRef, poseHistoryRef, predictAheadRef]);

  // ---- Diagnòstic i calibratge de focal, desacoblats del bucle de dibuix. --
  useEffect(() => {
    const id = setInterval(() => {
      if (viewportRef.current) setFovReadout(effectiveFov(viewportRef.current));

      // La focal mesurada es converteix a camp de visió del SENSOR, que és el
      // que es pot desar i el que no depèn de la mida del contenidor.
      const video = videoRef.current;
      const viewport = viewportRef.current;
      const gain = focalRef.current.gain;
      let measuredFov = measuredFovRef.current;

      if (gain !== null && video && viewport && video.videoWidth > 0) {
        const fov = sensorFovFromFocal(
          {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            containerWidth: viewport.width,
            containerHeight: viewport.height,
          },
          gain * viewport.focalPx,
        );
        if (fov !== null && fov >= MIN_FOV_DEG && fov <= MAX_FOV_DEG) {
          measuredFov = fov;
          measuredFovRef.current = fov;
          /*
           * ES REINICIA L'ESTIMADOR EN APLICAR EL GUANY. AIXÒ ÉS EL QUE FA QUE
           * CONVERGEIXI EN COMPTES DE FUGIR.
           *
           * `gain` és el quocient entre el gir visual i el del sensor, i el gir
           * visual s'ha mesurat AMB LA FOCAL QUE HI HAVIA quan es van acumular
           * les finestres. Si no es buiden, la propera lectura torna a portar
           * aquell mateix quocient —encara referit a la focal vella— i es
           * multiplica per la focal nova. Cada mig segon, un altre cop.
           *
           * Mesurat contra el mateix bucle: amb el camp real a 50° i una
           * primera estimació de 66°, el valor tocava els 50,00° exactes als
           * dos segons i després queia a 37,95°, 29,28° i fins al terra dels
           * 25°. En pantalla, el Sol es desplaçava dues vegades i mitja més de
           * pressa que el paisatge i el disc es dibuixava dues vegades i mitja
           * massa gran. I `saveMeasuredFov` desava el disbarat, o sigui que la
           * sessió següent —la del dia de l'eclipsi— començava enverinada.
           *
           * Buidant-lo, el guany següent es mesura contra la focal que ara s'hi
           * fa servir: la successió és una iteració de punt fix que tendeix a
           * 1 i s'hi queda. Costa uns cinquanta graus de panoràmica per volta,
           * que és el que fa qualsevol que busqui el Sol amb el mòbil.
           */
          // Les finestres es capturen ABANS del reinici: són l'historial que
          // acompanya el valor al disc, i el reinici les posa a zero.
          const windows = focalRef.current.count;
          focalRef.current.reset();
          // I només s'escriu al disc quan de veritat canvia: això corria dues
          // vegades per segon tota la sessió.
          if (Math.abs(fov - savedFovRef.current) > FOV_SAVE_STEP_DEG) {
            savedFovRef.current = fov;
            saveMeasuredFov(video.videoWidth, video.videoHeight, fov, windows);
          }
        }
      }

      const fix = anchorRef.current;
      diagnosticsRef.current = {
        ...diagnosticsRef.current,
        videoFps: frameClockRef.current.fps,
        exactFrameClock: frameClockRef.current.exact,
        fusion: fusionRef.current.telemetry,
        focalWindows: focalRef.current.count,
        measuredFovDeg: measuredFov,
        terrainAnchor:
          fix === null
            ? null
            : {
                ageMs: Math.max(0, performance.now() - anchorAtMsRef.current),
                confidence: fix.confidence,
                used: fix.used,
                altitudeOnly: fix.altitudeOnly,
              },
        drawMs: drawMsRef.current,
        pitchGain: focalRef.current.gainForAxis(1),
        sunAnchor:
          sunFixRef.current === null
            ? null
            : {
                confidence: sunFixRef.current.confidence,
                deltaAzDeg: sunFixRef.current.deltaAzimuthDeg,
                deltaAltDeg: sunFixRef.current.deltaAltitudeDeg,
              },
        anchorSource: anchorSourceRef.current,
      };
      setDiagnostics(diagnosticsRef.current);
    }, DIAGNOSTICS_MS);
    return () => clearInterval(id);
  }, []);

  const camera = orientation.camera;
  const rawError = camera ? normalizeAngle(sunNow.azimuth - camera.azimuth) : null;
  const agreement = diagnostics.fusion.agreement;
  const shownFovDeg = diagnostics.measuredFovDeg ?? calibration.sensorFovDeg;
  const sourceKey = SOURCE_KEYS[orientation.headingSource];
  // La nota del soroll porta un terme en negreta al mig de la frase. El
  // diccionari el marca amb `{term}` i aquí es reconstrueix el <strong>:
  // vegeu el perquè al costat de `camera.diag.noiseNote`.
  const [noiseBefore, noiseAfter] = s('camera.diag.noiseNote', locale).split('{term}');

  return (
    <div className="ar">
      {/*
        L'ENTRADA A LA CÀMERA, GRAN I AL MIG.

        Era un botó petit a dalt a l'esquerra, de la mida de qualsevol altre, i
        la pantalla que obre és la raó de ser d'aquesta app: veure el Sol
        eclipsat superposat al teu paisatge. Qui obre la pestanya del cel per
        primer cop ha de saber què hi ha de fer sense pensar-hi.

        A sota, el que hi guanyarà i el que li costarà. La càmera no s'obre mai
        sola: és una decisió de l'usuari, i per prendre-la ha de saber què li
        estem demanant.
      */}
      {!cameraOn && (
        <div className="ar__invite">
          <button className="ar__open" onClick={start} type="button">
            <Icon name="camera" size={ICON_LG} aria-hidden />
            <span>{s('home.openCamera', locale)}</span>
          </button>
          <p className="ar__invitenote">{s('camera.inviteNote', locale)}</p>
        </div>
      )}

      {orientation.permission === 'denied' && (
        <p className="warn">{s('camera.orientationDenied', locale)}</p>
      )}
      {cameraError && (
        <p className="warn">{s('camera.openError', locale, { error: cameraError })}</p>
      )}

      {cameraOn && chrome === 'full' && modeProp === undefined && (
        <div className="ar__modes">
          <button
            className={mode === 'mixed' ? 'tab tab--on' : 'tab'}
            onClick={() => setModeState('mixed')}
          >
            {s('camera.modeMixed', locale)}
          </button>
          <button
            className={mode === 'diagram' ? 'tab tab--on' : 'tab'}
            onClick={() => setModeState('diagram')}
          >
            {s('camera.modeDiagram', locale)}
          </button>
        </div>
      )}

      <div className="viewport" hidden={!cameraOn}>
        <video ref={videoRef} playsInline muted className="viewport__video" />
        {/*
          EL LLENÇ JA NO ES TOCA PER CALIBRAR.

          Hi havia un «toca el Sol a la imatge per calibrar»: es demanava a
          l'usuari que apuntés el dit a un Sol que, o bé encara no és on serà
          —perquè la gràcia de l'app és ensenyar-t'ho amb dies d'antelació—, o
          bé és tan enlluernador que mirar-lo per encertar-lo és exactament el
          que aquesta app passa el dia dient que no facis. I un toc mal posat
          desplaçava tota la superposició sense que res ho desmentís.

          Ho fa sol l'ancoratge a la silueta del terreny (`skyline.ts`), que
          aparella la muntanya que tens al davant amb la que el model del
          terreny diu que hi ha. És més precís que un dit —mig grau contra els
          quatre o cinc d'un toc—, es refà cada fotograma i no demana res.
        */}
        <canvas ref={canvasRef} className="viewport__overlay" />

        {cameraOn && (
          <SafetyBanner eclipseKind={circumstances.kind} isInTotality={nakedEyeNow} />
        )}

        {/*
          LA SORTIDA VIU AMB LA CÀMERA. En mode immersiu la pantalla
          amfitriona amaga capçalera i pestanyes: aquest botó és el camí de
          tornada, i tancar la càmera és el que restaura totes les barres
          (vegeu onState).
        */}
        {cameraOn && chrome === 'none' && (
          <IconButton
            icon="x"
            className="ui-iconbtn--over ar__close"
            label={s('camera.close', locale)}
            onClick={stopCamera}
          />
        )}
      </div>

      {chrome === 'full' && (
        <>
          {cameraOn && (
            <>
              <input
                className="scrub"
            type="range"
            min={0}
            max={1}
            step={1 / PATH_SAMPLES}
            value={
              timeMs !== undefined && trackWindow.endMs > trackWindow.startMs
                ? Math.max(
                    0,
                    Math.min(
                      1,
                      (timeMs - trackWindow.startMs) /
                        (trackWindow.endMs - trackWindow.startMs),
                    ),
                  )
                : progress
            }
            onChange={(e) => {
              const p = Number(e.target.value);
              if (onTimeChange) {
                onTimeChange(
                  trackWindow.startMs + p * (trackWindow.endMs - trackWindow.startMs),
                );
              } else {
                setProgress(p);
              }
            }}
            aria-label={s('camera.scrub', locale)}
          />
          {/*
            L'HORA, AMB L'IDIOMA ACTIU I EN LA ZONA DEL DISPOSITIU. Hi havia un
            `toLocaleTimeString('ca-ES', { timeZone: 'Europe/Madrid' })`: a les
            Canàries l'instant simulat sortia una hora per davant del rellotge
            de l'usuari. El regle de la simulació ja escriu la mateixa lectura
            amb `formatClock` i `sim.readout*`; aquí, igual.
          */}
          <div className="scrub__readout">
            <strong>{formatClock(currentSample.time, locale)}</strong>
            <span>
              {s('sim.readoutAlt', locale, {
                deg: `${formatDecimal(currentSample.sun.altitudeApparent, 2, locale)}°`,
              })}
            </span>
            <span>
              {s('sim.readoutObsc', locale, {
                pct: formatObscurationPercent(currentSample.obscuration, isTotality),
              })}
            </span>
            <span>
              {s('camera.readoutLight', locale, {
                phys: formatDecimal(light.physicalFraction * 100, 3, locale),
                perc: formatDecimal(light.perceived * 100, 0, locale),
              })}
            </span>
          </div>

          {light.perceived > 0.3 && currentSample.obscuration > 0.9 && (
            <p className="note">
              {s('camera.stillDaylight', locale, {
                pct: formatObscurationPercent(currentSample.obscuration, isTotality, 0),
              })}
            </p>
          )}

          {isTotality && bodies.length > 0 && (
            <p className="note">
              {s('camera.visibleBodies', locale, {
                list: bodies.map((b) => b.name).join(', '),
              })}
            </p>
          )}
        </>
      )}

      {/*
        La ubicació, ben visible. Tot el que diu aquesta pantalla —l'hora dels
        contactes, l'azimut, l'altura del Sol, la durada— surt d'aquestes
        coordenades. Si són les del punt per defecte i no les teves, tot és
        correcte per a un altre lloc, i fins ara no hi havia manera de saber-ho.
      */}
      <p className="note">
        <button className="linklike" onClick={() => onRequestLocation?.()}>
          {formatDecimal(location.lat, 4, locale)}°, {formatDecimal(location.lon, 4, locale)}° ·{' '}
          {Math.round(location.elevation)} m
        </button>
        {' — '}
        {s('camera.useMyPosition', locale)}
      </p>

      {/*
        El tipus d'eclipsi era `kind.toUpperCase()`: «ANNULAR» a pantalla, que
        no és cap paraula en cap dels dos idiomes — és el nom intern del
        catàleg. Les claus `kind.*` ja el diuen bé. I la durada era un
        «{m}m {s}s» fet a mà que amb 119,6 s escrivia «1m 60s»;
        `formatDuration` arrodoneix el total abans de repartir-lo.
      */}
      <p className="note">
        {eclipse.label[locale]} · {s(`kind.${circumstances.kind}`, locale)}
        {circumstances.centralDurationSec > 0 &&
          ` · ${formatDuration(circumstances.centralDurationSec)}`}
        {!horizonProfile && ` · ${s('camera.terrainNotComputed', locale)}`}
      </p>

      <button className="btn" onClick={() => setShowDiagnostics((v) => !v)}>
        {showDiagnostics ? s('camera.diagHide', locale) : s('camera.diagShow', locale)}
      </button>

      {showDiagnostics && (
        <>
          <dl className="readout">
            <div>
              <dt>{s('camera.diag.headingSource', locale)}</dt>
              <dd>{sourceKey ? s(sourceKey, locale) : NO_DATA}</dd>
            </div>
            <div>
              <dt>{s('camera.diag.sampleRate', locale)}</dt>
              <dd>{orientation.sampleRate} Hz</dd>
            </div>
            <div>
              {/*
                LA PARELLA DE NÚMEROS QUE DECIDEIX SI CAL UNA APLICACIÓ NATIVA.
                El primer és el soroll que arriba del magnetòmetre; el segon, el
                que en queda després del filtre. Els dos surten del mateix
                estimador circular, perquè comparar-los amb estimadors diferents
                no voldria dir res.
              */}
              <dt>{s('camera.diag.jitter', locale)}</dt>
              <dd className={orientation.jitterFiltered > 0.5 ? 'bad' : 'good'}>
                ±{orientation.jitter.toFixed(2)}° → ±{orientation.jitterFiltered.toFixed(2)}°
              </dd>
            </div>
            <div>
              <dt>{s('camera.diag.angularSpeed', locale)}</dt>
              <dd>
                {s('camera.diag.angularSpeedValue', locale, {
                  speed: orientation.smoothing.angularSpeedDegPerSec.toFixed(1),
                  cutoff: orientation.smoothing.cutoffHz.toFixed(1),
                })}
                {orientation.smoothing.frozen ? ` · ${s('camera.diag.frozen', locale)}` : ''}
              </dd>
            </div>
            <div>
              <dt>{s('camera.diag.accuracy', locale)}</dt>
              <dd>
                {orientation.compassAccuracy != null
                  ? `±${orientation.compassAccuracy.toFixed(0)}°`
                  : s('camera.diag.notAvailable', locale)}
              </dd>
            </div>
            <div>
              <dt>{s('camera.diag.declination', locale)}</dt>
              <dd>
                {s('camera.diag.declinationValue', locale, {
                  deg: `${magneticDeclination >= 0 ? '+' : ''}${magneticDeclination.toFixed(2)}`,
                })}
              </dd>
            </div>
            <div>
              <dt>{s('camera.diag.pointing', locale)}</dt>
              <dd>
                {camera
                  ? s('camera.diag.pointingValue', locale, {
                      az: camera.azimuth.toFixed(1),
                      alt: camera.altitude.toFixed(1),
                      roll: camera.roll.toFixed(0),
                    })
                  : NO_DATA}
              </dd>
            </div>
            <div>
              <dt>{s('camera.diag.sunNow', locale)}</dt>
              <dd>
                {s('camera.diag.azAlt', locale, {
                  az: sunNow.azimuth.toFixed(2),
                  alt: sunNow.altitudeApparent.toFixed(2),
                })}
              </dd>
            </div>
            <div>
              <dt>{s('camera.diag.rawError', locale)}</dt>
              <dd className={rawError !== null && Math.abs(rawError) > 10 ? 'bad' : 'good'}>
                {rawError !== null
                  ? `${rawError > 0 ? '+' : ''}${rawError.toFixed(1)}°`
                  : NO_DATA}
              </dd>
            </div>
            <div>
              <dt>{s('camera.diag.screenFov', locale)}</dt>
              <dd>
                {fovReadout
                  ? `${fovReadout.horizontal.toFixed(1)}° × ${fovReadout.vertical.toFixed(1)}°`
                  : NO_DATA}
              </dd>
            </div>
            <div>
              <dt>{s('camera.diag.anchor', locale)}</dt>
              <dd className={diagnostics.confidence > 0.5 ? 'good' : 'bad'}>
                {diagnostics.saturated
                  ? s('camera.diag.anchorFast', locale)
                  : diagnostics.confidence > 0
                    ? s('camera.diag.anchorValue', locale, {
                        pct: (diagnostics.confidence * 100).toFixed(0),
                        blocks: diagnostics.usedBlocks,
                        res: diagnostics.residualPx.toFixed(2),
                      })
                    : s('camera.diag.noTexture', locale)}
              </dd>
            </div>
            <div>
              {/*
                LA XIFRA QUE DIU SI LA FUSIÓ RESTA O SUMA. Si el signe de
                l'ancoratge visual estigués invertit, la superposició es mouria
                el DOBLE en comptes de quedar-se quieta, i des de fora això
                s'assembla molt a un error d'escala. Amb la concordança no cal
                endevinar-ho: positiva vol dir que la imatge i el sensor diuen el
                mateix; negativa, que hi ha una inversió de signe en algun lloc.
              */}
              <dt>{s('camera.diag.agreement', locale)}</dt>
              <dd className={agreement > 0.5 ? 'good' : agreement < -0.2 ? 'bad' : undefined}>
                {agreement >= 0 ? '+' : ''}
                {agreement.toFixed(2)}
                {' · '}
                {agreement > 0.5
                  ? s('camera.diag.agree', locale)
                  : agreement < -0.2
                    ? s('camera.diag.inverted', locale)
                    : s('camera.diag.noSignal', locale)}
              </dd>
            </div>
            <div>
              <dt>{s('camera.diag.pose', locale)}</dt>
              <dd>
                {s('camera.diag.poseValue', locale, {
                  source: s(
                    diagnostics.fusion.usingVisual
                      ? 'camera.diag.poseVisual'
                      : 'camera.diag.poseSensor',
                    locale,
                  ),
                  drift: diagnostics.fusion.driftDeg.toFixed(2),
                  tau: diagnostics.fusion.pullTauSec.toFixed(2),
                })}
              </dd>
            </div>
            <div>
              {/*
                El biaix que la fusió ha après del terreny. L'azimut pot ser
                gran (la brúixola s'ho mereix); l'altura enganxada al sostre
                d'1,5° vol dir que l'ancoratge veu una silueta que el model no
                té — arbres, teulades — i n'està absorbint l'error.
              */}
              <dt>{s('camera.diag.bias', locale)}</dt>
              <dd
                className={
                  Math.abs(diagnostics.fusion.biasAltDeg) > 1.2 ? 'bad' : undefined
                }
              >
                {s('camera.diag.azAlt', locale, {
                  az: diagnostics.fusion.biasAzDeg.toFixed(1),
                  alt: diagnostics.fusion.biasAltDeg.toFixed(2),
                })}
              </dd>
            </div>
            <div>
              <dt>{s('camera.diag.terrain', locale)}</dt>
              <dd
                className={
                  diagnostics.terrainAnchor && diagnostics.terrainAnchor.ageMs < 500
                    ? 'good'
                    : undefined
                }
              >
                {diagnostics.terrainAnchor
                  ? `${s('camera.diag.terrainValue', locale, {
                      pct: (diagnostics.terrainAnchor.confidence * 100).toFixed(0),
                      cols: diagnostics.terrainAnchor.used,
                      age: Math.round(diagnostics.terrainAnchor.ageMs),
                    })}${
                      diagnostics.terrainAnchor.altitudeOnly
                        ? ` · ${s('camera.diag.terrainAltOnly', locale)}`
                        : ''
                    }${
                      diagnostics.anchorSource === 'terrain' ||
                      diagnostics.anchorSource === 'both'
                        ? ` · ${s('camera.diag.anchorLeads', locale)}`
                        : ''
                    }`
                  : s('camera.diag.terrainNone', locale)}
              </dd>
            </div>
            <div>
              {/*
                El segon far: la taca del Sol (o la Lluna, de nit) contra les
                efemèrides de l'instant real. Res d'aquest panell no convida a
                MIRAR el Sol: la detecció és de la càmera i prou.
              */}
              <dt>{s('camera.diag.sunAnchor', locale)}</dt>
              <dd className={diagnostics.sunAnchor ? 'good' : undefined}>
                {diagnostics.sunAnchor
                  ? `${s('camera.diag.sunAnchorValue', locale, {
                      pct: (diagnostics.sunAnchor.confidence * 100).toFixed(0),
                      daz: diagnostics.sunAnchor.deltaAzDeg.toFixed(2),
                      dalt: diagnostics.sunAnchor.deltaAltDeg.toFixed(2),
                    })}${
                      diagnostics.anchorSource === 'sun' ||
                      diagnostics.anchorSource === 'moon' ||
                      diagnostics.anchorSource === 'both'
                        ? ` · ${s('camera.diag.anchorLeads', locale)}`
                        : ''
                    }`
                  : s('camera.diag.sunAnchorNone', locale)}
              </dd>
            </div>
            <div>
              {/*
                La quietud en xifres: el límit de correcció vigent. A 0,3°/s
                amb el mòbil quiet, la superposició no es pot moure de manera
                visible per molt que el sensor balli.
              */}
              <dt>{s('camera.diag.slew', locale)}</dt>
              <dd>
                {diagnostics.fusion.slewDegPerSec.toFixed(1)}°/s
                {diagnostics.fusion.slewClamped
                  ? ` · ${s('camera.diag.slewClamped', locale)}`
                  : ''}
                {diagnostics.pitchDegraded
                  ? ` · ${s('camera.diag.pitchDegraded', locale)}`
                  : ''}
              </dd>
            </div>
            <div>
              {/*
                Cost del cos de dibuix i, si n'hi ha, el guany de focal de
                l'eix d'inclinació: si difereix clarament del d'azimut, allò
                és l'empremta de l'obturador rodant del sensor, mesurada.
              */}
              <dt>{s('camera.diag.frameCost', locale)}</dt>
              <dd className={diagnostics.drawMs > 8 ? 'bad' : 'good'}>
                {diagnostics.drawMs.toFixed(1)} ms
                {diagnostics.pitchGain !== null
                  ? ` · ${s('camera.diag.pitchGain', locale, {
                      gain: diagnostics.pitchGain.toFixed(3),
                    })}`
                  : ''}
              </dd>
            </div>
            <div>
              {/*
                Fotogrames de càmera NOUS per segon. Si això va molt per sota de
                la freqüència de dibuix, l'ancoratge visual treballa amb la
                meitat de la informació que sembla; si cau a zero amb la càmera
                oberta, el flux s'ha aturat.
              */}
              <dt>{s('camera.diag.frames', locale)}</dt>
              <dd className={diagnostics.videoFps >= 20 ? 'good' : 'bad'}>
                {diagnostics.videoFps} Hz (
                {s(
                  diagnostics.exactFrameClock
                    ? 'camera.diag.framesCounted'
                    : 'camera.diag.framesEstimated',
                  locale,
                )}
                )
              </dd>
            </div>
            <div>
              <dt>{s('camera.diag.measuredFov', locale)}</dt>
              <dd className={diagnostics.measuredFovDeg ? 'good' : undefined}>
                {diagnostics.measuredFovDeg
                  ? s('camera.diag.measuredFovValue', locale, {
                      deg: diagnostics.measuredFovDeg.toFixed(1),
                    })
                  : s('camera.diag.measuring', locale, { n: diagnostics.focalWindows })}
              </dd>
            </div>
            <div>
              <dt>{s('camera.diag.lens', locale)}</dt>
              <dd>
                {cameraInfo
                  ? `${cameraInfo.width}×${cameraInfo.height}${
                      cameraInfo.looksUltraWide
                        ? ` · ${s('camera.diag.ultraWide', locale)}`
                        : ''
                    }${
                      cameraInfo.zoomRange
                        ? ` · ${s('camera.diag.zoom', locale, {
                            min: cameraInfo.zoomRange.min,
                            max: cameraInfo.zoomRange.max,
                          })}`
                        : ''
                    }`
                  : NO_DATA}
              </dd>
            </div>
          </dl>

          <label className="slider">
            {s('camera.diag.sensorFov', locale, { deg: shownFovDeg.toFixed(1) })}
            <input
              type="range"
              min={MIN_FOV_DEG}
              max={MAX_FOV_DEG}
              step={0.5}
              value={shownFovDeg}
              onChange={(e) => {
                // Tocar-lo a mà descarta la mesura automàtica: si l'usuari hi
                // posa la mà és perquè no se'n refia, i seguir sobreescrivint-lo
                // seria discutir-hi.
                measuredFovRef.current = null;
                focalRef.current.reset();
                setCalibration((c) => ({ ...c, sensorFovDeg: Number(e.target.value) }));
              }}
            />
          </label>

          <p className="note">{s('camera.diag.fovNote', locale)}</p>
          <p className="note">
            {noiseBefore}
            <strong>{s('camera.diag.noiseTerm', locale)}</strong>
            {noiseAfter}
          </p>
        </>
      )}
        </>
      )}
    </div>
  );
}
