/**
 * QUI HA PARLAT D'ECLIPSI.INFO, I EN QUIN ORDRE.
 *
 * PER QUÈ ÉS UN MÒDUL I NO UNA CONSTANT DINS D'`AboutScreen.tsx`. Pel mateix
 * motiu que `credits.ts`: una llista que només viu dins d'un component és una
 * llista que cap prova de Node pot llegir sense muntar un DOM, i per tant una
 * llista que ningú no compara amb res. Aquí hi va viure sencera durant una
 * setmana i el `logo` de cada fila era una cadena que no havia tocat mai el
 * disc: un fitxer mal escrit hauria sortit publicat com una targeta amb vora i
 * sense res a dins —la forma d'error de sempre en aquest projecte— i no ho
 * hauria dit ni la consola. Ara ho compara `tests/cobertura-editorial.test.ts`,
 * en les dues direccions.
 *
 * L'ORDRE ÉS D'ABAST, NO DE DATA. La primera fila ocupa tota l'amplada de la
 * graella (`.about__mention--lead`), o sigui que la decisió es veu: és la peça
 * que fa de portada del bloc. Es posen davant els mitjans que arriben a més
 * gent i les peces que parlen de l'app —no les que la citen de passada dins
 * d'un reportatge d'una altra cosa. Aquest criteri s'escriu aquí perquè el dia
 * que entri una fila nova hi hagi alguna cosa contra la qual decidir on va, en
 * comptes d'enganxar-la al final, que és on acaben totes les llistes que no
 * diuen com s'ordenen.
 *
 * PER QUÈ HI HA `kind`. Perquè dues d'aquestes peces són de ràdio, una és de
 * televisió i el botó deia «Llegeix la peça» a totes. Un enllaç que promet un
 * text i obre un reproductor és una mentida petita, però és de la família que
 * aquest projecte no es permet: la mateixa que anunciava «Galícia» d'una franja
 * que no passa per Vigo. La capa de vista tria la crida amb aquest camp, i ho
 * fa amb una taula i no amb un condicional (`MENTION_CTA` a `AboutScreen.tsx`):
 * així, el dia que entri una peça d'una mena que encara no existeix, qui no li
 * escrigui la crida es trobarà un error de compilació i no un botó que menteix.
 *
 * ELS LOGOTIPS NO SÓN NOSTRES i viuen a `public/press/media-logos/`. Els pinta
 * `.about__mentionlogo` amb `grayscale(1) brightness(0) invert(1)`: el filtre
 * emblanquina tot el que sigui OPAC, sigui de quin color sigui. La conseqüència
 * pràctica, que ja ha costat una passada: un logotip amb el paper blanc a sobre
 * no surt blanc sobre el fons fosc, surt un RECTANGLE blanc. Per això dos
 * fitxers d'aquí no són el que publica el mitjà tal qual:
 *
 *   · `rac1.svg` — és l'SVG que RAC1 mateix incrusta al seu full d'estil, sense
 *     el `<path d="M0,0h500v500H0"/>` que li fa de quadrat negre de fons. Amb el
 *     quadrat, el filtre donava un quadrat blanc i prou.
 *   · `vilapress.png`, `laciutat.png`, `radiosantandreu.png`, `radiodesvern.png`
 *     — es publiquen sobre paper blanc. El paper s'ha passat a alfa 0 i la
 *     tinta a alfa 255, i després s'ha retallat a la caixa de la tinta perquè
 *     ocupin la targeta com els altres. A Vilapress, la distància al blanc de
 *     la tinta més fluixa —el gris de «TE INFORMA»— és 87 i la del paper 1: el
 *     sòl de 8 no toca cap lletra. El de Ràdio Desvern arriba en JPEG i el
 *     paper hi porta soroll de compressió, i per això el seu sòl és 18.
 *
 *     De passada, això arregla sol un cas que semblava un problema i no ho és:
 *     els logotips amb una placa de color i el dibuix CALAT a dins —el quadrat
 *     de Ràdio Desvern, la rodona de La Ciutat— surten amb el calat convertit
 *     en forat, que és exactament com es dibuixa el negatiu d'una marca així.
 *
 *   · `radiomaricel.png` — aquest va A L'INREVÉS i és l'excepció que val la
 *     pena tenir escrita: la seva marca és BLANCA sobre una plaça blava plena.
 *     Qui s'hi quedés la tinta es quedaria la plaça, i publicaria un quadrat.
 *     Aquí la tinta és el blanc i la plaça és el fons.
 *
 *   · `nextllobregat.png` — el fitxer que publiquen és el logotip MÉS un
 *     muntatge d'un portàtil i un mòbil. El muntatge no és la marca, i sota el
 *     filtre hauria sortit una taca blanca al costat del nom. S'ha retallat pel
 *     buit de 57 px que separa les dues coses.
 *
 * Els altres arriben tal com els publica cadascú. Qui vigila que cap d'aquests
 * fitxers no sigui un document buit és `tests/actius-binaris.test.ts`, que els
 * té declarats un per un.
 *
 * EL DE LA XARXA ÉS EL MÉS PETIT DE TOTS: 235 × 59, que és l'únic que publiquen
 * al reproductor. A l'alçada de la targeta li'n caldrien 318 per anar fi en una
 * pantalla de doble densitat, i per tant es veurà una mica tou. S'hi queda així:
 * abans un logotip lleugerament tou que un d'inflat, que és mentir sobre una
 * resolució que no hi és —la mateixa regla que amb les xifres.
 */

/**
 * Si la peça es llegeix, s'escolta o es mira. No és cap detall d'estil:
 * decideix què promet el botó, i és l'única cosa que la vista necessita saber
 * per no mentir.
 */
export type MentionKind = 'article' | 'audio' | 'video';

export interface MediaMention {
  /**
   * La capçalera. No es pinta —el logotip ja ho diu— però és el que sent qui
   * navega amb lector de pantalla, perquè la imatge va amb `alt=""`.
   */
  name: string;
  /** Nom de fitxer dins de `public/press/media-logos/`, amb extensió. */
  logo: string;
  url: string;
  kind: MentionKind;
}

export const MEDIA_MENTIONS: MediaMention[] = [
  {
    name: 'El Periódico',
    logo: 'elperiodico.svg',
    url: 'https://www.elperiodico.com/es/ciencia/20260811/eclipse-solar-aplicacion-mejor-lugar-ver-dv-133256495',
    kind: 'article',
  },
  {
    name: 'Cadena SER',
    logo: 'cadena-ser.svg',
    url: 'https://cadenaser.com/audio/1786449663539/',
    kind: 'audio',
  },
  {
    name: 'RAC1',
    logo: 'rac1.svg',
    url: 'https://www.rac1.cat/a-la-carta/detail/6e265cbc-4f30-4e0f-b783-d937714e71de',
    kind: 'audio',
  },
  {
    name: 'Ouest-France',
    logo: 'ouest-france.svg',
    url: 'https://www.ouest-france.fr/sciences/astronomie/cote-sauvage-pointe-de-keroch-nos-meilleurs-spots-pour-admirer-leclipse-du-12-aout-dans-le-morbihan-7376bdce-8f52-11f1-bac6-43ee9437487c',
    kind: 'article',
  },
  {
    name: 'La Verdad',
    logo: 'laverdad.svg',
    url: 'https://www.laverdad.es/tecnologia/app-realidad-aumentada-simula-vera-eclipse-lugar-20260811191423-nt.html',
    kind: 'article',
  },
  /*
   * «Notícies en Xarxa Estiu», de l'11 d'agost del 2026. Va aquí i no més avall
   * perquè no és una televisió: és LA XARXA DE MITJANS LOCALS, i el que hi surt
   * el reemeten les televisions comarcals de tot el país. Sumat, arriba a més
   * gent que qualsevol de les capçaleres que vénen a continuació —encara que
   * cap d'elles sola no ho sembli.
   */
  {
    name: 'La Xarxa',
    logo: 'laxarxames.png',
    url: 'https://laxarxames.cat/player/5057028?streamType=MAIN',
    kind: 'video',
  },
  {
    name: 'VilaWeb',
    logo: 'vilaweb.svg',
    url: 'https://www.vilaweb.cat/noticies/on-veure-eclipsi-12-agost-coses-tenir-compte-veure-platja/',
    kind: 'article',
  },
  {
    name: 'Time Out Barcelona',
    logo: 'timeout.png',
    url: 'https://www.timeout.es/barcelona/es/noticias/un-disenador-catalan-crea-una-app-para-el-eclipse-solar-que-te-permite-comprobar-si-un-edificio-o-un-arbol-te-tapara-la-vision-080626',
    kind: 'article',
  },
  {
    name: 'Diari de Tarragona',
    logo: 'diari-tarragona.svg',
    url: 'https://www.diaridetarragona.com/tarragona/267731/eclipse-solar-total-2026-web-gratuita-buscar-mejor-sitio-tarragona-ver-12-agosto_amp.html',
    kind: 'article',
  },
  {
    name: 'Lleida.com',
    logo: 'lleida.svg',
    url: 'https://www.lleida.com/noticia_canal/una-eina-catalana-permet-calcular-el-millor-punt-veure-leclipsi-solar-del-12-dagost',
    kind: 'article',
  },
  {
    name: 'Diari de Barcelona',
    logo: 'diari-barcelona.png',
    url: 'https://www.diaridebarcelona.cat/w/saps-on-veuras-eclipsi-web-ajuda-decisio?redirect=%2F',
    kind: 'article',
  },
  {
    name: 'La Ciutat',
    logo: 'laciutat.png',
    url: 'https://laciutat.cat/catalunya/eclipsi-total-sol-12-agost-5-dubtes-has-resoldre-abans-veure_898193_102.html',
    kind: 'article',
  },
  {
    name: 'MetaData',
    logo: 'metadata.svg',
    url: 'https://www.metadata.cat/reportatge/6458/eclipsi-tecnologic-historia-eines-digitals-millor-punt-sol',
    kind: 'article',
  },
  {
    name: 'dBalears',
    logo: 'dbalears.svg',
    url: 'https://www.dbalears.cat/balears/balears/2026/08/06/421691/eclipsi-info-eina-gratuita-ajuda-trobar-millor-lloc-per-veure-eclipsi.html',
    kind: 'article',
  },
  {
    name: 'el 3 de vuit',
    logo: 'el3devuit.svg',
    url: 'https://el3devuit.cat/2026/08/06/143001/actualitat/expectacio-per-veure-leclipsi-solar-de-dimecres/',
    kind: 'article',
  },
  {
    name: 'Next Llobregat',
    logo: 'nextllobregat.png',
    url: 'https://www.nextllobregat.cat/ca/noticia/un-jove-emprenedor-del-baix-crea-una-app-gratuita-per-triar-el-millor-lloc-des-don-veure-leclipsi/ciencia',
    kind: 'article',
  },
  {
    name: 'Vilapress',
    logo: 'vilapress.png',
    url: 'https://www.vilapress.cat/articulo/baix-llobregat/2026-08-08/5979200-emprendedor-baix-llobregat-crea-app-encontrar-mejor-lugar-ver-eclipse',
    kind: 'article',
  },
  {
    name: 'Diari de Catalunya',
    logo: 'diari-catalunya.png',
    url: 'https://diaricatalunya.cat/baix-penedes/general/expectacio-per-leclipsi-solar-total-al-penedes',
    kind: 'article',
  },
  /*
   * LA CUA SÓN ELS MITJANS DE POBLE, i no hi és per condescendència: hi és
   * perquè el criteri d'aquesta llista és l'abast, i el d'un municipi és el
   * d'un municipi. Val la pena dir què hi ha aquí baix, perquè de contingut en
   * tenen més que uns quants de més amunt: Ràdio Maricel va seure a parlar amb
   * l'autor mitja hora, i Ràdio Sant Andreu i Esplugues.digital van escriure
   * peces senceres sobre com mirar l'eclipsi des del seu carrer. Si algun dia
   * el criteri d'ordre passa a ser la profunditat de la peça i no l'abast del
   * mitjà, aquestes quatre files pugen, i el comentari de dalt s'ha de reescriure.
   */
  {
    name: 'Ràdio Sant Andreu',
    logo: 'radiosantandreu.png',
    url: 'https://www.radiosantandreu.com/es-podra-veure-leclipsi-des-de-sant-andreu-de-la-barca-un-emprenedor-baixllobregati-crea-un-app-per-comprovar-ho/',
    kind: 'article',
  },
  {
    name: 'Ràdio Maricel',
    logo: 'radiomaricel.png',
    url: 'https://www.radiomaricel.cat/eclipsi-info-un-web-que-us-pot-ajudar-a-tenir-clar-des-don-es-pot-veure-millor-leclipsi-de-dimecres-nhem-parlat-amb-el-seu-creador-humbert-blanco/',
    kind: 'audio',
  },
  {
    name: 'Esplugues.digital',
    logo: 'esplugues.svg',
    url: 'https://esplugues.digital/com-veure-eclipsi-12-agost-esplugues/',
    kind: 'article',
  },
  {
    name: 'Ràdio Desvern',
    logo: 'radiodesvern.png',
    url: 'https://www.radiodesvern.com/news/sant-just-desvern-es-prepara-per-observar-leclipsi-solar-del-12-dagost/',
    kind: 'article',
  },
];
