/**
 * Avís de versió nova.
 *
 * Discret i descartable a posta: la versió nova ja està baixada i esperant, no
 * hi ha cap urgència. El que sí que hi ha és un moment en què recarregar seria
 * catastròfic — durant els dos minuts de totalitat — i per això mai ho fem
 * sols. Vegeu `registerType: 'prompt'` a vite.config.ts.
 */

import { applyUpdate, dismissUpdate } from './registerServiceWorker';
import { useServiceWorker } from './useServiceWorker';
import './offline.css';

export function UpdatePrompt() {
  const { needRefresh } = useServiceWorker();
  if (!needRefresh) return null;

  return (
    <div className="off-update" role="status">
      <p className="off-update__text">Hi ha una versió nova de l’app, ja baixada.</p>
      <div className="off-update__actions">
        <button className="off-btn off-btn--quiet" onClick={dismissUpdate}>
          Ara no
        </button>
        <button className="off-btn off-btn--accent" onClick={() => void applyUpdate()}>
          Actualitza
        </button>
      </div>
    </div>
  );
}
