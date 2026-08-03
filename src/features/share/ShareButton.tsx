/**
 * Compartir el punt: l'enllaç i, quan es pot, la targeta.
 *
 * ── PER QUÈ AMB IMATGE I NO NOMÉS AMB L'ENLLAÇ ──────────────────────────────
 *
 * Aquesta app viu en un lloc estàtic i en un servidor compartit que no es pot
 * tocar (ESTAT.md §1), o sigui que una `og:image` DIFERENT PER PUNT no és
 * possible: qualsevol enllaç que enviïs a un grup de WhatsApp ensenyaria la
 * mateixa icona de l'aplicació, digui el que digui l'adreça. La manera d'obtenir
 * una previsualització de veritat és no demanar-la: enviar la imatge com a
 * FITXER dins del mateix gest de compartir, que és el que fa `navigator.share`
 * amb `files`. La imatge és el cel del màxim simulat des del teu punt, amb
 * l'adreça impresa al peu: encara que viatgi sola, duu el camí de tornada.
 *
 * ── LES DUES ESCALES ────────────────────────────────────────────────────────
 *
 * AMB FULL NATIU (mòbil, `navigator.share` existeix):
 *
 *   1. Fitxer + text, quan `canShare({ files })` diu que sí. L'ADREÇA VIATJA
 *      DINS DEL TEXT i no al camp `url`: quan hi ha fitxers, molts destins
 *      (WhatsApp el primer) llencen el camp `url` i es queden el fitxer i el
 *      text. El que va escrit al text és l'únic que sobreviu segur.
 *   2. Només l'enllaç (`{ title, text, url }`), quan els fitxers no es poden.
 *
 * SENSE FULL NATIU (escriptori):
 *
 *   1. El porta-retalls amb DUES representacions del mateix punt en un sol
 *      gest: `text/plain` amb l'adreça i `image/png` amb la targeta. Enganxar
 *      en un camp de text dona l'adreça; enganxar on s'admeten imatges dona la
 *      simulació. Els blobs entren al `ClipboardItem` com a PROMESES i
 *      `write()` es crida sense cap `await` pel mig: és el patró que Safari
 *      exigeix —si la imatge es generés abans amb un `await`, el gest ja
 *      s'hauria esgotat i WebKit rebutjaria l'escriptura— i a Chrome i Firefox
 *      el mateix patró val.
 *   2. Només l'enllaç (`writeText`), si el porta-retalls d'imatge falla:
 *      l'adreça és el que mai pot faltar.
 *   3. Descarregar la targeta, si ni el text pla no entra. La targeta duu
 *      l'adreça impresa al peu, o sigui que ni així es perd el camí.
 *
 * El botó diu la veritat de l'esglaó on s'ha acabat: «Enllaç i simulació
 * copiats», «Enllaç copiat» o «Targeta descarregada», i mai una cosa per una
 * altra.
 *
 * ── QUE CANCEL·LAR NO ÉS FALLAR ─────────────────────────────────────────────
 *
 * Tancar el full de compartir llança `AbortError`. Pintar-hi un error seria
 * renyar algú per haver canviat d'opinió; es distingeix i es calla.
 */

import { useState } from 'react';
import { Button } from '../../ui';
import type { GeoLocation, LocalCircumstances } from '../../core/astro/types';
import type { HorizonProfile } from '../../core/horizon/profile';
import type { VisibilityVerdict } from '../../core/visibility/verdict';
import type { Locale } from '../../i18n';
import { buildShareLink } from './link';
import {
  cardFileName,
  renderShareCardBlob,
  renderShareCardFile,
  shareCardModelFrom,
} from './card';
import { downloadBlob, isAbortError } from './shareFile';
import { sh, type ShareStringKey } from './strings';

export interface ShareButtonProps {
  eclipseId: string;
  locale: Locale;
  /** `null` mentre no se sap on serà l'usuari: llavors no hi ha res a compartir. */
  location: GeoLocation | null;
  label: string | null;
  circumstances: LocalCircumstances | null;
  profile: HorizonProfile | null;
  verdict: VisibilityVerdict | null;
  className?: string;
}

type State =
  | 'idle'
  | 'working'
  | 'copied-both'
  | 'copied-link'
  | 'downloaded'
  | 'failed';

/** El text del botó per a cada estat que en té un de propi. */
const FEEDBACK: Partial<Record<State, ShareStringKey>> = {
  working: 'button.preparing',
  'copied-both': 'button.copiedBoth',
  'copied-link': 'button.copied',
  downloaded: 'button.downloaded',
};

export function ShareButton({
  eclipseId,
  locale,
  location,
  label,
  circumstances,
  profile,
  verdict,
  className,
}: ShareButtonProps) {
  const [state, setState] = useState<State>('idle');

  // Sense lloc ni circumstàncies no hi ha res a compartir, però desaparèixer
  // en silenci feia semblar que el botó no existia o que s'havia perdut. Es
  // deixa a la vista, deshabilitat de veritat (l'atribut arriba al <button>
  // natiu), i el text del costat diu què falta perquè torni a viure. Sense
  // `onClick`: el flux de compartir no es pot disparar ni per accident.
  if (location === null || circumstances === null) {
    return (
      <div className={className}>
        <Button variant="ghost" icon="share-2" disabled>
          {sh('button.share', locale)}
        </Button>
        <p className="screen__note">{sh('button.unavailable', locale)}</p>
      </div>
    );
  }

  const url = new URL(
    buildShareLink({ lat: location.lat, lon: location.lon, eclipseId, label }),
    window.location.href,
  ).toString();

  /** Pinta l'esglaó on s'ha acabat i torna a `idle` al cap d'un moment. */
  const settle = (outcome: State): void => {
    setState(outcome);
    window.setTimeout(() => setState('idle'), 2500);
  };

  const share = async (): Promise<void> => {
    const place = label ?? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`;
    // El model es munta abans de res i és síncron: totes dues escales el fan
    // servir, i al camí del porta-retalls no hi pot haver cap `await` entre el
    // clic i el `write()`.
    const model = shareCardModelFrom({
      eclipseId,
      place: location,
      label,
      circumstances,
      profile,
      verdict,
    });

    setState('working');

    /* ── Amb full natiu: el fitxer mana i l'adreça hi viatja a dins ───────── */
    if (typeof navigator.share === 'function') {
      try {
        const file = await renderShareCardFile(model, locale);
        const withFile =
          file === null
            ? null
            : {
                title: sh('share.title', locale),
                // SENSE URL quan viatja la targeta: l'adreça dins del text
                // feia que el destí pintés la previsualització de l'enllaç
                // (l'og) com a SEGONA imatge al costat de la targeta — dues
                // fotos al mateix missatge, report de camp del 3-8-2026. El
                // camí de tornada ja va IMPRÈS a la targeta, amb la marca.
                text: sh('share.text', locale, { place }),
                files: [file],
              };
        // `canShare` s'ha de preguntar amb el fitxer a la mà: hi ha navegadors
        // que comparteixen text i no fitxers, i altres que rebutgen segons el
        // tipus MIME. Provar-ho i caçar l'excepció seria indistingible d'un
        // usuari que tanca el full.
        if (withFile && navigator.canShare?.(withFile)) {
          await navigator.share(withFile);
        } else {
          await navigator.share({
            title: sh('share.title', locale),
            text: sh('share.text', locale, { place }),
            url,
          });
        }
        setState('idle');
      } catch (error) {
        if (isAbortError(error)) {
          setState('idle');
          return;
        }
        setState('failed');
      }
      return;
    }

    /* ── Sense full natiu: el porta-retalls, amb dues cares ───────────────── */

    // Esglaó 1: l'adreça i la simulació en un sol gest. El blob del PNG entra
    // com a PROMESA dins del `ClipboardItem` i `write()` es crida de seguida,
    // encara dins del gest: el patró que val per a Safari val per a tots.
    if (
      typeof ClipboardItem !== 'undefined' &&
      typeof navigator.clipboard?.write === 'function'
    ) {
      try {
        const card = renderShareCardBlob(model, locale).then((blob) => {
          // Rebutjar aquí fa caure el `write()` sencer i es baixa un esglaó:
          // millor cap imatge que un porta-retalls a mitges sense avisar.
          if (blob === null) throw new Error('la targeta no s’ha pogut generar');
          return blob;
        });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([url], { type: 'text/plain' }),
            'image/png': card,
          }),
        ]);
        settle('copied-both');
        return;
      } catch {
        // Es baixa a copiar només l'enllaç: la imatge és un extra, l'adreça no.
      }
    }

    // Esglaó 2: només l'enllaç, que és el que mai pot faltar.
    try {
      await navigator.clipboard.writeText(url);
      settle('copied-link');
      return;
    } catch {
      // Ni el text pla no ha entrat (context insegur, permís denegat, focus
      // perdut): queda la descàrrega, que duu l'adreça impresa al peu.
    }

    // Esglaó 3: la targeta com a fitxer.
    try {
      const blob = await renderShareCardBlob(model, locale);
      if (blob !== null) {
        downloadBlob(blob, cardFileName(label, location, locale));
        settle('downloaded');
        return;
      }
    } catch {
      // Cau al `failed` de sota: aquí ja no queda cap esglaó.
    }
    setState('failed');
  };

  return (
    <div className={className}>
      <Button
        variant="ghost"
        icon="share-2"
        disabled={state === 'working'}
        onClick={() => void share()}
      >
        {sh(FEEDBACK[state] ?? 'button.share', locale)}
      </Button>
      {state === 'failed' && <p className="screen__note">{sh('button.failed', locale)}</p>}
    </div>
  );
}
