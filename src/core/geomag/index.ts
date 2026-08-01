/**
 * Geomagnetisme: converteix el nord magnètic que dona la brúixola del mòbil en
 * el nord geogràfic que fa servir tota la resta de l'aplicació.
 */

export {
  declination,
  magneticToTrueHeading,
  trueAzimuth,
  MAGNETIC_DECLINATION_UNAVAILABLE,
  type DeclinationResult,
  type DeclinationStatus,
} from './declination';
export { magneticField, decimalYear, type MagneticField } from './wmm';
export { WMM_EPOCH, WMM_VALID_FROM, WMM_VALID_TO } from './wmm2025';
