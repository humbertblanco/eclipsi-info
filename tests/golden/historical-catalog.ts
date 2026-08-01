/**
 * Entrades de catàleg NOMÉS per als tests: dos eclipsis passats i ben
 * documentats que serveixen de control independent del motor.
 *
 * Per què viuen aquí i no a `src/core/eclipses/catalog.ts`: aquell fitxer és de
 * producció i ha de contenir exactament els tres eclipsis d'Espanya que la
 * webapp ensenya. Afegir-hi el 2017 i el 2024 faria aparèixer dos eclipsis
 * americans al selector de la interfície.
 *
 * `historical.test.ts` injecta aquestes entrades amb `vi.mock()` sobre el mòdul
 * del catàleg, de manera que `computeLocalCircumstances()` — el codi de
 * producció, sense cap modificació — es pot executar contra el 2017 i el 2024.
 *
 * Instants de màxim eclipsi global: Five Millennium Canon de la NASA/GSFC.
 */

import type { EclipseEntry } from '../../src/core/eclipses/catalog';

export const HISTORICAL_ECLIPSES: EclipseEntry[] = [
  {
    id: '2017-08-21',
    greatestEclipseUtc: '2017-08-21T18:26:40Z',
    kind: 'total',
    label: {
      ca: 'Eclipsi total del 21 d’agost de 2017 (EUA)',
      es: 'Eclipse total del 21 de agosto de 2017 (EE. UU.)',
    },
    spain: {
      ca: 'No visible des d’Espanya. Només per a validació del motor.',
      es: 'No visible desde España. Solo para validación del motor.',
    },
    saros: 145,
    lowSunOverSpain: false,
  },
  {
    id: '2024-04-08',
    greatestEclipseUtc: '2024-04-08T18:17:16Z',
    kind: 'total',
    label: {
      ca: 'Eclipsi total del 8 d’abril de 2024 (Mèxic, EUA, Canadà)',
      es: 'Eclipse total del 8 de abril de 2024 (México, EE. UU., Canadá)',
    },
    spain: {
      ca: 'No visible des d’Espanya. Només per a validació del motor.',
      es: 'No visible desde España. Solo para validación del motor.',
    },
    saros: 139,
    lowSunOverSpain: false,
  },
];
