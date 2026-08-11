/**
 * Què ensenya Google com a icona d'eclipsi.info, i és el que hauria d'ensenyar?
 *
 * Ús: npx tsx scripts/check-favicon.ts   (o `npm run check:favicon`)
 *
 * PER QUÈ EXISTEIX AQUEST FITXER. Perquè durant una setmana la conversa sobre
 * el llamp lila de Vite es va fer sencera a base d'intuïció: «crec que encara
 * està». I la intuïció, aquí, mirava una SERP que el navegador podia tenir
 * desada. Cada vegada que algú ho volia saber de debò calia repetir a mà la
 * mateixa dotzena de `curl`, i cada vegada se n'oblidava alguna.
 *
 * El que fa és separar les dues preguntes que sempre s'havien barrejat:
 *
 *   1. SERVIM EL QUE CREIEM QUE SERVIM? Checksum de cada icona del disc contra
 *      el de la seva URL pública. Si això falla, el problema és nostre i es
 *      soluciona desplegant. (Amb `?cb=` per saltar la vora de Cloudflare: el
 *      que interessa és l'origen, no la còpia del CDN.)
 *
 *   2. GOOGLE JA HO HA VIST? Els bytes que retorna el seu magatzem d'icones
 *      (`t*.gstatic.com/faviconV2`). Aquesta és la que decideix què surt a la
 *      SERP, i no la controlem: només es pot mirar.
 *
 * COM ES DISTINGEIX EL LLAMP DE LA LLUNA SENSE MIRAR-LA. El llamp de la
 * plantilla és un JPEG de 48×46 —no és quadrat, i totes les nostres icones ho
 * són— i el seu SHA-256 comença per 7ed02838. Amb això n'hi ha prou per donar
 * un veredicte sense obrir cap visor. Si algun dia Google torna una imatge
 * quadrada i amb un hash que no coneixem, l'script ho diu i demana que algú hi
 * posi els ulls: preferim un «no ho sé» a un «sí» inventat.
 *
 * NO forma part del build ni de les proves. És una eina de camp: fa xarxa, i
 * depèn d'un servei de tercers que pot canviar de forma sense avisar.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const PUBLIC = join(import.meta.dirname, '..', 'public');
const SITE = 'https://eclipsi.info';

/** El llamp lila de la plantilla, tal com el servia Google el 9-8-2026. */
const LLAMP_SHA256 = '7ed02838ef2113b4b2c4' as const;
const LLAMP_MIDES = { w: 48, h: 46 } as const;

/**
 * Les icones que es publiquen, amb la seva ruta pública. `favicon-48.png` hi és
 * encara que cap `<link>` no la declari: és la font del `.ico` i si es mou, es
 * mou el que veuen els clients vells.
 */
const ICONES = [
  'favicon.ico',
  'favicon.svg',
  'favicon-48.png',
  'brand/favicon-google-96.png',
  'app-icons/apple-touch-icon.png',
  'app-icons/icon-192.png',
  'app-icons/icon-512.png',
  'app-icons/icon-maskable-512.png',
  'app-icons/icon.svg',
] as const;

/**
 * Rutes que el món demana per convenció sense llegir mai l'HTML. Van tenir
 * 8.158 respostes 404 en nou dies fins que `public/.htaccess` les va reescriure
 * cap a la icona de debò; això vigila que no tornin a obrir-se.
 */
const RUTES_PER_CONVENCIO = [
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/apple-touch-icon-120x120.png',
  '/apple-touch-icon-180x180-precomposed.png',
  '/favicon.ico',
] as const;

const sha = (b: Buffer | Uint8Array) => createHash('sha256').update(b).digest('hex');
const curt = (h: string) => h.slice(0, 20);

const VERD = '\x1b[32m';
const VERMELL = '\x1b[31m';
const GROC = '\x1b[33m';
const FLUIX = '\x1b[2m';
const FI = '\x1b[0m';

let problemes = 0;

async function baixa(url: string): Promise<{ bytes: Uint8Array; status: number } | null> {
  try {
    const r = await fetch(url, { redirect: 'follow' });
    return { bytes: new Uint8Array(await r.arrayBuffer()), status: r.status };
  } catch {
    return null;
  }
}

/** Mides d'un PNG o d'un JPEG, sense descodificar la imatge sencera. */
function mides(b: Uint8Array): { w: number; h: number } | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b[0] === 0x89 && b[1] === 0x50) return { w: v.getUint32(16), h: v.getUint32(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      // SOF0..SOF15, saltant els marcadors que no porten mides.
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: v.getUint16(i + 5), w: v.getUint16(i + 7) };
      }
      i += 2 + v.getUint16(i + 2);
    }
  }
  return null;
}

// ─── 1. Servim el que creiem que servim? ─────────────────────────────────────

console.log(`\n${FLUIX}── Les nostres icones: disc contra URL pública ──${FI}\n`);

for (const ruta of ICONES) {
  const local = sha(readFileSync(join(PUBLIC, ruta)));
  // El paràmetre a l'atzar salta la cau de Cloudflare i pregunta a l'origen.
  const remot = await baixa(`${SITE}/${ruta}?cb=${process.pid}${ICONES.indexOf(ruta)}`);

  if (!remot || remot.status !== 200) {
    console.log(`${VERMELL}✗${FI} ${ruta.padEnd(34)} ${remot ? `HTTP ${remot.status}` : 'sense resposta'}`);
    problemes++;
  } else if (sha(remot.bytes) !== local) {
    console.log(`${VERMELL}✗${FI} ${ruta.padEnd(34)} disc ${curt(local)} ≠ públic ${curt(sha(remot.bytes))}`);
    problemes++;
  } else {
    console.log(`${VERD}✓${FI} ${ruta.padEnd(34)} ${FLUIX}${curt(local)}${FI}`);
  }
}

// ─── 2. Les rutes que ningú declara però tothom demana ───────────────────────

console.log(`\n${FLUIX}── Rutes per convenció (les que van fer 8.158 404) ──${FI}\n`);

for (const ruta of RUTES_PER_CONVENCIO) {
  const r = await baixa(`${SITE}${ruta}?cb=${process.pid}`);
  if (!r || r.status !== 200) {
    console.log(`${VERMELL}✗${FI} ${ruta.padEnd(46)} ${r ? `HTTP ${r.status}` : 'sense resposta'}`);
    problemes++;
  } else {
    console.log(`${VERD}✓${FI} ${ruta.padEnd(46)} ${FLUIX}200, ${r.bytes.length} bytes${FI}`);
  }
}

// ─── 3. Què en té Google ─────────────────────────────────────────────────────

console.log(`\n${FLUIX}── El magatzem d'icones de Google ──${FI}\n`);

const google = await baixa(
  `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${SITE}&size=64`,
);

if (!google || google.status !== 200) {
  console.log(`${GROC}?${FI} no s'ha pogut consultar el magatzem de Google.`);
} else {
  const h = sha(google.bytes);
  const m = mides(google.bytes);
  const mText = m ? `${m.w}×${m.h}` : 'mides desconegudes';

  if (curt(h) === LLAMP_SHA256) {
    console.log(`${VERMELL}✗ ENCARA EL LLAMP${FI} — ${mText}, ${curt(h)}`);
    console.log(
      `${FLUIX}  Els mateixos bytes que el 9-8-2026. No és cap defecte nostre:\n` +
        `  vol dir que el robot de favicons de Google encara no ha tornat.${FI}`,
    );
    problemes++;
  } else if (m && m.w === LLAMP_MIDES.w && m.h === LLAMP_MIDES.h) {
    console.log(`${GROC}? sospitós${FI} — ${mText} és la mida del llamp però el hash ha canviat (${curt(h)}).`);
    console.log(`${FLUIX}  Mira-t'ho amb els ulls abans de cantar victòria.${FI}`);
    problemes++;
  } else if (m && m.w === m.h) {
    console.log(`${VERD}✓ ha canviat${FI} — ${mText} (quadrada), ${curt(h)}`);
    console.log(`${FLUIX}  Ja no és el llamp. Confirma-ho mirant-la abans de tancar el cas.${FI}`);
  } else {
    console.log(`${GROC}?${FI} imatge desconeguda — ${mText}, ${curt(h)}. Cal mirar-la.`);
  }
}

console.log(
  problemes === 0
    ? `\n${VERD}Tot al seu lloc.${FI}\n`
    : `\n${VERMELL}${problemes} ${problemes === 1 ? 'cosa demana atenció' : 'coses demanen atenció'}.${FI}\n`,
);

process.exit(problemes === 0 ? 0 : 1);
