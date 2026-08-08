/**
 * L'HTML públic no porta comentaris del codi font i cada idioma anuncia els
 * seus actius socials. Aquesta comprovació corre al final del build, quan les
 * landings SEO ja existeixen: comprovar abans deixaria 1.316 pàgines fora.
 */
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve(process.env.ECLIPSI_OUT_DIR ?? 'dist');
const htmlFiles: string[] = [];

async function visit(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) await visit(file);
    else if (entry.name.endsWith('.html')) htmlFiles.push(file);
  }
}

await visit(out);

/*
 * EL SERVICE WORKER NO POT TORNAR A MENJAR-SE LES PÀGINES EDITORIALS.
 *
 * `src/content/seo/routes.test.ts` prova que el patró i els camins encaixen,
 * però prova DOS MÒDULS, no el fitxer que s'acaba publicant. Entre l'un i
 * l'altre hi ha Workbox, que és qui podria deixar l'opció fora sense dir res
 * —d'una versió a l'altra, o si algú toca la configuració.
 *
 * Això corre al final de cada build i mira el `sw.js` de debò: agafa una URL
 * editorial que existeix i exigeix que algun dels patrons de la llista la
 * reconegui. Si no, el build s'atura, que és molt millor que descobrir-ho al
 * cap de tres dies amb el Chrome apuntant a producció.
 */
const serviceWorker = await readFile(resolve(out, 'sw.js'), 'utf8');
const denylistDeclarada = /denylist:\s*\[([^\]]*)\]/.exec(serviceWorker)?.[1];
if (denylistDeclarada === undefined) {
  throw new Error(
    'El sw.js no declara cap denylist de navegació: totes les pàgines editorials ' +
      'tornaran l’esquelet de l’app. Vegeu navigateFallbackDenylist a vite.config.ts.',
  );
}
const patrons = [...denylistDeclarada.matchAll(/\/((?:[^/\\]|\\.)+)\/([a-z]*)/g)].map(
  ([, body, flags]) => new RegExp(body, flags),
);
for (const camí of ['/ciutat/barcelona/12-08-2026/', '/fr/site-officiel/x/12-08-2026/', '/es/guia/']) {
  if (!patrons.some((patró) => patró.test(camí))) {
    throw new Error(`El sw.js serviria l’app a ${camí} en comptes de la pàgina publicada.`);
  }
}
if (patrons.some((patró) => patró.test('/com-funciona/'))) {
  throw new Error('El sw.js deixaria «Com funciona» sense esquelet: el patró és massa ample.');
}

/*
 * EL SITEMAP ARA ÉS UN ÍNDEX, I LA COMPROVACIÓ EL SEGUEIX FINS AL FINAL.
 *
 * `sitemap.xml` va deixar de ser un fitxer d'1 MB amb 1.328 URL i va passar a
 * ser un `<sitemapindex>` amb un fitxer per mena de pàgina. Si aquesta
 * comprovació s'hagués quedat mirant només l'arrel, hauria passat en verd
 * validant cinc URL —les dels sitemaps— i cap de les 1.328 de debò. Una prova
 * que es fa més fluixa quan el codi creix és pitjor que no tenir-la.
 *
 * O sigui que aquí es baixa un nivell: es llegeix l'índex, s'obre cada fill i
 * es valida el conjunt sencer, que és el que Google acabarà rastrejant.
 */
const sitemapIndex = await readFile(resolve(out, 'sitemap.xml'), 'utf8');
if (!sitemapIndex.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
  throw new Error('El sitemap no té una declaració XML UTF-8 vàlida.');
}
if (!sitemapIndex.includes('<sitemapindex')) {
  throw new Error('sitemap.xml hauria de ser un índex de sitemaps.');
}

const childSitemaps = [...sitemapIndex.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
if (childSitemaps.length === 0) throw new Error('L’índex de sitemaps és buit.');

const sitemapUrls: string[] = [];
for (const child of childSitemaps) {
  const name = new URL(child).pathname.replace(/^\//, '');
  const xml = await readFile(resolve(out, name), 'utf8').catch(() => {
    throw new Error(`L’índex anuncia ${child} i el fitxer no existeix a ${out}.`);
  });
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  if (urls.length === 0) throw new Error(`${name} no conté cap URL.`);
  // El límit del format és 50.000 per fitxer; l'índex existeix per no
  // acostar-s'hi mai, i si algun dia s'hi acosta val més saber-ho aquí.
  if (urls.length > 50_000) throw new Error(`${name} passa del límit de 50.000 URL.`);
  sitemapUrls.push(...urls);
  // Un `lastmod` per URL i, a més, vàlid: la constant escrita a mà que hi
  // havia («2026-08-07») mentia cada dia a partir del vuit.
  const lastmods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((match) => match[1]);
  if (lastmods.length !== urls.length) {
    throw new Error(`${name}: ${urls.length} URL i ${lastmods.length} lastmod.`);
  }
  for (const lastmod of lastmods) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lastmod) || Number.isNaN(Date.parse(lastmod))) {
      throw new Error(`${name}: lastmod invàlid «${lastmod}».`);
    }
  }
}

if (new Set(sitemapUrls).size !== sitemapUrls.length) {
  throw new Error('Els sitemaps contenen URL duplicades.');
}
for (const entry of [...childSitemaps, ...sitemapUrls]) {
  const url = new URL(entry);
  if (url.protocol !== 'https:' || url.hostname !== 'eclipsi.info') {
    throw new Error(`URL no canònica al sitemap: ${entry}`);
  }
}

/*
 * I TOTA URL DEL SITEMAP HA DE TENIR UN FITXER AL DARRERE.
 *
 * És la comprovació que faltava i la més barata: un sitemap que anuncia una
 * pàgina que no s'ha generat li fa perdre el temps al rastrejador i, a Search
 * Console, surt com un error que no diu d'on ve.
 */
for (const entry of sitemapUrls) {
  const path = new URL(entry).pathname.replace(/^\//, '');
  const file = resolve(out, path, 'index.html');
  const exists = await readFile(file, 'utf8').then(() => true).catch(() => false);
  if (!exists) throw new Error(`El sitemap anuncia ${entry} i no hi ha cap ${file}.`);
}

/*
 * ELS QUATRE INDEX LOCALITZATS, COMPROVATS UN PER UN I NO «EL QUE HI HAGI».
 *
 * `vite.config.ts` fabrica `/es/`, `/en/` i `/fr/` a partir del català amb una
 * cadena de quinze `.replace()` de literals exactes. El mode de fallada
 * d'aquesta tècnica sempre és el mateix: algú toca una frase de l'`index.html`,
 * el literal deixa de casar i la substitució no es fa —en silenci, perquè
 * `String.replace()` no es queixa mai quan no troba res.
 *
 * La comprovació que hi havia buscava el `lang` amb una expressió regular i, si
 * no el trobava, se saltava la comprovació sencera (`locale !== undefined`). O
 * sigui que el cas dolent —`dist/es/index.html` amb `lang="ca"` i la targeta
 * catalana— passava content. Aquí es demana per fitxer ESPERAT: els quatre han
 * d'existir, tenir cadascun el seu idioma, la seva canònica i la seva targeta.
 */
for (const locale of ['ca', 'es', 'en', 'fr'] as const) {
  const prefix = locale === 'ca' ? '' : `${locale}/`;
  const file = resolve(out, prefix, 'index.html');
  const html = await readFile(file, 'utf8').catch(() => {
    throw new Error(`Falta l’index de ${locale}: ${file}`);
  });
  if (!html.includes(`<html lang="${locale}">`)) {
    throw new Error(`${file} no declara lang="${locale}": la localització no s’ha aplicat.`);
  }
  if (!html.includes(`<link rel="canonical" href="https://eclipsi.info/${prefix}"`)) {
    throw new Error(`${file} no té la canònica de https://eclipsi.info/${prefix}`);
  }
  if (!html.includes(`brand/og-${locale}.png`)) {
    throw new Error(`${file} no porta la targeta social og-${locale}.png`);
  }
}

/*
 * DUES CANÒNIQUES DIFERENTS NO PODEN COMPARTIR TÍTOL.
 *
 * Les vuit pàgines de «Com funciona» i «Premsa» es fabriquen copiant l'index de
 * cada idioma i reescrivint-ne unes quantes etiquetes. Durant un temps només
 * se'n reescrivien dues —la canònica i l'`og:url`— i les vuit sortien amb el
 * títol i la descripció de la portada: vuit URL indexables anunciant-se com una
 * novena. Google ho llegeix com a duplicats i tria ell quina ensenya.
 *
 * Això no es pot vigilar amb una prova unitària, perquè el defecte no és a cap
 * funció: és a la cadena de substitucions que corre al final del build. Aquí
 * sí.
 */
const titlesByLocale = new Map<string, Map<string, string[]>>();

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
  const language = /<html lang="(ca|es|en|fr)"/.exec(html)?.[1];
  if (canonical !== undefined && title !== undefined && language !== undefined) {
    const perLocale = titlesByLocale.get(language) ?? new Map<string, string[]>();
    perLocale.set(title, [...(perLocale.get(title) ?? []), canonical]);
    titlesByLocale.set(language, perLocale);
  }
  if (html.includes('<!--')) throw new Error(`Comentari HTML públic: ${file}`);
  for (const script of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([^]*?)<\/script>/g)) {
    if (!/type=["']application\/ld\+json["']/.test(script[1]) && /^\s*\/\//m.test(script[2])) {
      throw new Error(`Comentari JavaScript inline públic: ${file}`);
    }
  }
  for (const style of html.matchAll(/<style\b[^>]*>([^]*?)<\/style>/g)) {
    if (/\/\*/.test(style[1])) throw new Error(`Comentari CSS inline públic: ${file}`);
  }
  if (!html.includes('brand/favicon-google-96.png')) throw new Error(`Favicon no canònic: ${file}`);
  const locale = /<html lang="(ca|es|en|fr)"/.exec(html)?.[1];
  const noindex = /<meta[^>]+name="robots"[^>]+content="noindex"/.test(html);
  if (!noindex && locale !== undefined && !html.includes(`brand/og-${locale}.png`)) {
    throw new Error(`Targeta social incorrecta per a ${locale}: ${file}`);
  }
}

for (const [language, perLocale] of titlesByLocale) {
  for (const [title, urls] of perLocale) {
    if (urls.length > 1) {
      throw new Error(
        `Títol repetit en ${urls.length} URL canòniques de ${language}: «${title}»\n  ` +
          urls.join('\n  '),
      );
    }
  }
}

console.log(`HTML públic comprovat: ${htmlFiles.length} fitxers, sense comentaris i amb actius localitzats.`);
