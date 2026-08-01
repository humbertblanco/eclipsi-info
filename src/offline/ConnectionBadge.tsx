/**
 * Indicador de connexió i de disponibilitat offline.
 *
 * Pensat per anar a la barra superior, sempre visible. La frase no diu només
 * "sense xarxa": diu si això és un problema o no. Al camp, "SENSE XARXA" tot
 * sol fa por; "SENSE XARXA · TOT DESAT" és informació útil.
 */

import { useOnlineStatus } from './useOnlineStatus';
import { useServiceWorker } from './useServiceWorker';
// La barra superior pot muntar aquest indicador sense el panell: els estils
// han de venir amb ell.
import './offline.css';

export interface ConnectionBadgeProps {
  className?: string;
}

type Tone = 'clear' | 'muted' | 'danger';

export function ConnectionBadge({ className }: ConnectionBadgeProps) {
  const { online } = useOnlineStatus();
  const { offlineReady, registered } = useServiceWorker();

  let tone: Tone = 'muted';
  let text = 'En línia';

  if (!online) {
    // Amb l'esquelet desat, estar sense xarxa deixa de ser una avaria.
    tone = offlineReady || registered ? 'clear' : 'danger';
    text = offlineReady || registered ? 'Sense xarxa · desat' : 'Sense xarxa · no desat';
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
