import type { ReactNode } from 'react';
import { Icon, type IconName } from '../core/Icon';
import { ICON_SM } from '../sizes';
import '../ui.css';

export interface TipCardProps {
  /**
   * Ordinal de la fila. S'omple de zeros AQUÍ ("3" → "03"): el sistema ho fa
   * així i, si ho fes cadascú a la seva crida, un índex de dotze entrades
   * acabaria barrejant "3" i "03" a la mateixa columna.
   *
   * És preferible a la icona quan les entrades tenen un ordre real.
   */
  index?: number | string;
  /** Icona apagada de 16 px. Només quan NO hi ha ordinal. */
  icon?: IconName;
  /** @deprecated Nom antic d'`index`. Es manté perquè no trenqui res. */
  ordinal?: string;
  title: string;
  /** Temps de lectura o etiqueta curta, a la dreta. */
  meta?: string;
  /**
   * `row` és una fila d'índex separada per una línia d'un píxel (per defecte).
   * `card` la tanca en una caixa, i és NOMÉS per a barres laterals i per a
   * superposicions damunt del mapa, on no hi ha una llista que faci de context.
   */
  variant?: 'row' | 'card';
  /** Si es passa, la fila és premible. */
  onClick?: () => void;
  /** Una línia de resum. Mai dues. */
  children: ReactNode;
  className?: string;
}

/**
 * Consell de la guia, com a FILA D'ÍNDEX i no com a targeta decorativa.
 *
 * El sistema ho demana així explícitament: ordinal o icona, títol, una línia de
 * resum i el temps de lectura a la dreta, separats per una línia d'un píxel. Un
 * índex de deu targetes amb fons i ombra és il·legible; deu files no.
 */
export function TipCard({
  index,
  icon,
  ordinal,
  title,
  meta,
  variant = 'row',
  onClick,
  children,
  className,
}: TipCardProps) {
  const raw = index ?? ordinal;
  const padded = raw === undefined ? null : String(raw).padStart(2, '0');

  const inner = (
    <>
      {/* La casella de l'ordinal existeix sempre, amb ordinal o sense: si
          desaparegués, els títols de les files amb icona i sense quedarien a
          sagnats diferents i la llista deixaria de tenir columna. */}
      <span className="ui-tip__lead">
        {padded ?? (icon ? <Icon name={icon} size={ICON_SM} aria-hidden /> : null)}
      </span>
      <span className="ui-tip__body">
        <span className="ui-tip__title">{title}</span>
        <span className="ui-tip__text">{children}</span>
      </span>
      {meta && <span className="ui-tip__meta">{meta}</span>}
    </>
  );

  const classes = [
    'ui-tip',
    `ui-tip--${variant}`,
    onClick ? 'ui-tip--action' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  // Sense acció NO és un botó: un `<button>` que no fa res és una trampa per al
  // teclat i per al lector de pantalla.
  if (!onClick) return <div className={classes}>{inner}</div>;

  return (
    <button type="button" className={classes} onClick={onClick}>
      {inner}
    </button>
  );
}
