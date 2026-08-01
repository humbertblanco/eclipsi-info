import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icon';
import { ICON_LG, ICON_MD, ICON_SM } from '../sizes';
import '../ui.css';

/**
 * Variants, tal com les fixa `components/core/IconButton.d.ts`.
 *
 * `plain` és el nom antic de `ghost` (transparent del tot). Es manté perquè no
 * trenqui res, però el nom bo és `ghost`.
 */
export type IconButtonVariant = 'solid' | 'secondary' | 'ghost' | 'plain';

export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  /**
   * Nom de l'acció, en imperatiu. És OBLIGATORI: un botó que només és una
   * icona no diu res a un lector de pantalla. Va a `aria-label` i a `title`.
   */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

/** Diàmetre i mida d'icona per mida, tal com els fixa el sistema. */
const ICON_FOR_SIZE: Record<IconButtonSize, number> = {
  sm: ICON_SM,
  md: ICON_MD,
  lg: ICON_LG,
};

/**
 * Botó d'una sola icona.
 *
 * En mida `sm` el dibuix baixa a 36 px però l'àrea sensible es manté als 44 px
 * que exigeix el sistema, gràcies a `.ui-tappable`. Aquesta separació entre
 * mida visual i mida tàctil és el que permet un HUD prim que encara es pugui
 * prémer amb el dit gros a les fosques.
 *
 * PER QUÈ EL PER DEFECTE ÉS `secondary` I NO `ghost`: és el que diu el sistema.
 * Un botó d'icona sense caixa damunt d'un mapa o d'una imatge no es veu; la
 * caixa neutra és el que el fa trobable, i qui vulgui el botó despullat ho ha
 * de demanar explícitament.
 */
export function IconButton({
  icon,
  label,
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  const resolved = variant === 'plain' ? 'ghost' : variant;

  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={[
        'ui-iconbtn',
        `ui-iconbtn--${resolved}`,
        size === 'sm' ? 'ui-iconbtn--sm ui-tappable' : '',
        size === 'lg' ? 'ui-iconbtn--lg' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      <Icon name={icon} size={ICON_FOR_SIZE[size]} aria-hidden />
    </button>
  );
}
