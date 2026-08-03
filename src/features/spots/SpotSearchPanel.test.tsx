/**
 * Proves del cercador de llocs: el panell, i la llista que en penja.
 *
 * PER QUÈ EN UN SOL FITXER. Perquè `SpotList` no és un component independent
 * sinó el subarbre del panell, i la seva feina és dir la VERITAT sobre el que
 * el panell li acaba de donar. Provar-los per separat obligaria a construir
 * dues vegades el mateix resultat de cerca —que és un objecte de trenta camps—
 * i la duplicació seria la primera cosa que envelliria. El fitxer va del botó
 * fins a l'última targeta, que és el camí que fa la persona.
 *
 * QUÈ PROVA:
 *   · Que la cerca NO ARRENQUI SOLA. És l'única prova que vigila desenes de
 *     megabytes de dades mòbils: mentre ningú no premi el botó no s'ha de crear
 *     ni el Worker, i l'avís del que costa s'ha de llegir ABANS de prémer, que
 *     és quan encara es pot decidir.
 *   · Que cap frase del motor arribi crua a la pantalla. L'etapa del progrés i
 *     el motiu de la fallada són CODIS i el text surt de `strings.ts`: és
 *     l'invariant 8 d'ESTAT.md, i el cercador és justament el mòdul on ja va
 *     costar tres passades.
 *   · Que cancel·lar no sigui fallar: qui prem «Atura» no ha de veure cap error.
 *   · Que una cerca nova o buida deixi el mapa NET. Les xinxetes velles d'una
 *     cerca anterior damunt d'uns resultats nous són una mentida silenciosa.
 *   · Que una resposta tardana d'una cerca ja abandonada no repinti res.
 *   · Que la llista digui el context abans de cap xifra, i que amb la franja de
 *     centralitat fora del radi ho digui en comptes d'ordenar per segons que no
 *     hi són.
 *   · Que la porta de privadesa aguanti amb el component muntat: de tota la
 *     cerca no pot sortir ni un número.
 *
 * QUÈ NO PROVA:
 *   · L'embut. `core/spots/search.ts` fa trigonometria i té la seva bateria a
 *     Node, amb els casos d'or de veritat. Aquí el motor és un doble: el que es
 *     prova és què fa la PANTALLA amb el que li arriba.
 *   · El contingut d'una targeta. Les xifres i les frases de `SpotCard` surten
 *     de `format.ts` i de `strings.ts`, que es proven sols.
 *   · Res de com es veu.
 *
 * EL WORKER ÉS UN DOBLE I NO POT SER UNA ALTRA COSA. `useSpotSearch` en crea un
 * de debò amb `new Worker(new URL('../../workers/spots.worker.ts', …))`, i
 * aquell fitxer baixa relleu de la xarxa. El doble no decideix RES: només
 * apunta què li han demanat i deixa que la prova li digui què respon i quan.
 * Tota la decisió segueix sent del component.
 */

import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { installAnalytics, type AnalyticsTransport } from '../../core/analytics';
import type { GeoLocation } from '../../core/astro/types';
import type {
  SpotResult,
  SpotSearchOutcome,
  SpotSearchProgress,
} from '../../core/spots/types';
import type { SpotsWorkerRequest, SpotsWorkerResponse } from '../../workers/spots.worker';
import type { Locale } from '../../i18n';
import { SpotList } from './SpotList';
import { SpotSearchPanel } from './SpotSearchPanel';
import { durationText, formatDistance } from './format';
import { sp } from './strings';

/* ------------------------------------------------------------- el doble */

/** Els Workers que el component ha arribat a crear. Buit vol dir cap byte. */
let workers: WorkerFals[] = [];

/**
 * Un Worker que no calcula res.
 *
 * Implementa només les quatre coses que `useSpotSearch` li demana —crear-se,
 * escoltar, rebre i morir— i guarda el que li han enviat. `respon()` és el que
 * fa la prova quan vol que el motor «contesti»: va dins d'`act` perquè el que
 * dispara són canvis d'estat de React.
 */
class WorkerFals {
  readonly rebuts: SpotsWorkerRequest[] = [];
  acabat = false;
  private readonly oients = new Map<string, ((event: unknown) => void)[]>();

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const llista = this.oients.get(type) ?? [];
    llista.push(listener);
    this.oients.set(type, llista);
  }

  postMessage(message: SpotsWorkerRequest): void {
    this.rebuts.push(message);
  }

  terminate(): void {
    this.acabat = true;
  }

  /** Fa arribar una resposta del motor, com si hagués creuat el `postMessage`. */
  respon(message: SpotsWorkerResponse): void {
    act(() => {
      for (const oient of this.oients.get('message') ?? []) oient({ data: message });
    });
  }

  /** El Worker peta sencer. */
  peta(): void {
    act(() => {
      for (const oient of this.oients.get('error') ?? []) oient({});
    });
  }

  /** Les peticions de cerca que ha rebut, que són les que costen dades. */
  get cerques(): SpotsWorkerRequest[] {
    return this.rebuts.filter((r) => r.type === 'search');
  }
}

function muntaWorker(): void {
  workers = [];
  vi.stubGlobal(
    'Worker',
    class extends WorkerFals {
      constructor() {
        super();
        workers.push(this);
      }
    },
  );
  /*
   * La xarxa, tancada. `SpotCard` demana el topònim de cada candidat amb
   * mandra (`useSpotPlaceName` → `core/places`), i una prova que deixi sortir
   * aquella petició depèn d'un servei de fora per passar. Es tanca aquí i no
   * amb un doble que retorni noms: el nom és un extra i la targeta ha de
   * sortir sencera sense ell, que és exactament el que passa sense cobertura.
   */
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sense xarxa'))));
}

/** L'últim Worker creat. Falla clar si no n'hi ha cap. */
function worker(): WorkerFals {
  const últim = workers.at(-1);
  if (!últim) throw new Error('no s’ha creat cap Worker: la cerca no ha arrencat');
  return últim;
}

/* --------------------------------------------------------------- fixtures */

const TAFALLA: GeoLocation = { lat: 42.531, lon: -1.675, elevation: 426 };

/** Un resultat complet. Els números són de l'ordre dels de Tafalla. */
function lloc(over: Partial<SpotResult> = {}): SpotResult {
  return {
    id: 'g-42.60--1.70',
    lat: 42.601,
    lon: -1.702,
    elevation: 612,
    distanceKm: 8.4,
    bearingDeg: 315,
    score: 87,
    parts: { centralSeconds: 0.9, clearance: 0.8, closeness: 0.7, altitude: 0.6 },
    detail: 'full',
    centralVisibleSec: 101,
    centralTotalSec: 101,
    centralLostSec: 0,
    clearanceDeg: 1.4,
    horizonAltitudeDeg: 5.5,
    blockingDistanceKm: 12.3,
    climbToRecoverM: null,
    sunAzimuthDeg: 283.7,
    sunAltitudeDeg: 6.9,
    midCentralMs: Date.UTC(2026, 7, 12, 20, 29, 0),
    status: 'full',
    edgeUncertain: false,
    coverage: 1,
    ...over,
  };
}

const COST_ETAPA = {
  entered: 0,
  survived: 0,
  ms: 0,
  ephemerisCalls: 0,
  terrainSamples: 0,
  tiles: 0,
};

function resultat(over: Partial<SpotSearchOutcome> = {}): SpotSearchOutcome {
  return {
    results: [lloc()],
    cost: {
      grid: COST_ETAPA,
      astro: COST_ETAPA,
      tiles: COST_ETAPA,
      sieve: COST_ETAPA,
      refineTiles: COST_ETAPA,
      refine: COST_ETAPA,
      totalMs: 6100,
      uniqueTiles: 41,
      tilesIfNaive: 900,
      terrainSamplesIfNaive: 1_000_000,
    } as SpotSearchOutcome['cost'],
    origin: TAFALLA,
    radiusKm: 25,
    candidates: 1187,
    bestCentralSec: 101,
    centralReachable: true,
    estimatedOnly: false,
    ...over,
  };
}

const PROGRES = (over: Partial<SpotSearchProgress> = {}): SpotSearchProgress => ({
  stage: 'tiles',
  ratio: 0.42,
  examined: 500,
  alive: 120,
  ...over,
});

interface PanellProps {
  origin?: GeoLocation | null;
  locale?: Locale;
  onResults?: (spots: { lat: number; lon: number; index: number }[] | null) => void;
}

function panell({ origin = TAFALLA, locale = 'ca', onResults }: PanellProps = {}) {
  muntaWorker();
  return render(
    <SpotSearchPanel
      eclipseId="2026-08-12"
      locale={locale}
      origin={origin}
      onResults={onResults}
      // La taula de cost és un diagnòstic d'enginyeria i el seu valor per
      // defecte depèn de `import.meta.env.DEV`. Es fixa a fals perquè la prova
      // digui el mateix corri on corri.
      showCost={false}
    />,
  );
}

const botó = (clau: Parameters<typeof sp>[0], locale: Locale = 'ca'): HTMLButtonElement =>
  screen.getByRole('button', { name: sp(clau, locale) }) as HTMLButtonElement;

/* ------------------------------------------------------------------ proves */

describe('SpotSearchPanel · res no es baixa sense demanar-ho', () => {
  it('sense saber on ets, ho diu i no es pot cercar', () => {
    panell({ origin: null });

    expect(screen.getByText(sp('panel.needOrigin', 'ca'))).toBeTruthy();
    expect(botó('panel.search').disabled).toBe(true);
    expect(workers).toHaveLength(0);
  });

  it('amb el punt sabut i abans de prémer, la factura de dades es llegeix', () => {
    /*
     * L'AVÍS VA ABANS I NO DESPRÉS. Un cop la cerca corre, dir que baixarà
     * desenes de megabytes ja no és un avís: és una factura. Aquesta prova
     * vigila l'ordre, que és tota la gràcia.
     */
    panell();

    expect(screen.getByText(sp('panel.dataWarning', 'ca'))).toBeTruthy();
    expect(botó('panel.search').disabled).toBe(false);
    // I encara no s'ha creat cap Worker: muntar el panell no costa res.
    expect(workers).toHaveLength(0);
  });

  it('en prémer, i només llavors, arrenca la cerca amb el punt i l’eclipsi', () => {
    panell();
    fireEvent.click(botó('panel.search'));

    expect(workers).toHaveLength(1);
    const petició = worker().cerques[0];
    expect(petició).toMatchObject({
      type: 'search',
      eclipseId: '2026-08-12',
      origin: TAFALLA,
    });
    // Amb la cerca en marxa, l'avís del cost ja no hi pinta res.
    expect(screen.queryByText(sp('panel.dataWarning', 'ca'))).toBeNull();
    expect(botó('panel.stop')).toBeTruthy();
  });
});

describe('SpotSearchPanel · el motor no parla, dona codis', () => {
  it('l’etapa del progrés surt en l’idioma de qui mira', () => {
    /*
     * L'INVARIANT 8, AL LLOC ON JA HA CALGUT ARREGLAR-LO. `SpotSearchProgress`
     * portava un `message` en català escrit dins de `core/spots/search.ts` i
     * arribava tal qual a la pantalla de qui té l'app en castellà. Ara l'etapa
     * és un codi i la frase surt de `strings.ts`: es comprova en castellà,
     * perquè en català qualsevol de les dues implementacions passaria.
     */
    panell({ locale: 'es' });
    fireEvent.click(botó('panel.search', 'es'));
    worker().respon({ type: 'progress', id: 1, progress: PROGRES({ stage: 'tiles' }) });

    expect(screen.getByText(sp('stage.tiles', 'es'))).toBeTruthy();
    expect(screen.queryByText(sp('stage.tiles', 'ca'))).toBeNull();

    const barra = screen.getByRole('progressbar', { name: sp('panel.progressLabel', 'es') });
    expect(barra.getAttribute('aria-valuenow')).toBe('42');
  });

  it('el motiu d’una avaria es tradueix; el text cru del motor no arriba', () => {
    panell({ locale: 'es' });
    fireEvent.click(botó('panel.search', 'es'));
    /*
     * El Worker encara respon `{ message }` i el `message` ÉS el codi (vegeu la
     * nota de `useSpotSearch`). Es respon amb un codi de debò, i el que es
     * comprova és que la pantalla no l'ensenyi tal com li arriba.
     */
    worker().respon({ type: 'error', id: 1, message: 'no-terrain' });

    expect(screen.getByText(sp('panel.failed', 'es'))).toBeTruthy();
    expect(screen.getByText(sp('error.noTerrain', 'es'))).toBeTruthy();
    expect(screen.queryByText('no-terrain')).toBeNull();
    expect(screen.queryByText(sp('error.noTerrain', 'ca'))).toBeNull();
  });

  it('un navegador sense Workers ho diu amb paraules, no amb un error tècnic', () => {
    muntaWorker();
    vi.stubGlobal('Worker', undefined);
    render(<SpotSearchPanel eclipseId="2026-08-12" locale="ca" origin={TAFALLA} showCost={false} />);

    fireEvent.click(botó('panel.search'));
    expect(screen.getByText(sp('error.noWorker', 'ca'))).toBeTruthy();
  });

  it('el Worker que peta sencer no deixa la pantalla girant per sempre', () => {
    panell();
    fireEvent.click(botó('panel.search'));
    worker().peta();

    expect(screen.getByText(sp('error.worker', 'ca'))).toBeTruthy();
    // I es torna a poder demanar: un botó viu és el que distingeix una avaria
    // d'un cul-de-sac.
    expect(botó('panel.search').disabled).toBe(false);
  });
});

describe('SpotSearchPanel · aturar no és fallar', () => {
  it('prémer «Atura» cancel·la la petició viva i no ensenya cap error', () => {
    panell();
    fireEvent.click(botó('panel.search'));
    const idViu = worker().cerques[0].id;

    fireEvent.click(botó('panel.stop'));

    expect(worker().rebuts).toContainEqual({ type: 'cancel', id: idViu });
    expect(screen.getByText(sp('panel.cancelled', 'ca'))).toBeTruthy();
    expect(screen.queryByText(sp('panel.failed', 'ca'))).toBeNull();
  });

  it('la resposta d’una cerca abandonada no repinta res', () => {
    /*
     * EL CAS QUE JUSTIFICA ELS IDENTIFICADORS. La cancel·lació no atura el que
     * ja és en vol: la resposta del motor pot arribar DESPRÉS. Si es pintés,
     * la pantalla ensenyaria els resultats d'una cerca que la persona ja ha
     * dit que no volia, i no tindria manera de saber-ho.
     */
    panell();
    fireEvent.click(botó('panel.search'));
    const idAbandonat = worker().cerques[0].id;
    fireEvent.click(botó('panel.stop'));

    worker().respon({ type: 'done', id: idAbandonat, outcome: resultat() });

    expect(screen.getByText(sp('panel.cancelled', 'ca'))).toBeTruthy();
    expect(screen.queryByText(sp('list.caveat', 'ca'))).toBeNull();
  });
});

describe('SpotSearchPanel · el mapa no es queda amb xinxetes velles', () => {
  it('els resultats pugen numerats des d’u, com els cercles de la llista', () => {
    const rebuts: unknown[] = [];
    panell({ onResults: (spots) => rebuts.push(spots) });
    fireEvent.click(botó('panel.search'));

    const a = lloc({ id: 'a', lat: 42.6, lon: -1.7 });
    const b = lloc({ id: 'b', lat: 42.4, lon: -1.5 });
    worker().respon({ type: 'done', id: 1, outcome: resultat({ results: [a, b] }) });

    expect(rebuts.at(-1)).toEqual([
      { lat: 42.6, lon: -1.7, index: 1 },
      { lat: 42.4, lon: -1.5, index: 2 },
    ]);
  });

  it('una cerca sense resultats retira les xinxetes en comptes de deixar-les', () => {
    /*
     * `null` i no una llista buida, i no és el mateix per al mapa: el contracte
     * de `onResults` diu que `null` NETEJA. Una cerca que no troba res després
     * d'una que sí que en trobava deixaria, si no, les xinxetes de l'anterior
     * damunt d'un missatge que diu que no hi ha res.
     */
    const rebuts: unknown[] = [];
    panell({ onResults: (spots) => rebuts.push(spots) });
    fireEvent.click(botó('panel.search'));
    worker().respon({ type: 'done', id: 1, outcome: resultat({ results: [] }) });

    expect(rebuts.at(-1)).toBeNull();
    expect(
      screen.getByText(sp('list.empty', 'ca', { radius: formatDistance(25, 'ca') })),
    ).toBeTruthy();
  });
});

describe('SpotList · el context va abans que les xifres', () => {
  const llista = (over: Partial<SpotSearchOutcome> = {}, locale: Locale = 'ca') => {
    muntaWorker();
    return render(
      <SpotList outcome={resultat(over)} locale={locale} eclipseId="2026-08-12" />,
    );
  };

  it('diu quants llocs surten de quants punts mirats, i en singular quan n’hi ha un', () => {
    llista({ results: [lloc()], candidates: 1187 });
    expect(
      screen.getByText(
        sp('list.contextOne', 'ca', { n: 1, candidates: 1187, radius: formatDistance(25, 'ca') }),
        { exact: false },
      ),
    ).toBeTruthy();
  });

  it('amb la franja de centralitat fora del radi ho diu, en comptes d’ordenar per segons que no hi són', () => {
    /*
     * LA FRASE QUE EVITA QUE LES XIFRES ENGANYIN. Sense franja dins del radi,
     * la llista segueix existint però ja no ordena per segons de totalitat: si
     * no es diu, «el millor lloc» sembla el que més totalitat té i és el que
     * té millor horitzó. Es comprova ALHORA que hi és la frase i que no hi és
     * la de la millor durada, que seria la contradicció.
     */
    llista({ centralReachable: false, bestCentralSec: 0 });

    expect(screen.getByText(sp('list.noCentral', 'ca'), { exact: false })).toBeTruthy();
    expect(
      screen.queryByText(sp('list.best', 'ca', { duration: durationText(101) }), { exact: false }),
    ).toBeNull();
  });

  it('amb la franja a dins, diu quant dura la millor fase central', () => {
    llista({ centralReachable: true, bestCentralSec: 101 });
    expect(
      screen.getByText(sp('list.best', 'ca', { duration: durationText(101) }), { exact: false }),
    ).toBeTruthy();
  });

  it('els números del garbell es declaren estimacions', () => {
    llista({ estimatedOnly: true });
    expect(screen.getByText(sp('list.estimate', 'ca'))).toBeTruthy();
  });

  it('les estimacions no es declaren quan els números són del perfil complet', () => {
    llista({ estimatedOnly: false });
    expect(screen.queryByText(sp('list.estimate', 'ca'))).toBeNull();
  });

  it('el model de terra nua es diu SEMPRE, també quan la llista va plena', () => {
    /*
     * És l'única cosa que el motor no pot saber: no hi ha arbres, ni cases, ni
     * la tanca del càmping. Amb dues dècimes de marge, un lloc bo sobre el
     * paper és un lloc sense marge. Si algú mou aquesta frase a un desplegable
     * «per netejar la llista», aquesta prova ho atura.
     */
    llista({ results: [lloc(), lloc({ id: 'b' })] });
    expect(screen.getByText(sp('list.caveat', 'ca'))).toBeTruthy();
  });
});

describe('SpotSearchPanel · la porta de privadesa, amb el component muntat', () => {
  it('de tota una cerca no en surt ni un número', () => {
    /*
     * LA PROMESA ESCRITA D'AQUEST PROJECTE, comprovada al lloc on es podria
     * trencar sense que ningú se n'adonés: el cercador coneix la posició de la
     * persona amb precisió de metres i el que mesura és quant s'ha esperat.
     * Una latitud és un número, i els segons d'espera també: cap dels dos no
     * pot creuar la frontera. Es mira el que ARRIBA AL TRANSPORT, que és
     * l'últim lloc abans de sortir de l'app, i no el que li passa qui crida.
     */
    const enviats: { name: string; params: Record<string, unknown> }[] = [];
    const transport: AnalyticsTransport = {
      send: (name, params) => enviats.push({ name, params }),
    };
    installAnalytics(transport);

    try {
      panell();
      fireEvent.click(botó('panel.search'));
      worker().respon({ type: 'progress', id: 1, progress: PROGRES() });
      worker().respon({ type: 'done', id: 1, outcome: resultat() });

      // Una cerca que arrenca acaba amb un esdeveniment i només un.
      expect(enviats.filter((e) => e.name === 'spot_search_run')).toHaveLength(1);

      for (const { params } of enviats) {
        for (const [clau, valor] of Object.entries(params)) {
          expect(
            typeof valor,
            `«${clau}» surt cap a fora amb un valor que no és una paraula`,
          ).toBe('string');
          // Ni tan sols una cadena que sigui un número disfressat.
          expect(Number.isNaN(Number(valor)), `«${clau}» = «${String(valor)}»`).toBe(true);
        }
      }
    } finally {
      // La frontera és estat de mòdul: qui la instal·la la retira, o la prova
      // següent hereta un transport que no ha demanat.
      installAnalytics(null);
    }
  });
});
