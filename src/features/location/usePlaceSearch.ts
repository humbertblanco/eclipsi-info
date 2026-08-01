/**
 * La cerca per nom, lligada al camp de text.
 *
 * PER QUÈ AQUÍ NO HI HA CAP TEMPORITZADOR. El primer instint és posar-hi un
 * `setTimeout` de 300 ms per no disparar una petició per tecla, i seria un
 * error: el mòdul de topònims ja porta la seva política de ritme (espera que
 * qui escriu pari 320 ms i no deixa passar més d'una petició per segon, perquè
 * el servei és gratuït i té condicions d'ús). Un segon temporitzador a sobre no
 * el faria més educat; només sumaria retard damunt del retard i faria que
 * escriure «Peníscola» trigués més de mig segon a respondre sense cap motiu.
 *
 * QUÈ SÍ QUE ES FA AQUÍ, i sense això la llista menteix: descartar les
 * respostes velles. Si la resposta de «Pen» arriba després de la de
 * «Peníscola», el que queda a la pantalla és una llista de llocs equivocats
 * sota el text bo. No és un error visible: és pitjor, perquè sembla correcta.
 * Per això cada consulta porta número de sèrie i només s'aplica la de l'última,
 * i per això `superseded` no toca res.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MIN_QUERY_LENGTH,
  searchPlaces,
  type PlaceHit,
  type SearchOutcome,
} from './geocoder';

export interface PlaceSearchApi {
  query: string;
  setQuery: (next: string) => void;
  hits: readonly PlaceHit[];
  /** Estat de l'última cerca resolta. `null` mentre no s'ha buscat res. */
  outcome: SearchOutcome['status'] | null;
  loading: boolean;
  reset: () => void;
}

export interface UsePlaceSearchOptions {
  /**
   * Punt de referència per ordenar els resultats. Normalment, on ets.
   *
   * NO ÉS COSMÈTICA: hi ha tres Cervera a la península i cinc Villanueva.
   * Sense biaix, el primer resultat de «Cervera» és el que tingui més
   * població, que pot ser a quatre-cents quilòmetres del punt que estàs
   * mirant al mapa.
   */
  biasLat?: number;
  biasLon?: number;
}

export function usePlaceSearch(options: UsePlaceSearchOptions = {}): PlaceSearchApi {
  const { biasLat, biasLon } = options;
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<readonly PlaceHit[]>([]);
  const [outcome, setOutcome] = useState<SearchOutcome['status'] | null>(null);
  const [loading, setLoading] = useState(false);

  /** Número de sèrie de l'última consulta llançada. */
  const ticket = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    ticket.current++;
    setQuery('');
    setHits([]);
    setOutcome(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      ticket.current++;
      setHits([]);
      setOutcome(null);
      setLoading(false);
      return;
    }

    const mine = ++ticket.current;
    setLoading(true);

    void searchPlaces(trimmed, { biasLat, biasLon }).then((result) => {
      if (!alive.current || ticket.current !== mine) return;
      // Una consulta substituïda no ha de tocar res: n'hi ha una de més nova
      // en camí i buidar la llista mentrestant faria pampallugues.
      if (result.status === 'superseded') return;
      setOutcome(result.status);
      setHits(result.status === 'ok' ? result.hits : []);
      setLoading(false);
    });
  }, [query, biasLat, biasLon]);

  return { query, setQuery, hits, outcome, loading, reset };
}
