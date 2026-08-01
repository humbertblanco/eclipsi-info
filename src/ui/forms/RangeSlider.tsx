import { useId, type InputHTMLAttributes } from 'react';
import '../ui.css';

export interface RangeTick {
  value: number;
  /** Etiqueta curta: C1, C2, C4. */
  label: string;
}

export interface RangeSliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Nom del control, en majúscules d'overline. */
  label?: string;
  /**
   * Lectura JA FORMATADA del valor actual (una hora, una durada).
   * Es dona feta perquè el control no ha de saber què representa el número.
   */
  valueLabel?: string;
  /** Marques fixes sota la via. Es col·loquen per interpolació entre min i max. */
  ticks?: readonly RangeTick[];
}

/**
 * Control lliscant per recórrer la línia temporal de l'eclipsi.
 *
 * Es manté l'`input[type=range]` natiu i només es redibuixa amb CSS: el teclat,
 * el lector de pantalla i l'arrossegament amb el dit ja hi funcionen. Refer-ho
 * amb `div` i esdeveniments de punter vol dir perdre les tres coses i guanyar
 * només un thumb més bonic.
 */
export function RangeSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  valueLabel,
  ticks,
  className,
  style,
  ...rest
}: RangeSliderProps) {
  const id = useId();
  const span = max - min;
  // Fracció recorreguda. Va a una variable CSS perquè la via pintada la dibuixa
  // la fulla d'estil amb un degradat de dues parades: l'`input[type=range]`
  // natiu no té cap manera de pintar només el tram ja recorregut, i és
  // justament el tram que diu on ets dins de l'eclipsi.
  const filled = span > 0 ? Math.max(0, Math.min(1, (value - min) / span)) : 0;

  return (
    <div
      className={['ui-range', className ?? ''].filter(Boolean).join(' ')}
      style={{ ...style, ['--ui-range-pct' as string]: `${filled * 100}%` }}
    >
      {(label || valueLabel) && (
        <div className="ui-range__head">
          {label && (
            <label className="ui-range__label" htmlFor={id}>
              {label}
            </label>
          )}
          {valueLabel && <span className="ui-range__value">{valueLabel}</span>}
        </div>
      )}

      <input
        id={id}
        type="range"
        className="ui-range__input"
        min={min}
        max={max}
        step={step}
        value={value}
        // `aria-valuetext` porta la lectura formatada: sense això el lector de
        // pantalla llegeix "57" en comptes de "20:29".
        aria-valuetext={valueLabel}
        onChange={(event) => onChange(Number(event.target.value))}
        {...rest}
      />

      {ticks && ticks.length > 0 && span > 0 && (
        <div className="ui-range__ticks" aria-hidden>
          {ticks.map((tick) => (
            <span
              key={tick.label}
              className={[
                'ui-range__tick',
                Math.abs(tick.value - value) < step ? 'ui-range__tick--on' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ left: `${((tick.value - min) / span) * 100}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
