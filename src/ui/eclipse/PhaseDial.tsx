import { useId, type CSSProperties, type HTMLAttributes } from 'react';

export interface PhaseDialProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {
  /** Fracció de l'ÀREA solar tapada, de 0 a 1. */
  obscuration?: number;
  /**
   * Cert NOMÉS si des d'aquest punt es veu de debò la totalitat.
   *
   * No es dedueix de l'obscuració, i aquest és tot el motiu que existeixi:
   * abans el dibuix de la corona el disparava `obscuration > 0.985` tot sol, i
   * un 99,6 % pot ser un parcial pur, un total que el relleu tapa, o el caire
   * de la franja. Els tres casos ensenyaven corona, que és exactament la cosa
   * que aquell usuari NO veurà. Un anular tampoc no en té mai: el que queda és
   * anell de fotosfera.
   *
   * Qui el passa ha de mirar el veredicte (`centralVisibleSec > 0`), no el
   * tipus d'eclipsi del catàleg.
   */
  totality?: boolean;
  /** Costat del quadrat en píxels. El sistema el fa servir entre 96 i 160. */
  size?: number;
  glow?: boolean;
  style?: CSSProperties;
}

/**
 * Gruix mínim del cròissant, en píxels.
 *
 * A 99,6 % d'obscuració la separació real dels dos discos és de 0,26 px a
 * mida 96: geomètricament correcta i invisible, o sigui una caixa que sembla
 * espatllada. Això és un terra de LLEGIBILITAT, com l'amplada mínima d'un traç
 * en un gràfic, no un retoc de la xifra: el percentatge exacte es llegeix al
 * costat i no el toca ningú.
 */
const MIN_SLIVER_PX = 2;

/**
 * Indicador d'obscuració: el disc lunar llisca per damunt del solar.
 *
 * És l'única peça de la interfície que dibuixa geometria d'eclipsi fora del
 * canvas de simulació — el sistema de disseny prohibeix explícitament redibuixar
 * mitges llunes a mà en cap altre lloc.
 */
export function PhaseDial({
  obscuration = 0.5,
  totality = false,
  size = 120,
  glow = true,
  style,
  ...rest
}: PhaseDialProps) {
  const r = size * 0.34;
  const gap = (1 - Math.max(0, Math.min(1, obscuration))) * r * 2;
  // Amb totalitat el desplaçament ha de ser el real: els dos discos se
  // superposen i el que es dibuixa és la corona, unes línies més avall. Sense
  // totalitat, per molt alta que sigui l'obscuració SEMPRE queda fotosfera a la
  // vista, i el dibuix ho ha de dir.
  const offset = totality ? gap : Math.max(gap, MIN_SLIVER_PX);
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

          I LA CONDICIÓ JA NO ÉS L'OBSCURACIÓ. Era `obscuration > 0.985` a
          seques, i això dibuixava corona a qualsevol cosa per damunt del
          98,5 %: un parcial pur del 99,7 %, un total que el relleu tapa (on el
          veredicte diu 0 s), el caire de la franja, i fins i tot un anular.
          Cap d'aquestes quatre persones veurà mai una corona.

          És la mentida que el projecte jura no dir —«el 99,7 % no és 100 %»,
          ESTAT.md §3.2— però dita en imatge, que és pitjor: al costat del
          badge «Parcial» i del text honest «99,7 %», el dibuix ensenyava
          justament allò que aquell usuari es perdrà. I la imatge és el que la
          gent recorda.
        */}
        {totality && (
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
