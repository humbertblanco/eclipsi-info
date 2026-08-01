import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { ICON_MD, ICON_SM } from '../sizes';
import '../ui.css';

/**
 * Variants del botó, tal com les fixa `components/core/Button.d.ts`.
 *
 * `primary` és l'ÚNIC ambre. El sistema en permet un per pantalla: si en poses
 * dos, cap dels dos diu res. Quan una pantalla necessita dues accions, la
 * segona és `secondary` (neutra, amb vora) o `ghost` (terciària, sense caixa).
 *
 * `danger` NO ÉS UNA VARIANT COSMÈTICA MÉS. El contracte la reserva a dues
 * coses: destruir dades i, sobretot, al REFÚS DE SEGURETAT OCULAR. És el color
 * amb què l'app diu «ara no et pots treure el filtre». Que faltés volia dir que
 * l'app no tenia com dir-ho.
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  /** @deprecated Nom antic de `primary`. Es manté perquè no trenqui res. */
  | 'solid'
  /** @deprecated Nom antic de `ghost`. Es manté perquè no trenqui res. */
  | 'quiet';

export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Traducció dels noms antics als del contracte.
 *
 * PER QUÈ `ghost` ANTIC → `secondary`: el nostre `ghost` sempre ha dibuixat una
 * vora, que és exactament el que el sistema anomena `secondary`. El `ghost` del
 * sistema no té caixa. Reanomenar-lo sense aquesta taula hauria fet desaparèixer
 * la vora dels botons de reintent que ja hi ha a l'app.
 */
const ALIAS: Record<string, 'primary' | 'secondary' | 'ghost' | 'danger'> = {
  solid: 'primary',
  primary: 'primary',
  ghost: 'secondary',
  secondary: 'secondary',
  quiet: 'ghost',
  danger: 'danger',
};

/** Mida de la icona per mida de botó. El sistema fixa 16 / 18 / 20. */
const ICON_FOR_SIZE: Record<ButtonSize, number> = {
  sm: ICON_SM,
  md: ICON_MD,
  lg: ICON_MD,
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icona a l'esquerra de l'etiqueta. */
  icon?: IconName;
  /** Icona a la dreta de l'etiqueta. */
  iconRight?: IconName;
  /** Ocupa tota l'amplada disponible. */
  fullWidth?: boolean;
  /** Etiqueta en imperatiu, d'1 a 4 paraules. */
  children: ReactNode;
};

export type ButtonProps = CommonProps &
  (
    | ({ as?: 'button' } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>)
    | ({ as: 'a' } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'>)
  );

/**
 * Botó del sistema.
 *
 * `type="button"` per defecte i no `submit`: la majoria de botons de l'app
 * viuen fora de cap formulari, i el valor per defecte d'HTML fa que un botó
 * dins d'un formulari l'enviï sense que ningú ho hagi demanat.
 *
 * `as="a"` existeix perquè el contracte el demana i perquè un enllaç que sembla
 * un botó ha de continuar essent un `<a>`: obrir-lo en una pestanya nova,
 * copiar-ne l'adreça i que el lector de pantalla digui «enllaç» són coses que
 * un `<button>` amb `onClick` no dona.
 */
export function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    fullWidth = false,
    className,
    children,
    ...rest
  } = props;

  const iconSize = ICON_FOR_SIZE[size];
  const resolved = ALIAS[variant] ?? 'primary';

  const classes = [
    'ui-btn',
    `ui-btn--${resolved}`,
    `ui-btn--${size}`,
    fullWidth ? 'ui-btn--full' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      {icon && <Icon name={icon} size={iconSize} aria-hidden />}
      <span>{children}</span>
      {iconRight && <Icon name={iconRight} size={iconSize} aria-hidden />}
    </>
  );

  if (rest.as === 'a') {
    const { as: _as, ...anchor } = rest as { as: 'a' } & AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a className={classes} {...anchor}>
        {inner}
      </a>
    );
  }

  const {
    as: _as,
    type = 'button',
    ...button
  } = rest as { as?: 'button' } & ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button type={type} className={classes} {...button}>
      {inner}
    </button>
  );
}
