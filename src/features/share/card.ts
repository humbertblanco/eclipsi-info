/**
 * La targeta compartible: la mateixa imatge de la miniatura, en gran, amb les
 * tres xifres que decideixen alguna cosa.
 *
 * PER QUÈ 1200 × 630. És la mida que WhatsApp, Telegram, Signal, Mastodon i els
 * previsualitzadors d'enllaços retallen sense tallar res. Una imatge quadrada hi
 * arriba amb els extrems menjats, i justament els extrems d'aquest dibuix són
 * on hi ha la carena que tapa el Sol.
 *
 * QUÈ HI POSA I QUÈ NO. Hi va el nom del lloc, l'hora del màxim i els segons de
 * fase central que SOBREVIUEN AL RELLEU, que és l'única xifra que aquesta app
 * pot donar i cap altra. No hi va cap durada teòrica presentada com si fos el
 * que veuràs: quan no hi ha perfil de terreny calculat, la targeta ho diu amb
 * totes les lletres i etiqueta la durada com el que és.
 *
 * CAP REGLA DE FORMAT NOVA. Les hores, les durades i els decimals surten de
 * `screens/format.ts` i el percentatge d'obscuració de
 * `core/astro/obscuration.ts`. La regla del 99,7 % que no és 100 % s'ha
 * reescrit a mà a nou llocs d'aquest projecte i ha mentit a set (ESTAT.md §3.2);
 * una imatge que la gent es reenvia i que sobreviu a l'app és el pitjor lloc
 * possible per ser el vuitè.
 *
 * EL TEXT ES MESURA, NO ES CONFIA. `ctx.measureText` mana: un topònim llarg
 * («Sant Julià de Vilatorta») no pot sortir de la targeta ni encavalcar-se amb
 * les xifres, i en una imatge no hi ha `text-overflow` que ho salvi.
 */

import { formatObscurationPercent } from '../../core/astro/obscuration';
import type { GeoLocation, LocalCircumstances } from '../../core/astro/types';
import { getEclipse } from '../../core/eclipses/catalog';
import { horizonSampler, type HorizonProfile } from '../../core/horizon/profile';
import { readCachedProfile } from '../../core/horizon/cache';
import { computeVisibility, type VisibilityVerdict } from '../../core/visibility/verdict';
import type { Locale } from '../../i18n';
import {
  formatClock,
  formatCoords,
  formatDuration,
} from '../../screens/format';
import { canvasFont, readPalette, withAlpha, type Palette } from '../../styles/palette';
import { renderTrajectory } from '../sim/renderTrajectory';
import { TRAJECTORY_SAMPLES, trajectorySamples } from '../sim/samples';
import { sh } from './strings';
import {
  buildThumbnailModel,
  resolveThumbnailTerrain,
  thumbnailCacheKey,
  type ThumbnailModel,
} from './thumbnail';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/**
 * Alçada de la franja de dibuix.
 *
 * El text no va damunt de la imatge sinó a sota, en una franja pròpia. Damunt
 * hi hauria de portar un vel per ser llegible, i el vel s'hauria de menjar
 * justament la part baixa del dibuix, que és on hi ha la silueta del terreny.
 */
const IMAGE_HEIGHT = 372;

export interface ShareCardModel extends ThumbnailModel {
  eclipseId: string;
  place: GeoLocation;
  /** Nom del lloc si se'n coneix. Sense nom manen les coordenades. */
  label: string | null;
  /**
   * El veredicte del relleu. És `null` quan el terreny d'aquest punt encara no
   * s'ha calculat: llavors NO hi ha cap xifra de fase central visible, perquè
   * calcular-la amb l'horitzó pla de reserva donaria la durada teòrica
   * disfressada de mesura.
   */
  verdict: VisibilityVerdict | null;
}

/* --- el text, que és la part que es pot provar --------------------------- */

export interface CardFigure {
  label: string;
  value: string;
  /** Cert per a la xifra que decideix. N'hi ha una i prou: l'ambre del sistema. */
  emphasis?: boolean;
}

export interface CardText {
  /** Nom del lloc, o les coordenades si no en té. */
  title: string;
  /** Les coordenades, quan el títol ja és un nom. `null` si el títol ja les diu. */
  coords: string | null;
  /** Nom de l'eclipsi, tal com l'escriu la resta de l'app. */
  subtitle: string;
  figures: CardFigure[];
  /** Avís del terreny sense calcular. `null` quan el perfil és de debò. */
  caveat: string | null;
  footer: string;
}

export interface CardTextInput {
  eclipseId: string;
  place: GeoLocation;
  label: string | null;
  circumstances: LocalCircumstances;
  verdict: VisibilityVerdict | null;
  terrain: 'measured' | 'assumed';
  locale: Locale;
}

/**
 * Tot el text de la targeta, sense tocar cap canvas.
 *
 * Va a part del dibuix perquè el canvas no existeix en entorn Node i aquesta és
 * la part que pot mentir: aquí es decideix si la durada que s'ensenya és la que
 * veuràs o la teòrica, i com es diu el percentatge d'obscuració.
 */
export function cardText(input: CardTextInput): CardText {
  const { circumstances, verdict, terrain, locale, place } = input;
  const contacts = circumstances.contacts;
  const isCentral =
    circumstances.kind === 'total' || circumstances.kind === 'annular';

  const coords = formatCoords(place.lat, place.lon);
  const figures: CardFigure[] = [
    { label: sh('card.max', locale), value: formatClock(contacts.max.time, locale) },
  ];

  if (!isCentral) {
    // Des d'aquí no hi ha ni totalitat ni anularitat. Dir-ho és més útil que
    // ensenyar «0 s», que es llegeix com un error de càlcul.
    figures.push({ label: sh('card.central', locale), value: sh('card.noCentral', locale) });
  } else if (verdict) {
    figures.push({
      label: sh('card.central', locale),
      value: formatDuration(verdict.centralVisibleSec),
      emphasis: true,
    });
  } else {
    // Sense perfil de terreny, la durada és la de les efemèrides i s'etiqueta
    // com el que és. No porta èmfasi: l'ambre és de la xifra que decideix, i
    // una durada que no descompta cap muntanya encara no decideix res.
    figures.push({
      label: sh('card.centralTheoretical', locale),
      value: formatDuration(circumstances.centralDurationSec),
    });
  }

  figures.push({
    label: sh('card.obscured', locale),
    value: formatObscurationPercent(
      verdict?.maxVisibleObscuration ?? contacts.max.obscuration,
      isCentral,
    ),
  });

  const title = input.label ?? coords;

  return {
    title,
    coords: input.label === null ? null : coords,
    subtitle: getEclipse(input.eclipseId).label[locale],
    figures,
    caveat: terrain === 'assumed' ? sh('card.terrainAssumed', locale) : null,
    footer: sh('card.footer', locale),
  };
}

/**
 * Nom del fitxer de la imatge.
 *
 * Sense accents ni espais: el nom viatja per missatgeria, per correu i per
 * sistemes de fitxers que no són el del telèfon de qui la genera, i un
 * «Peníscola.png» arriba com a «Pen%C3%ADscola.png» a més llocs dels que
 * sembla. Els guions baixos no, guions normals: és el que fan els navegadors
 * en desar.
 */
export function cardFileName(label: string | null, place: GeoLocation, locale: Locale): string {
  const base = sh('share.fileName', locale);
  const slug = (label ?? `${place.lat.toFixed(3)},${place.lon.toFixed(3)}`)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug ? `${base}-${slug}.png` : `${base}.png`;
}

/* --- el model ------------------------------------------------------------ */

/**
 * El model de la targeta, anant a buscar el perfil desat.
 *
 * El veredicte NOMÉS es calcula si el perfil és de debò. Amb l'horitzó pla,
 * `computeVisibility` retornaria «102,1 s de 102,1 s» per a un punt que pot
 * tenir una carena de set graus al davant, que és el mateix defecte que
 * ESTAT.md §3.5 vigila al llindar de cobertura del perfil.
 */
export async function loadShareCardModel(
  eclipseId: string,
  place: GeoLocation,
  label: string | null,
): Promise<ShareCardModel> {
  const cached = await readCachedProfile(thumbnailCacheKey(place.lat, place.lon));
  const base = buildThumbnailModel(eclipseId, place, cached, TRAJECTORY_SAMPLES);
  return {
    ...base,
    eclipseId,
    place,
    label,
    verdict:
      base.terrain === 'measured'
        ? computeVisibility(base.circumstances, base.profile, base.samples)
        : null,
  };
}

/**
 * El model quan qui crida ja té les circumstàncies, el perfil i el veredicte
 * (la pantalla de simulació els té tots tres). Estalvia repetir el càlcul
 * sencer, que són unes desenes de mil·lisegons d'efemèrides just quan l'usuari
 * acaba de prémer el botó de compartir.
 *
 * El perfil pot ser `null`: vol dir que encara no s'ha calculat, i llavors la
 * targeta cau a l'horitzó pla de reserva i al text que ho diu. El veredicte
 * s'ignora en aquest cas, perquè un veredicte calculat sobre un horitzó pla no
 * és una mesura.
 */
export function shareCardModelFrom(options: {
  eclipseId: string;
  place: GeoLocation;
  label: string | null;
  circumstances: LocalCircumstances;
  profile: HorizonProfile | null;
  verdict: VisibilityVerdict | null;
  samples?: ShareCardModel['samples'];
}): ShareCardModel {
  const { eclipseId, place, label, circumstances, profile, verdict } = options;
  const resolved = resolveThumbnailTerrain(place, profile);
  return {
    eclipseId,
    place,
    label,
    circumstances,
    samples: options.samples ?? trajectorySamples(circumstances, place, TRAJECTORY_SAMPLES),
    profile: resolved.profile,
    terrain: resolved.terrain,
    verdict: resolved.terrain === 'measured' ? verdict : null,
  };
}

/* --- el dibuix ----------------------------------------------------------- */

/** Retalla un text a l'amplada disponible, amb punts suspensius. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

/**
 * Pinta la targeta sencera en un context ja dimensionat a 1200 × 630.
 *
 * La imatge de dalt és `renderTrajectory` en mode `mini`: exactament el mateix
 * dibuix que la miniatura de l'historial, a una altra mida. Que la targeta i la
 * fila de l'historial ensenyin la mateixa silueta no és estètica; és el que fa
 * que qui rep la imatge i qui té l'app estiguin mirant la mateixa cosa.
 */
export function drawShareCard(
  ctx: CanvasRenderingContext2D,
  model: ShareCardModel,
  locale: Locale,
  palette: Palette = readPalette(),
): void {
  const text = cardText({
    eclipseId: model.eclipseId,
    place: model.place,
    label: model.label,
    circumstances: model.circumstances,
    verdict: model.verdict,
    terrain: model.terrain,
    locale,
  });

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CARD_WIDTH, IMAGE_HEIGHT);
  ctx.clip();
  renderTrajectory(ctx, model.circumstances, model.samples, CARD_WIDTH, IMAGE_HEIGHT, {
    locale,
    chrome: 'mini',
    terrain: model.terrain,
    horizonProfile: horizonSampler(model.profile),
  });
  ctx.restore();

  // Franja de text.
  ctx.fillStyle = palette.bgPage;
  ctx.fillRect(0, IMAGE_HEIGHT, CARD_WIDTH, CARD_HEIGHT - IMAGE_HEIGHT);
  ctx.fillStyle = palette.borderSubtle;
  ctx.fillRect(0, IMAGE_HEIGHT, CARD_WIDTH, 1);

  const margin = 56;
  const maxTextWidth = CARD_WIDTH - margin * 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Nom del lloc.
  ctx.font = canvasFont(palette, 44, { weight: 700, mono: false });
  ctx.fillStyle = palette.textPrimary;
  ctx.fillText(fitText(ctx, text.title, maxTextWidth), margin, IMAGE_HEIGHT + 62);

  // Coordenades i nom de l'eclipsi, a la mateixa línia i separats pel punt
  // volat que fa servir tota l'app.
  const second = [text.coords, text.subtitle].filter(Boolean).join(' · ');
  ctx.font = canvasFont(palette, 20, { weight: 400, mono: false });
  ctx.fillStyle = palette.textSecondary;
  ctx.fillText(fitText(ctx, second, maxTextWidth), margin, IMAGE_HEIGHT + 96);

  // Les tres xifres, repartides.
  const columnWidth = maxTextWidth / text.figures.length;
  text.figures.forEach((figure, index) => {
    const x = margin + columnWidth * index;
    ctx.font = canvasFont(palette, 15, { weight: 500, mono: true });
    ctx.fillStyle = palette.textMuted;
    ctx.fillText(fitText(ctx, figure.label.toUpperCase(), columnWidth - 16), x, IMAGE_HEIGHT + 148);

    ctx.font = canvasFont(palette, 40, { weight: 500, mono: true });
    ctx.fillStyle = figure.emphasis ? palette.accent : palette.textPrimary;
    ctx.fillText(fitText(ctx, figure.value, columnWidth - 16), x, IMAGE_HEIGHT + 196);
  });

  // L'avís del terreny sense calcular, si cal. En blau informatiu i no en
  // ambre: l'ambre del sistema és d'una xifra per imatge i aquí la té la
  // durada. Un avís de configuració no li pot disputar el color.
  ctx.font = canvasFont(palette, 18, { weight: 400, mono: false });
  if (text.caveat) {
    ctx.fillStyle = palette.statusInfo;
    ctx.fillText(fitText(ctx, text.caveat, maxTextWidth - 160), margin, IMAGE_HEIGHT + 232);
  }

  ctx.textAlign = 'right';
  ctx.font = canvasFont(palette, 18, { weight: 500, mono: true });
  ctx.fillStyle = withAlpha(palette.textMuted, 0.9);
  ctx.fillText(text.footer, CARD_WIDTH - margin, IMAGE_HEIGHT + 232);
  ctx.textAlign = 'left';
}

/**
 * La targeta com a `Blob`, llesta per a `navigator.share({ files: [...] })`.
 *
 * Torna `null` en comptes de llançar quan no hi ha document (Node, un Worker) o
 * quan `toBlob` no pot codificar: qui comparteix ha de poder caure a compartir
 * només l'enllaç, i una excepció aquí deixaria l'usuari amb un botó que no fa
 * res i cap explicació.
 */
export async function renderShareCardBlob(
  model: ShareCardModel,
  locale: Locale,
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  drawShareCard(ctx, model, locale);

  return new Promise<Blob | null>((resolve) => {
    // PNG i no JPEG: el dibuix és de línies fines sobre fons molt fosc, i el
    // JPEG hi deixa una aurèola de blocs justament al voltant del camí del Sol.
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/**
 * El fitxer que espera `navigator.share`. `null` si no s'ha pogut generar la
 * imatge o si l'entorn no té `File` (alguns navegadors antics tenen `Blob` i
 * no `File`, i `share` amb fitxers no els funcionaria igualment).
 */
export async function renderShareCardFile(
  model: ShareCardModel,
  locale: Locale,
): Promise<File | null> {
  const blob = await renderShareCardBlob(model, locale);
  if (!blob || typeof File === 'undefined') return null;
  return new File([blob], cardFileName(model.label, model.place, locale), {
    type: 'image/png',
  });
}
