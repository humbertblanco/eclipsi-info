import { formatObscurationPercent } from '../core/astro/obscuration';
import { lazy, Suspense, useMemo, useState } from 'react';
import { Badge, Card, SegmentedControl, Stat, VisibilityMeter, type Tone } from '../ui';
import { EclipseMap } from '../features/map/EclipseMap';
import { CloudPanel, useCloudOutlook } from '../features/weather';
import {
  bearingToCardinal,
  computeDurationGradient,
  type DurationGradient,
} from '../core/astro/gradient';
import type { EclipseContext } from './context';
import { computeUncertainty, type BandLimitDistance } from '../core/astro/uncertainty';
import { computeShadowMotion, type ShadowMotion } from '../core/astro/shadow';
import {
  computeEclipsePath,
  distanceToCenterLineKm,
  type PathPoint,
} from '../core/eclipses/path';
import { EphemerisTable } from './EphemerisTable';
import type { Locale } from '../i18n';
import { s } from './strings';
import {
  formatAge,
  formatDecimal,
  formatDegrees,
  formatDuration,
  NO_DATA,
} from './format';
import './screens.css';

/*
 * El cercador de llocs, a part del paquet principal.
 *
 * Arrossega el seu worker i tot `core/spots`. `React.lazy` fa que això sigui un
 * tros separat que només baixa qui obre la vista: el dia de l'eclipsi, amb la
 * cel·la saturada, cada kB de la primera pintada es paga en segons.
 */
const SpotSearchPanel = lazy(() =>
  import('../features/spots').then((m) => ({ default: m.SpotSearchPanel })),
);

/*
 * L'alineació Sol–cim, també a part.
 *
 * Arrossega el seu Worker propi i `core/spots/alignment` (1.400 línies). És la
 * funció més diferencial de l'app i alhora la que menys gent obrirà el dia de
 * l'eclipsi, que és exactament el perfil del que ha d'anar en un tros separat.
 */
const AlignPanel = lazy(() =>
  import('../features/align').then((m) => ({ default: m.AlignPanel })),
);

/*
 * El desglossament de núvols, també.
 *
 * El mesurador de la vista de núvols NO és mandrós: és una xifra que ha de
 * sortir de seguida. El panell de capes sí, perquè és el detall que es mira
 * després, i així la seva branca —capes, línia de visió, climatologia— no entra
 * al paquet de la primera pintada.
 */
/*
 * El panell de núvols NO és lazy, a diferència dels dos de sota: el compte
 * enrere — pantalla de primera pintada — ja l'importa estàticament, o sigui
 * que viu al paquet principal tant sí com no; un límit lazy aquí era teatre
 * (el bundler mateix ho avisava: INEFFECTIVE_DYNAMIC_IMPORT).
 */

export interface MapScreenProps extends EclipseContext {
  /**
   * Recalcula-ho tot des d'unes coordenades. Rep només lat/lon: la cota l'ha
   * de resoldre contra el model del terreny qui té l'estat de l'observador,
   * perquè és una operació de xarxa.
   *
   * LA CRIDA EL CLIC AL MAPA, directament: tocar un punt vol dir que aquell
   * punt passa a ser el teu a totes les pantalles. Vegeu el comentari del gest
   * dins del component.
   */
  onPickLocation: (lat: number, lon: number) => void;
}

/** Què respon la fitxa de sota del mapa. */
type View = 'band' | 'clouds' | 'move' | 'spots' | 'align';



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
 *  · TOCAR EL MAPA ET MOU EL PUNT, A TOTES LES PANTALLES.
 *    Hi va haver una etapa intermèdia en què el clic només obria una fitxa de
 *    previsualització i el canvi de debò el feia un botó «Fes-ne el teu punt».
 *    Es va fer per poder mirar un altre lloc sense perdre el teu, i el preu era
 *    que el gest més natural del mapa no feia el que sembla que fa: la
 *    capçalera, el compte enrere i la guia seguien parlant d'un altre lloc
 *    mentre la fitxa parlava del que acabaves de tocar. Dues xifres diferents a
 *    la vista alhora és el que fa dubtar de totes dues.
 *
 *    Ara el clic crida `onPickLocation` i prou. El que hi vam guanyar amb la
 *    previsualització no es perd: cada punt tocat entra a l'historial, i
 *    comparar-ne dos és el que fa `ComparePanel` des de la fulla d'ubicació,
 *    que a més ho fa amb la cota del model i el perfil del terreny — coses que
 *    la fitxa de previsualització, calculada al nivell del mar, no tenia.
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

  /*
   * TOT EL QUE JA SABEM DEL PUNT DE L'USUARI, I NO ENSENYÀVEM.
   *
   * Del punt en sabem molt més del que es veia i ja ho tenim calculat: a
   * quants quilòmetres queda el límit de la franja i cap a on, a quina
   * distància queda la línia central, i per on arribarà l'ombra i a quina
   * velocitat. És exactament el que necessita algú que està decidint on va, que
   * és per a què serveix aquesta pantalla.
   *
   * La distància a la línia central es mesura sobre la polilínia DIBUIXADA, no
   * sobre el marge umbral: ha de coincidir amb la ratlla que l'usuari té
   * davant. Abans només sortia per al punt de previsualització, que ja no
   * existeix; ara és del teu punt, que és de qui havia de ser.
   */
  const detail = useMemo(() => {
    if (view !== 'band' || circumstances === null || location === null) return null;
    const uncertainty = computeUncertainty(eclipseId, circumstances, {
      locateSeaLevelLimit: false,
    });
    const shadow =
      circumstances.kind === 'total' || circumstances.kind === 'annular'
        ? computeShadowMotion(eclipseId, circumstances)
        : null;
    return {
      limit: uncertainty.limit,
      shadow,
      toCenterKm: distanceToCenterLineKm(location, centerLineFor(eclipseId)),
    };
  }, [view, eclipseId, circumstances, location]);

  return (
    <div className="screen screen--full screen--split screen--flush">
      <div className="screen__col screen__col--main">
        <div className="mapscreen__stage">
          {/*
            LA DIANA ÉS EL TEU PUNT.

            `picked` era el punt de previsualització i ara rep la ubicació de
            l'app: com que tocar el mapa la canvia a l'instant, el marcador
            segueix el dit igual que abans i, a més, ja no pot quedar-se clavat
            en un lloc del qual cap altra pantalla parla.
          */}
          <EclipseMap
            eclipseId={eclipseId}
            locale={locale}
            observer={location}
            picked={location}
            onPickLocation={(loc) => onPickLocation(loc.lat, loc.lon)}
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
            /*
              CINC OPCIONS NO CABEN EN UNA FILA de 256 px, que és el que fa la
              fitxa a l'escriptori. Sense `wrap`, «Franja» es llegia «Fr…» i
              «Enquadra», «E…». Amb `wrap` baixen a una segona fila senceres.
            */
            wrap
            label={s('map.compare', locale)}
            options={[
              { value: 'band', label: s('map.view.band', locale) },
              { value: 'clouds', label: s('map.view.clouds', locale) },
              { value: 'move', label: s('map.view.move', locale) },
              { value: 'spots', label: s('map.view.spots', locale) },
              { value: 'align', label: s('map.view.align', locale) },
            ]}
          />

          {circumstances === null || contacts === null ? (
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

              <LimitBlock
                limit={detail?.limit ?? null}
                toCenterKm={detail?.toCenterKm ?? null}
                locale={locale}
              />
              <ShadowBlock shadow={detail?.shadow ?? null} locale={locale} />

              <p className="screen__note">{s('map.pickNote', locale)}</p>
            </>
          ) : view === 'spots' ? (
            /*
              EL CERCADOR DE LLOCS, QUE FINS ARA NO ES PODIA OBRIR.

              El motor (`core/spots`), el seu worker i aquest panell estaven
              acabats i provats des del primer dia, i no els muntava ningú: la
              pregunta «i si em moc?» només tenia resposta en forma de rumb
              (`MoveAdvice`), mai en forma de llocs concrets.

              VA DARRERE DE `React.lazy` perquè arrossega el worker i tota la
              seva branca de codi, i el paquet d'aquesta app ja és el problema
              greu que diu ESTAT.md. Qui no obri aquesta vista no el paga.

              `onSelect` tanca el cercle: triar un resultat és canviar el punt
              de l'app, igual que tocar el mapa.
            */
            <Suspense fallback={<p className="screen__note">{s('map.view.spots', locale)}…</p>}>
              <SpotSearchPanel
                eclipseId={eclipseId}
                locale={locale}
                origin={location}
                onSelect={(spot) => onPickLocation(spot.lat, spot.lon)}
              />
            </Suspense>
          ) : view === 'align' ? (
            /*
              L'ALINEACIÓ SOL–CIM, QUE MAI NO HAVIA ARRIBAT A LA PANTALLA.

              `core/spots/alignment.ts` fa una cosa que cap altra aplicació fa:
              troba el punt per geometria i després torna a baixar el raig fins
              a l'element per comprovar que des d'allà es vegi de veritat. Amb
              el Sol a 2° —el 12 d'agost del 2026 a llevant— la línia sola
              menteix la meitat de les vegades. Eren 1.400 línies provades que
              no cridava ningú.

              VA AL MAPA i no a la pestanya del Cel perquè allà el marc és per a
              la càmera i aquí hi ha el territori, que és de què parla.
            */
            <Suspense fallback={<p className="screen__note">{s('map.view.align', locale)}…</p>}>
              <AlignPanel
                eclipseId={eclipseId}
                locale={locale}
                origin={location}
                onSelect={onPickLocation}
              />
            </Suspense>
          ) : view === 'clouds' ? (
            <>
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
              {/*
                EL DESGLOSSAMENT PER CAPES, QUE EXISTIA I NO ES VEIA.

                El mesurador dona una xifra de 0 a 100 i es queda aquí. El
                panell (`features/weather/CloudPanel`) porta el que decideix de
                debò: quina capa pesa, i sobretot ON és el núvol que et taparà.
                Amb el Sol a 5° —que és on serà el 12 d'agost del 2026— el que
                t'ha de preocupar no és el cel de sobre teu sinó el de seixanta
                quilòmetres cap al ponent, i aquesta és l'única part de l'app
                que ho sap dir.

                EL MESURADOR ES QUEDA: és el titular, i el panell el detall.

                SE LI PASSA `clouds`, la consulta que aquesta pantalla JA ha
                fet. Sense això el panell en faria una de pròpia amb els
                mateixos paràmetres: dues peticions a Open-Meteo per ensenyar el
                mateix número dos cops, i dues edats de dada que es podrien
                contradir a la mateixa targeta.
              */}
              <Suspense fallback={null}>
                <CloudPanel
                  locale={locale}
                  location={location}
                  targetTimeMs={contacts.max.time.getTime()}
                  sunAzimuthDeg={contacts.max.sun.azimuth}
                  sunAltitudeDeg={contacts.max.sun.altitudeApparent}
                  outlook={clouds}
                />
              </Suspense>
            </>
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
 * On queda el límit de la franja i, si es té, la línia central.
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
            label={s('map.toCenter', locale)}
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
