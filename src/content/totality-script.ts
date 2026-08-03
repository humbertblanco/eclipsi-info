/**
 * El guió de la totalitat: què has de mirar, i quan, amb les TEVES hores.
 *
 * PER QUÈ EXISTEIX. La totalitat dura entre un i dos minuts i dins hi passen
 * vuit o deu coses seguides. Qui hi arriba sense saber què buscar es passa la
 * meitat del temps buscant, i el que es perd no es recupera fins al pròxim
 * eclipsi. Això és un guió: una seqüència ordenada, ancorada als contactes
 * calculats per a aquest punt exacte, amb el rumb per on arriba l'ombra i els
 * planetes que des d'aquí es veuran de veritat.
 *
 * PER QUÈ SÓN DADES I NO COMPONENTS. El mateix guió s'ha de poder llegir a la
 * pantalla el dia abans, sentir en veu alta el dia mateix i assajar comprimit
 * en un minut. Si fos JSX només serviria per a la primera cosa.
 *
 * LA REGLA QUE MANA PER SOBRE DE TOTES:
 *
 *   Cap fita d'aquest guió no pot dir «treu-te el filtre» si la porta de
 *   seguretat de `core/timer/safety.ts` no ho ha autoritzat.
 *
 * Aquest mòdul NO decideix la seguretat: la pregunta i el motiu els torna
 * `canRemoveFilter`, i el text que autoritza és literalment el de
 * `core/timer/phrases.ts`. Aquí no se'n redacta cap de nou. Així no hi ha dues
 * redaccions que puguin divergir, i buscar «pots treure» al codi segueix
 * donant un sol resultat.
 *
 * Cap dependència del DOM: es pot construir en un Worker i provar sota Node.
 *
 * FONTS del contingut (les mateixes que `src/content/guide.ts`, on hi ha les
 * cites literals; aquí no s'hi ha afegit res que no en surti):
 *
 * [IGN-TOT]  IGN — «Qué se ve en un eclipse total»
 *            https://eclipses.ign.es/que-se-ve-en-un-eclipse-total.html
 *            Grans de Baily, anell de diamant, corona, cromosfera rosada per
 *            emissió d'hidrogen, «descenso muy brusco de la temperatura, todo
 *            en cuestión de unos cuantos segundos», reacció dels animals.
 * [IGN-OBS]  IGN — «Cómo observar los eclipses: Protege tus ojos»
 *            https://eclipses.ign.es/como-observar-eclipses.html
 * [IGN-2028] IGN — «Eclipse anular de Sol de 26 de enero de 2028»
 *            https://eclipses.ign.es/eclipse-anular-sol-de-26-de-enero-2028.html
 * [AAS-EYE]  American Astronomical Society — «Eye Safety»
 *            https://eclipse.aas.org/eye-safety
 *            Treure el filtre «only when the Moon completely covers the Sun's
 *            bright face»; en un eclipsi anular «there is no time when it is
 *            safe to look directly at the Sun without a special-purpose solar
 *            filter».
 * [AAS-DARK] AAS — «How Dark Does It Get During a Total Solar Eclipse?»
 *            https://eclipse.aas.org/eclipse-basics/totality-darkness
 *            1 000 lux al 99 % d'obscuració; ~5 lux durant la totalitat.
 *            ATENCIÓ: AQUESTES DUES XIFRES SÓN D'ECLIPSIS AMB EL SOL ALT i no
 *            es poden copiar en aquest guió. Els eclipsis espanyols de 2026 i
 *            2028 tenen el Sol entre 12° i 1° a la fase central (motor: la
 *            Corunya 12°, Maó 1,8° el 2026; Sevilla 7,3°, València 2,4° el
 *            2028), on el cel serè ja només dona des d'uns 17.000 lux fins a
 *            pocs milers arran d'horitzó, i el mateix percentatge tapat deixa
 *            molta menys llum en valor absolut. Per això aquí no s'escriu cap
 *            xifra de llum a mà: se li demana a `src/core/sky/illuminance.ts`,
 *            que és el model del projecte i està calibrat contra les mateixes
 *            taules.
 */

import { bearingToCardinal } from '../core/astro/gradient';
import { computeShadowMotion } from '../core/astro/shadow';
import type { ShadowMotion } from '../core/astro/shadow';
import { visibleBodiesDuringTotality } from '../core/astro/visibleBodies';
import type { VisibleBody } from '../core/astro/visibleBodies';
import type { Atmosphere, EclipseKind, EclipseSample, LocalCircumstances } from '../core/astro/types';
import { ECLIPSES } from '../core/eclipses/catalog';
// El model de llum del projecte. Cap xifra de lux d'aquest fitxer no s'escriu a
// mà: totes surten d'aquí, que és l'únic lloc on estan calibrades i on es poden
// tornar a comprovar. Vegeu [AAS-DARK] a la capçalera.
import {
  eclipseIlluminance,
  equivalentSunAltitudeDeg,
  luminousFractionFromObscuration,
} from '../core/sky';
import {
  buildRehearsalSchedule,
  canRemoveFilter,
  FILTER_OFF_DELAY_SEC,
  filterOffPhrase,
  filterOnPhrase,
} from '../core/timer';
import type {
  AlertKind,
  AlertSchedule,
  AlertSeverity,
  ContactTimesMs,
  FilterGate,
  LocalisedText,
  RehearsalOptions,
  TimerLocale,
  VoiceAlert,
} from '../core/timer';

/* ------------------------------------------------------------------ tipus */

/**
 * Estat del filtre solar durant una fita. És el camp crític del guió.
 *
 * `naked-eye` només pot aparèixer si la porta de seguretat ho ha autoritzat, i
 * els tests ho comproven exhaustivament. `away-from-sun` vol dir que la fita no
 * és al Sol —el terra, l'horitzó, el que tens al voltant— i per tant la
 * pregunta del filtre no s'hi planteja.
 */
export type BeatFilterState = 'filtered' | 'naked-eye' | 'away-from-sun';

/** Cap a on has de mirar. Serveix perquè la interfície ho pugui dibuixar. */
export type BeatLook = 'sun' | 'ground' | 'horizon' | 'sky' | 'around';

/** Contacte respecte del qual es defineix una fita. */
export type BeatAnchor = 'c2' | 'c3' | 'max';

/** Identificador estable de cada fita. Els tests i la interfície hi pengen. */
export type BeatId =
  // ---- comunes a totes les variants
  | 'light-shadows'
  | 'crescents'
  | 'temperature'
  // ---- totalitat
  | 'shadow-bands-in'
  | 'shadow-wall'
  | 'beads-in'
  | 'diamond-in'
  | 'filter-off'
  // AQUÍ HI HAVIA 'chromosphere-in' I S'HA ELIMINAT. Era una fita `naked-eye`
  // a C2 + 6 s, és a dir SIS SEGONS ABANS que la porta de seguretat autoritzi
  // res: exactament el tram on el biaix del nostre motor (el nostre C2 s'avança
  // fins a nou segons) pot deixar fotosfera a la vista. I no es pot desplaçar
  // més enllà del retard, perquè la cromosfera d'entrada dura uns cinc segons i
  // a C2 + 12 s ja se sol haver acabat: prometre-la seria fer buscar el que ja
  // no hi és. El que se'n podia dir honestament ha passat al text de
  // `filter-off`, i la de sortida segueix tenint fita pròpia.
  | 'corona'
  | 'prominences'
  | 'planets'
  | 'twilight-360'
  | 'last-look'
  | 'chromosphere-out'
  | 'filter-on-15'
  | 'filter-on-5'
  | 'diamond-out'
  | 'beads-out'
  | 'shadow-departs'
  | 'shadow-bands-out'
  // ---- anular
  | 'ring-closes'
  | 'never-safe'
  | 'ring-thinnest'
  | 'ring-opens'
  // ---- sense fase central autoritzada
  | 'why-filtered'
  | 'deep-partial-light'
  | 'max-filtered';

/** Una fita del guió, amb el seu instant absolut ja resolt. */
export interface ScriptBeat {
  id: BeatId;
  /** Contacte de referència. */
  anchor: BeatAnchor;
  /** Desplaçament respecte de l'àncora, en segons. Negatiu = abans. */
  offsetSec: number;
  /** Instant absolut, en ms des de l'època (UTC). Sempre àncora + desplaçament. */
  atMs: number;
  /** Quant dura, aproximadament, el que descriu. Zero si és instantani. */
  windowSec: number;
  filterState: BeatFilterState;
  look: BeatLook;
  severity: AlertSeverity;
  /**
   * Tipus d'avís equivalent a `core/timer`. Les fites de filtre reutilitzen el
   * seu tipus real perquè el reproductor les tracti amb la prioritat que els
   * toca i perquè la fusió amb la programació real les pugui identificar.
   */
  kind: AlertKind;
  /** Finestra durant la qual encara és correcte dir-ho tard, en ms. */
  validForMs: number;
  /** Etiqueta curta per a la pantalla. */
  title: LocalisedText;
  /** Explicació completa. És el que es llegeix el dia abans. */
  text: LocalisedText;
  /** Frase curta per llegir en veu alta. */
  speech: LocalisedText;
}

/**
 * Variant del guió. No és el tipus d'eclipsi: és què es pot fer des d'AQUEST
 * punt. Una totalitat tapada per una carena dona la variant `filtered`.
 */
export type ScriptVariant = 'totality' | 'annular' | 'filtered' | 'none';

/** Avís d'incertesa. Es diu sempre, mai s'amaga. */
export interface ScriptCaveat {
  id: 'edge-uncertain' | 'contact-precision' | 'low-sun-shadow' | 'shadow-speed' | 'shadow-bands';
  text: LocalisedText;
}

export interface TotalityScript {
  eclipseId: string;
  kind: EclipseKind;
  variant: ScriptVariant;
  /** Instants de referència, en ms. Tota fita en penja. */
  contacts: ContactTimesMs;
  /** El veredicte de `core/timer/safety.ts`, tal com ha arribat. */
  filterGate: FilterGate;
  /** Durada de la fase central considerada, en segons. */
  centralDurationSec: number;
  beats: ScriptBeat[];
  /** Moviment de l'ombra, si des d'aquest punt n'hi ha. */
  shadow: ShadowMotion | null;
  /** Cossos que hem calculat que es veuran des d'aquest punt. */
  bodies: VisibleBody[];
  caveats: ScriptCaveat[];
}

export interface TotalityScriptInput {
  circumstances: LocalCircumstances;
  /**
   * Cert si el terreny NO tapa la fase central. Ve de
   * `computeVisibility(...).centralVisibleSec > 0`. Vegeu `core/timer/safety.ts`:
   * per omissió s'assumeix horitzó lliure.
   */
  centralPhaseVisible?: boolean;
  /**
   * Moviment de l'ombra. Si no es passa, es calcula. Passar `null` explícitament
   * el desactiva; passar-lo ja calculat estalvia repetir la feina i permet
   * provar el guió amb contactes fabricats a mà.
   */
  shadow?: ShadowMotion | null;
  /** Cossos visibles. Si no es passen, es calculen al màxim de l'eclipsi. */
  bodies?: VisibleBody[];
}

/* -------------------------------------------------------------- constants */

const SEC = 1000;

/**
 * Segons entre l'avís que autoritza a treure's el filtre i la fita de la corona.
 *
 * ABANS LA CORONA ANAVA A C2 + 10 s FIXOS, i amb el retard de seguretat a dotze
 * segons això la deixava ABANS de l'autorització. La conseqüència real era
 * pitjor que un desordre: `clampToNakedEyeWindow` l'empenyia fins al primer
 * instant de la finestra, que és exactament el de l'autorització, i les dues
 * fites sortien al mateix mil·lisegon. La frase que autoritza és l'única de
 * l'app que no es pot perdre, i és la més llarga de totes —dues oracions,
 * perquè ara va condicionada a veure la corona—, o sigui que la que no pot
 * trepitjar-la és la de la corona.
 *
 * Vuit segons: prou perquè l'autorització s'acabi de dir i perquè qui l'escolta
 * tingui temps de comprovar el cel abans que se li digui què ha de mirar; i
 * prou pocs perquè, fins i tot a la totalitat més curta que la porta autoritza
 * (quaranta segons), la corona encara quedi a cinc segons del primer avís de
 * tornar-se a posar el filtre.
 */
const CORONA_AFTER_FILTER_OFF_SEC = 8;

/**
 * Instant de la corona respecte de C2, en segons.
 *
 * Es deriva del retard de seguretat en comptes d'escriure's a mà perquè la
 * relació que importa és «després de l'autorització», no cap número concret: si
 * algun dia `FILTER_OFF_DELAY_SEC` torna a moure's, això s'hi mou sol.
 */
const CORONA_OFFSET_SEC = FILTER_OFF_DELAY_SEC + CORONA_AFTER_FILTER_OFF_SEC;

/** Avisos de seguretat abans de C3, en segons. Els mateixos que `schedule.ts`. */
const FILTER_ON_SEC = [15, 5] as const;

/**
 * Durada, en segons, a partir de la qual el guió es diu sencer.
 *
 * PER QUÈ CALIA POSAR-HI UN LLINDAR. La finestra sense filtre va del segon 12
 * (`FILTER_OFF_DELAY_SEC`) fins a setze segons abans de C3, o sigui que d'una
 * totalitat de quaranta —la més curta que la porta de seguretat autoritza— en
 * queden dotze de finestra, i abans d'aquest canvi el guió n'omplia seixanta.
 * Amb tot el material dins hi cabien quatre frases seguides amb quatre segons
 * de separació, que és soroll, i les que trepitjaven la corona eren justament
 * les que fan girar-se d'esquena al Sol.
 *
 * Un minut és el tall: per sota, el guió es queda amb l'autorització, la
 * corona i els detalls que només es veuen ara i que són al Sol mateix.
 */
const FULL_SEQUENCE_MIN_SEC = 60;

/**
 * Separació mínima entre dues fites del guió, en ms.
 *
 * Una frase de les nostres es diu en uns dos segons. Per sota de quatre, dues
 * fites seguides es trepitgen i el resultat és soroll, precisament al minut en
 * què no es pot repetir res.
 *
 * L'EXCEPCIÓ ÉS LA FRASE QUE AUTORITZA, que en són vint-i-quatre paraules
 * perquè va condicionada a una observació i no al rellotge: aquella no en té
 * prou amb quatre segons, i per això la corona no s'hi acosta a menys de vuit
 * (`CORONA_AFTER_FILTER_OFF_SEC`).
 */
const MIN_BEAT_GAP_MS = 4 * SEC;

/** Separació mínima respecte d'un avís informatiu de la programació real. */
const MERGE_INFO_GAP_MS = 2500;
/** Separació mínima respecte d'un avís de SEGURETAT de la programació real. */
const MERGE_SAFETY_GAP_MS = 3 * SEC;

/* --------------------------------------------------------------- utilitats */

function contactsMs(circumstances: LocalCircumstances): ContactTimesMs {
  const { contacts } = circumstances;
  const ms = (sample: { time: Date } | undefined): number | undefined =>
    sample === undefined ? undefined : sample.time.getTime();
  return {
    c1: ms(contacts.c1),
    c2: ms(contacts.c2),
    max: contacts.max.time.getTime(),
    c3: ms(contacts.c3),
    c4: ms(contacts.c4),
  };
}

/** Velocitat arrodonida al centenar i amb el punt dels milers. */
function formatSpeed(kmh: number): string {
  const rounded = Math.round(kmh / 100) * 100;
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Percentatge d'obscuració, amb els decimals que calguin per no mentir.
 *
 * `Math.round(99.84)` dona 100, i «el 100 % del Sol tapat» dins d'un guió que
 * existeix precisament per dir que NO és el 100 % és el pitjor arrodoniment
 * possible: entre el 99,84 % i el 100 % hi ha tota la diferència que hi ha
 * entre veure la corona i cremar-se la retina. Per sobre del 99 % es donen
 * decimals; per sota, on la distinció no enganya ningú, es dona enter.
 */
function formatObscurationPct(obscuration: number): string {
  const clamped = Math.max(0, Math.min(1, obscuration));
  if (clamped >= 1) return '100';
  const pct = clamped * 100;
  const digits = pct > 99.5 ? 2 : pct >= 99 ? 1 : 0;
  if (digits === 0) return pct.toFixed(0);
  // La coma decimal la fan servir tots dos idiomes; els zeros de cua sobren.
  return pct
    .toFixed(digits)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
    .replace('.', ',');
}

/**
 * Lux amb dues xifres significatives i prou.
 *
 * El model dona la fuita de llum dins de l'ombra bona a un factor tres (vegeu
 * `src/core/sky/index.ts`), o sigui que escriure «3,914 lux» seria precisió
 * falsa. Dues xifres ja diuen l'única cosa que importa, que és l'ordre de
 * magnitud.
 */
function formatLux(lux: number): string {
  if (lux >= 1000) return String(Math.round(lux / 100) * 100).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (lux >= 100) return String(Math.round(lux / 10) * 10);
  if (lux >= 10) return String(Math.round(lux));
  if (lux >= 1) return lux.toFixed(1).replace('.', ',');
  return lux.toFixed(2).replace('.', ',');
}

/** Factor multiplicatiu arrodonit, per dir «unes tantes vegades menys llum». */
function formatFactor(factor: number): string {
  if (factor >= 1000) return String(Math.round(factor / 100) * 100).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (factor >= 100) return String(Math.round(factor / 10) * 10);
  return String(Math.max(1, Math.round(factor)));
}

/**
 * A què s'assembla aquesta quantitat de llum, dit sense xifres.
 *
 * Es resol amb `equivalentSunAltitudeDeg`, que torna l'altura del Sol que
 * sense eclipsi donaria aquesta il·luminància: així la comparació surt del
 * mateix model que la xifra i no d'una taula escrita a part que podria
 * contradir-la. Els talls són els dels crepuscles publicats (0°, −6°, −12°).
 */
function twilightComparison(lux: number, atmosphere: Atmosphere): LocalisedText {
  const alt = equivalentSunAltitudeDeg(lux, atmosphere);
  if (alt >= 10) return { ca: 'un dia ennuvolat', es: 'un día nublado' };
  if (alt >= 0) return { ca: 'els minuts abans de la posta de sol', es: 'los minutos antes de la puesta de sol' };
  if (alt >= -6) return { ca: 'el crepuscle just després de la posta', es: 'el crepúsculo justo después de la puesta' };
  if (alt >= -12) {
    return {
      ca: 'el final del crepuscle civil, quan s’encenen els fanals',
      es: 'el final del crepúsculo civil, cuando se encienden las farolas',
    };
  }
  if (alt >= -18) return { ca: 'el crepuscle nàutic', es: 'el crepúsculo náutico' };
  return { ca: 'la nit tancada', es: 'la noche cerrada' };
}

/**
 * «al nord», però «a l'oest».
 *
 * En català l'article s'apostrofa davant de vocal, i dels vuit rumbs n'hi ha
 * dos que hi comencen. Sense això el guió diu «cap al oest», que és
 * exactament el detall que fa que un text sembli generat.
 */
function towardsCa(cardinal: string): string {
  return /^[aeiou]/i.test(cardinal) ? `a l’${cardinal}` : `al ${cardinal}`;
}

/** Noms castellans dels cossos. `visibleBodies` els torna en català. */
const BODY_ES: Record<string, string> = {
  Venus: 'Venus',
  Júpiter: 'Júpiter',
  Mercuri: 'Mercurio',
  Mart: 'Marte',
  Saturn: 'Saturno',
};

function bodyName(name: string, locale: TimerLocale): string {
  return locale === 'es' ? (BODY_ES[name] ?? name) : name;
}

/** Diferència d'azimut portada a l'interval −180…180. */
function azimuthDelta(bodyAz: number, sunAz: number): number {
  return ((((bodyAz - sunAz) % 360) + 540) % 360) - 180;
}

/**
 * On és un planeta respecte del Sol, dit com ho diria una persona.
 *
 * Mirant cap a un azimut, els azimuts més grans queden a la dreta. Per això el
 * signe de la diferència ja dona el costat sense cap més trigonometria.
 */
function bodyPlacement(body: VisibleBody, sunAz: number, sunAlt: number, locale: TimerLocale): string {
  const dAz = azimuthDelta(body.azimuth, sunAz);
  const dAlt = body.altitude - sunAlt;
  const side =
    dAz >= 0 ? (locale === 'es' ? 'a la derecha' : 'a la dreta') : locale === 'es' ? 'a la izquierda' : 'a l’esquerra';
  const horizontal = `${Math.round(Math.abs(dAz))}° ${side}`;

  let vertical: string;
  if (Math.abs(dAlt) < 3) {
    vertical = locale === 'es' ? 'a la misma altura' : 'a la mateixa altura';
  } else if (dAlt > 0) {
    vertical = locale === 'es' ? `${Math.round(dAlt)}° más arriba` : `${Math.round(dAlt)}° més amunt`;
  } else {
    vertical = locale === 'es' ? `${Math.round(-dAlt)}° más abajo` : `${Math.round(-dAlt)}° més avall`;
  }

  const conjunction = locale === 'es' ? 'y' : 'i';
  return `${bodyName(body.name, locale)}, ${horizontal} del Sol ${conjunction} ${vertical}`;
}

/* ------------------------------------------------------- esborrany de fita */

/** Fita abans de resoldre l'instant absolut i la finestra de validesa. */
interface BeatDraft {
  id: BeatId;
  anchor: BeatAnchor;
  offsetSec: number;
  windowSec: number;
  filterState: BeatFilterState;
  look: BeatLook;
  severity?: AlertSeverity;
  kind?: AlertKind;
  /** Les fites essencials no es descarten mai per proximitat amb una altra. */
  essential?: boolean;
  /** Finestra de validesa explícita, en ms. Per a les fites de seguretat. */
  validForMs?: number;
  title: LocalisedText;
  text: LocalisedText;
  speech: LocalisedText;
}

/**
 * Finestra de validesa per omissió.
 *
 * Proporcional al que dura el fenomen i amb sostre: «mira les ombres a terra»
 * dita mig minut tard segueix servint; «l'ombra arriba ara» no.
 */
function defaultValidForMs(windowSec: number): number {
  return Math.min(30 * SEC, Math.max(3 * SEC, windowSec * 500));
}

function resolveBeat(draft: BeatDraft, anchorMs: number): ScriptBeat {
  return {
    id: draft.id,
    anchor: draft.anchor,
    offsetSec: draft.offsetSec,
    atMs: anchorMs + draft.offsetSec * SEC,
    windowSec: draft.windowSec,
    filterState: draft.filterState,
    look: draft.look,
    severity: draft.severity ?? 'info',
    kind: draft.kind ?? 'script-cue',
    validForMs: draft.validForMs ?? defaultValidForMs(draft.windowSec),
    title: draft.title,
    text: draft.text,
    speech: draft.speech,
  };
}

/* --------------------------------------------------------- guió: totalitat */

/**
 * Construeix les fites de la totalitat.
 *
 * Rep el rumb i la velocitat ja resolts perquè el text de l'ombra digui per on
 * ve de veritat, i no la frase genèrica que no fa mirar ningú enlloc.
 */
function totalityBeats(
  durationSec: number,
  shadow: ShadowMotion | null,
  bodies: VisibleBody[],
  sunAz: number,
  sunAlt: number,
  atmosphere: Atmosphere,
): BeatDraft[] {
  const drafts: BeatDraft[] = [];

  /** Instant, en segons des de C2, d'una fita col·locada a una fracció de la totalitat. */
  const fraction = (f: number): number => Math.round(durationSec * f);

  drafts.push({
    id: 'light-shadows',
    anchor: 'c2',
    offsetSec: -240,
    windowSec: 200,
    filterState: 'away-from-sun',
    look: 'ground',
    title: { ca: 'La llum es torna metàl·lica', es: 'La luz se vuelve metálica' },
    text: {
      ca: 'Els últims minuts el Sol ja no és un disc sinó una línia de llum, i les ombres es tornen extraordinàriament nítides. Mira a terra sota un arbre: cada espai entre fulles fa de forat estenopeic i el terra s’omple de mitges llunes.',
      es: 'En los últimos minutos el Sol ya no es un disco sino una línea de luz, y las sombras se vuelven extraordinariamente nítidas. Mira al suelo bajo un árbol: cada hueco entre hojas hace de agujero estenopeico y el suelo se llena de medias lunas.',
    },
    speech: {
      ca: 'Mira les ombres a terra. Es tornen molt nítides.',
      es: 'Mira las sombras en el suelo. Se vuelven muy nítidas.',
    },
  });

  drafts.push({
    id: 'shadow-bands-in',
    anchor: 'c2',
    offsetSec: -90,
    windowSec: 70,
    filterState: 'away-from-sun',
    look: 'ground',
    title: { ca: 'Bandes d’ombra', es: 'Bandas de sombra' },
    text: {
      ca: 'Ratlles fosques ondulants que corren per terra, com el fons d’una piscina. Són turbulència atmosfèrica i no surten sempre. Per veure-les cal una superfície clara i llisa: aquí és on serveix el llençol blanc estès a terra.',
      es: 'Rayas oscuras ondulantes que corren por el suelo, como el fondo de una piscina. Son turbulencia atmosférica y no salen siempre. Para verlas hace falta una superficie clara y lisa: aquí es donde sirve la sábana blanca extendida en el suelo.',
    },
    speech: { ca: 'Mira el llençol blanc. Bandes d’ombra.', es: 'Mira la sábana blanca. Bandas de sombra.' },
  });

  drafts.push(shadowWallBeat(shadow));

  drafts.push({
    id: 'beads-in',
    anchor: 'c2',
    // Set segons abans: prou lluny del compte enrere de deu segons de la
    // programació real perquè no s'hi trepitgi, prou a prop de C2 perquè el
    // fil de Sol ja s'estigui trencant.
    offsetSec: -7,
    windowSec: 5,
    filterState: 'filtered',
    look: 'sun',
    title: { ca: 'Grans de Baily', es: 'Granos de Baily' },
    text: {
      ca: 'L’últim fil de Sol es trenca en punts brillants separats: és la llum que passa entre les muntanyes de la vora de la Lluna. Encara és fotosfera, i el filtre encara no es toca.',
      es: 'El último hilo de Sol se rompe en puntos brillantes separados: es la luz que pasa entre las montañas del borde de la Luna. Todavía es fotosfera, y el filtro todavía no se toca.',
    },
    speech: { ca: 'Grans de Baily. Amb el filtre posat.', es: 'Granos de Baily. Con el filtro puesto.' },
  });

  drafts.push({
    id: 'diamond-in',
    anchor: 'c2',
    offsetSec: -2,
    windowSec: 2,
    filterState: 'filtered',
    look: 'sun',
    essential: true,
    title: { ca: 'Anell de diamant', es: 'Anillo de diamante' },
    text: {
      ca: 'Queda un sol punt de llum amb la corona insinuant-se al voltant. És la imatge que tothom té al cap. Segueix sent fotosfera: el filtre es treu quan la veu ho digui, no quan et sembli que ja no enlluerna.',
      es: 'Queda un solo punto de luz con la corona insinuándose alrededor. Es la imagen que todo el mundo tiene en la cabeza. Sigue siendo fotosfera: el filtro se quita cuando la voz lo diga, no cuando te parezca que ya no deslumbra.',
    },
    speech: { ca: 'Anell de diamant. Filtre posat.', es: 'Anillo de diamante. Filtro puesto.' },
  });

  // ————— L'ÚNICA fita que autoritza a treure's el filtre —————
  // El text surt de `core/timer/phrases.ts`, que n'és l'amo. Aquí no se'n
  // redacta cap versió pròpia: dues redaccions de la mateixa autorització és
  // exactament com es divergeix sense adonar-se'n.
  const filterOffText = filterOffPhrase();
  drafts.push({
    id: 'filter-off',
    anchor: 'c2',
    offsetSec: FILTER_OFF_DELAY_SEC,
    windowSec: 0,
    filterState: 'naked-eye',
    look: 'sun',
    severity: 'safety',
    kind: 'filter-off',
    essential: true,
    // Es talla abans del primer avís de seguretat, com a `schedule.ts`: dit
    // tard, aquest és l'únic missatge de l'app que fa mal.
    validForMs: Math.max(0, Math.min(8 * SEC, durationSec * SEC - FILTER_ON_SEC[0] * SEC - FILTER_OFF_DELAY_SEC * SEC)),
    title: filterOffText.label,
    // El text de pantalla repeteix la condició de la veu —comprovar-ho abans de
    // fer res— perquè és la salvaguarda que no depèn de la precisió de cap
    // motor, i s'hi ha recollit el poc que es podia dir honestament de la
    // cromosfera d'entrada, que ja no té fita pròpia: amb dotze segons de
    // retard sovint s'ha acabat, i prometre-la faria buscar el que no hi és.
    text: {
      ca: 'El disc solar ha quedat tapat del tot. Ara, i només fins al tercer contacte, es mira sense filtre: és l’única manera de veure la corona, perquè a través d’un filtre solar no se’n veu absolutament res. Comprova-ho abans de fer res: si encara queda un punt de llum, el filtre no es toca. Pot ser que a la vora per on ha desaparegut el Sol hi quedi un arc rosa —la cromosfera—, però dura uns cinc segons i el retard de seguretat se’l sol menjar.',
      es: 'El disco solar ha quedado tapado del todo. Ahora, y solo hasta el tercer contacto, se mira sin filtro: es la única manera de ver la corona, porque a través de un filtro solar no se ve absolutamente nada. Compruébalo antes de hacer nada: si todavía queda un punto de luz, el filtro no se toca. Puede que en el borde por donde ha desaparecido el Sol quede un arco rosa —la cromosfera—, pero dura unos cinco segundos y el retardo de seguridad suele comérselo.',
    },
    speech: filterOffText.speech,
  });

  drafts.push({
    id: 'corona',
    anchor: 'c2',
    offsetSec: CORONA_OFFSET_SEC,
    windowSec: 20,
    filterState: 'naked-eye',
    look: 'sun',
    essential: true,
    title: { ca: 'Corona', es: 'Corona' },
    text: {
      ca: 'El motiu del viatge. Un halo nacrat i estructurat, amb serpentines que arriben a diversos radis solars. Cap fotografia s’hi assembla: el rang dinàmic que veu l’ull no cap en cap sensor. Mira-la a ull nu primer i amb prismàtics després.',
      es: 'El motivo del viaje. Un halo nacarado y estructurado, con serpentinas que llegan a varios radios solares. Ninguna fotografía se le parece: el rango dinámico que ve el ojo no cabe en ningún sensor. Mírala a simple vista primero y con prismáticos después.',
    },
    speech: { ca: 'Corona. Mira-la a ull nu.', es: 'Corona. Mírala a simple vista.' },
  });

  drafts.push({
    id: 'prominences',
    anchor: 'c2',
    offsetSec: 25,
    windowSec: 15,
    filterState: 'naked-eye',
    look: 'sun',
    title: { ca: 'Protuberàncies', es: 'Protuberancias' },
    text: {
      ca: 'Llengües vermelloses de plasma que sobresurten de la vora de la Lluna. Amb prismàtics —ara sí, sense filtre, i només mentre duri la totalitat— es veuen molt bé.',
      es: 'Lenguas rojizas de plasma que sobresalen del borde de la Luna. Con prismáticos —ahora sí, sin filtro, y solo mientras dure la totalidad— se ven muy bien.',
    },
    speech: { ca: 'Protuberàncies a la vora. Prismàtics, si en tens.', es: 'Protuberancias en el borde. Prismáticos, si tienes.' },
  });

  // ————— El que NOMÉS hi cap si la totalitat arriba al minut —————
  //
  // Els planetes i el crepuscle de 360° fan apartar la vista del Sol. En una
  // totalitat de cent segons és una de les millors coses del guió; en una de
  // quaranta-cinc, on la finestra sense filtre dura dotze segons, és fer girar
  // algú d'esquena a l'únic que ha vingut a veure.
  //
  // L'ORDRE DE PRIORITAT quan no hi cap tot: l'autorització, la corona, els
  // detalls que només es veuen ara i que són al Sol (protuberàncies, l'arc
  // rosa de sortida), i finalment el que passa al voltant. El que cau, cau
  // d'aquí cap avall.
  if (durationSec >= FULL_SEQUENCE_MIN_SEC) {
    drafts.push(planetsBeat(fraction(0.35), bodies, sunAz, sunAlt));

    drafts.push({
      id: 'twilight-360',
      anchor: 'c2',
      offsetSec: fraction(0.5),
      windowSec: 15,
      filterState: 'away-from-sun',
      look: 'around',
      title: { ca: 'Crepuscle de 360°', es: 'Crepúsculo de 360°' },
      text: {
        ca: 'Aparta la vista del Sol un moment i gira sobre tu mateix. Tot l’horitzó té color de posta de sol, en totes direccions alhora, perquè ets sota una ombra d’un centenar de quilòmetres i fora d’ella encara és de dia.',
        es: 'Aparta la vista del Sol un momento y gira sobre ti mismo. Todo el horizonte tiene color de puesta de sol, en todas direcciones a la vez, porque estás bajo una sombra de un centenar de kilómetros y fuera de ella todavía es de día.',
      },
      speech: { ca: 'Gira’t. Tot l’horitzó és color de posta.', es: 'Date la vuelta. Todo el horizonte es color de puesta.' },
    });
  }

  // La llum que hi haurà durant la totalitat, calculada per a AQUEST punt.
  // Aquí hi deia «uns cinc lux, com el crepuscle civil», que és la xifra de
  // l'AAS per a eclipsis amb el Sol alt. Amb el Sol espanyol a pocs graus el
  // model del projecte en dona bastants menys, perquè la llum que entra dins de
  // l'ombra ve del cel de fora i aquell cel també és fluix.
  const totalityLux = eclipseIlluminance(0, sunAlt, { atmosphere }).totalLux;
  const totalityLight = twilightComparison(totalityLux, atmosphere);

  drafts.push({
    id: 'temperature',
    anchor: 'c2',
    offsetSec: fraction(0.65),
    windowSec: 15,
    filterState: 'away-from-sun',
    look: 'around',
    title: { ca: 'Fred, vent i silenci', es: 'Frío, viento y silencio' },
    text: {
      ca: `La temperatura fa un descens molt brusc en qüestió de segons i sovint s’aixeca un cop de vent. Els ocells callen de cop o tornen a dormir, els grills es posen a cantar. La llum haurà caigut fins a uns ${formatLux(totalityLux)} lux, com ${totalityLight.ca}: és el que dona el nostre model amb el Sol a ${Math.round(sunAlt)}°, i com més baix és el Sol menys llum entra dins de l’ombra. Escolta tant com mires.`,
      es: `La temperatura sufre un descenso muy brusco en cuestión de segundos y a menudo se levanta un golpe de viento. Los pájaros callan de golpe o vuelven a dormir, los grillos se ponen a cantar. La luz habrá caído hasta unos ${formatLux(totalityLux)} lux, como ${totalityLight.es}: es lo que da nuestro modelo con el Sol a ${Math.round(sunAlt)}°, y cuanto más bajo está el Sol menos luz entra dentro de la sombra. Escucha tanto como miras.`,
    },
    speech: { ca: 'Escolta. Els ocells callen i baixa la temperatura.', es: 'Escucha. Los pájaros callan y baja la temperatura.' },
  });

  // «Deixa la càmera», NOMÉS SI LA TOTALITAT DURA UN MINUT O MÉS.
  //
  // Va ancorada a vint-i-sis segons de C3, i en una totalitat de quaranta això
  // cau a catorze segons de C2: dos després de l'autorització. Dir «para ara,
  // els últims segons són per mirar» quan encara no fa tres segons que t'has
  // tret el filtre no és un consell, és soroll damunt de l'avís de seguretat, i
  // ningú no ha tingut temps d'encallar-se darrere de la càmera. Per sota del
  // minut els segons van tots a la corona.
  //
  // Tampoc no és `essential`: així, si en alguna durada intermèdia queia damunt
  // d'una altra fita, la regla de separació mínima la descarta sola. Cap frase
  // d'aquest guió no val una que es trepitgi amb una altra.
  if (durationSec >= FULL_SEQUENCE_MIN_SEC) {
    drafts.push({
      id: 'last-look',
      anchor: 'c3',
      offsetSec: -26,
      windowSec: 10,
      filterState: 'naked-eye',
      look: 'sun',
      title: { ca: 'Deixa la càmera', es: 'Deja la cámara' },
      text: {
        ca: 'Si has estat a la càmera, para ara. Els últims segons són per mirar. Fotografies de la corona n’hi ha milions de millors que la teva; aquesta corona, amb aquesta gent i aquest horitzó, no la tornaràs a veure.',
        es: 'Si has estado con la cámara, para ahora. Los últimos segundos son para mirar. Fotografías de la corona hay millones mejores que la tuya; esta corona, con esta gente y este horizonte, no la volverás a ver.',
      },
      speech: { ca: 'Deixa la càmera. Mira la corona.', es: 'Deja la cámara. Mira la corona.' },
    });
  }

  drafts.push({
    id: 'chromosphere-out',
    anchor: 'c3',
    offsetSec: -20,
    windowSec: 5,
    filterState: 'naked-eye',
    look: 'sun',
    title: { ca: 'L’arc rosa de sortida', es: 'El arco rosa de salida' },
    // Dita com una cosa que has de VIGILAR i no com una cosa que ja passa: la
    // cromosfera de sortida apareix als últims segons abans de C3, i aquesta
    // fita arriba vint segons abans. I amb l'asimetria explícita, que és la
    // part que pot fer mal: per TREURE'S el filtre mana el que veus, perquè
    // equivocar-se cap a esperar no té cost; per TORNAR-SE'L A POSAR mana el
    // rellotge i va abans, perquè aquí equivocar-se cap a esperar és el dany.
    text: {
      ca: 'Vigila la vora contrària, per on tornarà el Sol: quan hi vegis un arc rosa, la totalitat ja s’està acabant i el següent que sortirà per allà és fotosfera. No esperis a veure’l per posar-te el filtre. Per treure-te’l manava el que veies; per tornar-te’l a posar mana el rellotge, i el rellotge va abans.',
      es: 'Vigila el borde contrario, por donde volverá el Sol: cuando veas ahí un arco rosa, la totalidad ya se está acabando y lo siguiente que saldrá por ahí es fotosfera. No esperes a verlo para ponerte el filtro. Para quitártelo mandaba lo que veías; para volver a ponértelo manda el reloj, y el reloj va antes.',
    },
    speech: { ca: 'Vigila la vora. Quan torni l’arc rosa, s’acaba.', es: 'Vigila el borde. Cuando vuelva el arco rosa, se acaba.' },
  });

  // ————— Els dos avisos de SEGURETAT abans de C3 —————
  // Textos de `core/timer/phrases.ts`, com la fita d'autorització.
  for (let i = 0; i < FILTER_ON_SEC.length; i++) {
    const sec = FILTER_ON_SEC[i];
    const next: number | undefined = FILTER_ON_SEC[i + 1];
    const phrase = filterOnPhrase(sec);
    drafts.push({
      id: sec === 15 ? 'filter-on-15' : 'filter-on-5',
      anchor: 'c3',
      offsetSec: -sec,
      windowSec: 0,
      filterState: 'filtered',
      look: 'sun',
      severity: 'safety',
      kind: 'filter-on',
      essential: true,
      validForMs: next === undefined ? Math.max(0, (sec - 2) * SEC) : (sec - next) * SEC - SEC,
      title: phrase.label,
      text:
        sec === 15
          ? {
              ca: 'El Sol no torna gradualment: reapareix de cop, i el primer punt de fotosfera ja és massa brillant per a un ull adaptat a la foscor. El filtre s’ha de tenir posat ABANS, no en veure’l.',
              es: 'El Sol no vuelve gradualmente: reaparece de golpe, y el primer punto de fotosfera ya es demasiado brillante para un ojo adaptado a la oscuridad. El filtro debe estar puesto ANTES, no al verlo.',
            }
          : {
              ca: 'Ulls tapats ara. El tercer contacte arriba d’aquí a cinc segons i els instants de contacte tenen un parell de segons d’incertesa.',
              es: 'Ojos tapados ya. El tercer contacto llega dentro de cinco segundos y los instantes de contacto tienen un par de segundos de incertidumbre.',
            },
      speech: phrase.speech,
    });
  }

  drafts.push({
    id: 'diamond-out',
    anchor: 'c3',
    offsetSec: 2,
    windowSec: 4,
    filterState: 'filtered',
    look: 'sun',
    essential: true,
    title: { ca: 'Anell de diamant de sortida', es: 'Anillo de diamante de salida' },
    text: {
      ca: 'El primer punt de Sol torna per la vora oposada, amb la corona encara insinuada al voltant. Es mira amb filtre: això ja és fotosfera.',
      es: 'El primer punto de Sol vuelve por el borde opuesto, con la corona todavía insinuada alrededor. Se mira con filtro: eso ya es fotosfera.',
    },
    speech: { ca: 'Anell de diamant. Només amb filtre.', es: 'Anillo de diamante. Solo con filtro.' },
  });

  drafts.push({
    id: 'beads-out',
    anchor: 'c3',
    offsetSec: 7,
    windowSec: 5,
    filterState: 'filtered',
    look: 'sun',
    title: { ca: 'Grans de Baily de sortida', es: 'Granos de Baily de salida' },
    text: {
      ca: 'Els punts es multipliquen per la vora fins a tornar-se un fil continu. A partir d’aquí el filtre es queda posat fins al quart contacte.',
      es: 'Los puntos se multiplican por el borde hasta volverse un hilo continuo. A partir de aquí el filtro se queda puesto hasta el cuarto contacto.',
    },
    speech: { ca: 'Grans de Baily. El filtre es queda posat.', es: 'Granos de Baily. El filtro se queda puesto.' },
  });

  if (shadow) {
    const cardinalCa = bearingToCardinal(shadow.departureBearing, 'ca');
    const cardinalEs = bearingToCardinal(shadow.departureBearing, 'es');
    drafts.push({
      id: 'shadow-departs',
      anchor: 'c3',
      offsetSec: 15,
      windowSec: 20,
      filterState: 'away-from-sun',
      look: 'horizon',
      title: { ca: 'L’ombra marxa', es: 'La sombra se va' },
      text: {
        ca: `Gira’t cap ${towardsCa(cardinalCa)}. L’ombra s’allunya per allà a la mateixa velocitat amb què ha arribat, i la paret de foscor es veu marxar contra un cel que ja torna a ser clar.`,
        es: `Vuélvete hacia el ${cardinalEs}. La sombra se aleja por ahí a la misma velocidad con la que ha llegado, y la pared de oscuridad se ve marchar contra un cielo que ya vuelve a ser claro.`,
      },
      speech: {
        ca: `Mira cap ${towardsCa(cardinalCa)}. L’ombra marxa.`,
        es: `Mira hacia el ${cardinalEs}. La sombra se va.`,
      },
    });
  }

  drafts.push({
    id: 'shadow-bands-out',
    anchor: 'c3',
    offsetSec: 60,
    windowSec: 60,
    filterState: 'away-from-sun',
    look: 'ground',
    title: { ca: 'Bandes d’ombra, segona passada', es: 'Bandas de sombra, segunda pasada' },
    text: {
      ca: 'Les bandes d’ombra tornen a passar per terra un minut després de la totalitat. És la segona i última oportunitat de veure-les.',
      es: 'Las bandas de sombra vuelven a pasar por el suelo un minuto después de la totalidad. Es la segunda y última oportunidad de verlas.',
    },
    speech: { ca: 'Torna a mirar el llençol. Bandes d’ombra.', es: 'Vuelve a mirar la sábana. Bandas de sombra.' },
  });

  return drafts;
}

/** La fita de l'ombra que arriba. Amb rumb i velocitat si els sabem. */
function shadowWallBeat(shadow: ShadowMotion | null): BeatDraft {
  const base = {
    id: 'shadow-wall' as const,
    anchor: 'c2' as const,
    offsetSec: -20,
    windowSec: 20,
    filterState: 'away-from-sun' as const,
    look: 'horizon' as const,
    essential: true,
    title: { ca: 'L’ombra que arriba', es: 'La sombra que llega' },
  };

  if (!shadow) {
    return {
      ...base,
      text: {
        ca: 'Aparta la vista del Sol i mira l’horitzó per on ve l’ombra. És una paret de foscor que s’acosta a velocitat supersònica. Des d’aquest punt no en podem calcular el rumb.',
        es: 'Aparta la vista del Sol y mira el horizonte por donde viene la sombra. Es una pared de oscuridad que se acerca a velocidad supersónica. Desde este punto no podemos calcular su rumbo.',
      },
      speech: { ca: 'Mira l’horitzó. L’ombra arriba.', es: 'Mira el horizonte. La sombra llega.' },
    };
  }

  const cardinalCa = bearingToCardinal(shadow.arrivalBearing, 'ca');
  const cardinalEs = bearingToCardinal(shadow.arrivalBearing, 'es');
  // Al final del recorregut, amb el Sol rasant, la velocitat sobre el terra
  // tendeix a infinit. Quan passa, la xifra no informa de res i no es diu.
  const speedCa = shadow.speedDiverging ? 'molt de pressa' : `a uns ${formatSpeed(shadow.speedKmh)} km/h`;
  const speedEs = shadow.speedDiverging ? 'muy deprisa' : `a unos ${formatSpeed(shadow.speedKmh)} km/h`;
  const caveatCa = shadow.lowSunCaveat
    ? ` Amb el Sol a ${Math.round(shadow.sunAltitudeDeg)}° la paret arriba molt rasant: es veu més difusa i costa de destriar del capvespre.`
    : '';
  const caveatEs = shadow.lowSunCaveat
    ? ` Con el Sol a ${Math.round(shadow.sunAltitudeDeg)}° la pared llega muy rasante: se ve más difusa y cuesta distinguirla del atardecer.`
    : '';

  return {
    ...base,
    text: {
      ca: `Aparta la vista del Sol i mira cap ${towardsCa(cardinalCa)}. L’ombra de la Lluna arriba per allà ${speedCa}: una paret de foscor que s’acosta i t’engoleix.${caveatCa}`,
      es: `Aparta la vista del Sol y mira hacia el ${cardinalEs}. La sombra de la Luna llega por ahí ${speedEs}: una pared de oscuridad que se acerca y te engulle.${caveatEs}`,
    },
    speech: {
      ca: `Mira cap ${towardsCa(cardinalCa)}. L’ombra arriba.`,
      es: `Mira hacia el ${cardinalEs}. La sombra llega.`,
    },
  };
}

/** La fita dels planetes, amb els que hem calculat per a aquest punt. */
function planetsBeat(offsetSec: number, bodies: VisibleBody[], sunAz: number, sunAlt: number): BeatDraft {
  const base = {
    id: 'planets' as const,
    anchor: 'c2' as const,
    offsetSec,
    windowSec: 15,
    filterState: 'away-from-sun' as const,
    look: 'sky' as const,
    title: { ca: 'Planetes', es: 'Planetas' },
  };

  if (bodies.length === 0) {
    return {
      ...base,
      text: {
        ca: 'Des d’aquest punt no hem calculat cap planeta prou brillant per damunt de l’horitzó durant la totalitat. El cel quedarà com un crepuscle civil: hi pot haver alguna estrella brillant, però no val la pena gastar-hi segons.',
        es: 'Desde este punto no hemos calculado ningún planeta lo bastante brillante por encima del horizonte durante la totalidad. El cielo quedará como un crepúsculo civil: puede haber alguna estrella brillante, pero no vale la pena gastar segundos en ella.',
      },
      speech: { ca: 'Des d’aquí no surt cap planeta brillant.', es: 'Desde aquí no sale ningún planeta brillante.' },
    };
  }

  // Només els tres primers: ja van ordenats per brillantor i buscar-ne cinc en
  // trenta segons no ho fa ningú.
  const shown = bodies.slice(0, 3);
  const listCa = shown.map((b) => bodyPlacement(b, sunAz, sunAlt, 'ca')).join('. ');
  const listEs = shown.map((b) => bodyPlacement(b, sunAz, sunAlt, 'es')).join('. ');
  const firstCa = bodyName(shown[0].name, 'ca');
  const firstEs = bodyName(shown[0].name, 'es');
  const sideCa = azimuthDelta(shown[0].azimuth, sunAz) >= 0 ? 'a la dreta' : 'a l’esquerra';
  const sideEs = azimuthDelta(shown[0].azimuth, sunAz) >= 0 ? 'a la derecha' : 'a la izquierda';

  return {
    ...base,
    text: {
      ca: `Amb el cel a nivell de crepuscle civil surten els planetes brillants. Calculats per a aquest punt i aquesta hora: ${listCa}.`,
      es: `Con el cielo a nivel de crepúsculo civil salen los planetas brillantes. Calculados para este punto y esta hora: ${listEs}.`,
    },
    speech: {
      ca: `${firstCa}, ${sideCa} del Sol.`,
      es: `${firstEs}, ${sideEs} del Sol.`,
    },
  };
}

/* ------------------------------------------------------------ guió: anular */

/**
 * Guió d'un eclipsi anular.
 *
 * No hi ha cap fita `naked-eye` i no n'hi pot haver: l'anell és fotosfera pura
 * i durant l'anularitat no hi ha ni un instant segur sense filtre [AAS-EYE].
 * Tampoc hi ha planetes ni crepuscle de 360°: amb el 90 % d'obscuració el cel
 * no s'enfosqueix prou, i prometre-ho seria fer buscar el que no hi és.
 */
function annularBeats(durationSec: number): BeatDraft[] {
  const mid = Math.round(durationSec / 2);

  return [
    {
      id: 'light-shadows',
      anchor: 'c2',
      offsetSec: -240,
      windowSec: 200,
      filterState: 'away-from-sun',
      look: 'ground',
      title: { ca: 'La llum es torna metàl·lica', es: 'La luz se vuelve metálica' },
      text: {
        ca: 'Els últims minuts la llum es torna metàl·lica i les ombres, molt nítides. Segueix sent de dia i ho serà tota l’estona: aquesta és la diferència amb un eclipsi total.',
        es: 'En los últimos minutos la luz se vuelve metálica y las sombras, muy nítidas. Sigue siendo de día y lo será todo el rato: esta es la diferencia con un eclipse total.',
      },
      speech: { ca: 'Mira les ombres a terra. Es tornen molt nítides.', es: 'Mira las sombras en el suelo. Se vuelven muy nítidas.' },
    },
    {
      id: 'ring-closes',
      anchor: 'c2',
      offsetSec: 0,
      windowSec: 5,
      filterState: 'filtered',
      look: 'sun',
      essential: true,
      title: { ca: 'Es tanca l’anell', es: 'Se cierra el anillo' },
      text: {
        ca: 'La Lluna acaba d’entrar dins del disc solar i el fil de llum es tanca en un anell complet. Amb el filtre posat: el que estàs mirant és el Sol sencer vist per la vora.',
        es: 'La Luna acaba de entrar dentro del disco solar y el hilo de luz se cierra en un anillo completo. Con el filtro puesto: lo que estás mirando es el Sol entero visto por el borde.',
      },
      speech: { ca: 'Es tanca l’anell. Amb el filtre posat.', es: 'Se cierra el anillo. Con el filtro puesto.' },
    },
    {
      id: 'never-safe',
      anchor: 'c2',
      offsetSec: 8,
      windowSec: 0,
      filterState: 'filtered',
      look: 'sun',
      severity: 'safety',
      essential: true,
      validForMs: 10 * SEC,
      title: { ca: 'El filtre no es toca', es: 'El filtro no se toca' },
      text: {
        ca: 'En un eclipsi anular no hi ha cap instant segur sense filtre. L’anell és fotosfera i crema igual que el Sol sencer, encara que el cel s’hagi enfosquit i sembli que ja no enlluerna. Si vas viure la totalitat del 2026 o del 2027, aquest és el dia de no repetir el gest.',
        es: 'En un eclipse anular no hay ningún instante seguro sin filtro. El anillo es fotosfera y quema igual que el Sol entero, aunque el cielo se haya oscurecido y parezca que ya no deslumbra. Si viviste la totalidad de 2026 o 2027, este es el día de no repetir el gesto.',
      },
      speech: {
        ca: 'Anularitat. El filtre no es treu en cap moment.',
        es: 'Anularidad. El filtro no se quita en ningún momento.',
      },
    },
    {
      id: 'ring-thinnest',
      anchor: 'c2',
      offsetSec: mid,
      windowSec: 20,
      filterState: 'filtered',
      look: 'sun',
      title: { ca: 'L’anell, al màxim', es: 'El anillo, en el máximo' },
      text: {
        ca: 'Al màxim l’anell és el més prim i el més simètric de tota la fase central. Amb el filtre, i amb prismàtics filtrats si en tens, s’hi veu el gruix desigual: la vora de la Lluna no és una circumferència llisa.',
        es: 'En el máximo el anillo es el más fino y el más simétrico de toda la fase central. Con el filtro, y con prismáticos filtrados si tienes, se ve el grosor desigual: el borde de la Luna no es una circunferencia lisa.',
      },
      speech: { ca: 'L’anell és al més prim. Amb filtre.', es: 'El anillo está en su punto más fino. Con filtro.' },
    },
    {
      id: 'crescents',
      anchor: 'c2',
      offsetSec: mid + 20,
      windowSec: 30,
      filterState: 'away-from-sun',
      look: 'ground',
      title: { ca: 'Anells a terra', es: 'Anillos en el suelo' },
      text: {
        ca: 'Sota un arbre, o a través d’un escumador de cuina, cada foradet projecta la forma del Sol: ara mateix, anells complets. És l’única manera de veure la forma de l’anell sense mirar-lo.',
        es: 'Bajo un árbol, o a través de un escurridor de cocina, cada agujerito proyecta la forma del Sol: ahora mismo, anillos completos. Es la única manera de ver la forma del anillo sin mirarlo.',
      },
      speech: { ca: 'Mira a terra. Cada foradet projecta un anell.', es: 'Mira al suelo. Cada agujerito proyecta un anillo.' },
    },
    {
      id: 'temperature',
      anchor: 'c3',
      offsetSec: -30,
      windowSec: 20,
      filterState: 'away-from-sun',
      look: 'around',
      title: { ca: 'Fred i silenci', es: 'Frío y silencio' },
      text: {
        ca: 'La temperatura baixa i sovint s’aixeca vent. Els ocells s’aquieten. És més suau que en una totalitat, però amb el Sol al capvespre del gener es nota.',
        es: 'La temperatura baja y a menudo se levanta viento. Los pájaros se aquietan. Es más suave que en una totalidad, pero con el Sol en el atardecer de enero se nota.',
      },
      speech: { ca: 'Escolta. Baixa la temperatura.', es: 'Escucha. Baja la temperatura.' },
    },
    {
      id: 'ring-opens',
      anchor: 'c3',
      offsetSec: 0,
      windowSec: 5,
      filterState: 'filtered',
      look: 'sun',
      essential: true,
      title: { ca: 'S’obre l’anell', es: 'Se abre el anillo' },
      text: {
        ca: 'La Lluna toca la vora per l’altra banda i l’anell es trenca. S’acaba l’anularitat. El filtre segueix posat fins al quart contacte.',
        es: 'La Luna toca el borde por el otro lado y el anillo se rompe. Se acaba la anularidad. El filtro sigue puesto hasta el cuarto contacto.',
      },
      speech: { ca: 'S’obre l’anell. El filtre segueix posat.', es: 'Se abre el anillo. El filtro sigue puesto.' },
    },
  ];
}

/* -------------------------------------- guió: sense fase central autoritzada */

/** Explicació del perquè, treta del motiu que torna la porta de seguretat. */
function gateReasonText(gate: FilterGate): LocalisedText {
  switch (gate.reason) {
    case 'partial-only':
      return {
        ca: 'Des d’aquest punt l’eclipsi és només parcial: la Lluna no arriba a tapar el Sol del tot i sempre en queda fotosfera a la vista. No hi ha cap moment segur sense filtre, per alta que sigui l’obscuració.',
        es: 'Desde este punto el eclipse es solo parcial: la Luna no llega a tapar el Sol del todo y siempre queda fotosfera a la vista. No hay ningún momento seguro sin filtro, por alta que sea la oscuración.',
      };
    case 'central-blocked-by-terrain':
      return {
        ca: 'Hi ha fase central, però des d’aquest punt el terreny tapa el Sol mentre dura. El que et pot reaparèixer per damunt de la carena és fotosfera: el filtre no es treu. Val la pena mirar si movent-te uns quilòmetres el veuries.',
        es: 'Hay fase central, pero desde este punto el terreno tapa el Sol mientras dura. Lo que te puede reaparecer por encima de la loma es fotosfera: el filtro no se quita. Vale la pena mirar si moviéndote unos kilómetros lo verías.',
      };
    case 'totality-too-short':
      return {
        ca: 'Ets pràcticament damunt del límit de la franja. La totalitat calculada és tan curta que la incertesa del perfil de muntanyes de la Lluna la supera: hi hauria fotosfera visible bona part del temps. Aquí no autoritzem treure’s res. Mou-te cap al centre de la franja.',
        es: 'Estás prácticamente sobre el límite de la franja. La totalidad calculada es tan corta que la incertidumbre del perfil de montañas de la Luna la supera: habría fotosfera visible buena parte del tiempo. Aquí no autorizamos quitarse nada. Muévete hacia el centro de la franja.',
      };
    case 'edge-uncertain':
      return {
        ca: 'Ets a la franja de dos o tres quilòmetres on el nostre error de posició relativa entre el Sol i la Lluna és més gran que el marge que et separa del límit. Dit clar: no sabem si des d’aquí hi haurà totalitat o no, i una resposta a cara o creu no autoritza ningú a treure’s res. Mou-te cap al centre de la franja i el guió canviarà tot sol.',
        es: 'Estás en la franja de dos o tres kilómetros donde nuestro error de posición relativa entre el Sol y la Luna es mayor que el margen que te separa del límite. Dicho claro: no sabemos si desde aquí habrá totalidad o no, y una respuesta a cara o cruz no autoriza a nadie a quitarse nada. Muévete hacia el centro de la franja y el guion cambiará solo.',
      };
    case 'missing-central-contacts':
      return {
        ca: 'No hem pogut resoldre el segon i el tercer contacte des d’aquest punt. Sense saber exactament quan comença i quan s’acaba la totalitat, no es pot autoritzar treure cap filtre.',
        es: 'No hemos podido resolver el segundo y el tercer contacto desde este punto. Sin saber exactamente cuándo empieza y cuándo acaba la totalidad, no se puede autorizar quitar ningún filtro.',
      };
    default:
      return {
        ca: 'Des d’aquest punt el filtre no es treu en cap moment.',
        es: 'Desde este punto el filtro no se quita en ningún momento.',
      };
  }
}

/**
 * Guió d'un punt sense fase central autoritzada.
 *
 * Es penja del màxim quan no hi ha C2 ni C3, que és el cas de la parcial. Quan
 * n'hi ha —una totalitat tapada pel terreny, o massa curta— es penja igualment
 * del màxim: així el guió és un de sol i no hi ha cap camí de codi que pugui
 * col·locar una fita entre C2 i C3 en un punt on no s’hi pot mirar.
 */
function filteredBeats(
  gate: FilterGate,
  max: EclipseSample,
  atmosphere: Atmosphere,
  shadow: ShadowMotion | null,
): BeatDraft[] {
  const obscuration = max.obscuration;
  const pct = formatObscurationPct(obscuration);
  const deep = obscuration >= 0.98;

  // Quanta llum hi haurà de veritat al màxim, segons el model del projecte.
  //
  // Es fa servir la taula obscuració → flux i no la geometria exacta dels dos
  // discos a propòsit: la frase parla del percentatge tapat, i treure el flux
  // d'aquest mateix número és l'única manera que la xifra de lux i la
  // d'obscuració no puguin contradir-se dins d'una mateixa oració. El punt
  // dèbil conegut de la taula és l'anular profund, i aquí no n'hi arriba cap
  // amb fase central: l'anular té guió propi.
  const sunAlt = max.sun.altitudeApparent;
  const light = eclipseIlluminance(luminousFractionFromObscuration(obscuration), sunAlt, { atmosphere });
  const lux = formatLux(light.totalLux);
  const comparison = twilightComparison(light.totalLux, atmosphere);
  const factor = formatFactor(light.clearSkyLux / light.totalLux);

  const drafts: BeatDraft[] = [
    {
      id: 'why-filtered',
      anchor: 'max',
      offsetSec: -600,
      windowSec: 60,
      filterState: 'filtered',
      look: 'sun',
      severity: 'safety',
      essential: true,
      validForMs: 30 * SEC,
      title: { ca: 'Aquí el filtre no es treu', es: 'Aquí el filtro no se quita' },
      text: gateReasonText(gate),
      speech: {
        ca: 'Des d’aquest punt el filtre no es treu en cap moment.',
        es: 'Desde este punto el filtro no se quita en ningún momento.',
      },
    },
    {
      id: 'crescents',
      anchor: 'max',
      offsetSec: -300,
      windowSec: 240,
      filterState: 'away-from-sun',
      look: 'ground',
      title: { ca: 'Mitges llunes a terra', es: 'Medias lunas en el suelo' },
      text: {
        ca: 'Sota un arbre, cada espai entre fulles fa de forat estenopeic i el terra s’omple de solets mossegats. Un escumador de cuina en fa desenes alhora. És segur i és la millor manera d’ensenyar-ho a qui no tingui ulleres.',
        es: 'Bajo un árbol, cada hueco entre hojas hace de agujero estenopeico y el suelo se llena de solecitos mordidos. Un escurridor de cocina hace decenas a la vez. Es seguro y es la mejor manera de enseñárselo a quien no tenga gafas.',
      },
      speech: { ca: 'Mira a terra sota un arbre. Solets mossegats.', es: 'Mira al suelo bajo un árbol. Solecitos mordidos.' },
    },
    {
      id: 'deep-partial-light',
      anchor: 'max',
      offsetSec: -60,
      windowSec: 60,
      filterState: 'away-from-sun',
      look: 'around',
      title: { ca: 'La llum, al minut previ', es: 'La luz, en el minuto previo' },
      // XIFRES DEL MODEL, NO ESCRITES A MÀ. Aquí hi deia «la il·luminació ronda
      // els mil lux: encara inequívocament de dia, amb ombres i llum per
      // llegir». Amb el 99,84 % de Barcelona i el Sol a 4°, el model del
      // projecte en dona menys de quatre: tres ordres de magnitud de diferència
      // i una conclusió del revés. Els mil lux són la xifra de l'AAS per al
      // 99 % amb el Sol alt, i copiar-la aquí era aplicar-la a un eclipsi amb
      // el Sol arran d'horitzó, on el cel serè de partida ja només fa uns
      // quants milers de lux.
      //
      // I el text ha canviat de missatge, no només de número: la parcial
      // profunda espanyola SÍ que es farà fosca, i dir el contrari feia perdre
      // credibilitat justament a la frase que ha d'aguantar-ho tot. El que la
      // separa de la totalitat no és la foscor, és que queda fotosfera encesa.
      text: deep
        ? {
            ca: `Amb el ${pct} % del Sol tapat i el Sol a ${Math.round(sunAlt)}°, el model de llum d’aquesta app dona uns ${lux} lux: com ${comparison.ca}, unes ${factor} vegades menys llum que sense eclipsi. Es farà fosc de debò, i aquí hi ha el parany: s’assemblarà prou a una totalitat perquè algú es tregui el filtre. No ho és. Queda una escletxa de fotosfera encesa fins a l’últim segon, i n’hi ha prou per cremar la retina i per esborrar la corona, que és el que de veritat et perds.`,
            es: `Con el ${pct} % del Sol tapado y el Sol a ${Math.round(sunAlt)}°, el modelo de luz de esta app da unos ${lux} lux: como ${comparison.es}, unas ${factor} veces menos luz que sin eclipse. Va a oscurecer de verdad, y ahí está la trampa: se parecerá lo bastante a una totalidad como para que alguien se quite el filtro. No lo es. Queda una rendija de fotosfera encendida hasta el último segundo, y basta para quemar la retina y para borrar la corona, que es lo que de verdad te pierdes.`,
          }
        : {
            // El «la majoria de gent no nota res» d'abans era una afirmació
            // absoluta damunt d'una branca que va del 0 % al 98 % tapat: al
            // 50 % és certa i al 95 %, amb la llum dividida per trenta, no.
            // Ara la frase parla de la COMPRESSIÓ de l'ull, que és el que és
            // cert a tot el rang, i el número el posa el model.
            ca: `Amb el ${pct} % del Sol tapat el model dona uns ${lux} lux, unes ${factor} vegades menys llum que sense eclipsi. En notaràs molt menys del que fa pensar la xifra: l’ull respon de manera logarítmica i les pupil·les s’han anat dilatant durant l’hora de fase parcial. El que sí que es nota és la qualitat de la llum i la nitidesa de les ombres.`,
            es: `Con el ${pct} % del Sol tapado el modelo da unos ${lux} lux, unas ${factor} veces menos luz que sin eclipse. Notarás mucho menos de lo que hace pensar la cifra: el ojo responde de forma logarítmica y las pupilas se han ido dilatando durante la hora de fase parcial. Lo que sí se nota es la calidad de la luz y la nitidez de las sombras.`,
          },
      speech: {
        ca: 'Mira la qualitat de la llum i les ombres, no el Sol.',
        es: 'Mira la calidad de la luz y las sombras, no el Sol.',
      },
    },
    {
      id: 'max-filtered',
      anchor: 'max',
      offsetSec: 0,
      windowSec: 10,
      filterState: 'filtered',
      look: 'sun',
      essential: true,
      title: { ca: `Màxim · ${pct} %`, es: `Máximo · ${pct} %` },
      text: {
        ca: `Màxim de l’eclipsi des d’aquest punt: ${pct} % del disc solar tapat. Amb el filtre posat, la forma del Sol és la més estreta de tot l’esdeveniment.`,
        es: `Máximo del eclipse desde este punto: ${pct} % del disco solar tapado. Con el filtro puesto, la forma del Sol es la más estrecha de todo el evento.`,
      },
      speech: { ca: 'Màxim de l’eclipsi. No et treguis el filtre.', es: 'Máximo del eclipse. No te quites el filtro.' },
    },
    {
      id: 'temperature',
      anchor: 'max',
      offsetSec: 60,
      windowSec: 60,
      filterState: 'away-from-sun',
      look: 'around',
      title: { ca: 'Fred i silenci', es: 'Frío y silencio' },
      text: {
        ca: 'La temperatura baixa i els ocells s’aquieten. Amb obscuracions altes es nota clarament, encara que la llum sembli normal. Escolta tant com mires.',
        es: 'La temperatura baja y los pájaros se aquietan. Con oscuraciones altas se nota claramente, aunque la luz parezca normal. Escucha tanto como miras.',
      },
      speech: { ca: 'Escolta. Baixa la temperatura.', es: 'Escucha. Baja la temperatura.' },
    },
  ];

  if (deep && shadow) {
    const cardinalCa = bearingToCardinal(shadow.arrivalBearing, 'ca');
    const cardinalEs = bearingToCardinal(shadow.arrivalBearing, 'es');
    drafts.push({
      id: 'shadow-wall',
      anchor: 'max',
      offsetSec: -20,
      windowSec: 40,
      filterState: 'away-from-sun',
      look: 'horizon',
      title: { ca: 'L’ombra, de lluny', es: 'La sombra, de lejos' },
      text: {
        ca: `L’ombra de la Lluna passa a prop però no per aquí. Mira cap ${towardsCa(cardinalCa)}: l’horitzó s’enfosqueix com una tempesta que no arriba. És el més a prop que estaràs de la totalitat des d’aquest punt.`,
        es: `La sombra de la Luna pasa cerca pero no por aquí. Mira hacia el ${cardinalEs}: el horizonte se oscurece como una tormenta que no llega. Es lo más cerca que estarás de la totalidad desde este punto.`,
      },
      speech: { ca: `Mira cap ${towardsCa(cardinalCa)}. L’ombra passa de llarg.`, es: `Mira hacia el ${cardinalEs}. La sombra pasa de largo.` },
    });
  }

  return drafts;
}

/* --------------------------------------------------------------- incerteses */

function buildCaveats(
  circumstances: LocalCircumstances,
  variant: ScriptVariant,
  shadow: ShadowMotion | null,
): ScriptCaveat[] {
  const out: ScriptCaveat[] = [];

  if (circumstances.edgeUncertain) {
    const arcsec = Math.abs(circumstances.umbralMarginArcsec).toFixed(2);
    out.push({
      id: 'edge-uncertain',
      text: {
        ca: `Ets a la vora de la franja: el marge que et separa del límit és de ${arcsec}″ i l’error de posició relativa Sol-Lluna de les efemèrides és d’uns 1,5″. No podem dir honestament si hi haurà fase central des d’aquí. Mou-te cap endins.`,
        es: `Estás en el borde de la franja: el margen que te separa del límite es de ${arcsec}″ y el error de posición relativa Sol-Luna de las efemérides es de unos 1,5″. No podemos decir honestamente si habrá fase central desde aquí. Muévete hacia dentro.`,
      },
    });
  }

  if (variant === 'totality' || variant === 'annular') {
    out.push({
      id: 'contact-precision',
      // EL NÚMERO SURT DE LA CONSTANT, NO D'UNA LLETRA ESCRITA AQUÍ. Aquesta
      // frase deia «dos segons» i s'hi va quedar quan el retard va passar a
      // dotze: un avís d'incertesa que menteix sobre la seva pròpia incertesa
      // és pitjor que no dir-ne res. Interpolant-la, no pot tornar a passar.
      //
      // I ara diu d'on ve el retard de debò. El relleu del limbe hi és, però és
      // el terme petit; el gros és que el nostre C2 s'avança respecte de les
      // taules de l'IGN, i el signe és el dolent.
      text: {
        ca: `Els instants de contacte es calculen amb radis mitjans del Sol i de la Lluna: el relleu real del limbe lunar arriba a uns ±2 km i els mou un parell de segons. A més, comparat amb les taules de l’IGN el nostre segon contacte s’avança uns quants segons, fins a nou en el pitjor cas mesurat, i s’avança sempre cap al mateix costat. Per això l’avís de treure’s el filtre no arriba fins a ${FILTER_OFF_DELAY_SEC} segons després del C2 calculat, i encara així es dona condicionat a haver-se fet fosc i veure la corona: si queda un punt de llum, s’espera. El filtre torna a lloc quinze segons abans del C3.`,
        es: `Los instantes de contacto se calculan con radios medios del Sol y de la Luna: el relieve real del limbo lunar llega a unos ±2 km y los mueve un par de segundos. Además, comparado con las tablas del IGN nuestro segundo contacto se adelanta unos segundos, hasta nueve en el peor caso medido, y se adelanta siempre hacia el mismo lado. Por eso el aviso de quitarse el filtro no llega hasta ${FILTER_OFF_DELAY_SEC} segundos después del C2 calculado, y aun así se da condicionado a que haya oscurecido y se vea la corona: si queda un punto de luz, se espera. El filtro vuelve a su sitio quince segundos antes del C3.`,
      },
    });
  }

  if (variant === 'totality') {
    out.push({
      id: 'shadow-bands',
      text: {
        ca: 'Les bandes d’ombra són turbulència atmosfèrica, no geometria: no es poden predir i hi ha eclipsis en què no surten.',
        es: 'Las bandas de sombra son turbulencia atmosférica, no geometría: no se pueden predecir y hay eclipses en los que no salen.',
      },
    });
  }

  if (shadow?.lowSunCaveat) {
    out.push({
      id: 'low-sun-shadow',
      text: {
        ca: `El Sol és a ${Math.round(shadow.sunAltitudeDeg)}° sobre l’horitzó. L’ombra arriba tan rasant que la paret de foscor és difusa i es confon amb el capvespre. Es veurà, però no com a les fotografies dels eclipsis amb el Sol alt.`,
        es: `El Sol está a ${Math.round(shadow.sunAltitudeDeg)}° sobre el horizonte. La sombra llega tan rasante que la pared de oscuridad es difusa y se confunde con el atardecer. Se verá, pero no como en las fotografías de los eclipses con el Sol alto.`,
      },
    });
  }

  if (shadow?.speedDiverging) {
    out.push({
      id: 'shadow-speed',
      text: {
        ca: 'Amb el Sol tan baix, la velocitat de l’ombra sobre el terra es dispara i deixa de ser una xifra útil. Per això aquí no en donem cap número.',
        es: 'Con el Sol tan bajo, la velocidad de la sombra sobre el terreno se dispara y deja de ser una cifra útil. Por eso aquí no damos ningún número.',
      },
    });
  }

  return out;
}

/* ------------------------------------------------------------ construcció */

/** Cert si l'eclipsi és al catàleg i, per tant, en podem calcular la trajectòria. */
function knownEclipse(id: string): boolean {
  return ECLIPSES.some((e) => e.id === id);
}

/**
 * Construeix el guió per a un punt.
 *
 * L'ORDRE DE LES OPERACIONS NO ÉS CASUAL. Primer es consulta la porta de
 * seguretat; el seu resultat tria la variant, i només la variant `totality`
 * arriba a la funció que conté la fita d'autorització. No hi ha cap camí que
 * produeixi una fita `naked-eye` sense passar per `canRemoveFilter`.
 */
export function buildTotalityScript(input: TotalityScriptInput): TotalityScript {
  const { circumstances } = input;
  const contacts = contactsMs(circumstances);
  const gate = canRemoveFilter({
    kind: circumstances.kind,
    contacts,
    centralPhaseVisible: input.centralPhaseVisible,
    // EL CAIRE DE LA FRANJA ARRIBA FINS AQUÍ. Sense passar-l'hi, la comporta
    // `edge-uncertain` de `core/timer/safety.ts` era lletra morta per al guió i
    // el resultat era una contradicció dins d'un mateix document: les fites
    // deien «ara pots treure't el filtre» i, tres línies més avall,
    // `buildCaveats` deia «no podem dir honestament si hi haurà fase central
    // des d'aquí». Quan el motor no ho sap, el guió tampoc no ho sap.
    edgeUncertain: circumstances.edgeUncertain,
  });

  const hasCentral = contacts.c2 !== undefined && contacts.c3 !== undefined && contacts.c3 > contacts.c2;
  const canCompute = knownEclipse(circumstances.eclipseId);

  // L'ombra només es calcula si no ens l'han donada i si en podem: demanar la
  // trajectòria d'un eclipsi que no és al catàleg peta, i el guió ha de poder
  // construir-se amb contactes fabricats a mà per als tests.
  const shadow =
    input.shadow !== undefined
      ? input.shadow
      : hasCentral && canCompute
        ? computeShadowMotion(circumstances.eclipseId, circumstances)
        : null;

  const variant: ScriptVariant =
    circumstances.kind === 'none'
      ? 'none'
      : circumstances.kind === 'annular'
        ? 'annular'
        : gate.allowed
          ? 'totality'
          : 'filtered';

  // Els planetes només es calculen quan de veritat es veuran: amb el 90 % del
  // Sol a la vista el cel no arriba a crepuscle i llistar-los faria buscar el
  // que no hi és.
  const bodies =
    input.bodies !== undefined
      ? input.bodies
      : variant === 'totality'
        ? visibleBodiesDuringTotality(
            circumstances.contacts.max.time,
            circumstances.location,
            circumstances.atmosphere,
          )
        : [];

  const drafts = buildDrafts(variant, circumstances, contacts, gate, shadow, bodies);
  const beats = resolveDrafts(drafts, contacts, gate);

  return {
    eclipseId: circumstances.eclipseId,
    kind: circumstances.kind,
    variant,
    contacts,
    filterGate: gate,
    centralDurationSec: gate.centralDurationSec,
    beats,
    shadow,
    bodies,
    caveats: buildCaveats(circumstances, variant, shadow),
  };
}

function buildDrafts(
  variant: ScriptVariant,
  circumstances: LocalCircumstances,
  contacts: ContactTimesMs,
  gate: FilterGate,
  shadow: ShadowMotion | null,
  bodies: VisibleBody[],
): BeatDraft[] {
  if (variant === 'none') return [];

  if (variant === 'totality') {
    // Aquesta branca només s'arriba amb `gate.allowed`, i llavors la porta ja
    // ha garantit que C2 i C3 existeixen i que la durada és suficient.
    const c2 = contacts.c2;
    const c3 = contacts.c3;
    if (c2 === undefined || c3 === undefined) return [];
    const max = circumstances.contacts.max;
    return totalityBeats(
      (c3 - c2) / SEC,
      shadow,
      bodies,
      max.sun.azimuth,
      max.sun.altitudeApparent,
      circumstances.atmosphere,
    );
  }

  if (variant === 'annular') {
    const c2 = contacts.c2;
    const c3 = contacts.c3;
    if (c2 === undefined || c3 === undefined) {
      return filteredBeats(gate, circumstances.contacts.max, circumstances.atmosphere, shadow);
    }
    return annularBeats((c3 - c2) / SEC);
  }

  return filteredBeats(gate, circumstances.contacts.max, circumstances.atmosphere, shadow);
}

/**
 * Resol els esborranys en fites amb instant absolut, i en descarta les que no
 * hi caben.
 *
 * Tres filtres, en aquest ordre:
 *
 *  1. LA XARXA DE SEGURETAT. Cap fita `naked-eye` no sobreviu si la porta no ho
 *     ha autoritzat. Amb el codi actual això no hauria de descartar mai res
 *     —la variant `filtered` no en genera cap—, i és exactament per això que hi
 *     és: si algun dia algú afegeix una fita a la branca equivocada, morirà
 *     aquí en comptes d'arribar als ulls de ningú.
 *  2. La finestra sense filtre. Cap fita `naked-eye` fora de l'interval que va
 *     de l'autorització al primer avís de tornar-se a posar el filtre. La
 *     corona, que és la fita que justifica el guió, es retalla cap enrere en
 *     comptes de desaparèixer en una totalitat curta.
 *  3. La separació mínima. Les fites essencials es queden sempre; les altres
 *     només si no trepitgen res del que ja hi ha.
 */
function resolveDrafts(drafts: BeatDraft[], contacts: ContactTimesMs, gate: FilterGate): ScriptBeat[] {
  const anchorMs = (anchor: BeatAnchor): number | undefined =>
    anchor === 'c2' ? contacts.c2 : anchor === 'c3' ? contacts.c3 : contacts.max;

  const nakedEyeWindow = nakedEyeWindowMs(contacts, gate);

  const resolved: { beat: ScriptBeat; essential: boolean }[] = [];
  for (const draft of drafts) {
    if (draft.filterState === 'naked-eye' && !gate.allowed) continue;

    const base = anchorMs(draft.anchor);
    if (base === undefined) continue;

    let beat = resolveBeat(draft, base);

    if (draft.filterState === 'naked-eye') {
      if (!nakedEyeWindow) continue;
      const clamped = clampToNakedEyeWindow(beat, nakedEyeWindow, base);
      if (!clamped) continue;
      beat = clamped;
    }

    resolved.push({ beat, essential: draft.essential === true });
  }

  resolved.sort((a, b) => a.beat.atMs - b.beat.atMs);

  const kept: ScriptBeat[] = resolved.filter((r) => r.essential).map((r) => r.beat);
  for (const candidate of resolved) {
    if (candidate.essential) continue;
    const clashes = kept.some((k) => Math.abs(k.atMs - candidate.beat.atMs) < MIN_BEAT_GAP_MS);
    if (!clashes) kept.push(candidate.beat);
  }

  return kept.sort((a, b) => a.atMs - b.atMs);
}

/**
 * Interval en què es pot mirar sense filtre.
 *
 * Comença amb l'autorització (C2 + retard) i s'acaba un segon abans del primer
 * avís de tornar-se a posar el filtre. Res del guió no pot caure a fora.
 */
function nakedEyeWindowMs(contacts: ContactTimesMs, gate: FilterGate): { from: number; to: number } | null {
  if (!gate.allowed) return null;
  const { c2, c3 } = contacts;
  if (c2 === undefined || c3 === undefined) return null;
  const from = c2 + FILTER_OFF_DELAY_SEC * SEC;
  const to = c3 - FILTER_ON_SEC[0] * SEC - SEC;
  return to > from ? { from, to } : null;
}

/**
 * Retalla una fita sense filtre dins de la finestra segura.
 *
 * La corona és l'única que es retalla: en una totalitat curta no hi ha lloc per
 * a res més, i el que no pot passar és que la fita que justifica tot el guió
 * desaparegui. La resta, si no hi cap, es descarta.
 *
 * EL LÍMIT DE BAIX NO ÉS EL DE LA FINESTRA. El primer instant de la finestra és
 * el de l'avís que autoritza, i una fita retallada fins allà hi cauria al
 * damunt: és exactament el que passava quan la corona anava a C2 + 10 s i el
 * retard de seguretat va passar a dotze. La frase que autoritza és l'única de
 * l'app que no es pot perdre, o sigui que qualsevol altra cosa li deixa la
 * separació mínima.
 */
function clampToNakedEyeWindow(
  beat: ScriptBeat,
  window: { from: number; to: number },
  anchorMs: number,
): ScriptBeat | null {
  // L'avís que autoritza hi cau per definició, al primer instant. Qualsevol
  // altra fita ha de deixar-li la separació mínima per darrere.
  const from = beat.kind === 'filter-off' ? window.from : window.from + MIN_BEAT_GAP_MS;
  if (beat.atMs >= from && beat.atMs <= window.to) return beat;
  if (beat.id !== 'corona') return null;

  // El desplaçament es queda en segons sencers i l'instant es torna a derivar
  // d'ell, no al revés: així la fita segueix complint `atMs = àncora +
  // desplaçament` exactament, que és la propietat de la qual pengen la
  // interfície i els tests. L'arrodoniment va sempre cap a dins de la finestra.
  const offsetSec =
    beat.atMs < from
      ? Math.ceil((from - anchorMs) / SEC)
      : Math.floor((window.to - anchorMs) / SEC);
  const atMs = anchorMs + offsetSec * SEC;
  if (atMs < from || atMs > window.to) return null;
  return { ...beat, atMs, offsetSec };
}

/* ---------------------------------------------- enllaç amb el temporitzador */

/**
 * Converteix el guió en avisos per al reproductor de `core/timer/runner.ts`.
 *
 * Els identificadors van prefixats amb `script:` perquè el reproductor no els
 * pugui confondre amb els de la programació real.
 */
export function scriptToAlerts(script: TotalityScript): VoiceAlert[] {
  return script.beats.map(beatToAlert);
}

function beatToAlert(beat: ScriptBeat): VoiceAlert {
  return {
    id: `script:${beat.id}`,
    atMs: beat.atMs,
    anchor: beat.anchor,
    offsetSec: beat.offsetSec,
    kind: beat.kind,
    severity: beat.severity,
    validForMs: beat.validForMs,
    speech: beat.speech,
    label: beat.title,
  };
}

/**
 * Fusiona el guió amb la programació d'avisos del dia.
 *
 * QUI MANA. La programació de `core/timer/schedule.ts` és l'amo dels avisos de
 * filtre: les seves finestres de validesa estan calculades per no dir mai res
 * tard en el moment perillós. Del guió només s'hi afegeixen les fites de
 * contingut, i encara:
 *
 *  - cap si la porta de la programació no autoritza a treure el filtre i la
 *    fita és `naked-eye` (defensa en profunditat: el guió ja no n'hauria de
 *    tenir cap, però aquí es torna a comprovar contra la porta de la
 *    programació, que és la que mana el dia mateix);
 *  - cap que caigui massa a prop d'un avís existent, i molt especialment d'un
 *    avís de seguretat, que no ha d'esperar mai que acabi de parlar-se res.
 */
export function mergeScriptIntoSchedule(schedule: AlertSchedule, script: TotalityScript): AlertSchedule {
  const allowed = schedule.filterGate.allowed;

  const cues: VoiceAlert[] = [];
  for (const beat of script.beats) {
    if (beat.kind !== 'script-cue') continue;
    if (beat.filterState === 'naked-eye' && !allowed) continue;

    const tooClose = schedule.alerts.some((existing) => {
      const gap = existing.severity === 'safety' ? MERGE_SAFETY_GAP_MS : MERGE_INFO_GAP_MS;
      return Math.abs(existing.atMs - beat.atMs) < gap;
    });
    if (tooClose) continue;

    cues.push(beatToAlert(beat));
  }

  const alerts = [...schedule.alerts, ...cues].sort(
    (a, b) => a.atMs - b.atMs || (a.severity === 'safety' ? 0 : 1) - (b.severity === 'safety' ? 0 : 1),
  );

  return { alerts, filterGate: schedule.filterGate, rehearsal: schedule.rehearsal };
}

/**
 * Mode d'assaig: tota la seqüència del guió sentida en un minut.
 *
 * PER QUÈ NOMÉS EL GUIÓ I NO LA PROGRAMACIÓ SENCERA. L'assaig de
 * `core/timer/rehearsal.ts` comprimeix les tres hores d'eclipsi, des del compte
 * enrere de C1. Aquest comprimeix el minut i mig que importa. Són dues coses
 * diferents i totes dues útils: la primera ensenya quants avisos sentiràs, la
 * segona ensenya la seqüència de la totalitat.
 *
 * La compressió, la separació mínima i el retall de les finestres de validesa
 * els fa `buildRehearsalSchedule`: aquí no se’n reimplementa cap, i així
 * l'assaig hereta la porta de seguretat sencera. Si el punt és fora de la
 * franja, el guió no té cap fita d'autorització i l'assaig tampoc no en pot
 * inventar cap.
 */
export function buildScriptRehearsal(script: TotalityScript, options: RehearsalOptions): AlertSchedule {
  const base: AlertSchedule = {
    alerts: scriptToAlerts(script),
    filterGate: script.filterGate,
    rehearsal: false,
  };
  return buildRehearsalSchedule(base, options);
}
