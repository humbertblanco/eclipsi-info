import { useId, type CSSProperties, type HTMLAttributes } from 'react';

export interface PhaseDialProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {
  /** Fracció de l'ÀREA solar tapada, de 0 a 1. */
  obscuration?: number;
  /** Costat del quadrat en píxels. El sistema el fa servir entre 96 i 160. */
  size?: number;
  glow?: boolean;
  style?: CSSProperties;
}

/**
 * Indicador d'obscuració: el disc lunar llisca per damunt del solar.
 *
 * És l'única peça de la interfície que dibuixa geometria d'eclipsi fora del
 * canvas de simulació — el sistema de disseny prohibeix explícitament redibuixar
 * mitges llunes a mà en cap altre lloc.
 */
export function PhaseDial({
  obscuration = 0.5,
  size = 120,
  glow = true,
  style,
  ...rest
}: PhaseDialProps) {
  const r = size * 0.34;
  const offset = (1 - Math.max(0, Math.min(1, obscuration))) * r * 2;
  // useId conté dos punts, que no són vàlids dins d'una referència url(#…).
  const id = useId().replace(/:/g, '');

  return (
    <div style={{ position: 'relative', width: size, height: size, ...style }} {...rest}>
      {glow && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--grad-corona)',
            borderRadius: '50%',
          }}
        />
      )}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{ position: 'relative' }}
      >
        <defs>
          <mask id={`m${id}`}>
            <rect width={size} height={size} fill="#000" />
            <circle cx={size / 2} cy={size / 2} r={r} fill="#fff" />
            <circle cx={size / 2 + offset} cy={size / 2 - offset * 0.35} r={r} fill="#000" />
          </mask>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r + 4}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth="1"
        />

        {/*
          LA TOTALITAT VA A PART, i no és cap floritura.

          La màscara d'aquest component funciona restant un disc negre al disc
          blanc del Sol. Amb obscuració 1 el desplaçament és zero, els dos
          cercles se superposen exactament, i el que queda és una màscara
          completament negra: la caixa surt BUIDA. O sigui que justament el
          moment que tot el producte existeix per explicar es dibuixava com un
          forat.

          El contracte del sistema ho diu explícitament: per damunt de 0,985
          s'ha de veure un disc negre amb l'anell fi de corona, no una caixa
          buida. Aquí es reprodueix la implementació del sistema.
        */}
        {obscuration > 0.985 && (
          <g>
            <circle cx={size / 2} cy={size / 2} r={r} fill="var(--ink-950)" />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r + 1}
              fill="none"
              stroke="var(--corona-100)"
              strokeWidth={Math.max(1.5, size * 0.022)}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r + 5}
              fill="none"
              stroke="var(--sun-200)"
              strokeOpacity=".45"
              strokeWidth="1"
            />
          </g>
        )}

        <g mask={`url(#m${id})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="var(--sun-400)" />
        </g>
      </svg>
    </div>
  );
}
