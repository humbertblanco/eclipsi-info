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
  en: {
    partial5: 'Partial or annular phase, ND 5.0 filter',
    partial4: 'Partial phase, ND 4.0 filter',
    beads: 'Baily’s beads and diamond ring',
    chromo: 'Chromosphere',
    prom: 'Prominences',
    corona01: 'Inner corona (0.1 R☉)',
    corona02: 'Corona (0.2 R☉)',
    corona05: 'Middle corona (0.5 R☉)',
    corona1: 'Corona (1 R☉)',
    corona2: 'Outer corona (2 R☉)',
    corona4: 'Outer corona (4 R☉)',
    corona8: 'Earthshine and distant corona (8 R☉)',
  },
  fr: {
    partial5: 'Phase partielle ou annulaire, filtre ND 5,0',
    partial4: 'Phase partielle, filtre ND 4,0',
    beads: 'Grains de Baily et anneau de diamant',
    chromo: 'Chromosphère',
    prom: 'Protubérances',
    corona01: 'Couronne interne (0,1 R☉)',
    corona02: 'Couronne (0,2 R☉)',
    corona05: 'Couronne moyenne (0,5 R☉)',
    corona1: 'Couronne (1 R☉)',
    corona2: 'Couronne externe (2 R☉)',
    corona4: 'Couronne externe (4 R☉)',
    corona8: 'Lumière cendrée et couronne lointaine (8 R☉)',
  },
};

const EXPOSURE_HEAD: Record<Locale, string[]> = {
  ca: ['Subjecte', 'Filtre', 'ISO 100 · f/8', 'Q'],
  es: ['Sujeto', 'Filtro', 'ISO 100 · f/8', 'Q'],
  en: ['Subject', 'Filter', 'ISO 100 · f/8', 'Q'],
  fr: ['Sujet', 'Filtre', 'ISO 100 · f/8', 'Q'],
};

const EXPOSURE_CAPTION: Record<Locale, string> = {
  ca: 'Calculat amb t = f² / (ISO × 2^Q) i els factors Q de la guia d’exposició de la NASA (RP 1318, F. Espenak). Fes forquilla: ±2 passos a cada costat.',
  es: 'Calculado con t = f² / (ISO × 2^Q) y los factores Q de la guía de exposición de la NASA (RP 1318, F. Espenak). Haz horquilla: ±2 pasos a cada lado.',
  en: 'Calculated with t = f² / (ISO × 2^Q) and the Q factors from NASA’s exposure guide (RP 1318, F. Espenak). Bracket by ±2 stops on either side.',
  fr: 'Calculé avec t = f² / (ISO × 2^Q) et les facteurs Q du guide d’exposition de la NASA (RP 1318, F. Espenak). Faites un bracketing de ±2 IL de chaque côté.',
};

const FILTER_YES: Record<Locale, string> = { ca: 'Sí', es: 'Sí', en: 'Yes', fr: 'Oui' };
const FILTER_NO: Record<Locale, string> = { ca: 'NO', es: 'NO', en: 'NO', fr: 'NON' };

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

/* ----------------------------------------------------------- English guide */

function guideEn(): GuideSection[] {
  return [
    {
      id: 'safety',
      title: 'Eye safety',
      lead: 'The section you must read even if you read nothing else. A mistake here cannot be undone.',
      defaultOpen: true,
      blocks: [
        {
          kind: 'p',
          text: 'The retina has no pain receptors. A solar retinal burn does not hurt while it is happening: you notice it hours later, when a dark spot appears in the centre of your field of vision and does not go away. There is no treatment. That is why the rules in this section allow no exceptions and no “just one second”.',
        },
        {
          kind: 'callout',
          tone: 'good',
          title: 'The only thing that works: ISO 12312-2',
          text: 'Eclipse glasses or solar-viewing film certified to ISO 12312-2. They transmit at most 0.0032% of visible light, block all ultraviolet and at least 97% of infrared. With certified glasses on, the Sun’s disc should be the only thing you can see: if you can see anything else around you, they are not safe.',
        },
        {
          kind: 'list',
          tone: 'bad',
          items: [
            'Sunglasses, however dark they are, even high-quality ones with a UV filter. They transmit thousands of times more light than is safe.',
            'X-ray film and exposed photographic film. Modern film uses dyes instead of silver and provides no protection whatsoever.',
            'Candle-smoked glass, welding glass below shade 12 and plastic mirrors.',
            'CDs, DVDs, floppy disks, crisp packets, coloured plastics and negatives: they do not filter the infrared that cooks your retina without you noticing.',
            '3D cinema glasses, helmet visors and window-tinting film.',
            'Camera filters of insufficient density (ND 8, ND 64, polarisers and even ND 1000), and especially any filter screwed in BEHIND the lens or in front of a telescope eyepiece.',
          ],
        },
        {
          kind: 'p',
          text: 'How dark a material looks has nothing to do with whether it protects you. What matters is what it does to infrared and ultraviolet, and you cannot judge that by looking at it.',
        },
        {
          kind: 'callout',
          tone: 'bad',
          title: 'Telescopes, binoculars and telephoto lenses: the real danger',
          text: 'An optical instrument concentrates sunlight. Looking through an unfiltered telescope or binoculars destroys the retina in a fraction of a second, and eclipse glasses will NOT protect you: the concentrated light melts them. The filter must ALWAYS be securely mounted over the front of the objective, never at the eyepiece or between the objective and your eye, so that a gust of wind cannot dislodge it. A screw-in solar eyepiece filter is never safe.',
        },
        {
          kind: 'p',
          text: 'If you do not have a front-mounted filter, projection is safe and spectacular: make a small hole in a piece of card and, with your back to the Sun, watch the image it projects onto the ground or another card. A kitchen colander makes dozens of tiny crescent Suns at once. Never look at the Sun through the hole.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'TOTAL ECLIPSE: the two minutes when you must look without a filter',
          text: 'Only if you are INSIDE the path of totality, and only between second contact (C2) and third contact (C3), is the Sun completely covered; then you can — and should — remove your filter and view the corona with the unaided eye. It is the only way to see it: absolutely nothing is visible through a solar filter. Remove the filter only when the Sun disappears completely and darkness falls suddenly. Put it back on before any point of sunlight reappears at the Moon’s edge: at that instant your eyes must already be covered.',
        },
        {
          kind: 'callout',
          tone: 'bad',
          title: 'ANNULAR ECLIPSE: there is never a safe moment. Ever.',
          text: 'In an annular eclipse the Moon is too small to cover the Sun, so a bright ring always remains visible. That ring burns exactly like the full Sun. There is no instant during annularity when it is safe to look without a filter — not for one second, not for a photograph, and not even if the sky has darkened and the glare seems weaker. The eclipse of 26 January 2028 is annular: the filter stays on from C1 to C4.',
        },
        {
          kind: 'p',
          text: 'This is the most dangerous source of confusion in Spain’s eclipse trilogy. Many people will have experienced 2026 and 2027 by removing their glasses during totality and may instinctively do the same in 2028. Do not, and warn the people beside you.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Partial phase outside the path',
          text: 'If you are outside the central path, there is no safe moment even if obscuration reaches 99%. A filter is mandatory from beginning to end. The difference between 99% and 100% is not a matter of degree: it is something entirely different.',
        },
        {
          kind: 'list',
          tone: 'warn',
          items: [
            'Inspect the filter against the light before setting out: discard it if it has any scratch, pinhole or crack.',
            'Put the filter on before looking up at the Sun, and remove it only after looking down again.',
            'Watch children closely: they have the most accidents because they turn their glasses around or look underneath them.',
            'Cardboard eclipse glasses are not for wearing continuously: use them to look at the Sun for a few seconds at a time.',
          ],
        },
      ],
    },
    {
      id: 'phases',
      title: 'The phases, explained',
      lead: 'C1, C2, C3, C4, magnitude and obscuration: what each means, and why 95% is not “almost”.',
      blocks: [
        {
          kind: 'defs',
          items: [
            { term: 'C1 — first contact', text: 'The Moon’s edge touches the Sun’s edge and the first bite begins. You notice nothing with the unaided eye; through a filter you see a tiny notch. From here to C2 takes between fifty-five minutes (in 2026) and well over an hour and a quarter (in 2028).' },
            { term: 'C2 — second contact', text: 'The Moon finishes covering the Sun (or, in an annular eclipse, moves fully inside it and closes the ring). This is the instant of Baily’s beads and the diamond ring. In a total eclipse, this — and no earlier — is when filters come off.' },
            { term: 'C3 — third contact', text: 'The first point of sunlight reappears on the other side. Totality or annularity ends. Filters must be back on BEFORE it arrives.' },
            { term: 'C4 — fourth contact', text: 'The Moon leaves the solar disc. The eclipse ends. This occurs between fifty minutes (in 2026) and just over an hour (in 2027 and 2028) after C3. Note that in 2026 and 2028 the Sun sets before C4 across almost the entire path — in Valencia in 2026, C4 would occur with the Sun 4° below the horizon; in Barcelona in 2028, nearly 12° below. Your eclipse ends at sunset, not at C4.' },
            { term: 'Magnitude', text: 'The fraction of the Sun’s DIAMETER covered by the Moon. It is a ratio of diameters, not areas. It exceeds 1 in a total eclipse and remains below 1 in an annular eclipse.' },
            { term: 'Obscuration', text: 'The fraction of the solar disc’s AREA that is covered. This is the figure people call the “eclipse percentage”. It has no one-to-one relationship with magnitude because the Moon’s apparent size changes along its orbit.' },
          ],
        },
        {
          kind: 'p',
          text: 'An obscuration of 90% sounds like a lot, yet visually it is nothing. The figures usually quoted — 100,000 lux in full Sun and 1,000 lux at 99% obscuration — are for midday with the Sun high. Spain’s 2026 and 2028 eclipses are different: the Sun is only a few degrees above the horizon, shifting the entire range downward. In Asturias, with the Sun at 12°, a clear sky gives about 17,000 lux; about 1,200 remain at 90% coverage, and roughly one hundred at 99%. It is not the simple proportion you might expect: the Moon ultimately covers the centre of the disc, its brightest part. The percentage is just as deceptive, but from a much lower baseline.',
        },
        {
          kind: 'p',
          text: 'There are two reasons. First, the eye responds logarithmically: each tenfold reduction in light feels like one small step, not a plunge. Second, during the long partial phase your pupils gradually dilate without you noticing — from one millimetre to two, quadrupling the light admitted — and compensate for the loss as it happens.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'The entire plunge comes in the final seconds',
          text: 'From 99% to totality the light still falls by a factor of forty to eighty in less than a minute: far faster than the eye can adapt. With the Sun high, illumination drops from about 570 lux to about 7; with the Spanish Sun at 12°, from roughly one hundred to just over 2, already a night-sky level. The relative plunge is similar and feels just as dramatic. That is why totality does not “arrive”; it falls on top of you. And that is why 99% and 100% are different experiences, not the same one with a little more or less. The countdown calculates the figures for your location and your Sun altitude.',
        },
      ],
    },
    {
      id: 'watch',
      title: 'What to watch, and when',
      lead: 'Totality is short. It is worth arriving knowing what to look for and in what order.',
      blocks: [
        {
          kind: 'defs',
          items: [
            { term: 'Final minutes before C2', text: 'The light turns metallic and shadows become extraordinarily sharp — the Sun has become a line of light rather than a disc. Look at leaf shadows on the ground: every gap between the leaves acts as a pinhole and fills the ground with crescents.' },
            { term: 'Shadow bands', text: 'One or two minutes before and after totality, faint rippling dark lines race across the ground like light on the bottom of a swimming pool. They are caused by atmospheric turbulence and do not always appear. To see them, spread a smooth white sheet on the ground before the eclipse begins.' },
            { term: 'Baily’s beads', text: 'Right at C2, the final thread of sunlight breaks into separate bright points: sunlight is passing through valleys along the Moon’s edge. It lasts seconds.' },
            { term: 'Diamond ring', text: 'When only one point remains and the corona is already beginning to show around it. This is the image everyone knows. It happens twice: before C2 and just after C3.' },
            { term: 'Chromosphere', text: 'A thin, vivid pink arc around the Moon during the first and last seconds of totality. Its colour comes from hydrogen emission.' },
            { term: 'Prominences', text: 'Reddish tongues of plasma projecting beyond the edge. They are striking through binoculars (now without filters, but ONLY during totality).' },
            { term: 'Corona', text: 'The reason for the journey. A pearly, structured halo with streamers that may extend several solar radii. No photograph resembles it: no sensor can hold the dynamic range seen by the eye. Look first with the unaided eye, then with binoculars.' },
            { term: '360° twilight', text: 'Look away from the Sun for a moment and turn around: the entire horizon has sunset colours in every direction, because you are beneath a shadow two or three hundred kilometres wide — about 305 km across Spain in 2026 — while daylight continues outside it.' },
            { term: 'Planets and stars', text: 'With the sky at civil-twilight brightness, Venus and Jupiter appear easily, with Mercury and the brightest stars visible in clear conditions. On 12 August 2026, the eclipse also falls at the peak of the Perseids.' },
            { term: 'Temperature and animals', text: 'The temperature drops very sharply within seconds, often accompanied by a sudden breeze. Birds abruptly fall silent or return to roost, crickets begin to sing and livestock head for shelter. It is worth listening as much as looking.' },
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Save the last ten seconds for doing nothing',
          text: 'The 2026 totality is short, and your location matters enormously: the maximum over Spanish land is 1 min 50 s on the centreline as it reaches Asturias, falling rapidly towards the edges — 62 seconds in Valencia, 68 in Mahón and 58 in Tarragona. Spend that time checking focus and you will miss it. Decide beforehand which seconds belong to the camera and which to looking, and when C3 approaches, stop.',
        },
      ],
    },
    {
      id: 'lowsun',
      title: 'Low Sun: choosing a location',
      lead: 'In 2026 and 2028 the central phase occurs with the Sun almost touching the horizon. Here, location decides everything.',
      criticalFor: ['2026-08-12', '2028-01-26'],
      blocks: [
        {
          kind: 'p',
          text: 'On 12 August 2026, totality occurs near sunset, with the Sun between 12° and less than 2° above the horizon depending on your location: the farther east along the path, the lower it is — 12° in A Coruña, 8° in Burgos, 4.6° in Valencia and 1.8° in Mahón. On 26 January 2028, annularity arrives even lower: 8° in Huelva, 7° in Seville and 2.4° in Valencia; in Barcelona the Sun sets during annularity itself (0.2° at maximum), while in Girona and Mahón it has already set before annularity arrives. In both cases the problem is not the sky; it is what lies in front of you.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Seeing the Sun’s disc is not enough',
          text: 'What you have come to see is not the disc but the corona spreading around it. Coronal streamers commonly reach four to six solar radii, and because the Sun’s radius is about 0.26° in August, that means a halo between one and one and a half degrees in radius. Add the Sun’s continued descent during totality and atmospheric extinction at low altitude, and the practical rule is to leave about 3° clear above any obstacle, not zero. A hill that “only” blocks the sky up to 2° lets you see the Sun but steals half the corona.',
        },
        {
          kind: 'p',
          text: 'Three degrees is far more than it seems from the ground. A six-storey building one hundred metres away already spans 10°. A mountain ridge ten kilometres away that rises 500 m above you spans 2.9° — and you still need another three clear degrees above it. Your closed fist at arm’s length spans about 10°: if the western skyline from your planned spot lies below half a fist, the margin is tight.',
        },
        {
          kind: 'list',
          items: [
            'The best horizon is open sea to the west; next best is a broad west-facing valley or a ridge with the terrain falling away in that direction.',
            'Gaining altitude helps only if the obstruction is nearby. Against a distant mountain range, climbing one hundred metres solves nothing: you need to move sideways.',
            'Beware of fog and haze: at low altitude you look through a vast amount of atmosphere, and haze invisible at 30° can hide the Sun completely at 2°. The sea readily produces low evening fog in August.',
            'Atmospheric refraction raises the Sun’s apparent altitude, increasingly so as it approaches the horizon. It helps, but is not a planning figure: do not rely on it to save half a degree.',
            'Scout the location a day beforehand at the same time and see exactly where the Sun sets. With the Sun this low, moving one hundred metres can change the outcome.',
            'Arrive hours early on eclipse day. The best viewpoints will fill up, and being stuck on the road with the Sun at 5° means the journey was for nothing.',
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'The advantage of a low Sun',
          text: 'There is a reward for all this: the corona above a foreground of landscape, sea or mountains makes the most beautiful eclipse photograph possible, and it cannot be made with the Sun high. Shadow bands and the 360° twilight are also far more visible with the Sun on the horizon.',
        },
      ],
    },
    {
      id: 'photo',
      title: 'Photography',
      lead: 'Exposure by phase, focal length and framing — plus a warning not to spend totality staring at a screen.',
      blocks: [
        {
          kind: 'callout',
          tone: 'bad',
          title: 'Front-mounted filter for everything except totality',
          text: 'During every partial phase, and throughout the 2028 annularity, the lens must have a solar filter mounted over its front. Without one, the focused Sun can melt the sensor in seconds; with an SLR, looking through the optical viewfinder can melt your retina first. Remove the filter only between C2 and C3 of a TOTAL eclipse, and replace it before C3.',
        },
        exposureTable('en'),
        {
          kind: 'p',
          text: 'The table is a starting point, not dogma: the corona has an enormous dynamic range and no single exposure captures it. Use a rapid manual bracket — the same aperture, with shutter speeds from 1/2000 s to 1 s — and combine the frames afterwards. Program and rehearse everything before eclipse day.',
        },
        {
          kind: 'defs',
          items: [
            { term: 'Size of the Sun in the frame', text: 'The diameter of the Sun’s image in millimetres is approximately the focal length divided by 109. At 400 mm the Sun is 3.7 mm across: on a full-frame sensor (24 mm high) it occupies 15% of the frame height, leaving the corona to fill it well.' },
            { term: 'Maximum focal length', text: 'For the whole disc, use at most about 2500 mm on full frame or 1700 mm on APS-C. For the corona with framing room, use about 1000 mm on full frame or 700 mm on APS-C.' },
            { term: 'Recommended focal length', text: 'Between 200 and 500 mm gives room around the corona and makes framing less critical, which matters when you have only one or two minutes. If you carry two bodies, leave the second recording video with a fixed wide-angle view of the scene: it captures faces and the changing ambient light, which is what you will remember.' },
            { term: 'Framing with a low Sun', text: 'In 2026 and 2028, a 24–70 mm lens showing the small eclipsed Sun above a sea or mountain silhouette makes a better image than a telephoto lens. It also removes the need for precise tracking.' },
            { term: 'Focus', text: 'Focus manually at true infinity, set beforehand using live-view magnification on the filtered Sun’s edge or on a star. Lock it with tape. Autofocus will fail during totality.' },
            { term: 'Tripod and shutter release', text: 'Essential from 200 mm upward. Use a remote release or a 2 s timer, and turn stabilisation off when the camera is on a tripod. With a low Sun, watch for wind.' },
            { term: 'Phone', text: 'A phone will not make a decent photograph of the corona, but it can record an excellent video of the atmosphere and 360° twilight. Use manual mode if available, lock exposure before C2, and leave it recording unattended on a small tripod. Partial phases also require a filter over the phone lens.' },
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'The rule that will spare you regret',
          text: 'If this is your first total eclipse, do not take photographs — or automate the camera and do not look at it. Totality in 2026 lasts only a minute or a little more — 1 min 50 s at Spain’s best location, 62 seconds in Valencia — and in 2027 it lasts four and a half minutes at the Strait. You will never get it back; millions of corona photographs are better than yours will be. Watch it with your own eyes.',
        },
      ],
    },
    {
      id: 'checklist',
      title: 'Checklist and logistics',
      lead: 'What to bring, how to get there, and why the app works without coverage.',
      blocks: [
        {
          kind: 'list',
          items: [
            'ISO 12312-2 compliant eclipse glasses — plus a spare pair, because someone will ask for them or yours will break.',
            'A front-mounted solar filter for every optical instrument you plan to use, plus tape to secure it.',
            'Binoculars: the corona and prominences look spectacular through them during totality.',
            'A red torch or headlamp in red mode: very little is visible during totality, and white lights disturb everyone.',
            'A charged power bank and your phone at 100%. A saturated network and active GPS drain the battery fast.',
            'Water and food for far longer than you expect, plus a folding chair.',
            'Warm clothes: the temperature drops suddenly during totality, and the 2028 eclipse is in January at sunset.',
            'A white sheet spread on the ground for viewing shadow bands.',
            'Insect repellent for 2026, which occurs on an August evening at peak mosquito time. The 2027 eclipse is also in August but occurs in the morning: sunscreen and shade during the wait matter more there.',
            'A compass or the app, to know exactly where the Sun will be from your chosen location.',
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Mobile network: assume it is dead',
          text: 'Tens of thousands of people concentrated within a few kilometres will overload the masts until they are unusable. You will not be able to look things up, send messages or use online maps. Download offline maps of the area before leaving, agree a meeting point with your group in advance and carry written directions. This app is designed to work without a connection for exactly that reason.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Traffic and crowds',
          text: 'The pattern is always the same: people trickle in all day and everyone leaves at once within five minutes. Expect hours of queues afterwards. Fill the tank the day before, park facing the exit, and remember that a narrow viewpoint with a single access road is a trap. Many councils will restrict access to the best-known sites, so check beforehand.',
        },
        {
          kind: 'p',
          text: 'Weather: the final decision belongs to the last 24 hours. August is statistically favourable in Spain’s interior and worse on the Cantabrian coast, where low evening fog is common; January 2028 is the riskiest of the three. Prepare two or three alternative sites within the path and well separated from one another, then check high-resolution models and satellite images that morning. Being willing to drive one hundred kilometres on the day is what separates seeing it from missing it.',
        },
        {
          kind: 'callout',
          tone: 'good',
          title: 'And if a cloud covers it after all',
          text: 'You will still feel it: the sudden darkness, temperature drop, silence of the animals and twilight along the horizon all happen anyway. Do not keep staring at the cloud; look around you.',
        },
      ],
    },
  ];
}

function guideFr(): GuideSection[] {
  return [
    {
      id: 'safety',
      title: 'Sécurité oculaire',
      lead: 'La section que vous devez lire même si vous ne lisez rien d\'autre. Une erreur ici ne peut pas être réparée.',
      defaultOpen: true,
      blocks: [
        {
          kind: 'p',
          text: 'La rétine n\'a pas de récepteurs de douleur. Une brûlure solaire de la rétine ne fait pas mal au moment où elle se produit : vous la remarquez des heures plus tard, lorsqu\'une tache sombre apparaît au centre de votre champ de vision et ne disparaît pas. Il n\'y a pas de traitement. C\'est pourquoi les règles de cette section n\'autorisent aucune exception et aucun « juste une seconde ».',
        },
        {
          kind: 'callout',
          tone: 'good',
          title: 'La seule chose qui fonctionne : ISO 12312-2',
          text: 'Lunettes Eclipse ou film solaire certifié ISO 12312-2. Ils transmettent au maximum 0,0032 % de la lumière visible, bloquent tous les ultraviolets et au moins 97 % des infrarouges. Avec des lunettes certifiées, le disque solaire devrait être la seule chose que vous puissiez voir : si vous pouvez voir autre chose autour de vous, ils ne sont pas en sécurité.',
        },
        {
          kind: 'list',
          tone: 'bad',
          items: [
            'Les lunettes de soleil, aussi foncées et qualitatives soient-elles, même avec filtre UV. Elles laissent passer des milliers de fois plus de lumière que le seuil de sécurité.',
            'Film radiographique et film photographique exposé. Les films modernes utilisent des colorants au lieu de l\'argent et n\'offrent aucune protection.',
            'Verre fumé à la bougie, verre soudé sous l\'abat-jour 12 et miroirs en plastique.',
            'CD, DVD, disquettes, paquets de chips, plastiques colorés et négatifs : ils ne filtrent pas les infrarouges qui cuisent votre rétine sans que vous vous en rendiez compte.',
            'Lunettes de cinéma 3D, visières de casque et film teinté pour vitres.',
            'Filtres d\'appareil photo de densité insuffisante (ND 8, ND 64, polariseurs et même ND 1000), et surtout tout filtre vissé DERRIÈRE l\'objectif ou devant un oculaire de télescope.',
          ],
        },
        {
          kind: 'p',
          text: 'L’obscurité d’un matériau n’a rien à voir avec sa protection. Ce qui compte, c\'est ce qu\'il fait aux infrarouges et aux ultraviolets, et vous ne pouvez pas en juger en les regardant.',
        },
        {
          kind: 'callout',
          tone: 'bad',
          title: 'Télescopes, jumelles et téléobjectifs : le vrai danger',
          text: 'Un instrument optique concentre la lumière du soleil. Regarder à travers un télescope ou des jumelles non filtrés détruit la rétine en une fraction de seconde, et les lunettes à éclipse ne vous protégeront PAS : la lumière concentrée les fait fondre. Le filtre doit TOUJOURS être solidement monté sur l\'avant de l\'objectif, jamais au niveau de l\'oculaire ou entre l\'objectif et votre œil, afin qu\'un coup de vent ne puisse pas le déloger. Un filtre oculaire solaire à visser n’est jamais sûr.',
        },
        {
          kind: 'p',
          text: 'Si vous ne disposez pas de filtre frontal, la projection est sûre et spectaculaire : faites un petit trou dans un morceau de carton et, dos au Soleil, regardez l\'image qu\'il projette sur le sol ou sur une autre carte. Une passoire de cuisine permet de préparer des dizaines de petits croissants de soleil à la fois. Ne regardez jamais le Soleil à travers le trou.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'ÉCLIPSE TOTALE : les deux minutes où il faut regarder sans filtre',
          text: 'Ce n\'est que si vous êtes À L\'INTÉRIEUR du chemin de la totalité, et seulement entre le deuxième contact (C2) et le troisième contact (C3), que le Soleil est complètement couvert ; alors vous pouvez – et devez – retirer votre filtre et visualiser la couronne à l’œil nu. C\'est la seule façon de le voir : absolument rien n\'est visible à travers un filtre solaire. Retirez le filtre uniquement lorsque le soleil disparaît complètement et que l\'obscurité tombe soudainement. Remettez-le avant qu\'un point de soleil ne réapparaisse au bord de la Lune : à cet instant, vos yeux doivent déjà être couverts.',
        },
        {
          kind: 'callout',
          tone: 'bad',
          title: 'ÉCLIPSE ANNULAIRE : il n\'y a jamais de moment sûr. Jamais.',
          text: 'Lors d’une éclipse annulaire, la Lune est trop petite pour couvrir le Soleil, donc un anneau brillant reste toujours visible. Cet anneau brûle exactement comme le plein Soleil. Il n’y a pas d’instant pendant l’annularité où il est sûr de regarder sans filtre – pas une seconde, pas pour une photographie, et même si le ciel s’est assombri et que l’éblouissement semble plus faible. L\'éclipse du 26 janvier 2028 est annulaire : gardez le filtre de C1 à C4.',
        },
        {
          kind: 'p',
          text: 'C’est la source de confusion la plus dangereuse de la trilogie des éclipses espagnoles. De nombreuses personnes auront vécu 2026 et 2027 en retirant leurs lunettes pendant la totalité et pourraient instinctivement faire de même en 2028. Ne le faites pas et prévenez les personnes à vos côtés.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Phase partielle en dehors du chemin',
          text: 'Si vous êtes en dehors du chemin central, il n\'y a aucun moment de sécurité même si l\'obscurcissement atteint 99 %. Un filtre est obligatoire du début à la fin. La différence entre 99 % et 100 % n’est pas une question de degré : c’est quelque chose de complètement différent.',
        },
        {
          kind: 'list',
          tone: 'warn',
          items: [
            'Inspectez le filtre à contre-jour avant de partir : jetez-le s\'il présente une rayure, un trou d\'épingle ou une fissure.',
            'Mettez le filtre avant de regarder le Soleil et retirez-le seulement après avoir regardé à nouveau vers le bas.',
            'Surveillez attentivement les enfants : ce sont eux qui ont le plus d\'accidents parce qu\'ils retournent leurs lunettes ou regardent en dessous.',
            'Les lunettes à éclipse en carton ne doivent pas être portées en continu : utilisez-les pour regarder le Soleil quelques secondes à la fois.',
          ],
        },
      ],
    },
    {
      id: 'phases',
      title: 'Les phases, expliquées',
      lead: 'C1, C2, C3, C4, magnitude et obscurcissement : ce que chacun signifie et pourquoi 95 % n\'est pas « presque ».',
      blocks: [
        {
          kind: 'defs',
          items: [
            { term: 'C1 — premier contact', text: 'Le bord de la Lune touche le bord du Soleil et la première morsure commence. Vous ne remarquez rien à l’œil nu ; à travers un filtre, vous voyez une petite encoche. De là à C2, il faut entre cinquante-cinq minutes (en 2026) et bien plus d’une heure et quart (en 2028).' },
            { term: 'C2 — deuxième contact', text: 'La Lune finit de recouvrir le Soleil (ou, lors d\'une éclipse annulaire, se déplace complètement à l\'intérieur et ferme l\'anneau). C’est l’instant des perles de Baily et de la bague en diamant. Lors d’une éclipse totale, c’est à ce moment-là – et pas avant – que on retire les filtres.' },
            { term: 'C3 — troisième contact', text: 'Le premier point de soleil réapparaît de l’autre côté. La totalité ou l\'annularité prend fin. Les filtres doivent être remis AVANT son arrivée.' },
            { term: 'C4 — quatrième contact', text: 'La Lune quitte le disque solaire. L\'éclipse se termine. Cela se produit entre cinquante minutes (en 2026) et un peu plus d’une heure (en 2027 et 2028) après C3. Notez qu\'en 2026 et 2028, le Soleil se couche avant C4 sur presque toute la trajectoire — à Valence en 2026, C4 se produirait avec le Soleil 4° sous l\'horizon ; à Barcelone en 2028, près de 12° en dessous. Votre éclipse se termine au coucher du soleil, pas à C4.' },
            { term: 'Magnitude', text: 'La fraction du DIAMÈTRE du Soleil couverte par la Lune. Il s\'agit d\'un rapport de diamètres et non de surfaces. Il dépasse 1 lors d’une éclipse totale et reste inférieur à 1 lors d’une éclipse annulaire.' },
            { term: 'Obscurcissement', text: 'La fraction de la SURFACE du disque solaire qui est couverte. C’est ce que l’on appelle le « pourcentage d’éclipse ». Il n’y a pas de relation directe avec la magnitude car la taille apparente de la Lune change le long de son orbite.' },
          ],
        },
        {
          kind: 'p',
          text: 'Un obscurcissement de 90% semble beaucoup, mais visuellement ce n\'est rien. Les chiffres habituellement cités — 100 000 lux en plein soleil et 1 000 lux à 99 % d\'obscurcissement — concernent midi avec le soleil haut. Les éclipses espagnoles de 2026 et 2028 sont différentes : le Soleil n’est qu’à quelques degrés au-dessus de l’horizon, déplaçant toute la plage vers le bas. Dans les Asturies, avec le Soleil à 12°, un ciel clair donne environ 17 000 lux ; environ 1 200 restent à 90 % de couverture et environ une centaine à 99 %. Ce n’est pas la proportion simple à laquelle on pourrait s’attendre : la Lune recouvre finalement le centre du disque, sa partie la plus brillante. Le pourcentage est tout aussi trompeur, mais à partir d’un niveau de référence bien inférieur.',
        },
        {
          kind: 'p',
          text: 'Il y a deux raisons. Premièrement, l’œil réagit de manière logarithmique : chaque réduction décuplé de la lumière ressemble à un petit pas, pas à un plongeon. Deuxièmement, pendant la longue phase partielle, vos pupilles se dilatent progressivement sans que vous vous en rendiez compte — d\'un millimètre à deux, quadruplant la lumière admise — et compensent la perte au fur et à mesure.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Le plongeon entier se produit dans les dernières secondes',
          text: 'De 99 % à la totalité, la lumière diminue toujours d\'un facteur de quarante à quatre-vingts en moins d\'une minute : bien plus vite que l\'œil ne peut s\'adapter. Avec le Soleil haut, l\'éclairage chute d\'environ 570 lux à environ 7 ; avec le soleil espagnol à 12°, d\'environ cent à un peu plus de 2, déjà un niveau de ciel nocturne. La chute relative est similaire et semble tout aussi dramatique. C\'est pourquoi la totalité n\'« arrive » pas ; elle vous tombe dessus. Et c’est pour cela que 99 % et 100 % sont des expériences différentes, pas la même avec un peu plus ou un peu moins. Le compte à rebours calcule les chiffres de votre emplacement et de votre altitude solaire.',
        },
      ],
    },
    {
      id: 'watch',
      title: 'Que regarder et quand',
      lead: 'La totalité est courte. Cela vaut la peine d\'arriver en sachant quoi chercher et dans quel ordre.',
      blocks: [
        {
          kind: 'defs',
          items: [
            { term: 'Dernières minutes avant la C2', text: 'La lumière devient métallique et les ombres deviennent extraordinairement nettes : le Soleil est devenu une ligne de lumière plutôt qu\'un disque. Regardez les ombres des feuilles au sol : chaque espace entre les feuilles agit comme un trou d’épingle et remplit le sol de croissants.' },
            { term: 'Bandes d\'ombre', text: 'Une ou deux minutes avant et après la totalité, de légères lignes sombres ondulantes parcourent le sol comme la lumière au fond d\'une piscine. Elles sont provoquées par les turbulences atmosphériques et n’apparaissent pas toujours. Pour les voir, étalez un drap blanc et lisse sur le sol avant le début de l\'éclipse.' },
            { term: 'Les perles de Baily', text: 'Juste en C2, le dernier fil de lumière solaire se divise en points lumineux séparés : la lumière solaire traverse les vallées le long du bord de la Lune. Cela dure quelques secondes.' },
            { term: 'Anneau de diamant', text: 'Quand il ne reste plus qu’un point et que la couronne commence déjà à apparaître autour de lui. C\'est l\'image que tout le monde connaît. Cela arrive deux fois : avant C2 et juste après C3.' },
            { term: 'Chromosphère', text: 'Un arc fin et rose vif autour de la Lune pendant les première et dernière secondes de la totalité. Sa couleur provient de l\'émission d\'hydrogène.' },
            { term: 'Proéminences', text: 'Langues rougeâtres de plasma dépassant du bord. Elles sont saisissantes aux jumelles (maintenant sans filtres, mais UNIQUEMENT pendant la totalité).' },
            { term: 'Couronne', text: 'La raison du voyage. Un halo nacré et structuré avec des banderoles pouvant s\'étendre sur plusieurs rayons solaires. Aucune photographie ne lui ressemble : aucun capteur ne peut conserver la plage dynamique vue par l’œil. Regardez d’abord à l’œil nu, puis avec des jumelles.' },
            { term: 'Crépuscule à 360°', text: 'Détournez-vous un instant du Soleil et retournez-vous : l’horizon tout entier a des couleurs de coucher de soleil dans toutes les directions, car vous êtes sous une ombre de deux ou trois cents kilomètres de large – environ 305 km à travers l’Espagne en 2026 – tandis que la lumière du jour continue à l’extérieur.' },
            { term: 'Planètes et étoiles', text: 'Avec un ciel à la luminosité du crépuscule civil, Vénus et Jupiter apparaissent facilement, tandis que Mercure et les étoiles les plus brillantes sont visibles par temps clair. Le 12 août 2026, l’éclipse tombe également au sommet des Perséides.' },
            { term: 'Température et animaux', text: 'La température chute très fortement en quelques secondes, souvent accompagnée d\'une brise soudaine. Les oiseaux se taisent brusquement ou retournent se percher, les grillons se mettent à chanter et le bétail se dirige vers un abri. Cela vaut autant la peine d’écouter que de regarder.' },
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Gardez les dix dernières secondes pour ne rien faire',
          text: 'La totalité de 2026 est courte et votre localisation compte énormément : le maximum sur le territoire espagnol est de 1 min 50 s sur la ligne médiane lorsqu\'il atteint les Asturies, tombant rapidement vers les bords : 62 secondes à Valence, 68 à Mahón et 58 à Tarragone. Passez ce temps à vérifier la mise au point et vous la manquerez. Décidez à l\'avance quelles secondes appartiennent à la caméra et lesquelles regarder, et lorsque C3 approche, arrêtez-vous.',
        },
      ],
    },
    {
      id: 'lowsun',
      title: 'Soleil bas : choisir un emplacement',
      lead: 'En 2026 et 2028, la phase centrale se produit lorsque le Soleil touche presque l\'horizon. Ici, le lieu décide de tout.',
      criticalFor: ['2026-08-12', '2028-01-26'],
      blocks: [
        {
          kind: 'p',
          text: 'Le 12 août 2026, la totalité se produit à l\'approche du coucher du soleil, avec le Soleil entre 12° et moins de 2° au-dessus de l\'horizon selon votre position : plus le chemin est à l\'est, plus il est bas : 12° à La Corogne, 8° à Burgos, 4,6° à Valence et 1,8° à Mahón. Le 26 janvier 2028, l\'annularité arrive encore plus bas : 8° à Huelva, 7° à Séville et 2,4° à Valence ; à Barcelone, le Soleil se couche pendant l\'annularité elle-même (0,2° au maximum), tandis qu\'à Gérone et Mahón il s\'est déjà couché avant l\'arrivée de l\'annularité. Dans les deux cas, le problème n’est pas le ciel ; c\'est ce qui se trouve devant vous.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Voir le disque du Soleil ne suffit pas',
          text: 'Ce que vous êtes venu voir, ce n’est pas le disque mais la couronne qui s’étend autour de lui. Les banderoles coronales atteignent généralement quatre à six rayons solaires, et comme le rayon du Soleil est d\'environ 0,26° en août, cela signifie un halo de rayon compris entre un et un degré et demi. Ajoutez à cela la descente continue du Soleil pendant la totalité et l’extinction atmosphérique à basse altitude, et la règle pratique est de laisser environ 3° de dégagement au-dessus de tout obstacle, et non zéro. Une colline qui bloque « seulement » le ciel jusqu’à 2° permet de voir le Soleil mais vole la moitié de la couronne.',
        },
        {
          kind: 'p',
          text: 'Trois degrés, c’est bien plus qu’il n’y paraît vu du sol. Un immeuble de six étages à une centaine de mètres s\'étend déjà sur 10°. Une crête de montagne à dix kilomètres de là, qui s\'élève à 500 m au-dessus de vous, s\'étend sur 2,9° – et il vous faut encore trois degrés clairs au-dessus. Votre poing fermé à bout de bras s\'étend sur environ 10° : si l\'horizon ouest à partir de l\'endroit prévu se situe en dessous d\'un demi-poing, la marge est étroite.',
        },
        {
          kind: 'list',
          items: [
            'Le meilleur horizon est la mer ouverte à l’ouest ; viennent ensuite une large vallée orientée vers l\'ouest ou une crête avec le terrain tombant dans cette direction.',
            'Prendre de l\'altitude n\'est utile que si l\'obstacle est à proximité. Face à une chaîne de montagnes lointaine, grimper une centaine de mètres ne résout rien : il faut se déplacer de côté.',
            'Attention au brouillard et à la brume : à basse altitude, vous regardez à travers une grande quantité d\'atmosphère, et une brume invisible à 30° peut cacher complètement le Soleil à 2°. La mer produit facilement un faible brouillard nocturne en août.',
            'La réfraction atmosphérique augmente l’altitude apparente du Soleil, d’autant plus qu’il s’approche de l’horizon. Cela aide, mais ce n’est pas un chiffre de planification : ne comptez pas sur lui pour économiser un demi-degré.',
            'Recherchez l\'emplacement un jour à l\'avance à la même heure et voyez exactement où le soleil se couche. Avec un Soleil aussi bas, se déplacer d’une centaine de mètres peut changer le résultat.',
            'Arrivez des heures plus tôt le jour de l\'éclipse. Les meilleurs points de vue vont se remplir, et être coincé sur la route avec un soleil à 5° signifie que le voyage n\'a servi à rien.',
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'L\'avantage d\'un soleil bas',
          text: 'Il y a une récompense à tout cela : la couronne au-dessus d\'un premier plan d\'un paysage, d\'une mer ou d\'une montagne permet de réaliser la plus belle photographie d\'éclipse possible, et elle ne peut pas être réalisée avec le Soleil haut. Les bandes d\'ombre et le crépuscule à 360° sont également bien plus visibles avec le Soleil à l\'horizon.',
        },
      ],
    },
    {
      id: 'photo',
      title: 'Photographie',
      lead: 'Exposition par phase, distance focale et cadrage – plus un avertissement de ne pas passer la totalité à regarder un écran.',
      blocks: [
        {
          kind: 'callout',
          tone: 'bad',
          title: 'Filtre frontal pour tout sauf la totalité',
          text: 'Pendant chaque phase partielle et tout au long de l\'annularité 2028, la lentille doit avoir un filtre solaire monté sur sa face avant. Sans cela, le Soleil focalisé peut faire fondre le capteur en quelques secondes ; avec un reflex, regarder dans le viseur optique peut faire fondre votre rétine en premier. Retirez le filtre uniquement entre C2 et C3 d\'une éclipse TOTALE, et remplacez-le avant C3.',
        },
        exposureTable('fr'),
        {
          kind: 'p',
          text: 'Le tableau est un point de départ, pas un dogme : la couronne a une énorme plage dynamique et aucune exposition ne la capture. Utilisez un bracketing manuel rapide – la même ouverture, avec des vitesses d\'obturation de 1/2000 s à 1 s – et combinez ensuite les images. Programmez et répétez tout avant le jour de l’éclipse.',
        },
        {
          kind: 'defs',
          items: [
            { term: 'Taille du Soleil dans le cadre', text: 'Le diamètre de l’image du Soleil en millimètres est approximativement égal à la distance focale divisée par 109. A 400 mm, le Soleil mesure 3,7 mm de diamètre : sur un capteur plein format (24 mm de hauteur), il occupe 15 % de la hauteur du cadre, laissant la couronne bien le remplir.' },
            { term: 'Distance focale maximale', text: 'Pour l\'ensemble du disque, utilisez au maximum environ 2500 mm en plein format ou 1700 mm en APS-C. Pour le corona avec salle de cadrage, utilisez environ 1000 mm en plein format ou 700 mm en APS-C.' },
            { term: 'Distance focale recommandée', text: 'Entre 200 et 500 mm donnent de l\'espace autour de la couronne et rendent le cadrage moins critique, ce qui est important lorsque vous ne disposez que d\'une ou deux minutes. Si vous transportez deux corps, quittez le deuxième enregistrement vidéo avec une vue grand angle fixe de la scène : il capture les visages et la lumière ambiante changeante, c\'est ce dont vous vous souviendrez.' },
            { term: 'Cadrage avec un soleil bas', text: 'En 2026 et 2028, un objectif de 24 à 70 mm montrant le petit Soleil éclipsé au-dessus d\'une silhouette de mer ou de montagne donne une meilleure image qu\'un téléobjectif. Cela supprime également le besoin d’un suivi précis.' },
            { term: 'Mise au point', text: 'Mise au point manuelle à l\'infini véritable, réglée au préalable à l\'aide du grossissement en direct sur le bord filtré du Soleil ou sur une étoile. Verrouillez-le avec du ruban adhésif. La mise au point automatique échouera pendant la totalité.' },
            { term: 'Trépied et déclencheur', text: 'Indispensable à partir de 200 mm. Utilisez un déclencheur à distance ou une minuterie de 2 s et désactivez la stabilisation lorsque l\'appareil photo est sur un trépied. Avec un soleil bas, surveillez le vent.' },
            { term: 'Téléphone', text: 'Un téléphone ne prendra pas une bonne photo de la couronne, mais il peut enregistrer une excellente vidéo de l’atmosphère et du crépuscule à 360°. Utilisez le mode manuel si disponible, verrouillez l\'exposition avant C2 et laissez-le enregistrer sans surveillance sur un petit trépied. Les phases partielles nécessitent également un filtre sur l\'objectif du téléphone.' },
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'La règle qui vous épargnera des regrets',
          text: 'S’il s’agit de votre première éclipse totale, ne prenez pas de photos – ou automatisez l’appareil photo et ne le regardez pas. En 2026, la totalité ne dure qu’une minute ou un peu plus – 1 min 50 s dans le meilleur endroit d’Espagne, 62 secondes à Valence – et en 2027, elle dure quatre minutes et demie dans le détroit. Vous ne le récupérerez jamais ; des millions de photographies corona sont meilleures que les vôtres. Regardez-le de vos propres yeux.',
        },
      ],
    },
    {
      id: 'checklist',
      title: 'Liste de contrôle et logistique',
      lead: 'Quoi apporter, comment s\'y rendre et pourquoi l\'application fonctionne sans couverture.',
      blocks: [
        {
          kind: 'list',
          items: [
            'Lunettes Eclipse conformes à la norme ISO 12312-2 — plus une paire de rechange, car quelqu\'un vous les demandera ou les vôtres se briseront.',
            'Un filtre solaire monté à l\'avant pour chaque instrument optique que vous prévoyez d\'utiliser, ainsi qu\'un ruban adhésif pour le fixer.',
            'Jumelles : la couronne et les protubérances apparaissent spectaculaires dans leur totalité.',
            'Une torche rouge ou une lampe frontale en mode rouge : très peu de choses sont visibles en totalité, et les lumières blanches dérangent tout le monde.',
            'Une batterie externe chargée et votre téléphone à 100%. Un réseau saturé et un GPS actif épuisent rapidement la batterie.',
            'De l\'eau et de la nourriture bien plus longtemps que prévu, ainsi qu\'une chaise pliante.',
            'Des vêtements chauds : la température chute brutalement en totalité, et l\'éclipse de 2028 a lieu en janvier au coucher du soleil.',
            'Un drap blanc étalé sur le sol pour visualiser les bandes d\'ombre.',
            'Insectifuge pour 2026, qui a lieu un soir d\'août, à la période de pointe des moustiques. L\'éclipse de 2027 a également lieu en août mais se produit le matin : la crème solaire et l\'ombre pendant l\'attente comptent davantage là-bas.',
            'Une boussole ou l\'application, pour savoir exactement où sera le Soleil depuis l\'emplacement choisi.',
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Réseau mobile : supposez qu\'il est mort',
          text: 'Des dizaines de milliers de personnes concentrées sur quelques kilomètres vont surcharger les mâts jusqu’à les rendre inutilisables. Vous ne pourrez pas rechercher des informations, envoyer des messages ou utiliser des cartes en ligne. Téléchargez des cartes hors ligne de la région avant de partir, convenez à l\'avance d\'un point de rendez-vous avec votre groupe et emportez des instructions écrites. Cette application est conçue pour fonctionner sans connexion précisément pour cette raison.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Trafic et foule',
          text: 'Le schéma est toujours le même : les gens arrivent toute la journée et tout le monde part en même temps dans les cinq minutes. Attendez-vous ensuite à des heures de files d\'attente. Faites le plein la veille, garez-vous face à la sortie et n\'oubliez pas qu\'un belvédère étroit avec une seule route d\'accès est un piège. De nombreuses municipalités restreindront l\'accès aux sites les plus connus, alors vérifiez au préalable.',
        },
        {
          kind: 'p',
          text: 'Météo : la décision finale appartient aux dernières 24 heures. Le mois d’août est statistiquement favorable à l’intérieur de l’Espagne et pire sur la côte cantabrique, où le brouillard nocturne est fréquent ; Janvier 2028 est le plus risqué des trois. Préparez deux ou trois sites alternatifs sur le chemin et bien séparés les uns des autres, puis vérifiez les modèles haute résolution et les images satellite le matin même. Être prêt à parcourir cent kilomètres dans la journée est ce qui différencie le fait de le voir du manque.',
        },
        {
          kind: 'callout',
          tone: 'good',
          title: 'Et si un nuage le recouvre après tout',
          text: 'Vous le ressentirez encore : l\'obscurité soudaine, la baisse de température, le silence des animaux et le crépuscule à l\'horizon se produisent de toute façon. Ne continuez pas à regarder le nuage ; regarde autour de toi.',
        },
      ],
    },
  ];
}
/* ------------------------------------------------------------- accessors */

const GUIDES: Record<Locale, () => GuideSection[]> = { ca: guideCa, es: guideEs, en: guideEn, fr: guideFr };

/**
 * Guia completa en l'idioma demanat, ja filtrada per l'eclipsi actiu.
 *
 * El filtre és per `onlyFor`: una secció amb `onlyFor` només apareix per als
 * eclipsis llistats. `criticalFor` no filtra, només marca (la vista l'obre i
 * la destaca), perquè amagar contingut de seguretat seria pitjor que sobrar.
 */
export function getGuide(
  locale: Locale,
  eclipseId?: string,
  context?: { sunAltitudeDeg?: number | null },
): GuideSection[] {
  const altitude = context?.sunAltitudeDeg;
  return GUIDES[locale]().filter(
    (section) => {
      if (section.onlyFor && !(eclipseId !== undefined && section.onlyFor.includes(eclipseId))) {
        return false;
      }
      if (section.id !== 'lowsun') return true;

      if (typeof altitude === 'number' && Number.isFinite(altitude)) return altitude <= 15;

      // Mentre encara no hi ha un punt calculat, el catàleg evita un flaix de
      // contingut incorrecte. Tan bon punt hi ha geometria local, mana ella.
      return eclipseId !== undefined && section.criticalFor?.includes(eclipseId) === true;
    },
  ).map((section) => {
    if (
      section.id !== 'lowsun' ||
      typeof altitude !== 'number' ||
      !Number.isFinite(altitude)
    ) {
      return section;
    }

    const degrees = new Intl.NumberFormat(
      locale === 'es' ? 'es-ES' : locale === 'en' ? 'en-GB' : locale === 'fr' ? 'fr-FR' : 'ca-ES', {
      maximumFractionDigits: 1,
      },
    ).format(altitude);
    const below = altitude < 0;
    const first = section.blocks[0];
    const dynamicIntro: ParagraphBlock = {
      kind: 'p',
      text:
        locale === 'fr'
          ? below
            ? `À votre emplacement, le Soleil sera déjà à ${degrees.replace('-', '')}° sous l’horizon au maximum de l’éclipse. La phase centrale ne sera pas visible, même si la trajectoire de l’éclipse traverse géométriquement ce point.`
            : `À votre emplacement, le Soleil ne sera qu’à ${degrees}° au-dessus de l’horizon au maximum de l’éclipse. Cette altitude provient du calcul et varie selon le lieu : il vous faut un horizon réellement dégagé dans la direction du Soleil.`
          : locale === 'en'
          ? below
            ? `At your location, the Sun will already be ${degrees.replace('-', '')}° below the horizon at maximum eclipse. The central phase will not be visible even though the eclipse path geometrically crosses this point.`
            : `At your location, the Sun will be only ${degrees}° above the horizon at maximum eclipse. This altitude comes from the eclipse calculation and changes with location: you need a genuinely clear horizon in the Sun’s direction.`
          : locale === 'es'
          ? below
            ? `En tu ubicación, el Sol ya estará ${degrees.replace('-', '')}° bajo el horizonte en el máximo. La fase central no será visible aunque el eclipse pase geométricamente por este punto.`
            : `En tu ubicación, el Sol estará a solo ${degrees}° en el máximo. Esta altura sale del cálculo del eclipse y cambia al cambiar de lugar: necesitas un horizonte realmente libre en la dirección del Sol.`
          : below
            ? `Al teu punt, el Sol ja serà ${degrees.replace('-', '')}° sota l’horitzó al màxim. La fase central no serà visible encara que l’eclipsi passi geomètricament per aquest punt.`
            : `Al teu punt, el Sol serà a només ${degrees}° al màxim. Aquesta altura surt del càlcul de l’eclipsi i canvia quan canvies de lloc: necessites un horitzó realment lliure en la direcció del Sol.`,
    };
    return {
      ...section,
      lead:
        locale === 'fr'
          ? `Avertissement calculé pour votre emplacement : Soleil à ${degrees}° au maximum de l’éclipse.`
          : locale === 'en'
          ? `Calculated warning for your location: Sun at ${degrees}° at maximum eclipse.`
          : locale === 'es'
          ? `Aviso calculado para tu ubicación: Sol a ${degrees}° en el máximo.`
          : `Avís calculat per al teu punt: Sol a ${degrees}° al màxim.`,
      blocks: first?.kind === 'p' ? [dynamicIntro, ...section.blocks.slice(1)] : section.blocks,
    };
  });
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
    en: {
      tone: 'warn',
      title: 'Total, at sunset, with the Sun very low',
      text: 'During totality, and only then, you may remove the filter. But the Sun will stand between 12° and less than 2° above the horizon: your chosen location, and whatever lies to the west, determines whether you see it at all. Read the Low Sun section before deciding where to go.',
    },
    fr: {
      tone: 'warn',
      title: 'Totale, au coucher du Soleil, avec le Soleil très bas',
      text: 'Pendant la totalité, et seulement à ce moment-là, vous pouvez retirer le filtre. Mais le Soleil sera entre 12° et moins de 2° au-dessus de l’horizon : le lieu choisi et ce qui se trouve à l’ouest détermineront si vous la verrez. Lisez la section Soleil bas avant de choisir votre emplacement.',
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
    en: {
      tone: 'good',
      title: 'Total, in the morning, with the Sun high: the easiest of the three',
      text: 'No horizon problems, and the longest totality: no other eclipse visible from land will surpass it until 2114 (about four and a half minutes from the Strait). During totality, and only between C2 and C3, remove the filter and look at the corona. Put it back on at the first point of sunlight.',
    },
    fr: {
      tone: 'good',
      title: 'Totale, le matin, avec le Soleil haut : la plus facile des trois',
      text: 'Aucun problème d’horizon, et la totalité la plus longue : aucune autre éclipse visible depuis la terre ferme ne la dépassera avant 2114 (environ quatre minutes et demie depuis le détroit). Pendant la totalité, et seulement entre C2 et C3, retirez le filtre et regardez la couronne. Remettez-le dès le premier point de lumière solaire.',
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
    en: {
      tone: 'bad',
      title: 'ANNULAR: never remove the filter',
      text: 'This eclipse is NOT total. A ring of sunlight remains visible throughout and burns just like the full Sun. Unlike 2026 and 2027, there is not a single second when it is safe to look without a certified filter — not even during annularity. The Sun will also range from about 8° in the south-west of the path to the horizon in the north-east: in Barcelona it sets during annularity itself, and in Girona and Mahón it has already set before annularity begins. Here, a clear horizon is not advice; it is the condition for seeing the eclipse.',
    },
    fr: {
      tone: 'bad',
      title: 'ANNULAIRE : ne retirez jamais le filtre',
      text: 'Cette éclipse n’est PAS totale. Un anneau de Soleil reste visible et brûle comme le Soleil entier. Contrairement à 2026 et 2027, il n’existe pas une seule seconde où l’observation sans filtre certifié soit sûre — pas même pendant l’annularité. Le Soleil sera aussi à environ 8° au sud-ouest de la trajectoire et au ras de l’horizon au nord-est : à Barcelone, il se couche pendant l’annularité, et à Gérone et Mahón il sera déjà couché avant son début. Ici, un horizon dégagé n’est pas un conseil : c’est la condition pour voir l’éclipse.',
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
