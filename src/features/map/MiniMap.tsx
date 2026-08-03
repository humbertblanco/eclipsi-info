/*
 * El mini-mapa de la portada: la franja i el teu punt, d'un cop d'ull.
 *
 * NO ÉS MAPLIBRE, A POSTA. El compte enrere és la primera pintada i la
 * decisió que el mapa de debò viatgi en un tros mandrós és sagrada (vegeu
 * App.tsx): aquí la cartografia és UNA IMATGE ESTÀTICA precarregada
 * (public/brand/minimapa-iberia.png, les mateixes tessel·les CARTO fosques
 * de l'app, cuites un cop) i la franja, la línia central i el punt es
 * dibuixen A SOBRE amb un canvas i quatre línies de Mercator. Resultat:
 * zero xarxa en obrir, zero MapLibre al paquet inicial, i offline sencer —
 * la imatge va al precache del service worker com qualsevol altre actiu.
 *
 * ELS LÍMITS DE LA IMATGE SÓN CONSTANTS DE LA IMATGE. Surten del
 * `map.getBounds()` exacte del render que la va generar (fitBounds
 * [[-10,35],[5,44.5]] sobre un llenç 1440×1120): si mai es regenera la
 * imatge amb un altre enquadrament, aquests quatre números s'han de
 * regenerar amb ella o tot el que s'hi dibuixi quedarà desplaçat.
 */

import { useEffect, useMemo, useRef } from 'react';

import type { GeoLocation } from '../../core/astro/types';
import { computeEclipsePath, type PathPoint } from '../../core/eclipses/path';
import { readPalette, withAlpha } from '../../styles/palette';

/** Límits Mercator de la imatge base. Provenança: vegeu la capçalera. */
const WEST = -10.465101458180015;
const EAST = 5.465101458177742;
const SOUTH = 35;
const NORTH = 44.5;

const BASE_SRC = `${import.meta.env.BASE_URL}brand/minimapa-iberia.png`;

/** Projecció Y de Mercator (la X és lineal en longitud). */
function mercY(latDeg: number): number {
  const rad = (latDeg * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

const MERC_TOP = mercY(NORTH);
const MERC_SPAN = MERC_TOP - mercY(SOUTH);

/*
 * La franja de cada eclipsi, calculada UN COP per mòdul. El càlcul val
 * ~30 ms: el mòdul sobreviu al component i canviar de pestanya i tornar no
 * el repeteix (mateix patró que `centerLineFor` de MapScreen).
 */
const pathCache = new Map<string, ReturnType<typeof computeEclipsePath>>();

function pathFor(eclipseId: string) {
  let path = pathCache.get(eclipseId);
  if (path === undefined) {
    path = computeEclipsePath(eclipseId);
    pathCache.set(eclipseId, path);
  }
  return path;
}

interface Props {
  eclipseId: string;
  /** El punt de l'observador; `null` mentre no n'hi ha (no es pinta res). */
  location: GeoLocation | null;
  /** Text accessible del botó («Obre el mapa de la franja»). */
  label: string;
  /** Obre la pestanya del mapa. El widget és una porta, no un mapa. */
  onOpen: () => void;
}

export function MiniMap({ eclipseId, location, label, onOpen }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const path = useMemo(() => pathFor(eclipseId), [eclipseId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx === null) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const palette = readPalette();
      const toXY = (pt: { lat: number; lon: number }): [number, number] => [
        ((pt.lon - WEST) / (EAST - WEST)) * width,
        ((MERC_TOP - mercY(pt.lat)) / MERC_SPAN) * height,
      ];

      const trace = (points: PathPoint[]) => {
        ctx.beginPath();
        points.forEach((pt, i) => {
          const [x, y] = toXY(pt);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
      };

      // La franja plena: el mateix ambre tènue del mapa gran.
      if (path.northLimit.length > 1 && path.southLimit.length > 1) {
        ctx.beginPath();
        path.northLimit.forEach((pt, i) => {
          const [x, y] = toXY(pt);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        for (let i = path.southLimit.length - 1; i >= 0; i -= 1) {
          const [x, y] = toXY(path.southLimit[i]);
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = withAlpha(palette.accent, 0.2);
        ctx.fill();
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 1.5;
        trace(path.northLimit);
        ctx.stroke();
        trace(path.southLimit);
        ctx.stroke();
      }

      // La línia central, discontínua com al mapa gran.
      if (path.center.length > 1) {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = withAlpha(palette.corona100, 0.9);
        ctx.lineWidth = 1;
        trace(path.center);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // El teu punt: la mateixa diana del mapa gran, en petit.
      if (location !== null) {
        const [x, y] = toXY(location);
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = palette.bgPage;
        ctx.fill();
        ctx.strokeStyle = palette.corona100;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [path, location]);

  return (
    <button
      type="button"
      className="home__minimap"
      onClick={onOpen}
      aria-label={label}
      title={label}
    >
      {/*
        LA BASE VA EN UNA CAPA PRÒPIA AMB `filter: brightness()`: el CARTO
        fosc a zoom 6 encabit en 190 px és perceptualment negre (report de
        camp: «el widget no mostra mapa»), i el cop de llum en CSS sobre un
        element és el camí que no depèn de res — el canvas de sobre queda
        només per als vectors.
      */}
      <span
        className="home__minimapbase"
        style={{ backgroundImage: `url(${BASE_SRC})` }}
        aria-hidden="true"
      />
      <canvas ref={canvasRef} className="home__minimapcanvas" aria-hidden="true" />
      {/*
        L'atribució de la imatge cuita. El text és el de BASEMAP_SOURCES
        (offline/config), escrit aquí a pèl a posta: pertany a la IMATGE
        generada, no al proveïdor en temps d'execució.
      */}
      <span className="home__minimapcredit">© OpenStreetMap · © CARTO</span>
    </button>
  );
}
