/**
 * Indicador de connexió i de disponibilitat offline.
 *
 * Pensat per ser visible al camp, on la pregunta no és "tinc xarxa?" sinó
 * "l'app em funcionarà igualment?". La frase no diu només "sense xarxa": diu
 * si això és un problema o no. Al camp, "SENSE XARXA" tot sol fa por;
 * "SENSE XARXA · DESAT" és informació útil.
 */

import type { Locale } from '../i18n';
import { os } from './strings';
import { useOnlineStatus } from './useOnlineStatus';
import { useServiceWorker } from './useServiceWorker';
// La barra superior pot muntar aquest indicador sense el panell: els estils
// han de venir amb ell.
import './offline.css';

export interface ConnectionBadgeProps {
  locale: Locale;
  className?: string;
}

type Tone = 'clear' | 'muted' | 'danger';

export function ConnectionBadge({ locale, className }: ConnectionBadgeProps) {
  const { online } = useOnlineStatus();
  const { offlineReady, registered } = useServiceWorker();

  let tone: Tone = 'muted';
  let text = os('badge.online', locale);

  if (!online) {
    // Amb l'esquelet desat, estar sense xarxa deixa de ser una avaria.
    const saved = offlineReady || registered;
    tone = saved ? 'clear' : 'danger';
    text = saved ? os('badge.offlineSaved', locale) : os('badge.offlineUnsaved', locale);
  }

  return (
    <span
      className={className ? `off-badge off-badge--${tone} ${className}` : `off-badge off-badge--${tone}`}
      role="status"
      aria-live="polite"
    >
      <span className="off-badge__dot" aria-hidden="true" />
      {text}
    </span>
  );
}
