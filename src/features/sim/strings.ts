/**
 * Textos del càlcul de l'horitzó, en català i castellà.
 *
 * PER QUÈ EXISTEIX: el progrés («Baixant el relleu…», «Traçant l'horitzó…»)
 * naixia com a frase en català dins de `core/horizon/raycast.ts` i pujava
 * fins a la pantalla tal qual: l'usuari amb l'app en castellà veia el càlcul
 * parlar-li en català. Ara el nucli emet CODIS (`HorizonProgressStatus`) i
 * les paraules es posen aquí, que és territori de pantalla i sap l'idioma.
 *
 * PER QUÈ NO VAN A `src/i18n/*.json`: mateix motiu que
 * `features/weather/strings.ts`, que és el model d'aquest fitxer — les taules
 * `{ ca, es }` dins del mòdul són el patró de tota l'app, i el dia que
 * l'i18n es consolidi s'aboquen als JSON tal com estan.
 *
 * TO: pla, curt, de tu. Els parèntesis amb xifres van en mono a la pantalla
 * i no es tradueixen: són la dada.
 */

import type { Locale } from '../../i18n';
import type { HorizonProgressCode } from './useHorizon';

type Entry = { ca: string; es: string };

const STRINGS = {
  /* Un codi d'estat per clau: `progress.<stage>`. */
  'progress.tiles': {
    ca: 'Baixant el relleu ({done} de {total} tessel·les)',
    es: 'Descargando el relieve ({done} de {total} teselas)',
  },
  'progress.trace': {
    ca: 'Traçant l’horitzó ({pct} %)',
    es: 'Trazando el horizonte ({pct} %)',
  },
  'progress.done': { ca: 'Horitzó llest', es: 'Horizonte listo' },
  'progress.cache': {
    ca: 'Horitzó recuperat de la memòria',
    es: 'Horizonte recuperado de la memoria',
  },
  'progress.preparing': {
    ca: 'Preparant el càlcul de l’horitzó…',
    es: 'Preparando el cálculo del horizonte…',
  },
} as const satisfies Record<string, Entry>;

export type SimStringKey = keyof typeof STRINGS;

/**
 * Text d'una clau en l'idioma actiu. Mateixa signatura i mateixos marcadors
 * `{nom}` que `ws()` de `features/weather/strings.ts` i `ls()` de
 * `features/location/strings.ts`, perquè el dia que l'i18n es consolidi la
 * substitució sigui mecànica.
 */
export function hs(
  key: SimStringKey,
  locale: Locale,
  vars?: Readonly<Record<string, string | number>>,
): string {
  const text: string = STRINGS[key][locale];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Del codi de progrés a la frase, en un sol lloc.
 *
 * El `switch` és exhaustiu a posta: si algun dia el nucli o el hook
 * inventen un estat nou, TypeScript farà petar aquesta funció en compilar
 * en comptes de deixar que la pantalla ensenyi un forat.
 */
export function horizonProgressText(code: HorizonProgressCode, locale: Locale): string {
  switch (code.stage) {
    case 'tiles':
      return hs('progress.tiles', locale, { done: code.done ?? 0, total: code.total ?? 0 });
    case 'trace':
      return hs('progress.trace', locale, { pct: code.pct ?? 0 });
    case 'done':
      return hs('progress.done', locale);
    case 'cache':
      return hs('progress.cache', locale);
    case 'preparing':
      return hs('progress.preparing', locale);
  }
}
