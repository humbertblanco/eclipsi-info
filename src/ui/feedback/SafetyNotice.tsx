import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from '../core/Icon';
import { ICON_MD } from '../sizes';
import '../ui.css';

/**
 * Nivells, tal com els fixa `components/feedback/SafetyNotice.d.ts`:
 * danger = no miris mai el Sol; warning = depèn del moment; info = context.
 *
 * `warn` és el nom antic de `warning`; es manté per no trencar crides.
 */
export type SafetyLevel = 'danger' | 'warning' | 'info' | 'warn';

/**
 * Icona per defecte de cada nivell.
 *
 * EL PERILL PORTA UN ULL BARRAT, NO UN TRIANGLE. Ho fixa el sistema i té una
 * raó que no és estètica: el triangle és el signe genèric de «compte amb
 * alguna cosa» i surt a tot arreu; l'ull barrat diu EXACTAMENT quina és
 * l'acció prohibida, que és mirar. Aquest component existeix per evitar una
 * lesió de retina, i el glif ha de dir què no s'ha de fer, no que passa res.
 */
const ICON_FOR_LEVEL: Record<'danger' | 'warning' | 'info', IconName> = {
  danger: 'eye-off',
  warning: 'triangle-alert',
  info: 'info',
};

export interface SafetyNoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {
  level?: SafetyLevel;
  /**
   * Títol amb una XIFRA concreta ("Només 100 segons són segurs"), no una
   * advertència vaga. El sistema ho demana explícitament: la gent obeeix un
   * número i ignora un "vés amb compte".
   */
  title?: string;
  /** Substitueix la icona per defecte del nivell. */
  icon?: IconName;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Avís de seguretat ocular. NO ÉS DESCARTABLE i no ho ha de ser mai.
 *
 * `role="alert"` en nivell de perill perquè el lector de pantalla l'anunciï
 * sense esperar que l'usuari hi arribi navegant. El sistema hi posa `note`
 * sempre; aquí es puja a `alert` per al perill perquè, si algú està fent servir
 * l'app amb el lector de pantalla i li apareix un avís de no mirar el Sol,
 * esperar que hi navegui és esperar massa.
 */
export function SafetyNotice({
  level = 'danger',
  title,
  icon,
  className,
  style,
  children,
  ...rest
}: SafetyNoticeProps) {
  const resolved = level === 'warn' ? 'warning' : level;

  return (
    <div
      role={resolved === 'danger' ? 'alert' : 'note'}
      className={['ui-safety', `ui-safety--${resolved}`, className ?? '']
        .filter(Boolean)
        .join(' ')}
      style={style}
      {...rest}
    >
      <span className="ui-safety__icon">
        <Icon name={icon ?? ICON_FOR_LEVEL[resolved]} size={ICON_MD} aria-hidden />
      </span>
      <span className="ui-safety__body">
        {title && <strong className="ui-safety__title">{title}</strong>}
        <span className="ui-safety__text">{children}</span>
      </span>
    </div>
  );
}
