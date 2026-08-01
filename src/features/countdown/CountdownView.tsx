/**
 * La pantalla del compte enrere.
 *
 * ORDRE DELS ELEMENTS, i el perquè: primer el número gros, perquè és el que es
 * mira de reüll; després l'estat del filtre, perquè és l'única cosa d'aquesta
 * app que pot fer mal; i al final els botons i la llista de fites, que només
 * es toquen abans que comenci res.
 *
 * El component no calcula cap instant ni cap text d'avís: tot ve de
 * `useEclipseTimer`, que al seu torn ho treu de `src/core/timer/**`.
 */

import { useMemo } from 'react';
import {
  FILTER_GATE_NOTE,
  FILTER_OFF_DELAY_SEC,
  formatCountdown,
} from '../../core/timer';
import type { LocalisedText, TimerLocale, VoiceAlert } from '../../core/timer';
import type { LocalCircumstances } from '../../core/astro/types';
import { useEclipseTimer } from './useEclipseTimer';
import './countdown.css';

const UI = {
  overline: { ca: 'Compte enrere', es: 'Cuenta atrás' },
  at: { ca: 'a les', es: 'a las' },
  filterOn: { ca: 'Filtre posat', es: 'Filtro puesto' },
  filterOff: { ca: 'Filtre fora', es: 'Filtro fuera' },
  filterBack: { ca: 'Posa’t el filtre', es: 'Ponte el filtro' },
  enableVoice: { ca: 'Activa els avisos de veu', es: 'Activa los avisos de voz' },
  disableVoice: { ca: 'Atura els avisos', es: 'Detén los avisos' },
  testVoice: { ca: 'Prova la veu', es: 'Prueba la voz' },
  rehearse: { ca: 'Assaig d’un minut', es: 'Ensayo de un minuto' },
  stopRehearsal: { ca: 'Atura l’assaig', es: 'Detén el ensayo' },
  rehearsing: { ca: 'Assaig en curs. Aquests avisos no són reals.', es: 'Ensayo en curso. Estos avisos no son reales.' },
  upcoming: { ca: 'Properes fites', es: 'Próximos hitos' },
  lastAlert: { ca: 'Últim avís:', es: 'Último aviso:' },
  voiceReady: { ca: 'Veu activa.', es: 'Voz activa.' },
  voiceToneOnly: {
    ca: 'Aquest navegador no té cap veu instal·lada. Els avisos sonaran com a tons.',
    es: 'Este navegador no tiene ninguna voz instalada. Los avisos sonarán como tonos.',
  },
  voiceUnsupported: {
    ca: 'Aquest navegador no pot reproduir avisos. Fes servir el compte enrere de la pantalla.',
    es: 'Este navegador no puede reproducir avisos. Usa la cuenta atrás de la pantalla.',
  },
  voiceLocked: {
    ca: 'Toca el botó per activar la veu. Els navegadors no deixen que soni sense un toc teu.',
    es: 'Toca el botón para activar la voz. Los navegadores no dejan que suene sin un toque tuyo.',
  },
  wakeOn: { ca: 'La pantalla es mantindrà encesa.', es: 'La pantalla se mantendrá encendida.' },
  wakeUnsupported: {
    ca: 'Aquest dispositiu no deixa mantenir la pantalla encesa des del web. Desactiva el bloqueig automàtic a la configuració.',
    es: 'Este dispositivo no permite mantener la pantalla encendida desde la web. Desactiva el bloqueo automático en los ajustes.',
  },
  rehearsalLocked: {
    ca: 'L’assaig es desactiva a prop de l’eclipsi per no barrejar-lo amb els avisos de debò.',
    es: 'El ensayo se desactiva cerca del eclipse para no mezclarlo con los avisos de verdad.',
  },
  skipped: {
    ca: 'Un avís s’ha descartat perquè el telèfon estava aturat i ja no era cert.',
    es: 'Un aviso se ha descartado porque el teléfono estaba parado y ya no era cierto.',
  },
} satisfies Record<string, LocalisedText>;

/**
 * Per què NO sentiràs avisos de treure't el filtre. Es diu sempre, també quan
 * sí que en sentiràs: saber quina és l'única finestra segura és part de la
 * informació, no una advertència de lletra petita.
 */

export interface CountdownViewProps {
  /** Circumstàncies locals ja calculades per a la ubicació de l'usuari. */
  circumstances: LocalCircumstances;
  locale?: TimerLocale;
  /**
   * Cert si el terreny no tapa la fase central. Ve del mòdul de visibilitat
   * (`computeVisibility(...).centralVisibleSec > 0`). Si no es passa,
   * s'assumeix horitzó lliure.
   */
  centralPhaseVisible?: boolean;
  /** Zona horària per ensenyar les hores. Per defecte, la del dispositiu. */
  timeZone?: string;
  className?: string;
}

export function CountdownView({
  circumstances,
  locale = 'ca',
  centralPhaseVisible,
  timeZone,
  className,
}: CountdownViewProps) {
  const timer = useEclipseTimer({ circumstances, locale, centralPhaseVisible });
  const { schedule, countdown, nowMs } = timer;

  const clock = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'ca' ? 'ca-ES' : 'es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone,
      }),
    [locale, timeZone],
  );

  const c2Ms = circumstances.contacts.c2?.time.getTime();
  const c3Ms = circumstances.contacts.c3?.time.getTime();

  // Estat del filtre. La condició de `off` és deliberadament restrictiva: la
  // porta de seguretat ha d'estar oberta I hem de ser dins de la finestra, mai
  // una cosa sense l'altra.
  const filterState = resolveFilterState({
    allowed: schedule.filterGate.allowed,
    nowMs,
    c2Ms,
    c3Ms,
  });

  const alarm = filterState === 'back';
  const digits = formatCountdown(countdown.remainingMs);

  return (
    <section
      className={[
        'countdown',
        timer.rehearsing ? 'countdown--rehearsing' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={UI.overline[locale]}
    >
      {timer.rehearsing && (
        <div className="countdown__rehearsal">
          <span>{UI.rehearsing[locale]}</span>
          <button type="button" className="countdown__btn" onClick={timer.stopRehearsal}>
            {UI.stopRehearsal[locale]}
          </button>
        </div>
      )}

      <header className="countdown__head">
        <span className="eclipsi-overline">{UI.overline[locale]}</span>
        <h2 className="countdown__target">{countdown.label[locale]}</h2>
      </header>

      <div className="countdown__clock">
        {/* `aria-live` en «polite» i no «assertive»: el lector de pantalla no ha
            de llegir cada segon, però sí ha de poder consultar-ho. */}
        <span
          className={`countdown__digits${alarm ? ' countdown__digits--alarm' : ''}`}
          aria-live="off"
        >
          {digits}
        </span>
        {countdown.atMs !== undefined && (
          <span className="countdown__at">
            {UI.at[locale]} {clock.format(countdown.atMs)}
          </span>
        )}
      </div>

      <div className={`countdown__filter countdown__filter--${filterClass(filterState)}`}>
        <span className="countdown__filterstate">
          {filterState === 'off'
            ? UI.filterOff[locale]
            : filterState === 'back'
              ? UI.filterBack[locale]
              : UI.filterOn[locale]}
        </span>
        <p className="countdown__filternote">
          {FILTER_GATE_NOTE[schedule.filterGate.reason][locale]}
        </p>
      </div>

      <div className="countdown__actions">
        {timer.voiceEnabled ? (
          <button type="button" className="countdown__btn" onClick={timer.disableVoice}>
            {UI.disableVoice[locale]}
          </button>
        ) : (
          <button
            type="button"
            className="countdown__btn countdown__btn--primary"
            onClick={() => void timer.enableVoice()}
            disabled={timer.voiceStatus === 'unsupported'}
          >
            {UI.enableVoice[locale]}
          </button>
        )}
        <button
          type="button"
          className="countdown__btn"
          onClick={timer.testVoice}
          disabled={!timer.voiceEnabled}
        >
          {UI.testVoice[locale]}
        </button>
        <button
          type="button"
          className="countdown__btn"
          onClick={timer.startRehearsal}
          disabled={!timer.canRehearse}
        >
          {UI.rehearse[locale]}
        </button>
      </div>

      <ul className="countdown__notes">
        {/* L'avís també queda escrit: qui no hi senti, qui tingui el mòbil en
            silenci o qui sigui en un mirador ple de gent l'ha de poder llegir.
            `aria-live` assertiu perquè el lector de pantalla el digui de
            seguida: aquí la interrupció és el comportament correcte. */}
        {timer.lastAlert && (
          <li className="countdown__note" aria-live="assertive">
            {UI.lastAlert[locale]} {timer.lastAlert.label[locale]}
          </li>
        )}
        <li className="countdown__note">{voiceNote(timer.voiceStatus, timer.voiceEnabled)[locale]}</li>
        {timer.voiceEnabled && (
          <li className="countdown__note">
            {timer.wakeLock.supported ? UI.wakeOn[locale] : UI.wakeUnsupported[locale]}
          </li>
        )}
        {!timer.canRehearse && !timer.rehearsing && (
          <li className="countdown__note">{UI.rehearsalLocked[locale]}</li>
        )}
        {timer.lastSkipped && (
          <li className="countdown__note countdown__note--warn">{UI.skipped[locale]}</li>
        )}
      </ul>

      {timer.upcoming.length > 0 && (
        <div>
          <span className="eclipsi-overline">{UI.upcoming[locale]}</span>
          <ul className="countdown__upcoming">
            {timer.upcoming.slice(0, 5).map((alert) => (
              <li
                key={alert.id}
                className={`countdown__item${alert.severity === 'safety' ? ' countdown__item--safety' : ''}`}
              >
                <span className="countdown__itemtime">{clock.format(alert.atMs)}</span>
                <span className="countdown__itemlabel">{labelOf(alert, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );

  function voiceNote(status: typeof timer.voiceStatus, enabled: boolean): LocalisedText {
    if (status === 'unsupported') return UI.voiceUnsupported;
    if (!enabled) return UI.voiceLocked;
    if (status === 'tone-only') return UI.voiceToneOnly;
    return UI.voiceReady;
  }
}

type FilterState = 'on' | 'off' | 'back';

function filterClass(state: FilterState): string {
  return state === 'off' ? 'off' : state === 'back' ? 'alarm' : 'on';
}

/**
 * Quin ha de ser l'estat del filtre ARA MATEIX.
 *
 * Es calcula a part i amb una sola sortida possible per a `off` perquè sigui
 * fàcil de llegir i d'auditar: sense autorització de la porta de seguretat, la
 * pantalla no pot ensenyar «filtre fora» encara que els instants quadrin.
 */
function resolveFilterState(input: {
  allowed: boolean;
  nowMs: number;
  c2Ms?: number;
  c3Ms?: number;
}): FilterState {
  const { allowed, nowMs, c2Ms, c3Ms } = input;
  if (!allowed || c2Ms === undefined || c3Ms === undefined) return 'on';
  // Els últims quinze segons són els del primer avís de seguretat: la pantalla
  // i la veu diuen el mateix al mateix instant.
  if (nowMs >= c3Ms - 15_000 && nowMs < c3Ms + 5_000) return 'back';
  // El mateix retard que aplica la veu (vegeu `core/timer/safety.ts`): la
  // pantalla no pot autoritzar res abans que ho faci l'avís.
  if (nowMs >= c2Ms + FILTER_OFF_DELAY_SEC * 1000 && nowMs < c3Ms - 15_000) return 'off';
  return 'on';
}

/** Etiqueta curta d'una fita per a la llista. */
function labelOf(alert: VoiceAlert, locale: TimerLocale): string {
  return alert.label[locale];
}
