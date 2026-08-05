import type { Locale } from '../../i18n';

export type SeoText = Readonly<Record<Locale, string>>;

export interface SeoCity {
  id: string;
  name: SeoText;
  lat: number;
  lon: number;
  region: SeoText;
  /** Only editorial context that is stable and independently verifiable. */
  context: SeoText;
}
