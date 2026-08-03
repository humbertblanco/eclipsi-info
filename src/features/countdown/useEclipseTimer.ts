/**
 * El nus entre la lògica pura del temporitzador i el navegador.
 *
 * Aquí no es decideix res: la programació d'avisos surt sencera de
 * `src/core/timer/**`, amb les fites de contingut del guió de la totalitat
 * (`src/content/totality-script.ts`) fusionades al damunt, i aquest fitxer
 * només la fa sonar, la fa comptar i la dibuixa. Qui mana en cas de col·lisió,
 * quines fites es descarten i per què, ho decideix `mergeScriptIntoSchedule`:
 * si algun dia cal canviar quan es diu una cosa, el canvi va allà.
 *
 * DOS TEMPORITZADORS I NO UN. El de debò està sempre en marxa mentre el
 * component està muntat: és el que mou el compte enrere i el que dispararà els
 * avisos. El de l'assaig es crea a part i es destrueix quan s'acaba. Compartir
 * un sol reproductor obligaria a esborrar l'estat d'avisos ja emesos per
 * encabir-hi l'assaig, i un assaig no pot tocar mai la seqüència real.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildAlertSchedule,
  buildRehearsalSchedule,
  createAlertRunner,
  createMonotonicClock,
  resolveCountdown,
} from '../../core/timer';
import type {
  AlertRunner,
  AlertSchedule,
  CountdownTarget,
  SkipReason,
  TimerLocale,
  VoiceAlert,
} from '../../core/timer';
import type { LocalCircumstances } from '../../core/astro/types';
import { buildTotalityScript, mergeScriptIntoSchedule } from '../../content/totality-script';
import type { ScriptBeat, TotalityScript } from '../../content/totality-script';
import { createAnnouncer } from './speech';
import type { Announcer, VoiceStatus } from './speech';
import { useWakeLock } from './useWakeLock';
import type { WakeLockState } from './useWakeLock';

/**
 * Marge abans de C1 i després de C4 dins del qual no es deixa assajar.
 * L'assaig omple el canal d'àudio de frases falses; el dia de l'eclipsi això
 * no pot passar a prop de cap fita de veritat.
 */
const REHEARSAL_LOCKOUT_BEFORE_MS = 30 * 60 * 1000;
const REHEARSAL_LOCKOUT_AFTER_MS = 5 * 60 * 1000;

export interface UseEclipseTimerOptions {
  circumstances: LocalCircumstances;
  locale: TimerLocale;
  /**
   * Cert si el terreny no tapa la fase central. Es passa tal qual a la porta
   * de seguretat; vegeu `core/timer/safety.ts`.
   */
  centralPhaseVisible?: boolean;
}

/**
 * Una fita del guió vista des d'ARA: el beat sencer —títol i, sobretot, la
 * prosa que la veu no diu mai— i l'instant en què toca segons la línia de
 * temps que sona (la comprimida, mentre dura l'assaig).
 */
export interface ScriptMoment {
  beat: ScriptBeat;
  /** Instant de la fita, en ms des de l'època, a l'escala del rellotge del reproductor. */
  atMs: number;
  /** Quant hi falta, en ms. Negatiu quan ja ha passat. */
  inMs: number;
}

export interface EclipseTimerState {
  /** Programació real, amb el resultat de la porta de seguretat. */
  schedule: AlertSchedule;
  /** Cap a quina fita es compta ara i quant hi falta. */
  countdown: CountdownTarget;
  /** Instant actual segons el rellotge monòton del reproductor. */
  nowMs: number;
  /** Avisos que encara han de sonar, en ordre. */
  upcoming: VoiceAlert[];
  /** Últim avís emès, per ensenyar-lo a la pantalla. */
  lastAlert: VoiceAlert | null;
  /** Últim avís descartat i el motiu (pestanya congelada, típicament). */
  lastSkipped: { alert: VoiceAlert; reason: SkipReason } | null;

  /**
   * La fita del guió vigent ARA, amb la prosa sencera per llegir-la, i la
   * següent amb quant hi falta. Surten de la mateixa llista d'avisos que
   * sona; vegeu el comentari on es calculen.
   */
  currentMoment: ScriptMoment | null;
  nextMoment: ScriptMoment | null;

  voiceEnabled: boolean;
  voiceStatus: VoiceStatus;
  /** Activa la veu. S'HA de cridar des d'un gest de l'usuari. */
  enableVoice: () => Promise<void>;
  disableVoice: () => void;
  /** Diu una frase de prova per comprovar volum i veu. */
  testVoice: () => void;

  wakeLock: WakeLockState;

  rehearsing: boolean;
  /** Fals si som massa a prop de l'eclipsi per posar-se a assajar. */
  canRehearse: boolean;
  /** Programació de l'assaig mentre dura, per ensenyar-la. */
  rehearsalSchedule: AlertSchedule | null;
  startRehearsal: () => void;
  stopRehearsal: () => void;
}

export function useEclipseTimer(options: UseEclipseTimerOptions): EclipseTimerState {
  const { circumstances, locale, centralPhaseVisible } = options;

  // Les dependències són números i no l'objecte `circumstances`: si el
  // coordinador el recalcula a cada render (i és el que passa quan una vista
  // germana canvia d'estat), una memòria basada en la identitat de l'objecte
  // destruiria i recrearia el reproductor constantment, i amb ell la memòria
  // dels avisos ja emesos.
  const { kind } = circumstances;
  const { c1, c2, max, c3, c4 } = circumstances.contacts;
  const c1Ms = c1?.time.getTime();
  const c2Ms = c2?.time.getTime();
  const maxMs = max.time.getTime();
  const c3Ms = c3?.time.getTime();
  const c4Ms = c4?.time.getTime();
  const maxObscuration = max.obscuration;
  /*
   * LA INCERTESA DEL CAIRE, QUE ABANS ES PERDIA AQUÍ.
   *
   * `circumstances.edgeUncertain` és cert quan el marge umbral és més petit que
   * l'error de posició de les efemèrides: el motor no pot decidir si hi ha
   * totalitat o no. `canRemoveFilter` ho contempla i `scheduleFromCircumstances`
   * ho passa, però aquest ganxo muntava la llista a mà amb `buildAlertSchedule`
   * i s'ho deixava. Resultat mesurat a la Sierra de Grazalema (36,726 N /
   * −5,5 E, 02-08-2027): el motor diu «caire incert», el mapa ho ensenya, la
   * durada calculada són 69 s —o sigui que la comporta dels 40 s no salta— i la
   * veu autoritzava treure's el filtre igualment.
   *
   * Es desglossa a número perquè la memòria d'aquest fitxer depèn de valors i
   * no de la identitat de l'objecte, per la raó explicada més amunt.
   */
  const edgeUncertain = circumstances.edgeUncertain;

  const contacts = useMemo(
    () => ({ c1: c1Ms, c2: c2Ms, max: maxMs, c3: c3Ms, c4: c4Ms }),
    [c1Ms, c2Ms, maxMs, c3Ms, c4Ms],
  );

  /*
   * EL GUIÓ DE LA TOTALITAT, que va estar 1.600 línies escrit i provat sense
   * que ningú el sentís mai: cap camí de codi no cridava `buildTotalityScript`.
   * Durant la totalitat ningú no mira el mòbil, o sigui que si el guió no entra
   * a la programació de veu, no existeix.
   *
   * Té memòria pròpia, en una referència, clavada a una clau de valors i no a
   * la identitat de `circumstances`, per la mateixa raó que aquest fitxer
   * treballa amb números: el coordinador recrea l'objecte a cada render d'una
   * vista germana, i una memòria penjada de la identitat refaria el guió —amb
   * `computeShadowMotion` i `visibleBodiesDuringTotality` a dins— a cada
   * render, i de retruc destruiria i recrearia el reproductor, que és la fuita
   * que el comentari de dalt explica. No és un `useMemo` perquè un `useMemo`
   * amb clau de valors i tanca sobre l'objecte fa saltar `exhaustive-deps`, i
   * silenciar la regla aquí és amagar exactament la decisió que cal poder
   * llegir.
   *
   * La clau conté tot el que determina el guió: l'eclipsi, el punt,
   * l'atmosfera, els ms dels contactes i el veredicte de visibilitat. Amb la
   * mateixa clau, `computeLocalCircumstances` és determinista i el guió també:
   * reusar-lo no pot tornar res d'estantís, i reconstruir-lo en canviar la clau
   * és idempotent, que és el que fa segura una escriptura durant el render.
   */
  const { eclipseId } = circumstances;
  const { lat, lon, elevation } = circumstances.location;
  const { pressureMb, temperatureC } = circumstances.atmosphere;
  const scriptKey = [
    eclipseId,
    lat,
    lon,
    elevation,
    pressureMb,
    temperatureC,
    kind,
    c1Ms,
    c2Ms,
    maxMs,
    c3Ms,
    c4Ms,
    maxObscuration,
    centralPhaseVisible,
    edgeUncertain,
  ].join('|');

  const scriptCacheRef = useRef<{ key: string; script: TotalityScript } | null>(null);
  let scriptCache = scriptCacheRef.current;
  if (scriptCache === null || scriptCache.key !== scriptKey) {
    scriptCache = { key: scriptKey, script: buildTotalityScript({ circumstances, centralPhaseVisible }) };
    scriptCacheRef.current = scriptCache;
  }
  const script = scriptCache.script;

  const schedule = useMemo(
    () =>
      // La programació de `core/timer` mana; del guió només hi entren les
      // fites de contingut. La fusió descarta tota fita `naked-eye` si la
      // porta de seguretat no autoritza i cedeix el pas als avisos de filtre:
      // tot això es decideix a `mergeScriptIntoSchedule`, no aquí.
      mergeScriptIntoSchedule(
        buildAlertSchedule({
          kind,
          contacts,
          maxObscuration,
          centralPhaseVisible,
          edgeUncertain,
        }),
        script,
      ),
    [kind, contacts, maxObscuration, centralPhaseVisible, edgeUncertain, script],
  );

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('locked');
  const [lastAlert, setLastAlert] = useState<VoiceAlert | null>(null);
  const [lastSkipped, setLastSkipped] = useState<{
    alert: VoiceAlert;
    reason: SkipReason;
  } | null>(null);
  const [rehearsing, setRehearsing] = useState(false);
  const [rehearsalSchedule, setRehearsalSchedule] = useState<AlertSchedule | null>(null);

  const announcerRef = useRef<Announcer | null>(null);
  const rehearsalRunnerRef = useRef<AlertRunner | null>(null);
  // La veu s'ha de poder activar i desactivar sense recrear el reproductor:
  // recrear-lo perdria la memòria dels avisos ja emesos i els repetiria.
  const voiceEnabledRef = useRef(false);
  const rehearsingRef = useRef(false);
  /**
   * Avisos ja dits, per identificador. Sobreviu a la destrucció del
   * reproductor: en mode estricte React munta, desmunta i torna a muntar els
   * efectes, i sense això un avís acabat d'emetre es diria dues vegades.
   */
  const announcedRef = useRef<Set<string>>(new Set());

  const announce = useCallback((alert: VoiceAlert): void => {
    if (announcedRef.current.has(alert.id)) return;
    announcedRef.current.add(alert.id);
    setLastAlert(alert);
    if (voiceEnabledRef.current) announcerRef.current?.announce(alert.speech, alert.severity);
  }, []);

  // ------------------------------------------------------------ la veu -----
  // L'idioma inicial es congela en una referència perquè canviar d'idioma no
  // destrueixi el locutor: recrear-lo perdria la veu triada i, a iOS, el
  // desbloqueig que només es pot obtenir des d'un gest de l'usuari.
  const initialLocaleRef = useRef(locale);
  useEffect(() => {
    const announcer = createAnnouncer({
      locale: initialLocaleRef.current,
      onStatusChange: setVoiceStatus,
    });
    announcerRef.current = announcer;
    setVoiceStatus(announcer.status());
    return () => {
      announcer.dispose();
      announcerRef.current = null;
    };
  }, []);

  useEffect(() => {
    announcerRef.current?.setLocale(locale);
  }, [locale]);

  const stopRehearsal = useCallback(() => {
    rehearsalRunnerRef.current?.stop();
    rehearsalRunnerRef.current = null;
    rehearsingRef.current = false;
    setRehearsing(false);
    setRehearsalSchedule(null);
    announcerRef.current?.cancel();
  }, []);

  // ------------------------------------------- el reproductor de debò -----
  useEffect(() => {
    const runner = createAlertRunner({
      alerts: schedule.alerts,
      clock: createMonotonicClock(),
      onTick: setNowMs,
      onAlert: ({ alert }) => {
        // Un avís real mana sobre l'assaig: si per alguna raó coincideixen,
        // l'assaig calla immediatament.
        if (rehearsingRef.current) stopRehearsal();
        announce(alert);
      },
      onSkip: (alert, reason) => setLastSkipped({ alert, reason }),
    });
    runner.start();

    // En tornar de segon pla el temporitzador pendent pot haver quedat
    // congelat: cal revisar la llista de seguida i no esperar el proper batec.
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') runner.poll();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      runner.stop();
    };
  }, [schedule, stopRehearsal, announce]);

  // --------------------------------------------------------- l'assaig -----
  const eventStartMs = contacts.c1 ?? contacts.max;
  const eventEndMs = contacts.c4 ?? contacts.max;
  const canRehearse =
    !rehearsing &&
    schedule.alerts.length > 0 &&
    (nowMs < eventStartMs - REHEARSAL_LOCKOUT_BEFORE_MS ||
      nowMs > eventEndMs + REHEARSAL_LOCKOUT_AFTER_MS);

  const startRehearsal = useCallback(() => {
    if (rehearsalRunnerRef.current) return;

    const clock = createMonotonicClock();
    const compressed = buildRehearsalSchedule(schedule, { startMs: clock.now() + 500 });
    const total = compressed.alerts.length;
    let done = 0;

    const finishIfDone = (): void => {
      done += 1;
      if (done >= total) {
        // Es deixa acabar de parlar l'última frase abans de plegar.
        globalThis.setTimeout(() => stopRehearsal(), 2500);
      }
    };

    const runner = createAlertRunner({
      alerts: compressed.alerts,
      clock,
      onAlert: ({ alert }) => {
        setLastAlert(alert);
        if (voiceEnabledRef.current) announcerRef.current?.announce(alert.speech, alert.severity);
        finishIfDone();
      },
      onSkip: finishIfDone,
    });

    rehearsalRunnerRef.current = runner;
    rehearsingRef.current = true;
    setRehearsalSchedule(compressed);
    setRehearsing(true);
    runner.start();
  }, [schedule, stopRehearsal]);

  useEffect(() => () => rehearsalRunnerRef.current?.stop(), []);

  // ----------------------------------------------------------- accions ----
  const enableVoice = useCallback(async () => {
    const announcer = announcerRef.current;
    if (!announcer) return;
    const status = await announcer.unlock();
    setVoiceStatus(status);
    voiceEnabledRef.current = true;
    setVoiceEnabled(true);
    announcer.announce(
      {
        ca: 'Avisos activats. Deixa el mòbil a la butxaca i mira el cel.',
        es: 'Avisos activados. Deja el móvil en el bolsillo y mira al cielo.',
      },
      'info',
    );
  }, []);

  const disableVoice = useCallback(() => {
    voiceEnabledRef.current = false;
    setVoiceEnabled(false);
    announcerRef.current?.cancel();
  }, []);

  const testVoice = useCallback(() => {
    announcerRef.current?.announce(
      { ca: 'Prova de veu. Se sent bé?', es: 'Prueba de voz. ¿Se oye bien?' },
      'info',
    );
  }, []);

  // La pantalla es manté encesa mentre els avisos estiguin actius, i només
  // llavors: encendre-la abans d'hora buida la bateria abans de l'eclipsi.
  const wakeLock = useWakeLock(voiceEnabled);

  // ------------------------------------------------------- el que es veu ---
  const countdown = useMemo(
    () => resolveCountdown({ contacts, kind: circumstances.kind }, nowMs),
    [contacts, circumstances.kind, nowMs],
  );

  const upcoming = useMemo(
    () => schedule.alerts.filter((a) => a.atMs > nowMs),
    [schedule, nowMs],
  );

  /*
   * EL GUIÓ, ARA TAMBÉ PER LLEGIR. Cada beat porta una prosa (`text`) que la
   * veu no diu mai: era la part més treballada del guió i cap pantalla no
   * l'ensenyava. Aquí es resol quina fita és la vigent i quina ve després.
   *
   * LA LÍNIA DE TEMPS NO ES REFÀ. Es recorre la mateixa llista d'avisos que
   * sona —la fusionada, o la comprimida mentre dura l'assaig— i cada avís es
   * retorna al seu beat pel seu identificador pelat: `script:corona` i
   * `rehearsal:script:corona` duen a `corona`, i els avisos de filtre de la
   * programació real comparteixen identificador amb els beats de filtre del
   * guió a propòsit (vegeu `totality-script.ts`). Tres coses en surten de
   * franc: el que es llegeix arriba EXACTAMENT quan el que se sent; una fita
   * que la fusió ha descartat tampoc no s'ensenya; i la comporta de seguretat
   * no s'ha de reimplementar, perquè un avís de treure's el filtre només és a
   * la llista si `canRemoveFilter` l'ha autoritzat.
   */
  const beatById = useMemo(() => {
    const byId = new Map<string, ScriptBeat>();
    for (const beat of script.beats) byId.set(beat.id, beat);
    return byId;
  }, [script]);

  const activeAlerts =
    rehearsing && rehearsalSchedule !== null ? rehearsalSchedule.alerts : schedule.alerts;
  const filterAllowed = schedule.filterGate.allowed;

  const { currentMoment, nextMoment } = useMemo(() => {
    let current: ScriptMoment | null = null;
    let next: ScriptMoment | null = null;
    // La llista ja ve ordenada per instant: l'última fita passada és la vigent
    // i la primera futura és la següent.
    for (const alert of activeAlerts) {
      const beat = beatById.get(alert.id.replace(/^rehearsal:/, '').replace(/^script:/, ''));
      if (beat === undefined) continue;
      // Defensa en profunditat, la mateixa que `mergeScriptIntoSchedule`: cap
      // fita sense filtre no s'ensenya si la porta no autoritza. Aquí només es
      // llegeix el veredicte; la regla viu a `core/timer/safety.ts`.
      if (beat.filterState === 'naked-eye' && !filterAllowed) continue;
      const moment: ScriptMoment = { beat, atMs: alert.atMs, inMs: alert.atMs - nowMs };
      if (alert.atMs <= nowMs) {
        current = moment;
      } else {
        next = moment;
        break;
      }
    }
    // L'última fita no es queda «vigent» per sempre: passades la seva finestra
    // i la seva validesa, el guió s'ha acabat i la secció ha de poder plegar.
    if (
      current !== null &&
      next === null &&
      nowMs > current.atMs + current.beat.windowSec * 1000 + current.beat.validForMs
    ) {
      current = null;
    }
    return { currentMoment: current, nextMoment: next };
  }, [activeAlerts, beatById, nowMs, filterAllowed]);

  return {
    schedule,
    countdown,
    nowMs,
    upcoming,
    lastAlert,
    lastSkipped,
    currentMoment,
    nextMoment,
    voiceEnabled,
    voiceStatus,
    enableVoice,
    disableVoice,
    testVoice,
    wakeLock,
    rehearsing,
    canRehearse,
    rehearsalSchedule,
    startRehearsal,
    stopRehearsal,
  };
}
