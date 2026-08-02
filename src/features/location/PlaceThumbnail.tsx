/**
 * La miniatura d'un lloc dins d'una fila de l'historial.
 *
 * PER QUÈ EXISTEIX. Una fila que diu «42,1200° N, 1,5700° E» no es distingeix de
 * la del costat, i amb nom tampoc gaire: «Coll de Nargó» i «Organyà» són dues
 * línies de text que es diferencien en una paraula. El que de veritat les
 * distingeix és la silueta de la carena que tens al davant amb el camí del Sol a
 * sobre — la imatge que cap altra aplicació pot dibuixar perquè cap altra té el
 * perfil d'horitzó del teu punt.
 *
 * PER QUÈ ÉS UN COMPONENT I NO UNA CADENA DESADA. Perquè la imatge no es desa
 * enlloc. L'historial viu a `localStorage` (`state/recentPlaces.ts`) i una
 * data-URL de PNG s'hi menja quilobytes per fila; quan la quota salta, el que es
 * perd no és la miniatura sinó l'historial sencer. Es dibuixa cada vegada, que
 * són uns pocs mil·lisegons per fila, i prou.
 *
 * NO DEMANA MAI RES A LA XARXA. El perfil surt de la memòria cau que ja hi ha;
 * si no n'hi ha, es dibuixa l'horitzó pla de reserva en traç discontinu i es
 * diu que el terreny d'aquell punt encara no s'ha calculat. Baixar 20 MB de
 * tessel·les per pintar una imatge de 44 px que ningú ha demanat seria gastar
 * les dades de l'usuari a esquena seva, que és el que la fulla d'ubicació
 * evita a tot arreu.
 */

import { useEffect, useRef, useState } from 'react';
import type { GeoLocation } from '../../core/astro/types';
import type { Locale } from '../../i18n';
import {
  drawThumbnail,
  loadThumbnailModel,
  THUMB_HEIGHT,
  THUMB_WIDTH,
  type TerrainConfidence,
} from '../share/thumbnail';
import { sh } from '../share/strings';

export interface PlaceThumbnailProps {
  place: GeoLocation;
  eclipseId: string;
  locale: Locale;
  /** Mida en píxels de CSS. Per defecte, la de la fila de l'historial. */
  width?: number;
  height?: number;
}

export function PlaceThumbnail({
  place,
  eclipseId,
  locale,
  width = THUMB_WIDTH,
  height = THUMB_HEIGHT,
}: PlaceThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [terrain, setTerrain] = useState<TerrainConfidence | null>(null);

  // Dependències escalars i no l'objecte: `place` es reconstrueix a cada render
  // de la fulla i dispararia el càlcul d'efemèrides sense parar.
  const { lat, lon, elevation } = place;

  useEffect(() => {
    let cancelled = false;

    const draw = async () => {
      const model = await loadThumbnailModel(eclipseId, { lat, lon, elevation });
      if (cancelled) return;

      setTerrain(model.terrain);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Densitat de píxels del dispositiu: sense això, una silueta de 44 px surt
      // amb la carena escalonada i deixa de ser reconeixible, que és tot el que
      // se li demana.
      const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      drawThumbnail(ctx, model, width, height, locale);
    };

    void draw();
    return () => {
      cancelled = true;
    };
  }, [eclipseId, lat, lon, elevation, width, height, locale]);

  /*
   * EL TEXT ALTERNATIU DIU QUINA DE LES DUES COSES ÉS.
   *
   * Amb perfil calculat, el que hi ha dibuixat és l'horitzó d'aquell punt. Sense
   * perfil, el que hi ha és una línia plana que no ha mesurat res, i dir-ne
   * «horitzó» seria exactament la mentida optimista que aquesta app persegueix.
   * Mentre no se sap —el primer fotograma, abans que respongui IndexedDB— la
   * imatge no anuncia res: sense `role="img"` ni etiqueta, el lector de pantalla
   * se la salta en comptes de llegir una descripció que encara pot ser falsa.
   */
  const label =
    terrain === null
      ? null
      : sh(terrain === 'assumed' ? 'thumb.altAssumed' : 'thumb.alt', locale);

  return (
    <canvas
      ref={canvasRef}
      className={
        terrain === 'assumed' ? 'loc-thumb loc-thumb--assumed' : 'loc-thumb'
      }
      style={{ width, height }}
      role={label === null ? 'presentation' : 'img'}
      aria-label={label ?? undefined}
      aria-hidden={label === null ? true : undefined}
    />
  );
}
