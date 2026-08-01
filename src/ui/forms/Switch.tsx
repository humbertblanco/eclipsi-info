import type { InputHTMLAttributes } from 'react';
import '../ui.css';

export interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** Segona línia: la conseqüència concreta d'activar-ho, amb xifres si n'hi ha. */
  description?: string;
}

/**
 * Interruptor.
 *
 * El `<input type="checkbox">` real es manté al document i només es tapa
 * visualment (`.ui-visually-hidden`), en comptes de treure'l amb `display:none`:
 * així continua rebent el focus del teclat, l'anunci del lector de pantalla i
 * l'associació amb l'etiqueta, i el dibuix el fa el `<span>` germà.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  className,
  ...rest
}: SwitchProps) {
  return (
    <label className={['ui-switch', className ?? ''].filter(Boolean).join(' ')}>
      <input
        type="checkbox"
        className="ui-switch__input ui-visually-hidden"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        {...rest}
      />
      <span className="ui-switch__track" aria-hidden>
        <span className="ui-switch__knob" />
      </span>
      <span className="ui-switch__text">
        <span className="ui-switch__label">{label}</span>
        {description && <span className="ui-switch__desc">{description}</span>}
      </span>
    </label>
  );
}
