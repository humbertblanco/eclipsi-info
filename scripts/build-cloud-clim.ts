/**
 * Genera `public/data/clouds-clim-<eclipseId>.json`: la climatologia de
 * nuvolositat de tota la franja, cel·la a cel·la, en temps de compilació.
 *
 * Ús:  npx tsx scripts/build-cloud-clim.ts 2026-08-12 --dry-run
 *      npx tsx scripts/build-cloud-clim.ts 2026-08-12
 *      npx tsx scripts/build-cloud-clim.ts 2026-08-12 --fresh --batch=20
 *
 * Opcions: `--dry-run` (compta el cost i no toca la xarxa), `--fresh` (ignora
 * el punt de control), `--batch=N`, `--concurrency=N`, `--partial` (escriu el
 * JSON encara que hi falti feina; vegeu més avall per què no és el defecte).
 *
 * ATENCIÓ: NO ACABA EN UNA ESTONA, I POT NO ACABAR AVUI. La graella del 2026
 * val unes 8.486 crides d'API i el pla gratuït en deixa 5.000 per hora i 10.000
 * per dia. Dues coses que se'n deriven i que val més saber abans de començar:
 *
 *  - El mínim absolut són dues hores llargues, per la quota horària.
 *  - Si el dia ja portava quota gastada —proves, una execució anterior, l'app
 *    mateixa mentre es desenvolupa—, NO hi cabrà. La primera generació d'aquest
 *    fitxer va acabar amb «Daily API request limit exceeded» amb nou dels quinze
 *    anys desats (la graella tenia llavors 855 cel·les i 645 lots).
 *  - Les tres graelles del catàleg juntes (8.486 + 5.280 + 8.863 ≈ 22.600) són
 *    tres dies de pla gratuït. No es poden fer d'una tirada. Mesurat amb
 *    `--dry-run` per als tres identificadors del catàleg.
 *
 * Res d'això és un problema perquè el punt de control ho recorda tot: talla-ho
 * quan vulguis, torna-hi demà amb la mateixa ordre i continua per on anava. El
 * JSON no s'escriu fins que la graella és sencera, així que no hi ha manera de
 * publicar-ne una a mitges sense adonar-se'n.
 *
 * ── PER QUÈ ÉS UN SCRIPT I NO CODI DE L'APP ─────────────────────────────────
 *
 * `src/core/weather/outlook.ts` respon «què sol fer el cel AQUÍ» amb quinze
 * peticions a l'arxiu d'Open-Meteo, una per any. Per a un punt està bé. Per a
 * una capa de mapa de nou-centes cel·les serien tretze mil peticions cada
 * vegada que algú obre el mapa: inviable, abusiu contra una API gratuïta sense
 * clau, i innecessari, perquè la climatologia no canvia — el mateix
 * `CLIMATOLOGY_TTL_MS` ja diu cent vuitanta dies. Es calcula un cop, es publica
 * com a fitxer estàtic, i `src/core/weather/climGrid.ts` només el llegeix.
 *
 * ── LES DECISIONS QUE FAN QUE LA XIFRA SIGUI LA MATEIXA ─────────────────────
 *
 * Aquest fitxer NO reimplementa la climatologia: importa `scoreCloudLayers`,
 * `averageLayers` i `bandForScore` de `core/weather/layers.ts`, i copia
 * literalment el criteri de `buildClimatology` — la mateixa finestra de ±5 dies
 * (`CLIMATOLOGY_WINDOW_DAYS`), els mateixos quinze anys (`CLIMATOLOGY_YEARS`),
 * el mateix filtre d'una hora al voltant del màxim local, i la mateixa decisió
 * de puntuar any per any i fer-ne la mitjana en comptes de puntuar la
 * nuvolositat mitjana. Si el color d'una cel·la i la xifra de la fitxa d'aquell
 * mateix punt sortissin de criteris diferents, l'usuari tocaria una cel·la
 * verda i llegiria un número que no hi lliga, i no hi hauria manera d'explicar
 * quin dels dos és el bo.
 *
 * ── L'ÚNICA DESVIACIÓ, I PER QUÈ ────────────────────────────────────────────
 *
 * `fetchArchiveWindow` demana UN punt per petició. Aquí es demanen molts d'una
 * tacada amb `fetchArchiveBatch`, que és una funció d'aquest fitxer i no de
 * `core/`.
 *
 * I ARA LA PART HONESTA, perquè la primera versió d'aquest comentari deia una
 * cosa que després va resultar falsa. Deia que agrupar punts era necessari per
 * no passar-se de quota. No ho és: la quota d'Open-Meteo no compta peticions,
 * compta VOLUM (vegeu el bloc del ritme, més avall), i vint punts en una
 * petició valen exactament el mateix que vint peticions d'un punt. Les 13.320
 * consultes punt-any d'aquesta graella costen unes 8.486 crides d'API tant si
 * es demanen d'una en una com de vint en vint.
 *
 * El que l'agrupació estalvia de veritat és TEMPS: 13.320 connexions HTTP en
 * comptes de 675. A poc més d'un segon de resposta cadascuna i amb dues en
 * paral·lel, són prop de dues hores de latència pura que s'estalvien i que no
 * aporten res a ningú, ni a nosaltres ni al servidor de l'altra banda.
 *
 * No viu a `core/` perquè l'app no ho necessita mai: la fitxa d'un punt
 * consulta un punt. Codi de `core/` que només fa servir un script és codi que
 * ningú no prova amb dades reals.
 *
 * El que sí que s'importa són `ARCHIVE_ENDPOINT` i `ARCHIVE_HOURLY`, perquè la
 * llista de variables i l'adreça NO poden divergir de les de l'app. En
 * particular `visibility` no hi és: la reanàlisi no en té i demanar-la fa
 * fallar tota la petició (vegeu `openMeteo.ts`).
 *
 * TAMPOC ES PASSA `models=`, i és igual de deliberat. `fetchArchiveWindow` no
 * en passa, o sigui que l'app rep el que l'arxiu tria per defecte; si aquí es
 * demanés un model concret, el mapa i la fitxa del mateix punt podrien sortir
 * d'entrades diferents i no hi hauria manera d'explicar la discrepància.
 *
 * ── REPRENIBLE ──────────────────────────────────────────────────────────────
 *
 * El progrés es desa a `node_modules/.tmp/` —el mateix lloc on tsc desa els
 * seus `tsbuildinfo`, i per tant fora del repositori sense haver de tocar el
 * `.gitignore`. AMB UNA TRAMPA QUE VAL LA PENA SABER: un `npm ci` esborra
 * `node_modules` sencer i s'endú el punt de control, i amb ell les hores de
 * quota que hi ha a dins. Si has deixat una graella a mig fer, copia'l abans.
 *
 * Es compta per CEL·LA I ANY, i la cel·la s'identifica per la seva casella de
 * la malla —no per la seva posició dins d'una llista que la franja decideix. La
 * diferència no és teòrica: un ajust al límit nord de la franja vora Menorca va
 * passar la graella de 855 cel·les a 888 i, amb el progrés comptat per lots,
 * hauria llençat 369 lots ja baixats (unes 4.600 crides d'API) per 33 cel·les
 * noves. Ara es migra: el que ja hi era es reaprofita, el que és nou es baixa i
 * el que ha quedat fora de la franja s'oblida. Si la xarxa cau o l'API talla,
 * es torna a executar i continua on era. Amb `--fresh` es comença de zero.
 *
 * I SI FALTA FEINA, NO S'ESCRIU EL JSON. Publicar una graella incompleta com si
 * fos definitiva vol dir cel·les amb menys anys darrere dels que sembla —una
 * xifra pitjor disfressada de xifra bona— i ningú no ho notaria mirant el mapa.
 * Es diu què falta i es demana tornar-hi. `--partial` ho força, per a qui sàpiga
 * exactament què està publicant.
 *
 * Els comptadors de puntuacions es desen com a HISTOGRAMES de 101 caselles i no
 * com a llistes. `scoreCloudLayers` torna una puntuació entera de 0 a 100, o
 * sigui que l'histograma no perd RES i el punt de control passa de dos
 * megabytes a dos-cents seixanta kilobytes.
 *
 * «No perd res» és comprovat i no deduït: 60.000 comparacions de p25, p50 i p75
 * entre `percentileFromHistogram` i el `percentile()` d'`outlook.ts` sobre
 * mostres de fins a 500 valors —uniformes, bimodals i degenerades— donen una
 * diferència màxima de 0. Exactament 0, no «menyspreable».
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getEclipse } from '../src/core/eclipses/catalog';
import {
  approxDistanceKm,
  computeEclipsePath,
  distanceToCenterLineKm,
  ESPENAK_ATTRIBUTION,
  type EclipsePath,
  type PathPoint,
} from '../src/core/eclipses/path';
import {
  CLIM_GRID_FORMAT,
  climGridFileName,
  parseCloudClimGrid,
  type CloudClimGrid,
} from '../src/core/weather/climGrid';
import {
  averageLayers,
  bandForScore,
  scoreCloudLayers,
  SCORING_VERSION,
} from '../src/core/weather/layers';
import {
  ARCHIVE_ENDPOINT,
  ARCHIVE_HOURLY,
  ARCHIVE_LAG_DAYS,
  OPEN_METEO_ATTRIBUTION,
  type HourlySeries,
  type PointResponse,
  type QueryPoint,
} from '../src/core/weather/openMeteo';
import {
  CLIMATOLOGY_MIN_YEARS,
  CLIMATOLOGY_WINDOW_DAYS,
  CLIMATOLOGY_YEARS,
} from '../src/core/weather/outlook';
import type { CloudLayers } from '../src/core/weather/types';

const DAY_MS = 86_400_000;

/* ------------------------------------------------------------- paràmetres */

/**
 * Pas de la graella, en graus.
 *
 * MESURAT, PERQUÈ LA SUPOSICIÓ ERA FALSA. La idea de partida era que 0,25° fos
 * la malla d'ERA5 i que baixar-ne més fos fingir detall. Es va comprovar contra
 * l'API abans d'escriure res, i s'ha tornat a comprovar en generar la graella
 * de debò: demanant latituds separades 0,02°, l'arxiu torna coordenades
 * enganxades a una malla de 0,0703125° —7,8 km— i valors de nuvolositat
 * diferents gairebé a cada salt.
 *
 * LA SEGONA MESURA ÉS LA QUE TANCA EL DUBTE, perquè la primera no distingia
 * entre dada nova i interpolació. Un transsecte de 20 punts a 0,0703° sobre
 * Burgos (−3,70°, del 41,58° al 42,92°, 12-11-2024) dona 10 valors diferents de
 * 20 a les 09 UTC, amb trams iguals d'1,25 cel·les de mitjana: 0,088°. Si el
 * que hi ha a sota fos una malla de 0,25° interpolada, els trams durarien 3,5
 * cel·les i es veurien esglaons de 0,25°. No s'hi veuen.
 *
 * Es queda a 0,25° per cost, i el cost està comptat: a 0,0703° la franja del
 * 2026 passaria de 888 cel·les a unes onze mil dues-centes (creixen amb el
 * quadrat del pas), i les 8.486 crides d'API d'aquesta graella passarien a més
 * de cent mil — deu dies sencers del límit diari del pla gratuït. El JSON, de
 * ~55 kB a més d'un megabyte que l'usuari s'ha de baixar per anar sense
 * cobertura.
 *
 * La distinció que importa i que no s'ha de perdre mai: 0,25° no INVENTA res
 * —cap cel·la ensenya més detall del que la font en sap—, però tampoc no és el
 * límit de la font. Si algun dia es baixa el pas, això no és una millora
 * cosmètica: és dada nova de veritat.
 */
const STEP_DEG = 0.25;

/**
 * Marge al voltant de la franja, en km.
 *
 * La capa no serveix només per triar dins de la franja: serveix per veure si
 * val la pena moure's. Cinquanta quilòmetres és, aproximadament, el que es
 * recorre en tres quarts d'hora de carretera secundària el dia de l'eclipsi,
 * que és el que algú es pot plantejar el mateix matí. Més enllà d'això ja no
 * és una decisió de mapa, és un altre viatge.
 */
const BUFFER_KM = 50;

/**
 * Punts per petició d'arxiu.
 *
 * Vint és un compromís mesurat i no un número rodó: la resposta d'onze dies
 * horaris per a vint punts i quatre variables ronda els 500 kB (uns 25 kB per
 * punt, tal com diu `openMeteo.ts`), que és una mida que es descarrega i es
 * parseja sense fer patir res, i redueix les peticions per un factor de vint.
 */
const DEFAULT_BATCH = 20;

/**
 * Peticions simultànies. DUES, i és una decisió d'educació, no de rendiment.
 *
 * Aquest script és l'únic lloc del projecte que fa centenars de peticions
 * seguides a un servei gratuït que no ens demana ni clau ni diners. Anar a
 * quatre o a vuit estalviaria minuts a qui compila i li carregaria la feina a
 * ells. Amb el comptador de cost de més avall, de tota manera, qui mana és el
 * ritme i no el paral·lelisme.
 */
const DEFAULT_CONCURRENCY = 2;

/** Reintents per petició, amb espera creixent. */
const MAX_RETRIES = 4;

/*
 * ── EL COST NO ES COMPTA EN PETICIONS, ES COMPTA EN «API CALLS» ─────────────
 *
 * Això es va aprendre estavellant-s'hi, i val la pena deixar-ho escrit perquè
 * no torni a passar. La primera versió agrupava vint punts per petició i posava
 * una pausa de 350 ms entremig, convençuda que 645 peticions no eren res al
 * costat del límit de 600 per minut. A la pràctica va tirar 43 peticions en
 * 24 segons i Open-Meteo va respondre «Minutely API request limit exceeded».
 *
 * El motiu és que el límit no compta PETICIONS sinó VOLUM: una petició val,
 * aproximadament, punts × dies/7 × variables/10. Les nostres —vint punts, onze
 * dies, quatre variables— valen unes 14 crides cadascuna, i 43 × 14 ≈ 600.
 * Exactament el límit que va saltar. Agrupar punts, doncs, estalvia connexions
 * i temps de latència, però NO estalvia quota: la quota és la dada.
 *
 * Amb aquest comptador, la graella sencera del 2026 val 675 × 12,6 ≈ 8.486
 * crides. Cap dins del límit diari de 10.000 però no dins de l'horari de 5.000,
 * o sigui que el mínim honest són dues hores llargues. No hi ha drecera: la
 * mateixa dada no es pot demanar més barata.
 *
 * I LA FÓRMULA ÉS UNA ESTIMACIÓ, NO UN CONTRACTE. Open-Meteo no publica el pes
 * exacte i el nostre es va quedar curt a la segona prova: amb el sostre a 450
 * per minut encara va saltar el límit. Per això `RateGate` porta un factor de
 * seguretat que creix sol cada cop que l'API ens talla. És l'única manera
 * honesta de fer-ho quan la regla de l'altra banda no es pot llegir: mesurar-la
 * pel comportament i cedir-hi terreny.
 */

/** Cost estimat d'una petició, en «API calls» d'Open-Meteo. */
function callWeight(points: number, days: number, variables: number): number {
  return points * (days / 7) * (variables / 10);
}

/**
 * Sostres que ens autoimposem, per sota dels publicats (600/min, 5.000/h,
 * 10.000/dia). El marge no és timidesa: el pes real d'una petició és una
 * estimació nostra, i si ens quedéssim curts descobriríem l'error amb un tall
 * de servei enmig d'una execució de dues hores.
 */
const BUDGET_PER_MINUTE = 380;
const BUDGET_PER_HOUR = 4_000;
const BUDGET_PER_DAY = 9_000;

/**
 * Finestres de món que té sentit calcular, per eclipsi.
 *
 * NO ÉS TOTA LA FRANJA, i tampoc no ho pretén. La del 12 d'agost de 2026
 * comença a Sibèria, passa pel pol i baixa per Islàndia: calcular-la sencera
 * serien desenes de milers de cel·les i unes quantes hores de peticions per
 * pintar oceà que ningú d'aquesta app no mirarà mai. Aquesta aplicació parla
 * d'anar a veure l'eclipsi des d'Espanya, i aquests rectangles són el tros de
 * franja al qual s'hi pot arribar conduint.
 *
 * Els límits estan arrodonits a graus sencers a posta: així la retallada de
 * veritat la fa la geometria de la franja (`BUFFER_KM`) i no un rectangle
 * escrit a mà que algú hauria d'anar ajustant.
 */
const AREAS: Record<string, { west: number; south: number; east: number; north: number }> = {
  // Galícia i la cornisa cantàbrica fins a les Balears, passant per Castella,
  // la Rioja, l'Aragó i el litoral valencià.
  '2026-08-12': { west: -10, south: 36, east: 5, north: 45 },
  // L'Estret: Cadis, Màlaga, Ceuta i Melilla, amb el nord del Marroc.
  '2027-08-02': { west: -10, south: 33, east: 1, north: 40 },
  // De Sevilla a la costa catalana, amb el Sol ponent-se durant l'anularitat.
  '2028-01-26': { west: -10, south: 34, east: 5, north: 43 },
};

/* -------------------------------------------------------------- la graella */

interface Cell {
  /** Posició dins de la llista de cel·les. Evita cerques per identitat. */
  index: number;
  ix: number;
  iy: number;
  lat: number;
  lon: number;
  /**
   * Instant del màxim local, tret del punt més proper de la línia central.
   *
   * NO es criden les circumstàncies locals completes: la diferència entre el
   * màxim exacte d'una cel·la i el pas de la central que té al davant és d'un
   * parell de minuts, i la reanàlisi és HORÀRIA. Resoldre els contactes de
   * nou-centes cel·les per afinar minuts dins d'una casella d'una hora seria
   * pagar per res.
   *
   * I VAL LA PENA DEIXAR ESCRIT EL NÚMERO, perquè contradiu el que semblava.
   * S'esperava que l'hora canviés molt de punta a punta —«l'ombra triga mitja
   * hora a travessar Espanya»— i s'ha mesurat: de la Corunya (18:26:49 UT) a
   * Maó (18:32:04 UT) hi ha cinc minuts i quart. Cinc. Amb la finestra de ±1 h
   * amb què `buildClimatology` tria les mostres, això vol dir que el 2026 TOTES
   * les cel·les acaben mirant les mateixes hores del dia. L'hora per cel·la es
   * calcula igualment, perquè és el que és correcte i no costa res, però que
   * surti igual per a tothom és un RESULTAT d'aquest eclipsi i no una hipòtesi
   * de la qual es pugui dependre: al 2027, amb la franja pel matí i molt més
   * llarga, no té per què passar el mateix.
   */
  targetMs: number;
}

/**
 * Amplada local de la franja al voltant d'un punt de la línia central, en km.
 *
 * És la suma de les distàncies d'aquell punt als dos límits. Serveix per al
 * criteri de retallada de `buildCells`, que necessita saber quant val «dins».
 */
function bandWidthAt(path: EclipsePath, center: PathPoint): number {
  const north = distanceToCenterLineKm(center, path.northLimit) ?? 0;
  const south = distanceToCenterLineKm(center, path.southLimit) ?? 0;
  return north + south;
}

/**
 * Les cel·les de la malla ERA5 que cauen dins de la franja més el marge.
 *
 * EL CRITERI, que costa una línia i estalvia un polígon. Per a qualsevol punt,
 * la suma de les distàncies als dos límits val exactament l'amplada de la
 * franja si el punt és a dins, i l'amplada més el doble de la sortida si és a
 * fora. Per tant «dins de la franja o a menys de 50 km» és, ras i curt,
 * dNord + dSud ≤ amplada + 100.
 *
 * L'alternativa era construir el polígon de la franja i fer-hi un test de
 * pertinença. S'ha descartat: `eclipsePathToGeoJson` en treu un anell amb les
 * longituds DESENROTLLADES i tallat pel tram dibuixable (la franja del 2026
 * passa pel pol), i un test de raig sobre aquell anell hauria de tornar a
 * resoldre tots aquells casos per dir el que aquesta suma ja diu bé.
 */
function buildCells(
  eclipseId: string,
  path: EclipsePath,
  area: { west: number; south: number; east: number; north: number },
): Cell[] {
  const cells: Cell[] = [];
  const ixFrom = Math.ceil(area.west / STEP_DEG);
  const ixTo = Math.floor(area.east / STEP_DEG);
  const iyFrom = Math.ceil(area.south / STEP_DEG);
  const iyTo = Math.floor(area.north / STEP_DEG);

  // L'amplada local és cara de calcular i canvia poc: es guarda per punt de la
  // línia central i es reaprofita per a totes les cel·les que hi cauen a prop.
  const widthCache = new Map<number, number>();

  for (let iy = iyFrom; iy <= iyTo; iy++) {
    const lat = iy * STEP_DEG;
    for (let ix = ixFrom; ix <= ixTo; ix++) {
      const lon = ix * STEP_DEG;

      const north = distanceToCenterLineKm({ lat, lon }, path.northLimit);
      const south = distanceToCenterLineKm({ lat, lon }, path.southLimit);
      if (north === null || south === null) continue;

      // Índex del punt més proper de la central, per a l'amplada i per a l'hora.
      let nearest = 0;
      let bestKm = Infinity;
      for (let i = 0; i < path.center.length; i++) {
        const d = approxDistanceKm({ lat, lon }, path.center[i]);
        if (d < bestKm) {
          bestKm = d;
          nearest = i;
        }
      }

      let width = widthCache.get(nearest);
      if (width === undefined) {
        width = bandWidthAt(path, path.center[nearest]);
        widthCache.set(nearest, width);
      }

      if (north + south > width + 2 * BUFFER_KM) continue;

      cells.push({
        index: cells.length,
        ix,
        iy,
        lat,
        lon,
        targetMs: path.center[nearest].timeMs,
      });
    }
  }

  if (cells.length === 0) {
    throw new Error(
      `Cap cel·la per a ${eclipseId}: revisa AREAS, la franja no hi passa.`,
    );
  }
  return cells;
}

/* ------------------------------------------------------------- acumuladors */

/**
 * El que es guarda de cada cel·la mentre es baixen els anys.
 *
 * `histogram` té 101 caselles perquè la puntuació és entera de 0 a 100. No és
 * una aproximació: és la llista ordenada comprimida sense pèrdua.
 */
interface Accumulator {
  histogram: number[];
  low: number;
  mid: number;
  high: number;
  total: number;
  samples: number;
  clear: number;
  cloudy: number;
  /**
   * Anys ja INTENTATS en aquesta cel·la. És la clau del progrés, i viu aquí i
   * no en una llista de lots per la raó que explica la capçalera: el lot és una
   * agrupació de transport que canvia amb la franja, i la cel·la no.
   */
  folded: number[];
  /**
   * Anys que han donat alguna mostra útil. NO és `folded.length`: un any pot
   * baixar-se sencer i tornar només forats, i llavors s'ha d'intentar un sol
   * cop però no s'ha de comptar mai. És aquest número el que es publica.
   */
  years: number;
}

function emptyAccumulator(): Accumulator {
  return {
    histogram: new Array<number>(101).fill(0),
    low: 0,
    mid: 0,
    high: 0,
    total: 0,
    samples: 0,
    clear: 0,
    cloudy: 0,
    folded: [],
    years: 0,
  };
}

/** Percentil exacte sobre l'histograma, amb la mateixa interpolació d'outlook.ts. */
function percentileFromHistogram(histogram: readonly number[], q: number): number {
  const n = histogram.reduce((a, b) => a + b, 0);
  if (n === 0) return 0;

  const position = (n - 1) * q;
  const lowIndex = Math.floor(position);
  const highIndex = Math.ceil(position);

  let seen = 0;
  let lowValue: number | null = null;
  let highValue: number | null = null;
  for (let score = 0; score <= 100; score++) {
    const count = histogram[score];
    if (count === 0) continue;
    if (lowValue === null && seen + count > lowIndex) lowValue = score;
    if (highValue === null && seen + count > highIndex) highValue = score;
    seen += count;
    if (lowValue !== null && highValue !== null) break;
  }

  const lo = lowValue ?? 0;
  const hi = highValue ?? lo;
  return lo + (hi - lo) * (position - lowIndex);
}

/** Distància circular entre dues hores del dia, igual que a outlook.ts. */
function hourDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 24;
  return Math.min(d, 24 - d);
}

function readNumber(series: (number | null)[] | undefined, index: number): number | null {
  if (!series || index < 0 || index >= series.length) return null;
  const value = series[index];
  return value === null || value === undefined || !Number.isFinite(value) ? null : value;
}

/**
 * Buida la sèrie horària d'un any dins de l'acumulador d'una cel·la.
 *
 * Còpia literal del bucle de `buildClimatology`: mateixa finestra d'una hora,
 * mateix tractament dels forats i mateixa crida a `scoreCloudLayers`. Torna
 * cert si aquell any ha donat alguna mostra útil.
 *
 * Les capes es promitgen amb `averageLayers` any per any i s'acumulen
 * multiplicades pel nombre de mostres. És ARITMÈTICAMENT IDÈNTIC a promitjar
 * les quatre-centes mostres de cop —que és el que fa `buildClimatology`— i
 * permet que el punt de control guardi quatre números per cel·la en comptes de
 * la llista sencera. També és l'única manera de fer passar les lectures per la
 * mateixa funció que les fa passar a l'app, amb el seu retall a 0-100 inclòs.
 */
function foldYear(
  accumulator: Accumulator,
  series: HourlySeries,
  targetHour: number,
): boolean {
  const yearLayers: CloudLayers[] = [];

  for (let i = 0; i < series.time.length; i++) {
    const stamp = new Date(series.time[i] * 1000);
    if (hourDistance(stamp.getUTCHours(), targetHour) > 1) continue;

    const low = readNumber(series.cloud_cover_low, i);
    const mid = readNumber(series.cloud_cover_mid, i);
    const high = readNumber(series.cloud_cover_high, i);
    const total = readNumber(series.cloud_cover, i);

    const hasLayers = low !== null || mid !== null || high !== null;
    if (!hasLayers && total === null) continue;

    const layers: CloudLayers = {
      low: low ?? 0,
      mid: mid ?? 0,
      high: high ?? 0,
      total: total ?? 0,
    };
    const score = scoreCloudLayers(layers, hasLayers).score;
    const band = bandForScore(score);

    yearLayers.push(layers);
    accumulator.histogram[Math.min(100, Math.max(0, Math.round(score)))]++;
    if (band === 'clear') accumulator.clear++;
    if (band === 'cloudy') accumulator.cloudy++;
  }

  if (yearLayers.length === 0) return false;

  const mean = averageLayers(yearLayers);
  accumulator.low += mean.low * yearLayers.length;
  accumulator.mid += mean.mid * yearLayers.length;
  accumulator.high += mean.high * yearLayers.length;
  accumulator.total += mean.total * yearLayers.length;
  accumulator.samples += yearLayers.length;
  // `years` i `folded` els porta qui crida: aquesta funció no sap de quin any
  // és la sèrie que li han donat, i el compte d'anys amb dades i el d'anys
  // intentats són dues coses diferents que s'han d'escriure cadascuna al seu lloc.
  return true;
}

/* ------------------------------------------------------------------ xarxa */

const network = { requests: 0, bytes: 0, retries: 0, weight: 0 };

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/**
 * Torn d'espera que respecta els tres sostres alhora.
 *
 * Guarda el cost de cada petició amb la seva hora i, abans de deixar-ne passar
 * una de nova, mira quant en queda dins de l'últim minut, de l'última hora i de
 * l'últim dia. Si no hi cap, dorm just el que falta perquè la mostra més antiga
 * surti de la finestra. És deliberadament simple i deliberadament pessimista:
 * un script que corre dues hores i s'estavella al minut 90 per haver estat
 * agosarat no estalvia res a ningú.
 */
export interface RateSample {
  atMs: number;
  weight: number;
  /** Apunt posat per forçar una espera, no quota gastada de veritat. */
  synthetic?: boolean;
}

class RateGate {
  private history: RateSample[] = [];

  /**
   * Correcció de la nostra estimació de pes, apresa de l'API mateixa.
   *
   * Comença a 1 i puja un 20 % cada cop que Open-Meteo ens talla PER MINUT. Al
   * segon intent d'aquest script el límit va saltar amb el sostre a 450 per
   * minut, o sigui que la fórmula es queda curta; en comptes d'endevinar el
   * número bo i tornar-hi d'aquí a mitja hora, el gat es fa enrere sol fins que
   * deixa de xocar. No baixa mai: dins d'una execució, el que ha xocat un cop
   * ha xocat.
   *
   * NOMÉS PER MINUT, I NO PER HORA, que és la correcció d'un error propi. Un
   * tall horari no diu res del pes d'una petició: diu que la quota d'aquella
   * hora ja estava gastada, cosa que pot ser perfectament culpa d'una execució
   * anterior d'aquest mateix script. Fent-lo pujar també amb els talls horaris,
   * el factor va arribar a 1,44 en dues topades seguides i el ritme resultant
   * hauria allargat la generació de dues hores a gairebé tres, per una cosa que
   * no tenia res a veure amb el ritme.
   *
   * I EL SOSTRE ÉS 1,25 PERQUÈ L'ERROR ESTÀ ACOTAT PER DALT. De la primera
   * execució en surt una mesura: 43 peticions van passar i la 44a va topar amb
   * el límit de 600, o sigui que el pes real és entre 600/44 = 13,6 i
   * 600/43 = 13,95, contra els 12,57 que estima la fórmula. L'error és, doncs,
   * d'un 8-11 %. Un factor de 1,25 el cobreix amb marge i qualsevol cosa per
   * damunt ja no corregeix res: només fa la generació més lenta a canvi de res.
   */
  private safety = 1;
  private static readonly MAX_SAFETY = 1.25;

  /**
   * Recupera el que ja s'ha gastat en execucions anteriors.
   *
   * SENSE AIXÒ, REPRENDRE ÉS PITJOR QUE NO REPRENDRE. Va passar: tres
   * execucions seguides d'aquest script en vint minuts, cadascuna estrenant un
   * comptador a zero, van esgotar el sostre horari sense que cap de les tres
   * cregués haver-hi arribat. El punt de control ja guarda quina feina s'ha fet;
   * ha de guardar també quant ha costat, o el ritme el decideix l'oblit.
   */
  restore(samples: readonly RateSample[]): void {
    const cutoff = Date.now() - 86_400_000;
    this.history = samples.filter((s) => s.atMs >= cutoff).sort((a, b) => a.atMs - b.atMs);
  }

  /** El que s'ha gastat, per desar-ho al punt de control. */
  snapshot(): RateSample[] {
    return this.history;
  }

  /** L'API ens ha tallat: la nostra estimació era optimista. */
  backOff(): void {
    if (this.safety >= RateGate.MAX_SAFETY) return;
    this.safety = Math.min(RateGate.MAX_SAFETY, this.safety * 1.1);
    process.stdout.write(
      `    factor de seguretat del ritme → ×${this.safety.toFixed(2)}\n`,
    );
  }

  /**
   * L'hora ja està gastada, ho digui el nostre comptador o no.
   *
   * S'apunta el sostre horari sencer com si l'haguéssim consumit nosaltres: a
   * partir d'aquí el mateix `take` es cuida d'esperar. És més honest que un
   * `sleep` fix, perquè el que s'ha d'esperar no és un número rodó sinó que la
   * finestra torni a obrir-se, i el gat ja sap comptar finestres.
   */
  hourSpent(): void {
    // Es data al COMENÇAMENT de l'hora de rellotge, no a ara. Open-Meteo diu
    // «try again in the next hour», que és una finestra de rellotge i no una de
    // rodolant: així l'apunt caduca just al canvi d'hora i no seixanta minuts
    // després del tall, que seria mitja hora d'espera regalada.
    //
    // `synthetic` el deixa fora del comptador diari: és un apunt per forçar una
    // espera, no quota que hàgim gastat de veritat, i sumant-lo al dia dues o
    // tres vegades ens aturaríem sols contra un sostre que no hem tocat.
    const hourStart = Math.floor(Date.now() / 3_600_000) * 3_600_000;
    this.history.push({ atMs: hourStart, weight: BUDGET_PER_HOUR, synthetic: true });
  }

  /**
   * Quant s'ha d'esperar perquè hi càpiga `weight` en aquesta finestra.
   *
   * No n'hi ha prou de mirar quan caduca l'apunt més antic —que és el que feia
   * la primera versió i el que li va fer anunciar una hora d'espera quan en
   * tocaven tres minuts—: cal anar-los descomptant per ordre d'antiguitat fins
   * que el que queda deixi lloc, i l'espera és fins que caduca l'últim que ha
   * calgut descomptar. Per això la llista es manté ordenada.
   */
  private waitFor(
    nowMs: number,
    spanMs: number,
    budget: number,
    weight: number,
    countSynthetic: boolean,
  ): number {
    const inWindow = this.history.filter(
      (entry) => entry.atMs >= nowMs - spanMs && (countSynthetic || !entry.synthetic),
    );
    let total = inWindow.reduce((sum, entry) => sum + entry.weight, 0);
    if (total + weight <= budget) return 0;

    for (const entry of inWindow) {
      total -= entry.weight;
      if (total + weight <= budget) return entry.atMs + spanMs - nowMs;
    }
    // Ni buidant-la del tot hi cap: la petició val més que el sostre sencer.
    return spanMs;
  }

  /**
   * Espera fins que hi càpiga una petició d'aquest pes, i l'apunta.
   *
   * El pes que es DESA és el cru; el factor de seguretat s'aplica retallant els
   * sostres, no inflant els apunts. La diferència no és estilística: el punt de
   * control viatja entre execucions i uns apunts inflats hi arribarien amb un
   * factor que ja no és el d'ara. I el sostre DIARI no es retalla — el límit
   * diari és el que és, i encongir-lo amb el nostre propi marge de seguretat
   * ens hauria aturat sols a mig camí contra un sostre que no havíem tocat.
   */
  async take(weight: number): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.history.sort((a, b) => a.atMs - b.atMs);
      // La finestra d'un dia és la més llarga: tot el que en surt ja no compta.
      while (this.history.length > 0 && this.history[0].atMs < now - 86_400_000) {
        this.history.shift();
      }

      const windows: [number, number, string, boolean][] = [
        [60_000, BUDGET_PER_MINUTE / this.safety, 'minut', true],
        [3_600_000, BUDGET_PER_HOUR / this.safety, 'hora', true],
        [86_400_000, BUDGET_PER_DAY, 'dia', false],
      ];

      let waitMs = 0;
      let reason = '';
      for (const [span, budget, name, countSynthetic] of windows) {
        const until = this.waitFor(now, span, budget, weight, countSynthetic);
        if (until > waitMs) {
          waitMs = until;
          reason = name;
        }
      }

      if (waitMs <= 0) {
        this.history.push({ atMs: now, weight });
        return;
      }

      process.stdout.write(
        `    sostre per ${reason}: espera de ${Math.ceil(waitMs / 1000)} s\n`,
      );
      await sleep(Math.min(waitMs, 5 * 60_000) + 250);
    }
  }
}

const gate = new RateGate();

/**
 * El sostre DIARI no es pot esperar: s'ha d'aturar.
 *
 * Els altres dos es dormen —un minut, o fins al canvi d'hora— i s'hi torna. El
 * diari vol dir demà, i quedar-se un procés obert hores mirant el rellotge no
 * és paciència, és una manera de perdre el que s'ha baixat si algú tanca la
 * consola. Amb el punt de control desat, «demà» és tornar a executar la mateixa
 * ordre i continuar per on anava.
 *
 * Es marca amb una bandera i no llançant des de dins d'un lot perquè hi ha
 * feines en vol: es deixa que acabin, es desa, i s'atura.
 */
let dailyExhausted = false;

/**
 * Finestra d'arxiu per a MOLTS punts en una sola petició.
 *
 * Vegeu la capçalera: aquesta és l'única cosa que no surt de `core/`, i
 * l'endpoint i la llista de variables sí que en surten perquè no puguin
 * divergir. Reintenta amb espera creixent: una API gratuïta que ens talla per
 * excés de ritme no és un error, és un avís, i el que toca és esperar-se.
 */
async function fetchArchiveBatch(
  points: readonly QueryPoint[],
  startDateMs: number,
  endDateMs: number,
): Promise<PointResponse[]> {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat.toFixed(4)).join(','),
    longitude: points.map((p) => p.lon.toFixed(4)).join(','),
    hourly: ARCHIVE_HOURLY.join(','),
    start_date: new Date(startDateMs).toISOString().slice(0, 10),
    end_date: new Date(endDateMs).toISOString().slice(0, 10),
    timeformat: 'unixtime',
    timezone: 'UTC',
  });
  const url = `${ARCHIVE_ENDPOINT}?${params.toString()}`;
  const days = Math.round((endDateMs - startDateMs) / DAY_MS) + 1;
  const weight = callWeight(points.length, days, ARCHIVE_HOURLY.length);

  let attempt = 0;
  for (;;) {
    try {
      await gate.take(weight);
      network.weight += weight;
      const response = await fetch(url);
      const text = await response.text();
      network.requests++;
      network.bytes += Buffer.byteLength(text);

      if (!response.ok) {
        let reason = `HTTP ${response.status}`;
        try {
          const body = JSON.parse(text) as { reason?: string };
          if (body.reason) reason = body.reason;
        } catch {
          /* cos no llegible: ens quedem amb el codi */
        }
        throw new Error(`Open-Meteo ha respost ${reason}`);
      }

      const payload: unknown = JSON.parse(text);
      const list = Array.isArray(payload) ? payload : [payload];
      if (list.length !== points.length) {
        throw new Error(
          `Demanats ${points.length} punts i n'han tornat ${list.length}`,
        );
      }
      return list.map((entry) => {
        const point = entry as Partial<PointResponse> & { error?: boolean; reason?: string };
        if (point.error) throw new Error(point.reason ?? 'Error d’Open-Meteo');
        if (!point.hourly || !Array.isArray(point.hourly.time)) {
          throw new Error('Resposta sense sèrie horària');
        }
        return {
          latitude: point.latitude ?? 0,
          longitude: point.longitude ?? 0,
          elevation: point.elevation ?? 0,
          hourly: point.hourly,
        };
      });
    } catch (error) {
      network.retries++;
      const message = String(error);

      /*
       * UN TALL PER RITME NO ÉS UN ERROR, ÉS UN AVÍS, i per això no consumeix
       * intents: si els consumís, quatre talls seguits farien perdre el lot i
       * el reintent d'un lot ja baixat torna a gastar la mateixa quota que ens
       * acaba de faltar. El que toca és esperar-se el que la finestra demani.
       */
      if (message.includes('Daily API request limit')) {
        dailyExhausted = true;
        throw error;
      }
      if (message.includes('Hourly API request limit')) {
        // Sense `backOff`: això no diu que les nostres peticions pesin més del
        // que crèiem, diu que aquesta hora ja estava gastada — sovint per una
        // execució anterior d'aquest mateix script.
        gate.hourSpent();
        process.stdout.write('    sostre horari esgotat: s’espera que s’obri\n');
        continue;
      }
      if (message.includes('Minutely API request limit')) {
        gate.backOff();
        process.stdout.write('    sostre per minut: s’esperen 65 s\n');
        await sleep(65_000);
        continue;
      }

      if (attempt >= MAX_RETRIES) throw error;
      const wait = 2000 * 2 ** attempt;
      process.stdout.write(
        `    reintent ${attempt + 1}/${MAX_RETRIES} d'aquí a ${Math.round(wait / 1000)} s (${message})\n`,
      );
      attempt++;
      await sleep(wait);
    }
  }
}

/** Executa feines amb un límit de simultaneïtat, com `mapWithLimit` d'outlook.ts. */
async function runWithLimit<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

/* ------------------------------------------------------------ punt de control */

/**
 * El progrés es compta per CEL·LA I ANY, i la cel·la s'identifica per la seva
 * casella de la malla.
 *
 * DUES VERSIONS ANTERIORS I DUES LLIÇONS. La primera marcava l'any com a fet
 * encara que se n'hagués perdut algun lot pel camí: aquelles cel·les es
 * quedaven amb un any menys per sempre i, com que la xifra es publicava
 * igualment, ningú no ho hauria sabut mai. La segona ho va arreglar comptant per
 * LOT i any, amb una signatura de la graella que invalidava el punt de control
 * sencer si la franja canviava.
 *
 * Això últim va costar una tarda de quota. El lot és una agrupació de
 * transport —vint punts que caben en una petició— i el seu contingut depèn de
 * quines cel·les hi ha i en quin ordre; qualsevol retoc a la geometria de la
 * franja, encara que sigui a l'altra punta del mapa, en canvia la composició i
 * deixa les claus desades sense significat. Va passar de debò: un ajust al
 * límit nord vora Menorca va passar la graella de 855 cel·les a 888 i hauria
 * llençat 369 lots ja baixats —unes 4.600 crides d'API— per 33 cel·les noves.
 *
 * La cel·la, en canvi, no depèn de res: `ix`/`iy` són índexs ABSOLUTS sobre la
 * malla de 0,25° (vegeu `climGrid.ts`). Una cel·la baixada el mes passat parla
 * exactament del mateix tros de món que la d'avui. Per això el punt de control
 * desa la llista de caselles i, quan la franja canvia, MIGRA: el que ja hi era
 * es reaprofita, el que és nou es baixa i el que ha deixat de caure dins de la
 * franja s'oblida. I com que cada acumulador porta la seva pròpia llista d'anys
 * integrats, comptar dos cops el mateix any a la mateixa cel·la és impossible
 * per construcció, no per disciplina.
 */
interface Checkpoint {
  eclipseId: string;
  scoringVersion: number;
  stepDeg: number;
  bufferKm: number;
  /** Identitat de cada acumulador: la seva casella de la malla, `[ix, iy]`. */
  cells: [number, number][];
  accumulators: Accumulator[];
  /** Quota gastada recentment, perquè reprendre no reseteji el ritme. */
  rate: RateSample[];
}

function checkpointPath(eclipseId: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, `../node_modules/.tmp/clouds-clim-${eclipseId}.progress.json`);
}

/** Resultat de recuperar el punt de control, dit en números per poder-lo explicar. */
interface Restored {
  accumulators: Accumulator[];
  rate: RateSample[];
  reused: number;
  fresh: number;
  forgotten: number;
}

/**
 * Recupera el punt de control i l'encaixa amb la graella d'ARA.
 *
 * El que no lliga no fa descartar res: es migra el que es pot i es diu quant
 * s'ha reaprofitat. Només els paràmetres que canvien el SIGNIFICAT de les
 * dades —la física de puntuació, el pas de la malla— fan començar de zero,
 * perquè aleshores el que hi ha desat ja no vol dir el mateix.
 */
function readCheckpoint(eclipseId: string, cells: readonly Cell[]): Restored | null {
  const file = checkpointPath(eclipseId);
  if (!existsSync(file)) return null;
  try {
    const saved = JSON.parse(readFileSync(file, 'utf8')) as Partial<Checkpoint>;
    if (
      saved.eclipseId !== eclipseId ||
      saved.scoringVersion !== SCORING_VERSION ||
      saved.stepDeg !== STEP_DEG
    ) {
      process.stdout.write(
        '  el punt de control desat és d’una altra física o d’una altra malla: es descarta\n',
      );
      return null;
    }
    if (!Array.isArray(saved.cells) || !Array.isArray(saved.accumulators)) return null;
    if (saved.cells.length !== saved.accumulators.length) return null;

    const byCell = new Map<string, Accumulator>();
    for (let i = 0; i < saved.cells.length; i++) {
      const [ix, iy] = saved.cells[i];
      const acc = saved.accumulators[i];
      // Un punt de control d'abans que existís `folded` no es pot fer servir:
      // sabríem quantes dades hi ha però no de quins anys, i tornar a integrar
      // un any ja integrat duplicaria les mostres sense que res ho digués.
      if (!acc || !Array.isArray(acc.folded) || !Array.isArray(acc.histogram)) continue;
      byCell.set(`${ix},${iy}`, acc);
    }

    let reused = 0;
    const accumulators = cells.map((cell) => {
      const previous = byCell.get(`${cell.ix},${cell.iy}`);
      if (!previous) return emptyAccumulator();
      reused++;
      return previous;
    });

    return {
      accumulators,
      rate: saved.rate ?? [],
      reused,
      fresh: cells.length - reused,
      forgotten: byCell.size - reused,
    };
  } catch {
    return null;
  }
}

function writeCheckpoint(checkpoint: Checkpoint): void {
  const file = checkpointPath(checkpoint.eclipseId);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(checkpoint), 'utf8');
}

/* ------------------------------------------------------------------ sortida */

/**
 * Anys que de debò hi ha darrere de la graella.
 *
 * NO ÉS EL RANG DEL CALENDARI, i la diferència és tota la qüestió. `firstYear`
 * i `lastYear` es podrien treure de restar quinze a l'últim any d'arxiu, que és
 * el que es va DEMANAR; però el que es publica ha de dir el que es va OBTENIR.
 * Amb una execució aturada a mitges —el sostre diari d'Open-Meteo hi arriba
 * sovint— aquelles dues xifres anunciarien una sèrie de quinze anys damunt de
 * dades de vuit, i la columna `years`, que sí que diu la veritat cel·la a
 * cel·la, quedaria contradient la capçalera del mateix fitxer sense que ningú
 * ho miri. Una climatologia de vuit anys pot ser perfectament útil; el que no
 * pot fer és presentar-se com una de quinze.
 */
function foldedSpan(accumulators: readonly Accumulator[]): {
  first: number;
  last: number;
  count: number;
} {
  const seen = new Set<number>();
  for (const acc of accumulators) for (const year of acc.folded) seen.add(year);
  const list = [...seen].sort((a, b) => a - b);
  return { first: list[0] ?? 0, last: list[list.length - 1] ?? 0, count: list.length };
}

/**
 * Punt-any que encara falten per baixar dins de la finestra que es demana.
 *
 * Es filtra pels dos costats del rang a posta. El punt de control sobreviu
 * d'un dia per l'altre i la finestra de quinze anys llisca amb el calendari:
 * un acumulador pot portar anys que avui ja han quedat fora per baix, i
 * comptar-los faria creure que la feina està més avançada del que és.
 */
function pendingCellYears(
  accumulators: readonly Accumulator[],
  firstYear: number,
  lastYear: number,
): number {
  let pending = 0;
  for (const acc of accumulators) {
    const inWindow = acc.folded.filter((y) => y >= firstYear && y <= lastYear).length;
    pending += CLIMATOLOGY_YEARS - inWindow;
  }
  return pending;
}

function buildGrid(
  eclipseId: string,
  cells: readonly Cell[],
  accumulators: readonly Accumulator[],
  firstYear: number,
  lastYear: number,
): CloudClimGrid {
  const columns = {
    ix: [] as number[],
    iy: [] as number[],
    score: [] as number[],
    p25: [] as number[],
    p75: [] as number[],
    clear: [] as number[],
    cloudy: [] as number[],
    low: [] as number[],
    mid: [] as number[],
    high: [] as number[],
    total: [] as number[],
    years: [] as number[],
    samples: [] as number[],
  };

  let dropped = 0;

  for (let i = 0; i < cells.length; i++) {
    const acc = accumulators[i];
    /*
     * Una cel·la sense prou anys NO es publica. Dues raons, i cap és
     * defensiva:
     *
     *  - Amb zero mostres, publicar-la voldria dir posar-hi un zero, i un zero
     *    es pinta vermell i diu «aquí sempre està tapat», que és exactament
     *    l'oposat de «no en sé res». El que no se sap no es pinta.
     *  - Amb poques, el llindar és el MATEIX que fa servir `buildClimatology`
     *    per negar-se a fer una climatologia d'un punt (`CLIMATOLOGY_MIN_YEARS`).
     *    Seria estrany que la fitxa d'un lloc digués «no hi ha prou anys d'arxiu
     *    en aquest punt» mentre la cel·la que hi ha a sota, al mapa, en pintés
     *    una xifra tan tranquil·lament.
     */
    if (acc.samples === 0 || acc.years < CLIMATOLOGY_MIN_YEARS) {
      dropped++;
      continue;
    }

    // La mateixa mitjana de mitjanes que fa `buildClimatology`: es puntua cada
    // hora i es promitgen les puntuacions, no es puntua la nuvolositat mitjana.
    let sum = 0;
    for (let score = 0; score <= 100; score++) sum += score * acc.histogram[score];
    const mean = sum / acc.samples;

    columns.ix.push(cells[i].ix);
    columns.iy.push(cells[i].iy);
    columns.score.push(Math.round(mean));
    columns.p25.push(Math.round(percentileFromHistogram(acc.histogram, 0.25)));
    columns.p75.push(Math.round(percentileFromHistogram(acc.histogram, 0.75)));
    columns.clear.push(Math.round((100 * acc.clear) / acc.samples));
    columns.cloudy.push(Math.round((100 * acc.cloudy) / acc.samples));
    columns.low.push(Math.round(acc.low / acc.samples));
    columns.mid.push(Math.round(acc.mid / acc.samples));
    columns.high.push(Math.round(acc.high / acc.samples));
    columns.total.push(Math.round(acc.total / acc.samples));
    columns.years.push(acc.years);
    columns.samples.push(acc.samples);
  }

  if (dropped > 0) {
    process.stdout.write(
      `  ${dropped} cel·les amb menys de ${CLIMATOLOGY_MIN_YEARS} anys: no es publiquen\n`,
    );
  }

  const targets = cells.map((c) => c.targetMs);

  /*
   * QUANTS ANYS PORTA CADA CEL·LA, dit tal com és i no com voldríem.
   *
   * Amb la graella sencera totes en porten els mateixos i la frase és curta.
   * Amb una generació aturada a mig any —el sostre horari d'Open-Meteo hi
   * arriba— unes quantes cel·les en tenen una de més que la resta, i llavors
   * dir «13 anys» seria mentir a les que en porten 12 i dir «12» seria
   * amagar feina feta. Es diu el ventall, i la columna `years` el detalla
   * cel·la a cel·la per a qui hi vulgui mirar de prop.
   */
  const minYears = Math.min(...columns.years);
  const maxYears = Math.max(...columns.years);
  const yearsSaid = minYears === maxYears ? `${minYears} anys` : `${minYears}-${maxYears} anys`;

  return {
    format: CLIM_GRID_FORMAT,
    eclipseId,
    scoringVersion: SCORING_VERSION,
    builtAtMs: Date.now(),
    // El nombre d'anys va escrit a la frase i no només implícit al rang: un
    // 2011-2025 amb un any buit pel mig es llegiria com quinze anys, i qui
    // compari aquesta xifra amb una altra font ha de saber sobre quantes n'és.
    source:
      `Arxiu d’Open-Meteo (reanàlisi, ~0,07° a l’origen), ${yearsSaid} ` +
      `dins de ${firstYear}-${lastYear}, finestra de ±${CLIMATOLOGY_WINDOW_DAYS} dies al ` +
      `voltant del màxim local, mostrejat al centre de cel·les de ${STEP_DEG}°`,
    attribution: `${OPEN_METEO_ATTRIBUTION.ca} · ${ESPENAK_ATTRIBUTION}`,
    firstYear,
    lastYear,
    windowDays: CLIMATOLOGY_WINDOW_DAYS,
    stepDeg: STEP_DEG,
    firstTargetMs: Math.min(...targets),
    lastTargetMs: Math.max(...targets),
    cells: columns,
  };
}

const num = new Intl.NumberFormat('ca-ES');
const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/* -------------------------------------------------------------------- crida */

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const eclipseId = args.find((a) => !a.startsWith('--')) ?? '2026-08-12';
  const dryRun = args.includes('--dry-run');
  const fresh = args.includes('--fresh');
  const batchSize = Number(
    args.find((a) => a.startsWith('--batch='))?.slice(8) ?? DEFAULT_BATCH,
  );
  const concurrency = Number(
    args.find((a) => a.startsWith('--concurrency='))?.slice(14) ?? DEFAULT_CONCURRENCY,
  );

  const area = AREAS[eclipseId];
  if (!area) {
    throw new Error(
      `No hi ha finestra definida per a ${eclipseId}. Tria un de: ${Object.keys(AREAS).join(', ')}`,
    );
  }
  // Peta aquí i no més tard si l'identificador no és del catàleg.
  getEclipse(eclipseId);

  const started = Date.now();
  process.stdout.write(`\nCLIMATOLOGIA DE NUVOLOSITAT — eclipsi ${eclipseId}\n`);
  process.stdout.write('  calculant la franja…\n');

  const path = computeEclipsePath(eclipseId);
  const cells = buildCells(eclipseId, path, area);

  const targetDate = new Date(cells[Math.floor(cells.length / 2)].targetMs);
  const month = targetDate.getUTCMonth();
  const day = targetDate.getUTCDate();

  /*
   * La finestra de ±5 dies es demana UNA vegada per any i per lot, centrada en
   * aquesta data. Per als tres eclipsis del catàleg totes les cel·les cauen el
   * mateix dia UTC, però això és una propietat d'aquests tres i no una llei:
   * un eclipsi que passés a tocar de mitjanit partiria la graella en dues dates
   * i la meitat de les cel·les es mirarien una finestra desplaçada un dia
   * sencer sense que res ho digués. Val més parar aquí.
   */
  for (const cell of cells) {
    const d = new Date(cell.targetMs);
    if (d.getUTCMonth() !== month || d.getUTCDate() !== day) {
      throw new Error(
        `La cel·la ${cell.ix},${cell.iy} té el màxim el ` +
          `${d.toISOString().slice(0, 10)} i la resta el ` +
          `${targetDate.toISOString().slice(0, 10)}: aquesta franja creua la ` +
          'mitjanit UTC i la finestra d’arxiu s’ha de partir per data.',
      );
    }
  }

  // Últim any complet de l'arxiu, amb el mateix retard d'ERA5 que outlook.ts.
  const limitMs = Date.now() - ARCHIVE_LAG_DAYS * DAY_MS;
  let lastYear = new Date(limitMs).getUTCFullYear();
  if (Date.UTC(lastYear, month, day + CLIMATOLOGY_WINDOW_DAYS) > limitMs) lastYear -= 1;
  const firstYear = lastYear - CLIMATOLOGY_YEARS + 1;

  const batches: Cell[][] = [];
  for (let i = 0; i < cells.length; i += batchSize) {
    batches.push(cells.slice(i, i + batchSize));
  }
  const requests = batches.length * CLIMATOLOGY_YEARS;
  const windowDays = 2 * CLIMATOLOGY_WINDOW_DAYS + 1;
  const totalWeight = requests * callWeight(batchSize, windowDays, ARCHIVE_HOURLY.length);

  process.stdout.write(
    `  ${num.format(cells.length)} cel·les de ${STEP_DEG}° dins de la franja + ${BUFFER_KM} km\n`,
  );
  process.stdout.write(
    `  anys ${firstYear}-${lastYear} · finestra ±${CLIMATOLOGY_WINDOW_DAYS} dies · ` +
      `${num.format(cells.length * CLIMATOLOGY_YEARS)} punt-any\n`,
  );
  process.stdout.write(
    `  ${num.format(batches.length)} lots de ${batchSize} → ${num.format(requests)} peticions ` +
      `(punt a punt en serien ${num.format(cells.length * CLIMATOLOGY_YEARS)})\n`,
  );
  process.stdout.write(
    `  cost estimat ${num.format(Math.round(totalWeight))} crides d’API · ` +
      `sostres ${BUDGET_PER_MINUTE}/min i ${num.format(BUDGET_PER_HOUR)}/h → ` +
      `mínim ${(totalWeight / BUDGET_PER_HOUR).toFixed(1)} h\n`,
  );

  if (dryRun) {
    process.stdout.write('\n  --dry-run: no es toca la xarxa.\n\n');
    return;
  }

  let accumulators = cells.map(() => emptyAccumulator());

  if (!fresh) {
    const saved = readCheckpoint(eclipseId, cells);
    if (saved) {
      accumulators = saved.accumulators;
      gate.restore(saved.rate);
      const recent = gate
        .snapshot()
        .filter((s) => s.atMs >= Date.now() - 3_600_000)
        .reduce((sum, s) => sum + s.weight, 0);
      process.stdout.write(
        `  punt de control: ${num.format(saved.reused)} cel·les recuperades` +
          (saved.fresh > 0 ? `, ${num.format(saved.fresh)} de noves` : '') +
          (saved.forgotten > 0 ? `, ${num.format(saved.forgotten)} ja fora de la franja` : '') +
          ` · queden ${num.format(pendingCellYears(accumulators, firstYear, lastYear))} punt-any · ` +
          `${num.format(Math.round(recent))} crides gastades l’última hora\n`,
      );
    }
  }

  const snapshot = (): void => {
    writeCheckpoint({
      eclipseId,
      scoringVersion: SCORING_VERSION,
      stepDeg: STEP_DEG,
      bufferKm: BUFFER_KM,
      cells: cells.map((c) => [c.ix, c.iy]),
      accumulators,
      rate: gate.snapshot(),
    });
  };

  for (let year = firstYear; year <= lastYear; year++) {
    /*
     * Un lot es demana si li falta aquest any a ALGUNA de les seves cel·les.
     * Les que ja el tenen el rebran igualment dins de la resposta i no
     * l'integraran: la porta és `folded`, cel·la a cel·la, i no el fet d'haver
     * demanat el lot. Amb una graella acabada de migrar això vol dir baixar
     * alguna cel·la de més —el lot és indivisible— però mai comptar-la dues
     * vegades, que és l'error que sí que seria invisible.
     */
    const pending = batches
      .map((batch, index) => ({ batch, key: `${year}:${index}` }))
      .filter((job) => job.batch.some((c) => !accumulators[c.index].folded.includes(year)));
    if (pending.length === 0) continue;

    const yearStarted = Date.now();
    let lost = 0;
    let sinceSnapshot = 0;

    await runWithLimit(pending, concurrency, async (job) => {
      if (dailyExhausted) return;
      let responses: PointResponse[];
      try {
        responses = await fetchArchiveBatch(
          job.batch.map((c) => ({ lat: c.lat, lon: c.lon })),
          Date.UTC(year, month, day - CLIMATOLOGY_WINDOW_DAYS),
          Date.UTC(year, month, day + CLIMATOLOGY_WINDOW_DAYS),
        );
      } catch (error) {
        // Res no es marca: la propera execució tornarà a demanar el que falti.
        // Donar l'any per bo amb un forat a dins seria publicar una cel·la amb
        // menys anys dels que diu tenir, i això no ho veuria mai ningú.
        lost++;
        process.stdout.write(`    lot ${job.key} perdut (${String(error)})\n`);
        return;
      }

      // La integració i la marca passen dins del mateix bloc síncron a posta:
      // quan el punt de control es desa, el que hi ha a l'acumulador i el que
      // diu `folded` descriuen exactament la mateixa feina.
      for (let i = 0; i < job.batch.length; i++) {
        const cell = job.batch[i];
        const accumulator = accumulators[cell.index];
        if (accumulator.folded.includes(year)) continue;
        const target = new Date(cell.targetMs);
        const targetHour = target.getUTCHours() + target.getUTCMinutes() / 60;
        if (foldYear(accumulator, responses[i].hourly, targetHour)) accumulator.years++;
        accumulator.folded.push(year);
      }
      // Cada cinc lots i no cada deu: el punt de control també guarda la quota
      // gastada, i si arriba endarrerit, l'execució següent creu tenir més
      // marge del que li queda i xoca amb el límit a la primera petició.
      if (++sinceSnapshot >= 5) {
        sinceSnapshot = 0;
        snapshot();
      }
    });

    snapshot();
    process.stdout.write(
      `  ${year} · ${((Date.now() - yearStarted) / 1000).toFixed(0)} s · ` +
        `${num.format(network.requests)} peticions · ${num.format(Math.round(network.weight))} crides · ` +
        mb(network.bytes) +
        (lost > 0 ? ` · ${lost} lots perduts` : '') +
        '\n',
    );

    if (dailyExhausted) break;
  }

  // El que falta es compta en PUNT-ANY i no en lots: ara que el progrés viu a
  // la cel·la, el lot ja no és una unitat de feina sinó de transport.
  const totalCellYears = cells.length * CLIMATOLOGY_YEARS;
  const missing = pendingCellYears(accumulators, firstYear, lastYear);

  if (dailyExhausted) {
    snapshot();
    process.stdout.write(
      `\nSOSTRE DIARI D’OPEN-METEO ESGOTAT.\n` +
        `  Queden ${num.format(missing)} punt-any de ${num.format(totalCellYears)}, ` +
        'i el que s’ha baixat és al punt de control.\n' +
        '  No és cap error: el pla gratuït en deixa 10.000 al dia i aquesta graella\n' +
        '  en val unes 8.500. Demà, la mateixa ordre continua per on anava:\n' +
        `      npx tsx scripts/build-cloud-clim.ts ${eclipseId}\n\n`,
    );
    process.exitCode = 1;
    return;
  }

  if (missing > 0 && !args.includes('--partial')) {
    process.stdout.write(
      `\nFALTEN ${num.format(missing)} PUNT-ANY de ${num.format(totalCellYears)}.\n` +
        '  NO s’escriu el JSON. Una climatologia a mitges publicada com a definitiva\n' +
        '  seria una xifra amb menys anys dels que sembla i ningú no ho notaria.\n' +
        `  Torna-hi (el punt de control ho recorda):  npx tsx scripts/build-cloud-clim.ts ${eclipseId}\n` +
        '  O força-ho amb --partial si saps què estàs publicant.\n\n',
    );
    process.exitCode = 1;
    return;
  }

  /*
   * El rang que s'ESCRIU al fitxer és el dels anys que de debò s'han integrat,
   * no el que s'havia demanat. Amb la graella sencera les dues coses
   * coincideixen; amb `--partial` no, i llavors el fitxer ha de dir la veritat
   * pel seu compte, perquè ningú no llegirà aquesta consola d'aquí a sis mesos.
   */
  const span = foldedSpan(accumulators);
  if (span.count !== CLIMATOLOGY_YEARS) {
    process.stdout.write(
      `\n  ATENCIÓ: la sèrie té ${span.count} anys (${span.first}-${span.last}) i no ` +
        `${CLIMATOLOGY_YEARS}. El fitxer ho dirà: no es publica com una climatologia sencera.\n`,
    );
  }

  const grid = buildGrid(eclipseId, cells, accumulators, span.first, span.last);
  // Es valida amb el MATEIX lector que farà servir l'app: si el que escrivim
  // aquí no passa la validació d'allà, val més saber-ho ara que al navegador.
  parseCloudClimGrid(JSON.parse(JSON.stringify(grid)));

  const here = dirname(fileURLToPath(import.meta.url));
  const target = resolve(here, `../public/data/${climGridFileName(eclipseId)}`);
  mkdirSync(dirname(target), { recursive: true });
  const json = JSON.stringify(grid);
  writeFileSync(target, `${json}\n`, 'utf8');

  const scores = grid.cells.score;
  const best = Math.max(...scores);
  const worst = Math.min(...scores);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

  const worstYears = Math.min(...grid.cells.years);

  process.stdout.write('\nCOST REAL\n');
  process.stdout.write(`  peticions            ${num.format(network.requests)}\n`);
  process.stdout.write(
    `  crides d’API         ${num.format(Math.round(network.weight))} (estimades)\n`,
  );
  process.stdout.write(`  reintents            ${num.format(network.retries)}\n`);
  process.stdout.write(`  xarxa                ${mb(network.bytes)}\n`);
  process.stdout.write(
    `  temps                ${((Date.now() - started) / 1000 / 60).toFixed(1)} min\n`,
  );
  process.stdout.write('\nRESULTAT\n');
  process.stdout.write(`  fitxer               ${target}\n`);
  process.stdout.write(`  pes                  ${(json.length / 1024).toFixed(0)} kB\n`);
  process.stdout.write(`  cel·les publicades   ${num.format(scores.length)}\n`);
  process.stdout.write(
    `  anys per cel·la      mínim ${worstYears} de ${CLIMATOLOGY_YEARS}\n`,
  );
  process.stdout.write(
    `  puntuació            mitjana ${mean.toFixed(1)} · millor ${best} · pitjor ${worst}\n\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
