/**
 * Captures de premsa i de xarxes, fetes pel navegador de veritat.
 *
 * PER QUÈ EXISTEIX AQUEST FITXER I NO UNA TECLA D'IMPRIMIR PANTALLA. El material
 * per compartir s'ha de poder REFER quan l'app canviï, i s'ha de poder refer
 * IGUAL: la mateixa mida, el mateix punt, el mateix moment. Una captura feta a
 * mà porta la mida de la finestra de qui la va fer, la barra d'adreces d'aquell
 * dia i el zoom que tingués posat. Aquest guió les fa totes des de zero, amb la
 * mida declarada aquí sota, i es pot tornar a córrer d'aquí a un mes sense que
 * ningú hagi de recordar res.
 *
 * PER QUÈ PER CDP I NO AMB LA CAPTURA DEL SISTEMA. Dues raons mesurades:
 *
 *   · La resolució. La captura de pantalla del sistema dona el que hi ha a la
 *     pantalla; nosaltres volem 390×844 a 3× (1170×2532 px, la mida exacta d'un
 *     iPhone) i 1440×900 a 2×. Amb `Emulation.setDeviceMetricsOverride` la
 *     mida i la densitat es DEMANEN, no es pateixen.
 *   · El PNG. Les captures del pont del navegador arriben en JPEG reescalat a
 *     ~1450 px d'ample. Per a una portada d'Instagram això és massa poc i es
 *     nota: el text mono de les xifres és el primer que es desfà.
 *
 * PER QUÈ CHROME AMB FINESTRA I NO `--headless`. El mapa és WebGL. En headless
 * cal SwiftShader i el relleu ombrejat i la franja poden sortir diferents del
 * que veu la gent — i la primera regla d'aquesta casa és que el que publiquem
 * s'assembli al producte. Amb finestra i perfil temporal, el que es captura és
 * exactament el que es veuria.
 *
 * PER QUÈ ESPERA UNA FRASE I NO UNS SEGONS. El punt d'aquesta app és la durada
 * amb el relleu descomptat, i el relleu es baixa per tessel·les: si es captura
 * abans d'hora, la portada diu «durada teòrica» i el material acaba ensenyant
 * justament el que l'app diu que NO s'ha de mirar. Per això cada presa espera
 * una condició escrita (`until`), no un temporitzador.
 *
 * ÚS:
 *   npx tsx scripts/press-shots.ts                     # totes les preses
 *   npx tsx scripts/press-shots.ts --only mapa         # les que duen «mapa»
 *   npx tsx scripts/press-shots.ts --probe             # taula de veredictes
 *   npx tsx scripts/press-shots.ts --base http://localhost:5173/
 *
 * La sortida per defecte va a ~/Desktop/eclipsi-premsa/captures/.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

/* ─── Els punts, i per què cadascun ──────────────────────────────────────────
 *
 * Les xifres del comentari surten del motor (`npx tsx scripts/smoke.ts` i el
 * càlcul per Catalunya del 3-8-2026), no de cap fullet. Si algun dia no
 * quadren, el que s'ha mogut és el motor i això s'ha de mirar.
 */
/*
 * TOTES LES COORDENADES SÓN LES DEL GEOCODIFICADOR, no les que jo em pensava.
 * Es van demanar a Photon el 3-8-2026 i les meves anaven fins a 3,4 km enfora
 * (Pratdip). En qualsevol altra app això seria una molèstia; aquí és la
 * diferència entre «1 min 25 s» i «res», perquè la resposta la decideix la
 * carena que tens al davant i no el municipi on ets empadronat.
 */
const PUNTS = {
  /** Total i reconeixible: 58 s amb el Sol a 4,4°. La captura d'obertura. */
  tarragona: { p: '41.11724,1.25461', n: 'Tarragona' },
  /** Plaça de Catalunya. Parcial: el terreny li tapa el Sol JUST al màxim. */
  barcelona: { p: '41.38740,2.16860', n: 'Barcelona' },
  /** Al caire: 20 s que el motor NO pot afirmar. L'honestedat, en pantalla. */
  lleida: { p: '41.61476,0.62678', n: 'Lleida' },
  /** El millor de la costa catalana: 1 min 33 s a peu de Delta. */
  amposta: { p: '40.70799,0.58276', n: 'Amposta' },
  /** Dins de la franja i sense veure res: el relleu se la menja sencera. */
  benifallet: { p: '40.97406,0.51728', n: 'Benifallet' },
  /** El mateix cas, però amb l'obstacle a 3,8 km: no s'arregla caminant. */
  cornudella: { p: '41.26566,0.90571', n: 'Cornudella de Montsant' },
} as const;

type PuntId = keyof typeof PUNTS;

/**
 * La frase que vol dir «ja he acabat de comptar el terreny».
 *
 * NO es pot esperar que desaparegui «Baixant el relleu»: quan les tessel·les
 * han arribat encara queda traçar l'horitzó («Traçant l'horitzó (71 %)»), i
 * entremig la pantalla ensenya la DURADA TEÒRICA. Una captura feta en aquell
 * forat ensenyaria la xifra que aquesta app existeix per corregir. La frase de
 * sota només surt amb el perfil fet, tant si el veredicte és total com parcial.
 */
const VEREDICTE = 'per damunt del terreny';

/**
 * El marcador que val a TOTES les pantalles amb xifra: el rètol mateix.
 *
 * Abans que el perfil del terreny estigui fet, la targeta diu «DURADA
 * TEÒRICA»; quan ja hi és, diu «DURADA VISIBLE». No cal endevinar cap frase
 * segons com acabi el veredicte, i és impossible capturar el forat del mig.
 * Aquest guió ja hi va caure una vegada: el primer pla de Benifallet va sortir
 * publicant «1 min 25 s» quan la resposta d'aquell punt és zero.
 */
const XIFRA_BONA = 'Durada visible';

/**
 * L'altra manera d'acabar: que el relleu s'ho hagi menjat tot.
 *
 * Quan el terreny tapa la totalitat sencera la frase de dalt NO surt —el text
 * passa a ser «El terreny tapa la totalitat sencera (1 min 25 s)»— i esperar
 * només la primera deixava la sonda encallada seixanta segons a cada punt
 * interessant. Que és, precisament, cada punt que val la pena ensenyar.
 */
const VEREDICTE_TAPAT = 'El terreny tapa';

/**
 * Punts a sondar, per trobar-ne un on el relleu es mengi segons de veritat.
 *
 * NO són punts de captura: són candidats. Amb el Sol a quatre graus, la
 * pregunta «quin poble perd la totalitat per una carena» té resposta i no la
 * sabem de memòria — s'ha de preguntar a l'app, que és qui té el model del
 * terreny. Tots són al peu d'una serra a ponent o al fons d'una vall.
 */
const CANDIDATS: { n: string; p: string }[] = [
  { n: 'Cornudella de Montsant', p: '41.26566,0.90571' },
  { n: 'la Morera de Montsant', p: '41.25927,0.82903' },
  { n: 'Falset', p: '41.14510,0.81962' },
  { n: 'Benifallet', p: '40.97406,0.51728' },
  { n: 'Arnes', p: '40.91102,0.26102' },
  { n: 'la Sénia', p: '40.63521,0.28108' },
  { n: 'Horta de Sant Joan', p: '40.95549,0.31540' },
  { n: 'Tivissa', p: '41.04165,0.73465' },
  { n: 'Pratdip', p: '41.05152,0.87160' },
  { n: 'Vandellòs', p: '41.02011,0.83174' },
  { n: 'Tortosa', p: '40.81102,0.52093' },
  { n: 'Alcanar', p: '40.54386,0.48084' },
];

interface Presa {
  /** Nom del fitxer, sense mida ni extensió. */
  nom: string;
  punt: PuntId;
  /** Fragment de ruta, tal com el llegeix l'app (`#/mapa/durada`). */
  hash?: string;
  /** Condició per començar a comptar: text que ha d'HAVER-HI a la pàgina. */
  until?: string;
  /**
   * Qualsevol d'aquests textos serveix.
   *
   * Existeix perquè el veredicte del terreny s'escriu de dues maneres segons
   * com acabi («…per damunt del terreny» / «El terreny tapa…»), i esperar-ne
   * només una encalla precisament als punts que volem ensenyar.
   */
  untilAny?: string[];
  /** Text que NO hi pot haver (per esperar que acabi una baixada). */
  untilGone?: string;
  /** Botons a prémer, pel seu nom accessible, abans de disparar. */
  clicks?: string[];
  /**
   * Text que ha d'aparèixer DESPRÉS dels clics.
   *
   * El cercador de llocs triga desenes de segons —escombra el voltant baixant
   * relleu— i esperar-lo amb un temporitzador vol dir publicar, tard o d'hora,
   * una llista a mig fer.
   */
  finsQue?: string;
  /** Compàs d'espera final, per a les animacions del mapa. */
  pausaMs?: number;
  /** Només mòbil o només escriptori, quan la presa no té sentit a l'altra. */
  nomes?: 'mobil' | 'escriptori';
  /** Passes de roda cap a la xinxeta del punt. Vegeu `zoomAlPunt`. */
  zoomPunt?: number;
}

const PRESES: Presa[] = [
  {
    /*
     * LA CAPTURA QUE VAL PER TOTES. Benifallet és DINS de la franja i la fitxa
     * hi diu «DURADA VISIBLE 0 s»: el marge sobre el terreny és −2,1° i la
     * totalitat sencera passa per sota de la carena de ponent. Una sola imatge
     * amb el distintiu, la xifra i el perquè, tot alhora.
     */
    nom: '00-hero-benifallet-zero',
    punt: 'benifallet',
    hash: '#/mapa',
    untilAny: ['DINS LA FRANJA'],
    until: XIFRA_BONA,
    pausaMs: 5000,
  },
  {
    nom: '00b-portada-benifallet-zero',
    punt: 'benifallet',
    until: VEREDICTE_TAPAT,
    pausaMs: 1500,
  },
  {
    nom: '00c-mapa-cornudella-zero',
    punt: 'cornudella',
    hash: '#/mapa',
    untilAny: ['DINS LA FRANJA'],
    until: XIFRA_BONA,
    pausaMs: 5000,
  },
  { nom: '01-portada-tarragona', punt: 'tarragona', until: VEREDICTE, pausaMs: 1200 },
  { nom: '02-portada-barcelona-99', punt: 'barcelona', until: VEREDICTE, pausaMs: 1200 },
  {
    nom: '03-portada-lleida',
    punt: 'lleida',
    untilAny: [VEREDICTE, VEREDICTE_TAPAT],
    pausaMs: 1200,
  },
  {
    // El «Just al caire» NO surt a la portada: viu al distintiu del mapa, que
    // és qui parla de la franja. Sense aquesta presa, la part més honesta del
    // producte es quedaria sense captura.
    nom: '03b-mapa-lleida-al-caire',
    punt: 'lleida',
    hash: '#/mapa',
    untilAny: ['Just al caire'],
    until: XIFRA_BONA,
    pausaMs: 5000,
  },
  {
    // LA CAPTURA QUE HO EXPLICA TOT EN UNA PANTALLA. Per a la plaça de
    // Catalunya la fitxa diu «marge sobre el terreny −0,2°» i «el terreny tapa
    // el Sol just al moment del màxim»: la diferència entre el 99,80 % de les
    // taules i el 98,8 % que s'hi veurà, amb el perquè al costat.
    /*
     * A MÒBIL AQUESTA FITXA VA CAPADA A 45dvh i la fila del marge queda sota el
     * plec: el fitxer prometia «marge negatiu» i la imatge no l'ensenyava. A
     * escriptori la fitxa és una columna sencera i s'hi veu. El primer pla del
     * marge, que és la xifra que importa, es fa a part (`giny-12`).
     */
    nom: '02b-mapa-barcelona-marge-negatiu',
    punt: 'barcelona',
    hash: '#/mapa',
    until: XIFRA_BONA,
    pausaMs: 5000,
    nomes: 'escriptori',
  },
  {
    nom: '04-mapa-franja',
    punt: 'tarragona',
    hash: '#/mapa',
    until: XIFRA_BONA,
    pausaMs: 5000,
  },
  {
    nom: '05-mapa-vista-durada',
    until: XIFRA_BONA,
    punt: 'tarragona',
    hash: '#/mapa/durada',
    pausaMs: 9000,
  },
  {
    nom: '06-mapa-nuvols',
    until: XIFRA_BONA,
    punt: 'tarragona',
    hash: '#/mapa/nuvols',
    pausaMs: 7000,
  },
  {
    // Des de Benifallet, que és qui més ho necessita: la llista de llocs
    // millors surt ordenada pels segons que hi guanyaries, i aquí es guanya
    // tot, perquè al punt de sortida no en queda cap.
    /*
     * LA CERCA S'HA DE PRÉMER. La pestanya «Llocs» arrenca en estat buit —un
     * botó i una explicació— perquè escombrar el voltant baixa relleu i és car:
     * no es fa sense que l'usuari ho demani. La primera tanda del dossier va
     * publicar aquell estat buit amb un peu que parlava d'una llista ordenada
     * per segons guanyats. El peu descrivia el que hauria de sortir, no el que
     * sortia.
     */
    nom: '07-mapa-llocs',
    punt: 'benifallet',
    hash: '#/mapa/llocs',
    clicks: ['Busca llocs'],
    finsQue: 'Escombrat',
    pausaMs: 30000,
  },
  {
    nom: '08-mapa-enquadra',
    until: XIFRA_BONA,
    punt: 'tarragona',
    hash: '#/mapa/enquadra',
    pausaMs: 6000,
  },
  {
    nom: '09-mapa-capes',
    until: XIFRA_BONA,
    punt: 'tarragona',
    hash: '#/mapa',
    clicks: ['Capes del mapa'],
    pausaMs: 4000,
  },
  {
    /*
     * EL RELLEU OMBREJAT, QUE ÉS LA CAPA QUE EXPLICA LA RESTA. La llum va
     * posada a l'azimut del Sol al màxim del punt i ancorada al MAPA: els
     * vessants foscos són els que aquella tarda estaran a contrallum. Amb el
     * mapa lluny no es veu res, i per això s'hi entra tres zooms.
     */
    nom: '14-mapa-relleu-ombrejat',
    punt: 'benifallet',
    hash: '#/mapa',
    until: XIFRA_BONA,
    untilAny: ['DINS LA FRANJA'],
    clicks: ['Capes del mapa', 'Relleu ombrejat', 'Capes del mapa'],
    zoomPunt: 5,
    pausaMs: 15000,
  },
  {
    /*
     * EL MAPA DE CALOR DE VERITAT, QUE NO ÉS LA PESTANYA «DURADA».
     *
     * Es va descobrir fent el dossier: la pestanya «Durada» respon «quant
     * guanyaries si et mous d'aquí», i el mapa de calor —quants segons
     * sobreviuen al relleu a cada casella— és una CAPA que s'encén al plafó
     * («Mapa de visibilitat») i que triga uns segons perquè baixa relleu. Un
     * peu de foto que digués «mapa de calor» damunt de la pestanya seria fals.
     */
    nom: '15-mapa-visibilitat',
    punt: 'tarragona',
    hash: '#/mapa/durada',
    until: XIFRA_BONA,
    clicks: ['Capes del mapa', 'Mapa de visibilitat', 'Capes del mapa'],
    zoomPunt: 2,
    pausaMs: 20000,
  },
  {
    // A escriptori no hi ha pestanya «Cel» al rail: el fragment cau a la
    // portada i la captura sortia amb el nom d'una pantalla que no era.
    nom: '10-cel',
    punt: 'tarragona',
    hash: '#/cel',
    pausaMs: 3500,
    nomes: 'mobil',
  },
  { nom: '11-guia', punt: 'tarragona', hash: '#/guia', pausaMs: 2500 },
  {
    nom: '12-com-funciona',
    punt: 'tarragona',
    hash: '#/com-funciona',
    pausaMs: 2500,
  },
  {
    nom: '13-tria-el-lloc',
    punt: 'tarragona',
    clicks: ['Tria el lloc'],
    pausaMs: 2000,
  },
];

/* ─── Les dues mides, i per què aquestes ─────────────────────────────────────
 *
 * 390×844 a 3× és un iPhone 14/15 clavat: 1170×2532 px. Instagram i les
 * històries volen 1080 d'ample i d'aquí en surten sense inventar-se cap píxel.
 * 1440×900 a 2× és el portàtil de tothom, i 2880 px d'ample aguanten qualsevol
 * retall per a X o LinkedIn.
 */
const MIDES = {
  mobil: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
  escriptori: {
    width: 1440,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false,
  },
} as const;

const CHROME =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;

/* ─── Primers plans dels ginys ───────────────────────────────────────────────
 *
 * PER QUÈ RETALLAR PER ELEMENT I NO AMB LES TISORES. Un retall fet a ull porta
 * mig píxel de la targeta del costat i un marge que canvia a cada peça. Aquí es
 * demana la caixa de l'element al navegador i s'hi afegeix un marge declarat:
 * totes les peces surten amb el mateix aire i, si demà la targeta canvia de
 * mida, el retall la segueix.
 *
 * ELS SELECTORS SÓN CLASSES DE COMPONENT, no de presentació. `.mapscreen__stats`
 * i `.home__phase` són els noms dels blocs; si algun dia desapareixen, aquest
 * guió peta i és correcte que peti, perquè voldrà dir que el giny que volíem
 * ensenyar ja no existeix.
 */
interface Retall {
  nom: string;
  punt: PuntId;
  hash?: string;
  until?: string;
  untilAny?: string[];
  selector: string;
  /** Marge en píxels de CSS al voltant de la caixa. */
  marge?: number;
  pausaMs?: number;
  mida?: 'mobil' | 'escriptori';
  /** Botons a prémer, pel nom accessible, abans de mesurar la caixa. */
  clicks?: string[];
  /** Passes de roda cap a la xinxeta del punt. Vegeu `zoomAlPunt`. */
  zoomPunt?: number;
}

const RETALLS: Retall[] = [
  {
    nom: 'giny-01-durada-visible-zero',
    punt: 'benifallet',
    hash: '#/mapa',
    until: XIFRA_BONA,
    selector: '.mapscreen__stats',
    marge: 46,
    pausaMs: 4000,
  },
  {
    nom: 'giny-02-marge-sobre-el-terreny',
    punt: 'benifallet',
    hash: '#/mapa',
    until: XIFRA_BONA,
    selector: '.mapscreen__pairs',
    marge: 40,
    pausaMs: 4000,
  },
  {
    nom: 'giny-03-fitxa-sencera-benifallet',
    punt: 'benifallet',
    hash: '#/mapa',
    until: XIFRA_BONA,
    selector: '.mapscreen__sheet',
    marge: 0,
    pausaMs: 4000,
  },
  {
    nom: 'giny-12-marge-barcelona',
    punt: 'barcelona',
    hash: '#/mapa',
    until: XIFRA_BONA,
    selector: '.mapscreen__pairs',
    marge: 26,
    pausaMs: 4000,
    mida: 'escriptori',
  },
  {
    nom: 'giny-04-badge-just-al-caire',
    punt: 'lleida',
    hash: '#/mapa',
    until: XIFRA_BONA,
    selector: '.mapscreen__badges',
    marge: 40,
    pausaMs: 4000,
  },
  {
    nom: 'giny-05-efemerides-benifallet',
    punt: 'benifallet',
    hash: '#/mapa',
    until: XIFRA_BONA,
    selector: '.mapscreen__ephemeris',
    marge: 40,
    pausaMs: 4000,
    // A mòbil la fitxa va capada a 45dvh i aquest bloc no s'hi pinta.
    mida: 'escriptori',
  },
  {
    // La miniatura del relleu: només el llenç del mapa, sense crom ni fitxa.
    nom: 'giny-11-relleu-ombrejat',
    punt: 'benifallet',
    hash: '#/mapa',
    until: XIFRA_BONA,
    clicks: ['Capes del mapa', 'Relleu ombrejat', 'Capes del mapa'],
    zoomPunt: 5,
    selector: '.maplibregl-canvas',
    marge: 0,
    pausaMs: 15000,
    mida: 'escriptori',
  },
  {
    nom: 'giny-06-durada-portada-tarragona',
    punt: 'tarragona',
    until: XIFRA_BONA,
    selector: '.home__phase',
    marge: 0,
    pausaMs: 1500,
  },
  {
    nom: 'giny-07-compte-enrere',
    punt: 'tarragona',
    until: XIFRA_BONA,
    selector: '.home__hero',
    marge: 0,
    pausaMs: 1500,
  },
  {
    nom: 'giny-08-comporta-seguretat',
    punt: 'barcelona',
    until: XIFRA_BONA,
    selector: '.countdown__filter',
    marge: 40,
    pausaMs: 1500,
  },
  {
    nom: 'giny-09-contactes-tarragona',
    punt: 'tarragona',
    until: XIFRA_BONA,
    selector: '.home__timelinecard',
    marge: 0,
    pausaMs: 1500,
  },
  {
    nom: 'giny-10-crida-camera',
    punt: 'tarragona',
    until: XIFRA_BONA,
    selector: '.home__cameracta',
    marge: 30,
    pausaMs: 1500,
  },
];

/* ─── Client CDP mínim ──────────────────────────────────────────────────────
 * Sense dependències: Node 22 ja porta `WebSocket` i `fetch` de sèrie, i tot
 * el que necessitem són quatre mètodes. Afegir Puppeteer aquí seria portar
 * 300 MB de node_modules per a una cosa que cap en cinquanta línies.
 */
class Cdp {
  private ws: WebSocket;
  private id = 0;
  private pending = new Map<
    number,
    { ok: (v: unknown) => void; ko: (e: Error) => void }
  >();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id === undefined) return;
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.ko(new Error(`${msg.error.message} (${msg.error.code})`));
      else p.ok(msg.result);
    });
  }

  static async attach(url: string): Promise<Cdp> {
    const ws = new WebSocket(url);
    await new Promise<void>((ok, ko) => {
      ws.addEventListener('open', () => ok(), { once: true });
      ws.addEventListener('error', () => ko(new Error('CDP no obre')), {
        once: true,
      });
    });
    return new Cdp(ws);
  }

  send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const id = ++this.id;
    return new Promise<T>((ok, ko) => {
      this.pending.set(id, { ok: ok as (v: unknown) => void, ko });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

const dorm = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Avalua una expressió a la pàgina i torna el valor. */
async function eval_<T>(cdp: Cdp, expression: string): Promise<T> {
  const r = await cdp.send<{ result: { value: T } }>('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return r.result.value;
}

/**
 * Espera fins que una condició de text es compleixi, amb sostre.
 *
 * El sostre no és decoració: si l'app es queda baixant relleu perquè la xarxa
 * va malament, val més una captura tardana i un avís que un guió penjat per
 * sempre sense dir res.
 */
async function espera(
  cond: () => Promise<boolean>,
  quePasses: string,
  sostreMs = 60_000,
) {
  const t0 = Date.now();
  for (;;) {
    if (await cond()) return true;
    if (Date.now() - t0 > sostreMs) {
      console.warn(`  ⚠ sostre esperant ${quePasses} (${sostreMs / 1000}s)`);
      return false;
    }
    await dorm(400);
  }
}

/**
 * Que la pàgina digui una frase, sense mirar prim amb les majúscules.
 *
 * El distintiu del mapa s'escriu «Just al caire» al codi i surt «JUST AL CAIRE»
 * a la pantalla, perquè les versaletes les posa el CSS i `innerText` les
 * reflecteix. Comparar tal qual feia esperar seixanta segons de bades
 * exactament a la presa que ensenya la part més honesta del producte.
 */
const teText = (cdp: Cdp, txt: string) =>
  eval_<boolean>(
    cdp,
    `document.body.innerText.toLowerCase().includes(${JSON.stringify(
      txt.toLowerCase(),
    )})`,
  );

/**
 * Prem un botó pel seu NOM ACCESSIBLE, no per una classe de CSS.
 *
 * Les classes canvien cada vegada que algú toca l'estil; el nom que llegeix un
 * lector de pantalla no, perquè si canvia és que ha canviat el producte. Si un
 * dia aquesta funció no troba el botó, el que s'ha trencat mereix mirar-se.
 */
async function clica(cdp: Cdp, nom: string): Promise<boolean> {
  return eval_<boolean>(
    cdp,
    `(() => {
      const txt = ${JSON.stringify(nom)};
      const cand = [...document.querySelectorAll('button,[role=tab],a,label')];
      const el = cand.find((e) => {
        const noms = [e.getAttribute('aria-label'), e.textContent]
          .filter(Boolean).map((t) => t.trim());
        return noms.some((t) => t === txt || t.startsWith(txt));
      });
      if (!el) return false;
      /*
       * LES CAPES SÓN INTERRUPTORS, I UN INTERRUPTOR NO ES «PREM»: es posa.
       *
       * El plafó de capes recorda la tria de l'usuari, o sigui que una capa
       * pot arribar encesa d'una tanda anterior. Prémer-la a cegues l'apagaria
       * i la captura sortiria justament sense la capa que la peça anuncia.
       * Per això aquí es demana l'estat i només es toca si cal encendre-la.
       */
      const casella = el.querySelector && el.querySelector('input[type=checkbox]');
      if (casella) {
        if (casella.checked) return true;
        el.click();
        return true;
      }
      el.click();
      return true;
    })()`,
  );
}

async function arrencaChrome(): Promise<{
  proc: ChildProcess;
  wsUrl: string;
  perfil: string;
}> {
  const perfil = join(tmpdir(), `eclipsi-press-${Date.now()}`);
  mkdirSync(perfil, { recursive: true });
  const proc = spawn(
    CHROME,
    [
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${perfil}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      '--disable-extensions',
      '--window-size=1500,1000',
      '--window-position=0,0',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  // El port triga a obrir. Es demana fins que respon, sense dormir a ulls
  // clucs un nombre de segons que un dia serà curt.
  let wsUrl = '';
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = (await r.json()) as { webSocketDebuggerUrl: string };
      wsUrl = j.webSocketDebuggerUrl;
      break;
    } catch {
      await dorm(250);
    }
  }
  if (!wsUrl) throw new Error('Chrome no ha obert el port de depuració');

  const r = await fetch(
    `http://127.0.0.1:${PORT}/json/new?about:blank`,
    { method: 'PUT' },
  );
  const target = (await r.json()) as { webSocketDebuggerUrl: string };
  return { proc, wsUrl: target.webSocketDebuggerUrl, perfil };
}

function urlDe(base: string, punt: PuntId, hash: string | undefined) {
  const { p, n } = PUNTS[punt];
  const q = `?p=${p}&e=2026-08-12&n=${encodeURIComponent(n)}`;
  return `${base.replace(/\/$/, '')}/${q}${hash ?? ''}`;
}

async function captura(
  cdp: Cdp,
  presa: Presa,
  mida: keyof typeof MIDES,
  base: string,
  outDir: string,
) {
  const m = MIDES[mida];
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: m.width,
    height: m.height,
    deviceScaleFactor: m.deviceScaleFactor,
    mobile: m.mobile,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: m.mobile });

  /*
   * L'ORDRE IMPORTA, I VA COSTAR UNA TANDA SENCERA. Primer s'obre la portada
   * SENSE fragment i s'espera que el terreny estigui comptat; només llavors es
   * canvia de vista. Fer-ho al revés —obrir directament `#/mapa/durada` i
   * esperar-hi el rètol— no funciona: aquella vista no ensenya la targeta de
   * la durada i l'espera s'esgotava, o pitjor, capturava la xifra teòrica.
   * El terreny es calcula un cop per punt i val per a totes les pestanyes.
   */
  await cdp.send('Page.navigate', { url: urlDe(base, presa.punt, undefined) });
  await espera(
    async () => (await eval_<string>(cdp, 'document.readyState')) === 'complete',
    'la càrrega',
    30_000,
  );

  if (presa.until) {
    await espera(() => teText(cdp, presa.until!), `«${presa.until}»`);
  }

  if (presa.hash) {
    await eval_(cdp, `location.hash = ${JSON.stringify(presa.hash)}`);
    await dorm(900);
  }

  // `untilAny` és la condició de la VISTA, i per això s'espera després del
  // fragment: «DINS LA FRANJA» i «Just al caire» només existeixen al mapa.
  if (presa.untilAny) {
    await espera(
      async () => {
        for (const t of presa.untilAny!) if (await teText(cdp, t)) return true;
        return false;
      },
      `«${presa.untilAny.join('» o «')}»`,
    );
  }
  if (presa.untilGone) {
    await espera(
      async () => !(await teText(cdp, presa.untilGone!)),
      `que marxi «${presa.untilGone}»`,
    );
  }
  for (const c of presa.clicks ?? []) {
    const ok = await clica(cdp, c);
    if (!ok) console.warn(`  ⚠ no s'ha trobat el botó «${c}»`);
    await dorm(1200);
  }
  if (presa.finsQue) {
    await espera(
      () => teText(cdp, presa.finsQue!),
      `«${presa.finsQue}» després dels clics`,
      120_000,
    );
  }
  if (presa.zoomPunt) await zoomAlPunt(cdp, presa.zoomPunt);
  if (presa.pausaMs) await dorm(presa.pausaMs);

  const shot = await cdp.send<{ data: string }>('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  const fitxer = join(outDir, mida, `${presa.nom}.png`);
  writeFileSync(fitxer, Buffer.from(shot.data, 'base64'));
  const kb = Math.round(Buffer.from(shot.data, 'base64').length / 1024);
  console.log(
    `  ✓ ${mida.padEnd(10)} ${presa.nom.padEnd(28)} ${m.width * m.deviceScaleFactor}×${m.height * m.deviceScaleFactor}  ${kb} kB`,
  );
}

/**
 * Acosta el mapa AL PUNT, no al centre de la pantalla.
 *
 * Els botons de zoom de MapLibre acosten cap al centre de la vista, i a la
 * vista de la franja el centre és enmig de la Península: tres zooms i el
 * relleu que sortia era el de Guadalajara, amb una peça que parlava de les
 * Terres de l'Ebre. La roda del ratolí, en canvi, acosta cap on hi ha el
 * cursor — i el cursor el posem damunt de la xinxeta.
 */
async function zoomAlPunt(cdp: Cdp, passes: number) {
  const p = await eval_<{ x: number; y: number } | null>(
    cdp,
    `(() => {
      const m = document.querySelector('.maplibregl-marker');
      if (m) {
        const b = m.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      }
      const c = document.querySelector('.maplibregl-canvas');
      if (!c) return null;
      const b = c.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    })()`,
  );
  if (p === null) {
    console.warn('  ⚠ no s’ha trobat ni la xinxeta ni el mapa');
    return;
  }
  for (let i = 0; i < passes; i++) {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: p.x,
      y: p.y,
      deltaX: 0,
      deltaY: -240,
      pointerType: 'mouse',
    });
    await dorm(900);
  }
  await dorm(1500);
}

/**
 * Un primer pla d'un giny, retallat per la caixa de l'element.
 *
 * El retall es demana a `Page.captureScreenshot` amb `clip`, i no es fa
 * després amb una eina d'imatge, per una raó pràctica: així el resultat surt
 * a la densitat del dispositiu emulat (3× a mòbil) i no d'una imatge ja
 * aplanada que caldria ampliar.
 */
async function retalla(
  cdp: Cdp,
  r: Retall,
  base: string,
  outDir: string,
): Promise<void> {
  const mida = r.mida ?? 'mobil';
  const m = MIDES[mida];
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: m.width,
    height: m.height,
    deviceScaleFactor: m.deviceScaleFactor,
    mobile: m.mobile,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: m.mobile });

  // Mateix ordre que a `captura`: el terreny primer, la vista després.
  await cdp.send('Page.navigate', { url: urlDe(base, r.punt, undefined) });
  await espera(
    async () => (await eval_<string>(cdp, 'document.readyState')) === 'complete',
    'la càrrega',
    30_000,
  );
  if (r.until) await espera(() => teText(cdp, r.until!), `«${r.until}»`);
  if (r.hash) {
    await eval_(cdp, `location.hash = ${JSON.stringify(r.hash)}`);
    await dorm(900);
  }
  if (r.untilAny) {
    await espera(
      async () => {
        for (const t of r.untilAny!) if (await teText(cdp, t)) return true;
        return false;
      },
      `«${r.untilAny.join('» o «')}»`,
    );
  }
  for (const c of r.clicks ?? []) {
    if (!(await clica(cdp, c)))
      console.warn(`  ⚠ ${r.nom}: no s'ha trobat el botó «${c}»`);
    await dorm(1400);
  }
  if (r.zoomPunt) await zoomAlPunt(cdp, r.zoomPunt);
  if (r.pausaMs) await dorm(r.pausaMs);

  /*
   * PRIMER ES DESPLAÇA, ES DEIXA ASSENTAR, I DESPRÉS ES MESURA.
   *
   * Fer-ho tot en una sola passada donava retalls tallats per dalt: el bàner
   * de lloc d'aquesta app es plega quan es desplaça la pàgina, i mentre es
   * plega tot el que hi ha a sota puja unes desenes de píxels. La caixa
   * mesurada abans d'aquell moviment ja no és on és l'element quan es dispara.
   */
  const trobat = await eval_<boolean>(
    cdp,
    `(() => {
      const el = document.querySelector(${JSON.stringify(r.selector)});
      if (!el) return false;
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      return true;
    })()`,
  );
  if (!trobat) {
    console.warn(`  ✗ ${r.nom}: no s'ha trobat «${r.selector}»`);
    return;
  }
  await dorm(1200);

  const caixa = await eval_<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(
    cdp,
    `(() => {
      const el = document.querySelector(${JSON.stringify(r.selector)});
      if (!el) return null;
      const b = el.getBoundingClientRect();
      /*
       * SUMAR EL DESPLAÇAMENT NO ÉS OPCIONAL. El retall de
       * \`Page.captureScreenshot\` va en coordenades del DOCUMENT, i
       * getBoundingClientRect les dona respecte de la finestra. Als ginys de
       * dalt de tot les dues coincidien i semblava que funcionava; el de la
       * comporta de seguretat, que viu més avall de la portada, sortia negre.
       */
      return {
        x: b.x + window.scrollX,
        y: b.y + window.scrollY,
        width: b.width,
        height: b.height,
      };
    })()`,
  );
  if (caixa === null || caixa.width < 2) {
    console.warn(`  ✗ ${r.nom}: la caixa de «${r.selector}» és buida`);
    return;
  }

  const marge = r.marge ?? 0;
  const shot = await cdp.send<{ data: string }>('Page.captureScreenshot', {
    format: 'png',
    // Amb el retall en coordenades de document, cal deixar-lo sortir de la
    // finestra: si no, un element que queda mig avall es talla per la meitat.
    captureBeyondViewport: true,
    clip: {
      x: Math.max(0, caixa.x - marge),
      y: Math.max(0, caixa.y - marge),
      width: caixa.width + marge * 2,
      height: caixa.height + marge * 2,
      scale: 1,
    },
  });
  const dades = Buffer.from(shot.data, 'base64');
  writeFileSync(join(outDir, 'ginys', `${r.nom}.png`), dades);
  console.log(
    `  ✓ ${r.nom.padEnd(34)} ${Math.round(caixa.width + marge * 2)}×${Math.round(
      caixa.height + marge * 2,
    )} css  ${Math.round(dades.length / 1024)} kB`,
  );
}

/**
 * Mode sonda: què diu l'app de cada punt, amb el relleu ja descomptat.
 *
 * Serveix per triar els punts de les captures amb la xifra a la mà, que és
 * l'única manera honesta de triar-los. Imprimeix el text que l'usuari llegiria.
 */
async function sonda(cdp: Cdp, base: string) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    ...MIDES.escriptori,
  });
  const llista = [
    ...(Object.keys(PUNTS) as PuntId[]).map((id) => ({
      n: PUNTS[id].n,
      p: PUNTS[id].p,
    })),
    ...CANDIDATS,
  ];
  for (const { n, p } of llista) {
    const url = `${base.replace(/\/$/, '')}/?p=${p}&e=2026-08-12&n=${encodeURIComponent(n)}`;
    await cdp.send('Page.navigate', { url });
    await espera(
      async () =>
        (await eval_<string>(cdp, 'document.readyState')) === 'complete',
      'la càrrega',
      30_000,
    );
    await espera(
      async () =>
        (await teText(cdp, VEREDICTE)) || (await teText(cdp, VEREDICTE_TAPAT)),
      'el veredicte del terreny',
    );
    await dorm(800);
    const diu = await eval_<string>(
      cdp,
      `(() => {
        const t = document.body.innerText;
        const l = t.split('\\n').map(s => s.trim()).filter(Boolean);
        const i = l.findIndex(s => /DURADA/i.test(s));
        return l.slice(Math.max(0, i), i + 8).join(' · ');
      })()`,
    );
    console.log(`${n.padEnd(24)} ${diu}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const base =
    args.find((a) => a.startsWith('--base='))?.slice(7) ??
    (args.includes('--base') ? args[args.indexOf('--base') + 1] : null) ??
    'https://eclipsi.info/';
  const only = args.includes('--only')
    ? args[args.indexOf('--only') + 1]
    : null;
  const outDir =
    args.find((a) => a.startsWith('--out='))?.slice(6) ??
    join(homedir(), 'Desktop', 'eclipsi-premsa', 'captures');

  mkdirSync(join(outDir, 'mobil'), { recursive: true });
  mkdirSync(join(outDir, 'escriptori'), { recursive: true });

  console.log(`Base: ${base}`);
  console.log(`Sortida: ${outDir}\n`);

  const { proc, wsUrl, perfil } = await arrencaChrome();
  const cdp = await Cdp.attach(wsUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  try {
    if (args.includes('--probe')) {
      await sonda(cdp, base);
      return;
    }
    if (args.includes('--retalls')) {
      mkdirSync(join(outDir, 'ginys'), { recursive: true });
      console.log('\n── primers plans ──');
      for (const r of RETALLS.filter((r) =>
        only ? r.nom.includes(only) : true,
      )) {
        try {
          await retalla(cdp, r, base, outDir);
        } catch (e) {
          console.error(`  ✗ ${r.nom}: ${(e as Error).message}`);
        }
      }
      return;
    }
    const llista = PRESES.filter((p) => (only ? p.nom.includes(only) : true));
    for (const mida of ['escriptori', 'mobil'] as const) {
      console.log(`\n── ${mida} ──`);
      for (const presa of llista) {
        if (presa.nomes && presa.nomes !== mida) continue;
        try {
          await captura(cdp, presa, mida, base, outDir);
        } catch (e) {
          console.error(`  ✗ ${presa.nom}: ${(e as Error).message}`);
        }
      }
    }
  } finally {
    cdp.close();
    proc.kill();
    await dorm(500);
    rmSync(perfil, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
