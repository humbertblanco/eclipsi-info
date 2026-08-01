/**
 * Textos de les quatre pantalles, en català i castellà.
 *
 * PER QUÈ NO VAN A `src/i18n/*.json`: aquesta tasca no té permís per tocar
 * `src/i18n/**`. La resta de l'app ja resol el mateix problema igual —
 * `features/countdown/CountdownView.tsx` porta les seves cadenes en taules
 * `{ ca, es }` dins del mateix fitxer—, així que aquí se segueix el patró que
 * ja hi ha en comptes d'inventar-ne un de nou.
 *
 * SI ALGUN DIA ES CONSOLIDA L'I18N: aquestes claus es poden abocar tal qual a
 * `ca.json` i `es.json` i substituir `s(...)` per `t(...)`. L'estructura és
 * plana i amb el mateix estil de clau amb punts a posta.
 *
 * TO: frases curtes i declaratives, tractament de tu. Etiquetes de botó en
 * imperatiu, d'1 a 4 paraules. Cap emoji, cap signe d'admiració, cap paraula
 * d'entusiasme.
 */

import type { Locale } from '../i18n';

type Entry = { ca: string; es: string };

const STRINGS = {
  /* --- navegació ---
   *
   * `tab.*` són les etiquetes de la barra inferior i `nav.*` les de qualsevol
   * altre lloc. No és duplicar: a 390 px hi ha quatre pestanyes i cadascuna té
   * 97 px, i «Compte enrere» s'hi talla a «Compte a…», que no és una etiqueta
   * sinó un accident. El sistema demana etiquetes d'una o dues paraules a la
   * barra, i el muntatge original de l'app hi posa literalment «Compte».
   */
  'tab.countdown': { ca: 'Compte', es: 'Cuenta' },
  'tab.map': { ca: 'Mapa', es: 'Mapa' },
  'tab.sky': { ca: 'Cel', es: 'Cielo' },
  'tab.guide': { ca: 'Guia', es: 'Guía' },

  'nav.countdown': { ca: 'Compte enrere', es: 'Cuenta atrás' },
  'nav.map': { ca: 'Mapa', es: 'Mapa' },
  'nav.sky': { ca: 'Cel', es: 'Cielo' },
  'nav.guide': { ca: 'Guia', es: 'Guía' },
  'nav.label': { ca: 'Seccions de l’aplicació', es: 'Secciones de la aplicación' },

  /*
   * Títols de la barra superior. Són els del muntatge original
   * (`design-reference/ui_kits/app/index.html`): a la portada la barra porta el
   * logotip i cap títol; a la resta de pestanyes, el nom de la pantalla.
   */
  'title.map': { ca: 'Mapa de la franja', es: 'Mapa de la franja' },
  'title.sky': { ca: 'El cel ara mateix', es: 'El cielo ahora mismo' },
  'title.guide': { ca: 'Guia de l’eclipsi', es: 'Guía del eclipse' },
  'shell.eclipse': { ca: 'Tria l’eclipsi', es: 'Elige el eclipse' },
  'shell.open': { ca: 'Dades obertes · MIT', es: 'Datos abiertos · MIT' },
  'shell.band': { ca: 'Franja de centralitat', es: 'Franja de centralidad' },
  'shell.crashed': {
    ca: 'Aquesta pantalla ha fallat. La resta de l’app segueix funcionant: pots canviar de pestanya o tornar-ho a provar.',
    es: 'Esta pantalla ha fallado. El resto de la app sigue funcionando: puedes cambiar de pestaña o volver a intentarlo.',
  },
  'shell.retry': { ca: 'Torna-ho a provar', es: 'Vuelve a intentarlo' },
  'camera.crashed': {
    ca: 'La vista de càmera ha fallat. Les lectures d’aquesta pantalla segueixen essent bones: surten del càlcul, no del sensor.',
    es: 'La vista de cámara ha fallado. Las lecturas de esta pantalla siguen siendo buenas: salen del cálculo, no del sensor.',
  },

  /* --- comuns --- */
  'common.here': { ca: 'El teu punt', es: 'Tu punto' },
  'common.locate': { ca: 'Ubica’m', es: 'Ubícame' },
  'common.locating': { ca: 'Cercant…', es: 'Buscando…' },
  'common.eclipse': { ca: 'Eclipsi', es: 'Eclipse' },
  'common.unknownPlace': {
    ca: 'Encara no se sap on seràs.',
    es: 'Todavía no se sabe dónde estarás.',
  },
  'common.locateCta': {
    ca: 'Digues on seràs i et direm si el veuràs des d’aquell punt exacte.',
    es: 'Di dónde estarás y te diremos si lo verás desde ese punto exacto.',
  },

  /* --- tipus d'eclipsi --- */
  'kind.total': { ca: 'Totalitat', es: 'Totalidad' },
  'kind.annular': { ca: 'Anularitat', es: 'Anularidad' },
  'kind.partial': { ca: 'Parcial', es: 'Parcial' },
  'kind.none': { ca: 'Sense eclipsi', es: 'Sin eclipse' },

  /* --- compte enrere --- */
  'home.untilTotality': { ca: 'Fins a la totalitat', es: 'Hasta la totalidad' },
  'home.untilAnnularity': { ca: 'Fins a l’anularitat', es: 'Hasta la anularidad' },
  'home.untilMax': { ca: 'Fins al màxim', es: 'Hasta el máximo' },
  'home.past': { ca: 'Ha passat fa', es: 'Pasó hace' },
  'home.visibleDuration': { ca: 'Durada visible', es: 'Duración visible' },
  'home.theoreticalDuration': { ca: 'Durada teòrica', es: 'Duración teórica' },
  'home.obscuration': { ca: 'Ocultació', es: 'Ocultación' },
  'home.sunAltitude': { ca: 'Altura del Sol', es: 'Altura del Sol' },
  'home.contacts': { ca: 'Contactes al teu punt', es: 'Contactos en tu punto' },
  'home.openCamera': { ca: 'Apunta el mòbil al cel', es: 'Apunta el móvil al cielo' },
  'home.terrainPending': {
    ca: 'La durada encara és la teòrica: el perfil del terreny no està calculat i el relleu de ponent no hi entra.',
    es: 'La duración todavía es la teórica: el perfil del terreno no está calculado y el relieve de poniente no entra.',
  },
  'home.sources': {
    ca: 'Efemèrides calculades al dispositiu amb astronomy-engine. Perfil del terreny a partir de tessel·les d’elevació. Nuvolositat d’Open-Meteo.',
    es: 'Efemérides calculadas en el dispositivo con astronomy-engine. Perfil del terreno a partir de teselas de elevación. Nubosidad de Open-Meteo.',
  },

  /* --- núvols --- */
  'sky.clearOdds': { ca: 'Probabilitat de cel útil', es: 'Probabilidad de cielo útil' },
  'sky.cloudsLoading': {
    ca: 'Consultant la nuvolositat…',
    es: 'Consultando la nubosidad…',
  },
  'sky.cloudsOffline': {
    ca: 'Sense dades de núvols. Cal xarxa per consultar-les.',
    es: 'Sin datos de nubes. Hace falta red para consultarlas.',
  },

  /* --- horitzó --- */
  'horizon.computing': {
    ca: 'Calculant el perfil del terreny…',
    es: 'Calculando el perfil del terreno…',
  },
  'horizon.failed': {
    ca: 'No s’ha pogut calcular el perfil del terreny. El veredicte serà optimista, perquè assumeix horitzó pla.',
    es: 'No se ha podido calcular el perfil del terreno. El veredicto será optimista, porque asume horizonte plano.',
  },
  'horizon.retry': { ca: 'Torna-ho a provar', es: 'Vuelve a intentarlo' },

  /* --- mapa --- */
  'map.title': { ca: 'Franja de centralitat', es: 'Franja de centralidad' },
  /*
   * El segmentat del mapa: a la referència commutava CAPES del mapa. Aquí
   * commuta què respon la fitxa de sota, perquè `EclipseMap` només dibuixa una
   * capa i no és territori d'aquesta tasca afegir-n'hi. La pregunta que fa la
   * gent és la mateixa: on soc, quin cel hi haurà, i em convé moure'm.
   */
  'map.view.band': { ca: 'Franja', es: 'Franja' },
  'map.view.clouds': { ca: 'Núvols', es: 'Nubes' },
  'map.view.move': { ca: 'Durada', es: 'Duración' },
  'map.legend.band': { ca: 'Franja de centralitat', es: 'Franja de centralidad' },
  'map.legend.center': { ca: 'Línia central', es: 'Línea central' },
  'map.gradientFlat': {
    ca: 'Aquí la durada gairebé no canvia: moure’s uns quilòmetres no et donarà segons.',
    es: 'Aquí la duración casi no cambia: moverse unos kilómetros no te dará segundos.',
  },
  'map.gradientMove': {
    ca: 'Cap a {dir} guanyes {rate} s per quilòmetre.',
    es: 'Hacia {dir} ganas {rate} s por kilómetro.',
  },
  'map.gradientBest': {
    ca: 'Uns {km} km en aquesta direcció et deixarien a prop de {best}.',
    es: 'Unos {km} km en esa dirección te dejarían cerca de {best}.',
  },
  'map.noCentral': {
    ca: 'Des d’aquest punt no hi ha fase central: l’eclipsi és només parcial.',
    es: 'Desde este punto no hay fase central: el eclipse es solo parcial.',
  },
  'map.attribution': {
    ca: 'Cartografia i noms de lloc d’OpenStreetMap (noms via Photon, komoot). Trajectòria de Fred Espenak, NASA GSFC.',
    es: 'Cartografía y nombres de lugar de OpenStreetMap (nombres vía Photon, komoot). Trayectoria de Fred Espenak, NASA GSFC.',
  },
  'map.inBand': { ca: 'Dins la franja', es: 'Dentro de la franja' },
  'map.contacts': { ca: 'Hores en aquest punt', es: 'Horas en este punto' },
  'map.toLimit': {
    ca: 'Al límit {side}',
    es: 'Al límite {side}',
  },
  'map.side.north': { ca: 'nord', es: 'norte' },
  'map.side.south': { ca: 'sud', es: 'sur' },
  'map.inwardHint': {
    ca: 'Cap endins, {card}.',
    es: 'Hacia dentro, {card}.',
  },
  'map.shadowFrom': { ca: 'L’ombra arriba per', es: 'La sombra llega por' },
  'map.shadowSpeed': { ca: 'Velocitat de l’ombra', es: 'Velocidad de la sombra' },
  'map.pickHint': {
    ca: 'Toca qualsevol punt del mapa i tot es recalcula des d’allà.',
    es: 'Toca cualquier punto del mapa y todo se recalcula desde allí.',
  },
  'map.outOfBand': { ca: 'Fora de la franja', es: 'Fuera de la franja' },
  'map.edge': { ca: 'Just al caire', es: 'Justo en el borde' },
  'map.edgeNote': {
    ca: 'Ets tan a prop del límit que les efemèrides no ho poden decidir. Mou-te cap al centre de la franja.',
    es: 'Estás tan cerca del límite que las efemérides no pueden decidirlo. Muévete hacia el centro de la franja.',
  },
  'map.compare': { ca: 'Compara llocs', es: 'Compara lugares' },
  'map.compareNote': {
    ca: 'Toca un punt del mapa o tria un lloc per recalcular-ho tot des d’allà.',
    es: 'Toca un punto del mapa o elige un lugar para recalcularlo todo desde allí.',
  },

  /* --- mapa: fitxa del punt tocat ---
   *
   * Són els textos que `features/map/EclipseMap.tsx` pintava clavats en català.
   * Les etiquetes dels cinc contactes NO es repeteixen aquí: les del bloc
   * `web.*` diuen exactament el mateix i ja estan traduïdes.
   */
  'map.webglFailed': {
    ca: 'No s’ha pogut inicialitzar el mapa (cal WebGL): {error}',
    es: 'No se ha podido inicializar el mapa (hace falta WebGL): {error}',
  },
  'map.tilesFailed': {
    ca: 'No s’ha pogut carregar la cartografia. Comprova la connexió.',
    es: 'No se ha podido cargar la cartografía. Comprueba la conexión.',
  },
  /*
   * La llegenda va en dues claus i no en una amb variable perquè en català
   * «franja de anularitat» no existeix: davant de vocal, l'article s'apostrofa.
   * Una frase amb forat és exactament la manera de generar aquesta falta.
   */
  'map.legendBandTotal': { ca: 'Franja de totalitat', es: 'Franja de totalidad' },
  'map.legendBandAnnular': { ca: 'Franja d’anularitat', es: 'Franja de anularidad' },
  /* En minúscula: van dins d'una frase, no encapçalant-la. */
  'map.centralTotal': { ca: 'totalitat', es: 'totalidad' },
  'map.centralAnnular': { ca: 'anularitat', es: 'anularidad' },
  'map.creditsMap': { ca: 'Cartografia', es: 'Cartografía' },
  'map.creditsOsm': {
    ca: 'col·laboradors d’OpenStreetMap',
    es: 'colaboradores de OpenStreetMap',
  },
  'map.pickPrompt': {
    ca: 'Toca qualsevol punt del mapa i hi calcularem l’eclipsi: si hi ha {central}, quanta estona dura i a quina hora. Dins de la franja pintada la fase central és visible; fora, l’eclipsi és només parcial.',
    es: 'Toca cualquier punto del mapa y calcularemos allí el eclipse: si hay {central}, cuánto dura y a qué hora. Dentro de la franja pintada la fase central es visible; fuera, el eclipse es solo parcial.',
  },
  'map.obscuredAtMax': {
    ca: '{pct} del disc solar tapat al màxim',
    es: '{pct} del disco solar tapado en el máximo',
  },
  'map.seaLevel': { ca: 'al nivell del mar', es: 'a nivel del mar' },
  'map.nothingVisible': {
    ca: 'Des d’aquest punt no es veu res de l’eclipsi.',
    es: 'Desde este punto no se ve nada del eclipse.',
  },
  /*
   * Deia «hores locals peninsulars» i era fals a les Canàries, que és
   * justament on l'error costa una hora. Les hores les escriu `formatClock`,
   * que fa servir la zona del dispositiu; el peu ho ha de dir així.
   */
  'map.contactsNote': {
    ca: 'Hores en la zona horària del dispositiu. Les dues darreres columnes són l’altura i l’azimut del Sol.',
    es: 'Horas en la zona horaria del dispositivo. Las dos últimas columnas son la altura y el acimut del Sol.',
  },
  'map.sunBelowHorizon': {
    ca: 'Alguna de les fases passa amb el Sol sota l’horitzó: des d’aquí no es veurà l’eclipsi sencer.',
    es: 'Alguna de las fases ocurre con el Sol bajo el horizonte: desde aquí no se verá el eclipse entero.',
  },
  'map.lowSun': {
    ca: 'Sol a {alt} al màxim. A aquesta altura mana el relleu cap a ponent, no el mapa: cal comprovar l’horitzó real del punt.',
    es: 'Sol a {alt} en el máximo. A esta altura manda el relieve hacia poniente, no el mapa: hay que comprobar el horizonte real del punto.',
  },

  /* --- simulació --- */
  'sim.terrainSteals': {
    ca: 'de {total} · el terreny te’n roba {lost}',
    es: 'de {total} · el terreno te roba {lost}',
  },
  'sim.obscuredArea': {
    ca: '{pct} de l’àrea solar tapada',
    es: '{pct} del área solar tapada',
  },
  'sim.climb': {
    ca: 'El que et tapa és a {km} km i et falten {deficit} d’altura. Des d’aquí, això vol dir pujar uns {climb} m.',
    es: 'Lo que te tapa está a {km} km y te faltan {deficit} de altura. Desde aquí, eso significa subir unos {climb} m.',
  },
  'sim.terrainPending': {
    ca: 'Encara no s’ha calculat el perfil del terreny d’aquest punt: la durada que es mostra és la teòrica, amb horitzó pla.',
    es: 'Todavía no se ha calculado el perfil del terreno de este punto: la duración que se muestra es la teórica, con horizonte plano.',
  },
  'sim.timeline': {
    ca: 'Línia temporal de l’eclipsi',
    es: 'Línea temporal del eclipse',
  },
  /*
   * Les tres lectures del cursor. «Az» es deixa igual en tots dos idiomes, com
   * ja fa `camera.readout`: és l'abreviatura que es fa servir de sempre en
   * observació, i «ac» no la reconeixeria ningú.
   */
  'sim.readoutAlt': { ca: 'alt {deg}', es: 'alt {deg}' },
  'sim.readoutAz': { ca: 'Az {deg}', es: 'Az {deg}' },
  'sim.readoutObsc': { ca: 'obsc {pct}', es: 'obsc {pct}' },
  'sim.sunset': {
    ca: 'Posta de Sol a les {time}, amb horitzó pla de mar.',
    es: 'Puesta de Sol a las {time}, con horizonte plano de mar.',
  },
  'sim.sunsetBefore': {
    ca: 'El Sol es pon {gap} abans que acabi l’eclipsi. I això comptant un horitzó pla de mar: amb qualsevol relleu a ponent, en perdràs més.',
    es: 'El Sol se pone {gap} antes de que acabe el eclipse. Y eso contando un horizonte plano de mar: con cualquier relieve hacia poniente, perderás más.',
  },
  'sim.lowSun': {
    ca: 'Sol a {alt} sobre l’horitzó al màxim. A aquesta altura el terreny cap a l’oest decideix el que veuràs — el perfil real d’aquest punt encara no està calculat.',
    es: 'Sol a {alt} sobre el horizonte en el máximo. A esta altura el terreno hacia el oeste decide lo que verás — el perfil real de este punto todavía no está calculado.',
  },

  /* --- cel / càmera --- */
  'camera.title': { ca: 'El cel des d’aquí', es: 'El cielo desde aquí' },
  'camera.intro': {
    ca: 'Aixeca el mòbil cap a ponent. La capa dibuixa el recorregut del Sol sobre la imatge de la càmera i marca on el tapa el terreny.',
    es: 'Levanta el móvil hacia poniente. La capa dibuja el recorrido del Sol sobre la imagen de la cámara y marca dónde lo tapa el terreno.',
  },
  'camera.safety': {
    ca: 'Mira la pantalla, no el Sol. Ulleres ISO 12312-2 fins que vegis la corona.',
    es: 'Mira la pantalla, no el Sol. Gafas ISO 12312-2 hasta que veas la corona.',
  },
  'camera.live': { ca: 'El cel ara', es: 'El cielo ahora' },
  'camera.sim': { ca: 'Recorregut simulat', es: 'Recorrido simulado' },
  'camera.track': { ca: 'Recorregut', es: 'Recorrido' },
  'camera.free': { ca: 'Horitzó lliure', es: 'Horizonte libre' },
  'camera.blocked': { ca: 'Sol darrere obstacle', es: 'Sol tras obstáculo' },
  'camera.terrainUnknown': { ca: 'Terreny per calcular', es: 'Terreno por calcular' },
  'camera.obscured': { ca: '{n} % ocultat', es: '{n} % ocultado' },
  'camera.tools': { ca: 'Controls de la càmera', es: 'Controles de la cámara' },
  'camera.toolsHide': { ca: 'Amaga els controls', es: 'Oculta los controles' },
  /* Què veuràs en aquest instant. Frases curtes: es llegeixen de reüll. */
  'camera.phase.corona': {
    ca: 'Corona visible a ull nu.',
    es: 'Corona visible a simple vista.',
  },
  'camera.phase.ring': {
    ca: 'Anell de foc. Cal filtre igualment.',
    es: 'Anillo de fuego. Hace falta filtro igualmente.',
  },
  'camera.phase.thin': {
    ca: 'Falç molt fina. Encara cal filtre.',
    es: 'Hoz muy fina. Todavía hace falta filtro.',
  },
  'camera.phase.clear': {
    ca: 'Falç clara amb filtre.',
    es: 'Hoz clara con filtro.',
  },
  'camera.phase.bite': {
    ca: 'Mossegada al disc, imperceptible sense filtre.',
    es: 'Mordisco en el disco, imperceptible sin filtro.',
  },
  'camera.phase.none': {
    ca: 'El disc solar encara és sencer.',
    es: 'El disco solar todavía está entero.',
  },
  'camera.belowHorizon': {
    ca: 'En aquest instant el Sol ja és sota l’horitzó astronòmic.',
    es: 'En este instante el Sol ya está bajo el horizonte astronómico.',
  },
  'camera.readout': {
    ca: 'Az {az}° {card} · alt {alt}° · terreny {terrain}',
    es: 'Az {az}° {card} · alt {alt}° · terreno {terrain}',
  },

  /* --- guia --- */
  'guide.checklist': { ca: 'Què em cal portar', es: 'Qué me hace falta llevar' },
  'guide.item.glasses': {
    ca: 'Ulleres certificades ISO 12312-2',
    es: 'Gafas certificadas ISO 12312-2',
  },
  'guide.item.tripod': {
    ca: 'Trípode petit i disparador',
    es: 'Trípode pequeño y disparador',
  },
  'guide.item.battery': {
    ca: 'Bateria externa i jaqueta fina',
    es: 'Batería externa y chaqueta fina',
  },
  'guide.item.horizon': {
    ca: 'Horitzó de ponent comprovat sobre el terreny',
    es: 'Horizonte de poniente comprobado sobre el terreno',
  },
  'guide.checklistNote': {
    ca: 'La llista es desa al dispositiu i no surt d’aquí.',
    es: 'La lista se guarda en el dispositivo y no sale de aquí.',
  },
  'guide.alert': { ca: 'Avisa’m 30 min abans', es: 'Avísame 30 min antes' },
  'guide.alertPending': {
    ca: 'Encara no se sap l’hora: cal la teva posició.',
    es: 'Todavía no se sabe la hora: hace falta tu posición.',
  },
  'guide.alertOn': {
    ca: 'L’avís només sona amb l’app oberta. No hi ha notificacions del sistema.',
    es: 'El aviso solo suena con la app abierta. No hay notificaciones del sistema.',
  },
  'guide.alertAt': { ca: 'Sonarà a les {time}', es: 'Sonará a las {time}' },
  /*
   * El títol de l'avís porta una XIFRA, com exigeix el sistema: la gent obeeix
   * un número i ignora un «vés amb compte». La xifra és la durada REAL de la
   * fase central des del punt de l'usuari, no la teòrica del catàleg.
   */
  'guide.safeTitle': {
    ca: 'Només {n} s són segurs',
    es: 'Solo {n} s son seguros',
  },
  'guide.safeBody': {
    ca: 'Durant la fase central pots mirar el Sol a ull nu. Un segon abans o després, no.',
    es: 'Durante la fase central puedes mirar el Sol a simple vista. Un segundo antes o después, no.',
  },
  'guide.unsafeTitle': {
    ca: 'Cap moment és segur a ull nu',
    es: 'Ningún momento es seguro a simple vista',
  },
  'guide.unsafeBody': {
    ca: 'Des d’aquest punt no hi ha fase central. Filtre certificat de C1 a C4, sense excepció.',
    es: 'Desde este punto no hay fase central. Filtro certificado de C1 a C4, sin excepción.',
  },

  /* --- escriptori: taula d'efemèrides --- */
  'web.ephemeris': { ca: 'Efemèrides al teu punt', es: 'Efemérides en tu punto' },
  'web.c1': { ca: 'C1 · primer contacte', es: 'C1 · primer contacto' },
  'web.c2total': { ca: 'C2 · inici totalitat', es: 'C2 · inicio totalidad' },
  'web.c2annular': { ca: 'C2 · inici anularitat', es: 'C2 · inicio anularidad' },
  'web.max': { ca: 'Màxim', es: 'Máximo' },
  'web.c3total': { ca: 'C3 · fi totalitat', es: 'C3 · fin totalidad' },
  'web.c3annular': { ca: 'C3 · fi anularitat', es: 'C3 · fin anularidad' },
  'web.c4': { ca: 'C4 · últim contacte', es: 'C4 · último contacto' },
} as const satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;

/**
 * Text d'una clau en l'idioma actiu.
 *
 * PER QUÈ HI HA INTERPOLACIÓ: hi ha frases que porten una xifra al mig
 * («Cap a ponent guanyes 3 s per quilòmetre») i cada idioma la col·loca on li
 * toca. Partir la frase en trossos i concatenar-los al component és el camí
 * segur cap a un castellà amb sintaxi catalana. Els marcadors són `{nom}`,
 * igual que a `src/i18n`, però amb una sola clau perquè aquí no hi ha plurals.
 */
export function s(
  key: StringKey,
  locale: Locale,
  vars?: Readonly<Record<string, string | number>>,
): string {
  const text = STRINGS[key][locale];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}
