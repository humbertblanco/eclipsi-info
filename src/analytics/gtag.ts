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
 * No demana consentiment ni el canvia. El consentiment va DENEGAT per defecte
 * des d'`index.html` (sense cookies, sense senyals publicitaris) i és una
 * decisió de producte, no un detall d'implementació: aquesta app no posa un
 * bàner de cookies perquè no en fa servir cap.
 */

import {
  installAnalytics,
  safePageLocation,
  type AnalyticsEventName,
  type RejectionReason,
} from '../core/analytics';

/**
 * La funció que planta `index.html` (`function gtag(){dataLayer.push(arguments)}`).
 *
 * Es tipa mínimament i es comprova en execució: qui hi hagi al davant pot ser
 * la de Google, pot ser un tros de codi que hi ha posat una extensió, o pot no
 * ser-hi. Les tres coses són normals.
 */
type GtagFn = (command: 'event', name: string, params: Record<string, string>) => void;

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
