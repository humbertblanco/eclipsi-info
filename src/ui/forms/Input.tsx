import { useId, type InputHTMLAttributes } from 'react';
import { Icon, type IconName } from '../core/Icon';
import { ICON_SM } from '../sizes';
import '../ui.css';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  /**
   * Retorna el valor ja desempaquetat i no l'esdeveniment.
   *
   * DIVERGEIX DEL CONTRACTE, que el declara `(e: ChangeEvent)`. Es manté així
   * perquè totes les crides feien `event.target.value` i era soroll repetit;
   * qui necessiti l'esdeveniment sencer té `onChangeCapture` i la resta
   * d'atributs natius, que hi passen igual.
   */
  onChange?: (next: string) => void;
  /** Icona apagada a l'esquerra del camp. */
  icon?: IconName;
  /** Etiqueta visible a sobre. Sense etiqueta, el `placeholder` fa d'`aria-label`. */
  label?: string;
  /** Línia d'ajuda apagada sota el camp. */
  hint?: string;
  /**
   * Missatge d'error. Substitueix el `hint` i tenyeix la vora d'ember.
   *
   * L'ERROR VA SOTA EL CAMP I NO EN UN AVÍS A PART: el sistema ho vol al
   * costat de la cosa que s'ha d'arreglar, i s'associa amb `aria-describedby`
   * perquè el lector de pantalla el llegeixi en entrar al camp, no després.
   */
  error?: string;
  /** Vidre per quan el camp flota damunt del mapa o de la càmera. */
  glass?: boolean;
}

/**
 * Camp de text d'una línia.
 *
 * `onChange` retorna el valor ja desempaquetat i no l'esdeveniment: totes les
 * crides de l'app feien `event.target.value` i era soroll repetit.
 */
export function Input({
  onChange,
  icon,
  label,
  hint,
  error,
  glass = false,
  className,
  placeholder,
  ...rest
}: InputProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;

  const field = (
    <div
      className={[
        'ui-input',
        glass ? 'ui-input--glass' : '',
        error ? 'ui-input--error' : '',
        label || note ? '' : (className ?? ''),
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon && <Icon name={icon} size={ICON_SM} aria-hidden />}
      <input
        id={id}
        className="ui-input__field"
        placeholder={placeholder}
        aria-label={label ? undefined : placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        {...rest}
      />
    </div>
  );

  if (!label && !note) return field;

  return (
    <div className={['ui-field', className ?? ''].filter(Boolean).join(' ')}>
      {label && (
        <label className="ui-field__label" htmlFor={id}>
          {label}
        </label>
      )}
      {field}
      {note && (
        <span
          id={noteId}
          className={error ? 'ui-field__note ui-field__note--error' : 'ui-field__note'}
        >
          {note}
        </span>
      )}
    </div>
  );
}
