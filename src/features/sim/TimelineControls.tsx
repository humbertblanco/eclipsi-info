/**
 * Els controls de la línia de temps: el que converteix un mapa en un simulador.
 *
 * LA DECISIÓ QUE MANA SOBRE TOTES LES ALTRES: aquesta app té un compte enrere
 * de debò, amb una veu que arriba a autoritzar a treure's el filtre solar. Un
 * simulador que ensenyi una hora sense dir que és simulada és, el dia de
 * l'eclipsi, una manera de fer que algú es tregui el filtre dos minuts abans
 * d'hora. Per això la distinció TEMPS REAL / SIMULACIÓ no és una etiqueta
 * discreta en una cantonada sinó la primera fila del control, en forma de
 * commutador, i sota el rellotge hi ha SEMPRE una frase que diu quant s'allunya
 * del món el que s'està mirant («3 h 12 min per davant de l'hora real»). La
 * competència ensenya l'hora i prou; és l'única cosa d'aquesta pantalla que no
 * hem copiat d'ells a posta.
 *
 * L'AMBRE ÉS DE LA BARRA, i només d'ella. La via de `RangeSlider` ja pinta en
 * ambre el tram recorregut —és el sistema qui ho decideix, no aquest fitxer— i
 * això vol dir que aquí dins l'ambre significa «temps transcorregut». D'aquí
 * surten dues renúncies:
 *
 *   · les pastilles de contacte no fan servir mai l'estat `selected` de `Tag`,
 *     que és ambre. Serveixen per SALTAR-HI, no per dir on ets: això ja ho diu
 *     la barra, i dues coses ambre a quaranta píxels l'una de l'altra fan que
 *     cap de les dues signifiqui res.
 *   · cap botó és `solid` ni `primary` (també ambre). El transport és neutre.
 *
 * PER QUÈ NO S'HI FA SERVIR `TimelineTrack`, que existeix i pinta els cinc
 * contactes. Perquè no es pot prémer, i en aquesta fila els contactes han de
 * ser el control de salt; perquè repetiria l'ambre de la barra dient el mateix;
 * i perquè les hores que aporta ja les diu `EphemerisTable` a totes les
 * pantalles on això aterrarà. Segueix sent el component bo per a un resum
 * estàtic de contactes: aquí el que cal és un comandament.
 *
 * CAP A 390 px. Cinc files, cadascuna d'una alçada tàctil: commutador de
 * rellotge, lectura, barra, contactes i transport, i la velocitat només quan
 * s'està simulant —en temps real no vol dir res, i que desaparegui és un senyal
 * més que reforça en quin dels dos móns ets.
 */

import { useMemo } from 'react';
import {
  isPlayable,
  NUDGE_MS,
  PLAYBACK_RATES,
  type PlaybackRate,
  type TimelineSource,
} from '../../core/timeline';
import type { Locale } from '../../i18n';
import { formatClock } from '../../screens/format';
import {
  IconButton,
  RangeSlider,
  SegmentedControl,
  Tag,
  type SegmentedOption,
} from '../../ui';
import { TRAJECTORY_SAMPLES } from './samples';
import { contactJumpLabel, contactShortLabel, hs, timeGapText } from './strings';
import type { SimulationClock } from './useSimulationClock';
import './timeline.css';

export interface TimelineControlsProps {
  /**
   * El rellotge. Normalment surt de `useSimulationClock`, però el tipus és el
   * que mana: una pantalla que ja governi l'instant pel seu compte pot
   * satisfer-lo sense el hook, i els controls no se n'assabenten.
   */
  clock: SimulationClock;
  locale: Locale;
  /** La fila de pastilles per saltar a un contacte. */
  showContacts?: boolean;
  className?: string;
}

/** Clau de text del factor de velocitat: '1' | '60' | '300' | '600'. */
type RateKey = `${PlaybackRate}`;

const RATE_OPTIONS: readonly SegmentedOption<RateKey>[] = PLAYBACK_RATES.map((rate) => ({
  value: `${rate}` as RateKey,
  // El signe de multiplicar de debò (×), no una ics. És una xifra, i el símbol
  // correcte és el que fa que «60×» no es llegeixi «seixanta ics».
  label: `${rate}×`,
}));

export function TimelineControls({
  clock,
  locale,
  showContacts = true,
  className,
}: TimelineControlsProps) {
  const { state, timeMs, realNowMs } = clock;
  const { startMs, endMs } = state.window;
  const live = state.source === 'live';
  const playable = isPlayable(state);

  const modeOptions = useMemo<readonly SegmentedOption<TimelineSource>[]>(
    () => [
      { value: 'live', label: hs('timeline.live', locale) },
      { value: 'sim', label: hs('timeline.sim', locale) },
    ],
    [locale],
  );

  const clockText = formatClock(new Date(timeMs), locale);

  /*
   * EL PAS DE LA BARRA ÉS EL DE LES MOSTRES, no un segon rodó.
   *
   * `samples.ts` calcula 240 mostres entre C1 i C4 i diu, amb totes les
   * lletres, que la barra ha de compartir graella amb la corba perquè el
   * marcador caigui damunt d'una mostra i no entre dues. Amb una finestra de
   * 105 min, cada pas són 26 s: també és el que avança cada premuda de fletxa
   * del teclat, i creuar l'eclipsi sencer amb el teclat són 240 premudes en
   * comptes de les 6.300 que caldrien amb pas d'un segon.
   */
  const step = endMs > startMs ? (endMs - startMs) / TRAJECTORY_SAMPLES : 1;

  // En temps real l'instant pot ser molt fora de la finestra —l'eclipsi és
  // d'aquí a un any— i el control natiu no accepta valors fora de rang. Es capa
  // per pintar, i la frase de sota diu que allò no és on ets.
  const scrubValue = Math.min(endMs, Math.max(startMs, timeMs));

  const liveNoteKey = live
    ? timeMs < startMs
      ? 'timeline.liveBefore'
      : timeMs > endMs
        ? 'timeline.liveAfter'
        : 'timeline.liveDuring'
    : null;

  /*
   * LA FORMA D'AIXÒ ÉS UNA BARRA, NO UNA COLUMNA D'AJUSTOS.
   *
   * El primer muntatge apilava sis blocs a tota amplada —mode, lectura, barra,
   * contactes, transport i velocitat—, cada un amb la seva fila. Ocupava 230 px
   * d'alçada sota un cel de 150, el botó de reproduir surava sol al mig d'una
   * fila buida i el conjunt es llegia com un panell de configuració. Un
   * reproductor s'ha de reconèixer sense llegir-lo: els botons junts a
   * l'esquerra, la barra al mig i l'hora a la dreta, tot en una línia.
   *
   * Queden dos nivells a posta. A dalt, EL GEST: transport, barra i hora, que
   * és el que es toca mentre es mira el cel. A baix, LA CONFIGURACIÓ: de quin
   * món és l'hora i a quina velocitat corre, que es tria un cop i s'oblida.
   * Els contactes pengen de la barra perquè són posicions D'AQUELLA barra, no
   * una llista a part.
   */
  return (
    <div className={['simclock', className ?? ''].filter(Boolean).join(' ')}>
      <div className="simclock__bar">
        <div className="simclock__transport">
          <IconButton
            icon="arrow-left"
            label={hs('timeline.back', locale)}
            onClick={() => clock.nudge(-NUDGE_MS)}
            disabled={!playable}
          />
          <IconButton
            icon={state.playing ? 'pause' : 'play'}
            label={hs(state.playing ? 'timeline.pause' : 'timeline.play', locale)}
            onClick={clock.toggle}
            disabled={!playable}
            className="simclock__play"
          />
          <IconButton
            icon="arrow-right"
            label={hs('timeline.forward', locale)}
            onClick={() => clock.nudge(NUDGE_MS)}
            disabled={!playable}
          />
        </div>

        <div className="simclock__scrub">
          <RangeSlider
            min={startMs}
            max={endMs}
            step={step}
            value={scrubValue}
            onChange={clock.seek}
            disabled={!playable}
            aria-label={hs('timeline.scrub', locale)}
            // Guanya el de `RangeSlider` perquè les propietats de la resta
            // s'escampen després: sense això el lector llegiria l'instant com el
            // número d'època que és, disset xifres.
            aria-valuetext={clockText}
          />

          {showContacts && state.marks.length > 0 && (
            <div
              className="simclock__contacts"
              role="group"
              aria-label={hs('timeline.contacts', locale)}
            >
              {state.marks.map((mark) => (
                <Tag
                  key={mark.id}
                  // 32 px de dibuix i 44 de toc, amb la primitiva del sistema. Una
                  // pastilla de «C2» no pot mesurar 44 px sense semblar un botó,
                  // però això es prem a fora, dret i amb el dit gros.
                  className="ui-tappable"
                  title={contactJumpLabel(mark.id, locale)}
                  aria-label={contactJumpLabel(mark.id, locale)}
                  onClick={() => clock.jump(mark.id)}
                >
                  {contactShortLabel(mark.id, locale)}
                </Tag>
              ))}
            </div>
          )}
        </div>

        {/*
          La lectura. `aria-live` no hi va a posta: durant la reproducció l'hora
          canvia seixanta cops per segon i un lector de pantalla que ho cantés tot
          seria inservible. Qui necessiti l'instant el té a `aria-valuetext` de la
          barra, que és on el gest el va a buscar.
        */}
        <p className={live ? 'simclock__read simclock__read--live' : 'simclock__read'}>
          <span className="simclock__dot" aria-hidden />
          <strong className="simclock__clock">{clockText}</strong>
          <span className="simclock__note">
            {liveNoteKey === null
              ? timeGapText(timeMs - realNowMs, locale)
              : hs(liveNoteKey, locale)}
          </span>
        </p>
      </div>

      <div className="simclock__foot">
        <SegmentedControl
          value={state.source}
          onChange={(next) => (next === 'live' ? clock.goLive() : clock.enterSim())}
          options={modeOptions}
          label={hs('timeline.mode', locale)}
          className="simclock__mode"
        />

        {/*
          La velocitat només existeix en simulació, i el buit que deixa en
          directe NO es col·lapsa: `visibility` en comptes de desmuntar-la, per
          què la barra no canviï d'alçada en commutar de món i el mode no salti
          de lloc sota el dit.
        */}
        <SegmentedControl
          value={`${state.rate}` as RateKey}
          // L'únic pas per un `string` de tot el fitxer. `SegmentedControl` és
          // genèric sobre tipus de text —així les unions de mode de cada
          // pantalla es continuen comprovant en compilar— i un factor de
          // velocitat és un número. La clau és el número escrit, i el tipus
          // plantilla fa que només n'hi càpiguen quatre.
          onChange={(key) => clock.setRate(Number(key) as PlaybackRate)}
          options={RATE_OPTIONS}
          label={hs('timeline.rate', locale)}
          className={live ? 'simclock__rate simclock__rate--idle' : 'simclock__rate'}
        />
      </div>
    </div>
  );
}
