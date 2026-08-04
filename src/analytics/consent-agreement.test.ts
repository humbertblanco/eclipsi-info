/**
 * L'ACORD ENTRE `index.html` I EL NUCLI DEL CONSENTIMENT.
 *
 * ── QUÈ COMPARA AIXÒ AMB QUÈ, QUE ÉS L'ÚNICA PREGUNTA QUE IMPORTA ───────────
 *
 * Hi ha DUES implementacions de la mateixa regla —«què compta com un sí viu i
 * vàlid»— i han de coincidir:
 *
 *   · `src/core/analytics/consent.ts`, que és la font de la veritat, es prova
 *     sola i governa el que fa l'app un cop ha arrencat.
 *   · Sis línies dins d'`index.html`, que existeixen perquè el primer
 *     `page_view` surt abans que el bundle de React existeixi. No poden
 *     importar res: han de córrer abans que hi hagi mòduls.
 *
 * Dues còpies de la mateixa regla, en dos llenguatges, sense res que les
 * comparés: és LITERALMENT la família d'errors que documenta CLAUDE.md —el text
 * que anunciava «Galícia» d'una franja que no hi passa, la franja dibuixada que
 * deixava València fora—, i totes tenien la mateixa forma. Aquest fitxer és la
 * resposta a «què ho compara amb la realitat».
 *
 * Si divergissin en silenci, el símptoma seria caríssim de trobar: el
 * consentiment es desaria bé, el bàner no tornaria a sortir, i tot i així cada
 * visita es comptaria com una persona nova perquè la galeta no s'hauria aplicat
 * a temps. Tot funcionant, i la xifra malament.
 *
 * ── PER QUÈ ES LLEGEIX EL FITXER I NO ES PROVA EL COMPORTAMENT ──────────────
 *
 * Perquè el comportament que importa passa a `<head>`, abans de tot, i muntar
 * un navegador per provar-lo costaria mil vegades més que llegir un fitxer de
 * text. El que es prova aquí no és el marcatge: són els TRES NÚMEROS i la clau
 * de què depèn la decisió, més l'ORDRE de les crides, que és el que fa que
 * serveixi de res.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CONSENT_FUTURE_TOLERANCE_MS,
  CONSENT_MAX_AGE_MS,
  CONSENT_STORAGE_KEY,
} from '../core/analytics';

const here = dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = resolve(here, '../../index.html');

const raw = readFileSync(INDEX_HTML, 'utf8');

/**
 * El fitxer SENSE ELS COMENTARIS, que és l'única cosa contra la qual té sentit
 * mesurar un ordre.
 *
 * AIXÒ NO ÉS PULCRITUD: la primera versió d'aquest test va fallar el dia que es
 * va escriure, i va fallar bé. `index.html` documenta les seves pròpies línies
 * de consentiment i el comentari MENCIONA `gtag('config')` unes ratlles abans
 * que hi hagi la crida de debò. `indexOf` trobava la prosa, no el codi, i
 * conclouia que l'ordre era l'invers del que és.
 *
 * La lliçó, que val per a qualsevol test que llegeixi un fitxer de text: si el
 * projecte obliga a documentar les decisions dins del codi —i aquest hi
 * obliga—, un test que busqui cadenes trobarà la documentació abans que el codi
 * gairebé sempre. S'han de treure primer.
 *
 * Es treuen les línies que NOMÉS són comentari (`//` al principi, o dins d'un
 * bloc `<!-- -->`). No es toquen les que tenen codi i comentari a la mateixa
 * línia: allà el codi hi és de debò i ha de comptar.
 */
const html = ((): string => {
  const lines = raw.split('\n');
  const kept: string[] = [];
  let inHtmlComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (inHtmlComment) {
      if (trimmed.includes('-->')) inHtmlComment = false;
      continue;
    }
    if (trimmed.startsWith('<!--')) {
      if (!trimmed.includes('-->')) inHtmlComment = true;
      continue;
    }
    // Comentari de línia de JavaScript. El `startsWith` evita menjar-se els
    // `https://` del mig d'una línia, que és l'error clàssic d'aquest filtre.
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    kept.push(line);
  }

  return kept.join('\n');
})();

describe('index.html i el nucli diuen el mateix sobre el consentiment', () => {
  it('«la clau desada és la mateixa als dos costats»', () => {
    // Si el nucli canviés de clau i l'HTML no, el consentiment es desaria en un
    // lloc i es llegiria d'un altre: el bàner desapareixeria i la galeta no
    // s'aplicaria mai.
    expect(html).toContain(`localStorage.getItem('${CONSENT_STORAGE_KEY}')`);
  });

  it('«la caducitat és la mateixa als dos costats»', () => {
    expect(CONSENT_MAX_AGE_MS).toBe(31536000000);
    expect(html).toContain(String(CONSENT_MAX_AGE_MS));
  });

  it('«el marge de rellotge és el mateix als dos costats»', () => {
    // A l'HTML va en negatiu perquè es compara contra una edat («fa quant»),
    // no contra una data. El número ha de ser el mateix.
    expect(CONSENT_FUTURE_TOLERANCE_MS).toBe(300000);
    expect(html).toContain(`-${CONSENT_FUTURE_TOLERANCE_MS}`);
  });
});

describe('l’ordre d’index.html, que és tota la raó de ser d’aquestes línies', () => {
  it('«el per defecte denegat va abans que carregui res de Google»', () => {
    const defaultAt = html.indexOf("gtag('consent', 'default'");
    const scriptAt = html.indexOf('googletagmanager.com/gtag/js');

    expect(defaultAt).toBeGreaterThan(-1);
    expect(scriptAt).toBeGreaterThan(-1);
    /*
     * El `<script async>` de Google és ABANS al document, i està bé: `async`
     * vol dir que no s'executa fins que el navegador ha acabat de llegir aquest
     * bloc en línia. El que no pot passar mai és que el `default` deixi
     * d'estar dins del mateix bloc síncron, perquè llavors hi hauria una
     * finestra amb galeta. Es comprova que el `default` és la PRIMERA ordre de
     * consentiment del fitxer.
     */
    expect(defaultAt).toBeLessThan(html.indexOf("gtag('consent', 'update'"));
  });

  it('«el sí desat s’aplica ABANS de la primera vista de pàgina»', () => {
    // Aquesta és la prova que justifica que el codi visqui a l'HTML. Si algú
    // el mou després del `config`, el primer page_view de cada sessió tornaria
    // a sortir sense galeta i la xifra d'usuaris tornaria a ser càrregues.
    const updateAt = html.indexOf("gtag('consent', 'update'");
    const configAt = html.indexOf("gtag('config'");

    expect(updateAt).toBeGreaterThan(-1);
    expect(configAt).toBeGreaterThan(-1);
    expect(updateAt).toBeLessThan(configAt);
  });

  it('«només s’obre la casella de mesura, mai cap de publicitat»', () => {
    // El bàner no ofereix cap tracte sobre publicitat, i per tant no n'ha de
    // poder concedir cap. L'única cosa que `update` pot tocar és aquesta.
    const update = html.slice(
      html.indexOf("gtag('consent', 'update'"),
      html.indexOf("gtag('js'"),
    );
    expect(update).toContain("analytics_storage: 'granted'");
    expect(update).not.toContain('ad_storage');
    expect(update).not.toContain('ad_user_data');
    expect(update).not.toContain('ad_personalization');
  });

  it('«els senyals publicitaris segueixen denegats per defecte i sense pregunta»', () => {
    const defaults = html.slice(
      html.indexOf("gtag('consent', 'default'"),
      html.indexOf("gtag('consent', 'update'"),
    );
    for (const key of ['ad_storage', 'ad_user_data', 'ad_personalization']) {
      expect(defaults).toContain(`${key}: 'denied'`);
    }
    // I la mesura també arrenca denegada: el sí l'ha d'obrir explícitament.
    expect(defaults).toContain("analytics_storage: 'denied'");
  });
});

describe('la promesa que no es negocia', () => {
  it('«l’adreça que viatja a Google no porta mai la consulta»', () => {
    // `?p=lat,lon` és la posició de l'usuari. Aquesta funció és el retall, i
    // que existeixi amb aquest cos exacte és el que fa certa la frase del peu.
    expect(html).toContain('location.origin + location.pathname + location.hash');
    // I el `config` l'ha de fer servir, no `location.href`.
    expect(html).not.toContain('location.href');
  });
});
