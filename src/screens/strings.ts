/**
 * Textos de les quatre pantalles, en català, castellà i anglès.
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

type Entry = { ca: string; es: string; en: string };

const STRINGS = {
  /* --- navegació ---
   *
   * `tab.*` són les etiquetes de la barra inferior i `nav.*` les de qualsevol
   * altre lloc. No és duplicar: a 390 px hi ha quatre pestanyes i cadascuna té
   * 97 px, i «Compte enrere» s'hi talla a «Compte a…», que no és una etiqueta
   * sinó un accident. El sistema demana etiquetes d'una o dues paraules a la
   * barra, i el muntatge original de l'app hi posa literalment «Compte».
   */
  'tab.countdown': { ca: 'Compte', es: 'Cuenta', en: 'Countdown' },
  'tab.map': { ca: 'Mapa', es: 'Mapa', en: 'Map' },
  'tab.sky': { ca: 'Cel', es: 'Cielo', en: 'Sky' },
  'tab.guide': { ca: 'Guia', es: 'Guía', en: 'Guide' },

  'nav.countdown': { ca: 'Compte enrere', es: 'Cuenta atrás', en: 'Countdown' },
  'nav.map': { ca: 'Mapa', es: 'Mapa', en: 'Map' },
  'nav.sky': { ca: 'Cel', es: 'Cielo', en: 'Sky' },
  'nav.guide': { ca: 'Guia', es: 'Guía', en: 'Guide' },
  'nav.label': { ca: 'Seccions de l’aplicació', es: 'Secciones de la aplicación', en: 'Application sections' },

  /*
   * Títols de la barra superior. Són els del muntatge original
   * (`design-reference/ui_kits/app/index.html`): a la portada la barra porta el
   * logotip i cap títol; a la resta de pestanyes, el nom de la pantalla.
   */
  'title.map': { ca: 'Mapa de la franja', es: 'Mapa de la franja', en: 'Eclipse path map' },
  'title.sky': { ca: 'El cel ara mateix', es: 'El cielo ahora mismo', en: 'The sky right now' },
  'title.guide': { ca: 'Guia de l’eclipsi', es: 'Guía del eclipse', en: 'Eclipse guide' },
  'title.about': { ca: 'Com funciona', es: 'Cómo funciona', en: 'How it works' },
  'shell.eclipse': { ca: 'Tria l’eclipsi', es: 'Elige el eclipse', en: 'Choose the eclipse' },
  /*
   * Sense «· MIT»: la llicència del codi encara NO està decidida (ho diu el
   * README, a la secció final). Anunciar-la a la capçalera era prometre una
   * cosa que ningú ha signat; el dia que es decideixi, es torna a dir aquí.
   */
  'shell.open': { ca: 'Dades obertes', es: 'Datos abiertos', en: 'Open data' },
  'shell.band': { ca: 'Franja de centralitat', es: 'Franja de centralidad', en: 'Path of centrality' },
  'shell.crashed': {
    ca: 'Aquesta pantalla ha fallat. La resta de l’app segueix funcionant: pots canviar de pestanya o tornar-ho a provar.',
    es: 'Esta pantalla ha fallado. El resto de la app sigue funcionando: puedes cambiar de pestaña o volver a intentarlo.', en: 'This screen has failed. The rest of the app continues to work: you can change tabs or try again.',
  },
  'shell.retry': { ca: 'Torna-ho a provar', es: 'Vuelve a intentarlo', en: 'Try again' },
  'camera.crashed': {
    ca: 'La vista de càmera ha fallat. Les lectures d’aquesta pantalla segueixen essent bones: surten del càlcul, no del sensor.',
    es: 'La vista de cámara ha fallado. Las lecturas de esta pantalla siguen siendo buenas: salen del cálculo, no del sensor.', en: 'Camera view has failed. The readings on this screen are still good: they come from the calculation, not the sensor.',
  },

  /* --- comuns --- */
  'common.here': { ca: 'El teu punt', es: 'Tu punto', en: 'Your point' },
  'common.locate': { ca: 'Ubica’m', es: 'Ubícame', en: 'Locate me' },
  'common.locating': { ca: 'Cercant…', es: 'Buscando…', en: 'Searching…' },
  'common.eclipse': { ca: 'Eclipsi', es: 'Eclipse', en: 'Eclipse' },
  'common.unknownPlace': {
    ca: 'Encara no se sap on seràs.',
    es: 'Todavía no se sabe dónde estarás.', en: 'It is not yet known where you will be.',
  },
  'common.locateCta': {
    ca: 'Digues on seràs i et direm si el veuràs des d’aquell punt exacte.',
    es: 'Di dónde estarás y te diremos si lo verás desde ese punto exacto.', en: 'Say where you will be and we will tell you if you will see it from that exact point.',
  },

  /* --- tipus d'eclipsi --- */
  'kind.total': { ca: 'Totalitat', es: 'Totalidad', en: 'Totality' },
  'kind.annular': { ca: 'Anularitat', es: 'Anularidad', en: 'Annularity' },
  'kind.partial': { ca: 'Parcial', es: 'Parcial', en: 'Partial' },
  'kind.none': { ca: 'Sense eclipsi', es: 'Sin eclipse', en: 'No eclipse' },

  /* --- compte enrere --- */
  'home.untilTotality': { ca: 'Fins a la totalitat', es: 'Hasta la totalidad', en: 'Until totality' },
  'home.untilAnnularity': { ca: 'Fins a l’anularitat', es: 'Hasta la anularidad', en: 'Until annularity' },
  'home.untilMax': { ca: 'Fins al màxim', es: 'Hasta el máximo', en: 'Until maximum eclipse' },
  'home.past': { ca: 'Ha passat fa', es: 'Pasó hace', en: 'Happened' },
  'home.visibleDuration': { ca: 'Durada visible', es: 'Duración visible', en: 'Visible duration' },
  'home.theoreticalDuration': { ca: 'Durada teòrica', es: 'Duración teórica', en: 'Theoretical duration' },
  'home.obscuration': { ca: 'Ocultació', es: 'Ocultación', en: 'Obscuration' },
  'home.sunAltitude': { ca: 'Altura del Sol', es: 'Altura del Sol', en: 'Sun altitude' },
  'home.contacts': { ca: 'Contactes al teu punt', es: 'Contactos en tu punto', en: 'Contacts at your point' },
  'home.weatherAtPoint': {
    ca: 'El temps al teu punt',
    es: 'El tiempo en tu ubicación', en: 'The weather at your location',
  },
  'home.fromThisPoint': { ca: 'Des d’aquest punt', es: 'Desde este punto', en: 'From this point' },
  'home.weatherWhy': {
    ca: 'Per què dona aquest resultat',
    es: 'Por qué da este resultado', en: 'Why does it give this result?',
  },
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
    es: 'Cuántos segundos de eclipse verás desde donde estarás', en: 'How many seconds of eclipse will you see from where you will be?',
  },
  'home.openCamera': { ca: 'Apunta el mòbil al cel', es: 'Apunta el móvil al cielo', en: 'Point your phone at the sky' },
  /*
   * L'aparador de la càmera: una línia que diu QUÈ hi guanyes. És la funció
   * diferencial del producte (ESTAT §6) i un botó pelat no la venia.
   */
  'home.cameraPitch': {
    ca: 'El mode càmera superposa el Sol que vindrà al teu horitzó real: veuràs què et taparà abans que passi.',
    es: 'El modo cámara superpone el Sol que vendrá a tu horizonte real: verás qué lo tapará antes de que pase.', en: 'Camera mode superimposes the coming Sun onto your real horizon: you\'ll see what will cover it before it passes.',
  },
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
  'home.openMap': { ca: 'Tria on seràs, al mapa', es: 'Elige dónde estarás, en el mapa', en: 'Choose where you will be, on the map' },
  /*
   * La resposta a la frase del veredicte quan el terreny roba fase central:
   * el botó que obre el cercador de llocs del mapa (la vista «Llocs»). Va en
   * fantasma i no en ambre — l'accent del compte enrere ja el té la durada
   * visible — i només surt quan hi ha segons a recuperar de debò.
   */
  'home.minimap': {
    ca: 'Obre el mapa de la franja',
    es: 'Abre el mapa de la franja', en: 'Open the eclipse path map',
  },
  'home.findSpot': {
    ca: 'Busca un lloc millor a prop',
    es: 'Busca un sitio mejor cerca', en: 'Find a better place nearby',
  },
  'home.terrainPending': {
    ca: 'La durada encara és la teòrica: el perfil del terreny no està calculat i el relleu de ponent no hi entra.',
    es: 'La duración todavía es la teórica: el perfil del terreno no está calculado y el relieve de poniente no entra.', en: 'The duration is still theoretical: the terrain profile has not been calculated, so terrain to the west is not yet included.',
  },
  'home.sources': {
    ca: 'Efemèrides calculades al dispositiu amb astronomy-engine. Perfil del terreny a partir de tessel·les d’elevació. Nuvolositat d’Open-Meteo.',
    es: 'Efemérides calculadas en el dispositivo con astronomy-engine. Perfil del terreno a partir de teselas de elevación. Nubosidad de Open-Meteo.', en: 'Ephemeris calculated on the device with astronomy-engine. Terrain profile from elevation tiles. Open-Meteo cloudiness.',
  },

  /* --- núvols --- */
  'sky.clearOdds': { ca: 'Probabilitat de cel útil', es: 'Probabilidad de cielo útil', en: 'Chance of a clear view' },
  'sky.cloudsLoading': {
    ca: 'Consultant la nuvolositat…',
    es: 'Consultando la nubosidad…', en: 'Checking cloud cover…',
  },
  'sky.cloudsOffline': {
    ca: 'Sense dades de núvols. Cal xarxa per consultar-les.',
    es: 'Sin datos de nubes. Hace falta red para consultarlas.', en: 'No cloud data. A network connection is required.',
  },
  'sky.forecast': { ca: 'Previsió', es: 'Previsión', en: 'Forecast' },
  'sky.climatology': { ca: 'Climatologia', es: 'Climatología', en: 'Climatology' },
  'sky.confidence': { ca: 'Fiabilitat', es: 'Fiabilidad', en: 'Reliability' },
  'sky.confidence.high': { ca: 'alta', es: 'alta', en: 'high' },
  'sky.confidence.medium': { ca: 'mitjana', es: 'media', en: 'medium' },
  'sky.confidence.low': { ca: 'baixa', es: 'baja', en: 'low' },
  'sky.confidence.very-low': { ca: 'molt baixa', es: 'muy baja', en: 'very low' },
  'sky.clouds.low': { ca: 'Baixos', es: 'Bajos', en: 'Low' },
  'sky.clouds.mid': { ca: 'Mitjans', es: 'Medios', en: 'Mid-level' },
  'sky.clouds.high': { ca: 'Alts', es: 'Altos', en: 'High' },

  /* --- horitzó --- */
  'horizon.computing': {
    ca: 'Calculant el perfil del terreny…',
    es: 'Calculando el perfil del terreno…', en: 'Calculating the terrain profile…',
  },
  'horizon.failed': {
    ca: 'No s’ha pogut calcular el perfil del terreny. El veredicte serà optimista, perquè assumeix horitzó pla.',
    es: 'No se ha podido calcular el perfil del terreno. El veredicto será optimista, porque asume horizonte plano.', en: 'The terrain profile could not be calculated. The verdict will be optimistic, because it assumes a flat horizon.',
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
    es: 'No se ha podido calcular el perfil del terreno. El veredicto será optimista, porque asume horizonte plano. Causa: {error}', en: 'The terrain profile could not be calculated. The verdict will be optimistic, because it assumes a flat horizon. Cause: {error}',
  },
  'horizon.retry': { ca: 'Torna-ho a provar', es: 'Vuelve a intentarlo', en: 'Try again' },

  /* --- mapa --- */
  'map.title': { ca: 'Franja de centralitat', es: 'Franja de centralidad', en: 'Path of centrality' },
  /*
   * El segmentat del mapa: a la referència commutava CAPES del mapa. Aquí
   * commuta què respon la fitxa de sota, perquè `EclipseMap` només dibuixa una
   * capa i no és territori d'aquesta tasca afegir-n'hi. La pregunta que fa la
   * gent és la mateixa: on soc, quin cel hi haurà, i em convé moure'm.
   */
  'map.view.band': { ca: 'Franja', es: 'Franja', en: 'Path' },
  'map.view.clouds': { ca: 'Núvols', es: 'Nubes', en: 'Clouds' },
  'map.view.move': { ca: 'Durada', es: 'Duración', en: 'Duration' },
  /*
   * La quarta vista: el cercador de llocs.
   *
   * «Llocs» i no «Cercador» perquè el que hi trobes són llocs concrets on
   * plantar-te, i perquè a la barra segmentada hi caben quatre etiquetes de
   * mòbil justes: la paraula més curta que digui la veritat guanya.
   */
  'map.view.spots': { ca: 'On veure’l', es: 'Dónde verlo', en: 'Where to see it' },
  /*
   * La cinquena vista: l'alineació Sol–cim.
   *
   * «Enquadra» i no «Alineació» perquè és el que en fa qui la vol: enquadrar el
   * Sol damunt d'una cosa. La paraula tècnica la sap el motor; la barra, no cal.
   */
  'map.view.align': { ca: 'Enquadra', es: 'Encuadra', en: 'Frame' },
  'map.legend.band': { ca: 'Franja de centralitat', es: 'Franja de centralidad', en: 'Path of centrality' },
  'map.legend.center': { ca: 'Línia central', es: 'Línea central', en: 'Center line' },
  'map.gradientFlat': {
    ca: 'Aquí la durada gairebé no canvia: moure’s uns quilòmetres no et donarà segons.',
    es: 'Aquí la duración casi no cambia: moverse unos kilómetros no te dará segundos.', en: 'The duration barely changes here: moving a few kilometres will not gain you any time.',
  },
  'map.gradientMove': {
    ca: 'Cap a {dir} guanyes {rate} s per quilòmetre.',
    es: 'Hacia {dir} ganas {rate} s por kilómetro.', en: 'Towards {dir}, you gain {rate} s per kilometre.',
  },
  'map.gradientBest': {
    ca: 'Uns {km} km en aquesta direcció et deixarien a prop de {best}.',
    es: 'Unos {km} km en esa dirección te dejarían cerca de {best}.', en: 'About {km} km in that direction would take you near {best}.',
  },
  'map.noCentral': {
    ca: 'Des d’aquest punt no hi ha fase central: l’eclipsi és només parcial.',
    es: 'Desde este punto no hay fase central: el eclipse es solo parcial.', en: 'From this point there is no central phase: the eclipse is only partial.',
  },
  'map.attribution': {
    ca: 'Cartografia i noms de lloc d’OpenStreetMap (noms via Photon, komoot). Trajectòria de Fred Espenak, NASA GSFC.',
    es: 'Cartografía y nombres de lugar de OpenStreetMap (nombres vía Photon, komoot). Trayectoria de Fred Espenak, NASA GSFC.', en: 'OpenStreetMap mapping and place names (names via Photon, komoot). Eclipse path by Fred Espenak, NASA GSFC.',
  },
  'map.inBand': { ca: 'Dins la franja', es: 'Dentro de la franja', en: 'Inside the path' },
  'map.contacts': { ca: 'Hores en aquest punt', es: 'Horas en este punto', en: 'Times at this point' },
  'map.traj': {
    ca: 'El Sol des d’aquest punt',
    es: 'El Sol desde este punto', en: 'The Sun from this point',
  },
  'map.trajCta': {
    ca: 'Obre-ho al compte enrere',
    es: 'Ábrelo en la cuenta atrás', en: 'Open in countdown',
  },
  'map.toLimit': {
    ca: 'Al límit {side}',
    es: 'Al límite {side}', en: 'On the edge {side}',
  },
  'map.side.north': { ca: 'nord', es: 'norte', en: 'north' },
  'map.side.south': { ca: 'sud', es: 'sur', en: 'south' },
  'map.inwardHint': {
    ca: 'Cap endins, {card}.',
    es: 'Hacia dentro, {card}.', en: 'Inwards, {card}.',
  },
  'map.shadowFrom': { ca: 'L’ombra arriba per', es: 'La sombra llega por', en: 'The shadow arrives from' },
  'map.shadowSpeed': { ca: 'Velocitat de l’ombra', es: 'Velocidad de la sombra', en: 'Shadow speed' },
  'map.shadowVeryFast': { ca: 'Molt ràpida', es: 'Muy rápida', en: 'Very fast' },
  'map.sunAzimuth': { ca: 'El Sol al màxim, cap a', es: 'El Sol en el máximo, hacia', en: 'The Sun at maximum, towards' },
  'map.overTerrain': { ca: 'Marge sobre el terreny', es: 'Margen sobre el terreno', en: 'Clearance above terrain' },
  'map.terrainBlocksMax': {
    ca: 'El terreny tapa el Sol just al moment del màxim. Mira la durada visible: és el que en queda.',
    es: 'El terreno tapa el Sol justo en el momento del máximo. Mira la duración visible: es lo que queda.', en: 'The terrain blocks the Sun right at the moment of its maximum. Look at the visible duration: it\'s what\'s left.',
  },
  'map.layers.open': { ca: 'Capes del mapa', es: 'Capas del mapa', en: 'Map layers' },
  'map.layers.path': { ca: 'Recorregut de l’eclipsi', es: 'Recorrido del eclipse', en: 'Eclipse path' },
  'map.layers.pathDesc': {
    ca: 'La franja de centralitat, els límits i la línia central.',
    es: 'La franja de centralidad, los límites y la línea central.', en: 'The path of centrality, its limits and the center line.',
  },
  'map.layers.hillshade': { ca: 'Relleu ombrejat', es: 'Relieve sombreado', en: 'Shaded relief' },
  'map.layers.hillshadeDesc': {
    ca: 'Il·luminat des d’on serà el Sol al màxim del teu punt.',
    es: 'Iluminado desde donde estará el Sol en el máximo de tu punto.', en: 'Illuminated from where the Sun will be at its maximum point.',
  },
  'map.layers.cone': { ca: 'Con de visió', es: 'Cono de visión', en: 'Field of view' },
  'map.layers.coneDesc': {
    ca: 'El sector que tindràs davant, del primer contacte a l’últim.',
    es: 'El sector que tendrás delante, del primer contacto al último.', en: 'The sector that you will have in front of you, from the first contact to the last.',
  },
  'map.place.official': {
    ca: 'Punt d’observació oficial',
    es: 'Punto de observación oficial', en: 'Official observation point',
  },
  'map.place.spot': { ca: 'Lloc candidat {rank}', es: 'Sitio candidato {rank}', en: 'Candidate site {rank}' },
  'map.place.spotNoRank': { ca: 'Lloc candidat', es: 'Sitio candidato', en: 'Candidate site' },
  'map.place.clear': { ca: 'Deixa d’ensenyar aquest lloc', es: 'Deja de mostrar este lugar', en: 'Stop showing this place' },
  'map.place.openSource': { ca: 'Web oficial', es: 'Web oficial', en: 'Official website' },
  'map.place.estimated': {
    ca: 'La coordenada és aproximada: la font dona el municipi, no el recinte.',
    es: 'La coordenada es aproximada: la fuente da el municipio, no el recinto.', en: 'The coordinates are approximate: the source identifies the municipality, not the exact venue.',
  },
  'map.place.elevation': { ca: '{m} m de cota', es: '{m} m de cota', en: '{m} m elevation' },
  'map.spots.officialFirst': { ca: 'Punts oficials', es: 'Puntos oficiales', en: 'Official points' },
  'map.spots.viewpointsNext': { ca: 'Miradors i cims propers', es: 'Miradores y cumbres cercanos', en: 'Nearby viewpoints and summits' },
  'map.spots.noneOfficial': {
    ca: 'Encara no hi ha punts oficials publicats per aquest eclipsi.',
    es: 'Todavía no hay puntos oficiales publicados para este eclipse.', en: 'There are no official points posted for this eclipse yet.',
  },
  'map.spots.pick': { ca: 'Calcula aquest punt', es: 'Calcula este punto', en: 'Calculate for this point' },
  'map.spots.central': { ca: 'Fase central', es: 'Fase central', en: 'Central phase' },
  'map.spots.partial': { ca: 'Només parcial', es: 'Solo parcial', en: 'Only partial' },
  'map.spots.exact': { ca: 'Ubicació publicada', es: 'Ubicación publicada', en: 'Published location' },
  'map.spots.estimated': { ca: 'Ubicació aproximada', es: 'Ubicación aproximada', en: 'Approximate location' },
  'map.spots.booking': { ca: 'Cal reserva', es: 'Requiere reserva', en: 'Reservation required' },
  'map.spots.orderExplain': {
    ca: 'Primer, el punt oficial més proper. La fila indica si hi haurà fase central i si la coordenada és publicada o aproximada. Ser oficial no garanteix un horitzó net: calcula el punt abans de decidir.',
    es: 'Primero, el punto oficial más cercano. La fila indica si habrá fase central y si la coordenada es publicada o aproximada. Ser oficial no garantiza un horizonte despejado: calcula el punto antes de decidir.', en: 'First, the closest official point. The row indicates if there will be a central phase and if the coordinate is published or approximate. Being an official does not guarantee a clear horizon: calculate the point before deciding.',
  },
  'guide.officialNearby': {
    ca: 'Ordenats per distància des del lloc que tens seleccionat.',
    es: 'Ordenados por distancia desde el lugar que tienes seleccionado.', en: 'Sorted by distance from the place you have selected.',
  },
  'guide.officialCentral': { ca: 'Fase central', es: 'Fase central', en: 'Central phase' },
  'guide.officialPartial': { ca: 'Només parcial', es: 'Solo parcial', en: 'Only partial' },
  'map.viewpoint.viewpoint': { ca: 'Mirador senyalitzat', es: 'Mirador señalizado', en: 'Marked viewpoint' },
  'map.viewpoint.peak': { ca: 'Cim', es: 'Cumbre', en: 'Summit' },
  'map.viewpoints.osm': {
    ca: 'Miradors i cims d’OpenStreetMap (ODbL 1.0).',
    es: 'Miradores y cumbres de OpenStreetMap (ODbL 1.0).', en: 'OpenStreetMap viewpoints and summits (ODbL 1.0).',
  },
  'map.clouds.grain': {
    ca: 'Cada quadre fa 25 km i té un sol valor: el del seu centre.',
    es: 'Cada cuadro mide 25 km y tiene un solo valor: el de su centro.', en: 'Each square is 25 km wide and uses a single value sampled at its center.',
  },
  'map.layers.byView': {
    ca: 'La fletxa de durada i el caire de la franja només apareixen a la seva pestanya.',
    es: 'La flecha de duración y el borde de la franja solo aparecen en su pestaña.', en: 'The duration arrow and stripe border only appear on its tab.',
  },
  'map.layers.heat': { ca: 'Mapa de visibilitat', es: 'Mapa de visibilidad', en: 'Visibility map' },
  'map.layers.heatDesc': {
    ca: 'Quants segons sobreviuen al relleu a cada punt. Baixa relleu i triga uns segons.',
    es: 'Cuántos segundos sobreviven al relieve en cada punto. Descarga relieve y tarda unos segundos.', en: 'Visible seconds above the terrain at each point. This downloads elevation data and takes a few seconds.',
  },
  'map.layers.clouds': { ca: 'Climatologia al mapa', es: 'Climatología en el mapa', en: 'Climatology on the map' },
  'map.layers.cloudsDesc': {
    ca: 'Malla històrica de 25 km. La previsió viva és la de la fitxa del punt.',
    es: 'Malla histórica de 25 km. La previsión en vivo es la de la ficha del punto.', en: 'Historical 25 km grid. The live forecast appears in the selected point panel.',
  },
  'map.heat.legend': {
    ca: 'Segons visibles darrere el relleu (fins a {max})',
    es: 'Segundos visibles tras el relieve (hasta {max})', en: 'Visible seconds after relief (up to {max})',
  },
  'map.heat.estimate': {
    ca: 'Els quadres esvaïts són estimació sense relleu. El veredicte fi és el del teu punt.',
    es: 'Los cuadros desvaídos son estimación sin relieve. El veredicto fino es el de tu punto.', en: 'Faded squares are estimates without terrain data. The precise verdict is shown for your selected point.',
  },
  'map.layers.official': {
    ca: 'Punts d’observació oficials',
    es: 'Puntos de observación oficiales', en: 'Official observation points',
  },
  'map.layers.officialDesc': {
    ca: 'Convocatòries d’administracions i agrupacions, amb la font a la fitxa.',
    es: 'Convocatorias de administraciones y agrupaciones, con la fuente en la ficha.', en: 'Events published by public authorities and astronomy groups, with sources in each listing.',
  },
  'map.layers.viewpoints': { ca: 'Miradors i cims', es: 'Miradores y cumbres', en: 'Viewpoints and summits' },
  'map.layers.viewpointsDesc': {
    ca: 'D’OpenStreetMap. En encendre’ls es baixen un cop i queden desats.',
    es: 'De OpenStreetMap. Al encenderlos se descargan una vez y quedan guardados.', en: 'From OpenStreetMap. When you turn them on, they are downloaded once and saved.',
  },
  'map.layers.officialPartial': {
    ca: 'Aquí l’eclipsi és parcial: fora de la franja de centralitat.',
    es: 'Aquí el eclipse es parcial: fuera de la franja de centralidad.', en: 'The eclipse is partial here, outside the path of centrality.',
  },
  'map.layers.source': { ca: 'Font', es: 'Fuente', en: 'Source' },
  'map.pickHint': {
    ca: 'Toca qualsevol punt del mapa i tot es recalcula des d’allà.',
    es: 'Toca cualquier punto del mapa y todo se recalcula desde allí.', en: 'Touch any point on the map and everything is recalculated from there.',
  },
  'map.outOfBand': { ca: 'Fora de la franja', es: 'Fuera de la franja', en: 'Outside the path' },
  'map.edge': { ca: 'Just al caire', es: 'Justo en el borde', en: 'right on the edge' },
  'map.edgeNote': {
    ca: 'Ets tan a prop del límit que les efemèrides no ho poden decidir. Mou-te cap al centre de la franja.',
    es: 'Estás tan cerca del límite que las efemérides no pueden decidirlo. Muévete hacia el centro de la franja.', en: 'You are so close to the limit that the ephemerides cannot resolve it. Move towards the center of the path.',
  },
  /* --- mapa: crèdits i llicències ---
   *
   * El peu de pàgina (SiteFooter) només es renderitza al compte enrere i a la
   * guia; el Mapa i el Cel són pantalles senceres i no el porten, a posta.
   * Però l'atribució ODbL d'OpenStreetMap ha de poder-se obrir des d'on es fa
   * servir la dada, i la dada és justament aquesta cartografia: d'aquí el
   * botó d'informació del panell, que obre els crèdits del peu en un diàleg.
   */
  'map.credits.open': { ca: 'Crèdits i llicències', es: 'Créditos y licencias', en: 'Credits and licenses' },
  'map.credits.close': { ca: 'Tanca', es: 'Cerrar', en: 'Close' },
  'map.credits.odbl': {
    ca: 'La cartografia i els topònims són dades d’OpenStreetMap, sota la llicència ODbL.',
    es: 'La cartografía y los topónimos son datos de OpenStreetMap, bajo la licencia ODbL.', en: 'Cartography and place names are data from OpenStreetMap, under the ODbL license.',
  },
  'map.compare': { ca: 'Compara llocs', es: 'Compara lugares', en: 'Compare places' },
  'map.compareNote': {
    ca: 'Toca un punt del mapa o tria un lloc per recalcular-ho tot des d’allà.',
    es: 'Toca un punto del mapa o elige un lugar para recalcularlo todo desde allí.', en: 'Tap a point on the map or choose a location to recalculate everything from there.',
  },

  /* --- mapa: fitxa del punt tocat ---
   *
   * Són els textos que `features/map/EclipseMap.tsx` pintava clavats en català.
   * Les etiquetes dels cinc contactes NO es repeteixen aquí: les del bloc
   * `web.*` diuen exactament el mateix i ja estan traduïdes.
   */
  'map.webglFailed': {
    ca: 'No s’ha pogut inicialitzar el mapa (cal WebGL): {error}',
    es: 'No se ha podido inicializar el mapa (hace falta WebGL): {error}', en: 'Could not initialize map (WebGL required): {error}',
  },
  'map.tilesFailed': {
    ca: 'No s’ha pogut carregar la cartografia. Comprova la connexió.',
    es: 'No se ha podido cargar la cartografía. Comprueba la conexión.', en: 'The cartography could not be loaded. Check the connection.',
  },
  /*
   * La llegenda va en dues claus i no en una amb variable perquè en català
   * «franja de anularitat» no existeix: davant de vocal, l'article s'apostrofa.
   * Una frase amb forat és exactament la manera de generar aquesta falta.
   */
  'map.legendBandTotal': { ca: 'Franja de totalitat', es: 'Franja de totalidad', en: 'Path of totality' },
  'map.legendBandAnnular': { ca: 'Franja d’anularitat', es: 'Franja de anularidad', en: 'Path of annularity' },
  /* En minúscula: van dins d'una frase, no encapçalant-la. */
  'map.centralTotal': { ca: 'totalitat', es: 'totalidad', en: 'totality' },
  'map.centralAnnular': { ca: 'anularitat', es: 'anularidad', en: 'annularity' },
  'map.creditsMap': { ca: 'Cartografia', es: 'Cartografía', en: 'Mapping' },
  'map.creditsOsm': {
    ca: 'col·laboradors d’OpenStreetMap',
    es: 'colaboradores de OpenStreetMap', en: 'OpenStreetMap contributors',
  },
  'map.pickPrompt': {
    ca: 'Toca qualsevol punt del mapa i hi calcularem l’eclipsi: si hi ha {central}, quanta estona dura i a quina hora. Dins de la franja pintada la fase central és visible; fora, l’eclipsi és només parcial.',
    es: 'Toca cualquier punto del mapa y calcularemos allí el eclipse: si hay {central}, cuánto dura y a qué hora. Dentro de la franja pintada la fase central es visible; fuera, el eclipse es solo parcial.', en: 'Tap anywhere on the map to calculate the eclipse there: whether it has {central}, how long it lasts and at what time. The central phase is visible inside the shaded path; outside it, the eclipse is partial.',
  },
  'map.obscuredAtMax': {
    ca: '{pct} del disc solar tapat al màxim',
    es: '{pct} del disco solar tapado en el máximo', en: '{pct} of the solar disk covered at maximum',
  },
  'map.seaLevel': { ca: 'al nivell del mar', es: 'a nivel del mar', en: 'at sea level' },
  'map.nothingVisible': {
    ca: 'Des d’aquest punt no es veu res de l’eclipsi.',
    es: 'Desde este punto no se ve nada del eclipse.', en: 'From this point nothing of the eclipse can be seen.',
  },
  /*
   * Deia «hores locals peninsulars» i era fals a les Canàries, que és
   * justament on l'error costa una hora. Les hores les escriu `formatClock`,
   * que fa servir la zona del dispositiu; el peu ho ha de dir així.
   */
  'map.contactsNote': {
    ca: 'Hores en la zona horària del dispositiu. Les dues darreres columnes són l’altura i l’azimut del Sol.',
    es: 'Horas en la zona horaria del dispositivo. Las dos últimas columnas son la altura y el acimut del Sol.', en: 'Hours in the device\'s time zone. The last two columns are the altitude and azimuth of the Sun.',
  },
  'map.sunBelowHorizon': {
    ca: 'Alguna de les fases passa amb el Sol sota l’horitzó: des d’aquí no es veurà l’eclipsi sencer.',
    es: 'Alguna de las fases ocurre con el Sol bajo el horizonte: desde aquí no se verá el eclipse entero.', en: 'Some of the phases occur with the Sun below the horizon: the entire eclipse will not be seen from here.',
  },
  'map.lowSun': {
    ca: 'Sol a {alt} al màxim. A aquesta altura mana el relleu cap a ponent, no el mapa: cal comprovar l’horitzó real del punt.',
    es: 'Sol a {alt} en el máximo. A esta altura manda el relieve hacia poniente, no el mapa: hay que comprobar el horizonte real del punto.', en: 'Sun altitude at maximum: {alt}. At this low angle, terrain to the west—not the map—determines visibility, so check the actual horizon at this location.',
  },

  /* --- simulació --- */
  'sim.terrainSteals': {
    ca: 'de {total} · el terreny te’n roba {lost}',
    es: 'de {total} · el terreno te roba {lost}', en: 'of {total} · terrain takes away {lost}',
  },
  'sim.obscuredArea': {
    ca: '{pct} de l’àrea solar tapada',
    es: '{pct} del área solar tapada', en: '{pct} of the covered solar area',
  },
  'sim.climb': {
    ca: 'El que et tapa és a {km} km i et falten {deficit} d’altura. Des d’aquí, això vol dir pujar uns {climb} m.',
    es: 'Lo que te tapa está a {km} km y te faltan {deficit} de altura. Desde aquí, eso significa subir unos {climb} m.', en: 'The obstruction is {km} km away and you need another {deficit} of altitude. From here, that means climbing about {climb} m.',
  },
  'sim.terrainPending': {
    ca: 'Encara no s’ha calculat el perfil del terreny d’aquest punt: la durada que es mostra és la teòrica, amb horitzó pla.',
    es: 'Todavía no se ha calculado el perfil del terreno de este punto: la duración que se muestra es la teórica, con horizonte plano.', en: 'The terrain profile of this point has not yet been calculated: the duration shown is the theoretical one, with a flat horizon.',
  },
  'sim.timeline': {
    ca: 'Línia temporal de l’eclipsi',
    es: 'Línea temporal del eclipse', en: 'eclipse timeline',
  },
  /*
   * Les tres lectures del cursor. «Az» es deixa igual en tots dos idiomes, com
   * ja fa `camera.readout`: és l'abreviatura que es fa servir de sempre en
   * observació, i «ac» no la reconeixeria ningú.
   */
  'sim.readoutAlt': { ca: 'alt {deg}', es: 'alt {deg}', en: 'alt {deg}' },
  'sim.readoutAz': { ca: 'Az {deg}', es: 'Az {deg}', en: 'Az {deg}' },
  'sim.readoutObsc': { ca: 'obsc {pct}', es: 'obsc {pct}', en: 'obsc {pct}' },
  'sim.sunset': {
    ca: 'Posta de Sol a les {time}, amb horitzó pla de mar.',
    es: 'Puesta de Sol a las {time}, con horizonte plano de mar.', en: 'Sunset at {time}, with a flat sea horizon.',
  },
  'sim.sunsetBefore': {
    ca: 'El Sol es pon {gap} abans que acabi l’eclipsi. I això comptant un horitzó pla de mar: amb qualsevol relleu a ponent, en perdràs més.',
    es: 'El Sol se pone {gap} antes de que acabe el eclipse. Y eso contando un horizonte plano de mar: con cualquier relieve hacia poniente, perderás más.', en: 'The Sun sets {gap} before the eclipse ends. And that\'s counting a flat sea horizon: with any relief towards the west, you will lose more.',
  },
  'sim.lowSun': {
    ca: 'Sol a {alt} sobre l’horitzó al màxim. A aquesta altura el terreny cap a l’oest decideix el que veuràs — el perfil real d’aquest punt encara no està calculat.',
    es: 'Sol a {alt} sobre el horizonte en el máximo. A esta altura el terreno hacia el oeste decide lo que verás — el perfil real de este punto todavía no está calculado.', en: 'Sun at {alt} above the horizon at maximum. At this point the terrain to the west decides what you will see — the actual profile of this point is not yet calculated.',
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
    es: 'Desde este punto no hay eclipse.', en: 'From this point there is no eclipse.',
  },
  'verdict.sunBlocked': {
    ca: 'El Sol queda darrere el terreny durant tot l’eclipsi: des d’aquí no en veuràs res.',
    es: 'El Sol queda detrás del terreno durante todo el eclipse: desde aquí no verás nada.', en: 'The Sun remains behind the terrain during the entire eclipse: from here you will not see anything.',
  },
  'verdict.centralBlockedTotal': {
    ca: 'El terreny tapa la totalitat sencera ({total}). Com a màxim veuràs un {pct} % del Sol cobert.',
    es: 'El terreno tapa la totalidad entera ({total}). Como máximo verás un {pct} % del Sol cubierto.', en: 'The terrain covers the entire totality ({total}). At most you will see {pct} % of the Sun covered.',
  },
  'verdict.centralBlockedAnnular': {
    ca: 'El terreny tapa l’anularitat sencera ({total}). Com a màxim veuràs un {pct} % del Sol cobert.',
    es: 'El terreno tapa la anularidad entera ({total}). Como máximo verás un {pct} % del Sol cubierto.', en: 'The terrain covers the entire annularity ({total}). At most you will see {pct} % of the Sun covered.',
  },
  'verdict.centralPartialTotal': {
    ca: 'De {total} de totalitat només en veuràs {visible}: el relleu se’n menja {lost}.',
    es: 'De {total} de totalidad solo verás {visible}: el relieve se come {lost}.', en: 'Of {total} of totality, only {visible} will be visible: terrain blocks {lost}.',
  },
  'verdict.centralPartialAnnular': {
    ca: 'De {total} d’anularitat només en veuràs {visible}: el relleu se’n menja {lost}.',
    es: 'De {total} de anularidad solo verás {visible}: el relieve se come {lost}.', en: 'Of {total} of annularity, only {visible} will be visible: terrain blocks {lost}.',
  },
  'verdict.centralVisibleTotal': {
    ca: '{visible} de totalitat sencers per damunt del terreny.',
    es: '{visible} de totalidad enteros por encima del terreno.', en: 'The full {visible} of totality is visible above the terrain.',
  },
  'verdict.centralVisibleAnnular': {
    ca: '{visible} d’anularitat sencers per damunt del terreny.',
    es: '{visible} de anularidad enteros por encima del terreno.', en: 'The full {visible} of annularity is visible above the terrain.',
  },
  'verdict.partialOnly': {
    ca: 'Eclipsi parcial: fins a un {pct} % del Sol cobert per damunt del terreny.',
    es: 'Eclipse parcial: hasta un {pct} % del Sol cubierto por encima del terreno.', en: 'Partial eclipse: up to {pct} % of the Sun is covered above the terrain.',
  },
  /* El signe de grau va DINS de la variable {deficit}, com a `sim.climb`. */
  'verdict.climb': {
    ca: 'Caldria guanyar {deficit} d’altura sobre l’horitzó (uns {climb} m amunt, amb l’obstacle a {km} km).',
    es: 'Haría falta ganar {deficit} de altura sobre el horizonte (unos {climb} m de subida, con el obstáculo a {km} km).', en: 'It would be necessary to gain {deficit} in height above the horizon (about {climb} m of ascent, with the obstacle at {km} km).',
  },

  /* --- cel / càmera --- */
  'camera.title': { ca: 'El cel des d’aquí', es: 'El cielo desde aquí', en: 'The sky from here' },
  'camera.intro': {
    ca: 'Aixeca el mòbil cap a ponent. La capa dibuixa el recorregut del Sol sobre la imatge de la càmera i marca on el tapa el terreny.',
    es: 'Levanta el móvil hacia poniente. La capa dibuja el recorrido del Sol sobre la imagen de la cámara y marca dónde lo tapa el terreno.', en: 'Raise the mobile phone towards the west. The layer draws the path of the Sun on the camera image and marks where the terrain covers it.',
  },
  'camera.safety': {
    ca: 'Mira la pantalla, no el Sol. Ulleres ISO 12312-2 fins que vegis la corona.',
    es: 'Mira la pantalla, no el Sol. Gafas ISO 12312-2 hasta que veas la corona.', en: 'Look at the screen, not the Sun. ISO 12312-2 glasses until you see the crown.',
  },
  'camera.live': { ca: 'El cel ara', es: 'El cielo ahora', en: 'Sky now' },
  'camera.sim': { ca: 'Recorregut simulat', es: 'Recorrido simulado', en: 'Simulated path' },
  'camera.track': { ca: 'Recorregut', es: 'Recorrido', en: 'Path' },
  'camera.free': { ca: 'Horitzó lliure', es: 'Horizonte libre', en: 'free horizon' },
  'camera.blocked': { ca: 'Sol darrere obstacle', es: 'Sol tras obstáculo', en: 'Sun behind obstacle' },
  'camera.terrainUnknown': { ca: 'Terreny per calcular', es: 'Terreno por calcular', en: 'Terrain not calculated' },
  'camera.obscured': { ca: '{n} % ocultat', es: '{n} % ocultado', en: '{n} % hidden' },
  'camera.tools': { ca: 'Controls de la càmera', es: 'Controles de la cámara', en: 'Camera controls' },
  'camera.toolsHide': { ca: 'Amaga els controls', es: 'Oculta los controles', en: 'Hide controls' },
  /* Què veuràs en aquest instant. Frases curtes: es llegeixen de reüll. */
  'camera.phase.corona': {
    ca: 'Corona visible a ull nu.',
    es: 'Corona visible a simple vista.', en: 'Corona visible to the naked eye.',
  },
  'camera.phase.ring': {
    ca: 'Anell de foc. Cal filtre igualment.',
    es: 'Anillo de fuego. Hace falta filtro igualmente.', en: 'Ring of fire. You also need a filter.',
  },
  'camera.phase.thin': {
    ca: 'Falç molt fina. Encara cal filtre.',
    es: 'Hoz muy fina. Todavía hace falta filtro.', en: 'Very thin crescent. A filter is still required.',
  },
  'camera.phase.clear': {
    ca: 'Falç clara amb filtre.',
    es: 'Hoz clara con filtro.', en: 'Clear crescent through a filter.',
  },
  'camera.phase.bite': {
    ca: 'Mossegada al disc, imperceptible sense filtre.',
    es: 'Mordisco en el disco, imperceptible sin filtro.', en: 'A bite out of the disk, imperceptible without a filter.',
  },
  'camera.phase.none': {
    ca: 'El disc solar encara és sencer.',
    es: 'El disco solar todavía está entero.', en: 'The solar disk is still whole.',
  },
  'camera.belowHorizon': {
    ca: 'En aquest instant el Sol ja és sota l’horitzó astronòmic.',
    es: 'En este instante el Sol ya está bajo el horizonte astronómico.', en: 'At this moment the Sun is already below the astronomical horizon.',
  },
  'camera.readout': {
    ca: 'Az {az}° {card} · alt {alt}° · terreny {terrain}',
    es: 'Az {az}° {card} · alt {alt}° · terreno {terrain}', en: 'Az {az}° {card} · alt {alt}° · terrain {terrain}',
  },

  /* --- cel / càmera: vista de RA (`features/ar/ARView.tsx`) ---
   *
   * Tot el text d'aquesta vista era català clavat al JSX: qui triava castellà
   * rebia la pantalla diferencial del producte en català. El botó d'entrada no
   * és aquí perquè ja existia: és `home.openCamera`.
   */
  'camera.inviteNote': {
    ca: 'Hi veuràs el recorregut del Sol superposat al teu paisatge, a l’hora que triïs. La imatge no surt del telèfon.',
    es: 'Verás el recorrido del Sol superpuesto a tu paisaje, a la hora que elijas. La imagen no sale del teléfono.', en: 'You will see the path of the Sun superimposed on your landscape, at the time you choose. The image does not come out of the phone.',
  },
  'camera.orientationDenied': {
    ca: 'Permís d’orientació denegat. A iOS s’ha de tornar a donar des de Safari.',
    es: 'Permiso de orientación denegado. En iOS hay que volver a concederlo desde Safari.', en: 'Orientation permission denied. On iOS you have to grant it again from Safari.',
  },
  'camera.openError': { ca: 'Càmera: {error}', es: 'Cámara: {error}', en: 'Camera: {error}' },
  'camera.lost': {
    ca: 'El sistema ha tallat la càmera —una trucada, una altra app—. Torna-la a obrir amb un toc.',
    es: 'El sistema cortó la cámara —una llamada, otra app—. Vuelve a abrirla con un toque.', en: 'The system cut off the camera—a call, another app. Open it again with a touch.',
  },
  'camera.paused': { ca: 'Càmera en pausa pel sistema', es: 'Cámara en pausa por el sistema', en: 'Camera paused by system' },
  'camera.modeMixed': { ca: 'Com es veurà', es: 'Cómo se verá', en: 'How it will look' },
  'camera.modeDiagram': { ca: 'Esquema', es: 'Esquema', en: 'Diagram' },
  'camera.scrub': { ca: 'Instant de l’eclipsi', es: 'Instante del eclipse', en: 'Moment of the eclipse' },
  /* Les altres dues lectures del regle són `sim.readoutAlt` i `sim.readoutObsc`. */
  'camera.readoutLight': {
    ca: 'llum {phys}% · percebuda {perc}%',
    es: 'luz {phys}% · percibida {perc}%', en: 'light {phys}% · perceived {perc}%',
  },
  'camera.stillDaylight': {
    ca: 'Amb el {pct} del Sol tapat encara sembla de dia. La caiguda de llum de veritat arriba en els últims segons abans de la totalitat.',
    es: 'Con el {pct} del Sol tapado todavía parece de día. La caída de luz de verdad llega en los últimos segundos antes de la totalidad.', en: 'With the {pct} of the Sun obscured it still seems like daytime. The real light fall comes in the last few seconds before totality.',
  },
  'camera.visibleBodies': {
    ca: 'Visibles ara mateix al cel: {list}.',
    es: 'Visibles ahora mismo en el cielo: {list}.', en: 'Visible right now in the sky: {list}.',
  },
  'camera.useMyPosition': {
    ca: 'toca-hi per fer servir la teva posició',
    es: 'tócalo para usar tu posición', en: 'tap it to use your position',
  },
  'camera.terrainNotComputed': {
    ca: 'perfil del terreny no calculat',
    es: 'perfil del terreno no calculado', en: 'terrain profile not calculated',
  },
  /* Deia «Amagar diagnòstic»: les etiquetes de botó van en imperatiu. */
  'camera.diagShow': { ca: 'Diagnòstic de sensors', es: 'Diagnóstico de sensores', en: 'Sensor diagnostics' },
  'camera.diagHide': { ca: 'Amaga el diagnòstic', es: 'Oculta el diagnóstico', en: 'Hide diagnostics' },

  /* --- cel / càmera: panell de diagnòstic ---
   *
   * També és interfície, encara que el llegeixin quatre. «az» i «alt» són les
   * abreviatures d'observació de sempre i queden iguals en tots dos idiomes,
   * com ja passa a `sim.readoutAlt` i `sim.readoutAz`.
   */
  'camera.diag.headingSource': { ca: 'Font del rumb', es: 'Fuente del rumbo', en: 'Heading source' },
  'camera.diag.sourceIos': {
    ca: 'webkitCompassHeading (absolut)',
    es: 'webkitCompassHeading (absoluto)', en: 'webkitCompassHeading (absolute)',
  },
  'camera.diag.sourceAbsolute': {
    ca: 'deviceorientationabsolute (absolut)',
    es: 'deviceorientationabsolute (absoluto)', en: 'deviceorientationabsolute (absolute)',
  },
  'camera.diag.sourceRelative': {
    ca: 'alpha relativa — no fiable sense calibrar',
    es: 'alpha relativa — no fiable sin calibrar', en: 'relative alpha — unreliable uncalibrated',
  },
  'camera.diag.sampleRate': { ca: 'Freqüència del sensor', es: 'Frecuencia del sensor', en: 'Sensor frequency' },
  'camera.diag.jitter': {
    ca: 'Soroll del rumb (brut → filtrat)',
    es: 'Ruido del rumbo (bruto → filtrado)', en: 'Heading noise (raw → filtered)',
  },
  'camera.diag.angularSpeed': { ca: 'Velocitat angular', es: 'Velocidad angular', en: 'Angular velocity' },
  'camera.diag.angularSpeedValue': {
    ca: '{speed}°/s · tall {cutoff} Hz',
    es: '{speed}°/s · corte {cutoff} Hz', en: '{speed}°/s · cutoff {cutoff} Hz',
  },
  'camera.diag.frozen': { ca: 'congelat', es: 'congelado', en: 'frozen' },
  'camera.diag.accuracy': { ca: 'Precisió declarada', es: 'Precisión declarada', en: 'Declared Accuracy' },
  'camera.diag.notAvailable': { ca: 'no disponible', es: 'no disponible', en: 'not available' },
  'camera.diag.declination': { ca: 'Declinació magnètica', es: 'Declinación magnética', en: 'Magnetic declination' },
  'camera.diag.declinationValue': {
    ca: '{deg}° aplicada a l’azimut',
    es: '{deg}° aplicada al acimut', en: '{deg}° applied to azimuth',
  },
  'camera.diag.pointing': { ca: 'Càmera apunta a', es: 'Cámara apunta a', en: 'Camera points to' },
  'camera.diag.pointingValue': {
    ca: 'az {az}° · alt {alt}° · gir {roll}°',
    es: 'az {az}° · alt {alt}° · giro {roll}°', en: 'az {az}° · alt {alt}° · roll {roll}°',
  },
  'camera.diag.sunNow': { ca: 'Sol ara', es: 'Sol ahora', en: 'Sun now' },
  'camera.diag.azAlt': { ca: 'az {az}° · alt {alt}°', es: 'az {az}° · alt {alt}°', en: 'az {az}° · alt {alt}°' },
  'camera.diag.rawError': {
    ca: 'Error de brúixola en brut',
    es: 'Error de brújula en bruto', en: 'Raw compass error',
  },
  'camera.diag.screenFov': {
    ca: 'Camp de visió a pantalla',
    es: 'Campo de visión en pantalla', en: 'Field of view on screen',
  },
  'camera.diag.anchor': { ca: 'Ancoratge visual', es: 'Anclaje visual', en: 'Visual anchor' },
  'camera.diag.anchorFast': {
    ca: 'gir massa ràpid — mana el sensor',
    es: 'giro demasiado rápido — manda el sensor', en: 'turning too fast — sensor takes over',
  },
  'camera.diag.anchorValue': {
    ca: '{pct}% · {blocks} blocs · residu {res} px',
    es: '{pct}% · {blocks} bloques · residuo {res} px', en: '{pct}% · {blocks} blocks · residue {res} px',
  },
  'camera.diag.noTexture': { ca: 'sense textura', es: 'sin textura', en: 'no texture' },
  'camera.diag.agreement': {
    ca: 'Concordança imatge/sensor',
    es: 'Concordancia imagen/sensor', en: 'Image/sensor agreement',
  },
  'camera.diag.agree': {
    ca: 'les dues fonts coincideixen',
    es: 'las dos fuentes coinciden', en: 'the two sources coincide',
  },
  'camera.diag.inverted': { ca: 'SIGNE INVERTIT', es: 'SIGNO INVERTIDO', en: 'INVERTED SIGN' },
  'camera.diag.noSignal': {
    ca: 'sense senyal per comparar',
    es: 'sin señal para comparar', en: 'no signal to compare',
  },
  'camera.diag.pose': { ca: 'Qui porta la postura', es: 'Quién lleva la postura', en: 'Pose source' },
  'camera.diag.poseValue': {
    ca: '{source} · deriva {drift}° · estirada {tau} s',
    es: '{source} · deriva {drift}° · tirón {tau} s', en: '{source} · drift {drift}° · pull {tau} s',
  },
  'camera.diag.bias': { ca: 'Biaix après del terreny', es: 'Sesgo aprendido del terreno', en: 'Bias learned from terrain' },
  'camera.diag.terrain': { ca: 'Àncora de terreny', es: 'Ancla de terreno', en: 'ground anchor' },
  'camera.diag.terrainValue': {
    ca: '{pct}% · {cols} columnes · fa {age} ms',
    es: '{pct}% · {cols} columnas · hace {age} ms', en: '{pct}% · {cols} columns · {age} ms ago',
  },
  'camera.diag.terrainAltOnly': { ca: 'només altura', es: 'solo altura', en: 'height only' },
  'camera.diag.terrainNone': { ca: 'cap a la vista', es: 'ninguna a la vista', en: 'none in sight' },
  'camera.diag.sunAnchor': { ca: 'Àncora de Sol', es: 'Ancla de Sol', en: 'Sun Anchor' },
  'camera.diag.sunAnchorValue': {
    ca: '{pct}% · Δaz {daz}° · Δalt {dalt}°',
    es: '{pct}% · Δaz {daz}° · Δalt {dalt}°', en: '{pct}% · Δaz {daz}° · Δalt {dalt}°',
  },
  'camera.diag.sunAnchorNone': { ca: 'no detectat', es: 'no detectado', en: 'not detected' },
  'camera.diag.anchorLeads': { ca: 'mana', es: 'manda', en: 'leading' },
  'camera.close': { ca: 'Tanca la càmera', es: 'Cierra la cámara', en: 'Close the camera' },
  'camera.compassJitter': { ca: 'brúixola ±{deg}°', es: 'brújula ±{deg}°', en: 'compass ±{deg}°' },
  'camera.sunArrowLabel': { ca: 'Sol', es: 'Sol', en: 'Sun' },
  'camera.sunHudLocked': { ca: 'Sol fixat', es: 'Sol fijado', en: 'Sun locked' },
  'camera.calibrateCoach': {
    ca: 'Brúixola marejada — mou el mòbil fent un vuit ∞',
    es: 'Brújula mareada — mueve el móvil haciendo un ocho ∞', en: 'Compass unsettled — move your phone in a figure eight ∞',
  },
  'camera.lockSun': { ca: 'Sol fixat', es: 'Sol fijado', en: 'Sun locked' },
  'camera.lockMoon': { ca: 'Lluna fixada', es: 'Luna fijada', en: 'Moon locked' },
  'camera.lockTerrain': { ca: 'Terreny fixat', es: 'Terreno fijado', en: 'Terrain locked' },
  'camera.lockBoth': { ca: 'Sol + terreny', es: 'Sol + terreno', en: 'Sun + terrain' },
  'camera.capture': { ca: 'Captura i comparteix la vista', es: 'Captura y comparte la vista', en: 'Capture and share the view' },
  'map.toCenter': { ca: 'A la línia central', es: 'A la línea central', en: 'To the center line' },
  /*
   * EL TEXT DEL GEST DEL MAPA, QUE DIU EL QUE EL GEST FA ARA.
   *
   * Abans prometia «sense perdre el teu punt», que era veritat mentre el clic
   * només obria una previsualització. Ara el clic ÉS el canvi de punt, i
   * deixar la frase antiga seria pitjor que no tenir-ne cap.
   */
  'map.pickNote': {
    ca: 'Toca qualsevol punt del mapa i passa a ser el teu: es recalcula tot, a totes les pantalles. Els llocs que toquis queden a l’historial.',
    es: 'Toca cualquier punto del mapa y pasa a ser el tuyo: se recalcula todo, en todas las pantallas. Los lugares que toques quedan en el historial.', en: 'Touch any point on the map and it becomes yours: everything is recalculated, on all screens. The places you touch remain in your history.',
  },
  'camera.diag.slew': { ca: 'Límit de correcció', es: 'Límite de corrección', en: 'Correction limit' },
  'camera.diag.slewClamped': { ca: 'retallant', es: 'recortando', en: 'clamping' },
  'camera.diag.pitchDegraded': {
    ca: 'braç vertical coix — l’altura la porta el sensor',
    es: 'brazo vertical cojo — la altura la lleva el sensor', en: 'weak vertical baseline — altitude comes from the sensor',
  },
  'camera.diag.frameCost': { ca: 'Cost del dibuix', es: 'Coste del dibujo', en: 'Render cost' },
  'camera.diag.pitchGain': {
    ca: 'guany pitch {gain} (obturador rodant)',
    es: 'ganancia pitch {gain} (obturador rodante)', en: 'pitch gain {gain} (rolling shutter)',
  },
  'camera.diag.poseVisual': { ca: 'la imatge', es: 'la imagen', en: 'the image' },
  'camera.diag.poseSensor': { ca: 'només el sensor', es: 'solo el sensor', en: 'just the sensor' },
  'camera.diag.frames': { ca: 'Fotogrames de càmera', es: 'Fotogramas de cámara', en: 'camera frames' },
  'camera.diag.framesCounted': { ca: 'comptats', es: 'contados', en: 'counted' },
  'camera.diag.framesEstimated': { ca: 'estimats', es: 'estimados', en: 'estimated' },
  'camera.diag.measuredFov': {
    ca: 'Camp de visió mesurat',
    es: 'Campo de visión medido', en: 'Measured field of view',
  },
  'camera.diag.measuredFovValue': {
    ca: '{deg}° al costat llarg · desat',
    es: '{deg}° en el lado largo · guardado', en: '{deg}° on the long side · saved',
  },
  'camera.diag.measuring': {
    ca: 'mesurant… ({n} de 6 finestres)',
    es: 'midiendo… ({n} de 6 ventanas)', en: 'measuring… ({n} of 6 windows)',
  },
  'camera.diag.lens': { ca: 'Objectiu', es: 'Objetivo', en: 'Lens' },
  'camera.diag.ultraWide': { ca: 'ULTRA-ANGULAR', es: 'ULTRA GRAN ANGULAR', en: 'ULTRA WIDE ANGLE' },
  'camera.diag.zoom': { ca: 'zoom {min}-{max}', es: 'zoom {min}-{max}', en: 'zoom {min}-{max}' },
  'camera.diag.sensorFov': {
    ca: 'Camp de visió del sensor: {deg}°',
    es: 'Campo de visión del sensor: {deg}°', en: 'Sensor field of view: {deg}°',
  },
  'camera.diag.fovNote': {
    ca: 'El camp de visió del sensor no és el que veus a la pantalla: el vídeo es mostra retallat per omplir el marc. La projecció treballa amb la distància focal en píxels, que el retall no altera.',
    es: 'El campo de visión del sensor no es el que ves en la pantalla: el vídeo se muestra recortado para llenar el marco. La proyección trabaja con la distancia focal en píxeles, que el recorte no altera.', en: 'The sensor\'s field of view is not what you see on the screen: the video is displayed cropped to fill the frame. The projection works with the focal length in pixels, which the crop does not alter.',
  },
  /*
   * La nota del soroll porta un terme destacat en negreta AL MIG de la frase.
   * El terme hi va com a marcador `{term}` i la vista el reconstrueix amb el
   * seu <strong>: partir la frase en dos literals per envoltar la negreta és
   * exactament el camí cap al castellà amb sintaxi catalana que aquest fitxer
   * diu d'evitar.
   */
  'camera.diag.noiseTerm': { ca: 'soroll del rumb', es: 'ruido del rumbo', en: 'heading noise' },
  'camera.diag.noiseNote': {
    ca: 'El que decideix si això funciona és el {term}, no l’error en brut: l’error el corregeix el calibratge, però el soroll no. Amb l’ancoratge visual actiu, aquell soroll ja no arriba a la superposició mentre la imatge tingui textura; quan no en té, torna a manar el sensor i es torna a notar.',
    es: 'Lo que decide si esto funciona es el {term}, no el error en bruto: el error lo corrige la calibración, pero el ruido no. Con el anclaje visual activo, ese ruido ya no llega a la superposición mientras la imagen tenga textura; cuando no la tiene, vuelve a mandar el sensor y se vuelve a notar.', en: 'What decides whether this works is the {term}, not the raw error: the error is corrected by the calibration, but the noise is not. With visual anchoring active, that noise no longer reaches the overlay as long as the image is textured; When it doesn\'t have it, it sends the sensor again and it is noticed again.',
  },

  /* --- guia --- */
  'guide.checklist': { ca: 'Què em cal portar', es: 'Qué me hace falta llevar', en: 'What do I need to bring?' },
  'guide.item.glasses': {
    ca: 'Ulleres certificades ISO 12312-2',
    es: 'Gafas certificadas ISO 12312-2', en: 'ISO 12312-2 certified glasses',
  },
  'guide.item.tripod': {
    ca: 'Trípode petit i disparador',
    es: 'Trípode pequeño y disparador', en: 'Small tripod and shutter release',
  },
  'guide.item.battery': {
    ca: 'Bateria externa i jaqueta fina',
    es: 'Batería externa y chaqueta fina', en: 'Power bank and light jacket',
  },
  'guide.item.horizon': {
    ca: 'Horitzó de ponent comprovat sobre el terreny',
    es: 'Horizonte de poniente comprobado sobre el terreno', en: 'West-facing horizon checked on site',
  },
  'guide.checklistNote': {
    ca: 'La llista es desa al dispositiu i no surt d’aquí.',
    es: 'La lista se guarda en el dispositivo y no sale de aquí.', en: 'The list is saved on the device and does not leave here.',
  },
  'guide.alert': { ca: 'Avisa’m 30 min abans', es: 'Avísame 30 min antes', en: 'Alert me 30 min before' },
  'guide.alertPending': {
    ca: 'Encara no se sap l’hora: cal la teva posició.',
    es: 'Todavía no se sabe la hora: hace falta tu posición.', en: 'The time is not yet known: your position is needed.',
  },
  'guide.alertOn': {
    ca: 'L’avís només sona amb l’app oberta. No hi ha notificacions del sistema.',
    es: 'El aviso solo suena con la app abierta. No hay notificaciones del sistema.', en: 'The alert only sounds while the app is open. System notifications are not available.',
  },
  'guide.alertAt': { ca: 'Sonarà a les {time}', es: 'Sonará a las {time}', en: 'It will ring at {time}' },
  /* L'etiqueta de la nav de l'índex de la guia, i res més: els títols de les
     seccions ja arriben traduïts des de `content/guide.ts`. */
  'guide.toc': { ca: 'Índex', es: 'Índice', en: 'Index' },
  /*
   * El títol de l'avís porta una XIFRA, com exigeix el sistema: la gent obeeix
   * un número i ignora un «vés amb compte». La xifra és la durada REAL de la
   * fase central des del punt de l'usuari, no la teòrica del catàleg.
   */
  'guide.safeTitle': {
    ca: 'Només {n} s són segurs',
    es: 'Solo {n} s son seguros', en: 'Only {n}s are safe',
  },
  'guide.safeBody': {
    ca: 'Durant la fase central pots mirar el Sol a ull nu. Un segon abans o després, no.',
    es: 'Durante la fase central puedes mirar el Sol a simple vista. Un segundo antes o después, no.', en: 'During the central phase you can look at the Sun with the naked eye. A second before or after, no.',
  },
  'guide.unsafeTitle': {
    ca: 'Cap moment és segur a ull nu',
    es: 'Ningún momento es seguro a simple vista', en: 'There is no safe time to look without protection',
  },
  'guide.unsafeBody': {
    ca: 'Des d’aquest punt no hi ha fase central. Filtre certificat de C1 a C4, sense excepció.',
    es: 'Desde este punto no hay fase central. Filtro certificado de C1 a C4, sin excepción.', en: 'From this point there is no central phase. Certified filter from C1 to C4, without exception.',
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
  'three.title': { ca: 'Els tres eclipsis, des d’aquí', es: 'Los tres eclipses, desde aquí', en: 'The three eclipses, from here' },
  'three.intro': {
    ca: 'Els tres calculats per a les teves coordenades, no llegits de cap taula. El perfil de l’horitzó depèn del lloc i no de l’eclipsi: el mateix relleu que tens al voltant val per als tres.',
    es: 'Los tres calculados para tus coordenadas, no leídos de ninguna tabla. El perfil del horizonte depende del lugar y no del eclipse: el mismo relieve que tienes alrededor vale para los tres.', en: 'All three calculated for your coordinates, not read from any table. The profile of the horizon depends on the place and not the eclipse: the same relief that you have around you is valid for all three.',
  },
  'three.selected': { ca: 'El que tens triat', es: 'El que tienes elegido', en: 'The one you have chosen' },
  'three.max': { ca: 'Màxim', es: 'Máximo', en: 'Maximum' },
  /* El que sobreviu al relleu, quan el terreny en roba una part. */
  'three.terrainEats': {
    ca: 'Des d’aquí el relleu se’n menja {lost} dels {total}.',
    es: 'Desde aquí el relieve se come {lost} de los {total}.', en: 'From here, terrain blocks {lost} of the {total}.',
  },
  /*
   * La frase que cap altra app pot dir: amb el Sol alt, el terreny deixa de
   * decidir. Les dues altures van juntes perquè la conclusió és la RESTA, i
   * donar-ne només una obligaria a creure’ns.
   */
  'three.terrainClear': {
    ca: 'Sol a {alt} i terreny a {horizon} en aquell azimut: aquí el relleu no hi compta.',
    es: 'Sol a {alt} y terreno a {horizon} en ese acimut: aquí el relieve no cuenta.', en: 'Sun at {alt} and terrain at {horizon} in that azimuth: relief does not count here.',
  },
  'three.terrainPending': {
    ca: 'El perfil del terreny d’aquest punt encara no està calculat: aquestes durades són les teòriques, amb horitzó pla.',
    es: 'El perfil del terreno de este punto todavía no está calculado: estas duraciones son las teóricas, con horizonte plano.', en: 'The terrain profile of this point has not yet been calculated: these durations are theoretical, with a flat horizon.',
  },
  'three.maxBlocked': {
    ca: 'Al màxim el Sol ja queda darrere el terreny.',
    es: 'En el máximo el Sol ya queda detrás del terreno.', en: 'At maximum, the Sun is already behind the terrain.',
  },
  'three.noCentral': {
    ca: 'Des d’aquest punt no hi ha fase central: com a màxim, {pct} del disc solar tapat.',
    es: 'Desde este punto no hay fase central: como máximo, {pct} del disco solar tapado.', en: 'From this point there is no central phase: at most, {pct} of the solar disk obscured.',
  },

  /* --- escriptori: taula d'efemèrides --- */
  'web.ephemeris': { ca: 'Efemèrides al teu punt', es: 'Efemérides en tu punto', en: 'Ephemerides at your location' },
  'web.c1': { ca: 'C1 · primer contacte', es: 'C1 · primer contacto', en: 'C1 · first contact' },
  'web.c2total': { ca: 'C2 · inici totalitat', es: 'C2 · inicio totalidad', en: 'C2 · start totality' },
  'web.c2annular': { ca: 'C2 · inici anularitat', es: 'C2 · inicio anularidad', en: 'C2 · start annularity' },
  'web.max': { ca: 'Màxim', es: 'Máximo', en: 'Maximum' },
  'web.c3total': { ca: 'C3 · fi totalitat', es: 'C3 · fin totalidad', en: 'C3 · end totality' },
  'web.c3annular': { ca: 'C3 · fi anularitat', es: 'C3 · fin anularidad', en: 'C3 · end annularity' },
  'web.c4': { ca: 'C4 · últim contacte', es: 'C4 · último contacto', en: 'C4 · last contact' },
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
