/**
 * El mapa de calor de visibilitat: quants segons de fase central sobreviuen al
 * relleu, cel·la a cel·la.
 *
 * El motor ja hi és sencer (`core/heat/grid.ts`, `compute.ts`, `cache.ts` i
 * `workers/heat.worker.ts`). Aquí només es pinta el que aquell torna. Aquest
 * fitxer no calcula ni un segon.
 *
 * ── LA RAMPA DE COLOR, QUE ÉS UNA DECISIÓ DE PRODUCTE ───────────────────────
 *
 * De FOSC TRANSPARENT (zero segons) a `statusClear` (verd) al capdamunt. Tres
 * coses que la decideixen, i cap és estètica:
 *
 *  1. VERMELL NO. En aquesta app el vermell és `statusDanger` i vol dir UNA
 *     cosa: seguretat ocular. Un mapa que pinti de vermell «aquí veuràs pocs
 *     segons» ensenya a llegir el vermell com «lloc dolent», i el dia que el
 *     vermell aparegui volent dir «no et treguis el filtre» ja no el llegirà
 *     ningú. El color de la comporta no es gasta en cap altra cosa.
 *  2. AMBRE TAMPOC. Al mapa l'ambre és de la FRANJA i prou (vegeu
 *     `hillshade.ts` i `viewCone.ts`, que van fer la mateixa renúncia). Un
 *     mapa de calor càlid tindria 800 cel·les competint amb l'única vora que
 *     ha de manar.
 *  3. I NI TAN SOLS EL VERMELL-BLAU. La rampa vermell→blau és la de la
 *     competència i, a més de cremada, és DIVERGENT: dona la sensació que hi
 *     ha dos extrems dolents i un centre bo. Aquí la magnitud és d'un sol
 *     sentit —més segons és millor, sempre— i el que li correspon és una rampa
 *     SEQÜENCIAL d'un sol to que creix. D'aquí que el camí sigui
 *     fosc → `statusCloudy` (el gris blavós de «cel tapat», que ja vol dir «no
 *     comptis amb res») → `statusClear`, que és el verd que en tota l'app vol
 *     dir «això es veu».
 *
 * Cap color escrit a mà: tots surten de `readPalette()` per paràmetre i passen
 * per `withAlpha()`. La paleta arriba d'ARGUMENT i no es llegeix aquí dins,
 * com a totes les capes d'aquest mapa: així es pot provar amb una paleta
 * sintètica i el mòdul no depèn del document.
 *
 * ── L'ESTIMACIÓ NO ES VESTEIX DE MESURA ─────────────────────────────────────
 *
 * Una cel·la pot arribar dues vegades: primer amb `detail: 'theory'` (només
 * efemèrides, cap muntanya mirada) i després amb `detail: 'sieve'` (el terreny
 * ha dit la seva). Les dues es pinten, perquè el mapa ha de començar a existir
 * de seguida, però NO es poden pintar igual: la teòrica va al 45 % de
 * l'opacitat de la mesurada. El mapa arrenca esvaït i es va assentant a mesura
 * que el relleu contesta, que és exactament el que està passant.
 *
 * I una mesura amb mig terreny buit tampoc és una mesura: una cel·la de
 * garbell amb `coverage` per sota de `MIN_TRUSTED_COVERAGE` es pinta com a
 * estimació encara que porti l'etiqueta de mesurada. La `coverage` la publica
 * `compute.ts` justament per a això.
 *
 * PER QUÈ OPACITAT I NO TRAMAT. El tramat de MapLibre és `fill-pattern`, i
 * `fill-pattern` vol una imatge a l'sprite de l'estil: caldria embarcar un PNG
 * i registrar-lo abans de poder pintar res. A sobre, a zoom 11 la cel·la fa
 * ~900 m, que en pantalla són poques desenes de píxels: un tramat més petit
 * que la cel·la no es llegeix com a tramat, es llegeix com a soroll.
 *
 * ── EL ZERO NO ÉS TRANSPARENT DEL TOT, I ÉS A POSTA ─────────────────────────
 *
 * Una cel·la DINS de la franja amb zero segons visibles és informació cara i
 * dura: «aquí la muntanya se'ls menja tots». Si es pintés invisible, aquella
 * cel·la es confondria amb el mapa sense calcular. Es pinta amb el fosc de
 * `bgInset` a mitja opacitat: no crida, però hi és.
 *
 * ── ERRORS QUE JA HAN PASSAT EN AQUEST MAPA I QUE AQUÍ NO ES REPETEIXEN ─────
 *
 *  · UNA CAPA AFEGIDA DUES VEGADES PETA LA PILA DE DIBUIX. `applyHeatmap` és
 *    IDEMPOTENT i es pot cridar a cada render, com `ensureHillshade` i
 *    `applyViewCone`: crea font i capa el primer cop i després només reescriu
 *    dades i pintura. Amb React en `StrictMode` el component es munta dues
 *    vegades i sense això el mapa es queda sense capa i sense error a la
 *    consola.
 *  · L'ORDRE DE LES CAPES NO ES POT DEIXAR A L'ATZAR. El farciment va SOTA la
 *    vora ambre de la franja (`beforeId: 'band-edge'`): 800 cel·les de color
 *    per damunt del límit de centralitat taparien l'única línia que respon la
 *    pregunta del producte.
 *  · LES COSTURES ENTRE CEL·LES VEÏNES. Les cel·les són tessel·les exactes i
 *    comparteixen aresta; amb l'antialiàsing de MapLibre, cada aresta compartida
 *    dibuixa dues vores mig transparents i el mapa surt amb una reixa clara al
 *    damunt. `fill-antialias: false` la treu.
 */

import type { FeatureCollection } from 'geojson';
import type {
  ExpressionSpecification,
  GeoJSONSource,
  MapLibreMap,
} from 'maplibre-gl';
import type { HeatCellValue } from '../../../core/heat/compute';
import { withAlpha, type Palette } from '../../../styles/palette';

const HEAT_SOURCE = 'visibility-heat';
export const HEAT_FILL_LAYER = 'visibility-heat-fill';

/**
 * Fracció de mostres del terreny amb dades per sota de la qual una cel·la de
 * garbell es dibuixa com a estimació.
 *
 * La meitat: amb menys terreny que buit, el «millor punt» de la cel·la pot ser
 * un forat del model i no un cim. `compute.ts` ja és optimista dins de la
 * cel·la a posta (un fals negatiu no el recupera ningú); el que no pot fer el
 * mapa és presentar aquell optimisme amb la mateixa tinta que una mesura amb
 * el terreny sencer.
 */
export const MIN_TRUSTED_COVERAGE = 0.5;

/**
 * Quant s'esvaeix una cel·la que només és estimació.
 *
 * Prou per veure-la a la primera passada del dit, prou poc perquè al costat
 * d'una de mesurada es noti quina és quina sense haver de llegir cap llegenda.
 */
export const ESTIMATE_OPACITY_FACTOR = 0.45;

/**
 * La rampa, en fraccions del sostre de segons.
 *
 * Les parades no són equidistants: els primers segons són els que canvien la
 * decisió («no res» contra «alguna cosa») i per això el gris entra aviat; del
 * mig cap amunt la diferència entre 70 i 90 segons no fa moure ningú de lloc i
 * el que ha de créixer és la intensitat, no el to.
 */
export function heatRampStops(palette: Palette): { at: number; color: string }[] {
  return [
    { at: 0, color: withAlpha(palette.bgInset, 0.5) },
    { at: 0.12, color: withAlpha(palette.statusCloudy, 0.34) },
    { at: 0.62, color: withAlpha(palette.statusClear, 0.4) },
    { at: 1, color: withAlpha(palette.statusClear, 0.68) },
  ];
}

/**
 * La rampa com a gradient de CSS, per a la pastilla de la llegenda.
 *
 * Existeix perquè la pantalla no hagi de repetir cap color: la llegenda i el
 * mapa han de sortir literalment de la mateixa taula, o el dia que es calibri
 * la rampa la llegenda quedarà mentint sense que ho vegi ningú.
 */
export function heatLegendGradient(palette: Palette): string {
  const stops = heatRampStops(palette)
    .map((stop) => `${stop.color} ${Math.round(stop.at * 100)}%`)
    .join(', ');
  return `linear-gradient(90deg, ${stops})`;
}

/** Pas del sostre de la rampa, en segons. */
const CEILING_STEP_SEC = 30;

/**
 * El sostre de la rampa: quants segons pinten el verd ple.
 *
 * ES CALCULA DE LES DADES I NO DEL CATÀLEG perquè el catàleg no en té —i és una
 * regla seva, no un descuit: `core/eclipses/catalog.ts` només guarda el context
 * global i tot el que és local es calcula. La durada màxima de l'eclipsi al
 * desert egipci tampoc no serviria de sostre per a un mapa de Galícia: deixaria
 * tota la Península a mig camí de la rampa i el mapa no distingiria res.
 *
 * DUES PROPIETATS QUE NO SÓN NEGOCIABLES:
 *
 *  · ÉS ESCALONAT (30 s). Sense això, cada cel·la nova moguda mig segon
 *    repintaria el mapa sencer amb uns altres colors i dues captures de pantalla
 *    del mateix lloc no es podrien comparar.
 *  · NOMÉS PUJA (`previous`). Movent-se per la franja el sostre podria pujar i
 *    baixar a cada passada, i el mateix tros de territori canviaria de color
 *    segons per on hi haguessis arribat. Qui el reinicia és el canvi d'eclipsi,
 *    i això ho decideix qui crida.
 *
 * Es mira la durada TEÒRICA i no la visible: el sostre és «quant hi ha per
 * guanyar en aquest tros de franja», i el relleu no pot moure aquesta escala.
 */
export function rampCeilingSec(
  cells: readonly HeatCellValue[],
  previous = 0,
): number {
  let peak = 0;
  for (const cell of cells) {
    if (Number.isFinite(cell.theoreticalSec) && cell.theoreticalSec > peak) {
      peak = cell.theoreticalSec;
    }
  }
  const stepped = Math.ceil(peak / CEILING_STEP_SEC) * CEILING_STEP_SEC;
  // El mínim d'un pas evita una divisió per zero a la rampa quan encara no ha
  // arribat cap cel·la amb fase central.
  return Math.max(CEILING_STEP_SEC, stepped, previous);
}

/**
 * Els segons que pinten una cel·la i si el número és una estimació.
 *
 * `visibleSec` a zero amb `detail: 'theory'` NO és cap estimació: vol dir que
 * en aquell punt no hi ha fase central per perdre, i això ho diuen les
 * efemèrides soles sense mirar cap muntanya (vegeu `compute.ts`). Confondre-ho
 * amb «encara no ho sabem» esvairia mitja franja de fora endins per no res.
 */
export function heatCellPaint(cell: HeatCellValue): {
  sec: number;
  estimate: boolean;
} {
  const sec = cell.visibleSec ?? cell.theoreticalSec;
  const estimate =
    cell.detail === 'sieve'
      ? cell.coverage < MIN_TRUSTED_COVERAGE
      : cell.visibleSec === null;
  return { sec: Number.isFinite(sec) ? sec : 0, estimate };
}

const emptyFeatureCollection: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

/**
 * Les cel·les com a GeoJSON.
 *
 * Les que arriben sense polígon es descarten en silenci: la memòria cau desa
 * números i no geometria (vegeu `cache.ts`), i qui les ressuscita hi ha de
 * tornar a enganxar l'anell de la graella d'ara. Una cel·la sense anell no és
 * un error, és una cel·la que encara no es pot dibuixar.
 */
export function heatCellsToGeoJson(cells: readonly HeatCellValue[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cells
      .filter((cell) => cell.poly.length >= 4)
      .map((cell) => {
        const { sec, estimate } = heatCellPaint(cell);
        return {
          type: 'Feature' as const,
          id: cell.id,
          properties: { sec, estimate },
          geometry: { type: 'Polygon' as const, coordinates: [cell.poly] },
        };
      }),
  };
}

/**
 * L'expressió de color de MapLibre per a un sostre donat.
 *
 * `to-number` no és paranoia: `get` torna un valor sense tipus i `interpolate`
 * en vol un de numèric. Sense l'assercció, un estil que en altres versions es
 * carrega perfectament peta amb «Expected number but found value» i el mapa es
 * queda sense la capa sencera.
 */
function fillColorExpression(palette: Palette, maxSec: number): ExpressionSpecification {
  const ceiling = Math.max(1, maxSec);
  const expression: (string | number | unknown[])[] = [
    'interpolate',
    ['linear'],
    ['to-number', ['get', 'sec']],
  ];
  for (const stop of heatRampStops(palette)) {
    // A la dècima de segon: `0.12 * 120` en coma flotant és
    // 14,399999999999999, i una expressió d'estil plena de cues d'aquestes és
    // impossible de llegir quan un dia s'hagi de depurar amb l'inspector.
    expression.push(Math.round(stop.at * ceiling * 10) / 10, stop.color);
  }
  // Les expressions de MapLibre són tuples variàdiques i el nombre de parades
  // el decideix la taula de la rampa: cap tipus no pot comprovar això, i
  // fingir que sí amb un tipus escrit a mà seria pitjor que dir-ho aquí.
  return expression as unknown as ExpressionSpecification;
}

/** L'opacitat, que és on es distingeix l'estimació de la mesura. */
const FILL_OPACITY_EXPRESSION: ExpressionSpecification = [
  'case',
  ['==', ['get', 'estimate'], true],
  ESTIMATE_OPACITY_FACTOR,
  1,
];

export interface HeatmapOptions {
  /** Segons de fase central que pinten el verd ple. De `rampCeilingSec`. */
  maxSec: number;
  /**
   * Capa sota la qual s'insereix. Ha de ser la vora ambre de la franja
   * (`'band-edge'`): el farciment del mapa de calor és dada, la vora és el
   * veredicte, i el veredicte va a sobre.
   */
  beforeId?: string;
}

/**
 * Pinta (o actualitza) el mapa de calor. Idempotent: es crida a cada render.
 *
 * Amb la llista buida no es desmunta res, es buiden les dades — igual que
 * `applyViewCone`. Així la capa apareix i desapareix seguint les passades
 * sense refer l'estil, que és el que costa car.
 */
export function applyHeatmap(
  map: MapLibreMap,
  palette: Palette,
  cells: readonly HeatCellValue[],
  options: HeatmapOptions,
): void {
  if (map.getSource(HEAT_SOURCE) === undefined) {
    map.addSource(HEAT_SOURCE, { type: 'geojson', data: emptyFeatureCollection });
  }

  if (map.getLayer(HEAT_FILL_LAYER) === undefined) {
    map.addLayer(
      {
        id: HEAT_FILL_LAYER,
        type: 'fill',
        source: HEAT_SOURCE,
        paint: {
          'fill-color': fillColorExpression(palette, options.maxSec),
          'fill-opacity': FILL_OPACITY_EXPRESSION,
          // Vegeu la capçalera: sense això, les arestes compartides entre
          // cel·les veïnes dibuixen una reixa clara sobre tot el mapa.
          'fill-antialias': false,
        },
      },
      options.beforeId,
    );
  } else {
    // El sostre de la rampa pot pujar a mig moviment (una cel·la amb més
    // durada teòrica), i llavors tot el mapa s'ha de tornar a repartir els
    // colors sense refer la capa.
    map.setPaintProperty(
      HEAT_FILL_LAYER,
      'fill-color',
      fillColorExpression(palette, options.maxSec),
    );
  }

  (map.getSource(HEAT_SOURCE) as GeoJSONSource).setData(
    cells.length === 0 ? emptyFeatureCollection : heatCellsToGeoJson(cells),
  );
}

/** Treu la capa i la font. Segur de cridar encara que no hi siguin. */
export function removeHeatmap(map: MapLibreMap): void {
  if (map.getLayer(HEAT_FILL_LAYER) !== undefined) map.removeLayer(HEAT_FILL_LAYER);
  if (map.getSource(HEAT_SOURCE) !== undefined) map.removeSource(HEAT_SOURCE);
}

/* ------------------------------------------------ la franja, amb el heatmap */

/**
 * La capa de farciment de la franja, tal com la registra `EclipseMap.tsx`.
 *
 * Es declara aquí perquè aquesta capa n'ha d'abaixar l'opacitat i un
 * identificador escrit a mà a dos fitxers és una avaria que no fa soroll: el
 * dia que canviï el nom, el farciment no s'abaixarà i ningú no sabrà per què el
 * mapa de calor es veu enfangat.
 */
export const BAND_FILL_LAYER = 'band-fill';
/** L'opacitat de sempre del farciment ambre, sense mapa de calor. */
export const BAND_FILL_OPACITY = 0.16;
/**
 * L'opacitat del farciment ambre amb el mapa de calor encès.
 *
 * NO ES TREU DEL TOT, i és la meitat de la decisió: la franja ha de continuar
 * dient on és encara que no s'hagi calculat cap cel·la, i el mapa de calor no
 * arriba a la vora (es retalla a la franja amb 10 km de marge, vegeu
 * `grid.ts`). El que sí que passa és que 0,16 d'ambre per sota de 800 cel·les
 * verdoses embruta tots els colors de la rampa i la fa il·legible: amb 0,06 la
 * franja segueix insinuada i qui mana és la VORA ambre, que no es toca.
 */
export const BAND_FILL_OPACITY_UNDER_HEAT = 0.06;

/**
 * Abaixa (o restitueix) el farciment ambre de la franja.
 *
 * Segur de cridar sempre: si la capa encara no hi és —l'estil no ha carregat,
 * o el mapa s'està desmuntant— no fa res.
 */
export function setBandFillForHeatmap(
  map: MapLibreMap,
  heatmapOn: boolean,
  layerId: string = BAND_FILL_LAYER,
): void {
  if (map.getLayer(layerId) === undefined) return;
  map.setPaintProperty(
    layerId,
    'fill-opacity',
    heatmapOn ? BAND_FILL_OPACITY_UNDER_HEAT : BAND_FILL_OPACITY,
  );
}
