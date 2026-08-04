/**
 * Les animacions: el que una captura fixa no pot explicar.
 *
 * QUÈ S'HI GRAVA I PER QUÈ. Tres coses del producte només s'entenen movent-se:
 * que el commutador del mapa canvia la RESPOSTA i no la decoració, que la vista
 * de durada respon si val la pena moure's d'on ets —i no és el mapa de calor,
 * que és una capa a part—, i que la portada és una columna que es llegeix de
 * dalt a baix. La resta —una xifra, un
 * distintiu— ja es diu millor amb una imatge quieta i no s'anima.
 *
 * PER QUÈ SCREENCAST I NO UNA CAPTURA CADA X MIL·LISEGONS. El bucle de
 * captures dona fotogrames a un ritme que depèn de com de carregada estigui la
 * màquina, i el resultat va a batzegades. `Page.screencastFrame` porta la
 * marca de temps de cada fotograma i amb ella es munta una llista de durades
 * per a ffmpeg: el vídeo va al ritme real encara que la gravació anés coixa.
 *
 * DUES SORTIDES PER PECA. `.mp4` per a X i LinkedIn, que hi volen vídeo, i
 * `.gif` per on no se'n pugui posar. El GIF es fa amb paleta pròpia
 * (`palettegen`/`paletteuse`): amb la paleta de sèrie, el degradat del cel de
 * la nostra portada surt a bandes.
 *
 * ÚS: npx tsx scripts/press-motion.ts [--only mapa]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { obreChrome, evalua, espera, esperaCarrega, dorm, type Cdp } from './lib/chrome.ts';
import { feHoritzoY4m } from './lib/horitzo-fals.ts';

const BASE = 'https://eclipsi.info/';
const PUNTS = {
  tarragona: { p: '41.11724,1.25461', n: 'Tarragona' },
  benifallet: { p: '40.97406,0.51728', n: 'Benifallet' },
};

/** El rètol que només surt amb el perfil del terreny fet. Vegeu press-shots. */
const XIFRA_BONA = 'durada visible';

type Pas =
  | { clica: string; espera?: number }
  | { desplaça: number; espera?: number }
  | { pausa: number }
  /**
   * Escombra el control lliscant del temps, de 0 a 1, en un nombre de passes.
   *
   * La pantalla de la càmera NO té reproductor amb velocitats: té un lliscador
   * («Instant de l'eclipsi»). Prémer-hi «Reprodueix» no és possible perquè no
   * existeix; el que fa la gent és arrossegar-lo, i això és el que es grava.
   */
  | { escombra: { de: number; a: number; passes: number; ms: number } };

interface Seq {
  nom: string;
  punt: keyof typeof PUNTS;
  hash?: string;
  mida: 'mobil' | 'escriptori';
  /** Segons d'escalfament abans de començar a gravar. */
  abans?: number;
  /**
   * Obre el mode càmera abans de gravar, amb el senyal de vídeo sintètic.
   *
   * És l'única manera de gravar la capa d'AR des d'un escriptori. El que es
   * publiqui d'aquí duu «simulacio» al nom: el fons no és una fotografia.
   */
  camera?: true;
  /**
   * Amplada del GIF, quan la de sèrie el deixa massa gros.
   *
   * Un desplaçament suau canvia CADA píxel a cada fotograma i la paleta del
   * GIF no el pot comprimir: la portada, a 420 px, pesava 4,3 MB, que és més
   * del que accepten la meitat de les plataformes. El vídeo no té el problema
   * i es queda com és.
   */
  gifAmple?: number;
  /** Segon on comença el GIF, quan només interessa un tros de la gravació. */
  gifDes?: number;
  /** Durada del GIF en segons. El vídeo es queda sencer. */
  gifDurada?: number;
  passos: Pas[];
}

const SEQS: Seq[] = [
  {
    /*
     * El commutador de la fitxa, que és la idea central del mapa: cada
     * pestanya respon una pregunta DIFERENT sobre el teu punt, no pinta una
     * capa diferent damunt del mateix.
     */
    nom: '01-mobil-vistes-del-mapa',
    punt: 'tarragona',
    hash: '#/mapa',
    mida: 'mobil',
    abans: 3000,
    passos: [
      { pausa: 1200 },
      { clica: 'Núvols', espera: 2600 },
      { clica: 'Durada', espera: 3400 },
      { clica: 'Llocs', espera: 3400 },
      { clica: 'Enquadra', espera: 2600 },
      { clica: 'Franja', espera: 2200 },
    ],
  },
  {
    nom: '02-escriptori-vista-durada',
    punt: 'tarragona',
    hash: '#/mapa',
    mida: 'escriptori',
    abans: 4000,
    passos: [
      { pausa: 1800 },
      { clica: 'Durada', espera: 7000 },
      // Un zoom curt cap a les Terres de l'Ebre: sense cap moviment, el
      // screencast no envia fotogrames i el degradat de la durada no s'arriba
      // a veure canviar.
      { desplaça: 0, espera: 400 },
      { clica: 'Zoom in', espera: 2200 },
      { clica: 'Zoom in', espera: 3000 },
      { pausa: 2000 },
    ],
  },
  {
    /*
     * LA SIMULACIÓ, QUE ÉS EL QUE NOMÉS S'ENTÉN MOVENT-SE.
     *
     * El rellotge de simulació de l'app corre l'eclipsi sencer a 300×: vint
     * segons de gravació són una hora i quaranta de tarda del 12 d'agost, amb
     * el disc menjant-se el Sol, l'ocultació pujant i el tint del cel canviant.
     * La totalitat, a aquesta velocitat, dura dues dècimes: per a la corona hi
     * ha la peça de la càmera, que va a 1×.
     */
    nom: '04-mobil-simulacio-eclipsi',
    punt: 'tarragona',
    mida: 'mobil',
    abans: 2500,
    gifAmple: 340,
    passos: [
      { pausa: 800 },
      { clica: 'Simulació', espera: 1500 },
      // Al principi de l'eclipsi. Sense això, la simulació arrenca on l'hagi
      // deixada el rellotge i la primera peça va sortir després de la posta.
      { clica: 'C1', espera: 1600 },
      { clica: '300×', espera: 1000 },
      /* L'enquadrament es fa DESPRÉS de posar la simulació: en entrar-hi
         apareix el reproductor i tot el que hi ha a sota baixa. Desplaçar
         abans deixava el cel a la vora inferior del quadre. */
      { desplaça: 900, espera: 1400 },
      { clica: 'Reprodueix', espera: 24000 },
      { pausa: 1500 },
    ],
  },
  {
    /*
     * LA CORONA, A 1×. La peça de la simulació corre a 300× i la totalitat hi
     * dura dues dècimes; aquí el rellotge va a temps real, arrencant just
     * abans del segon contacte, i s'hi veu el que la gent hi anirà a veure:
     * el disc tancant-se, la corona i el rètol de seguretat canviant.
     */
    nom: '05-camera-simulacio-corona',
    punt: 'tarragona',
    mida: 'mobil',
    camera: true,
    abans: 1500,
    // 300 px, i el GIF només del tros central: el cel d'aquesta peça canvia de
    // color a cada fotograma i la paleta no el pot comprimir. Sencer i a 340
    // pesava 7 MB, que no els accepta ni la meitat de les plataformes.
    gifAmple: 300,
    gifDes: 8,
    gifDurada: 12,
    passos: [
      { clica: 'Recorregut simulat', espera: 2500 },
      { pausa: 1200 },
      // De just abans del primer contacte fins passada la totalitat. Les
      // passes són petites perquè el gest es vegi continu i no a salts.
      { escombra: { de: 0.02, a: 0.62, passes: 90, ms: 130 } },
      { pausa: 1800 },
      { escombra: { de: 0.62, a: 0.98, passes: 40, ms: 110 } },
      { pausa: 1500 },
    ],
  },
  {
    nom: '03-mobil-portada',
    punt: 'benifallet',
    mida: 'mobil',
    abans: 2500,
    gifAmple: 300,
    passos: [
      { pausa: 1200 },
      { desplaça: 420, espera: 900 },
      { desplaça: 420, espera: 900 },
      { desplaça: 420, espera: 900 },
      { desplaça: 420, espera: 1400 },
    ],
  },
];

/*
 * Densitat 2 i no 3. A mòbil, tres vegades 390×844 són 1170×2532 per
 * fotograma: mig gigabyte de JPEG per a deu segons i un GIF que no es pot
 * publicar enlloc. Amb 2×, 780×1688, el text mono encara es llegeix.
 */
const MIDES = {
  mobil: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
  escriptori: { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false },
} as const;

interface Fotograma {
  fitxer: string;
  t: number;
}

async function grava(
  cdp: Cdp,
  seq: Seq,
  treball: string,
): Promise<{ fotogrames: Fotograma[]; fi: number }> {
  const fotogrames: Fotograma[] = [];
  let n = 0;

  cdp.on<{ data: string; sessionId: number; metadata: { timestamp: number } }>(
    'Page.screencastFrame',
    (p) => {
      const fitxer = join(treball, `f${String(++n).padStart(5, '0')}.jpg`);
      writeFileSync(fitxer, Buffer.from(p.data, 'base64'));
      fotogrames.push({ fitxer, t: p.metadata.timestamp });
      void cdp.send('Page.screencastFrameAck', { sessionId: p.sessionId });
    },
  );

  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    everyNthFrame: 1,
  });

  for (const pas of seq.passos) {
    if ('pausa' in pas) {
      await dorm(pas.pausa);
      continue;
    }
    if ('escombra' in pas) {
      const { de, a, passes, ms } = pas.escombra;
      for (let i = 0; i <= passes; i++) {
        const v = de + ((a - de) * i) / passes;
        await evalua(
          cdp,
          `(() => {
            const r = document.querySelector('input[type=range]');
            if (!r) return false;
            const min = Number(r.min || 0), max = Number(r.max || 100);
            r.value = String(min + (max - min) * ${v});
            r.dispatchEvent(new Event('input', { bubbles: true }));
            r.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          })()`,
        );
        await dorm(ms);
      }
      continue;
    }
    if ('desplaça' in pas) {
      await evalua(
        cdp,
        `(() => {
          const c = document.scrollingElement || document.documentElement;
          c.scrollBy({ top: ${pas.desplaça}, behavior: 'smooth' });
        })()`,
      );
      await dorm(pas.espera ?? 800);
      continue;
    }
    const ok = await evalua<boolean>(
      cdp,
      `(() => {
        const txt = ${JSON.stringify(pas.clica)};
        /* Es miren les DUES etiquetes, no una o l'altra: els salts de
           contacte de la línia de temps porten un aria-label llarg («Vés a
           C1…») i el text visible curt («C1»), i comparar només la primera
           feia que el guió no trobés mai el botó que buscava. */
        const el = [...document.querySelectorAll('button,[role=tab],a')].find(e => {
          const noms = [e.getAttribute('aria-label'), e.textContent]
            .filter(Boolean).map(t => t.trim());
          return noms.some(t => t === txt || t.startsWith(txt));
        });
        if (!el) return false;
        el.click();
        return true;
      })()`,
    );
    if (!ok) console.warn(`  ⚠ no s'ha trobat «${pas.clica}»`);
    await dorm(pas.espera ?? 1500);
  }

  await cdp.send('Page.stopScreencast');
  await dorm(300);
  /*
   * LA MARCA DE TEMPS DEL FINAL, I PER QUÈ CAL.
   *
   * `Page.screencastFrame` només arriba quan la pantalla CANVIA. Si l'última
   * cosa que fa la seqüència és quedar-se quieta mirant el mapa de calor —que
   * és justament el que volem que es vegi—, no arriba cap fotograma més i el
   * vídeo s'acabava tres segons abans que la gravació. Amb l'instant real del
   * final, l'últim fotograma dura el que ha de durar.
   */
  const fi = await evalua<number>(cdp, 'Date.now() / 1000');
  return { fotogrames, fi };
}

/**
 * Munta el vídeo amb les durades REALS de cada fotograma.
 *
 * El demuxer `concat` vol la durada després de cada fitxer i vol l'últim
 * repetit, o se salta el darrer fotograma. Això últim no és una dèria: sense
 * repetir-lo, totes les peces acabaven un instant abans del que s'havia
 * gravat i el gest final quedava tallat.
 */
function munta(
  fotogrames: Fotograma[],
  fi: number,
  treball: string,
  sortida: string,
  nom: string,
  gifAmple = 420,
  gifDes?: number,
  gifDurada?: number,
) {
  if (fotogrames.length < 2) {
    console.warn(`  ⚠ ${nom}: només ${fotogrames.length} fotogrames, no es munta`);
    return;
  }
  const linies: string[] = [];
  for (let i = 0; i < fotogrames.length; i++) {
    const dur =
      i < fotogrames.length - 1
        ? Math.max(0.02, fotogrames[i + 1].t - fotogrames[i].t)
        : Math.min(4, Math.max(0.5, fi - fotogrames[i].t));
    linies.push(`file '${fotogrames[i].fitxer}'`, `duration ${dur.toFixed(3)}`);
  }
  linies.push(`file '${fotogrames[fotogrames.length - 1].fitxer}'`);
  const llista = join(treball, 'llista.txt');
  writeFileSync(llista, linies.join('\n'));

  const mp4 = join(sortida, `${nom}.mp4`);
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', llista,
    '-vf', 'fps=25,scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
    '-movflags', '+faststart',
    mp4,
  ]);

  const tall = [
    ...(gifDes !== undefined ? ['-ss', String(gifDes)] : []),
    ...(gifDurada !== undefined ? ['-t', String(gifDurada)] : []),
  ];
  const paleta = join(treball, 'paleta.png');
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', ...tall, '-i', mp4,
    '-vf', `fps=10,scale=${gifAmple}:-1:flags=lanczos,palettegen=stats_mode=diff`,
    paleta,
  ]);
  const gif = join(sortida, `${nom}.gif`);
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', ...tall, '-i', mp4, '-i', paleta,
    '-lavfi', `fps=10,scale=${gifAmple}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
    '-loop', '0',
    gif,
  ]);
  console.log(`  ✓ ${nom}  mp4 + gif`);
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
  const sortida = join(homedir(), 'Desktop', 'eclipsi-premsa', 'animacions');
  mkdirSync(sortida, { recursive: true });

  const llista = SEQS.filter((s) => (only ? s.nom.includes(only) : true));
  console.log(`Seqüències: ${llista.length}\nSortida: ${sortida}\n`);

  for (const seq of llista) {
    const treball = join(tmpdir(), `eclipsi-motion-${seq.nom}`);
    rmSync(treball, { recursive: true, force: true });
    mkdirSync(treball, { recursive: true });

    // Un Chrome per seqüència: així un escoltador de fotogrames no pot heretar
    // els de l'anterior, que és com es barregen dues gravacions en una.
    /*
     * Les banderes del senyal de vídeo fals només s'hi posen si la seqüència
     * ho demana: obrir sempre Chrome amb una càmera falsa faria que qualsevol
     * altra peça es gravés amb permisos que l'usuari real no té donats.
     */
    let flags: string[] = [];
    if (seq.camera) {
      const casa = mkdtempSync(join(tmpdir(), 'eclipsi-horitzo-'));
      const y4m = await feHoritzoY4m(casa, 9341);
      flags = [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-video-capture=${y4m}`,
      ];
    }
    const { cdp, tanca } = await obreChrome(9340, flags);
    try {
      const m = MIDES[seq.mida];
      await cdp.send('Emulation.setDeviceMetricsOverride', m);
      await cdp.send('Emulation.setTouchEmulationEnabled', {
        enabled: m.mobile,
      });
      const { p, n } = PUNTS[seq.punt];
      await cdp.send('Page.navigate', {
        url: `${BASE}?p=${p}&e=2026-08-12&n=${encodeURIComponent(n)}${seq.hash ?? ''}`,
      });
      await esperaCarrega(cdp);
      if (seq.hash) {
        await evalua(cdp, `location.hash = ${JSON.stringify(seq.hash)}`);
        await dorm(700);
      }
      await espera(
        () =>
          evalua<boolean>(
            cdp,
            `document.body.innerText.toLowerCase().includes('${XIFRA_BONA}')`,
          ),
        'la xifra amb el terreny descomptat',
      );

      if (seq.camera) {
        await cdp.send('Browser.grantPermissions', {
          origin: 'https://eclipsi.info',
          permissions: ['videoCapture', 'sensors'],
        });
        await cdp.send('DeviceOrientation.setDeviceOrientationOverride', {
          alpha: 75,
          beta: 82,
          gamma: 0,
        });
        // Dos tocs: la portada porta a la pestanya del cel i allà hi ha el
        // botó que obre la càmera de debò. Es mira el vídeo, no els clics.
        let obert = false;
        for (let i = 0; i < 3 && !obert; i++) {
          const premut = await evalua<boolean>(
            cdp,
            `(() => {
              const b = [...document.querySelectorAll('button')].find((e) =>
                (e.textContent || '').toLowerCase().includes('apunta el mòbil'));
              if (!b) return false;
              b.click();
              return true;
            })()`,
          );
          if (!premut) break;
          await dorm(4000);
          obert = await evalua<boolean>(
            cdp,
            `(() => {
              const v = document.querySelector('video');
              return !!v && v.readyState >= 2 && v.videoWidth > 0;
            })()`,
          );
        }
        if (!obert) console.warn('  ⚠ la càmera no s’ha obert');
        await dorm(4000);
      }

      await dorm(seq.abans ?? 2000);

      const { fotogrames, fi } = await grava(cdp, seq, treball);
      console.log(`  · ${seq.nom}: ${fotogrames.length} fotogrames`);
      munta(
        fotogrames,
        fi,
        treball,
        sortida,
        seq.nom,
        seq.gifAmple,
        seq.gifDes,
        seq.gifDurada,
      );
    } finally {
      await tanca();
      rmSync(treball, { recursive: true, force: true });
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
