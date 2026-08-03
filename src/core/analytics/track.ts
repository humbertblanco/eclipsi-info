/**
 * L'emissor. Una funció per enviar, una interfície per rebre, i cap dependència
 * del navegador.
 *
 * ── QUÈ HI FA A `src/core`, SI L'ANALÍTICA ÉS COSA DEL NAVEGADOR ────────────
 *
 * Perquè el que és difícil de l'analítica no és cridar `gtag`: són el
 * vocabulari, la porta de privadesa i la decisió de què val la pena mesurar.
 * Tot això és lògica pura, es pot provar a Node i no ha de dependre mai de si
 * hi ha una pestanya oberta. El que SÍ que toca el navegador —llegir
 * `window.gtag` i l'adreça actual— cap en trenta línies i viu fora d'aquí, a
 * `src/analytics/gtag.ts`, que és l'ÚNIC fitxer de tota l'app que sap que
 * Google Analytics existeix. La regla de `src/core` («mai el DOM», ESTAT.md §5)
 * no és negociable ni per això.
 *
 * La frontera es declara amb `installAnalytics()`. Qui no la instal·la —els
 * tests, els Workers, els scripts de mesura— pot cridar `track()` tantes
 * vegades com vulgui: es sanejarà i no anirà enlloc.
 *
 * ── LES TRES MANERES DE NO ARRIBAR, I TOTES TRES SÓN NORMALS ────────────────
 *
 *   1. NO HI HA FRONTERA (tests, Node, un Worker). `no_transport`.
 *   2. HI ÉS PERÒ NO HI HA `gtag`: un bloquejador de publicitat, una xarxa
 *      caiguda al cim, el mode privat estricte, o simplement que el script
 *      extern no ha carregat encara —no és al precache a posta, o sigui que
 *      sense cobertura no hi és mai. La frontera se n'adona i calla.
 *   3. LA FRONTERA LLANÇA. Alguns bloquejadors no treuen `gtag`: el
 *      substitueixen per un tros de codi que peta. Es cull aquí i es reporta
 *      `transport_failed`.
 *
 * En cap dels tres casos no passa res: ni excepció, ni missatge, ni consola. Un
 * usuari amb un bloquejador ha de tenir exactament la mateixa app que un que no
 * en té, i el dia de l'eclipsi no hi pot haver cap camí en què una mètrica es
 * porti la pantalla per davant.
 *
 * ── PER QUÈ `track` RETORNA UNA COSA QUE GAIREBÉ NINGÚ MIRARÀ ───────────────
 *
 * Perquè és l'única manera de provar la porta de veritat: un test pot afirmar
 * que un esdeveniment amb una latitud a dins torna `rejected` sense haver de
 * muntar cap navegador ni espiar cap consola. Als punts de crida, ignorar el
 * retorn és el comportament esperat i correcte.
 */

import { sanitizeEvent, type RejectionReason } from './sanitize';
import type { AnalyticsEventName, AnalyticsParams } from './vocabulary';

/**
 * Qui s'endú els esdeveniments ja sanejats.
 *
 * Rep `params` JA NET —claus i valors declarats, res més— i té una sola feina:
 * posar-ho al canal que toqui. No ha de validar res i no ha de llançar mai;
 * si ho fa, `track()` ho cull igualment.
 */
export interface AnalyticsTransport {
  send: (name: AnalyticsEventName, params: Readonly<Record<string, string>>) => void;
  /**
   * Diagnòstic de desenvolupament, opcional. La porta no crida mai la consola
   * pel seu compte —`src/core` no fa soroll— però sí que ofereix aquest fil
   * perquè la frontera pugui queixar-se en local i callar en producció. És el
   * que farà que qui afegeixi un esdeveniment amb pressa vegi de seguida per
   * què no li surt, en comptes de mirar un panell buit d'aquí a tres dies.
   */
  onRejected?: (name: string, reason: RejectionReason, detail: string) => void;
}

export type TrackOutcome = 'sent' | 'rejected' | 'no_transport' | 'transport_failed';

let transport: AnalyticsTransport | null = null;

/**
 * Declara (o retira, amb `null`) la frontera. Es crida un sol cop, a l'arrencada.
 *
 * L'estat és de mòdul i no un context de React a posta: `track()` s'ha de poder
 * cridar des d'un `useEffect`, des d'un gestor d'esdeveniments, des d'un mòdul
 * de nivell superior i des d'un test, i un context obligaria a passar-lo per
 * llocs on no hi pinta res. Retirar-la torna l'app al seu estat per defecte,
 * que és el silenci.
 */
export function installAnalytics(next: AnalyticsTransport | null): void {
  transport = next;
}

/** Si hi ha frontera instal·lada. Per als tests, i per a res més. */
export function analyticsInstalled(): boolean {
  return transport !== null;
}

/**
 * Envia un esdeveniment del vocabulari.
 *
 * ES SANEJA SEMPRE, HI HAGI FRONTERA O NO. Podria semblar malbaratament fer
 * passar la porta a un esdeveniment que no anirà enlloc, però és el que fa que
 * el comportament sigui EL MATEIX amb navegador i sense: si la porta només
 * s'apliqués quan hi ha `gtag`, un test verd no voldria dir res sobre el que
 * passa a producció, que és justament on importa.
 *
 * NO LLANÇA MAI, per res.
 */
export function track<K extends AnalyticsEventName>(
  name: K,
  params: AnalyticsParams<K>,
): TrackOutcome {
  const result = sanitizeEvent(name, params);

  if (!result.ok) {
    try {
      transport?.onRejected?.(name, result.reason, result.detail);
    } catch {
      // Ni el diagnòstic no pot endur-se res per davant.
    }
    return 'rejected';
  }

  if (transport === null) return 'no_transport';

  try {
    transport.send(result.name, result.params);
    return 'sent';
  } catch {
    return 'transport_failed';
  }
}
