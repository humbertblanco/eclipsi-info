/**
 * Veu i tons dels avisos.
 *
 * Aquesta és l'única part del compte enrere que toca el navegador. La lògica de
 * QUÈ es diu i QUAN viu a `src/core/timer/**`, que no sap què és un `window`.
 *
 * TRES COSES QUE EL NAVEGADOR FA MALAMENT I QUE AQUÍ ES COMPENSEN:
 *
 * 1. LES VEUS TRIGUEN A CARREGAR-SE. A Chrome, `getVoices()` torna una llista
 *    buida fins que salta `voiceschanged`. Si es tria la veu al muntar el
 *    component, es tria «cap». Aquí s'escolta l'esdeveniment i es torna a triar.
 *
 * 2. NO HI HA VEU CATALANA A TOT ARREU. iOS en porta (ca-ES), Android sovint
 *    no. Llegir text català amb una veu castellana surt malament. La cadena de
 *    recurs és: veu de l'idioma demanat → veu de l'altre idioma que tenim, dient
 *    el text D'AQUELL idioma (millor un castellà correcte que un català
 *    destrossat) → veu per defecte amb el text demanat → només to.
 *
 * 3. L'ÀUDIO ESTÀ BLOQUEJAT FINS QUE L'USUARI TOCA LA PANTALLA. A iOS i a
 *    Chrome, ni `speechSynthesis.speak()` ni `AudioContext` funcionen si no
 *    s'han encetat des d'un gest. Per això hi ha `unlock()`, que s'ha de cridar
 *    des del `onClick` del botó d'activar la veu i no des d'un efecte.
 *
 * EL TO NO ÉS UN RECURS DE SEGONA: els avisos de seguretat SEMPRE fan el to,
 * encara que la veu vagi. En un mirador amb dues-centes persones cridant quan
 * arriba la totalitat, tres bips aguts arriben on no arriba una frase.
 */

import type { AlertSeverity, LocalisedText, TimerLocale } from '../../core/timer';

/** Estat de la sortida d'àudio, per ensenyar-lo a la interfície. */
export type VoiceStatus =
  /** Hi ha veu i s'ha desbloquejat. */
  | 'ready'
  /** Hi ha àudio però no hi ha cap veu utilitzable: només tons. */
  | 'tone-only'
  /** Encara no s'ha desbloquejat amb un gest de l'usuari. */
  | 'locked'
  /** Ni veu ni àudio: el navegador no en té. */
  | 'unsupported';

export interface Announcer {
  /**
   * Desbloqueja veu i àudio. S'HA de cridar dins del gestor d'un gest de
   * l'usuari (clic o toc), no des d'un `useEffect`.
   */
  unlock(): Promise<VoiceStatus>;
  /** Diu un avís. Els de seguretat tallen el que s'estigui dient. */
  announce(text: LocalisedText, severity?: AlertSeverity): void;
  /** Talla qualsevol locució en curs. */
  cancel(): void;
  setLocale(locale: TimerLocale): void;
  status(): VoiceStatus;
  /** Idioma amb què es parlarà de veritat. Pot no ser el demanat (vegeu la capçalera). */
  spokenLocale(): TimerLocale;
  dispose(): void;
}

type AudioContextCtor = new () => AudioContext;

/** `AudioContext` amb el prefix antic de Safari, que encara circula. */
function getAudioContextCtor(): AudioContextCtor | null {
  const w = globalThis as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Patrons de to: un bip curt per als informatius, tres aguts per als de seguretat. */
const TONE_INFO = { freq: 880, beeps: 1, beepMs: 120, gapMs: 0 };
const TONE_SAFETY = { freq: 1320, beeps: 3, beepMs: 130, gapMs: 90 };

export interface AnnouncerOptions {
  locale: TimerLocale;
  /** Volum de la veu, de 0 a 1. Per defecte 1: això es fa servir a l'aire lliure. */
  volume?: number;
  /** S'invoca quan canvia l'estat (per exemple quan arriben les veus). */
  onStatusChange?: (status: VoiceStatus) => void;
}

export function createAnnouncer(options: AnnouncerOptions): Announcer {
  const synth: SpeechSynthesis | undefined = globalThis.speechSynthesis;
  const AudioCtor = getAudioContextCtor();
  const volume = options.volume ?? 1;

  let locale = options.locale;
  let unlocked = false;
  let voice: SpeechSynthesisVoice | null = null;
  let voiceLocale: TimerLocale = locale;
  let audio: AudioContext | null = null;

  function computeStatus(): VoiceStatus {
    if (!synth && !AudioCtor) return 'unsupported';
    if (!unlocked) return 'locked';
    if (!synth || voice === null) return 'tone-only';
    return 'ready';
  }

  function notify(): void {
    options.onStatusChange?.(computeStatus());
  }

  /**
   * Tria la millor veu disponible per a l'idioma demanat.
   * Es prefereixen les veus locals: les de servidor callen sense xarxa, i el
   * dia de l'eclipsi la xarxa mòbil estarà saturada.
   */
  function pickVoice(): void {
    if (!synth) return;
    const voices = synth.getVoices();
    if (voices.length === 0) return;

    const byLang = (prefix: string): SpeechSynthesisVoice | undefined => {
      const matches = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
      return matches.find((v) => v.localService) ?? matches[0];
    };

    const wanted = byLang(locale);
    if (wanted) {
      voice = wanted;
      voiceLocale = locale;
      return;
    }
    const other: TimerLocale = locale === 'ca' ? 'es' : 'ca';
    const alternative = byLang(other);
    if (alternative) {
      voice = alternative;
      voiceLocale = other;
      return;
    }
    // Sense cap veu dels nostres idiomes val més la veu per defecte del sistema
    // que res: dirà el text amb accent estrany però s'entendrà.
    voice = null;
    voiceLocale = locale;
  }

  const onVoicesChanged = (): void => {
    pickVoice();
    notify();
  };
  synth?.addEventListener?.('voiceschanged', onVoicesChanged);
  pickVoice();

  /** Bips amb l'API d'àudio. Sintetitzats: cap fitxer, cap descàrrega. */
  function playTone(kind: typeof TONE_INFO): void {
    if (!audio) return;
    const ctx = audio;
    const start = ctx.currentTime + 0.01;
    for (let i = 0; i < kind.beeps; i++) {
      const at = start + (i * (kind.beepMs + kind.gapMs)) / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = kind.freq;
      // Rampa curta d'atac i caiguda: un to quadrat sec fa un clic desagradable
      // i a l'aire lliure es confon amb un error de connexió.
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.28 * volume, at + 0.015);
      gain.gain.linearRampToValueAtTime(0, at + kind.beepMs / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + kind.beepMs / 1000 + 0.02);
    }
  }

  return {
    async unlock(): Promise<VoiceStatus> {
      if (AudioCtor && !audio) {
        try {
          audio = new AudioCtor();
        } catch {
          audio = null;
        }
      }
      // A iOS el context neix suspès i només `resume()` dins d'un gest el
      // desperta. Si això no es fa, els tons no sonen mai i no hi ha cap error.
      if (audio && audio.state === 'suspended') {
        try {
          await audio.resume();
        } catch {
          // Sense àudio quedarà la veu, si n'hi ha.
        }
      }
      if (synth) {
        // Locució buida dins del gest: és el que desbloqueja el motor de veu a
        // iOS. Sense això, la primera frase de veritat no se sent.
        try {
          const primer = new SpeechSynthesisUtterance(' ');
          primer.volume = 0;
          synth.speak(primer);
        } catch {
          // Alguns navegadors llancen si el motor no està llest. No és fatal.
        }
        pickVoice();
      }
      unlocked = true;
      notify();
      return computeStatus();
    },

    announce(text: LocalisedText, severity: AlertSeverity = 'info'): void {
      if (severity === 'safety') {
        // Un avís de seguretat no fa cua darrere de res: el que s'estigui dient
        // ja no importa tant com això.
        try {
          synth?.cancel();
        } catch {
          /* buit a propòsit */
        }
        playTone(TONE_SAFETY);
      } else if (!synth || voice === null) {
        // Sense veu, el to és l'únic canal que queda.
        playTone(TONE_INFO);
      }

      if (!synth) return;
      try {
        const utterance = new SpeechSynthesisUtterance(text[voiceLocale] ?? text[locale]);
        utterance.lang = voiceLocale === 'ca' ? 'ca-ES' : 'es-ES';
        if (voice) utterance.voice = voice;
        utterance.volume = volume;
        // Una mica per sota del ritme normal: aquestes frases es diuen amb
        // vent, gent i el cor accelerat. La claredat val més que la brevetat.
        utterance.rate = severity === 'safety' ? 0.95 : 1;
        utterance.pitch = 1;
        // El to de seguretat dura uns 0,6 s; deixar-lo acabar abans de parlar
        // evita que la primera paraula quedi tapada.
        if (severity === 'safety') {
          globalThis.setTimeout(() => {
            try {
              synth.speak(utterance);
            } catch {
              /* buit a propòsit */
            }
          }, 650);
        } else {
          synth.speak(utterance);
        }
      } catch {
        playTone(severity === 'safety' ? TONE_SAFETY : TONE_INFO);
      }
    },

    cancel(): void {
      try {
        synth?.cancel();
      } catch {
        /* buit a propòsit */
      }
    },

    setLocale(next: TimerLocale): void {
      locale = next;
      pickVoice();
      notify();
    },

    status: computeStatus,
    spokenLocale: () => voiceLocale,

    dispose(): void {
      synth?.removeEventListener?.('voiceschanged', onVoicesChanged);
      try {
        synth?.cancel();
      } catch {
        /* buit a propòsit */
      }
      void audio?.close();
      audio = null;
    },
  };
}
