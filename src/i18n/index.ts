/**
 * Sistema d'i18n propi, sense cap dependència externa.
 *
 * Per què no una llibreria: l'app ha de funcionar offline i pesar poc, i només
 * necessitem dues coses — accés per clau amb punts i interpolació de variables.
 * Tot això cap en un fitxer i no afegeix 40 kB al bundle.
 *
 * El contingut llarg (la guia) NO viu aquí: viu tipat a `src/content/guide.ts`,
 * perquè és estructurat (taules, llistes, avisos) i el JSON pla no ho aguanta bé.
 * Aquí només hi ha les cadenes curtes de la interfície.
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import ca from './ca.json';
import es from './es.json';

export type Locale = 'ca' | 'es';

/** Ordre d'aparició als selectors d'idioma. */
export const LOCALES: readonly Locale[] = ['ca', 'es'];

/** Idioma per defecte quan el navegador no diu res útil. */
export const FALLBACK_LOCALE: Locale = 'ca';

/** Clau de localStorage. Prefixada per no xocar amb res més del domini. */
export const LOCALE_STORAGE_KEY = 'eclipsi.locale';

/**
 * Els diccionaris són arbres arbitràriament profunds de cadenes. No els tipem
 * clau a clau a propòsit: obligaria a regenerar tipus a cada text nou i la
 * gràcia d'aquest sistema és que afegir un text sigui editar un JSON.
 */
type Dict = { [key: string]: string | Dict };

const DICTS: Record<Locale, Dict> = { ca, es };

export type TranslateVars = Record<string, string | number>;

export interface TranslateFn {
  (key: string, vars?: TranslateVars): string;
}

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: TranslateFn;
}

/** Cert si el valor és un idioma que tenim traduït. */
export function isLocale(value: unknown): value is Locale {
  return value === 'ca' || value === 'es';
}

/**
 * Resol una clau amb punts (`guide.safety.title`) dins d'un diccionari.
 * Torna `null` si la clau no existeix o si apunta a un subarbre, no a un text.
 */
function lookup(dict: Dict, key: string): string | null {
  let node: string | Dict | undefined = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return null;
    node = node[part];
  }
  return typeof node === 'string' ? node : null;
}

/** Substitueix `{{nom}}` pels valors donats. El que no es troba es deixa tal qual. */
function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Crea la funció de traducció d'un idioma. Cadena de recurs:
 * idioma demanat → idioma de fallback → la clau mateixa.
 *
 * Tornar la clau i no una cadena buida és deliberat: un text que falta es veu
 * de seguida en pantalla en comptes de passar desapercebut.
 */
export function createTranslator(locale: Locale): TranslateFn {
  const primary = DICTS[locale];
  const fallback = DICTS[FALLBACK_LOCALE];
  return (key, vars) => {
    const raw = lookup(primary, key) ?? lookup(fallback, key);
    return raw === null ? key : interpolate(raw, vars);
  };
}

/**
  * Idioma inicial: preferència guardada, i si no n'hi ha, català.
 *
 * L'idioma del navegador NO es mira. Vegeu el perquè dins de la funció.
 */
export function detectLocale(): Locale {
  if (typeof window === 'undefined') return FALLBACK_LOCALE;

  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Safari en mode privat pot llançar en accedir a localStorage. No és fatal.
  }

  // CATALÀ PER DEFECTE, i no el que digui el navegador.
  //
  // El sistema de disseny ho fixa: aquesta app és en català, i el castellà —i
  // més endavant l'anglès i el francès— són una TRIA de l'usuari, no una
  // deducció. Autodetectar sembla amable i aquí no ho és: la majoria de
  // navegadors a Catalunya estan configurats en castellà encara que qui els fa
  // servir prefereixi el català, i el resultat era que l'app arrencava en
  // castellà per a gairebé tothom.
  //
  // Qui vulgui una altra llengua la tria un cop i queda desada a `localStorage`,
  // que és el que es comprova aquí sobre.
  return FALLBACK_LOCALE;

}

/** Guarda la preferència. Si localStorage no va, l'app continua funcionant. */
function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignorem: la preferència durarà només aquesta sessió.
  }
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export interface LocaleProviderProps {
  children: ReactNode;
  /** Força un idioma inicial. Sense això es detecta del navegador. */
  initialLocale?: Locale;
}

/**
 * Proveïdor d'idioma. Es fa amb `createElement` i no amb JSX perquè aquest
 * fitxer sigui `.ts` i el sistema d'i18n quedi tot en un únic mòdul.
 */
export function LocaleProvider({
  children,
  initialLocale,
}: LocaleProviderProps): ReactElement {
  const [locale, setLocaleState] = useState<Locale>(
    () => initialLocale ?? detectLocale(),
  );

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
    // Manté l'atribut `lang` del document sincronitzat: importa per als
    // lectors de pantalla i per a la partició de mots del navegador.
    if (typeof document !== 'undefined') document.documentElement.lang = next;
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t: createTranslator(locale) }),
    [locale, setLocale],
  );

  return createElement(LocaleContext.Provider, { value }, children);
}

/**
 * Accés a l'idioma actiu i a la funció de traducció.
 *
 * Fora d'un `LocaleProvider` no peta: cau a un traductor de l'idioma detectat
 * amb un `setLocale` inert. Així un component solt (per exemple el banner de
 * seguretat encastat a la vista de càmera) es pot muntar aïllat i als tests.
 */
export function useTranslation(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  const fallbackLocale = ctx ? ctx.locale : FALLBACK_LOCALE;
  const detached = useMemo<LocaleContextValue>(
    () => ({
      locale: fallbackLocale,
      setLocale: () => {},
      t: createTranslator(fallbackLocale),
    }),
    [fallbackLocale],
  );
  return ctx ?? detached;
}

/** Drecera per quan només cal saber l'idioma (per exemple per triar contingut). */
export function useLocale(): Locale {
  return useTranslation().locale;
}
