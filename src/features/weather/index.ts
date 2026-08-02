/** API pública de la funcionalitat de nuvolositat, per al coordinador. */

export { CloudPanel } from './CloudPanel';
export type { CloudPanelProps } from './CloudPanel';
export { useCloudOutlook } from './useCloudOutlook';
export type { UseCloudOutlookParams, UseCloudOutlookResult } from './useCloudOutlook';
/*
 * Els textos surten perquè la pantalla que munta el panell n'ha de poder dir
 * el títol —a la pestanya, a un desplegable o a una capçalera— sense
 * reescriure'l pel seu compte, que és com es fabriquen dues traduccions del
 * mateix mot.
 */
export { ws } from './strings';
export type { WeatherStringKey } from './strings';
