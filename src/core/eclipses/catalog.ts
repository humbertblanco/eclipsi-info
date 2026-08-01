/**
 * Catàleg d'eclipsis. Les dades globals (instant de màxim eclipsi, tipus, saros)
 * venen del Five Millennium Canon de la NASA/GSFC — Fred Espenak.
 *
 * Aquí NOMÉS hi ha el context global de cada eclipsi, que serveix per centrar
 * la finestra de cerca dels contactes. Tot el que és local (hores, magnitud,
 * durada, altura del Sol) es calcula per coordenada, mai es llegeix d'aquí.
 */

export interface EclipseEntry {
  id: string;
  /** Instant de màxim eclipsi global, en UTC. Centra la finestra de cerca. */
  greatestEclipseUtc: string;
  kind: 'total' | 'annular';
  /** Etiquetes multilingües per a la interfície. */
  label: { ca: string; es: string };
  /** Resum de la franja sobre territori espanyol. */
  spain: { ca: string; es: string };
  /** Sèrie de Saros. */
  saros: number;
  /**
   * Cert si la fase central passa amb el Sol molt baix a Espanya, cosa que fa
   * que el perfil d'horitzó sigui decisiu. Activa els avisos corresponents.
   */
  lowSunOverSpain: boolean;
}

export const ECLIPSES: EclipseEntry[] = [
  {
    id: '2026-08-12',
    greatestEclipseUtc: '2026-08-12T17:46:00Z',
    kind: 'total',
    label: {
      ca: 'Eclipsi total del 12 d’agost de 2026',
      es: 'Eclipse total del 12 de agosto de 2026',
    },
    spain: {
      ca: 'Franja de NO a SE: Galícia, Astúries, Lleó, Burgos, Sòria, Saragossa, Peníscola i Balears. Al capvespre, amb el Sol entre 12° i 1° sobre l’horitzó.',
      es: 'Franja de NO a SE: Galicia, Asturias, León, Burgos, Soria, Zaragoza, Peñíscola y Baleares. Al atardecer, con el Sol entre 12° y 1° sobre el horizonte.',
    },
    saros: 126,
    lowSunOverSpain: true,
  },
  {
    id: '2027-08-02',
    greatestEclipseUtc: '2027-08-02T10:07:50Z',
    kind: 'total',
    label: {
      ca: 'Eclipsi total del 2 d’agost de 2027',
      es: 'Eclipse total del 2 de agosto de 2027',
    },
    spain: {
      ca: 'Franja per l’estret de Gibraltar: Cadis, Màlaga, Ceuta i Melilla. Al matí i amb el Sol alt — l’eclipsi fàcil dels tres.',
      es: 'Franja por el estrecho de Gibraltar: Cádiz, Málaga, Ceuta y Melilla. Por la mañana y con el Sol alto — el eclipse fácil de los tres.',
    },
    saros: 136,
    lowSunOverSpain: false,
  },
  {
    id: '2028-01-26',
    greatestEclipseUtc: '2028-01-26T15:08:59Z',
    kind: 'annular',
    label: {
      ca: 'Eclipsi anular del 26 de gener de 2028',
      es: 'Eclipse anular del 26 de enero de 2028',
    },
    spain: {
      ca: 'Franja de SO a NE: Sevilla, Màlaga, Múrcia i València. A Barcelona i Palma el Sol es pon durant l’anularitat.',
      es: 'Franja de SO a NE: Sevilla, Málaga, Murcia y Valencia. En Barcelona y Palma el Sol se pone durante la anularidad.',
    },
    saros: 141,
    lowSunOverSpain: true,
  },
];

export function getEclipse(id: string): EclipseEntry {
  const entry = ECLIPSES.find((e) => e.id === id);
  if (!entry) throw new Error(`Eclipsi desconegut: ${id}`);
  return entry;
}
