/**
 * Proves del guió de fixar un punt.
 *
 * AIXÒ ÉS EL QUE NO PROVAVA NINGÚ. `useObserver` no tenia cap prova i no era ni
 * accessible des de cap fitxer de test: ni la regla de fixar la posició abans de
 * l'altitud, ni el tiquet de carrera, que porta escrit al capdamunt l'error que
 * ja es va publicar un cop. Aquí es prova la part que decideix, que és pura, i
 * el que en queda al hook són quatre `useState` i una crida al navegador.
 *
 * Els tres casos que han fet mal de debò, i que aquí no poden tornar sense que
 * alguna cosa es posi vermella:
 *
 *  1. Esperar l'altitud per donar la posició. Vint segons de «Cercant el
 *     senyal…» amb el GPS ja resolt.
 *  2. Aplicar una altitud que torna d'un punt que l'usuari ja ha descartat.
 *  3. Desar un `pending` al disc, que en tornar és un zero que ningú no revisa.
 */

import { describe, expect, it } from 'vitest';
import type { FixedLocation } from './location';
import {
  fixAndResolve,
  fixFromPick,
  fixFromPosition,
  fixFromStored,
  needsElevation,
  toRecent,
  withResolvedElevation,
  type FixFlow,
  type FixPhase,
  type ResolvedElevation,
} from './observerFlow';
import type { RecentPlace } from './recentPlaces';

/** Una altitud que no arriba fins que la prova ho digui. Com la xarxa dolenta. */
function deferred<T>(): { promise: Promise<T>; settle: (value: T) => void } {
  let settle!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

interface Harness {
  flow: FixFlow;
  /** Tot el que s'ha fixat, en ordre. */
  commits: { fix: FixedLocation; phase: FixPhase }[];
  /** Quantes vegades s'ha demanat l'altitud al model del terreny. */
  asked: number;
  /** Fa arribar la tessel·la. */
  tile: (resolved: ResolvedElevation) => void;
  /** Simula que l'usuari ha triat un altre lloc mentrestant. */
  moveOn: () => void;
  /** Simula un nom que arriba de la xarxa mentre l'altitud viatja. */
  rename: (label: string) => void;
}

function harness(startsStale = false): Harness {
  const pending = deferred<ResolvedElevation>();
  const commits: { fix: FixedLocation; phase: FixPhase }[] = [];
  let current: FixedLocation | null = null;
  let stale = startsStale;

  const h: Harness = {
    commits,
    asked: 0,
    tile: pending.settle,
    moveOn: () => {
      stale = true;
    },
    rename: (label) => {
      if (current !== null) current = { ...current, label };
    },
    flow: {
      commit: (fix, phase) => {
        commits.push({ fix, phase });
        current = fix;
      },
      resolve: () => {
        h.asked += 1;
        return pending.promise;
      },
      stale: () => stale,
      current: () => current,
    },
  };
  return h;
}

const PICK = { lat: 42.3439, lon: -3.6969, origin: 'search' as const, label: 'Burgos' };

describe('triar un lloc', () => {
  it('el punt queda fixat abans d’haver esperat cap tessel·la', () => {
    const h = harness();
    // A posta sense `await`: el que es prova és que la posició hi és ABANS de
    // cedir el control. Si algun dia torna a haver-hi un `await` davant del
    // primer `commit`, aquí no hi haurà res i això s'aturarà.
    void fixAndResolve(fixFromPick(PICK, 1_000), h.flow);

    expect(h.commits).toHaveLength(1);
    expect(h.commits[0].phase).toBe('placed');
    expect(h.commits[0].fix.location.lat).toBe(42.3439);
    expect(h.commits[0].fix.label).toBe('Burgos');
    expect(h.commits[0].fix.elevationSource).toBe('pending');
  });

  it('l’altitud s’hi enganxa quan arriba', async () => {
    const h = harness();
    const done = fixAndResolve(fixFromPick(PICK, 1_000), h.flow);
    h.tile({ elevation: 860, source: 'dem' });
    await done;

    expect(h.commits).toHaveLength(2);
    expect(h.commits[1].phase).toBe('elevation');
    expect(h.commits[1].fix.location.elevation).toBe(860);
    expect(h.commits[1].fix.elevationSource).toBe('dem');
    // I la posició no s'ha mogut ni un decimal pel camí.
    expect(h.commits[1].fix.location.lon).toBe(-3.6969);
  });

  it('el nom que ha arribat mentre l’altitud viatjava no es perd', async () => {
    const h = harness();
    const done = fixAndResolve(
      fixFromPick({ lat: 42.3439, lon: -3.6969, origin: 'map' }, 1_000),
      h.flow,
    );
    // La cerca inversa del nom i la tessel·la del terreny són dues peticions
    // independents i guanya qui vulgui. Si la segona passada reescrivís el punt
    // de la primera, el nom s'esborraria tot sol de la pantalla.
    h.rename('Burgos');
    h.tile({ elevation: 860, source: 'dem' });
    await done;

    expect(h.commits[1].fix.label).toBe('Burgos');
  });

  it('sense tessel·la, el punt es queda i la font ho diu', async () => {
    const h = harness();
    const done = fixAndResolve(fixFromPick(PICK, 1_000), h.flow);
    h.tile({ elevation: 0, source: 'assumed' });
    await done;

    expect(h.commits[1].fix.location.lat).toBe(42.3439);
    expect(h.commits[1].fix.elevationSource).toBe('assumed');
  });
});

describe('«on soc ara»', () => {
  const POS = { lat: 41.3851, lon: 2.1734, accuracyM: 8, gpsElevationM: 56 };

  it('la posició del GPS es dona sencera de seguida', () => {
    const h = harness();
    void fixAndResolve(fixFromPosition(POS, 1_000), h.flow);

    // Aquest és l'error que es va publicar: el GPS responia als 12 s, la
    // tessel·la trigava 8 s més i durant vint segons `fix` era null i la barra
    // deia «Cercant el senyal…» amb la posició ja sabuda.
    expect(h.commits).toHaveLength(1);
    expect(h.commits[0].fix.location.lat).toBe(41.3851);
    expect(h.commits[0].fix.origin).toBe('gps');
    expect(h.commits[0].fix.accuracyM).toBe(8);
    expect(h.commits[0].fix.elevationSource).toBe('pending');
  });

  it('l’altitud del GPS es guarda però no és la que es fa servir', async () => {
    const h = harness();
    const done = fixAndResolve(fixFromPosition(POS, 1_000), h.flow);
    h.tile({ elevation: 4, source: 'dem' });
    await done;

    expect(h.commits[1].fix.location.elevation).toBe(4);
    expect(h.commits[1].fix.gpsElevationM).toBe(56);
  });
});

describe('carreres', () => {
  it('una resposta que arriba quan l’usuari ja ha triat un altre lloc no fixa res', () => {
    const h = harness(true);
    void fixAndResolve(fixFromPosition(
      { lat: 41.3851, lon: 2.1734, accuracyM: 8, gpsElevationM: null },
      1_000,
    ), h.flow);

    // El GPS pot tardar quinze segons. Si mentrestant s'ha tocat un punt del
    // mapa, aquesta resposta tapar-lo-hi seria moure l'usuari de lloc sense
    // que ho hagi demanat.
    expect(h.commits).toHaveLength(0);
    expect(h.asked).toBe(0);
  });

  it('l’altitud d’un punt descartat no s’aplica al punt nou', async () => {
    const h = harness();
    const done = fixAndResolve(fixFromPick(PICK, 1_000), h.flow);
    h.moveOn();
    h.tile({ elevation: 860, source: 'dem' });
    await done;

    // Dos punts tocats seguits al mapa poden tornar en l'ordre contrari. Sense
    // aquesta guarda, l'app es quedava calculant amb l'altitud d'un lloc que
    // l'usuari ja havia descartat, i res a la pantalla no ho deia.
    expect(h.commits).toHaveLength(1);
    expect(h.commits[0].phase).toBe('placed');
  });
});

describe('tornar a obrir l’app', () => {
  const stored = (extra: Partial<RecentPlace> = {}): RecentPlace => ({
    lat: 42.5,
    lon: 0.75,
    elevation: 1520,
    label: 'Refugi',
    origin: 'search',
    atMs: 5_000,
    ...extra,
  });

  it('el punt torna marcat com a recuperat i amb la seva font', () => {
    const fix = fixFromStored(stored({ elevationSource: 'dem' }));
    expect(fix.restored).toBe(true);
    expect(fix.location.elevation).toBe(1520);
    expect(fix.elevationSource).toBe('dem');
    expect(fix.atMs).toBe(5_000);
  });

  it('una entrada antiga sense font diu que no se sap', () => {
    expect(fixFromStored(stored()).elevationSource).toBe('assumed');
  });

  it('una altitud del model no es torna a demanar', async () => {
    const h = harness();
    await fixAndResolve(fixFromStored(stored({ elevationSource: 'dem' })), h.flow);

    // El terreny no es mou: tornar a baixar la tessel·la a cada arrencada seria
    // gastar dades per confirmar el que ja sabem.
    expect(h.asked).toBe(0);
    expect(h.commits).toHaveLength(1);
  });

  it('una altitud suposada es torna a resoldre en arrencar', async () => {
    const h = harness();
    const restored = fixFromStored(stored({ elevation: 0, elevationSource: 'assumed' }));
    const done = fixAndResolve(restored, h.flow);

    // El punt hi és des del primer instant, amb el zero desat i dient-ho.
    expect(h.commits[0].fix.location.elevation).toBe(0);
    expect(h.commits[0].fix.elevationSource).toBe('assumed');

    h.tile({ elevation: 1520, source: 'dem' });
    await done;

    // I ara sí. Sense això, algú que va triar el refugi sense cobertura tenia
    // les hores dels contactes calculades al nivell del mar per sempre més.
    expect(h.asked).toBe(1);
    expect(h.commits[1].fix.location.elevation).toBe(1520);
    expect(h.commits[1].fix.elevationSource).toBe('dem');
    expect(h.commits[1].fix.restored).toBe(true);
  });

  it('la del GPS també, que té trenta metres d’error vertical', () => {
    expect(needsElevation('gps')).toBe(true);
    expect(needsElevation('pending')).toBe(true);
    expect(needsElevation('assumed')).toBe(true);
    expect(needsElevation('dem')).toBe(false);
  });
});

describe('el que se’n desa', () => {
  const fix: FixedLocation = {
    location: { lat: 42.5, lon: 0.75, elevation: 0 },
    origin: 'search',
    label: 'Refugi',
    accuracyM: null,
    elevationSource: 'pending',
    gpsElevationM: null,
    atMs: 5_000,
    restored: false,
  };

  it('«pendent» no s’escriu mai al disc', () => {
    // «Pendent» vol dir que hi ha una petició en marxa, i una petició no
    // sobreviu a tancar l'app. Desat tal qual, en tornar només en quedava un
    // zero que semblava una altitud i no ho era.
    expect(toRecent(fix).elevationSource).toBe('assumed');
  });

  it('les altres fonts es desen tal com són', () => {
    expect(toRecent({ ...fix, elevationSource: 'dem' }).elevationSource).toBe('dem');
    expect(toRecent({ ...fix, elevationSource: 'gps' }).elevationSource).toBe('gps');
  });

  it('anada i tornada pel disc: el que es desa és el que es recupera', () => {
    const resolved = withResolvedElevation(fix, { elevation: 1520, source: 'dem' });
    const back = fixFromStored(toRecent(resolved));

    expect(back.location).toEqual({ lat: 42.5, lon: 0.75, elevation: 1520 });
    expect(back.elevationSource).toBe('dem');
    expect(back.label).toBe('Refugi');
    expect(back.origin).toBe('search');
  });

  it('un punt encara pendent torna com a suposat i es torna a resoldre', () => {
    const back = fixFromStored(toRecent(fix));
    expect(back.elevationSource).toBe('assumed');
    expect(needsElevation(back.elevationSource)).toBe(true);
  });
});
