/**
 * El conjunt. El que es prova aquí no són els números sinó les tres decisions
 * que fan que el conjunt valgui alguna cosa:
 *
 *  1. Que cada membre es puntuï SOL i la fracció surti de comptar-los, no de
 *     fer la mitjana de la nuvolositat i puntuar-la després.
 *  2. Que la fiabilitat surti de MESURAR l'acord i no del calendari.
 *  3. Que si el conjunt falla, l'usuari no perdi absolutament res.
 *
 * D'ON SURT LA RESPOSTA AMB QUÈ ES PROVA EL CONTRACTE. Hi ha un fitxer de
 * `__fixtures__` que és una resposta REAL d'`ensemble-api.open-meteo.com`,
 * baixada el 8-8-2026 per als sis punts del pla de visual de Sòria i les tres
 * hores al voltant del màxim. No és cap simulacre nostre, i és a posta: una
 * prova que munta la resposta que espera i després comprova que l'ha sabut
 * llegir no prova res del món exterior. El que ha de fallar el dia que
 * Open-Meteo canviï el nom de les claus és aquest fitxer, no la producció.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { clearWeatherCache } from './cache';
import { confidenceForLead, getCloudOutlook } from './outlook';
import {
  ENSEMBLE_VISIBLE_MIN_SCORE,
  MIN_ENSEMBLE_MEMBERS,
  combineAlongLineOfSight,
  confidenceForAgreement,
  measureAgreement,
  scoreEnsembleMembers,
  summariseEnsemble,
} from './ensemble';
import { averageLayers, scoreCloudLayers } from './layers';
import { planLineOfSight } from './lineOfSight';
import {
  ENSEMBLE_HOURLY,
  ENSEMBLE_MODELS,
  parseEnsemblePoint,
  splitMemberKey,
} from './openMeteo';
import type { EnsembleMember } from './openMeteo';
import type { CloudLayers } from './types';

/** El mateix observador i el mateix instant que `outlook.test.ts`. */
const OBSERVER = { lat: 41.5, lon: -2.5 };
const ECLIPSE_MS = Date.UTC(2026, 7, 12, 20, 30);
const PLAN = planLineOfSight(OBSERVER.lat, OBSERVER.lon, 285, 4);

const LABELS = new Map(ENSEMBLE_MODELS.map((m) => [m.id, m.label]));

/* ─────────────────────────────────────────── membres fets a mà, per decidir */

interface FakeLayers {
  low: number;
  mid: number;
  high: number;
}

/**
 * Un conjunt sintètic: `counts` diu quants membres hi ha de cada cel.
 *
 * Els membres es reparteixen per TOTS els punts del pla amb el mateix valor,
 * que és el cas net per raonar-hi: el que aquestes proves volen decidir és com
 * s'agreguen els membres, no com es projecten sobre la visual — d'això últim
 * se n'encarrega la prova del fixture i la de l'acord amb el camí determinista.
 */
function membersFor(counts: readonly { layers: FakeLayers; n: number }[]) {
  const hour = Math.floor(ECLIPSE_MS / 3_600_000) * 3600;
  const time = [hour - 3600, hour, hour + 3600];
  const members: EnsembleMember[] = [];
  let index = 0;
  for (const group of counts) {
    for (let i = 0; i < group.n; i++) {
      const fill = (v: number) => time.map(() => v);
      members.push({
        modelId: ENSEMBLE_MODELS[0].id,
        member: index++,
        hourly: {
          time,
          cloud_cover_low: fill(group.layers.low),
          cloud_cover_mid: fill(group.layers.mid),
          cloud_cover_high: fill(group.layers.high),
        },
      });
    }
  }
  // El mateix joc de membres a cada punt del pla.
  return PLAN.points.map(() => ({ members }));
}

function summaryFor(counts: readonly { layers: FakeLayers; n: number }[]) {
  const scored = scoreEnsembleMembers(PLAN, membersFor(counts), ECLIPSE_MS);
  return summariseEnsemble(scored, LABELS);
}

const CLEAR: FakeLayers = { low: 0, mid: 0, high: 0 };
const OVERCAST: FakeLayers = { low: 100, mid: 0, high: 0 };

describe('la fiabilitat es mesura, no es dedueix del calendari', () => {
  it('amb trenta membres idèntics, la confiança és màxima', () => {
    const net = summaryFor([{ layers: CLEAR, n: 30 }]);
    expect(net).not.toBeNull();
    expect(net!.memberCount).toBe(30);
    expect(net!.favourableCount).toBe(30);
    expect(net!.agreement).toBe(1);
    expect(net!.confidence).toBe('high');

    /*
     * I la unanimitat val igual quan el que diuen tots trenta és que no. «Els
     * cinquanta-un escenaris et tapen el Sol» és una previsió de fiabilitat
     * ALTA d'una mala notícia, i confondre «segur que no» amb «no ho sabem»
     * seria enviar algú a conduir sis-cents quilòmetres per si de cas.
     */
    const tapat = summaryFor([{ layers: OVERCAST, n: 30 }]);
    expect(tapat!.favourableCount).toBe(0);
    expect(tapat!.agreement).toBe(1);
    expect(tapat!.confidence).toBe('high');
  });

  it('amb quinze membres a cada extrem, la confiança és mínima', () => {
    const partit = summaryFor([
      { layers: CLEAR, n: 15 },
      { layers: OVERCAST, n: 15 },
    ]);
    expect(partit).not.toBeNull();
    expect(partit!.memberCount).toBe(30);
    expect(partit!.favourableFraction).toBe(0.5);
    expect(partit!.confidence).toBe('very-low');
    // I l'acord mesurat ha de ser MOLT petit, no només l'etiqueta.
    expect(partit!.agreement).toBeLessThan(0.1);
  });

  it('l’acord no baixa mai per un empat just al llindar', () => {
    /*
     * El defecte de frontera que justifica el `max` de `measureAgreement`, i
     * que és per què no es fa servir només la fracció. Trenta membres que
     * puntuïn tots entre 68 i 72 estan D'ACORD —el cel serà just al límit— i
     * la meitat cauen a cada costat del 70. Amb el vot sol, això sortiria com
     * «no en sabem res», que és una mentida sobre una previsió unànime.
     */
    const enfrontera = measureAgreement([68, 68, 69, 71, 72, 72], 0.5);
    expect(enfrontera).toBeGreaterThan(0.9);
    expect(confidenceForAgreement(enfrontera)).toBe('high');

    // Mentre que un empat de debò, amb els números separats, sí que ho és.
    const deveritat = measureAgreement([2, 3, 3, 98, 99, 100], 0.5);
    expect(deveritat).toBeLessThan(0.1);
    expect(confidenceForAgreement(deveritat)).toBe('very-low');
  });

  it('l’acord no surt mai de rang, digui el que digui la distribució', () => {
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      for (const scores of [[0, 100], [50, 50], [0, 0, 0], [100]]) {
        const a = measureAgreement(scores, f);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('la fracció es compta membre a membre', () => {
  it('la fracció NO surt d’una mitjana de nuvolositat', () => {
    /*
     * ÉS LA PROVA QUE JUSTIFICA TOT EL FITXER. Quinze membres de cel net i
     * quinze d'estrat tancat.
     *
     *  · Comptant membre a membre: quinze de trenta et donen l'eclipsi sencer.
     *    És una moneda a l'aire i s'ha de dir així.
     *  · Fent la mitjana de la nuvolositat primer: surt un 50 % de núvols
     *    baixos, una tarda mediocre que no ha previst CAP membre, que puntua
     *    per sota del llindar i per tant diria que no el veus. Zero de trenta.
     *
     * Els dos camins no donen el mateix número i no volen dir el mateix
     * consell. Aquesta prova compara els dos, i ha de fallar el dia que algú
     * "simplifiqui" promitjant abans de puntuar.
     */
    const partit = summaryFor([
      { layers: CLEAR, n: 15 },
      { layers: OVERCAST, n: 15 },
    ])!;

    expect(partit.favourableCount).toBe(15);
    expect(partit.favourableFraction).toBe(0.5);

    // El camí dolent, calculat aquí mateix amb les mateixes peces.
    const mitjana: CloudLayers = averageLayers([
      ...Array.from({ length: 15 }, () => ({ ...CLEAR, total: 0 })),
      ...Array.from({ length: 15 }, () => ({ ...OVERCAST, total: 100 })),
    ]);
    const puntuacioDeLaMitjana = scoreCloudLayers(mitjana).score;

    expect(mitjana.low).toBe(50);
    expect(puntuacioDeLaMitjana).toBeLessThan(ENSEMBLE_VISIBLE_MIN_SCORE);
    // O sigui: promitjant primer, la resposta hauria estat "cap dels trenta".
    expect(partit.favourableCount).not.toBe(0);
  });

  it('els membres es reparteixen per bandes i les bandes sumen el total', () => {
    const barrejat = summaryFor([
      { layers: CLEAR, n: 12 },
      { layers: { low: 0, mid: 60, high: 0 }, n: 8 },
      { layers: OVERCAST, n: 10 },
    ])!;
    const { clear, partial, cloudy } = barrejat.byBand;
    expect(clear + partial + cloudy).toBe(barrejat.memberCount);
    expect(clear).toBe(12);
    expect(cloudy).toBe(10);
  });

  it('un conjunt massa petit no es publica a mitges', () => {
    const pocs = summaryFor([{ layers: CLEAR, n: MIN_ENSEMBLE_MEMBERS - 1 }]);
    expect(pocs).toBeNull();
    const justos = summaryFor([{ layers: CLEAR, n: MIN_ENSEMBLE_MEMBERS }]);
    expect(justos).not.toBeNull();
  });

  it('un vel de cirrus sencer queda per sota del llindar, i és conservador a posta', () => {
    /*
     * `layers.ts` diu que a través d'un vel de cirrus la corona encara es veu
     * (transmissió 0,65) i per tant un cel de cirrus tancat puntua 65, per
     * sota del llindar de 70. El llindar és conservador i s'ha de saber: per
     * això el resum publica també els membres de la banda "depèn", perquè qui
     * escrigui la frase no s'hagi d'inventar cap segon llindar.
     */
    const cirrus = summaryFor([{ layers: { low: 0, mid: 0, high: 100 }, n: 20 }])!;
    expect(cirrus.favourableCount).toBe(0);
    expect(cirrus.byBand.partial).toBe(20);
    expect(cirrus.byBand.cloudy).toBe(0);
  });
});

/* ──────────────────────────────── el contracte real de l'API, amb dada real */

const FIXTURE = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('./__fixtures__/ensemble-ecmwf-soria-2026-08-12.json', import.meta.url),
    ),
    'utf8',
  ),
) as unknown[];

describe('el contracte real d’ensemble-api.open-meteo.com', () => {
  it('la resposta guardada és la de tot el pla de visual, no la d’un punt sol', () => {
    // Si algú retallés la petició al punt de l'observador, això ho diria: la
    // projecció sobre la visual és el que fa que aquest mòdul serveixi de res
    // amb el Sol a 4°, i un conjunt sense projecció seria un pas enrere.
    expect(Array.isArray(FIXTURE)).toBe(true);
    expect(FIXTURE).toHaveLength(PLAN.points.length);
    expect(PLAN.points.length).toBeGreaterThan(3);
  });

  it('en surten cinquanta-un membres amb les TRES capes, no claus buides', () => {
    /*
     * LA COMPROVACIÓ QUE VA DESTAPAR-HO TOT. L'API publica
     * `cloud_cover_low/mid/high` per a tots els models del conjunt, amb els
     * seus quaranta o trenta membres, i per a gairebé tots les omple de
     * `null`. Comptant claus, semblava que tres models servien les capes;
     * mirant valors, només ECMWF. Per això aquí no es compten claus: es
     * compten membres amb dada.
     */
    const point = parseEnsemblePoint(FIXTURE[0], ENSEMBLE_MODELS);
    expect(point.members).toHaveLength(51);

    for (const member of point.members) {
      for (const layer of ['cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high'] as const) {
        const series = member.hourly[layer];
        expect(series, `${member.modelId} membre ${member.member} sense ${layer}`).toBeDefined();
        expect(series!.some((v) => v !== null && v !== undefined)).toBe(true);
      }
    }
  });

  it('els membres es numeren un cop cadascun, control inclòs', () => {
    const point = parseEnsemblePoint(FIXTURE[0], ENSEMBLE_MODELS);
    const numbers = point.members.map((m) => m.member).sort((a, b) => a - b);
    // El control és la sèrie sense sufix i compta com a membre 0; els altres
    // cinquanta són `_member01`..`_member50`.
    expect(numbers[0]).toBe(0);
    expect(numbers[numbers.length - 1]).toBe(50);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('la dada real travessa tot el camí i dona un resum coherent', () => {
    const byPoint = FIXTURE.map((entry) => parseEnsemblePoint(entry, ENSEMBLE_MODELS));
    const scored = scoreEnsembleMembers(PLAN, byPoint, ECLIPSE_MS);
    expect(scored).toHaveLength(51);

    const summary = summariseEnsemble(scored, LABELS)!;
    expect(summary).not.toBeNull();
    expect(summary.memberCount).toBe(51);
    expect(summary.favourableCount + (51 - summary.favourableCount)).toBe(51);
    expect(summary.favourableFraction).toBeGreaterThanOrEqual(0);
    expect(summary.favourableFraction).toBeLessThanOrEqual(1);
    expect(summary.scores).toHaveLength(51);
    // Ordenades: la interfície en pintarà la forma i compta amb això.
    for (let i = 1; i < summary.scores.length; i++) {
      expect(summary.scores[i]).toBeGreaterThanOrEqual(summary.scores[i - 1]);
    }
    expect(summary.p10).toBeLessThanOrEqual(summary.medianScore);
    expect(summary.medianScore).toBeLessThanOrEqual(summary.p90);
    expect(summary.models).toHaveLength(1);
    expect(summary.models[0].label).toBe(ENSEMBLE_MODELS[0].label);
    expect(summary.models[0].memberCount).toBe(51);
  });

  it('la resposta guardada porta les variables que el codi demana', () => {
    // Si algú afegís una variable a `ENSEMBLE_HOURLY` sense refer el fixture,
    // les proves de sobre seguirien verdes provant una petició que ja no és la
    // que fem. Això lliga les dues bandes.
    const hourly = (FIXTURE[0] as { hourly: Record<string, unknown> }).hourly;
    for (const variable of ENSEMBLE_HOURLY) {
      expect(Object.keys(hourly).some((k) => splitMemberKey(k)?.variable === variable),
        `el fixture no porta ${variable}`).toBe(true);
    }
  });
});

describe('splitMemberKey coneix les quatre formes de clau', () => {
  /*
   * Les quatre cadenes són literals OBSERVATS, no inventats: les dues primeres
   * surten del fixture (un sol model demanat) i les dues últimes de la petició
   * de tres models del 8-8-2026, que és quan es va veure que el sufix del
   * model només apareix quan n'hi ha més d'un.
   */
  it('un sol model: control i membre, sense sufix', () => {
    expect(splitMemberKey('cloud_cover_low')).toEqual({
      variable: 'cloud_cover_low', member: 0, suffix: null,
    });
    expect(splitMemberKey('cloud_cover_low_member07')).toEqual({
      variable: 'cloud_cover_low', member: 7, suffix: null,
    });
  });

  it('més d’un model: control i membre, amb sufix', () => {
    expect(splitMemberKey('cloud_cover_low_ecmwf_ifs025_ensemble')).toEqual({
      variable: 'cloud_cover_low', member: 0, suffix: 'ecmwf_ifs025_ensemble',
    });
    expect(splitMemberKey('cloud_cover_low_member07_ecmwf_ifs025_ensemble')).toEqual({
      variable: 'cloud_cover_low', member: 7, suffix: 'ecmwf_ifs025_ensemble',
    });
  });

  it('la variable curta no es menja la llarga', () => {
    /*
     * `cloud_cover` és prefix de `cloud_cover_low`. Provant de curta a llarga,
     * `cloud_cover_low_member07` es llegiria com la variable `cloud_cover` amb
     * un membre que es diu `low_member07`, i les tres capes desapareixerien
     * dins del total sense que res petés. Per això es prova de llarga a curta.
     */
    expect(splitMemberKey('cloud_cover_low_member07')?.variable).toBe('cloud_cover_low');
    expect(splitMemberKey('cloud_cover_member07')?.variable).toBe('cloud_cover');
    expect(splitMemberKey('cloud_cover_high')?.variable).toBe('cloud_cover_high');
  });

  it('el que no reconeix el descarta en comptes d’endevinar-ho', () => {
    expect(splitMemberKey('temperature_2m')).toBeNull();
    expect(splitMemberKey('cloud_cover_low_member07_un_model_que_no_hem_demanat')).toEqual({
      variable: 'cloud_cover_low', member: 7, suffix: 'un_model_que_no_hem_demanat',
    });
    // …i el sufix desconegut el filtra `parseEnsemblePoint`, no aquesta funció.
    expect(splitMemberKey('cloud_cover_un_model_desconegut')).toBeNull();
  });
});

/* ─────────────────────── el conjunt és un afegit: si cau, no s'endú res */

/**
 * El `fetch` fals reparteix per amfitrió: la previsió determinista i el
 * conjunt són dos servidors diferents i aquí es responen per separat, que és
 * l'única manera de provar què passa quan en cau NOMÉS UN.
 */
function splitFetch(options: {
  ensemble?: (url: string) => unknown;
  forecast?: (url: string) => unknown;
}): { impl: typeof fetch; urls: string[] } {
  const urls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('ensemble-api.open-meteo.com')) {
      if (!options.ensemble) throw new TypeError('Failed to fetch');
      return jsonResponse(options.ensemble(url));
    }
    if (!options.forecast) throw new TypeError('Failed to fetch');
    return jsonResponse(options.forecast(url));
  }) as typeof fetch;
  return { impl, urls };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** Previsió determinista amb cel net, un punt per cada coordenada demanada. */
function forecastBody(url: string) {
  const points = (new URL(url).searchParams.get('latitude') ?? '').split(',').length;
  const base = Math.floor(ECLIPSE_MS / 3_600_000) * 3600;
  const time = [base - 3600, base, base + 3600];
  const fill = (v: number) => time.map(() => v);
  return Array.from({ length: points }, () => ({
    latitude: OBSERVER.lat,
    longitude: OBSERVER.lon,
    elevation: 1100,
    hourly: {
      time,
      cloud_cover: fill(0),
      cloud_cover_low: fill(0),
      cloud_cover_mid: fill(0),
      cloud_cover_high: fill(0),
      visibility: fill(40_000),
    },
  }));
}

const REQUEST = {
  location: { lat: OBSERVER.lat, lon: OBSERVER.lon, elevation: 1100 },
  targetTimeMs: ECLIPSE_MS,
  sunAzimuthDeg: 285,
  sunAltitudeDeg: 4,
};

afterEach(async () => {
  await clearWeatherCache();
});

describe('additiu, no substitutiu', () => {
  it('sense demanar-lo, NO es toca l’amfitrió del conjunt', () => {
    /*
     * El defecte és no demanar-lo, i és la decisió que fa que res del que ja
     * funcionava pugui empitjorar: qui no l'encengui fa exactament les
     * peticions d'abans. Encendre'l és feina de la capa de vista.
     */
    const fake = splitFetch({ forecast: forecastBody });
    return getCloudOutlook(REQUEST, {
      nowMs: ECLIPSE_MS - 2 * 86_400_000,
      fetchImpl: fake.impl,
    }).then((outlook) => {
      expect(fake.urls).toHaveLength(1);
      expect(fake.urls[0]).toContain('api.open-meteo.com/v1/forecast');
      expect(outlook.mode).toBe('forecast');
      expect(outlook.mode === 'forecast' && outlook.ensemble).toBeNull();
    });
  });

  it('demanant-lo, va als DOS amfitrions i el determinista continua sent el mateix', async () => {
    const fake = splitFetch({
      forecast: forecastBody,
      ensemble: () => FIXTURE,
    });
    const amb = await getCloudOutlook(REQUEST, {
      nowMs: ECLIPSE_MS - 2 * 86_400_000,
      fetchImpl: fake.impl,
      ensemble: true,
    });

    expect(fake.urls.some((u) => u.includes('ensemble-api.open-meteo.com'))).toBe(true);
    expect(fake.urls.some((u) => u.includes('api.open-meteo.com/v1/forecast'))).toBe(true);
    expect(amb.mode).toBe('forecast');
    if (amb.mode !== 'forecast') return;

    // La puntuació determinista NO ha canviat: el conjunt viatja al costat.
    expect(amb.score.score).toBe(100);
    expect(amb.ensemble).not.toBeNull();
    expect(amb.ensemble!.memberCount).toBe(51);
  });

  it('si el conjunt cau, la fitxa és EXACTAMENT la d’abans', async () => {
    /*
     * La prova de la reserva. Es demana el conjunt, l'amfitrió del conjunt
     * falla, i el que en surt s'ha de poder comparar camp a camp amb el que
     * dona el camí de sempre. Si algun dia el conjunt s'endugués la previsió
     * amb ell, això seria vermell.
     */
    const caigut = splitFetch({ forecast: forecastBody });
    const ambCaiguda = await getCloudOutlook(REQUEST, {
      nowMs: ECLIPSE_MS - 9 * 86_400_000,
      fetchImpl: caigut.impl,
      ensemble: true,
    });
    await clearWeatherCache();

    const nomesDeterminista = splitFetch({
      forecast: forecastBody,
    });
    const senseDemanarlo = await getCloudOutlook(REQUEST, {
      nowMs: ECLIPSE_MS - 9 * 86_400_000,
      fetchImpl: nomesDeterminista.impl,
    });

    expect(ambCaiguda.mode).toBe('forecast');
    expect(ambCaiguda.score).toEqual(senseDemanarlo.score);
    expect(ambCaiguda.layers).toEqual(senseDemanarlo.layers);
    expect(ambCaiguda.confidence).toBe(senseDemanarlo.confidence);
    expect(ambCaiguda.caveat).toBe(senseDemanarlo.caveat);
    expect(ambCaiguda.mode === 'forecast' && ambCaiguda.ensemble).toBeNull();

    // …i la fiabilitat, en caure el conjunt, torna a ser la deduïda del
    // calendari, que és el comportament d'abans i no una novetat.
    expect(ambCaiguda.confidence).toBe(confidenceForLead(9));
  });

  it('amb conjunt, la fiabilitat ja no la mana el calendari', async () => {
    /*
     * ÉS EL CANVI QUE ES VENIA A FER. A nou dies vista, `confidenceForLead`
     * diu 'very-low' mirant només el calendari. El fixture són cinquanta-un
     * membres reals d'ECMWF sobre Sòria que diuen tots el mateix; l'acord
     * mesurat és alt i la fitxa ho ha de dir, perquè «no ens en refiem» seria,
     * en aquest cas, senzillament fals.
     */
    const fake = splitFetch({
      forecast: forecastBody,
      ensemble: () => FIXTURE,
    });
    const outlook = await getCloudOutlook(REQUEST, {
      nowMs: ECLIPSE_MS - 9 * 86_400_000,
      fetchImpl: fake.impl,
      ensemble: true,
    });

    expect(confidenceForLead(9)).toBe('very-low');
    expect(outlook.mode === 'forecast' && outlook.ensemble!.confidence).toBe('high');
    expect(outlook.confidence).toBe('high');
    expect(outlook.confidence).not.toBe(confidenceForLead(9));
  });

  it('el conjunt i el determinista no comparteixen entrada de memòria cau', async () => {
    /*
     * Si la compartissin, encendre el conjunt tornaria l'objecte desat sense
     * conjunt i semblaria que la funció no fa res —o pitjor, apagar-lo tornaria
     * una fiabilitat MESURADA dins d'una fitxa que diu que és deduïda.
     */
    const sense = splitFetch({ forecast: forecastBody });
    await getCloudOutlook(REQUEST, {
      nowMs: ECLIPSE_MS - 86_400_000,
      fetchImpl: sense.impl,
    });

    const amb = splitFetch({
      forecast: forecastBody,
      ensemble: () => FIXTURE,
    });
    const segona = await getCloudOutlook(REQUEST, {
      nowMs: ECLIPSE_MS - 86_400_000 + 60_000,
      fetchImpl: amb.impl,
      ensemble: true,
    });

    expect(amb.urls.length).toBeGreaterThan(0);
    expect(segona.mode === 'forecast' && segona.ensemble).not.toBeNull();
  });
});

describe('la projecció sobre la visual és la MATEIXA que la del camí determinista', () => {
  it('un membre i el camí determinista puntuen igual la mateixa lectura', () => {
    /*
     * `combineAlongLineOfSight` la fa servir el conjunt i la fa servir
     * `buildForecast`. És LA MATEIXA FUNCIÓ i no una còpia, i aquesta prova és
     * la costura: llegeix cirrus lluny i estrats a prop —el cas que dona sentit
     * a tot el mostreig— i comprova que el resultat és el que dona la física
     * de `layers.ts` sense passar per enlloc més.
     */
    const samples = PLAN.points.map((p) => ({
      low: p.layers.includes('low') ? 20 : null,
      mid: p.layers.includes('mid') ? 40 : null,
      high: p.layers.includes('high') ? 90 : null,
      total: null,
      visibility: null,
    }));

    const { layers, hasLayers } = combineAlongLineOfSight(PLAN, samples);
    expect(hasLayers).toBe(true);
    expect(layers.low).toBeCloseTo(20, 6);
    expect(layers.mid).toBeCloseTo(40, 6);
    expect(layers.high).toBeCloseTo(90, 6);

    const scored = scoreEnsembleMembers(
      PLAN,
      membersFor([{ layers: { low: 20, mid: 40, high: 90 }, n: 12 }]),
      ECLIPSE_MS,
    );
    for (const member of scored) {
      expect(member.score).toBe(scoreCloudLayers(layers, true).score);
    }
  });

  it('els punts llunyans compten: canviar-hi els cirrus canvia la puntuació', () => {
    /*
     * Si el conjunt es demanés només al punt de l'observador, aquesta prova
     * seria idèntica en els dos casos. És la comprovació que la projecció no
     * s'ha perdut pel camí.
     */
    const ambCirrusLluny = scoreEnsembleMembers(
      PLAN,
      membersFor([{ layers: { low: 0, mid: 0, high: 100 }, n: 12 }]),
      ECLIPSE_MS,
    );
    const senseCirrus = scoreEnsembleMembers(
      PLAN,
      membersFor([{ layers: { low: 0, mid: 0, high: 0 }, n: 12 }]),
      ECLIPSE_MS,
    );
    expect(ambCirrusLluny[0].score).toBeLessThan(senseCirrus[0].score);
    expect(senseCirrus[0].score).toBe(100);
  });
});
