import type { Locale } from '../../i18n';
import type { SeoOutcome } from './verdict';

export const SEO_LOCALES: readonly Locale[] = ['ca', 'es', 'en', 'fr'];
export const SEO_SITE = 'https://eclipsi.info/';

export function prefix(locale: Locale): string { return locale === 'ca' ? '' : `${locale}/`; }

const TEXT = {
  ca: { eclipse:'Eclipsi', city:'Eclipsi a', point:'Punt oficial', home:'Inici', cities:'Ciutats', points:'Punts oficials', guides:'Guies pràctiques', conjunction:'i', calculate:'Calcula-ho al punt exacte', source:'Font oficial', coords:'Coordenades', elevation:'Altitud publicada', climatology:'Climatologia local', skyScore:'Índex històric de cel favorable', clearYears:'Mostres amb cel favorable', cloudyYears:'Mostres amb cel molt tapat', climCaveat:'És climatologia històrica d’Open-Meteo, NO una previsió del dia de l’eclipsi.', central:'fase central', partial:'eclipsi parcial', maximum:'Màxim', duration:'Durada de la fase central', obscuration:'Disc solar tapat', sun:'Altura del Sol al màxim', noCentral:'Sense fase central en aquest punt', related:'També et pot interessar', intro:'Horaris i visibilitat calculats per a aquest punt amb el motor topocèntric d’eclipsi.info.', disclaimer:'El relleu, els edificis i els núvols poden canviar el que veuràs. Obre el simulador per calcular l’horitzó real.', official:'Aquest emplaçament consta al catàleg publicat per l’administració indicada.', estimated:'La font publica el lloc però no una coordenada exacta; la posició del mapa és estimada.', exact:'Coordenada publicada per la font.', event:'Activitat amb entrada o reserva segons la convocatòria original.', observatory:'Observatori o planetari amb activitat anunciada.', openSite:'Punt d’observació oficial d’accés lliure segons la font.' },
  es: { eclipse:'Eclipse', city:'Eclipse en', point:'Punto oficial', home:'Inicio', cities:'Ciudades', points:'Puntos oficiales', guides:'Guías prácticas', conjunction:'y', calculate:'Calcúlalo en el punto exacto', source:'Fuente oficial', coords:'Coordenadas', elevation:'Altitud publicada', climatology:'Climatología local', skyScore:'Índice histórico de cielo favorable', clearYears:'Muestras con cielo favorable', cloudyYears:'Muestras con cielo muy cubierto', climCaveat:'Es climatología histórica de Open-Meteo, NO una previsión para el día del eclipse.', central:'fase central', partial:'eclipse parcial', maximum:'Máximo', duration:'Duración de la fase central', obscuration:'Disco solar cubierto', sun:'Altura del Sol en el máximo', noCentral:'Sin fase central en este punto', related:'También te puede interesar', intro:'Horarios y visibilidad calculados para este punto con el motor topocéntrico de eclipsi.info.', disclaimer:'El relieve, los edificios y las nubes pueden cambiar lo que verás. Abre el simulador para calcular el horizonte real.', official:'Este emplazamiento figura en el catálogo publicado por la administración indicada.', estimated:'La fuente publica el lugar, pero no una coordenada exacta; la posición del mapa es estimada.', exact:'Coordenada publicada por la fuente.', event:'Actividad con entrada o reserva según la convocatoria original.', observatory:'Observatorio o planetario con actividad anunciada.', openSite:'Punto oficial de observación de acceso libre según la fuente.' },
  en: { eclipse:'Eclipse', city:'Eclipse in', point:'Official viewing site', home:'Home', cities:'Cities', points:'Official sites', guides:'Practical guides', conjunction:'and', calculate:'Calculate your exact point', source:'Official source', coords:'Coordinates', elevation:'Published elevation', climatology:'Local climatology', skyScore:'Historical favourable-sky score', clearYears:'Samples with favourable sky', cloudyYears:'Samples with heavy cloud', climCaveat:'This is historical Open-Meteo climatology, NOT a forecast for eclipse day.', central:'central phase', partial:'partial eclipse', maximum:'Maximum', duration:'Central phase duration', obscuration:'Solar disc covered', sun:'Sun altitude at maximum', noCentral:'No central phase at this point', related:'Related pages', intro:'Times and visibility calculated for this point with eclipsi.info’s topocentric engine.', disclaimer:'Terrain, buildings and clouds can change what you see. Open the simulator to calculate the real horizon.', official:'This location appears in the catalogue published by the named public authority.', estimated:'The source names the place but gives no exact coordinates; its map position is estimated.', exact:'Coordinates published by the source.', event:'Ticket or reservation required according to the original announcement.', observatory:'Observatory or planetarium with an announced activity.', openSite:'Official free-access viewing site according to the source.' },
  fr: { eclipse:'Éclipse', city:'Éclipse à', point:'Site officiel', home:'Accueil', cities:'Villes', points:'Sites officiels', guides:'Guides pratiques', conjunction:'et', calculate:'Calculer votre point exact', source:'Source officielle', coords:'Coordonnées', elevation:'Altitude publiée', climatology:'Climatologie locale', skyScore:'Indice historique de ciel favorable', clearYears:'Échantillons avec ciel favorable', cloudyYears:'Échantillons avec ciel très couvert', climCaveat:'Il s’agit de climatologie historique Open-Meteo, PAS d’une prévision pour le jour de l’éclipse.', central:'phase centrale', partial:'éclipse partielle', maximum:'Maximum', duration:'Durée de la phase centrale', obscuration:'Disque solaire couvert', sun:'Hauteur du Soleil au maximum', noCentral:'Aucune phase centrale en ce point', related:'À voir aussi', intro:'Horaires et visibilité calculés pour ce point avec le moteur topocentrique d’eclipsi.info.', disclaimer:'Le relief, les bâtiments et les nuages peuvent modifier ce que vous verrez. Ouvrez le simulateur pour calculer l’horizon réel.', official:'Ce site figure dans le catalogue publié par l’autorité indiquée.', estimated:'La source nomme le lieu sans fournir de coordonnées exactes ; sa position sur la carte est estimée.', exact:'Coordonnées publiées par la source.', event:'Billet ou réservation requis selon l’annonce originale.', observatory:'Observatoire ou planétarium avec activité annoncée.', openSite:'Site officiel d’observation en accès libre selon la source.' },
} as const;

export function seoStrings(locale: Locale) { return TEXT[locale]; }

/* ═══════════════════════════════════════════════════════════════════════════
   EL VEREDICTE DEL PUNT, EN PARAULES

   Aquí baixen els codis de `verdict.ts` a frases. És l'única capa que sap en
   quin idioma es parla, i per això l'ha de tenir tota: si una forma existís en
   català i no en francès, la pàgina francesa cauria cap al text genèric i
   ningú no ho veuria fins que algú la llegís.

   LA XIFRA I LA UNITAT VAN SEPARADES a posta. La xifra és l'accent ambre de la
   pàgina —l'únic— i es compon amb la tipografia de dades; la unitat, no. Si
   arribessin com una sola cadena («48,3 s de totalitat») no es podrien pintar
   diferent sense tornar a partir el text, que és com es trenquen les
   traduccions.

   PER QUÈ EL TÍTOL PORTA LA XIFRA. Perquè el títol és el que Google ensenya, i
   «Eclipsi 2026 a Barcelona: 99,8 % del disc tapat» diu la veritat i alhora
   respon la pregunta abans del clic. El que hi havia deia «Eclipsi total 2026 a
   Barcelona», que no és cert, i no deia cap número.
   ═══════════════════════════════════════════════════════════════════════════ */


/** Les tres peces del veredicte: la xifra, la seva unitat i la conseqüència. */
export interface SeoVerdictCopy {
  /** El número, ja formatat per l'idioma. Al caire i sense eclipsi, una paraula. */
  figure: string;
  /** Què mesura la xifra. Va sota, en to secundari. */
  unit: string;
  /** Una frase que digui què vol dir això per a qui hi vagi. */
  sentence: string;
  /** Fragment que s'insereix al `<title>` i a la descripció. */
  summary: string;
}

interface VerdictValues {
  /** Durada de la fase central, ja formatada («48,3»). */
  duration: string;
  /** Percentatge de disc tapat, ja formatat («99,8»). */
  obscuration: string;
  /** Cert si la fase central és una totalitat; fals si és una anularitat. */
  total: boolean;
}

export function seoVerdict(
  locale: Locale,
  outcome: SeoOutcome,
  values: VerdictValues,
): SeoVerdictCopy {
  const central = {
    ca: values.total ? 'de totalitat' : 'd’anularitat',
    es: values.total ? 'de totalidad' : 'de anularidad',
    en: values.total ? 'of totality' : 'of annularity',
    fr: values.total ? 'de totalité' : 'd’annularité',
  }[locale];

  if (outcome === 'central') {
    return {
      figure: `${values.duration} s`,
      unit: central,
      sentence: {
        ca: values.total
          ? `Des d’aquest punt la totalitat és visible: el disc solar queda tapat del tot durant ${values.duration} segons. És l’únic interval en què el filtre es pot retirar, i s’ha de tornar a posar abans que reaparegui el Sol.`
          : `Des d’aquest punt la Lluna queda dins del disc solar i en deixa un anell encès durant ${values.duration} segons. L’anell és fotosfera: el filtre no es pot treure en cap moment.`,
        es: values.total
          ? `Desde este punto la totalidad es visible: el disco solar queda tapado por completo durante ${values.duration} segundos. Es el único intervalo en que el filtro puede retirarse, y hay que volver a ponerlo antes de que reaparezca el Sol.`
          : `Desde este punto la Luna queda dentro del disco solar y deja un anillo encendido durante ${values.duration} segundos. El anillo es fotosfera: el filtro no se puede quitar en ningún momento.`,
        en: values.total
          ? `Totality is visible from here: the solar disc is fully covered for ${values.duration} seconds. That is the only interval when the filter may come off, and it must go back on before sunlight returns.`
          : `The Moon sits inside the solar disc from here, leaving a bright ring for ${values.duration} seconds. The ring is photosphere: the filter never comes off.`,
        fr: values.total
          ? `La totalité est visible depuis ce point : le disque solaire est entièrement couvert pendant ${values.duration} secondes. C’est le seul intervalle où le filtre peut être retiré, et il doit être remis avant le retour du Soleil.`
          : `Depuis ce point, la Lune reste à l’intérieur du disque solaire et laisse un anneau allumé pendant ${values.duration} secondes. L’anneau est de la photosphère : le filtre ne se retire jamais.`,
      }[locale],
      summary: {
        ca: `${values.duration} s ${central}`,
        es: `${values.duration} s ${central}`,
        en: `${values.duration} s ${central}`,
        fr: `${values.duration} s ${central}`,
      }[locale],
    };
  }

  if (outcome === 'edge') {
    return {
      figure: { ca: 'Al caire', es: 'En el límite', en: 'On the edge', fr: 'Sur la limite' }[locale],
      unit: {
        ca: 'de la franja',
        es: 'de la franja',
        en: 'of the path',
        fr: 'de la bande',
      }[locale],
      sentence: {
        ca: 'Aquest punt cau dins la zona d’incertesa del caire. El motor hi calcula una durada, però no la pot garantir: no planifiquis la totalitat aquí. Uns quilòmetres cap a l’interior de la franja ho decideixen, i val la pena comprovar el punt nou.',
        es: 'Este punto cae en la zona de incertidumbre del borde. El motor calcula una duración, pero no puede garantizarla: no planifiques aquí la totalidad. Unos kilómetros hacia el interior de la franja lo deciden, y conviene comprobar el punto nuevo.',
        en: 'This point falls inside the uncertainty zone at the path edge. The engine computes a duration but cannot guarantee it: do not plan on totality here. A few kilometres further inside the path settle it, and the new point is worth checking.',
        fr: 'Ce point tombe dans la zone d’incertitude de la limite. Le moteur calcule une durée mais ne peut pas la garantir : ne planifiez pas la totalité ici. Quelques kilomètres vers l’intérieur de la bande tranchent la question, et le nouveau point mérite une vérification.',
      }[locale],
      summary: {
        ca: 'al caire de la franja',
        es: 'en el límite de la franja',
        en: 'on the path edge',
        fr: 'sur la limite de la bande',
      }[locale],
    };
  }

  if (outcome === 'partial') {
    return {
      figure: `${values.obscuration} %`,
      unit: {
        ca: 'del disc tapat',
        es: 'del disco tapado',
        en: 'of the disc covered',
        fr: 'du disque couvert',
      }[locale],
      sentence: {
        ca: 'Des d’aquest punt l’eclipsi és parcial. Sempre queda una escletxa de fotosfera visible, i això no és una totalitat petita: és una altra cosa. No es fa fosc, no surt la corona, no es veuen els planetes, i el filtre no es pot treure en cap moment.',
        es: 'Desde este punto el eclipse es parcial. Siempre queda una franja de fotosfera visible, y eso no es una totalidad pequeña: es otra cosa. No se hace de noche, no sale la corona, no se ven los planetas, y el filtro no se puede quitar en ningún momento.',
        en: 'The eclipse is partial from here. A sliver of photosphere stays visible throughout, and that is not a small totality: it is a different phenomenon. It does not go dark, the corona never appears, the planets stay hidden, and the filter never comes off.',
        fr: 'Depuis ce point l’éclipse est partielle. Un croissant de photosphère reste visible en permanence, et ce n’est pas une petite totalité : c’est autre chose. Il ne fait pas nuit, la couronne n’apparaît pas, les planètes restent invisibles, et le filtre ne se retire jamais.',
      }[locale],
      summary: {
        ca: `${values.obscuration} % del disc tapat`,
        es: `${values.obscuration} % del disco tapado`,
        en: `${values.obscuration} % of the disc covered`,
        fr: `${values.obscuration} % du disque couvert`,
      }[locale],
    };
  }

  return {
    figure: { ca: 'Cap', es: 'Ninguno', en: 'None', fr: 'Aucune' }[locale],
    unit: {
      ca: 'eclipsi visible',
      es: 'eclipse visible',
      en: 'eclipse visible',
      fr: 'éclipse visible',
    }[locale],
    sentence: {
      ca: 'Des d’aquest punt els discos del Sol i de la Lluna no arriben a tocar-se: no hi ha eclipsi de cap mena. Les pàgines de les ciutats de la franja diuen on sí que n’hi ha.',
      es: 'Desde este punto los discos del Sol y de la Luna no llegan a tocarse: no hay eclipse de ningún tipo. Las páginas de las ciudades de la franja indican dónde sí lo hay.',
      en: 'The discs of the Sun and Moon never touch as seen from here: there is no eclipse at all. The city pages along the path show where there is one.',
      fr: 'Depuis ce point, les disques du Soleil et de la Lune ne se touchent jamais : il n’y a aucune éclipse. Les pages des villes de la bande indiquent où il y en a une.',
    }[locale],
    summary: {
      ca: 'sense eclipsi visible',
      es: 'sin eclipse visible',
      en: 'no eclipse visible',
      fr: 'aucune éclipse visible',
    }[locale],
  };
}

/**
 * L'encapçalament d'una fitxa local.
 *
 * NO PORTA LA MENA D'ECLIPSI, i és tota la correcció: la mena que sortia d'aquí
 * era la GLOBAL del catàleg, i per això Barcelona anunciava un eclipsi total que
 * des de Barcelona no existeix. Qui diu què passa en aquest punt és el
 * veredicte, que es pinta just a sota amb la seva xifra.
 */
export function seoLocalHeading(locale: Locale, dateLong: string, place: string): string {
  return {
    ca: `Eclipsi del ${dateLong} a ${place}`,
    es: `Eclipse del ${dateLong} en ${place}`,
    en: `The ${dateLong} eclipse from ${place}`,
    fr: `L’éclipse du ${dateLong} à ${place}`,
  }[locale];
}

/**
 * El `<title>` d'una fitxa de PUNT OFICIAL.
 *
 * ÉS DIFERENT DEL DE LA CIUTAT A POSTA, i el motiu el va trobar la comprovació
 * de `check-built-html.ts` el primer cop que va córrer: la ciutat de València i
 * el punt oficial de València sortien tots dos amb «Eclipsi 2026 a València:
 * 61,7 s de totalitat». Dues URL indexables nostres amb el mateix títol i la
 * mateixa intenció: Google en tria una i l'altra no existeix per a ningú.
 *
 * Posar «punt oficial» al davant no és decoració: és la diferència real entre
 * les dues pàgines —una parla del lloc, l'altra d'un emplaçament amb
 * organitzador i accés— i és també la manera com es busca.
 */
export function seoOfficialTitle(
  locale: Locale,
  year: string,
  place: string,
  summary: string,
): string {
  return {
    ca: `Punt oficial a ${place}: eclipsi ${year}, ${summary} | eclipsi.info`,
    es: `Punto oficial en ${place}: eclipse ${year}, ${summary} | eclipsi.info`,
    en: `Official site at ${place}: ${year} eclipse, ${summary} | eclipsi.info`,
    fr: `Site officiel à ${place} : éclipse ${year}, ${summary} | eclipsi.info`,
  }[locale];
}

/** El `<title>`: el lloc, l'any i el veredicte. Sense adjectius que no toquin. */
export function seoLocalTitle(
  locale: Locale,
  year: string,
  place: string,
  summary: string,
): string {
  return {
    ca: `Eclipsi ${year} a ${place}: ${summary} | eclipsi.info`,
    es: `Eclipse ${year} en ${place}: ${summary} | eclipsi.info`,
    en: `${year} eclipse from ${place}: ${summary} | eclipsi.info`,
    fr: `Éclipse ${year} à ${place} : ${summary} | eclipsi.info`,
  }[locale];
}

/* ═══════════════════════════════════════════════════════════════════════════
   ON ANAR, QUE ÉS LA MEITAT QUE FALTAVA

   Una fitxa de ciutat deia el seu tant per cent i s'aturava. Qui la llegeix no
   ha vingut a saber un número: ha vingut a decidir on es planta. Aquí baixen a
   paraules les tres respostes que dona `travel.ts`, i cadascuna tanca una
   pàgina que abans era un carreró sense sortida.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface SeoTravelCopy {
  heading: string;
  /** La distància a la línia central, sempre. */
  centerLine: string;
  /** «Vés a X»: hi ha un lloc raonable a prop. */
  target?: string;
  /** «Aquí no, però tal dia sí»: no n'hi ha, i n'hi ha un altre eclipsi. */
  otherEclipse?: string;
  /** «Ja hi ets»: no cal moure's. */
  stay?: string;
}

interface TravelValues {
  /** Distància a la central, ja formatada. */
  centerKm: string;
  place: string;
  /** Nom de la ciutat de destinació. */
  targetName?: string;
  targetKm?: string;
  targetSeconds?: string;
  /** Data llarga de l'altre eclipsi i els seus segons en aquest mateix punt. */
  otherDate?: string;
  otherSeconds?: string;
  otherTotal?: boolean;
}

export function seoTravel(locale: Locale, values: TravelValues): SeoTravelCopy {
  const copy: SeoTravelCopy = {
    heading: {
      ca: 'On has d’anar, i si val la pena',
      es: 'Adónde ir, y si compensa',
      en: 'Where to go, and whether it is worth it',
      fr: 'Où aller, et si cela en vaut la peine',
    }[locale],
    centerLine: {
      ca: `La línia central de la franja passa a ${values.centerKm} km de ${values.place}, en línia recta. No és temps de trajecte: és la distància sobre el mapa.`,
      es: `La línea central de la franja pasa a ${values.centerKm} km de ${values.place}, en línea recta. No es tiempo de trayecto: es la distancia sobre el mapa.`,
      en: `The centre line of the path runs ${values.centerKm} km from ${values.place} as the crow flies. That is map distance, not travel time.`,
      fr: `La ligne centrale de la bande passe à ${values.centerKm} km de ${values.place}, à vol d’oiseau. Ce n’est pas un temps de trajet : c’est la distance sur la carte.`,
    }[locale],
  };

  if (values.targetName !== undefined) {
    copy.target = {
      ca: `El lloc amb fase central més proper que tenim calculat és ${values.targetName}, a ${values.targetKm} km, amb ${values.targetSeconds} segons. Obre’n la fitxa abans de decidir: els segons no ho són tot, i l’horitzó i els núvols d’aquell punt també compten.`,
      es: `El lugar con fase central más cercano que tenemos calculado es ${values.targetName}, a ${values.targetKm} km, con ${values.targetSeconds} segundos. Abre su ficha antes de decidir: los segundos no lo son todo, y el horizonte y las nubes de ese punto también cuentan.`,
      en: `The nearest place with a central phase we have calculated is ${values.targetName}, ${values.targetKm} km away, with ${values.targetSeconds} seconds. Open its page before deciding: seconds are not everything, and that site’s horizon and cloud matter too.`,
      fr: `Le lieu avec phase centrale le plus proche que nous ayons calculé est ${values.targetName}, à ${values.targetKm} km, avec ${values.targetSeconds} secondes. Ouvrez sa fiche avant de décider : les secondes ne font pas tout, l’horizon et les nuages de ce point comptent aussi.`,
    }[locale];
  } else if (values.otherDate !== undefined) {
    const what = {
      ca: values.otherTotal === true ? 'la totalitat' : 'l’anell de l’anular',
      es: values.otherTotal === true ? 'la totalidad' : 'el anillo del anular',
      en: values.otherTotal === true ? 'totality' : 'the annular ring',
      fr: values.otherTotal === true ? 'la totalité' : 'l’anneau de l’annulaire',
    }[locale];
    copy.otherEclipse = {
      ca: `Per a aquest eclipsi no hi ha cap destinació raonable des d’aquí. Ara bé: ${what} del ${values.otherDate} passa per ${values.place} mateix, amb ${values.otherSeconds} segons. Aquell dia no caldrà que et moguis.`,
      es: `Para este eclipse no hay ningún destino razonable desde aquí. Ahora bien: ${what} del ${values.otherDate} pasa por ${values.place} mismo, con ${values.otherSeconds} segundos. Ese día no hará falta moverse.`,
      en: `There is no reasonable destination for this eclipse from here. But ${what} on ${values.otherDate} passes right over ${values.place}, with ${values.otherSeconds} seconds. That day you will not have to travel.`,
      fr: `Pour cette éclipse, aucune destination raisonnable depuis ici. En revanche, ${what} du ${values.otherDate} passe au-dessus de ${values.place} même, avec ${values.otherSeconds} secondes. Ce jour-là, pas besoin de bouger.`,
    }[locale];
  } else {
    copy.stay = {
      ca: `Ja hi ets: no hi ha cap lloc a prop que valgui el desplaçament. El que decidirà què veuràs és l’horitzó del teu punt i els núvols d’aquell vespre, no uns quants quilòmetres més.`,
      es: `Ya estás: no hay ningún lugar cerca que compense el desplazamiento. Lo que decidirá qué verás es el horizonte de tu punto y las nubes de esa tarde, no unos kilómetros más.`,
      en: `You are already there: no nearby place is worth the trip. What will decide the outcome is your site’s horizon and that evening’s cloud, not a few more kilometres.`,
      fr: `Vous y êtes déjà : aucun lieu proche ne justifie le déplacement. Ce qui décidera de ce que vous verrez, c’est l’horizon de votre point et les nuages de ce soir-là, pas quelques kilomètres de plus.`,
    }[locale];
  }

  return copy;
}
