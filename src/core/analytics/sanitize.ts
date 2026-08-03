/**
 * LA PORTA. La promesa de privadesa, escrita com a codi executable.
 *
 * ── A QUI VA ADREÇAT AQUEST FITXER ──────────────────────────────────────────
 *
 * A tu, que d'aquí sis mesos, l'11 d'agost del 2026 a les dues de la matinada,
 * afegiràs un esdeveniment amb pressa perquè demà hi ha l'eclipsi i vols saber
 * una cosa. No llegiràs res. Per això aquesta porta no et demana que recordis
 * cap regla: t'HO IMPEDEIX. Si el que intentes enviar pot ser una ubicació, no
 * surt, i el teu esdeveniment no existeix. Sense excepcions i sense petar.
 *
 * El peu de l'app diu, en dos idiomes, «la teva ubicació no surt d'aquí».
 * Aquest fitxer és l'únic lloc del projecte on aquella frase és comprovable.
 *
 * ── QUÈ HI HA A L'ALTRA BANDA DE LA PORTA ───────────────────────────────────
 *
 * L'adreça d'aquesta app PORTA LA UBICACIÓ DE L'USUARI: `?p=41.3809,2.1735`, i
 * de propina `&n=<el nom del lloc>`. Per això `index.html` ja retalla la
 * consulta sencera abans de donar cap adreça a Google. Aquella defensa és per a
 * les vistes de pàgina; aquesta és per a tota la resta, i n'hi ha d'haver dues
 * perquè són dos camins diferents cap al mateix forat.
 *
 * ── LES QUATRE REGLES, I PER QUÈ CADA UNA ───────────────────────────────────
 *
 *  1. NOMÉS PASSEN CADENES. Un `typeof value === 'number'` és rebutjat sempre,
 *     encara que el número sigui innocent. És la regla que fa que aquest fitxer
 *     valgui la pena: una latitud és un número, i si cap número no travessa la
 *     porta, cap latitud no pot travessar-la per accident. El preu és haver de
 *     convertir les xifres en paraules abans (`buckets.ts`), i és un preu que
 *     val la pena pagar.
 *
 *  2. NOMÉS PASSEN PARAULES AMB FORMA DE FITXA: `^[a-z][a-z0-9_]{0,23}$`. Ha
 *     de començar per lletra —«41.3809» comença per xifra—, no admet ni punts,
 *     ni comes, ni graus, ni espais, ni majúscules, ni accents. Amb això cauen,
 *     per la forma i sense saber què són: les coordenades («41.3809»,
 *     «41,3809», «41°22'51"N»), els topònims («Peníscola», «el Port de la
 *     Selva») i les adreces («https://eclipsi.info/?p=…»).
 *
 *  3. NOMÉS PASSEN ELS VALORS DECLARATS al vocabulari per a AQUELL paràmetre
 *     d'AQUELL esdeveniment. Aquesta regla ja implica les dues anteriors; les
 *     altres dues hi són igualment perquè el dia que algú declari malament una
 *     entrada de la taula, la porta segueixi tancada.
 *
 *  4. LES CLAUS TAMBÉ ES MIREN, i hi ha una llista de noms prohibits. Tècnicament
 *     no cal —el valor ja no podria passar— però és la regla que ENSENYA: qui
 *     escriu `{ lat: 41.38 }` a les dues de la matinada rep un no per la clau i
 *     per el valor alhora, i entén de què va això sense haver de llegir res.
 *
 * ── QUÈ NO POT FER AQUESTA PORTA ────────────────────────────────────────────
 *
 * No pot aturar la MALA FE ni una decisió deliberada. Qui declari al vocabulari
 * un paràmetre amb els cinquanta cims del país com a valors possibles hi podrà
 * enviar el cim que ha triat l'usuari, i cap regexp no ho distingirà d'una
 * paraula qualsevol. El que la porta garanteix és que això no pot passar SENSE
 * VOLER: demana declarar-ho, en un fitxer que es llegeix a les revisions, amb
 * un test (`vocabulary.test.ts`) que repassa la taula sencera i que es posarà
 * vermell si algú hi encasta una clau amb nom de lloc.
 */

import {
  declaredParams,
  isAnalyticsEventName,
  type AnalyticsEventName,
} from './vocabulary';

/**
 * La forma d'una paraula que pot sortir d'aquí: minúscula, comença per lletra,
 * fins a 24 caràcters. Vegeu la regla 2 de la capçalera.
 */
export const TOKEN_PATTERN = /^[a-z][a-z0-9_]{0,23}$/;

/** La forma d'un nom d'esdeveniment. Igual, però amb marge (GA4 en permet 40). */
export const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;

/**
 * Sostre de paràmetres per esdeveniment.
 *
 * GA4 n'admet 25; aquí en són 8, i el límit no és tècnic sinó de disseny: un
 * esdeveniment que necessita nou dimensions no és un esdeveniment, és un
 * bolcat d'estat, i un bolcat d'estat és per on s'escapen les coses.
 */
export const MAX_PARAMS = 8;

/**
 * Els noms on s'amaga una ubicació.
 *
 * Coincidència EXACTA, no per tros: `had_point` és una pregunta de sí o no i ha
 * de poder existir, mentre que `point` sol no. Per als casos on el tros SÍ que
 * canta —«lat», «coord», «place»— hi ha la llista d'arrels de sota.
 */
const FORBIDDEN_KEYS: readonly string[] = [
  'lat',
  'lon',
  'lng',
  'latitude',
  'longitude',
  'coord',
  'coords',
  'coordinates',
  'position',
  'pos',
  'point',
  'place',
  'location',
  'loc',
  'geo',
  'address',
  'street',
  'town',
  'city',
  'municipality',
  'region',
  'country',
  'postcode',
  'label',
  'name',
  'title',
  'toponym',
  'query',
  'q',
  'search',
  'term',
  'keyword',
  'url',
  'uri',
  'href',
  'link',
  'referrer',
  'email',
  'phone',
  'ip',
  'elevation',
  'altitude',
  'height',
  'bearing',
  'azimuth',
  'distance',
  'timestamp',
];

/**
 * Arrels que no poden aparèixer DINS de cap clau.
 *
 * `origin_lat`, `spot_place_name` i `user_query` no són a la llista d'exactes i
 * han de caure igualment. La llista és curta a posta: cada arrel de més és un
 * nom legítim que un dia no es podrà fer servir.
 */
const FORBIDDEN_KEY_STEMS: readonly string[] = [
  'lat',
  'lon',
  'lng',
  'coord',
  'geo',
  'place',
  'topon',
  'addr',
  'query',
  'search',
  'url',
  'href',
  'email',
  'phone',
  'gps_',
  'user_',
  'client_',
  'session_',
  'municip',
  'postal',
];

/**
 * Claus que GA4 es reserva o que ja fa servir per a coses nostres.
 *
 * `page_location` hi és per un motiu que no és cosmètic: és el camp que porta
 * l'adreça, i l'adreça d'aquesta app porta la ubicació. Qui l'ha d'escriure és
 * la frontera (`src/analytics/gtag.ts`), amb el valor ja retallat per
 * `safePageLocation()`; que no el pugui escriure ningú més és el que fa que la
 * garantia sigui d'un sol lloc.
 */
const RESERVED_KEYS: readonly string[] = [
  'page_location',
  'page_referrer',
  'page_title',
  'page_path',
  'screen_name',
  'screen_class',
  'user_id',
  'client_id',
  'session_id',
  'engagement_time_msec',
  'currency',
  'value',
  'items',
];

const RESERVED_KEY_PREFIXES: readonly string[] = ['ga_', 'google_', 'firebase_', '_'];

/**
 * Noms d'esdeveniment que GA4 es reserva. Enviar-ne un no dona cap error: la
 * dada es barreja amb la de Google i no hi ha manera de destriar-la després.
 */
const RESERVED_EVENT_NAMES: readonly string[] = [
  'app_remove',
  'app_store_refund',
  'app_store_subscription_cancel',
  'app_store_subscription_convert',
  'app_store_subscription_renew',
  'click',
  'error',
  'file_download',
  'first_open',
  'first_visit',
  'form_start',
  'form_submit',
  'in_app_purchase',
  'page_view',
  'scroll',
  'session_start',
  'user_engagement',
  'view_search_results',
];

/** Per què s'ha rebutjat. No arriba mai a l'usuari: és per a qui programa. */
export type RejectionReason =
  | 'unknown_event'
  | 'reserved_event'
  | 'bad_event_name'
  | 'params_not_object'
  | 'too_many_params'
  | 'unknown_param'
  | 'forbidden_key'
  | 'reserved_key'
  | 'bad_key'
  | 'missing_param'
  | 'not_a_string'
  | 'bad_value'
  | 'undeclared_value'
  /** Llegir l'entrada ha llançat: un `get` que peta, un Proxy hostil. */
  | 'read_failed';

export type SanitizeResult =
  | {
      readonly ok: true;
      readonly name: AnalyticsEventName;
      /** Objecte NOU, construït clau a clau des del vocabulari. */
      readonly params: Readonly<Record<string, string>>;
    }
  | {
      readonly ok: false;
      readonly reason: RejectionReason;
      /** Quin paràmetre ha fet caure l'esdeveniment. MAI el valor. */
      readonly detail: string;
    };

function reject(reason: RejectionReason, detail: string): SanitizeResult {
  return { ok: false, reason, detail };
}

/** Cert si la paraula té la forma que pot sortir d'aquí (regla 2). */
export function isSafeToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

/** Cert si la clau és un nom on s'hi pot amagar una ubicació (regla 4). */
export function isForbiddenKey(key: string): boolean {
  if (FORBIDDEN_KEYS.includes(key)) return true;
  return FORBIDDEN_KEY_STEMS.some((stem) => key.includes(stem));
}

function isReservedKey(key: string): boolean {
  if (RESERVED_KEYS.includes(key)) return true;
  return RESERVED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * LA PORTA.
 *
 * Rep `unknown` a posta, i no el tipus bo: el tipus bo ja el comprova el
 * compilador, i el que ha d'aturar això és justament el que ha escapat del
 * compilador — un `as`, un `any` que ve d'una resposta de xarxa, un objecte
 * muntat amb `JSON.parse`. Si aquesta funció només acceptés coses ben tipades,
 * no protegiria de res.
 *
 * NO LLANÇA MAI. Una excepció aquí seria una app que peta per una mètrica, que
 * és l'insult definitiu: perdre l'usuari el dia de l'eclipsi per una dada que
 * no li serveix de res a ell.
 *
 * ELS PARÀMETRES DECLARATS SÓN TOTS OBLIGATORIS. Un `map_layer_toggle` sense
 * `state` no és mitja dada: és una dada que menteix, perquè al panell de GA
 * apareixerà com un toc de capa sense direcció i algú comptarà encesos que
 * podrien ser apagats. O l'esdeveniment és sencer o no existeix.
 *
 * EL RESULTAT ÉS UN OBJECTE NOU, muntat recorrent el VOCABULARI i no l'entrada.
 * Així res que hagi vingut de fora —una clau de més, un símbol, un `toJSON`, un
 * prototipus contaminat— pot arribar a la frontera encara que la porta s'hagi
 * distret.
 */
export function sanitizeEvent(name: string, params: unknown): SanitizeResult {
  try {
    return gate(name, params);
  } catch {
    // «No llança mai» ha de ser cert també quan l'entrada és hostil: un `get`
    // que peta o un Proxy que es rebel·la a mig recórrer. Un objecte que no es
    // deixa llegir no és un esdeveniment: és un no.
    return reject('read_failed', name);
  }
}

function gate(name: string, params: unknown): SanitizeResult {
  if (!EVENT_NAME_PATTERN.test(name)) return reject('bad_event_name', name);
  if (RESERVED_EVENT_NAMES.includes(name)) return reject('reserved_event', name);
  if (!isAnalyticsEventName(name)) return reject('unknown_event', name);

  if (typeof params !== 'object' || params === null || Array.isArray(params)) {
    return reject('params_not_object', name);
  }

  const declared = declaredParams(name);
  const input = params as Record<string, unknown>;

  const given = Object.keys(input);
  if (given.length > MAX_PARAMS) return reject('too_many_params', name);

  // Primer les claus que sobren: una clau que el vocabulari no coneix és el cas
  // típic del descuit («ja que hi soc, hi poso la latitud»), i s'ha de veure
  // com a tal i no com un valor dolent.
  for (const key of given) {
    if (!isSafeToken(key)) return reject('bad_key', key);
    if (isForbiddenKey(key)) return reject('forbidden_key', key);
    if (isReservedKey(key)) return reject('reserved_key', key);
    if (!Object.prototype.hasOwnProperty.call(declared, key)) {
      return reject('unknown_param', key);
    }
  }

  const clean: Record<string, string> = {};
  for (const key of Object.keys(declared)) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) {
      return reject('missing_param', key);
    }
    const value: unknown = input[key];
    // Regla 1. El comentari va aquí i no a la capçalera perquè és la línia que
    // algú tindrà la temptació de relaxar: una latitud és un número.
    if (typeof value !== 'string') return reject('not_a_string', key);
    if (!TOKEN_PATTERN.test(value)) return reject('bad_value', key);
    if (!declared[key].includes(value)) return reject('undeclared_value', key);
    clean[key] = value;
  }

  return { ok: true, name, params: clean };
}

/**
 * L'ADREÇA, RETALLADA: origen + camí + fragment, i res més.
 *
 * ── PER QUÈ TAMBÉ AQUÍ, SI JA HI ÉS A `index.html` ──────────────────────────
 *
 * Perquè la d'`index.html` s'aplica a la CONFIGURACIÓ i a les vistes de pàgina,
 * i confiar que gtag.js arrossegarà aquell valor a tots els esdeveniments
 * següents és confiar en la semàntica de persistència de paràmetres d'una
 * llibreria de tercers que es pot actualitzar sola i sense avisar-nos. Aquesta
 * funció fa que cada enviament porti la seva pròpia garantia, comprovable amb
 * un test que corre a Node. La duplicació és el punt, no el defecte.
 *
 * ── QUÈ CAU ────────────────────────────────────────────────────────────────
 *
 *   · LA CONSULTA SENCERA. És on viu `?p=41.3809,2.1735&n=Peníscola`. No es
 *     filtren paràmetres un per un: es tira tota, perquè una llista de
 *     paràmetres a filtrar és una llista que un dia s'oblida d'actualitzar.
 *   · L'USUARI I LA CONTRASENYA d'una adreça, si mai n'hi hagués (`origin` ja
 *     no els porta).
 *   · EL FRAGMENT QUE NO RECONEIXEM. Les rutes d'aquesta app són paraules
 *     (`#/mapa/llocs`, `#/guia/safety`, `#/com-funciona`) i el filtre només
 *     deixa passar això. Si un dia algú posa el punt al fragment
 *     —`#/mapa/41.38,2.17`, que és una idea que apareix sola quan es vol
 *     compartir estat— el fragment cau sencer i l'adreça queda pelada. Es
 *     perd granularitat al panell; no es perd la promesa.
 *
 * ── I SI L'ADREÇA NO ES POT LLEGIR, ES FALLA TANCAT ─────────────────────────
 *
 * Torna `null`, i la frontera no envia RES. Podria semblar exagerat perdre un
 * esdeveniment per una adreça rara, però l'alternativa és enviar-lo sense
 * adreça i deixar que gtag.js hi posi `location.href` sencer pel seu compte,
 * que és exactament el forat que aquesta funció existeix per tapar.
 */
export function safePageLocation(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  // Res que no sigui web: `file:`, `data:` i companyia no tenen origen útil i
  // sí que poden portar el document sencer a dins.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.origin === 'null' || url.origin === '') return null;

  return `${url.origin}${url.pathname}${safeHash(url.hash)}`;
}

/**
 * Les rutes d'aquesta app, i cap altra cosa: `#/paraula` o `#/paraula/paraula`,
 * amb guions admesos (`#/com-funciona`). Sense xifres, sense punts i sense
 * comes — que és el que tenen les coordenades.
 */
const SAFE_HASH_PATTERN = /^#\/[a-z]+(?:-[a-z]+)*(?:\/[a-z]+(?:-[a-z]+)*)?$/;

function safeHash(hash: string): string {
  if (hash === '') return '';
  return SAFE_HASH_PATTERN.test(hash) ? hash : '';
}
