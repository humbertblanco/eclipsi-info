/**
 * Límits reals de les PWA a iOS, i el poc que se'n pot detectar per codi.
 *
 * Això no és una nota pessimista: la meitat de la gent que anirà a la franja
 * de totalitat del 12-08-2026 hi anirà amb un iPhone, i el comportament de
 * WebKit és prou diferent del de Chrome com per canviar el consell que li hem
 * de donar a l'usuari.
 *
 * ── 1. Tots els navegadors d'iOS són WebKit ───────────────────────────────
 * Chrome, Firefox i Edge a l'iPhone són capes damunt de WebKit. No hi ha cap
 * "prova-ho amb un altre navegador" que canviï res del que hi ha aquí sota.
 *
 * ── 2. No hi ha instal·lació guiada ───────────────────────────────────────
 * `beforeinstallprompt` no existeix a WebKit. No podem oferir cap botó
 * d'"Instal·la": l'única via és Compartir → Afegeix a la pantalla d'inici, i
 * només des de Safari (des de Chrome per a iOS l'opció no hi és). Per això
 * ensenyem instruccions escrites i no un botó.
 *
 * ── 3. L'app instal·lada té l'emmagatzematge SEPARAT de Safari ────────────
 * Fins a iOS 17.4, una web afegida a la pantalla d'inici corria en una
 * instància de WebKit pròpia, amb la seva Cache Storage i la seva IndexedDB.
 * Conseqüència pràctica i molt fàcil de patir: si prepares el viatge dins de
 * Safari i després obres la icona de la pantalla d'inici, no hi trobes res
 * desat. El consell correcte és: instal·la PRIMER, prepara DESPRÉS, i des de
 * dins de l'app instal·lada.
 *
 * ── 4. Esborrat als 7 dies ────────────────────────────────────────────────
 * L'ITP de WebKit esborra tot l'emmagatzematge escrivible per scripts (Cache
 * Storage, IndexedDB, localStorage, i fins i tot el service worker) després de
 * set dies sense que l'usuari interactuï amb el lloc. Les apps afegides a la
 * pantalla d'inici en queden exemptes, cosa que reforça el consell del punt 3.
 * Aquest és el motiu pel qual la interfície diu la data de la preparació: si
 * fa més d'una setmana i no està instal·lada, pot no quedar-hi res.
 *
 * ── 5. `navigator.storage.persist()` no existeix ──────────────────────────
 * Safari no implementa l'API de persistència, així que no hi ha manera de
 * demanar que no ens esborrin. `estimate()` sí que funciona, i és el que fem
 * servir per ensenyar l'espai ocupat. La quota per origen ronda el gigabyte
 * (una fracció de l'espai lliure del dispositiu) i es pot reduir sola.
 *
 * ── 6. Res en segon pla ───────────────────────────────────────────────────
 * Ni Background Sync ni Periodic Background Sync. La precàrrega només avança
 * amb l'app oberta i la pantalla encesa; si l'usuari canvia d'app, iOS
 * congela la pestanya i les baixades s'aturen. Per això la barra de progrés
 * demana explícitament no tancar l'app.
 *
 * ── 7. La icona ve d'`apple-touch-icon`, no del manifest ──────────────────
 * iOS ignora l'array `icons` del manifest per a la pantalla d'inici i només
 * llegeix `<link rel="apple-touch-icon">`, que ha de ser PNG (l'SVG no li
 * val, i la transparència es converteix en negre).
 *
 * ── 8. El service worker es reinicia sovint ───────────────────────────────
 * WebKit mata el service worker molt més agressivament i té un límit de temps
 * per petició. És una raó més perquè la precàrrega la faci la pàgina (que
 * l'usuari veu i manté viva) i no el service worker.
 */

/** Cert en iPhone i iPad, incloent-hi l'iPad que es fa passar per Mac. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // Des d'iPadOS 13, l'iPad diu que és un Mac. La pista que el delata és que
  // té pantalla tàctil.
  return ua.includes('Macintosh') && navigator.maxTouchPoints > 1;
}

/** Cert si l'app corre instal·lada (sense barres del navegador). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const byMedia =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  // Safari no exposa `display-mode` fins fa poc: la propietat no estàndard
  // `navigator.standalone` és l'única pista fiable a iOS.
  const legacy = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return byMedia || legacy;
}

export interface InstallHint {
  /** Passos per instal·lar, en català i en ordre. */
  steps: string[];
  /** Motiu pel qual val la pena, en una frase. */
  reason: string;
}

/**
 * Instruccions d'instal·lació, o `null` si ja està instal·lada.
 *
 * A iOS no és cosmètic: instal·lar és l'única manera que les dades desades
 * sobrevisquin una setmana (punts 3 i 4 de dalt).
 */
export function installHint(): InstallHint | null {
  if (isStandalone()) return null;

  if (isIOS()) {
    return {
      reason:
        'A l’iPhone, el que baixis des del navegador es pot esborrar sol al cap de set dies. Instal·lada, no.',
      steps: [
        'Obre aquesta pàgina amb Safari.',
        'Toca el botó de compartir, a la barra de sota.',
        'Tria «Afegeix a la pantalla d’inici».',
        'Obre l’app des de la icona nova i prepara-hi el punt des d’allà.',
      ],
    };
  }

  return {
    reason: 'Instal·lada, s’obre sola en pantalla completa i les dades desades duren més.',
    steps: [
      'Obre el menú del navegador.',
      'Tria «Instal·la l’aplicació» o «Afegeix a la pantalla d’inici».',
    ],
  };
}
