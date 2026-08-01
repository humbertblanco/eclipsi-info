import type { CSSProperties, HTMLAttributes } from 'react';

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

/** Línia de contactes C1 → C2 → màxim → C3 → C4 per a un lloc. */
export function TimelineTrack({
  contacts = [],
  activeIndex = 0,
  style,
  ...rest
}: TimelineTrackProps) {
  const last = contacts.length - 1;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', ...style }}
      {...rest}
    >
      <div
        style={{
          position: 'relative',
          height: 2,
          background: 'var(--border-subtle)',
          borderRadius: 1,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: 2,
            borderRadius: 1,
            background: 'var(--accent)',
            width: contacts.length > 1 ? `${(activeIndex / last) * 100}%` : '0%',
            transition: 'width var(--dur-slow) var(--ease-orbit)',
          }}
        />
        {contacts.map((c, i) => (
          <span
            key={c.label}
            style={{
              position: 'absolute',
              top: -4,
              left: `${contacts.length > 1 ? (i / last) * 100 : 0}%`,
              transform: 'translateX(-50%)',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: i <= activeIndex ? 'var(--accent)' : 'var(--ink-600)',
              border: '2px solid var(--bg-page)',
              boxShadow: i === activeIndex ? 'var(--glow-corona)' : 'none',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
        {contacts.map((c, i) => (
          <span
            key={c.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              alignItems: i === 0 ? 'flex-start' : i === last ? 'flex-end' : 'center',
            }}
          >
            <span
              style={{
                font: 'var(--text-overline)',
                letterSpacing: 'var(--ls-caps)',
                textTransform: 'uppercase',
                color: i === activeIndex ? 'var(--text-accent)' : 'var(--text-muted)',
              }}
            >
              {c.label}
            </span>
            <span
              style={{
                font: 'var(--text-body-sm)',
                fontFamily: 'var(--font-mono)',
                color: i <= activeIndex ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {c.time}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
