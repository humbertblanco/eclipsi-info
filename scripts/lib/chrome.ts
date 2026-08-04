/**
 * Un Chrome de veritat, conduït per CDP, sense cap dependència.
 *
 * PER QUÈ NO PUPPETEER. Tot el que necessiten els dos guions que fan servir
 * això —obrir una pàgina, esperar que digui una frase, prémer un botó pel seu
 * nom accessible i disparar una captura— són quatre mètodes del protocol.
 * Puppeteer són 300 MB de `node_modules` i una versió de Chrome pròpia que
 * caldria mantenir al dia. Node 22 ja porta `WebSocket` i `fetch` de sèrie i
 * el navegador ja és a l'ordinador: el pont hi cap en cinquanta línies.
 *
 * PER QUÈ AMB FINESTRA I NO `--headless`. El mapa de l'app és WebGL. En
 * headless caldria SwiftShader, i el relleu ombrejat i la franja poden sortir
 * diferents del que veu la gent. El que publiquem s'ha d'assemblar al
 * producte, o no serveix de res.
 *
 * PERFIL TEMPORAL SEMPRE. Ni cookies, ni sessions, ni extensions, ni el zoom
 * que algú es va deixar posat: cada tanda arrenca d'un Chrome que no ha vist
 * mai aquesta web. És l'única manera que dues tandes fetes amb un mes de
 * diferència es puguin comparar.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CHROME_BIN =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export const dorm = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Client CDP mínim: enviar comandes i rebre'n el resultat. Res més. */
export class Cdp {
  private ws: WebSocket;
  private id = 0;
  private pending = new Map<
    number,
    { ok: (v: unknown) => void; ko: (e: Error) => void }
  >();

  /**
   * Escoltadors d'esdeveniments, per mètode.
   *
   * Calen per gravar: `Page.screencastFrame` arriba SENSE `id` i, sense això,
   * els fotogrames es llençaven en silenci i el vídeo sortia buit.
   */
  private escoltes = new Map<string, ((params: unknown) => void)[]>();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id === undefined) {
        for (const cb of this.escoltes.get(msg.method) ?? []) cb(msg.params);
        return;
      }
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.ko(new Error(`${msg.error.message} (${msg.error.code})`));
      else p.ok(msg.result);
    });
  }

  /** Escolta un esdeveniment del protocol (`Page.screencastFrame`, …). */
  on<T>(method: string, cb: (params: T) => void) {
    const l = this.escoltes.get(method) ?? [];
    l.push(cb as (params: unknown) => void);
    this.escoltes.set(method, l);
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

export interface Sessio {
  cdp: Cdp;
  tanca: () => Promise<void>;
}

/**
 * Arrenca Chrome amb perfil nou, s'hi connecta i torna la sessió.
 *
 * El port es demana fins que respon en comptes de dormir un nombre de segons
 * triat a ull: en una màquina carregada, aquell nombre sempre acaba sent curt.
 */
export async function obreChrome(
  port = 9333,
  extra: string[] = [],
): Promise<Sessio> {
  const perfil = join(tmpdir(), `eclipsi-cdp-${port}-${process.pid}`);
  mkdirSync(perfil, { recursive: true });
  const proc: ChildProcess = spawn(
    CHROME_BIN,
    [
      ...extra,
      `--remote-debugging-port=${port}`,
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

  let ok = false;
  for (let i = 0; i < 80; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`);
      ok = true;
      break;
    } catch {
      await dorm(250);
    }
  }
  if (!ok) throw new Error('Chrome no ha obert el port de depuració');

  const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
    method: 'PUT',
  });
  const target = (await r.json()) as { webSocketDebuggerUrl: string };
  const cdp = await Cdp.attach(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  return {
    cdp,
    tanca: async () => {
      cdp.close();
      proc.kill();
      await dorm(500);
      rmSync(perfil, { recursive: true, force: true });
    },
  };
}

/** Avalua una expressió a la pàgina i en torna el valor. */
export async function evalua<T>(cdp: Cdp, expression: string): Promise<T> {
  const r = await cdp.send<{ result: { value: T } }>('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return r.result.value;
}

/**
 * Espera una condició amb sostre, i avisa si el sostre s'esgota.
 *
 * El sostre no és decoració: si la xarxa va malament val més una captura
 * tardana amb un avís a la consola que un guió penjat per sempre en silenci.
 */
export async function espera(
  cond: () => Promise<boolean>,
  quePasses: string,
  sostreMs = 60_000,
): Promise<boolean> {
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

/** Espera que la pàgina hagi acabat de carregar-se. */
export const esperaCarrega = (cdp: Cdp) =>
  espera(
    async () => (await evalua<string>(cdp, 'document.readyState')) === 'complete',
    'la càrrega',
    30_000,
  );
