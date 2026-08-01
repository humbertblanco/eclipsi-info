import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { ICON_SM } from '../sizes';
import '../ui.css';

export interface TagProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Cert si aquest és el valor triat ara mateix. */
  selected?: boolean;
  /** Icona petita davant del text. */
  icon?: IconName;
  /**
   * Si es passa, l'etiqueta porta una creu per treure-la del filtre.
   *
   * L'ACCIÓ DE TREURE HA DE SER SEPARABLE DE L'ACCIÓ DE TRIAR: si la creu fos
   * part del mateix botó, prémer-la seleccionaria l'etiqueta i tot seguit la
   * faria fora, i amb el dit gros no hi ha manera d'encertar-hi.
   */
  onRemove?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Text de la creu per al lector de pantalla. Obligatori si hi ha `onRemove`. */
  removeLabel?: string;
  children: ReactNode;
}

/**
 * Etiqueta triable, per comparar llocs d'una ullada.
 *
 * PER QUÈ ÉS UN `<button>` I NO EL `<span>` DEL SISTEMA: el sistema la dibuixa
 * amb un `<span onClick>`, que no rep el focus del teclat ni s'anuncia com a
 * premuda. Aquí ha de ser navegable amb teclat i ha de dir amb `aria-pressed`
 * si està triada. L'aparença és exactament la del sistema; el que canvia és
 * només l'element, i canviar-lo no té cap cost visual.
 *
 * No és un `<input type=radio>` perquè el grup no sempre és exclusiu ni sempre
 * viu dins d'un formulari.
 */
export function Tag({
  selected = false,
  icon,
  onRemove,
  removeLabel,
  className,
  type = 'button',
  children,
  ...rest
}: TagProps) {
  const classes = ['ui-tag', selected ? 'ui-tag--on' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      {icon && <Icon name={icon} size={ICON_SM} aria-hidden />}
      {children}
    </>
  );

  if (!onRemove) {
    return (
      <button type={type} aria-pressed={selected} className={classes} {...rest}>
        {inner}
      </button>
    );
  }

  // Amb creu, l'etiqueta passa a ser un contenidor amb DOS botons. Un botó dins
  // d'un altre botó no és HTML vàlid i el navegador el desmunta.
  return (
    <span className={`${classes} ui-tag--removable`}>
      <button type={type} aria-pressed={selected} className="ui-tag__label" {...rest}>
        {inner}
      </button>
      <button
        type="button"
        className="ui-tag__remove"
        aria-label={removeLabel}
        title={removeLabel}
        onClick={onRemove}
      >
        <Icon name="x" size={ICON_SM} aria-hidden />
      </button>
    </span>
  );
}
