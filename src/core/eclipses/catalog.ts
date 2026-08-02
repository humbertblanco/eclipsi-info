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
  /**
   * Consells propis d'aquest eclipsi, per ensenyar-los al costat de les xifres
   * calculades del punt de l'usuari.
   *
   * SÓN QUALITATIUS I HO HAN DE SEGUIR SENT. La regla d'aquest fitxer és que
   * tot el que és local es calcula i no es llegeix d'aquí: si un consell digués
   * «el Sol serà a 4,5°» o «tindràs 96 s», seria una xifra de catàleg competint
   * amb la que el motor calcula per a les coordenades de qui llegeix, i quan
   * les dues no coincideixin —que és el cas normal, perquè aquestes xifres
   * canvien cada pocs quilòmetres— la de catàleg semblaria la bona per estar
   * escrita amb lletra. Aquí només hi va el que és cert per a tothom: quin
   * dels tres és el fàcil, quin no permet mai treure's el filtre i quin es
   * juga amb l'horitzó.
   *
   * Res del que hi ha aquí autoritza a mirar sense filtre. L'única frase que ho
   * pot dir surt de `canRemoveFilter` (`core/timer/safety.ts`); vegeu-hi el
   * comentari de capçalera.
   *
   * ÉS OPCIONAL, I NO PER COMODITAT. Aquest camp és CONTINGUT, no física, i
   * `EclipseEntry` es fa servir en llocs on el contingut no existeix ni hi ha
   * de ser: `tests/golden/historical-catalog.ts` construeix entrades del 2017 i
   * del 2024 per validar el motor contra eclipsis ja passats, i un eclipsi que
   * ja s'ha vist no necessita consells per anar-lo a veure. Fer-lo obligatori
   * els demanava tres frases inventades a cada entrada de validació — text mort
   * que ningú no llegiria i que igualment caldria traduir. Qui el pinti ha
   * d'aguantar que no hi sigui.
   */
  tips?: { ca: string[]; es: string[] };
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
    tips: {
      ca: [
        'Aquest es juga amb l’horitzó. Amb el Sol tan baix, el que decideix què veuràs no és el mapa de la franja sinó el que tinguis a ponent: una carena discreta pot valer més que cent quilòmetres de cotxe en la direcció equivocada.',
        'Comprova l’horitzó sobre el terreny, i abans del dia mateix. Una foto del skyline de ponent des del punt exacte on penses plantar-te val més que qualsevol previsió.',
        'Arran d’horitzó, la calitja i els núvols baixos fan la mateixa feina que una muntanya. Val la pena tenir un pla B a poca distància i cap a un altre horitzó.',
      ],
      es: [
        'Este se juega con el horizonte. Con el Sol tan bajo, lo que decide qué verás no es el mapa de la franja sino lo que tengas a poniente: una loma discreta puede valer más que cien kilómetros de coche en la dirección equivocada.',
        'Comprueba el horizonte sobre el terreno, y antes del día mismo. Una foto del skyline de poniente desde el punto exacto donde piensas plantarte vale más que cualquier previsión.',
        'A ras de horizonte, la calima y las nubes bajas hacen el mismo trabajo que una montaña. Vale la pena tener un plan B a poca distancia y hacia otro horizonte.',
      ],
    },
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
    tips: {
      ca: [
        'És el fàcil dels tres: passa al matí i amb el Sol alt, o sigui que el relleu de l’horitzó deixa de manar i el que decideix és el cel que faci.',
        'Amb el Sol alt miraràs cap amunt molta estona. Una cadira reclinable i una ròtula de trípode amb prou joc són la diferència entre gaudir-ho i acabar amb el coll bloquejat.',
        'Aquí sí que compensa moure’s per la previsió meteorològica: dins de la franja, qualsevol punt serveix igual de bé, cosa que als altres dos no passa.',
      ],
      es: [
        'Es el fácil de los tres: ocurre por la mañana y con el Sol alto, así que el relieve del horizonte deja de mandar y lo que decide es el cielo que haga.',
        'Con el Sol alto mirarás hacia arriba mucho rato. Una silla reclinable y una rótula de trípode con suficiente juego son la diferencia entre disfrutarlo y acabar con el cuello bloqueado.',
        'Aquí sí compensa moverse por la previsión meteorológica: dentro de la franja, cualquier punto sirve igual de bien, cosa que en los otros dos no pasa.',
      ],
    },
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
    tips: {
      ca: [
        'És anular: el que queda a la vista quan la Lluna és al mig del Sol és un anell de fotosfera. No hi ha cap instant d’aquest eclipsi en què es pugui mirar sense filtre certificat, ni tan sols dins de l’anularitat.',
        'No s’assemblarà a una totalitat. La llum baixa i es torna metàl·lica, però no es fa fosc, no surt la corona i no s’encenen les estrelles: qui hi vagi esperant l’altra cosa en tornarà decebut.',
        'A canvi, l’anell aguanta minuts sencers i és estable. És l’eclipsi dels tres on hi ha temps de sobres per provar filtres, projecció amb uns prismàtics i enquadraments, en comptes de jugar-s’ho tot en un minut.',
      ],
      es: [
        'Es anular: lo que queda a la vista cuando la Luna está en medio del Sol es un anillo de fotosfera. No hay ningún instante de este eclipse en el que se pueda mirar sin filtro certificado, ni siquiera dentro de la anularidad.',
        'No se parecerá a una totalidad. La luz baja y se vuelve metálica, pero no oscurece, no sale la corona y no se encienden las estrellas: quien vaya esperando la otra cosa volverá decepcionado.',
        'A cambio, el anillo aguanta minutos enteros y es estable. Es el eclipse de los tres donde sobra tiempo para probar filtros, proyección con unos prismáticos y encuadres, en vez de jugárselo todo en un minuto.',
      ],
    },
  },
];

export function getEclipse(id: string): EclipseEntry {
  const entry = ECLIPSES.find((e) => e.id === id);
  if (!entry) throw new Error(`Eclipsi desconegut: ${id}`);
  return entry;
}
