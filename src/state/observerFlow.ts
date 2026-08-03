/**
 * El guió de fixar un punt, sense React.
 *
 * PER QUÈ VIU A PART DEL HOOK. El que decideix aquest fitxer és l'ORDRE de dues
 * coses —fixar la posició i resoldre l'altitud— i quina de les dues es pot fer
 * esperar. És la lògica que més ha fet mal d'aquesta app i alhora és la que
 * costa més de provar, perquè al hook va enredada amb `useState`, `useRef` i el
 * navegador. Els tests d'aquest projecte corren a Node i no tenen DOM: si
 * l'ordre viu dins del hook, no el prova ningú. Aquí es pot provar amb una
 * altitud que no arriba mai i un tiquet que canvia a mitges, que són exactament
 * els dos casos que han fet mal.
 *
 * LA REGLA, EN UNA LÍNIA: la posició horitzontal es fixa a l'instant i l'altitud
 * arriba després. Mai al revés. Esperar l'altitud vol dir esperar una tessel·la
 * del terreny, que és una petició de xarxa sense temps màxim; el dia de
 * l'eclipsi, amb quinze mil persones penjades de la mateixa antena, aquesta
 * petició pot no tornar mai. La posició ja la sabíem des del primer segon.
 */

import type { GeoLocation } from '../core/astro/types';
import type { ElevationSource, FixedLocation, LocationOrigin } from './location';
import { persistedElevationSource, type RecentPlace } from './recentPlaces';

/** Un lloc que es demana fixar. L'altitud la resol el hook, no qui el crida. */
export interface PlacePick {
  lat: number;
  lon: number;
  origin: LocationOrigin;
  /** Nom, si qui el tria ja el sap (per exemple un resultat de la cerca). */
  label?: string | null;
  /**
   * Altitud ja sabuda D'AQUEST MATEIX PUNT, amb la seva font, si qui el tria
   * la porta: una entrada de l'historial la té desada amb les seves pròpies
   * coordenades, o sigui que és exacta i no una aproximació.
   *
   * EL CAS QUE HO VA DESTAPAR. Planifiques a casa, el refugi queda a
   * l'historial amb els seus 1.520 m del model del terreny; puges, sense
   * cobertura, i el repesques de la llista. Sense aquests camps, repescar-lo
   * era un `pending` amb zero, la tessel·la no arribava mai, i el punt es
   * quedava com a «altitud desconeguda: nivell del mar» — destruint una dada
   * bona que l'app JA TENIA al disc, i just el dia que no es pot recuperar.
   */
  elevation?: number;
  elevationSource?: ElevationSource;
}

/** El que torna el model del terreny, amb la seva procedència enganxada. */
export interface ResolvedElevation {
  elevation: number;
  source: ElevationSource;
}

/**
 * Quina de les dues passades és.
 *
 * Qui fa la crida ho necessita per decidir si desa: en restaurar l'últim lloc,
 * la primera passada no s'ha de tornar a escriure al disc (ja ve d'allà) però
 * l'altitud represa sí, o cada arrencada la tornaria a demanar per sempre.
 */
export type FixPhase = 'placed' | 'elevation';

/** El punt tal com queda a l'instant de triar-lo, amb l'altitud per resoldre. */
export function fixFromPick(pick: PlacePick, atMs: number): FixedLocation {
  /*
   * NOMÉS S'APROFITA L'ALTITUD DEL MODEL DEL TERRENY. És l'única que no cal
   * revisar (el terreny no es mou, i és la mateixa regla que `needsElevation`
   * aplica en restaurar). Una de `gps` o `assumed` que vingués desada segueix
   * el camí de sempre: `pending` i tornar-la a demanar, que potser avui hi ha
   * xarxa i es pot arreglar.
   */
  const dem =
    pick.elevationSource === 'dem' &&
    pick.elevation !== undefined &&
    Number.isFinite(pick.elevation)
      ? pick.elevation
      : null;

  return {
    location: { lat: pick.lat, lon: pick.lon, elevation: dem ?? 0 },
    origin: pick.origin,
    label: pick.label ?? null,
    accuracyM: null,
    elevationSource: dem === null ? 'pending' : 'dem',
    gpsElevationM: null,
    atMs,
    restored: false,
  };
}

/** Camps del GPS que ens interessen. Els altres (velocitat, rumb) no en tenen. */
export interface PositionFields {
  lat: number;
  lon: number;
  /** Precisió HORITZONTAL declarada pel dispositiu, en metres. */
  accuracyM: number;
  /** Altitud que deia el GPS, si en deia. Mai s'usa per calcular. */
  gpsElevationM: number | null;
}

/**
 * El punt tal com queda quan el GPS respon.
 *
 * L'ALTITUD ENCARA NO HI ÉS, I ÉS TOT EL SENTIT D'AQUESTA FUNCIÓ. Abans el hook
 * esperava la tessel·la del terreny abans de donar la posició per bona. El cas
 * que ho va destapar: el dia de l'eclipsi, amb cobertura dolenta, el GPS respon
 * als 12 s i la tessel·la es queda penjada 8 s més; durant vint segons sencers
 * la barra deia «Cercant el senyal…» i `fix` era `null` tot i que la posició
 * feia estona que se sabia. La posició es dona ara; l'altitud, quan arribi.
 */
export function fixFromPosition(pos: PositionFields, atMs: number): FixedLocation {
  return {
    location: { lat: pos.lat, lon: pos.lon, elevation: 0 },
    origin: 'gps',
    label: null,
    accuracyM: pos.accuracyM,
    elevationSource: 'pending',
    gpsElevationM: pos.gpsElevationM,
    atMs,
    restored: false,
  };
}

/**
 * El punt tal com torna del disc en obrir l'app.
 *
 * Es marca `restored` perquè la interfície pugui dir que ve d'una altra estona.
 * La font de l'altitud és la que es va desar i no una de suposada: les entrades
 * antigues no en porten, i llavors la resposta honesta és «no se sap», que és el
 * que vol dir `assumed`.
 */
export function fixFromStored(last: RecentPlace): FixedLocation {
  return {
    location: { lat: last.lat, lon: last.lon, elevation: last.elevation },
    origin: last.origin,
    label: last.label,
    accuracyM: null,
    elevationSource: last.elevationSource ?? 'assumed',
    gpsElevationM: null,
    atMs: last.atMs,
    restored: true,
  };
}

/**
 * Un punt que ha arribat per l'URL.
 *
 * ES DECLARA AQUÍ I NO S'IMPORTA DE `features/share` A POSTA. `src/features`
 * depèn de `src/state` (`features/location/origin.ts` importa `LocationOrigin`
 * d'aquí mateix) i la fletxa no ha d'anar en tots dos sentits: aquest fitxer és
 * el guió de fixar un punt i ha de poder-se llegir i provar sense arrossegar-hi
 * mig mòdul de vistes. La forma és la de `SharedPoint`, que hi encaixa sense
 * conversions perquè en té els mateixos camps i algun més.
 */
export interface LinkedPoint {
  lat: number;
  lon: number;
  /** Nom que viatjava amb l'enllaç, si en portava. */
  label: string | null;
}

/**
 * El punt tal com queda quan arriba per un enllaç.
 *
 * `restored` ÉS FALS, i la diferència amb `fixFromStored` no és cosmètica. Un
 * punt restaurat ve d'una sessió anterior i la nota de la barra diu «això ve de
 * l'última vegada que vas obrir l'app», que és un avís de possible obsolescència.
 * Un punt d'un enllaç acaba d'arribar, ara mateix, i no té res de vell: el que
 * cal dir-ne és una altra cosa —que no l'ha triat qui té l'app a la mà—, i això
 * ja ho diu `origin: 'link'`. Marcar-lo com a restaurat mostraria l'avís
 * equivocat i amagaria l'únic que importa.
 */
export function fixFromLink(point: LinkedPoint, atMs: number): FixedLocation {
  return {
    location: { lat: point.lat, lon: point.lon, elevation: 0 },
    origin: 'link',
    label: point.label,
    accuracyM: null,
    elevationSource: 'pending',
    gpsElevationM: null,
    atMs,
    restored: false,
  };
}

/** El mateix punt amb l'altitud que acaba d'arribar. */
export function withResolvedElevation(
  fix: FixedLocation,
  resolved: ResolvedElevation,
): FixedLocation {
  return {
    ...fix,
    location: { ...fix.location, elevation: resolved.elevation },
    elevationSource: resolved.source,
  };
}

/**
 * Cert quan encara val la pena demanar l'altitud al model del terreny.
 *
 * `dem` és l'única que no cal tornar a demanar: el terreny no es mou. Totes les
 * altres volen dir que la xifra que tenim és provisional —zero, o la del GPS,
 * que té ±10 a ±30 m d'error vertical— i que en algun moment s'ha d'arreglar. En
 * restaurar és quan toca: el punt ve d'una sessió en què la tessel·la no va
 * arribar, i ara potser hi ha xarxa.
 */
export function needsElevation(source: ElevationSource): boolean {
  return source !== 'dem';
}

/** L'entrada d'historial que correspon a un punt fixat. */
export function toRecent(fix: FixedLocation): RecentPlace {
  return {
    lat: fix.location.lat,
    lon: fix.location.lon,
    elevation: fix.location.elevation,
    // `pending` no es desa mai: vegeu `persistedElevationSource`.
    elevationSource: persistedElevationSource(fix.elevationSource),
    label: fix.label,
    origin: fix.origin,
    atMs: fix.atMs,
  };
}

/** El que `fixAndResolve` necessita del món de fora. Tot injectat, tot provable. */
export interface FixFlow {
  /** Fixa el punt. Es crida un cop amb la posició i un altre amb l'altitud. */
  commit: (fix: FixedLocation, phase: FixPhase) => void;
  /** Demana l'altitud al model del terreny. Pot trigar o no tornar mai. */
  resolve: (
    location: GeoLocation,
    gpsElevationM: number | null,
  ) => Promise<ResolvedElevation>;
  /** Cert quan aquesta petició ja ha quedat enrere i no s'ha d'aplicar res. */
  stale: () => boolean;
  /** El punt actiu ara mateix, que pot haver canviat d'etiqueta mentrestant. */
  current: () => FixedLocation | null;
}

/**
 * Fixa el punt i, tot seguit, hi enganxa l'altitud quan arriba.
 *
 * TRES GUARDES, I CAP ÉS DECORATIVA:
 *
 * 1. `stale()` ABANS DE FIXAR RES. El GPS pot respondre quan l'usuari ja ha
 *    triat un altre lloc al mapa; una resposta que arriba tard no ha de tapar
 *    una tria que l'usuari ha fet després.
 * 2. `stale()` DESPRÉS D'ESPERAR L'ALTITUD. És la mateixa carrera un pas més
 *    enllà: dues tessel·les demanades seguides poden tornar en l'ordre contrari,
 *    i l'app es quedaria calculant-ho tot amb l'altitud d'un punt descartat
 *    sense que res ho digués.
 * 3. `current()` I NO EL PUNT DE FA UNA ESTONA. Mentre l'altitud viatjava, el
 *    nom del lloc pot haver arribat de la xarxa. Si tornéssim a escriure el punt
 *    de la primera passada, el nom desapareixeria tot sol de la pantalla.
 */
export async function fixAndResolve(first: FixedLocation, flow: FixFlow): Promise<void> {
  if (flow.stale()) return;

  flow.commit(first, 'placed');
  if (!needsElevation(first.elevationSource)) return;

  const resolved = await flow.resolve(first.location, first.gpsElevationM);
  if (flow.stale()) return;

  const current = flow.current();
  if (current === null) return;
  flow.commit(withResolvedElevation(current, resolved), 'elevation');
}

/* --- l'arrencada ---------------------------------------------------------- */

/** El que hi ha per començar. Tot llegit ja, res per llegir aquí dins. */
export interface BootInputs {
  /** El punt de l'URL, si n'hi havia cap de vàlid. */
  link: LinkedPoint | null;
  /** L'últim lloc desat al disc. */
  stored: RecentPlace | null;
  /** Cert si ja s'ha explicat alguna vegada per què cal la ubicació. */
  asked: boolean;
  /**
   * Ara mateix, en ms d'època. El punt de l'enllaç es fixa ARA i no quan es va
   * escriure l'enllaç: `atMs` és quan aquest dispositiu ha començat a mirar
   * aquell lloc, i és el que ordena l'historial.
   *
   * ES PASSA I NO ES LLEGEIX AQUÍ DINS perquè aquesta funció ha de ser pura:
   * amb un `Date.now()` a dins, la prova de l'ordre de l'historial dependria de
   * l'hora a què es corre.
   */
  nowMs: number;
}

/** D'on ha sortit el punt amb què arrenca l'app. */
export type BootSource = 'link' | 'stored' | 'none';

/** Què s'ha de fer en arrencar. */
export interface BootPlan {
  source: BootSource;
  /** El punt amb què comença l'app, o `null` si no n'hi ha cap. */
  fix: FixedLocation | null;
  /** Si cada passada s'ha de desar al disc. */
  remember: Record<FixPhase, boolean>;
  /** Si s'ha d'ensenyar l'explicació de per què cal la ubicació. */
  needsIntro: boolean;
}

/**
 * Decideix amb què arrenca l'app: l'enllaç, el disc, o res.
 *
 * PER QUÈ ÉS UNA FUNCIÓ PURA I NO QUATRE `if` DINS DE L'EFECTE D'ARRENCADA. És
 * la decisió amb més conseqüències de tota l'app —tria el punt sobre el qual es
 * calcula TOT i decideix quina és la primera pantalla que veu algú— i alhora és
 * la que passa una sola vegada, dins d'un `useEffect` amb una guarda de
 * `bootstrapped`, en un hook que els tests d'aquest projecte (entorn Node, sense
 * DOM) no poden muntar. Escrita aquí, es prova; escrita allà, no la prova ningú
 * i es descobreix el dia que algú comparteix un enllaç.
 *
 * LES TRES REGLES:
 *
 * 1. L'ENLLAÇ MANA SOBRE EL DISC, sempre. És l'única prioritat que té sentit:
 *    obrir un enllaç és un gest deliberat i d'ARA, i el punt desat és el d'una
 *    altra estona. Al revés, l'app faria una cosa absurda —algú t'envia «ens
 *    trobem al coll de Nargó», hi entres, i l'app t'ensenya les xifres del teu
 *    poble— i seria absurda justament per a qui ja fa servir l'app, que és qui
 *    té alguna cosa desada.
 * 2. AMB UN ENLLAÇ NO HI HA PANTALLA D'INTRODUCCIÓ. Aquella pantalla existeix
 *    per explicar per què cal la ubicació ABANS de demanar-la al navegador; amb
 *    un punt ja sobre la taula no hi ha res a demanar, i sortiria tapant el
 *    lloc que la persona acaba d'obrir. Seria l'app posant-se al davant del
 *    missatge que algú li ha enviat.
 * 3. EL PUNT DE L'ENLLAÇ ES DESA i el del disc no. El del disc ja ve d'allà i
 *    tornar-l'hi a escriure només serveix per moure'l de lloc a l'historial;
 *    el de l'enllaç és nou i ha d'entrar a l'historial com qualsevol altre lloc
 *    triat, perquè si tanques l'app i la tornes a obrir sense l'enllaç, el lloc
 *    on has quedat amb algú no es pot haver evaporat.
 *
 * L'EXCEPCIÓ DE L'ALTITUD DEL PUNT D'EXEMPLE es manté tal com era: el punt
 * d'exemple no és de l'usuari, no embruta l'historial i tampoc no s'hi desa
 * l'altitud que se n'aconsegueixi.
 */
export function planBoot(inputs: BootInputs): BootPlan {
  const { link, stored, asked, nowMs } = inputs;

  if (link !== null) {
    return {
      source: 'link',
      fix: fixFromLink(link, nowMs),
      remember: { placed: true, elevation: true },
      needsIntro: false,
    };
  }

  if (stored !== null) {
    const restored = fixFromStored(stored);
    return {
      source: 'stored',
      fix: restored,
      // La primera passada no es torna a desar: acaba de sortir del disc. La de
      // l'altitud sí, o cada arrencada tornaria a demanar la mateixa tessel·la
      // per sempre.
      remember: { placed: false, elevation: restored.origin !== 'default' },
      needsIntro: !asked,
    };
  }

  return {
    source: 'none',
    fix: null,
    remember: { placed: false, elevation: false },
    needsIntro: !asked,
  };
}
