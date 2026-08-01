import type { HTMLAttributes, ReactNode } from 'react';
import '../ui.css';

export interface StatProps extends HTMLAttributes<HTMLDivElement> {
  /** Nom de la magnitud, curt. Va en majúscules d'overline. */
  label: string;
  /**
   * La xifra, JA FORMATADA i exacta.
   *
   * El component no formata res a posta: qui té la dada sap quants decimals
   * són honestos. El sistema prohibeix arrodonir a "aproximadament un minut i
   * mig" quan es té el número.
   */
  value: ReactNode;
  /** Unitat (min, %, °, km). Va apagada, al costat de la xifra. */
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  /**
   * `accent` posa la xifra en ambre. Recorda que només n'hi pot haver un.
   * `clear` la posa en verd de cel útil, i és per a xifres que responen la
   * pregunta «ho veuré?» amb un sí — no per a qualsevol cosa positiva.
   */
  tone?: 'default' | 'accent' | 'clear';
  /**
   * Alineació del bloc. `center` només dins d'una graella de xifres que ja
   * estigui centrada; en una columna de dades, alinear al centre fa que els
   * dígits no coincideixin verticalment i el bloc deixi de ser una taula.
   */
  align?: 'left' | 'center';
}

/** Parell etiqueta-xifra. La xifra sempre en mono tabular. */
export function Stat({
  label,
  value,
  unit,
  size = 'md',
  tone = 'default',
  align = 'left',
  className,
  ...rest
}: StatProps) {
  return (
    <div
      className={[
        'ui-stat',
        `ui-stat--${size}`,
        tone === 'default' ? '' : `ui-stat--${tone}`,
        align === 'center' ? 'ui-stat--center' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      <span className="ui-stat__label">{label}</span>
      <span className="ui-stat__row">
        <span className="ui-stat__value">{value}</span>
        {unit && <span className="ui-stat__unit">{unit}</span>}
      </span>
    </div>
  );
}
