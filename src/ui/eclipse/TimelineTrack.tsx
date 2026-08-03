import type { CSSProperties, HTMLAttributes } from 'react';
import '../ui.css';

export interface TimelineContact {
  /** Etiqueta curta: C1, C2, màxim, C3, C4. */
  label: string;
  /** Hora ja formatada. El component no formata res: només pinta. */
  time: string;
}

export interface TimelineTrackProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {
  contacts?: TimelineContact[];
  activeIndex?: number;
  style?: CSSProperties;
}

/**
 * Línia de contactes C1 → C2 → màxim → C3 → C4 per a un lloc.
 *
 * Tota la maquetació viu a `ui.css` (bloc `.ui-timeline*`), com a la resta de
 * components. Aquí només queden els DOS estils de debò dinàmics —l'amplada del
 * tram recorregut i la posició de cada punt—, que són percentatges que surten
 * de comptar contactes i no es poden escriure en cap regla estàtica.
 */
export function TimelineTrack({
  contacts = [],
  activeIndex = 0,
  className,
  style,
  ...rest
}: TimelineTrackProps) {
  const last = contacts.length - 1;

  return (
    <div
      className={['ui-timeline', className ?? ''].filter(Boolean).join(' ')}
      style={style}
      {...rest}
    >
      <div className="ui-timeline__track">
        <div
          className="ui-timeline__fill"
          style={{ width: contacts.length > 1 ? `${(activeIndex / last) * 100}%` : '0%' }}
        />
        {contacts.map((c, i) => (
          <span
            key={c.label}
            className={[
              'ui-timeline__dot',
              i <= activeIndex ? 'ui-timeline__dot--past' : '',
              i === activeIndex ? 'ui-timeline__dot--on' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ left: `${contacts.length > 1 ? (i / last) * 100 : 0}%` }}
          />
        ))}
      </div>

      <div className="ui-timeline__labels">
        {contacts.map((c, i) => (
          <span key={c.label} className="ui-timeline__contact">
            <span
              className={
                i === activeIndex
                  ? 'ui-timeline__label ui-timeline__label--on'
                  : 'ui-timeline__label'
              }
            >
              {c.label}
            </span>
            <span
              className={
                i <= activeIndex ? 'ui-timeline__time ui-timeline__time--past' : 'ui-timeline__time'
              }
            >
              {c.time}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
