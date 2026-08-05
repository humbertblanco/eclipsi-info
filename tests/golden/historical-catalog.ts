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
      en: 'Total solar eclipse of 21 August 2017 (USA)',
      fr: 'Éclipse totale de Soleil du 21 août 2017 (États-Unis)',
    },
    spain: {
      ca: 'No visible des d’Espanya. Només per a validació del motor.',
      es: 'No visible desde España. Solo para validación del motor.',
      en: 'Not visible from Spain. Used only for engine validation.',
      fr: 'Non visible depuis l’Espagne. Utilisée uniquement pour valider le moteur.',
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
      en: 'Total solar eclipse of 8 April 2024 (Mexico, USA, Canada)',
      fr: 'Éclipse totale de Soleil du 8 avril 2024 (Mexique, États-Unis, Canada)',
    },
    spain: {
      ca: 'No visible des d’Espanya. Només per a validació del motor.',
      es: 'No visible desde España. Solo para validación del motor.',
      en: 'Not visible from Spain. Used only for engine validation.',
      fr: 'Non visible depuis l’Espagne. Utilisée uniquement pour valider le moteur.',
    },
    saros: 139,
    lowSunOverSpain: false,
  },
];
