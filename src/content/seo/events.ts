import type { Locale } from '../../i18n';

export interface SeoEventWindow {
  start: string;
  end: string;
  area: Readonly<Record<Locale, string>>;
}

/** Interval global del fenomen; les hores locals es calculen punt per punt. */
export const SEO_EVENT_WINDOWS: Readonly<Record<string, SeoEventWindow>> = {
  '2026-08-12': { start:'2026-08-12T17:34:00Z', end:'2026-08-12T19:38:00Z', area:{ca:'Islàndia i nord d’Espanya',es:'Islandia y norte de España',en:'Iceland and northern Spain',fr:'Islande et nord de l’Espagne'} },
  '2027-08-02': { start:'2027-08-02T07:30:00Z', end:'2027-08-02T12:04:00Z', area:{ca:'Sud d’Espanya i nord d’Àfrica',es:'Sur de España y norte de África',en:'Southern Spain and North Africa',fr:'Sud de l’Espagne et Afrique du Nord'} },
  '2028-01-26': { start:'2028-01-26T13:10:00Z', end:'2028-01-26T17:00:00Z', area:{ca:'Península Ibèrica',es:'Península ibérica',en:'Iberian Peninsula',fr:'Péninsule Ibérique'} },
};
