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
 * ELS LÍMITS DE LA IMATGE SÓN CONSTANTS DE LA IMATGE, i viuen a
 * `minimapFrame.ts` perquè el generador (`scripts/build-minimap.ts`) i aquest
 * component els comparteixin en comptes de copiar-se'ls.
 *
 * DUES COSES QUE VAN FALLAR AQUÍ, i que expliquen per què el dibuix passa per
 * `coverTransform` i per què hi ha una prova que mira els píxels de l'actiu:
 *
 *  1. LA IMATGE PUBLICADA ERA TRANSPARENT SENCERA. 1296×1008 píxels a
 *     (0,0,0,0): es va coure en un navegador que encara no havia rebut cap
 *     tessel·la, ningú no en va mirar els píxels i el que va arribar al camp
 *     va ser un widget amb la franja surant damunt del no-res. El
 *     `filter: brightness(1.9)` que hi havia per «il·luminar el CARTO fosc»
 *     no podia fer res: 1,9 × 0 segueix sent 0.
 *  2. LA BASE I ELS VECTORS NO S'HAURIEN ALINEAT MAI. El CSS pinta amb
 *     `cover` (manté proporció i retalla) i el canvas estirava la caixa
 *     geogràfica sencera contra l'element. Vegeu `minimapFrame.ts`.
 */

import { useEffect, useRef, useState } from 'react';

import type { GeoLocation } from '../../core/astro/types';
/*
 * NOMÉS ELS TIPUS, I L'IMPORT DE DEBÒ ÉS DINÀMIC (vegeu l'efecte de sota).
 *
 * `core/eclipses/path.ts` arrossega els elements besselians i és de les peces
 * grosses del projecte. Amb un import estàtic viatjava al paquet d'ARRENCADA
 * per culpa d'aquest widget, i el paga tothom que obre l'app encara que no
 * miri mai el mapa. Els tipus s'esborren en compilar i no pesen res.
 */
import type { EclipsePath, PathPoint } from '../../core/eclipses/path';
import { readPalette, withAlpha } from '../../styles/palette';
import { coverTransform, minimapXY } from './minimapFrame';

const BASE_SRC = `${import.meta.env.BASE_URL}brand/minimapa-iberia.png`;

/*
 * LA FRANJA NO ES CALCULA DURANT EL PRIMER RENDER, I AIXÒ VA COSTAR MIG SEGON.
 *
 * Aquí hi havia un `useMemo(() => pathFor(eclipseId))` amb un comentari que
 * deia «val ~30 ms». La xifra era falsa i feia anys que ningú no la
 * remesurava: `computeEclipsePath` val 117,7 ms per al 2026, 144,3 per al 2027
 * i 133,1 per al 2028 en un portàtil ràpid i en calent. En un mòbil de gamma
 * mitjana són quatre o cinc vegades més — mig segon de pantalla congelada
 * ABANS del primer píxel útil, i just a la portada, que és la primera cosa que
 * es veu i sovint amb dades mòbils.
 *
 * Ara es demana DESPRÉS de pintar, i el widget viu perfectament sense: mentre
 * no hi és, ensenya la seva imatge base —que és un mapa de debò— i prou. La
 * franja hi apareix un fotograma més tard i ningú no ho nota, perquè això és
 * una PORTA cap al mapa, no el mapa.
 *
 * La memòria ja no és aquí: viu a `core/eclipses/path.ts`, compartida amb els
 * altres tres llocs que la demanaven amb la seva memòria pròpia.
 */
type EclipsePathData = EclipsePath;

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

  /*
   * El càlcul es demana en un efecte, o sigui DESPRÉS de la primera pintada, i
   * a més dins d'un `requestIdleCallback` quan el navegador en té: així no
   * competeix ni amb el compte enrere ni amb el que l'usuari estigui llegint.
   * Safari encara no en té, i allà es cau a un `setTimeout(0)`, que almenys
   * cedeix el fil un cop.
   */
  const [path, setPath] = useState<EclipsePathData | null>(null);

  useEffect(() => {
    let alive = true;
    const compute = (): void => {
      /*
       * L'import és DINÀMIC: així el mòdul de la franja (i els elements
       * besselians que arrossega) no viatgen al paquet d'arrencada. Quan
       * l'usuari obri el mapa, el tros ja estarà baixat i en memòria.
       */
      void import('../../core/eclipses/path').then(({ computeEclipsePath }) => {
        if (alive) setPath(computeEclipsePath(eclipseId));
      });
    };
    const idle = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    const handle =
      idle === undefined
        ? window.setTimeout(compute, 0)
        : idle(compute, { timeout: 1200 });
    return () => {
      alive = false;
      if (idle === undefined) window.clearTimeout(handle);
    };
  }, [eclipseId]);

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
      // La MATEIXA geometria que el `cover` del CSS de sota: si no, la franja
      // no cau damunt del mapa que ensenya la imatge.
      const cover = coverTransform(width, height);
      const toXY = (pt: { lat: number; lon: number }): [number, number] =>
        minimapXY(pt, cover);

      const trace = (points: PathPoint[]) => {
        ctx.beginPath();
        points.forEach((pt, i) => {
          const [x, y] = toXY(pt);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
      };

      // La franja plena: el mateix ambre tènue del mapa gran. Mentre el
      // càlcul no ha arribat, el widget ensenya la seva imatge base i prou.
      if (path !== null && path.northLimit.length > 1 && path.southLimit.length > 1) {
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
      if (path !== null && path.center.length > 1) {
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
