import { useId, type SelectHTMLAttributes } from 'react';
import { Icon } from '../core/Icon';
import { ICON_SM } from '../sizes';
import '../ui.css';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value: T;
  onChange: (next: T) => void;
  options: readonly SelectOption<T>[];
  label?: string;
}

/**
 * Desplegable.
 *
 * Es fa servir el `<select>` natiu i NO un menú propi: al mòbil el natiu obre
 * la roda del sistema, que es maneja amb el polze i a les fosques molt millor
 * que qualsevol llista pròpia, i ja va traduït.
 *
 * El cast a `T` a `onChange` és segur perquè les úniques opcions que el
 * navegador pot retornar són les que hem pintat nosaltres.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  ...rest
}: SelectProps<T>) {
  const id = useId();

  const field = (
    // El galó el dibuixem nosaltres perquè el sistema apaga l'aparença nativa
    // (`appearance: none`): la fletxa que hi posa cada navegador té el seu
    // color i la seva mida, i sobre el fons nocturn n'hi ha que la pinten
    // gairebé blanca. Va amb `pointer-events: none` perquè el clic continuï
    // arribant al `<select>` i obrint la roda del sistema.
    <span className="ui-selectwrap">
      <select
        id={id}
        className={['ui-select', label ? '' : (className ?? '')].filter(Boolean).join(' ')}
        value={value}
        aria-label={label ? undefined : rest['aria-label']}
        onChange={(event) => onChange(event.target.value as T)}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={ICON_SM} className="ui-selectwrap__caret" aria-hidden />
    </span>
  );

  if (!label) return field;

  return (
    <div className={['ui-field', className ?? ''].filter(Boolean).join(' ')}>
      <label className="ui-field__label" htmlFor={id}>
        {label}
      </label>
      {field}
    </div>
  );
}
