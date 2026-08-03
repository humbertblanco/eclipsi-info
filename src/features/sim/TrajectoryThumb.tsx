/*
 * La trajectòria del Sol contra el terreny, en miniatura i sense cap slider.
 *
 * És EXACTAMENT el mateix dibuix que la targeta de compartir i que la
 * miniatura de l'historial: `renderTrajectory` en mode `mini`. Que el panell
 * del mapa, la targeta i l'historial ensenyin la mateixa silueta no és
 * estètica, és el que fa que totes les portes de l'app parlin del mateix
 * lloc. Aquí serveix per respondre, des del mapa mateix, la pregunta que fins
 * ara obligava a canviar de pantalla: «i des d'aquest punt, com hi passa el
 * Sol?».
 *
 * NO PORTA RELLOTGE. La simulació amb barra de temps viu al compte enrere,
 * que és la pantalla d'aprofundir-hi; duplicar-la aquí seria tenir dos
 * rellotges per al mateix cel (la mateixa raó per la qual ARView va passar a
 * acceptar el temps de fora, vegeu ESTAT.md §6).
 */

import { useEffect, useMemo, useRef } from 'react';

import type { GeoLocation, LocalCircumstances } from '../../core/astro/types';
import { horizonSampler, type HorizonProfile } from '../../core/horizon/profile';
import type { Locale } from '../../i18n';
import { renderTrajectory } from './renderTrajectory';
import { MINI_TRAJECTORY_SAMPLES, trajectorySamples } from './samples';

interface Props {
  circumstances: LocalCircumstances;
  /** La MATEIXA ubicació amb què s'han calculat les circumstàncies. */
  location: GeoLocation;
  /** Perfil del terreny; sense ell la silueta surt discontínua (assumida). */
  horizon: HorizonProfile | null;
  locale: Locale;
}

export function TrajectoryThumb({ circumstances, location, horizon, locale }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Prou mostres per a una carena llegible, poques per no notar-se al tacte:
  // el mateix recompte que la miniatura de l'historial.
  const samples = useMemo(
    () => trajectorySamples(circumstances, location, MINI_TRAJECTORY_SAMPLES),
    [circumstances, location],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      // Densitat real del dispositiu: sense això la carena surt borrosa en
      // pantalles d'alta densitat, que són totes les de mòbil.
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx === null) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      renderTrajectory(ctx, circumstances, samples, width, height, {
        locale,
        chrome: 'mini',
        terrain: horizon !== null ? 'measured' : 'assumed',
        horizonProfile: horizon !== null ? horizonSampler(horizon) : undefined,
      });
    };

    draw();
    // El panell canvia d'amplada entre el full de mòbil i la columna fixa
    // d'escriptori: es redibuixa quan la caixa es mou, no a cada fotograma.
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [circumstances, samples, horizon, locale]);

  return (
    <canvas
      ref={canvasRef}
      className="trajthumb"
      role="img"
      aria-hidden="true"
    />
  );
}
