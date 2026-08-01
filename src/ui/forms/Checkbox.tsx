import type { InputHTMLAttributes } from 'react';
import { Icon } from '../core/Icon';
import { ICON_SM } from '../sizes';
import '../ui.css';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  label?: string;
}

/**
 * Casella d'una llista de comprovació.
 *
 * El tic és `<Icon name="check">` amb traç 3, tal com el dibuixa el sistema.
 * Abans aquí hi havia un SVG dibuixat a mà perquè `check` no era al vocabulari
 * d'icones; ara hi és, i tenir dues maneres de dibuixar el mateix tic era
 * exactament la mena de deriva que el vocabulari tancat ha d'evitar.
 */
export function Checkbox({
  checked = false,
  onChange,
  label,
  className,
  ...rest
}: CheckboxProps) {
  return (
    <label className={['ui-check', className ?? ''].filter(Boolean).join(' ')}>
      <input
        type="checkbox"
        className="ui-check__input ui-visually-hidden"
        checked={checked}
        onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
        {...rest}
      />
      <span className="ui-check__box" aria-hidden>
        <Icon name="check" size={ICON_SM} strokeWidth={3} />
      </span>
      {label && <span className="ui-check__label">{label}</span>}
    </label>
  );
}
