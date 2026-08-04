/**
 * Un horitzó fals, per poder ensenyar el mode càmera sense càmera.
 *
 * PER QUÈ EXISTEIX. La funció diferencial de l'app —el camí del Sol dibuixat
 * damunt del teu horitzó real— no es pot capturar des d'un escriptori: no hi
 * ha ni càmera ni sensors. Chrome sap fer de càmera amb un fitxer de vídeo, i
 * aquest mòdul el fabrica.
 *
 * PERÒ NO ÉS UNA FOTOGRAFIA, I ES NOTA A POSTA. La silueta és plana i sense
 * gra, i el cel és un degradat net: ha de llegir-se com un gràfic. Tot el que
 * es publiqui amb aquest fons duu «simulacio» al nom, perquè aquesta casa no
 * vesteix una estimació de mesura ni un dibuix de fotografia.
 */
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { obreChrome, esperaCarrega, dorm } from './chrome.ts';

/** L'horitzó fals, dibuixat amb HTML per no dependre de cap imatge externa. */
const HORITZO_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0}
html,body{width:1280px;height:720px;overflow:hidden;background:#000}
.escena{position:relative;width:1280px;height:720px;
  background:linear-gradient(180deg,#0B1020 0%,#1D2340 34%,#4A3352 58%,#8A4B36 78%,#C46A2A 92%,#D97B22 100%)}
/* La carena. Una silueta plana i fosca: ha de llegir-se com un gràfic, no
   com una fotografia, i per això no hi ha ni textura ni gra. */
.carena{position:absolute;left:0;right:0;bottom:0;height:280px}
.nuvol{position:absolute;height:3px;border-radius:3px;background:rgba(255,225,190,.22)}
</style></head><body><div class="escena">
  <div class="nuvol" style="left:12%;bottom:330px;width:280px"></div>
  <div class="nuvol" style="left:46%;bottom:372px;width:180px;opacity:.7"></div>
  <div class="nuvol" style="left:64%;bottom:308px;width:340px;opacity:.5"></div>
  <svg class="carena" viewBox="0 0 1280 280" preserveAspectRatio="none">
    <path fill="#0A0C14" d="M0,190 L90,168 L180,196 L280,140 L360,172 L470,104
      L560,150 L660,120 L760,168 L880,132 L980,178 L1090,150 L1190,186 L1280,164
      L1280,280 L0,280 Z"/>
  </svg>
</div></body></html>`;

export async function feHoritzoY4m(
  treball: string,
  port = 9337,
): Promise<string> {
  const html = join(treball, 'horitzo.html');
  writeFileSync(html, HORITZO_HTML);

  const servidor = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(readFileSync(html));
  });
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
  const portHttp = (servidor.address() as { port: number }).port;

  const { cdp, tanca } = await obreChrome(port);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${portHttp}/` });
  await esperaCarrega(cdp);
  await dorm(600);
  const shot = await cdp.send<{ data: string }>('Page.captureScreenshot', {
    format: 'png',
  });
  const png = join(treball, 'horitzo.png');
  writeFileSync(png, Buffer.from(shot.data, 'base64'));
  await tanca();
  servidor.close();

  // Chrome vol un Y4M per fer de càmera. Deu segons en bucle són de sobres:
  // el que s'ha de veure és una pantalla, no una pel·lícula.
  const y4m = join(treball, 'horitzo.y4m');
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-loop', '1', '-i', png,
    '-t', '10', '-r', '15',
    '-pix_fmt', 'yuv420p', '-s', '1280x720',
    y4m,
  ]);
  return y4m;
}

