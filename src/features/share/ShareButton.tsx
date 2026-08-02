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
 * amb `files`. La silueta que hi surt és la del teu horitzó, dibuixada amb el
 * mateix codi que la miniatura de l'historial.
 *
 * ── ELS TRES ESGLAONS ───────────────────────────────────────────────────────
 *
 *   1. Compartir amb fitxer, quan `canShare({ files })` diu que sí.
 *   2. Compartir només l'enllaç (iOS antic, escriptori amb Web Share).
 *   3. Copiar l'enllaç al porta-retalls (Firefox d'escriptori i companyia).
 *
 * No hi ha cap quart esglaó amb un diàleg propi: qualsevol cosa que muntéssim
 * per sobre seria pitjor que el full natiu del sistema, que ja va traduït i ja
 * sap quines aplicacions té l'usuari.
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
import { renderShareCardFile, shareCardModelFrom } from './card';
import { sh } from './strings';

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

type State = 'idle' | 'working' | 'copied' | 'failed';

import { isAbortError as isAbort } from './shareFile';

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

  if (location === null || circumstances === null) return null;

  const url = new URL(
    buildShareLink({ lat: location.lat, lon: location.lon, eclipseId, label }),
    window.location.href,
  ).toString();

  const share = async (): Promise<void> => {
    const place = label ?? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`;
    const payload = {
      title: sh('share.title', locale),
      text: sh('share.text', locale, { place }),
      url,
    };

    setState('working');
    try {
      if (typeof navigator.share === 'function') {
        const file = await renderShareCardFile(
          shareCardModelFrom({
            eclipseId,
            place: location,
            label,
            circumstances,
            profile,
            verdict,
          }),
          locale,
        );

        const withFile = file === null ? null : { ...payload, files: [file] };
        // `canShare` s'ha de preguntar amb el fitxer a la mà: hi ha navegadors
        // que comparteixen text i no fitxers, i altres que rebutgen segons el
        // tipus MIME. Provar-ho i caçar l'excepció seria indistingible d'un
        // usuari que tanca el full.
        if (withFile && navigator.canShare?.(withFile)) {
          await navigator.share(withFile);
        } else {
          await navigator.share(payload);
        }
        setState('idle');
        return;
      }

      await navigator.clipboard.writeText(url);
      setState('copied');
      window.setTimeout(() => setState('idle'), 2500);
    } catch (error) {
      if (isAbort(error)) {
        setState('idle');
        return;
      }
      setState('failed');
    }
  };

  return (
    <div className={className}>
      <Button
        variant="ghost"
        icon="share-2"
        disabled={state === 'working'}
        onClick={() => void share()}
      >
        {state === 'working'
          ? sh('button.preparing', locale)
          : state === 'copied'
            ? sh('button.copied', locale)
            : sh('button.share', locale)}
      </Button>
      {state === 'failed' && <p className="screen__note">{sh('button.failed', locale)}</p>}
    </div>
  );
}
