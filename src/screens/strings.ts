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
  'title.about': { ca: 'Com funciona', es: 'Cómo funciona' },
  'shell.eclipse': { ca: 'Tria l’eclipsi', es: 'Elige el eclipse' },
  /*
   * Sense «· MIT»: la llicència del codi encara NO està decidida (ho diu el
   * README, a la secció final). Anunciar-la a la capçalera era prometre una
   * cosa que ningú ha signat; el dia que es decideixi, es torna a dir aquí.
   */
  'shell.open': { ca: 'Dades obertes', es: 'Datos abiertos' },
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
  /*
   * L'`h1` de la portada.
   *
   * No es veu: a la portada la capçalera ensenya el logotip i el títol va
   * amagat visualment (vegeu `TopBar`). Però és el primer que llegeix un lector
   * de pantalla i el que llegeix un cercador, i allà «Eclipsi» —que és
   * l'etiqueta de la pestanya— no diu res. Aquí hi va la promesa sencera.
   */
  'home.h1': {
    ca: 'Quants segons d’eclipsi veuràs des d’on seràs',
    es: 'Cuántos segundos de eclipse verás desde donde estarás',
  },
  'home.openCamera': { ca: 'Apunta el mòbil al cel', es: 'Apunta el móvil al cielo' },
  /*
   * L'ALTERNATIVA D'ESCRIPTORI.
   *
   * A l'escriptori no hi ha càmera cap enfora ni giroscopi, la pestanya del Cel
   * no existeix i «Apunta el mòbil al cel» era un botó primari que no feia
   * absolutament res. Qui el prova conclou que l'app està trencada — que és
   * exactament la percepció que `useCameraSupport` diu voler evitar.
   *
   * En lloc seu, l'acció que de veritat toca en una pantalla gran: triar on
   * seràs. L'escriptori és on es planifica.
   */
  'home.openMap': { ca: 'Tria on seràs, al mapa', es: 'Elige dónde estarás, en el mapa' },
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
  /*
   * Quan el càlcul SAP per què ha fallat, es diu: «comprova la connexió» i
   * «alguna cosa ha petat» són dues converses diferents i el genèric les
   * aplanava totes dues. La causa arriba tal com l'ha dita qui ha fallat
   * (una frase sencera, amb punt), i per això va al final, darrere de dos
   * punts, on una frase sencera no trenca la nostra.
   */
  'horizon.failedDetail': {
    ca: 'No s’ha pogut calcular el perfil del terreny. El veredicte serà optimista, perquè assumeix horitzó pla. Causa: {error}',
    es: 'No se ha podido calcular el perfil del terreno. El veredicto será optimista, porque asume horizonte plano. Causa: {error}',
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
  /*
   * La quarta vista: el cercador de llocs.
   *
   * «Llocs» i no «Cercador» perquè el que hi trobes són llocs concrets on
   * plantar-te, i perquè a la barra segmentada hi caben quatre etiquetes de
   * mòbil justes: la paraula més curta que digui la veritat guanya.
   */
  'map.view.spots': { ca: 'Llocs', es: 'Sitios' },
  /*
   * La cinquena vista: l'alineació Sol–cim.
   *
   * «Enquadra» i no «Alineació» perquè és el que en fa qui la vol: enquadrar el
   * Sol damunt d'una cosa. La paraula tècnica la sap el motor; la barra, no cal.
   */
  'map.view.align': { ca: 'Enquadra', es: 'Encuadra' },
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
  'map.traj': {
    ca: 'El Sol des d’aquest punt',
    es: 'El Sol desde este punto',
  },
  'map.trajCta': {
    ca: 'Obre-ho al compte enrere',
    es: 'Ábrelo en la cuenta atrás',
  },
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
  /* --- mapa: crèdits i llicències ---
   *
   * El peu de pàgina (SiteFooter) només es renderitza al compte enrere i a la
   * guia; el Mapa i el Cel són pantalles senceres i no el porten, a posta.
   * Però l'atribució ODbL d'OpenStreetMap ha de poder-se obrir des d'on es fa
   * servir la dada, i la dada és justament aquesta cartografia: d'aquí el
   * botó d'informació del panell, que obre els crèdits del peu en un diàleg.
   */
  'map.credits.open': { ca: 'Crèdits i llicències', es: 'Créditos y licencias' },
  'map.credits.close': { ca: 'Tanca', es: 'Cerrar' },
  'map.credits.odbl': {
    ca: 'La cartografia i els topònims són dades d’OpenStreetMap, sota la llicència ODbL.',
    es: 'La cartografía y los topónimos son datos de OpenStreetMap, bajo la licencia ODbL.',
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

  /* --- veredicte del terreny ---
   *
   * La frase que resumeix quants segons sobreviuen al relleu. Era un camp
   * `summary` que el motor (`core/visibility/verdict.ts`) redactava en català
   * per construcció, i es pintava tal qual amb l'app en castellà. Les variants
   * total/anular van en claus SEPARADES i no amb un forat `{central}` pel
   * mateix motiu que `map.legendBandTotal`: davant de vocal l'article i la
   * preposició s'apostrofen («l'anularitat», «d'anularitat») i una frase amb
   * forat és exactament la manera de generar la falta.
   */
  'verdict.noEclipse': {
    ca: 'Des d’aquest punt no hi ha eclipsi.',
    es: 'Desde este punto no hay eclipse.',
  },
  'verdict.sunBlocked': {
    ca: 'El Sol queda darrere el terreny durant tot l’eclipsi: des d’aquí no en veuràs res.',
    es: 'El Sol queda detrás del terreno durante todo el eclipse: desde aquí no verás nada.',
  },
  'verdict.centralBlockedTotal': {
    ca: 'El terreny tapa la totalitat sencera ({total}). Com a màxim veuràs un {pct} % del Sol cobert.',
    es: 'El terreno tapa la totalidad entera ({total}). Como máximo verás un {pct} % del Sol cubierto.',
  },
  'verdict.centralBlockedAnnular': {
    ca: 'El terreny tapa l’anularitat sencera ({total}). Com a màxim veuràs un {pct} % del Sol cobert.',
    es: 'El terreno tapa la anularidad entera ({total}). Como máximo verás un {pct} % del Sol cubierto.',
  },
  'verdict.centralPartialTotal': {
    ca: 'De {total} de totalitat només en veuràs {visible}: el relleu se’n menja {lost}.',
    es: 'De {total} de totalidad solo verás {visible}: el relieve se come {lost}.',
  },
  'verdict.centralPartialAnnular': {
    ca: 'De {total} d’anularitat només en veuràs {visible}: el relleu se’n menja {lost}.',
    es: 'De {total} de anularidad solo verás {visible}: el relieve se come {lost}.',
  },
  'verdict.centralVisibleTotal': {
    ca: '{visible} de totalitat sencers per damunt del terreny.',
    es: '{visible} de totalidad enteros por encima del terreno.',
  },
  'verdict.centralVisibleAnnular': {
    ca: '{visible} d’anularitat sencers per damunt del terreny.',
    es: '{visible} de anularidad enteros por encima del terreno.',
  },
  'verdict.partialOnly': {
    ca: 'Eclipsi parcial: fins a un {pct} % del Sol cobert per damunt del terreny.',
    es: 'Eclipse parcial: hasta un {pct} % del Sol cubierto por encima del terreno.',
  },
  /* El signe de grau va DINS de la variable {deficit}, com a `sim.climb`. */
  'verdict.climb': {
    ca: 'Caldria guanyar {deficit} d’altura sobre l’horitzó (uns {climb} m amunt, amb l’obstacle a {km} km).',
    es: 'Haría falta ganar {deficit} de altura sobre el horizonte (unos {climb} m de subida, con el obstáculo a {km} km).',
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

  /* --- cel / càmera: vista de RA (`features/ar/ARView.tsx`) ---
   *
   * Tot el text d'aquesta vista era català clavat al JSX: qui triava castellà
   * rebia la pantalla diferencial del producte en català. El botó d'entrada no
   * és aquí perquè ja existia: és `home.openCamera`.
   */
  'camera.inviteNote': {
    ca: 'Hi veuràs el recorregut del Sol superposat al teu paisatge, a l’hora que triïs. La imatge no surt del telèfon.',
    es: 'Verás el recorrido del Sol superpuesto a tu paisaje, a la hora que elijas. La imagen no sale del teléfono.',
  },
  'camera.orientationDenied': {
    ca: 'Permís d’orientació denegat. A iOS s’ha de tornar a donar des de Safari.',
    es: 'Permiso de orientación denegado. En iOS hay que volver a concederlo desde Safari.',
  },
  'camera.openError': { ca: 'Càmera: {error}', es: 'Cámara: {error}' },
  'camera.lost': {
    ca: 'El sistema ha tallat la càmera —una trucada, una altra app—. Torna-la a obrir amb un toc.',
    es: 'El sistema cortó la cámara —una llamada, otra app—. Vuelve a abrirla con un toque.',
  },
  'camera.paused': { ca: 'Càmera en pausa pel sistema', es: 'Cámara en pausa por el sistema' },
  'camera.modeMixed': { ca: 'Com es veurà', es: 'Cómo se verá' },
  'camera.modeDiagram': { ca: 'Esquema', es: 'Esquema' },
  'camera.scrub': { ca: 'Instant de l’eclipsi', es: 'Instante del eclipse' },
  /* Les altres dues lectures del regle són `sim.readoutAlt` i `sim.readoutObsc`. */
  'camera.readoutLight': {
    ca: 'llum {phys}% · percebuda {perc}%',
    es: 'luz {phys}% · percibida {perc}%',
  },
  'camera.stillDaylight': {
    ca: 'Amb el {pct} del Sol tapat encara sembla de dia. La caiguda de llum de veritat arriba en els últims segons abans de la totalitat.',
    es: 'Con el {pct} del Sol tapado todavía parece de día. La caída de luz de verdad llega en los últimos segundos antes de la totalidad.',
  },
  'camera.visibleBodies': {
    ca: 'Visibles ara mateix al cel: {list}.',
    es: 'Visibles ahora mismo en el cielo: {list}.',
  },
  'camera.useMyPosition': {
    ca: 'toca-hi per fer servir la teva posició',
    es: 'tócalo para usar tu posición',
  },
  'camera.terrainNotComputed': {
    ca: 'perfil del terreny no calculat',
    es: 'perfil del terreno no calculado',
  },
  /* Deia «Amagar diagnòstic»: les etiquetes de botó van en imperatiu. */
  'camera.diagShow': { ca: 'Diagnòstic de sensors', es: 'Diagnóstico de sensores' },
  'camera.diagHide': { ca: 'Amaga el diagnòstic', es: 'Oculta el diagnóstico' },

  /* --- cel / càmera: panell de diagnòstic ---
   *
   * També és interfície, encara que el llegeixin quatre. «az» i «alt» són les
   * abreviatures d'observació de sempre i queden iguals en tots dos idiomes,
   * com ja passa a `sim.readoutAlt` i `sim.readoutAz`.
   */
  'camera.diag.headingSource': { ca: 'Font del rumb', es: 'Fuente del rumbo' },
  'camera.diag.sourceIos': {
    ca: 'webkitCompassHeading (absolut)',
    es: 'webkitCompassHeading (absoluto)',
  },
  'camera.diag.sourceAbsolute': {
    ca: 'deviceorientationabsolute (absolut)',
    es: 'deviceorientationabsolute (absoluto)',
  },
  'camera.diag.sourceRelative': {
    ca: 'alpha relativa — no fiable sense calibrar',
    es: 'alpha relativa — no fiable sin calibrar',
  },
  'camera.diag.sampleRate': { ca: 'Freqüència del sensor', es: 'Frecuencia del sensor' },
  'camera.diag.jitter': {
    ca: 'Soroll del rumb (brut → filtrat)',
    es: 'Ruido del rumbo (bruto → filtrado)',
  },
  'camera.diag.angularSpeed': { ca: 'Velocitat angular', es: 'Velocidad angular' },
  'camera.diag.angularSpeedValue': {
    ca: '{speed}°/s · tall {cutoff} Hz',
    es: '{speed}°/s · corte {cutoff} Hz',
  },
  'camera.diag.frozen': { ca: 'congelat', es: 'congelado' },
  'camera.diag.accuracy': { ca: 'Precisió declarada', es: 'Precisión declarada' },
  'camera.diag.notAvailable': { ca: 'no disponible', es: 'no disponible' },
  'camera.diag.declination': { ca: 'Declinació magnètica', es: 'Declinación magnética' },
  'camera.diag.declinationValue': {
    ca: '{deg}° aplicada a l’azimut',
    es: '{deg}° aplicada al acimut',
  },
  'camera.diag.pointing': { ca: 'Càmera apunta a', es: 'Cámara apunta a' },
  'camera.diag.pointingValue': {
    ca: 'az {az}° · alt {alt}° · gir {roll}°',
    es: 'az {az}° · alt {alt}° · giro {roll}°',
  },
  'camera.diag.sunNow': { ca: 'Sol ara', es: 'Sol ahora' },
  'camera.diag.azAlt': { ca: 'az {az}° · alt {alt}°', es: 'az {az}° · alt {alt}°' },
  'camera.diag.rawError': {
    ca: 'Error de brúixola en brut',
    es: 'Error de brújula en bruto',
  },
  'camera.diag.screenFov': {
    ca: 'Camp de visió a pantalla',
    es: 'Campo de visión en pantalla',
  },
  'camera.diag.anchor': { ca: 'Ancoratge visual', es: 'Anclaje visual' },
  'camera.diag.anchorFast': {
    ca: 'gir massa ràpid — mana el sensor',
    es: 'giro demasiado rápido — manda el sensor',
  },
  'camera.diag.anchorValue': {
    ca: '{pct}% · {blocks} blocs · residu {res} px',
    es: '{pct}% · {blocks} bloques · residuo {res} px',
  },
  'camera.diag.noTexture': { ca: 'sense textura', es: 'sin textura' },
  'camera.diag.agreement': {
    ca: 'Concordança imatge/sensor',
    es: 'Concordancia imagen/sensor',
  },
  'camera.diag.agree': {
    ca: 'les dues fonts coincideixen',
    es: 'las dos fuentes coinciden',
  },
  'camera.diag.inverted': { ca: 'SIGNE INVERTIT', es: 'SIGNO INVERTIDO' },
  'camera.diag.noSignal': {
    ca: 'sense senyal per comparar',
    es: 'sin señal para comparar',
  },
  'camera.diag.pose': { ca: 'Qui porta la postura', es: 'Quién lleva la postura' },
  'camera.diag.poseValue': {
    ca: '{source} · deriva {drift}° · estirada {tau} s',
    es: '{source} · deriva {drift}° · tirón {tau} s',
  },
  'camera.diag.bias': { ca: 'Biaix après del terreny', es: 'Sesgo aprendido del terreno' },
  'camera.diag.terrain': { ca: 'Àncora de terreny', es: 'Ancla de terreno' },
  'camera.diag.terrainValue': {
    ca: '{pct}% · {cols} columnes · fa {age} ms',
    es: '{pct}% · {cols} columnas · hace {age} ms',
  },
  'camera.diag.terrainAltOnly': { ca: 'només altura', es: 'solo altura' },
  'camera.diag.terrainNone': { ca: 'cap a la vista', es: 'ninguna a la vista' },
  'camera.diag.sunAnchor': { ca: 'Àncora de Sol', es: 'Ancla de Sol' },
  'camera.diag.sunAnchorValue': {
    ca: '{pct}% · Δaz {daz}° · Δalt {dalt}°',
    es: '{pct}% · Δaz {daz}° · Δalt {dalt}°',
  },
  'camera.diag.sunAnchorNone': { ca: 'no detectat', es: 'no detectado' },
  'camera.diag.anchorLeads': { ca: 'mana', es: 'manda' },
  'camera.close': { ca: 'Tanca la càmera', es: 'Cierra la cámara' },
  'camera.compassJitter': { ca: 'brúixola ±{deg}°', es: 'brújula ±{deg}°' },
  'camera.sunArrowLabel': { ca: 'el Sol', es: 'el Sol' },
  'camera.calibrateCoach': {
    ca: 'Brúixola marejada — mou el mòbil fent un vuit ∞',
    es: 'Brújula mareada — mueve el móvil haciendo un ocho ∞',
  },
  'camera.lockSun': { ca: 'Sol fixat', es: 'Sol fijado' },
  'camera.lockMoon': { ca: 'Lluna fixada', es: 'Luna fijada' },
  'camera.lockTerrain': { ca: 'Terreny fixat', es: 'Terreno fijado' },
  'camera.lockBoth': { ca: 'Sol + terreny', es: 'Sol + terreno' },
  'camera.capture': { ca: 'Captura i comparteix la vista', es: 'Captura y comparte la vista' },
  'map.toCenter': { ca: 'A la línia central', es: 'A la línea central' },
  /*
   * EL TEXT DEL GEST DEL MAPA, QUE DIU EL QUE EL GEST FA ARA.
   *
   * Abans prometia «sense perdre el teu punt», que era veritat mentre el clic
   * només obria una previsualització. Ara el clic ÉS el canvi de punt, i
   * deixar la frase antiga seria pitjor que no tenir-ne cap.
   */
  'map.pickNote': {
    ca: 'Toca qualsevol punt del mapa i passa a ser el teu: es recalcula tot, a totes les pantalles. Els llocs que toquis queden a l’historial.',
    es: 'Toca cualquier punto del mapa y pasa a ser el tuyo: se recalcula todo, en todas las pantallas. Los lugares que toques quedan en el historial.',
  },
  'camera.diag.slew': { ca: 'Límit de correcció', es: 'Límite de corrección' },
  'camera.diag.slewClamped': { ca: 'retallant', es: 'recortando' },
  'camera.diag.pitchDegraded': {
    ca: 'braç vertical coix — l’altura la porta el sensor',
    es: 'brazo vertical cojo — la altura la lleva el sensor',
  },
  'camera.diag.frameCost': { ca: 'Cost del dibuix', es: 'Coste del dibujo' },
  'camera.diag.pitchGain': {
    ca: 'guany pitch {gain} (obturador rodant)',
    es: 'ganancia pitch {gain} (obturador rodante)',
  },
  'camera.diag.poseVisual': { ca: 'la imatge', es: 'la imagen' },
  'camera.diag.poseSensor': { ca: 'només el sensor', es: 'solo el sensor' },
  'camera.diag.frames': { ca: 'Fotogrames de càmera', es: 'Fotogramas de cámara' },
  'camera.diag.framesCounted': { ca: 'comptats', es: 'contados' },
  'camera.diag.framesEstimated': { ca: 'estimats', es: 'estimados' },
  'camera.diag.measuredFov': {
    ca: 'Camp de visió mesurat',
    es: 'Campo de visión medido',
  },
  'camera.diag.measuredFovValue': {
    ca: '{deg}° al costat llarg · desat',
    es: '{deg}° en el lado largo · guardado',
  },
  'camera.diag.measuring': {
    ca: 'mesurant… ({n} de 6 finestres)',
    es: 'midiendo… ({n} de 6 ventanas)',
  },
  'camera.diag.lens': { ca: 'Objectiu', es: 'Objetivo' },
  'camera.diag.ultraWide': { ca: 'ULTRA-ANGULAR', es: 'ULTRA GRAN ANGULAR' },
  'camera.diag.zoom': { ca: 'zoom {min}-{max}', es: 'zoom {min}-{max}' },
  'camera.diag.sensorFov': {
    ca: 'Camp de visió del sensor: {deg}°',
    es: 'Campo de visión del sensor: {deg}°',
  },
  'camera.diag.fovNote': {
    ca: 'El camp de visió del sensor no és el que veus a la pantalla: el vídeo es mostra retallat per omplir el marc. La projecció treballa amb la distància focal en píxels, que el retall no altera.',
    es: 'El campo de visión del sensor no es el que ves en la pantalla: el vídeo se muestra recortado para llenar el marco. La proyección trabaja con la distancia focal en píxeles, que el recorte no altera.',
  },
  /*
   * La nota del soroll porta un terme destacat en negreta AL MIG de la frase.
   * El terme hi va com a marcador `{term}` i la vista el reconstrueix amb el
   * seu <strong>: partir la frase en dos literals per envoltar la negreta és
   * exactament el camí cap al castellà amb sintaxi catalana que aquest fitxer
   * diu d'evitar.
   */
  'camera.diag.noiseTerm': { ca: 'soroll del rumb', es: 'ruido del rumbo' },
  'camera.diag.noiseNote': {
    ca: 'El que decideix si això funciona és el {term}, no l’error en brut: l’error el corregeix el calibratge, però el soroll no. Amb l’ancoratge visual actiu, aquell soroll ja no arriba a la superposició mentre la imatge tingui textura; quan no en té, torna a manar el sensor i es torna a notar.',
    es: 'Lo que decide si esto funciona es el {term}, no el error en bruto: el error lo corrige la calibración, pero el ruido no. Con el anclaje visual activo, ese ruido ya no llega a la superposición mientras la imagen tenga textura; cuando no la tiene, vuelve a mandar el sensor y se vuelve a notar.',
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
  /* L'etiqueta de la nav de l'índex de la guia, i res més: els títols de les
     seccions ja arriben traduïts des de `content/guide.ts`. */
  'guide.toc': { ca: 'Índex', es: 'Índice' },
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

  /* --- guia: els tres eclipsis, des d'aquí ---
   *
   * Les xifres d'aquestes frases sempre arriben ja formatades des de la
   * pantalla (`formatDuration`, `formatDegrees`, `formatObscurationPercent`):
   * cap forat d'aquí no rep un número cru. Si es passés un número i s'hi
   * afegís la unitat dins de la frase, tornaríem a tenir una regla de format
   * escrita per separat, que és exactament el defecte que documenta
   * `core/astro/obscuration.ts`.
   */
  'three.title': { ca: 'Els tres eclipsis, des d’aquí', es: 'Los tres eclipses, desde aquí' },
  'three.intro': {
    ca: 'Els tres calculats per a les teves coordenades, no llegits de cap taula. El perfil de l’horitzó depèn del lloc i no de l’eclipsi: el mateix relleu que tens al voltant val per als tres.',
    es: 'Los tres calculados para tus coordenadas, no leídos de ninguna tabla. El perfil del horizonte depende del lugar y no del eclipse: el mismo relieve que tienes alrededor vale para los tres.',
  },
  'three.selected': { ca: 'El que tens triat', es: 'El que tienes elegido' },
  'three.max': { ca: 'Màxim', es: 'Máximo' },
  /* El que sobreviu al relleu, quan el terreny en roba una part. */
  'three.terrainEats': {
    ca: 'Des d’aquí el relleu se’n menja {lost} dels {total}.',
    es: 'Desde aquí el relieve se come {lost} de los {total}.',
  },
  /*
   * La frase que cap altra app pot dir: amb el Sol alt, el terreny deixa de
   * decidir. Les dues altures van juntes perquè la conclusió és la RESTA, i
   * donar-ne només una obligaria a creure’ns.
   */
  'three.terrainClear': {
    ca: 'Sol a {alt} i terreny a {horizon} en aquell azimut: aquí el relleu no hi compta.',
    es: 'Sol a {alt} y terreno a {horizon} en ese acimut: aquí el relieve no cuenta.',
  },
  'three.terrainPending': {
    ca: 'El perfil del terreny d’aquest punt encara no està calculat: aquestes durades són les teòriques, amb horitzó pla.',
    es: 'El perfil del terreno de este punto todavía no está calculado: estas duraciones son las teóricas, con horizonte plano.',
  },
  'three.maxBlocked': {
    ca: 'Al màxim el Sol ja queda darrere el terreny.',
    es: 'En el máximo el Sol ya queda detrás del terreno.',
  },
  'three.noCentral': {
    ca: 'Des d’aquest punt no hi ha fase central: com a màxim, {pct} del disc solar tapat.',
    es: 'Desde este punto no hay fase central: como máximo, {pct} del disco solar tapado.',
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
