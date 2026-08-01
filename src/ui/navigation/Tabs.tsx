import type { HTMLAttributes } from 'react';
import '../ui.css';

export interface TabItem<T extends string> {
  value: T;
  label: string;
}

export interface TabsProps<T extends string>
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: T;
  onChange: (next: T) => void;
  items: readonly TabItem<T>[];
  label?: string;
}

/**
 * Pestanyes de contingut, subratllades.
 *
 * PER QUÈ NO ÉS EL MATEIX QUE `SegmentedControl`: aquest navega DINS d'una
 * pantalla (Abans / Durant / Fotografia) i el segmentat commuta l'estat d'un
 * control (el cel ara / el recorregut simulat). Dibuixar-los igual faria que
 * l'usuari esperés que el segmentat també canviés de pàgina.
 */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
  className,
  ...rest
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={['ui-tabs', className ?? ''].filter(Boolean).join(' ')}
      {...rest}
    >
      {items.map((item) => {
        const on = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={on}
            className={['ui-tabs__item', on ? 'ui-tabs__item--on' : ''].filter(Boolean).join(' ')}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
