import type { HTMLAttributes, ReactNode } from 'react';
import '../ui.css';

export interface TooltipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'content'> {
  /** Explicació breu: una oració, sense punt final. */
  content?: ReactNode;
  /** @deprecated Nom antic de `content`. Es manté perquè no trenqui res. */
  label?: string;
  /**
   * De quin costat surt la bafarada. `top` per defecte; `bottom` quan l'element
   * és a dalt de tot de la pantalla i a sobre no hi ha lloc.
   */
  placement?: 'top' | 'bottom';
  children: ReactNode;
}

/**
 * Explicació breu en passar per damunt o en rebre el focus.
 *
 * ADVERTIMENT DE CONTRACTE: al mòbil no hi ha `hover`, i aquesta app és de
 * mòbil. Per això la bafarada NO pot contenir mai informació necessària —
 * només context d'una dada que ja és a la pantalla. El que calgui saber, es
 * diu al text.
 *
 * El contingut també va a `title` perquè quedi disponible sense CSS i als
 * navegadors on el `focus-within` no s'arribi a disparar.
 */
export function Tooltip({
  content,
  label,
  placement = 'top',
  className,
  children,
  ...rest
}: TooltipProps) {
  const text = content ?? label;

  return (
    <span
      className={['ui-tooltip', `ui-tooltip--${placement}`, className ?? '']
        .filter(Boolean)
        .join(' ')}
      // `title` només quan el contingut és text pla: un node de React no es pot
      // posar en un atribut, i `String(node)` hi escriuria "[object Object]".
      title={typeof text === 'string' ? text : undefined}
      {...rest}
    >
      {children}
      <span className="ui-tooltip__bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
