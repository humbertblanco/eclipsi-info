/**
 * Avís de versió nova.
 *
 * Discret i descartable a posta: la versió nova ja està baixada i esperant, no
 * hi ha cap urgència. El que sí que hi ha és un moment en què recarregar seria
 * catastròfic — durant els dos minuts de totalitat — i per això mai ho fem
 * sols. Vegeu `registerType: 'prompt'` a vite.config.ts.
 */

import type { Locale } from '../i18n';
import { applyUpdate, dismissUpdate } from './registerServiceWorker';
import { os } from './strings';
import { useServiceWorker } from './useServiceWorker';
import './offline.css';

export interface UpdatePromptProps {
  locale: Locale;
}

export function UpdatePrompt({ locale }: UpdatePromptProps) {
  const { needRefresh } = useServiceWorker();
  if (!needRefresh) return null;

  return (
    <div className="off-update" role="status">
      <p className="off-update__text">{os('update.ready', locale)}</p>
      <div className="off-update__actions">
        <button className="off-btn off-btn--quiet" onClick={dismissUpdate}>
          {os('update.later', locale)}
        </button>
        <button className="off-btn off-btn--accent" onClick={() => void applyUpdate()}>
          {os('update.apply', locale)}
        </button>
      </div>
    </div>
  );
}
