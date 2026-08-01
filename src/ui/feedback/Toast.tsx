import type { HTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from '../core/Icon';
import { IconButton } from '../core/IconButton';
import { ICON_SM } from '../sizes';
import type { Tone } from '../core/Badge';
import '../ui.css';

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * El contracte del sistema en preveu tres (`neutral`, `clear`, `danger`).
   * Aquí s'accepta la paleta sencera de tons perquè és la mateixa que la de
   * `Badge` i el motor de nuvolositat ja parla amb aquests noms.
   */
  tone?: Tone;
  icon?: IconName;
  /** Si es passa, apareix el botó de tancar. Sense això, l'avís es queda. */
  onClose?: () => void;
  /** Text del botó de tancar per al lector de pantalla. */
  closeLabel?: string;
  children: ReactNode;
}

/**
 * Confirmació breu.
 *
 * `role="status"` i `aria-live="polite"`: s'anuncia quan el lector de pantalla
 * acabi el que estigui dient, sense interrompre. Un avís de seguretat sí que
 * interromp, però això és feina de `SafetyNotice`, no d'aquí.
 *
 * EL TO VA A LA ICONA I NO A LA CAIXA. Abans pintàvem la vora i el text del
 * color del to, i el resultat era un rètol de colors flotant damunt del mapa.
 * El sistema deixa la caixa neutra —vidre, text primari— i tenyeix només el
 * glif: n'hi ha prou per dir de què va i no competeix amb el contingut de sota.
 */
export function Toast({
  tone = 'neutral',
  icon,
  onClose,
  closeLabel = 'Tanca',
  className,
  children,
  ...rest
}: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={['ui-toast', `ui-toast--${tone}`, className ?? ''].filter(Boolean).join(' ')}
      {...rest}
    >
      {/* La campana és la icona per defecte del sistema: un avís sense glif
          sembla un tros de text que ha quedat surant. */}
      <span className="ui-toast__icon">
        <Icon name={icon ?? 'bell'} size={ICON_SM} aria-hidden />
      </span>
      <span className="ui-toast__body">{children}</span>
      {onClose && (
        <IconButton icon="x" label={closeLabel} variant="ghost" size="sm" onClick={onClose} />
      )}
    </div>
  );
}
