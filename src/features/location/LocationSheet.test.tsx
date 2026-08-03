/**
 * Proves de la fulla «On seràs».
 *
 * PER QUÈ AQUEST COMPONENT. Perquè és la porta d'entrada de tota l'app: cada
 * xifra de cada pantalla penja del punt que se surt d'aquí. Té QUATRE vies
 * d'entrada que no serveixen soles —el GPS, la cerca, el mapa i les coordenades
 * escrites— i la feina del component és triar quina respon a cada gest. Això és
 * decisió, no marcatge.
 *
 * QUÈ PROVA:
 *   · EL CAMP UNIVERSAL. Que unes coordenades enganxades al cercador es
 *     resolguin AQUÍ MATEIX i sense tocar la xarxa, amb coma decimal inclosa,
 *     que és com les enganxa la gent d'aquí; i que amb coordenades al camp la
 *     llista de topònims no hi surti.
 *   · Que el GPS que acaba bé tanqui la fulla i el que falla no, i que això es
 *     decideixi per la TRANSICIÓ i no per l'estat: obrir la fulla amb un punt
 *     de GPS ja actiu no l'ha de tancar de cop.
 *   · Que un permís ja denegat es digui ABANS de prémer el botó.
 *   · Que un text que no són coordenades no triï cap punt i ho digui al camp.
 *   · Que repescar un lloc de l'historial se'n dugui l'ALTITUD DESADA amb la
 *     seva font. És el cas del refugi a 1.520 m sense cobertura, i sense
 *     aquesta línia l'app destrueix una dada bona que ja tenia al disc.
 *   · Que la fila del lloc actiu no s'ofereixi per comparar-se amb ella mateixa.
 *
 * QUÈ NO PROVA:
 *   · `parseCoords`. És pur, corre a Node i té `coords.test.ts` amb els formats
 *     de debò (graus i minuts, hemisferis, comes). Aquí només es comprova que
 *     la fulla el faci servir, i que el faci servir a les DUES bandes.
 *   · El geocodificador. `usePlaceSearch` i `core/places` tenen les seves
 *     bateries; el que aquí importa és quan NO se'ls crida.
 *   · La miniatura de l'historial ni la comparació de dos llocs: dibuixen, i el
 *     que dibuixen es verifica mirant-ho.
 *   · Res de com es veu.
 *
 * L'AMFITRIÓ ÉS UN DOBLE DE DADES, NO DE DECISIONS. `ObserverApi` és estat, i
 * aquí s'hi posa a mà l'estat que interessa a cada cas —cercant, amb error, amb
 * historial— i s'hi apunta què li demana la fulla. Cap funció d'aquest fitxer
 * no decideix res que hagi de decidir el component.
 */

import { describe, expect, it, vi, type Mock } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import type { GeoLocation } from '../../core/astro/types';
import type { ComparisonApi } from './useComparison';
import type { RecentPlace } from '../../state/recentPlaces';
import type { FixedLocation } from '../../state/location';
import type { ObserverApi } from '../../state/useObserver';
import type { PlacePick } from '../../state/observerFlow';
import { formatCoords } from '../../screens/format';
import { LocationSheet } from './LocationSheet';
import { ls } from './strings';

/* ------------------------------------------------------------- els dobles */

/** Barcelona, que és el que la gent enganxa quan prova l'app. */
const BARCELONA = { lat: 41.3851, lon: 2.1734 };

/** El refugi de la nota d'`observerFlow.ts`: 1.520 m del model del terreny. */
const REFUGI: RecentPlace = {
  lat: 42.6231,
  lon: 0.9962,
  elevation: 1520,
  elevationSource: 'dem',
  label: 'Refugi de Colomers',
  origin: 'search',
  atMs: Date.UTC(2026, 6, 30, 10, 0, 0),
};

const TAFALLA_RECENT: RecentPlace = {
  lat: 42.531,
  lon: -1.675,
  elevation: 426,
  elevationSource: 'dem',
  label: 'Tafalla',
  origin: 'map',
  atMs: Date.UTC(2026, 7, 1, 10, 0, 0),
};

function fix(over: Partial<FixedLocation> = {}): FixedLocation {
  return {
    location: { lat: 42.531, lon: -1.675, elevation: 426 },
    origin: 'map',
    label: 'Tafalla',
    accuracyM: null,
    elevationSource: 'dem',
    gpsElevationM: null,
    atMs: Date.UTC(2026, 7, 1, 10, 0, 0),
    restored: false,
    ...over,
  };
}

/*
 * ELS ESPIES VAN TIPATS AMB LA SIGNATURA DE DEBÒ i no amb el que `vi.fn()`
 * dedueix sol. Amb un `Mock` sense paràmetres de tipus, `setPlace` accepta
 * qualsevol cosa i la prova de l'historial —la que comprova que l'altitud
 * desada viatja— passaria igual amb un camp mal escrit. El compilador és aquí
 * la primera assercíó de cada prova.
 */
interface Espies {
  setPlace: Mock<(pick: PlacePick) => Promise<void>>;
  locate: Mock<() => void>;
  forget: Mock<(target: GeoLocation) => void>;
  onClose: Mock<() => void>;
  compareWith: Mock<(place: RecentPlace | null) => void>;
}

function espies(): Espies {
  return {
    setPlace: vi.fn(async () => {}),
    locate: vi.fn(),
    forget: vi.fn(),
    onClose: vi.fn(),
    compareWith: vi.fn(),
  };
}

function observador(over: Partial<ObserverApi>, spies: Espies): ObserverApi {
  return {
    fix: null,
    location: null,
    elevationSource: 'pending',
    accuracy: null,
    error: null,
    loading: false,
    permission: 'prompt',
    recents: [],
    needsIntro: false,
    locate: spies.locate,
    setManual: async () => {},
    setPlace: spies.setPlace,
    useDefaultLocation: async () => {},
    setLabel: () => {},
    forget: spies.forget,
    dismissIntro: () => {},
    ...over,
  };
}

function comparacio(over: Partial<ComparisonApi>, spies: Espies): ComparisonApi {
  return {
    other: null,
    otherCircumstances: null,
    result: null,
    compareWith: spies.compareWith,
    clear: () => {},
    ...over,
  };
}

interface FullaOpcions {
  observer?: Partial<ObserverApi>;
  comparison?: Partial<ComparisonApi>;
}

function fulla({ observer = {}, comparison = {} }: FullaOpcions = {}) {
  const spies = espies();

  /*
   * LA XARXA, TANCADA I VIGILADA. La fulla munta `usePlaceSearch`, que crida
   * Photon, i les miniatures de l'historial llegeixen el perfil desat. Un doble
   * que retorni topònims faria passar la prova de les coordenades enganxades
   * fins i tot amb la petició sortint —i aquella prova existeix justament per
   * comprovar que NO surt. Amb `fetch` comptat, la pregunta té resposta.
   */
  const xarxa = vi.fn(() => Promise.reject(new Error('sense xarxa')));
  vi.stubGlobal('fetch', xarxa);

  const utils = render(
    <LocationSheet
      locale="ca"
      observer={observador(observer, spies)}
      comparison={comparacio(comparison, spies)}
      onClose={spies.onClose}
    />,
  );

  return { ...utils, espies: spies, xarxa };
}

/** Escriu al camp universal de dalt. */
function escriu(text: string): void {
  fireEvent.change(screen.getByLabelText(ls('search.label', 'ca')), {
    target: { value: text },
  });
}

/** L'última crida a `setPlace`, que és el que la fulla decideix. */
function triat(spies: Espies): PlacePick {
  const última = spies.setPlace.mock.calls.at(-1);
  if (!última) throw new Error('la fulla no ha triat cap punt');
  return última[0];
}

/* ------------------------------------------------------------------ proves */

describe('LocationSheet · el cercador entén coordenades i no gasta xarxa', () => {
  it('unes coordenades enganxades es resolen aquí mateix, sense preguntar res a ningú', () => {
    /*
     * PER QUÈ IMPORTA QUE NO SURTI LA PETICIÓ. Photon amb «41,3851, 2,1734»
     * torna soroll —no és un topònim— i gasta una petició d'un servei gratuït
     * que ens deixa fer-ne les que ens deixa. El resultat bo és local,
     * immediat i correcte, i el dolent és lent i equivocat: valia la pena
     * escriure-hi la detecció, i val la pena vigilar-la.
     */
    const { espies, xarxa } = fulla();
    escriu('41.3851, 2.1734');

    expect(screen.getByText(ls('search.exact', 'ca'))).toBeTruthy();
    expect(
      screen.getByText(formatCoords(BARCELONA.lat, BARCELONA.lon), { exact: false }),
    ).toBeTruthy();
    expect(xarxa).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText(ls('search.exact', 'ca')));

    expect(triat(espies)).toEqual({
      lat: BARCELONA.lat,
      lon: BARCELONA.lon,
      origin: 'map',
      label: null,
    });
    // Triar un punt tanca la fulla: el gest ja ha acabat.
    expect(espies.onClose).toHaveBeenCalled();
  });

  it('amb coma decimal, que és com les enganxa la gent d’aquí', () => {
    /*
     * El cas real del report de camp. Un mòbil configurat en català escriu els
     * decimals amb coma, i el text que s'enganxa és «41,3851, 2,1734»: dues
     * comes de decimals i una de separador. Si la fulla no ho entén, l'usuari
     * veu «cap resultat» damunt d'unes coordenades perfectament vàlides.
     */
    fulla();
    escriu('41,3851, 2,1734');

    expect(screen.getByText(ls('search.exact', 'ca'))).toBeTruthy();
    expect(
      screen.getByText(formatCoords(BARCELONA.lat, BARCELONA.lon), { exact: false }),
    ).toBeTruthy();
  });

  it('un text que no són coordenades no ensenya cap punt exacte', () => {
    fulla();
    escriu('Peníscola');

    expect(screen.queryByText(ls('search.exact', 'ca'))).toBeNull();
  });
});

describe('LocationSheet · el GPS', () => {
  it('mentre cerca el senyal ho diu i no es pot tornar a prémer', () => {
    fulla({ observer: { loading: true } });

    const botó = screen.getByRole('button', {
      name: ls('sheet.locating', 'ca'),
    }) as HTMLButtonElement;
    expect(botó.disabled).toBe(true);
  });

  it('un error del GPS es diu amb paraules i la fulla es queda oberta', () => {
    /*
     * El desenllaç dolent es queda AQUÍ, amb l'error a la vista i les altres
     * tres vies a un dit. Tancar la fulla en fallar deixaria la persona a la
     * pantalla d'abans sense saber què ha passat ni per on tornar-hi.
     */
    const { espies } = fulla({ observer: { error: 'timeout' } });

    expect(screen.getByText(ls('error.timeout', 'ca'))).toBeTruthy();
    expect(espies.onClose).not.toHaveBeenCalled();
  });

  it('un permís ja denegat es diu ABANS de prémer el botó', () => {
    /*
     * En molts navegadors una denegació antiga fa fallar la crida a l'acte i
     * sense cap diàleg: el botó és una loteria i la culpa sembla de l'app. Amb
     * el permís conegut, es diu abans de prémer res.
     */
    fulla({ observer: { permission: 'denied' } });
    expect(screen.getByText(ls('error.denied', 'ca'))).toBeTruthy();
  });

  it('amb un error a la vista, la nota del permís no es repeteix', () => {
    fulla({ observer: { permission: 'denied', error: 'denied' } });
    expect(screen.getAllByText(ls('error.denied', 'ca'))).toHaveLength(1);
  });

  it('el GPS que acaba bé tanca la fulla', () => {
    /*
     * Les altres tres vies acaben amb un gest que ja tanca. «On soc ara»
     * acabava en silenci —el botó tornava a l'estat normal i prou— i al camp
     * allò es llegeix com «no ha ubicat».
     */
    const spies = espies();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sense xarxa'))));

    const pinta = (over: Partial<ObserverApi>) => (
      <LocationSheet
        locale="ca"
        observer={observador(over, spies)}
        comparison={comparacio({}, spies)}
        onClose={spies.onClose}
      />
    );

    const vista = render(pinta({ loading: true }));
    expect(spies.onClose).not.toHaveBeenCalled();

    vista.rerender(pinta({ loading: false, fix: fix({ origin: 'gps' }) }));
    expect(spies.onClose).toHaveBeenCalledTimes(1);
  });

  it('obrir la fulla amb un punt de GPS ja actiu NO la tanca', () => {
    /*
     * ES DETECTA LA TRANSICIÓ I NO L'ESTAT, i aquesta és la prova que ho
     * separa. Amb la condició escrita damunt de l'estat —«hi ha fix de GPS i no
     * carrega»— la fulla es tancaria sola en obrir-la l'endemà de fer servir el
     * GPS, i no hi hauria manera de canviar de lloc.
     */
    const { espies } = fulla({ observer: { loading: false, fix: fix({ origin: 'gps' }) } });
    expect(espies.onClose).not.toHaveBeenCalled();
  });
});

describe('LocationSheet · les coordenades escrites, al camp de sempre', () => {
  const camp = () => screen.getByLabelText(ls('sheet.coords', 'ca'));

  it('un text que no són coordenades ho diu i no tria res', () => {
    const { espies } = fulla();
    fireEvent.change(camp(), { target: { value: 'per aquí a la vora' } });
    fireEvent.click(screen.getByRole('button', { name: ls('sheet.use', 'ca') }));

    expect(screen.getByText(ls('sheet.coordsBad', 'ca'))).toBeTruthy();
    expect(espies.setPlace).not.toHaveBeenCalled();
    expect(espies.onClose).not.toHaveBeenCalled();
  });

  it('unes coordenades bones trien el punt i fan la mateixa crida que el cercador', () => {
    /*
     * LES DUES BANDES HAN DE COINCIDIR. El camp plegat i el cercador de dalt
     * criden el MATEIX `parseCoords` i han de fer el MATEIX `setPlace`: si un
     * dia divergissin, el mateix text donaria dos punts diferents segons on
     * s'hagués escrit.
     */
    const { espies } = fulla();
    fireEvent.change(camp(), { target: { value: '41.3851, 2.1734' } });
    fireEvent.click(screen.getByRole('button', { name: ls('sheet.use', 'ca') }));

    expect(triat(espies)).toEqual({
      lat: BARCELONA.lat,
      lon: BARCELONA.lon,
      origin: 'map',
      label: null,
    });
    expect(espies.onClose).toHaveBeenCalled();
  });
});

describe('LocationSheet · l’historial', () => {
  it('repescar un lloc se n’endú l’altitud desada i la seva font', () => {
    /*
     * EL CAS DEL REFUGI, que és el que va destapar aquests dos camps.
     * Planifiques a casa i el refugi queda desat amb els seus 1.520 m del
     * model del terreny; puges, sense cobertura, i el repesques de la llista.
     * Sense passar l'altitud, allò és un `pending` amb zero, la tessel·la no
     * arriba mai i el punt es queda com a «altitud desconeguda: nivell del
     * mar». L'app destrueix una dada bona que JA TENIA al disc, i just el dia
     * que no es pot recuperar.
     */
    const { espies } = fulla({ observer: { recents: [REFUGI] } });

    fireEvent.click(screen.getByText(REFUGI.label as string));

    expect(triat(espies)).toEqual({
      lat: REFUGI.lat,
      lon: REFUGI.lon,
      origin: 'recent',
      label: REFUGI.label,
      elevation: 1520,
      elevationSource: 'dem',
    });
  });

  it('sense historial ho diu, en comptes de deixar un buit', () => {
    fulla();
    expect(screen.getByText(ls('sheet.recentsEmpty', 'ca'))).toBeTruthy();
  });

  it('el lloc actiu no s’ofereix per comparar-se amb ell mateix', () => {
    /*
     * Comparar Tafalla amb Tafalla dona zero segons de diferència i una fila
     * que no vol dir res. Amb dues entrades a la llista i una de sola activa,
     * el botó de comparar ha de sortir una vegada i no dues.
     */
    fulla({
      observer: {
        recents: [TAFALLA_RECENT, REFUGI],
        fix: fix({ location: { lat: TAFALLA_RECENT.lat, lon: TAFALLA_RECENT.lon, elevation: 426 } }),
      },
    });

    expect(screen.getAllByRole('button', { name: ls('sheet.compareWith', 'ca') })).toHaveLength(1);
  });

  it('treure un lloc de la llista el treu, i no el tria', () => {
    const { espies } = fulla({ observer: { recents: [REFUGI] } });

    fireEvent.click(screen.getByRole('button', { name: ls('sheet.forget', 'ca') }));

    expect(espies.forget).toHaveBeenCalledWith({
      lat: REFUGI.lat,
      lon: REFUGI.lon,
      elevation: REFUGI.elevation,
    });
    expect(espies.setPlace).not.toHaveBeenCalled();
  });
});
