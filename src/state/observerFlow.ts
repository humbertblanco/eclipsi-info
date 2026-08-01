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
  return {
    location: { lat: pick.lat, lon: pick.lon, elevation: 0 },
    origin: pick.origin,
    label: pick.label ?? null,
    accuracyM: null,
    elevationSource: 'pending',
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
