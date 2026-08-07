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

type Entry = { ca: string; es: string; en: string; fr: string };

const STRINGS = {
  /* --- navegació ---
   *
   * `tab.*` són les etiquetes de la barra inferior i `nav.*` les de qualsevol
   * altre lloc. No és duplicar: a 390 px hi ha quatre pestanyes i cadascuna té
   * 97 px, i «Compte enrere» s'hi talla a «Compte a…», que no és una etiqueta
   * sinó un accident. El sistema demana etiquetes d'una o dues paraules a la
   * barra, i el muntatge original de l'app hi posa literalment «Compte».
   */
  'tab.countdown': { ca: 'Compte', es: 'Cuenta', en: 'Countdown', fr: 'Compte à rebours' },
  'tab.map': { ca: 'Mapa', es: 'Mapa', en: 'Map', fr: 'Carte' },
  'tab.sky': { ca: 'Cel', es: 'Cielo', en: 'Sky', fr: 'Ciel' },
  'tab.guide': { ca: 'Guia', es: 'Guía', en: 'Guide', fr: 'Guide' },

  'nav.countdown': { ca: 'Compte enrere', es: 'Cuenta atrás', en: 'Countdown', fr: 'Compte à rebours' },
  'nav.map': { ca: 'Mapa', es: 'Mapa', en: 'Map', fr: 'Carte' },
  'nav.sky': { ca: 'Cel', es: 'Cielo', en: 'Sky', fr: 'Ciel' },
  'nav.guide': { ca: 'Guia', es: 'Guía', en: 'Guide', fr: 'Guide' },
  'nav.label': { ca: 'Seccions de l’aplicació', es: 'Secciones de la aplicación', en: 'Application sections', fr: 'Sections de l’application' },

  /*
   * Títols de la barra superior. Són els del muntatge original
   * (`design-reference/ui_kits/app/index.html`): a la portada la barra porta el
   * logotip i cap títol; a la resta de pestanyes, el nom de la pantalla.
   */
  'title.map': { ca: 'Mapa de la franja', es: 'Mapa de la franja', en: 'Eclipse path map', fr: 'Carte du chemin de l\'éclipse' },
  'title.sky': { ca: 'El cel ara mateix', es: 'El cielo ahora mismo', en: 'The sky right now', fr: 'Le ciel en ce moment' },
  'title.guide': { ca: 'Guia de l’eclipsi', es: 'Guía del eclipse', en: 'Eclipse guide', fr: 'Guide des éclipses' },
  'title.about': { ca: 'Com funciona', es: 'Cómo funciona', en: 'How it works', fr: 'Comment ça marche' },
  'shell.eclipse': { ca: 'Tria l’eclipsi', es: 'Elige el eclipse', en: 'Choose the eclipse', fr: 'Choisissez l\'éclipse' },
  /*
   * Sense «· MIT»: la llicència del codi encara NO està decidida (ho diu el
   * README, a la secció final). Anunciar-la a la capçalera era prometre una
   * cosa que ningú ha signat; el dia que es decideixi, es torna a dir aquí.
   */
  'shell.open': { ca: 'Dades obertes', es: 'Datos abiertos', en: 'Open data', fr: 'Données ouvertes' },
  'shell.band': { ca: 'Franja de centralitat', es: 'Franja de centralidad', en: 'Path of centrality', fr: 'Chemin de la centralité' },
  'shell.crashed': {
    ca: 'Aquesta pantalla ha fallat. La resta de l’app segueix funcionant: pots canviar de pestanya o tornar-ho a provar.',
    es: 'Esta pantalla ha fallado. El resto de la app sigue funcionando: puedes cambiar de pestaña o volver a intentarlo.', en: 'This screen has failed. The rest of the app continues to work: you can change tabs or try again.', fr: 'Cet écran a échoué. Le reste de l\'application continue de fonctionner : vous pouvez changer d\'onglet ou réessayer.',
  },
  'shell.retry': { ca: 'Torna-ho a provar', es: 'Vuelve a intentarlo', en: 'Try again', fr: 'Essayer à nouveau' },
  'camera.crashed': {
    ca: 'La vista de càmera ha fallat. Les lectures d’aquesta pantalla segueixen essent bones: surten del càlcul, no del sensor.',
    es: 'La vista de cámara ha fallado. Las lecturas de esta pantalla siguen siendo buenas: salen del cálculo, no del sensor.', en: 'Camera view has failed. The readings on this screen are still good: they come from the calculation, not the sensor.', fr: 'La vue de la caméra a échoué. Les lectures sur cet écran sont toujours bonnes : elles proviennent du calcul, pas du capteur.',
  },

  /* --- comuns --- */
  'common.here': { ca: 'El teu punt', es: 'Tu punto', en: 'Your point', fr: 'Votre point' },
  'common.locate': { ca: 'Ubica’m', es: 'Ubícame', en: 'Locate me', fr: 'Me localiser' },
  'common.locating': { ca: 'Cercant…', es: 'Buscando…', en: 'Searching…', fr: 'Recherche…' },
  'common.eclipse': { ca: 'Eclipsi', es: 'Eclipse', en: 'Eclipse', fr: 'Éclipse' },
  'common.unknownPlace': {
    ca: 'Encara no se sap on seràs.',
    es: 'Todavía no se sabe dónde estarás.', en: 'It is not yet known where you will be.', fr: 'On ne sait pas encore où vous serez.',
  },
  'common.locateCta': {
    ca: 'Digues on seràs i et direm si el veuràs des d’aquell punt exacte.',
    es: 'Di dónde estarás y te diremos si lo verás desde ese punto exacto.', en: 'Say where you will be and we will tell you if you will see it from that exact point.', fr: 'Dites où vous serez et nous vous dirons si vous le verrez de ce point précis.',
  },

  /* --- tipus d'eclipsi --- */
  'kind.total': { ca: 'Totalitat', es: 'Totalidad', en: 'Totality', fr: 'Totalité' },
  'kind.annular': { ca: 'Anularitat', es: 'Anularidad', en: 'Annularity', fr: 'Annularité' },
  'kind.partial': { ca: 'Parcial', es: 'Parcial', en: 'Partial', fr: 'Partiel' },
  'kind.none': { ca: 'Sense eclipsi', es: 'Sin eclipse', en: 'No eclipse', fr: 'Pas d\'éclipse' },

  /* --- compte enrere --- */
  'home.untilTotality': { ca: 'Fins a la totalitat', es: 'Hasta la totalidad', en: 'Until totality', fr: 'Jusqu\'à la totalité' },
  'home.untilAnnularity': { ca: 'Fins a l’anularitat', es: 'Hasta la anularidad', en: 'Until annularity', fr: 'Jusqu\'à l\'annularité' },
  'home.untilMax': { ca: 'Fins al màxim', es: 'Hasta el máximo', en: 'Until maximum eclipse', fr: 'Jusqu\'à l\'éclipse maximale' },
  'home.past': { ca: 'Ha passat fa', es: 'Pasó hace', en: 'Happened', fr: 'Passé il y a' },
  'home.visibleDuration': { ca: 'Durada visible', es: 'Duración visible', en: 'Visible duration', fr: 'Durée visible' },
  'home.theoreticalDuration': { ca: 'Durada teòrica', es: 'Duración teórica', en: 'Theoretical duration', fr: 'Durée théorique' },
  'home.obscuration': { ca: 'Ocultació', es: 'Ocultación', en: 'Obscuration', fr: 'Obscurcissement' },
  'home.sunAltitude': { ca: 'Altura del Sol', es: 'Altura del Sol', en: 'Sun altitude', fr: 'Altitude du Soleil' },
  'home.contacts': { ca: 'Contactes al teu punt', es: 'Contactos en tu punto', en: 'Contacts at your point', fr: 'Contacts à votre emplacement' },
  'home.weatherAtPoint': {
    ca: 'El temps al teu punt',
    es: 'El tiempo en tu ubicación', en: 'The weather at your location', fr: 'La météo à votre emplacement',
  },
  'home.fromThisPoint': { ca: 'Des d’aquest punt', es: 'Desde este punto', en: 'From this point', fr: 'Depuis cet emplacement' },
  'home.weatherWhy': {
    ca: 'Per què dona aquest resultat',
    es: 'Por qué da este resultado', en: 'Why does it give this result?', fr: 'Pourquoi donne-t-il ce résultat ?',
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
    es: 'Cuántos segundos de eclipse verás desde donde estarás', en: 'How many seconds of eclipse will you see from where you will be?', fr: 'Combien de secondes d’éclipse verrez-vous d’où vous serez ?',
  },
  'home.openCamera': { ca: 'Apunta el mòbil al cel', es: 'Apunta el móvil al cielo', en: 'Point your phone at the sky', fr: 'Pointez votre téléphone vers le ciel' },
  /*
   * L'aparador de la càmera: una línia que diu QUÈ hi guanyes. És la funció
   * diferencial del producte (ESTAT §6) i un botó pelat no la venia.
   */
  'home.cameraPitch': {
    ca: 'El mode càmera superposa el Sol que vindrà al teu horitzó real: veuràs què et taparà abans que passi.',
    es: 'El modo cámara superpone el Sol que vendrá a tu horizonte real: verás qué lo tapará antes de que pase.', en: 'Camera mode superimposes the coming Sun onto your real horizon: you\'ll see what will cover it before it passes.', fr: 'Le mode caméra superpose le Soleil qui arrive sur votre horizon réel : vous verrez ce qui le couvrira avant son passage.',
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
  'home.openMap': { ca: 'Tria on seràs, al mapa', es: 'Elige dónde estarás, en el mapa', en: 'Choose where you will be, on the map', fr: 'Choisissez où vous serez, sur la carte' },
  /*
   * La resposta a la frase del veredicte quan el terreny roba fase central:
   * el botó que obre el cercador de llocs del mapa (la vista «Llocs»). Va en
   * fantasma i no en ambre — l'accent del compte enrere ja el té la durada
   * visible — i només surt quan hi ha segons a recuperar de debò.
   */
  'home.minimap': {
    ca: 'Obre el mapa de la franja',
    es: 'Abre el mapa de la franja', en: 'Open the eclipse path map', fr: 'Ouvrez la carte du chemin de l\'éclipse',
  },
  'home.findSpot': {
    ca: 'Busca un lloc millor a prop',
    es: 'Busca un sitio mejor cerca', en: 'Find a better place nearby', fr: 'Trouver un meilleur endroit à proximité',
  },
  'home.terrainPending': {
    ca: 'La durada encara és la teòrica: el perfil del terreny no està calculat i el relleu de ponent no hi entra.',
    es: 'La duración todavía es la teórica: el perfil del terreno no está calculado y el relieve de poniente no entra.', en: 'The duration is still theoretical: the terrain profile has not been calculated, so terrain to the west is not yet included.', fr: 'La durée est encore théorique : le profil du terrain n\'a pas été calculé, donc le terrain à l\'ouest n\'est pas encore inclus.',
  },
  'home.sources': {
    ca: 'Efemèrides calculades al dispositiu amb astronomy-engine. Perfil del terreny a partir de tessel·les d’elevació. Nuvolositat d’Open-Meteo.',
    es: 'Efemérides calculadas en el dispositivo con astronomy-engine. Perfil del terreno a partir de teselas de elevación. Nubosidad de Open-Meteo.', en: 'Ephemeris calculated on the device with astronomy-engine. Terrain profile from elevation tiles. Open-Meteo cloudiness.', fr: 'Éphémérides calculées sur l\'appareil avec moteur d\'astronomie. Profil de terrain à partir de tuiles d\'élévation. Nébulosité d\'Open-Meteo.',
  },

  /* --- núvols --- */
  'sky.clearOdds': { ca: 'Probabilitat de cel útil', es: 'Probabilidad de cielo útil', en: 'Chance of a clear view', fr: 'Chance d\'avoir une vue dégagée' },
  'sky.cloudsLoading': {
    ca: 'Consultant la nuvolositat…',
    es: 'Consultando la nubosidad…', en: 'Checking cloud cover…', fr: 'Vérification de la couverture nuageuse…',
  },
  'sky.cloudsOffline': {
    ca: 'Sense dades de núvols. Cal xarxa per consultar-les.',
    es: 'Sin datos de nubes. Hace falta red para consultarlas.', en: 'No cloud data. A network connection is required.', fr: 'Aucune donnée nuageuse. Une connexion réseau est requise.',
  },
  'sky.forecast': { ca: 'Previsió', es: 'Previsión', en: 'Forecast', fr: 'Prévision' },
  'sky.climatology': { ca: 'Climatologia', es: 'Climatología', en: 'Climatology', fr: 'Climatologie' },
  'sky.confidence': { ca: 'Fiabilitat', es: 'Fiabilidad', en: 'Reliability', fr: 'Fiabilité' },
  'sky.confidence.high': { ca: 'alta', es: 'alta', en: 'high', fr: 'haut' },
  'sky.confidence.medium': { ca: 'mitjana', es: 'media', en: 'medium', fr: 'moyen' },
  'sky.confidence.low': { ca: 'baixa', es: 'baja', en: 'low', fr: 'faible' },
  'sky.confidence.very-low': { ca: 'molt baixa', es: 'muy baja', en: 'very low', fr: 'très faible' },
  'sky.clouds.low': { ca: 'Baixos', es: 'Bajos', en: 'Low', fr: 'Faible' },
  'sky.clouds.mid': { ca: 'Mitjans', es: 'Medios', en: 'Mid-level', fr: 'Niveau intermédiaire' },
  'sky.clouds.high': { ca: 'Alts', es: 'Altos', en: 'High', fr: 'Haut' },

  /* --- horitzó --- */
  'horizon.computing': {
    ca: 'Calculant el perfil del terreny…',
    es: 'Calculando el perfil del terreno…', en: 'Calculating the terrain profile…', fr: 'Calcul du profil du terrain…',
  },
  'horizon.failed': {
    ca: 'No s’ha pogut calcular el perfil del terreny. El veredicte serà optimista, perquè assumeix horitzó pla.',
    es: 'No se ha podido calcular el perfil del terreno. El veredicto será optimista, porque asume horizonte plano.', en: 'The terrain profile could not be calculated. The verdict will be optimistic, because it assumes a flat horizon.', fr: 'Le profil du terrain n\'a pas pu être calculé. Le verdict sera optimiste, car il suppose un horizon plat.',
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
    es: 'No se ha podido calcular el perfil del terreno. El veredicto será optimista, porque asume horizonte plano. Causa: {error}', en: 'The terrain profile could not be calculated. The verdict will be optimistic, because it assumes a flat horizon. Cause: {error}', fr: 'Le profil du terrain n\'a pas pu être calculé. Le verdict sera optimiste, car il suppose un horizon plat. Cause : {error}',
  },
  'horizon.retry': { ca: 'Torna-ho a provar', es: 'Vuelve a intentarlo', en: 'Try again', fr: 'Essayer à nouveau' },

  /* --- mapa --- */
  'map.title': { ca: 'Franja de centralitat', es: 'Franja de centralidad', en: 'Path of centrality', fr: 'Chemin de la centralité' },
  /*
   * El segmentat del mapa: a la referència commutava CAPES del mapa. Aquí
   * commuta què respon la fitxa de sota, perquè `EclipseMap` només dibuixa una
   * capa i no és territori d'aquesta tasca afegir-n'hi. La pregunta que fa la
   * gent és la mateixa: on soc, quin cel hi haurà, i em convé moure'm.
   */
  'map.view.band': { ca: 'Franja', es: 'Franja', en: 'Path', fr: 'Chemin' },
  'map.view.clouds': { ca: 'Núvols', es: 'Nubes', en: 'Clouds', fr: 'Nuages' },
  'map.view.move': { ca: 'Durada', es: 'Duración', en: 'Duration', fr: 'Durée' },
  /*
   * La quarta vista: el cercador de llocs.
   *
   * «Llocs» i no «Cercador» perquè el que hi trobes són llocs concrets on
   * plantar-te, i perquè a la barra segmentada hi caben quatre etiquetes de
   * mòbil justes: la paraula més curta que digui la veritat guanya.
   */
  'map.view.spots': { ca: 'On veure’l', es: 'Dónde verlo', en: 'Where to see it', fr: 'Où le voir' },
  /*
   * La cinquena vista: l'alineació Sol–cim.
   *
   * «Enquadra» i no «Alineació» perquè és el que en fa qui la vol: enquadrar el
   * Sol damunt d'una cosa. La paraula tècnica la sap el motor; la barra, no cal.
   */
  'map.view.align': { ca: 'Enquadra', es: 'Encuadra', en: 'Frame', fr: 'Cadre' },
  'map.legend.band': { ca: 'Franja de centralitat', es: 'Franja de centralidad', en: 'Path of centrality', fr: 'Chemin de la centralité' },
  'map.legend.center': { ca: 'Línia central', es: 'Línea central', en: 'Center line', fr: 'Ligne médiane' },
  'map.gradientFlat': {
    ca: 'Aquí la durada gairebé no canvia: moure’s uns quilòmetres no et donarà segons.',
    es: 'Aquí la duración casi no cambia: moverse unos kilómetros no te dará segundos.', en: 'The duration barely changes here: moving a few kilometres will not gain you any time.', fr: 'La durée ne change guère ici : parcourir quelques kilomètres ne vous fera pas gagner de temps.',
  },
  'map.gradientMove': {
    ca: 'Cap a {dir} guanyes {rate} s per quilòmetre.',
    es: 'Hacia {dir} ganas {rate} s por kilómetro.', en: 'Towards {dir}, you gain {rate} s per kilometre.', fr: 'Vers {dir}, vous gagnez {rate} s par kilomètre.',
  },
  'map.gradientBest': {
    ca: 'Uns {km} km en aquesta direcció et deixarien a prop de {best}.',
    es: 'Unos {km} km en esa dirección te dejarían cerca de {best}.', en: 'About {km} km in that direction would take you near {best}.', fr: 'Environ {km} km dans cette direction vous mèneraient près de {best}.',
  },
  'map.noCentral': {
    ca: 'Des d’aquest punt no hi ha fase central: l’eclipsi és només parcial.',
    es: 'Desde este punto no hay fase central: el eclipse es solo parcial.', en: 'From this point there is no central phase: the eclipse is only partial.', fr: 'A partir de ce point, il n\'y a plus de phase centrale : l\'éclipse n\'est que partielle.',
  },
  'map.attribution': {
    ca: 'Cartografia i noms de lloc d’OpenStreetMap (noms via Photon, komoot). Trajectòria de Fred Espenak, NASA GSFC.',
    es: 'Cartografía y nombres de lugar de OpenStreetMap (nombres vía Photon, komoot). Trayectoria de Fred Espenak, NASA GSFC.', en: 'OpenStreetMap mapping and place names (names via Photon, komoot). Eclipse path by Fred Espenak, NASA GSFC.', fr: 'Cartographie OpenStreetMap et noms de lieux (noms via Photon, komoot). Trajectoire de l\'éclipse par Fred Espenak, NASA GSFC.',
  },
  'map.inBand': { ca: 'Dins la franja', es: 'Dentro de la franja', en: 'Inside the path', fr: 'À l\'intérieur du chemin' },
  'map.contacts': { ca: 'Hores en aquest punt', es: 'Horas en este punto', en: 'Times at this point', fr: 'Horaires à cet emplacement' },
  'map.traj': {
    ca: 'El Sol des d’aquest punt',
    es: 'El Sol desde este punto', en: 'The Sun from this point', fr: 'Le Soleil à partir de ce point',
  },
  'map.trajCta': {
    ca: 'Obre-ho al compte enrere',
    es: 'Ábrelo en la cuenta atrás', en: 'Open in countdown', fr: 'Ouvrir dans le compte à rebours',
  },
  'map.streetView': {
    ca: 'Veure Google Street View',
    es: 'Ver Google Street View', en: 'See Google Street View', fr: 'Voir Google Street View',
  },
  'map.toLimit': {
    ca: 'Al límit {side}',
    es: 'Al límite {side}', en: 'On the edge {side}', fr: 'Sur le bord {side}',
  },
  'map.side.north': { ca: 'nord', es: 'norte', en: 'north', fr: 'nord' },
  'map.side.south': { ca: 'sud', es: 'sur', en: 'south', fr: 'sud' },
  'map.inwardHint': {
    ca: 'Cap endins, {card}.',
    es: 'Hacia dentro, {card}.', en: 'Inwards, {card}.', fr: 'Vers l\'intérieur, {card}.',
  },
  'map.shadowFrom': { ca: 'L’ombra arriba per', es: 'La sombra llega por', en: 'The shadow arrives from', fr: 'L\'ombre arrive de' },
  'map.shadowSpeed': { ca: 'Velocitat de l’ombra', es: 'Velocidad de la sombra', en: 'Shadow speed', fr: 'Vitesse de l\'ombre' },
  'map.shadowVeryFast': { ca: 'Molt ràpida', es: 'Muy rápida', en: 'Very fast', fr: 'Très rapide' },
  'map.sunAzimuth': { ca: 'El Sol al màxim, cap a', es: 'El Sol en el máximo, hacia', en: 'The Sun at maximum, towards', fr: 'Le Soleil au maximum, vers' },
  'map.overTerrain': { ca: 'Marge sobre el terreny', es: 'Margen sobre el terreno', en: 'Clearance above terrain', fr: 'Dégagement au-dessus du terrain' },
  'map.terrainBlocksMax': {
    ca: 'El terreny tapa el Sol just al moment del màxim. Mira la durada visible: és el que en queda.',
    es: 'El terreno tapa el Sol justo en el momento del máximo. Mira la duración visible: es lo que queda.', en: 'The terrain blocks the Sun right at the moment of its maximum. Look at the visible duration: it\'s what\'s left.', fr: 'Le terrain bloque le Soleil juste au moment de son maximum. Regardez la durée visible : c\'est ce qui reste.',
  },
  'map.layers.open': { ca: 'Capes del mapa', es: 'Capas del mapa', en: 'Map layers', fr: 'Couches de carte' },
  'map.layers.path': { ca: 'Recorregut de l’eclipsi', es: 'Recorrido del eclipse', en: 'Eclipse path', fr: 'Chemin de l\'éclipse' },
  'map.layers.pathDesc': {
    ca: 'La franja de centralitat, els límits i la línia central.',
    es: 'La franja de centralidad, los límites y la línea central.', en: 'The path of centrality, its limits and the center line.', fr: 'Le chemin de la centralité, ses limites et la ligne médiane.',
  },
  'map.layers.hillshade': { ca: 'Relleu ombrejat', es: 'Relieve sombreado', en: 'Shaded relief', fr: 'Relief ombré' },
  'map.layers.hillshadeDesc': {
    ca: 'Il·luminat des d’on serà el Sol al màxim del teu punt.',
    es: 'Iluminado desde donde estará el Sol en el máximo de tu punto.', en: 'Illuminated from where the Sun will be at its maximum point.', fr: 'Illuminé d\'où le Soleil sera à son point maximum.',
  },
  'map.layers.cone': { ca: 'Con de visió', es: 'Cono de visión', en: 'Field of view', fr: 'Champ de vision' },
  'map.layers.coneDesc': {
    ca: 'El sector que tindràs davant, del primer contacte a l’últim.',
    es: 'El sector que tendrás delante, del primer contacto al último.', en: 'The sector that you will have in front of you, from the first contact to the last.', fr: 'Le secteur que vous aurez devant vous, du premier contact au dernier.',
  },
  'map.place.official': {
    ca: 'Punt d’observació oficial',
    es: 'Punto de observación oficial', en: 'Official observation point', fr: 'Point d\'observation officiel',
  },
  'map.place.spot': { ca: 'Lloc candidat {rank}', es: 'Sitio candidato {rank}', en: 'Candidate site {rank}', fr: 'Site candidat {rank}' },
  'map.place.spotNoRank': { ca: 'Lloc candidat', es: 'Sitio candidato', en: 'Candidate site', fr: 'Site candidat' },
  'map.place.clear': { ca: 'Deixa d’ensenyar aquest lloc', es: 'Deja de mostrar este lugar', en: 'Stop showing this place', fr: 'Arrêtez de montrer cet endroit' },
  'map.place.openSource': { ca: 'Web oficial', es: 'Web oficial', en: 'Official website', fr: 'Site officiel' },
  'map.place.estimated': {
    ca: 'La coordenada és aproximada: la font dona el municipi, no el recinte.',
    es: 'La coordenada es aproximada: la fuente da el municipio, no el recinto.', en: 'The coordinates are approximate: the source identifies the municipality, not the exact venue.', fr: 'Les coordonnées sont approximatives : la source identifie la commune, pas le lieu exact.',
  },
  'map.place.elevation': { ca: '{m} m de cota', es: '{m} m de cota', en: '{m} m elevation', fr: '{m} m d\'altitude' },
  'map.spots.officialFirst': { ca: 'Punts oficials', es: 'Puntos oficiales', en: 'Official points', fr: 'Points officiels' },
  'map.spots.viewpointsNext': { ca: 'Miradors i cims propers', es: 'Miradores y cumbres cercanos', en: 'Nearby viewpoints and summits', fr: 'Points de vue et sommets à proximité' },
  'map.spots.noneOfficial': {
    ca: 'Encara no hi ha punts oficials publicats per aquest eclipsi.',
    es: 'Todavía no hay puntos oficiales publicados para este eclipse.', en: 'There are no official points posted for this eclipse yet.', fr: 'Il n’y a pas encore de points officiels affichés pour cette éclipse.',
  },
  'map.spots.pick': { ca: 'Calcula aquest punt', es: 'Calcula este punto', en: 'Calculate for this point', fr: 'Calculer pour ce point' },
  'map.spots.central': { ca: 'Fase central', es: 'Fase central', en: 'Central phase', fr: 'Phase centrale' },
  'map.spots.partial': { ca: 'Només parcial', es: 'Solo parcial', en: 'Only partial', fr: 'Seulement partiel' },
  'map.spots.exact': { ca: 'Ubicació publicada', es: 'Ubicación publicada', en: 'Published location', fr: 'Emplacement publié' },
  'map.spots.estimated': { ca: 'Ubicació aproximada', es: 'Ubicación aproximada', en: 'Approximate location', fr: 'Localisation approximative' },
  'map.spots.booking': { ca: 'Cal reserva', es: 'Requiere reserva', en: 'Reservation required', fr: 'Réservation obligatoire' },
  'map.spots.orderExplain': {
    ca: 'Primer, el punt oficial més proper. La fila indica si hi haurà fase central i si la coordenada és publicada o aproximada. Ser oficial no garanteix un horitzó net: calcula el punt abans de decidir.',
    es: 'Primero, el punto oficial más cercano. La fila indica si habrá fase central y si la coordenada es publicada o aproximada. Ser oficial no garantiza un horizonte despejado: calcula el punto antes de decidir.', en: 'First, the closest official point. The row indicates if there will be a central phase and if the coordinate is published or approximate. Being an official does not guarantee a clear horizon: calculate the point before deciding.', fr: 'Tout d’abord, le point officiel le plus proche. La ligne indique s\'il y aura une phase centrale et si la coordonnée est publiée ou approximative. Being an official does not guarantee a clear horizon: calculate the point before deciding.',
  },
  'guide.officialNearby': {
    ca: 'Ordenats per distància des del lloc que tens seleccionat.',
    es: 'Ordenados por distancia desde el lugar que tienes seleccionado.', en: 'Sorted by distance from the place you have selected.', fr: 'Triés par distance du lieu que vous avez sélectionné.',
  },
  'guide.officialCentral': { ca: 'Fase central', es: 'Fase central', en: 'Central phase', fr: 'Phase centrale' },
  'guide.officialPartial': { ca: 'Només parcial', es: 'Solo parcial', en: 'Only partial', fr: 'Seulement partiel' },
  'map.viewpoint.viewpoint': { ca: 'Mirador senyalitzat', es: 'Mirador señalizado', en: 'Marked viewpoint', fr: 'Point de vue balisé' },
  'map.viewpoint.peak': { ca: 'Cim', es: 'Cumbre', en: 'Summit', fr: 'Sommet' },
  'map.viewpoints.osm': {
    ca: 'Miradors i cims d’OpenStreetMap (ODbL 1.0).',
    es: 'Miradores y cumbres de OpenStreetMap (ODbL 1.0).', en: 'OpenStreetMap viewpoints and summits (ODbL 1.0).', fr: 'Points de vue et sommets OpenStreetMap (ODbL 1.0).',
  },
  'map.clouds.grain': {
    ca: 'Cada quadre fa 25 km i té un sol valor: el del seu centre.',
    es: 'Cada cuadro mide 25 km y tiene un solo valor: el de su centro.', en: 'Each square is 25 km wide and uses a single value sampled at its center.', fr: 'Chaque carré mesure 25 km de large et utilise une seule valeur échantillonnée en son centre.',
  },
  'map.layers.byView': {
    ca: 'La fletxa de durada i el caire de la franja només apareixen a la seva pestanya.',
    es: 'La flecha de duración y el borde de la franja solo aparecen en su pestaña.', en: 'The duration arrow and stripe border only appear on its tab.', fr: 'La flèche de durée et la bordure de bande n\'apparaissent que sur son onglet.',
  },
  'map.layers.heat': { ca: 'Mapa de visibilitat', es: 'Mapa de visibilidad', en: 'Visibility map', fr: 'Carte de visibilité' },
  'map.layers.heatDesc': {
    ca: 'Quants segons sobreviuen al relleu a cada punt. Baixa relleu i triga uns segons.',
    es: 'Cuántos segundos sobreviven al relieve en cada punto. Descarga relieve y tarda unos segundos.', en: 'Visible seconds above the terrain at each point. This downloads elevation data and takes a few seconds.', fr: 'Secondes visibles au-dessus du terrain à chaque point. Cela télécharge les données d\'altitude et prend quelques secondes.',
  },
  'map.layers.clouds': { ca: 'Climatologia al mapa', es: 'Climatología en el mapa', en: 'Climatology on the map', fr: 'Climatologie sur la carte' },
  'map.layers.cloudsDesc': {
    ca: 'Malla històrica de 25 km. La previsió viva és la de la fitxa del punt.',
    es: 'Malla histórica de 25 km. La previsión en vivo es la de la ficha del punto.', en: 'Historical 25 km grid. The live forecast appears in the selected point panel.', fr: 'Grille historique de 25 km. La prévision en direct apparaît dans le panneau du point sélectionné.',
  },
  'map.heat.legend': {
    ca: 'Segons visibles darrere el relleu (fins a {max})',
    es: 'Segundos visibles tras el relieve (hasta {max})', en: 'Visible seconds after relief (up to {max})', fr: 'Visible quelques secondes après le soulagement (jusqu\'à {max})',
  },
  'map.heat.estimate': {
    ca: 'Els quadres esvaïts són estimació sense relleu. El veredicte fi és el del teu punt.',
    es: 'Los cuadros desvaídos son estimación sin relieve. El veredicto fino es el de tu punto.', en: 'Faded squares are estimates without terrain data. The precise verdict is shown for your selected point.', fr: 'Les carrés estompés sont des estimations sans données de terrain. Le verdict précis est affiché pour votre point sélectionné.',
  },
  'map.layers.official': {
    ca: 'Punts d’observació oficials',
    es: 'Puntos de observación oficiales', en: 'Official observation points', fr: 'Points d\'observation officiels',
  },
  'map.layers.officialDesc': {
    ca: 'Convocatòries d’administracions i agrupacions, amb la font a la fitxa.',
    es: 'Convocatorias de administraciones y agrupaciones, con la fuente en la ficha.', en: 'Events published by public authorities and astronomy groups, with sources in each listing.', fr: 'Événements publiés par les pouvoirs publics et les groupes d\'astronomie, avec des sources dans chaque liste.',
  },
  'map.layers.viewpoints': { ca: 'Miradors i cims', es: 'Miradores y cumbres', en: 'Viewpoints and summits', fr: 'Points de vue et sommets' },
  'map.layers.viewpointsDesc': {
    ca: 'D’OpenStreetMap. En encendre’ls es baixen un cop i queden desats.',
    es: 'De OpenStreetMap. Al encenderlos se descargan una vez y quedan guardados.', en: 'From OpenStreetMap. When you turn them on, they are downloaded once and saved.', fr: 'Depuis OpenStreetMap. Lorsque vous les activez, ils sont téléchargés une fois et enregistrés.',
  },
  'map.layers.officialPartial': {
    ca: 'Aquí l’eclipsi és parcial: fora de la franja de centralitat.',
    es: 'Aquí el eclipse es parcial: fuera de la franja de centralidad.', en: 'The eclipse is partial here, outside the path of centrality.', fr: 'L’éclipse est ici partielle, hors du chemin de la centralité.',
  },
  'map.layers.source': { ca: 'Font', es: 'Fuente', en: 'Source', fr: 'Source' },
  'map.pickHint': {
    ca: 'Toca qualsevol punt del mapa i tot es recalcula des d’allà.',
    es: 'Toca cualquier punto del mapa y todo se recalcula desde allí.', en: 'Touch any point on the map and everything is recalculated from there.', fr: 'Touchez n\'importe quel point de la carte et tout est recalculé à partir de là.',
  },
  'map.outOfBand': { ca: 'Fora de la franja', es: 'Fuera de la franja', en: 'Outside the path', fr: 'Hors de la bande' },
  'map.edge': { ca: 'Just al caire', es: 'Justo en el borde', en: 'right on the edge', fr: 'juste au bord' },
  'map.edgeNote': {
    ca: 'Ets tan a prop del límit que les efemèrides no ho poden decidir. Mou-te cap al centre de la franja.',
    es: 'Estás tan cerca del límite que las efemérides no pueden decidirlo. Muévete hacia el centro de la franja.', en: 'You are so close to the limit that the ephemerides cannot resolve it. Move towards the center of the path.', fr: 'Vous êtes si proche de la limite que les éphémérides ne peuvent pas la résoudre. Avancez vers le centre du chemin.',
  },
  /* --- mapa: crèdits i llicències ---
   *
   * El peu de pàgina (SiteFooter) només es renderitza al compte enrere i a la
   * guia; el Mapa i el Cel són pantalles senceres i no el porten, a posta.
   * Però l'atribució ODbL d'OpenStreetMap ha de poder-se obrir des d'on es fa
   * servir la dada, i la dada és justament aquesta cartografia: d'aquí el
   * botó d'informació del panell, que obre els crèdits del peu en un diàleg.
   */
  'map.credits.open': { ca: 'Crèdits i llicències', es: 'Créditos y licencias', en: 'Credits and licenses', fr: 'Crédits et licences' },
  'map.credits.close': { ca: 'Tanca', es: 'Cerrar', en: 'Close', fr: 'Fermer' },
  'map.credits.odbl': {
    ca: 'La cartografia i els topònims són dades d’OpenStreetMap, sota la llicència ODbL.',
    es: 'La cartografía y los topónimos son datos de OpenStreetMap, bajo la licencia ODbL.', en: 'Cartography and place names are data from OpenStreetMap, under the ODbL license.', fr: 'La cartographie et la toponymie sont des données issues d\'OpenStreetMap, sous licence ODbL.',
  },
  'map.compare': { ca: 'Compara llocs', es: 'Compara lugares', en: 'Compare places', fr: 'Comparer les lieux' },
  'map.compareNote': {
    ca: 'Toca un punt del mapa o tria un lloc per recalcular-ho tot des d’allà.',
    es: 'Toca un punto del mapa o elige un lugar para recalcularlo todo desde allí.', en: 'Tap a point on the map or choose a location to recalculate everything from there.', fr: 'Appuyez sur un point sur la carte ou choisissez un emplacement pour tout recalculer à partir de là.',
  },

  /* --- mapa: fitxa del punt tocat ---
   *
   * Són els textos que `features/map/EclipseMap.tsx` pintava clavats en català.
   * Les etiquetes dels cinc contactes NO es repeteixen aquí: les del bloc
   * `web.*` diuen exactament el mateix i ja estan traduïdes.
   */
  'map.webglFailed': {
    ca: 'No s’ha pogut inicialitzar el mapa (cal WebGL): {error}',
    es: 'No se ha podido inicializar el mapa (hace falta WebGL): {error}', en: 'Could not initialize map (WebGL required): {error}', fr: 'Impossible d\'initialiser la carte (WebGL requis) : {error}',
  },
  'map.tilesFailed': {
    ca: 'No s’ha pogut carregar la cartografia. Comprova la connexió.',
    es: 'No se ha podido cargar la cartografía. Comprueba la conexión.', en: 'The cartography could not be loaded. Check the connection.', fr: 'La cartographie n\'a pas pu être chargée. Vérifiez la connexion.',
  },
  /*
   * La llegenda va en dues claus i no en una amb variable perquè en català
   * «franja de anularitat» no existeix: davant de vocal, l'article s'apostrofa.
   * Una frase amb forat és exactament la manera de generar aquesta falta.
   */
  'map.legendBandTotal': { ca: 'Franja de totalitat', es: 'Franja de totalidad', en: 'Path of totality', fr: 'Chemin de totalité' },
  'map.legendBandAnnular': { ca: 'Franja d’anularitat', es: 'Franja de anularidad', en: 'Path of annularity', fr: 'Chemin d\'annularité' },
  /* En minúscula: van dins d'una frase, no encapçalant-la. */
  'map.centralTotal': { ca: 'totalitat', es: 'totalidad', en: 'totality', fr: 'totalité' },
  'map.centralAnnular': { ca: 'anularitat', es: 'anularidad', en: 'annularity', fr: 'annularité' },
  'map.creditsMap': { ca: 'Cartografia', es: 'Cartografía', en: 'Mapping', fr: 'Cartographie' },
  'map.creditsOsm': {
    ca: 'col·laboradors d’OpenStreetMap',
    es: 'colaboradores de OpenStreetMap', en: 'OpenStreetMap contributors', fr: 'Contributeurs d\'OpenStreetMap',
  },
  'map.pickPrompt': {
    ca: 'Toca qualsevol punt del mapa i hi calcularem l’eclipsi: si hi ha {central}, quanta estona dura i a quina hora. Dins de la franja pintada la fase central és visible; fora, l’eclipsi és només parcial.',
    es: 'Toca cualquier punto del mapa y calcularemos allí el eclipse: si hay {central}, cuánto dura y a qué hora. Dentro de la franja pintada la fase central es visible; fuera, el eclipse es solo parcial.', en: 'Tap anywhere on the map to calculate the eclipse there: whether it has {central}, how long it lasts and at what time. The central phase is visible inside the shaded path; outside it, the eclipse is partial.', fr: 'Appuyez n\'importe où sur la carte pour y calculer l\'éclipse : si elle a {central}, combien de temps elle dure et à quelle heure. La phase centrale est visible à l\'intérieur du chemin ombragé ; à l\'extérieur, l\'éclipse est partielle.',
  },
  'map.obscuredAtMax': {
    ca: '{pct} del disc solar tapat al màxim',
    es: '{pct} del disco solar tapado en el máximo', en: '{pct} of the solar disk covered at maximum', fr: '{pct} du disque solaire couvert au maximum',
  },
  'map.seaLevel': { ca: 'al nivell del mar', es: 'a nivel del mar', en: 'at sea level', fr: 'au niveau de la mer' },
  'map.nothingVisible': {
    ca: 'Des d’aquest punt no es veu res de l’eclipsi.',
    es: 'Desde este punto no se ve nada del eclipse.', en: 'From this point nothing of the eclipse can be seen.', fr: 'De ce point, rien de l’éclipse n’est visible.',
  },
  /*
   * Deia «hores locals peninsulars» i era fals a les Canàries, que és
   * justament on l'error costa una hora. Les hores les escriu `formatClock`,
   * que fa servir la zona del dispositiu; el peu ho ha de dir així.
   */
  'map.contactsNote': {
    ca: 'Hores en la zona horària del dispositiu. Les dues darreres columnes són l’altura i l’azimut del Sol.',
    es: 'Horas en la zona horaria del dispositivo. Las dos últimas columnas son la altura y el acimut del Sol.', en: 'Hours in the device\'s time zone. The last two columns are the altitude and azimuth of the Sun.', fr: 'Heures dans le fuseau horaire de l’appareil. Les deux dernières colonnes correspondent à l\'altitude et à l\'azimut du Soleil.',
  },
  'map.sunBelowHorizon': {
    ca: 'Alguna de les fases passa amb el Sol sota l’horitzó: des d’aquí no es veurà l’eclipsi sencer.',
    es: 'Alguna de las fases ocurre con el Sol bajo el horizonte: desde aquí no se verá el eclipse entero.', en: 'Some of the phases occur with the Sun below the horizon: the entire eclipse will not be seen from here.', fr: 'Certaines phases se produisent lorsque le Soleil est au-dessous de l\'horizon : l\'éclipse entière ne sera pas visible d\'ici.',
  },
  'map.lowSun': {
    ca: 'Sol a {alt} al màxim. A aquesta altura mana el relleu cap a ponent, no el mapa: cal comprovar l’horitzó real del punt.',
    es: 'Sol a {alt} en el máximo. A esta altura manda el relieve hacia poniente, no el mapa: hay que comprobar el horizonte real del punto.', en: 'Sun altitude at maximum: {alt}. At this low angle, terrain to the west—not the map—determines visibility, so check the actual horizon at this location.', fr: 'Altitude du soleil au maximum : {alt}. À cet angle faible, c\'est le terrain à l\'ouest (et non la carte) qui détermine la visibilité. Vérifiez donc l\'horizon réel à cet endroit.',
  },

  /* --- simulació --- */
  'sim.terrainSteals': {
    ca: 'de {total} · el terreny te’n roba {lost}',
    es: 'de {total} · el terreno te roba {lost}', en: 'of {total} · terrain takes away {lost}', fr: 'sur {total} · le terrain enlève {lost}',
  },
  'sim.obscuredArea': {
    ca: '{pct} de l’àrea solar tapada',
    es: '{pct} del área solar tapada', en: '{pct} of the covered solar area', fr: '{pct} de la surface solaire couverte',
  },
  'sim.climb': {
    ca: 'El que et tapa és a {km} km i et falten {deficit} d’altura. Des d’aquí, això vol dir pujar uns {climb} m.',
    es: 'Lo que te tapa está a {km} km y te faltan {deficit} de altura. Desde aquí, eso significa subir unos {climb} m.', en: 'The obstruction is {km} km away and you need another {deficit} of altitude. From here, that means climbing about {climb} m.', fr: 'L\'obstacle est à {km} km et vous avez besoin d\'un autre {deficit} d\'altitude. À partir de là, cela signifie grimper environ {climb} m.',
  },
  'sim.terrainPending': {
    ca: 'Encara no s’ha calculat el perfil del terreny d’aquest punt: la durada que es mostra és la teòrica, amb horitzó pla.',
    es: 'Todavía no se ha calculado el perfil del terreno de este punto: la duración que se muestra es la teórica, con horizonte plano.', en: 'The terrain profile of this point has not yet been calculated: the duration shown is the theoretical one, with a flat horizon.', fr: 'Le profil du terrain de ce point n\'a pas encore été calculé : la durée indiquée est la durée théorique, avec un horizon plat.',
  },
  'sim.timeline': {
    ca: 'Línia temporal de l’eclipsi',
    es: 'Línea temporal del eclipse', en: 'eclipse timeline', fr: 'chronologie de l\'éclipse',
  },
  /*
   * Les tres lectures del cursor. «Az» es deixa igual en tots dos idiomes, com
   * ja fa `camera.readout`: és l'abreviatura que es fa servir de sempre en
   * observació, i «ac» no la reconeixeria ningú.
   */
  'sim.readoutAlt': { ca: 'alt {deg}', es: 'alt {deg}', en: 'alt {deg}', fr: 'alt {deg}' },
  'sim.readoutAz': { ca: 'Az {deg}', es: 'Az {deg}', en: 'Az {deg}', fr: 'Az {deg}' },
  'sim.readoutObsc': { ca: 'obsc {pct}', es: 'obsc {pct}', en: 'obsc {pct}', fr: 'obsc {pct}' },
  'sim.sunset': {
    ca: 'Posta de Sol a les {time}, amb horitzó pla de mar.',
    es: 'Puesta de Sol a las {time}, con horizonte plano de mar.', en: 'Sunset at {time}, with a flat sea horizon.', fr: 'Coucher de soleil à {time}, avec un horizon marin plat.',
  },
  'sim.sunsetBefore': {
    ca: 'El Sol es pon {gap} abans que acabi l’eclipsi. I això comptant un horitzó pla de mar: amb qualsevol relleu a ponent, en perdràs més.',
    es: 'El Sol se pone {gap} antes de que acabe el eclipse. Y eso contando un horizonte plano de mar: con cualquier relieve hacia poniente, perderás más.', en: 'The Sun sets {gap} before the eclipse ends. And that\'s counting a flat sea horizon: with any relief towards the west, you will lose more.', fr: 'Le Soleil se couche {gap} avant la fin de l\'éclipse. Et c\'est sans compter un horizon marin plat : avec tout relief vers l\'ouest, vous perdrez davantage.',
  },
  'sim.lowSun': {
    ca: 'Sol a {alt} sobre l’horitzó al màxim. A aquesta altura el terreny cap a l’oest decideix el que veuràs — el perfil real d’aquest punt encara no està calculat.',
    es: 'Sol a {alt} sobre el horizonte en el máximo. A esta altura el terreno hacia el oeste decide lo que verás — el perfil real de este punto todavía no está calculado.', en: 'Sun at {alt} above the horizon at maximum. At this point the terrain to the west decides what you will see — the actual profile of this point is not yet calculated.', fr: 'Soleil à {alt} au-dessus de l\'horizon au maximum. À ce stade, le terrain à l’ouest décide de ce que vous verrez – le profil réel de ce point n’est pas encore calculé.',
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
    es: 'Desde este punto no hay eclipse.', en: 'From this point there is no eclipse.', fr: 'A partir de ce point, il n’y a plus d’éclipse.',
  },
  'verdict.sunBlocked': {
    ca: 'El Sol queda darrere el terreny durant tot l’eclipsi: des d’aquí no en veuràs res.',
    es: 'El Sol queda detrás del terreno durante todo el eclipse: desde aquí no verás nada.', en: 'The Sun remains behind the terrain during the entire eclipse: from here you will not see anything.', fr: 'Le Soleil reste derrière le terrain pendant toute la durée de l\'éclipse : d\'ici vous ne verrez rien.',
  },
  'verdict.centralBlockedTotal': {
    ca: 'El terreny tapa la totalitat sencera ({total}). Com a màxim veuràs un {pct} % del Sol cobert.',
    es: 'El terreno tapa la totalidad entera ({total}). Como máximo verás un {pct} % del Sol cubierto.', en: 'The terrain covers the entire totality ({total}). At most you will see {pct} % of the Sun covered.', fr: 'Le terrain couvre la totalité ({total}). Au maximum, vous verrez {pct} % du Soleil couvert.',
  },
  'verdict.centralBlockedAnnular': {
    ca: 'El terreny tapa l’anularitat sencera ({total}). Com a màxim veuràs un {pct} % del Sol cobert.',
    es: 'El terreno tapa la anularidad entera ({total}). Como máximo verás un {pct} % del Sol cubierto.', en: 'The terrain covers the entire annularity ({total}). At most you will see {pct} % of the Sun covered.', fr: 'Le terrain couvre toute l\'annularité ({total}). Au maximum, vous verrez {pct} % du Soleil couvert.',
  },
  'verdict.centralPartialTotal': {
    ca: 'De {total} de totalitat només en veuràs {visible}: el relleu se’n menja {lost}.',
    es: 'De {total} de totalidad solo verás {visible}: el relieve se come {lost}.', en: 'Of {total} of totality, only {visible} will be visible: terrain blocks {lost}.', fr: 'Sur {total} de la totalité, seuls {visible} seront visibles : blocs de terrain {lost}.',
  },
  'verdict.centralPartialAnnular': {
    ca: 'De {total} d’anularitat només en veuràs {visible}: el relleu se’n menja {lost}.',
    es: 'De {total} de anularidad solo verás {visible}: el relieve se come {lost}.', en: 'Of {total} of annularity, only {visible} will be visible: terrain blocks {lost}.', fr: 'Sur {total} d\'annularité, seul {visible} sera visible : blocs de terrain {lost}.',
  },
  'verdict.centralVisibleTotal': {
    ca: '{visible} de totalitat sencers per damunt del terreny.',
    es: '{visible} de totalidad enteros por encima del terreno.', en: 'The full {visible} of totality is visible above the terrain.', fr: 'Le plein {visible} de la totalité est visible au-dessus du terrain.',
  },
  'verdict.centralVisibleAnnular': {
    ca: '{visible} d’anularitat sencers per damunt del terreny.',
    es: '{visible} de anularidad enteros por encima del terreno.', en: 'The full {visible} of annularity is visible above the terrain.', fr: 'La totalité {visible} de l\'annularité est visible au-dessus du terrain.',
  },
  'verdict.partialOnly': {
    ca: 'Eclipsi parcial: fins a un {pct} % del Sol cobert per damunt del terreny.',
    es: 'Eclipse parcial: hasta un {pct} % del Sol cubierto por encima del terreno.', en: 'Partial eclipse: up to {pct} % of the Sun is covered above the terrain.', fr: 'Éclipse partielle : jusqu\'à {pct} % du Soleil est couvert au-dessus du terrain.',
  },
  /* El signe de grau va DINS de la variable {deficit}, com a `sim.climb`. */
  'verdict.climb': {
    ca: 'Caldria guanyar {deficit} d’altura sobre l’horitzó (uns {climb} m amunt, amb l’obstacle a {km} km).',
    es: 'Haría falta ganar {deficit} de altura sobre el horizonte (unos {climb} m de subida, con el obstáculo a {km} km).', en: 'It would be necessary to gain {deficit} in height above the horizon (about {climb} m of ascent, with the obstacle at {km} km).', fr: 'Il faudrait gagner {deficit} de hauteur au dessus de l\'horizon (environ {climb} m de dénivelé positif, avec l\'obstacle à {km} km).',
  },

  /* --- cel / càmera --- */
  'camera.title': { ca: 'El cel des d’aquí', es: 'El cielo desde aquí', en: 'The sky from here', fr: 'Le ciel d\'ici' },
  'camera.intro': {
    ca: 'Aixeca el mòbil cap a ponent. La capa dibuixa el recorregut del Sol sobre la imatge de la càmera i marca on el tapa el terreny.',
    es: 'Levanta el móvil hacia poniente. La capa dibuja el recorrido del Sol sobre la imagen de la cámara y marca dónde lo tapa el terreno.', en: 'Raise the mobile phone towards the west. The layer draws the path of the Sun on the camera image and marks where the terrain covers it.', fr: 'Soulevez le téléphone portable vers l\'ouest. Le calque dessine la trajectoire du Soleil sur l\'image de la caméra et marque l\'endroit où le terrain le recouvre.',
  },
  'camera.safety': {
    ca: 'Mira la pantalla, no el Sol. Ulleres ISO 12312-2 fins que vegis la corona.',
    es: 'Mira la pantalla, no el Sol. Gafas ISO 12312-2 hasta que veas la corona.', en: 'Look at the screen, not the Sun. ISO 12312-2 glasses until you see the crown.', fr: 'Regardez l\'écran, pas le Soleil. Lunettes ISO 12312-2 jusqu\'à ce que vous voyiez la couronne.',
  },
  'camera.live': { ca: 'El cel ara', es: 'El cielo ahora', en: 'Sky now', fr: 'Ciel maintenant' },
  'camera.sim': { ca: 'Recorregut simulat', es: 'Recorrido simulado', en: 'Simulated path', fr: 'Chemin simulé' },
  'camera.track': { ca: 'Recorregut', es: 'Recorrido', en: 'Path', fr: 'Chemin' },
  'camera.free': { ca: 'Horitzó lliure', es: 'Horizonte libre', en: 'free horizon', fr: 'horizon libre' },
  'camera.blocked': { ca: 'Sol darrere obstacle', es: 'Sol tras obstáculo', en: 'Sun behind obstacle', fr: 'Soleil derrière un obstacle' },
  'camera.terrainUnknown': { ca: 'Terreny per calcular', es: 'Terreno por calcular', en: 'Terrain not calculated', fr: 'Terrain non calculé' },
  'camera.obscured': { ca: '{n} % ocultat', es: '{n} % ocultado', en: '{n} % hidden', fr: '{n} % masqué' },
  'camera.tools': { ca: 'Controls de la càmera', es: 'Controles de la cámara', en: 'Camera controls', fr: 'Commandes de la caméra' },
  'camera.toolsHide': { ca: 'Amaga els controls', es: 'Oculta los controles', en: 'Hide controls', fr: 'Masquer les contrôles' },
  /* Què veuràs en aquest instant. Frases curtes: es llegeixen de reüll. */
  'camera.phase.corona': {
    ca: 'Corona visible a ull nu.',
    es: 'Corona visible a simple vista.', en: 'Corona visible to the naked eye.', fr: 'Couronne visible à l\'œil nu.',
  },
  'camera.phase.ring': {
    ca: 'Anell de foc. Cal filtre igualment.',
    es: 'Anillo de fuego. Hace falta filtro igualmente.', en: 'Ring of fire. You also need a filter.', fr: 'Anneau de feu. Vous avez également besoin d\'un filtre.',
  },
  'camera.phase.thin': {
    ca: 'Falç molt fina. Encara cal filtre.',
    es: 'Hoz muy fina. Todavía hace falta filtro.', en: 'Very thin crescent. A filter is still required.', fr: 'Croissant très fin. Un filtre est toujours nécessaire.',
  },
  'camera.phase.clear': {
    ca: 'Falç clara amb filtre.',
    es: 'Hoz clara con filtro.', en: 'Clear crescent through a filter.', fr: 'Clair croissant à travers un filtre.',
  },
  'camera.phase.bite': {
    ca: 'Mossegada al disc, imperceptible sense filtre.',
    es: 'Mordisco en el disco, imperceptible sin filtro.', en: 'A bite out of the disk, imperceptible without a filter.', fr: 'Une bouchée du disque, imperceptible sans filtre.',
  },
  'camera.phase.none': {
    ca: 'El disc solar encara és sencer.',
    es: 'El disco solar todavía está entero.', en: 'The solar disk is still whole.', fr: 'Le disque solaire est encore entier.',
  },
  'camera.belowHorizon': {
    ca: 'En aquest instant el Sol ja és sota l’horitzó astronòmic.',
    es: 'En este instante el Sol ya está bajo el horizonte astronómico.', en: 'At this moment the Sun is already below the astronomical horizon.', fr: 'A ce moment, le Soleil est déjà sous l\'horizon astronomique.',
  },
  'camera.readout': {
    ca: 'Az {az}° {card} · alt {alt}° · terreny {terrain}',
    es: 'Az {az}° {card} · alt {alt}° · terreno {terrain}', en: 'Az {az}° {card} · alt {alt}° · terrain {terrain}', fr: 'Az {az}° {card} · alt {alt}° · terrain {terrain}',
  },

  /* --- cel / càmera: vista de RA (`features/ar/ARView.tsx`) ---
   *
   * Tot el text d'aquesta vista era català clavat al JSX: qui triava castellà
   * rebia la pantalla diferencial del producte en català. El botó d'entrada no
   * és aquí perquè ja existia: és `home.openCamera`.
   */
  'camera.inviteNote': {
    ca: 'Hi veuràs el recorregut del Sol superposat al teu paisatge, a l’hora que triïs. La imatge no surt del telèfon.',
    es: 'Verás el recorrido del Sol superpuesto a tu paisaje, a la hora que elijas. La imagen no sale del teléfono.', en: 'You will see the path of the Sun superimposed on your landscape, at the time you choose. The image does not come out of the phone.', fr: 'Vous verrez la course du Soleil superposée à votre paysage, à l\'heure que vous choisirez. L\'image ne sort pas du téléphone.',
  },
  'camera.orientationDenied': {
    ca: 'Permís d’orientació denegat. A iOS s’ha de tornar a donar des de Safari.',
    es: 'Permiso de orientación denegado. En iOS hay que volver a concederlo desde Safari.', en: 'Orientation permission denied. On iOS you have to grant it again from Safari.', fr: 'Autorisation d\'orientation refusée. Sur iOS, vous devez l\'accorder à nouveau depuis Safari.',
  },
  'camera.openError': { ca: 'Càmera: {error}', es: 'Cámara: {error}', en: 'Camera: {error}', fr: 'Caméra : {error}' },
  'camera.lost': {
    ca: 'El sistema ha tallat la càmera —una trucada, una altra app—. Torna-la a obrir amb un toc.',
    es: 'El sistema cortó la cámara —una llamada, otra app—. Vuelve a abrirla con un toque.', en: 'The system cut off the camera—a call, another app. Open it again with a touch.', fr: 'Le système a coupé la caméra : un appel, une autre application. Ouvrez-le à nouveau d\'un simple toucher.',
  },
  'camera.paused': { ca: 'Càmera en pausa pel sistema', es: 'Cámara en pausa por el sistema', en: 'Camera paused by system', fr: 'Caméra mise en pause par le système' },
  'camera.modeMixed': { ca: 'Com es veurà', es: 'Cómo se verá', en: 'How it will look', fr: 'À quoi ça ressemblera' },
  'camera.modeDiagram': { ca: 'Esquema', es: 'Esquema', en: 'Diagram', fr: 'Diagramme' },
  'camera.scrub': { ca: 'Instant de l’eclipsi', es: 'Instante del eclipse', en: 'Moment of the eclipse', fr: 'Moment de l\'éclipse' },
  /* Les altres dues lectures del regle són `sim.readoutAlt` i `sim.readoutObsc`. */
  'camera.readoutLight': {
    ca: 'llum {phys}% · percebuda {perc}%',
    es: 'luz {phys}% · percibida {perc}%', en: 'light {phys}% · perceived {perc}%', fr: 'lumière {phys}% · perçue {perc}%',
  },
  'camera.stillDaylight': {
    ca: 'Amb el {pct} del Sol tapat encara sembla de dia. La caiguda de llum de veritat arriba en els últims segons abans de la totalitat.',
    es: 'Con el {pct} del Sol tapado todavía parece de día. La caída de luz de verdad llega en los últimos segundos antes de la totalidad.', en: 'With the {pct} of the Sun obscured it still seems like daytime. The real light fall comes in the last few seconds before totality.', fr: 'Avec le {pct} du Soleil obscurci, il semble toujours qu\'il fasse jour. La véritable chute de lumière survient dans les dernières secondes avant la totalité.',
  },
  'camera.visibleBodies': {
    ca: 'Visibles ara mateix al cel: {list}.',
    es: 'Visibles ahora mismo en el cielo: {list}.', en: 'Visible right now in the sky: {list}.', fr: 'Visible en ce moment dans le ciel : {list}.',
  },
  'camera.useMyPosition': {
    ca: 'toca-hi per fer servir la teva posició',
    es: 'tócalo para usar tu posición', en: 'tap it to use your position', fr: 'appuyez dessus pour utiliser votre position',
  },
  'camera.terrainNotComputed': {
    ca: 'perfil del terreny no calculat',
    es: 'perfil del terreno no calculado', en: 'terrain profile not calculated', fr: 'profil de terrain non calculé',
  },
  /* Deia «Amagar diagnòstic»: les etiquetes de botó van en imperatiu. */
  'camera.diagShow': { ca: 'Diagnòstic de sensors', es: 'Diagnóstico de sensores', en: 'Sensor diagnostics', fr: 'Diagnostic des capteurs' },
  'camera.diagHide': { ca: 'Amaga el diagnòstic', es: 'Oculta el diagnóstico', en: 'Hide diagnostics', fr: 'Masquer les diagnostics' },

  /* --- cel / càmera: panell de diagnòstic ---
   *
   * També és interfície, encara que el llegeixin quatre. «az» i «alt» són les
   * abreviatures d'observació de sempre i queden iguals en tots dos idiomes,
   * com ja passa a `sim.readoutAlt` i `sim.readoutAz`.
   */
  'camera.diag.headingSource': { ca: 'Font del rumb', es: 'Fuente del rumbo', en: 'Heading source', fr: 'Source du titre' },
  'camera.diag.sourceIos': {
    ca: 'webkitCompassHeading (absolut)',
    es: 'webkitCompassHeading (absoluto)', en: 'webkitCompassHeading (absolute)', fr: 'webkitCompassHeading (absolu)',
  },
  'camera.diag.sourceAbsolute': {
    ca: 'deviceorientationabsolute (absolut)',
    es: 'deviceorientationabsolute (absoluto)', en: 'deviceorientationabsolute (absolute)', fr: 'orientation de l\'appareilabsolu (absolu)',
  },
  'camera.diag.sourceRelative': {
    ca: 'alpha relativa — no fiable sense calibrar',
    es: 'alpha relativa — no fiable sin calibrar', en: 'relative alpha — unreliable uncalibrated', fr: 'alpha relatif – peu fiable, non calibré',
  },
  'camera.diag.sampleRate': { ca: 'Freqüència del sensor', es: 'Frecuencia del sensor', en: 'Sensor frequency', fr: 'Fréquence du capteur' },
  'camera.diag.jitter': {
    ca: 'Soroll del rumb (brut → filtrat)',
    es: 'Ruido del rumbo (bruto → filtrado)', en: 'Heading noise (raw → filtered)', fr: 'Bruit de cap (brut → filtré)',
  },
  'camera.diag.angularSpeed': { ca: 'Velocitat angular', es: 'Velocidad angular', en: 'Angular velocity', fr: 'Vitesse angulaire' },
  'camera.diag.angularSpeedValue': {
    ca: '{speed}°/s · tall {cutoff} Hz',
    es: '{speed}°/s · corte {cutoff} Hz', en: '{speed}°/s · cutoff {cutoff} Hz', fr: '{speed}°/s · coupure {cutoff} Hz',
  },
  'camera.diag.frozen': { ca: 'congelat', es: 'congelado', en: 'frozen', fr: 'congelé' },
  'camera.diag.accuracy': { ca: 'Precisió declarada', es: 'Precisión declarada', en: 'Declared Accuracy', fr: 'Précision déclarée' },
  'camera.diag.notAvailable': { ca: 'no disponible', es: 'no disponible', en: 'not available', fr: 'pas disponible' },
  'camera.diag.declination': { ca: 'Declinació magnètica', es: 'Declinación magnética', en: 'Magnetic declination', fr: 'Déclinaison magnétique' },
  'camera.diag.declinationValue': {
    ca: '{deg}° aplicada a l’azimut',
    es: '{deg}° aplicada al acimut', en: '{deg}° applied to azimuth', fr: '{deg}° appliqué à l\'azimut',
  },
  'camera.diag.pointing': { ca: 'Càmera apunta a', es: 'Cámara apunta a', en: 'Camera points to', fr: 'La caméra pointe vers' },
  'camera.diag.pointingValue': {
    ca: 'az {az}° · alt {alt}° · gir {roll}°',
    es: 'az {az}° · alt {alt}° · giro {roll}°', en: 'az {az}° · alt {alt}° · roll {roll}°', fr: 'az {az}° · alt {alt}° · rouler {roll}°',
  },
  'camera.diag.sunNow': { ca: 'Sol ara', es: 'Sol ahora', en: 'Sun now', fr: 'Soleil maintenant' },
  'camera.diag.azAlt': { ca: 'az {az}° · alt {alt}°', es: 'az {az}° · alt {alt}°', en: 'az {az}° · alt {alt}°', fr: 'az {az}° · alt {alt}°' },
  'camera.diag.rawError': {
    ca: 'Error de brúixola en brut',
    es: 'Error de brújula en bruto', en: 'Raw compass error', fr: 'Erreur de boussole brute',
  },
  'camera.diag.screenFov': {
    ca: 'Camp de visió a pantalla',
    es: 'Campo de visión en pantalla', en: 'Field of view on screen', fr: 'Champ de vision à l\'écran',
  },
  'camera.diag.anchor': { ca: 'Ancoratge visual', es: 'Anclaje visual', en: 'Visual anchor', fr: 'Ancrage visuel' },
  'camera.diag.anchorFast': {
    ca: 'gir massa ràpid — mana el sensor',
    es: 'giro demasiado rápido — manda el sensor', en: 'turning too fast — sensor takes over', fr: 'tourne trop vite - le capteur prend le relais',
  },
  'camera.diag.anchorValue': {
    ca: '{pct}% · {blocks} blocs · residu {res} px',
    es: '{pct}% · {blocks} bloques · residuo {res} px', en: '{pct}% · {blocks} blocks · residue {res} px', fr: '{pct}% · {blocks} blocs · résidu {res} px',
  },
  'camera.diag.noTexture': { ca: 'sense textura', es: 'sin textura', en: 'no texture', fr: 'pas de texture' },
  'camera.diag.agreement': {
    ca: 'Concordança imatge/sensor',
    es: 'Concordancia imagen/sensor', en: 'Image/sensor agreement', fr: 'Accord image/capteur',
  },
  'camera.diag.agree': {
    ca: 'les dues fonts coincideixen',
    es: 'las dos fuentes coinciden', en: 'the two sources coincide', fr: 'les deux sources coïncident',
  },
  'camera.diag.inverted': { ca: 'SIGNE INVERTIT', es: 'SIGNO INVERTIDO', en: 'INVERTED SIGN', fr: 'SIGNE INVERSÉ' },
  'camera.diag.noSignal': {
    ca: 'sense senyal per comparar',
    es: 'sin señal para comparar', en: 'no signal to compare', fr: 'aucun signal pour comparer',
  },
  'camera.diag.pose': { ca: 'Qui porta la postura', es: 'Quién lleva la postura', en: 'Pose source', fr: 'Source de pose' },
  'camera.diag.poseValue': {
    ca: '{source} · deriva {drift}° · estirada {tau} s',
    es: '{source} · deriva {drift}° · tirón {tau} s', en: '{source} · drift {drift}° · pull {tau} s', fr: '{source} · dérive {drift}° · tirer {tau} s',
  },
  'camera.diag.bias': { ca: 'Biaix après del terreny', es: 'Sesgo aprendido del terreno', en: 'Bias learned from terrain', fr: 'Biais appris du terrain' },
  'camera.diag.terrain': { ca: 'Àncora de terreny', es: 'Ancla de terreno', en: 'ground anchor', fr: 'ancrage au sol' },
  'camera.diag.terrainValue': {
    ca: '{pct}% · {cols} columnes · fa {age} ms',
    es: '{pct}% · {cols} columnas · hace {age} ms', en: '{pct}% · {cols} columns · {age} ms ago', fr: '{pct}% · {cols} colonnes · il y a {age} ms',
  },
  'camera.diag.terrainAltOnly': { ca: 'només altura', es: 'solo altura', en: 'height only', fr: 'hauteur seulement' },
  'camera.diag.terrainNone': { ca: 'cap a la vista', es: 'ninguna a la vista', en: 'none in sight', fr: 'aucun en vue' },
  'camera.diag.sunAnchor': { ca: 'Àncora de Sol', es: 'Ancla de Sol', en: 'Sun Anchor', fr: 'Ancre solaire' },
  'camera.diag.sunAnchorValue': {
    ca: '{pct}% · Δaz {daz}° · Δalt {dalt}°',
    es: '{pct}% · Δaz {daz}° · Δalt {dalt}°', en: '{pct}% · Δaz {daz}° · Δalt {dalt}°', fr: '{pct}% · Δaz {daz}° · Δalt {dalt}°',
  },
  'camera.diag.sunAnchorNone': { ca: 'no detectat', es: 'no detectado', en: 'not detected', fr: 'non détecté' },
  'camera.diag.anchorLeads': { ca: 'mana', es: 'manda', en: 'leading', fr: 'menant' },
  'camera.close': { ca: 'Tanca la càmera', es: 'Cierra la cámara', en: 'Close the camera', fr: 'Fermez la caméra' },
  'camera.compassJitter': { ca: 'brúixola ±{deg}°', es: 'brújula ±{deg}°', en: 'compass ±{deg}°', fr: 'boussole ±{deg}°' },
  'camera.sunArrowLabel': { ca: 'Sol', es: 'Sol', en: 'Sun', fr: 'Soleil' },
  'camera.sunHudLocked': { ca: 'Sol fixat', es: 'Sol fijado', en: 'Sun locked', fr: 'Soleil verrouillé' },
  'camera.calibrateCoach': {
    ca: 'Brúixola marejada — mou el mòbil fent un vuit ∞',
    es: 'Brújula mareada — mueve el móvil haciendo un ocho ∞', en: 'Compass unsettled — move your phone in a figure eight ∞', fr: 'Boussole instable : déplacez votre téléphone en forme de huit ∞',
  },
  'camera.lockSun': { ca: 'Sol fixat', es: 'Sol fijado', en: 'Sun locked', fr: 'Soleil verrouillé' },
  'camera.lockMoon': { ca: 'Lluna fixada', es: 'Luna fijada', en: 'Moon locked', fr: 'Lune verrouillée' },
  'camera.lockTerrain': { ca: 'Terreny fixat', es: 'Terreno fijado', en: 'Terrain locked', fr: 'Terrain verrouillé' },
  'camera.lockBoth': { ca: 'Sol + terreny', es: 'Sol + terreno', en: 'Sun + terrain', fr: 'Soleil + terrain' },
  'camera.capture': { ca: 'Captura i comparteix la vista', es: 'Captura y comparte la vista', en: 'Capture and share the view', fr: 'Capturez et partagez la vue' },
  'map.toCenter': { ca: 'A la línia central', es: 'A la línea central', en: 'To the center line', fr: 'Vers la ligne médiane' },
  /*
   * EL TEXT DEL GEST DEL MAPA, QUE DIU EL QUE EL GEST FA ARA.
   *
   * Abans prometia «sense perdre el teu punt», que era veritat mentre el clic
   * només obria una previsualització. Ara el clic ÉS el canvi de punt, i
   * deixar la frase antiga seria pitjor que no tenir-ne cap.
   */
  'map.pickNote': {
    ca: 'Toca qualsevol punt del mapa i passa a ser el teu: es recalcula tot, a totes les pantalles. Els llocs que toquis queden a l’historial.',
    es: 'Toca cualquier punto del mapa y pasa a ser el tuyo: se recalcula todo, en todas las pantallas. Los lugares que toques quedan en el historial.', en: 'Touch any point on the map and it becomes yours: everything is recalculated, on all screens. The places you touch remain in your history.', fr: 'Touchez n\'importe quel point de la carte et il devient le vôtre : tout est recalculé, sur tous les écrans. Les lieux que vous touchez restent dans votre histoire.',
  },
  'camera.diag.slew': { ca: 'Límit de correcció', es: 'Límite de corrección', en: 'Correction limit', fr: 'Limite de correction' },
  'camera.diag.slewClamped': { ca: 'retallant', es: 'recortando', en: 'clamping', fr: 'serrage' },
  'camera.diag.pitchDegraded': {
    ca: 'braç vertical coix — l’altura la porta el sensor',
    es: 'brazo vertical cojo — la altura la lleva el sensor', en: 'weak vertical baseline — altitude comes from the sensor', fr: 'ligne de base verticale faible – l\'altitude provient du capteur',
  },
  'camera.diag.frameCost': { ca: 'Cost del dibuix', es: 'Coste del dibujo', en: 'Render cost', fr: 'Coût du rendu' },
  'camera.diag.pitchGain': {
    ca: 'guany pitch {gain} (obturador rodant)',
    es: 'ganancia pitch {gain} (obturador rodante)', en: 'pitch gain {gain} (rolling shutter)', fr: 'gain de pitch {gain} (volet roulant)',
  },
  'camera.diag.poseVisual': { ca: 'la imatge', es: 'la imagen', en: 'the image', fr: 'l\'image' },
  'camera.diag.poseSensor': { ca: 'només el sensor', es: 'solo el sensor', en: 'just the sensor', fr: 'juste le capteur' },
  'camera.diag.frames': { ca: 'Fotogrames de càmera', es: 'Fotogramas de cámara', en: 'camera frames', fr: 'cadres de caméra' },
  'camera.diag.framesCounted': { ca: 'comptats', es: 'contados', en: 'counted', fr: 'dénombré' },
  'camera.diag.framesEstimated': { ca: 'estimats', es: 'estimados', en: 'estimated', fr: 'estimé' },
  'camera.diag.measuredFov': {
    ca: 'Camp de visió mesurat',
    es: 'Campo de visión medido', en: 'Measured field of view', fr: 'Champ de vision mesuré',
  },
  'camera.diag.measuredFovValue': {
    ca: '{deg}° al costat llarg · desat',
    es: '{deg}° en el lado largo · guardado', en: '{deg}° on the long side · saved', fr: '{deg}° sur le côté long · enregistré',
  },
  'camera.diag.measuring': {
    ca: 'mesurant… ({n} de 6 finestres)',
    es: 'midiendo… ({n} de 6 ventanas)', en: 'measuring… ({n} of 6 windows)', fr: 'mesure… ({n} sur 6 fenêtres)',
  },
  'camera.diag.lens': { ca: 'Objectiu', es: 'Objetivo', en: 'Lens', fr: 'Lentille' },
  'camera.diag.ultraWide': { ca: 'ULTRA-ANGULAR', es: 'ULTRA GRAN ANGULAR', en: 'ULTRA WIDE ANGLE', fr: 'ULTRA GRAND ANGLE' },
  'camera.diag.zoom': { ca: 'zoom {min}-{max}', es: 'zoom {min}-{max}', en: 'zoom {min}-{max}', fr: 'zoomer {min}-{max}' },
  'camera.diag.sensorFov': {
    ca: 'Camp de visió del sensor: {deg}°',
    es: 'Campo de visión del sensor: {deg}°', en: 'Sensor field of view: {deg}°', fr: 'Champ de vision du capteur : {deg}°',
  },
  'camera.diag.fovNote': {
    ca: 'El camp de visió del sensor no és el que veus a la pantalla: el vídeo es mostra retallat per omplir el marc. La projecció treballa amb la distància focal en píxels, que el retall no altera.',
    es: 'El campo de visión del sensor no es el que ves en la pantalla: el vídeo se muestra recortado para llenar el marco. La proyección trabaja con la distancia focal en píxeles, que el recorte no altera.', en: 'The sensor\'s field of view is not what you see on the screen: the video is displayed cropped to fill the frame. The projection works with the focal length in pixels, which the crop does not alter.', fr: 'Le champ de vision du capteur n\'est pas celui que vous voyez à l\'écran : la vidéo est affichée recadrée pour remplir le cadre. La projection fonctionne avec la focale en pixels, que le recadrage ne modifie pas.',
  },
  /*
   * La nota del soroll porta un terme destacat en negreta AL MIG de la frase.
   * El terme hi va com a marcador `{term}` i la vista el reconstrueix amb el
   * seu <strong>: partir la frase en dos literals per envoltar la negreta és
   * exactament el camí cap al castellà amb sintaxi catalana que aquest fitxer
   * diu d'evitar.
   */
  'camera.diag.noiseTerm': { ca: 'soroll del rumb', es: 'ruido del rumbo', en: 'heading noise', fr: 'bruit de cap' },
  'camera.diag.noiseNote': {
    ca: 'El que decideix si això funciona és el {term}, no l’error en brut: l’error el corregeix el calibratge, però el soroll no. Amb l’ancoratge visual actiu, aquell soroll ja no arriba a la superposició mentre la imatge tingui textura; quan no en té, torna a manar el sensor i es torna a notar.',
    es: 'Lo que decide si esto funciona es el {term}, no el error en bruto: el error lo corrige la calibración, pero el ruido no. Con el anclaje visual activo, ese ruido ya no llega a la superposición mientras la imagen tenga textura; cuando no la tiene, vuelve a mandar el sensor y se vuelve a notar.', en: 'What decides whether this works is the {term}, not the raw error: the error is corrected by the calibration, but the noise is not. With visual anchoring active, that noise no longer reaches the overlay as long as the image is textured; When it doesn\'t have it, it sends the sensor again and it is noticed again.', fr: 'Ce qui décide si cela fonctionne, c\'est le {term}, et non l\'erreur brute : l\'erreur est corrigée par l\'étalonnage, mais pas le bruit. Avec l\'ancrage visuel actif, ce bruit n\'atteint plus la superposition tant que l\'image est texturée ; Lorsqu\'il ne l\'a pas, il renvoie le capteur et il est à nouveau remarqué.',
  },

  /* --- guia --- */
  'guide.checklist': { ca: 'Què em cal portar', es: 'Qué me hace falta llevar', en: 'What do I need to bring?', fr: 'Que dois-je apporter ?' },
  'guide.item.glasses': {
    ca: 'Ulleres certificades ISO 12312-2',
    es: 'Gafas certificadas ISO 12312-2', en: 'ISO 12312-2 certified glasses', fr: 'Lunettes certifiées ISO 12312-2',
  },
  'guide.item.tripod': {
    ca: 'Trípode petit i disparador',
    es: 'Trípode pequeño y disparador', en: 'Small tripod and shutter release', fr: 'Petit trépied et déclencheur',
  },
  'guide.item.battery': {
    ca: 'Bateria externa i jaqueta fina',
    es: 'Batería externa y chaqueta fina', en: 'Power bank and light jacket', fr: 'Banque d\'alimentation et veste légère',
  },
  'guide.item.horizon': {
    ca: 'Horitzó de ponent comprovat sobre el terreny',
    es: 'Horizonte de poniente comprobado sobre el terreno', en: 'West-facing horizon checked on site', fr: 'Horizon orienté ouest vérifié sur place',
  },
  'guide.checklistNote': {
    ca: 'La llista es desa al dispositiu i no surt d’aquí.',
    es: 'La lista se guarda en el dispositivo y no sale de aquí.', en: 'The list is saved on the device and does not leave here.', fr: 'La liste est enregistrée sur l\'appareil et ne part pas ici.',
  },
  'guide.alert': { ca: 'Avisa’m 30 min abans', es: 'Avísame 30 min antes', en: 'Alert me 30 min before', fr: 'Alertez-moi 30 minutes avant' },
  'guide.alertPending': {
    ca: 'Encara no se sap l’hora: cal la teva posició.',
    es: 'Todavía no se sabe la hora: hace falta tu posición.', en: 'The time is not yet known: your position is needed.', fr: 'L’heure n’est pas encore connue : votre position est nécessaire.',
  },
  'guide.alertOn': {
    ca: 'L’avís només sona amb l’app oberta. No hi ha notificacions del sistema.',
    es: 'El aviso solo suena con la app abierta. No hay notificaciones del sistema.', en: 'The alert only sounds while the app is open. System notifications are not available.', fr: 'L\'alerte ne retentit que lorsque l\'application est ouverte. Les notifications système ne sont pas disponibles.',
  },
  'guide.alertAt': { ca: 'Sonarà a les {time}', es: 'Sonará a las {time}', en: 'It will ring at {time}', fr: 'L’alerte sonnera à {time}' },
  /* L'etiqueta de la nav de l'índex de la guia, i res més: els títols de les
     seccions ja arriben traduïts des de `content/guide.ts`. */
  'guide.toc': { ca: 'Índex', es: 'Índice', en: 'Index', fr: 'Sommaire' },
  /*
   * El títol de l'avís porta una XIFRA, com exigeix el sistema: la gent obeeix
   * un número i ignora un «vés amb compte». La xifra és la durada REAL de la
   * fase central des del punt de l'usuari, no la teòrica del catàleg.
   */
  'guide.safeTitle': {
    ca: 'Només {n} s són segurs',
    es: 'Solo {n} s son seguros', en: 'Only {n}s are safe', fr: 'Seules {n} s sont sûres',
  },
  'guide.safeBody': {
    ca: 'Durant la fase central pots mirar el Sol a ull nu. Un segon abans o després, no.',
    es: 'Durante la fase central puedes mirar el Sol a simple vista. Un segundo antes o después, no.', en: 'During the central phase you can look at the Sun with the naked eye. A second before or after, no.', fr: 'Pendant la phase centrale, vous pouvez observer le Soleil à l\'œil nu. Une seconde avant ou après, non.',
  },
  'guide.unsafeTitle': {
    ca: 'Cap moment és segur a ull nu',
    es: 'Ningún momento es seguro a simple vista', en: 'There is no safe time to look without protection', fr: 'Il n’y a pas de moment sûr pour regarder sans protection',
  },
  'guide.unsafeBody': {
    ca: 'Des d’aquest punt no hi ha fase central. Filtre certificat de C1 a C4, sense excepció.',
    es: 'Desde este punto no hay fase central. Filtro certificado de C1 a C4, sin excepción.', en: 'From this point there is no central phase. Certified filter from C1 to C4, without exception.', fr: 'A partir de ce point, il n’y a plus de phase centrale. Filtre certifié de C1 à C4, sans exception.',
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
  'three.title': { ca: 'Els tres eclipsis, des d’aquí', es: 'Los tres eclipses, desde aquí', en: 'The three eclipses, from here', fr: 'Les trois éclipses, d\'ici' },
  'three.intro': {
    ca: 'Els tres calculats per a les teves coordenades, no llegits de cap taula. El perfil de l’horitzó depèn del lloc i no de l’eclipsi: el mateix relleu que tens al voltant val per als tres.',
    es: 'Los tres calculados para tus coordenadas, no leídos de ninguna tabla. El perfil del horizonte depende del lugar y no del eclipse: el mismo relieve que tienes alrededor vale para los tres.', en: 'All three calculated for your coordinates, not read from any table. The profile of the horizon depends on the place and not the eclipse: the same relief that you have around you is valid for all three.', fr: 'Tous les trois sont calculés pour vos coordonnées, et ne sont lus dans aucun tableau. Le profil de l\'horizon dépend du lieu et non de l\'éclipse : le même relief que vous avez autour de vous est valable pour les trois.',
  },
  'three.selected': { ca: 'El que tens triat', es: 'El que tienes elegido', en: 'The one you have chosen', fr: 'Celui que tu as choisi' },
  'three.max': { ca: 'Màxim', es: 'Máximo', en: 'Maximum', fr: 'Maximum' },
  /* El que sobreviu al relleu, quan el terreny en roba una part. */
  'three.terrainEats': {
    ca: 'Des d’aquí el relleu se’n menja {lost} dels {total}.',
    es: 'Desde aquí el relieve se come {lost} de los {total}.', en: 'From here, terrain blocks {lost} of the {total}.', fr: 'À partir de là, les blocs de terrain {lost} sur le {total}.',
  },
  /*
   * La frase que cap altra app pot dir: amb el Sol alt, el terreny deixa de
   * decidir. Les dues altures van juntes perquè la conclusió és la RESTA, i
   * donar-ne només una obligaria a creure’ns.
   */
  'three.terrainClear': {
    ca: 'Sol a {alt} i terreny a {horizon} en aquell azimut: aquí el relleu no hi compta.',
    es: 'Sol a {alt} y terreno a {horizon} en ese acimut: aquí el relieve no cuenta.', en: 'Sun at {alt} and terrain at {horizon} in that azimuth: relief does not count here.', fr: 'Soleil à {alt} et terrain à {horizon} dans cet azimut : le relief ne compte pas ici.',
  },
  'three.terrainPending': {
    ca: 'El perfil del terreny d’aquest punt encara no està calculat: aquestes durades són les teòriques, amb horitzó pla.',
    es: 'El perfil del terreno de este punto todavía no está calculado: estas duraciones son las teóricas, con horizonte plano.', en: 'The terrain profile of this point has not yet been calculated: these durations are theoretical, with a flat horizon.', fr: 'Le profil de terrain de ce point n\'a pas encore été calculé : ces durées sont théoriques, avec un horizon plat.',
  },
  'three.maxBlocked': {
    ca: 'Al màxim el Sol ja queda darrere el terreny.',
    es: 'En el máximo el Sol ya queda detrás del terreno.', en: 'At maximum, the Sun is already behind the terrain.', fr: 'Au maximum, le Soleil est déjà derrière le terrain.',
  },
  'three.noCentral': {
    ca: 'Des d’aquest punt no hi ha fase central: com a màxim, {pct} del disc solar tapat.',
    es: 'Desde este punto no hay fase central: como máximo, {pct} del disco solar tapado.', en: 'From this point there is no central phase: at most, {pct} of the solar disk obscured.', fr: 'A partir de ce point, il n\'y a plus de phase centrale : tout au plus, {pct} du disque solaire est obscurci.',
  },

  /* --- escriptori: taula d'efemèrides --- */
  'web.ephemeris': { ca: 'Efemèrides al teu punt', es: 'Efemérides en tu punto', en: 'Ephemerides at your location', fr: 'Éphémérides chez vous' },
  'web.c1': { ca: 'C1 · primer contacte', es: 'C1 · primer contacto', en: 'C1 · first contact', fr: 'C1 · premier contact' },
  'web.c2total': { ca: 'C2 · inici totalitat', es: 'C2 · inicio totalidad', en: 'C2 · start totality', fr: 'C2 · début de la totalité' },
  'web.c2annular': { ca: 'C2 · inici anularitat', es: 'C2 · inicio anularidad', en: 'C2 · start annularity', fr: 'C2 · Annularité de départ' },
  'web.max': { ca: 'Màxim', es: 'Máximo', en: 'Maximum', fr: 'Maximum' },
  'web.c3total': { ca: 'C3 · fi totalitat', es: 'C3 · fin totalidad', en: 'C3 · end totality', fr: 'C3 · totalité finale' },
  'web.c3annular': { ca: 'C3 · fi anularitat', es: 'C3 · fin anularidad', en: 'C3 · end annularity', fr: 'C3 · annularité finale' },
  'web.c4': { ca: 'C4 · últim contacte', es: 'C4 · último contacto', en: 'C4 · last contact', fr: 'C4 · dernier contact' },
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
