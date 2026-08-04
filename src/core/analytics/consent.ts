/**
 * El consentiment de cookies, com a DECISIÓ i no com a interruptor.
 *
 * ── PER QUÈ AIXÒ EXISTEIX, I PER QUÈ NO HI ERA ──────────────────────────────
 *
 * Fins al 4 d'agost de 2026 aquesta app no tenia bàner perquè no tenia cookies:
 * el consentiment anava DENEGAT per defecte des d'`index.html` i GA4 rebia
 * pings sense galeta. Era net i era honest, però tenia un preu que no s'havia
 * dit en veu alta: sense galeta no hi ha `client_id` persistit, i sense
 * `client_id` el número que GA4 escriu sota «Usuaris» no és gent — és
 * càrregues de pàgina. Qui entra dilluns i dimecres compta dues vegades.
 *
 * La decisió de producte és tenir la xifra de persones i pagar-ne el preu, que
 * és un bàner. Aquest fitxer és la meitat de la feina que es pot provar a Node
 * en mil·lisegons: quins estats existeixen, com es llegeix el que hi ha desat i
 * quan s'ha de tornar a preguntar.
 *
 * ── LES TRES REGLES QUE GOVERNEN AQUEST FITXER ──────────────────────────────
 *
 *  1. FALLA TANCADA, SEMPRE. Qualsevol cosa que no sigui exactament un
 *     consentiment vàlid i viu es llegeix com `'unknown'`, i `'unknown'` es
 *     tradueix a `denied`. Un JSON trencat, una clau manipulada a mà, un rellotge
 *     que va enrere, una versió antiga del format: tot cau al mateix lloc, i el
 *     lloc és «no mesuris». L'error car aquí no és perdre una mètrica, és posar
 *     una galeta a algú que no ha dit que sí.
 *
 *  2. UN CONSENTIMENT SENSE DATA DE CADUCITAT NO ÉS UN CONSENTIMENT. Es desa
 *     QUAN es va dir que sí, no només què es va dir, i passat un any torna a
 *     ser `'unknown'`. Sí, aquesta app es mor pràcticament el 12 d'agost de 2026
 *     i és molt probable que aquesta branca no s'executi mai en producció —
 *     però és una branca de deu línies que té test, no un tros de codi mort:
 *     `caducat` és un dels estats del sistema, i si no es prova aquí no es prova
 *     enlloc.
 *
 *  3. CAP FRASE PER A L'USUARI, que és la regla 6 del projecte. Aquí hi ha
 *     `'granted'` i `'denied'`; les paraules «Accepta» i «No, gràcies» viuen a
 *     `features/consent/strings.ts`, que és l'única capa que sap en quin idioma
 *     s'està parlant.
 *
 * ── EL RELLOTGE ENTRA PER PARÀMETRE ─────────────────────────────────────────
 *
 * `parseConsent` rep `nowMs` i no crida `Date.now()`. No és purisme: la
 * caducitat i el rellotge cap enrere són exactament els dos casos que s'han de
 * provar, i amb el rellotge a dins només es poden provar amb simulacres del
 * temps global — que és la mena de test que ESTAT.md classifica com a mentider,
 * perquè acaba assertant-se damunt del seu propi simulacre.
 */

/** El que l'usuari pot haver contestat. No hi ha terceres opcions. */
export type ConsentChoice = 'granted' | 'denied';

/**
 * L'estat complet, que en té un de més: encara no ha contestat.
 *
 * `'unknown'` NO vol dir «denegat» a efectes de producte —vol dir que s'ha de
 * preguntar—, però sí que hi equival a efectes de mesura. Són dues preguntes
 * diferents i per això hi ha dues funcions: `needsDecision` i `analyticsStorage`.
 */
export type ConsentState = ConsentChoice | 'unknown';

/**
 * Clau de localStorage. Prefixada com `eclipsi.locale`, pel mateix motiu: el
 * domini pot acabar servint alguna cosa més que aquesta app.
 */
export const CONSENT_STORAGE_KEY = 'eclipsi.consent';

/**
 * Quant dura un sí.
 *
 * Dotze mesos. La guia de cookies de l'AEPD en tolera vint-i-quatre com a
 * màxim; se'n prenen dotze perquè el màxim d'una guia no és mai un bon valor
 * per defecte i perquè, amb l'eclipsi al mig, ningú no tornarà a aquesta app
 * d'aquí a dos anys sense haver-se'n oblidat del tot.
 */
export const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Marge de tolerància cap al futur.
 *
 * Un consentiment amb data posterior a ara és impossible i vol dir una de dues:
 * rellotge del dispositiu mal posat, o algú que ha editat la clau a mà. Es
 * toleren cinc minuts —el desfasament normal d'un rellotge de mòbil— i a partir
 * d'aquí es descarta. Sense aquest marge, un rellotge que va cinc segons avançat
 * quan es va desar el sí esborraria el sí a la següent visita.
 */
export const CONSENT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** El que hi ha realment desat: la resposta i quan es va donar. */
export interface StoredConsent {
  choice: ConsentChoice;
  /** Mil·lisegons d'època del moment en què es va contestar. */
  at: number;
}

/** Cert si el valor és una de les dues respostes possibles. */
export function isConsentChoice(value: unknown): value is ConsentChoice {
  return value === 'granted' || value === 'denied';
}

/**
 * El que s'escriu a localStorage.
 *
 * JSON i no la cadena pelada («granted») a posta: la data ha d'anar-hi de
 * costat, i el dia que calgui una tercera dada —la versió del text que es va
 * acceptar, posem— hi cabrà sense haver d'endevinar formats antics.
 */
export function serializeConsent(choice: ConsentChoice, atMs: number): string {
  const payload: StoredConsent = { choice, at: atMs };
  return JSON.stringify(payload);
}

/**
 * Llegeix el que hi ha desat i decideix què val.
 *
 * Torna `'unknown'` per a tot el que no sigui un consentiment vàlid i viu: no
 * hi ha res, no és JSON, no és un objecte, la resposta no és de les dues, la
 * data no és un número finit, la data és al futur més enllà del marge, o la
 * data és més vella que `CONSENT_MAX_AGE_MS`.
 */
export function parseConsent(raw: string | null, nowMs: number): ConsentState {
  if (raw === null || raw === '') return 'unknown';

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Clau escrita per una versió anterior, per una extensió, o a mà.
    return 'unknown';
  }

  if (typeof parsed !== 'object' || parsed === null) return 'unknown';

  const { choice, at } = parsed as { choice?: unknown; at?: unknown };
  if (!isConsentChoice(choice)) return 'unknown';
  if (typeof at !== 'number' || !Number.isFinite(at)) return 'unknown';

  if (at > nowMs + CONSENT_FUTURE_TOLERANCE_MS) return 'unknown';
  if (nowMs - at > CONSENT_MAX_AGE_MS) return 'unknown';

  return choice;
}

/** Cert quan s'ha de mostrar el bàner: només si encara no s'ha contestat. */
export function needsDecision(state: ConsentState): boolean {
  return state === 'unknown';
}

/**
 * El valor que li toca a `analytics_storage` de Google.
 *
 * Aquí és on `'unknown'` es converteix en `'denied'`, i és l'únic lloc on
 * passa: la resta del codi no ha de recordar mai que un estat desconegut no
 * autoritza res.
 */
export function analyticsStorage(state: ConsentState): ConsentChoice {
  return state === 'granted' ? 'granted' : 'denied';
}
