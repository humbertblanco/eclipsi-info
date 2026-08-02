/**
 * «Els tres eclipsis, des d'aquí»: els tres del catàleg, CALCULATS per al punt
 * de l'usuari, un al costat de l'altre.
 *
 * PER QUÈ EXISTEIX. Qualsevol web publica una taula amb els tres eclipsis de la
 * dècada i les seves xifres globals. Aquesta pantalla respon una altra pregunta:
 * quin dels tres et convé A TU, des d'on seràs. I la resposta canvia amb el
 * punt, perquè el que decideix un eclipsi de Sol baix no és la geometria de
 * l'ombra sinó el que tens a l'horitzó.
 *
 * LA CLAU QUE HO FA POSSIBLE, I QUE VA SEMBLAR UN DETALL FINS QUE ES VA VEURE:
 * el perfil d'horitzó depèn NOMÉS DEL LLOC, no de l'eclipsi. És un relleu de
 * 360° al voltant d'un punt; l'eclipsi no el canvia. O sigui que el `horizon`
 * que `EclipseContext` ja porta calculat per a l'eclipsi seleccionat serveix
 * exactament igual per als altres dos, sense baixar ni una tessel·la més. Això
 * permet dir, amb el mateix perfil i en la mateixa targeta, que el 2026 el
 * terreny se't menja mig minut de totalitat i que el 2027 el Sol és tan alt que
 * el relleu no hi pinta res. Sense el perfil, aquesta comparació no es pot fer.
 *
 * ON ES TALLA LA LÍNIA ENTRE CÀLCUL I REDACCIÓ: `buildEclipseRows` no torna ni
 * una frase, només dades, i es pot importar des de Node sense DOM (és el que
 * prova `threeEclipses.test.ts`). Tot el text el munta el component amb `s()` i
 * amb els formats que ja té el projecte. És la mateixa separació que va caldre
 * imposar a `computeVisibility` quan el seu `summary` sortia en català per
 * construcció i es pintava tal qual amb l'app en castellà.
 *
 * QUÈ NO FA AQUESTA PANTALLA: decidir per compte propi si es pot mirar sense
 * filtre. La frase de seguretat de cada fila surt de `canRemoveFilter` i de la
 * taula `FILTER_GATE_NOTE`, sense excepció. Vegeu ESTAT.md §3.1: la comporta ha
 * estat codi mort dues vegades, i el segon cop va ser precisament perquè una
 * pantalla —aquesta mateixa, la de la guia— es va escriure la seva pròpia regla
 * i va acabar anunciant set minuts segurs per a un eclipsi ANULAR.
 */

import { useMemo } from 'react';
import { Badge, Card, Stat } from '../ui';
import { canRemoveFilter, FILTER_GATE_NOTE, type FilterGate } from '../core/timer';
import { computeLocalCircumstances } from '../core/astro/contacts';
import { computeVisibility } from '../core/visibility/verdict';
import { ECLIPSES } from '../core/eclipses/catalog';
import { formatObscurationPercent } from '../core/astro/obscuration';
import type { EclipseKind, GeoLocation } from '../core/astro/types';
import type { HorizonProfile } from '../core/horizon/profile';
import type { Locale } from '../i18n';
import type { EclipseContext } from './context';
import { formatClockShort, formatDegrees, formatDuration } from './format';
import { s, type StringKey } from './strings';
import './screens.css';

/**
 * Una fila de la comparació: NOMÉS DADES.
 *
 * Els camps que poden ser `null` ho són sempre pel mateix motiu —encara no hi
 * ha perfil d'horitzó— i no s'han de substituir per zeros. Un zero aquí es
 * llegiria com «el terreny no et pren res», que és justament la conclusió que
 * no tenim dret a donar mentre el relleu no s'ha calculat.
 */
export interface EclipseRow {
  id: string;
  /**
   * Tipus d'eclipsi DES D'AQUEST PUNT, que no és el del catàleg: el 2026 és
   * total al Canon i parcial des de Sevilla.
   */
  kind: EclipseKind;
  /** Instant del màxim local, en ms d'època. */
  maxTimeMs: number;
  /** Altura APARENT del Sol al màxim: la que es compara amb el terreny. */
  sunAltitudeDeg: number;
  /** Obscuració al màxim, sense mirar el relleu. */
  obscurationAtMax: number;
  /** Cert si des d'aquí hi ha totalitat o anularitat de veritat. */
  hasCentral: boolean;
  /** Durada teòrica de la fase central, en segons. Zero si no n'hi ha. */
  centralTotalSec: number;
  /** La que sobreviu al relleu. `null` mentre no hi ha perfil d'horitzó. */
  centralVisibleSec: number | null;
  centralLostSec: number | null;
  /** Altura del terreny a l'azimut del màxim. `null` sense perfil. */
  horizonAltitudeAtMaxDeg: number | null;
  /** Cert si al màxim el Sol és per damunt del terreny. `null` sense perfil. */
  maxVisible: boolean | null;
  /** Obscuració màxima que sobreviu al relleu. `null` sense perfil. */
  visibleObscuration: number | null;
  /** El veredicte de la comporta de seguretat ocular, amb el seu motiu. */
  gate: FilterGate;
}

/**
 * Els tres eclipsis del catàleg resolts per a un punt.
 *
 * Cap dependència del DOM ni de React a posta: és la part que es prova.
 *
 * COST: tres cerques d'arrels de contactes i, si hi ha perfil, tres escombrats
 * de visibilitat. És car i per això la crida va dins d'un `useMemo`; també és
 * el motiu pel qual no es refà quan l'usuari canvia d'eclipsi seleccionat, que
 * no mou cap d'aquests números.
 */
export function buildEclipseRows(
  location: GeoLocation,
  horizon: HorizonProfile | null,
): EclipseRow[] {
  return ECLIPSES.map((entry) => {
    const circumstances = computeLocalCircumstances(entry.id, location);
    const verdict = horizon === null ? null : computeVisibility(circumstances, horizon);
    const { contacts } = circumstances;

    /*
     * LA COMPORTA, PER A CADA ECLIPSI. Es construeix igual que a la resta de
     * l'app: el tipus i els contactes de les circumstàncies locals, el terreny
     * només quan hi ha veredicte (si no, `undefined`, que és el que la comporta
     * espera quan encara no se sap) i la incertesa del caire tal com surt del
     * motor. Cap condició escrita aquí.
     */
    const gate = canRemoveFilter({
      kind: circumstances.kind,
      contacts: {
        c1: contacts.c1?.time.getTime(),
        c2: contacts.c2?.time.getTime(),
        max: contacts.max.time.getTime(),
        c3: contacts.c3?.time.getTime(),
        c4: contacts.c4?.time.getTime(),
      },
      centralPhaseVisible: verdict === null ? undefined : verdict.centralVisibleSec > 0,
      edgeUncertain: circumstances.edgeUncertain,
    });

    return {
      id: entry.id,
      kind: circumstances.kind,
      maxTimeMs: contacts.max.time.getTime(),
      sunAltitudeDeg: contacts.max.sun.altitudeApparent,
      obscurationAtMax: contacts.max.obscuration,
      hasCentral: circumstances.centralDurationSec > 0,
      centralTotalSec: circumstances.centralDurationSec,
      centralVisibleSec: verdict === null ? null : verdict.centralVisibleSec,
      centralLostSec: verdict === null ? null : verdict.centralLostSec,
      horizonAltitudeAtMaxDeg: verdict === null ? null : verdict.horizonAltitudeAtMaxDeg,
      maxVisible: verdict === null ? null : verdict.maxVisible,
      visibleObscuration: verdict === null ? null : verdict.maxVisibleObscuration,
      gate,
    };
  });
}

/** Etiqueta del tipus d'eclipsi vist des d'aquí. */
const KIND_KEY: Record<EclipseKind, StringKey> = {
  total: 'kind.total',
  annular: 'kind.annular',
  partial: 'kind.partial',
  none: 'kind.none',
};

/**
 * La frase que explica què hi fa el terreny en aquest eclipsi, des d'aquest
 * punt. És la conclusió de la fila i per això va sencera i no per trossos: qui
 * la llegeix està comparant tres eclipsis i no vol reconstruir una resta.
 */
function terrainLine(row: EclipseRow, locale: Locale): string {
  if (row.kind === 'none') return s('verdict.noEclipse', locale);
  /*
   * Sense perfil no es diu res del relleu: es diu que encara no s'ha mirat.
   * Els tres camps es comproven un per un i no amb un de sol perquè així la
   * frase de sota no necessita cap valor de reserva: un `?? 0` en l'altura del
   * terreny escriuria «terreny a 0,0°», que és una mesura, i aquí no n'hi ha.
   */
  if (
    row.centralLostSec === null ||
    row.maxVisible === null ||
    row.horizonAltitudeAtMaxDeg === null
  ) {
    return s('three.terrainPending', locale);
  }
  if (!row.maxVisible) return s('three.maxBlocked', locale);
  if (row.centralLostSec > 0) {
    return s('three.terrainEats', locale, {
      lost: formatDuration(row.centralLostSec),
      total: formatDuration(row.centralTotalSec),
    });
  }
  if (!row.hasCentral) {
    /*
     * Fora de la franja, la xifra que importa és l'obscuració, i es diu amb la
     * funció del nucli. `isCentral` va a fals perquè aquí NO hi ha fase
     * central: és exactament el cas que la regla del 99,7 % vigila, i el que
     * fa que amb obscuracions de 0,9997 s'escriguin els decimals que calguin
     * en comptes d'un «100 %» que faria treure ulleres a algú.
     */
    const fraction = row.visibleObscuration ?? row.obscurationAtMax;
    return s('three.noCentral', locale, {
      pct: formatObscurationPercent(fraction, false),
    });
  }
  return s('three.terrainClear', locale, {
    alt: formatDegrees(row.sunAltitudeDeg, locale),
    horizon: formatDegrees(row.horizonAltitudeAtMaxDeg, locale),
  });
}

export type ThreeEclipsesProps = Pick<
  EclipseContext,
  'eclipseId' | 'locale' | 'location' | 'horizon'
>;

export function ThreeEclipses({ eclipseId, locale, location, horizon }: ThreeEclipsesProps) {
  /*
   * DEPÈN DEL LLOC I DEL PERFIL, I DE RES MÉS.
   *
   * `eclipseId` no hi és a posta: canviar d'eclipsi seleccionat només canvia
   * quina fila porta la insígnia, i posar-lo a les dependències refaria les
   * tres cerques d'arrels cada cop que l'usuari toca el selector de la
   * capçalera. `horizon` sí que hi ha de ser, encara que arribi tard: és el que
   * converteix les durades teòriques en les de debò, i sense ell la targeta es
   * quedaria per sempre dient «el perfil encara no està calculat».
   */
  const rows = useMemo(
    () => (location === null ? null : buildEclipseRows(location, horizon)),
    [location, horizon],
  );

  return (
    <Card>
      <span className="screen__overline">{s('three.title', locale)}</span>
      <p className="screen__note">{s('three.intro', locale)}</p>

      {rows === null ? (
        <p className="screen__note">{s('common.locateCta', locale)}</p>
      ) : (
        <ul className="threeecl">
          {rows.map((row) => {
            const entry = ECLIPSES.find((e) => e.id === row.id);
            if (entry === undefined) return null;
            const current = row.id === eclipseId;
            return (
              <li
                key={row.id}
                className={
                  current ? 'threeecl__item threeecl__item--current' : 'threeecl__item'
                }
              >
                <div className="threeecl__head">
                  <h3 className="threeecl__name">{entry.label[locale]}</h3>
                  <div className="threeecl__badges">
                    {/* Tons neutres i d'informació: l'ambre d'aquesta pantalla
                        ja el gasta l'avís de seguretat de dalt de tot, i el to
                        `partial` és el mateix hexadecimal que l'accent. */}
                    <Badge tone="neutral">{s(KIND_KEY[row.kind], locale)}</Badge>
                    {current && <Badge tone="info">{s('three.selected', locale)}</Badge>}
                  </div>
                </div>

                <div className="threeecl__stats">
                  <Stat
                    size="sm"
                    label={s('three.max', locale)}
                    value={formatClockShort(new Date(row.maxTimeMs), locale)}
                  />
                  <Stat
                    size="sm"
                    label={s('home.sunAltitude', locale)}
                    value={formatDegrees(row.sunAltitudeDeg, locale)}
                  />
                  {row.hasCentral ? (
                    <>
                      <Stat
                        size="sm"
                        label={s('home.theoreticalDuration', locale)}
                        value={formatDuration(row.centralTotalSec)}
                      />
                      {/* La durada que sobreviu al relleu només es pinta quan
                          existeix de debò. Pintar-hi la teòrica amb l'etiqueta
                          «visible» mentre no hi ha perfil seria dir que el
                          terreny no en pren res sense haver-ho mirat. */}
                      {row.centralVisibleSec !== null && (
                        <Stat
                          size="sm"
                          label={s('home.visibleDuration', locale)}
                          value={formatDuration(row.centralVisibleSec)}
                        />
                      )}
                    </>
                  ) : (
                    <Stat
                      size="sm"
                      label={s('home.obscuration', locale)}
                      value={formatObscurationPercent(
                        row.visibleObscuration ?? row.obscurationAtMax,
                        false,
                      )}
                    />
                  )}
                </div>

                <p className="screen__note">{terrainLine(row, locale)}</p>

                {/* LA FRASE DEL FILTRE, TAL COM SURT DE LA COMPORTA. No es
                    compon, no es resumeix i no es tria per tipus d'eclipsi:
                    s'indexa pel motiu que ha donat `canRemoveFilter`. */}
                <p className="threeecl__gate">
                  {FILTER_GATE_NOTE[row.gate.reason][locale]}
                </p>

                {/* Els consells són opcionals al catàleg (vegeu-hi el
                    comentari de `tips`): les entrades de validació no en
                    tenen. Sense consells, la fila segueix dient tot el que
                    importa, que és el que s'ha calculat. */}
                {entry.tips !== undefined && (
                  <ul className="threeecl__tips">
                    {entry.tips[locale].map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
