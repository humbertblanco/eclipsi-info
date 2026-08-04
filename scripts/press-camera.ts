/**
 * El mode càmera, capturat sense càmera.
 *
 * EL PROBLEMA. La funció diferencial de l'app —apuntes el mòbil al cel i hi
 * veus per on vindrà el Sol, dibuixat damunt del teu horitzó real— no es pot
 * ensenyar amb una captura d'escriptori: no hi ha ni càmera ni sensors. I
 * demanar-li a algú que surti al carrer amb el mòbil dona una foto per
 * campanya, feta amb la llum d'aquell dia i impossible de refer igual.
 *
 * LA SOLUCIÓ, I LA SEVA LLETRA PETITA. Chrome sap fer de càmera amb un fitxer
 * de vídeo (`--use-file-for-fake-video-capture`) i CDP sap mentir sobre
 * l'orientació del dispositiu (`DeviceOrientation.setDeviceOrientationOverride`).
 * Amb les dues coses, la pantalla d'AR s'obre i pinta.
 *
 * PERÒ EL FONS NO ÉS UNA FOTO, I AIXÒ S'HA DE DIR. El senyal de vídeo que
 * s'injecta és un horitzó SINTÈTIC generat aquí mateix: un degradat de
 * capvespre i una silueta de carena. El que és producte de veritat és la CAPA
 * de sobre —el camí del Sol, el HUD, els avisos de seguretat—, i el fitxer es
 * diu `camera-simulacio-*.png` justament perquè ningú no el pugui publicar
 * pensant-se que és una fotografia. Aquesta casa no vesteix una estimació de
 * mesura, i tampoc no vesteix un gràfic de fotografia.
 *
 * ÚS: npx tsx scripts/press-camera.ts
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { obreChrome, evalua, espera, esperaCarrega, dorm } from './lib/chrome.ts';
import { feHoritzoY4m } from './lib/horitzo-fals.ts';

/** Tarragona: 58 s de totalitat i el Sol a 4,4°, cap a l'oest. */
const PUNT = { p: '41.11724,1.25461', n: 'Tarragona' };
const BASE = 'https://eclipsi.info/';

/*
 * L'orientació que s'injecta: mirant a l'oest i amb el mòbil dret.
 *
 * A `deviceorientation`, alpha 0 és mirar al nord i creix en sentit
 * antihorari, o sigui que per mirar cap a 285° (que és cap on serà el Sol al
 * màxim des d'aquest punt) cal alpha = 360 − 285 = 75. Beta 82° és el mòbil
 * gairebé vertical, una mica alçat: la postura de qui mira l'horitzó.
 */
const ORIENTACIO = { alpha: 75, beta: 82, gamma: 0 };

async function main() {
  const sortida = join(homedir(), 'Desktop', 'eclipsi-premsa', 'captures', 'camera');
  mkdirSync(sortida, { recursive: true });
  const treball = join(tmpdir(), `eclipsi-camera-${process.pid}`);
  mkdirSync(treball, { recursive: true });

  console.log('Fabricant l’horitzó sintètic…');
  const y4m = await feHoritzoY4m(treball);
  if (!existsSync(y4m)) throw new Error('el senyal de vídeo no s’ha creat');

  const { cdp, tanca } = await obreChrome(9338, [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${y4m}`,
  ]);

  try {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await cdp.send('Browser.grantPermissions', {
      origin: 'https://eclipsi.info',
      permissions: ['videoCapture', 'sensors'],
    });
    await cdp.send('DeviceOrientation.setDeviceOrientationOverride', ORIENTACIO);

    const url = `${BASE}?p=${PUNT.p}&e=2026-08-12&n=${encodeURIComponent(PUNT.n)}`;
    await cdp.send('Page.navigate', { url });
    await esperaCarrega(cdp);
    await espera(
      () =>
        evalua<boolean>(
          cdp,
          `document.body.innerText.toLowerCase().includes('durada visible')`,
        ),
      'la xifra amb el terreny descomptat',
    );

    // La invitació, que ja és una peça per si sola: l'app no obre mai la
    // càmera sola i això és una decisió que val la pena ensenyar.
    await dorm(600);
    await desa(cdp, sortida, 'camera-01-invitacio');

    /*
     * EL BOTÓ S'HA DE PRÉMER DUES VEGADES, I NO ÉS UN ERROR DE L'APP.
     *
     * A la portada, «Apunta el mòbil al cel» és una invitació que et porta a
     * la pestanya del cel; allà hi ha el mateix botó, i aquell sí que obre la
     * càmera. És la regla de la casa —no es demana res sense explicar-ho
     * abans— vista des de fora: hi ha una pantalla sencera entremig que et diu
     * per a què la vol i que la imatge no surt del telèfon.
     *
     * Per això no es compta clics: es mira si hi ha vídeo. Si un dia la
     * invitació desapareix, això seguirà funcionant.
     */
    let obert = false;
    for (let i = 0; i < 3 && !obert; i++) {
      const premut = await evalua<boolean>(
        cdp,
        `(() => {
          const b = [...document.querySelectorAll('button')].find(e =>
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
    if (!obert)
      throw new Error(
        'la càmera no s’ha obert: no hi ha cap <video> amb fotogrames',
      );

    // La fusió de sensors necessita uns quants fotogrames per assentar-se.
    await dorm(5000);
    await cdp.send('DeviceOrientation.setDeviceOrientationOverride', ORIENTACIO);
    await dorm(2500);
    await desa(cdp, sortida, 'camera-simulacio-02-cel');

    // Un segon enquadrament, un pèl més amunt: ensenya que la capa segueix
    // el moviment i no és un dibuix enganxat a la pantalla.
    await cdp.send('DeviceOrientation.setDeviceOrientationOverride', {
      ...ORIENTACIO,
      beta: 74,
    });
    await dorm(3000);
    await desa(cdp, sortida, 'camera-simulacio-03-horitzo');

    /*
     * MINIATURES DEL HUD. Aquí el retall va per rectangle i no per selector,
     * i és a posta: gairebé tot el que es veu en aquesta pantalla està pintat
     * a un `<canvas>` —la brúixola, el recorregut del Sol, la corona— i un
     * canvas no té fills que es puguin seleccionar. Les mides són en píxels de
     * CSS del mòbil emulat (390 × 844) i surten a 3×.
     */
    await cdp.send('DeviceOrientation.setDeviceOrientationOverride', ORIENTACIO);
    await dorm(2500);
    await retalla(cdp, sortida, 'camera-simulacio-04-bruixola', 0, 0, 390, 88);
    await retalla(cdp, sortida, 'camera-simulacio-05-recorregut', 0, 88, 390, 240);
    await retalla(cdp, sortida, 'camera-simulacio-06-lectura', 0, 700, 390, 144);
  } finally {
    await tanca();
  }
}

/** Un rectangle de la pantalla, en píxels de CSS del dispositiu emulat. */
async function retalla(
  cdp: Awaited<ReturnType<typeof obreChrome>>['cdp'],
  dir: string,
  nom: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const shot = await cdp.send<{ data: string }>('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x, y, width, height, scale: 1 },
  });
  const dades = Buffer.from(shot.data, 'base64');
  writeFileSync(join(dir, `${nom}.png`), dades);
  console.log(
    `  ✓ ${nom.padEnd(30)} ${width * 3}×${height * 3}  ${Math.round(dades.length / 1024)} kB`,
  );
}

async function desa(
  cdp: Awaited<ReturnType<typeof obreChrome>>['cdp'],
  dir: string,
  nom: string,
) {
  const shot = await cdp.send<{ data: string }>('Page.captureScreenshot', {
    format: 'png',
  });
  const dades = Buffer.from(shot.data, 'base64');
  writeFileSync(join(dir, `${nom}.png`), dades);
  console.log(`  ✓ ${nom.padEnd(30)} ${Math.round(dades.length / 1024)} kB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
