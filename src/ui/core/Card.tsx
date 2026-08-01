import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import '../ui.css';

/**
 * `glass` només quan la targeta flota damunt d'una imatge o d'un mapa. Sobre el
 * fons pla és vidre sobre res: costa GPU i no aporta cap profunditat.
 *
 * `surface` és el nom antic de `default`; es manté per no trencar les crides
 * que ja hi ha.
 */
export type CardTone = 'default' | 'glass' | 'inset' | 'surface';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {
  tone?: CardTone;
  /**
   * La targeta sencera és premible: canvia de fons en passar-hi per damunt i
   * el cursor es converteix en una mà. NO posa cap semàntica de botó — si la
   * targeta ha de ser accionable amb el teclat, qui la fa servir hi ha de
   * posar un enllaç o un botó a dins.
   */
  interactive?: boolean;
  /**
   * Resplendor de corona en comptes d'ombra.
   *
   * NOMÉS PER A UNA TARGETA PER PANTALLA, la mateixa que porta l'accent ambre.
   * És la versió superfície de la regla d'un sol accent: dues targetes que
   * brillen no jerarquitzen res.
   */
  glow?: boolean;
  /**
   * Encoixinat intern. S'espera un token (`var(--sp-6)`), no un número.
   * És l'única propietat d'aparença que es passa des de fora, i és així perquè
   * les pantalles de referència en fan servir dos valors diferents.
   */
  padding?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Superfície bàsica. La jerarquia la fa el valor del fons i la línia d'un píxel. */
export function Card({
  tone = 'default',
  interactive = false,
  glow = false,
  padding = 'var(--sp-6)',
  className,
  style,
  children,
  ...rest
}: CardProps) {
  // `surface` era el nostre nom per al to per defecte; el contracte en diu
  // `default`. Es tradueix aquí perquè el CSS només conegui els noms bons.
  const resolved = tone === 'surface' ? 'default' : tone;

  return (
    <div
      className={[
        'ui-card',
        `ui-card--${resolved}`,
        interactive ? 'ui-card--interactive' : '',
        glow ? 'ui-card--glow' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ padding, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
