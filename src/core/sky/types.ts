/** Tipus públics del model de llum. Cap dependència de DOM. */

/** Color en sRGB, components de 0 a 255. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Fase de l'eclipsi, des del punt de vista de la llum que arriba a terra. */
export type LightPhase =
  /** Cap eclipsi, o encara no es nota. */
  | 'clear'
  /** Fase parcial: sempre queda un tros de fotosfera visible. */
  | 'partial'
  /** Anularitat: queda un anell sencer. Mai no es fa fosc. */
  | 'annular'
  /** Totalitat: la fotosfera desapareix del tot. */
  | 'total';

/** Règim de funcionament de la retina. */
export type VisionRegime =
  /** Només cons: colors plens, agudesa màxima. */
  | 'photopic'
  /** Cons i bastons alhora: els colors comencen a marxar. */
  | 'mesopic'
  /** Només bastons: visió en gris i sense detall fi. */
  | 'scotopic';

/** D'on ve cada lux. És el desglossament que fa el model explicable. */
export interface IlluminanceBreakdown {
  /** Feix solar directe projectat sobre el pla horitzontal, en lux. */
  directLux: number;
  /** Llum del cel (dispersada per l'atmosfera local), en lux. */
  diffuseLux: number;
  /**
   * Llum que s'escola dins de l'ombra des de l'atmosfera il·luminada de fora.
   * Durant la totalitat és el terme que mana: la corona hi posa molt menys.
   */
  leakageLux: number;
  /** Corona solar, en lux. */
  coronaLux: number;
  /** Masses d'aire que travessa el feix directe. */
  airMass: number;
  /** Transmitància del feix directe, de 0 a 1. */
  transmittance: number;
  /** Il·luminància del feix directe a incidència normal, en lux. */
  directNormalLux: number;
}

/** Estat de l'ull: la diferència entre la llum que hi ha i la que notes. */
export interface EyeState {
  /** Nivell d'il·luminància al qual l'ull està ajustat, en lux. */
  adaptationLux: number;
  /** Diàmetre de la pupil·la, en mm. */
  pupilDiameterMm: number;
  /** Luminància del paisatge, en cd/m². */
  sceneLuminanceCdM2: number;
  regime: VisionRegime;
  /**
   * Fracció de llum FÍSICA respecte del mateix cel sense eclipsi, de 0 a 1.
   * Amb el 95% del Sol tapat val ~0,03.
   */
  physicalFraction: number;
  /**
   * Fracció de claror PERCEBUDA respecte del mateix cel sense eclipsi.
   * Amb el 95% del Sol tapat val ~0,65: per això la gent no s'ho creu.
   */
  perceivedFraction: number;
  /** Quantes vegades ha caigut la llum física. Amb el 95% tapat, ~32. */
  physicalDropFactor: number;
  /** Quantes vegades notes que ha caigut. Amb el 95% tapat, ~1,5. */
  perceivedDropFactor: number;
  /**
   * Quantes vegades l'ull t'amaga la caiguda: física / percebuda.
   * Aquest número és, ell sol, el contingut educatiu del mòdul.
   */
  compensation: number;
  /**
   * Colorit relatiu, de 0 a 1. Baixa amb la luminància (efecte Hunt) i
   * s'ensorra en entrar al règim mesòpic (desplaçament de Purkinje).
   */
  colorfulness: number;
}

/** Colors del cel per pintar l'escena. */
export interface SkyPalette {
  /** Color al zenit. */
  zenith: Rgb;
  /** Color a l'horitzó, mirant cap al Sol. */
  horizonSunward: Rgb;
  /** Color a l'horitzó, girat d'esquena al Sol. */
  horizonOpposite: Rgb;
  /**
   * Cert durant la totalitat: la franja taronja de l'horitzó fa la volta
   * sencera, els 360°. És la signatura visual que no té cap capvespre.
   */
  horizonGlowIsAllRound: boolean;
  /** Factor de luminància aplicat respecte del mateix cel sense eclipsi. */
  luminanceScale: number;
  /** Factor de saturació aplicat respecte del mateix cel sense eclipsi. */
  saturationScale: number;
  /**
   * Temperatura de color de la llum que il·lumina el terra, en K.
   * Serveix per tenyir el paisatge, no el cel.
   */
  sunlightTemperatureK: number;
}

/** Tot el que el renderitzador necessita saber sobre la llum en un instant. */
export interface SkyState {
  phase: LightPhase;
  /** Il·luminància horitzontal total, en lux. La llum que hi ha de veritat. */
  illuminanceLux: number;
  /** La que hi hauria sense eclipsi, amb el Sol a la mateixa altura. */
  clearSkyIlluminanceLux: number;
  /** illuminanceLux / clearSkyIlluminanceLux. */
  lightFraction: number;
  /**
   * Fracció del FLUX lluminós del Sol que encara es veu.
   * No és 1 − obscuració: el limbe és més fosc que el centre.
   */
  luminousFraction: number;
  /** Fracció de l'ÀREA del disc solar tapada, tal com ens l'han passada. */
  obscuration: number;
  breakdown: IlluminanceBreakdown;
  eye: EyeState;
  palette: SkyPalette;
  /**
   * Altura del Sol, en graus, que donaria aquesta mateixa llum sense eclipsi.
   * Tradueix l'eclipsi a una experiència que tothom coneix: "tens tanta llum
   * com mitja hora abans de la posta".
   */
  equivalentSunAltitudeDeg: number;
  /** Quantes vegades més llum que la lluna plena al zenit. */
  timesFullMoon: number;
  /** Frase curta en català, sense xifres, llesta per ensenyar. */
  headline: string;
}
