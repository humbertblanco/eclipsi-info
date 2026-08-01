import { useEffect, useMemo, useState } from 'react';
import {
  formatObscurationPercent,
  obscurationPercentValue,
} from '../core/astro/obscuration';
import {
  Badge,
  Button,
  ErrorBoundary,
  Icon,
  ICON_SM,
  IconButton,
  RangeSlider,
  SegmentedControl,
  type RangeTick,
  type Tone,
} from '../ui';
import { ARView } from '../features/ar/ARView';
import { sampleAt } from '../core/astro/ephemeris';
import { horizonAltitudeAt } from '../core/horizon/profile';
import { bearingToCardinal } from '../core/astro/gradient';
import type { EclipseContext } from './context';
import { s } from './strings';
import { formatClock, formatDegrees, formatDuration, NO_DATA } from './format';
import './screens.css';

export interface SkyScreenProps extends EclipseContext {
  /** Demana la ubicació. Va al mateix gest que obre la càmera. */
  onRequestLocation: () => void;
}

/** El mode del HUD: el cel d'ara mateix o el recorregut que es pot recórrer. */
type Mode = 'live' | 'sim';

/**
 * Pantalla "Cel" — la càmera, que és el cor del producte.
 *
 * ESTRUCTURA, tal com la fixa `design-reference/ui_kits/app/SkyScreen.jsx`:
 * franja de brúixola de vidre a dalt, insígnies d'estat sota seu, la imatge
 * ocupant el marc SENCER, i UN SOL HUD prim a baix amb el control segmentat, el
 * control lliscant del recorregut amb marques a C1/C2/C4, una línia d'estat i
 * l'avís de seguretat, que no es pot descartar.
 *
 * D'ON SURTEN LES XIFRES. De la referència no se n'ha copiat cap número: allà
 * la trajectòria i els contactes estaven cablejats a coordenades del marc. Aquí
 * l'azimut, l'altura i l'obscuració els dona `sampleAt` per a l'instant que
 * marca el control lliscant, i l'altura del terreny en aquell azimut surt del
 * perfil d'horitzó real que ja hem calculat. La insígnia d'«horitzó lliure» o
 * «Sol darrere obstacle» és, per tant, una mesura del relleu de debò del punt
 * on ets, no una franja vermella dibuixada a la imatge.
 *
 * LÍMIT CONEGUT — LA SUPERPOSICIÓ NO SEGUEIX EL CONTROL LLISCANT. `ARView` té
 * el seu propi estat d'instant simulat i no accepta que li'l posin des de fora,
 * i aquesta tasca no pot tocar `src/features/ar/`. O sigui que ara mateix el
 * control lliscant mou les LECTURES (hora, azimut, altura, obscuració, marge
 * sobre el terreny) però no el disc dibuixat sobre la imatge. Les props que
 * caldrien a `ARView` per lligar-ho estan documentades a `AR_PROPS_NEEDED`, a
 * baix de tot d'aquest fitxer.
 *
 * MENTRESTANT, els controls propis d'`ARView` (calibratge, esquema, diagnòstic
 * de sensors) queden fora del marc, que és el que demana el sistema —«un sol
 * HUD prim»—, i es recuperen amb el botó d'obertura de diafragma del HUD. No
 * s'amaguen amb `display:none`: només queden fora de la retallada, i tornar-los
 * a ensenyar no remunta res ni tanca la càmera.
 */
export function SkyScreen({
  eclipseId,
  locale,
  location,
  circumstances,
  verdict,
  horizon,
  onRequestLocation,
}: SkyScreenProps) {
  const [mode, setMode] = useState<Mode>('sim');
  const [offsetSec, setOffsetSec] = useState(0);
  const [tools, setTools] = useState(false);

  const contacts = circumstances?.contacts ?? null;

  // Finestra del recorregut: de C1 a C4, en segons des de C1. Es treballa amb
  // desplaçaments i no amb mil·lisegons d'època perquè un `input[type=range]`
  // amb un min de 1,78e12 perd precisió pel camí.
  const track = useMemo(() => {
    if (!contacts) return null;
    const startMs = (contacts.c1 ?? contacts.max).time.getTime();
    const endMs = (contacts.c4 ?? contacts.max).time.getTime();
    const spanSec = Math.max(1, Math.round((endMs - startMs) / 1000));
    return { startMs, spanSec };
  }, [contacts]);

  // En arrencar, el control es planta al màxim: és l'instant que la gent vol
  // veure, no el primer contacte.
  const maxOffsetSec = useMemo(() => {
    if (!track || !contacts) return 0;
    return Math.round((contacts.max.time.getTime() - track.startMs) / 1000);
  }, [track, contacts]);

  useEffect(() => setOffsetSec(maxOffsetSec), [maxOffsetSec]);

  // Rellotge propi per al mode «el cel ara». Només corre en aquest mode: un
  // interval que dispara un render per segon amb la càmera oberta és bateria
  // cremada per res.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (mode !== 'live') return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [mode]);

  const instantMs =
    mode === 'live' || track === null ? nowMs : track.startMs + offsetSec * 1000;

  const sample = useMemo(
    () => (location === null ? null : sampleAt(new Date(instantMs), location)),
    [location, instantMs],
  );

  // Altura del terreny a l'azimut on hi ha el Sol en aquest instant. Sense
  // perfil no és zero: és desconeguda, i es diu.
  const terrainDeg = useMemo(
    () => (horizon === null || sample === null ? null : horizonAltitudeAt(horizon, sample.sun.azimuth)),
    [horizon, sample],
  );

  const blocked =
    terrainDeg !== null && sample !== null && sample.sun.altitudeApparent < terrainDeg;

  const ticks = useMemo<RangeTick[]>(() => {
    if (!track || !contacts) return [];
    const at = (ms: number) => Math.round((ms - track.startMs) / 1000);
    const out: RangeTick[] = [{ value: 0, label: 'C1' }];
    if (contacts.c2) out.push({ value: at(contacts.c2.time.getTime()), label: 'C2' });
    out.push({ value: track.spanSec, label: 'C4' });
    return out;
  }, [track, contacts]);

  if (location === null || circumstances === null || contacts === null) {
    return (
      <div className="screen screen--full">
        <div className="skyscreen__empty">
          <div className="screen__empty">
            <span>{s('common.unknownPlace', locale)}</span>
            <span>{s('common.locateCta', locale)}</span>
            <Button icon="crosshair" onClick={onRequestLocation}>
              {s('common.locate', locale)}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const obscuration = sample ? sample.obscuration : 0;
  const central = circumstances.kind === 'total' || circumstances.kind === 'annular';
  const visibleSec = verdict ? verdict.centralVisibleSec : circumstances.centralDurationSec;

  return (
    <div className="screen screen--full skyscreen">
      {/*
        La imatge, a sang. Tot el que ve després hi flota per sobre.

        LA BARRERA D'ERROR NO ÉS DEFENSIVA PER COSTUM: la vista de RA depèn de
        la càmera, dels sensors d'orientació i del permís d'ubicació, que és
        exactament la mena de codi que falla en un dispositiu concret i no es
        reprodueix a taula. Sense barrera, una excepció allà dins s'emportaria
        també la brúixola, les insígnies i el HUD — que segueixen essent
        correctes, perquè surten del càlcul i no del sensor.
      */}
      <div className={tools ? 'skyscreen__ar skyscreen__ar--tools' : 'skyscreen__ar'}>
        <ErrorBoundary
          resetKey={eclipseId}
          message={s('camera.crashed', locale)}
          retryLabel={s('shell.retry', locale)}
        >
          <ARView
            location={location}
            eclipseId={eclipseId}
            locale={locale}
            horizon={horizon}
            /*
              EL TERRENY, CAP A LA COMPORTA DE LA CÀMERA.
              Aquesta pantalla té el veredicte a la mà i no l'hi passava: en un
              punt on una carena tapa la totalitat sencera, la veu del compte
              enrere callava i el rètol de la càmera seguia autoritzant a
              mirar. `undefined` mentre no hi ha veredicte, que és «encara no
              se sap» i no «no es veu».
            */
            centralPhaseVisible={verdict ? verdict.centralVisibleSec > 0 : undefined}
            onRequestLocation={onRequestLocation}
          />
        </ErrorBoundary>
      </div>

      {!tools && (
        <>
          <div className="skyscreen__top">
            <CompassStrip
              azimuth={sample ? sample.sun.azimuth : 0}
              locale={locale}
            />
            <div className="skyscreen__badges">
              <Badge tone={obscuration >= 0.999 ? 'clear' : 'partial'}>
                {s('camera.obscured', locale, { n: obscurationPercentValue(obscuration, central) })}
              </Badge>
              <Badge tone={horizonTone(terrainDeg, blocked)} dot>
                {terrainDeg === null
                  ? s('camera.terrainUnknown', locale)
                  : blocked
                    ? s('camera.blocked', locale)
                    : s('camera.free', locale)}
              </Badge>
            </div>
          </div>

          {/* Un sol HUD prim. */}
          <div className="skyscreen__hud">
            <SegmentedControl
              value={mode}
              onChange={setMode}
              label={s('title.sky', locale)}
              options={[
                { value: 'live', label: s('camera.live', locale) },
                { value: 'sim', label: s('camera.sim', locale) },
              ]}
            />

            {mode === 'sim' && track !== null && (
              <RangeSlider
                label={s('camera.track', locale)}
                valueLabel={formatClock(new Date(instantMs), locale)}
                min={0}
                max={track.spanSec}
                step={1}
                value={offsetSec}
                onChange={setOffsetSec}
                ticks={ticks}
              />
            )}

            <div className="skyscreen__status">
              <span className="skyscreen__statustext">
                <span className="skyscreen__what">
                  {phrase(obscuration, circumstances.kind, central, visibleSec, locale)}
                </span>
                <span className="screen__overline">
                  {s('camera.readout', locale, {
                    az: sample ? sample.sun.azimuth.toFixed(0) : NO_DATA,
                    card: sample ? bearingToCardinal(sample.sun.azimuth, locale) : NO_DATA,
                    alt: sample ? sample.sun.altitudeApparent.toFixed(1) : NO_DATA,
                    terrain: terrainDeg === null ? NO_DATA : formatDegrees(terrainDeg),
                  })}
                </span>
              </span>
              <IconButton
                icon="aperture"
                // Vidre i no la caixa neutra del sistema: aquest botó sura
                // damunt de la imatge de la càmera, i una caixa opaca hi tapa
                // justament el tros de cel que s'està mirant.
                className="ui-iconbtn--over"
                label={s('camera.tools', locale)}
                onClick={() => setTools(true)}
              />
            </div>

            {/*
              L'avís NO és descartable i no depèn de cap estat. `ARView` en pinta
              un de propi damunt de la imatge quan la càmera està oberta, o sigui
              que en algun moment n'hi ha dos; és redundància, no contradicció, i
              en seguretat ocular el cantó segur de l'error és aquest.

              PER QUÈ AQUÍ NO ÉS UN `SafetyNotice`. Ho era, i era una caixa
              vermella de dues línies al peu d'una pantalla que ha de ser tota
              cel: entre ella i els controls, de la càmera en quedava una
              franja. El text no s'ha tocat ni s'ha fet descartable —és el
              mateix avís, amb la mateixa icona i el mateix to de perill—, però
              en una línia. El bloc sencer viu a la pantalla de la guia, que és
              on es llegeix abans de sortir de casa.
            */}
            <p className="skyscreen__safety">
              <Icon name="eye-off" size={ICON_SM} aria-hidden />
              <span>{s('camera.safety', locale)}</span>
            </p>
          </div>
        </>
      )}

      {tools && (
        <div className="skyscreen__toolsbar">
          <Button variant="ghost" size="sm" icon="eye" onClick={() => setTools(false)}>
            {s('camera.toolsHide', locale)}
          </Button>
        </div>
      )}
    </div>
  );
}

/** El to de la insígnia d'horitzó. Sense perfil no és ni bo ni dolent: no se sap. */
function horizonTone(terrainDeg: number | null, blocked: boolean): Tone {
  if (terrainDeg === null) return 'cloudy';
  return blocked ? 'danger' : 'clear';
}

/**
 * Què veuràs en aquest instant, en una frase curta.
 *
 * Els llindars són els de la referència, i no són arbitraris: per sota d'un 30 %
 * la mossegada al disc no es distingeix sense filtre, i per damunt d'un 85 % la
 * falç ja és prima però encara fa mal mirar-la. El que canvia respecte de la
 * referència és que aquí la durada que s'anuncia és la VISIBLE des d'aquest
 * punt, la que ha sobreviscut al relleu, no la teòrica.
 */
function phrase(
  obscuration: number,
  kind: string,
  central: boolean,
  visibleSec: number,
  locale: EclipseContext['locale'],
): string {
  if (obscuration >= 0.999 && central) {
    const head =
      kind === 'annular' ? s('camera.phase.ring', locale) : s('camera.phase.corona', locale);
    return visibleSec > 0 ? `${head} ${formatDuration(visibleSec)}.` : head;
  }
  if (obscuration > 0.85) return s('camera.phase.thin', locale);
  if (obscuration > 0.3) {
    return `${formatObscurationPercent(obscuration, false, 0)} · ${s('camera.phase.clear', locale)}`;
  }
  if (obscuration > 0.001) return s('camera.phase.bite', locale);
  return s('camera.phase.none', locale);
}

/**
 * Franja de brúixola.
 *
 * PER QUÈ LA FINESTRA ÉS MÒBIL i no els 226°–274° fixos de la referència:
 * aquesta app cobreix tres eclipsis i el Sol hi surt entre el sud-est i el
 * nord-oest segons el cas. Una finestra de ±24° al voltant de l'azimut del Sol
 * ensenya sempre el mateix detall i no deixa mai el marcador fora de la vista.
 */
function CompassStrip({
  azimuth,
  locale,
}: {
  azimuth: number;
  locale: EclipseContext['locale'];
}) {
  const HALF = 24;
  /* Marques cada deu graus, tret de les que cauen sota el marcador del Sol:
     dues etiquetes al mateix lloc no són més informació, són menys. */
  const CLEAR = 6;
  const from = azimuth - HALF;
  const first = Math.ceil(from / 10) * 10;
  const marks: number[] = [];
  for (let a = first; a <= azimuth + HALF; a += 10) {
    if (Math.abs(a - azimuth) >= CLEAR) marks.push(a);
  }

  const at = (deg: number) => ((deg - from) / (HALF * 2)) * 100;

  return (
    <div className="skyscreen__compass">
      {marks.map((deg) => (
        <span key={deg} className="skyscreen__tick" style={{ left: `${at(deg)}%` }}>
          <span className="skyscreen__tickline" />
          <span className="skyscreen__ticklabel">{((deg % 360) + 360) % 360}°</span>
        </span>
      ))}
      <span
        className="skyscreen__tick skyscreen__tick--sun"
        style={{ left: `${at(azimuth)}%` }}
      >
        <span className="skyscreen__tickline" />
        <span className="skyscreen__ticklabel">
          {azimuth.toFixed(0)}° {bearingToCardinal(azimuth, locale)}
        </span>
      </span>
    </div>
  );
}

/*
 * ---------------------------------------------------------------------------
 * PROPS QUE CALDRIEN A `ARView` PERQUÈ AQUESTA PANTALLA FOS SENCERA.
 *
 * Es documenten aquí, i no s'implementen, perquè `src/features/ar/` és d'una
 * altra tasca. Cap d'aquestes és cosmètica: sense elles la pantalla té dos
 * rellotges (el del HUD i el d'`ARView`) i dos jocs de controls.
 *
 *   1. `timeMs?: number` — instant a dibuixar. Ara `ARView` el porta dins amb
 *      `progress` (0..1). Amb això, el control lliscant del HUD mouria el disc
 *      per la imatge, que és tota la gràcia de la pantalla.
 *   2. `onTimeChange?: (ms: number) => void` — perquè el calibratge o un gest
 *      dins de la imatge puguin tornar l'instant al HUD.
 *   3. `chrome?: 'full' | 'none'` — amaga els seus controls, la seva línia de
 *      lectura i el seu avís de seguretat, i deixa només vídeo i llenç. Ara
 *      s'aconsegueix retallant-los amb `overflow`, que funciona però és una
 *      manera indirecta de dir el mateix.
 *   4. `onState?: (state: { cameraOn: boolean; calibrated: boolean;
 *      headingJitterDeg: number }) => void` — el HUD ha de poder dir «brúixola
 *      ±2°» a la línia d'estat, que és el que demana la referència, i saber si
 *      la càmera està oberta per no duplicar l'avís de seguretat.
 *   5. `mode?: 'mixed' | 'diagram'` controlat des de fora, perquè «com es
 *      veurà» i «esquema» són dues vistes de contingut i el seu lloc natural és
 *      el segmentat del HUD.
 * ---------------------------------------------------------------------------
 */
