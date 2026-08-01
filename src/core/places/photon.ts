/**
 * Client de Photon (https://photon.komoot.io), el geocodificador d'OpenStreetMap
 * que manté komoot.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PER QUÈ AQUEST I NO UN ALTRE. Es van comprovar quatre serveis amb la política
 * d'ús a la mà i amb consultes reals a punts rurals del nord d'Espanya, que és
 * on serà la gent el 12 d'agost de 2026.
 *
 * 1. NOMINATIM (OpenStreetMap Foundation) — DESCARTAT.
 *    La seva política d'ús diu literalment, sobre la cerca amb suggeriments:
 *    «Auto-complete search — this is not yet supported by Nominatim and you
 *    must not implement such a service». El cercador de llocs d'aquesta app és
 *    exactament això. A més fixa «an absolute maximum of 1 request per second»,
 *    desaconsella explícitament les peticions periòdiques des d'aplicacions i
 *    prohibeix les «systematic queries» com les consultes inverses en malla —
 *    que és el que sembla, des de fora, una app que posa nom a cada punt que
 *    l'usuari toca al mapa. Hi ha un problema tècnic afegit: demana un
 *    User-Agent identificatiu, i un navegador no deixa posar aquesta capçalera.
 *
 * 2. BIGDATACLOUD (reverse-geocode-client) — DESCARTAT, i no per gust.
 *    És gratuït, sense clau i sense límit, però la seva política d'ús permet
 *    només resoldre «the current, real-time location of the calling device» i
 *    prohibeix expressament les «pre-stored, cached, or externally-sourced
 *    coordinates», amb bloqueig d'IP com a sanció. Aquesta app fa les dues
 *    coses prohibides: posa nom a punts que l'usuari tria al mapa i DESA els
 *    resultats a la memòria cau, que és un requisit del projecte. Incompatible.
 *
 * 3. IGN / CARTOCIUDAD (cartociudad.es) — DESCARTAT com a principal.
 *    Molt bo pel que és: sense clau, sense quota, CC-BY 4.0 i amb
 *    `Access-Control-Allow-Origin: *`. Però és un geocodificador d'ADRECES
 *    POSTALS amb un radi de cerca inversa de 350 m. Consultat a 43,081 N /
 *    5,345 O (l'alt de San Isidro, línia central de 2026) torna el cos BUIT.
 *    Els miradors i els colls de muntanya —justament on anirà la gent— no
 *    tenen adreça postal. A més només cobreix Espanya, i el 2026 la franja
 *    passa a menys de 40 km de la frontera francesa.
 *
 * 4. PHOTON (komoot) — TRIAT.
 *    · Sense clau i sense registre: no hi ha cap secret a amagar dins d'una
 *      app que és tota client.
 *    · `Access-Control-Allow-Origin: *` verificat: es pot cridar del navegador.
 *    · Està FET per a cerca amb suggeriments; no hi ha cap prohibició com la
 *      de Nominatim.
 *    · Els paràmetres `radius` i `osm_tag` deixen demanar exactament el que ens
 *      cal —el nucli habitat més proper— en una sola petició.
 *    · La qualitat als nuclis rurals petits del nord és molt bona, perquè OSM
 *      té les parròquies i els llogarets etiquetats com `place=hamlet`. Provat:
 *      Bulnes de Arriba a 1,95 km des dels Picos de Europa; Villar de Navelgas
 *      a 1,17 km des de l'interior de Tinéu; Ipás a 1,68 km des de la
 *      Jacetania; la Valldan a 1,23 km des d'Odèn.
 *    · La resposta porta `Cache-Control: max-age=3600`, o sigui que el navegador
 *      ja ens estalvia part de la feina abans i tot d'arribar a la nostra
 *      memòria cau.
 *
 * EL QUE PHOTON DEMANA A CANVI, i que aquí es compleix:
 *    «You are welcome to use the API for your project as long as the number of
 *    requests stay in a reasonable limit. Extensive usage will be throttled or
 *    completely banned.» No publica cap xifra. Com que no n'hi ha, agafem la
 *    de Nominatim —1 petició per segon com a màxim absolut— de sostre prudent,
 *    perquè és l'única xifra publicada dins de la família OpenStreetMap.
 *    Tampoc garanteix disponibilitat: per això qualsevol fallada cau a les
 *    coordenades i no trenca res.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IDIOMA. El paràmetre `lang` de la instància pública només accepta
 * `default`, `de`, `en` i `fr` (comprovat: amb `lang=es` torna un error 400
 * amb la llista). Fem servir `default` a posta, que dona el nom LOCAL oficial:
 * "Oviedo / Uviéu", "Tinéu", "Sant Llorenç de Morunys". És el nom que la gent
 * diu i el que hi ha als cartells de la carretera; traduir topònims seria
 * inventar-se'ls.
 *
 * Cap dependència de DOM: aquest mòdul ha de poder córrer en Node.
 */

import { PlaceLookupError, type PlaceSuggestion, type Settlement } from './types';

const BASE_URL = 'https://photon.komoot.io';

/** Atribució obligatòria. Les dades són d'OSM (ODbL) i el servei, de komoot. */
export const PLACES_ATTRIBUTION =
  'Noms de lloc: Photon (komoot) sobre dades d’OpenStreetMap';

/** Enllaç de la llicència de les dades, per si es vol fer clicable. */
export const PLACES_ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright';

/**
 * Identificació de l'aplicació.
 *
 * Al navegador NO s'envia: `User-Agent` és una capçalera prohibida i el motor
 * l'ignora; el que sí que arriba és el `Referer` del nostre domini, que és el
 * mecanisme d'identificació que accepten tots els serveis de la família OSM.
 * Fora del navegador (Node, proves, scripts) no hi ha Referer i llavors sí que
 * la posem, que és quan serveix d'alguna cosa.
 */
export const PLACES_USER_AGENT =
  'eclipsi.info/1.0 (+https://lacuinade.estic.online/eclipsi/)';

/**
 * Temps màxim d'espera, en ms.
 *
 * Més curt que el de la meteorologia (12 s) a posta: el nom del lloc és un
 * adorn i, amb cobertura dolenta, val més quedar-se amb les coordenades de
 * seguida que tenir la interfície esperant.
 */
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Classes de `place` que compten com a nucli habitat.
 *
 * Es filtra a la petició amb `osm_tag` perquè si no la resposta s'omple de
 * `place=locality`, que a OSM són microtopònims DESHABITATS: consultat des de
 * l'alt de San Isidro, el resultat més proper sense filtre és "La Rapaona", un
 * paratge. Dir-li a algú que és a La Rapaona no l'ajuda a orientar-se.
 */
const SETTLEMENT_TAGS = ['place:city', 'place:town', 'place:village', 'place:hamlet'];

/**
 * Radi de cerca inversa, en km.
 *
 * Quaranta perquè hi ha trossos de la franja de 2026 —la Montaña Palentina, els
 * Monegros, el mar davant de la costa asturiana— on el nucli més proper queda
 * a més de vint-i-cinc. Passat el llindar no en direm el nom, però sí que en
 * volem la comarca, i la comarca ve dins del mateix resultat.
 */
const REVERSE_RADIUS_KM = 40;

/** Resultats demanats a la inversa. Amb cinc n'hi ha de sobres per triar. */
const REVERSE_LIMIT = 5;

/**
 * Marc de cerca del cercador de llocs: Península, Balears i Canàries.
 *
 * Els tres eclipsis del catàleg passen per aquí. Restringir-hi la cerca evita
 * que escriure "Cervera" tregui la Cervera de Lleida barrejada amb mig món.
 */
const SEARCH_BBOX = '-19.0,27.0,5.0,44.5';

/** Punt cap al qual s'esbiaixa la cerca si qui crida no en dona cap altre. */
const SEARCH_BIAS_LAT = 42.5;
const SEARCH_BIAS_LON = -4.0;

/* -------------------------------------------------------------- resposta */

interface PhotonProperties {
  name?: string;
  osm_id?: number;
  osm_type?: string;
  osm_key?: string;
  osm_value?: string;
  city?: string;
  county?: string;
  state?: string;
  district?: string;
  countrycode?: string;
}

interface PhotonFeature {
  geometry?: { coordinates?: number[] };
  properties?: PhotonProperties;
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

function isSettlementRank(value: string | undefined): value is Settlement['rank'] {
  return value === 'city' || value === 'town' || value === 'village' || value === 'hamlet';
}

/** "N240109189". `null` si la font no dona els dos camps. */
function osmIdOf(props: PhotonProperties): string | null {
  const type = props.osm_type;
  const id = props.osm_id;
  if (!type || typeof id !== 'number') return null;
  return `${type.toUpperCase()}${id}`;
}

/** Text que hi ha o `null`. Les cadenes buides compten com a absents. */
function text(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function coordsOf(feature: PhotonFeature): { lat: number; lon: number } | null {
  const c = feature.geometry?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const [lon, lat] = c;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

/* --------------------------------------------------------------- transport */

async function requestJson(
  url: string,
  fetchImpl: typeof fetch | undefined,
  signal: AbortSignal | undefined,
): Promise<PhotonResponse> {
  const doFetch = fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== 'function') {
    throw new PlaceLookupError('Aquest entorn no té `fetch`');
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  // Vegeu `PLACES_USER_AGENT`: al navegador la capçalera s'ignora i el que
  // identifica l'app és el Referer que hi posa el navegador tot sol.
  if (typeof window === 'undefined') headers['User-Agent'] = PLACES_USER_AGENT;

  // Doble avortament: el de qui ens ha cridat i el nostre temps màxim.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const response = await doFetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      throw new PlaceLookupError(`Photon ha respost HTTP ${response.status}`);
    }
    return (await response.json()) as PhotonResponse;
  } catch (error) {
    if (error instanceof PlaceLookupError) throw error;
    throw new PlaceLookupError('No s’ha pogut consultar Photon', error);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/* ------------------------------------------------------ inversa: coord → nom */

/**
 * Nuclis habitats a l'entorn d'un punt, sense ordenar per distància.
 *
 * NO decideix res: només porta la llista. Qui tria el candidat i qui redacta la
 * frase són `resolver.ts` i `describe.ts`, que es poden provar sense xarxa.
 *
 * Les coordenades van amb cinc decimals (~1 m) i no amb més: la clau de la
 * memòria cau ja les ha arrodonides a la cel·la de 100 m, i afegir decimals
 * només serviria per fer variants d'URL que trencarien la memòria cau HTTP.
 */
export async function fetchNearbySettlements(
  lat: number,
  lon: number,
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<Settlement[]> {
  const params = new URLSearchParams({
    lat: lat.toFixed(5),
    lon: lon.toFixed(5),
    lang: 'default',
    limit: String(REVERSE_LIMIT),
    radius: String(REVERSE_RADIUS_KM),
  });
  for (const tag of SETTLEMENT_TAGS) params.append('osm_tag', tag);

  const payload = await requestJson(
    `${BASE_URL}/reverse?${params.toString()}`,
    options.fetchImpl,
    options.signal,
  );

  const out: Settlement[] = [];
  for (const feature of payload.features ?? []) {
    const props = feature.properties ?? {};
    const coords = coordsOf(feature);
    const name = text(props.name);
    if (!coords || !name || !isSettlementRank(props.osm_value)) continue;
    out.push({
      name,
      rank: props.osm_value,
      lat: coords.lat,
      lon: coords.lon,
      county: text(props.county),
      state: text(props.state),
      countryCode: text(props.countrycode)?.toLowerCase() ?? null,
      osmId: osmIdOf(props),
    });
  }
  return out;
}

/* -------------------------------------------------------- directa: nom → coord */

/**
 * Classes que val la pena ensenyar al cercador.
 *
 * Fora queden botigues, parades d'autobús i cartells informatius, que la
 * resposta en va plena: buscant "Pola de Somiedo" el primer resultat és una
 * parada d'autobús. Dins hi entren els cims i els colls, perquè són el que la
 * gent escriu de veritat quan busca on plantar-se.
 */
function suggestionKind(props: PhotonProperties): PlaceSuggestion['kind'] | null {
  const key = props.osm_key;
  const value = props.osm_value;

  if (key === 'place' && isSettlementRank(value)) return 'settlement';
  // `boundary=administrative` és el municipi. Serveix, però el seu punt és el
  // centroide del polígon, no el poble; queda com a "other" i baixa a la llista.
  if (key === 'boundary' && value === 'administrative') return 'other';
  if (key === 'natural' && (value === 'peak' || value === 'saddle')) return 'peak';
  if (key === 'mountain_pass') return 'peak';
  if (key === 'tourism' && value === 'viewpoint') return 'other';
  return null;
}

/** Ordre de preferència: primer pobles, després cims, després la resta. */
const KIND_ORDER: Record<PlaceSuggestion['kind'], number> = {
  settlement: 0,
  peak: 1,
  other: 2,
};

/**
 * Cerca de llocs pel nom.
 *
 * `bbox` retalla a Ibèria, Balears i Canàries i `lat`/`lon` esbiaixen cap al
 * centre de la franja; totes dues coses són el que fa que escrivint "Cervera"
 * surti la de la Segarra i no una de Filipines.
 */
export async function fetchPlaceSearch(
  query: string,
  options: {
    limit?: number;
    biasLat?: number;
    biasLon?: number;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  } = {},
): Promise<PlaceSuggestion[]> {
  const limit = options.limit ?? 8;
  const params = new URLSearchParams({
    q: query,
    lang: 'default',
    // Demanem més del que ensenyarem perquè el filtre de classes en llença.
    limit: String(Math.min(20, limit * 3)),
    bbox: SEARCH_BBOX,
    lat: (options.biasLat ?? SEARCH_BIAS_LAT).toFixed(4),
    lon: (options.biasLon ?? SEARCH_BIAS_LON).toFixed(4),
  });

  const payload = await requestJson(
    `${BASE_URL}/api?${params.toString()}`,
    options.fetchImpl,
    options.signal,
  );

  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];

  for (const feature of payload.features ?? []) {
    const props = feature.properties ?? {};
    const coords = coordsOf(feature);
    const name = text(props.name);
    const kind = suggestionKind(props);
    if (!coords || !name || !kind) continue;

    // La mateixa vila surt sovint dues vegades (el node del poble i el polígon
    // del municipi). Amb el nom i la comarca n'hi ha prou per adonar-se'n.
    const dedupeKey = `${name}|${props.county ?? ''}|${kind}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const context = [text(props.city), text(props.county), text(props.state)]
      .filter((part): part is string => part !== null && part !== name)
      .join(' · ');

    out.push({
      name,
      context,
      lat: coords.lat,
      lon: coords.lon,
      kind,
      osmId: osmIdOf(props),
    });
  }

  // Estable: la font ja ordena per rellevància i només reordenem per classe.
  out.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  return out.slice(0, limit);
}
