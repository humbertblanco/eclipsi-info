/**
 * Qui publica els punts d'observació oficials, per a l'eclipsi que s'està
 * mirant.
 *
 * PER QUÈ ÉS UN COMPONENT I NO UNA FILA MÉS DE `CREDITS`.
 *
 * Perquè aquesta llista no és fixa: la manen les administracions i canvia per
 * eclipsi. El 12 d'agost de 2026 en són VUIT (Aragó, Astúries, Balears,
 * Castella i Lleó, Catalunya, Madrid, Navarra i la Comunitat Valenciana, amb
 * 274 punts entre totes); el 2 d'agost de 2027 i el 26 de gener de 2028 no en
 * són cap, perquè encara no n'ha publicat ni una (repassat font a font el 3
 * d'agost de 2026, i el motiu de cadascuna és a la capçalera de
 * `data/observation-points/catalog.ts`). Una constant escrita a mà mentiria
 * dos cops de tres i envelliria el dia que Andalusia publiqui els seus.
 *
 * Per això la llista es DERIVA del catàleg amb `observationSourcesFor()`, que
 * recorre els punts i en treu les fonts sense repetits. Afegir un punt d'una
 * administració nova la fa sortir aquí tota sola: no hi ha cap segona llista
 * que es pugui quedar enrere.
 *
 * QUAN NO HI HA CAP FONT, NO PINTA RES —ni el títol. Una capçalera amb una
 * llista buida a sota es llegeix com una cosa que s'ha trencat, i el que passa
 * de debò és que aquell eclipsi encara no té punts oficials. Qui vulgui saber
 * per què, ho troba escrit a «Com funciona»; el bloc de crèdits no és el lloc
 * per explicar una absència.
 *
 * ES MUNTA A DOS LLOCS i per això no depèn de cap dels dos: la pàgina «Com
 * funciona» i el diàleg de crèdits del mapa. Porta el seu full d'estil, que és
 * curt a posta —no arrossega `about.css` cap al paquet del mapa.
 *
 * EL COST, DIT: importa el catàleg dels punts, que són 160 kB de JSON (14 kB
 * comprimits). Els paga qui obre el mapa o «Com funciona», que són dues
 * pantalles carregades amb `React.lazy`, i NO el paquet d'arrencada: el peu
 * només toca `credits.ts`, que no importa res. Que la llista sigui derivada té
 * aquest preu i s'ha triat pagar-lo — una constant de vuit noms no en costaria
 * cap i mentiria el dia que el catàleg canviés.
 */

import type { Locale } from '../../i18n';
import {
  allObservationSources,
  observationSourcesFor,
} from '../../data/observation-points/catalog';
import { OBSERVATION_SOURCES_HEADING, OBSERVATION_SOURCES_NOTE } from './credits';
import './credits.css';

export interface ObservationSourcesProps {
  /**
   * L'eclipsi que s'està mirant, tal com el diu `core/eclipses/catalog.ts`.
   *
   * OPCIONAL, i les dues respostes són correctes: el diàleg del mapa SÍ que
   * mira un eclipsi i ha de llistar les administracions d'aquell —ensenyar-hi
   * les del 2028 mentre es mira el 2026 seria soroll—, i «Com funciona» no en
   * mira cap, perquè explica l'app i no una data: sense identificador, surten
   * totes les del catàleg.
   */
  eclipseId?: string;
  locale: Locale;
}

export function ObservationSources({ eclipseId, locale }: ObservationSourcesProps) {
  const sources =
    eclipseId === undefined ? allObservationSources() : observationSourcesFor(eclipseId);
  if (sources.length === 0) return null;

  return (
    <div className="obssources">
      <p className="obssources__overline">{OBSERVATION_SOURCES_HEADING[locale]}</p>
      <p className="obssources__note">{OBSERVATION_SOURCES_NOTE[locale]}</p>
      <ul className="obssources__list">
        {sources.map((source) => (
          <li key={source.url}>
            {/*
              L'enllaç porta el NOM DE L'ADMINISTRACIÓ i no un «vegeu-ho aquí»:
              la regla 1 del catàleg diu que qui no s'ho cregui ha de poder anar
              a mirar-ho en dos tocs, i per anar-hi cal saber a on vas.
            */}
            <a href={source.url} target="_blank" rel="noreferrer noopener">
              {source.who}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
