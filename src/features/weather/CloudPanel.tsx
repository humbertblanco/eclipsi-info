/**
 * El panell de nuvolositat.
 *
 * Té una sola feina i és difícil: dir la veritat sobre una dada que no és
 * fiable, sense que això la faci inútil. Per això, i és deliberat:
 *
 *  - L'etiqueta de PREVISIÓ o CLIMATOLOGIA va al costat del número gran, no
 *    en una nota al peu. Són dues respostes a dues preguntes diferents i s'han
 *    de poder distingir d'una llambregada.
 *  - L'edat de la dada i la fiabilitat surten SEMPRE, també quan tot va bé.
 *    Si només apareixen quan hi ha problemes, la seva absència passa a voler
 *    dir "això és segur", i no ho és mai.
 *  - Les barres de les capes es pinten amb l'opacitat física de cada capa: els
 *    núvols baixos surten sòlids i els cirrus, translúcids. La barra és el
 *    model, dibuixat.
 *  - Aquest panell NO fa servir `--accent`. La regla del sistema és un sol
 *    accent ambre per pantalla, i aquí l'ambre ja té una feina assignada:
 *    `--status-partial`. Barrejar-los faria que un cel a mitges es confongués
 *    amb un botó.
 */

import type { GeoLocation } from '../../core/astro/types';
import {
  BAND_MEANING,
  BAND_TITLE,
  CONFIDENCE_LABEL,
  LAYER_LABEL,
  LAYER_NOTE,
  LAYER_OPACITY,
  LAYER_ORDER,
  OPEN_METEO_ATTRIBUTION,
  describeAge,
  describeAgeSince,
  describeDominantLayer,
  describeHaze,
  describeLead,
  describeLineOfSight,
  type CloudLayerId,
  type CloudOutlook,
} from '../../core/weather';
import { useCloudOutlook } from './useCloudOutlook';
import './weather.css';

export interface CloudPanelProps {
  /** `null` mentre no se sap on és l'usuari. El panell ho diu i espera. */
  location: GeoLocation | null;
  /** Instant del màxim de l'eclipsi des d'aquest lloc, en ms d'època. */
  targetTimeMs: number | null;
  /** Azimut del Sol en aquell instant, en graus des del nord cap a l'est. */
  sunAzimuthDeg: number | null;
  /** Altura APARENT del Sol en aquell instant, en graus (amb refracció). */
  sunAltitudeDeg: number | null;
  /** Nom de l'instant consultat. Per defecte, el màxim de l'eclipsi. */
  eventLabel?: string;
  className?: string;
}

const percent = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 0 });

/**
 * Percentatge amb espai fi abans del signe, com mana la tipografia catalana.
 * L'espai és dur perquè la xifra i el signe no se separin mai de línia.
 */
function pct(value: number): string {
  return `${percent.format(value)}\u00a0%`;
}

function formatHour(timeMs: number): string {
  return new Intl.DateTimeFormat('ca-ES', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }).format(new Date(timeMs));
}

/* ------------------------------------------------------------ subcomponents */

/**
 * Barra d'una capa. L'amplada és la cobertura i l'opacitat del farciment és
 * l'opacitat física de la capa: així es veu d'un cop d'ull que un cel ple de
 * cirrus no és el mateix que un cel ple d'estrats.
 */
function LayerRow({
  layer,
  cover,
  dominant,
}: {
  layer: CloudLayerId;
  cover: number;
  dominant: boolean;
}) {
  return (
    <div className={dominant ? 'cloudlayer cloudlayer--on' : 'cloudlayer'}>
      <span className="cloudlayer__name">{LAYER_LABEL[layer]}</span>
      <span className="cloudlayer__track" title={LAYER_NOTE[layer]}>
        <span
          className="cloudlayer__fill"
          style={{
            width: `${Math.min(100, Math.max(0, cover))}%`,
            opacity: LAYER_OPACITY[layer],
          }}
        />
      </span>
      <span className="cloudlayer__value eclipsi-data">{pct(cover)}</span>
      <span className="cloudlayer__weight eclipsi-data">
        ×{LAYER_OPACITY[layer].toFixed(2)}
      </span>
    </div>
  );
}

/** Fila de metadades. Etiqueta a l'esquerra, xifra en mono a la dreta. */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="cloudmeta__row">
      <dt>{label}</dt>
      <dd className="eclipsi-data">{value}</dd>
    </div>
  );
}

/** Els punts que s'han consultat al llarg de la línia de visió. */
function LineOfSightStrip({ outlook }: { outlook: CloudOutlook }) {
  const { sampling } = outlook;
  if (!sampling.slanted) return null;

  return (
    <div className="cloudlos">
      <p className="eclipsi-overline">Línia de visió</p>
      <p className="cloudlos__text">{describeLineOfSight(outlook)}</p>
      {sampling.lineOfSightUsed && (
        <ul className="cloudlos__chips">
          {sampling.points.map((point) => (
            <li key={`${point.lat},${point.lon}`} className="eclipsi-data">
              {Math.round(point.groundDistanceKm)} km
            </li>
          ))}
        </ul>
      )}
      {sampling.truncated && (
        <p className="cloudlos__note">
          La línia de visió surt de la zona que consultem. Els núvols més
          llunyans no hi entren.
        </p>
      )}
    </div>
  );
}

/**
 * Repartiment històric de la climatologia.
 *
 * Ensenyem els quartils i no la desviació típica perquè la distribució de
 * nuvolositat no és normal ni de bon tros: s'acumula als extrems (o cel net o
 * cel tancat) i una desviació típica hi diria molt poc.
 */
function ClimatologySpread({ outlook }: { outlook: CloudOutlook }) {
  if (outlook.mode !== 'climatology') return null;
  const { stats, firstYear, lastYear, windowDays } = outlook;

  return (
    <div className="cloudclimo">
      <p className="eclipsi-overline">Repartiment dels anys</p>
      <div className="cloudclimo__track">
        <span
          className="cloudclimo__box"
          style={{ left: `${stats.p25}%`, width: `${Math.max(1, stats.p75 - stats.p25)}%` }}
        />
        <span className="cloudclimo__median" style={{ left: `${stats.medianScore}%` }} />
      </div>
      <div className="cloudclimo__scale eclipsi-data">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
      <dl className="cloudmeta">
        <MetaRow label="Hores amb cel net" value={pct(stats.clearFraction * 100)} />
        <MetaRow label="Hores amb cel tapat" value={pct(stats.cloudyFraction * 100)} />
        <MetaRow
          label="La meitat dels casos, entre"
          value={`${percent.format(stats.p25)} i ${percent.format(stats.p75)}`}
        />
        <MetaRow label="Sèrie" value={`${firstYear}–${lastYear}, ±${windowDays} dies`} />
        <MetaRow
          label="Hores observades"
          value={`${percent.format(stats.sampleCount)} en ${stats.years} anys`}
        />
      </dl>
    </div>
  );
}

/* ---------------------------------------------------------------- component */

export function CloudPanel({
  location,
  targetTimeMs,
  sunAzimuthDeg,
  sunAltitudeDeg,
  eventLabel = 'Màxim de l’eclipsi',
  className,
}: CloudPanelProps) {
  const { outlook, loading, error, online, nowMs, refresh } = useCloudOutlook({
    location,
    targetTimeMs,
    sunAzimuthDeg,
    sunAltitudeDeg,
  });

  const root = className ? `cloudpanel ${className}` : 'cloudpanel';

  if (!location || targetTimeMs === null) {
    return (
      <section className={root} aria-label="Nuvolositat">
        <p className="eclipsi-overline">Nuvolositat</p>
        <p className="cloudpanel__empty">
          Cal saber on ets i a quina hora et passa l’eclipsi.
        </p>
      </section>
    );
  }

  if (loading && !outlook) {
    return (
      <section className={root} aria-label="Nuvolositat" aria-busy="true">
        <p className="eclipsi-overline">Nuvolositat</p>
        <p className="cloudpanel__empty">Consultant Open-Meteo…</p>
      </section>
    );
  }

  if (!outlook) {
    return (
      <section className={root} aria-label="Nuvolositat">
        <p className="eclipsi-overline">Nuvolositat</p>
        <p className="cloudpanel__error">
          {error ?? 'No hi ha dada de nuvolositat.'}
          {!online && ' Estàs sense connexió i no hi ha res desat d’aquest lloc.'}
        </p>
        <button type="button" className="cloudpanel__retry" onClick={refresh}>
          Torna-ho a provar
        </button>
      </section>
    );
  }

  const band = outlook.score.band;
  const ageMs = Math.max(0, nowMs - outlook.fetchedAtMs);
  const dominantNote = describeDominantLayer(outlook);
  const hazeNote = describeHaze(outlook);

  return (
    <section
      className={`${root} cloudpanel--${band}`}
      aria-label="Nuvolositat"
      aria-busy={loading || undefined}
    >
      <header className="cloudpanel__head">
        <p className="eclipsi-overline">Nuvolositat</p>
        <span className={`cloudbadge cloudbadge--${outlook.mode}`}>
          {outlook.mode === 'forecast' ? 'Previsió' : 'Climatologia'}
        </span>
      </header>

      {outlook.stale && (
        <p className="cloudpanel__stale">
          Sense connexió. Aquesta és l’última dada que es va desar,{' '}
          <strong className="eclipsi-data">{describeAgeSince(ageMs)}</strong>.
        </p>
      )}

      <div className="cloudscore">
        <div className="cloudscore__figure">
          <span className="cloudscore__value eclipsi-data">{outlook.score.score}</span>
          <span className="cloudscore__unit eclipsi-data">/100</span>
        </div>
        <div className="cloudscore__text">
          <h3 className="cloudscore__title">{BAND_TITLE[band]}</h3>
          <p className="cloudscore__meaning">{BAND_MEANING[band]}</p>
          {dominantNote && <p className="cloudscore__note">{dominantNote}</p>}
        </div>
      </div>

      <div className="cloudlayers">
        <p className="eclipsi-overline">Capes de núvols</p>
        {LAYER_ORDER.map((layer) => (
          <LayerRow
            key={layer}
            layer={layer}
            cover={outlook.layers[layer]}
            dominant={outlook.score.dominant === layer}
          />
        ))}
        <p className="cloudlayers__legend">
          El pes de la dreta és quanta llum atura cada capa. Els cirrus deixen
          passar la corona; els estrats, no.
        </p>
        {outlook.score.fromTotalOnly && (
          <p className="cloudlayers__legend cloudlayers__legend--warn">
            El model no ha donat el desglossament per capes. La xifra és
            grollera.
          </p>
        )}
      </div>

      <LineOfSightStrip outlook={outlook} />
      <ClimatologySpread outlook={outlook} />

      {hazeNote && <p className="cloudhaze">{hazeNote}</p>}

      <dl className="cloudmeta cloudmeta--foot">
        <MetaRow label={eventLabel} value={formatHour(targetTimeMs)} />
        {outlook.mode === 'forecast' && (
          <MetaRow label="Antelació" value={describeLead(outlook.leadDays)} />
        )}
        <MetaRow label="Fiabilitat de la xifra" value={CONFIDENCE_LABEL[outlook.confidence]} />
        <MetaRow label="Dada de" value={describeAge(ageMs)} />
      </dl>

      <p className="cloudpanel__caveat">{outlook.caveat}</p>

      <footer className="cloudpanel__foot">
        <span className="cloudpanel__source">{OPEN_METEO_ATTRIBUTION}</span>
        <button
          type="button"
          className="cloudpanel__retry"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? 'Consultant…' : 'Actualitza'}
        </button>
      </footer>
    </section>
  );
}
