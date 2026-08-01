import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../core/Button';
import '../ui.css';

export interface ErrorBoundaryProps {
  /**
   * Canviar aquest valor rearma la barrera. L'estructura hi passa la pestanya
   * activa: si una pantalla ha petat, canviar de pestanya i tornar-hi ha de
   * tornar a provar-ho, no ensenyar l'error per sempre.
   */
  resetKey?: string;
  /** Frase que explica què ha deixat de funcionar, en l'idioma de l'usuari. */
  message: string;
  /** Etiqueta del botó de reintent, en imperatiu. */
  retryLabel: string;
  children: ReactNode;
}

interface State {
  /** Missatge tècnic de l'error, per ensenyar-lo sense amagar-lo. */
  detail: string | null;
  resetKey?: string;
}

/**
 * Barrera d'error.
 *
 * PER QUÈ EXISTEIX, I PER QUÈ ÉS L'ESTRUCTURA QUI LA POSA: en una app de quatre
 * pestanyes sense barrera, qualsevol excepció dins d'una pantalla desmunta
 * l'arbre sencer i deixa la finestra NEGRA — sense capçalera i, sobretot, sense
 * barra de pestanyes. L'usuari es queda tancat en una pantalla en blanc i l'únic
 * que pot fer és recarregar.
 *
 * Això no és hipotètic: la pantalla del cel depèn de la càmera, dels sensors
 * d'orientació i del permís de geolocalització, que és exactament la mena de
 * codi que falla en dispositius concrets i en circumstàncies que no es poden
 * reproduir a taula. El dia de l'eclipsi, «recarrega la pàgina» amb la xarxa
 * saturada pot voler dir perdre-se'l.
 *
 * L'ERROR ES DIU, NO S'AMAGA. El sistema demana que la incertesa es digui; un
 * error tècnic també. Es pinta el missatge del navegador tal qual sota la
 * frase, perquè qui reporti el problema el pugui copiar.
 *
 * ÉS UNA CLASSE perquè React només ofereix `getDerivedStateFromError` i
 * `componentDidCatch` en components de classe. No hi ha equivalent amb hooks.
 * No s'hi fan servir propietats de paràmetre al constructor, que
 * `erasableSyntaxOnly` prohibeix.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { detail: null };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { detail: error instanceof Error ? error.message : String(error) };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: State,
  ): Partial<State> | null {
    // Canviar de pestanya rearma la barrera. Es compara contra l'estat i no
    // contra les props anteriors perquè així també funciona al primer muntatge.
    if (props.resetKey !== state.resetKey) {
      return { resetKey: props.resetKey, detail: null };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // A la consola hi va la traça sencera; a la pantalla, només la frase.
    console.error('[eclipsi] pantalla caiguda', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.detail === null) return this.props.children;

    return (
      <div className="ui-fallback" role="alert">
        <span className="ui-fallback__text">{this.props.message}</span>
        <code className="ui-fallback__detail">{this.state.detail}</code>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => this.setState({ detail: null })}
        >
          {this.props.retryLabel}
        </Button>
      </div>
    );
  }
}
