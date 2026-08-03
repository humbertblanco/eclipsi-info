/**
 * Proves del comandament de la línia de temps.
 *
 * PER QUÈ AQUEST COMPONENT ÉS EL PRIMER DE TOTS. Perquè és l'únic de l'app on
 * una confusió de la interfície té conseqüència física. La capçalera de
 * `TimelineControls.tsx` ho diu sense embuts: un simulador que ensenyi una hora
 * sense dir que és simulada és, el dia de l'eclipsi, una manera de fer que algú
 * es tregui el filtre solar dos minuts abans d'hora. Tota aquesta bateria prova
 * una sola cosa des de cinc angles: QUE MAI ES PUGUI CONFONDRE EL MÓN AMB LA
 * SIMULACIÓ.
 *
 * QUÈ PROVA:
 *   · Que en temps real la barra menteixi amb la posició (l'eclipsi és d'aquí a
 *     nou dies i el botó està clavat a C1) però el TEXT ho desfaci, i que la
 *     lectura sigui l'hora de debò i no la posició capada.
 *   · Que en simulació sempre hi hagi la xifra de quant s'allunya del món.
 *   · Que cap dels quatre estats possibles deixi el rellotge nu.
 *   · Que el commutador digui de quin món és l'hora i que canviar-lo canviï el
 *     món de debò, no només l'etiqueta.
 *   · Que una finestra sense amplada no es pugui reproduir.
 *   · Que el pas de la barra sigui el de les mostres (240), que és el que fa que
 *     el marcador caigui damunt d'una mostra i no entre dues.
 *
 * QUÈ NO PROVA:
 *   · Res del reductor. Aquell és pur, corre a Node i té la seva bateria a
 *     `core/timeline/playback.test.ts`: el final clavat a C4, el canvi de
 *     velocitat sense saltar i el fotograma de la pestanya amagada. Repetir-ho
 *     aquí seria pagar jsdom per fer aritmètica.
 *   · Res de com es veu. No hi ha ni una assercíó sobre una classe de CSS. Que
 *     l'ambre sigui de la barra i que el conjunt es llegeixi com un reproductor
 *     i no com un panell d'ajustos són decisions bones i verificables MIRANT-HO,
 *     que és el que fa el protocol manual.
 *
 * L'AMFITRIÓ NO ÉS UN SIMULACRE. `TimelineControls` demana un `SimulationClock`
 * i el seu tipus diu explícitament que una pantalla que governi l'instant pel
 * seu compte el pot satisfer sense el hook. Això és exactament el que fa
 * `Banc`: hi posa el REDUCTOR DE DEBÒ (`timelineReduce`) i li deixa l'hora real
 * fixa. Prémer un botó fa córrer la màquina d'estats de veritat, i el que es
 * comprova després és el que la persona hauria vist. L'única cosa falsa d'aquí
 * dins és el rellotge de paret, i ho ha de ser: una prova que depengui de
 * `Date.now()` falla sola el dia que l'eclipsi arribi.
 */

import { useReducer } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import {
  createTimeline,
  timelineReduce,
  NUDGE_MS,
  type ContactId,
  type PlaybackRate,
  type TimelineMark,
  type TimelineSource,
  type TimelineWindow,
} from '../../core/timeline';
import type { Locale } from '../../i18n';
import { formatClock } from '../../screens/format';
import { TimelineControls } from './TimelineControls';
import { TRAJECTORY_SAMPLES } from './samples';
import { hs, timeGapText } from './strings';
import type { SimulationClock } from './useSimulationClock';

/*
 * L'ECLIPSI DEL 12 D'AGOST DE 2026 VIST DES DE TAFALLA, en números rodons: C1 a
 * les 19:29 UTC, màxim a les 20:29 i C4 a les 21:19. La finestra fa 6.600 s, que
 * és de l'ordre de les que dona `timelineFromContacts` per als eclipsis del
 * catàleg. Números fixos i no `Date.now()`: aquesta prova ha de dir el mateix el
 * 2027.
 */
const C1 = Date.UTC(2026, 7, 12, 19, 29, 0);
const C2 = Date.UTC(2026, 7, 12, 20, 28, 10);
const MAX = Date.UTC(2026, 7, 12, 20, 29, 0);
const C3 = Date.UTC(2026, 7, 12, 20, 29, 50);
const C4 = Date.UTC(2026, 7, 12, 21, 19, 0);

const WINDOW: TimelineWindow = { startMs: C1, endMs: C4 };
const MARKS: readonly TimelineMark[] = [
  { id: 'c1', atMs: C1 },
  { id: 'c2', atMs: C2 },
  { id: 'max', atMs: MAX },
  { id: 'c3', atMs: C3 },
  { id: 'c4', atMs: C4 },
];

/** Nou dies abans de l'eclipsi: el 99 % del temps que es fa servir l'app. */
const ABANS = Date.UTC(2026, 7, 3, 12, 0, 0);
/** Enmig de la parcialitat, el dia bo. */
const DURANT = MAX - 10 * 60_000;
/** L'endemà. */
const DESPRES = Date.UTC(2026, 7, 13, 9, 0, 0);

interface BancProps {
  locale?: Locale;
  window?: TimelineWindow;
  marks?: readonly TimelineMark[];
  source?: TimelineSource;
  rate?: PlaybackRate;
  /** Instant d'arrencada de la simulació. En directe s'ignora, com al motor. */
  timeMs?: number;
  /** L'hora de paret, fixa. És l'única cosa d'aquest banc que no és real. */
  realNowMs: number;
}

function Banc({
  locale = 'ca',
  window: win = WINDOW,
  marks = MARKS,
  source = 'live',
  rate = 1,
  timeMs,
  realNowMs: fixedNowMs,
}: BancProps) {
  const nowMs = fixedNowMs;
  const [state, dispatch] = useReducer(timelineReduce, null, () =>
    createTimeline({ window: win, marks, nowMs, source, rate, timeMs }),
  );

  const clock: SimulationClock = {
    state,
    timeMs: state.timeMs,
    realNowMs: nowMs,
    play: () => dispatch({ type: 'play' }),
    pause: () => dispatch({ type: 'pause' }),
    toggle: () => dispatch({ type: 'toggle' }),
    replay: () => dispatch({ type: 'replay' }),
    setRate: (next: PlaybackRate) => dispatch({ type: 'setRate', rate: next }),
    seek: (next: number) => dispatch({ type: 'seek', timeMs: next }),
    nudge: (deltaMs: number = NUDGE_MS) => dispatch({ type: 'nudge', deltaMs }),
    jump: (mark: ContactId) => dispatch({ type: 'jump', mark }),
    enterSim: () => dispatch({ type: 'enterSim' }),
    goLive: () => dispatch({ type: 'goLive', nowMs }),
  };

  return <TimelineControls clock={clock} locale={locale} />;
}

/** La barra. Es busca pel nom accessible, que és el que sent qui no la veu. */
const barra = (locale: Locale = 'ca'): HTMLInputElement =>
  screen.getByRole('slider', { name: hs('timeline.scrub', locale) }) as HTMLInputElement;

const commutador = (locale: Locale = 'ca'): HTMLElement =>
  screen.getByRole('tablist', { name: hs('timeline.mode', locale) });

describe('TimelineControls · temps real contra simulació', () => {
  it('en directe amb l’eclipsi encara lluny, la barra es capa però la lectura és l’hora de debò', () => {
    render(<Banc source="live" realNowMs={ABANS} />);

    /*
     * LES DUES MEITATS D'AQUESTA DECISIÓ, JUNTES.
     *
     * La barra NO pot ensenyar el 3 d'agost: un `input[type=range]` no accepta
     * valors fora de rang i el component el capa a C1 a posta. Sol, això diria
     * que l'eclipsi està començant ara mateix.
     *
     * El que ho desfà és que la LECTURA no es capa: `aria-valuetext` porta
     * l'hora real i sota la barra hi ha la frase que diu que l'eclipsi encara
     * no ha començat. Si algú «arregla» el capat fent que la lectura també es
     * capi, aquesta prova és l'única que ho aturarà.
     */
    expect(barra().value).toBe(String(C1));
    expect(barra().getAttribute('aria-valuetext')).toBe(formatClock(new Date(ABANS), 'ca'));
    expect(screen.getByText(hs('timeline.liveBefore', 'ca'))).toBeTruthy();
  });

  it('en directe diu en quin dels tres moments de l’eclipsi som', () => {
    const casos = [
      { nowMs: ABANS, clau: 'timeline.liveBefore' },
      { nowMs: DURANT, clau: 'timeline.liveDuring' },
      { nowMs: DESPRES, clau: 'timeline.liveAfter' },
    ] as const;

    for (const cas of casos) {
      const vista = render(<Banc source="live" realNowMs={cas.nowMs} />);
      expect(screen.getByText(hs(cas.clau, 'ca'))).toBeTruthy();
      // Cap dels altres dos moments no hi pot ser alhora.
      for (const altre of casos) {
        if (altre.clau === cas.clau) continue;
        expect(screen.queryByText(hs(altre.clau, 'ca'))).toBeNull();
      }
      vista.unmount();
    }
  });

  it('en simulació diu SEMPRE quant s’allunya del món, amb la xifra', () => {
    // Simulació posada al màxim mentre el rellotge de paret marca nou dies
    // abans: el desfasament és de dies, no de minuts.
    render(<Banc source="sim" timeMs={MAX} realNowMs={ABANS} />);

    const esperat = timeGapText(MAX - ABANS, 'ca');
    expect(esperat).toContain('per davant de l’hora real');
    expect(screen.getByText(esperat)).toBeTruthy();

    // I cap de les tres frases del món real, que dirien que això és l'hora que és.
    for (const clau of ['timeline.liveBefore', 'timeline.liveDuring', 'timeline.liveAfter'] as const) {
      expect(screen.queryByText(hs(clau, 'ca'))).toBeNull();
    }
  });

  it('una simulació aturada JUST a l’hora real segueix dient que és simulada', () => {
    /*
     * EL CAS DOLENT DE TOTS. A l'hora exacta de l'eclipsi, algú que hagi tocat
     * la barra i l'hagi deixada damunt de l'instant real veu la mateixa hora que
     * veuria en directe. Si la frase callés perquè el desfasament és zero, les
     * dues pantalles serien idèntiques i la de mentida autoritzaria a treure's
     * el filtre. `timeGapText` té una frase pròpia per a aquest cas i és
     * l'única raó per la qual existeix.
     */
    render(<Banc source="sim" timeMs={MAX} realNowMs={MAX} />);
    expect(screen.getByText(hs('timeline.atNow', 'ca'))).toBeTruthy();
    expect(hs('timeline.atNow', 'ca')).toContain('simulada');
  });

  it('el commutador canvia de món de debò, no només d’etiqueta', () => {
    render(<Banc source="live" realNowMs={DURANT} />);

    const opcions = () => screen.getAllByRole('tab');
    const directe = () => screen.getByRole('tab', { name: hs('timeline.live', 'ca') });
    const simulacio = () => screen.getByRole('tab', { name: hs('timeline.sim', 'ca') });

    /*
     * El commutador de mode és el primer `tablist`: el segon és el de velocitat.
     * Es comprova amb `Node.contains` i no amb `toContainElement`, que és un
     * matcher de `@testing-library/jest-dom` —una dependència que aquest
     * projecte NO té i que no val la pena afegir per una línia: el DOM ja sap
     * respondre la pregunta.
     */
    expect(commutador().contains(directe())).toBe(true);
    expect(opcions().length).toBeGreaterThanOrEqual(2);
    expect(directe().getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(hs('timeline.liveDuring', 'ca'))).toBeTruthy();

    fireEvent.click(simulacio());

    // No n'hi ha prou que el botó canviï d'estat: la FRASE ha de canviar de
    // família, perquè és la que la persona llegeix.
    expect(simulacio().getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByText(hs('timeline.liveDuring', 'ca'))).toBeNull();
    expect(screen.getByText(timeGapText(DURANT - DURANT, 'ca'))).toBeTruthy();

    fireEvent.click(directe());
    expect(directe().getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(hs('timeline.liveDuring', 'ca'))).toBeTruthy();
  });

  it('tocar el temps entra en simulació encara que ningú no toqui el commutador', () => {
    /*
     * La regla és del reductor («qui toca el temps entra en simulació») però la
     * conseqüència que importa és aquesta: no hi ha cap camí per moure l'hora i
     * que la pantalla segueixi dient «Temps real». Es prova pel camí que fa
     * servir la persona, que és prémer «un minut endavant».
     */
    render(<Banc source="live" realNowMs={DURANT} />);
    expect(screen.getByRole('tab', { name: hs('timeline.live', 'ca') }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: hs('timeline.forward', 'ca') }));

    expect(screen.getByRole('tab', { name: hs('timeline.sim', 'ca') }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByText(hs('timeline.liveDuring', 'ca'))).toBeNull();
  });
});

describe('TimelineControls · el comandament', () => {
  it('salta al contacte que es prem i ho ensenya al rellotge', () => {
    render(<Banc source="sim" timeMs={C1} realNowMs={ABANS} />);

    expect(barra().value).toBe(String(C1));
    fireEvent.click(screen.getByRole('button', { name: hs('timeline.jump.c3', 'ca') }));

    expect(barra().value).toBe(String(C3));
    expect(barra().getAttribute('aria-valuetext')).toBe(formatClock(new Date(C3), 'ca'));
  });

  it('el pas de la barra és el de les mostres de la corba, no un segon', () => {
    /*
     * La barra i la corba comparteixen graella a posta: amb 240 mostres el
     * marcador cau damunt d'una mostra i no entre dues, i creuar l'eclipsi amb
     * el teclat són 240 premudes en comptes de les 6.300 d'un pas d'un segon.
     * Si algú posa `step={1000}` «per fer-ho rodó», el marcador deixa de caure
     * damunt de la corba i no ho veurà ningú fins que ho miri de prop.
     */
    render(<Banc source="sim" timeMs={MAX} realNowMs={ABANS} />);
    expect(Number(barra().step)).toBeCloseTo((C4 - C1) / TRAJECTORY_SAMPLES, 6);
    expect(Number(barra().step)).toBeCloseTo(27.5 * 1000, 0);
  });

  it('una finestra sense amplada no es pot reproduir', () => {
    /*
     * Passa de debò: un eclipsi que des d'aquest punt no tingui contactes
     * parcials col·lapsa la finestra al màxim (`timelineFromContacts`). Un botó
     * de reproduir viu damunt d'una finestra buida no reprodueix res i sembla
     * espatllat; desactivat, diu la veritat.
     */
    render(<Banc source="sim" window={{ startMs: MAX, endMs: MAX }} marks={[]} realNowMs={ABANS} />);

    expect((barra() as HTMLInputElement).disabled).toBe(true);
    for (const clau of ['timeline.play', 'timeline.back', 'timeline.forward'] as const) {
      const boto = screen.getByRole('button', { name: hs(clau, 'ca') }) as HTMLButtonElement;
      expect(boto.disabled).toBe(true);
    }
  });

  it('sense contactes no hi ha fila per saltar-hi', () => {
    render(<Banc source="sim" marks={[]} timeMs={MAX} realNowMs={ABANS} />);
    expect(screen.queryByRole('group', { name: hs('timeline.contacts', 'ca') })).toBeNull();
  });
});

describe('TimelineControls · idioma', () => {
  it('en castellà no hi queda ni una frase en català', () => {
    /*
     * L'INVARIANT 8 D'ESTAT.md, comprovat on es trenca. Aquest fitxer no escriu
     * cap text —tot surt de `strings.ts`—, i justament per això la regressió
     * possible és una frase clavada a mà «mentre no la munta ningú».
     *
     * PER QUÈ NO ES BUSCA L'ABSÈNCIA DEL CATALÀ AL COS DEL DOCUMENT. Es va
     * provar i era una prova FALSA: «Simulació» és un prefix de «Simulación»,
     * de manera que un `not.toContain` de la cadena catalana falla damunt d'una
     * pantalla perfectament castellana. Amb dues llengües tan properes, cercar
     * subcadenes no distingeix res. El que es compara és el NOM ACCESSIBLE de
     * cada control —el que la persona llegeix i el que sent qui no hi veu— amb
     * la columna castellana sencera: si algú clava una cadena catalana, el nom
     * deixa de ser el que toca i `getByRole` no troba el control.
     */
    render(<Banc source="sim" timeMs={MAX} realNowMs={ABANS} locale="es" />);

    for (const clau of ['timeline.live', 'timeline.sim'] as const) {
      expect(hs(clau, 'es')).not.toBe(hs(clau, 'ca'));
      expect(screen.getByRole('tab', { name: hs(clau, 'es') }).textContent).toBe(hs(clau, 'es'));
    }
    expect(commutador('es')).toBeTruthy();
    expect(barra('es')).toBeTruthy();
    expect(screen.getByText(timeGapText(MAX - ABANS, 'es'))).toBeTruthy();
  });
});
