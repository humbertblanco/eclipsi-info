import { Button, Card, SafetyNotice } from '../ui';
import { canRemoveFilter, FILTER_GATE_NOTE } from '../core/timer';
import { GuideView } from '../features/guide/GuideView';
import { OfflinePanel } from '../offline/OfflinePanel';
import { ThreeEclipses } from './ThreeEclipses';
import type { EclipseContext } from './context';
import { s } from './strings';
import { formatClockShort } from './format';
import './screens.css';

export interface GuideScreenProps extends EclipseContext {
  /** Porta a la pestanya on viuen de debò els avisos amb veu. */
  onOpenCountdown: () => void;
}



/** Mitja hora abans. És el marge que dona temps a plantar-se i no a arribar-hi. */
const ALERT_LEAD_MS = 30 * 60 * 1000;

/**
 * Pantalla "Guia".
 *
 * QUÈ CONSERVA DE LA REFERÈNCIA (`design-reference/ui_kits/app/GuideScreen.jsx`):
 * l'avís de seguretat va A DALT DE TOT, no es pot descartar, i el seu títol és
 * una XIFRA concreta i no una advertència vaga. Després, la llista de
 * comprovació de veritat, amb estat que sobreviu a tancar l'app.
 *
 * QUÈ CANVIA, I PER QUÈ:
 *
 *  · La xifra del títol no és el «100 segons» inventat de la referència: és la
 *    durada de la fase central VISIBLE des del punt de l'usuari, la que ja ha
 *    passat pel relleu. Si des d'allà no hi ha fase central, el títol canvia i
 *    diu que cap moment és segur, que és la informació que salva un ull.
 *
 *  · Les pestanyes per moment (Abans / Durant / Fotografia) i les files de
 *    consells no hi són. El contingut de la guia viu tipat a
 *    `src/content/guide.ts` i el pinta `GuideView`, que no està organitzat per
 *    moments sinó per temes; reetiquetar-lo des d'aquí seria inventar-se una
 *    classificació que el contingut no té. Queda anotat com a pendent: si el
 *    contingut algun dia porta el moment a cada secció, aquesta pantalla ja té
 *    el lloc on posar-hi les pestanyes.
 *
 *  · L'interruptor d'avís de la referència s'ha substituït per un enllaç al
 *    compte enrere. Els avisos de veu, l'assaig i el bloqueig de pantalla ja
 *    existeixen i viuen allà; un segon interruptor aquí, que no els governa,
 *    seria un control que menteix.
 */
export function GuideScreen({
  eclipseId,
  locale,
  location,
  placeLabel,
  circumstances,
  verdict,
  horizon,
  onOpenCountdown,
}: GuideScreenProps) {
  /*
   * QUI DECIDEIX SI ES POT MIRAR A ULL NU ÉS LA COMPORTA, I NOMÉS ELLA.
   *
   * Aquí hi havia `centralDurationSec > 0`. Un eclipsi ANULAR també té C2 i C3
   * i també té durada de fase central: el 26 de gener del 2028, des de
   * València, aquesta pantalla encapçalava amb «Només 421 s són segurs —
   * durant la fase central pots mirar el Sol a ull nu», set minuts seguits, per
   * damunt del mateix avís de `GuideView` que diu «eclipsi anular: mai sense
   * filtre». L'anell que queda a la vista és fotosfera.
   *
   * `canRemoveFilter` ja contemplava l'anular, la durada mínima, el terreny i
   * la incertesa del caire. El defecte no era la comporta: era que aquesta
   * pantalla no la consultava i s'havia escrit la seva pròpia regla.
   */
  const gate =
    circumstances === null
      ? null
      : canRemoveFilter({
          kind: circumstances.kind,
          contacts: {
            c1: circumstances.contacts.c1?.time.getTime(),
            c2: circumstances.contacts.c2?.time.getTime(),
            max: circumstances.contacts.max.time.getTime(),
            c3: circumstances.contacts.c3?.time.getTime(),
            c4: circumstances.contacts.c4?.time.getTime(),
          },
          // El relleu ja hi ha dit la seva quan hi ha veredicte.
          centralPhaseVisible: verdict === null ? undefined : verdict.centralVisibleSec > 0,
          edgeUncertain: circumstances.edgeUncertain,
        });

  // Els segons segurs són els que de veritat veuràs, no els teòrics.
  const safeSec = verdict
    ? Math.round(verdict.centralVisibleSec)
    : Math.round(circumstances?.centralDurationSec ?? 0);

  const maxTime = circumstances?.contacts.max.time ?? null;

  return (
    <div className="screen">
      {gate !== null && gate.allowed && safeSec > 0 ? (
        <SafetyNotice level="danger" title={s('guide.safeTitle', locale, { n: safeSec })}>
          {s('guide.safeBody', locale)}
        </SafetyNotice>
      ) : (
        <SafetyNotice level="danger" title={s('guide.unsafeTitle', locale)}>
          {/* El motiu concret, i no una frase genèrica: no és el mateix ser
              fora de la franja que ser en un anular o tenir una muntanya al
              davant, i el que l'usuari pot fer al respecte tampoc. */}
          {gate === null
            ? s('guide.unsafeBody', locale)
            : FILTER_GATE_NOTE[gate.reason][locale]}
        </SafetyNotice>
      )}

      {/*
        AQUÍ HI HAVIA LA LLISTA DE «QUÈ EM CAL PORTAR».

        Se n'ha anat perquè no era una guia: era una llista de quatre coses
        òbvies amb caselles per marcar, i ocupava el primer terç de la pantalla
        per damunt del contingut que sí que serveix. El que cal portar ja surt
        explicat, i amb el perquè, dins de la guia mateixa.
      */}
      <Card>
        <span className="screen__overline">{s('guide.alert', locale)}</span>
        <p className="screen__note">
          {maxTime === null
            ? s('guide.alertPending', locale)
            : s('guide.alertAt', locale, {
                time: formatClockShort(new Date(maxTime.getTime() - ALERT_LEAD_MS), locale),
              })}
        </p>
        <p className="screen__note">{s('guide.alertOn', locale)}</p>
        <Button variant="ghost" icon="bell" onClick={onOpenCountdown}>
          {s('nav.countdown', locale)}
        </Button>
      </Card>

      {/*
        ELS TRES ECLIPSIS, CALCULATS PER AL PUNT DE L'USUARI.

        PER QUÈ AQUÍ I NO A LA PORTADA: és una decisió de planificació, no una
        lectura del dia. Qui obre l'app el 12 d'agost a les vuit del vespre vol
        una xifra i un compte enrere; qui compara tres eclipsis ho fa mesos
        abans, i ho fa a la pantalla que es llegeix a casa — la mateixa
        justificació que ja té el panell de preparació offline de sota.

        PER QUÈ EN AQUESTA POSICIÓ, entre l'avís de 30 min i la preparació
        offline: els dos avisos curts de dalt parlen de l'eclipsi que l'usuari
        té triat i han de quedar junts. Aquesta targeta és el moment en què la
        pantalla deixa de parlar d'un eclipsi i passa a parlar dels tres, i just
        després ve l'acció de preparar-se. La guia de lectura va al final, que
        és on ha d'anar el text llarg.

        NO REP `circumstances` NI `verdict`: se'ls calcula tots tres pel seu
        compte. El parell que porta el context és NOMÉS de l'eclipsi
        seleccionat, i encadenar-lo aquí faria que canviar d'eclipsi al selector
        de la capçalera refés les tres cerques d'arrels per obtenir exactament
        els mateixos números. El que sí que hi passa és el `horizon`, que és
        l'única peça compartida de debò: el perfil del terreny depèn del lloc i
        no de l'eclipsi.
      */}
      <ThreeEclipses
        eclipseId={eclipseId}
        locale={locale}
        location={location}
        horizon={horizon}
      />

      {/*
        LA PREPARACIÓ PER ANAR SENSE COBERTURA, QUE NO ES PODIA OBRIR DES
        D'ENLLOC.

        El panell existia sencer (`src/offline/OfflinePanel.tsx`, amb els seus
        hooks i la seva planificació provada) i cap pantalla no el muntava: al
        camp, l'única memòria cau que tenia l'usuari era la de les tessel·les
        que hagués mirat per casualitat, i «funciona sense cobertura» és un
        pilar declarat del producte.

        PER QUÈ AQUÍ. La guia és la pantalla de preparar-se: es llegeix a casa,
        dies abans, que és exactament quan baixar 15-20 MB encara és possible —
        el mateix argument que la portada de la guia fa amb «llegeix-la abans
        de sortir de casa». I de les quatre pantalles és una de les dues que es
        desplacen: al mapa i al cel el marc és fix i un panell d'aquesta alçada
        no hi cap sense robar espai al que aquelles pantalles han d'ensenyar.

        PER QUÈ EN AQUESTA POSICIÓ: després dels dos avisos curts (seguretat
        primer, sempre; l'avís de 30 min després, que hi enllaça) i abans del
        contingut de lectura, perquè és una ACCIÓ amb data de caducitat i
        enterrada sota vint pantalles de text no la faria ningú.

        El punt i el seu nom venen del context, com a totes les pantalles: el
        panell prepara el lloc que l'app ja té triat, no un de propi.
      */}
      <OfflinePanel
        location={location}
        placeLabel={placeLabel ?? undefined}
        locale={locale}
      />

      <GuideView eclipseId={eclipseId} />
    </div>
  );
}
