/**
 * Tests del guió de la totalitat.
 *
 * Dos grups. El primer comprova que els instants estiguin ben ancorats als
 * contactes: un guió que et diu «mira l'ombra» tres segons tard no serveix de
 * res, perquè no hi ha segona oportunitat.
 *
 * El segon protegeix la propietat que no es pot trencar mai: des d'un punt on
 * queda fotosfera visible, el guió no pot contenir cap instrucció de treure's
 * el filtre, en cap idioma, ni al text de pantalla ni al que llegeix la veu, ni
 * en directe ni en mode d'assaig. Si algun d'aquests tests falla, la resposta
 * correcta no és ajustar-lo: és desfer el canvi que l'ha trencat.
 */

import { describe, it, expect } from 'vitest';
import {
  buildScriptRehearsal,
  buildTotalityScript,
  mergeScriptIntoSchedule,
  scriptToAlerts,
} from './totality-script';
import type { ScriptBeat, TotalityScript } from './totality-script';
import { computeLocalCircumstances } from '../core/astro/contacts';
import type { ShadowMotion } from '../core/astro/shadow';
import type { VisibleBody } from '../core/astro/visibleBodies';
import type {
  Atmosphere,
  Contacts,
  EclipseKind,
  EclipseSample,
  GeoLocation,
  LocalCircumstances,
  SkyPosition,
} from '../core/astro/types';
// `filterOff()` surt del barril amb el sufix `Phrase` (vegeu `core/timer/index.ts`:
// el sufix el distingeix del valor `'filter-off'` d'`AlertKind`). Sense aquest
// import, la comprovació que el guió no reescriu el text que autoritza petava
// amb un ReferenceError, que és una manera silenciosa de no comprovar res.
import { buildAlertSchedule, FILTER_OFF_DELAY_SEC, filterOffPhrase } from '../core/timer';

/* ------------------------------------------------------------- bastida ---- */

const C2 = Date.UTC(2026, 7, 12, 19, 30, 0);
const ATMOSPHERE: Atmosphere = { pressureMb: 1013.25, temperatureC: 15 };
const LOCATION: GeoLocation = { lat: 41.7665, lon: -2.479, elevation: 1063 };

function sky(azimuth: number, altitude: number): SkyPosition {
  return {
    azimuth,
    altitudeTrue: altitude,
    altitudeApparent: altitude,
    ra: 9.5,
    dec: 14,
    distanceAu: 1,
    angularRadius: 0.26,
  };
}

function sample(atMs: number, obscuration: number): EclipseSample {
  return {
    time: new Date(atMs),
    sun: sky(280, 6),
    moon: sky(280, 6),
    separation: 0,
    magnitude: obscuration >= 1 ? 1.02 : 0.98,
    obscuration,
  };
}

/** Circumstàncies fabricades a mà: els tests de lògica no han de dependre de les efemèrides. */
function fakeCircumstances(options: {
  kind: EclipseKind;
  centralSec?: number;
  obscuration?: number;
  edgeUncertain?: boolean;
}): LocalCircumstances {
  const centralSec = options.centralSec ?? 0;
  const hasCentral = centralSec > 0;
  const c3 = C2 + centralSec * 1000;
  const contacts: Contacts = {
    c1: sample(C2 - 3600_000, 0),
    c2: hasCentral ? sample(C2, 1) : undefined,
    max: sample(hasCentral ? C2 + (centralSec * 1000) / 2 : C2, options.obscuration ?? 1),
    c3: hasCentral ? sample(c3, 1) : undefined,
    c4: sample((hasCentral ? c3 : C2) + 3600_000, 0),
  };

  return {
    // Deliberadament fora del catàleg: així cap test de lògica no acaba
    // calculant trajectòries de veritat sense adonar-se'n.
    eclipseId: 'test',
    location: LOCATION,
    atmosphere: ATMOSPHERE,
    kind: options.kind,
    contacts,
    centralDurationSec: centralSec,
    partialDurationSec: 7200,
    sunBelowHorizonDuringEvent: false,
    umbralMarginArcsec: -30,
    edgeUncertain: options.edgeUncertain ?? false,
  };
}

const SHADOW: ShadowMotion = {
  arrivalBearing: 250,
  departureBearing: 70,
  speedKmh: 6318,
  speedDiverging: false,
  watchFromUtc: new Date(C2 - 20_000),
  lowSunCaveat: true,
  sunAltitudeDeg: 6,
};

const BODIES: VisibleBody[] = [
  { name: 'Venus', azimuth: 300, altitude: 16, magnitude: -3.9 },
  { name: 'Júpiter', azimuth: 250, altitude: 2, magnitude: -1.8 },
];

function beat(script: TotalityScript, id: string): ScriptBeat {
  const found = script.beats.find((b) => b.id === id);
  if (!found) throw new Error(`No hi ha cap fita ${id}: ${script.beats.map((b) => b.id).join(', ')}`);
  return found;
}

/**
 * La comprovació que ho justifica tot: enlloc del guió, ni al text ni a la veu
 * ni a l'etiqueta, no hi pot haver cap manera de dir «treu-te el filtre».
 */
function expectNoFilterRemoval(script: TotalityScript): void {
  expect(script.filterGate.allowed).toBe(false);
  expect(script.beats.map((b) => b.filterState)).not.toContain('naked-eye');
  expect(script.beats.map((b) => b.kind)).not.toContain('filter-off');

  // La comprovació de debò és l'estructural, de dues línies més amunt: cap
  // fita `naked-eye` i cap avís de tipus `filter-off`. Aquesta és la segona
  // barrera, i busca les formes AFIRMATIVES concretes amb què es podria dir.
  // No busca «sense filtre» a seques perquè els textos que neguen que hi hagi
  // cap moment segur l'han de poder dir.
  const forbidden = [
    /pots treure/i,
    /puedes quitar/i,
    /treu-te el filtre/i,
    /quítate el filtro/i,
    /a ull nu/i,
    /a simple vista/i,
  ];
  for (const b of script.beats) {
    for (const text of [b.text.ca, b.text.es, b.speech.ca, b.speech.es, b.title.ca, b.title.es]) {
      for (const pattern of forbidden) expect(text).not.toMatch(pattern);
    }
  }
}

/* -------------------------------------------------------- ancoratge ------- */

describe('el guió està ancorat als contactes', () => {
  const script = buildTotalityScript({
    circumstances: fakeCircumstances({ kind: 'total', centralSec: 100 }),
    shadow: SHADOW,
    bodies: BODIES,
  });

  it('cada fita cau exactament a la seva àncora més el seu desplaçament', () => {
    const anchors = { c2: script.contacts.c2, c3: script.contacts.c3, max: script.contacts.max };
    for (const b of script.beats) {
      const base = anchors[b.anchor];
      expect(base).toBeDefined();
      expect(b.atMs).toBe((base as number) + b.offsetSec * 1000);
    }
  });

  it('les fites van ordenades i no n’hi ha cap fora de l’eclipsi', () => {
    const times = script.beats.map((b) => b.atMs);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    for (const t of times) {
      expect(t).toBeGreaterThan(script.contacts.c1 as number);
      expect(t).toBeLessThan(script.contacts.c4 as number);
    }
  });

  it('l’ombra que arriba es mira just abans de C2, i marxa després de C3', () => {
    expect(beat(script, 'shadow-wall').atMs).toBe(C2 - 20_000);
    expect(beat(script, 'shadow-departs').atMs).toBeGreaterThan(script.contacts.c3 as number);
  });

  it('el guió de l’ombra fa servir el rumb i la velocitat calculats', () => {
    const wall = beat(script, 'shadow-wall');
    // 250° arrodoneix a oest. I en català l'article s'hi apostrofa.
    expect(wall.text.ca).toContain('mira cap a l’oest');
    expect(wall.text.es).toContain('hacia el oeste');
    expect(wall.text.ca).toContain('6.300 km/h');
    // El Sol a 6° és prou baix perquè la paret sigui difusa, i s'ha de dir.
    expect(wall.text.ca).toContain('difusa');
    expect(script.caveats.map((c) => c.id)).toContain('low-sun-shadow');
  });

  it('els planetes surten amb la posició relativa al Sol, calculada per a aquest punt', () => {
    const planets = beat(script, 'planets');
    // Venus és a 300° amb el Sol a 280°: vint graus a la dreta i deu més amunt.
    expect(planets.text.ca).toContain('Venus, 20° a la dreta del Sol i 10° més amunt');
    expect(planets.text.es).toContain('Venus, 20° a la derecha del Sol y 10° más arriba');
  });

  it('diu la incertesa dels contactes amb el seu origen', () => {
    expect(script.caveats.map((c) => c.id)).toContain('contact-precision');
    expect(script.caveats.find((c) => c.id === 'contact-precision')?.text.ca).toContain('radis mitjans');
  });
});

/* ----------------------------------------------- totalitat autoritzada ---- */

describe('totalitat des de dins de la franja', () => {
  const script = buildTotalityScript({
    circumstances: fakeCircumstances({ kind: 'total', centralSec: 100 }),
    shadow: SHADOW,
    bodies: BODIES,
  });

  it('és la variant de totalitat i la porta ho autoritza', () => {
    expect(script.variant).toBe('totality');
    expect(script.filterGate.allowed).toBe(true);
    expect(script.filterGate.reason).toBe('ok');
  });

  it('hi ha una sola fita que autoritza a treure el filtre, i és després de C2', () => {
    const off = script.beats.filter((b) => b.kind === 'filter-off');
    expect(off).toHaveLength(1);
    expect(off[0].atMs).toBe(C2 + FILTER_OFF_DELAY_SEC * 1000);
    expect(off[0].severity).toBe('safety');
  });

  it('el text que autoritza és literalment el de core/timer, no una còpia', () => {
    // Si algú en fa una segona redacció, aquest test cau. És el punt.
    //
    // ABANS AQUEST TEST ES CONTRADEIA SOL: comprovava que no hi hagués cap còpia
    // del text... comparant-lo amb una còpia literal escrita aquí dins. Quan es
    // va canviar la redacció a `core/timer/phrases.ts` —per condicionar l'avís a
    // veure la corona en comptes de donar-lo pel rellotge— aquest test va caure,
    // i hauria d'haver passat: el guió sí que feia servir el text bo.
    //
    // Ara es compara contra la font, que és l'única manera que la comprovació
    // vulgui dir el que diu.
    expect(beat(script, 'filter-off').speech.ca).toBe(filterOffPhrase().speech.ca);
    expect(beat(script, 'filter-off').speech.es).toBe(filterOffPhrase().speech.es);

    // I que la redacció segueixi sent CONDICIONAL, que és la part que no depèn
    // de la precisió de cap motor: si algú la torna a convertir en una ordre
    // pel rellotge («Totalitat. Ja et pots treure el filtre»), aquest test cau.
    expect(beat(script, 'filter-off').speech.ca).toMatch(/^Si /);
    expect(beat(script, 'filter-off').speech.es).toMatch(/^Si /);
  });

  it('cap fita sense filtre no cau fora de la finestra segura', () => {
    const c3 = script.contacts.c3 as number;
    for (const b of script.beats.filter((x) => x.filterState === 'naked-eye')) {
      expect(b.atMs).toBeGreaterThanOrEqual(C2 + FILTER_OFF_DELAY_SEC * 1000);
      // Un segon abans del primer avís de tornar-se a posar el filtre.
      expect(b.atMs).toBeLessThanOrEqual(c3 - 16_000);
    }
  });

  it('els dos avisos de seguretat previs a C3 hi són, i abans de C3', () => {
    const c3 = script.contacts.c3 as number;
    expect(beat(script, 'filter-on-15').atMs).toBe(c3 - 15_000);
    expect(beat(script, 'filter-on-5').atMs).toBe(c3 - 5_000);
    expect(beat(script, 'filter-on-15').severity).toBe('safety');
    expect(beat(script, 'filter-on-5').severity).toBe('safety');
  });

  it('l’ordre no negociable: filtre fora després de C2, filtre posat abans de C3', () => {
    expect(beat(script, 'filter-off').atMs).toBeGreaterThan(C2);
    expect(beat(script, 'filter-off').atMs).toBeLessThan(beat(script, 'filter-on-15').atMs);
    expect(beat(script, 'filter-on-5').atMs).toBeLessThan(script.contacts.c3 as number);
  });

  it('després de C3 tot torna a ser amb filtre', () => {
    const c3 = script.contacts.c3 as number;
    for (const b of script.beats.filter((x) => x.atMs > c3 && x.look === 'sun')) {
      expect(b.filterState).toBe('filtered');
    }
  });

  it('hi ha la seqüència sencera que la totalitat mereix', () => {
    const ids = script.beats.map((b) => b.id);
    for (const id of [
      'shadow-bands-in',
      'shadow-wall',
      'beads-in',
      'diamond-in',
      'filter-off',
      'corona',
      'planets',
      'twilight-360',
      'temperature',
      'filter-on-15',
      'diamond-out',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('la cromosfera d’entrada ja no hi és, i és a propòsit', () => {
    // AQUESTA LLISTA EXIGIA 'chromosphere-in' I ERA UNA EXPECTATIVA DOLENTA.
    // Aquella fita era `naked-eye` a C2 + 6 s, sis segons ABANS que la porta de
    // seguretat autoritzi res. El nostre C2 s'avança fins a nou segons respecte
    // de les taules de l'IGN, o sigui que a C2 + 6 s hi pot haver fotosfera a
    // la vista: el test donava per bo precisament el que el retard de dotze
    // segons existeix per impedir.
    //
    // I no s'ha pogut desplaçar cap endins de la finestra en comptes de
    // descartar-la: la cromosfera d'entrada dura uns cinc segons i a C2 + 12 s
    // ja se sol haver acabat. Una fita que fa buscar el que ja no hi és gasta
    // els segons que no es recuperen. El que se'n podia dir honestament és al
    // text de `filter-off`; la de sortida, que sí que cau dins de la finestra,
    // manté fita pròpia.
    expect(script.beats.map((b) => b.id)).not.toContain('chromosphere-in');
    expect(script.beats.map((b) => b.id)).toContain('chromosphere-out');
    expect(beat(script, 'filter-off').text.ca).toContain('cromosfera');
    expect(beat(script, 'filter-off').text.es).toContain('cromosfera');
  });

  it('la corona no es diu damunt de l’avís que autoritza', () => {
    // La regressió que va destapar el canvi de seguretat: la corona anava a
    // C2 + 10 s i, en passar el retard de 2 a 12, `clampToNakedEyeWindow`
    // l'empenyia fins al primer instant de la finestra —el mateix mil·lisegon
    // que l'autorització—, i les dues frases sortien alhora. La frase que
    // autoritza és la més llarga de l'app i l'única que no es pot perdre.
    const off = beat(script, 'filter-off');
    const corona = beat(script, 'corona');
    expect(corona.atMs).toBeGreaterThanOrEqual(off.atMs + 4000);
  });

  it('cap parella de fites no es trepitja', () => {
    for (let i = 1; i < script.beats.length; i++) {
      expect(script.beats[i].atMs - script.beats[i - 1].atMs).toBeGreaterThanOrEqual(2000);
    }
  });
});

describe('totalitat curta, just per damunt del llindar', () => {
  // ABANS AQUÍ HI DEIA VINT-I-CINC SEGONS I JA NO POT SER. La durada mínima per
  // autoritzar res ha pujat a quaranta (`MIN_TOTALITY_FOR_FILTER_OFF_SEC`),
  // perquè amb dotze segons de retard una totalitat de vint només en deixava
  // vuit d'útils. Amb vint-i-cinc, la porta ara denega amb `totality-too-short`
  // i el guió és el de filtre posat: el test comprovava el retall de la corona
  // en un punt on el guió ja no ha de tenir cap corona.
  //
  // Quaranta-dos segons és el nou «just per damunt»: hi caben l'autorització,
  // la corona i els dos avisos de seguretat, i res més. La corona no pot
  // desaparèixer del guió per manca d'espai.
  const CENTRAL_SEC = 42;
  const script = buildTotalityScript({
    circumstances: fakeCircumstances({ kind: 'total', centralSec: CENTRAL_SEC }),
    shadow: null,
    bodies: [],
  });

  it('manté la corona i la retalla dins de la finestra segura', () => {
    expect(script.variant).toBe('totality');
    expect(script.filterGate.allowed).toBe(true);
    const corona = beat(script, 'corona');
    expect(corona.atMs).toBeGreaterThanOrEqual(C2 + FILTER_OFF_DELAY_SEC * 1000);
    expect(corona.atMs).toBeLessThanOrEqual(C2 + CENTRAL_SEC * 1000 - 16_000);
    expect(corona.atMs).toBe((script.contacts.c2 as number) + corona.offsetSec * 1000);
  });

  it('amb tan poc temps, cap fita no es trepitja amb una altra', () => {
    // La comprovació de la totalitat llarga, repetida aquí perquè el cas que
    // trenca la separació és justament el curt: la finestra sense filtre s'ha
    // escurçat per les dues bandes i les fites que no hi caben s'han de
    // descartar, no encavalcar.
    for (let i = 1; i < script.beats.length; i++) {
      expect(script.beats[i].atMs - script.beats[i - 1].atMs).toBeGreaterThanOrEqual(2000);
    }
  });

  it('cap durada autoritzada no deixa una fita sense filtre fora de la finestra', () => {
    // La comprovació de fons de tot aquest fitxer, feta per a TOTES les durades
    // que la porta autoritza i no només per a les dues que hi havia escrites.
    // Els guions es van trencar precisament perquè les fites estaven pensades
    // per a una totalitat de seixanta segons llargs i la finestra sense filtre
    // es va escurçar per les dues bandes; una durada solta no ho hauria vist.
    for (let centralSec = 40; centralSec <= 200; centralSec++) {
      const s = buildTotalityScript({
        circumstances: fakeCircumstances({ kind: 'total', centralSec }),
        shadow: null,
        bodies: [],
      });
      const c2 = s.contacts.c2 as number;
      const c3 = s.contacts.c3 as number;
      const label = `totalitat de ${centralSec} s`;

      // 1. Ni un mil·lisegon de mirar sense filtre fora de la finestra segura.
      for (const b of s.beats.filter((x) => x.filterState === 'naked-eye')) {
        expect(b.atMs, `${label}: ${b.id} abans de l’autorització`).toBeGreaterThanOrEqual(
          c2 + FILTER_OFF_DELAY_SEC * 1000,
        );
        expect(b.atMs, `${label}: ${b.id} massa a prop de C3`).toBeLessThanOrEqual(c3 - 16_000);
      }

      // 2. La corona hi és sempre, i mai damunt de l'avís que autoritza.
      const corona = s.beats.find((x) => x.id === 'corona');
      expect(corona, `${label}: falta la corona`).toBeDefined();
      const off = s.beats.find((x) => x.kind === 'filter-off');
      expect((corona as ScriptBeat).atMs - (off as ScriptBeat).atMs).toBeGreaterThanOrEqual(4000);

      // 3. Res no es trepitja amb res.
      for (let i = 1; i < s.beats.length; i++) {
        expect(
          s.beats[i].atMs - s.beats[i - 1].atMs,
          `${label}: ${s.beats[i - 1].id} i ${s.beats[i].id}`,
        ).toBeGreaterThanOrEqual(2000);
      }
    }
  });

  it('una totalitat de trenta-nou segons ja no autoritza res', () => {
    // El llindar és una frontera dura i s'ha de provar pels dos costats.
    const shorter = buildTotalityScript({
      circumstances: fakeCircumstances({ kind: 'total', centralSec: 39 }),
      shadow: null,
      bodies: [],
    });
    expect(shorter.filterGate.reason).toBe('totality-too-short');
    expectNoFilterRemoval(shorter);
  });

  it('no deixa cap fita sense filtre passat el primer avís de seguretat', () => {
    const limit = (script.contacts.c3 as number) - 15_000;
    for (const b of script.beats.filter((x) => x.filterState === 'naked-eye')) {
      expect(b.atMs).toBeLessThan(limit);
    }
  });
});

/* ------------------------------------------- el bloqueig de seguretat ----- */

describe('fora de la franja de totalitat', () => {
  it('una parcial profunda no diu mai que et treguis el filtre', () => {
    // El cas de Barcelona el 2026: el 99,8 % tapat, es fa fosc, tothom crida, i
    // queda fotosfera visible tota l'estona.
    const script = buildTotalityScript({
      circumstances: fakeCircumstances({ kind: 'partial', obscuration: 0.998 }),
      shadow: null,
    });
    expect(script.variant).toBe('filtered');
    expect(script.filterGate.reason).toBe('partial-only');
    expectNoFilterRemoval(script);
  });

  it('una totalitat tapada pel terreny tampoc', () => {
    const script = buildTotalityScript({
      circumstances: fakeCircumstances({ kind: 'total', centralSec: 100 }),
      centralPhaseVisible: false,
      shadow: SHADOW,
      bodies: BODIES,
    });
    expect(script.variant).toBe('filtered');
    expect(script.filterGate.reason).toBe('central-blocked-by-terrain');
    expectNoFilterRemoval(script);
    // I ho explica, en comptes de deixar l'usuari sense saber per què.
    expect(beat(script, 'why-filtered').text.ca).toContain('terreny');
  });

  it('una totalitat massa curta, damunt del límit de la franja, tampoc', () => {
    const script = buildTotalityScript({
      circumstances: fakeCircumstances({ kind: 'total', centralSec: 8 }),
      shadow: SHADOW,
    });
    expect(script.variant).toBe('filtered');
    expect(script.filterGate.reason).toBe('totality-too-short');
    expectNoFilterRemoval(script);
  });

  it('al caire de la franja el guió no autoritza res i ho diu', () => {
    // La contradicció que la comporta `edge-uncertain` existeix per impedir: el
    // guió deia alhora «ara pots treure’t el filtre» (fites) i «no podem dir si
    // hi haurà fase central des d’aquí» (incerteses). Passa perquè
    // `buildTotalityScript` no li passava `edgeUncertain` a `canRemoveFilter` i
    // la comporta era lletra morta.
    const script = buildTotalityScript({
      circumstances: fakeCircumstances({ kind: 'total', centralSec: 100, edgeUncertain: true }),
      shadow: SHADOW,
      bodies: BODIES,
    });
    expect(script.variant).toBe('filtered');
    expect(script.filterGate.reason).toBe('edge-uncertain');
    expectNoFilterRemoval(script);
    expect(script.caveats.map((c) => c.id)).toContain('edge-uncertain');
    expect(beat(script, 'why-filtered').text.ca).toContain('no sabem');
  });

  it('cap fita no es penja de C2 ni de C3 quan no s’hi pot mirar', () => {
    const script = buildTotalityScript({
      circumstances: fakeCircumstances({ kind: 'total', centralSec: 100 }),
      centralPhaseVisible: false,
      shadow: SHADOW,
    });
    expect(script.beats.map((b) => b.anchor)).not.toContain('c2');
    expect(script.beats.map((b) => b.anchor)).not.toContain('c3');
  });

  it('un punt sense eclipsi no genera cap fita', () => {
    const script = buildTotalityScript({
      circumstances: fakeCircumstances({ kind: 'none' }),
      shadow: null,
    });
    expect(script.variant).toBe('none');
    expect(script.beats).toHaveLength(0);
  });
});

describe('eclipsi anular', () => {
  const script = buildTotalityScript({
    circumstances: fakeCircumstances({ kind: 'annular', centralSec: 180, obscuration: 0.9 }),
    shadow: null,
  });

  it('no hi ha cap moment segur, i el guió no en promet cap', () => {
    expect(script.variant).toBe('annular');
    expect(script.filterGate.reason).toBe('annular');
    expectNoFilterRemoval(script);
  });

  it('hi ha una fita de seguretat que ho diu explícitament', () => {
    const never = beat(script, 'never-safe');
    expect(never.severity).toBe('safety');
    expect(never.speech.ca).toContain('no es treu en cap moment');
    expect(never.speech.es).toContain('no se quita en ningún momento');
  });

  it('no promet planetes ni crepuscle de 360°, que amb el 90 % no surten', () => {
    const ids = script.beats.map((b) => b.id);
    expect(ids).not.toContain('planets');
    expect(ids).not.toContain('twilight-360');
    expect(script.bodies).toHaveLength(0);
  });

  it('l’anell es tanca a C2 i s’obre a C3', () => {
    expect(beat(script, 'ring-closes').atMs).toBe(script.contacts.c2);
    expect(beat(script, 'ring-opens').atMs).toBe(script.contacts.c3);
  });
});

/* ----------------------------------------------- enllaç amb el timer ------ */

describe('conversió a avisos i fusió amb la programació', () => {
  const circumstances = fakeCircumstances({ kind: 'total', centralSec: 100 });
  const script = buildTotalityScript({ circumstances, shadow: SHADOW, bodies: BODIES });

  it('cada fita dona un avís amb el seu instant i el seu text', () => {
    const alerts = scriptToAlerts(script);
    expect(alerts).toHaveLength(script.beats.length);
    for (const alert of alerts) {
      expect(alert.id.startsWith('script:')).toBe(true);
      expect(alert.validForMs).toBeGreaterThan(0);
      expect(alert.speech.ca.length).toBeGreaterThan(0);
      expect(alert.speech.es.length).toBeGreaterThan(0);
    }
  });

  it('la fusió no duplica els avisos de filtre: els de la programació manen', () => {
    const schedule = buildAlertSchedule({
      kind: 'total',
      contacts: {
        c1: circumstances.contacts.c1?.time.getTime(),
        c2: script.contacts.c2,
        max: script.contacts.max,
        c3: script.contacts.c3,
        c4: script.contacts.c4,
      },
    });
    const merged = mergeScriptIntoSchedule(schedule, script);

    expect(merged.alerts.filter((a) => a.kind === 'filter-off')).toHaveLength(1);
    expect(merged.alerts.filter((a) => a.kind === 'filter-on')).toHaveLength(2);
    // Hi són tots els de la programació, més fites de contingut.
    for (const original of schedule.alerts) {
      expect(merged.alerts.some((a) => a.id === original.id)).toBe(true);
    }
    expect(merged.alerts.length).toBeGreaterThan(schedule.alerts.length);
  });

  it('la fusió deixa respirar els avisos de seguretat', () => {
    const schedule = buildAlertSchedule({
      kind: 'total',
      contacts: {
        c1: circumstances.contacts.c1?.time.getTime(),
        c2: script.contacts.c2,
        max: script.contacts.max,
        c3: script.contacts.c3,
        c4: script.contacts.c4,
      },
    });
    const merged = mergeScriptIntoSchedule(schedule, script);
    const safety = merged.alerts.filter((a) => a.severity === 'safety');
    for (const s of safety) {
      for (const other of merged.alerts) {
        if (other.id === s.id) continue;
        expect(Math.abs(other.atMs - s.atMs)).toBeGreaterThanOrEqual(1000);
      }
    }
  });

  it('cap fita sense filtre no s’escola en una programació que no ho autoritza', () => {
    // Defensa en profunditat: el guió és d'una totalitat, la programació és
    // d'una parcial. Encara que algú els creui per error, res del que arribi a
    // la veu no pot suposar que es pugui mirar sense filtre.
    const partial = buildAlertSchedule({
      kind: 'partial',
      contacts: { c1: C2 - 3600_000, max: C2, c4: C2 + 3600_000 },
    });
    const merged = mergeScriptIntoSchedule(partial, script);
    const nakedEyeIds = script.beats
      .filter((b) => b.filterState === 'naked-eye')
      .map((b) => `script:${b.id}`);
    for (const id of nakedEyeIds) {
      expect(merged.alerts.some((a) => a.id === id)).toBe(false);
    }
    expect(merged.alerts.map((a) => a.kind)).not.toContain('filter-off');
  });
});

/* --------------------------------------------------------- mode d'assaig -- */

describe('mode d’assaig', () => {
  it('sentir tota la seqüència de la totalitat en un minut', () => {
    const script = buildTotalityScript({
      circumstances: fakeCircumstances({ kind: 'total', centralSec: 100 }),
      shadow: SHADOW,
      bodies: BODIES,
    });
    const rehearsal = buildScriptRehearsal(script, { startMs: 0 });

    expect(rehearsal.rehearsal).toBe(true);
    // Entrada, totes les fites i comiat.
    expect(rehearsal.alerts.length).toBe(script.beats.length + 2);
    const last = rehearsal.alerts[rehearsal.alerts.length - 1];
    expect(last.atMs).toBeLessThanOrEqual(75_000);
    expect(last.atMs).toBeGreaterThan(30_000);

    // Cap frase no es trepitja amb la següent.
    for (let i = 1; i < rehearsal.alerts.length; i++) {
      expect(rehearsal.alerts[i].atMs - rehearsal.alerts[i - 1].atMs).toBeGreaterThanOrEqual(2000);
    }

    // L'ordre de la seqüència es manté: primer es treu el filtre, després es
    // torna a posar.
    const off = rehearsal.alerts.findIndex((a) => a.kind === 'filter-off');
    const on = rehearsal.alerts.findIndex((a) => a.kind === 'filter-on');
    expect(off).toBeGreaterThan(0);
    expect(on).toBeGreaterThan(off);
  });

  it('l’assaig d’un punt fora de la franja no diu mai que et treguis el filtre', () => {
    // És la raó de ser de l'assaig: comprovar-ho amb quinze dies d'antelació i
    // no amb quinze segons.
    const script = buildTotalityScript({
      circumstances: fakeCircumstances({ kind: 'partial', obscuration: 0.998 }),
      shadow: null,
    });
    const rehearsal = buildScriptRehearsal(script, { startMs: 0 });

    expect(rehearsal.filterGate.allowed).toBe(false);
    expect(rehearsal.alerts.map((a) => a.kind)).not.toContain('filter-off');
    for (const alert of rehearsal.alerts) {
      expect(alert.speech.ca).not.toMatch(/pots treure/i);
      expect(alert.speech.es).not.toMatch(/puedes quitar/i);
    }
  });

  it('l’assaig d’un anular tampoc', () => {
    const script = buildTotalityScript({
      circumstances: fakeCircumstances({ kind: 'annular', centralSec: 180, obscuration: 0.9 }),
      shadow: null,
    });
    const rehearsal = buildScriptRehearsal(script, { startMs: 0 });
    expect(rehearsal.alerts.map((a) => a.kind)).not.toContain('filter-off');
  });
});

/* ------------------------------------------------ amb el motor de debò ---- */

describe('amb les efemèrides reals del 12 d’agost de 2026', () => {
  it('des de Sòria, dins la franja, el guió és el de la totalitat sencera', () => {
    const circumstances = computeLocalCircumstances('2026-08-12', {
      lat: 41.7665,
      lon: -2.479,
      elevation: 1063,
    });
    expect(circumstances.kind).toBe('total');

    const script = buildTotalityScript({ circumstances });
    expect(script.variant).toBe('totality');

    const c2 = circumstances.contacts.c2?.time.getTime() as number;
    const c3 = circumstances.contacts.c3?.time.getTime() as number;
    expect(beat(script, 'filter-off').atMs).toBe(c2 + FILTER_OFF_DELAY_SEC * 1000);
    expect(beat(script, 'filter-on-15').atMs).toBe(c3 - 15_000);
    expect(beat(script, 'corona').atMs).toBeGreaterThan(c2);
    expect(beat(script, 'corona').atMs).toBeLessThan(c3 - 15_000);

    // L'ombra del 2026 arriba per ponent i el Sol és baix: totes dues coses
    // s'han de veure al guió.
    expect(script.shadow).not.toBeNull();
    expect(beat(script, 'shadow-wall').text.ca).toMatch(/oest/);
    expect(script.caveats.map((c) => c.id)).toContain('low-sun-shadow');

    // Venus és el planeta que es veurà des d'aquí, i el guió l'ha de nomenar.
    expect(script.bodies.map((b) => b.name)).toContain('Venus');
    expect(beat(script, 'planets').text.ca).toContain('Venus');
  });

  it('des de Barcelona, amb el 99,8 % tapat, el guió no autoritza res', () => {
    const circumstances = computeLocalCircumstances('2026-08-12', {
      lat: 41.3874,
      lon: 2.1686,
      elevation: 12,
    });
    expect(circumstances.kind).toBe('partial');

    const script = buildTotalityScript({ circumstances });
    expect(script.variant).toBe('filtered');
    expectNoFilterRemoval(script);
    // I encara li dona alguna cosa a mirar, que és la gràcia del guió.
    expect(script.beats.length).toBeGreaterThan(2);
  });

  it('l’anular del 26 de gener de 2028 no té cap instant sense filtre', () => {
    const circumstances = computeLocalCircumstances('2028-01-26', {
      lat: 39.4699,
      lon: -0.3763,
      elevation: 15,
    });
    expect(circumstances.kind).toBe('annular');

    const script = buildTotalityScript({ circumstances });
    expect(script.variant).toBe('annular');
    expectNoFilterRemoval(script);
  });
});
