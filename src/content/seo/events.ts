/**
 * L'INTERVAL QUE PUBLIQUEM COM A `startDate` I `endDate` DE L'`Event`.
 *
 * ── L'ERROR QUE ARREGLA ─────────────────────────────────────────────────────
 *
 * Aquestes sis dates estaven escrites a mà, i cap de les tres parelles seguia
 * la mateixa convenció. Mesurat el 8 d'agost de 2026 contra
 * `computeLocalCircumstances()` sobre els 290 punts i ciutats que les nostres
 * pàgines publiquen de l'eclipsi del 2026, i els 16 de cadascun dels altres:
 *
 *     eclipsi      declarat a mà              el que dona el motor
 *     2026-08-12   17:34 → 19:38 UTC          17:30:46 → 19:24:50
 *     2027-08-02   07:30 → 12:04 UTC          07:45:30 → 10:13:17
 *     2028-01-26   13:10 → 17:00 UTC          15:32:13 → 18:06:20
 *
 * O sigui: la finestra del 2027 s'acabava 111 minuts DESPRÉS que l'últim
 * contacte que la mateixa pàgina imprimeix, i la del 2028 començava 142 minuts
 * ABANS que el primer. La pàgina de l'eclipsi del 2028 deia a Google que
 * l'esdeveniment començava a les 13:10 mentre la seva pròpia taula de ciutats
 * no en donava cap contacte fins a les 15:32.
 *
 * Ningú no ho havia vist perquè l'única prova que hi havia (`seo.test.ts`)
 * comprovava que la finestra CONTINGUÉS el màxim global. Amb un interval de
 * quatre hores desplaçat dues, això segueix sent cert.
 *
 * ── QUÈ ÉS AQUEST INTERVAL, DIT AMB PRECISIÓ ────────────────────────────────
 *
 * NO és l'eclipsi vist des de la Terra: aquell dura hores i comença damunt d'un
 * oceà on no tenim cap pàgina. És **l'eclipsi al territori que aquestes pàgines
 * cobreixen**: del primer contacte C1 al darrer C4 entre les ciutats i els
 * punts oficials que publiquem, que és exactament el que el lector pot
 * comprovar a la taula de la mateixa pàgina.
 *
 * Dir-ho així fa que el JSON-LD i el que es veu no es puguin contradir mai més,
 * perquè surten dels mateixos contactes. `events.test.ts` ho torna a comprovar.
 *
 * ── PER QUÈ ES CALCULA I NO S'ESCRIU ────────────────────────────────────────
 *
 * Perquè si s'escriu, es podreix. El catàleg de punts oficials creix cada
 * setmana —274 el 2026, i cada tanda nova pot eixamplar l'interval per
 * qualsevol dels dos extrems—, i cap constant escrita a mà es tornaria a
 * repassar. El càlcul es fa un sol cop per eclipsi, la primera vegada que algú
 * demana la seva finestra, i es desa.
 */

import type { Locale } from '../../i18n';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import { pointsForEclipse } from '../../data/observation-points/catalog';
import { SEO_CITIES } from './cities';

export interface SeoEventWindow {
  /** Primer contacte C1 entre tots els llocs que publiquem, en ISO amb Z. */
  start: string;
  /** Darrer contacte C4 entre tots els llocs que publiquem. */
  end: string;
  area: Readonly<Record<Locale, string>>;
}

/**
 * On passa, dit sense presumir.
 *
 * L'`area` és editorial i es queda escrita: és una frase per a humans i no una
 * xifra. Ara bé, ha de descriure el que les pàgines cobreixen i no el que
 * l'eclipsi fa al món — dir «nord d'Espanya» d'una franja que dona 96 s a
 * Palma i 62 s a València seria la mateixa mena de mentida que arreglàvem als
 * títols.
 */
const AREA: Readonly<Record<string, Readonly<Record<Locale, string>>>> = {
  '2026-08-12': {
    ca: 'Franja de totalitat: de Galícia i Astúries al País Valencià i les Balears',
    es: 'Franja de totalidad: de Galicia y Asturias a la Comunitat Valenciana y Baleares',
    en: 'Path of totality: from Galicia and Asturias to Valencia and the Balearic Islands',
    fr: 'Bande de totalité : de la Galice et des Asturies à Valence et aux Baléares',
  },
  '2027-08-02': {
    ca: 'Sud de la península Ibèrica i nord d’Àfrica',
    es: 'Sur de la península ibérica y norte de África',
    en: 'Southern Iberian Peninsula and North Africa',
    fr: 'Sud de la péninsule Ibérique et Afrique du Nord',
  },
  '2028-01-26': {
    ca: 'Península Ibèrica',
    es: 'Península ibérica',
    en: 'Iberian Peninsula',
    fr: 'Péninsule Ibérique',
  },
};

/**
 * Els contactes extrems entre tot el que aquestes pàgines publiquen.
 *
 * Els punts sense eclipsi es descarten: un lloc des d'on els discos no arriben a
 * tocar-se no pot obrir ni tancar l'esdeveniment. I es demanen C1 i C4 —no el
 * màxim— perquè el que es publica és quan comença i quan s'acaba.
 */
function computeWindow(eclipseId: string): { start: string; end: string } {
  const places = [
    ...SEO_CITIES.map((city) => ({ lat: city.lat, lon: city.lon, elevation: 0 })),
    ...pointsForEclipse(eclipseId).map((point) => ({
      lat: point.lat,
      lon: point.lon,
      elevation: point.elevationM ?? 0,
    })),
  ];

  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const place of places) {
    const circumstances = computeLocalCircumstances(eclipseId, place);
    if (circumstances.kind === 'none') continue;
    if (circumstances.contacts.c1) first = Math.min(first, circumstances.contacts.c1.time.getTime());
    if (circumstances.contacts.c4) last = Math.max(last, circumstances.contacts.c4.time.getTime());
  }

  // Si això passés, el catàleg no tindria cap lloc amb eclipsi i el que toca és
  // aturar-se: publicar un interval inventat és el defecte que arreglem aquí.
  if (!Number.isFinite(first) || !Number.isFinite(last)) {
    throw new Error(`Cap lloc publicat veu l’eclipsi ${eclipseId}: no se’n pot dir cap interval.`);
  }
  return { start: new Date(first).toISOString(), end: new Date(last).toISOString() };
}

const CACHE = new Map<string, SeoEventWindow>();

/**
 * Es conserva el nom i la forma d'abans —un `Record` que s'indexa per
 * identificador— perquè el generador ja el fa servir així i no calia tocar-lo.
 * L'única diferència és que ara els dos extrems els dona el motor, i que es
 * calculen la primera vegada que algú els demana i no en importar el mòdul: la
 * prova de rutes no ha de pagar 290 càlculs d'eclipsi per llegir un topònim.
 */
export const SEO_EVENT_WINDOWS: Readonly<Record<string, SeoEventWindow>> = new Proxy(
  {} as Record<string, SeoEventWindow>,
  {
    get(_target, key: string): SeoEventWindow | undefined {
      if (AREA[key] === undefined) return undefined;
      const cached = CACHE.get(key);
      if (cached) return cached;
      const window = { ...computeWindow(key), area: AREA[key] };
      CACHE.set(key, window);
      return window;
    },
    has(_target, key: string) {
      return AREA[key] !== undefined;
    },
    ownKeys() {
      return Object.keys(AREA);
    },
    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true };
    },
  },
);
