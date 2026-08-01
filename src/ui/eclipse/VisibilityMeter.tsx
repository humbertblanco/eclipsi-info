import { Icon, type IconName } from '../core/Icon';
import { ICON_MD } from '../sizes';
import '../ui.css';

/** Els mateixos noms que `SkyBand` del nucli de nuvolositat, a posta. */
export type VisibilityState = 'clear' | 'partial' | 'cloudy' | 'unknown';

/**
 * Glif de cada estat.
 *
 * PER QUÈ NO N'HI HA PROU AMB EL COLOR: `colors-visibility` és la fitxa de la
 * dada central del producte, i les tres bandes es distingeixen per verd, ambre
 * i gris. Una de cada dotze persones no distingeix el verd de l'ambre. La
 * icona diu el mateix sense demanar-li res a la vista del color.
 *
 * `unknown` no en té: la incertesa ja la diu la xifra amb guions, i inventar-hi
 * un signe d'interrogació seria dir-ho dues vegades.
 */
const GLYPH: Record<VisibilityState, IconName | null> = {
  clear: 'sun',
  partial: 'cloud-sun',
  cloudy: 'cloudy',
  unknown: null,
};

export interface VisibilityMeterProps {
  /** Nom del lloc a què es refereix la xifra. */
  place: string;
  /**
   * Probabilitat de cel útil, de 0 a 100. `null` quan encara no se sap:
   * es pinta amb guions i la barra buida, mai amb un zero fals.
   */
  value: number | null;
  state?: VisibilityState;
  /** D'on surt la xifra, en una frase. */
  caption?: string;
  /**
   * Antiguitat de la dada, ja formatada ("fa 40 min").
   *
   * El sistema exigeix que la incertesa es digui SEMPRE amb la seva antiguitat:
   * una probabilitat de cel clar de fa sis hores és una altra dada.
   */
  age?: string;
  className?: string;
}

/** Barra de probabilitat de cel útil per a un lloc. */
export function VisibilityMeter({
  place,
  value,
  state = 'unknown',
  caption,
  age,
  className,
}: VisibilityMeterProps) {
  const clamped = value === null ? 0 : Math.max(0, Math.min(100, value));
  const glyph = GLYPH[state];

  return (
    <div className={['ui-vis', `ui-vis--${state}`, className ?? ''].filter(Boolean).join(' ')}>
      <div className="ui-vis__head">
        {glyph && (
          <span className="ui-vis__glyph">
            <Icon name={glyph} size={ICON_MD} aria-hidden />
          </span>
        )}
        <span className="ui-vis__place">{place}</span>
        {/*
          Espai fi abans del signe de percentatge. El kit del sistema escriu
          "78%" sense espai, i aquí NO se segueix a posta: la norma tipogràfica
          catalana el vol, i tota la resta de l'app (`formatPercent`,
          `formatObscurationPercent`) ja l'escriu amb espai. Copiar el kit en
          aquest detall voldria dir que dins d'una mateixa pantalla el
          percentatge de cel clar i el d'ocultació s'escriurien diferent.
        */}
        <span className="ui-vis__value">
          {value === null ? '—' : `${Math.round(clamped)} %`}
        </span>
      </div>
      <div
        className="ui-vis__track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value === null ? undefined : Math.round(clamped)}
        aria-label={`Probabilitat de cel útil a ${place}`}
      >
        <div className="ui-vis__fill" style={{ width: `${clamped}%` }} />
      </div>
      {(caption || age) && (
        <span className="ui-vis__caption">
          {caption}
          {caption && age ? ' · ' : ''}
          {age}
        </span>
      )}
    </div>
  );
}
