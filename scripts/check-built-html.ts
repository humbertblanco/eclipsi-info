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
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  if (html.includes('<!--')) throw new Error(`Comentari HTML públic: ${file}`);
  if (!html.includes('brand/favicon-google-96.png')) throw new Error(`Favicon no canònic: ${file}`);
  const locale = /<html lang="(ca|es|en|fr)"/.exec(html)?.[1];
  const noindex = /<meta[^>]+name="robots"[^>]+content="noindex"/.test(html);
  if (!noindex && locale !== undefined && !html.includes(`brand/og-${locale}.png`)) {
    throw new Error(`Targeta social incorrecta per a ${locale}: ${file}`);
  }
}

console.log(`HTML públic comprovat: ${htmlFiles.length} fitxers, sense comentaris i amb actius localitzats.`);
