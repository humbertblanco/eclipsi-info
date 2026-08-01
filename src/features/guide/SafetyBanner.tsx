/**
 * Avís de seguretat ocular contextual.
 *
 * Component petit i sense estat, pensat per encastar-lo sobre la imatge de la
 * càmera o a qualsevol capçalera. Tota la seva raó de ser és una única decisió:
 * en aquest instant, aquesta persona es pot treure el filtre o no?
 *
 * La regla, que ve de l'AAS i de l'IGN (vegeu `src/content/guide.ts`):
 *  - Anular  → MAI. Ni tan sols durant l'anularitat: sempre queda anell.
 *  - Total   → només entre C2 i C3 i només dins la franja.
 *  - Parcial → mai.
 *
 * `isInTotality` s'ignora deliberadament quan l'eclipsi és anular: si el motor
 * de simulació algun dia marqués l'anularitat amb aquesta bandera, el banner
 * no ha de dir mai que es pot mirar. El cas segur mana.
 *
 * AQUEST COMPONENT NO PINTA RES PEL SEU COMPTE. Abans tenia el seu propi estil,
 * amb una franja de color a l'esquerra — el patró que el sistema de disseny
 * prohibeix explícitament — i el resultat era que la pantalla de guia ensenyava
 * DOS avisos de seguretat amb dos aspectes diferents: aquest i el `SafetyNotice`
 * del sistema.
 *
 * En un avís de seguretat ocular, que dos components diguin el mateix de dues
 * maneres no és un detall estètic: ensenya a l'usuari que l'aspecte de l'avís no
 * vol dir res, i el dia que n'hi hagi un de diferent no s'hi fixarà.
 *
 * El valor d'aquest component és la LÒGICA de sobre, no l'aspecte. El dibuix el
 * fa `SafetyNotice`.
 */

import { useTranslation } from '../../i18n';
import { SafetyNotice } from '../../ui';

export type EclipseKind = 'total' | 'annular' | 'partial' | 'none';

export interface SafetyBannerProps {
  eclipseKind: EclipseKind;
  /** Cert només entre C2 i C3 d'un eclipsi total vist des de dins la franja. */
  isInTotality: boolean;
  /** Text addicional opcional (per exemple l'avís d'usar la pantalla). */
  note?: string;
  className?: string;
}

/** To visual i prefix de clau de traducció segons la situació. */
type Verdict = { tone: 'good' | 'warn' | 'bad'; key: string; safe: boolean };

function resolveVerdict(kind: EclipseKind, isInTotality: boolean): Verdict {
  // L'anular va primer perquè cap altra condició el pot sobreescriure.
  if (kind === 'annular') return { tone: 'bad', key: 'safety.annular', safe: false };
  if (kind === 'partial') return { tone: 'bad', key: 'safety.partial', safe: false };
  if (kind === 'none') return { tone: 'warn', key: 'safety.none', safe: false };
  return isInTotality
    ? { tone: 'good', key: 'safety.totalityNow', safe: true }
    : { tone: 'warn', key: 'safety.totalitySoon', safe: false };
}

export function SafetyBanner({
  eclipseKind,
  isInTotality,
  note,
  className,
}: SafetyBannerProps) {
  const { t } = useTranslation();
  const notice = resolveVerdict(eclipseKind, isInTotality);

  return (
    <SafetyNotice
      /*
       * El moment segur va en 'info' i no en cap to d'alarma: és l'únic instant
       * de tot l'eclipsi en què es pot mirar sense filtre, i mereix llegir-se
       * com una instrucció i no com un avís més. El sistema no té un nivell
       * "tot correcte" a `SafetyNotice`, i és coherent: un rètol de seguretat
       * ocular no ha de dir mai que tot va bé, ha de dir què has de fer.
       */
      level={notice.safe ? 'info' : notice.tone === 'warn' ? 'warning' : 'danger'}
      title={t(`${notice.key}.title`)}
      icon={notice.safe ? 'eye' : 'eye-off'}
      className={className}
    >
      {t(`${notice.key}.text`)}
      {note ? ` ${note}` : ''}
    </SafetyNotice>
  );
}
