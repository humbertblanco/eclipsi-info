/**
 * El cost de l'embut, per a qui en toqui els paràmetres.
 *
 * No és una mètrica de vanitat. L'embut existeix perquè el camí ingenu costa
 * 10 GB de xarxa, i qualsevol canvi de radi, de pas de graella o d'anells del
 * garbell pot fer-lo tornar a costar això sense que res peti: només aniria molt
 * a poc a poc i es menjaria les dades de l'usuari. Aquesta taula és l'única
 * manera de veure-ho al moment.
 *
 * Es plega dins d'un `<details>` perquè no és informació per a qui busca un
 * lloc on plantar-se, i s'ensenya sencera perquè qui l'obre la vol sencera.
 */

import type { SpotSearchCost, SpotSearchStage } from '../../core/spots/types';
import type { Locale } from '../../i18n';
import { formatBytes, formatCount, formatMs, formatRatio } from './format';
import { sp } from './strings';
import './spots.css';

/**
 * Pes mitjà d'una tessel·la terrarium, mesurat.
 *
 * Una tessel·la z11 de la península en pesa 125 kB (mesurat a
 * s3.amazonaws.com/elevation-tiles-prod/terrarium/11/1018/770.png). Sobre
 * execucions senceres amb `scripts/spots-cost.ts`, la mitjana va de 73 kB
 * (Peníscola, molt de mar) a 121 kB (Sòria, tot muntanya). 120 kB és el cas
 * dolent: serveix per veure l'ordre de magnitud del que baixa l'usuari, no per
 * facturar-li res.
 */
const TILE_BYTES = 120 * 1024;

const STAGES: Exclude<SpotSearchStage, 'done'>[] = [
  'grid',
  'astro',
  'tiles',
  'sieve',
  'refineTiles',
  'refine',
];

function megabytes(tiles: number, locale: Locale): string {
  return formatBytes(tiles * TILE_BYTES, locale);
}

export interface SpotFunnelCostProps {
  cost: SpotSearchCost;
  /** Candidats de la graella inicial. Serveix per llegir les files per candidat. */
  candidates: number;
  locale: Locale;
  className?: string;
}

export function SpotFunnelCost({ cost, candidates, locale, className }: SpotFunnelCostProps) {
  return (
    <details className={['spotcost', className ?? ''].filter(Boolean).join(' ')}>
      <summary className="spotcost__summary">
        <span className="eclipsi-overline">{sp('cost.title', locale)}</span>
        <span className="eclipsi-data">
          {formatMs(cost.totalMs, locale)} · {formatCount(cost.uniqueTiles, locale)}{' '}
          {sp('cost.tiles', locale)}
        </span>
      </summary>

      <div className="spotcost__scroll">
        <table className="spotcost__table">
          <thead>
            <tr>
              <th scope="col">{sp('cost.stage', locale)}</th>
              <th scope="col">{sp('cost.in', locale)}</th>
              <th scope="col">{sp('cost.out', locale)}</th>
              <th scope="col">{sp('cost.time', locale)}</th>
              <th scope="col">{sp('cost.ephemeris', locale)}</th>
              <th scope="col">{sp('cost.samples', locale)}</th>
              <th scope="col">{sp('cost.tilesCol', locale)}</th>
            </tr>
          </thead>
          <tbody>
            {STAGES.map((stage) => {
              const row = cost[stage];
              return (
                <tr key={stage}>
                  <th scope="row">{sp(`cost.stage.${stage}`, locale)}</th>
                  <td className="eclipsi-data">{formatCount(row.entered, locale)}</td>
                  <td className="eclipsi-data">{formatCount(row.survived, locale)}</td>
                  <td className="eclipsi-data">{formatMs(row.ms, locale)}</td>
                  <td className="eclipsi-data">{formatCount(row.ephemerisCalls, locale)}</td>
                  <td className="eclipsi-data">{formatCount(row.terrainSamples, locale)}</td>
                  <td className="eclipsi-data">{formatCount(row.tiles, locale)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <dl className="spotcost__totals">
        <div>
          <dt>{sp('cost.candidates', locale)}</dt>
          <dd className="eclipsi-data">{formatCount(candidates, locale)}</dd>
        </div>
        <div>
          <dt>{sp('cost.totalTime', locale)}</dt>
          <dd className="eclipsi-data">{formatMs(cost.totalMs, locale)}</dd>
        </div>
        <div>
          <dt>{sp('cost.downloaded', locale)}</dt>
          <dd className="eclipsi-data">
            {formatCount(cost.uniqueTiles, locale)} · {megabytes(cost.uniqueTiles, locale)}
          </dd>
        </div>
        <div>
          <dt>{sp('cost.naive', locale)}</dt>
          <dd className="eclipsi-data">
            {formatCount(cost.tilesIfNaive, locale)} · {megabytes(cost.tilesIfNaive, locale)}
          </dd>
        </div>
        <div>
          <dt>{sp('cost.netSaving', locale)}</dt>
          <dd className="eclipsi-data">
            {formatRatio(cost.uniqueTiles, cost.tilesIfNaive, locale)}
          </dd>
        </div>
        <div>
          <dt>{sp('cost.terrainSaving', locale)}</dt>
          <dd className="eclipsi-data">
            {formatRatio(
              cost.sieve.terrainSamples + cost.refine.terrainSamples,
              cost.terrainSamplesIfNaive,
              locale,
            )}
          </dd>
        </div>
      </dl>

      <p className="spotcost__note">{sp('cost.note', locale)}</p>
    </details>
  );
}
