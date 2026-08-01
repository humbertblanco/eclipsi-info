import { useEffect, useState, type CSSProperties } from 'react';
/* El repartiment del temps i la tria d'unitats viuen al costat, en lògica pura. */
import { DAY_MS, MINUTE_MS, pad, split, UNIT_FIELD, unitsFor } from './countdownParts';
import '../ui.css';

export interface CountdownProps {
  /**
   * Instant objectiu, en ms d'època. `null` mentre encara no se sap on serà
   * l'usuari: el component ho diu amb guions en comptes d'inventar-se un zero.
   *
   * PER QUÈ MIL·LISEGONS I NO L'ISO DEL CONTRACTE: l'instant que compta aquí
   * no és una data escrita a mà sinó el resultat de `computeLocalCircumstances`,
   * que ja el dona com a `Date`. Passar per una cadena ISO voldria dir formatar
   * i tornar a analitzar una data cada segon, i obrir la porta al cas en què la
   * cadena no s'entengui i el rellotge marqui `NaN` sense dir-ho.
   *
   * El contracte també s'accepta: si es passa `target`, s'analitza un sol cop.
   */
  targetMs?: number | null;
  /**
   * Instant objectiu com a marca de temps ISO, tal com el demana el contracte
   * del sistema. És una alternativa a `targetMs`, no un complement: si es
   * passen tots dos, mana `targetMs`.
   */
  target?: string;
  /** Què és el que es compta. Exemple: "Fins a la totalitat". */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Etiqueta quan l'instant ja ha passat. Per defecte, compta el temps des de llavors. */
  pastLabel?: string;
  /** Injecta "ara" per als tests. Sense això, el component fa el seu propi tic. */
  nowMs?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Rellotge que s'alinea amb el rellotge del sistema.
 *
 * PER QUÈ NO UN `setInterval` PELAT: l'interval acumula deriva i, quan el
 * navegador ofega els temporitzadors d'una pestanya de fons (cosa que passa
 * sempre al mòbil), el compte es queda enrere i després salta uns quants
 * segons de cop. Reprogramant el següent tic contra el rellotge real, els
 * dígits sempre canvien quan toca i tornar a la pestanya no ensenya mai una
 * xifra caducada.
 *
 * `periodMs` és la resolució que de veritat es pinta. Quan falten dies no es
 * pinten els segons, i llavors despertar el fil seixanta vegades per minut per
 * no canviar cap dígit és gastar bateria a canvi de res.
 */
function useClock(enabled: boolean, periodMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const current = Date.now();
      setNow(current);
      timer = setTimeout(tick, periodMs - (current % periodMs));
    };
    timer = setTimeout(tick, periodMs - (Date.now() % periodMs));

    return () => clearTimeout(timer);
  }, [enabled, periodMs]);

  return now;
}




/**
 * Compte enrere.
 *
 * Mono TABULAR i sempre amb dos dígits: sense això, passar de 10 a 9 segons
 * estreny la línia i tot el bloc batega. Els números són exactes; el sistema
 * prohibeix dir "aproximadament un minut i mig" quan es té la xifra.
 */
export function Countdown({
  targetMs,
  target,
  label = 'Fins a la totalitat',
  size = 'lg',
  pastLabel,
  nowMs,
  className,
  style,
}: CountdownProps) {
  // `targetMs` mana; `target` (ISO) és la porta d'entrada del contracte. Una
  // data ISO que no s'entengui dona `NaN`, i `NaN` es tracta com «encara no se
  // sap»: val més ensenyar guions que un compte enrere sense sentit.
  const parsed =
    targetMs !== undefined && targetMs !== null
      ? targetMs
      : target !== undefined
        ? Date.parse(target)
        : null;
  const resolved = parsed !== null && Number.isFinite(parsed) ? parsed : null;

  // El primer tic encara no sap quant falta, i per decidir el ritme cal saber-ho.
  // Es mira contra `Date.now()` un sol cop: la frontera dels dies es creua una
  // vegada i el component ja es redibuixa a cada tic.
  const roughRemaining = resolved === null ? 0 : Math.abs(resolved - (nowMs ?? Date.now()));
  const periodMs = roughRemaining >= DAY_MS ? MINUTE_MS : 1000;

  const ticking = useClock(nowMs === undefined && resolved !== null, periodMs);
  const now = nowMs ?? ticking;

  const remaining = resolved === null ? null : resolved - now;
  const past = remaining !== null && remaining < 0;
  const parts = remaining === null ? null : split(remaining);
  const units = parts === null ? [] : unitsFor(parts);

  return (
    <div
      className={['ui-countdown', `ui-countdown--${size}`, past ? 'ui-countdown--past' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      <span className="ui-countdown__label">{past ? (pastLabel ?? label) : label}</span>
      <div
        className="ui-countdown__digits"
        role="timer"
        // Els lectors de pantalla no han d'anunciar cada segon: seria
        // impossible fer servir la resta de la pantalla mentre compta.
        aria-live="off"
      >
        {parts === null ? (
          <span className="ui-countdown__group">
            <span>—:—:—</span>
          </span>
        ) : (
          units.map((unit) => (
            <span className="ui-countdown__group" key={unit}>
              {/* Els dies no es completen amb un zero: «03 d» no és cap xifra
                  que ningú digui, i a més el primer grup és el que marca
                  l'amplada de tota la línia. La resta sí, que és el que evita
                  que el bloc bategui en passar de 10 a 9. */}
              <span>{unit === 'd' ? parts.days : pad(parts[UNIT_FIELD[unit]])}</span>
              <span className="ui-countdown__unit">{unit}</span>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
