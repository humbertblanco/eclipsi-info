/**
 * Historial dels últims llocs, desat al dispositiu.
 *
 * PER QUÈ EXISTEIX. Qui planifica un eclipsi no mira un lloc: en compara uns
 * quants. Mira el poble on té la casa, mira el port de muntanya de vint
 * quilòmetres més enllà, torna al poble. Sense historial, cada tornada és
 * tornar a buscar el lloc, i com que buscar-lo requereix xarxa i el dia de
 * l'eclipsi la xarxa cau, la comparació es perd justament quan importa.
 *
 * COM ESTÀ PARTIT. Les funcions pures (`mergeRecent`, `parseRecents`) estan
 * separades de les que toquen `localStorage` a posta: les primeres es poden
 * provar en entorn Node, que és on corren els tests d'aquest projecte, i les
 * segones són quatre línies amb un `try` que no tenen cap lògica per provar.
 *
 * PER QUÈ TOT VA DINS D'UN `try`. Safari en mode privat llança en accedir a
 * `localStorage`. Un historial que peta no pot endur-se l'app: si no es pot
 * desar, l'app funciona igual i l'historial dura una sessió.
 */

import type { GeoLocation } from '../core/astro/types';
import type { ElevationSource } from './location';
import {
  isElevationSource,
  isLocationOrigin,
  isSamePlace,
  type LocationOrigin,
} from './location';

/** Clau de `localStorage`. Prefixada per no xocar amb res més del domini. */
export const RECENTS_KEY = 'eclipsi.places.recent';

/**
 * Quants llocs es guarden.
 *
 * D'ON SURT EL 8. La llista es llegeix dins d'una fulla que a un mòbil de
 * 390 × 844 px en té uns 500 d'alçada útil, i cada fila ha de fer com a mínim
 * els 44 px de `--tap-min` per poder-se tocar amb el dit. 500 / 56 ≈ 8. Amb
 * més entrades la llista es desplaça dins d'una fulla que ja es desplaça, que
 * és la manera segura de no trobar mai res.
 */
export const MAX_RECENTS = 8;

/** Una entrada de l'historial. És el mínim per poder-hi tornar. */
export interface RecentPlace {
  lat: number;
  lon: number;
  /** Altitud en metres. */
  elevation: number;
  /**
   * D'on va sortir aquella altitud.
   *
   * ES DESA PERQUÈ SENSE ELLA S'HA DE MENTIR EN RESTAURAR. Abans no hi era i
   * el codi de restauració declarava `'dem'` a pèl, raonant que «ja venia del
   * model i el terreny no es mou». Però `resolveElevation` retorna zero amb
   * font `'assumed'` quan la tessel·la falla, i un punt a 1.520 m desat sense
   * cobertura tornava com a «0 m del model del terreny»: l'avís desapareixia i
   * aquell zero viatjava a la resta de càlculs com si fos bo.
   */
  elevationSource?: ElevationSource;
  /** Nom si se'n coneix. Sense xarxa no n'hi ha, i llavors manen les coordenades. */
  label: string | null;
  /** D'on va sortir. Es guarda perquè la llista pugui dir «aquest era el GPS». */
  origin: LocationOrigin;
  /** Quan es va visitar per última vegada, en ms d'època. */
  atMs: number;
}

/**
 * Cert si el valor té la forma d'una entrada aprofitable.
 *
 * ELS DOS CAMPS D'ENUMERACIÓ ES COMPROVEN CONTRA ELS VALORS QUE EXISTEIXEN, no
 * només contra el tipus. Abans n'hi havia prou amb `typeof v.origin === 'string'`
 * i això deixava passar `origin: 'HACK'` o `elevationSource: 'moon'`, que no són
 * dades corruptes teòriques: hi arriba qualsevol build vell amb un valor que
 * després es va treure, i qualsevol persona que obri les eines del navegador.
 * Un origen desconegut fa petar el text de la barra de la ubicació, que està
 * FORA de l'`ErrorBoundary`, i com que el valor es rellegeix del disc a cada
 * arrencada, l'app es queda en blanc també a la propera. Vegeu
 * `isLocationOrigin` a `location.ts`.
 */
function isRecentPlace(value: unknown): value is RecentPlace {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.lat === 'number' &&
    Number.isFinite(v.lat) &&
    Math.abs(v.lat) <= 90 &&
    typeof v.lon === 'number' &&
    Number.isFinite(v.lon) &&
    Math.abs(v.lon) <= 180 &&
    typeof v.elevation === 'number' &&
    Number.isFinite(v.elevation) &&
    (v.label === null || typeof v.label === 'string') &&
    isLocationOrigin(v.origin) &&
    // Les entrades d'abans que existís el camp no en porten. Que no hi sigui és
    // legítim i vol dir «no se sap»; el que no pot passar és que hi sigui amb
    // un valor que no sabem interpretar.
    (v.elevationSource === undefined || isElevationSource(v.elevationSource)) &&
    typeof v.atMs === 'number' &&
    Number.isFinite(v.atMs)
  );
}

/**
 * Com es desa la font de l'altitud.
 *
 * `pending` NO ES DESA MAI. Vol dir «la tessel·la del terreny està de camí», i
 * una petició de xarxa no sobreviu a tancar l'app: en tornar-la a obrir només en
 * queda el zero que hi havia mentrestant. Desat tal qual, un punt a 1.520 m que
 * es tanqués abans que arribés la tessel·la tornava com a 1.520 → 0 m i les
 * hores dels contactes es calculaven al nivell del mar per a algú que és a
 * mitja muntanya. Es desa com a `assumed`, que és exactament el que era: no ho
 * sabíem i hi havia un zero. Així l'avís de la barra surt i, en restaurar,
 * `useObserver` torna a demanar l'altitud de tot el que no sigui `dem`.
 */
export function persistedElevationSource(source: ElevationSource): ElevationSource {
  return source === 'pending' ? 'assumed' : source;
}

/**
 * Llegeix la llista d'un text JSON, descartant el que no tingui forma bona.
 *
 * PER QUÈ ES VALIDA ENTRADA A ENTRADA i no es confia en el `JSON.parse`: el
 * contingut de `localStorage` és de l'usuari i sobreviu a les versions de
 * l'app. Una entrada d'un format vell amb `lat` com a text faria petar el
 * càlcul d'efemèrides amb un `NaN` que aniria a parar a la pantalla en forma
 * d'hora invàlida, molt lluny d'aquí. Es descarta i ja està.
 */
export function parseRecents(raw: string | null): RecentPlace[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentPlace).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

/**
 * Afegeix un lloc a la llista i en torna una de nova. Funció pura.
 *
 * TRES REGLES:
 *
 * 1. El més recent va primer. És l'ordre en què es busca amb el dit.
 * 2. Un lloc a menys de `SAME_PLACE_M` d'un que ja hi és NO és una entrada
 *    nova: és el mateix lloc, i el que fa és pujar a dalt. Sense això, prémer
 *    «On soc ara» tres vegades omplia l'historial amb tres versions del mateix
 *    banc del parc, cadascuna amb les seves coordenades del GPS, i els llocs
 *    de debò en queien pel final.
 * 3. En fusionar es queda el nom que hi hagi. Un punt tocat al mapa damunt
 *    d'un lloc que ja tenia nom no li ha de robar el nom.
 */
export function mergeRecent(
  list: readonly RecentPlace[],
  entry: RecentPlace,
): RecentPlace[] {
  const target: GeoLocation = {
    lat: entry.lat,
    lon: entry.lon,
    elevation: entry.elevation,
  };

  const previous = list.find((item) =>
    isSamePlace({ lat: item.lat, lon: item.lon, elevation: item.elevation }, target),
  );

  const merged: RecentPlace = {
    ...entry,
    label: entry.label ?? previous?.label ?? null,
  };

  const rest = list.filter((item) => item !== previous);
  return [merged, ...rest].slice(0, MAX_RECENTS);
}

/**
 * Treu un lloc de la llista. Es compara per proximitat i no per identitat
 * d'objecte perquè qui prem la creu té una fila pintada, no una referència.
 */
export function removeRecent(
  list: readonly RecentPlace[],
  target: GeoLocation,
): RecentPlace[] {
  return list.filter(
    (item) =>
      !isSamePlace(
        { lat: item.lat, lon: item.lon, elevation: item.elevation },
        target,
      ),
  );
}

/* --- persistència -------------------------------------------------------- */

export function readRecents(): RecentPlace[] {
  try {
    return parseRecents(window.localStorage.getItem(RECENTS_KEY));
  } catch {
    return [];
  }
}

export function writeRecents(list: readonly RecentPlace[]): void {
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    // Sense espai o en mode privat. L'historial durarà aquesta sessió.
  }
}

/* --- l'últim lloc, per tornar-hi en obrir l'app -------------------------- */

/**
 * Clau de l'últim lloc triat.
 *
 * PER QUÈ VA A PART DE L'HISTORIAL i no s'agafa el primer de la llista: no
 * tots els llocs de l'historial han estat el lloc actiu (comparar-ne un no el
 * fa teu), i sobretot perquè així es pot esborrar l'historial sense perdre el
 * punt sobre el qual s'estan mirant les xifres.
 */
export const LAST_PLACE_KEY = 'eclipsi.places.last';

/**
 * Llegeix l'últim lloc d'un text JSON. Funció pura, per poder-la provar.
 *
 * ÉS LA VALIDACIÓ QUE MÉS IMPORTA de tot el fitxer: aquest és l'únic valor que
 * es pinta a la barra de la ubicació sense que l'usuari hagi tocat res, o sigui
 * que si passa alguna cosa que no s'entén, l'app peta abans d'ensenyar res.
 */
export function parseLastPlace(raw: string | null): RecentPlace | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecentPlace(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readLastPlace(): RecentPlace | null {
  try {
    return parseLastPlace(window.localStorage.getItem(LAST_PLACE_KEY));
  } catch {
    return null;
  }
}

export function writeLastPlace(entry: RecentPlace | null): void {
  try {
    if (entry === null) window.localStorage.removeItem(LAST_PLACE_KEY);
    else window.localStorage.setItem(LAST_PLACE_KEY, JSON.stringify(entry));
  } catch {
    // Igual que amb l'historial: no és fatal.
  }
}

/* --- si ja hem explicat per què demanem la ubicació ---------------------- */

/**
 * Clau del fet d'haver explicat per què cal la ubicació.
 *
 * NO guarda si l'usuari va dir que sí: això ho sap el navegador i és seu.
 * Guarda que ja li ho hem PREGUNTAT, perquè la pantalla d'explicació surti un
 * cop i no cada vegada que s'obre l'app.
 */
export const ASKED_KEY = 'eclipsi.location.asked';

export function readAsked(): boolean {
  try {
    return window.localStorage.getItem(ASKED_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeAsked(): void {
  try {
    window.localStorage.setItem(ASKED_KEY, '1');
  } catch {
    // Si no es pot desar, l'explicació tornarà a sortir. És el mal menor.
  }
}
