/** Text de les visualitzacions; els models purs no coneixen cap idioma. */

import type { Locale } from '../../i18n';

const TEXT = {
  'fingerprint.title': { ca: 'L’empremta del teu eclipsi', es: 'La huella de tu eclipse', en: 'Your eclipse fingerprint' },
  'fingerprint.measured': { ca: 'Relleu mesurat · orientada al nord', es: 'Relieve medido · orientada al norte', en: 'Terrain measured · north at the top' },
  'fingerprint.assumed': { ca: 'Relleu pendent · horitzó provisional', es: 'Relieve pendiente · horizonte provisional', en: 'Terrain pending · provisional horizon' },
  'fingerprint.central': { ca: 'fase central visible', es: 'fase central visible', en: 'central phase visible' },
  'fingerprint.partial': { ca: 'Sol ocultat', es: 'Sol ocultado', en: 'Sun obscured' },
  'fingerprint.shape.measured': {
    ca: 'El contorn és el teu horitzó real en 360°: cada entrant és relleu que tens al voltant.',
    es: 'El contorno es tu horizonte real en 360°: cada entrante es relieve que tienes alrededor.',
    en: 'The outline is your actual 360° horizon: every indentation represents the terrain around you.',
  },
  'fingerprint.shape.assumed': {
    ca: 'El contorn blau discontinu és provisional. Quan acabi el càlcul, el substituirà la silueta real del teu horitzó.',
    es: 'El contorno azul discontinuo es provisional. Cuando termine el cálculo, lo sustituirá la silueta real de tu horizonte.',
    en: 'The dashed blue outline is provisional. Once the calculation finishes, it will be replaced by the actual silhouette of your horizon.',
  },
  'fingerprint.arc.central': {
    ca: 'L’arc exterior indica quina part de la fase central queda visible després de descomptar el relleu.',
    es: 'El arco exterior indica qué parte de la fase central queda visible después de descontar el relieve.',
    en: 'The outer arc shows how much of the central phase remains visible after accounting for the terrain.',
  },
  'fingerprint.arc.partial': {
    ca: 'L’arc exterior indica quina part de l’àrea del Sol quedarà tapada al màxim.',
    es: 'El arco exterior indica qué parte del área del Sol quedará tapada en el máximo.',
    en: 'The outer arc shows how much of the Sun’s area will be covered at maximum eclipse.',
  },
  'fingerprint.arc.pending': {
    ca: 'L’arc visible apareixerà quan sapiguem quanta fase central sobreviu al relleu.',
    es: 'El arco visible aparecerá cuando sepamos cuánta fase central sobrevive al relieve.',
    en: 'The visible arc will appear once we know how much of the central phase remains visible above the terrain.',
  },
  'fingerprint.discs.total': {
    ca: 'Al centre, la Lluna cobreix completament el Sol: les dues mides aparents estan dibuixades a escala.',
    es: 'En el centro, la Luna cubre completamente el Sol: los dos tamaños aparentes están dibujados a escala.',
    en: 'At the centre, the Moon completely covers the Sun: their apparent sizes are drawn to scale.',
  },
  'fingerprint.discs.annular': {
    ca: 'Al centre, la Lluna és més petita que el Sol i deixa l’anell visible; les mides estan dibuixades a escala.',
    es: 'En el centro, la Luna es más pequeña que el Sol y deja visible el anillo; los tamaños están dibujados a escala.',
    en: 'At the centre, the Moon is smaller than the Sun and leaves the ring visible; their sizes are drawn to scale.',
  },
  'fingerprint.discs.partial': {
    ca: 'Al centre, els discs mostren la cobertura màxima a escala; no representen una totalitat.',
    es: 'En el centro, los discos muestran la cobertura máxima a escala; no representan una totalidad.',
    en: 'At the centre, the discs show maximum coverage to scale; they do not represent totality.',
  },
  'fingerprint.direction': {
    ca: 'El punt blau marca la direcció del Sol al màxim; la part superior del cercle és el nord.',
    es: 'El punto azul marca la dirección del Sol en el máximo; la parte superior del círculo es el norte.',
    en: 'The blue dot marks the Sun’s direction at maximum eclipse; the top of the circle is north.',
  },
  'shadow.title': { ca: 'L’ombra que s’acosta', es: 'La sombra que se acerca', en: 'The approaching shadow' },
  'shadow.annularTitle': { ca: 'L’ombra central que s’acosta', es: 'La sombra central que se acerca', en: 'The approaching central shadow' },
  'shadow.from': { ca: 'Arriba de', es: 'Llega desde', en: 'Arrives from' },
  'shadow.speed': { ca: 'Velocitat', es: 'Velocidad', en: 'Speed' },
  'shadow.watch': { ca: 'Mira-hi des de', es: 'Mira desde las', en: 'Start watching at' },
  'shadow.fast': { ca: 'molt ràpida', es: 'muy rápida', en: 'very fast' },
  'shadow.low': { ca: 'Amb el Sol tan baix, la paret d’ombra es confondrà amb el capvespre.', es: 'Con el Sol tan bajo, la pared de sombra se confundirá con el crepúsculo.', en: 'With the Sun this low, the wall of shadow will blend into the twilight.' },
  'shadow.explain.total': {
    ca: 'La zona fosca representa la paret d’ombra de la Lluna. La fletxa blava assenyala d’on arribarà fins al teu punt.',
    es: 'La zona oscura representa la pared de sombra de la Luna. La flecha azul señala desde dónde llegará hasta tu punto.',
    en: 'The dark area represents the Moon’s wall of shadow. The blue arrow shows the direction it will come from as it reaches your location.',
  },
  'shadow.explain.annular': {
    ca: 'És el pas de l’antombra, no una nit sobtada: la Lluna quedarà davant del Sol però en deixarà visible l’anell.',
    es: 'Es el paso de la antumbra, no una noche repentina: la Luna quedará delante del Sol pero dejará visible el anillo.',
    en: 'This is the antumbra passing over, not sudden nightfall: the Moon will move in front of the Sun but leave its ring visible.',
  },
  'shadow.explain.before': {
    ca: 'El dibuix es manté quiet fins vint segons abans de C2. Llavors avançarà amb el mateix rellotge que els avisos.',
    es: 'El dibujo se mantiene quieto hasta veinte segundos antes de C2. Entonces avanzará con el mismo reloj que los avisos.',
    en: 'The display remains still until twenty seconds before C2. It will then advance using the same clock as the alerts.',
  },
  'shadow.explain.approaching': {
    ca: 'Ara la zona fosca avança cap al centre: representa els segons que falten perquè l’ombra arribi al teu punt.',
    es: 'Ahora la zona oscura avanza hacia el centro: representa los segundos que faltan para que la sombra llegue a tu punto.',
    en: 'The dark area is now moving towards the centre, showing the seconds remaining until the shadow reaches your location.',
  },
  'shadow.explain.arrived': {
    ca: 'L’ombra ja ha arribat al teu punt; la direcció continua indicant l’horitzó per on l’has vista venir.',
    es: 'La sombra ya ha llegado a tu punto; la dirección sigue indicando el horizonte por donde la has visto venir.',
    en: 'The shadow has reached your location; the direction still indicates the part of the horizon where you saw it approach.',
  },
  'shadow.explain.diverging': {
    ca: 'Prop del terminador la velocitat calculada tendeix a infinit i deixa de ser útil. Per això es diu “molt ràpida” i no una xifra enganyosa.',
    es: 'Cerca del terminador la velocidad calculada tiende a infinito y deja de ser útil. Por eso se indica “muy rápida” y no una cifra engañosa.',
    en: 'Near the terminator, the calculated speed tends towards infinity and ceases to be useful. That is why it says “very fast” instead of showing a misleading figure.',
  },
  'band.title': { ca: 'La teva posició dins la franja', es: 'Tu posición dentro de la franja', en: 'Your position within the path' },
  'band.north': { ca: 'Nord', es: 'Norte', en: 'North' },
  'band.south': { ca: 'Sud', es: 'Sur', en: 'South' },
  'band.center': { ca: 'Línia central', es: 'Línea central', en: 'Centre line' },
  'band.here': { ca: 'Tu', es: 'Tú', en: 'You' },
  'band.inside': { ca: 'Dins de la franja', es: 'Dentro de la franja', en: 'Inside the path' },
  'band.outside': { ca: 'Fora de la franja', es: 'Fuera de la franja', en: 'Outside the path' },
  'band.edge': { ca: 'La trama marca la zona on el límit és incert.', es: 'La trama marca la zona donde el límite es incierto.', en: 'The hatched area marks where the boundary is uncertain.' },
} as const;

export type VisualStringKey = keyof typeof TEXT;
export function vs(key: VisualStringKey, locale: Locale): string {
  return TEXT[key][locale];
}
