/**
 * El bàner de cookies.
 *
 * ── ON SURT I PER QUÈ ───────────────────────────────────────────────────────
 *
 * A BAIX i enganxat a la finestra, no a dalt. A dalt hi ha l'avís de versió
 * nova (`offline/UpdatePrompt`) i hi ha la capçalera; a més, a la portada, la
 * meitat de dalt de la pantalla és on hi ha la xifra que decideix, que és el
 * producte. Un bàner que la tapa el primer cop que algú obre l'app tapa
 * exactament allò que ha vingut a veure.
 *
 * Va per damunt de la barra de pestanyes (z-index 70 > 60 de l'avís de versió)
 * i li deixa lloc perquè no se la mengi: vegeu `consent.css`.
 *
 * ── PER QUÈ NO ÉS UN `Dialog` DEL SISTEMA ───────────────────────────────────
 *
 * Perquè un diàleg modal bloqueja l'app fins que contestes, i això és el que
 * fa que la gent accepti sense llegir per treure-s'ho del davant. Aquí es pot
 * seguir fent servir l'app amb el bàner obert: la mesura pot esperar, la
 * resposta de quants segons d'eclipsi veuràs no.
 *
 * Conseqüència directa: NO té `role="dialog"` ni captura el focus. És una
 * `region` amb nom, que és el que de debò és.
 *
 * ── L'AMBRE NO ES TOCA ──────────────────────────────────────────────────────
 *
 * Cap dels dos botons és ambre (regla 3: l'ambre és de la xifra que decideix, i
 * al mapa és de la franja). Van tots dos amb la vora i el fons de superfície,
 * amb el mateix pes. Això, que aquí és una regla de disseny del projecte,
 * resulta que coincideix amb el que demana la llei: si «Accepta» cridés més que
 * «No, gràcies», el consentiment no seria lliure i no valdria.
 */

import type { Locale } from '../../i18n';
import type { ConsentChoice } from '../../core/analytics';
import { cs } from './strings';
import './consent.css';

export interface ConsentBannerProps {
  locale: Locale;
  onDecide: (choice: ConsentChoice) => void;
}

export function ConsentBanner({ locale, onDecide }: ConsentBannerProps) {
  return (
    <aside
      className="consent"
      /*
        `region` + `aria-label` i no `alert`: `alert` interromp el lector de
        pantalla a mitja frase, i qui està escoltant quants segons de totalitat
        li toquen no ha de perdre la frase per una pregunta sobre cookies.
      */
      role="region"
      aria-label={cs('banner.title', locale)}
    >
      <div className="consent__text">
        <p className="consent__title">{cs('banner.title', locale)}</p>
        <p className="consent__body">{cs('banner.body', locale)}</p>
        {/* La garantia, a part i amb pes: és la frase que decideix per a la
            gent que fa servir aquesta app. */}
        <p className="consent__promise">{cs('banner.promise', locale)}</p>
      </div>

      {/*
        L'ORDRE DELS BOTONS: rebutjar primer en el DOM i a l'esquerra.

        Qui va amb teclat o lector de pantalla arriba abans a «No, gràcies», que
        és la resposta que no costa res desfer. I visualment, l'acció que
        s'endevina per defecte a la dreta queda per a l'accepta sense que cap de
        les dues canviï de color ni de mida.
      */}
      <div className="consent__actions">
        <button
          type="button"
          className="consent__btn"
          onClick={() => onDecide('denied')}
        >
          {cs('banner.reject', locale)}
        </button>
        <button
          type="button"
          className="consent__btn"
          onClick={() => onDecide('granted')}
        >
          {cs('banner.accept', locale)}
        </button>
      </div>
    </aside>
  );
}
