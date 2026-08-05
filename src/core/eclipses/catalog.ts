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
  label: { ca: string; es: string; en: string; fr: string };
  /**
   * Resum de la franja sobre territori espanyol.
   *
   * ÉS L'ÚNIC CAMP D'AQUEST FITXER AMB XIFRES, i és una excepció que es paga
   * amb un test. No pot ser d'una altra manera: una llista de llocs és una
   * afirmació sobre la geografia de la franja, no sobre el punt de qui
   * llegeix, i el motor no la pot generar sola perquè cap càlcul sap quins
   * topònims reconeix la gent.
   *
   * EL QUE VA PASSAR PER NO TENIR AQUEST TEST: la frase del 2026 va viure
   * mesos deixant València fora de la franja quan el motor li dona 62 s de
   * totalitat, i anomenant «Galícia» sencera una comunitat de la qual la
   * franja només agafa la punta nord. Ningú no ho va veure perquè ningú no
   * comparava mai el text amb el codi.
   *
   * REGLA, DES DEL 3-8-2026: cada lloc anomenat aquí i cada altura o
   * percentatge escrit surt de `computeLocalCircumstances`, i
   * `tests/afirmacions-del-text.test.ts` els torna a calcular tots. Si el
   * motor canvia, el test es posa vermell i el text s'actualitza — no al
   * revés.
   */
  spain: { ca: string; es: string; en: string; fr: string };
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
  tips?: { ca: string[]; es: string[]; en: string[]; fr: string[] };
}

export const ECLIPSES: EclipseEntry[] = [
  {
    id: '2026-08-12',
    greatestEclipseUtc: '2026-08-12T17:46:00Z',
    kind: 'total',
    label: {
      ca: 'Eclipsi total del 12 d’agost de 2026',
      es: 'Eclipse total del 12 de agosto de 2026',
      en: 'Total solar eclipse of 12 August 2026',
      fr: 'Éclipse solaire totale du 12 août 2026',
    },
    /*
     * LA FRASE QUE DEIXAVA VALÈNCIA FORA (corregida el 3-8-2026).
     *
     * Aquí hi deia «Galícia, Astúries, Lleó, Burgos, Sòria, Saragossa,
     * Peníscola i Balears», i era la frase que llegeix algú per decidir si es
     * mou. Tenia dos errors, tots dos comprovats amb `computeLocalCircumstances`
     * damunt de seixanta localitats:
     *
     *  1. OMETIA LA CIUTAT MÉS GRAN DE LA FRANJA. València té 62 s de totalitat
     *     (marge umbral −6,5″, ben endins), i és el municipi més poblat que
     *     la franja travessa. També hi faltaven Castelló 94 s, Valladolid 89 s,
     *     Santander 60 s, Vitòria 60 s, Logronyo 79 s, Tarragona 58 s.
     *  2. DEIA «GALÍCIA» SENCERA I NO HI ÉS. El motor deixa fora Vigo (99,40 %
     *     d'obscuració), Pontevedra (99,62 %), Ourense (99,89 %) i Santiago
     *     (99,98 %, marge +1,5″: dins de la incertesa de les efemèrides). Una
     *     comunitat entera com a etiqueta convidava mitja Galícia a quedar-se
     *     a casa amb una parcial. Ara s'hi diuen ciutats, que és el que la gent
     *     pot comprovar.
     *
     * NO HI POSEM Bilbao (23 s, marge −0,8″), Lleida (20 s, −0,6″) ni Zamora
     * (30 s, −1,3″): el motor els dona totalitat però amb `edgeUncertain`, i
     * una llista publicada no és el lloc per jugar-se una moneda a l'aire.
     *
     * I S'HI DIU QUI EN QUEDA FORA PER POC, que és informació que ningú no
     * dona: Barcelona es queda al 99,80 %. Sense dir-ho, un barceloní llegeix
     * la llista, no s'hi troba, i no sap si és per 10 km o per 300.
     *
     * MADRID I SANTIAGO TENEN CLÀUSULA PRÒPIA, i és una correcció d'aquest
     * mateix text. Deia «Barcelona, Madrid, Pamplona i Vigo en queden fora» i
     * afirmava de Madrid una cosa que el motor NO diu: marge +1,85″ i
     * `edgeUncertain: true` (Santiago, +1,67″, igual). O sigui que el càlcul
     * no els pot situar ni dins ni fora. Just tres línies més amunt, aquest
     * mateix comentari es nega a posar Bilbao, Lleida i Zamora a la llista de
     * DINS pel mateix motiu: l'asimetria era la trampa. I el producte es
     * contradeia a si mateix — un madrileny llegia «queda fora» amb lletra
     * impresa i, si tocava el mapa al seu punt, la mateixa app li deia «just
     * al caire, ves-hi amb marge».
     *
     * Barcelona (+6,99″), Pamplona (+2,81″) i Vigo (+15,93″) sí que en queden
     * fora amb el motor decidit, i per això es queden a l'enumeració.
     *
     * L'altura: dins de la franja i sobre terra el motor va de 12,3° (Malpica
     * de Bergantiños) i 12,0° (A Coruña) fins a 1,8° a Maó i 1,7° a l'Illa de
     * l'Aire. Deia «entre 12° i 1°»; el mínim real arrodoneix a 2°, no a 1°.
     */
    spain: {
      ca: 'Franja de NO a SE: A Coruña, Oviedo i Gijón, Santander, Lleó, Burgos, Valladolid, Logronyo, Vitòria, Sòria, Saragossa, Tarragona, Castelló, València i les Balears. Al capvespre, amb el Sol de 12° a menys de 2° sobre l’horitzó. Barcelona, Pamplona i Vigo en queden fora per poc: parcial del 99 %, que no és el mateix. Madrid i Santiago es queden a la ratlla mateixa: el càlcul no els pot situar ni dins ni fora.',
      es: 'Franja de NO a SE: A Coruña, Oviedo y Gijón, Santander, León, Burgos, Valladolid, Logroño, Vitoria, Soria, Zaragoza, Tarragona, Castellón, Valencia y Baleares. Al atardecer, con el Sol de 12° a menos de 2° sobre el horizonte. Barcelona, Pamplona y Vigo se quedan fuera por poco: parcial del 99 %, que no es lo mismo. Madrid y Santiago se quedan en la raya misma: el cálculo no puede situarlos ni dentro ni fuera.',
      en: 'The path runs NW to SE through A Coruña, Oviedo and Gijón, Santander, León, Burgos, Valladolid, Logroño, Vitoria, Soria, Zaragoza, Tarragona, Castellón, Valencia and the Balearic Islands. It happens at sunset, with the Sun from 12° to less than 2° above the horizon. Barcelona, Pamplona and Vigo narrowly miss totality: a 99% partial eclipse is not the same thing. Madrid and Santiago lie right on the edge, where the calculation cannot reliably place them inside or outside.',
      fr: 'La bande traverse du nord-ouest au sud-est A Coruña, Oviedo, Gijón, Santander, León, Burgos, Valladolid, Logroño, Vitoria, Soria, Saragosse, Tarragone, Castellón, Valence et les Baléares. L’éclipse a lieu au coucher du Soleil, entre 12° et moins de 2° au-dessus de l’horizon. Barcelone, Pampelune et Vigo manquent de peu la totalité : une partielle à 99 % n’est pas la même chose. Madrid et Saint-Jacques-de-Compostelle sont exactement sur la limite, où le calcul ne peut les classer avec certitude.',
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
      en: [
        'This eclipse is decided by the horizon. With the Sun so low, what you have to the west matters more than the path map: a modest ridge can cost more than driving a hundred kilometres in the wrong direction.',
        'Check the horizon on site before eclipse day. A photograph of the western skyline from the exact place where you plan to stand is worth more than any forecast.',
        'Near the horizon, haze and low cloud can block the Sun just like a mountain. Keep a nearby plan B with a different horizon.',
      ],
      fr: ['Cette éclipse se joue sur l’horizon. Avec un Soleil si bas, une crête modeste à l’ouest compte davantage que la carte de la bande.', 'Vérifiez l’horizon sur place avant le jour J. Une photo du panorama occidental depuis votre point exact vaut plus que toute prévision.', 'Près de l’horizon, brume et nuages bas bloquent le Soleil comme une montagne. Gardez un plan B proche avec un autre horizon.'],
    },
  },
  {
    id: '2027-08-02',
    greatestEclipseUtc: '2027-08-02T10:07:50Z',
    kind: 'total',
    label: {
      ca: 'Eclipsi total del 2 d’agost de 2027',
      es: 'Eclipse total del 2 de agosto de 2027',
      en: 'Total solar eclipse of 2 August 2027',
      fr: 'Éclipse solaire totale du 2 août 2027',
    },
    /*
     * LA DADA QUE FA AIXECAR CELLES, dita amb el matís exacte: el màxim de
     * 6 min 23 s és al desert egipci, no aquí — des de l'Estret el motor
     * dona ~4 min i mig (Tarifa 4 min 37 s), que ja dobla el 2026. La
     * totalitat més llarga visible des de terra fins al 3 de juny de 2114
     * és una afirmació de l'ECLIPSI sencer, i així s'escriu.
     *
     * REVERIFICAT EL 3-8-2026 contra el motor, i les dues xifres aguanten:
     * escombrant la línia central sencera amb `centralLineAt`, el màxim de
     * durada surt de 383,1 s = 6 min 23,1 s a 26,83 N / 31,11 E — la vall del
     * Nil, Egipte. I `computeLocalCircumstances` dona Tarifa 277,3 s (4 min
     * 37 s), Ceuta 287,7 s, Algesires 264,5 s: «uns 4 min i mig» és exacte.
     * Els quatre llocs de la frase tenen totalitat de sobres (Cadis 167,5 s,
     * Màlaga 100,0 s, Ceuta 287,7 s, Melilla 275,6 s). Sevilla (98,30 %) i
     * Granada (99,17 %) en queden fora, i per això no hi són.
     */
    spain: {
      ca: 'Franja per l’estret de Gibraltar: Cadis, Màlaga, Ceuta i Melilla. Al matí i amb el Sol alt — l’eclipsi fàcil dels tres. I el gran: cap totalitat visible des de terra el superarà fins al 2114 (6 min 23 s al màxim, a Egipte; des de l’Estret, uns 4 min i mig).',
      es: 'Franja por el estrecho de Gibraltar: Cádiz, Málaga, Ceuta y Melilla. Por la mañana y con el Sol alto — el eclipse fácil de los tres. Y el grande: ninguna totalidad visible desde tierra lo superará hasta 2114 (6 min 23 s en el máximo, en Egipto; desde el Estrecho, unos 4 min y medio).',
      en: 'The path crosses the Strait of Gibraltar: Cádiz, Málaga, Ceuta and Melilla. It happens in the morning with the Sun high—the easiest of the three eclipses. It is also the long one: no totality visible from land will surpass it until 2114 (6 min 23 s at maximum in Egypt; about 4½ minutes from the Strait).',
      fr: 'La bande traverse le détroit de Gibraltar : Cadix, Málaga, Ceuta et Melilla. Elle se produit le matin avec le Soleil haut — la plus facile des trois. C’est aussi la grande : aucune totalité visible depuis la terre ne la dépassera avant 2114 (6 min 23 s au maximum en Égypte ; environ 4 min 30 depuis le détroit).',
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
      en: [
        'The Sun will be high enough that a distant ridge is much less likely to spoil the view. Here, getting well inside the path matters more than finding a perfectly flat horizon.',
        'Heat, traffic and access will be the practical constraints. Arrive early and do not rely on the last road into the path.',
        'This is the most forgiving eclipse of the three, but clouds still win. Keep a mobile plan B within the path.',
      ],
      fr: ['Le Soleil sera assez haut pour qu’une crête lointaine menace peu la vue. Être bien à l’intérieur de la bande compte davantage qu’un horizon parfaitement plat.', 'Chaleur, circulation et accès seront les contraintes pratiques. Arrivez tôt et ne dépendez pas de la dernière route vers la bande.', 'C’est la plus tolérante des trois éclipses, mais les nuages gagnent toujours. Gardez un plan B mobile dans la bande.'],
    },
  },
  {
    id: '2028-01-26',
    greatestEclipseUtc: '2028-01-26T15:08:59Z',
    kind: 'annular',
    label: {
      ca: 'Eclipsi anular del 26 de gener de 2028',
      es: 'Eclipse anular del 26 de enero de 2028',
      en: 'Annular solar eclipse of 26 January 2028',
      fr: 'Éclipse solaire annulaire du 26 janvier 2028',
    },
    /*
     * QUATRE CIUTATS PER A UNA FRANJA QUE TRAVESSA MIG PAÍS (corregit el
     * 3-8-2026, mateixa passada que el 2026). El motor dona anularitat a
     * vint-i-cinc de les vint-i-vuit localitats provades: la franja d'aquest
     * eclipsi fa ~1.170 km d'amplada sobre la península —quatre vegades la del
     * 2026— i n'hi cabien Huelva 432 s, Còrdova 433 s, Albacete 426 s,
     * Granada 318 s, Alacant 299 s, Cadis 400 s, Jaén 411 s, Castelló 421 s,
     * Tarragona 372 s i Barcelona 378 s, cap de les quals hi era.
     *
     * ELS QUE EN QUEDEN FORA són Madrid (+10,9″), Almeria (+10,6″) i
     * Saragossa (+16,6″): els tres amb un 82 % de parcial. Val la pena
     * dir-ho perquè són les tres úniques capitals importants d'aquesta meitat
     * del país que es queden a fora, i el mapa mental de la gent no ho endevina.
     *
     * L'ALTURA DEL SOL: dins de la franja el motor va de 8,4° (Ayamonte) i
     * 8,0° (Huelva) al sud-oest fins a per sota de l'horitzó al nord-est —
     * Barcelona 0,16° al màxim (el Sol es pon entre el màxim i C3), Palma
     * 0,38°, Girona −0,39° i Maó −0,69°, on l'anularitat ja arriba amb el Sol
     * post. La guia deia «entre uns 7° i amb prou feines 2°», que no cobreix
     * cap dels dos extrems.
     */
    spain: {
      ca: 'Franja de SO a NE: Huelva, Sevilla, Cadis, Còrdova, Jaén, Granada, Màlaga, Albacete, Múrcia, Alacant, València, Castelló, Tarragona, Barcelona i les Balears. Al capvespre, amb el Sol de 8° al sud-oest fins a ran d’horitzó al nord-est: a Barcelona i Palma es pon durant l’anularitat, i a Girona i Maó ja s’ha post. Madrid, Saragossa i Almeria en queden fora.',
      es: 'Franja de SO a NE: Huelva, Sevilla, Cádiz, Córdoba, Jaén, Granada, Málaga, Albacete, Murcia, Alicante, Valencia, Castellón, Tarragona, Barcelona y Baleares. Al atardecer, con el Sol de 8° en el suroeste hasta el ras del horizonte en el noreste: en Barcelona y Palma se pone durante la anularidad, y en Girona y Mahón ya se ha puesto. Madrid, Zaragoza y Almería se quedan fuera.',
      en: 'The path runs SW to NE through Huelva, Seville, Cádiz, Córdoba, Jaén, Granada, Málaga, Albacete, Murcia, Alicante, Valencia, Castellón, Tarragona, Barcelona and the Balearic Islands. It happens at sunset, with the Sun from 8° high in the southwest down to the horizon in the northeast: it sets during annularity in Barcelona and Palma, and has already set in Girona and Maó. Madrid, Zaragoza and Almería lie outside the path.',
      fr: 'La bande va du sud-ouest au nord-est par Huelva, Séville, Cadix, Cordoue, Jaén, Grenade, Málaga, Albacete, Murcie, Alicante, Valence, Castellón, Tarragone, Barcelone et les Baléares. Au coucher du Soleil, sa hauteur passe de 8° au sud-ouest à l’horizon au nord-est : il se couche pendant l’annularité à Barcelone et Palma, et est déjà couché à Gérone et Maó. Madrid, Saragosse et Almería restent hors de la bande.',
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
      en: [
        'This is an annular eclipse: the bright ring is exposed photosphere. Solar filters stay on throughout the event, with no exception.',
        'The Sun will be extremely low across much of the path. The exact western horizon can decide whether you see the ring at all.',
        'In the northeast the Sun sets during, or even before, annularity. Calculate your exact point and choose a clear sea or lowland horizon.',
      ],
      fr: ['C’est une éclipse annulaire : l’anneau lumineux est de la photosphère exposée. Le filtre solaire reste en place sans aucune exception.', 'Le Soleil sera extrêmement bas sur une grande partie de la bande. L’horizon occidental exact peut décider si vous voyez l’anneau.', 'Au nord-est, le Soleil se couche pendant, voire avant, l’annularité. Calculez votre point exact et choisissez un horizon maritime ou de plaine dégagé.'],
    },
  },
];

export function getEclipse(id: string): EclipseEntry {
  const entry = ECLIPSES.find((e) => e.id === id);
  if (!entry) throw new Error(`Eclipsi desconegut: ${id}`);
  return entry;
}
