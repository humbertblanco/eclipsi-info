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
import { nakedEyeAllowedAt, type FilterGateInput } from '../../core/timer';
import { useNow } from '../../state/useNow';
import { Icon, ICON_LG } from '../../ui';
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
import { loadMeasuredFov, saveMeasuredFov } from './focalStore';
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
}

type Mode = 'mixed' | 'diagram';

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

/** Cada quants fotogrames de càmera es torna a ancorar al terreny. */
const ANCHOR_EVERY_FRAMES = 6;

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

const MIN_FOV_DEG = 25;
const MAX_FOV_DEG = 140;

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
}

const INITIAL_DIAGNOSTICS: TrackingDiagnostics = {
  confidence: 0,
  usedBlocks: 0,
  saturated: false,
  residualPx: 0,
  videoFps: 0,
  exactFrameClock: false,
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
  const [mode, setMode] = useState<Mode>('mixed');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [progress, setProgress] = useState(0.5);
  const [fovReadout, setFovReadout] = useState<{ horizontal: number; vertical: number } | null>(
    null,
  );
  const [cameraInfo, setCameraInfo] = useState<CameraOpenResult | null>(null);
  const [diagnostics, setDiagnostics] = useState<TrackingDiagnostics>(INITIAL_DIAGNOSTICS);

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
  const sensorAtFrameRef = useRef<{ az: number; alt: number } | null>(null);
  const lastDrawMsRef = useRef<number | null>(null);
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

  const currentSample =
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

  // Mirall del que el bucle de dibuix necessita. S'escriu DESPRÉS de cada
  // render, mai durant: el bucle no s'ha de tornar a crear per això.
  const renderRef = useRef<RenderState>({
    calibration,
    circumstances,
    currentSample,
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
      samples,
      bodies,
      horizonProfile,
      locale,
      mode,
    };
  });

  // Posició del Sol ARA, que és la referència del calibratge. El rellotge que
  // la mou és el de dalt: aquí hi havia un segon `setInterval` amb el seu propi
  // `new Date()`, i és el que va deixar la comporta de seguretat sense tic.
  const sunNow = useMemo(() => sampleAt(now, location).sun, [now, location]);

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
      const newFrame = video !== null && frameClockRef.current.consume();
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

        if (geometry) {
          // Predicció del gir a partir del sensor: centra la finestra de cerca,
          // i amb això el límit del que es pot mesurar deixa de ser el radi de
          // cerca (uns 100°/s) i passa a ser el desenfocament de moviment. És el
          // seguiment assistit per inercials de qualsevol sistema de RA seriós.
          const previous = sensorAtFrameRef.current;
          const imageRoll = camera.roll + camera.screenAngle;
          let hint: RotationHint | null = null;
          let sensorStep: { pitchRad: number; yawRad: number } | null = null;

          if (previous) {
            sensorStep = poseDeltaToRotation(
              normalizeAngle(camera.azimuth - previous.az),
              camera.altitude - previous.alt,
              imageRoll,
              camera.altitude,
            );
            hint = { ...sensorStep, rollRad: 0 };
          }
          sensorAtFrameRef.current = { az: camera.azimuth, alt: camera.altitude };

          visual = trackerRef.current.measure(video, geometry, hint);

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
          anchorTickRef.current++;
          if (
            state.horizonProfile &&
            trackerRef.current &&
            anchorTickRef.current % ANCHOR_EVERY_FRAMES === 0
          ) {
            const hits = detectSkyline(trackerRef.current.lastGray, geometry, viewport);
            const fix = fitSkyline(
              hits,
              camera,
              state.calibration,
              viewport,
              state.horizonProfile,
            );
            anchorRef.current = fix;
            // Amb data, amb la postura del sensor d'aquell instant i amb la
            // velocitat a què anava: sense les dues primeres no hi ha manera
            // de saber si el fix encara val com a POSTURA; sense la tercera,
            // de saber si val com a mesura de BIAIX.
            anchorAtMsRef.current = nowMs;
            anchorSensorRef.current = {
              az: camera.azimuth,
              alt: camera.altitude,
              speedDegPerSec: smoothingRef.current.angularSpeedDegPerSec,
            };
          }

          diagnosticsRef.current = {
            ...diagnosticsRef.current,
            confidence: visual?.confidence ?? 0,
            usedBlocks: visual?.usedBlocks ?? 0,
            saturated: visual?.saturated ?? false,
            residualPx: visual?.residualPx ?? 0,
          };
        }
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

      const stable: CameraPointing = {
        ...camera,
        azimuth: fused.azimuthDeg,
        altitude: fused.altitudeDeg,
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
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [cameraRef, smoothingRef]);

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
          focalRef.current.reset();
          // I només s'escriu al disc quan de veritat canvia: això corria dues
          // vegades per segon tota la sessió.
          if (Math.abs(fov - savedFovRef.current) > FOV_SAVE_STEP_DEG) {
            savedFovRef.current = fov;
            saveMeasuredFov(video.videoWidth, video.videoHeight, fov);
          }
        }
      }

      diagnosticsRef.current = {
        ...diagnosticsRef.current,
        videoFps: frameClockRef.current.fps,
        exactFrameClock: frameClockRef.current.exact,
        fusion: fusionRef.current.telemetry,
        focalWindows: focalRef.current.count,
        measuredFovDeg: measuredFov,
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

      {cameraOn && (
        <div className="ar__modes">
          <button
            className={mode === 'mixed' ? 'tab tab--on' : 'tab'}
            onClick={() => setMode('mixed')}
          >
            {s('camera.modeMixed', locale)}
          </button>
          <button
            className={mode === 'diagram' ? 'tab tab--on' : 'tab'}
            onClick={() => setMode('diagram')}
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
      </div>

      {cameraOn && (
        <>
          <input
            className="scrub"
            type="range"
            min={0}
            max={1}
            step={1 / PATH_SAMPLES}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
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
              <dt>{s('camera.diag.applied', locale)}</dt>
              <dd>
                {s('camera.diag.appliedValue', locale, {
                  deg: `${calibration.azimuthOffset >= 0 ? '+' : ''}${calibration.azimuthOffset.toFixed(2)}`,
                })}
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
              min={40}
              max={130}
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
    </div>
  );
}
