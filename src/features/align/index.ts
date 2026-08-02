/**
 * Alineació Sol–element: on plantar-se perquè el Sol quedi damunt d'un cim.
 *
 * Es carrega amb `React.lazy` des de `MapScreen`: arrossega el seu Worker i
 * tot `core/spots/alignment`, i qui no obri la vista no ho ha de pagar.
 */

export { AlignPanel } from './AlignPanel';
export type { AlignPanelProps } from './AlignPanel';
export { useAlignment } from './useAlignment';
export type {
  AlignmentStatus,
  UseAlignmentParams,
  UseAlignmentResult,
} from './useAlignment';
export { al } from './strings';
export type { AlignStringKey } from './strings';
