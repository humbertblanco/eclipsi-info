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
import { formatBytes, formatCount, formatMs, formatRatio } from './format';
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

const STAGE_LABEL: Record<Exclude<SpotSearchStage, 'done'>, string> = {
  grid: 'Graella de candidats',
  astro: 'A · Astronomia barata',
  tiles: 'B · Tessel·les compartides',
  sieve: 'C · Garbell d’horitzó',
  refineTiles: 'D1 · Tessel·les dels finalistes',
  refine: 'D2 · Càlcul complet',
};

const STAGES = Object.keys(STAGE_LABEL) as Exclude<SpotSearchStage, 'done'>[];

function megabytes(tiles: number): string {
  return formatBytes(tiles * TILE_BYTES);
}

export interface SpotFunnelCostProps {
  cost: SpotSearchCost;
  /** Candidats de la graella inicial. Serveix per llegir les files per candidat. */
  candidates: number;
  className?: string;
}

export function SpotFunnelCost({ cost, candidates, className }: SpotFunnelCostProps) {
  return (
    <details className={['spotcost', className ?? ''].filter(Boolean).join(' ')}>
      <summary className="spotcost__summary">
        <span className="eclipsi-overline">Cost de l’embut</span>
        <span className="eclipsi-data">
          {formatMs(cost.totalMs)} · {formatCount(cost.uniqueTiles)} tessel·les
        </span>
      </summary>

      <div className="spotcost__scroll">
        <table className="spotcost__table">
          <thead>
            <tr>
              <th scope="col">Etapa</th>
              <th scope="col">Entren</th>
              <th scope="col">Surten</th>
              <th scope="col">Temps</th>
              <th scope="col">Efemèrides</th>
              <th scope="col">Mostres</th>
              <th scope="col">Tessel·les</th>
            </tr>
          </thead>
          <tbody>
            {STAGES.map((stage) => {
              const row = cost[stage];
              return (
                <tr key={stage}>
                  <th scope="row">{STAGE_LABEL[stage]}</th>
                  <td className="eclipsi-data">{formatCount(row.entered)}</td>
                  <td className="eclipsi-data">{formatCount(row.survived)}</td>
                  <td className="eclipsi-data">{formatMs(row.ms)}</td>
                  <td className="eclipsi-data">{formatCount(row.ephemerisCalls)}</td>
                  <td className="eclipsi-data">{formatCount(row.terrainSamples)}</td>
                  <td className="eclipsi-data">{formatCount(row.tiles)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <dl className="spotcost__totals">
        <div>
          <dt>Candidats</dt>
          <dd className="eclipsi-data">{formatCount(candidates)}</dd>
        </div>
        <div>
          <dt>Temps total</dt>
          <dd className="eclipsi-data">{formatMs(cost.totalMs)}</dd>
        </div>
        <div>
          <dt>Tessel·les baixades</dt>
          <dd className="eclipsi-data">
            {formatCount(cost.uniqueTiles)} · {megabytes(cost.uniqueTiles)}
          </dd>
        </div>
        <div>
          <dt>Si es fes candidat a candidat</dt>
          <dd className="eclipsi-data">
            {formatCount(cost.tilesIfNaive)} · {megabytes(cost.tilesIfNaive)}
          </dd>
        </div>
        <div>
          <dt>Estalvi de xarxa</dt>
          <dd className="eclipsi-data">
            {formatRatio(cost.uniqueTiles, cost.tilesIfNaive)}
          </dd>
        </div>
        <div>
          <dt>Estalvi de terreny</dt>
          <dd className="eclipsi-data">
            {formatRatio(
              cost.sieve.terrainSamples + cost.refine.terrainSamples,
              cost.terrainSamplesIfNaive,
            )}
          </dd>
        </div>
      </dl>

      <p className="spotcost__note">
        Els números de la dreta són el que costaria calcular el perfil complet de
        cada candidat un per un. Si l’estalvi baixa d’unes cent vegades, val la
        pena tornar a mirar els paràmetres del garbell.
      </p>
    </details>
  );
}
