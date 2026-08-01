import { useCallback, useState } from 'react';
import { Button, Card, Checkbox, SafetyNotice } from '../ui';
import { canRemoveFilter, FILTER_GATE_NOTE } from '../core/timer';
import { GuideView } from '../features/guide/GuideView';
import type { EclipseContext } from './context';
import { s } from './strings';
import { formatClockShort } from './format';
import './screens.css';

export interface GuideScreenProps extends EclipseContext {
  /** Porta a la pestanya on viuen de debò els avisos amb veu. */
  onOpenCountdown: () => void;
}

/** Les quatre coses de la llista. L'ordre és el de la conseqüència de no dur-les. */
const ITEMS = ['glasses', 'tripod', 'battery', 'horizon'] as const;
type Item = (typeof ITEMS)[number];

const STORAGE_KEY = 'eclipsi.checklist';

/** Mitja hora abans. És el marge que dona temps a plantar-se i no a arribar-hi. */
const ALERT_LEAD_MS = 30 * 60 * 1000;

/**
 * Llegeix la llista del dispositiu.
 *
 * Safari en mode privat llança en tocar `localStorage`, i una llista de
 * comprovació que fa petar l'app seria un acudit de mal gust el dia de
 * l'eclipsi. Si falla, es comença amb tot desmarcat i s'acaba aquí.
 */
function readChecklist(): Record<Item, boolean> {
  const empty = { glasses: false, tripod: false, battery: false, horizon: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return empty;
    const source = parsed as Partial<Record<Item, unknown>>;
    return {
      glasses: source.glasses === true,
      tripod: source.tripod === true,
      battery: source.battery === true,
      horizon: source.horizon === true,
    };
  } catch {
    return empty;
  }
}

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
  circumstances,
  verdict,
  onOpenCountdown,
}: GuideScreenProps) {
  const [checked, setChecked] = useState<Record<Item, boolean>>(readChecklist);

  const toggle = useCallback((item: Item, next: boolean) => {
    setChecked((prev) => {
      const updated = { ...prev, [item]: next };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // La llista durarà només aquesta sessió. No és motiu per no marcar-la.
      }
      return updated;
    });
  }, []);

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

      <Card>
        <span className="screen__overline">{s('guide.checklist', locale)}</span>
        <div className="guidescreen__list">
          {ITEMS.map((item) => (
            <Checkbox
              key={item}
              checked={checked[item]}
              onChange={(next) => toggle(item, next)}
              label={s(`guide.item.${item}` as 'guide.item.glasses', locale)}
            />
          ))}
        </div>
        <p className="screen__note">{s('guide.checklistNote', locale)}</p>
      </Card>

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

      <GuideView eclipseId={eclipseId} />
    </div>
  );
}
