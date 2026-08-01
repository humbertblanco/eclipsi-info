/**
 * Genera `tests/golden/ign-2026-08-12.json` a partir de les dades oficials de
 * l'Instituto Geográfico Nacional (https://eclipses.ign.es).
 *
 * Ús: npx tsx scripts/fetch-ign-reference.ts
 *
 * ── D'ON SURT CADA COSA ──────────────────────────────────────────────────────
 *
 * L'IGN publica les circumstàncies de l'eclipsi de dues maneres, i les dues
 * fan falta perquè cap de les dues és completa:
 *
 * 1. UNA TAULA HTML per municipi dins de la pàgina de l'eclipsi. Dona les hores
 *    de contacte amb precisió d'1 SEGON, que és el millor que hi ha. En canvi
 *    l'altura del Sol només hi surt com a nombre enter de graus i NO hi ha
 *    coordenades enlloc. Aquesta taula la baixem i la parsegem cada vegada:
 *    és la font de les hores.
 *
 * 2. UNA INFOGRAFIA JPEG per municipi (una imatge, 8.131 en total). Aquesta sí
 *    que porta la longitud i la latitud en graus/minuts/segons amb centèsimes
 *    de segon d'arc, l'altitud en metres i l'altura i l'azimut del Sol amb una
 *    dècima de grau. És l'única manera de saber QUIN PUNT EXACTE ha fet servir
 *    l'IGN per a cada municipi.
 *
 * El problema de la segona és que és text rasteritzat dins d'un JPEG: no es pot
 * parsejar amb codi. Per això els punts de referència estan transcrits a mà a
 * `REFERENCE_POINTS` (més avall), amb l'URL de la infografia de cada municipi
 * al costat perquè qualsevol pugui verificar la transcripció obrint la imatge.
 *
 * Resum honest de la procedència:
 *   - hores C1/C2/màxim/C3/C4, posta de Sol, magnitud → baixades i parsejades
 *     en cada execució des de la taula HTML de l'IGN.
 *   - coordenades, altitud, altura i azimut del Sol → transcrites de les
 *     infografies oficials de l'IGN (constants d'aquest fitxer).
 *
 * Com que les coordenades són EXACTAMENT les que l'IGN diu haver fet servir,
 * no hi ha cap incertesa de posició: no hem hagut d'anar a buscar-les al
 * nomenclàtor ni a Wikidata, que ens haurien donat un punt diferent del seu i
 * haurien contaminat la comparació.
 *
 * ── DUES TROBALLES SOBRE EL FORMAT DE L'IGN ──────────────────────────────────
 *
 * a) L'altura del Sol de la infografia és l'altura VERTADERA (geomètrica) i la
 *    de la taula HTML és l'APARENT (amb refracció), arrodonida a graus enters.
 *    Ho hem comprovat als 39 municipis: aplicant Sæmundsson a 1010 mb i 10 °C
 *    a l'altura de la infografia i arrodonint, surt el valor de la taula en
 *    39 casos de 39. Per això el JSON guarda les dues coses per separat.
 *
 * b) Quan el Sol es pon abans del quart contacte, la columna "Fin eclipse" de
 *    la taula no porta l'hora de C4 sinó "Puesta de Sol a las HH:MM:SS". En
 *    aquests casos deixem `c4` a null i omplim `sunsetUtc`, que de retruc ens
 *    dona una referència oficial per validar `findSunset()`.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const IGN_PAGE =
  'https://eclipses.ign.es/eclipse-total-sol-de-12-de-agosto-2026.html';
const INFOGRAPHIC_BASE = 'https://eclipses.ign.es/src/img/eclipse-26/infografia/';

/**
 * Desfasament de l'hora oficial espanyola respecte a UTC el 12 d'agost de 2026.
 * Península i Balears van en CEST (UTC+2). No hi ha cap municipi canari a la
 * llista justament per no haver de barrejar dos fusos.
 */
const SPAIN_UTC_OFFSET_HOURS = 2;

interface ReferencePoint {
  /** Codi INE del municipi. És la clau que lliga la taula amb la infografia. */
  ine: string;
  /** Longitud tal com surt impresa a la infografia. Est positiu. */
  lonDms: string;
  /** Latitud tal com surt impresa a la infografia. Nord positiu. */
  latDms: string;
  /** Altitud en metres, de la infografia. */
  elevation: number;
  /** Altura VERTADERA del Sol al màxim, en graus (infografia, 0,1°). */
  sunAltitudeTrueDeg: number;
  /** Azimut del Sol al màxim, en graus (infografia, 0,1°). */
  sunAzimuthDeg: number;
  /** Per què és a la llista. Serveix per llegir després els resultats. */
  role: 'centre' | 'limit' | 'fora' | 'balears';
}

/**
 * Els 39 punts de referència, transcrits de les infografies oficials.
 *
 * La tria no és aleatòria: el motor és fràgil justament a les vores de la
 * franja i amb el Sol arran d'horitzó, i és allà on hi ha més municipis.
 *   - `centre`  : dins de la franja, totalitat llarga. Cas fàcil.
 *   - `limit`   : totalitat de 1 a 24 segons, és a dir just al caire de la
 *                 franja. Aquí un error de 0,1" al radi lunar es converteix en
 *                 desenes de segons de durada.
 *   - `fora`    : magnitud ~1,00 però sense totalitat. L'altre costat del caire.
 *   - `balears` : Sol entre 1,4° i 2,8°, on la refracció val més que el radi
 *                 del Sol i on la posta arriba abans que el final de l'eclipsi.
 *
 * NOTA sobre les longituds de menys d'un grau: la infografia hi omet els graus
 * i imprimeix, per exemple, `-52' 45.43"` per a Saragossa. Aquí ho escrivim
 * normalitzat com a `-0° 52' 45.43"`, que vol dir exactament el mateix.
 */
const REFERENCE_POINTS: ReferencePoint[] = [
  // ── Dins de la franja, totalitat còmoda ───────────────────────────────────
  { ine: '33077', lonDms: `-6° 42' 24.63"`,  latDms: `43° 26' 46.59"`, elevation: 354,  sunAltitudeTrueDeg: 10.8, sunAzimuthDeg: 280.2, role: 'centre' },
  { ine: '15030', lonDms: `-8° 23' 43.81"`,  latDms: `43° 22' 16.56"`, elevation: 7,    sunAltitudeTrueDeg: 11.9, sunAzimuthDeg: 279.2, role: 'centre' },
  { ine: '33044', lonDms: `-5° 50' 37.40"`,  latDms: `43° 21' 44.36"`, elevation: 231,  sunAltitudeTrueDeg: 10.2, sunAzimuthDeg: 280.8, role: 'centre' },
  { ine: '33024', lonDms: `-5° 39' 34.18"`,  latDms: `43° 32' 21.13"`, elevation: 7,    sunAltitudeTrueDeg: 10.1, sunAzimuthDeg: 280.8, role: 'centre' },
  { ine: '39075', lonDms: `-3° 48' 35.00"`,  latDms: `43° 27' 43.80"`, elevation: 6,    sunAltitudeTrueDeg: 8.8,  sunAzimuthDeg: 282.1, role: 'centre' },
  { ine: '09059', lonDms: `-3° 42' 15.11"`,  latDms: `42° 20' 28.07"`, elevation: 859,  sunAltitudeTrueDeg: 8.2,  sunAzimuthDeg: 282.6, role: 'centre' },
  { ine: '47186', lonDms: `-4° 43' 24.06"`,  latDms: `41° 39' 08.38"`, elevation: 690,  sunAltitudeTrueDeg: 8.5,  sunAzimuthDeg: 282.2, role: 'centre' },
  { ine: '26089', lonDms: `-2° 26' 44.36"`,  latDms: `42° 27' 59.22"`, elevation: 384,  sunAltitudeTrueDeg: 7.4,  sunAzimuthDeg: 283.3, role: 'centre' },
  { ine: '01059', lonDms: `-2° 40' 21.92"`,  latDms: `42° 51' 02.12"`, elevation: 539,  sunAltitudeTrueDeg: 7.7,  sunAzimuthDeg: 283.0, role: 'centre' },
  { ine: '42173', lonDms: `-2° 27' 58.49"`,  latDms: `41° 45' 47.80"`, elevation: 1061, sunAltitudeTrueDeg: 7.0,  sunAzimuthDeg: 283.6, role: 'centre' },
  { ine: '50297', lonDms: `-0° 52' 45.43"`,  latDms: `41° 39' 23.24"`, elevation: 208,  sunAltitudeTrueDeg: 5.9,  sunAzimuthDeg: 284.6, role: 'centre' },
  { ine: '43148', lonDms: `1° 15' 30.32"`,   latDms: `41° 07' 08.77"`, elevation: 69,   sunAltitudeTrueDeg: 4.2,  sunAzimuthDeg: 286.0, role: 'centre' },
  { ine: '12040', lonDms: `-0° 02' 12.77"`,  latDms: `39° 59' 11.07"`, elevation: 27,   sunAltitudeTrueDeg: 4.4,  sunAzimuthDeg: 285.6, role: 'centre' },
  { ine: '46250', lonDms: `-0° 22' 32.37"`,  latDms: `39° 28' 31.24"`, elevation: 16,   sunAltitudeTrueDeg: 4.4,  sunAzimuthDeg: 285.6, role: 'centre' },
  { ine: '44216', lonDms: `-1° 06' 33.38"`,  latDms: `40° 20' 38.87"`, elevation: 915,  sunAltitudeTrueDeg: 5.4,  sunAzimuthDeg: 284.9, role: 'centre' },
  { ine: '16078', lonDms: `-2° 07' 53.48"`,  latDms: `40° 04' 35.54"`, elevation: 997,  sunAltitudeTrueDeg: 5.9,  sunAzimuthDeg: 284.4, role: 'centre' },

  // ── Just al caire de la franja: totalitat de segons ───────────────────────
  { ine: '25120', lonDms: `0° 37' 14.23"`,   latDms: `41° 36' 54.98"`, elevation: 167,  sunAltitudeTrueDeg: 4.9,  sunAzimuthDeg: 285.5, role: 'limit' },
  { ine: '31130', lonDms: `-2° 07' 10.09"`,  latDms: `42° 53' 24.01"`, elevation: 525,  sunAltitudeTrueDeg: 7.4,  sunAzimuthDeg: 283.3, role: 'limit' },
  { ine: '48901', lonDms: `-2° 53' 13.09"`,  latDms: `43° 17' 28.77"`, elevation: 20,   sunAltitudeTrueDeg: 8.1,  sunAzimuthDeg: 282.7, role: 'limit' },
  { ine: '20025', lonDms: `-2° 17' 26.17"`,  latDms: `42° 58' 35.14"`, elevation: 296,  sunAltitudeTrueDeg: 7.6,  sunAzimuthDeg: 283.2, role: 'limit' },
  { ine: '48091', lonDms: `-2° 35' 04.41"`,  latDms: `43° 07' 49.84"`, elevation: 162,  sunAltitudeTrueDeg: 7.8,  sunAzimuthDeg: 283.0, role: 'limit' },
  { ine: '05114', lonDms: `-4° 59' 53.99"`,  latDms: `41° 05' 23.13"`, elevation: 809,  sunAltitudeTrueDeg: 8.4,  sunAzimuthDeg: 282.3, role: 'limit' },
  { ine: '05204', lonDms: `-4° 34' 53.62"`,  latDms: `40° 53' 31.13"`, elevation: 922,  sunAltitudeTrueDeg: 8.0,  sunAzimuthDeg: 282.6, role: 'limit' },
  { ine: '22099', lonDms: `0° 16' 29.12"`,   latDms: `41° 47' 54.21"`, elevation: 277,  sunAltitudeTrueDeg: 5.2,  sunAzimuthDeg: 285.2, role: 'limit' },
  { ine: '16152', lonDms: `-2° 12' 16.53"`,  latDms: `39° 52' 05.98"`, elevation: 1023, sunAltitudeTrueDeg: 5.9,  sunAzimuthDeg: 284.4, role: 'limit' },
  { ine: '46008', lonDms: `-0° 23' 12.08"`,  latDms: `39° 12' 03.71"`, elevation: 13,   sunAltitudeTrueDeg: 4.2,  sunAzimuthDeg: 285.7, role: 'limit' },
  { ine: '43074', lonDms: `1° 33' 06.94"`,   latDms: `41° 17' 03.67"`, elevation: 161,  sunAltitudeTrueDeg: 4.1,  sunAzimuthDeg: 286.2, role: 'limit' },
  { ine: '25081', lonDms: `1° 00' 13.52"`,   latDms: `41° 29' 41.60"`, elevation: 433,  sunAltitudeTrueDeg: 4.5,  sunAzimuthDeg: 285.8, role: 'limit' },

  // ── Just fora: magnitud ~1,00 però sense totalitat ────────────────────────
  { ine: '28079', lonDms: `-3° 41' 15.36"`,  latDms: `40° 24' 30.28"`, elevation: 657,  sunAltitudeTrueDeg: 7.2,  sunAzimuthDeg: 283.3, role: 'fora' },
  { ine: '08019', lonDms: `2° 10' 34.86"`,   latDms: `41° 23' 03.29"`, elevation: 13,   sunAltitudeTrueDeg: 3.7,  sunAzimuthDeg: 286.5, role: 'fora' },
  { ine: '31201', lonDms: `-1° 38' 42.55"`,  latDms: `42° 48' 50.77"`, elevation: 450,  sunAltitudeTrueDeg: 7.0,  sunAzimuthDeg: 283.7, role: 'fora' },
  { ine: '05019', lonDms: `-4° 41' 51.77"`,  latDms: `40° 39' 21.13"`, elevation: 1131, sunAltitudeTrueDeg: 8.0,  sunAzimuthDeg: 282.6, role: 'fora' },
  { ine: '22125', lonDms: `-0° 24' 30.32"`,  latDms: `42° 08' 26.26"`, elevation: 483,  sunAltitudeTrueDeg: 5.8,  sunAzimuthDeg: 284.7, role: 'fora' },

  // ── Balears: el Sol entre 1,4° i 2,8° ─────────────────────────────────────
  { ine: '07040', lonDms: `2° 39' 06.54"`,   latDms: `39° 34' 16.13"`, elevation: 24,   sunAltitudeTrueDeg: 2.4,  sunAzimuthDeg: 287.3, role: 'balears' },
  { ine: '07032', lonDms: `4° 15' 51.49"`,   latDms: `39° 53' 23.14"`, elevation: 33,   sunAltitudeTrueDeg: 1.5,  sunAzimuthDeg: 288.1, role: 'balears' },
  { ine: '07064', lonDms: `4° 17' 22.80"`,   latDms: `39° 52' 41.98"`, elevation: 16,   sunAltitudeTrueDeg: 1.4,  sunAzimuthDeg: 288.2, role: 'balears' },
  { ine: '07015', lonDms: `3° 50' 16.59"`,   latDms: `40° 00' 06.91"`, elevation: 19,   sunAltitudeTrueDeg: 1.8,  sunAzimuthDeg: 287.9, role: 'balears' },
  { ine: '07026', lonDms: `1° 25' 27.78"`,   latDms: `38° 54' 43.00"`, elevation: 8,    sunAltitudeTrueDeg: 2.8,  sunAzimuthDeg: 286.8, role: 'balears' },
  { ine: '07024', lonDms: `1° 25' 41.17"`,   latDms: `38° 42' 19.15"`, elevation: 40,   sunAltitudeTrueDeg: 2.7,  sunAzimuthDeg: 286.8, role: 'balears' },
];

/**
 * Converteix `-4° 59' 53.99"` a graus decimals.
 *
 * El signe s'aplica al conjunt, no només als graus: `-0° 22' 32.37"` ha de
 * donar −0,3756, no +0,3756. Si el signe s'apliqués només al camp dels graus,
 * tots els municipis d'entre 0° i −1° de longitud (Saragossa, València,
 * Castelló, Osca) sortirien a l'altre costat del meridià de Greenwich.
 */
function dmsToDegrees(dms: string): number {
  const match = /^(-)?(\d+)°\s*(\d+)'\s*([\d.]+)"$/.exec(dms.trim());
  if (!match) throw new Error(`Format DMS no reconegut: ${dms}`);
  const [, sign, deg, min, sec] = match;
  const value = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
  return sign ? -value : value;
}

/** Treu etiquetes i entitats d'un fragment de HTML. */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .trim();
}

/**
 * Passa una hora oficial espanyola `HH:MM:SS` del 12/08/2026 a un instant UTC
 * en format ISO. Retorna undefined si la cel·la no porta cap hora.
 */
function localTimeToUtcIso(hms: string): string | undefined {
  const match = /(\d{2}):(\d{2}):(\d{2})/.exec(hms);
  if (!match) return undefined;
  const [, h, m, s] = match;
  const utcHour = Number(h) - SPAIN_UTC_OFFSET_HOURS;
  return `2026-08-12T${String(utcHour).padStart(2, '0')}:${m}:${s}Z`;
}

interface IgnTableRow {
  municipality: string;
  province: string;
  ine: string;
  c1?: string;
  c2?: string;
  max?: string;
  c3?: string;
  /** Buit si la columna porta la posta de Sol en comptes de C4. */
  c4?: string;
  sunsetUtc?: string;
  magnitude: number;
  sunAltitudeApparentRoundedDeg: number;
}

/**
 * Parseja les taules de municipis de la pàgina de l'IGN.
 *
 * L'estructura real (verificada sobre l'HTML descarregat, no suposada) és:
 * 52 taules `<table class="tabla-datos datos-municipio-eclipse">`, una per
 * província, amb 8.131 files de 11 cel·les:
 *
 *   0 Municipio · 1 Provincia · 2 Infografía · 3 Inicio eclipse ·
 *   4 Inicio totalidad · 5 Máximo · 6 Fin totalidad · 7 Fin eclipse ·
 *   8 Magnitud · 9 Altura Sol · 10 Azimut Sol
 *
 * El codi INE no surt en cap columna: s'extreu de l'URL de la infografia de la
 * cel·la 2, que té la forma `.../infografia/50297_Zaragoza_Zaragoza.jpg`.
 */
function parseIgnTables(html: string): Map<string, IgnTableRow> {
  const rows = new Map<string, IgnTableRow>();

  for (const rowMatch of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(
      (m) => m[1],
    );
    // Les capçaleres fan servir <th>, així que ja queden fora amb aquest filtre.
    if (cells.length < 11) continue;

    const ineMatch = /\/infografia\/(\d+)_/.exec(cells[2]);
    if (!ineMatch) continue;

    const finEclipse = stripTags(cells[7]);
    const isSunset = finEclipse.includes('Puesta');

    rows.set(ineMatch[1], {
      municipality: stripTags(cells[0]),
      province: stripTags(cells[1]),
      ine: ineMatch[1],
      c1: localTimeToUtcIso(stripTags(cells[3])),
      c2: localTimeToUtcIso(stripTags(cells[4])),
      max: localTimeToUtcIso(stripTags(cells[5])),
      c3: localTimeToUtcIso(stripTags(cells[6])),
      c4: isSunset ? undefined : localTimeToUtcIso(finEclipse),
      sunsetUtc: isSunset ? localTimeToUtcIso(finEclipse) : undefined,
      magnitude: Number(stripTags(cells[8]).replace(',', '.')),
      sunAltitudeApparentRoundedDeg: Number(stripTags(cells[9])),
    });
  }

  return rows;
}

async function main(): Promise<void> {
  process.stdout.write(`Baixant ${IGN_PAGE} …\n`);
  const response = await fetch(IGN_PAGE);
  if (!response.ok) {
    throw new Error(`L'IGN ha respost ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  process.stdout.write(`  ${(html.length / 1e6).toFixed(1)} MB\n`);

  const tableRows = parseIgnTables(html);
  process.stdout.write(`  ${tableRows.size} municipis a les taules\n`);
  if (tableRows.size < 8000) {
    throw new Error(
      `Només s'han parsejat ${tableRows.size} municipis. Segurament l'IGN ha ` +
        `canviat el format de les taules i cal revisar parseIgnTables().`,
    );
  }

  const municipalities = REFERENCE_POINTS.map((point) => {
    const row = tableRows.get(point.ine);
    if (!row) {
      throw new Error(
        `El municipi amb codi INE ${point.ine} ja no surt a les taules de l'IGN.`,
      );
    }
    return {
      ine: point.ine,
      name: row.municipality,
      province: row.province,
      role: point.role,
      infographic: `${INFOGRAPHIC_BASE}${point.ine}_…jpg`,
      // Coordenades del punt que fa servir l'IGN, no d'un nomenclàtor extern.
      lat: Number(dmsToDegrees(point.latDms).toFixed(7)),
      lon: Number(dmsToDegrees(point.lonDms).toFixed(7)),
      latDms: point.latDms,
      lonDms: point.lonDms,
      elevation: point.elevation,
      // Hores oficials, passades a UTC.
      c1: row.c1 ?? null,
      c2: row.c2 ?? null,
      max: row.max ?? null,
      c3: row.c3 ?? null,
      c4: row.c4 ?? null,
      sunsetUtc: row.sunsetUtc ?? null,
      magnitude: row.magnitude,
      sunAltitudeTrueDeg: point.sunAltitudeTrueDeg,
      sunAzimuthDeg: point.sunAzimuthDeg,
      sunAltitudeApparentRoundedDeg: row.sunAltitudeApparentRoundedDeg,
    };
  });

  const output = {
    eclipseId: '2026-08-12',
    source: {
      timesAndMagnitude: IGN_PAGE,
      coordinatesAndSunPosition:
        'Infografies oficials per municipi de l’IGN, ' +
        `${INFOGRAPHIC_BASE}<INE>_<Municipi>_<Província>.jpg`,
      calculatedBy: 'Observatorio Astronómico Nacional (IGN)',
    },
    conventions: {
      timeZone:
        'Les hores de l’IGN són hora oficial peninsular (CEST, UTC+2). ' +
        'Aquí ja estan convertides a UTC.',
      sunAltitudeTrueDeg:
        'Altura geomètrica del Sol al màxim, de la infografia (±0,05° per ' +
        'l’arrodoniment a una dècima).',
      sunAltitudeApparentRoundedDeg:
        'Altura amb refracció, de la taula HTML, arrodonida a graus enters. ' +
        'Comprovat als 39 municipis que és sunAltitudeTrueDeg + refracció.',
      c4: 'null quan el Sol es pon abans del quart contacte; llavors s’omple sunsetUtc.',
      magnitude: 'Només dos decimals: la taula de l’IGN no en dona més.',
    },
    municipalities,
  };

  const here = dirname(fileURLToPath(import.meta.url));
  const target = resolve(here, '../tests/golden/ign-2026-08-12.json');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const withTotality = municipalities.filter((m) => m.c2 !== null).length;
  const withRealC4 = municipalities.filter((m) => m.c4 !== null).length;
  process.stdout.write(
    `\nEscrit ${target}\n` +
      `  ${municipalities.length} municipis · ${withTotality} amb totalitat · ` +
      `${withRealC4} amb C4 abans de la posta\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
