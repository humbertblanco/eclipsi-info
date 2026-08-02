/**
 * El punt de l'observador, dins de l'URL.
 *
 * PER QUÈ EXISTEIX. Aquesta app respon una pregunta que només té sentit des d'un
 * punt concret: quants segons hi duraràs, a quina hora i si hi ha una muntanya
 * al mig. Fins ara aquell punt vivia només al `localStorage` del dispositiu que
 * el va triar, o sigui que la frase que la gent es diu de debò quan prepara una
 * sortida —«ens trobem aquí»— no es podia dir amb l'app. S'havia de dictar unes
 * coordenades per WhatsApp i l'altra persona les havia de tornar a escriure a
 * mà, amb totes les possibilitats d'equivocar-se que això té. Amb el punt a
 * l'URL, l'enllaç és el missatge: qui l'obre veu les SEVES xifres del NOSTRE
 * lloc, sense escriure res.
 *
 * PER QUÈ AQUEST FITXER ÉS PUR. No hi ha ni un `window`, ni un `history`, ni un
 * `document`: qui crida hi passa el `location.search` i rep un text de tornada.
 * És l'única manera que això es pugui provar amb els tests d'aquest projecte,
 * que corren a Node i no tenen DOM, i la part que cal provar és justament
 * aquesta: què fem amb el que ens arriba per l'URL, que és el canal MENYS de
 * confiança que té l'app. Una coordenada de l'URL l'ha escrita qualsevol, pot
 * venir retallada per un client de correu, o pot ser un `?p=` buit d'un enllaç
 * copiat a mitges.
 *
 * EL FORMAT, I PER QUÈ ÉS AQUEST:
 *
 *     ?p=42.12345,1.56789&e=2026-08-12&n=Coll%20de%20Narg%C3%B3
 *
 *   · `p` (obligatori) el punt, «lat,lon» en graus decimals. Un sol paràmetre i
 *     no dos perquè el punt és una cosa sola: amb `lat` i `lon` per separat
 *     existeix l'enllaç a mig retallar que porta latitud i no longitud, i llavors
 *     s'ha de decidir què fer amb mig punt. Amb un de sol, o hi és sencer o no
 *     hi és.
 *   · `e` (opcional) quin dels tres eclipsis es mirava. Es valida contra el
 *     catàleg.
 *   · `n` (opcional) el nom del lloc, per no dependre de la xarxa. Qui obre
 *     l'enllaç al cim, sense cobertura, no pot resoldre el topònim: si el nom
 *     viatja amb l'enllaç, la barra diu «Coll de Nargó» i no unes coordenades.
 *
 * LES LLETRES SÓN CURTES A POSTA. L'enllaç s'enganxa dins d'un missatge i molts
 * clients el trenquen per la meitat a partir d'una certa llargada; `?p=` i `&e=`
 * en comptes de `?point=` i `&eclipse=` estalvien una dotzena de caràcters que
 * no diuen res a ningú que llegeixi l'URL.
 */

import { ECLIPSES } from '../../core/eclipses/catalog';

/**
 * Decimals de les coordenades a l'enllaç. Cinc.
 *
 * D'ON SURT EL 5. Cinc decimals de latitud són 1,1 m i, a les latituds de la
 * franja (39°-44° N), cinc de longitud són entre 0,8 i 0,9 m. És dos ordres de
 * magnitud més fi que `SAME_PLACE_M` (150 m, el radi per sota del qual aquesta
 * app declara honestament que no pot distingir dos punts), o sigui que
 * l'arrodoniment de l'enllaç no pot canviar cap veredicte.
 *
 * I NO MÉS, perquè els decimals de més són mentida i ocupen. Set decimals són
 * un centímetre: cap GPS de mòbil els té, cap mapa els permet tocar, i l'única
 * cosa que fan és allargar un text que ha de cabre dins d'un missatge.
 */
export const SHARE_DECIMALS = 5;

/**
 * Llargada màxima de l'etiqueta que viatja per l'URL.
 *
 * D'ON SURT EL 60. El topònim més llarg que torna el cercador per a la zona de
 * la franja ronda els quaranta caràcters («Sant Julià de Cerdanyola i Fresser»,
 * «Villanueva de la Peña de Cabezón de Liébana»); seixanta hi deixen marge i
 * alhora posen un sostre a què pot injectar algú a l'enllaç. Sense sostre, el
 * `n` és un camp de text lliure de mida il·limitada que va a parar directament
 * a la barra de la ubicació i al `localStorage` de qui obre l'enllaç.
 *
 * ES RETALLA I NO ES REBUTJA: un nom massa llarg no és motiu per llençar el
 * punt, que és el que val de l'enllaç. Del nom se n'aprofita el que hi cap.
 */
export const MAX_LABEL_CHARS = 60;

/** Un punt que ha arribat per l'URL, ja validat. L'altitud la resol el terreny. */
export interface SharedPoint {
  lat: number;
  lon: number;
  /** Id del catàleg, o `null` si l'enllaç no en portava cap de reconeixible. */
  eclipseId: string | null;
  /** Nom del lloc si l'enllaç en portava, ja retallat. */
  label: string | null;
}

/** El que cal per construir un enllaç. Només `lat` i `lon` són obligatoris. */
export interface ShareLinkParams {
  lat: number;
  lon: number;
  eclipseId?: string | null;
  label?: string | null;
}

/**
 * Un número de l'URL, llegit amb desconfiança.
 *
 * PER QUÈ NO N'HI HA PROU AMB `Number()`. `Number('')` és 0 i `Number(' ')`
 * també, o sigui que un `?p=,` —un enllaç copiat a mitges— passaria per un punt
 * perfectament vàlid al golf de Guinea i l'app es posaria a calcular-hi hores de
 * contacte com si res. `Number('0x1f')` és 31 i `Number('1e400')` és infinit.
 * Aquí el format el generem nosaltres i és sempre un decimal pla: acceptar
 * qualsevol altra cosa només obre portes.
 */
const PLAIN_NUMBER = /^-?\d+(?:\.\d+)?$/;

function readNumber(text: string): number | null {
  if (!PLAIN_NUMBER.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/**
 * Arrodoneix una coordenada a la precisió de l'enllaç i en treu el zero negatiu.
 *
 * ÉS LA MATEIXA FUNCIÓ PER ESCRIURE I PER LLEGIR, i això no és estalvi de línies:
 * és el que fa que `parse(build(p))` doni exactament `p` i que `build(parse(t))`
 * doni exactament `t`. Amb dues normalitzacions diferents a cada banda hi hauria
 * un forat per on el punt que s'envia i el que es rep divergeixen, i divergir
 * aquí vol dir mirar les xifres d'un altre lloc sense que res ho digui.
 *
 * EL ZERO NEGATIU JA HA MOSSEGAT DUES VEGADES EN AQUEST PROJECTE. `-0` és igual a
 * `0` amb `===` i es pinta com a «0», o sigui que no es veu enlloc fins que algú
 * el fa servir per fabricar una CLAU: `(-0).toFixed(3)` és `'-0.000'` i
 * `(0).toFixed(3)` és `'0.000'`, que són dues entrades diferents de la mateixa
 * cel·la. Va passar a la memòria cau de topònims (`core/places/cache.ts`, que per
 * això té `snapCoordinate`) i encara hi és a `offline/store.ts`, que fa servir
 * `${lat.toFixed(3)},${lon.toFixed(3)}` com a clau primària d'IndexedDB.
 *
 * L'URL ÉS EL CAMÍ MÉS CURT PER TORNAR-LO A INTRODUIR: `?p=-0,-0` és un text que
 * qualsevol pot escriure, i el meridià de Greenwich i l'equador no són llocs
 * teòrics. I no n'hi ha prou de mirar el signe del text: una longitud de
 * −0,0000004° —uns tres centímetres a l'oest de Greenwich, que és el soroll d'un
 * GPS qualsevol— arrodonida a cinc decimals ÉS `-0`. Per això la neteja va
 * DESPRÉS de l'arrodoniment i no abans.
 */
function snap(value: number): number {
  const rounded = Number(value.toFixed(SHARE_DECIMALS));
  return rounded === 0 ? 0 : rounded;
}

/** Cert si l'id és d'un eclipsi que aquesta versió sap calcular. */
function isKnownEclipse(id: string): boolean {
  return ECLIPSES.some((entry) => entry.id === id);
}

/**
 * Llegeix el punt d'una cadena de consulta. `null` si no n'hi ha cap de vàlid.
 *
 * QUI CRIDA HI PASSA EL `location.search`; aquí no es toca el `window`. La
 * cadena pot venir amb `?` al davant o sense: `URLSearchParams` accepta les
 * dues, i qui crida no ha d'haver de recordar quina li toca.
 *
 * LES TRES REGLES DE VALIDACIÓ, i totes tres tenen la mateixa forma —davant del
 * dubte, el punt és el que mana:
 *
 *  1. SENSE `p` VÀLID NO HI HA ENLLAÇ. Un `e` i un `n` sense punt no serveixen
 *     de res: el nom d'un lloc que no sabem on és no es pot pintar, i canviar
 *     d'eclipsi sense canviar de lloc no és compartir res.
 *  2. UN `e` QUE NO ÉS DEL CATÀLEG ES DESCARTA, PERÒ EL PUNT ES QUEDA. Un id
 *     d'un eclipsi que aquesta versió encara no té (o que ja no té) no ha de
 *     fer perdre el lloc: l'app s'obre amb l'eclipsi de sempre, al punt correcte.
 *     Passar-lo endavant sí que seria greu, perquè `getEclipse` llança i el que
 *     hi ha darrere és tota la pantalla.
 *  3. UN `n` BUIT ÉS `null` I NO CADENA BUIDA. `placeTitle` mira `label !== ''`
 *     justament perquè una etiqueta buida deixaria la barra sense res, i aquí la
 *     cadena buida arriba sola: `?n=` és el que queda quan algú comparteix un
 *     punt del mapa que encara no tenia nom.
 */
export function parseShareLink(search: string): SharedPoint | null {
  if (search === '' || search === '?') return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    // No hauria de passar mai —`URLSearchParams` no llança amb text—, però
    // aquesta funció és la porta d'entrada d'un canal que no controlem i el
    // preu de la guarda és una línia.
    return null;
  }

  const point = params.get('p');
  if (point === null) return null;

  const parts = point.split(',');
  if (parts.length !== 2) return null;

  const lat = readNumber(parts[0].trim());
  const lon = readNumber(parts[1].trim());
  if (lat === null || lon === null) return null;

  // Els límits són els del planeta i s'hi inclouen: ±90 de latitud són els pols
  // i ±180 de longitud és l'antimeridià, que són llocs, no errors. El que no ho
  // és, és qualsevol cosa de fora: una latitud de 91 no és un punt arrodonit,
  // és un enllaç trencat o una broma, i calcular-hi efemèrides donaria xifres
  // que semblen bones.
  //
  // ES MIRA ABANS D'ARRODONIR a posta: si es mirés després, un 90,000004 hauria
  // quedat convertit en un 90 legítim i l'enllaç trencat passaria per bo.
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  const eclipse = params.get('e');
  const label = params.get('n');

  return {
    lat: snap(lat),
    lon: snap(lon),
    eclipseId: eclipse !== null && isKnownEclipse(eclipse) ? eclipse : null,
    label: readLabel(label),
  };
}

/** El nom retallat, o `null` si no n'hi ha cap d'aprofitable. */
function readLabel(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  return trimmed.slice(0, MAX_LABEL_CHARS);
}

/**
 * Escriu una coordenada per a l'URL.
 *
 * ES TREUEN ELS ZEROS DE LA CUA. `toFixed(5)` de 42,1 dona «42.10000», que són
 * quatre caràcters que no diuen res, dos cops a cada enllaç, en un text que molts
 * clients de missatgeria trenquen per llargada. `snap` ja torna un número i
 * `String` d'un número no els escriu.
 */
function writeCoordinate(value: number): string {
  return String(snap(value));
}

/**
 * Construeix la cadena de consulta d'un enllaç, amb el `?` inclòs.
 *
 * TORNA NOMÉS LA CONSULTA I NO UN URL SENCER a posta: aquesta funció no sap —ni
 * ha de saber— en quin domini ni en quin subdirectori viu l'app. Qui crida ja hi
 * és a dins i té el camí; aquí només es diu què hi ha darrere del `?`.
 *
 * ES MUNTA A MÀ I NO AMB `URLSearchParams.toString()` per una diferència que es
 * veu: aquell escriu els espais com a `+` i les comes com a `%2C`, i el que en
 * surt és `p=42.12345%2C1.56789&n=Coll+de+Narg%C3%B3`. Es llegeix igual de bé
 * per màquina i molt pitjor per persona, i aquest text la gent l'enganxa dins
 * de missatges on el llegeix algú abans de tocar-lo. La coma és un caràcter
 * legítim dins d'una consulta i no cal escapar-la.
 *
 * L'ECLIPSI NOMÉS HI VA SI ÉS DEL CATÀLEG. Escriure'n un que no existeix seria
 * fabricar l'enllaç trencat que `parseShareLink` es dedica a defensar.
 */
export function buildShareLink(params: ShareLinkParams): string {
  const parts = [`p=${writeCoordinate(params.lat)},${writeCoordinate(params.lon)}`];

  const eclipseId = params.eclipseId ?? null;
  if (eclipseId !== null && isKnownEclipse(eclipseId)) {
    parts.push(`e=${encodeURIComponent(eclipseId)}`);
  }

  const label = readLabel(params.label ?? null);
  if (label !== null) parts.push(`n=${encodeURIComponent(label)}`);

  return `?${parts.join('&')}`;
}
