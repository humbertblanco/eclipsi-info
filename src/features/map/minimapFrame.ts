/**
 * L'enquadrament de la imatge base del mini-mapa, en un sol lloc.
 *
 * PER QUÈ NO VIU DINS DE `MiniMap.tsx`. Aquests quatre números descriuen una
 * IMATGE concreta (`public/brand/minimapa-iberia.png`), i qui la genera
 * (`scripts/build-minimap.ts`) i qui hi dibuixa a sobre han de fer servir
 * exactament els mateixos. Amb les constants amagades dins del component, el
 * generador les havia de copiar — i una còpia que ningú no compara és una
 * còpia que un dia divergeix i desplaça la franja damunt del mapa sense que
 * cap prova se n'adoni. Ara el generador les IMPORTA d'aquí.
 *
 * ── LA TRAMPA DEL `COVER`, QUE VA COSTAR UN DEFECTE ─────────────────────────
 *
 * La imatge es pinta amb `background-size: cover`, que MANTÉ LA PROPORCIÓ i
 * retalla el que sobra. El canvas de sobre, en canvi, mapava la caixa
 * geogràfica sencera contra l'amplada i l'alçada de l'element, o sigui
 * ESTIRANT-LA. Amb el widget a 399×191 (proporció 2,09) i la caixa
 * geogràfica a 1,29, això vol dir que la imatge ensenyava només la seva
 * franja central mentre la franja de totalitat es dibuixava damunt de la
 * caixa sencera: mai no podien coincidir. No es va veure perquè la imatge
 * publicada era transparent de dalt a baix i no es veia res a sota.
 *
 * `coverTransform` és aquella mateixa regla del CSS escrita com a funció, i és
 * el que fa que el que pinta el canvas caigui damunt del que pinta el CSS.
 */

/** Límits de la imatge base. Si es regenera la imatge, es regeneren aquí. */
export const MINIMAP_WEST = -10.465101458180015;
export const MINIMAP_EAST = 5.465101458177742;
export const MINIMAP_SOUTH = 35;
export const MINIMAP_NORTH = 44.5;

/** Projecció Y de Mercator (la X és lineal en longitud). */
export function mercY(latDeg: number): number {
  const rad = (latDeg * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

export const MINIMAP_MERC_TOP = mercY(MINIMAP_NORTH);
export const MINIMAP_MERC_SPAN = MINIMAP_MERC_TOP - mercY(MINIMAP_SOUTH);

/** Amplada de la caixa en unitats de Mercator (que són quadrades). */
const BOX_W = ((MINIMAP_EAST - MINIMAP_WEST) * Math.PI) / 180;
const BOX_H = MINIMAP_MERC_SPAN;

/** Proporció de la caixa geogràfica. La imatge s'ha de generar amb aquesta. */
export const MINIMAP_ASPECT = BOX_W / BOX_H;

export interface CoverTransform {
  /** Píxels per unitat de Mercator. */
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * La mateixa geometria que aplica `background-size: cover`: escala la caixa
 * fins que en tapa les dues dimensions i la centra, deixant sortir per fora
 * el que sobri.
 */
export function coverTransform(width: number, height: number): CoverTransform {
  const scale = Math.max(width / BOX_W, height / BOX_H);
  return {
    scale,
    offsetX: (width - BOX_W * scale) / 2,
    offsetY: (height - BOX_H * scale) / 2,
  };
}

/** Punt geogràfic → píxel de l'element, alineat amb la imatge de sota. */
export function minimapXY(
  point: { lat: number; lon: number },
  t: CoverTransform,
): [number, number] {
  const x = t.offsetX + (((point.lon - MINIMAP_WEST) * Math.PI) / 180) * t.scale;
  const y = t.offsetY + (MINIMAP_MERC_TOP - mercY(point.lat)) * t.scale;
  return [x, y];
}
