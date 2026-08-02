import type { HTMLAttributes } from 'react';
import '../ui.css';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string>
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: T;
  onChange: (next: T) => void;
  options: readonly SegmentedOption<T>[];
  /**
   * Ocupa tota l'amplada i reparteix les opcions en columnes iguals. És el
   * comportament per defecte del sistema, i és el correcte per a un commutador
   * que viu al peu d'una pantalla: totes les opcions han de tenir la mateixa
   * superfície tàctil, encara que una es digui "Cel" i l'altra "Recorregut
   * simulat". Amb `false`, s'ajusta al contingut.
   */
  fullWidth?: boolean;
  /**
   * Deixa que les opcions baixin a una segona fila quan no hi caben.
   *
   * PER QUÈ CAL. Aquest control reparteix l'amplada en columnes IGUALS, i amb
   * cinc opcions dins d'una columna de 256 px cada etiqueta rep 44 px: «Franja»
   * es llegia «Fr…» i «Enquadra», «E…». Cinc pastilles de dues lletres no són
   * un commutador, són un test d'endevinalles.
   *
   * Amb `wrap`, les columnes es declaren per amplada mínima i no per nombre: on
   * hi càpiguen totes, queden en una fila; on no, baixen. Cap etiqueta no es
   * talla mai.
   *
   * NO ÉS EL COMPORTAMENT PER DEFECTE a posta: amb dues o tres opcions —que és
   * per a què es va fer aquest control— la fila única és el correcte, i una
   * segona fila que apareix sola en una amplada intermèdia mouria els botons
   * sota el dit.
   */
  wrap?: boolean;
  /** Nom del grup per als lectors de pantalla. */
  label?: string;
}

/**
 * Commutador de dos o tres estats excloents.
 *
 * `role="tablist"` i no un grup de ràdios: semànticament commuta QUÈ es veu
 * (el cel ara / el recorregut simulat), no què val un camp d'un formulari.
 *
 * És genèric sobre `T` perquè `onChange` retorni el tipus literal de l'opció i
 * no un `string` qualsevol: així la unió de modes de cada pantalla es continua
 * comprovant en compilació després de passar pel control.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  fullWidth = true,
  wrap = false,
  label,
  className,
  style,
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={[
        'ui-seg',
        fullWidth ? 'ui-seg--full' : '',
        wrap ? 'ui-seg--wrap' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      // Les columnes es declaren aquí i no al CSS perquè el nombre d'opcions
      // només es coneix en temps d'execució. Amb `wrap` no s'hi posen: les
      // decideix la fulla d'estils per amplada mínima, i una columna fixa aquí
      // guanyaria sempre i tornaria a tallar les etiquetes.
      style={wrap ? style : { gridTemplateColumns: `repeat(${options.length}, 1fr)`, ...style }}
      {...rest}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={on}
            className={['ui-seg__opt', on ? 'ui-seg__opt--on' : ''].filter(Boolean).join(' ')}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
