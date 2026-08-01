import { Button } from '../core/Button';
import { Icon } from '../core/Icon';
import { ICON_MD } from '../sizes';
import '../ui.css';

export interface SiteLink<T extends string> {
  value: T;
  label: string;
}

export interface SiteHeaderProps<T extends string> {
  links: readonly SiteLink<T>[];
  active?: T;
  onNavigate?: (value: T) => void;
  /** Etiqueta del botó ambre. És l'única acció primària de tota la pàgina. */
  cta?: string;
  /** Què fa el botó. Si no es passa, no es dibuixa. */
  onCta?: () => void;
  /** Font del logotip. Es passa des de fora perquè `ui/` no sap la base d'URL. */
  logoSrc?: string;
  /**
   * Adreça del repositori. Sense això NO es dibuixa la icona de GitHub: el
   * sistema hi té l'adreça escrita a dins, i un enllaç que va a github.com i
   * prou és pitjor que cap enllaç.
   */
  repoHref?: string;
  /** Text de l'enllaç del repositori per al lector de pantalla. */
  repoLabel?: string;
}

/**
 * Capçalera de la versió WEB (la pàgina pública), no de l'app.
 *
 * PER QUÈ ÉS UN COMPONENT A PART DE `TopBar`: no és la mateixa peça amb un
 * altre encoixinat. La barra de l'app fa 56 px, és fixa, i porta el context de
 * la pantalla on ets; aquesta és enganxosa, respira els gutters amples del web,
 * porta navegació entre seccions i UNA acció ambre. Fer-ne una de sola amb un
 * interruptor voldria dir que qualsevol retoc a l'app tocaria la pàgina
 * pública i a l'inrevés.
 *
 * És genèrica sobre `T` pel mateix motiu que `Tabs` i `TabBar`: perquè la unió
 * de seccions es continuï comprovant en compilació després de passar pel
 * component.
 */
export function SiteHeader<T extends string>({
  links,
  active,
  onNavigate,
  cta,
  onCta,
  logoSrc,
  repoHref,
  repoLabel = 'Codi obert a GitHub',
}: SiteHeaderProps<T>) {
  return (
    <header className="ui-siteheader">
      {logoSrc && <img className="ui-siteheader__logo" src={logoSrc} alt="eclipsi.info" />}

      <nav className="ui-siteheader__nav">
        {links.map((link) => (
          <button
            key={link.value}
            type="button"
            aria-current={link.value === active ? 'page' : undefined}
            className={[
              'ui-siteheader__link',
              link.value === active ? 'ui-siteheader__link--on' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onNavigate?.(link.value)}
          >
            {link.label}
          </button>
        ))}
      </nav>

      {repoHref && (
        <a
          className="ui-siteheader__repo"
          href={repoHref}
          aria-label={repoLabel}
          title={repoLabel}
          // `noreferrer` a més de `noopener`: l'enllaç surt del nostre domini i
          // no cal que el destí sàpiga d'on ve ningú.
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="github" size={ICON_MD} aria-hidden />
        </a>
      )}

      {cta && onCta && (
        <Button size="sm" variant="primary" iconRight="arrow-right" onClick={onCta}>
          {cta}
        </Button>
      )}
    </header>
  );
}
