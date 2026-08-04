/**
 * LA FRONTERA. L'únic fitxer de tota l'app que sap que Google Analytics existeix.
 *
 * ── PER QUÈ VIU AQUÍ I NO A `src/core/analytics/` ───────────────────────────
 *
 * Perquè llegeix globals del navegador (`gtag`, `location`) i `src/core` no en
 * llegeix cap: la regla és d'ESTAT.md §5 i no es negocia ni per una mètrica.
 * L'altra meitat de la raó és pràctica: amb la frontera separada, tot el que
 * decideix alguna cosa —el vocabulari, la porta de privadesa, les franges— es
 * prova a Node en mil·lisegons i sense muntar cap navegador, i el que queda
 * aquí és tan poca cosa que es pot llegir sencer d'una tirada. Que és
 * exactament el que ha de passar amb el codi que té permís per parlar amb fora.
 *
 * Va a `src/analytics/` i no dins de `features/` per la mateixa raó que
 * `src/offline/`: no és cap pantalla, és canonada de l'aplicació sencera.
 *
 * ── LES TRES COSES QUE FA, I NOMÉS AQUESTES TRES ────────────────────────────
 *
 *  1. LLEGEIX `gtag` A CADA ENVIAMENT, mai una sola vegada a l'arrencada. El
 *     script de Google és `async` (vegeu `index.html`) i no és al precache del
 *     service worker a posta: sense cobertura no arriba mai, i amb cobertura
 *     dolenta arriba tard. Desar-ne una referència a l'inici voldria dir
 *     decidir per sempre, al pitjor moment possible, si aquesta sessió mesura o
 *     no. Llegir-lo cada cop val nanosegons.
 *
 *  2. TORNA A RETALLAR L'ADREÇA, a cada esdeveniment i pel seu compte. Sí,
 *     `index.html` ja ho fa per a la configuració i per a les vistes de pàgina.
 *     No n'hi ha prou: que gtag.js arrossegui aquell `page_location` als
 *     esdeveniments següents és una semàntica de persistència de paràmetres
 *     d'una llibreria de tercers que s'actualitza sola. Si un dia deixés de ser
 *     certa, la llibreria agafaria `location.href` sencer —amb `?p=41.38,2.17`
 *     i `&n=<el nom del lloc de l'usuari>` a dins— i ningú no se n'assabentaria
 *     fins que fos massa tard. Aquí la garantia és LOCAL a cada enviament i té
 *     un test que corre a Node (`safePageLocation`).
 *
 *  3. FALLA TANCADA. Si l'adreça no es pot llegir o no es pot retallar amb
 *     seguretat, l'esdeveniment NO SURT. Perdre una mètrica no costa res;
 *     enviar-la sense adreça i deixar que gtag.js hi posi la seva costaria
 *     exactament la promesa del peu de l'app.
 *
 * ── EL QUE AQUEST FITXER NO FA, I NO HA DE FER MAI ──────────────────────────
 *
 * No envia vistes de pàgina. Les envia `index.html` amb el seu escoltador de
 * `hashchange`, i n'hi ha d'haver un de sol: dos comptadors del mateix, cadascun
 * amb la seva idea de què és una pantalla, són pitjor que cap. Si algun dia
 * s'ha de moure aquí, s'ha de treure d'allà en el mateix commit.
 *
 * No DEMANA consentiment: qui el demana és `features/consent/`, que és qui té
 * paraules i idioma. Aquest fitxer només l'APLICA, amb `updateConsent()`, i ho
 * fa perquè la frase de dalt segueixi sent certa — si la crida a
 * `gtag('consent', …)` visqués al component del bàner, hi hauria dos fitxers
 * que saben que Google Analytics existeix i el dia que es canviï de proveïdor
 * caldria trobar-los tots dos.
 *
 * ── EL BÀNER: QUÈ HI HAVIA ABANS I PER QUÈ HA CANVIAT ───────────────────────
 *
 * Fins al 4 d'agost de 2026 aquí hi deia que aquesta app no posava bàner de
 * cookies «perquè no en fa servir cap», i era veritat: consentiment denegat per
 * defecte i pings sense galeta. El preu, que no s'havia escrit enlloc, era que
 * la xifra d'«Usuaris» de GA4 no eren persones sinó càrregues de pàgina, perquè
 * sense galeta no hi ha `client_id` que duri d'una visita a l'altra.
 *
 * La decisió nova és tenir la xifra de persones i pagar el bàner. El que NO ha
 * canviat: `allow_google_signals` segueix a fals i els senyals publicitaris
 * segueixen denegats per sempre i sense pregunta, perquè d'això no se'n demana
 * permís — simplement no es fa. L'única casella que el bàner pot obrir és
 * `analytics_storage`.
 *
 * I EL PER DEFECTE SEGUEIX SENT DENEGAT, a `index.html`, abans que carregui res.
 * Això és el que fa que la galeta no existeixi fins que algú digui que sí, i
 * l'ordre importa: si el valor per defecte es posés després de carregar
 * `gtag.js`, hi hauria una finestra de mil·lisegons amb galeta.
 */

import {
  installAnalytics,
  safePageLocation,
  type AnalyticsEventName,
  type ConsentChoice,
  type RejectionReason,
} from '../core/analytics';

/**
 * La funció que planta `index.html` (`function gtag(){dataLayer.push(arguments)}`).
 *
 * Es tipa mínimament i es comprova en execució: qui hi hagi al davant pot ser
 * la de Google, pot ser un tros de codi que hi ha posat una extensió, o pot no
 * ser-hi. Les tres coses són normals.
 */
interface GtagFn {
  (command: 'event', name: string, params: Record<string, string>): void;
  /**
   * La segona i última ordre que fem servir. `'update'` i mai `'default'`: el
   * valor per defecte el posa `index.html` abans de carregar res, i tornar-lo a
   * declarar des d'aquí seria declarar-lo TARD, que és precisament el forat que
   * el Consent Mode existeix per tapar.
   */
  (command: 'consent', action: 'update', params: Record<string, string>): void;
}

/**
 * Els globals que ens interessen, llegits de `globalThis` i no de `window`.
 *
 * Al navegador són el mateix objecte; la diferència és que així aquest fitxer
 * es pot carregar en un Worker o a Node sense petar en la primera línia, i el
 * seu test pot muntar un `gtag` fals sense inventar-se un DOM.
 */
interface AnalyticsScope {
  gtag?: unknown;
  location?: { href?: unknown };
}

function scope(): AnalyticsScope {
  return globalThis as unknown as AnalyticsScope;
}

function readGtag(): GtagFn | null {
  const candidate = scope().gtag;
  return typeof candidate === 'function' ? (candidate as GtagFn) : null;
}

function readHref(): string | null {
  const href = scope().location?.href;
  return typeof href === 'string' ? href : null;
}

/**
 * Aplica una resposta de l'usuari al Consent Mode de Google, en calent.
 *
 * ── PER QUÈ «EN CALENT» I NO «A LA PRÒXIMA CÀRREGA» ─────────────────────────
 *
 * Perquè si no, el sí de l'usuari no serviria per a la sessió en què l'ha dit:
 * hauria d'acceptar, tancar l'app i tornar-hi perquè comencés a comptar. Amb
 * `consent update`, gtag.js escriu la galeta i reenvia el que tenia en cua al
 * moment, sense recarregar res.
 *
 * ── NOMÉS TOCA UNA CASELLA, I ÉS A POSTA ────────────────────────────────────
 *
 * `analytics_storage` i cap més. `ad_storage`, `ad_user_data` i
 * `ad_personalization` es queden denegats per sempre des d'`index.html` i el
 * bàner ni tan sols els menciona, perquè no s'ofereix cap tracte on s'activin:
 * un bàner que demana permís per a coses que no penses fer és un bàner que
 * menteix.
 *
 * ── I FALLA CALLANT, COM LA RESTA DEL FITXER ────────────────────────────────
 *
 * Sense `gtag` no hi ha res a fer i no és cap error (bloquejador, xarxa
 * caiguda, script que encara no ha arribat). El que NO pot passar és que un
 * bloquejador que substitueix `gtag` per codi que llança s'endugui la pantalla
 * quan l'usuari acaba de prémer un botó — per això el `try`.
 *
 * Compte amb una cosa que aquesta funció NO fa: desar la resposta. Qui la desa
 * és `features/consent/useConsent.ts`. Si es desés aquí, la clau de
 * localStorage quedaria escrita per un fitxer que pot no arribar a executar-se
 * mai (vegeu el `return` de dalt) i hi hauria consentiments donats que no es
 * recordarien.
 */
export function updateConsent(choice: ConsentChoice): void {
  const gtag = readGtag();
  if (gtag === null) return;

  try {
    gtag('consent', 'update', { analytics_storage: choice });
  } catch {
    // Mateix motiu que a `send()`: hi ha bloquejadors que no treuen `gtag`,
    // el substitueixen per un tros de codi que llança.
  }
}

export interface GtagAnalyticsOptions {
  /**
   * Queixa't per consola quan la porta rebutgi un esdeveniment. Per defecte,
   * només en desenvolupament: en producció això seria soroll a la consola de
   * l'usuari per un problema que és nostre.
   */
  debug?: boolean;
}

/**
 * Enganxa l'emissor del nucli amb Google Analytics. Es crida un cop, a
 * `main.tsx`, i a partir d'aquí `track()` funciona des d'on sigui.
 *
 * Si no es crida mai, l'app funciona igual i no mesura res — que és el
 * comportament que volem als tests i a qualsevol eina que carregui mòduls de
 * l'app fora d'un navegador.
 */
export function installGtagAnalytics(options: GtagAnalyticsOptions = {}): void {
  const debug = options.debug ?? import.meta.env.DEV;

  installAnalytics({
    send(name: AnalyticsEventName, params: Readonly<Record<string, string>>): void {
      const gtag = readGtag();
      // Sense gtag no hi ha res a fer i no és cap error: bloquejador, xarxa
      // caiguda, o el script que encara no ha arribat.
      if (gtag === null) return;

      const href = readHref();
      if (href === null) return;
      const page = safePageLocation(href);
      // Falla tancada: vegeu el punt 3 de la capçalera.
      if (page === null) return;

      try {
        gtag('event', name, { ...params, page_location: page });
      } catch {
        // Hi ha bloquejadors que no treuen `gtag`: el substitueixen per un
        // tros de codi que llança. Una mètrica no pot endur-se una pantalla.
      }
    },

    onRejected: debug
      ? (name: string, reason: RejectionReason, detail: string): void => {
          // Només en desenvolupament, i amb el nom del paràmetre — mai el
          // valor: si el valor era una latitud, escriure-la a la consola seria
          // repetir el problema en un altre canal.
          console.warn(
            `[analytics] «${name}» rebutjat per la porta de privadesa: ${reason} (${detail}). ` +
              'Els paràmetres han d’estar declarats a src/core/analytics/vocabulary.ts i ' +
              'han de ser paraules d’una llista tancada, mai números ni text lliure.',
          );
        }
      : undefined,
  });
}
