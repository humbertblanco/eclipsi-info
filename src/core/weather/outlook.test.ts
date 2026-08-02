/**
 * Orquestració. El que importa aquí no són els números sinó les decisions:
 * quan es demana una previsió i quan una climatologia, què passa quan la
 * xarxa cau, i que una dada vella no es pugui ensenyar mai sense l'etiqueta
 * de vella.
 *
 * Fem servir un `fetch` fals: els tests no poden dependre de la xarxa ni
 * gastar quota d'una API gratuïta.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { clearWeatherCache } from './cache';
import {
  CONFIDENCE_LABEL,
  climatologyCaveat,
  confidenceForLead,
  forecastCaveat,
  getCloudOutlook,
  outlookMode,
} from './outlook';
import {
  CLOUD_ERROR_TEXT,
  CloudOutlookError,
  type Confidence,
  type CloudOutlookRequest,
} from './types';

const OBSERVER = { lat: 41.5, lon: -2.5, elevation: 1100 };

/** 12 d'agost de 2026, 20:30 UTC: el màxim de l'eclipsi des de Sòria. */
const ECLIPSE_MS = Date.UTC(2026, 7, 12, 20, 30);

const REQUEST: CloudOutlookRequest = {
  location: OBSERVER,
  targetTimeMs: ECLIPSE_MS,
  sunAzimuthDeg: 285,
  sunAltitudeDeg: 4,
};

interface FakeLayers {
  low: number;
  mid: number;
  high: number;
  total: number;
}

/** Resposta de previsió amb tres hores i les capes que li diguem. */
function forecastBody(points: number, values: FakeLayers) {
  const base = Math.floor(ECLIPSE_MS / 3_600_000) * 3600;
  const time = [base - 3600, base, base + 3600];
  const fill = (v: number) => time.map(() => v);
  return Array.from({ length: points }, () => ({
    latitude: OBSERVER.lat,
    longitude: OBSERVER.lon,
    elevation: 1100,
    hourly: {
      time,
      cloud_cover: fill(values.total),
      cloud_cover_low: fill(values.low),
      cloud_cover_mid: fill(values.mid),
      cloud_cover_high: fill(values.high),
      visibility: fill(40_000),
    },
  }));
}

/** Resposta d'arxiu: onze dies horaris amb una nuvolositat constant. */
function archiveBody(year: number, values: FakeLayers) {
  const start = Date.UTC(year, 7, 7) / 1000;
  const time: number[] = [];
  for (let h = 0; h < 11 * 24; h++) time.push(start + h * 3600);
  const fill = (v: number) => time.map(() => v);
  return {
    latitude: OBSERVER.lat,
    longitude: OBSERVER.lon,
    elevation: 1100,
    hourly: {
      time,
      cloud_cover: fill(values.total),
      cloud_cover_low: fill(values.low),
      cloud_cover_mid: fill(values.mid),
      cloud_cover_high: fill(values.high),
    },
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

interface FakeFetch {
  impl: typeof fetch;
  urls: string[];
}

/** Nombre de coordenades que demana una URL. El pla no sempre té els mateixos. */
function pointCount(url: string): number {
  const latitude = new URL(url).searchParams.get('latitude') ?? '';
  return latitude.split(',').length;
}

function makeFetch(handler: (url: string) => unknown): FakeFetch {
  const urls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    return jsonResponse(handler(url));
  }) as typeof fetch;
  return { impl, urls };
}

afterEach(async () => {
  await clearWeatherCache();
});

describe('outlookMode', () => {
  it('a pocs dies vista demana previsió', () => {
    expect(outlookMode(ECLIPSE_MS, ECLIPSE_MS - 3 * 86_400_000)).toBe('forecast');
  });

  it('a mesos vista NO inventa una previsió', () => {
    expect(outlookMode(ECLIPSE_MS, ECLIPSE_MS - 200 * 86_400_000)).toBe('climatology');
  });

  it('el límit és l’horitzó real del model, no un número rodó', () => {
    expect(outlookMode(ECLIPSE_MS, ECLIPSE_MS - 15 * 86_400_000)).toBe('forecast');
    expect(outlookMode(ECLIPSE_MS, ECLIPSE_MS - 16 * 86_400_000)).toBe('climatology');
  });
});

describe('confidenceForLead', () => {
  it('la fiabilitat cau amb l’antelació i mai puja', () => {
    const order = ['high', 'medium', 'low', 'very-low'];
    let previous = -1;
    for (const lead of [0, 2, 3, 4, 5, 7, 8, 14]) {
      const index = order.indexOf(confidenceForLead(lead));
      expect(index).toBeGreaterThanOrEqual(previous);
      previous = index;
    }
  });
});

describe('getCloudOutlook — previsió', () => {
  it('mostreja la línia de visió en UNA sola petició', async () => {
    const fake = makeFetch((url) => forecastBody(pointCount(url), { low: 0, mid: 0, high: 0, total: 0 }));
    const outlook = await getCloudOutlook(REQUEST, {
      nowMs: ECLIPSE_MS - 2 * 86_400_000,
      fetchImpl: fake.impl,
    });

    expect(outlook.mode).toBe('forecast');
    expect(fake.urls).toHaveLength(1);
    // Diverses coordenades separades per comes: és el que ho fa viable.
    expect(fake.urls[0]).toContain('latitude=41.5000%2C');
    expect(outlook.sampling.lineOfSightUsed).toBe(true);
    expect(outlook.sampling.points.length).toBeGreaterThan(3);
  });

  it('demana les capes i la visibilitat, no només la nuvolositat total', async () => {
    const fake = makeFetch((url) => forecastBody(pointCount(url), { low: 0, mid: 0, high: 0, total: 0 }));
    await getCloudOutlook(REQUEST, {
      nowMs: ECLIPSE_MS - 86_400_000,
      fetchImpl: fake.impl,
    });
    const url = decodeURIComponent(fake.urls[0]);
    expect(url).toContain('cloud_cover_low');
    expect(url).toContain('cloud_cover_mid');
    expect(url).toContain('cloud_cover_high');
    expect(url).toContain('visibility');
  });

  it('un cel de cirrus no es despatxa com a cel tapat', async () => {
    const fake = makeFetch((url) => forecastBody(pointCount(url), { low: 0, mid: 0, high: 95, total: 95 }));
    const outlook = await getCloudOutlook(REQUEST, {
      nowMs: ECLIPSE_MS - 86_400_000,
      fetchImpl: fake.impl,
    });
    expect(outlook.layers.high).toBeCloseTo(95, 6);
    expect(outlook.score.band).not.toBe('cloudy');
    expect(outlook.score.dominant).toBe('high');
  });

  it('diu l’antelació i la fiabilitat, sempre', async () => {
    const fake = makeFetch((url) => forecastBody(pointCount(url), { low: 50, mid: 0, high: 0, total: 50 }));
    const outlook = await getCloudOutlook(REQUEST, {
      nowMs: ECLIPSE_MS - 9 * 86_400_000,
      fetchImpl: fake.impl,
    });
    expect(outlook.mode).toBe('forecast');
    expect(outlook.confidence).toBe('very-low');
    expect(outlook.caveat.length).toBeGreaterThan(10);
  });

  it('no torna a la xarxa mentre la dada sigui fresca', async () => {
    const fake = makeFetch((url) => forecastBody(pointCount(url), { low: 10, mid: 0, high: 0, total: 10 }));
    const now = ECLIPSE_MS - 86_400_000;
    await getCloudOutlook(REQUEST, { nowMs: now, fetchImpl: fake.impl });
    await getCloudOutlook(REQUEST, { nowMs: now + 60_000, fetchImpl: fake.impl });
    expect(fake.urls).toHaveLength(1);
  });
});

describe('getCloudOutlook — climatologia', () => {
  it('per a dates llunyanes consulta l’arxiu, any per any', async () => {
    const fake = makeFetch((url) => {
      const year = Number(/start_date=(\d{4})/.exec(url)?.[1] ?? 2020);
      return archiveBody(year, { low: 0, mid: 0, high: 0, total: 0 });
    });

    const outlook = await getCloudOutlook(REQUEST, {
      nowMs: ECLIPSE_MS - 300 * 86_400_000,
      fetchImpl: fake.impl,
    });

    expect(outlook.mode).toBe('climatology');
    expect(fake.urls.length).toBeGreaterThan(10);
    expect(fake.urls[0]).toContain('archive-api');
    if (outlook.mode === 'climatology') {
      expect(outlook.stats.years).toBeGreaterThanOrEqual(10);
      expect(outlook.stats.sampleCount).toBeGreaterThan(50);
      expect(outlook.stats.clearFraction).toBe(1);
    }
  });

  it('la climatologia es diu climatologia i no es disfressa de previsió', async () => {
    const fake = makeFetch((url) => {
      const year = Number(/start_date=(\d{4})/.exec(url)?.[1] ?? 2020);
      return archiveBody(year, { low: 80, mid: 0, high: 0, total: 80 });
    });
    const outlook = await getCloudOutlook(REQUEST, {
      nowMs: ECLIPSE_MS - 300 * 86_400_000,
      fetchImpl: fake.impl,
    });
    expect(outlook.caveat).toContain('NO és una previsió');
    // Només consulta el punt de l'observador: la geometria es conserva per
    // poder-la explicar, però l'etiqueta ha de dir la veritat.
    expect(outlook.sampling.lineOfSightUsed).toBe(false);
  });

  it('no demana mai visibilitat a l’arxiu: ERA5 no en té', async () => {
    const fake = makeFetch((url) => {
      const year = Number(/start_date=(\d{4})/.exec(url)?.[1] ?? 2020);
      return archiveBody(year, { low: 0, mid: 0, high: 0, total: 0 });
    });
    await getCloudOutlook(REQUEST, {
      nowMs: ECLIPSE_MS - 300 * 86_400_000,
      fetchImpl: fake.impl,
    });
    for (const url of fake.urls) expect(decodeURIComponent(url)).not.toContain('visibility');
  });
});

describe('el text que surt d’aquí, en castellà', () => {
  const CONFIDENCES: Confidence[] = ['high', 'medium', 'low', 'very-low'];

  it('cap taula no té claus a mitges', () => {
    for (const c of CONFIDENCES) {
      expect(CONFIDENCE_LABEL[c].ca.length, c).toBeGreaterThan(0);
      expect(CONFIDENCE_LABEL[c].es.length, c).toBeGreaterThan(0);
    }
    for (const entry of Object.values(CLOUD_ERROR_TEXT)) {
      expect(entry.ca.length).toBeGreaterThan(0);
      expect(entry.es.length).toBeGreaterThan(0);
      expect(entry.ca).not.toBe(entry.es);
    }
  });

  it('el caveat de previsió té les quatre fiabilitats en tots dos idiomes', () => {
    for (const c of CONFIDENCES) {
      const ca = forecastCaveat(3, c, false, 'ca');
      const es = forecastCaveat(3, c, false, 'es');
      expect(ca).toContain('Falten 3.0 dies.');
      expect(es).toContain('Faltan 3.0 días.');
      // Si algú afegeix una fiabilitat nova i se n'oblida, la castellana
      // sortiria igual que la catalana o buida.
      expect(es).not.toBe(ca);
      expect(es.length).toBeGreaterThan('Faltan 3.0 días.'.length + 10);
    }
  });

  it('l’avís de "sense desglossament" també es tradueix', () => {
    expect(forecastCaveat(1, 'high', true, 'es')).toContain('desglose por capas');
    expect(forecastCaveat(1, 'high', true, 'ca')).toContain('desglossament per capes');
  });

  it('la climatologia diu NO en majúscules en tots dos idiomes', () => {
    // És l'única cosa que impedeix llegir quinze anys d'estadística com si
    // fossin una previsió. No es pot perdre en traduir-la.
    expect(climatologyCaveat(15, 'ca')).toContain('NO és una previsió');
    expect(climatologyCaveat(15, 'es')).toContain('NO es una previsión');
    expect(climatologyCaveat(15, 'es')).toContain('15 años');
  });

  it('el defecte de tot plegat segueix sent el català', () => {
    expect(forecastCaveat(2, 'low', false)).toBe(forecastCaveat(2, 'low', false, 'ca'));
    expect(climatologyCaveat(9)).toBe(climatologyCaveat(9, 'ca'));
  });

  it('getCloudOutlook escriu el caveat en l’idioma demanat', async () => {
    const fake = makeFetch((url) => forecastBody(pointCount(url), { low: 0, mid: 0, high: 0, total: 0 }));
    const outlook = await getCloudOutlook(REQUEST, {
      nowMs: ECLIPSE_MS - 86_400_000,
      fetchImpl: fake.impl,
      locale: 'es',
    });
    expect(outlook.caveat).toContain('Faltan');
    expect(outlook.caveat).not.toContain('Falten');
  });

  it('canviar d’idioma reescriu el caveat SENSE tornar a la xarxa', async () => {
    // La memòria cau desa números, i els números no canvien de llengua. Si
    // l'idioma entrés a la clau, canviar el selector de la capçalera costaria
    // una consulta nova; amb la climatologia, quinze.
    const fake = makeFetch((url) => forecastBody(pointCount(url), { low: 0, mid: 0, high: 0, total: 0 }));
    const now = ECLIPSE_MS - 86_400_000;
    const ca = await getCloudOutlook(REQUEST, { nowMs: now, fetchImpl: fake.impl });
    const es = await getCloudOutlook(REQUEST, {
      nowMs: now + 60_000,
      fetchImpl: fake.impl,
      locale: 'es',
    });

    expect(fake.urls).toHaveLength(1);
    expect(ca.caveat).toContain('Falten');
    expect(es.caveat).toContain('Faltan');
    expect(es.score.score).toBe(ca.score.score);
  });
});

describe('getCloudOutlook — sense xarxa', () => {
  it('ensenya l’última dada desada i la marca com a vella', async () => {
    const good = makeFetch((url) => forecastBody(pointCount(url), { low: 20, mid: 0, high: 0, total: 20 }));
    const now = ECLIPSE_MS - 5 * 86_400_000;
    const fresh = await getCloudOutlook(REQUEST, { nowMs: now, fetchImpl: good.impl });
    expect(fresh.stale).toBe(false);

    const dead = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;

    const offline = await getCloudOutlook(REQUEST, {
      // Prou estona després perquè la memòria cau ja no sigui fresca.
      nowMs: now + 6 * 3_600_000,
      fetchImpl: dead,
    });

    expect(offline.stale).toBe(true);
    // L'edat es calcula amb la data ORIGINAL, no amb la d'ara: és tot el punt.
    expect(offline.fetchedAtMs).toBe(fresh.fetchedAtMs);
    expect(offline.score.score).toBe(fresh.score.score);
  });

  it('sense xarxa i sense res desat, llança un error explicable', async () => {
    const dead = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;

    await expect(
      getCloudOutlook(REQUEST, { nowMs: ECLIPSE_MS - 86_400_000, fetchImpl: dead }),
    ).rejects.toBeInstanceOf(CloudOutlookError);
  });
});
