/**
 * Contingut de la guia de l'eclipsi, com a dades tipades.
 *
 * Per què dades i no JSX: així el mateix contingut es pot renderitzar a la
 * guia, exportar a text pla per a l'ús offline, o filtrar per eclipsi sense
 * duplicar cap marcatge. El component només sap pintar blocs.
 *
 * FONTS (totes consultades i verificades; res d'aquí és inventat):
 *
 * [MOTOR]    El nostre propi motor, que MANA PER SOBRE DE TOTES LES ALTRES.
 *            `computeLocalCircumstances` (`core/astro/contacts.ts`),
 *            `computeEclipsePath` i `centralLineAt` (`core/eclipses/path.ts`) i
 *            el model de llum de `core/sky`. Quan una font oficial diu una cosa
 *            i el motor en diu una altra, s'escriu la del motor i el perquè al
 *            costat: vegeu [IGN-2028] aquí sota.
 *            AUDITORIA DEL 3-8-2026: es van recalcular TOTES les afirmacions
 *            numèriques d'aquest fitxer sobre seixanta localitats i les tres
 *            línies centrals. Set no quadraven i estan corregides — la durada
 *            de la totalitat del 2026, els dos rangs d'altura del Sol, el buit
 *            C1→C2, el buit C3→C4, l'angle d'una serra a 10 km, el radi de la
 *            corona en graus i l'amplada de l'ombra. Cada correcció duu al
 *            costat la xifra que dona el motor. Perquè no es tornin a separar
 *            en silenci, ara les vigila `tests/afirmacions-del-text.test.ts`,
 *            que les torna a calcular totes a cada `vitest run`.
 *
 * [IGN-OBS]  IGN — «Cómo observar los eclipses: Protege tus ojos»
 *            https://eclipses.ign.es/como-observar-eclipses.html
 *            Filtres casolans desaconsellats (pel·lícules velades, disquets,
 *            radiografies, ulleres de sol, CD, vidres fumats, ulleres de
 *            soldador excepte grau 12-14); projecció com a mètode segur;
 *            escalfament de l'ocular en telescopis.
 * [IGN-DEF]  IGN — «Qué es un eclipse»
 *            https://eclipses.ign.es/que-es-un-eclipse.html
 *            Magnitud = fracció del DIÀMETRE angular del Sol tapada, relació
 *            entre diàmetres i no entre àrees. Obscuració = fracció de l'ÀREA
 *            del disc solar tapada. «No se da una correspondencia única entre
 *            magnitud y oscurecimiento».
 * [IGN-TOT]  IGN — «Qué se ve en un eclipse total»
 *            https://eclipses.ign.es/que-se-ve-en-un-eclipse-total.html
 *            Grans de Baily, anell de diamant, corona, cromosfera rosada per
 *            emissió d'hidrogen, «descenso muy brusco de la temperatura, todo
 *            en cuestión de unos cuantos segundos», reacció dels animals.
 * [IGN-2028] IGN — «Eclipse anular de Sol de 26 de enero de 2028»
 *            https://eclipses.ign.es/eclipse-anular-sol-de-26-de-enero-2028.html
 *            Cal «esa parte del horizonte bien despejada de montes, árboles,
 *            edificios u otros obstáculos». La pàgina diu «Sol a 4-7°», però
 *            aquest interval NO cobreix tota la franja espanyola: el motor del
 *            projecte (computeLocalCircumstances) dona 8,4° a Ayamonte i 8,0° a
 *            Huelva a l'extrem sud-oest, 7,3° a Sevilla, 2,4° a València, 0,2°
 *            a Barcelona i −0,4° a Girona i −0,7° a Maó, on l'anularitat
 *            arriba amb el Sol JA POST. La guia escriu els valors del motor,
 *            no els de la pàgina. (Fins al 3-8-2026 aquesta nota deia «~7° a
 *            Sevilla i ~2° a València», que és cert però són dos punts de
 *            mig país: donaven la impressió que 2° era el mínim quan al
 *            nord-est de la franja el Sol ja s'ha post.)
 * [IGN-COND] IGN — «Condiciones de observación»
 *            https://eclipses.ign.es/condiciones-de-observacion.html
 *            La refracció atmosfèrica altera l'altura aparent del Sol i l'efecte
 *            és més important com més baix està.
 * [AAS-EYE]  American Astronomical Society — «Eye Safety»
 *            https://eclipse.aas.org/eye-safety
 *            Norma ISO 12312-2; les ulleres de sol «transmit far more sunlight
 *            than is safe»; els filtres van SEMPRE al davant de l'òptica; treure
 *            el filtre «only when the Moon completely covers the Sun's bright
 *            face»; en un eclipsi anular «there is no time when it is safe to
 *            look directly at the Sun without a special-purpose solar filter».
 * [AAS-PROJ] AAS — «Projection»
 *            https://eclipse.aas.org/eye-safety/projection
 *            Projecció estenopeica; «Do NOT look at the Sun through the
 *            pinhole(s)»; la projecció no serveix durant la totalitat.
 * [AAS-DARK] AAS — «How Dark Does It Get During a Total Solar Eclipse?»
 *            https://eclipse.aas.org/eclipse-basics/totality-darkness
 *            100 000 lux amb Sol ple; 25 000 lux al 75% d'obscuració;
 *            1 000 lux al 99% («only about as dark as an overcast day»);
 *            ~5 lux durant la totalitat (comparable al crepuscle civil);
 *            la pupil·la passa d'~1 mm a ~2 mm durant la parcial (×4 de llum).
 *            ATENCIÓ ABANS DE COPIAR-NE CAP XIFRA: totes són d'eclipsis amb el
 *            SOL ALT. Els espanyols del 2026 i el 2028 tenen el Sol entre 12° i
 *            ran d'horitzó a la fase central (motor: la Corunya 12,0° i Maó
 *            1,8° el 2026; Huelva 8,0°, Sevilla 7,3°, València 2,4°, Barcelona
 *            0,2° i Girona −0,4° el 2028), on el cel serè dona des d'uns
 *            17.000 lux fins a menys de 2.000 arran d'horitzó i el mateix
 *            percentatge tapat deixa molta menys llum en valor absolut. Aquest
 *            fitxer les cita com el que són —la referència de migdia— i al
 *            costat hi posa les del cas espanyol, que surten del model del
 *            projecte (`src/core/sky/illuminance.ts` amb la taula obscuració →
 *            flux de `solarDisc.ts`; amb el Sol a 60° dona 97.330 lux de cel
 *            serè, 571 al 99% d'obscuració i 7,10 a la totalitat — el 99%
 *            queda per sota dels 1.000 de l'AAS perquè la Lluna acaba tapant
 *            el centre del disc, que brilla més que el limbe).
 *            El guió de la totalitat no n'escriu cap a mà: les demana al model
 *            amb l'altura del Sol del punt de l'usuari.
 * [NASA-EXP] NASA RP 1318 — «Solar Eclipse Exposure Guide» (F. Espenak)
 *            https://umbra.nascom.nasa.gov/eclipse/941103/tables/table.15
 *            Fórmula t = f² / (I × 2^Q) i factors Q per subjecte. Els valors Q
 *            d'aquest fitxer són literalment els de la taula.
 * [NASA-PHO] NASA/GSFC — «Solar Eclipse Photography» (F. Espenak)
 *            https://eclipse.gsfc.nasa.gov/SEhelp/SEphoto.html
 *            «the diameter of the Sun's image is approximately equal to the
 *            focal length divided by 109».
 * [MRE-PHO]  mreclipse.com — «How to Photograph a Solar Eclipse» (F. Espenak)
 *            https://www.mreclipse.com/SEphoto/SEphoto.html
 *            Focal màxima 2500 mm (full frame) / 1700 mm (APS-C) per al disc
 *            sencer; ~1000 mm (full frame) / 700 mm (APS-C) per a la corona.
 * [ISO]      AAS — «About the ISO 12312-2 Standard for Solar Viewers»
 *            https://eclipse.aas.org/eye-safety/iso12312-2
 *            La norma fixa una transmitància lluminosa MÀXIMA del 0,0032% i
 *            una mínima del 0,000061%, a més del bloqueig de l'ultraviolat i
 *            de com a mínim el 97% de l'infraroig. Al text de la guia hi ha el
 *            límit màxim (0,0032%), que és el que decideix si un filtre val.
 */

import type { Locale } from '../i18n';

/* ------------------------------------------------------------------ tipus */

/**
 * To visual d'un avís. Es mapa a les variables de color del sistema.
 *
 * EL VOCABULARI DE L'AMBRE, DECIDIT AQUÍ I OBEÏT A `guide.css`: l'ambre
 * (`--status-partial`, que és el mateix sun-500 de l'accent) queda RESERVAT
 * als avisos de dany irreversible — la seguretat ocular i el 'warn' que la
 * porta. Tot el que és consell, logística o context va en 'info', que es
 * pinta NEUTRE (tinta secundària, sense taronja). La pantalla n'havia
 * arribat a tenir vuit alhora entre insígnies, pics de llista i requadres:
 * quan tot és ambre, l'ambre que t'ha de salvar la retina ja no crida.
 */
export type Tone = 'info' | 'good' | 'warn' | 'bad';

export interface ParagraphBlock {
  kind: 'p';
  text: string;
}

export interface ListBlock {
  kind: 'list';
  tone?: Tone;
  items: string[];
}

/** Llista de definicions: terme curt + explicació. Per a C1-C4, magnitud, etc. */
export interface DefsBlock {
  kind: 'defs';
  items: { term: string; text: string }[];
}

export interface CalloutBlock {
  kind: 'callout';
  tone: Tone;
  title: string;
  text: string;
}

export interface TableBlock {
  kind: 'table';
  head: string[];
  rows: string[][];
  caption?: string;
}

export type GuideBlock =
  | ParagraphBlock
  | ListBlock
  | DefsBlock
  | CalloutBlock
  | TableBlock;

export type GuideSectionId =
  | 'safety'
  | 'phases'
  | 'watch'
  | 'lowsun'
  | 'photo'
  | 'checklist';

export interface GuideSection {
  id: GuideSectionId;
  title: string;
  /** Frase d'entrada, visible amb la secció plegada. */
  lead: string;
  blocks: GuideBlock[];
  /** S'obre sola en carregar la guia. */
  defaultOpen?: boolean;
  /**
   * Ids d'eclipsi per als quals la secció és especialment rellevant. La vista
   * la marca i l'obre. Buit o absent = rellevant sempre.
   */
  criticalFor?: string[];
  /** Si hi és, la secció NOMÉS es mostra per a aquests eclipsis. */
  onlyFor?: string[];
}

/* -------------------------------------------------- taula d'exposicions */

/**
 * Exposicions calculades amb la fórmula de [NASA-EXP]: t = f² / (I × 2^Q),
 * amb ISO 100 i f/8 → f²/I = 0,64 s. Els valors Q són els de la taula original
 * i NO s'han tocat. Els temps s'han arrodonit a la velocitat estàndard més
 * propera (p. ex. Q=3 dona 1/12,5 s, que a la càmera és 1/13 s).
 *
 * Comprovació creuada: [MRE-PHO] recomana 1/1000 s per a protuberàncies a
 * ISO 400 i f/16; la fórmula dona 256/(400×512) = 1/800 s. Quadra.
 *
 * Regla pràctica per adaptar-ho: cada pas d'ISO o de diafragma és un pas
 * d'exposició. ISO 200 → el doble de ràpid; f/11 → el doble de lent.
 */
interface ExposureRow {
  /** Factor Q de [NASA-EXP]. */
  q: number;
  /** Temps a ISO 100 i f/8, ja arrodonit. */
  t: string;
  filtered: boolean;
}

const EXPOSURES: { key: string; row: ExposureRow }[] = [
  { key: 'partial5', row: { q: 8, t: '1/400 s', filtered: true } },
  { key: 'partial4', row: { q: 11, t: '1/3200 s', filtered: true } },
  { key: 'beads', row: { q: 12, t: '1/6400 s', filtered: false } },
  { key: 'chromo', row: { q: 11, t: '1/3200 s', filtered: false } },
  { key: 'prom', row: { q: 9, t: '1/800 s', filtered: false } },
  { key: 'corona01', row: { q: 7, t: '1/200 s', filtered: false } },
  { key: 'corona02', row: { q: 5, t: '1/50 s', filtered: false } },
  { key: 'corona05', row: { q: 3, t: '1/13 s', filtered: false } },
  { key: 'corona1', row: { q: 1, t: '1/3 s', filtered: false } },
  { key: 'corona2', row: { q: 0, t: '0,6 s', filtered: false } },
  { key: 'corona4', row: { q: -1, t: '1,3 s', filtered: false } },
  { key: 'corona8', row: { q: -3, t: '5 s', filtered: false } },
];

/** Noms dels subjectes de la taula d'exposicions, per idioma. */
const EXPOSURE_LABELS: Record<Locale, Record<string, string>> = {
  ca: {
    partial5: 'Fase parcial o anular, filtre ND 5,0',
    partial4: 'Fase parcial, filtre ND 4,0',
    beads: 'Grans de Baily i anell de diamant',
    chromo: 'Cromosfera',
    prom: 'Protuberàncies',
    corona01: 'Corona interior (0,1 R☉)',
    corona02: 'Corona (0,2 R☉)',
    corona05: 'Corona mitjana (0,5 R☉)',
    corona1: 'Corona (1 R☉)',
    corona2: 'Corona exterior (2 R☉)',
    corona4: 'Corona exterior (4 R☉)',
    corona8: 'Llum cendrosa i corona llunyana (8 R☉)',
  },
  es: {
    partial5: 'Fase parcial o anular, filtro ND 5,0',
    partial4: 'Fase parcial, filtro ND 4,0',
    beads: 'Granos de Baily y anillo de diamante',
    chromo: 'Cromosfera',
    prom: 'Protuberancias',
    corona01: 'Corona interior (0,1 R☉)',
    corona02: 'Corona (0,2 R☉)',
    corona05: 'Corona media (0,5 R☉)',
    corona1: 'Corona (1 R☉)',
    corona2: 'Corona exterior (2 R☉)',
    corona4: 'Corona exterior (4 R☉)',
    corona8: 'Luz cenicienta y corona lejana (8 R☉)',
  },
};

const EXPOSURE_HEAD: Record<Locale, string[]> = {
  ca: ['Subjecte', 'Filtre', 'ISO 100 · f/8', 'Q'],
  es: ['Sujeto', 'Filtro', 'ISO 100 · f/8', 'Q'],
};

const EXPOSURE_CAPTION: Record<Locale, string> = {
  ca: 'Calculat amb t = f² / (ISO × 2^Q) i els factors Q de la guia d’exposició de la NASA (RP 1318, F. Espenak). Fes forquilla: ±2 passos a cada costat.',
  es: 'Calculado con t = f² / (ISO × 2^Q) y los factores Q de la guía de exposición de la NASA (RP 1318, F. Espenak). Haz horquilla: ±2 pasos a cada lado.',
};

const FILTER_YES: Record<Locale, string> = { ca: 'Sí', es: 'Sí' };
const FILTER_NO: Record<Locale, string> = { ca: 'NO', es: 'NO' };

function exposureTable(locale: Locale): TableBlock {
  const labels = EXPOSURE_LABELS[locale];
  return {
    kind: 'table',
    head: EXPOSURE_HEAD[locale],
    caption: EXPOSURE_CAPTION[locale],
    rows: EXPOSURES.map(({ key, row }) => [
      labels[key],
      row.filtered ? FILTER_YES[locale] : FILTER_NO[locale],
      row.t,
      String(row.q),
    ]),
  };
}

/* ---------------------------------------------------------- guia catalana */

function guideCa(): GuideSection[] {
  return [
    {
      id: 'safety',
      title: 'Seguretat ocular',
      lead: 'La secció que has de llegir encara que no llegeixis cap altra. Un error aquí no es corregeix.',
      defaultOpen: true,
      blocks: [
        {
          kind: 'p',
          text: 'La retina no té receptors de dolor. Una cremada solar de retina no fa mal mentre passa: te n’adones hores després, quan apareix una taca fosca al centre del camp visual que ja no marxa. No hi ha tractament. Per això les normes d’aquesta secció no admeten excepcions ni “només un segon”.',
        },
        {
          kind: 'callout',
          tone: 'good',
          title: 'L’única cosa que serveix: ISO 12312-2',
          text: 'Ulleres o làmines de visió solar certificades segons la norma ISO 12312-2. Deixen passar com a màxim un 0,0032% de la llum visible, bloquegen tot l’ultraviolat i com a mínim el 97% de l’infraroig. Amb unes ulleres homologades posades, l’únic que has de veure és el disc del Sol: si veus qualsevol altra cosa de l’entorn, no són bones.',
        },
        {
          kind: 'list',
          tone: 'bad',
          items: [
            'Ulleres de sol, per fosques que siguin, i encara que siguin de qualitat i amb filtre UV. Deixen passar milers de vegades més llum de la que és segura.',
            'Radiografies i pel·lícula fotogràfica velada. Les modernes fan servir tints en comptes de plata i no protegeixen absolutament gens.',
            'Vidres fumats amb un ciri, vidres de soldador per sota del grau 12 i miralls de plàstic.',
            'CD, DVD, disquets, bosses de patates, plàstics de color, negatius: no filtren l’infraroig, que és el que et cou la retina sense que ho notis.',
            'Ulleres de cinema 3D, viseres de casc, làmines de tintar vidres.',
            'Filtres de càmera de densitat insuficient (ND 8, ND 64, polaritzadors, i fins i tot ND 1000) i, molt especialment, qualsevol filtre que es rosqui DARRERE de l’objectiu o davant l’ocular d’un telescopi.',
          ],
        },
        {
          kind: 'p',
          text: 'La foscor d’un material no té res a veure amb si protegeix. El que compta és què fa amb l’infraroig i l’ultraviolat, i això no ho pots jutjar mirant-lo.',
        },
        {
          kind: 'callout',
          tone: 'bad',
          title: 'Telescopis, prismàtics i teleobjectius: el perill de debò',
          text: 'Un instrument òptic concentra la llum del Sol. Mirar per un telescopi o uns prismàtics sense filtre destrueix la retina en una fracció de segon, i les ulleres d’eclipsi NO t’hi protegeixen: la llum concentrada les fon. El filtre ha d’anar SEMPRE muntat al davant de l’objectiu, mai a l’ocular ni entre l’objectiu i l’ull, i ha d’estar ben subjecte perquè no el pugui arrencar una ràfega de vent. Un ocular solar de rosca no és mai una opció segura.',
        },
        {
          kind: 'p',
          text: 'Si no tens filtre frontal, la projecció és segura i espectacular: fes un forat petit en una cartolina i mira la imatge que projecta a terra o en una altra cartolina, d’esquena al Sol. Un escumador de cuina fa desenes de solets mossegats alhora. Mai miris el Sol a través del forat.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'ECLIPSI TOTAL: els dos minuts en què s’ha de mirar sense filtre',
          text: 'Només si ets DINS la franja de totalitat, i només entre el segon contacte (C2) i el tercer (C3), el Sol queda completament tapat i pots — i has de — treure’t el filtre i mirar la corona a ull nu. És l’única manera de veure-la: a través d’un filtre solar no es veu absolutament res. El senyal per treure-te’l és que el Sol desapareix del tot i es fa fosc de cop. El senyal per tornar-te’l a posar és qualsevol punt de llum que reaparegui per la vora de la Lluna: en aquell instant els ulls ja s’han de tenir tapats.',
        },
        {
          kind: 'callout',
          tone: 'bad',
          title: 'ECLIPSI ANULAR: no hi ha cap moment segur. Mai.',
          text: 'En un eclipsi anular la Lluna és massa petita per tapar el Sol i sempre en queda un anell brillant a la vista. Aquell anell crema exactament igual que el Sol sencer. Durant l’anularitat no hi ha cap instant en què es pugui mirar sense filtre — ni un segon, ni per fer la foto, ni encara que el cel s’hagi enfosquit i sembli que ja no enlluerna. El 26 de gener de 2028 és anular: el filtre no es toca de C1 a C4.',
        },
        {
          kind: 'p',
          text: 'És la confusió més perillosa de la trilogia d’eclipsis espanyola. Molta gent haurà viscut el 2026 i el 2027 traient-se les ulleres durant la totalitat i li sortirà el gest sol el 2028. No el facis, i avisa qui tinguis al costat.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Fase parcial fora de la franja',
          text: 'Si ets fora de la franja central, per molt que l’obscuració arribi al 99% no hi ha cap moment segur. El filtre és obligatori de principi a fi. La diferència entre el 99% i el 100% no és de grau: és tota una altra cosa.',
        },
        {
          kind: 'list',
          tone: 'warn',
          items: [
            'Revisa el filtre a contrallum abans de sortir: qualsevol ratllada, forat o esquerda i el llences.',
            'Posa’t el filtre abans d’aixecar la vista cap al Sol i treu-te’l només després d’abaixar-la.',
            'Vigila els nens: són els que més accidents tenen perquè es giren les ulleres o miren per sota.',
            'Les ulleres de cartró no són per fer-hi vida: es fan servir per mirar el Sol uns segons cada cop.',
          ],
        },
      ],
    },

    {
      id: 'phases',
      title: 'Les fases, explicades',
      lead: 'C1, C2, C3, C4, magnitud i obscuració: què vol dir cada cosa i per què el 95% no és “gairebé”.',
      blocks: [
        {
          kind: 'defs',
          items: [
            {
              // El «entorn d'una hora i quart» que hi havia era la xifra del
              // 2028 aplicada als tres. El motor dona C1→C2: el 2026, 56,7 min
              // a la Corunya, 55,1 a Burgos, 54,1 a València i 53,0 a Palma;
              // el 2027, 64,7 min a Cadis; el 2028, 77,8 min a Sevilla i 74,3
              // a València. L'hora i quart només és certa per a l'anular.
              term: 'C1 — primer contacte',
              text: 'La vora de la Lluna toca la vora del Sol i comença la mossegada. A ull nu no es nota res; amb el filtre veus una osca minúscula. Des d’aquí fins a C2 passa entre cinquanta-cinc minuts (el 2026) i una hora i quart llarga (el 2028).',
            },
            {
              term: 'C2 — segon contacte',
              text: 'La Lluna acaba de tapar el Sol (o, en un eclipsi anular, hi entra del tot i es tanca l’anell). És l’instant dels grans de Baily i de l’anell de diamant. En un eclipsi total, aquí i no abans es treuen els filtres.',
            },
            {
              term: 'C3 — tercer contacte',
              text: 'Reapareix el primer punt de Sol per l’altra banda. S’acaba la totalitat o l’anularitat. Els filtres han d’estar posats ABANS que arribi.',
            },
            {
              // AQUÍ HI HAVIA UNA MITJA VERITAT que val la pena escriure: «una
              // altra hora llarga després de C3». El motor dona C3→C4 de 50 a
              // 53 min el 2026, 71 min el 2027 i 65-68 min el 2028. Però el
              // que faltava és més gros: el 2026 i el 2028 el Sol es pon
              // ABANS de C4 gairebé a tot arreu. Altura del Sol a C4 segons el
              // motor — 2026: la Corunya +2,7°, Burgos −0,4°, València −4,2°,
              // Palma −6,0°; 2028: Sevilla −5,1°, València −9,6°, Barcelona
              // −11,7°. Prometre un C4 que la meitat de la gent no veurà és
              // exactament el tipus de frase que aquesta auditoria busca.
              term: 'C4 — quart contacte',
              text: 'La Lluna deixa el disc solar. Fi de l’eclipsi. Entre cinquanta minuts (el 2026) i poc més d’una hora (el 2027 i el 2028) després de C3. Compte: el 2026 i el 2028 el Sol es pon abans d’arribar-hi a gairebé tota la franja — a València el 2026 C4 cauria amb el Sol 4° per sota de l’horitzó, i a Barcelona el 2028, gairebé 12° per sota. El teu eclipsi s’acaba a la posta, no a C4.',
            },
            {
              term: 'Magnitud',
              text: 'Fracció del DIÀMETRE del Sol que la Lluna tapa. És una relació entre diàmetres, no entre àrees. En un eclipsi total supera 1; en un anular es queda per sota.',
            },
            {
              term: 'Obscuració',
              text: 'Fracció de l’ÀREA del disc solar tapada. És la xifra que la gent diu com a “percentatge d’eclipsi”. No hi ha correspondència única amb la magnitud, perquè la mida aparent de la Lluna canvia amb la seva òrbita.',
            },
          ],
        },
        {
          kind: 'p',
          // Xifres del motor amb el Sol a 12°: eclipseIlluminance(
          // luminousFractionFromObscuration(0,90 | 0,99), 12).totalLux →
          // 1.240,1 i 99,5 lux; clearSkyIlluminanceLux(12) → 16.778,9. (Aquest
          // comentari deia 16.791; recomprovat el 3-8-2026 dona 16.778,9. La
          // diferència no arriba al 0,1 % i no toca el text, que diu «uns
          // 17 000», però una xifra escrita ha de ser la que surt de córrer-ho.)
          // No són proporcionals al percentatge perquè la taula de
          // solarDisc.ts descompta l'enfosquiment de limbe.
          text: 'Una obscuració del 90% sona a molt i visualment no és res. Les xifres que se citen sempre —100 000 lux amb el Sol ple, 1 000 lux al 99% d’obscuració— són de migdia, amb el Sol ben alt. Els eclipsis espanyols del 2026 i el 2028 no són així: el Sol és a pocs graus de l’horitzó i tot el rang baixa d’un cop. A Astúries, amb el Sol a 12°, el cel serè dona uns 17 000 lux; al 90% tapat en queden uns 1 200, i al 99%, un centenar. No és la regla de tres que esperaves: la Lluna acaba tapant el centre del disc, que és la part que més brilla. El percentatge enganya igual, però des de molt més avall.',
        },
        {
          kind: 'p',
          text: 'Hi ha dues raons. La primera és que l’ull respon de manera logarítmica: cada divisió per deu de la llum es percep com un escalonet, no com una caiguda. La segona és que durant l’hora llarga de fase parcial les pupil·les s’han anat dilatant sense que te n’adonis — d’un mil·límetre a dos, que és quadruplicar la llum que entra — i han anat compensant la pèrdua a mesura que passava.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Tota la caiguda és als últims segons',
          // Motor: amb el Sol a 60°, del 99% (571,0 lux) a la totalitat (7,10)
          // hi ha un factor 80,4; amb el Sol a 12°, de 99,5 lux a 2,22, un
          // factor 44,9; a 4°, 41,2; a 2°, 40,4. Aquí hi deia «entre cinquanta
          // i cent vegades» i el cas espanyol —que és el que ens importa—
          // queda per SOTA de cinquanta: la forquilla honesta és quaranta a
          // vuitanta, i el sostre de cent no el toca cap dels nostres casos.
          text: 'Del 99% a la totalitat la llum encara es divideix entre quaranta i vuitanta vegades, concentrat en menys d’un minut: molt més ràpid del que l’ull es pot adaptar. Amb el Sol alt es passa d’uns 570 lux a uns 7; amb el Sol espanyol a 12°, d’un centenar a poc més de 2, que ja és fons de cel de nit. La caiguda relativa és semblant i el salt es nota igual. Per això la totalitat no “arriba”, sinó que et cau a sobre. I per això un 99% i un 100% són experiències diferents, no la mateixa amb un pèl més o menys. Les xifres del teu punt, amb la teva altura del Sol, les calcula el compte enrere.',
        },
      ],
    },

    {
      id: 'watch',
      title: 'Què mirar i quan',
      lead: 'La totalitat dura poc. Val la pena arribar-hi sabent què buscar i en quin ordre.',
      blocks: [
        {
          kind: 'defs',
          items: [
            {
              term: 'Últims minuts abans de C2',
              text: 'La llum es torna metàl·lica i les ombres, extraordinàriament nítides — el Sol s’ha convertit en una línia de llum en comptes d’un disc. Mira les ombres de les fulles a terra: cada espai entre fulles fa de forat estenopeic i el terra s’omple de mitges llunes.',
            },
            {
              term: 'Bandes d’ombra',
              text: 'Un o dos minuts abans i després de la totalitat, ratlles fosques ondulants que corren per terra, com el fons d’una piscina. Són turbulència atmosfèrica i no sempre surten. Per veure-les cal una superfície clara i llisa: estén un llençol blanc a terra abans de començar.',
            },
            {
              term: 'Grans de Baily',
              text: 'Just a C2, l’últim fil de Sol es trenca en punts brillants separats: és la llum passant entre les muntanyes de la vora de la Lluna. Dura segons.',
            },
            {
              term: 'Anell de diamant',
              text: 'Quan només en queda un punt, amb la corona ja començant a insinuar-se al voltant. És la imatge que tothom té al cap. Passa dos cops: abans de C2 i just després de C3.',
            },
            {
              term: 'Cromosfera',
              text: 'Un arc prim de color rosa intens vorejant la Lluna els primers i els últims segons de la totalitat. El color és emissió de l’hidrogen.',
            },
            {
              term: 'Protuberàncies',
              text: 'Llengües vermelloses de plasma que sobresurten de la vora. Amb uns prismàtics (ara sí, sense filtre, i NOMÉS durant la totalitat) es veuen molt bé.',
            },
            {
              term: 'Corona',
              text: 'El motiu del viatge. Un halo nacrat i estructurat, amb serpentines que poden arribar a diversos radis solars de distància. Cap fotografia se li assembla: el rang dinàmic que veu l’ull no cap en cap sensor. Mira-la a ull nu i després amb prismàtics.',
            },
            {
              // «Un centenar de quilòmetres» era tres vegades massa poc.
              // Mesurat amb el motor caminant perpendicularment a la franja
              // des de la línia central fins que la totalitat s'apaga: el 2026
              // la franja fa ~305 km a Astúries, ~305 a la meseta i ~295 al
              // Mediterrani; el 2027, ~240 km a l'Estret. La idea (ets sota una
              // taca petita comparada amb l'horitzó) no canvia; la xifra sí.
              term: 'Crepuscle de 360°',
              text: 'Aparta la vista del Sol un moment i gira sobre tu mateix: tot l’horitzó té color de posta de sol, en totes direccions alhora, perquè estàs sota una ombra de dos-cents o tres-cents quilòmetres d’amplada —el 2026 en fa uns 305 sobre Espanya— i fora d’ella encara és de dia.',
            },
            {
              term: 'Planetes i estrelles',
              text: 'Amb el cel a nivell de crepuscle civil surten Venus i Júpiter sense dificultat, i Mercuri i les estrelles més brillants si el cel és net. El 12 d’agost de 2026, a més, l’eclipsi cau en ple màxim dels Perseids.',
            },
            {
              term: 'Temperatura i animals',
              text: 'La temperatura fa un descens molt brusc en qüestió de segons i sovint s’aixeca un cop de vent. Els ocells callen de cop o tornen a dormir, els grills es posen a cantar i el bestiar es dirigeix als estables. Val la pena escoltar tant com mirar.',
            },
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Reserva els deu últims segons per no fer res',
          // «Entre un minut i mig i dos minuts» era generós pels dos costats.
          // El motor sobre la línia central, allà on entra a terra per la
          // costa asturiana, dona 110 s: el màxim d'Espanya és 1 min 50 s, no
          // dos minuts. I a sota, la caiguda és molt més ràpida del que
          // suggeria: València 62 s, Maó 68 s, Tarragona 58 s, Santander 60 s,
          // Vitòria 60 s. Un minut i mig NO és el mínim, és gairebé el màxim.
          text: 'La totalitat de 2026 és curta i on siguis mana molt: el màxim sobre terra espanyola és 1 min 50 s, a la línia central per on entra a Astúries, i baixa de pressa cap a les vores — a València són 62 segons, a Maó 68 i a Tarragona 58. Si te’ls passes comprovant l’enfocament, te l’hauràs perdut. Decideix per endavant quins segons dediques a la càmera i quins a mirar, i quan arribi C3, para.',
        },
      ],
    },

    {
      id: 'lowsun',
      title: 'Sol baix: com triar el lloc',
      lead: 'El 2026 i el 2028 la fase central passa amb el Sol gairebé tocant l’horitzó. Aquí el lloc ho decideix tot.',
      criticalFor: ['2026-08-12', '2028-01-26'],
      blocks: [
        {
          kind: 'p',
          // Rangs recalculats el 3-8-2026 sobre tota la franja, no sobre dos
          // punts. 2026: Malpica 12,3°, la Corunya 12,0°, Oviedo 10,3°, Burgos
          // 8,3°, València 4,6°, Palma 2,6°, Maó 1,8°, Illa de l'Aire 1,7°.
          // 2028: Ayamonte 8,4°, Huelva 8,0°, Sevilla 7,3°, València 2,4°,
          // Tarragona 0,8°, Barcelona 0,16°, Palma 0,4°, Girona −0,4°, Maó
          // −0,7°, cap de Creus −0,8°. Deia «poc més d'1°» (el mínim real
          // arrodoneix a 2°) i «amb prou feines 2°» per al 2028, quan al
          // nord-est el Sol ja s'ha post durant l'anularitat.
          text: 'El 12 d’agost de 2026 la totalitat passa al capvespre, amb el Sol de 12° a menys de 2° sobre l’horitzó segons on siguis: com més a l’est de la franja, més baix — 12° a la Corunya, 8° a Burgos, 4,6° a València, 1,8° a Maó. El 26 de gener de 2028 l’anularitat arriba encara més baixa: 8° a Huelva, 7° a Sevilla, 2,4° a València, i a Barcelona el Sol es pon durant l’anularitat mateixa (0,2° al màxim), mentre que a Girona i a Maó ja s’ha post abans d’arribar-hi. En tots dos casos el problema no és el cel: és el que tens al davant.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'No n’hi ha prou que es vegi el disc del Sol',
          // L'aritmètica no quadrava. El motor dona R☉ = 0,2631° el 12-8-2026,
          // 0,2627° el 2-8-2027 i 0,2707° el 26-1-2028 (l'agost la Terra és a
          // prop de l'afeli i el Sol es veu més petit). Amb 0,26°, quatre a sis
          // radis solars fan de 1,05° a 1,58°, no «un grau i mig o dos», que
          // demanaria set radis. Es corregeix la xifra i es manté la regla dels
          // 3°, que no en depèn: hi entra el descens del Sol durant la
          // totalitat i l'extinció arran d'horitzó.
          text: 'El que vas a veure no és el disc: és la corona, que s’escampa al seu voltant. Les serpentines coronals arriben habitualment a quatre o sis radis solars, i com que el radi del Sol fa uns 0,26° a l’agost, això vol dir un halo d’entre un grau i un grau i mig de radi. Sumant-hi que el Sol continua baixant durant la totalitat i que a poca altura l’extinció atmosfèrica ja se’n menja bona part, la regla pràctica és deixar uns 3° lliures per damunt de l’obstacle, no zero. Un turó que “només” tapa fins a 2° et deixa veure el Sol i et roba mitja corona.',
        },
        {
          kind: 'p',
          // «Una serra a deu quilòmetres que s'aixequi 500 m també [ocupa 10°]»
          // era fals per un factor 3,5: arctan(500/10.000) = 2,9°. Per ocupar
          // 10° a deu quilòmetres caldrien 1.760 m per damunt teu. I resulta
          // que la xifra correcta és MILLOR exemple que la falsa, perquè 2,9°
          // és exactament el marge de 3° del paràgraf anterior.
          text: 'Tres graus són molt més del que sembla des de terra. Un edifici de sis plantes a cent metres ja n’ocupa 10. Una serra a deu quilòmetres que s’aixequi 500 m per damunt teu n’ocupa 2,9 — i encara n’hi has de deixar tres més lliures per damunt d’ella. El puny tancat amb el braç estirat fa uns 10°: si des d’on penses posar-te la silueta de l’oest queda per sota de mig puny, vas just.',
        },
        {
          kind: 'list',
          items: [
            'El millor horitzó és el mar obert cap a ponent, i el segon millor una vall ampla oberta a l’oest o una carena amb el terreny caient cap allà.',
            'Guanyar altura ajuda, però només si el que et tapa és a prop. Contra una serralada llunyana pujar cent metres no soluciona res: el que cal és desplaçar-se.',
            'Compte amb les boires i les calitges: a poca altura mires a través de moltíssima atmosfera, i una bruma que a 30° no es nota, a 2° tapa el Sol del tot. El mar a l’agost fa boires baixes al capvespre amb molta facilitat.',
            'La refracció atmosfèrica aixeca l’altura aparent del Sol, i tant més com més baix està. Serveix a favor teu, però no és una xifra amb què fer plans: no comptis amb ella per salvar mig grau.',
            'Vés-hi a reconèixer el lloc un dia abans, a la mateixa hora, i mira exactament on es pon el Sol. Amb el Sol tan baix, cent metres de desplaçament canvien el resultat.',
            'El dia de l’eclipsi arriba amb hores d’antelació. Els millors miradors s’ompliran, i quedar-se atrapat a la carretera amb el Sol a 5° vol dir haver-hi anat per res.',
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'L’avantatge del Sol baix',
          text: 'Tot això té una compensació: la corona amb un primer terme de paisatge, mar o serralada és la fotografia més bonica que es pot fer d’un eclipsi, i amb el Sol alt és impossible. I les bandes d’ombra i el crepuscle de 360° es veuen molt millor amb el Sol arran d’horitzó.',
        },
      ],
    },

    {
      id: 'photo',
      title: 'Fotografia',
      lead: 'Exposicions per fase, focal, enquadrament — i l’avís de no gastar la totalitat mirant la pantalla.',
      blocks: [
        {
          kind: 'callout',
          tone: 'bad',
          title: 'Filtre frontal per a tot el que no sigui totalitat',
          text: 'Durant les fases parcials, i durant tota l’anularitat del 2028, l’objectiu ha de portar un filtre solar muntat al davant. Sense filtre, el Sol enfocat sobre el sensor el fon en segons, i si la càmera és rèflex i mires pel visor òptic, et fon la retina primer. El filtre només es treu entre C2 i C3 d’un eclipsi TOTAL, i s’ha de tornar a posar abans de C3.',
        },
        exposureTable('ca'),
        {
          kind: 'p',
          text: 'La taula és un punt de partida, no un dogma: la corona té un rang dinàmic enorme i cap exposició sola la captura. La tècnica és fer una forquilla ràpida en mode manual — la mateixa obertura, velocitats de 1/2000 s a 1 s — i combinar-les després. Deixa-ho tot programat i assajat abans del dia.',
        },
        {
          kind: 'defs',
          items: [
            {
              term: 'Mida del Sol al fotograma',
              text: 'El diàmetre de la imatge del Sol en mil·límetres és aproximadament la focal dividida per 109. Amb 400 mm el Sol fa 3,7 mm: en un fotograma complet (24 mm d’alçada) ocupa un 15% de l’alçada, que amb la corona omple bé.',
            },
            {
              term: 'Focal màxima',
              text: 'Per al disc sencer, com a màxim uns 2500 mm en fotograma complet o 1700 mm en APS-C. Per a la corona amb marge d’enquadrament, uns 1000 mm en fotograma complet o 700 mm en APS-C.',
            },
            {
              term: 'Focal recomanada',
              text: 'Entre 200 i 500 mm tens la corona amb marge i l’enquadrament no és crític, que amb un o dos minuts de temps és el que importa. Si portes dos cossos, el segon amb un gran angular fix apuntat a l’escena, gravant vídeo, capta les cares i la llum ambiental — que és el que després recordes.',
            },
            {
              term: 'Enquadrament amb Sol baix',
              text: 'El 2026 i el 2028, un 24-70 mm amb el Sol eclipsat petit sobre una silueta de mar o serralada dona una imatge millor que un teleobjectiu. I no cal encertar el seguiment.',
            },
            {
              term: 'Enfocament',
              text: 'Manual, a l’infinit real, fixat abans amb ampliació en directe sobre la vora del Sol filtrat o sobre un estel. Bloqueja’l amb cinta adhesiva. L’autofocus fallarà durant la totalitat.',
            },
            {
              term: 'Trípode i disparador',
              text: 'Imprescindibles a partir de 200 mm. Disparador remot o temporitzador de 2 s, i estabilitzador desconnectat si el cos és sobre trípode. Amb Sol baix, compte amb el vent.',
            },
            {
              term: 'Mòbil',
              text: 'Un mòbil no farà una foto decent de la corona, però sí un vídeo molt bo de l’ambient i del crepuscle de 360°. Posa’l en mode manual si el tens, bloqueja l’exposició abans de C2 i deixa’l gravant sol sobre un petit trípode. Per a les fases parcials cal filtre també davant de la lent.',
            },
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'La regla que t’estalviarà el penediment',
          // «La totalitat dura dos minuts» no és certa de cap dels dos totals:
          // el motor dona com a màxim 110 s sobre terra espanyola el 2026 (i
          // 62 s a València) i 277 s a Tarifa el 2027. Dir-ho amb els dos
          // números fa la frase MÉS punyent, no menys.
          text: 'Si és el teu primer eclipsi total, no facis fotos, o fes-ne amb la càmera automatitzada i sense mirar-la. La totalitat del 2026 dura un minut o poc més —1 min 50 s al millor punt d’Espanya, 62 segons a València— i la del 2027, quatre minuts i mig a l’Estret. No la recuperaràs mai; fotografies de la corona n’hi ha milions de millors que la teva. Mira-la amb els ulls.',
        },
      ],
    },

    {
      id: 'checklist',
      title: 'Checklist i logística',
      lead: 'Què endur-se, com arribar-hi i per què l’app funciona sense cobertura.',
      blocks: [
        {
          kind: 'list',
          items: [
            'Ulleres homologades ISO 12312-2 — i unes de recanvi, perquè algú te’n demanarà o se’t trencaran.',
            'Filtre solar frontal per a cada òptica que pensis fer servir, i cinta adhesiva per assegurar-lo.',
            'Prismàtics: la corona i les protuberàncies s’hi veuen espectaculars durant la totalitat.',
            'Llanterna vermella o frontal en mode vermell: durant la totalitat es veu molt poc, i les llums blanques molesten tothom.',
            'Bateria externa carregada i el mòbil al 100%. Amb la xarxa saturada i el GPS actiu, la bateria vola.',
            'Aigua i menjar per a moltes més hores de les previstes, i cadira plegable.',
            'Roba d’abric: la temperatura cau de cop durant la totalitat, i el 2028 és al gener i al capvespre.',
            'Llençol blanc estès a terra per veure les bandes d’ombra.',
            // El 2027 és de matí (motor, Cadis: C1 a les 09:40 locals amb el
            // Sol a 24° i pujant): el consell del capvespre només val per al
            // 2026.
            'Repel·lent d’insectes per al 2026, que és a l’agost i al capvespre, just l’hora dels mosquits. El 2027 també és a l’agost però passa al matí: allà el que mana és la crema solar i alguna cosa per fer ombra durant l’espera.',
            'Brúixola o l’app, per saber exactament per on serà el Sol des del lloc triat.',
          ],
        },
        {
          kind: 'callout',
          // Logística, no seguretat: en 'info' pel vocabulari de l'ambre (Tone).
          tone: 'info',
          title: 'Xarxa mòbil: dona-la per morta',
          text: 'Desenes de milers de persones concentrades en pocs quilòmetres saturen les antenes fins a deixar-les inservibles. No podràs consultar res, ni enviar missatges, ni fer servir mapes en línia. Baixa’t els mapes de la zona per a ús offline abans de sortir, decideix el punt de trobada amb el teu grup per endavant, i porta la ruta escrita. Aquesta app està pensada per funcionar sense connexió precisament per això.',
        },
        {
          kind: 'callout',
          // Logística, no seguretat: en 'info' pel vocabulari de l'ambre (Tone).
          tone: 'info',
          title: 'Trànsit i aglomeracions',
          text: 'El patró és sempre el mateix: s’hi arriba amb comptagotes durant tot el dia i tothom marxa alhora en cinc minuts. Compta amb hores de cua a la sortida. Omple el dipòsit el dia abans, aparca de cara a la sortida i tingues clar que un mirador estret amb una sola carretera d’accés és una ratera. Molts ajuntaments limitaran l’accés als punts més coneguts: mira-ho abans.',
        },
        {
          kind: 'p',
          text: 'Meteorologia: la decisió final és de les últimes 24 hores. L’agost és estadísticament bo a l’interior peninsular i pitjor a la costa cantàbrica, on les boires baixes del capvespre són freqüents; el gener del 2028 és el més arriscat dels tres. Tingues preparats dos o tres llocs alternatius dins la franja, separats entre ells, i mira els models d’alta resolució i les imatges de satèl·lit el matí mateix. Estar disposat a conduir cent quilòmetres el mateix dia és el que separa veure-ho de no veure-ho.',
        },
        {
          kind: 'callout',
          tone: 'good',
          title: 'I si al final el tapa un núvol',
          text: 'Encara ho notaràs: la foscor sobtada, la caiguda de temperatura, el silenci dels animals i el crepuscle a l’horitzó passen igual. No et quedis mirant el núvol; mira al teu voltant.',
        },
      ],
    },
  ];
}

/* -------------------------------------------------------- guia castellana */

function guideEs(): GuideSection[] {
  return [
    {
      id: 'safety',
      title: 'Seguridad ocular',
      lead: 'La sección que debes leer aunque no leas ninguna otra. Un error aquí no se corrige.',
      defaultOpen: true,
      blocks: [
        {
          kind: 'p',
          text: 'La retina no tiene receptores de dolor. Una quemadura solar de retina no duele mientras ocurre: te das cuenta horas después, cuando aparece una mancha oscura en el centro del campo visual que ya no se va. No hay tratamiento. Por eso las normas de esta sección no admiten excepciones ni «solo un segundo».',
        },
        {
          kind: 'callout',
          tone: 'good',
          title: 'Lo único que sirve: ISO 12312-2',
          text: 'Gafas o láminas de visión solar certificadas según la norma ISO 12312-2. Dejan pasar como máximo un 0,0032% de la luz visible, bloquean todo el ultravioleta y al menos el 97% del infrarrojo. Con unas gafas homologadas puestas, lo único que debes ver es el disco del Sol: si ves cualquier otra cosa del entorno, no son buenas.',
        },
        {
          kind: 'list',
          tone: 'bad',
          items: [
            'Gafas de sol, por oscuras que sean, y aunque sean de calidad y con filtro UV. Dejan pasar miles de veces más luz de la que es segura.',
            'Radiografías y película fotográfica velada. Las modernas usan tintes en lugar de plata y no protegen absolutamente nada.',
            'Cristales ahumados con una vela, cristales de soldador por debajo del grado 12 y espejos de plástico.',
            'CD, DVD, disquetes, bolsas de patatas, plásticos de color, negativos: no filtran el infrarrojo, que es lo que te cuece la retina sin que lo notes.',
            'Gafas de cine 3D, viseras de casco, láminas de tintado de cristales.',
            'Filtros de cámara de densidad insuficiente (ND 8, ND 64, polarizadores, e incluso ND 1000) y, muy especialmente, cualquier filtro que se rosque DETRÁS del objetivo o delante del ocular de un telescopio.',
          ],
        },
        {
          kind: 'p',
          text: 'Lo oscuro que sea un material no tiene nada que ver con si protege. Lo que cuenta es qué hace con el infrarrojo y el ultravioleta, y eso no puedes juzgarlo mirándolo.',
        },
        {
          kind: 'callout',
          tone: 'bad',
          title: 'Telescopios, prismáticos y teleobjetivos: el peligro de verdad',
          text: 'Un instrumento óptico concentra la luz del Sol. Mirar por un telescopio o unos prismáticos sin filtro destruye la retina en una fracción de segundo, y las gafas de eclipse NO te protegen: la luz concentrada las funde. El filtro debe ir SIEMPRE montado delante del objetivo, nunca en el ocular ni entre el objetivo y el ojo, y bien sujeto para que no lo arranque una ráfaga de viento. Un ocular solar de rosca no es nunca una opción segura.',
        },
        {
          kind: 'p',
          text: 'Si no tienes filtro frontal, la proyección es segura y espectacular: haz un agujero pequeño en una cartulina y mira la imagen que proyecta en el suelo o en otra cartulina, de espaldas al Sol. Un escurridor de cocina hace decenas de solecitos mordidos a la vez. Nunca mires el Sol a través del agujero.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'ECLIPSE TOTAL: los dos minutos en que hay que mirar sin filtro',
          text: 'Solo si estás DENTRO de la franja de totalidad, y solo entre el segundo contacto (C2) y el tercero (C3), el Sol queda completamente tapado y puedes —y debes— quitarte el filtro y mirar la corona a simple vista. Es la única manera de verla: a través de un filtro solar no se ve absolutamente nada. La señal para quitártelo es que el Sol desaparece del todo y oscurece de golpe. La señal para volver a ponértelo es cualquier punto de luz que reaparezca por el borde de la Luna: en ese instante los ojos ya deben estar tapados.',
        },
        {
          kind: 'callout',
          tone: 'bad',
          title: 'ECLIPSE ANULAR: no hay ningún momento seguro. Nunca.',
          text: 'En un eclipse anular la Luna es demasiado pequeña para tapar el Sol y siempre queda un anillo brillante a la vista. Ese anillo quema exactamente igual que el Sol entero. Durante la anularidad no hay ningún instante en que se pueda mirar sin filtro: ni un segundo, ni para hacer la foto, ni aunque el cielo se haya oscurecido y parezca que ya no deslumbra. El 26 de enero de 2028 es anular: el filtro no se toca de C1 a C4.',
        },
        {
          kind: 'p',
          text: 'Es la confusión más peligrosa del trío de eclipses español. Mucha gente habrá vivido 2026 y 2027 quitándose las gafas durante la totalidad y le saldrá el gesto solo en 2028. No lo hagas, y avisa a quien tengas al lado.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Fase parcial fuera de la franja',
          text: 'Si estás fuera de la franja central, por mucho que la oscuración llegue al 99% no hay ningún momento seguro. El filtro es obligatorio de principio a fin. La diferencia entre el 99% y el 100% no es de grado: es otra cosa completamente distinta.',
        },
        {
          kind: 'list',
          tone: 'warn',
          items: [
            'Revisa el filtro a contraluz antes de salir: cualquier raya, agujero o grieta y lo tiras.',
            'Ponte el filtro antes de levantar la vista hacia el Sol y quítatelo solo después de bajarla.',
            'Vigila a los niños: son los que más accidentes tienen porque se giran las gafas o miran por debajo.',
            'Las gafas de cartón no son para llevarlas puestas: se usan para mirar el Sol unos segundos cada vez.',
          ],
        },
      ],
    },

    {
      id: 'phases',
      title: 'Las fases, explicadas',
      lead: 'C1, C2, C3, C4, magnitud y oscuración: qué significa cada cosa y por qué el 95% no es «casi».',
      blocks: [
        {
          kind: 'defs',
          items: [
            {
              // Mirall castellà: C1→C2 pel motor — 2026, 56,7 min a la Corunya
              // i 53,0 a Palma; 2027, 64,7 a Cadis; 2028, 77,8 a Sevilla.
              term: 'C1 — primer contacto',
              text: 'El borde de la Luna toca el borde del Sol y empieza el mordisco. A simple vista no se nota nada; con el filtro ves una muesca minúscula. De aquí a C2 pasan entre cincuenta y cinco minutos (en 2026) y una hora y cuarto larga (en 2028).',
            },
            {
              term: 'C2 — segundo contacto',
              text: 'La Luna termina de tapar el Sol (o, en un eclipse anular, entra del todo y se cierra el anillo). Es el instante de los granos de Baily y del anillo de diamante. En un eclipse total, aquí y no antes se quitan los filtros.',
            },
            {
              term: 'C3 — tercer contacto',
              text: 'Reaparece el primer punto de Sol por el otro lado. Se acaba la totalidad o la anularidad. Los filtros deben estar puestos ANTES de que llegue.',
            },
            {
              // Mirall castellà: C3→C4 de 50-53 min el 2026, 71 el 2027 i
              // 65-68 el 2028; i el Sol a C4 sota l'horitzó gairebé a tota la
              // franja del 2026 (València −4,2°) i del 2028 (Barcelona −11,7°).
              term: 'C4 — cuarto contacto',
              text: 'La Luna abandona el disco solar. Fin del eclipse. Entre cincuenta minutos (en 2026) y poco más de una hora (en 2027 y 2028) después de C3. Ojo: en 2026 y 2028 el Sol se pone antes de llegar en casi toda la franja — en Valencia, en 2026, C4 caería con el Sol 4° por debajo del horizonte, y en Barcelona, en 2028, casi 12° por debajo. Tu eclipse acaba en la puesta, no en C4.',
            },
            {
              term: 'Magnitud',
              text: 'Fracción del DIÁMETRO del Sol que la Luna tapa. Es una relación entre diámetros, no entre áreas. En un eclipse total supera 1; en uno anular se queda por debajo.',
            },
            {
              term: 'Oscuración',
              text: 'Fracción del ÁREA del disco solar tapada. Es la cifra que la gente llama «porcentaje de eclipse». No hay correspondencia única con la magnitud, porque el tamaño aparente de la Luna cambia con su órbita.',
            },
          ],
        },
        {
          kind: 'p',
          // Mirall castellà del paràgraf català: mateixes xifres del motor
          // (Sol a 12°: 16.778,9 lux serè; 1.240,1 al 90%; 99,5 al 99%).
          text: 'Una oscuración del 90% suena a mucho y visualmente no es nada. Las cifras que siempre se citan —100 000 lux con el Sol pleno, 1 000 lux al 99% de oscuración— son de mediodía, con el Sol bien alto. Los eclipses españoles de 2026 y 2028 no son así: el Sol está a pocos grados del horizonte y todo el rango baja de golpe. En Asturias, con el Sol a 12°, el cielo despejado da unos 17 000 lux; al 90% tapado quedan unos 1 200, y al 99%, un centenar. No es la regla de tres que esperabas: la Luna acaba tapando el centro del disco, que es la parte que más brilla. El porcentaje engaña igual, pero desde mucho más abajo.',
        },
        {
          kind: 'p',
          text: 'Hay dos razones. La primera es que el ojo responde de forma logarítmica: cada división por diez de la luz se percibe como un escaloncito, no como una caída. La segunda es que durante la hora larga de fase parcial las pupilas se han ido dilatando sin que te des cuenta —de un milímetro a dos, que es cuadruplicar la luz que entra— y han ido compensando la pérdida a medida que ocurría.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Toda la caída está en los últimos segundos',
          // Mirall castellà: motor a 60° → 571,0 → 7,10 lux (×80,4); a 12° →
          // 99,5 → 2,22 lux (×44,9); a 4° ×41,2; a 2° ×40,4. El cas espanyol
          // queda per sota de cinquanta: la forquilla és 40-80, no 50-100.
          text: 'Del 99% a la totalidad la luz todavía se divide entre cuarenta y ochenta veces, concentrado en menos de un minuto: mucho más rápido de lo que el ojo puede adaptarse. Con el Sol alto se pasa de unos 570 lux a unos 7; con el Sol español a 12°, de un centenar a poco más de 2, que ya es fondo de cielo nocturno. La caída relativa es parecida y el salto se nota igual. Por eso la totalidad no «llega», sino que se te echa encima. Y por eso un 99% y un 100% son experiencias distintas, no la misma con un poco más o menos. Las cifras de tu punto, con tu altura del Sol, las calcula la cuenta atrás.',
        },
      ],
    },

    {
      id: 'watch',
      title: 'Qué mirar y cuándo',
      lead: 'La totalidad dura poco. Vale la pena llegar sabiendo qué buscar y en qué orden.',
      blocks: [
        {
          kind: 'defs',
          items: [
            {
              term: 'Últimos minutos antes de C2',
              text: 'La luz se vuelve metálica y las sombras, extraordinariamente nítidas: el Sol se ha convertido en una línea de luz en lugar de un disco. Mira las sombras de las hojas en el suelo: cada hueco entre hojas hace de agujero estenopeico y el suelo se llena de medias lunas.',
            },
            {
              term: 'Bandas de sombra',
              text: 'Uno o dos minutos antes y después de la totalidad, rayas oscuras ondulantes que corren por el suelo, como el fondo de una piscina. Son turbulencia atmosférica y no siempre salen. Para verlas hace falta una superficie clara y lisa: extiende una sábana blanca en el suelo antes de empezar.',
            },
            {
              term: 'Granos de Baily',
              text: 'Justo en C2, el último hilo de Sol se rompe en puntos brillantes separados: es la luz pasando entre las montañas del borde de la Luna. Dura segundos.',
            },
            {
              term: 'Anillo de diamante',
              text: 'Cuando solo queda un punto, con la corona ya empezando a insinuarse alrededor. Es la imagen que todo el mundo tiene en la cabeza. Ocurre dos veces: antes de C2 y justo después de C3.',
            },
            {
              term: 'Cromosfera',
              text: 'Un arco fino de color rosa intenso bordeando la Luna los primeros y los últimos segundos de la totalidad. El color es emisión del hidrógeno.',
            },
            {
              term: 'Protuberancias',
              text: 'Lenguas rojizas de plasma que sobresalen del borde. Con unos prismáticos (ahora sí, sin filtro, y SOLO durante la totalidad) se ven muy bien.',
            },
            {
              term: 'Corona',
              text: 'El motivo del viaje. Un halo nacarado y estructurado, con serpentinas que pueden llegar a varios radios solares de distancia. Ninguna fotografía se le parece: el rango dinámico que ve el ojo no cabe en ningún sensor. Mírala a simple vista y luego con prismáticos.',
            },
            {
              term: 'Crepúsculo de 360°',
              // Mirall castellà: ~305 km d'amplada el 2026 sobre Espanya i
              // ~240 el 2027, mesurats caminant perpendicularment a la franja.
              text: 'Aparta la vista del Sol un momento y gira sobre ti mismo: todo el horizonte tiene color de puesta de sol, en todas direcciones a la vez, porque estás bajo una sombra de doscientos o trescientos kilómetros de ancho —en 2026 mide unos 305 sobre España— y fuera de ella todavía es de día.',
            },
            {
              term: 'Planetas y estrellas',
              text: 'Con el cielo a nivel de crepúsculo civil salen Venus y Júpiter sin dificultad, y Mercurio y las estrellas más brillantes si el cielo está limpio. El 12 de agosto de 2026, además, el eclipse cae en pleno máximo de las Perseidas.',
            },
            {
              term: 'Temperatura y animales',
              text: 'La temperatura sufre un descenso muy brusco en cuestión de segundos y a menudo se levanta un golpe de viento. Los pájaros callan de golpe o vuelven a dormir, los grillos se ponen a cantar y el ganado se dirige a los establos. Vale la pena escuchar tanto como mirar.',
            },
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Reserva los diez últimos segundos para no hacer nada',
          // Mirall castellà: màxim 110 s a la línia central asturiana;
          // València 62 s, Maó 68 s, Tarragona 58 s.
          text: 'La totalidad de 2026 es corta y dónde estés manda mucho: el máximo sobre tierra española es 1 min 50 s, en la línea central por donde entra en Asturias, y baja deprisa hacia los bordes — en Valencia son 62 segundos, en Mahón 68 y en Tarragona 58. Si te los pasas comprobando el enfoque, te la habrás perdido. Decide de antemano qué segundos dedicas a la cámara y cuáles a mirar, y cuando llegue C3, para.',
        },
      ],
    },

    {
      id: 'lowsun',
      title: 'Sol bajo: cómo elegir el sitio',
      lead: 'En 2026 y 2028 la fase central ocurre con el Sol casi tocando el horizonte. Aquí el lugar lo decide todo.',
      criticalFor: ['2026-08-12', '2028-01-26'],
      blocks: [
        {
          kind: 'p',
          // Mirall castellà dels rangs recalculats el 3-8-2026 sobre tota la
          // franja (2026: 12,3° Malpica → 1,7° Illa de l'Aire; 2028: 8,4°
          // Ayamonte → −0,8° cap de Creus).
          text: 'El 12 de agosto de 2026 la totalidad ocurre al atardecer, con el Sol de 12° a menos de 2° sobre el horizonte según dónde estés: cuanto más al este de la franja, más bajo — 12° en A Coruña, 8° en Burgos, 4,6° en Valencia, 1,8° en Mahón. El 26 de enero de 2028 la anularidad llega todavía más baja: 8° en Huelva, 7° en Sevilla, 2,4° en Valencia, y en Barcelona el Sol se pone durante la anularidad misma (0,2° en el máximo), mientras que en Girona y en Mahón ya se ha puesto antes de llegar. En ambos casos el problema no es el cielo: es lo que tienes delante.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'No basta con que se vea el disco del Sol',
          // Mirall castellà: R☉ = 0,2631° (2026), 0,2627° (2027), 0,2707°
          // (2028) segons el motor; 4-6 R☉ = 1,05°-1,58°.
          text: 'Lo que vas a ver no es el disco: es la corona, que se extiende a su alrededor. Las serpentinas coronales llegan habitualmente a cuatro o seis radios solares, y como el radio del Sol mide unos 0,26° en agosto, eso significa un halo de entre un grado y grado y medio de radio. Sumando que el Sol sigue bajando durante la totalidad y que a poca altura la extinción atmosférica ya se come buena parte, la regla práctica es dejar unos 3° libres por encima del obstáculo, no cero. Una colina que «solo» tapa hasta 2° te deja ver el Sol y te roba media corona.',
        },
        {
          kind: 'p',
          // Mirall castellà: arctan(500/10.000) = 2,9°, no 10°. Per ocupar 10°
          // a deu quilòmetres caldrien 1.760 m.
          text: 'Tres grados son mucho más de lo que parece desde el suelo. Un edificio de seis plantas a cien metros ya ocupa 10. Una sierra a diez kilómetros que se eleve 500 m por encima de ti ocupa 2,9 — y todavía tienes que dejar tres más libres por encima de ella. El puño cerrado con el brazo estirado mide unos 10°: si desde donde piensas ponerte la silueta del oeste queda por debajo de medio puño, vas justo.',
        },
        {
          kind: 'list',
          items: [
            'El mejor horizonte es el mar abierto hacia poniente, y el segundo mejor un valle amplio abierto al oeste o una loma con el terreno cayendo hacia allí.',
            'Ganar altura ayuda, pero solo si lo que te tapa está cerca. Contra una cordillera lejana subir cien metros no soluciona nada: lo que hace falta es desplazarse.',
            'Cuidado con las nieblas y las calimas: a poca altura miras a través de muchísima atmósfera, y una bruma que a 30° no se nota, a 2° tapa el Sol del todo. El mar en agosto genera nieblas bajas al atardecer con mucha facilidad.',
            'La refracción atmosférica eleva la altura aparente del Sol, y tanto más cuanto más bajo está. Juega a tu favor, pero no es una cifra con la que hacer planes: no cuentes con ella para salvar medio grado.',
            'Ve a reconocer el sitio un día antes, a la misma hora, y mira exactamente por dónde se pone el Sol. Con el Sol tan bajo, cien metros de desplazamiento cambian el resultado.',
            'El día del eclipse llega con horas de antelación. Los mejores miradores se llenarán, y quedarse atrapado en la carretera con el Sol a 5° significa haber ido para nada.',
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'La ventaja del Sol bajo',
          text: 'Todo esto tiene una compensación: la corona con un primer término de paisaje, mar o cordillera es la fotografía más bonita que se puede hacer de un eclipse, y con el Sol alto es imposible. Y las bandas de sombra y el crepúsculo de 360° se ven mucho mejor con el Sol a ras de horizonte.',
        },
      ],
    },

    {
      id: 'photo',
      title: 'Fotografía',
      lead: 'Exposiciones por fase, focal, encuadre — y el aviso de no gastar la totalidad mirando la pantalla.',
      blocks: [
        {
          kind: 'callout',
          tone: 'bad',
          title: 'Filtro frontal para todo lo que no sea totalidad',
          text: 'Durante las fases parciales, y durante toda la anularidad de 2028, el objetivo debe llevar un filtro solar montado delante. Sin filtro, el Sol enfocado sobre el sensor lo funde en segundos, y si la cámara es réflex y miras por el visor óptico, te funde la retina primero. El filtro solo se quita entre C2 y C3 de un eclipse TOTAL, y hay que volver a ponerlo antes de C3.',
        },
        exposureTable('es'),
        {
          kind: 'p',
          text: 'La tabla es un punto de partida, no un dogma: la corona tiene un rango dinámico enorme y ninguna exposición sola la captura. La técnica es hacer una horquilla rápida en modo manual —la misma abertura, velocidades de 1/2000 s a 1 s— y combinarlas después. Déjalo todo programado y ensayado antes del día.',
        },
        {
          kind: 'defs',
          items: [
            {
              term: 'Tamaño del Sol en el fotograma',
              text: 'El diámetro de la imagen del Sol en milímetros es aproximadamente la focal dividida entre 109. Con 400 mm el Sol mide 3,7 mm: en un fotograma completo (24 mm de alto) ocupa un 15% de la altura, que con la corona llena bien.',
            },
            {
              term: 'Focal máxima',
              text: 'Para el disco entero, como máximo unos 2500 mm en fotograma completo o 1700 mm en APS-C. Para la corona con margen de encuadre, unos 1000 mm en fotograma completo o 700 mm en APS-C.',
            },
            {
              term: 'Focal recomendada',
              text: 'Entre 200 y 500 mm tienes la corona con margen y el encuadre no es crítico, que con uno o dos minutos de tiempo es lo que importa. Si llevas dos cuerpos, el segundo con un gran angular fijo apuntado a la escena, grabando vídeo, capta las caras y la luz ambiental, que es lo que luego recuerdas.',
            },
            {
              term: 'Encuadre con Sol bajo',
              text: 'En 2026 y 2028, un 24-70 mm con el Sol eclipsado pequeño sobre una silueta de mar o cordillera da una imagen mejor que un teleobjetivo. Y no hay que acertar el seguimiento.',
            },
            {
              term: 'Enfoque',
              text: 'Manual, al infinito real, fijado antes con ampliación en directo sobre el borde del Sol filtrado o sobre una estrella. Bloquéalo con cinta adhesiva. El autofoco fallará durante la totalidad.',
            },
            {
              term: 'Trípode y disparador',
              text: 'Imprescindibles a partir de 200 mm. Disparador remoto o temporizador de 2 s, y estabilizador desconectado si el cuerpo está sobre trípode. Con Sol bajo, cuidado con el viento.',
            },
            {
              term: 'Móvil',
              text: 'Un móvil no hará una foto decente de la corona, pero sí un vídeo muy bueno del ambiente y del crepúsculo de 360°. Ponlo en modo manual si lo tienes, bloquea la exposición antes de C2 y déjalo grabando solo sobre un trípode pequeño. Para las fases parciales hace falta filtro también delante de la lente.',
            },
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'La regla que te ahorrará el arrepentimiento',
          // Mirall castellà: 110 s màxim sobre terra el 2026 (62 s a València)
          // i 277 s a Tarifa el 2027. «Dos minutos» no era cert de cap.
          text: 'Si es tu primer eclipse total, no hagas fotos, o hazlas con la cámara automatizada y sin mirarla. La totalidad de 2026 dura un minuto o poco más —1 min 50 s en el mejor punto de España, 62 segundos en Valencia— y la de 2027, cuatro minutos y medio en el Estrecho. No la recuperarás nunca; fotografías de la corona hay millones mejores que la tuya. Mírala con los ojos.',
        },
      ],
    },

    {
      id: 'checklist',
      title: 'Checklist y logística',
      lead: 'Qué llevarse, cómo llegar y por qué la app funciona sin cobertura.',
      blocks: [
        {
          kind: 'list',
          items: [
            'Gafas homologadas ISO 12312-2 — y unas de repuesto, porque alguien te pedirá o se te romperán.',
            'Filtro solar frontal para cada óptica que pienses usar, y cinta adhesiva para asegurarlo.',
            'Prismáticos: la corona y las protuberancias se ven espectaculares durante la totalidad.',
            'Linterna roja o frontal en modo rojo: durante la totalidad se ve muy poco, y las luces blancas molestan a todo el mundo.',
            'Batería externa cargada y el móvil al 100%. Con la red saturada y el GPS activo, la batería vuela.',
            'Agua y comida para muchas más horas de las previstas, y silla plegable.',
            'Ropa de abrigo: la temperatura cae de golpe durante la totalidad, y 2028 es en enero y al atardecer.',
            'Sábana blanca extendida en el suelo para ver las bandas de sombra.',
            // Mirall castellà: el 2027 és de matí (Cadis, C1 09:40 locals).
            'Repelente de insectos para 2026, que es en agosto y al atardecer, justo la hora de los mosquitos. 2027 también es en agosto pero ocurre por la mañana: allí lo que manda es la crema solar y algo de sombra durante la espera.',
            'Brújula o la app, para saber exactamente por dónde estará el Sol desde el sitio elegido.',
          ],
        },
        {
          kind: 'callout',
          // Logística, no seguretat: en 'info' pel vocabulari de l'ambre (Tone).
          tone: 'info',
          title: 'Red móvil: dala por muerta',
          text: 'Decenas de miles de personas concentradas en pocos kilómetros saturan las antenas hasta dejarlas inservibles. No podrás consultar nada, ni enviar mensajes, ni usar mapas en línea. Descarga los mapas de la zona para uso offline antes de salir, decide el punto de encuentro con tu grupo de antemano, y lleva la ruta escrita. Esta app está pensada para funcionar sin conexión precisamente por eso.',
        },
        {
          kind: 'callout',
          // Logística, no seguretat: en 'info' pel vocabulari de l'ambre (Tone).
          tone: 'info',
          title: 'Tráfico y aglomeraciones',
          text: 'El patrón es siempre el mismo: se llega con cuentagotas durante todo el día y todo el mundo se va a la vez en cinco minutos. Cuenta con horas de cola a la salida. Llena el depósito el día antes, aparca de cara a la salida y ten claro que un mirador estrecho con una sola carretera de acceso es una ratonera. Muchos ayuntamientos limitarán el acceso a los puntos más conocidos: míralo antes.',
        },
        {
          kind: 'p',
          text: 'Meteorología: la decisión final es de las últimas 24 horas. Agosto es estadísticamente bueno en el interior peninsular y peor en la costa cantábrica, donde las nieblas bajas del atardecer son frecuentes; enero de 2028 es el más arriesgado de los tres. Ten preparados dos o tres sitios alternativos dentro de la franja, separados entre sí, y mira los modelos de alta resolución y las imágenes de satélite esa misma mañana. Estar dispuesto a conducir cien kilómetros el mismo día es lo que separa verlo de no verlo.',
        },
        {
          kind: 'callout',
          tone: 'good',
          title: 'Y si al final lo tapa una nube',
          text: 'Aun así lo notarás: la oscuridad repentina, la caída de temperatura, el silencio de los animales y el crepúsculo en el horizonte ocurren igual. No te quedes mirando la nube; mira a tu alrededor.',
        },
      ],
    },
  ];
}

/* ------------------------------------------------------------- accessors */

const GUIDES: Record<Locale, () => GuideSection[]> = { ca: guideCa, es: guideEs };

/**
 * Guia completa en l'idioma demanat, ja filtrada per l'eclipsi actiu.
 *
 * El filtre és per `onlyFor`: una secció amb `onlyFor` només apareix per als
 * eclipsis llistats. `criticalFor` no filtra, només marca (la vista l'obre i
 * la destaca), perquè amagar contingut de seguretat seria pitjor que sobrar.
 */
export function getGuide(locale: Locale, eclipseId?: string): GuideSection[] {
  return GUIDES[locale]().filter(
    (section) =>
      !section.onlyFor || (eclipseId !== undefined && section.onlyFor.includes(eclipseId)),
  );
}

/** Cert si la secció és especialment rellevant per a l'eclipsi donat. */
export function isCritical(section: GuideSection, eclipseId?: string): boolean {
  return (
    eclipseId !== undefined &&
    section.criticalFor !== undefined &&
    section.criticalFor.includes(eclipseId)
  );
}

/**
 * Avís d'encapçalament específic de cada eclipsi. És el primer que es llegeix
 * en obrir la guia i el lloc on es diu, sense embuts, què canvia respecte dels
 * altres dos. El del 2028 és el més important de tots.
 */
export interface EclipseHighlight {
  tone: Tone;
  title: string;
  text: string;
}

const HIGHLIGHTS: Record<string, Record<Locale, EclipseHighlight>> = {
  '2026-08-12': {
    ca: {
      tone: 'warn',
      title: 'Total, al capvespre i amb el Sol molt baix',
      // El rang surt del motor sobre la franja sencera: 12,3° a Malpica de
      // Bergantiños i 12,0° a la Corunya per dalt, 1,8° a Maó i 1,7° a l'Illa
      // de l'Aire per baix. Deia «poc més d'1°»; el mínim arrodoneix a 2°.
      text: 'Durant la totalitat, i només llavors, et pots treure el filtre. Però el Sol estarà de 12° a menys de 2° sobre l’horitzó: el lloc que triïs, i què tinguis cap a ponent, decideix si ho veus o no. Llegeix la secció de Sol baix abans de decidir on vas.',
    },
    es: {
      tone: 'warn',
      title: 'Total, al atardecer y con el Sol muy bajo',
      // Mirall castellà del rang del motor (Malpica 12,3°, Maó 1,8°).
      text: 'Durante la totalidad, y solo entonces, puedes quitarte el filtro. Pero el Sol estará de 12° a menos de 2° sobre el horizonte: el sitio que elijas, y qué tengas hacia poniente, decide si lo ves o no. Lee la sección de Sol bajo antes de decidir a dónde vas.',
    },
  },
  '2027-08-02': {
    ca: {
      tone: 'good',
      title: 'Total, al matí i amb el Sol alt: el fàcil dels tres',
      // La totalitat més llarga visible des de terra fins al 2114: el màxim
      // (6 min 23 s) cau a Egipte; des de l'Estret, uns 4 min i mig — el
      // doble que el 2026. La xifra gran es diu amb el seu lloc, com sempre.
      text: 'Sense problemes d’horitzó i amb la totalitat més llarga: cap altra de visible des de terra la superarà fins al 2114 (des de l’Estret, uns 4 min i mig). Durant la totalitat, i només entre C2 i C3, treu-te el filtre i mira la corona. Torna-te’l a posar al primer punt de llum.',
    },
    es: {
      tone: 'good',
      title: 'Total, por la mañana y con el Sol alto: el fácil de los tres',
      text: 'Sin problemas de horizonte y con la totalidad más larga. Durante la totalidad, y solo entre C2 y C3, quítate el filtro y mira la corona. Vuelve a ponértelo al primer punto de luz.',
    },
  },
  '2028-01-26': {
    ca: {
      tone: 'bad',
      title: 'ANULAR: el filtre no es treu en cap moment',
      // El «7°–2°» d'abans eren Sevilla i València: dos punts de mig país
      // presentats com si fossin els extrems. El motor sobre la franja sencera
      // dona 8,4° a Ayamonte i 8,0° a Huelva per dalt, i per baix el Sol ja
      // s'ha post — Barcelona 0,16° al màxim (es pon entre el màxim i C3),
      // Palma 0,38°, Girona −0,39°, Maó −0,69°, cap de Creus −0,78°.
      text: 'Aquest eclipsi NO és total. Queda sempre un anell de Sol visible i crema igual que el Sol sencer. A diferència del 2026 i el 2027, aquí no hi ha ni un segon en què es pugui mirar sense filtre homologat — ni durant l’anularitat. A sobre, el Sol serà entre uns 8° al sud-oest de la franja i ran d’horitzó al nord-est: a Barcelona es pon durant l’anularitat mateixa, i a Girona i a Maó ja s’ha post abans que comenci. L’horitzó lliure aquí no és un consell, és la condició.',
    },
    es: {
      tone: 'bad',
      title: 'ANULAR: el filtro no se quita en ningún momento',
      // Mirall castellà: 8,4° Ayamonte / 8,0° Huelva per dalt; Barcelona 0,16°,
      // Girona −0,39°, Maó −0,69° per baix.
      text: 'Este eclipse NO es total. Siempre queda un anillo de Sol visible y quema igual que el Sol entero. A diferencia de 2026 y 2027, aquí no hay ni un segundo en que se pueda mirar sin filtro homologado — ni durante la anularidad. Además, el Sol estará entre unos 8° en el suroeste de la franja y el ras del horizonte en el noreste: en Barcelona se pone durante la anularidad misma, y en Girona y en Mahón ya se ha puesto antes de que empiece. Aquí el horizonte despejado no es un consejo, es la condición.',
    },
  },
};

/** Avís d'encapçalament de l'eclipsi, o `null` si no en tenim cap. */
export function getEclipseHighlight(
  eclipseId: string,
  locale: Locale,
): EclipseHighlight | null {
  return HIGHLIGHTS[eclipseId]?.[locale] ?? null;
}

/** Fonts, per llistar-les al peu de la guia. */
export interface GuideSource {
  label: string;
  url: string;
}

export const GUIDE_SOURCES: GuideSource[] = [
  { label: 'IGN — Eclipses 2026-2028', url: 'https://eclipses.ign.es/' },
  {
    label: 'IGN — Cómo observar los eclipses',
    url: 'https://eclipses.ign.es/como-observar-eclipses.html',
  },
  { label: 'American Astronomical Society — Eye Safety', url: 'https://eclipse.aas.org/eye-safety' },
  {
    label: 'AAS — How Dark Does It Get During a Total Solar Eclipse?',
    url: 'https://eclipse.aas.org/eclipse-basics/totality-darkness',
  },
  {
    label: 'NASA/GSFC — Solar Eclipse Photography (F. Espenak)',
    url: 'https://eclipse.gsfc.nasa.gov/SEhelp/SEphoto.html',
  },
  {
    label: 'NASA RP 1318 — Solar Eclipse Exposure Guide',
    url: 'https://umbra.nascom.nasa.gov/eclipse/941103/tables/table.15',
  },
  { label: 'ISO 12312-2:2015', url: 'https://www.iso.org/standard/59289.html' },
  // Els noms de lloc són dades d'OpenStreetMap servides per Photon (komoot), i
  // l'ODbL exigeix atribuir-les allà on es facin servir. Es resolen a `App.tsx`
  // per a tota l'aplicació —la barra d'ubicació, l'historial, la comparació—,
  // així que no hi ha cap pantalla concreta a qui penjar-los-hi: van aquí, que
  // és la llista de fonts que sempre es pot obrir, i al peu del mapa.
  {
    label: 'OpenStreetMap — noms de lloc, via Photon (komoot)',
    url: 'https://www.openstreetmap.org/copyright',
  },
];
