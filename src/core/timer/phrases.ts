/**
 * Els textos dels avisos, en català i castellà.
 *
 * PER QUÈ VIUEN AQUÍ I NO A `src/i18n/*.json`: aquests textos els llegeix una
 * veu sintètica, no els llegeix ningú amb els ulls. Es redacten amb criteris
 * diferents dels de la interfície — xifres escrites amb lletres (una veu
 * sintètica llegeix «15 s» de maneres imprevisibles segons el motor), frases
 * de sis paraules, verb imperatiu al davant — i han de poder-se provar amb
 * Vitest sense muntar el proveïdor d'i18n, que arrossega React.
 *
 * REGLA DE REDACCIÓ: primer l'acció, després el context. Durant la totalitat
 * l'usuari està mirant el cel amb gent cridant al voltant; si la frase comença
 * amb «Falten quinze segons perquè...» ja ha perdut els primers quinze
 * caràcters. Comença amb «Quinze segons» i acaba amb l'ordre.
 */

import { obscurationPercentValue } from '../astro/obscuration';
import type { FilterGateReason, LocalisedText } from './types';


/** Text d'un avís: el que se sent i el que es veu. */
export interface AlertText {
  speech: LocalisedText;
  label: LocalisedText;
}

/**
 * Xifres en lletres per a la veu.
 *
 * Els motors de TTS llegeixen «10 min» com «deu eme i ene» o «deu minuts»
 * segons el motor, la versió i l'idioma. Escrivint-ho amb lletres el resultat
 * és el mateix a tot arreu. A l'etiqueta de pantalla, en canvi, hi va la xifra:
 * allà mana el sistema de disseny i les xifres van en mono tabular.
 */
const WORDS: Record<number, LocalisedText> = {
  1: { ca: 'Un', es: 'Un' },
  5: { ca: 'Cinc', es: 'Cinco' },
  10: { ca: 'Deu', es: 'Diez' },
  15: { ca: 'Quinze', es: 'Quince' },
  30: { ca: 'Trenta', es: 'Treinta' },
  60: { ca: 'Seixanta', es: 'Sesenta' },
};

/** Xifra en lletres; si no és a la taula, cau a la xifra mateixa. */
function word(n: number): LocalisedText {
  return WORDS[n] ?? { ca: String(n), es: String(n) };
}

/** Compte enrere cap al primer contacte, a 10, 5 i 1 minut. */
export function c1Countdown(seconds: number): AlertText {
  const minutes = Math.round(seconds / 60);
  const w = word(minutes);
  const unitCa = minutes === 1 ? 'minut' : 'minuts';
  const unitEs = minutes === 1 ? 'minuto' : 'minutos';

  // A deu minuts encara ets a temps de treure les ulleres de la motxilla; a un
  // minut ja no és un recordatori logístic sinó una instrucció.
  const tailCa =
    minutes >= 10
      ? ' Prepara el filtre.'
      : minutes === 1
        ? ' Mira el Sol només amb filtre.'
        : '';
  const tailEs =
    minutes >= 10
      ? ' Prepara el filtro.'
      : minutes === 1
        ? ' Mira el Sol solo con filtro.'
        : '';

  return {
    speech: {
      ca: `${w.ca} ${unitCa} per al primer contacte.${tailCa}`,
      es: `${w.es} ${unitEs} para el primer contacto.${tailEs}`,
    },
    label: {
      ca: `${minutes} min per a C1`,
      es: `${minutes} min para C1`,
    },
  };
}

/** Primer contacte: la Lluna ja mossega el disc solar. */
export function c1Start(): AlertText {
  return {
    speech: {
      ca: 'Primer contacte. Comença l’eclipsi.',
      es: 'Primer contacto. Empieza el eclipse.',
    },
    label: { ca: 'C1 · comença l’eclipsi', es: 'C1 · empieza el eclipse' },
  };
}

/**
 * Com s'ha de parlar de la fase central des d'aquest punt.
 * `no-filter-off` és el cas en què hi ha fase central però NO és segur
 * treure's el filtre (vegeu `safety.ts`).
 */
export type CentralMode = 'total' | 'annular' | 'no-filter-off';

/** Compte enrere cap a la fase central. */
export function centralCountdown(seconds: number, mode: CentralMode): AlertText {
  const isMinute = seconds >= 60;
  const w = word(isMinute ? Math.round(seconds / 60) : seconds);
  const unitCa = isMinute ? (seconds === 60 ? 'minut' : 'minuts') : 'segons';
  const unitEs = isMinute ? (seconds === 60 ? 'minuto' : 'minutos') : 'segundos';

  const nameCa =
    mode === 'annular' ? 'l’anularitat' : mode === 'total' ? 'la totalitat' : 'la fase central';
  const nameEs =
    mode === 'annular' ? 'la anularidad' : mode === 'total' ? 'la totalidad' : 'la fase central';

  // El matís importa: en totalitat el filtre es treu D'AQUÍ A UNA ESTONA, en
  // anularitat no es treu mai, i quan la geometria no ho garanteix tampoc.
  const tailCa =
    mode === 'total'
      ? ' No et treguis el filtre encara.'
      : mode === 'annular'
        ? ' El filtre no es treu mai.'
        : ' Des d’aquest punt no és segur treure’s el filtre.';
  const tailEs =
    mode === 'total'
      ? ' No te quites el filtro todavía.'
      : mode === 'annular'
        ? ' El filtro no se quita nunca.'
        : ' Desde este punto no es seguro quitarse el filtro.';

  return {
    speech: {
      ca: `${w.ca} ${unitCa} per a ${nameCa}.${tailCa}`,
      es: `${w.es} ${unitEs} para ${nameEs}.${tailEs}`,
    },
    label: {
      ca: `${isMinute ? `${Math.round(seconds / 60)} min` : `${seconds} s`} per a C2`,
      es: `${isMinute ? `${Math.round(seconds / 60)} min` : `${seconds} s`} para C2`,
    },
  };
}

/**
 * Comença la fase central en un cas en què el filtre NO es treu.
 *
 * Només s'usa per a `annular` i per a `no-filter-off`. La totalitat segura no
 * passa per aquí: té el seu text propi a `filterOff()`, i que siguin dues
 * funcions diferents impedeix que un canvi de redacció en una faci caure
 * l'autorització a l'altra.
 */
export function centralStart(mode: 'annular' | 'no-filter-off'): AlertText {
  if (mode === 'annular') {
    return {
      speech: {
        ca: 'Anularitat. Anell de foc. El filtre es queda posat.',
        es: 'Anularidad. Anillo de fuego. El filtro se queda puesto.',
      },
      label: { ca: 'C2 · anell de foc', es: 'C2 · anillo de fuego' },
    };
  }
  return {
    speech: {
      ca: 'Fase central. Des d’aquest punt el filtre no es treu.',
      es: 'Fase central. Desde este punto el filtro no se quita.',
    },
    label: { ca: 'C2 · filtre posat', es: 'C2 · filtro puesto' },
  };
}

/**
 * L'ÚNIC text de tota l'aplicació que autoritza a treure's el filtre.
 * Que en surti un de sol, i des d'una sola funció, és deliberat: així és
 * greppable i qualsevol canvi hi passa per força.
 */
/**
 * L'AVÍS ES CONDICIONA A UNA OBSERVACIÓ, NO AL RELLOTGE.
 *
 * Deia «Totalitat. Ja et pots treure el filtre», que és una ordre basada en
 * l'hora que calculem nosaltres. Però el nostre C2 té un biaix mesurat de −4,3 s
 * de mitjana i fins a −9,1 s en el pitjor cas, i el residu d'efemèrides canvia
 * de signe entre eclipsis. El retard de dotze segons cobreix això amb marge
 * (vegeu `safety.ts`), però cap número no pot garantir-ho sempre.
 *
 * El que SÍ que és infal·lible és el que la persona té davant. La regla de
 * l'American Astronomical Society no parla d'hores: diu que es pot mirar quan
 * la Lluna cobreix del tot el disc brillant del Sol — i això es veu, perquè es
 * fa fosc de cop i apareix la corona.
 *
 * Per això la frase demana comprovar-ho abans de fer res. Si el nostre rellotge
 * s'avança, l'usuari mirarà, veurà que encara hi ha una escletxa de llum, i no
 * es traurà res. Aquesta és l'única salvaguarda que no depèn de la precisió de
 * cap motor.
 */
export function filterOff(): AlertText {
  return {
    speech: {
      ca: "Si ja s'ha fet fosc i veus la corona, ara pots treure't el filtre. Si encara hi ha un punt de llum, espera.",
      es: 'Si ya ha oscurecido y ves la corona, ahora puedes quitarte el filtro. Si todavía hay un punto de luz, espera.',
    },
    label: { ca: 'Filtre fora', es: 'Filtro fuera' },
  };
}

/** Temps que queda de fase central. Informatiu, sense implicació de seguretat. */
export function centralRemaining(seconds: number, mode: CentralMode): AlertText {
  const isMinute = seconds >= 60;
  const w = word(isMinute ? Math.round(seconds / 60) : seconds);
  const unitCa = isMinute ? (seconds === 60 ? 'minut' : 'minuts') : 'segons';
  const unitEs = isMinute ? (seconds === 60 ? 'minuto' : 'minutos') : 'segundos';
  const nameCa = mode === 'annular' ? 'anularitat' : 'totalitat';
  const nameEs = mode === 'annular' ? 'anularidad' : 'totalidad';

  return {
    speech: {
      ca: `${w.ca} ${unitCa} de ${nameCa}.`,
      es: `${w.es} ${unitEs} de ${nameEs}.`,
    },
    label: {
      ca: `Queden ${isMinute ? `${Math.round(seconds / 60)} min` : `${seconds} s`}`,
      es: `Quedan ${isMinute ? `${Math.round(seconds / 60)} min` : `${seconds} s`}`,
    },
  };
}

/**
 * Avís de seguretat abans del tercer contacte.
 *
 * A 15 segons es prepara, a 5 segons ja s'ha de tenir posat. La diferència de
 * to entre «prepara» i «ara» és intencionada: dos avisos idèntics es fonen en
 * un i el segon deixa de fer efecte.
 */
export function filterOn(seconds: number): AlertText {
  const w = word(seconds);
  const finalCa = seconds <= 5 ? ' Posa’t el filtre ara.' : ' Prepara el filtre.';
  const finalEs = seconds <= 5 ? ' Ponte el filtro ahora.' : ' Prepara el filtro.';

  return {
    speech: {
      ca: `${w.ca} segons.${finalCa}`,
      es: `${w.es} segundos.${finalEs}`,
    },
    label: {
      ca: seconds <= 5 ? 'Filtre posat ARA' : `Filtre en ${seconds} s`,
      es: seconds <= 5 ? 'Filtro puesto YA' : `Filtro en ${seconds} s`,
    },
  };
}

/** El Sol ha tornat. Recordatori que el filtre no es toca fins al final. */
export function sunReturned(mode: CentralMode): AlertText {
  if (mode === 'annular') {
    return {
      speech: {
        ca: 'S’ha acabat l’anularitat. El filtre segueix posat.',
        es: 'Se ha acabado la anularidad. El filtro sigue puesto.',
      },
      label: { ca: 'C3 · fi de l’anularitat', es: 'C3 · fin de la anularidad' },
    };
  }
  return {
    speech: {
      ca: 'Torna el Sol. El filtre es queda posat fins al final.',
      es: 'Vuelve el Sol. El filtro se queda puesto hasta el final.',
    },
    label: { ca: 'C3 · torna el Sol', es: 'C3 · vuelve el Sol' },
  };
}

/** Màxim de l'eclipsi. És la fita útil quan des d'aquí no hi ha fase central. */
export function maximum(obscuration?: number): AlertText {
  // `obscurationPercentValue` i no `Math.round`: un 99,7 % arrodonit dona 100 i
  // el telèfon arribava a dir «cent per cent del Sol tapat» a algú que és fora
  // de la franja i que, si s'ho creu, es treu el filtre. Fora de la fase
  // central la funció talla a 99 a posta. És la mateixa regla que la pantalla.
  const pct =
    obscuration === undefined ? undefined : obscurationPercentValue(obscuration, false);

  return {
    speech: {
      ca:
        pct === undefined
          ? 'Màxim de l’eclipsi. No et treguis el filtre.'
          : `Màxim de l’eclipsi. ${pct} per cent del Sol tapat. No et treguis el filtre.`,
      es:
        pct === undefined
          ? 'Máximo del eclipse. No te quites el filtro.'
          : `Máximo del eclipse. ${pct} por ciento del Sol tapado. No te quites el filtro.`,
    },
    label: {
      ca: pct === undefined ? 'Màxim' : `Màxim · ${pct} %`,
      es: pct === undefined ? 'Máximo' : `Máximo · ${pct} %`,
    },
  };
}

/** Quart contacte: s'ha acabat. */
export function eclipseEnd(): AlertText {
  return {
    speech: {
      ca: 'Quart contacte. S’ha acabat l’eclipsi.',
      es: 'Cuarto contacto. Se ha acabado el eclipse.',
    },
    label: { ca: 'C4 · fi de l’eclipsi', es: 'C4 · fin del eclipse' },
  };
}

/**
 * Locucions del mode d'assaig.
 *
 * S'anuncia al principi i al final, i no a cada avís: repetir «assaig» dotze
 * vegades entrena l'oïda a ignorar precisament les frases que després salvaran
 * la vista. L'estat d'assaig el sosté la pantalla, no la veu.
 */
export function rehearsalStart(): AlertText {
  return {
    speech: {
      ca: 'Assaig. Sentiràs tota la seqüència d’avisos accelerada.',
      es: 'Ensayo. Vas a oír toda la secuencia de avisos acelerada.',
    },
    label: { ca: 'Assaig · comença', es: 'Ensayo · empieza' },
  };
}

export function rehearsalEnd(): AlertText {
  return {
    speech: { ca: 'Fi de l’assaig.', es: 'Fin del ensayo.' },
    label: { ca: 'Assaig · fi', es: 'Ensayo · fin' },
  };
}

/**
 * Per què la comporta no autoritza treure el filtre, dit a l'usuari.
 *
 * VIU AQUÍ I NO DINS D'UNA PANTALLA perquè hi ha més d'una pantalla que ho ha
 * de dir, i quan la taula vivia dins del compte enrere la pantalla de la guia
 * es va escriure la seva pròpia frase: mirava `centralDurationSec > 0` en
 * comptes de la comporta i, com que un eclipsi ANULAR també té C2 i C3,
 * anunciava «Només 421 s són segurs — durant la fase central pots mirar el Sol
 * a ull nu» per al 26 de gener del 2028. L'anell que queda a la vista és
 * fotosfera. Amb una sola taula això no es pot tornar a escriure per separat.
 */
export const FILTER_GATE_NOTE: Record<FilterGateReason, LocalisedText> = {
  ok: {
    ca: 'Només et pots treure el filtre entre l’avís de totalitat i el primer avís de tornar-te’l a posar.',
    es: 'Solo puedes quitarte el filtro entre el aviso de totalidad y el primer aviso de volvértelo a poner.',
  },
  'no-eclipse': {
    ca: 'Des d’aquest punt no hi ha eclipsi.',
    es: 'Desde este punto no hay eclipse.',
  },
  'partial-only': {
    ca: 'Des d’aquí l’eclipsi és parcial. No sentiràs mai l’avís de treure’t el filtre, perquè no hi ha cap moment segur.',
    es: 'Desde aquí el eclipse es parcial. No oirás nunca el aviso de quitarte el filtro, porque no hay ningún momento seguro.',
  },
  annular: {
    ca: 'Eclipsi anular. L’anell que queda a la vista és fotosfera: el filtre no es treu en cap moment.',
    es: 'Eclipse anular. El anillo que queda a la vista es fotosfera: el filtro no se quita en ningún momento.',
  },
  'missing-central-contacts': {
    ca: 'No s’han pogut fixar els contactes de la totalitat. Per seguretat, no hi haurà cap avís de treure el filtre.',
    es: 'No se han podido fijar los contactos de la totalidad. Por seguridad, no habrá ningún aviso de quitar el filtro.',
  },
  'totality-too-short': {
    ca: 'Ets al límit de la franja i la totalitat calculada és massa curta per garantir-la. Filtre posat tota l’estona.',
    es: 'Estás en el límite de la franja y la totalidad calculada es demasiado corta para garantizarla. Filtro puesto todo el rato.',
  },
  'central-blocked-by-terrain': {
    ca: 'El terreny tapa la fase central des d’aquest punt. Filtre posat tota l’estona.',
    es: 'El terreno tapa la fase central desde este punto. Filtro puesto todo el rato.',
  },
  'edge-uncertain': {
    ca: 'Ets al caire de la franja i no podem dir amb prou seguretat si hi haurà totalitat. Filtre posat tota l’estona; si et mous cap endins, tornem-ho a mirar.',
    es: 'Estás en el borde de la franja y no podemos decir con suficiente seguridad si habrá totalidad. Filtro puesto todo el rato; si te mueves hacia dentro, lo volvemos a mirar.',
  },
};

