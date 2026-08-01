import { formatObscurationPercent } from '../core/astro/obscuration';
import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  SegmentedControl,
  Stat,
  VisibilityMeter,
  type Tone,
} from '../ui';
import { EclipseMap } from '../features/map/EclipseMap';
import { useCloudOutlook } from '../features/weather';
import {
  bearingToCardinal,
  computeDurationGradient,
  type DurationGradient,
} from '../core/astro/gradient';
import { computeLocalCircumstances } from '../core/astro/contacts';
import type {
  EclipseSample,
  GeoLocation,
  LocalCircumstances,
} from '../core/astro/types';
import type { EclipseContext } from './context';
import { computeUncertainty, type BandLimitDistance } from '../core/astro/uncertainty';
import { computeShadowMotion, type ShadowMotion } from '../core/astro/shadow';
import {
  approxDistanceKm,
  computeEclipsePath,
  type PathPoint,
} from '../core/eclipses/path';
import { EphemerisTable } from './EphemerisTable';
import type { Locale } from '../i18n';
import { s, type StringKey } from './strings';
import {
  formatAge,
  formatClock,
  formatDecimal,
  formatDegrees,
  formatDuration,
  NO_DATA,
} from './format';
import './screens.css';

export interface MapScreenProps extends EclipseContext {
  /**
   * Recalcula-ho tot des d'unes coordenades. Rep només lat/lon: la cota l'ha
   * de resoldre contra el model del terreny qui té l'estat de l'observador,
   * perquè és una operació de xarxa.
   *
   * NOMÉS LA CRIDA EL BOTÓ «Fes-ne el teu punt», mai el clic directe: vegeu el
   * comentari del gest de tocar el mapa, dins del component.
   */
  onPickLocation: (lat: number, lon: number) => void;
}

/** Què respon la fitxa de sota del mapa. */
type View = 'band' | 'clouds' | 'move';

/*
 * Textos NOUS d'aquesta pantalla, en taula local i no a `strings.ts`: aquell
 * fitxer el toquen altres feines en paral·lel, i el patró del projecte per a
 * aquest cas és el de `CountdownView` — taules `{ ca, es }` al costat del
 * component. El dia que es consolidi l'i18n s'aboquen a `strings.ts` tal qual.
 */
const LOCAL = {
  pickedOverline: { ca: 'Punt tocat al mapa', es: 'Punto tocado en el mapa' },
  makeMine: { ca: 'Fes-ne el teu punt', es: 'Conviértelo en tu punto' },
  backToMine: { ca: 'Torna al teu punt', es: 'Vuelve a tu punto' },
  toCenter: { ca: 'A la línia central', es: 'A la línea central' },
  vsYours: { ca: 'Respecte del teu punt', es: 'Respecto a tu punto' },
  distance: { ca: 'Distància', es: 'Distancia' },
  centralPhase: { ca: 'Fase central', es: 'Fase central' },
  pickNote: {
    ca: 'Toca qualsevol punt del mapa i veuràs l’eclipsi des d’allà sense perdre el teu punt.',
    es: 'Toca cualquier punto del mapa y verás el eclipse desde allí sin perder tu punto.',
  },
} as const;

type LocalKey = keyof typeof LOCAL;

const tl = (key: LocalKey, locale: Locale): string => LOCAL[key][locale];

/**
 * La línia central de l'eclipsi, guardada a nivell de mòdul.
 *
 * `computeEclipsePath` val ~30 ms. `EclipseMap` calcula la seva per dibuixar;
 * aquí només en cal la polilínia per mesurar-hi distàncies, i només a partir
 * del primer toc al mapa. No és un `useMemo` a posta: el mòdul sobreviu al
 * component, i canviar de pestanya i tornar no repeteix el càlcul.
 */
let centerLineCache: { eclipseId: string; center: PathPoint[] } | null = null;

function centerLineFor(eclipseId: string): PathPoint[] {
  if (centerLineCache === null || centerLineCache.eclipseId !== eclipseId) {
    centerLineCache = { eclipseId, center: computeEclipsePath(eclipseId).center };
  }
  return centerLineCache.center;
}

const KM_PER_DEG_LAT = 111.32;
const DEG = Math.PI / 180;

/**
 * Distància mínima del punt a la línia central DIBUIXADA, en km.
 *
 * És geometria sobre la polilínia del mapa i no una derivada del marge umbral
 * a posta: el número ha de coincidir amb la línia que l'usuari té davant, i la
 * linealització marge/gradient es queda curta lluny del límit (vegeu el
 * comentari de precisió de `BandLimitDistance.km`). Equirectangular local al
 * punt amb projecció sobre cada segment: la línia és suau i els segments fan
 * ~60 km, o sigui que prop del mínim —que és l'únic tram que decideix res—
 * l'error és de metres.
 *
 * Hauria de viure a `core/eclipses/path.ts` al costat d'`approxDistanceKm`;
 * aquesta feina no toca `core` i s'hi pot moure tal qual.
 */
function distanceToCenterLineKm(point: GeoLocation, line: PathPoint[]): number | null {
  if (line.length === 0) return null;
  const kmPerDegLon = KM_PER_DEG_LAT * Math.cos(point.lat * DEG);

  // Coordenades locals en km. La longitud del camí ve DESENROTLLADA (path.ts
  // no la redueix a ±180° per poder creuar l'antimeridià sense ratlles); la
  // diferència es normalitza perquè el punt tocat sí que arriba normalitzat.
  const xy = line.map((q) => {
    const dLon = ((((q.lon - point.lon + 180) % 360) + 360) % 360) - 180;
    return { x: dLon * kmPerDegLon, y: (q.lat - point.lat) * KM_PER_DEG_LAT };
  });

  let best = Infinity;
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i];
    best = Math.min(best, Math.hypot(a.x, a.y));

    const b = xy[i + 1];
    if (b === undefined) continue;
    // Si la normalització ha partit el segment per l'antimeridià, projectar-hi
    // dibuixaria una corda falsa travessant mig món. Es salta, i hi queden les
    // distàncies als dos extrems, que allà són la resposta honesta.
    if (Math.abs(b.x - a.x) > 90 * kmPerDegLon) continue;

    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    if (len2 < 1e-9) continue;
    const t = -(a.x * abx + a.y * aby) / len2;
    if (t <= 0 || t >= 1) continue;
    best = Math.min(best, Math.hypot(a.x + t * abx, a.y + t * aby));
  }
  return Number.isFinite(best) ? best : null;
}

/** El que la fitxa diu del punt tocat, a banda de les circumstàncies. */
interface PickedDetail {
  limit: BandLimitDistance | null;
  shadow: ShadowMotion | null;
  toCenterKm: number | null;
}

/**
 * Pantalla "Mapa".
 *
 * QUÈ CONSERVA DE LA REFERÈNCIA (`design-reference/ui_kits/app/MapScreen.jsx`):
 * cartografia base REAL amb la franja dibuixada a sobre, un control segmentat
 * flotant i una fitxa de vidre a baix amb el veredicte del punt seleccionat.
 *
 * QUÈ CANVIA, I PER QUÈ:
 *
 *  · La referència feia servir el segmentat per commutar CAPES del mapa (ombra
 *    / núvols / durada). `EclipseMap` només dibuixa la franja i afegir-hi capes
 *    és territori de `src/features/map/`, que aquesta tasca no toca. Aquí el
 *    segmentat commuta què respon la FITXA, que és la mateixa pregunta feta
 *    des de l'altre costat: on soc, quin cel hi haurà i em convé moure'm.
 *
 *  · TOCAR EL MAPA JA NO ET MOU EL PUNT: obre la fitxa del punt tocat.
 *    Abans el clic substituïa la ubicació de l'observador a l'acte, i mirar
 *    «què hi ha a Oviedo» et costava el punt que tenies triat: comparar dos
 *    llocs volia dir recordar-ne un. Ara el punt tocat es calcula aquí mateix
 *    (síncron, ~10 ms: un worker o un estat de càrrega només hi afegirien
 *    latència percebuda) i la fitxa l'ensenya AMB la comparació contra el teu
 *    punt; el canvi de debò el fa el botó «Fes-ne el teu punt».
 *
 *  · No hi ha camp de cerca de llocs. No tenim geocodificador, i un camp que
 *    accepta un nom de poble i no en sap fer res és pitjor que no tenir-lo. El
 *    gest de triar lloc és tocar el mapa, que sí que funciona i a més funciona
 *    sense xarxa. Les xinxetes de ciutats inventades de la referència tampoc hi
 *    són per la mateixa raó: no tenim base de topònims amb coordenades.
 *
 *  · Un sol accent ambre: és la franja pintada al mapa. Per això cap element
 *    d'aquesta pantalla porta `tone="accent"` ni cap botó `solid`.
 */
export function MapScreen({
  eclipseId,
  locale,
  location,
  placeLabel,
  circumstances,
  verdict,
  horizon,
  onPickLocation,
}: MapScreenProps) {
  const [view, setView] = useState<View>('band');
  const [picked, setPicked] = useState<GeoLocation | null>(null);

  const contacts = circumstances?.contacts ?? null;
  const central = circumstances?.kind === 'total' || circumstances?.kind === 'annular';

  const clouds = useCloudOutlook({
    location,
    targetTimeMs: contacts?.max.time.getTime() ?? null,
    sunAzimuthDeg: contacts?.max.sun.azimuth ?? null,
    sunAltitudeDeg: contacts?.max.sun.altitudeApparent ?? null,
  });

  // El gradient són quatre càlculs de circumstàncies locals a un quilòmetre de
  // distància. Val unes desenes de mil·lisegons, però només es demana quan la
  // fitxa el mostra: no té sentit pagar-lo cada cop que algú toca el mapa per
  // mirar una altra cosa.
  const gradient = useMemo(
    () =>
      view === 'move' && location !== null
        ? computeDurationGradient(eclipseId, location)
        : null,
    [view, eclipseId, location],
  );

  // Les circumstàncies del punt tocat, amb cota zero: la cota real és una
  // consulta de xarxa al model del terreny i no es paga per una ullada. La
  // fitxa ho diu amb el «al nivell del mar» de la capçalera.
  const pickedCircs = useMemo(
    () => (picked === null ? null : computeLocalCircumstances(eclipseId, picked)),
    [eclipseId, picked],
  );

  const pickedDetail = useMemo<PickedDetail | null>(() => {
    if (view !== 'band' || picked === null || pickedCircs === null) return null;
    const uncertainty = computeUncertainty(eclipseId, pickedCircs, {
      locateSeaLevelLimit: false,
    });
    const shadow =
      pickedCircs.kind === 'total' || pickedCircs.kind === 'annular'
        ? computeShadowMotion(eclipseId, pickedCircs)
        : null;
    return {
      limit: uncertainty.limit,
      shadow,
      toCenterKm: distanceToCenterLineKm(picked, centerLineFor(eclipseId)),
    };
  }, [view, eclipseId, picked, pickedCircs]);

  /*
   * TOT EL QUE JA SABEM DEL PUNT DE L'USUARI, I NO ENSENYÀVEM.
   *
   * Del punt en sabem molt més del que es veia i ja ho tenim calculat: a
   * quants quilòmetres queda el límit de la franja i cap a on, i per on
   * arribarà l'ombra i a quina velocitat. És exactament el que necessita algú
   * que està decidint on va, que és per a què serveix aquesta pantalla.
   *
   * Es demana només amb la vista de la franja oberta i sense cap punt tocat
   * (la fitxa del punt tocat té el seu propi càlcul, a dalt).
   */
  const detail = useMemo(() => {
    if (view !== 'band' || circumstances === null || picked !== null) return null;
    const uncertainty = computeUncertainty(eclipseId, circumstances, {
      locateSeaLevelLimit: false,
    });
    const shadow =
      circumstances.kind === 'total' || circumstances.kind === 'annular'
        ? computeShadowMotion(eclipseId, circumstances)
        : null;
    return { limit: uncertainty.limit, shadow };
  }, [view, eclipseId, circumstances, picked]);

  const commitPicked = () => {
    if (picked === null) return;
    onPickLocation(picked.lat, picked.lon);
    // Es tanca la fitxa del punt tocat: a partir d'aquí el punt ÉS el teu i
    // qui en parla és la fitxa normal, amb el veredicte del terreny quan
    // arribi. Deixar-la oberta seria ensenyar la còpia a nivell de mar d'una
    // dada que l'app ja està millorant.
    setPicked(null);
  };

  return (
    <div className="screen screen--full screen--split screen--flush">
      <div className="screen__col screen__col--main">
        <div className="mapscreen__stage">
          <EclipseMap
            eclipseId={eclipseId}
            locale={locale}
            observer={location}
            picked={picked}
            onPickLocation={setPicked}
          />

          {/* Llegenda pròpia. La d'`EclipseMap` viu sota el llenç i aquí el
              llenç ocupa el marc sencer, així que quedaria fora de vista. */}
          <div className="mapscreen__legend">
            <span className="mapscreen__legenditem">
              <span className="mapscreen__swatch" aria-hidden="true" />
              {s('map.legend.band', locale)}
            </span>
            <span className="mapscreen__legenditem">
              <span
                className="mapscreen__swatch mapscreen__swatch--line"
                aria-hidden="true"
              />
              {s('map.legend.center', locale)}
            </span>
          </div>
        </div>
      </div>

      <div className="screen__col screen__col--side">
        <Card tone="glass" className="mapscreen__sheet">
          <SegmentedControl
            value={view}
            onChange={setView}
            label={s('map.compare', locale)}
            options={[
              { value: 'band', label: s('map.view.band', locale) },
              { value: 'clouds', label: s('map.view.clouds', locale) },
              { value: 'move', label: s('map.view.move', locale) },
            ]}
          />

          {view === 'band' && pickedCircs !== null ? (
            <PickedPanel
              circumstances={pickedCircs}
              detail={pickedDetail}
              mine={circumstances}
              locale={locale}
              onCommit={commitPicked}
              onDismiss={location === null ? null : () => setPicked(null)}
            />
          ) : circumstances === null || contacts === null ? (
            <p className="screen__note">{s('map.compareNote', locale)}</p>
          ) : view === 'band' ? (
            <>
              <div className="mapscreen__badges">
                <Badge tone={bandTone(circumstances.edgeUncertain, central)} dot>
                  {circumstances.edgeUncertain
                    ? s('map.edge', locale)
                    : central
                      ? s('map.inBand', locale)
                      : s('map.outOfBand', locale)}
                </Badge>
                <span className="screen__note">
                  {s(`kind.${circumstances.kind}` as 'kind.total', locale)}
                </span>
              </div>

              <div className="mapscreen__stats">
                <Stat
                  label={
                    verdict
                      ? s('home.visibleDuration', locale)
                      : s('home.theoreticalDuration', locale)
                  }
                  value={
                    central
                      ? formatDuration(
                          verdict ? verdict.centralVisibleSec : circumstances.centralDurationSec,
                        )
                      : NO_DATA
                  }
                />
                <Stat
                  label={s('home.obscuration', locale)}
                  // `formatObscurationPercent` i no `formatPercent`: aquest
                  // últim arrodoneix, i un 99,97 % sortia com a «100 %» just al
                  // costat del distintiu «Fora de la franja». És la xifra que
                  // decideix si algú es mou o no, i la que no pot mentir.
                  value={formatObscurationPercent(
                    verdict ? verdict.maxVisibleObscuration : contacts.max.obscuration,
                    circumstances.kind === 'total' || circumstances.kind === 'annular',
                  )}
                />
                <Stat
                  label={s('home.sunAltitude', locale)}
                  value={formatDegrees(contacts.max.sun.altitudeApparent)}
                />
              </div>

              {circumstances.edgeUncertain && (
                <p className="screen__note">{s('map.edgeNote', locale)}</p>
              )}
              {!central && <p className="screen__note">{s('map.noCentral', locale)}</p>}

              {/* Les hores dels cinc contactes, per a AQUEST punt. */}
              <div className="mapscreen__block">
                <span className="screen__overline">{s('map.contacts', locale)}</span>
                <EphemerisTable circumstances={circumstances} horizon={horizon} locale={locale} />
              </div>

              <LimitBlock limit={detail?.limit ?? null} toCenterKm={null} locale={locale} />
              <ShadowBlock shadow={detail?.shadow ?? null} locale={locale} />

              <p className="screen__note">{tl('pickNote', locale)}</p>
            </>
          ) : view === 'clouds' ? (
            <VisibilityMeter
              place={placeLabel ?? s('common.here', locale)}
              value={clouds.outlook ? clouds.outlook.score.score : null}
              state={clouds.outlook ? clouds.outlook.score.band : 'unknown'}
              caption={
                clouds.outlook
                  ? clouds.outlook.caveat
                  : clouds.loading
                    ? s('sky.cloudsLoading', locale)
                    : (clouds.error ?? s('sky.cloudsOffline', locale))
              }
              age={
                clouds.outlook
                  ? formatAge(clouds.nowMs - clouds.outlook.fetchedAtMs)
                  : undefined
              }
            />
          ) : (
            <MoveAdvice gradient={gradient} locale={locale} />
          )}

          <p className="screen__note">{s('map.attribution', locale)}</p>
        </Card>
      </div>
    </div>
  );
}

/** El to de la insígnia de franja. El caire no és ni un sí ni un no. */
function bandTone(edgeUncertain: boolean, central: boolean): Tone {
  if (edgeUncertain) return 'partial';
  return central ? 'clear' : 'cloudy';
}

/**
 * Diferència de durada amb signe: «+1 min 41 s», «−12 s», «0 s».
 * El signe és tot el consell: allà hi ha més segons que aquí, o menys.
 */
function formatSignedDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  if (rounded === 0) return '0 s';
  return `${rounded > 0 ? '+' : '−'}${formatDuration(Math.abs(rounded))}`;
}

/** Diferència d'ocultació en punts de percentatge, amb signe. */
function formatSignedPoints(points: number, locale: Locale): string {
  const rounded = Math.round(points * 10) / 10;
  if (rounded === 0) return '0 %';
  return `${rounded > 0 ? '+' : '−'}${formatDecimal(Math.abs(rounded), 1, locale)} %`;
}

/**
 * On queda el límit de la franja i, si es té, la línia central.
 * Compartit entre la fitxa del teu punt i la del punt tocat: la mateixa dada
 * s'ha de llegir igual vingui d'on vingui.
 */
function LimitBlock({
  limit,
  toCenterKm,
  locale,
}: {
  limit: BandLimitDistance | null;
  toCenterKm: number | null;
  locale: Locale;
}) {
  if (limit === null && toCenterKm === null) return null;
  return (
    <div className="mapscreen__block">
      <div className="mapscreen__stats">
        {limit !== null && (
          <Stat
            label={s('map.toLimit', locale, {
              side: s(`map.side.${limit.side}` as 'map.side.north', locale),
            })}
            value={`${formatDecimal(limit.km, 1, locale)} km`}
          />
        )}
        {toCenterKm !== null && (
          <Stat
            label={tl('toCenter', locale)}
            value={`${formatDecimal(toCenterKm, toCenterKm < 10 ? 1 : 0, locale)} km`}
          />
        )}
      </div>
      {limit !== null && (
        <p className="screen__note">
          {s('map.inwardHint', locale, {
            card: bearingToCardinal(limit.inwardBearingDeg, locale),
          })}
        </p>
      )}
    </div>
  );
}

/** Per on arriba l'ombra: el moment que més impressiona i el que gairebé ningú
    no sap cap a on mirar. */
function ShadowBlock({ shadow, locale }: { shadow: ShadowMotion | null; locale: Locale }) {
  if (shadow === null) return null;
  return (
    <div className="mapscreen__block mapscreen__block--pair">
      <Stat
        label={s('map.shadowFrom', locale)}
        value={bearingToCardinal(shadow.arrivalBearing, locale)}
      />
      <Stat
        label={s('map.shadowSpeed', locale)}
        value={`${formatDecimal(shadow.speedKmh, 0, locale)} km/h`}
      />
    </div>
  );
}

/**
 * La fitxa del punt tocat.
 *
 * És el panell que vivia dins d'`EclipseMap` i que la retallada de l'escenari
 * feia invisible, refet amb els components de la fitxa perquè el punt tocat i
 * el teu punt es llegeixin com la mateixa dada — i ampliat amb el que faltava
 * per DECIDIR: la distància a la línia central, la comparació amb el teu punt
 * i el botó que converteix la ullada en decisió.
 *
 * ELS AVISOS VAN COM A NOTA I NO COM A `.warn`: `--status-partial` és el
 * mateix hexadecimal que `--accent`, i l'únic ambre d'aquesta pantalla és la
 * franja pintada al mapa.
 */
function PickedPanel({
  circumstances,
  detail,
  mine,
  locale,
  onCommit,
  onDismiss,
}: {
  circumstances: LocalCircumstances;
  detail: PickedDetail | null;
  /** Les circumstàncies del punt de l'usuari, per comparar. */
  mine: LocalCircumstances | null;
  locale: Locale;
  onCommit: () => void;
  /** Null quan no hi ha cap punt propi on tornar. */
  onDismiss: (() => void) | null;
}) {
  const { contacts, kind, location } = circumstances;
  const central = kind === 'total' || kind === 'annular';
  const annular = kind === 'annular';

  // Les etiquetes dels contactes són les del bloc `web.*`: la mateixa fila no
  // es pot dir de dues maneres segons quin component la pinti.
  const rows: [StringKey, EclipseSample | undefined][] = [
    ['web.c1', contacts.c1],
    [annular ? 'web.c2annular' : 'web.c2total', contacts.c2],
    ['web.max', contacts.max],
    [annular ? 'web.c3annular' : 'web.c3total', contacts.c3],
    ['web.c4', contacts.c4],
  ];

  // La comparació és teòrica a banda i banda (el punt tocat no té terreny):
  // comparar la teva durada VISIBLE amb una durada de mapa seria esbiaixar el
  // consell cap a moure's. Si cap dels dos punts té fase central, la durada és
  // 0 − 0 i no diu res: llavors la diferència que decideix és l'ocultació.
  const deltaSec =
    mine === null ? null : circumstances.centralDurationSec - mine.centralDurationSec;
  const compareDuration =
    mine !== null &&
    (circumstances.centralDurationSec > 0 || mine.centralDurationSec > 0);
  const deltaObscPts =
    mine === null
      ? null
      : (contacts.max.obscuration - mine.contacts.max.obscuration) * 100;

  return (
    <>
      <div className="mapscreen__pickhead">
        <span className="screen__overline">{tl('pickedOverline', locale)}</span>
        <p className="mapscreen__coords">
          {formatDecimal(location.lat, 4, locale)}°{' '}
          {formatDecimal(location.lon, 4, locale)}° · {s('map.seaLevel', locale)}
        </p>
      </div>

      <div className="mapscreen__badges">
        <Badge tone={bandTone(circumstances.edgeUncertain, central)} dot>
          {circumstances.edgeUncertain
            ? s('map.edge', locale)
            : central
              ? s('map.inBand', locale)
              : s('map.outOfBand', locale)}
        </Badge>
        <span className="screen__note">
          {s(`kind.${kind}` as 'kind.total', locale)}
        </span>
      </div>

      {kind === 'none' ? (
        <p className="screen__note">{s('map.nothingVisible', locale)}</p>
      ) : (
        <div className="mapscreen__stats">
          <Stat
            label={s('home.theoreticalDuration', locale)}
            value={central ? formatDuration(circumstances.centralDurationSec) : NO_DATA}
          />
          <Stat
            label={s('home.obscuration', locale)}
            value={formatObscurationPercent(contacts.max.obscuration, central)}
          />
          <Stat
            label={s('home.sunAltitude', locale)}
            value={formatDegrees(contacts.max.sun.altitudeApparent, locale)}
          />
        </div>
      )}

      {circumstances.edgeUncertain && (
        <p className="screen__note">{s('map.edgeNote', locale)}</p>
      )}
      {!central && kind !== 'none' && (
        <p className="screen__note">{s('map.noCentral', locale)}</p>
      )}

      {mine !== null && (
        <div className="mapscreen__block">
          <span className="screen__overline">{tl('vsYours', locale)}</span>
          <div className="mapscreen__stats">
            <Stat
              label={tl('distance', locale)}
              value={`${formatDecimal(approxDistanceKm(location, mine.location), 0, locale)} km`}
            />
            {compareDuration && deltaSec !== null ? (
              <Stat label={tl('centralPhase', locale)} value={formatSignedDuration(deltaSec)} />
            ) : deltaObscPts !== null ? (
              <Stat
                label={s('home.obscuration', locale)}
                value={formatSignedPoints(deltaObscPts, locale)}
              />
            ) : null}
          </div>
        </div>
      )}

      {/* El botó que converteix la ullada en decisió. `secondary` i no
          `primary`: l'ambre de la pantalla és la franja. */}
      <div className="mapscreen__actions">
        <Button variant="secondary" onClick={onCommit}>
          {tl('makeMine', locale)}
        </Button>
        {onDismiss !== null && (
          <Button variant="ghost" onClick={onDismiss}>
            {tl('backToMine', locale)}
          </Button>
        )}
      </div>

      {kind !== 'none' && (
        <div className="mapscreen__block">
          <span className="screen__overline">{s('map.contacts', locale)}</span>
          {/* Taula `.contacts` i no `EphemerisTable`: aquella només es pinta a
              l'escriptori (al mòbil la substitueix `TimelineTrack`, que aquí no
              hi és), i les hores del punt tocat s'han de veure a tot arreu. */}
          <table className="contacts">
            <tbody>
              {rows.map(([key, sample]) =>
                sample ? (
                  <tr key={key}>
                    <td className="contacts__label">{s(key, locale)}</td>
                    <td className="contacts__time">{formatClock(sample.time, locale)}</td>
                    <td className="contacts__alt">
                      {formatDecimal(sample.sun.altitudeApparent, 1, locale)}°
                    </td>
                    <td className="contacts__az">
                      {formatDecimal(sample.sun.azimuth, 0, locale)}°
                    </td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
          <p className="screen__note">{s('map.contactsNote', locale)}</p>
        </div>
      )}

      <LimitBlock
        limit={detail?.limit ?? null}
        toCenterKm={detail?.toCenterKm ?? null}
        locale={locale}
      />
      <ShadowBlock shadow={detail?.shadow ?? null} locale={locale} />

      {circumstances.sunBelowHorizonDuringEvent && (
        <p className="screen__note">{s('map.sunBelowHorizon', locale)}</p>
      )}
      {central && contacts.max.sun.altitudeApparent < 10 && (
        <p className="screen__note">
          {s('map.lowSun', locale, {
            alt: formatDegrees(contacts.max.sun.altitudeApparent, locale),
          })}
        </p>
      )}
    </>
  );
}

/**
 * Val la pena moure's?
 *
 * És la pregunta que de veritat es fa qui mira un mapa d'eclipsi, i la resposta
 * canvia brutalment segons on siguis: al mig de la franja, un quilòmetre no et
 * dona ni un segon; a tres quilòmetres del límit, te'n pot donar quinze. Quan
 * el gradient és massa petit per tenir direcció, es diu que no cal moure's en
 * comptes d'inventar-se un rumb.
 */
function MoveAdvice({
  gradient,
  locale,
}: {
  gradient: DurationGradient | null;
  locale: EclipseContext['locale'];
}) {
  if (gradient === null) {
    return <p className="screen__note">{s('map.compareNote', locale)}</p>;
  }

  if (!gradient.worthMoving || gradient.bearingDeg === null) {
    return (
      <>
        <Stat
          label={s('home.theoreticalDuration', locale)}
          value={gradient.centralSec > 0 ? formatDuration(gradient.centralSec) : NO_DATA}
        />
        <p className="screen__note">{s('map.gradientFlat', locale)}</p>
      </>
    );
  }

  return (
    <>
      <div className="mapscreen__stats">
        <Stat
          label={s('home.theoreticalDuration', locale)}
          value={formatDuration(gradient.centralSec)}
        />
        <Stat
          label={s('map.view.move', locale)}
          value={`+${formatDecimal(gradient.secondsPerKm, 1, locale)}`}
          unit="s/km"
        />
      </div>
      <p className="screen__note">
        {s('map.gradientMove', locale, {
          dir: bearingToCardinal(gradient.bearingDeg, locale),
          rate: formatDecimal(gradient.secondsPerKm, 1, locale),
        })}
      </p>
      {gradient.approxKmToBest !== null && gradient.approxBestSec !== null && (
        <p className="screen__note">
          {s('map.gradientBest', locale, {
            km: Math.round(gradient.approxKmToBest),
            best: formatDuration(gradient.approxBestSec),
          })}
        </p>
      )}
    </>
  );
}
