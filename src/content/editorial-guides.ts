import type { Locale } from '../i18n';

export type EditorialGuideId = 'safety' | 'photography' | 'low-sun';

export interface EditorialSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface EditorialFaq {
  question: string;
  answer: string;
}

export interface EditorialGuide {
  id: EditorialGuideId;
  slug: string;
  title: string;
  description: string;
  intro: string;
  sections: EditorialSection[];
  /** Preguntes que s'han de mostrar a la pàgina si també s'emeten com a FAQPage. */
  faq: EditorialFaq[];
  relatedEclipseIds: readonly string[];
}

type LocalizedGuide = Record<Locale, EditorialGuide>;

const safety: LocalizedGuide = {
  ca: {
    id: 'safety', slug: 'seguretat-eclipsi-solar',
    title: 'Com observar un eclipsi solar amb seguretat',
    description: 'Quan cal portar filtre solar, com comprovar-lo i en quin únic moment d’un eclipsi total es pot retirar.',
    intro: 'Mirar el Sol sense la protecció correcta pot lesionar la retina sense dolor immediat. La regla segura és senzilla: filtre solar homologat durant totes les fases parcials i durant tot un eclipsi anular.',
    sections: [
      { id: 'filter', title: 'El filtre que sí que serveix', paragraphs: ['Fes servir ulleres o visors que compleixin ISO 12312-2 i provinguin d’un fabricant o distribuïdor fiable. Abans de cada ús, revisa’ls a contrallum: si estan ratllats, perforats, desenganxats o deformats, descarta’ls.'], bullets: ['Les ulleres de sol, encara que siguin molt fosques, no serveixen.', 'Tampoc serveixen radiografies, vidres fumats, CD ni filtres fotogràfics neutres.', 'Posa’t el visor abans de mirar amunt i aparta la mirada abans de treure-te’l.'] },
      { id: 'optics', title: 'Càmeres, prismàtics i telescopis', paragraphs: ['Qualsevol instrument òptic concentra molta més energia que l’ull. Necessita un filtre solar específic, ben fixat davant de l’objectiu. No miris mai per un instrument amb unes ulleres d’eclipsi posades: la llum concentrada les pot malmetre.'], bullets: ['Tapa o filtra també el cercador.', 'Supervisa els infants i munta l’equip abans que comenci l’eclipsi.', 'Si no coneixes el sistema, demana ajuda a una agrupació astronòmica.'] },
      { id: 'totality', title: 'L’única excepció: la totalitat', paragraphs: ['Només es pot retirar el filtre quan el Sol està completament cobert en un eclipsi total, entre el segon i el tercer contacte, i només si la totalitat és visible des del punt exacte. Torna a posar-lo tan bon punt reaparegui qualsevol punt brillant. En un eclipsi parcial o anular no hi ha cap moment segur sense filtre.'], bullets: ['Un 99,9% continua sent fase parcial.', 'No et guiïs per la foscor ambiental: segueix els contactes calculats per al teu lloc.', 'Si el relleu o la incertesa no permeten confirmar la totalitat, mantén el filtre.'] },
      { id: 'incident', title: 'Si hi ha una exposició accidental', paragraphs: ['Aparta la mirada. Si després notes una taca central, visió borrosa, distorsió o canvis de color, consulta un professional sanitari. Els símptomes poden aparèixer hores després; aquesta guia no substitueix l’atenció mèdica.'] },
    ],
    faq: [
      { question: 'Puc mirar l’eclipsi amb ulleres de sol?', answer: 'No. Cal un visor solar conforme a ISO 12312-2 i en bon estat; les ulleres de sol ordinàries no filtren prou la radiació solar.' },
      { question: 'Quan em puc treure el filtre?', answer: 'Només durant la totalitat d’un eclipsi total, entre C2 i C3, si és visible des del teu punt. En fases parcials i eclipsis anulars, mai.' },
      { question: 'Les ulleres d’eclipsi serveixen amb prismàtics?', answer: 'No. Els prismàtics, telescopis i càmeres necessiten el seu propi filtre davant de l’objectiu; no s’hi ha de mirar només amb ulleres d’eclipsi.' },
    ], relatedEclipseIds: ['2026-08-12', '2027-08-02', '2028-01-26'],
  },
  es: {
    id: 'safety', slug: 'seguridad-eclipse-solar', title: 'Cómo observar un eclipse solar con seguridad',
    description: 'Cuándo usar filtro solar, cómo comprobarlo y en qué único momento de un eclipse total se puede retirar.',
    intro: 'Mirar el Sol sin la protección correcta puede lesionar la retina sin dolor inmediato. La regla segura es sencilla: filtro solar homologado durante todas las fases parciales y durante todo un eclipse anular.',
    sections: [
      { id: 'filter', title: 'El filtro que sí sirve', paragraphs: ['Usa gafas o visores que cumplan ISO 12312-2 y procedan de un fabricante o distribuidor fiable. Revísalos a contraluz antes de cada uso y descártalos si están rayados, perforados, despegados o deformados.'], bullets: ['Las gafas de sol, aunque sean muy oscuras, no sirven.', 'Tampoco sirven radiografías, cristales ahumados, CD ni filtros fotográficos neutros.', 'Ponte el visor antes de mirar arriba y aparta la vista antes de quitártelo.'] },
      { id: 'optics', title: 'Cámaras, prismáticos y telescopios', paragraphs: ['Todo instrumento óptico concentra mucha más energía que el ojo. Necesita un filtro solar específico y bien sujeto delante del objetivo. Nunca mires por un instrumento solo con gafas de eclipse: la luz concentrada puede dañarlas.'], bullets: ['Tapa o filtra también el buscador.', 'Supervisa a los niños y monta el equipo antes del eclipse.', 'Si no conoces el sistema, pide ayuda a una agrupación astronómica.'] },
      { id: 'totality', title: 'La única excepción: la totalidad', paragraphs: ['Solo se puede retirar el filtro cuando el Sol está completamente cubierto en un eclipse total, entre el segundo y el tercer contacto, y si la totalidad es visible desde el punto exacto. Vuelve a colocarlo en cuanto reaparezca cualquier punto brillante. En un eclipse parcial o anular no hay ningún momento seguro sin filtro.'], bullets: ['Un 99,9 % sigue siendo fase parcial.', 'No te guíes por la oscuridad ambiental: sigue los contactos calculados para tu lugar.', 'Si el relieve o la incertidumbre impiden confirmar la totalidad, mantén el filtro.'] },
      { id: 'incident', title: 'Si hay una exposición accidental', paragraphs: ['Aparta la mirada. Si después notas una mancha central, visión borrosa, distorsión o cambios de color, consulta a un profesional sanitario. Los síntomas pueden aparecer horas después; esta guía no sustituye la atención médica.'] },
    ],
    faq: [
      { question: '¿Puedo mirar el eclipse con gafas de sol?', answer: 'No. Hace falta un visor solar conforme a ISO 12312-2 y en buen estado; las gafas de sol normales no filtran suficientemente la radiación solar.' },
      { question: '¿Cuándo puedo quitarme el filtro?', answer: 'Solo durante la totalidad de un eclipse total, entre C2 y C3, si es visible desde tu punto. En fases parciales y eclipses anulares, nunca.' },
      { question: '¿Sirven las gafas de eclipse con prismáticos?', answer: 'No. Prismáticos, telescopios y cámaras necesitan su propio filtro delante del objetivo; no deben usarse solo con gafas de eclipse.' },
    ], relatedEclipseIds: ['2026-08-12', '2027-08-02', '2028-01-26'],
  },
  en: {
    id: 'safety', slug: 'solar-eclipse-safety', title: 'How to watch a solar eclipse safely',
    description: 'When a solar filter is required, how to check it, and the one moment in a total eclipse when it may be removed.',
    intro: 'Looking at the Sun without proper protection can injure the retina without immediate pain. The safe rule is simple: use a certified solar viewer throughout every partial phase and throughout an annular eclipse.',
    sections: [
      { id: 'filter', title: 'A filter you can trust', paragraphs: ['Use viewers that comply with ISO 12312-2 and come from a reputable maker or seller. Inspect them against the light before every use; discard scratched, punctured, detached or warped viewers.'], bullets: ['Ordinary sunglasses are not safe, however dark they look.', 'X-rays, smoked glass, CDs and neutral-density camera filters are not safe either.', 'Put the viewer on before looking up and look away before removing it.'] },
      { id: 'optics', title: 'Cameras, binoculars and telescopes', paragraphs: ['Optical instruments concentrate far more energy than the unaided eye. They require a purpose-built solar filter secured over the front aperture. Never look through an instrument while merely wearing eclipse glasses: concentrated sunlight can damage the glasses.'], bullets: ['Cover or filter the finder scope too.', 'Supervise children and assemble the equipment before the eclipse.', 'Ask an astronomy group for help if the system is unfamiliar.'] },
      { id: 'totality', title: 'The only exception: totality', paragraphs: ['Remove the filter only while the Sun is completely covered in a total eclipse, between second and third contact, and only where totality is visible. Replace it as soon as any bright point returns. A partial or annular eclipse has no filter-free interval.'], bullets: ['99.9% coverage is still a partial phase.', 'Do not judge by ambient darkness; follow contacts calculated for your exact location.', 'Keep the filter on if terrain or uncertainty prevents confirmation of totality.'] },
      { id: 'incident', title: 'After accidental exposure', paragraphs: ['Look away. If you later notice a central spot, blurred or distorted vision, or altered colour perception, seek medical advice. Symptoms may take hours to appear; this guide is not a substitute for medical care.'] },
    ],
    faq: [
      { question: 'Can I watch the eclipse through sunglasses?', answer: 'No. You need an undamaged solar viewer compliant with ISO 12312-2; ordinary sunglasses do not block enough solar radiation.' },
      { question: 'When may I remove the solar filter?', answer: 'Only during totality in a total eclipse, between C2 and C3, where it is visible from your location. Never during partial phases or an annular eclipse.' },
      { question: 'Can I use eclipse glasses with binoculars?', answer: 'No. Binoculars, telescopes and cameras need their own filter over the front aperture; eclipse glasses alone are not safe with them.' },
    ], relatedEclipseIds: ['2026-08-12', '2027-08-02', '2028-01-26'],
  },
  fr: {
    id: 'safety', slug: 'securite-eclipse-solaire', title: 'Comment observer une éclipse solaire en sécurité',
    description: 'Quand utiliser un filtre solaire, comment le vérifier et à quel unique moment d’une éclipse totale il peut être retiré.',
    intro: 'Regarder le Soleil sans protection adaptée peut léser la rétine sans douleur immédiate. La règle est simple : un filtre solaire homologué pendant toutes les phases partielles et pendant toute éclipse annulaire.',
    sections: [
      { id: 'filter', title: 'Un filtre fiable', paragraphs: ['Utilisez des lunettes ou visières conformes à la norme ISO 12312-2, provenant d’un fabricant ou vendeur fiable. Examinez-les à contre-jour avant chaque utilisation et jetez-les si elles sont rayées, percées, décollées ou déformées.'], bullets: ['Les lunettes de soleil ne conviennent pas, même très foncées.', 'Les radiographies, verres fumés, CD et filtres photo neutres ne conviennent pas non plus.', 'Mettez la visière avant de lever les yeux et détournez le regard avant de l’enlever.'] },
      { id: 'optics', title: 'Appareils photo, jumelles et télescopes', paragraphs: ['Tout instrument optique concentre beaucoup plus d’énergie que l’œil. Il exige un filtre solaire conçu pour cet usage, solidement fixé devant l’objectif. Ne regardez jamais dans un instrument avec pour seule protection des lunettes d’éclipse : la lumière concentrée peut les endommager.'], bullets: ['Couvrez ou filtrez aussi le chercheur.', 'Surveillez les enfants et montez le matériel avant l’éclipse.', 'Demandez l’aide d’un club d’astronomie si le système ne vous est pas familier.'] },
      { id: 'totality', title: 'La seule exception : la totalité', paragraphs: ['Le filtre ne peut être retiré que lorsque le Soleil est entièrement caché pendant une éclipse totale, entre le deuxième et le troisième contact, et seulement là où la totalité est visible. Remettez-le dès qu’un point brillant réapparaît. Une éclipse partielle ou annulaire n’offre aucun moment sans filtre.'], bullets: ['Une occultation de 99,9 % reste une phase partielle.', 'Ne vous fiez pas à l’obscurité ambiante : suivez les contacts calculés pour votre position.', 'Gardez le filtre si le relief ou l’incertitude ne permet pas de confirmer la totalité.'] },
      { id: 'incident', title: 'Après une exposition accidentelle', paragraphs: ['Détournez le regard. Si une tache centrale, une vision floue ou déformée, ou une altération des couleurs apparaît ensuite, consultez un professionnel de santé. Les symptômes peuvent survenir plusieurs heures plus tard ; ce guide ne remplace pas un avis médical.'] },
    ],
    faq: [
      { question: 'Puis-je regarder l’éclipse avec des lunettes de soleil ?', answer: 'Non. Il faut une visière solaire intacte conforme à la norme ISO 12312-2 ; des lunettes de soleil ordinaires ne filtrent pas suffisamment le rayonnement solaire.' },
      { question: 'Quand puis-je retirer le filtre ?', answer: 'Uniquement pendant la totalité d’une éclipse totale, entre C2 et C3, si elle est visible depuis votre position. Jamais pendant une phase partielle ou une éclipse annulaire.' },
      { question: 'Les lunettes d’éclipse conviennent-elles avec des jumelles ?', answer: 'Non. Les jumelles, télescopes et appareils photo nécessitent leur propre filtre devant l’objectif ; les lunettes d’éclipse seules ne suffisent pas.' },
    ], relatedEclipseIds: ['2026-08-12', '2027-08-02', '2028-01-26'],
  },
};

const photography: LocalizedGuide = {
  ca: {
    id: 'photography', slug: 'fotografiar-eclipsi-solar', title: 'Com fotografiar un eclipsi solar',
    description: 'Equip, enfocament, exposició i seguretat per fotografiar les fases parcials i la totalitat sense perdre l’experiència.',
    intro: 'Una fotografia nítida comença abans del dia de l’eclipsi: filtre correcte, enfocament provat i una seqüència prou simple per poder mirar el fenomen amb els teus ulls.',
    sections: [
      { id: 'equipment', title: 'Equip mínim i protecció', paragraphs: ['Durant qualsevol fase en què quedi fotosfera visible, col·loca un filtre solar específic davant de l’objectiu. Una focal llarga fa el disc més gran, però també magnifica vibracions i errors d’enquadrament.'], bullets: ['Trípode estable i disparador o retard de dos segons.', 'Bateria carregada, targeta buida i parasol retirat si interfereix amb el filtre.', 'No confiïs en el visor òptic; usa pantalla o visor electrònic només amb el filtre instal·lat.'] },
      { id: 'setup', title: 'Prova l’enfocament i l’enquadrament', paragraphs: ['Assaja amb el Sol filtrat dies abans, a una altura semblant. Enfoca manualment la vora solar o una taca, amplia la imatge i bloqueja l’enfocament. Deixa marge perquè el Sol es desplaça i perquè prop de l’horitzó la refracció n’altera la forma.'] },
      { id: 'exposure', title: 'Exposició: mesura i fes forquilla', paragraphs: ['No hi ha un únic ajust universal. Amb el filtre posat, parteix de la lectura de la càmera en manual, comprova l’histograma i evita saturar el disc. Durant la totalitat, si realment ets dins la franja, retira el filtre després de C2 i fes una forquilla àmplia: corona, protuberàncies i cromosfera tenen brillantors molt diferents.'], bullets: ['Fotografia en RAW si la càmera ho permet.', 'Mantén ISO moderat i varia principalment la velocitat.', 'Torna a posar el filtre abans de C3; un temporitzador o avís de veu ajuda.'] },
      { id: 'experience', title: 'No converteixis l’eclipsi en una avaria', paragraphs: ['Automatitza només allò que hagis assajat. Si alguna cosa falla, deixa la càmera i mira. La totalitat dura poc i cap fotografia substitueix veure la corona i el paisatge amb els propis ulls.'] },
    ],
    faq: [
      { question: 'La càmera també necessita filtre solar?', answer: 'Sí. Sempre que quedi fotosfera visible, el filtre ha d’anar fixat davant de l’objectiu. En un eclipsi total només es retira durant la totalitat visible.' },
      { question: 'Quina exposició he de fer servir?', answer: 'Depèn del filtre, l’òptica i la fase. Treballa en manual, comprova l’histograma i fes una forquilla d’exposicions; durant la totalitat cal cobrir un rang especialment ampli.' },
      { question: 'Puc fotografiar l’eclipsi amb el mòbil?', answer: 'Sí, però mentre quedi fotosfera visible cal un filtre solar homologat davant de la lent i el disc serà petit. No apuntis el telèfon a través de prismàtics o telescopis sense filtres específics; prioritza una composició amb el paisatge.' },
    ], relatedEclipseIds: ['2026-08-12', '2027-08-02', '2028-01-26'],
  },
  es: {
    id: 'photography', slug: 'fotografiar-eclipse-solar', title: 'Cómo fotografiar un eclipse solar', description: 'Equipo, enfoque, exposición y seguridad para fotografiar las fases parciales y la totalidad sin perderse la experiencia.',
    intro: 'Una fotografía nítida empieza antes del eclipse: filtro correcto, enfoque probado y una secuencia lo bastante sencilla como para poder contemplar el fenómeno.',
    sections: [
      { id: 'equipment', title: 'Equipo mínimo y protección', paragraphs: ['Mientras quede fotosfera visible, coloca un filtro solar específico delante del objetivo. Una focal larga agranda el disco, pero también amplifica vibraciones y errores de encuadre.'], bullets: ['Trípode estable y disparador o retardo de dos segundos.', 'Batería cargada, tarjeta vacía y parasol retirado si interfiere con el filtro.', 'No uses el visor óptico; usa pantalla o visor electrónico solo con el filtro instalado.'] },
      { id: 'setup', title: 'Prueba el enfoque y el encuadre', paragraphs: ['Ensaya con el Sol filtrado días antes, a una altura parecida. Enfoca manualmente el borde solar o una mancha, amplía la imagen y bloquea el enfoque. Deja margen para el desplazamiento del Sol y la deformación por refracción cerca del horizonte.'] },
      { id: 'exposure', title: 'Exposición: mide y haz bracketing', paragraphs: ['No existe un ajuste universal. Con el filtro puesto, parte de la medición manual, comprueba el histograma y evita saturar el disco. Durante la totalidad, si estás realmente dentro de la franja, retira el filtro después de C2 y haz un bracketing amplio: corona, protuberancias y cromosfera tienen brillos muy distintos.'], bullets: ['Fotografía en RAW si es posible.', 'Mantén un ISO moderado y varía principalmente la velocidad.', 'Vuelve a poner el filtro antes de C3; ayuda usar un temporizador o aviso de voz.'] },
      { id: 'experience', title: 'No conviertas el eclipse en una avería', paragraphs: ['Automatiza solo lo que hayas ensayado. Si algo falla, deja la cámara y mira. La totalidad dura poco y ninguna fotografía sustituye ver la corona y el paisaje con tus propios ojos.'] },
    ],
    faq: [
      { question: '¿La cámara también necesita filtro solar?', answer: 'Sí. Siempre que quede fotosfera visible, el filtro debe ir delante del objetivo. En un eclipse total solo se retira durante la totalidad visible.' },
      { question: '¿Qué exposición debo utilizar?', answer: 'Depende del filtro, la óptica y la fase. Trabaja en manual, comprueba el histograma y haz un bracketing; durante la totalidad hace falta cubrir un rango especialmente amplio.' },
      { question: '¿Puedo fotografiar el eclipse con el móvil?', answer: 'Sí, pero mientras quede fotosfera visible hace falta un filtro solar homologado delante de la lente y el disco será pequeño. No apuntes el teléfono a través de prismáticos o telescopios sin filtros específicos; considera una composición con el paisaje.' },
    ], relatedEclipseIds: ['2026-08-12', '2027-08-02', '2028-01-26'],
  },
  en: {
    id: 'photography', slug: 'photograph-solar-eclipse', title: 'How to photograph a solar eclipse', description: 'Equipment, focus, exposure and safety for photographing partial phases and totality without missing the experience.',
    intro: 'A sharp eclipse photograph begins before eclipse day: the right filter, tested focus and a sequence simple enough to leave time to experience the event.',
    sections: [
      { id: 'equipment', title: 'Essential equipment and protection', paragraphs: ['Whenever any photosphere remains visible, secure a purpose-built solar filter over the front of the lens. A long focal length makes the disc larger but magnifies vibration and framing errors.'], bullets: ['A stable tripod and remote release or two-second delay.', 'A charged battery, empty card and no lens hood if it interferes with the filter.', 'Avoid an optical viewfinder; use a screen or electronic finder only with the filter fitted.'] },
      { id: 'setup', title: 'Test focus and framing', paragraphs: ['Rehearse on the filtered Sun several days beforehand at a similar altitude. Focus manually on the solar limb or a sunspot, magnify the live image and lock focus. Leave room for solar motion and for refraction to distort the disc near the horizon.'] },
      { id: 'exposure', title: 'Exposure: meter and bracket', paragraphs: ['There is no universal setting. With the filter fitted, begin with a manual meter reading, inspect the histogram and avoid clipping the disc. During totality, only if you are truly inside the path, remove the filter after C2 and bracket widely: corona, prominences and chromosphere differ greatly in brightness.'], bullets: ['Shoot RAW when available.', 'Keep ISO moderate and vary shutter speed first.', 'Replace the filter before C3; a timer or spoken cue helps.'] },
      { id: 'experience', title: 'Do not spend totality troubleshooting', paragraphs: ['Automate only what you have rehearsed. If the setup fails, leave it and look. Totality is brief, and no photograph replaces seeing the corona and landscape with your own eyes.'] },
    ],
    faq: [
      { question: 'Does my camera need a solar filter?', answer: 'Yes. Whenever any photosphere is visible, a solar filter must cover the front of the lens. In a total eclipse it is removed only during visible totality.' },
      { question: 'What exposure should I use?', answer: 'It depends on the filter, lens and phase. Work manually, inspect the histogram and bracket exposures; totality requires an especially wide range.' },
      { question: 'Can I photograph the eclipse with a phone?', answer: 'Yes, but a certified solar filter must cover the phone lens whenever any photosphere remains, and the solar disc will be small. Never aim a phone through unfiltered binoculars or a telescope; consider including the landscape.' },
    ], relatedEclipseIds: ['2026-08-12', '2027-08-02', '2028-01-26'],
  },
  fr: {
    id: 'photography', slug: 'photographier-eclipse-solaire', title: 'Comment photographier une éclipse solaire', description: 'Matériel, mise au point, exposition et sécurité pour photographier les phases partielles et la totalité sans manquer l’expérience.',
    intro: 'Une photo nette se prépare avant le jour de l’éclipse : filtre adapté, mise au point testée et séquence assez simple pour laisser le temps d’observer le phénomène.',
    sections: [
      { id: 'equipment', title: 'Matériel essentiel et protection', paragraphs: ['Tant qu’une partie de la photosphère reste visible, fixez un filtre solaire conçu pour cet usage devant l’objectif. Une longue focale agrandit le disque, mais amplifie aussi les vibrations et erreurs de cadrage.'], bullets: ['Trépied stable et déclencheur ou retardateur de deux secondes.', 'Batterie chargée, carte vide et pare-soleil retiré s’il gêne le filtre.', 'Évitez le viseur optique ; utilisez l’écran ou un viseur électronique uniquement avec le filtre en place.'] },
      { id: 'setup', title: 'Tester la mise au point et le cadrage', paragraphs: ['Répétez avec le Soleil filtré quelques jours avant, à une hauteur comparable. Faites la mise au point manuelle sur le limbe ou une tache solaire, agrandissez l’image et verrouillez-la. Gardez de la marge pour le déplacement du Soleil et sa déformation par la réfraction près de l’horizon.'] },
      { id: 'exposure', title: 'Exposition : mesurer et faire un bracketing', paragraphs: ['Il n’existe aucun réglage universel. Filtre en place, partez d’une mesure manuelle, contrôlez l’histogramme et évitez de saturer le disque. Pendant la totalité, uniquement si vous êtes bien dans la bande, retirez le filtre après C2 et faites un large bracketing : couronne, protubérances et chromosphère ont des luminosités très différentes.'], bullets: ['Photographiez en RAW si possible.', 'Gardez une sensibilité ISO modérée et variez surtout la vitesse.', 'Remettez le filtre avant C3 ; un minuteur ou une annonce vocale aide.'] },
      { id: 'experience', title: 'Ne passez pas la totalité à dépanner', paragraphs: ['N’automatisez que ce que vous avez répété. Si le montage échoue, laissez l’appareil et regardez. La totalité est brève et aucune image ne remplace la couronne et le paysage vus de ses propres yeux.'] },
    ],
    faq: [
      { question: 'Mon appareil photo a-t-il besoin d’un filtre solaire ?', answer: 'Oui. Tant qu’une partie de la photosphère est visible, le filtre doit couvrir l’avant de l’objectif. Pendant une éclipse totale, il ne se retire que durant la totalité visible.' },
      { question: 'Quelle exposition dois-je utiliser ?', answer: 'Elle dépend du filtre, de l’optique et de la phase. Travaillez en manuel, contrôlez l’histogramme et faites un bracketing ; la totalité demande une plage particulièrement large.' },
      { question: 'Puis-je photographier l’éclipse avec un téléphone ?', answer: 'Oui, mais un filtre solaire homologué doit couvrir l’objectif tant qu’une partie de la photosphère reste visible, et le disque sera petit. Ne placez jamais le téléphone derrière des jumelles ou un télescope sans filtre adapté.' },
    ], relatedEclipseIds: ['2026-08-12', '2027-08-02', '2028-01-26'],
  },
};

const lowSun: LocalizedGuide = {
  ca: {
    id: 'low-sun', slug: 'eclipsi-sol-baix-horitzo', title: 'Veure un eclipsi amb el Sol baix sobre l’horitzó', description: 'Com triar lloc quan l’eclipsi coincideix amb el capvespre: azimut, relleu, refracció, boirina i marge d’arribada.',
    intro: 'Amb el Sol baix, estar dins la franja no basta. Una carena, un edifici o una capa de boirina poden ocultar els últims minuts; l’horitzó exacte es converteix en part del càlcul.',
    sections: [
      { id: 'geometry', title: 'Altura i azimut, no només una ciutat', paragraphs: ['Comprova l’altura aparent i la direcció del Sol a C1, al màxim i al final. Després compara l’azimut amb el perfil d’horitzó des del punt concret. Dos llocs separats per pocs quilòmetres poden tenir un resultat diferent.'], bullets: ['Una altura de 0° correspon a l’horitzó astronòmic aparent, no necessàriament a la línia de muntanyes.', 'Arbres, edificis i obstacles pròxims no sempre apareixen als models de terreny.', 'Reserva una alternativa amb horitzó més net.'] },
      { id: 'recon', title: 'Reconeix el lloc abans', paragraphs: ['Visita el punt a la mateixa hora solar uns dies abans o utilitza la càmera de cel per comprovar la direcció. No esperis al dia de l’eclipsi per descobrir una tanca, un accés restringit o una carena més alta del previst.'], bullets: ['Arriba amb llum i sense bloquejar vies o finques.', 'Confirma accessos, aparcament i cobertura.', 'Tria una posició estable abans de muntar trípodes.'] },
      { id: 'atmosphere', title: 'L’atmosfera pot decidir', paragraphs: ['Prop de l’horitzó la llum travessa molta més atmosfera. La refracció eleva i deforma el disc aparent, però és variable i no compensa núvols, pols o boirina. La climatologia ajuda a comparar zones; no és una previsió del dia.'], bullets: ['Revisa la previsió actualitzada quan entri dins del seu horitzó fiable.', 'Mira núvol baix, visibilitat i aerosols, no només el percentatge de núvols.', 'Mantén marge: un pronòstic no pot garantir una escletxa a l’horitzó.'] },
      { id: 'photography', title: 'Paisatge i exposició', paragraphs: ['El Sol baix permet incloure referències del paisatge, però el primer pla pot quedar molt fosc. Planifica l’enquadrament i fes forquilla d’exposició. El filtre solar continua sent obligatori mentre quedi fotosfera visible, encara que el Sol sembli atenuat pel capvespre.'] },
    ],
    faq: [
      { question: 'Quina altura mínima ha de tenir el Sol?', answer: 'No hi ha una xifra universal: depèn de l’altura real de l’horitzó en aquell azimut i de l’atmosfera. Com més pocs graus tingui, més necessari és comprovar el punt exacte.' },
      { question: 'La refracció farà visible un Sol que ja és sota l’horitzó?', answer: 'La refracció sol elevar una mica el disc aparent prop de l’horitzó, però varia amb l’atmosfera i no s’ha d’utilitzar com a marge de seguretat.' },
      { question: 'La climatologia del mapa és una previsió?', answer: 'No. Resumeix patrons històrics per comparar zones. La previsió concreta només guanya utilitat quan falten pocs dies i encara conserva incertesa.' },
    ], relatedEclipseIds: ['2026-08-12', '2028-01-26'],
  },
  es: {
    id: 'low-sun', slug: 'eclipse-sol-bajo-horizonte', title: 'Ver un eclipse con el Sol bajo sobre el horizonte', description: 'Cómo elegir lugar cuando el eclipse coincide con el atardecer: acimut, relieve, refracción, calima y margen de llegada.',
    intro: 'Con el Sol bajo, estar dentro de la franja no basta. Una cresta, un edificio o una capa de calima pueden ocultar los últimos minutos; el horizonte exacto pasa a formar parte del cálculo.',
    sections: [
      { id: 'geometry', title: 'Altura y acimut, no solo una ciudad', paragraphs: ['Comprueba la altura aparente y la dirección del Sol en C1, el máximo y el final. Compara después el acimut con el perfil del horizonte desde el punto concreto. Dos lugares separados por pocos kilómetros pueden dar resultados distintos.'], bullets: ['Una altura de 0° corresponde al horizonte astronómico aparente, no necesariamente a las montañas.', 'Árboles, edificios y obstáculos próximos no siempre aparecen en los modelos de terreno.', 'Reserva una alternativa con horizonte más limpio.'] },
      { id: 'recon', title: 'Reconoce el lugar antes', paragraphs: ['Visita el punto a la misma hora solar unos días antes o usa la cámara de cielo para comprobar la dirección. No esperes al eclipse para descubrir una valla, un acceso restringido o una cresta más alta de lo previsto.'], bullets: ['Llega con luz y sin bloquear caminos o fincas.', 'Confirma accesos, aparcamiento y cobertura.', 'Elige una posición estable antes de montar trípodes.'] },
      { id: 'atmosphere', title: 'La atmósfera puede decidir', paragraphs: ['Cerca del horizonte, la luz atraviesa mucha más atmósfera. La refracción eleva y deforma el disco aparente, pero es variable y no compensa nubes, polvo o calima. La climatología permite comparar zonas; no es un pronóstico del día.'], bullets: ['Consulta la previsión actualizada cuando entre en su horizonte fiable.', 'Mira nube baja, visibilidad y aerosoles, no solo el porcentaje de nubes.', 'Conserva margen: ningún pronóstico garantiza un claro en el horizonte.'] },
      { id: 'photography', title: 'Paisaje y exposición', paragraphs: ['El Sol bajo permite incluir referencias del paisaje, pero el primer plano puede quedar muy oscuro. Planifica el encuadre y haz bracketing. El filtro solar sigue siendo obligatorio mientras quede fotosfera visible, aunque el Sol parezca atenuado por el atardecer.'] },
    ],
    faq: [
      { question: '¿Qué altura mínima debe tener el Sol?', answer: 'No hay una cifra universal: depende de la altura real del horizonte en ese acimut y de la atmósfera. Cuantos menos grados tenga, más importante es comprobar el punto exacto.' },
      { question: '¿La refracción hará visible un Sol que ya está bajo el horizonte?', answer: 'La refracción suele elevar un poco el disco aparente cerca del horizonte, pero varía con la atmósfera y no debe usarse como margen de seguridad.' },
      { question: '¿La climatología del mapa es una previsión?', answer: 'No. Resume patrones históricos para comparar zonas. La previsión concreta solo resulta útil cuando faltan pocos días y sigue teniendo incertidumbre.' },
    ], relatedEclipseIds: ['2026-08-12', '2028-01-26'],
  },
  en: {
    id: 'low-sun', slug: 'eclipse-low-sun-horizon', title: 'Watching an eclipse low above the horizon', description: 'How to choose a site when an eclipse meets sunset: azimuth, terrain, refraction, haze and arrival margin.',
    intro: 'With the Sun low, being inside the eclipse path is not enough. A ridge, building or haze layer can hide the final minutes, making the exact local horizon part of the calculation.',
    sections: [
      { id: 'geometry', title: 'Altitude and azimuth, not just a town', paragraphs: ['Check the Sun’s apparent altitude and direction at C1, maximum and the end. Then compare that azimuth with the horizon profile from the exact site. Places only a few kilometres apart can have different outcomes.'], bullets: ['An altitude of 0° means the apparent astronomical horizon, not necessarily the ridge line.', 'Nearby trees, buildings and obstructions may be absent from terrain models.', 'Keep a backup site with a clearer horizon.'] },
      { id: 'recon', title: 'Reconnoitre the site first', paragraphs: ['Visit at a similar solar time a few days beforehand or use the sky camera to check the direction. Do not wait until eclipse day to discover a fence, restricted access or a higher-than-expected ridge.'], bullets: ['Arrive in daylight and do not block roads or private land.', 'Confirm access, parking and mobile coverage.', 'Choose stable ground before setting up tripods.'] },
      { id: 'atmosphere', title: 'The atmosphere may decide', paragraphs: ['Near the horizon, light crosses much more atmosphere. Refraction lifts and distorts the apparent disc, but varies and cannot overcome cloud, dust or haze. Climatology helps compare regions; it is not a forecast for eclipse day.'], bullets: ['Check updated forecasts once they enter their useful range.', 'Consider low cloud, visibility and aerosols, not only total cloud percentage.', 'Keep a margin: no forecast can guarantee a clear gap on the horizon.'] },
      { id: 'photography', title: 'Landscape and exposure', paragraphs: ['A low Sun makes landscape compositions possible, but the foreground may be very dark. Plan the framing and bracket exposures. A solar filter remains mandatory while any photosphere is visible, even if sunset haze makes the Sun look dim.'] },
    ],
    faq: [
      { question: 'How high must the Sun be?', answer: 'There is no universal minimum: it depends on the real horizon altitude at that azimuth and on the atmosphere. The fewer degrees remain, the more important an exact site check becomes.' },
      { question: 'Will refraction reveal a Sun already below the horizon?', answer: 'Refraction commonly lifts the apparent disc a little near the horizon, but varies with atmospheric conditions and should not be treated as a safety margin.' },
      { question: 'Is the map climatology a weather forecast?', answer: 'No. It summarises historical patterns for comparing regions. A specific forecast becomes useful only a few days beforehand and still carries uncertainty.' },
    ], relatedEclipseIds: ['2026-08-12', '2028-01-26'],
  },
  fr: {
    id: 'low-sun', slug: 'eclipse-soleil-bas-horizon', title: 'Observer une éclipse avec le Soleil bas sur l’horizon', description: 'Comment choisir un site lorsque l’éclipse coïncide avec le coucher du Soleil : azimut, relief, réfraction, brume et marge.',
    intro: 'Lorsque le Soleil est bas, être dans la bande de l’éclipse ne suffit pas. Une crête, un bâtiment ou une couche de brume peut cacher les dernières minutes : l’horizon local exact entre dans le calcul.',
    sections: [
      { id: 'geometry', title: 'Hauteur et azimut, pas seulement une ville', paragraphs: ['Vérifiez la hauteur apparente et la direction du Soleil à C1, au maximum et à la fin. Comparez ensuite cet azimut au profil d’horizon du site précis. Quelques kilomètres peuvent suffire à changer le résultat.'], bullets: ['Une hauteur de 0° désigne l’horizon astronomique apparent, pas nécessairement la ligne des crêtes.', 'Les arbres, bâtiments et obstacles proches peuvent manquer dans les modèles de terrain.', 'Prévoyez un site de repli avec un horizon plus dégagé.'] },
      { id: 'recon', title: 'Reconnaître le site à l’avance', paragraphs: ['Visitez le lieu à une heure solaire comparable quelques jours avant ou utilisez la caméra du ciel pour vérifier la direction. N’attendez pas l’éclipse pour découvrir une clôture, un accès interdit ou une crête plus haute que prévu.'], bullets: ['Arrivez de jour sans bloquer route ni propriété.', 'Vérifiez les accès, le stationnement et le réseau mobile.', 'Choisissez un sol stable avant d’installer les trépieds.'] },
      { id: 'atmosphere', title: 'L’atmosphère peut décider', paragraphs: ['Près de l’horizon, la lumière traverse beaucoup plus d’atmosphère. La réfraction relève et déforme le disque apparent, mais elle varie et ne traverse ni nuages, ni poussière, ni brume. La climatologie compare des régions ; ce n’est pas la prévision du jour.'], bullets: ['Consultez les prévisions actualisées lorsqu’elles entrent dans leur période utile.', 'Examinez nuages bas, visibilité et aérosols, pas seulement le pourcentage nuageux.', 'Gardez une marge : aucune prévision ne garantit une trouée à l’horizon.'] },
      { id: 'photography', title: 'Paysage et exposition', paragraphs: ['Un Soleil bas permet de composer avec le paysage, mais le premier plan peut être très sombre. Préparez le cadrage et faites un bracketing. Le filtre solaire reste obligatoire tant qu’une partie de la photosphère est visible, même si la brume du soir atténue le Soleil.'] },
    ],
    faq: [
      { question: 'À quelle hauteur minimale le Soleil doit-il être ?', answer: 'Il n’existe pas de minimum universel : tout dépend de la hauteur réelle de l’horizon à cet azimut et de l’atmosphère. Plus la hauteur est faible, plus la vérification du site précis est importante.' },
      { question: 'La réfraction rendra-t-elle visible un Soleil déjà sous l’horizon ?', answer: 'La réfraction relève souvent légèrement le disque apparent près de l’horizon, mais elle varie avec l’atmosphère et ne doit pas servir de marge de sécurité.' },
      { question: 'La climatologie de la carte est-elle une prévision météo ?', answer: 'Non. Elle résume des tendances historiques pour comparer les régions. Une prévision précise ne devient utile que quelques jours avant et reste incertaine.' },
    ], relatedEclipseIds: ['2026-08-12', '2028-01-26'],
  },
};

export const EDITORIAL_GUIDES: Readonly<Record<EditorialGuideId, LocalizedGuide>> = {
  safety,
  photography,
  'low-sun': lowSun,
};

export const EDITORIAL_GUIDE_IDS: readonly EditorialGuideId[] = [
  'safety',
  'photography',
  'low-sun',
];

export function getEditorialGuide(id: EditorialGuideId, locale: Locale): EditorialGuide {
  return EDITORIAL_GUIDES[id][locale];
}

export function findEditorialGuideBySlug(slug: string, locale: Locale): EditorialGuide | null {
  for (const id of EDITORIAL_GUIDE_IDS) {
    const guide = EDITORIAL_GUIDES[id][locale];
    if (guide.slug === slug) return guide;
  }
  return null;
}
