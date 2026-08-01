import type { HTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { ICON_XS } from '../sizes';
import '../ui.css';

/**
 * Tons semàntics. Són els mateixos noms que els tokens `--status-*`, a posta:
 * el to d'una insígnia sempre vol dir el mateix a tota l'app.
 * `clear` es veurà, `partial` es veurà a mitges, `cloudy` no se sap,
 * `danger` és perill físic, `info` és context.
 */
export type Tone = 'clear' | 'partial' | 'cloudy' | 'danger' | 'info' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /**
   * Icona de 12 px abans del text. Alternativa al punt quan l'estat té una
   * imatge pròpia (un núvol, un ull barrat) i no només un color.
   */
  icon?: IconName;
  /** Afegeix el punt de color al davant. Per a estats vius, no per a etiquetes. */
  dot?: boolean;
  children: ReactNode;
}

/** Etiqueta d'estat, curta i en majúscules. Mai més de tres paraules. */
export function Badge({
  tone = 'neutral',
  icon,
  dot = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={['ui-badge', `ui-badge--${tone}`, className ?? ''].filter(Boolean).join(' ')}
      {...rest}
    >
      {dot && <span className="ui-badge__dot" aria-hidden />}
      {/* Traç 2 i no 1,75: a 12 px el pes de la marca es dilueix i la icona
          es llegeix com una taca. El sistema fa la mateixa excepció. */}
      {icon && <Icon name={icon} size={ICON_XS} strokeWidth={2} aria-hidden />}
      {children}
    </span>
  );
}
