/**
 * Les peces per publicar: Instagram, X i LinkedIn, maquetades amb el sistema
 * de l'app i renderitzades pel mateix navegador que les farà servir.
 *
 * PER QUÈ ES MAQUETEN AMB HTML I NO A UN EDITOR DE DISSENY. Perquè els colors,
 * les tipografies i els espais ja existeixen i estan decidits: són els tokens
 * de `src/styles/tokens/`. Refer-los a mà en una altra eina vol dir tenir dues
 * fonts de veritat i que un dia el taronja del cartell no sigui el taronja de
 * l'app. Aquí els valors s'escriuen un sol cop, a `PALETA`, copiats d'allà.
 *
 * LA REGLA DE L'AMBRE, TAMBÉ AQUÍ. A l'app hi ha un sol accent ambre per
 * pantalla i és el de la xifra que decideix. En aquestes peces es respecta: la
 * xifra gran és l'única cosa ambre, i per això el logotip del peu va en
 * monocrom. L'única peça amb el logotip ambre és la de crida final, que no té
 * cap xifra que competeixi.
 *
 * PER QUÈ SERVEIX ELS FITXERS PER HTTP I NO ELS OBRE AMB `file://`. Chrome
 * tracta cada `file://` com un origen diferent i les tipografies no carreguen
 * sense afluixar la seguretat amb una bandera. Vint línies de servidor són més
 * barates que una bandera de seguretat en un guió que algú tornarà a córrer.
 *
 * ÚS:
 *   npx tsx scripts/press-creatives.ts
 *   npx tsx scripts/press-creatives.ts --only story
 *
 * Necessita les captures fetes: `npx tsx scripts/press-shots.ts` abans.
 */
import { createServer } from 'node:http';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { obreChrome, evalua, espera, dorm } from './lib/chrome.ts';

/* ─── La paleta, copiada de src/styles/tokens/colors.css ───────────────────── */
const P = {
  ink950: '#05060B',
  ink900: '#0A0C14',
  ink800: '#121623',
  ink700: '#1B2133',
  slate400: '#6E7A94',
  slate350: '#7D89A2',
  mist200: '#C9D1E2',
  corona050: '#FBF8F1',
  corona100: '#F5F0E4',
  sun500: '#FFA51F',
  sun400: '#FFC257',
  aurora500: '#2FD3A3',
  flare500: '#FF5A45',
};

/* ─── Les mides, i per què aquestes ─────────────────────────────────────────
 * 1080×1350 és el retrat 4:5 d'Instagram, el format que ocupa més pantalla al
 * mur sense que la plataforma el retalli. 1080×1920 són les històries. 1200×675
 * és la targeta 16:9 que X i LinkedIn ensenyen sense retallar a cap client.
 */
const MIDES = {
  feed: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
  card: { w: 1200, h: 675 },
  /* El quadrat, per als comptes que encara publiquen 1:1 i per a LinkedIn,
     on una imatge quadrada ocupa més alçada al mur que una de 16:9. */
  quadrat: { w: 1080, h: 1080 },
} as const;

type MidaId = keyof typeof MIDES;

interface Peca {
  nom: string;
  mida: MidaId;
  disseny:
    | 'xifra'
    | 'mobil'
    | 'taula'
    | 'crida'
    | 'ample'
    | 'duel'
    | 'cita'
    | 'hores'
    | 'giny';
  /**
   * Quin accent mana a la peça.
   *
   * El vermell d'aquesta casa vol dir seguretat ocular i no es gasta en res
   * més; per això és un valor tancat i no un color qualsevol. Cap peça pot
   * tenir-ne dos: la que porta vermell no porta ambre.
   */
  to?: 'ambre' | 'vermell';
  /** Sobretítol en versaletes. El context: on i quan. */
  kicker?: string;
  /** La xifra que decideix. L'única cosa ambre de la peça. */
  xifra?: string;
  /** El titular, en tipografia de títol. */
  titular?: string;
  /** La lletra petita: el perquè, o la condició. */
  nota?: string;
  /** Captura a incrustar, relativa a `captures/`. */
  imatge?: string;
  /** Quina part de la captura es veu, quan no hi cap sencera. */
  enquadra?: 'top' | 'center' | 'bottom';
  files?: { lloc: string; valor: string; destaca?: boolean }[];
  /** Per al duel: la xifra que diu la taula i la que veuràs de debò. */
  duel?: { abans: string; abansPeu: string; despres: string; despresPeu: string };
  /** Per a la cita: el text i qui el diu. */
  cita?: { text: string; qui: string };
}

/*
 * TOTES LES XIFRES D'AQUESTES PECES SURTEN DE L'APP PUBLICADA, demanades el
 * 3-8-2026 amb les coordenades que el geocodificador dona per a cada municipi.
 * Estan totes a `textos/dades-verificades.md` amb l'enllaç per reproduir-les.
 * Si en canvies una aquí, canvia-la allà: el dia que no quadrin, la que mentirà
 * serà la que es publica.
 */
const PECES: Peca[] = [
  /* ── Instagram, carrusel de mur ─────────────────────────────────────────── */
  {
    nom: 'ig-feed-01-zero',
    mida: 'feed',
    disseny: 'xifra',
    kicker: 'Benifallet · dins de la franja',
    xifra: '0 s',
    titular: 'La totalitat li dura 1 min 25 s.\nEn veurà zero.',
    nota: 'La carena de ponent li tapa el Sol al moment del màxim. Marge sobre el terreny: −2,1°.',
  },
  {
    nom: 'ig-feed-02-fitxa',
    mida: 'feed',
    disseny: 'giny',
    kicker: 'la fitxa de Benifallet',
    titular: 'Ser dins de la franja\nja no vol dir veure-ho',
    imatge: 'ginys/giny-01-durada-visible-zero.png',
    nota: 'Dins la franja, totalitat… i durada visible 0 s. Les tres xifres que decideixen si val la pena desplaçar-s’hi.',
  },
  {
    nom: 'ig-feed-03-barcelona',
    mida: 'feed',
    disseny: 'xifra',
    kicker: 'Barcelona · plaça de Catalunya',
    xifra: '98,8 %',
    titular: 'Tot l’eclipsi que hi veuràs.',
    nota: 'No el 99,8 % de les taules: al moment del màxim, el Sol ja serà darrere de Collserola.',
  },
  {
    nom: 'ig-feed-04-quatre-graus',
    mida: 'feed',
    disseny: 'xifra',
    kicker: 'Barcelona · 12.08.2026 · 20:29',
    xifra: '3,9°',
    titular: 'L’altura del Sol al màxim.',
    nota: 'Tres dits amb el braç estirat. A aquesta altura, qui decideix el que veuràs no és la Lluna: és el que tinguis a ponent. Dins de la franja, a Catalunya, el Sol no passa dels 5°.',
  },
  {
    nom: 'ig-feed-05-on-si',
    mida: 'feed',
    disseny: 'taula',
    titular: 'On sí que se’n veurà',
    files: [
      { lloc: 'la Sénia', valor: '1 min 37 s', destaca: true },
      { lloc: 'Amposta', valor: '1 min 33 s' },
      { lloc: 'Tortosa', valor: '1 min 31 s' },
      { lloc: 'Arnes', valor: '1 min 31 s' },
      { lloc: 'Horta de Sant Joan', valor: '1 min 29 s' },
      { lloc: 'Tivissa', valor: '1 min 17 s' },
      { lloc: 'Falset', valor: '1 min 09 s' },
      { lloc: 'Tarragona', valor: '58 s' },
    ],
    nota: 'Totalitat visible amb el relleu descomptat, al punt exacte de cada poble. La resposta canvia en pocs centenars de metres.',
  },
  {
    nom: 'ig-feed-06-app',
    mida: 'feed',
    disseny: 'crida',
    titular: 'Quants segons\nen veuràs tu?',
    nota: 'Gratuït · sense anuncis · el càlcul es fa al teu mòbil i la teva ubicació no viatja enlloc',
  },

  /* ── Instagram, històries ───────────────────────────────────────────────── */
  {
    nom: 'ig-story-01-zero',
    mida: 'story',
    disseny: 'xifra',
    kicker: 'el 12 d’agost, a Benifallet',
    xifra: '0 s',
    titular: 'I és dins de la franja.',
    nota: 'Li tocaria 1 min 25 s de totalitat. La muntanya de ponent se’ls menja tots.',
  },
  {
    nom: 'ig-story-02-fitxa',
    mida: 'story',
    disseny: 'giny',
    kicker: 'i el perquè, a la línia de sota',
    titular: 'Marge sobre el terreny:\n−2,1°',
    imatge: 'ginys/giny-02-marge-sobre-el-terreny.png',
    nota: 'El Sol, al màxim, és 2,1° per sota de la carena de ponent. Per veure’l caldrien 48 m més d’altura.',
  },
  {
    nom: 'ig-story-03-barcelona',
    mida: 'story',
    disseny: 'xifra',
    kicker: 'Barcelona',
    xifra: '98,8 %',
    titular: 'Ni tan sols el 99,8 %.',
    nota: 'Al màxim, el Sol ja serà darrere de Collserola. Marge sobre el terreny: −0,2°.',
  },
  {
    nom: 'ig-story-04-on-si',
    mida: 'story',
    disseny: 'taula',
    titular: 'On sí que se’n veurà',
    files: [
      { lloc: 'la Sénia', valor: '1 min 37 s', destaca: true },
      { lloc: 'Amposta', valor: '1 min 33 s' },
      { lloc: 'Tortosa', valor: '1 min 31 s' },
      { lloc: 'Horta de Sant Joan', valor: '1 min 29 s' },
      { lloc: 'Tivissa', valor: '1 min 17 s' },
      { lloc: 'Tarragona', valor: '58 s' },
    ],
    nota: 'Amb el relleu descomptat, al punt exacte de cada poble.',
  },
  {
    nom: 'ig-story-05-app',
    mida: 'story',
    disseny: 'crida',
    titular: 'Mira el teu punt',
    nota: 'Gratuït · sense anuncis · sense saber on ets',
  },

  /* ── X i LinkedIn ───────────────────────────────────────────────────────── */
  {
    nom: 'x-card-01-zero',
    mida: 'card',
    disseny: 'xifra',
    kicker: 'Benifallet · dins de la franja de totalitat',
    xifra: '0 s',
    titular: 'De 1 min 25 s a zero, per una carena.',
    nota: 'eclipsi.info calcula els segons que et sobreviuen al terreny, des del teu punt exacte.',
  },
  {
    nom: 'x-card-02-fitxa',
    mida: 'card',
    disseny: 'giny',
    titular: 'Dins la franja. Durada visible: 0 s.',
    imatge: 'ginys/giny-01-durada-visible-zero.png',
  },
  {
    nom: 'x-card-03-barcelona',
    mida: 'card',
    disseny: 'xifra',
    kicker: 'Barcelona · plaça de Catalunya',
    xifra: '98,8 %',
    titular: 'Tot l’eclipsi que hi veuràs el 12 d’agost.',
    nota: 'Al moment del màxim, el Sol ja serà darrere de Collserola.',
  },
  /* ── Segona tanda: duels, cites, hores, seguretat i quadrats ─────────────── */
  {
    /* El duel és el format que explica el producte sense cap paraula tècnica:
       a dalt el que diu la taula, a baix el que veuràs. */
    nom: 'ig-feed-07-duel-benifallet',
    mida: 'feed',
    disseny: 'duel',
    kicker: 'Benifallet · Baix Ebre',
    duel: {
      abans: '1 min 25 s',
      abansPeu: 'el que diu la taula<br>d’eclipsis',
      despres: '0 s',
      despresPeu: 'el que hi veuràs,<br>amb la carena descomptada',
    },
    titular: 'La diferència és una muntanya.',
    nota: 'Marge sobre el terreny: −2,1°. La totalitat sencera li passa per sota de la carena de ponent.',
  },
  {
    nom: 'ig-feed-08-cita-99',
    mida: 'feed',
    disseny: 'cita',
    kicker: 'el que diu l’app quan et queda un 99 %',
    cita: {
      text: 'No és una totalitat petita: és una altra cosa. Amb una escletxa de fotosfera visible no es fa fosc, no surt la corona, no es veuen els planetes, i el filtre no se’t pot treure en cap moment.',
      qui: 'eclipsi.info, a la fitxa d’un punt fora de la franja',
    },
  },
  {
    nom: 'ig-feed-09-hores-tarragona',
    mida: 'feed',
    disseny: 'hores',
    titular: 'El 12 d’agost, a Tarragona',
    files: [
      { lloc: 'C1 · comença l’eclipsi', valor: '19:35:31' },
      { lloc: 'C2 · comença la totalitat', valor: '20:29:27', destaca: true },
      { lloc: 'Màxim', valor: '20:29:56' },
      { lloc: 'C3 · s’acaba la totalitat', valor: '20:30:25' },
      { lloc: 'Posta de Sol', valor: '20:58:00' },
      { lloc: 'C4 · s’acaba l’eclipsi', valor: '21:21:08' },
    ],
    nota: 'Hora oficial peninsular. El Sol es pon amb l’eclipsi encara a mig fer: el final no el veurà ningú.',
  },
  {
    /* L'única peça del dossier amb vermell, i és la que toca: en aquesta casa
       el vermell vol dir seguretat ocular i no es gasta en res més. */
    nom: 'ig-feed-10-seguretat',
    mida: 'feed',
    disseny: 'xifra',
    to: 'vermell',
    kicker: 'abans del 12 d’agost',
    xifra: 'ISO 12312-2',
    titular: 'És l’única cosa que et pots posar davant dels ulls.',
    nota: 'Ni vidres fumats, ni radiografies, ni ulleres de sol de tres capes. Amb una escletxa de Sol visible, el filtre no se’t pot treure en cap moment.',
  },
  {
    nom: 'ig-feed-11-cinc-pobles',
    mida: 'feed',
    disseny: 'taula',
    titular: 'Cinc pobles dins la franja\nque no en veuran res',
    files: [
      { lloc: 'Benifallet', valor: '0 s', destaca: true },
      { lloc: 'Pratdip', valor: '0 s' },
      { lloc: 'Vandellòs', valor: '0 s' },
      { lloc: 'la Morera de Montsant', valor: '0 s' },
      { lloc: 'Cornudella de Montsant', valor: '0 s' },
    ],
    nota: 'A tots cinc els toca entre 56 s i 1 min 25 s de totalitat. La carena de ponent els tapa el Sol abans que arribi.',
  },
  {
    nom: 'ig-story-06-duel-benifallet',
    mida: 'story',
    disseny: 'duel',
    kicker: 'Benifallet · dins de la franja',
    duel: {
      abans: '1 min 25 s',
      abansPeu: 'el que diu la taula',
      despres: '0 s',
      despresPeu: 'el que hi veuràs',
    },
    titular: 'La diferència és una muntanya.',
  },
  {
    nom: 'ig-story-07-seguretat',
    mida: 'story',
    disseny: 'xifra',
    to: 'vermell',
    kicker: 'per mirar-lo sense fer-te mal',
    xifra: 'ISO 12312-2',
    titular: 'Busca aquest número a les ulleres.',
    nota: 'Amb una escletxa de Sol visible, el filtre no se’t pot treure en cap moment.',
  },
  {
    nom: 'ig-sq-01-zero',
    mida: 'quadrat',
    disseny: 'xifra',
    kicker: 'Benifallet · dins de la franja',
    xifra: '0 s',
    titular: 'Li toquen 1 min 25 s\nde totalitat.',
    nota: 'La carena de ponent li tapa el Sol al moment del màxim.',
  },
  {
    nom: 'ig-sq-02-barcelona',
    mida: 'quadrat',
    disseny: 'xifra',
    kicker: 'Barcelona · plaça de Catalunya',
    xifra: '98,8 %',
    titular: 'Tot l’eclipsi que hi veuràs.',
    nota: 'Al màxim, el Sol ja serà darrere de Collserola. Marge sobre el terreny: −0,2°.',
  },
  {
    nom: 'ig-sq-03-cinc-pobles',
    mida: 'quadrat',
    disseny: 'taula',
    titular: 'Dins la franja, i res',
    files: [
      { lloc: 'Benifallet', valor: '0 s', destaca: true },
      { lloc: 'Pratdip', valor: '0 s' },
      { lloc: 'Vandellòs', valor: '0 s' },
      { lloc: 'la Morera de Montsant', valor: '0 s' },
      { lloc: 'Cornudella de Montsant', valor: '0 s' },
    ],
    nota: 'Els cinc tenen totalitat assignada i el relleu se la menja sencera.',
  },
  {
    nom: 'x-card-04-duel',
    mida: 'card',
    disseny: 'duel',
    kicker: 'Benifallet · dins de la franja de totalitat',
    duel: {
      abans: '1 min 25 s',
      abansPeu: 'el que diu la taula',
      despres: '0 s',
      despresPeu: 'el que hi veuràs',
    },
    titular: 'La diferència és una muntanya.',
  },
  {
    nom: 'x-card-05-cinc-pobles',
    mida: 'card',
    disseny: 'taula',
    titular: 'Cinc pobles dins la franja, zero segons',
    files: [
      { lloc: 'Benifallet', valor: '0 s', destaca: true },
      { lloc: 'Pratdip', valor: '0 s' },
      { lloc: 'Vandellòs', valor: '0 s' },
      { lloc: 'la Morera de Montsant', valor: '0 s' },
      { lloc: 'Cornudella de Montsant', valor: '0 s' },
    ],
  },
  {
    nom: 'x-card-06-seguretat',
    mida: 'card',
    disseny: 'xifra',
    to: 'vermell',
    kicker: '12 d’agost de 2026',
    xifra: 'ISO 12312-2',
    titular: 'L’únic filtre que serveix.',
    nota: 'Amb una escletxa de Sol visible no se’t pot treure en cap moment.',
  },
  {
    nom: 'x-card-07-cita',
    mida: 'card',
    disseny: 'cita',
    cita: {
      text: 'No és una totalitat petita: és una altra cosa.',
      qui: 'eclipsi.info, quan et quedes al 99 %',
    },
  },
];


/* ─── Tipografies ───────────────────────────────────────────────────────────
 * Els mateixos fitxers que serveix l'app, agafats de node_modules. Es copien a
 * la carpeta temporal perquè el servidor els pugui donar amb el seu tipus MIME.
 */
const FONTS: { fitxer: string; desti: string }[] = [
  {
    fitxer:
      'node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2',
    desti: 'grotesk-700.woff2',
  },
  {
    fitxer:
      'node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2',
    desti: 'grotesk-500.woff2',
  },
  {
    fitxer:
      'node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2',
    desti: 'plex-400.woff2',
  },
  {
    fitxer:
      'node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2',
    desti: 'plex-600.woff2',
  },
  {
    fitxer:
      'node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2',
    desti: 'mono-500.woff2',
  },
];

const marca = (ambre: boolean) => `
  <div class="marca">
    <svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true">
      <defs><mask id="m"><rect width="64" height="64" fill="#000"/>
        <circle cx="32" cy="32" r="24" fill="#fff"/>
        <circle cx="39.5" cy="27.5" r="21" fill="#000"/></mask></defs>
      <g mask="url(#m)"><circle cx="32" cy="32" r="24" fill="${
        ambre ? P.sun500 : P.corona100
      }"/></g>
    </svg>
    <span class="marca__nom">eclipsi<span class="marca__tld">.info</span></span>
  </div>`;

function css(mida: MidaId): string {
  const { w, h } = MIDES[mida];
  // Una sola escala per mida: així els cossos de lletra es declaren un cop i
  // les tres mides queden proporcionades sense tres jocs de números.
  const k =
    mida === 'card' ? 0.62 : mida === 'story' ? 1.16 : mida === 'quadrat' ? 0.86 : 1;
  return `
@font-face{font-family:'Grotesk';src:url(/grotesk-700.woff2) format('woff2');font-weight:700;font-display:block}
@font-face{font-family:'Grotesk';src:url(/grotesk-500.woff2) format('woff2');font-weight:500;font-display:block}
@font-face{font-family:'Plex';src:url(/plex-400.woff2) format('woff2');font-weight:400;font-display:block}
@font-face{font-family:'Plex';src:url(/plex-600.woff2) format('woff2');font-weight:600;font-display:block}
@font-face{font-family:'Mono';src:url(/mono-500.woff2) format('woff2');font-weight:500;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{
  background:${P.ink950};
  color:${P.corona050};
  font-family:'Plex',sans-serif;
  -webkit-font-smoothing:antialiased;
}
.peca{
  position:relative;width:${w}px;height:${h}px;
  display:flex;flex-direction:column;
  padding:${Math.round(72 * k)}px ${Math.round(76 * k)}px ${Math.round(60 * k)}px;
  background:linear-gradient(180deg,${P.ink950} 0%,#0B1020 58%,#1D1836 86%,#2C1B2C 100%);
  overflow:hidden;
}
/* El sol que no es veu: el resplendor va DARRERE de la xifra, mai a sobre. */
.peca::before{
  content:'';position:absolute;left:50%;top:${mida === 'card' ? '50%' : '46%'};
  width:${Math.round(1100 * k)}px;height:${Math.round(1100 * k)}px;
  transform:translate(-50%,-50%);
  background:radial-gradient(circle at 50% 50%,rgba(255,224,168,.16) 0%,rgba(255,165,31,.07) 34%,rgba(255,165,31,0) 66%);
  pointer-events:none;
}
.peca > *{position:relative}
.kicker{
  font-family:'Mono',monospace;font-weight:500;
  font-size:${Math.round(23 * k)}px;letter-spacing:.14em;text-transform:uppercase;
  color:${P.slate350};
}
.cos{flex:1;display:flex;flex-direction:column;justify-content:center;gap:${Math.round(34 * k)}px}
.xifra{
  font-family:'Mono',monospace;font-weight:500;
  font-size:${Math.round(232 * k)}px;line-height:.9;letter-spacing:-.04em;
  color:${P.sun500};
}
.titular{
  font-family:'Grotesk',sans-serif;font-weight:700;
  font-size:${Math.round(66 * k)}px;line-height:1.06;letter-spacing:-.025em;
  color:${P.corona050};white-space:pre-line;
}
.titular--petit{font-size:${Math.round(52 * k)}px}
.nota{
  font-size:${Math.round(29 * k)}px;line-height:1.4;color:${P.mist200};
  max-width:${Math.round(880 * k)}px;
}
.peu{
  display:flex;align-items:flex-end;justify-content:space-between;gap:24px;
  padding-top:${Math.round(30 * k)}px;
  border-top:1px solid rgba(255,255,255,.10);
}
.marca{display:flex;align-items:center;gap:${Math.round(14 * k)}px}
.marca__nom{
  font-family:'Grotesk',sans-serif;font-weight:700;
  font-size:${Math.round(36 * k)}px;letter-spacing:-.02em;color:${P.corona100};
}
.marca__tld{color:${P.slate400}}
.segell{
  font-family:'Mono',monospace;font-size:${Math.round(21 * k)}px;
  letter-spacing:.1em;color:${P.slate400};text-align:right;line-height:1.5;
}
/* La captura, dins d'un marc que recorda un telèfon sense imitar-ne cap. */
.marc{
  flex:1;display:flex;align-items:center;justify-content:center;
  min-height:0;padding:${Math.round(18 * k)}px 0;
}
.marc__vidre{
  height:100%;aspect-ratio:1170/2532;
  border-radius:${Math.round(46 * k)}px;overflow:hidden;
  border:1px solid rgba(255,255,255,.12);
  box-shadow:0 ${Math.round(40 * k)}px ${Math.round(90 * k)}px rgba(0,0,0,.55);
  background:${P.ink900};
}
.marc__vidre img{width:100%;height:100%;object-fit:cover}
.taula{display:flex;flex-direction:column;gap:0}
.fila{
  display:flex;align-items:baseline;justify-content:space-between;gap:20px;
  padding:${Math.round(21 * k)}px 0;border-bottom:1px solid rgba(255,255,255,.08);
}
.fila__lloc{font-size:${Math.round(35 * k)}px;color:${P.mist200}}
.fila__valor{
  font-family:'Mono',monospace;font-weight:500;
  font-size:${Math.round(37 * k)}px;letter-spacing:-.02em;color:${P.corona050};
}
.fila--destaca .fila__lloc{color:${P.corona050};font-weight:600}
.fila--destaca .fila__valor{color:${P.sun500}}
/* Peça de crida: aquí no hi ha xifra, i per això el logotip pot ser ambre. */
.crida{flex:1;display:flex;flex-direction:column;justify-content:center;gap:${Math.round(40 * k)}px}
.crida .marca__nom{font-size:${Math.round(64 * k)}px}
.crida .marca svg{width:${Math.round(58 * k)}px;height:${Math.round(58 * k)}px}
.punts{display:flex;flex-direction:column;gap:${Math.round(16 * k)}px}
.punt{
  display:flex;gap:${Math.round(16 * k)}px;align-items:baseline;
  font-size:${Math.round(30 * k)}px;color:${P.mist200};
}
.punt::before{content:'—';color:${P.slate400}}
.url{
  font-family:'Mono',monospace;font-size:${Math.round(34 * k)}px;
  letter-spacing:.02em;color:${P.sun500};
}
/* El giny sol, damunt del fons de la peça.
   PER QUÈ SUBSTITUEIX LA MAQUETA DE TELÈFON: una captura de mòbil sencera
   arrossega la llegenda del mapa tallada a mig mot i l'atribució
   d'OpenStreetMap impresa damunt de la fila de contactes. Retallat per
   l'element, el que es publica és la xifra i prou. */
.giny{flex:1;display:flex;align-items:center;justify-content:center;min-height:0;padding:${Math.round(14 * k)}px 0}
.giny img{
  max-width:100%;max-height:100%;width:auto;height:auto;
  border-radius:${Math.round(26 * k)}px;
  border:1px solid rgba(255,255,255,.10);
  box-shadow:0 ${Math.round(30 * k)}px ${Math.round(70 * k)}px rgba(0,0,0,.5);
}
/* Duel: el que diu la taula contra el que veuràs. La fletxa és el missatge. */
.duel{flex:1;display:flex;flex-direction:column;justify-content:center;gap:${Math.round(30 * k)}px}
.duel__fila{display:flex;align-items:baseline;gap:${Math.round(26 * k)}px}
.duel__xifra{
  font-family:'Mono',monospace;font-weight:500;letter-spacing:-.04em;line-height:.95;
}
.duel__xifra--abans{font-size:${Math.round(96 * k)}px;color:${P.slate400};text-decoration:line-through;text-decoration-thickness:${Math.round(4 * k)}px}
.duel__xifra--despres{font-size:${Math.round(176 * k)}px;color:${P.sun500}}
.duel__peu{font-size:${Math.round(26 * k)}px;color:${P.slate350};line-height:1.35}
.duel__fletxa{font-family:'Mono',monospace;font-size:${Math.round(58 * k)}px;color:${P.slate400};line-height:1}
/* Cita: paraules del producte, no de la campanya. */
.cita{flex:1;display:flex;flex-direction:column;justify-content:center;gap:${Math.round(36 * k)}px}
.cita__text{
  font-family:'Grotesk',sans-serif;font-weight:500;
  font-size:${Math.round(58 * k)}px;line-height:1.18;letter-spacing:-.02em;
  color:${P.corona050};
}
.cita__qui{font-size:${Math.round(26 * k)}px;color:${P.slate350};letter-spacing:.02em}
/* Hores: la taula de contactes, que és el que es mira el dia mateix. */
.hores{display:flex;flex-direction:column;gap:0}
.hores__fila{
  display:flex;align-items:baseline;justify-content:space-between;gap:20px;
  padding:${Math.round(19 * k)}px 0;border-bottom:1px solid rgba(255,255,255,.08);
}
.hores__que{font-size:${Math.round(30 * k)}px;color:${P.mist200}}
.hores__quan{font-family:'Mono',monospace;font-weight:500;font-size:${Math.round(36 * k)}px;letter-spacing:-.02em;color:${P.corona050}}
.hores__fila--destaca .hores__que{color:${P.corona050};font-weight:600}
.hores__fila--destaca .hores__quan{color:${P.sun500}}
/* El to de seguretat ocular: l'única peça on el vermell és legítim. */
.peca--vermell .xifra,.peca--vermell .duel__xifra--despres{color:${P.flare500}}
.peca--vermell .fila--destaca .fila__valor{color:${P.flare500}}
/* Peça ampla: la captura mana i el text va damunt d'un vel. */
.ample{position:absolute;inset:0}
.ample img{width:100%;height:100%;object-fit:cover;object-position:center top}
.ample__vel{
  position:absolute;inset:auto 0 0 0;padding:${Math.round(52 * k)}px ${Math.round(60 * k)}px;
  background:linear-gradient(180deg,rgba(5,6,11,0) 0%,rgba(5,6,11,.88) 42%,rgba(5,6,11,.97) 100%);
  display:flex;align-items:flex-end;justify-content:space-between;gap:30px;
}
`;
}

function cos(p: Peca): string {
  switch (p.disseny) {
    case 'xifra':
      return `
        ${p.kicker ? `<p class="kicker">${p.kicker}</p>` : ''}
        <div class="cos">
          <p class="xifra">${p.xifra ?? ''}</p>
          <h1 class="titular">${p.titular ?? ''}</h1>
          ${p.nota ? `<p class="nota">${p.nota}</p>` : ''}
        </div>`;
    case 'mobil':
      return `
        <h1 class="titular titular--petit">${p.titular ?? ''}</h1>
        <div class="marc"><div class="marc__vidre">
          <img src="/${p.imatge}" style="object-position:center ${p.enquadra ?? 'top'}">
        </div></div>
        ${p.nota ? `<p class="nota">${p.nota}</p>` : ''}`;
    case 'taula':
      return `
        <h1 class="titular titular--petit">${p.titular ?? ''}</h1>
        <div class="cos"><div class="taula">
          ${(p.files ?? [])
            .map(
              (f) => `<div class="fila${f.destaca ? ' fila--destaca' : ''}">
                <span class="fila__lloc">${f.lloc}</span>
                <span class="fila__valor">${f.valor}</span></div>`,
            )
            .join('')}
        </div></div>
        ${p.nota ? `<p class="nota">${p.nota}</p>` : ''}`;
    case 'crida':
      return `
        <div class="crida">
          <h1 class="titular">${p.titular ?? ''}</h1>
          ${marca(true)}
          <div class="punts">
            <span class="punt">Els segons de totalitat del teu punt, amb les muntanyes descomptades</span>
            <span class="punt">Compte enrere amb veu i avisos de seguretat ocular</span>
            <span class="punt">Funciona sense cobertura</span>
          </div>
          <p class="url">eclipsi.info</p>
        </div>`;
    case 'giny':
      return `
        ${p.kicker ? `<p class="kicker">${p.kicker}</p>` : ''}
        <h1 class="titular titular--petit">${p.titular ?? ''}</h1>
        <div class="giny"><img src="/${p.imatge}"></div>
        ${p.nota ? `<p class="nota">${p.nota}</p>` : ''}`;
    case 'duel':
      return `
        ${p.kicker ? `<p class="kicker">${p.kicker}</p>` : ''}
        <div class="duel">
          <div class="duel__fila">
            <span class="duel__xifra duel__xifra--abans">${p.duel?.abans ?? ''}</span>
            <span class="duel__peu">${p.duel?.abansPeu ?? ''}</span>
          </div>
          <span class="duel__fletxa">↓</span>
          <div class="duel__fila">
            <span class="duel__xifra duel__xifra--despres">${p.duel?.despres ?? ''}</span>
            <span class="duel__peu">${p.duel?.despresPeu ?? ''}</span>
          </div>
          <h1 class="titular titular--petit">${p.titular ?? ''}</h1>
          ${p.nota ? `<p class="nota">${p.nota}</p>` : ''}
        </div>`;
    case 'cita':
      return `
        ${p.kicker ? `<p class="kicker">${p.kicker}</p>` : ''}
        <div class="cita">
          <p class="cita__text">«${p.cita?.text ?? ''}»</p>
          <p class="cita__qui">${p.cita?.qui ?? ''}</p>
          ${p.nota ? `<p class="nota">${p.nota}</p>` : ''}
        </div>`;
    case 'hores':
      return `
        <h1 class="titular titular--petit">${p.titular ?? ''}</h1>
        <div class="cos"><div class="hores">
          ${(p.files ?? [])
            .map(
              (f) => `<div class="hores__fila${f.destaca ? ' hores__fila--destaca' : ''}">
                <span class="hores__que">${f.lloc}</span>
                <span class="hores__quan">${f.valor}</span></div>`,
            )
            .join('')}
        </div></div>
        ${p.nota ? `<p class="nota">${p.nota}</p>` : ''}`;
    case 'ample':
      return `
        <div class="ample">
          <img src="/${p.imatge}">
          <div class="ample__vel">
            <h1 class="titular titular--petit">${p.titular ?? ''}</h1>
            ${marca(false)}
          </div>
        </div>`;
  }
}

function pagina(p: Peca): string {
  // Totes les peces porten peu menys la de captura a sang, que ja en té un
  // de propi damunt del vel. La de crida el volia i no el tenia: acabava en un
  // terç de degradat pelat.
  const ambPeu = p.disseny !== 'ample';
  return `<!doctype html><html lang="ca"><head><meta charset="utf-8">
<title>${p.nom}</title><style>${css(p.mida)}</style></head>
<body><div class="peca${p.to === 'vermell' ? ' peca--vermell' : ''}">
${cos(p)}
${
  ambPeu
    ? `<div class="peu">${marca(false)}<p class="segell">12.08.2026<br>eclipsi total</p></div>`
    : ''
}
</div></body></html>`;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
  const arrel = join(homedir(), 'Desktop', 'eclipsi-premsa');
  const capturesDir = join(arrel, 'captures');
  const sortida = join(arrel, 'creativitats');
  mkdirSync(sortida, { recursive: true });

  const treball = join(tmpdir(), `eclipsi-creatives-${process.pid}`);
  mkdirSync(treball, { recursive: true });

  for (const f of FONTS) {
    if (!existsSync(f.fitxer)) throw new Error(`Falta la tipografia ${f.fitxer}`);
    copyFileSync(f.fitxer, join(treball, f.desti));
  }

  const llista = PECES.filter((p) => (only ? p.nom.includes(only) : true));

  // Les captures que necessiten les peces. Si en falta cap, val més parar aquí
  // que publicar un forat negre amb una vora arrodonida.
  const calen = new Set(llista.map((p) => p.imatge).filter(Boolean) as string[]);
  for (const rel of calen) {
    const orig = join(capturesDir, rel);
    if (!existsSync(orig))
      throw new Error(
        `Falta la captura ${rel}. Corre abans: npx tsx scripts/press-shots.ts`,
      );
    const desti = join(treball, rel);
    mkdirSync(join(desti, '..'), { recursive: true });
    copyFileSync(orig, desti);
  }

  for (const p of llista) {
    writeFileSync(join(treball, `${p.nom}.html`), pagina(p));
  }

  const servidor = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(
      /^\/+/,
      '',
    );
    const fitxer = join(treball, rel);
    if (!fitxer.startsWith(treball) || !existsSync(fitxer)) {
      res.writeHead(404).end('no');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[extname(fitxer)] ?? 'application/octet-stream',
    });
    res.end(readFileSync(fitxer));
  });
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
  const port = (servidor.address() as { port: number }).port;

  console.log(`Peces: ${llista.length}`);
  console.log(`Sortida: ${sortida}\n`);

  const { cdp, tanca } = await obreChrome(9334);
  try {
    for (const p of llista) {
      const { w, h } = MIDES[p.mida];
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: 2,
        mobile: false,
      });
      await cdp.send('Page.navigate', {
        url: `http://127.0.0.1:${port}/${p.nom}.html`,
      });
      await espera(
        async () =>
          (await evalua<string>(cdp, 'document.readyState')) === 'complete',
        'la càrrega',
        20_000,
      );
      // Les tipografies i la captura han d'estar a dins ABANS de disparar: una
      // peça capturada a mig carregar surt amb la lletra del sistema i no es
      // nota fins que és publicada.
      await espera(
        () =>
          evalua<boolean>(
            cdp,
            `document.fonts.status === 'loaded' &&
             [...document.images].every(i => i.complete && i.naturalWidth > 0)`,
          ),
        'tipografies i imatges',
        20_000,
      );
      await dorm(350);
      const shot = await cdp.send<{ data: string }>('Page.captureScreenshot', {
        format: 'png',
      });
      const dades = Buffer.from(shot.data, 'base64');
      writeFileSync(join(sortida, `${p.nom}.png`), dades);
      console.log(
        `  ✓ ${p.nom.padEnd(26)} ${w * 2}×${h * 2}  ${Math.round(dades.length / 1024)} kB`,
      );
    }
  } finally {
    await tanca();
    servidor.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
