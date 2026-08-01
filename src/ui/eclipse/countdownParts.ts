/**
 * Com es reparteix i com s'escurça un compte enrere.
 *
 * VIU FORA DEL COMPONENT per dues raons. La primera és que és lògica pura, i
 * així es pot provar sense DOM, que és com corre la bateria d'aquest projecte.
 * La segona és que un fitxer que exporta components I funcions trenca la
 * recàrrega en calent de Vite.
 */

export interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function split(totalMs: number): Parts {
  const total = Math.floor(Math.abs(totalMs) / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export const pad = (value: number) => String(value).padStart(2, '0');



/**
 * Quines tres unitats es pinten.
 *
 * SEMPRE TRES, I NO QUATRE. Amb dies a sobre sortien «11 d 04 h 23 min 15 s»:
 * a 32 px de mono en una pantalla de 390 px, allò no hi cap i se n'anava fora
 * de la caixa. I no és només una qüestió d'amplada: a onze dies vista, un
 * comptador que canvia cada segon és soroll que es mou, i els segons no
 * informen de res que l'usuari pugui fer servir. Es cauen sols quan deixen de
 * dir res i tornen quan tornen a importar.
 *
 *   dies    →  d · h · min      (i el rellotge batega cada minut)
 *   hores   →  h · min · s
 *   la resta →  min · s
 */
export type Unit = 'd' | 'h' | 'min' | 's';

export const UNIT_FIELD: Record<Unit, keyof Parts> = {
  d: 'days',
  h: 'hours',
  min: 'minutes',
  s: 'seconds',
};

export function unitsFor(parts: Parts): Unit[] {
  if (parts.days > 0) return ['d', 'h', 'min'];
  if (parts.hours > 0) return ['h', 'min', 's'];
  return ['min', 's'];
}

/** Vegeu `useClock` a `Countdown.tsx`: el ritme segueix la unitat més petita. */
export const MINUTE_MS = 60_000;
export const DAY_MS = 86_400_000;
