import type { ReactNode } from 'react';
import { IconButton } from '../core/IconButton';
import '../ui.css';

export interface TopBarProps {
  /**
   * Nom de la pantalla. Una o dues paraules.
   *
   * És opcional perquè el contracte del sistema el declara així: amb `logo`, la
   * portada no ensenya cap títol. Quan hi ha logotip i títol, el títol se'n va
   * al text alternatiu de la imatge, que és el que llegeix qui no la veu.
   */
  title?: string;
  /**
   * Substitueix el títol pel logotip.
   *
   * PER QUÈ EXISTEIX: és el contracte original del sistema i el muntatge de
   * l'app el fa servir a la portada, on ensenyar el nom del producte val més
   * que repetir el nom de la pestanya.
   *
   * L'alçada de 22 px i l'espai lliure els fixa `brand-logo`; van a `ui.css`.
   */
  logo?: boolean;
  /** Font del logotip. Es passa des de fora perquè `ui/` no sap la base d'URL. */
  logoSrc?: string;
  /**
   * Segona línia: el context que fa útil la pantalla (el lloc, l'hora, la
   * precisió). Va en mono tabular perquè gairebé sempre porta xifres.
   */
  subtitle?: string;
  /** Element abans del títol (la fletxa d'enrere, una insígnia d'estat). */
  left?: ReactNode;
  /** Accions a la dreta. Com a màxim dues: la barra fa 56 px i no s'estira. */
  right?: ReactNode;
  /** @deprecated Nom antic de `left`. Es manté perquè no trenqui res. */
  leading?: ReactNode;
  /** @deprecated Nom antic de `right`. Es manté perquè no trenqui res. */
  actions?: ReactNode;
}

/** Capçalera de 56 px. L'alçada i el vidre els posa l'estructura de l'app. */
export function TopBar({
  title,
  subtitle,
  left,
  right,
  leading,
  actions,
  logo = false,
  logoSrc,
}: TopBarProps) {
  const start = left ?? leading;
  const end = right ?? actions;

  return (
    <div className="ui-topbar">
      {start}
      <span className="ui-topbar__text">
        {logo && logoSrc ? (
          // El `title` va al `alt`: sense això, la pantalla no té nom per a qui
          // no veu la imatge. Sense títol, el nom del producte hi fa el servei.
          <img className="ui-topbar__logo" src={logoSrc} alt={title ?? 'eclipsi.info'} />
        ) : (
          title !== undefined && <span className="ui-topbar__title">{title}</span>
        )}
        {subtitle && <span className="ui-topbar__sub">{subtitle}</span>}
      </span>
      {end && <span className="ui-topbar__actions">{end}</span>}
    </div>
  );
}

export interface BackTopBarProps {
  title?: string;
  onBack?: () => void;
  right?: ReactNode;
  /**
   * Segona línia, igual que a `TopBar`.
   *
   * NO ÉS AL CONTRACTE, i s'hi afegeix perquè les nostres pantalles interiors
   * hi porten el lloc de l'observador en coordenades. Un contracte és un
   * mínim: qui l'hagi escrit contra `BackTopBar.d.ts` continua funcionant.
   */
  subtitle?: string;
  /** Text de la fletxa per al lector de pantalla. */
  backLabel?: string;
}

/**
 * Capçalera de les pantalles que NO són la portada.
 *
 * PER QUÈ ÉS UN COMPONENT I NO UN `TopBar` AMB UNA FLETXA POSADA A MÀ: el
 * muntatge del sistema (`ui_kits/app/index.html`) fa exactament aquesta
 * distinció —portada amb logotip, la resta amb fletxa— i si cada pantalla
 * s'hagués de muntar la seva fletxa, en tindríem quatre de lleugerament
 * diferents: una amb `sm`, una amb `md`, una amb un altre text alternatiu.
 * Aquí la fletxa és sempre la mateixa i el text de tornada també.
 *
 * La fletxa és `ghost`: és navegació, no una acció. Una caixa al voltant de la
 * fletxa d'enrere la faria competir amb l'acció real de la pantalla.
 */
export function BackTopBar({
  title,
  onBack,
  right,
  subtitle,
  backLabel = 'Enrere',
}: BackTopBarProps) {
  return (
    <TopBar
      title={title}
      subtitle={subtitle}
      right={right}
      left={
        <IconButton
          icon="arrow-left"
          label={backLabel}
          size="sm"
          variant="ghost"
          onClick={onBack}
        />
      }
    />
  );
}
