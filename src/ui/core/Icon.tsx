import type { ComponentType, SVGProps } from 'react'
import {
  Aperture,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Camera,
  Check,
  ChevronDown,
  Clock,
  CloudSun,
  Cloudy,
  Compass,
  Crosshair,
  Eye,
  EyeOff,
  Info,
  Layers,
  Mail,
  Map,
  MapPin,
  Moon,
  Pause,
  Play,
  Rss,
  Satellite,
  ScanEye,
  Search,
  Settings,
  Share2,
  Sun,
  Thermometer,
  Timer,
  TriangleAlert,
  Upload,
  Users,
  X,
  type LucideProps,
} from 'lucide-react'

/* ============================================================================
   Icon — embolcall sobre lucide-react.

   PER QUÈ EXISTEIX AQUEST EMBOLCALL (i no fem servir lucide directament):

   1) OFFLINE. L'original del sistema de disseny carregava Lucide des d'un CDN
      (`unpkg.com/lucide@0.454.0`) i resolia les icones en temps d'execució.
      Això és inacceptable aquí: el dia de l'eclipsi la xarxa mòbil estarà
      saturada dins la franja de totalitat, i una icona que no carrega en un
      avís de seguretat ("no miris el Sol sense filtre") és un problema real,
      no cosmètic. `lucide-react` empaqueta els SVG dins el bundle: zero
      peticions de xarxa en temps d'execució.

   2) TREE-SHAKING. Importem els 26 components pel seu nom, un a un. El
      bundler només inclou aquests, no les ~1.600 icones del paquet. Per això
      el registre de sota és un objecte literal amb referències directes i NO
      un `import()` dinàmic per nom: un import dinàmic obligaria a incloure-ho
      tot i mataria el tree-shaking.

   3) API ESTABLE. Els consumidors escriuen `name="cloud-sun"` (kebab-case,
      igual que l'original i que la nomenclatura pública de Lucide). Si demà
      canviem de proveïdor d'icones o Lucide reanomena un export, es toca
      només aquest fitxer i no les 25 crides repartides per l'app.
   ========================================================================== */

/**
 * Vocabulari tancat d'icones del producte.
 *
 * PER QUÈ UNA UNIÓ TANCADA i no `string`: si algú escriu `name="clod-sun"`
 * l'error surt en compilació, no com una icona invisible en producció. Afegir
 * una icona nova és deliberat: cal tocar el tipus i el registre alhora.
 */
export type IconName =
  | 'sun'
  | 'cloud-sun'
  | 'cloudy'
  | 'moon'
  | 'timer'
  | 'clock'
  | 'map'
  | 'map-pin'
  | 'crosshair'
  | 'compass'
  | 'camera'
  | 'aperture'
  | 'eye'
  | 'eye-off'
  | 'bell'
  | 'book-open'
  | 'share-2'
  | 'upload'
  | 'triangle-alert'
  | 'info'
  | 'github'
  | 'rss'
  | 'mail'
  | 'users'
  | 'thermometer'
  | 'satellite'
  /* --- vocabulari d'interfície ------------------------------------------
     Aquests vuit no surten a `guidelines/brand-icons.card.html`, que només
     ensenya les icones de DOMINI (Sol, núvols, mapa, càmera). Els components
     del sistema, en canvi, en fan servir vuit més per a mecànica pura: el
     `x` de tancar (Tag, Toast, Dialog), el `check` de la casella, el
     `chevron-down` del desplegable, la fletxa enrere de `BackTopBar`… Sense
     elles no es poden implementar els contractes, i dibuixar-les a mà a cada
     component és com vam acabar tenint un tic d'SVG dins de `Checkbox`. */
  | 'arrow-left'
  | 'arrow-right'
  /* El transport de la línia de temps del simulador (`features/sim/
     TimelineControls.tsx`). Van al vocabulari i no dibuixades a mà dins del
     component per la mateixa raó que hi van les vuit de sobre: el tic d'SVG
     que va acabar dins de `Checkbox` va començar exactament així, amb una
     forma que «només la fa servir un component». I un triangle i dues barres
     són el senyal universal de reproduir i pausar: no hi ha manera d'escriure
     «Reprodueix» en un botó de 44 px que hagi de conviure amb els de ±1 min. */
  | 'play'
  | 'pause'
  | 'check'
  | 'chevron-down'
  | 'layers'
  | 'scan-eye'
  | 'search'
  | 'settings'
  | 'x'

/**
 * Gruix de traç del sistema de disseny.
 *
 * PER QUÈ 1.75 i no el 2 per defecte de Lucide: el sistema fixa 1.75 perquè
 * sobre el fons fosc (--ink-950) un traç de 2px "empastifa" i les icones
 * petites perden detall. És una constant del sistema, no una preferència.
 */
const STROKE_WIDTH = 1.75

/**
 * Mida per defecte, en píxels.
 *
 * SÓN 20 I NO 24. Ho fixen dues fonts que diuen el mateix: el contracte
 * (`components/core/Icon.d.ts` — «16 inline with text, 20 default UI, 24 in tab
 * bars») i la implementació real del sistema (`_ds_bundle.js`, `size = 20`).
 * Abans aquí hi havia 24, que és el valor per defecte de Lucide, no el del
 * sistema: totes les icones sense mida explícita sortien un 20 % massa grosses.
 */
const DEFAULT_SIZE = 20

/**
 * Marca de GitHub.
 *
 * PER QUÈ ÉS LOCAL I NO VE DE lucide-react: Lucide va retirar totes les icones
 * de marca a la v1.0 (motius de marca registrada); la versió que feia servir
 * l'original (0.454.0) encara les tenia. Com que `github` forma part del
 * vocabulari acordat, reproduïm aquí el traçat exacte d'aquella versió
 * (lucide-static 0.454.0, llicència ISC) dins la mateixa graella de 24×24,
 * de manera que encaixi visualment amb la resta. L'alternativa —clavar
 * lucide-react a una versió d'ara fa un any per una sola icona— sortia molt
 * més cara.
 */
const GithubMark: ComponentType<LucideProps> = ({
  size = DEFAULT_SIZE,
  color = 'currentColor',
  strokeWidth = STROKE_WIDTH,
  absoluteStrokeWidth: _absoluteStrokeWidth,
  ...rest
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...rest}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
)

/**
 * Registre nom-públic → component de Lucide.
 *
 * `Record<IconName, ...>` obliga el compilador a comprovar que hi són tots:
 * si s'afegeix un nom al tipus i s'oblida aquí, el build peta.
 */
const REGISTRY: Record<IconName, ComponentType<LucideProps>> = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloudy: Cloudy,
  moon: Moon,
  timer: Timer,
  clock: Clock,
  map: Map,
  'map-pin': MapPin,
  crosshair: Crosshair,
  compass: Compass,
  play: Play,
  pause: Pause,
  camera: Camera,
  aperture: Aperture,
  eye: Eye,
  'eye-off': EyeOff,
  bell: Bell,
  'book-open': BookOpen,
  'share-2': Share2,
  upload: Upload,
  'triangle-alert': TriangleAlert,
  info: Info,
  github: GithubMark,
  rss: Rss,
  mail: Mail,
  users: Users,
  thermometer: Thermometer,
  satellite: Satellite,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  check: Check,
  'chevron-down': ChevronDown,
  layers: Layers,
  'scan-eye': ScanEye,
  search: Search,
  settings: Settings,
  x: X,
}

/**
 * Props d'`Icon`.
 *
 * El contracte documentat són `name`, `size` i `color`. Deixem passar la resta
 * d'atributs SVG estàndard (`className`, `aria-label`, `aria-hidden`, `role`…)
 * perquè una icona ha de poder ser etiquetada o amagada als lectors de
 * pantalla segons el context; és un superconjunt estricte del contracte, així
 * que cap consumidor escrit contra l'API documentada es pot trencar.
 */
export interface IconProps
  extends Omit<SVGProps<SVGSVGElement>, 'name' | 'color' | 'ref'> {
  /** Nom del vocabulari d'icones, en kebab-case (p. ex. `'cloud-sun'`). */
  name: IconName
  /** Costat del quadrat de la icona, en px. Per defecte 20 (mida d'UI). */
  size?: number | string
  /** Color del traç. Per defecte hereta el color del text (`currentColor`). */
  color?: string
  /**
   * Gruix del traç. Per defecte 1,75, que és el pes de la marca.
   *
   * El contracte diu que només s'ha de pujar a 2 a partir de 32 px… i el
   * sistema mateix en fa una excepció que sí que val la pena copiar: la
   * pestanya ACTIVA de la barra inferior engreixa la icona a 2 per marcar on
   * ets. És l'únic senyal, a part del color, que distingeix la pestanya on ets
   * de les altres tres.
   */
  strokeWidth?: number
}

export function Icon({
  name,
  size = DEFAULT_SIZE,
  color = 'currentColor',
  strokeWidth = STROKE_WIDTH,
  ...rest
}: IconProps) {
  const Glyph = REGISTRY[name]

  return <Glyph size={size} color={color} strokeWidth={strokeWidth} {...rest} />
}

export default Icon
