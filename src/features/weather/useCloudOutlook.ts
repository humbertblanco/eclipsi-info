/**
 * Enganxa el nucli de nuvolositat amb React.
 *
 * Dues coses que semblen detalls i no ho són:
 *
 * 1. Les entrades s'ARRODONEIXEN abans d'entrar a les dependències de
 *    l'efecte. El GPS et fa ballar la posició uns quants metres cada segon i
 *    l'azimut del Sol canvia a cada re-render; sense arrodonir, cada
 *    tremolor dispararia una petició nova a una API gratuïta que ens deixa
 *    gastar deu mil peticions al dia. Arrodonim a 100 m, a 1° d'azimut i a
 *    l'hora, que és molt més fi que la malla del model.
 *
 * 2. Hi ha un rellotge propi que va avançant. L'edat de la dada s'ha
 *    d'ensenyar sempre i ha d'anar envellint sola a la pantalla: "fa 2 min"
 *    que es queda congelat en "fa 2 min" durant mitja hora és una mentida.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GeoLocation } from '../../core/astro/types';
import { CloudOutlookError, getCloudOutlook, type CloudOutlook } from '../../core/weather';

export interface UseCloudOutlookParams {
  /** `null` mentre no sabem on és l'usuari. */
  location: GeoLocation | null;
  /** Instant del màxim de l'eclipsi, en ms d'època. `null` si encara no es sap. */
  targetTimeMs: number | null;
  /** Azimut del Sol en aquell instant, en graus. */
  sunAzimuthDeg: number | null;
  /** Altura APARENT del Sol en aquell instant, en graus. */
  sunAltitudeDeg: number | null;
}

export interface UseCloudOutlookResult {
  outlook: CloudOutlook | null;
  loading: boolean;
  /** Missatge en català, ja llest per pintar. `null` si tot ha anat bé. */
  error: string | null;
  /** Estat de la connexió, per poder-ho dir abans que falli res. */
  online: boolean;
  /** Rellotge que avança sol, per calcular l'edat de la dada. */
  nowMs: number;
  /** Torna a consultar saltant-se la memòria cau. */
  refresh: () => void;
}

/** Cada mig minut n'hi ha prou perquè el text de l'edat no menteixi. */
const AGE_TICK_MS = 30_000;

function useOnline(): boolean {
  const [online, setOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine !== false,
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return online;
}

export function useCloudOutlook(params: UseCloudOutlookParams): UseCloudOutlookResult {
  const { location, targetTimeMs, sunAzimuthDeg, sunAltitudeDeg } = params;

  const [outlook, setOutlook] = useState<CloudOutlook | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [reloadToken, setReloadToken] = useState(0);
  const forceNext = useRef(false);
  const online = useOnline();

  // Entrades arrodonides: aquestes són les dependències reals de l'efecte.
  const query = useMemo(() => {
    if (
      !location ||
      targetTimeMs === null ||
      sunAzimuthDeg === null ||
      sunAltitudeDeg === null
    ) {
      return null;
    }
    return {
      lat: Math.round(location.lat * 1000) / 1000,
      lon: Math.round(location.lon * 1000) / 1000,
      elevation: Math.round(location.elevation),
      hour: Math.round(targetTimeMs / 3_600_000),
      az: Math.round(sunAzimuthDeg),
      alt: Math.round(sunAltitudeDeg * 2) / 2,
    };
  }, [location, targetTimeMs, sunAzimuthDeg, sunAltitudeDeg]);

  /**
   * La clau de l'efecte. L'ALTITUD NO HI ÉS, a diferència de la resta.
   *
   * Cada tria de lloc fixa el punt dues vegades: primer amb l'altitud a zero
   * mentre es baixa la tessel·la del terreny i després amb la de debò (vegeu
   * `state/observerFlow.ts`). Amb l'altitud a la clau, això eren dues consultes
   * seguides a una API gratuïta amb quota diària, i la primera s'abortava a
   * mitges: el panell parpellejava de «carregant» a «carregant» sense que la
   * posició s'hagués mogut ni un metre.
   *
   * Es pot treure perquè no la mira ningú riu avall: el punt que va a Open-Meteo
   * és només `{ lat, lon }` i la clau de la memòria cau del nucli tampoc no la
   * porta. El mateix lloc amb 0 m o amb 1.520 m torna exactament la mateixa
   * predicció. L'altitud segueix viatjant dins de `location` perquè la resposta
   * la retorna enganxada, però no ha de disparar cap consulta.
   */
  const key = query
    ? `${query.lat},${query.lon},${query.hour},${query.az},${query.alt}`
    : null;

  useEffect(() => {
    if (!query) {
      setOutlook(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const force = forceNext.current;
    forceNext.current = false;

    setLoading(true);
    setError(null);

    getCloudOutlook(
      {
        location: { lat: query.lat, lon: query.lon, elevation: query.elevation },
        targetTimeMs: query.hour * 3_600_000,
        sunAzimuthDeg: query.az,
        sunAltitudeDeg: query.alt,
      },
      { signal: controller.signal, forceRefresh: force },
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        setOutlook(result);
        setNowMs(Date.now());
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setOutlook(null);
        setError(
          cause instanceof CloudOutlookError
            ? cause.message
            : 'No s’ha pogut obtenir la nuvolositat',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // `key` resumeix totes les entrades arrodonides; `query` canvia d'identitat
    // però no de contingut, i seguir-lo dispararia peticions per no res.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloadToken]);

  // El rellotge només corre mentre hi ha alguna cosa a envellir.
  useEffect(() => {
    if (!outlook) return;
    const timer = setInterval(() => setNowMs(Date.now()), AGE_TICK_MS);
    return () => clearInterval(timer);
  }, [outlook]);

  const refresh = useCallback(() => {
    forceNext.current = true;
    setReloadToken((n) => n + 1);
  }, []);

  return { outlook, loading, error, online, nowMs, refresh };
}
