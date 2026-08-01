import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from '../core/IconButton';
import '../ui.css';

export interface DialogProps {
  /** Per defecte oberta, com al contracte: qui la munta ja ha decidit obrir-la. */
  open?: boolean;
  title?: string;
  /** Sense `onClose` no hi ha creu ni es tanca amb Escape: fulla obligatòria. */
  onClose?: () => void;
  /** Botons d'acció. El primer és el que resol; el segon, sortir sense fer res. */
  footer?: ReactNode;
  /** Text de la creu per al lector de pantalla. */
  closeLabel?: string;
  children: ReactNode;
}

/**
 * Fulla modal. Al mòbil puja de baix; a partir de tauleta se centra.
 *
 * TRES COSES QUE NO SÓN COSMÈTIQUES:
 * 1. Escape tanca. És l'única sortida amb teclat si el focus s'ha perdut.
 * 2. Mentre és oberta, el document no es desplaça. Sense això, al mòbil el
 *    fons llisca sota la fulla i es perd la posició de lectura.
 * 3. El focus entra a la fulla en obrir-se i torna a l'element que la va obrir
 *    en tancar-se.
 *
 * NO es fa servir `<dialog>` natiu: `showModal()` s'ha de cridar per efecte i
 * el seu `::backdrop` no accepta `backdrop-filter` de manera fiable a iOS, que
 * és justament la plataforma d'aquesta app.
 */
export function Dialog({
  open = true,
  title,
  onClose,
  footer,
  closeLabel = 'Tanca',
  children,
}: DialogProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    openerRef.current = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="ui-dialog"
      // Clic al vel: tanca. Es comprova que el clic sigui al vel mateix i no a
      // un fill, o arrossegar text dins la fulla la tancaria.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title === undefined ? undefined : titleId}
        tabIndex={-1}
        className="ui-dialog__sheet"
      >
        <div className="ui-dialog__head">
          <h2 id={titleId} className="ui-dialog__title">
            {title}
          </h2>
          {onClose && (
            <IconButton
              icon="x"
              label={closeLabel}
              variant="ghost"
              size="sm"
              onClick={onClose}
            />
          )}
        </div>
        <div className="ui-dialog__body">{children}</div>
        {footer && <div className="ui-dialog__footer">{footer}</div>}
      </div>
    </div>
  );
}
