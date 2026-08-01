/* ============================================================================
   Eclipsi Design System — barril públic de la capa d'UI.

   PER QUÈ UN BARRIL: els consumidors importen `from '../../ui'` i no han de
   saber si un component viu a `core/`, `forms/` o `eclipse/`. Reorganitzar
   carpetes deixa de ser un canvi que trenca res.

   D'ON SURTEN ELS CONTRACTES: manen els fitxers `.d.ts` de
   `design-reference/components/**`, i la implementació de referència és
   `design-reference/_ds_bundle.js` — NO els `.jsx`, que són una còpia de
   treball. Per damunt de tots dos, per a radis, elevació, tipografia i colors,
   manen les fitxes de `design-reference/guidelines/`.

   ON DIVERGIM DEL CONTRACTE, I PER QUÈ. Cada cas està raonat al fitxer del
   component; el resum és:

     · `Countdown` rep `targetMs` (ms d'època) a més del `target` ISO del
       contracte. L'instant real surt d'un càlcul, no d'una cadena escrita.
     · `VisibilityMeter` accepta `value: null` i `state: 'unknown'`, perquè el
       motor de nuvolositat pot no tenir dada i el sistema mana dir la
       incertesa en comptes d'amagar-la darrere un zero.
     · `Input`, `Select`, `Switch` i `Checkbox` retornen el VALOR a `onChange`,
       no l'esdeveniment: totes les crides feien `event.target.value`.
     · `SegmentedControl`, `Select`, `Tabs`, `TabBar` i `SiteHeader` són
       genèrics sobre el tipus del valor, perquè la unió de modes de cada
       pantalla es continuï comprovant en compilació.
     · `Tag` és un `<button>` amb `aria-pressed` i no el `<span onClick>` del
       sistema, que no rep el focus del teclat.
     · `SafetyNotice` puja a `role="alert"` en nivell de perill.
     · `Tooltip` existeix però té un ús molt limitat: al mòbil no hi ha hover.
       No hi pot anar mai informació necessària.

   NOMS DE PROPS OBSOLETS. Quan el contracte deia una cosa i nosaltres una
   altra, s'accepten TOTS DOS i l'antic queda marcat amb `@deprecated`:
   `TopBar.leading/actions` → `left/right`, `Tooltip.label` → `content`,
   `TipCard.ordinal` → `index`, `SafetyNotice level="warn"` → `"warning"`,
   `Button variant="solid"` → `"primary"` i `"quiet"` → `"ghost"`,
   `Card tone="surface"` → `"default"`, `IconButton variant="plain"` →
   `"ghost"`. Cap crida existent s'ha hagut de tocar per això.

   PENDENT CONEGUT: logos de marca a `public/brand/` i fotografia pròpia amb
   drets clars. La referència feia servir imatges d'Unsplash per URL externa,
   cosa que trenca el funcionament offline.
   ========================================================================== */

import './ui.css';

/* --- core ---------------------------------------------------------------- */
export { Icon } from './core/Icon';
export type { IconName, IconProps } from './core/Icon';
export { Button } from './core/Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './core/Button';
export { IconButton } from './core/IconButton';
export type {
  IconButtonProps,
  IconButtonSize,
  IconButtonVariant,
} from './core/IconButton';
export { Badge } from './core/Badge';
export type { BadgeProps, Tone } from './core/Badge';
export { Tag } from './core/Tag';
export type { TagProps } from './core/Tag';
export { Card } from './core/Card';
export type { CardProps, CardTone } from './core/Card';
export { Stat } from './core/Stat';
export type { StatProps } from './core/Stat';

/* --- forms --------------------------------------------------------------- */
export { RangeSlider } from './forms/RangeSlider';
export type { RangeSliderProps, RangeTick } from './forms/RangeSlider';
export { SegmentedControl } from './forms/SegmentedControl';
export type { SegmentedControlProps, SegmentedOption } from './forms/SegmentedControl';
export { Switch } from './forms/Switch';
export type { SwitchProps } from './forms/Switch';
export { Checkbox } from './forms/Checkbox';
export type { CheckboxProps } from './forms/Checkbox';
export { Select } from './forms/Select';
export type { SelectProps, SelectOption } from './forms/Select';
export { Input } from './forms/Input';
export type { InputProps } from './forms/Input';

/* --- feedback ------------------------------------------------------------ */
export { Toast } from './feedback/Toast';
export type { ToastProps } from './feedback/Toast';
export { Dialog } from './feedback/Dialog';
export type { DialogProps } from './feedback/Dialog';
export { SafetyNotice } from './feedback/SafetyNotice';
export type { SafetyLevel, SafetyNoticeProps } from './feedback/SafetyNotice';
export { Tooltip } from './feedback/Tooltip';
export type { TooltipProps } from './feedback/Tooltip';
export { ErrorBoundary } from './feedback/ErrorBoundary';
export type { ErrorBoundaryProps } from './feedback/ErrorBoundary';

/* --- navigation ---------------------------------------------------------- */
export { BackTopBar, TopBar } from './navigation/TopBar';
export type { BackTopBarProps, TopBarProps } from './navigation/TopBar';
export { SiteHeader } from './navigation/SiteHeader';
export type { SiteHeaderProps, SiteLink } from './navigation/SiteHeader';
export { TabBar } from './navigation/TabBar';
export type { TabBarItem, TabBarProps } from './navigation/TabBar';
export { Tabs } from './navigation/Tabs';
export type { TabItem, TabsProps } from './navigation/Tabs';

/* --- eclipse ------------------------------------------------------------- */
export { Countdown } from './eclipse/Countdown';
export type { CountdownProps } from './eclipse/Countdown';
export { VisibilityMeter } from './eclipse/VisibilityMeter';
export type { VisibilityMeterProps, VisibilityState } from './eclipse/VisibilityMeter';
export { TipCard } from './eclipse/TipCard';
export type { TipCardProps } from './eclipse/TipCard';
export { PhaseDial } from './eclipse/PhaseDial';
export type { PhaseDialProps } from './eclipse/PhaseDial';
export { TimelineTrack } from './eclipse/TimelineTrack';
export type { TimelineContact, TimelineTrackProps } from './eclipse/TimelineTrack';

/* --- mides d'icona ------------------------------------------------------- */
export { ICON_XS, ICON_SM, ICON_MD, ICON_LG } from './sizes';
export { useMediaQuery } from './useMediaQuery';
