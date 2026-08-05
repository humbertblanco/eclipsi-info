/**
 * El vocabulari: tot el que aquesta app pot dir de si mateixa, i res més.
 *
 * ── PER QUÈ EXISTEIX ────────────────────────────────────────────────────────
 *
 * L'app té Google Analytics des del primer dia i no li hem preguntat mai res:
 * sabem quines pantalles es miren i res del que s'hi fa. I aquest projecte ja
 * s'ha equivocat exactament per aquí, més d'un cop i sempre en la mateixa
 * direcció — construir una cosa cara i no saber que ningú no hi arriba.
 * `SpotSearchPanel` (l'embut sencer de `core/spots`: 6,1 s de càlcul i 7,5 MB
 * de xarxa a Sòria), `AlignPanel` (1.400 línies provades), `UpdatePrompt` i
 * `ConnectionBadge` estaven acabats, provats i NO ELS MUNTAVA NINGÚ. Ho vam
 * descobrir llegint el codi. La comporta de seguretat ocular ha estat codi mort
 * dues vegades. Un producte que no es mesura es descobreix a si mateix per
 * casualitat, i la casualitat no arriba sempre.
 *
 * ── LA REGLA QUE HO GOVERNA TOT: NOMÉS PARAULES ─────────────────────────────
 *
 * Un paràmetre d'analítica d'aquesta app només pot ser UNA PARAULA D'UNA LLISTA
 * TANCADA. No hi ha manera de declarar «text lliure» i no hi ha manera de
 * declarar «un número». No és estilisme:
 *
 *   · una latitud és un NÚMERO, i si els números no viatgen, no pot viatjar
 *     cap latitud per accident;
 *   · un topònim és TEXT LLIURE, i si el text lliure no viatja, no pot viatjar
 *     «Peníscola» perquè algú va voler saber quins llocs es busquen.
 *
 * El que és una xifra es converteix en paraula ABANS d'arribar aquí, amb les
 * funcions de `buckets.ts`, que són les úniques que saben on són els llindars.
 * Qui té 97 segons de totalitat no envia 97: envia `one_to_two_min`, que és
 * una franja de milers de quilòmetres quadrats i no identifica cap punt.
 *
 * ── COM S'AFEGEIX UN ESDEVENIMENT (llegeix-ho, són trenta segons) ───────────
 *
 * S'afegeix una entrada A AQUESTA TAULA i prou: d'aquí en surten alhora el
 * tipus que valida les crides en compilació i la llista que la porta de
 * `sanitize.ts` fa complir en execució. No hi ha cap segona llista per
 * mantenir, perquè dues llistes escrites a mà divergeixen sempre — l'app ja té
 * la seva cicatriu d'això (`MAP_SEGMENT_BY_VIEW` a `App.tsx` es gira amb codi
 * justament per no tenir-ne dues).
 *
 * I ABANS D'AFEGIR-NE UN, LA PREGUNTA: quina decisió canviaria segons el que
 * digui? Si no en canvia cap, no s'afegeix. Cada entrada d'aquí sota porta
 * escrita la seva, i si un dia una deixa de ser certa, l'esdeveniment se'n va.
 */

/**
 * Els valors possibles d'un paràmetre.
 *
 * És una tupla NO BUIDA a posta: `[]` seria un paràmetre que no pot prendre
 * cap valor, o sigui un esdeveniment que la porta rebutjaria sempre i en
 * silenci. Val més que no compili.
 */
type ParamValues = readonly [string, ...string[]];

/** Els paràmetres d'un esdeveniment. Un esdeveniment sense cap (`{}`) val. */
type EventVocabulary = Readonly<Record<string, ParamValues>>;

type VocabularyTable = Readonly<Record<string, EventVocabulary>>;

/**
 * L'ESCALA D'ESPERES, compartida per tot el que fa esperar.
 *
 * Una sola escala i no una per esdeveniment, perquè la gràcia és poder comparar:
 * «el mapa de calor fa esperar com el cercador de llocs» és una frase que
 * decideix per on començar, i amb dues escales diferents no es pot dir.
 *
 * Les franges porten els límits al nom a posta. `slow` és un judici i canvia de
 * significat segons qui el llegeixi; `five_to_fifteen_s` és una mesura i no
 * canvia mai. Els llindars els aplica `waitBucket()` a `buckets.ts`, que és
 * l'únic lloc on viuen els números.
 */
const WAIT = [
  'under_one_s',
  'one_to_five_s',
  'five_to_fifteen_s',
  'over_fifteen_s',
  /* Quan no s'ha pogut mesurar. Hi és perquè la regla d'honestedat val també
     per a les dades internes: una espera desconeguda que s'apunta com a
     «menys d'un segon» infla la columna que decideix si això va prou de pressa. */
  'unknown',
] as const;

/**
 * L'ESCALA DE DURADES de la fase central.
 *
 * Prou gruixuda perquè cap franja no assenyali un lloc, i prou fina perquè
 * digui el que decideix: si vas a veure una totalitat de debò, una de curta o
 * cap. Els llindars, a `durationBucket()`.
 */
const DURATION = ['none', 'under_one_min', 'one_to_two_min', 'over_two_min'] as const;

/**
 * LA TAULA. Font única de la veritat: tipus i porta en surten tots dos.
 */
export const VOCABULARY = {
  /* ── EL MAPA ───────────────────────────────────────────────────────────── */

  /**
   * S'ha obert una vista de la fitxa del mapa.
   *
   * DECISIÓ QUE AJUDA A PRENDRE: el commutador té cinc opcions i dues
   * (`spots`, `align`) arrosseguen el seu propi tros mandrós i el seu Worker.
   * Si «Enquadra» l'obre el 0,4 % de les sessions, deixa de ser la cinquena
   * pestanyeta i passa a ser un enllaç des de dins de «Llocs»; si «Núvols»
   * guanya «Franja», canvia la vista per defecte del mapa.
   *
   * `via` separa un problema de DESCOBRIMENT d'un problema de DEMANDA, que es
   * curen al revés: si la gent hi arriba per enllaç i mai pel commutador, el
   * commutador no es veu; si no hi arriba de cap manera, la vista no interessa.
   */
  map_view_open: {
    view: ['band', 'clouds', 'move', 'spots', 'align'],
    /** `switch` el commutador, `tab` entrar al mapa, `link` una adreça
        (#/mapa/llocs o l'enrere del navegador), `cta` un botó d'una altra
        pantalla. */
    via: ['switch', 'tab', 'link', 'cta'],
  },

  /**
   * S'ha encès o apagat una capa del mapa.
   *
   * DECISIÓ QUE AJUDA A PRENDRE: la que va originar tot aquest encàrrec. El
   * relleu ve encès a l'escriptori i apagat al mòbil (`MapScreen`), i el
   * defecte és una hipòtesi que ningú ha comprovat mai: si al mòbil l'encenen i
   * no l'apaguen mai, el defecte s'inverteix. I una capa que s'encén i s'apaga
   * dins de la mateixa sessió més sovint que no pas es queda encesa està
   * costant més del que dona — que és exactament la pregunta oberta del mapa de
   * calor, que es paga en megabytes.
   *
   * Les capes que encara no existeixen ja hi són declarades a posta: són les
   * que hi ha en marxa (mapa de calor, nuvolositat, punts oficials, miradors) i
   * així qui les acabi no ha de tocar aquest fitxer amb pressa.
   */
  map_layer_toggle: {
    layer: ['path', 'hillshade', 'cone', 'heat', 'clouds', 'official', 'viewpoints'],
    state: ['on', 'off'],
  },

  /**
   * S'ha pintat una passada del mapa de calor de visibilitat.
   *
   * DECISIÓ QUE AJUDA A PRENDRE: si el mapa de calor val el que costa. Dues
   * meitats de la mateixa pregunta:
   *
   *   · `source` diu si la memòria cau (`core/heat/cache.ts`) fa la feina que
   *     promet la seva capçalera — «la zona que vas mirar a casa es repinta
   *     sencera» és una promesa de producte i aquesta és l'ÚNICA manera de
   *     saber si es compleix al camp. Si al camp tot és `computed`, la promesa
   *     és falsa i el codi de la memòria cau és decoració cara.
   *   · `wait` diu si la gent s'hi espera. Una passada són ~3 s de càlcul i uns
   *     quants megabytes; si la meitat de les passades passen de quinze segons,
   *     el que s'ha de tocar és la resolució de la graella, no la interfície.
   *
   * No hi ha ni marc ni zoom ni nombre de cel·les: el marc del mapa és, de fet,
   * una ubicació.
   */
  heat_render: {
    source: ['cache', 'computed', 'mixed'],
    wait: WAIT,
  },

  /**
   * S'ha acabat (o s'ha aturat) una cerca de llocs millors a prop.
   *
   * DECISIÓ QUE AJUDA A PRENDRE: els paràmetres de l'embut. La cerca val 6,1 s
   * i 7,5 MB a Sòria i 14,5 s i 12,5 MB a Barcelona (números mesurats de
   * `core/spots/search.ts`). Si `cancelled` és habitual, el radi de 25 km i el
   * pas de 2 km són massa i s'han d'encongir; si el que domina és `empty`, el
   * garbell és massa estricte i descarta candidats bons. Totes dues coses són
   * canvis de paràmetre, no opinions.
   */
  spot_search_run: {
    outcome: ['ok', 'empty', 'cancelled', 'error', 'offline'],
    wait: WAIT,
  },

  /**
   * S'ha triat un dels llocs proposats.
   *
   * DECISIÓ QUE AJUDA A PRENDRE: si l'ordenació serveix. Si la gent tria
   * sistemàticament el quart resultat, el que està malament és com puntuem, no
   * la llista. El rang va en franges perquè el número exacte, amb prou
   * resultats, comença a assenyalar quin lloc era.
   */
  spot_pick: {
    rank: ['first', 'top_three', 'rest'],
  },

  /* ── L'APP ─────────────────────────────────────────────────────────────── */

  /**
   * L'usuari ha dit (o ha canviat) on serà.
   *
   * DECISIÓ QUE AJUDA A PRENDRE: on va la feina de la porta d'entrada. L'app té
   * quatre maneres i mitja de dir on seràs i no sabem quina fa servir ningú.
   * `had_point: no` és la PRIMERA vegada (l'embut d'entrada, el que decideix si
   * `LocationGate` funciona); `had_point: yes` és tornar-hi, que és el
   * comportament de comparar llocs. Si `shared_link` pesa, l'experiència de qui
   * REP un enllaç mereix la targeta per punt que ESTAT.md va deixant per a més
   * endavant; si les sessions es queden a `example` (el punt de mostra), la
   * pantalla d'introducció no està convencent ningú.
   *
   * EL MÈTODE NO ÉS EL LLOC: `gps` diu com s'ha sabut, mai on.
   */
  point_set: {
    method: ['map_tap', 'gps', 'search', 'spot', 'align', 'shared_link', 'example'],
    had_point: ['yes', 'no'],
  },

  /**
   * S'ha ensenyat un veredicte sencer (amb el perfil del terreny ja calculat).
   *
   * DECISIÓ QUE AJUDA A PRENDRE: quant de protagonisme mereix el relleu, que és
   * l'única cosa que fa aquesta app i no en fa cap altra. `terrain: trimmed` o
   * `blocked` vol dir que el terreny ROBA segons de debò en aquell punt: si
   * passa al 2 % de les sessions, la crida «busca un lloc millor a prop» està
   * sobredimensionada; si passa al 30 %, ha de ser el titular de la portada i
   * no un botó de sota.
   *
   * LA DURADA VA EN FRANGES i mai en segons. Amb l'eclipsi triat, una durada
   * exacta és una corba sobre el mapa; una franja de «entre un i dos minuts»
   * són desenes de milers de quilòmetres quadrats.
   */
  verdict_shown: {
    kind: ['total', 'annular', 'partial', 'none'],
    duration: DURATION,
    /** `clear` el terreny no roba res, `trimmed` en roba, `blocked` s'ho
        menja tot, `unknown` encara no hi ha perfil. */
    terrain: ['clear', 'trimmed', 'blocked', 'unknown'],
  },

  /**
   * S'ha completat un gest de compartir, i per quin esglaó ha sortit.
   *
   * DECISIÓ QUE AJUDA A PRENDRE: si val la pena renderitzar la targeta. La
   * targeta és una simulació del cel del màxim de 1200×630 que es dibuixa a
   * cada compartida; l'escala d'esglaons de `ShareButton` és una hipòtesi sobre
   * què admeten els aparells de debò. Si el que passa al camp és
   * `clipboard_link` i `native_link` —o sigui, els esglaons on la targeta NO
   * viatja—, l'esforç ha d'anar a la targeta estàtica d'`og:image` i no a
   * dibuixar una imatge que ningú no rep.
   *
   * NO HI HA `share_start`: cancel·lar no és fallar (ho diu la capçalera de
   * `ShareButton`) i el parell començar/acabar no canviaria cap decisió que
   * aquest esdeveniment sol no canviï.
   */
  share_done: {
    surface: ['home', 'map', 'spot'],
    channel: [
      'native_files',
      'native_link',
      'clipboard_both',
      'clipboard_link',
      'download',
    ],
  },

  /**
   * S'ha acabat una preparació per anar sense cobertura.
   *
   * DECISIÓ QUE AJUDA A PRENDRE: si la promesa offline —que és l'assegurança
   * del producte i una part gens petita de la complexitat d'aquesta app— la fa
   * servir algú, i si el pressupost de tessel·les cap en un mòbil real. Si
   * `partial` domina, el que s'ha d'encongir és el pla, no la interfície.
   */
  offline_ready: {
    outcome: ['ok', 'partial', 'failed'],
  },

  /**
   * S'ha tancat una sessió de càmera, i amb quina àncora ha arribat a treballar.
   *
   * DECISIÓ QUE AJUDA A PRENDRE: si l'ancoratge al terreny s'enganxa al camp.
   * És la funció diferencial de l'app (ESTAT.md §6, tres capes de fusió) i no
   * en tenim CAP evidència fora del banc sintètic. Si `anchor: none` domina,
   * aquelles capes no s'arriben a activar en aparells de debò i el mes que ve
   * va a fer-les arrencar, no a afegir res. `ended: track_lost` mesura el camí
   * que es va endurir el 2-8 (la càmera que se't pren el sistema).
   */
  camera_session: {
    /**
     * Amb què ha arribat a ancorar EN TOTA LA SESSIÓ, no a l'últim fotograma:
     * el gest normal d'acabar és abaixar el braç, i llegir l'àncora vigent al
     * tancament diria «cap» de gairebé totes. Ho acumula
     * `features/ar/sessionAnchor.ts`, que és on viu també la precedència.
     *
     * `moon` NO ES POT PLEGAR DINS DE `sun`. Els assajos de nit (§6 d'ESTAT.md:
     * «de nit, la Lluna») són l'única estona en què l'àncora d'astre s'exercita
     * abans del dia de l'eclipsi, i comptar-los com a Sol faria que la columna
     * afirmés que el camí solar funciona a ple dia quan no s'hi haurà provat
     * mai. És el mateix codi amb condicions de llum oposades: una taca de Lluna
     * sobre cel negre és el cas fàcil. `both` sí que els barreja, i és a posta
     * — allà la pregunta és si les dues capes arriben a fusionar-se, i quin
     * astre hi entra no canvia la resposta.
     */
    anchor: ['sun', 'moon', 'terrain', 'both', 'none'],
    ended: ['closed', 'track_lost', 'error'],
  },

  /**
   * El perfil d'horitzó no s'ha pogut calcular.
   *
   * DECISIÓ QUE AJUDA A PRENDRE: on posar la xarxa de seguretat. Sense perfil,
   * l'app ensenya la xifra teòrica i ho diu — o sigui que la seva promesa
   * central queda a mitges. Saber si el que falla són les tessel·les, la xarxa
   * o el Worker decideix entre muntar un mirall de tessel·les, canviar la
   * política de reintents o encongir el pressupost. Ara mateix ho endevinem.
   *
   * AVUI NOMÉS SE'N PRODUEIXEN DOS: `useHorizon` distingeix `compute` (el
   * càlcul ha llançat) de `worker` (el Worker ha petat sencer), i res més —
   * els errors de l'horitzó encara viatgen com a prosa catalana dins de
   * `detail`, que és un dels punts oberts d'ESTAT.md. Els altres tres estan
   * declarats perquè el dia que aquella prosa es converteixi en codis, la
   * columna del panell no s'hagi de partir en dues sèries incomparables.
   */
  /*
   * ELS MOTIUS SÓN ELS DEL NUCLI, no una llista paral·lela.
   *
   * Aquí hi havia sis motius inventats (`compute`, `network`, `timeout`…) que
   * no corresponien a cap codi real: `HorizonErrorCode` de
   * `core/horizon/errors.ts` només en té quatre, i el hook n'hi afegeix un
   * cinquè (`worker`). Una llista que no casa amb la font vol dir un informe
   * amb columnes sempre buides i el motiu de debò sense columna. Es
   * tradueixen amb `horizonReason` perquè el guionet de `tiles-incomplete` no
   * passa la porta de privadesa, que a posta només accepta lletres, xifres i
   * guions baixos.
   *
   * `cancelled` NO hi és: cancel·lar no és fallar, i qui cancel·la ja no vol
   * el resultat. El camí que emet això el filtra abans.
   */
  horizon_failed: {
    reason: ['tiles_incomplete', 'no_terrain', 'worker', 'unknown'],
  },
} as const satisfies VocabularyTable;

export type Vocabulary = typeof VOCABULARY;

/** Els noms que existeixen. Qualsevol altre no és un esdeveniment d'aquesta app. */
export type AnalyticsEventName = keyof Vocabulary & string;

type ValueOf<T> = T extends readonly (infer V)[] ? V : never;

/**
 * Els paràmetres exactes d'un esdeveniment, amb els seus valors literals.
 *
 * Això és el que fa que `track('map_layer_toggle', { layer: 'hillshade', state: 'maybe' })`
 * no compili, i que oblidar-se de `state` tampoc: tots els paràmetres
 * declarats són obligatoris (vegeu el perquè a `sanitize.ts`).
 */
export type AnalyticsParams<K extends AnalyticsEventName> = {
  readonly [P in keyof Vocabulary[K]]: ValueOf<Vocabulary[K][P]>;
};

/**
 * Cert si el nom és un dels declarats.
 *
 * `hasOwnProperty` i no `in`: `'toString' in VOCABULARY` és cert i seria un
 * esdeveniment inventat que passa la porta per la cadena de prototipus.
 */
export function isAnalyticsEventName(name: string): name is AnalyticsEventName {
  return Object.prototype.hasOwnProperty.call(VOCABULARY, name);
}

/** Els paràmetres declarats d'un esdeveniment, per a la porta. */
export function declaredParams(
  name: AnalyticsEventName,
): Readonly<Record<string, readonly string[]>> {
  return VOCABULARY[name];
}
