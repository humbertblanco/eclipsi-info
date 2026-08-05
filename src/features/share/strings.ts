/**
 * Textos de la miniatura i de la targeta compartible, en català i castellà.
 *
 * PER QUÈ AQUÍ I NO A `src/i18n/*.json`: aquesta feina només toca
 * `features/share/**` i `features/location/PlaceThumbnail.tsx`, i la taula
 * `{ ca, es }` dins del mòdul és el patró que ja segueixen `offline/strings.ts`
 * i `features/location/strings.ts`. Si algun dia es consolida l'i18n, aquestes
 * claus s'aboquen tal qual als JSON.
 *
 * TO: frases curtes, declaratives, tractament de tu, cap emoji i cap
 * admiració. I la regla pròpia d'aquesta capa, que és la que va costar més
 * d'escriure: **no es diu mai res que la imatge no ensenyi**. La miniatura d'un
 * punt sense perfil de terreny calculat no es pot dir «horitzó»: es diu que el
 * terreny encara no s'ha calculat, perquè la línia plana que s'hi veu no és una
 * mesura sinó una reserva. Vegeu ESTAT.md §3.5.
 */

import type { Locale } from '../../i18n';

type Entry = { ca: string; es: string; en: string };

const STRINGS = {
  /* --- la miniatura -------------------------------------------------------
   * Són textos alternatius: no es veuen, els llegeix el lector de pantalla i
   * per això han de dir QUÈ hi ha dibuixat, no com de bonic és.             */
  'thumb.alt': {
    ca: 'Silueta de l’horitzó d’aquest punt amb el camí del Sol durant l’eclipsi',
    es: 'Silueta del horizonte de este punto con el camino del Sol durante el eclipse',
    en: 'Horizon silhouette at this point with the Sun’s path during the eclipse',
  },
  'thumb.altAssumed': {
    ca: 'El terreny d’aquest punt encara no s’ha calculat: la silueta que es veu és un horitzó pla de reserva',
    es: 'El terreno de este punto todavía no se ha calculado: la silueta que se ve es un horizonte plano de reserva',
    en: 'The terrain at this point has not been calculated yet: the visible silhouette is a fallback flat horizon',
  },
  /** Etiqueta curta, per si la interfície la vol escriure al costat. */
  'thumb.pending': { ca: 'Terreny per calcular', es: 'Terreno por calcular', en: 'Terrain not yet calculated' },

  /* --- la targeta ---------------------------------------------------------
   * «Fase central» i no «totalitat» perquè la mateixa targeta ha de servir per
   * a l'anular del 2028, on el que passa és una anularitat. La paraula
   * «totalitat» aplicada a un anular és la mena d'error que fa que algú es
   * tregui el filtre.                                                        */
  'card.max': { ca: 'Màxim', es: 'Máximo', en: 'Maximum' },
  'card.central': { ca: 'Fase central visible', es: 'Fase central visible', en: 'Central phase visible' },
  'card.centralTheoretical': {
    ca: 'Fase central (sense terreny)',
    es: 'Fase central (sin terreno)',
    en: 'Central phase (without terrain)',
  },
  'card.obscured': { ca: 'Disc tapat', es: 'Disco tapado', en: 'Solar disc obscured' },
  'card.noCentral': { ca: 'No hi ha fase central', es: 'No hay fase central', en: 'No central phase' },

  /* El relleu que et roba segons: la xifra que justifica tota l'app. */
  'card.stolen': {
    ca: 'El relleu se’n menja {lost} de {total}',
    es: 'El relieve se come {lost} de {total}',
    en: 'Terrain blocks {lost} of {total}',
  },
  /* Curt a posta: comparteix la línia del peu amb l'adreça impresa del punt,
     i una frase llarga acabaria retallada amb punts suspensius justament on
     diu la part que importa. «Per calcular» és el vocabulari de
     `thumb.pending`, no una fórmula nova. */
  'card.terrainAssumed': {
    ca: 'El terreny està per calcular: les xifres no descompten cap muntanya.',
    es: 'El terreno está por calcular: las cifras no descuentan montañas.',
    en: 'Terrain has not been calculated: the figures do not account for any mountains.',
  },

  /* El domini que encapçala el peu. El peu sencer és l'adreça del punt
     («eclipsi.info/?p=…»), muntada a `cardText` amb `buildShareLink`: una
     imatge que viatja per missatgeria i sobreviu sola a qualsevol conversa
     ha de dur escrit el camí de tornada, no només d'on surt. */
  'card.footer': { ca: 'eclipsi.info', es: 'eclipsi.info', en: 'eclipsi.info' },

  /* --- compartir ---------------------------------------------------------- */
  'share.title': { ca: 'El meu punt per a l’eclipsi', es: 'Mi punto para el eclipse', en: 'My eclipse viewing point' },
  'share.fileName': { ca: 'eclipsi', es: 'eclipsi', en: 'eclipse' },

  /* --- el botó -------------------------------------------------------------
   *
   * «Comparteix el punt» i no «Comparteix»: el que viatja és un lloc concret
   * amb les seves coordenades, i qui el rep obrirà l'app situada allà. Dir-ho
   * evita que ningú l'enviï pensant que comparteix l'aplicació.                */
  'button.share': { ca: 'Comparteix el punt', es: 'Comparte el punto', en: 'Share this point' },
  'button.preparing': { ca: 'Preparant la imatge…', es: 'Preparando la imagen…', en: 'Preparing image…' },
  /*
   * El feedback del porta-retalls diu la veritat de què hi ha quedat, i per
   * això són tres frases i no una: si el porta-retalls porta l'adreça I la
   * targeta, es diu; si només ha entrat l'adreça, no es promet cap imatge; i
   * si tot ha fallat i la targeta s'ha descarregat com a fitxer, es diu això
   * i no cap «copiat» que no ha passat.
   */
  'button.copiedBoth': {
    ca: 'Enllaç i simulació copiats',
    es: 'Enlace y simulación copiados',
    en: 'Link and simulation copied',
  },
  'button.copied': { ca: 'Enllaç copiat', es: 'Enlace copiado', en: 'Link copied' },
  'button.downloaded': { ca: 'Targeta descarregada', es: 'Tarjeta descargada', en: 'Card downloaded' },
  'button.failed': {
    ca: 'No s’ha pogut compartir. L’adreça de la barra ja porta el punt: copia-la.',
    es: 'No se ha podido compartir. La dirección de la barra ya lleva el punto: cópiala.',
    en: 'Could not share. The address bar already contains this point: copy it from there.',
  },
  /*
   * Quan encara no hi ha lloc triat, el botó no desapareix: es queda adormit
   * amb aquesta frase al costat. Diu què falta i no pas què s'ha espatllat,
   * perquè no s'ha espatllat res: només falta el lloc.
   */
  'button.unavailable': {
    ca: 'Tria un lloc per poder compartir-lo',
    es: 'Elige un lugar para poder compartirlo',
    en: 'Choose a location before sharing it',
  },
  /*
   * El text que acompanya l'enllaç. Porta el nom del lloc perquè, a una
   * conversa de grup, un enllaç sol no diu on has quedat amb ningú.
   */
  'share.text': {
    ca: 'Aquí és on penso veure l’eclipsi: {place}. {detail} Mira com es veurà des del teu punt amb l’app de l’eclipsi.',
    es: 'Aquí es donde pienso ver el eclipse: {place}. {detail} Mira cómo se verá desde tu punto con la app del eclipse.',
    en: 'This is where I plan to watch the eclipse: {place}. {detail} See what it will look like from your location with the eclipse app.',
  },
  'share.detailCentral': {
    ca: '{duration} de fase central visible; màxim a les {time}.',
    es: '{duration} de fase central visible; máximo a las {time}.',
    en: '{duration} of visible central phase; maximum at {time}.',
  },
  'share.detailPartial': {
    ca: 'Aquí serà parcial; màxim a les {time}.',
    es: 'Aquí será parcial; máximo a las {time}.',
    en: 'The eclipse will be partial here; maximum at {time}.',
  },
} as const satisfies Record<string, Entry>;

export type ShareStringKey = keyof typeof STRINGS;

/**
 * Un text, amb interpolació de `{clau}`.
 *
 * Mateixa forma que `ls()` i `s()`: qui llegeixi dues d'aquestes capes seguides
 * no ha de canviar de gramàtica pel camí.
 */
export function sh(
  key: ShareStringKey,
  locale: Locale,
  vars?: Record<string, string>,
): string {
  const text = STRINGS[key][locale];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match);
}
