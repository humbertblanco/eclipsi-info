import { Icon, type IconName } from '../core/Icon';
import { ICON_LG } from '../sizes';
import '../ui.css';

export interface TabBarItem<T extends string> {
  value: T;
  /** Etiqueta d'1 o 2 paraules. Hi caben quatre pestanyes a 390 px. */
  label: string;
  icon: IconName;
}

export interface TabBarProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  items: readonly TabBarItem<T>[];
  /** Nom del grup per als lectors de pantalla. */
  label?: string;
}

/**
 * Barra de pestanyes principal.
 *
 * La pestanya activa es marca amb COLOR, amb GRUIX DE TRAÇ i amb `aria-current`,
 * mai amb un fons: sobre la barra de vidre, un rectangle de fons per pestanya
 * converteix la barra en una graella i trenca la continuïtat amb el contingut
 * que hi passa per sota. El traç més gruixut de la icona activa és el que fa
 * que la pestanya on ets es distingeixi també per a qui no separa bé l'ambre
 * del gris.
 *
 * ICONES A 24 I NO A 20: `components/core/Icon.d.ts` ho diu literalment —
 * «16 inline with text, 20 default UI, 24 in tab bars». La barra és l'element
 * que es prem a les fosques i amb el dit gros, i és l'únic lloc de l'app on la
 * icona val més que l'etiqueta.
 *
 * El mateix component serveix per a la barra inferior del mòbil i per al
 * carril lateral de l'escriptori: el que canvia és la disposició, que la posa
 * l'estructura de l'app, no aquest fitxer.
 */
export function TabBar<T extends string>({ value, onChange, items, label }: TabBarProps<T>) {
  return (
    <nav className="ui-tabbar" aria-label={label}>
      {items.map((item) => {
        const on = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-current={on ? 'page' : undefined}
            className={['ui-tabbar__item', on ? 'ui-tabbar__item--on' : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => onChange(item.value)}
          >
            <Icon name={item.icon} size={ICON_LG} strokeWidth={on ? 2 : undefined} aria-hidden />
            <span className="ui-tabbar__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
