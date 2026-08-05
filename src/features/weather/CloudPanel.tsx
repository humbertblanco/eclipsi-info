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
 *
 * IDIOMA. Res d'aquest fitxer no escriu text: les afirmacions sobre el cel
 * surten de `core/weather` amb `locale`, i les etiquetes, de `./strings.ts`.
 * El panell es va escriure monolingüe mentre no el muntava ningú; en obrir-lo
 * al mapa, deixar-lo així seria el mateix defecte que ESTAT.md descriu a
 * `verdict.summary`.
 */

import type { GeoLocation } from '../../core/astro/types';
/*
 * DEL MÒDUL CONCRET, NO DEL BARRIL, i és una decisió de pes de paquet.
 *
 * `core/weather/index.ts` exporta també `climGrid.ts` —la graella de
 * climatologia de núvols del mapa— i aquest component el renderitza el COMPTE
 * ENRERE, que és la primera pintada. Importar del barril arrossegava
 * `climGrid` sencer al paquet d'arrencada de tothom, per a una capa que només
 * existeix dins del mapa i que la majoria no obrirà mai. Es va detectar
 * buscant les cadenes `eclipsi.clouds-clim` i `scoringVersion` dins del chunk
 * d'entrada compilat.
 *
 * Els barrils són còmodes i cars: un barril és una promesa que tot el que hi
 * ha a dins viatja junt.
 */
import {
  BAND_MEANING,
  BAND_TITLE,
  describeAge,
  describeAgeSince,
  describeDominantLayer,
  describeHaze,
  describeLead,
  describeLineOfSight,
} from '../../core/weather/describe';
import { CONFIDENCE_LABEL } from '../../core/weather/outlook';
import {
  LAYER_LABEL,
  LAYER_NOTE,
  LAYER_OPACITY,
  LAYER_ORDER,
} from '../../core/weather/layers';
import { OPEN_METEO_ATTRIBUTION } from '../../core/weather/openMeteo';
import type { CloudLayerId, CloudOutlook } from '../../core/weather/types';
import type { Locale } from '../../i18n';
import { ws } from './strings';
import { useCloudOutlook, type UseCloudOutlookResult } from './useCloudOutlook';
import './weather.css';

export interface CloudPanelProps {
  locale: Locale;
  /** `null` mentre no se sap on és l'usuari. El panell ho diu i espera. */
  location: GeoLocation | null;
  /** Instant del màxim de l'eclipsi des d'aquest lloc, en ms d'època. */
  targetTimeMs: number | null;
  /** Azimut del Sol en aquell instant, en graus des del nord cap a l'est. */
  sunAzimuthDeg: number | null;
  /** Altura APARENT del Sol en aquell instant, en graus (amb refracció). */
  sunAltitudeDeg: number | null;
  /**
   * Resultat JA RESOLT de `useCloudOutlook`. Quan es dona, el panell NO fa
   * cap petició pròpia: es reaprofita la que ja té la pantalla.
   */
  outlook?: UseCloudOutlookResult;
  /** Nom de l'instant consultat. Per defecte, el màxim de l'eclipsi. */
  eventLabel?: string;
  className?: string;
}

/**
 * Etiqueta BCP-47 de cada idioma. Català i castellà escriuen els números
 * igual, però l'hora no: `Intl` en dona el mes abreujat («d’ag.» contra
 * «ago») i, sobretot, el dia que entri una tercera llengua no s'ha de
 * descobrir amb una data catalana enmig d'una altra pantalla.
 */
const INTL: Record<Locale, string> = {
  ca: 'ca-ES',
  es: 'es-ES',
  en: 'en-GB',
  fr: 'fr-FR',
};

const percentFmt: Partial<Record<Locale, Intl.NumberFormat>> = {};
const hourFmt: Partial<Record<Locale, Intl.DateTimeFormat>> = {};

const CONFIDENCE_FR: Record<CloudOutlook['confidence'], string> = {
  high: 'Élevée',
  medium: 'Moyenne',
  low: 'Faible',
  'very-low': 'Très faible',
};

const OPEN_METEO_FR = 'Données météorologiques d’Open-Meteo.com (CC BY 4.0)';

/** Es memoritzen: construir un `Intl` a cada pintada no és barat. */
function percent(locale: Locale): Intl.NumberFormat {
  return (percentFmt[locale] ??= new Intl.NumberFormat(INTL[locale], {
    maximumFractionDigits: 0,
  }));
}

/**
 * Percentatge amb espai fi abans del signe, com mana la tipografia catalana
 * i la castellana. L'espai és dur perquè la xifra i el signe no se separin
 * mai de línia.
 */
function pct(value: number, locale: Locale): string {
  return `${percent(locale).format(value)}\u00a0%`;
}

function formatHour(timeMs: number, locale: Locale): string {
  const fmt = (hourFmt[locale] ??= new Intl.DateTimeFormat(INTL[locale], {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }));
  return fmt.format(new Date(timeMs));
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
  locale,
}: {
  layer: CloudLayerId;
  cover: number;
  dominant: boolean;
  locale: Locale;
}) {
  return (
    <div className={dominant ? 'cloudlayer cloudlayer--on' : 'cloudlayer'}>
      <span className="cloudlayer__name">{LAYER_LABEL[layer][locale]}</span>
      <span className="cloudlayer__track" title={LAYER_NOTE[layer][locale]}>
        <span
          className="cloudlayer__fill"
          style={{
            width: `${Math.min(100, Math.max(0, cover))}%`,
            opacity: LAYER_OPACITY[layer],
          }}
        />
      </span>
      <span className="cloudlayer__value eclipsi-data">{pct(cover, locale)}</span>
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
function LineOfSightStrip({
  outlook,
  locale,
}: {
  outlook: CloudOutlook;
  locale: Locale;
}) {
  const { sampling } = outlook;
  if (!sampling.slanted) return null;

  return (
    <div className="cloudlos">
      <p className="eclipsi-overline">{ws('los.overline', locale)}</p>
      <p className="cloudlos__text">{describeLineOfSight(outlook, locale)}</p>
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
        <p className="cloudlos__note">{ws('los.truncated', locale)}</p>
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
function ClimatologySpread({
  outlook,
  locale,
}: {
  outlook: CloudOutlook;
  locale: Locale;
}) {
  if (outlook.mode !== 'climatology') return null;
  const { stats, firstYear, lastYear, windowDays } = outlook;
  const n = percent(locale);

  return (
    <div className="cloudclimo">
      <p className="eclipsi-overline">{ws('climo.overline', locale)}</p>
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
        <MetaRow
          label={ws('climo.clearHours', locale)}
          value={pct(stats.clearFraction * 100, locale)}
        />
        <MetaRow
          label={ws('climo.cloudyHours', locale)}
          value={pct(stats.cloudyFraction * 100, locale)}
        />
        <MetaRow
          label={ws('climo.half', locale)}
          value={ws('climo.halfValue', locale, {
            a: n.format(stats.p25),
            b: n.format(stats.p75),
          })}
        />
        <MetaRow
          label={ws('climo.series', locale)}
          value={ws('climo.seriesValue', locale, {
            first: firstYear,
            last: lastYear,
            days: windowDays,
          })}
        />
        <MetaRow
          label={ws('climo.hours', locale)}
          value={ws('climo.hoursValue', locale, {
            n: n.format(stats.sampleCount),
            years: stats.years,
          })}
        />
      </dl>
    </div>
  );
}

/* ---------------------------------------------------------------- component */

/**
 * Entrades que deixen el hook aturat: sense lloc i sense hora no hi ha res a
 * consultar i l'efecte de `useCloudOutlook` surt per la primera branca.
 * Constant de mòdul perquè la identitat no balli entre pintades.
 */
const IDLE: Parameters<typeof useCloudOutlook>[0] = {
  location: null,
  targetTimeMs: null,
  sunAzimuthDeg: null,
  sunAltitudeDeg: null,
};

export function CloudPanel({
  locale,
  location,
  targetTimeMs,
  sunAzimuthDeg,
  sunAltitudeDeg,
  outlook: provided,
  eventLabel,
  className,
}: CloudPanelProps) {
  /*
   * LA REGLA DELS HOOKS, RESOLTA CRIDANT SEMPRE EL HOOK.
   *
   * De les dues sortides possibles —un component intern per a cada cas, o una
   * sola crida amb paràmetres nuls— es tria la segona, i per dues raons:
   *
   *  1. Amb dos components, el dia que la pantalla comenci o deixi de passar
   *     `outlook` (per exemple, mentre encara no té la posició), React
   *     desmuntaria un subarbre i en muntaria un altre: el panell parpellejaria
   *     i perdria l'estat de desplaçament. Amb una sola crida no passa res.
   *  2. La crida en va és PROVADAMENT inerta: amb `location` i `targetTimeMs`
   *     a `null`, `query` és `null`, l'efecte neteja i retorna sense obrir cap
   *     `AbortController` ni cap petició, i el rellotge de l'edat no arrenca
   *     perquè no hi ha `outlook` a envellir. El cost és un `useState` i dos
   *     efectes que no fan res, no una consulta a Open-Meteo.
   */
  const own = useCloudOutlook(
    provided ? IDLE : { location, targetTimeMs, sunAzimuthDeg, sunAltitudeDeg, locale },
  );
  const { outlook, loading, error, online, nowMs, refresh } = provided ?? own;

  const root = className ? `cloudpanel ${className}` : 'cloudpanel';
  const title = ws('title', locale);

  if (!location || targetTimeMs === null) {
    return (
      <section className={root} aria-label={title}>
        <p className="eclipsi-overline">{title}</p>
        <p className="cloudpanel__empty">{ws('empty.noInput', locale)}</p>
      </section>
    );
  }

  if (loading && !outlook) {
    return (
      <section className={root} aria-label={title} aria-busy="true">
        <p className="eclipsi-overline">{title}</p>
        <p className="cloudpanel__empty">{ws('loading', locale)}</p>
      </section>
    );
  }

  if (!outlook) {
    return (
      <section className={root} aria-label={title}>
        <p className="eclipsi-overline">{title}</p>
        <p className="cloudpanel__error">
          {error ?? ws('error.none', locale)}
          {!online && ws('error.offline', locale)}
        </p>
        <button type="button" className="cloudpanel__retry" onClick={refresh}>
          {ws('retry', locale)}
        </button>
      </section>
    );
  }

  const band = outlook.score.band;
  const ageMs = Math.max(0, nowMs - outlook.fetchedAtMs);
  const dominantNote = describeDominantLayer(outlook, locale);
  const hazeNote = describeHaze(outlook, locale);

  return (
    <section
      className={`${root} cloudpanel--${band}`}
      aria-label={title}
      aria-busy={loading || undefined}
    >
      <header className="cloudpanel__head">
        <p className="eclipsi-overline">{title}</p>
        <span className={`cloudbadge cloudbadge--${outlook.mode}`}>
          {ws(outlook.mode === 'forecast' ? 'badge.forecast' : 'badge.climatology', locale)}
        </span>
      </header>

      {outlook.stale && (
        <p className="cloudpanel__stale">
          {ws('stale.lead', locale)}{' '}
          <strong className="eclipsi-data">{describeAgeSince(ageMs, locale)}</strong>.
        </p>
      )}

      <div className="cloudscore">
        <div className="cloudscore__figure">
          <span className="cloudscore__value eclipsi-data">{outlook.score.score}</span>
          <span className="cloudscore__unit eclipsi-data">/100</span>
        </div>
        <div className="cloudscore__text">
          <h3 className="cloudscore__title">{BAND_TITLE[band][locale]}</h3>
          <p className="cloudscore__meaning">{BAND_MEANING[band][locale]}</p>
          {dominantNote && <p className="cloudscore__note">{dominantNote}</p>}
        </div>
      </div>

      <div className="cloudlayers">
        <p className="eclipsi-overline">{ws('layers.overline', locale)}</p>
        {LAYER_ORDER.map((layer) => (
          <LayerRow
            key={layer}
            layer={layer}
            cover={outlook.layers[layer]}
            dominant={outlook.score.dominant === layer}
            locale={locale}
          />
        ))}
        <p className="cloudlayers__legend">{ws('layers.legend', locale)}</p>
        {outlook.score.fromTotalOnly && (
          <p className="cloudlayers__legend cloudlayers__legend--warn">
            {ws('layers.totalOnly', locale)}
          </p>
        )}
      </div>

      <LineOfSightStrip outlook={outlook} locale={locale} />
      <ClimatologySpread outlook={outlook} locale={locale} />

      {hazeNote && <p className="cloudhaze">{hazeNote}</p>}

      <dl className="cloudmeta cloudmeta--foot">
        <MetaRow
          label={eventLabel ?? ws('event.max', locale)}
          value={formatHour(targetTimeMs, locale)}
        />
        {outlook.mode === 'forecast' && (
          <MetaRow
            label={ws('meta.lead', locale)}
            value={describeLead(outlook.leadDays, locale)}
          />
        )}
        <MetaRow
          label={ws('meta.confidence', locale)}
          value={
            locale === 'fr'
              ? CONFIDENCE_FR[outlook.confidence]
              : CONFIDENCE_LABEL[outlook.confidence][locale]
          }
        />
        <MetaRow label={ws('meta.age', locale)} value={describeAge(ageMs, locale)} />
      </dl>

      <p className="cloudpanel__caveat">{outlook.caveat}</p>

      <footer className="cloudpanel__foot">
        <span className="cloudpanel__source">
          {locale === 'fr' ? OPEN_METEO_FR : OPEN_METEO_ATTRIBUTION[locale]}
        </span>
        <button
          type="button"
          className="cloudpanel__retry"
          onClick={refresh}
          disabled={loading}
        >
          {ws(loading ? 'refreshing' : 'refresh', locale)}
        </button>
      </footer>
    </section>
  );
}
