/**
 * Els llindars de distància i el text que en surt.
 *
 * És la prova més important del mòdul: la frase que llegeix l'usuari ÉS la
 * dada. Si el llindar s'equivoca, algú llegeix "Cervera" essent a set
 * quilòmetres de Cervera, i el que decideix a partir d'allà surt malament.
 */

import { describe, expect, it } from 'vitest';
import { catalanOf, describePlace, formatDistanceKm } from './describe';
import { buildPlaceName, distanceKm, regionLabel } from './nearest';
import type { Settlement, SettlementRank } from './types';

/** Un nucli qualsevol a la latitud i longitud que es demani. */
function settlement(
  name: string,
  rank: SettlementRank,
  lat: number,
  lon: number,
  county: string | null = 'Segarra',
  state: string | null = 'Catalunya',
): Settlement {
  return {
    name,
    rank,
    lat,
    lon,
    county,
    state,
    countryCode: 'es',
    osmId: `N${name.length}`,
  };
}

/**
 * Punt situat a `km` al nord d'un altre.
 * Un grau de latitud són 111,19 km al meridià; per moure's en línia recta cap
 * al nord no cal res més i així la distància de la prova és exacta.
 */
function northOf(lat: number, km: number): number {
  return lat + km / 111.19492664455873;
}

const CERVERA_LAT = 41.6704;
const CERVERA_LON = 1.268;

describe('formatDistanceKm', () => {
  it('posa un decimal per sota de deu quilòmetres, amb coma', () => {
    expect(formatDistanceKm(2.42)).toBe('2,4 km');
    expect(formatDistanceKm(0.86)).toBe('0,9 km');
    expect(formatDistanceKm(9.94)).toBe('9,9 km');
  });

  it('no posa decimals a partir de deu: la precisió no hi és', () => {
    expect(formatDistanceKm(10)).toBe('10 km');
    expect(formatDistanceKm(17.3)).toBe('17 km');
    expect(formatDistanceKm(24.6)).toBe('25 km');
  });
});

describe('catalanOf', () => {
  it('apostrofa davant de vocal i d’hac', () => {
    expect(catalanOf('Oviedo')).toBe('d’Oviedo');
    expect(catalanOf('Osca')).toBe('d’Osca');
    expect(catalanOf('Huesca')).toBe('d’Huesca');
    expect(catalanOf('Àger')).toBe('d’Àger');
  });

  it('no apostrofa davant de consonant', () => {
    expect(catalanOf('Cervera')).toBe('de Cervera');
    expect(catalanOf('Bulnes de Arriba')).toBe('de Bulnes de Arriba');
  });

  it('contrau els articles catalans en minúscula i deixa la i les', () => {
    expect(catalanOf('el Masnou')).toBe('del Masnou');
    expect(catalanOf('els Hostalets')).toBe('dels Hostalets');
    expect(catalanOf('la Valldan')).toBe('de la Valldan');
    expect(catalanOf('les Oluges')).toBe('de les Oluges');
    expect(catalanOf('l’Horta')).toBe('de l’Horta');
  });

  it('no toca els articles castellans en majúscula: són part del topònim', () => {
    // "d’El Espinar" seria escriure malament un nom propi castellà.
    expect(catalanOf('El Espinar')).toBe('d’El Espinar');
    expect(catalanOf('Las Rozas')).toBe('de Las Rozas');
  });
});

describe('regionLabel', () => {
  it('ajunta comarca i comunitat quan són coses diferents', () => {
    expect(regionLabel('Segarra', 'Catalunya')).toBe('Segarra, Catalunya');
    expect(regionLabel('León', 'Castilla y León')).toBe('León, Castilla y León');
  });

  it('no repeteix la mateixa regió dues vegades', () => {
    expect(regionLabel('Cantabria', 'Cantabria')).toBe('Cantabria');
    // El cas real d'Astúries: la font dona el nom bilingüe i la fórmula
    // administrativa, que són el mateix lloc dit de dues maneres.
    expect(regionLabel('Asturias / Asturies', 'Principado de Asturias')).toBe(
      'Asturias / Asturies',
    );
  });

  it('aguanta que en falti una', () => {
    expect(regionLabel(null, 'Aragón')).toBe('Aragón');
    expect(regionLabel('Solsonès', null)).toBe('Solsonès');
    expect(regionLabel(null, null)).toBeNull();
  });
});

describe('llindars de distància', () => {
  it('a menys d’un quilòmetre i mig diu el nom sol', () => {
    const place = buildPlaceName(
      [settlement('Cervera', 'town', CERVERA_LAT, CERVERA_LON)],
      northOf(CERVERA_LAT, 0.4),
      CERVERA_LON,
      0,
    );
    expect(place.precision).toBe('at');
    expect(describePlace(place)?.primary).toBe('Cervera');
    expect(describePlace(place)?.secondary).toBe('Segarra, Catalunya');
  });

  it('més enllà diu la distància, i és la distància REAL al nucli', () => {
    // 4,4 km del node de Cervera. Amb el radi d'una vila (1,2 km) la vora
    // queda a 3,2 km, per damunt del llindar d'1,5: toca dir-ne la distància.
    const place = buildPlaceName(
      [settlement('Cervera', 'town', CERVERA_LAT, CERVERA_LON)],
      northOf(CERVERA_LAT, 4.4),
      CERVERA_LON,
      0,
    );
    expect(place.precision).toBe('near');
    expect(place.distanceKm).toBeCloseTo(4.4, 1);
    // El número que es pinta és el 4,4 del node, no el 3,2 de la vora.
    expect(describePlace(place)?.primary).toBe('a 4,4 km de Cervera');
    expect(describePlace(place, 'es')?.primary).toBe('a 4,4 km de Cervera');
  });

  it('passats vint-i-cinc quilòmetres només diu la regió', () => {
    const place = buildPlaceName(
      [settlement('Ribadeo', 'town', 43.5372, -7.0405, 'A Mariña Oriental', 'Galicia')],
      northOf(43.5372, 31),
      -7.0405,
      0,
    );
    expect(place.precision).toBe('region');
    const label = describePlace(place);
    expect(label?.primary).toBe('A Mariña Oriental, Galicia');
    expect(label?.secondary).toBeNull();
    // El nucli segueix al resultat: qui vulgui la xifra la té, però la frase
    // no promet una precisió que a trenta quilòmetres no existeix.
    expect(place.settlement?.name).toBe('Ribadeo');
  });

  it('el llindar es mira a la VORA del nucli, no al seu centre', () => {
    // Plantat a 2,6 km del node d'Oviedo: encara ets dins de la ciutat.
    const oviedo = settlement(
      'Oviedo / Uviéu',
      'city',
      43.3619,
      -5.8484,
      'Asturias / Asturies',
      'Principado de Asturias',
    );
    const inside = buildPlaceName([oviedo], northOf(43.3619, 2.6), -5.8484, 0);
    expect(inside.precision).toBe('at');
    expect(describePlace(inside)?.primary).toBe('Oviedo / Uviéu');

    // A 6 km ja n'ets fora, i llavors sí que toca dir-ho, amb apòstrof.
    const outside = buildPlaceName([oviedo], northOf(43.3619, 6), -5.8484, 0);
    expect(outside.precision).toBe('near');
    expect(describePlace(outside)?.primary).toBe('a 6,0 km d’Oviedo / Uviéu');
  });

  it('a 4,4 km del node no diu «ets a» encara que sigui una «city»', () => {
    // Terol: OSM l'etiqueta `city` per capital de província, no per mida, i el
    // radi suposat de 3 km li regala una vora falsa. Sense sostre, la resta
    // donava 1,4 km i la pantalla ensenyava «Terol» a seques des d'enmig del
    // camp. La xifra és la informació; el supòsit no la pot esborrar.
    const teruel = settlement('Teruel', 'city', 40.3456, -1.1065, 'Teruel', 'Aragón');
    const out = buildPlaceName([teruel], northOf(40.3456, 4.4), -1.1065, 0);
    expect(out.precision).toBe('near');
    expect(describePlace(out)?.primary).toBe('a 4,4 km de Teruel');
  });

  it('sense cap nucli a l’abast no diu res i no inventa', () => {
    const empty = buildPlaceName([], 43.78, -7.05, 0);
    expect(empty.precision).toBe('none');
    expect(empty.settlement).toBeNull();
    expect(describePlace(empty)).toBeNull();
    expect(describePlace(null)).toBeNull();
  });
});

describe('tria del nucli', () => {
  it('la ciutat de la qual ets a dins guanya el llogaret més proper', () => {
    // Cas real d'Oviedo: el node de la ciutat a 2,5 km i un llogaret a 1,3.
    const observerLat = northOf(43.3619, 2.5);
    const candidates = [
      settlement('Los Catalanes', 'hamlet', northOf(observerLat, 1.3), -5.8484, null, null),
      settlement('Oviedo / Uviéu', 'city', 43.3619, -5.8484, null, null),
    ];
    const place = buildPlaceName(candidates, observerLat, -5.8484, 0);
    expect(place.settlement?.name).toBe('Oviedo / Uviéu');
    expect(place.precision).toBe('at');
  });

  it('enmig del no-res guanya el que et queda més a prop, per petit que sigui', () => {
    // Els Picos de Europa: només llogarets, i el bo és el de 1,95 km.
    const lat = 43.24;
    const candidates = [
      settlement('Camarmeña', 'hamlet', northOf(lat, 2.39), -4.85, null, null),
      settlement('Bulnes de Arriba', 'hamlet', northOf(lat, 1.95), -4.85, null, null),
      settlement('Caín de Valdeón', 'hamlet', northOf(lat, 5.37), -4.85, null, null),
    ];
    const place = buildPlaceName(candidates, lat, -4.85, 0);
    expect(place.settlement?.name).toBe('Bulnes de Arriba');
    expect(describePlace(place)?.primary).toBe('a 2,0 km de Bulnes de Arriba');
  });

  it('en cas d’empat a la vora es queda el centre més proper', () => {
    const lat = 42;
    const candidates = [
      settlement('Petit', 'hamlet', northOf(lat, 0.1), 1, null, null),
      settlement('Gran', 'city', northOf(lat, 2.0), 1, null, null),
    ];
    /*
     * Tots dos queden dins del seu propi radi suposat, o sigui amb la vora a
     * 0 km clavat.
     *
     * AQUEST TEST AFIRMAVA EL CONTRARI —que havia de guanyar el gran, «que és
     * el que la gent de fora coneixerà»— i un report de camp del 3-8-2026 el
     * va desmentir: plantat a Esplugues de Llobregat, l'app deia
     * «l'Hospitalet de Llobregat», que és a 2,28 km, perquè el radi de ciutat
     * se'l empassava i la mida desempatava. Dir el nom d'un municipi veí quan
     * en tens un a dues-centes passes no és ser reconeixible, és equivocar-se.
     *
     * Quan els dos t'enclouen, el que t'enclou de debò és el que tens a
     * tocar. La mida es queda com a últim desempat, per a dos centres a la
     * mateixa distància exacta.
     */
    const place = buildPlaceName(candidates, lat, 1, 0);
    expect(place.settlement?.name).toBe('Petit');
  });

  it('a igual distància de centre, el més gran', () => {
    // El desempat de tercer nivell, que sí que segueix sent la mida: dos
    // nuclis amb el node exactament al mateix lloc no els distingeix res més.
    const lat = 42;
    const candidates = [
      settlement('Petit', 'hamlet', northOf(lat, 1.0), 1, null, null),
      settlement('Gran', 'city', northOf(lat, 1.0), 1, null, null),
    ];
    expect(buildPlaceName(candidates, lat, 1, 0).settlement?.name).toBe('Gran');
  });
});

describe('distanceKm', () => {
  it('mesura bé una distància coneguda', () => {
    // Oviedo → Gijón, uns 24,5 km en línia recta.
    expect(distanceKm(43.3619, -5.8494, 43.5322, -5.6611)).toBeCloseTo(24.5, 0);
  });

  it('val zero al mateix punt', () => {
    expect(distanceKm(43, -5, 43, -5)).toBe(0);
  });
});
