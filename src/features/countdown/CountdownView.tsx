/**
 * La pantalla del compte enrere.
 *
 * ORDRE DELS ELEMENTS, i el perquè: primer el número gros, perquè és el que es
 * mira de reüll; després l'estat del filtre, perquè és l'única cosa d'aquesta
 * app que pot fer mal; després el guió del moment («Durant»), que és el que es
 * llegeix quan l'eclipsi ja passa; i al final els botons i la llista de fites,
 * que només es toquen abans que comenci res.
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
  overline: { ca: 'Compte enrere', es: 'Cuenta atrás', en: 'Countdown', fr: 'Compte à rebours' },
  at: { ca: 'a les', es: 'a las', en: 'at', fr: 'à' },
  during: { ca: 'Durant', es: 'Durante', en: 'During', fr: 'Pendant' },
  now: { ca: 'Ara', es: 'Ahora', en: 'Now', fr: 'Maintenant' },
  then: { ca: 'Després', es: 'Después', en: 'Next', fr: 'Ensuite' },
  thenIn: { ca: 'd’aquí a', es: 'dentro de', en: 'in', fr: 'dans' },
  filterOn: { ca: 'Filtre posat', es: 'Filtro puesto', en: 'Filter on', fr: 'Filtre en place' },
  filterOff: { ca: 'Filtre fora', es: 'Filtro fuera', en: 'Filter off', fr: 'Filtre retiré' },
  filterBack: { ca: 'Posa’t el filtre', es: 'Ponte el filtro', en: 'Put the filter back on', fr: 'Remettez le filtre' },
  enableVoice: { ca: 'Activa els avisos de veu', es: 'Activa los avisos de voz', en: 'Enable voice alerts', fr: 'Activer les alertes vocales' },
  disableVoice: { ca: 'Atura els avisos', es: 'Detén los avisos', en: 'Stop alerts', fr: 'Arrêter les alertes' },
  testVoice: { ca: 'Prova la veu', es: 'Prueba la voz', en: 'Test voice', fr: 'Tester la voix' },
  rehearse: { ca: 'Assaig d’un minut', es: 'Ensayo de un minuto', en: 'One-minute rehearsal', fr: 'Répétition d’une minute' },
  stopRehearsal: { ca: 'Atura l’assaig', es: 'Detén el ensayo', en: 'Stop rehearsal', fr: 'Arrêter la répétition' },
  rehearsing: {
    ca: 'Assaig en curs. Aquests avisos no són reals.',
    es: 'Ensayo en curso. Estos avisos no son reales.',
    en: 'Rehearsal in progress. These alerts are not real.',
    fr: 'Répétition en cours. Ces alertes ne sont pas réelles.',
  },
  upcoming: { ca: 'Properes fites', es: 'Próximos hitos', en: 'Upcoming milestones', fr: 'Prochaines étapes' },
  lastAlert: { ca: 'Últim avís:', es: 'Último aviso:', en: 'Last alert:', fr: 'Dernière alerte :' },
  voiceReady: { ca: 'Veu activa.', es: 'Voz activa.', en: 'Voice alerts active.', fr: 'Alertes vocales actives.' },
  voiceToneOnly: {
    ca: 'Aquest navegador no té cap veu instal·lada. Els avisos sonaran com a tons.',
    es: 'Este navegador no tiene ninguna voz instalada. Los avisos sonarán como tonos.',
    en: 'This browser has no voice installed. Alerts will sound as tones.',
    fr: 'Ce navigateur ne dispose d’aucune voix. Les alertes seront émises sous forme de sons.',
  },
  voiceUnsupported: {
    ca: 'Aquest navegador no pot reproduir avisos. Fes servir el compte enrere de la pantalla.',
    es: 'Este navegador no puede reproducir avisos. Usa la cuenta atrás de la pantalla.',
    en: 'This browser cannot play alerts. Use the on-screen countdown.',
    fr: 'Ce navigateur ne peut pas diffuser d’alertes. Utilisez le compte à rebours affiché à l’écran.',
  },
  voiceLocked: {
    ca: 'Toca el botó per activar la veu. Els navegadors no deixen que soni sense un toc teu.',
    es: 'Toca el botón para activar la voz. Los navegadores no dejan que suene sin un toque tuyo.',
    en: 'Tap the button to enable voice alerts. Browsers cannot play them until you interact with the page.',
    fr: 'Touchez le bouton pour activer les alertes vocales. Les navigateurs ne peuvent pas les diffuser avant une interaction avec la page.',
  },
  wakeOn: { ca: 'La pantalla es mantindrà encesa.', es: 'La pantalla se mantendrá encendida.', en: 'The screen will stay on.', fr: 'L’écran restera allumé.' },
  wakeUnsupported: {
    ca: 'Aquest dispositiu no deixa mantenir la pantalla encesa des del web. Desactiva el bloqueig automàtic a la configuració.',
    es: 'Este dispositivo no permite mantener la pantalla encendida desde la web. Desactiva el bloqueo automático en los ajustes.',
    en: 'This device cannot keep the screen on from the web. Turn off auto-lock in your device settings.',
    fr: 'Cet appareil ne permet pas de maintenir l’écran allumé depuis le Web. Désactivez le verrouillage automatique dans les réglages.',
  },
  rehearsalLocked: {
    ca: 'L’assaig es desactiva a prop de l’eclipsi per no barrejar-lo amb els avisos de debò.',
    es: 'El ensayo se desactiva cerca del eclipse para no mezclarlo con los avisos de verdad.',
    en: 'Rehearsal is disabled near the eclipse to keep it separate from real alerts.',
    fr: 'La répétition est désactivée à l’approche de l’éclipse afin de ne pas la confondre avec les vraies alertes.',
  },
  skipped: {
    ca: 'Un avís s’ha descartat perquè el telèfon estava aturat i ja no era cert.',
    es: 'Un aviso se ha descartado porque el teléfono estaba parado y ya no era cierto.',
    en: 'An alert was skipped because the phone was inactive and the alert was no longer valid.',
    fr: 'Une alerte a été ignorée, car le téléphone était inactif et l’alerte n’était plus valable.',
  },
} satisfies Record<string, LocalisedText>;

const LOCALE_TAG = {
  ca: 'ca-ES',
  es: 'es-ES',
  en: 'en-GB',
  fr: 'fr-FR',
} satisfies Record<TimerLocale, string>;

/**
 * Per què NO sentiràs avisos de treure't el filtre. Es diu sempre, també quan
 * sí que en sentiràs: saber quina és l'única finestra segura és part de la
 * informació, no una advertència de lletra petita.
 */

/**
 * Quan la secció «Durant» entra a la pantalla, si no hi ha cap fita vigent:
 * quan la següent és a menys d'una hora. La primera fita del guió cau quatre
 * minuts abans de la totalitat; amb una hora de coll, la secció apareix mentre
 * la parcial avança i ningú no la descobreix amb el diamant ja a sobre.
 */
const DURING_AHEAD_MS = 60 * 60 * 1000;

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
      new Intl.DateTimeFormat(LOCALE_TAG[locale], {
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

  // La secció «Durant» es mostra quan l'eclipsi és a prop o en curs, i sempre
  // durant l'assaig: assajar és precisament veure com es veurà.
  const { currentMoment, nextMoment } = timer;
  const showDuring =
    (currentMoment !== null || nextMoment !== null) &&
    (timer.rehearsing ||
      currentMoment !== null ||
      (nextMoment !== null && nextMoment.inMs <= DURING_AHEAD_MS));

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

      {showDuring && (
        <div className="countdown__during">
          <span className="eclipsi-overline">{UI.during[locale]}</span>
          {currentMoment !== null && (
            /* `aria-live` educat: el canvi de fita ja el diu la veu, i el
               lector de pantalla ha de poder seguir la prosa sense que cada
               fita nova l'interrompi a mitja frase. */
            <div className="countdown__moment" aria-live="polite">
              <span className="countdown__momentkicker">{UI.now[locale]}</span>
              <h3 className="countdown__momenttitle">{currentMoment.beat.title[locale]}</h3>
              <p className="countdown__momenttext">{currentMoment.beat.text[locale]}</p>
            </div>
          )}
          {nextMoment !== null && (
            <p className="countdown__momentnext">
              <span className="countdown__momentkicker">{UI.then[locale]}</span>
              <span className="countdown__momentnextname">{nextMoment.beat.title[locale]}</span>
              <span className="countdown__momentnextin">
                {UI.thenIn[locale]}{' '}
                <span className="countdown__momentnextdigits">
                  {formatCountdown(nextMoment.inMs)}
                </span>
              </span>
            </p>
          )}
        </div>
      )}

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
