/**
 * On plantar-se perquè el Sol eclipsat quedi damunt d'un cim.
 *
 * ── PER QUÈ AQUESTA PANTALLA EXISTEIX ───────────────────────────────────────
 *
 * El motor (`core/spots/alignment.ts`) fa una cosa que cap altra aplicació fa:
 * després de trobar el punt per geometria, torna a baixar el raig fins a
 * l'element i comprova que des d'allà es vegi de veritat. Amb el Sol a 2°, la
 * línia sola menteix la meitat de les vegades. Aquest panell és l'única manera
 * que aquell càlcul arribi a algú.
 *
 * ── L'ORDRE DEL FORMULARI ÉS L'ORDRE DE LES DECISIONS ───────────────────────
 *
 * Què vols sota el Sol → quina altura té → en quin moment → com l'enquadres.
 * L'altura va la segona i no l'última perquè és la que la gent no sap que ha de
 * dir: el model del terreny és de terra nua i no porta ni campanars ni arbres,
 * i sense aquell número el resultat seria un punt inventat amb cinc decimals.
 *
 * ── EL BOTÓ, I PER QUÈ NO S'ARRENCA SOL ─────────────────────────────────────
 *
 * El càlcul baixa el relleu de tot el passadís entre el punt i l'element. Al
 * camp això són les dades de l'usuari, i gastar-les sense demanar-ho no es fa.
 * L'avís del cost surt ABANS del botó, que és quan encara es pot decidir.
 *
 * ── UN SOL AMBRE ────────────────────────────────────────────────────────────
 *
 * Mentre no hi ha resultat, l'ambre és del botó, que és l'única cosa a la
 * pantalla. Amb resultat, el botó passa a `secondary` i l'ambre queda per a
 * l'avís que el terreny no s'ha pogut comprovar, que és la xifra que decideix
 * si val la pena el viatge. Mai n'hi ha dos alhora.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { Badge, Button, Card, Input, Select, SegmentedControl } from '../../ui';
import type { GeoLocation } from '../../core/astro/types';
import {
  describeAlignment,
  type AlignmentMoment,
  type AlignmentTarget,
} from '../../core/spots/alignment';
import { formatCoords, mapUrl } from '../spots/format';
import { parseCoords } from '../location/coords';
import { usePlaceSearch } from '../location/usePlaceSearch';
import type { Locale } from '../../i18n';
import { al } from './strings';
import { useAlignment } from './useAlignment';
import './align.css';

/**
 * Radi angular aparent del Sol, en graus.
 *
 * És el que separa «disc centrat a la punta» de «disc recolzat a sobre», i és
 * exactament el que `AlignmentOptions.sunAboveTargetDeg` espera. Varia un 1,7 %
 * al llarg de l'any i aquí no importa: la tolerància de posició que en surt es
 * mesura en desenes de metres.
 */
const SUN_ANGULAR_RADIUS_DEG = 0.26;

type Framing = 'centred' | 'resting';

export interface AlignPanelProps {
  eclipseId: string;
  locale: Locale;
  /** On ets. Serveix per dir-te què et costa arribar al punt trobat. */
  origin: GeoLocation | null;
  /** Fa del punt trobat el punt de l'app. */
  onSelect?: (lat: number, lon: number) => void;
  className?: string;
}

export function AlignPanel({
  eclipseId,
  locale,
  origin,
  onSelect,
  className,
}: AlignPanelProps) {
  const [target, setTarget] = useState<AlignmentTarget | null>(null);
  const [summitText, setSummitText] = useState('');
  const [aboveText, setAboveText] = useState('');
  const [moment, setMoment] = useState<AlignmentMoment>('c2');
  const [framing, setFraming] = useState<Framing>('centred');

  /*
    L'ALTURA ES LLEGEIX EN PRÉMER, NO A CADA TECLA.

    Amb l'objectiu i l'altura al mateix estat, escriure «1.2» al camp de la cota
    passaria per «1» i per «1.» pel camí, i cada valor intermedi seria un
    objectiu diferent. Aquí els camps són text i el número es fa quan es demana
    el càlcul.
  */
  const solvedTarget = useMemo<AlignmentTarget | null>(() => {
    if (target === null) return null;
    const summit = Number.parseFloat(summitText.replace(',', '.'));
    const above = Number.parseFloat(aboveText.replace(',', '.'));
    return {
      ...target,
      summitElevationM: Number.isFinite(summit) ? summit : undefined,
      heightAboveGroundM: Number.isFinite(above) ? above : undefined,
    };
  }, [target, summitText, aboveText]);

  const { status, progress, outcome, terrainChecked, canSolve, solve, cancel } =
    useAlignment({
      eclipseId,
      target: solvedTarget,
      origin,
      options: {
        moment,
        sunAboveTargetDeg: framing === 'resting' ? SUN_ANGULAR_RADIUS_DEG : 0,
      },
    });

  const running = status === 'running';
  const text = outcome === null ? null : describeAlignment(outcome, locale);
  const point = outcome !== null && outcome.ok ? outcome.point : null;

  return (
    <section className={['alignpanel', className ?? ''].filter(Boolean).join(' ')}>
      <header className="alignpanel__head">
        <div>
          <h3 className="alignpanel__title">{al('panel.title', locale)}</h3>
          <p className="alignpanel__lead">{al('panel.lead', locale)}</p>
        </div>
        {/*
          EL BOTÓ NO EXISTEIX FINS QUE HI HA OBJECTIU.

          Abans hi era sempre, desactivat, i era l'únic element ambre de la
          pantalla: l'accent de la vista se l'enduia una acció que no es podia
          fer. Amb la tria per fer, el que ha de cridar l'atenció és el camp de
          cerca, i el que s'ha de fer ja ho diu el formulari.
        */}
        {target !== null &&
          (running ? (
            <Button variant="secondary" icon="timer" onClick={cancel}>
              {al('panel.stop', locale)}
            </Button>
          ) : (
            <Button
              variant={outcome === null ? 'primary' : 'secondary'}
              icon="crosshair"
              onClick={solve}
              disabled={!canSolve}
            >
              {outcome === null ? al('panel.solve', locale) : al('panel.solveAgain', locale)}
            </Button>
          ))}
      </header>

      {target === null ? (
        <TargetPicker locale={locale} origin={origin} onPick={setTarget} />
      ) : (
        <div className="alignpanel__chosen">
          <span className="screen__overline">{al('target.chosen', locale)}</span>
          <p className="alignpanel__chosenname">
            {target.name}
            <span className="eclipsi-data"> · {formatCoords(target.lat, target.lon)}</span>
          </p>
          <Button variant="ghost" size="sm" onClick={() => setTarget(null)}>
            {al('target.clear', locale)}
          </Button>
        </div>
      )}

      {target !== null && (
        <>
          <fieldset className="alignpanel__group">
            <legend className="screen__overline">{al('height.legend', locale)}</legend>
            <Input
              label={al('height.summit', locale)}
              hint={al('height.summitHint', locale)}
              inputMode="decimal"
              value={summitText}
              onChange={setSummitText}
            />
            <Input
              label={al('height.above', locale)}
              hint={al('height.aboveHint', locale)}
              inputMode="decimal"
              value={aboveText}
              onChange={setAboveText}
            />
            <p className="alignpanel__note">{al('height.none', locale)}</p>
          </fieldset>

          <fieldset className="alignpanel__group">
            <legend className="screen__overline">{al('moment.legend', locale)}</legend>
            <Select
              value={moment}
              onChange={setMoment}
              options={(['c1', 'c2', 'max', 'c3', 'c4'] as const).map((m) => ({
                value: m,
                label: al(`moment.${m}`, locale),
              }))}
            />
          </fieldset>

          <fieldset className="alignpanel__group">
            <legend className="screen__overline">{al('framing.legend', locale)}</legend>
            <SegmentedControl
              value={framing}
              onChange={setFraming}
              options={[
                { value: 'centred', label: al('framing.centred', locale) },
                { value: 'resting', label: al('framing.resting', locale) },
              ]}
            />
            <p className="alignpanel__note">{al('framing.hint', locale)}</p>
          </fieldset>
        </>
      )}

      {/* El cost de dades, abans de prémer: després seria una factura. */}
      {target !== null && !running && outcome === null && (
        <p className="alignpanel__note">{al('panel.dataWarning', locale)}</p>
      )}

      {running && progress && (
        <div className="alignpanel__progress">
          <div
            className="alignprogress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.ratio * 100)}
            aria-label={al('panel.progressLabel', locale)}
          >
            <span
              className="alignprogress__fill"
              style={{ width: `${Math.round(progress.ratio * 100)}%` }}
            />
          </div>
          <p className="alignpanel__note">
            {progress.stage === 'tiles'
              ? al('stage.tiles', locale, {
                  done: progress.tilesDone ?? 0,
                  total: progress.tilesTotal ?? 0,
                })
              : al(`stage.${progress.stage}`, locale)}
          </p>
        </div>
      )}

      {status === 'cancelled' && (
        <p className="alignpanel__note">{al('panel.cancelled', locale)}</p>
      )}
      {status === 'error' && <p className="alignpanel__error">{al('panel.failed', locale)}</p>}

      {text !== null && (
        <Card tone="inset" padding="var(--sp-4)" className="alignresult">
          <p className="alignresult__headline">{text.headline}</p>

          {point !== null && (
            <>
              {!terrainChecked && (
                <Badge tone="partial" dot>
                  {al('result.noTerrain', locale)}
                </Badge>
              )}

              <dl className="alignresult__meta">
                <div>
                  <dt>{al('result.coords', locale)}</dt>
                  <dd className="eclipsi-data">{text.coordinates}</dd>
                </div>
              </dl>

              {text.approach && <p className="alignresult__line">{text.approach}</p>}
              {text.terrain && <p className="alignresult__line">{text.terrain}</p>}
              {text.tolerance && <p className="alignresult__line">{text.tolerance}</p>}

              {text.caveats.length > 0 && (
                <ul className="alignresult__caveats">
                  {text.caveats.map((caveat) => (
                    <li key={caveat}>{caveat}</li>
                  ))}
                </ul>
              )}

              <div className="alignresult__actions">
                {onSelect && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="map-pin"
                    onClick={() => onSelect(point.lat, point.lon)}
                  >
                    {al('result.makeMine', locale)}
                  </Button>
                )}
                <CopyCoords lat={point.lat} lon={point.lon} locale={locale} />
                <a
                  className="alignresult__map"
                  href={mapUrl(point.lat, point.lon)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {al('result.openMap', locale)}
                </a>
              </div>
            </>
          )}
        </Card>
      )}
    </section>
  );
}

/**
 * Tria de l'objectiu: pel nom o per coordenades.
 *
 * Les dues vies hi són perquè responen a dues situacions: a casa es busca «Peña
 * Ubiña» i el cercador de topònims el troba; al camp, sense cobertura, el
 * cercador no serveix i el que hi ha és un punt del mapa i unes coordenades.
 * `usePlaceSearch` i `parseCoords` són els mateixos que fa servir la fulla
 * d'ubicació: no se'n fa una segona versió.
 */
function TargetPicker({
  locale,
  origin,
  onPick,
}: {
  locale: Locale;
  origin: GeoLocation | null;
  onPick: (target: AlignmentTarget) => void;
}) {
  const search = usePlaceSearch({ biasLat: origin?.lat, biasLon: origin?.lon });
  const [coordText, setCoordText] = useState('');
  const [nameText, setNameText] = useState('');
  const [coordError, setCoordError] = useState(false);

  const submitCoords = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseCoords(coordText);
    if (parsed === null) {
      setCoordError(true);
      return;
    }
    setCoordError(false);
    onPick({
      name: nameText.trim() || al('target.namePlaceholder', locale),
      lat: parsed.lat,
      lon: parsed.lon,
    });
  };

  return (
    <div className="alignpicker">
      <Input
        icon="search"
        type="search"
        label={al('target.search', locale)}
        hint={al('target.searchHint', locale)}
        value={search.query}
        onChange={search.setQuery}
      />

      {search.loading && <p className="alignpanel__note">{al('target.searching', locale)}</p>}
      {!search.loading && search.outcome === 'empty' && (
        <p className="alignpanel__note">{al('target.noHits', locale)}</p>
      )}

      {search.hits.length > 0 && (
        <ul className="alignpicker__hits">
          {search.hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className="alignpicker__hit"
                onClick={() => onPick({ name: hit.name, lat: hit.lat, lon: hit.lon })}
              >
                <span className="alignpicker__hitname">{hit.name}</span>
                {hit.detail && <span className="alignpicker__hitdetail">{hit.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="alignpicker__coords" onSubmit={submitCoords}>
        <Input
          label={al('target.coords', locale)}
          hint={coordError ? undefined : al('target.coordsHint', locale)}
          error={coordError ? al('target.coordsBad', locale) : undefined}
          inputMode="decimal"
          value={coordText}
          onChange={(next) => {
            setCoordText(next);
            setCoordError(false);
          }}
        />
        <Input
          label={al('target.name', locale)}
          placeholder={al('target.namePlaceholder', locale)}
          value={nameText}
          onChange={setNameText}
        />
        <Button type="submit" variant="secondary" size="sm">
          {al('target.use', locale)}
        </Button>
      </form>
    </div>
  );
}

/** Botó de copiar amb confirmació breu. Al camp es prem amb guants i sense mirar. */
function CopyCoords({ lat, lon, locale }: { lat: number; lon: number; locale: Locale }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const clipboard = navigator.clipboard;
    if (!clipboard) return;
    void clipboard.writeText(formatCoords(lat, lon)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button variant="secondary" size="sm" icon="crosshair" onClick={copy}>
      {copied ? al('result.copied', locale) : al('result.copy', locale)}
    </Button>
  );
}
