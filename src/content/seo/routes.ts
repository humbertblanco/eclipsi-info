/**
 * ELS SEGMENTS D'URL DE LES PÀGINES EDITORIALS, EN UN SOL LLOC.
 *
 * PER QUÈ AQUEST FITXER EXISTEIX, I NO ÉS ORDRE. Aquesta llista estava escrita
 * dues vegades: una a `scripts/build-seo-pages.ts` (que decideix on s'escriu
 * cada fitxer) i una altra a `vite.config.ts` (que decideix què entra al
 * precache). Les dues còpies deien el mateix i cap de les dues sabia de l'altra.
 *
 * El que va passar, i es va veure amb el Chrome apuntant a producció el 8
 * d'agost de 2026: el `globIgnores` del service worker treia les pàgines del
 * precache —la còpia de `vite.config.ts` estava bé— però el `navigateFallback`
 * se les continuava menjant TOTES, perquè aquella opció no mirava cap llista.
 * `curl https://eclipsi.info/ciutat/barcelona/12-08-2026/` tornava la pàgina
 * bona, de 33 kB; el navegador de qualsevol persona que hagués obert l'app un
 * sol cop ensenyava l'app amb el punt que tingués desat. Googlebot no executa
 * service workers, i per això la indexació semblava perfecta mentre cap
 * visitant real veia mai cap de les 1.328 pàgines.
 *
 * La lliçó no era «faltava una opció»: era que la frase «aquests camins no són
 * de l'app» vivia en dos llocs i el segon no s'havia actualitzat. Ara viu aquí,
 * i tant el generador com la configuració del service worker la llegeixen
 * d'aquest fitxer.
 *
 * NO IMPORTA RES. Ni `../../i18n` ni cap tipus del projecte, perquè
 * `vite.config.ts` l'ha de poder llegir i `i18n/index.ts` arrossega React.
 * Les claus són les mateixes que `Locale` i `SEO_LOCALES`, i
 * `content/seo/routes.test.ts` és qui exigeix que no divergeixin.
 */

/** Les menes de pàgina editorial. Cada una té el seu primer segment d'URL. */
export type SeoKind = 'eclipse' | 'city' | 'point' | 'guide' | 'guides';

/**
 * El primer segment de cada mena, per idioma. Es tradueix a posta: una URL en
 * anglès amb la paraula «punt-oficial» no la reconeix ningú, ni una persona ni
 * un cercador.
 */
export const SEO_SEGMENTS = {
  ca: { eclipse: 'eclipsi', city: 'ciutat', point: 'punt-oficial', guide: 'guia', guides: 'guia' },
  es: { eclipse: 'eclipse', city: 'ciudad', point: 'punto-oficial', guide: 'guia', guides: 'guia' },
  en: { eclipse: 'eclipse', city: 'city', point: 'official-site', guide: 'guide', guides: 'guide' },
  fr: { eclipse: 'eclipse', city: 'ville', point: 'site-officiel', guide: 'guide', guides: 'guide' },
} as const satisfies Record<string, Record<SeoKind, string>>;

/** Els prefixos d'idioma que poden anar davant d'un segment editorial. */
export const SEO_LOCALE_PREFIXES = ['es', 'en', 'fr'] as const;

/**
 * Tots els primers segments, sense repetits i ordenats. `guia` surt un sol cop
 * encara que el comparteixin la guia i el seu índex.
 */
export const SEO_FIRST_SEGMENTS: readonly string[] = [
  ...new Set(Object.values(SEO_SEGMENTS).flatMap((segments) => Object.values(segments))),
].sort();

/** El domini públic, amb barra final. Tota URL canònica en penja. */
export const SEO_SITE = 'https://eclipsi.info/';

/** Els idiomes que generen pàgines, en ordre d'aparició als selectors. */
export const SEO_LOCALE_CODES = ['ca', 'es', 'en', 'fr'] as const;
export type SeoLocale = (typeof SEO_LOCALE_CODES)[number];

/** El català viu a l'arrel; la resta, en subdirectori. */
export function seoPrefix(locale: SeoLocale): string {
  return locale === 'ca' ? '' : `${locale}/`;
}

/**
 * Una pàgina editorial, dita en termes d'URL i no de contingut.
 *
 * `slug` ARRIBA RESOLT a posta. La llesca d'una guia surt de
 * `content/editorial-guides.ts`, que és contingut i arrossega els quatre
 * idiomes sencers; si aquest fitxer l'importés, `vite.config.ts` no el podria
 * llegir i tornaríem a tenir dues llistes de camins. Qui construeix la ruta ja
 * sap la llesca: només ha de dir-la.
 */
export interface SeoRoute {
  kind: SeoKind;
  /** Identificador dins de la mena. Buit per a l'índex de guies. */
  slug: string;
  /** L'eclipsi al qual pertany la fitxa, en format públic (dia-mes-any). */
  eclipseSlug?: string;
}

/**
 * El camí absolut d'una pàgina, amb barra inicial i barra final.
 *
 * LES DUES BARRES SÓN LA PART QUE IMPORTA. El servidor serveix
 * `<camí>/index.html`; una URL sense barra final provoca una redirecció 301 del
 * servidor i, si algú l'escriu així en un enllaç intern, cada visita en paga
 * dues.
 *
 * CORRECCIÓ D'UNA VERSIÓ ANTERIOR D'AQUEST COMENTARI: aquí hi deia que la
 * còpia de `seo-widgets.tsx` treia una barra doble en català. No és cert —
 * `${locale==='ca'?'':`/${locale}`}/${segment}/…` dona `/punt-oficial/…` i
 * `/es/punto-oficial/…`, tots dos correctes. El problema d'aquella còpia no és
 * que estigui malament: és que és una CÒPIA, i el dia que aquí es canviï un
 * segment, el client seguirà enviant la gent al camí vell sense que res
 * s'aturi. Val la pena dir-ho bé: un comentari que descriu un error que no ha
 * passat mai fa perdre el temps a qui el llegeixi i desacredita els que sí.
 */
export function seoPath(locale: SeoLocale, route: SeoRoute): string {
  const segment = SEO_SEGMENTS[locale][route.kind];
  if (route.kind === 'guides') return `/${seoPrefix(locale)}${segment}/`;
  const eclipse = route.eclipseSlug !== undefined && route.kind !== 'eclipse'
    ? `${route.eclipseSlug}/`
    : '';
  return `/${seoPrefix(locale)}${segment}/${route.slug}/${eclipse}`;
}

/** La mateixa ruta, absoluta. És el que va a `<link rel="canonical">`. */
export function seoUrl(locale: SeoLocale, route: SeoRoute): string {
  return `${SEO_SITE}${seoPath(locale, route).slice(1)}`;
}

/**
 * Els patrons de `globIgnores` de Workbox: què NO entra al precache de la PWA.
 * Les pàgines editorials són documents independents, es generen DESPRÉS de
 * Workbox i no han d'inflar la instal·lació offline de ningú.
 */
export const SEO_PRECACHE_IGNORES: readonly string[] = SEO_FIRST_SEGMENTS.map(
  (segment) => `**/${segment}/**`,
);

/**
 * El patró de `navigateFallbackDenylist`: quines navegacions NO ha de servir
 * l'esquelet de l'app. Ha de casar tant `/ciutat/…` com `/fr/site-officiel/…`.
 *
 * Es torna una funció i no una constant perquè les expressions regulars amb
 * estat global són una font d'errors quan es reutilitzen; aquí no en portem,
 * però la intenció és que cada consumidor en tingui la seva.
 */
export function seoNavigationDenylist(): RegExp[] {
  const locales = SEO_LOCALE_PREFIXES.join('|');
  const segments = SEO_FIRST_SEGMENTS.join('|');
  return [new RegExp(`^/(?:(?:${locales})/)?(?:${segments})/`)];
}
