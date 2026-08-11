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
 * PER QUÈ HI HA `kind`. Perquè dues d'aquestes peces són de ràdio i el botó
 * deia «Llegeix la peça» a totes tretze. Un enllaç que promet un text i obre un
 * reproductor és una mentida petita, però és de la família que aquest projecte
 * no es permet: la mateixa que anunciava «Galícia» d'una franja que no passa
 * per Vigo. La capa de vista tria la crida amb aquest camp.
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
 *   · `vilapress.png` — el seu logotip es publica sobre paper (254,254,254).
 *     El paper s'ha passat a alfa 0 i les lletres a alfa 255, i després s'ha
 *     retallat a la caixa de la tinta perquè ocupi la seva targeta com els
 *     altres. La distància al blanc de la tinta més fluixa —el gris de «TE
 *     INFORMA»— és 87, i la del paper 1: el sòl de 8 no toca cap lletra.
 *
 * Els altres onze arriben tal com els publica cadascú. Qui vigila que cap
 * d'aquests fitxers no sigui un document buit és `tests/actius-binaris.test.ts`,
 * que els té declarats un per un.
 */

/**
 * Si la peça es llegeix o s'escolta. No és cap detall d'estil: decideix què
 * promet el botó, i és l'única cosa que la vista necessita saber per no mentir.
 */
export type MentionKind = 'article' | 'audio';

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
    name: 'Diari de Barcelona',
    logo: 'diari-barcelona.png',
    url: 'https://www.diaridebarcelona.cat/w/saps-on-veuras-eclipsi-web-ajuda-decisio?redirect=%2F',
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
];
