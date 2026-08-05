/**
 * Que el castellà no arribi tard.
 *
 * PER QUÈ EXISTEIX. En aquest projecte el mateix defecte ha passat cinc
 * vegades i sempre igual: algú escriu un text, l'escriu en català, i el
 * castellà no apareix fins que algú obre l'app en castellà i troba una frase
 * catalana enmig. El veredicte, el guió de la totalitat, la zona de realitat
 * augmentada, el progrés de l'horitzó i —fins avui— els seus errors.
 *
 * QUÈ VIGILA I QUÈ NO, QUE ÉS LA PART IMPORTANT.
 *
 * El compilador ja fa una part de la feina i no s'ha de duplicar: les taules
 * `{ ca, es }` porten `as const satisfies Record<string, Entry>`, i una clau
 * sense `es` no compila. El que TypeScript no pot veure és:
 *
 *   1. `src/i18n/ca.json` i `es.json`, que no tenen cap tipus al darrere. Són
 *      dos arbres lliures i res no obliga que tinguin les mateixes claus: una
 *      clau que hi falti no peta, torna la clau mateixa a la pantalla.
 *   2. Que un marcador `{nom}` hi sigui en una llengua i no en l'altra. La
 *      frase castellana surt sencera i sense petar, però ha perdut la xifra —
 *      justament la dada. És el defecte més car de tots perquè és invisible.
 *   3. Que el castellà sigui una còpia literal del català. Compila, es pinta,
 *      i és exactament el defecte que aquest fitxer hauria d'aturar.
 *
 * COM LLEGEIX LES CLAUS. Del disc, com fa `offline/basemap-agreement.test.ts`:
 * les taules són internes al mòdul (i han de ser-ho) i el tipus de la clau no
 * existeix en temps d'execució. Es recuperen del text del fitxer i després es
 * demanen a l'accessor de veritat, que és el que fa servir la interfície. Si
 * algú canvia la forma de les taules, l'extracció es queda a zero claus i la
 * primera asserció ho diu.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import ca from './ca.json';
import es from './es.json';
import en from './en.json';
import fr from './fr.json';
import type { Locale } from './index';
import { s } from '../screens/strings';
import { os } from '../offline/strings';
import { sp } from '../features/spots/strings';
import { hs } from '../features/sim/strings';
import { ls } from '../features/location/strings';
import { ws } from '../features/weather/strings';
import { ab } from '../features/about/strings';
import { al } from '../features/align/strings';
import { cs } from '../features/clock/strings';
import { sh } from '../features/share/strings';

/* ------------------------------------------------- els dos JSON de l'i18n */

type Node = { [key: string]: string | Node };

/** Totes les rutes de fulla d'un arbre: `guide.title`, `safety.badge.text`… */
function leafPaths(node: Node, prefix = ''): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof value === 'string') paths.push(path);
    else paths.push(...leafPaths(value, path));
  }
  return paths;
}

function leafAt(node: Node, path: string): string {
  let current: string | Node = node;
  for (const part of path.split('.')) {
    if (typeof current === 'string') return current;
    current = current[part];
  }
  return typeof current === 'string' ? current : '';
}

/** Els marcadors dels JSON són de doble clau: `{{eclipse}}`. */
function jsonMarkers(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
}

describe('els catàlegs JSON diuen les mateixes coses', () => {
  const caPaths = leafPaths(ca as Node);
  const esPaths = leafPaths(es as Node);
  const enPaths = leafPaths(en as Node);
  const frPaths = leafPaths(fr as Node);

  it('cap clau del català no es queda sense traducció', () => {
    // Una clau que falta no peta: `createTranslator` cau al català i l'usuari
    // en castellà rep una frase catalana sense que ho sàpiga ningú.
    expect(caPaths.length).toBeGreaterThan(10);
    expect(esPaths.slice().sort()).toEqual(caPaths.slice().sort());
    expect(enPaths.slice().sort()).toEqual(caPaths.slice().sort());
    expect(frPaths.slice().sort()).toEqual(caPaths.slice().sort());
  });

  it('cap text no és buit', () => {
    for (const path of caPaths) {
      expect(leafAt(ca as Node, path).trim().length, path).toBeGreaterThan(0);
      expect(leafAt(es as Node, path).trim().length, path).toBeGreaterThan(0);
      expect(leafAt(en as Node, path).trim().length, path).toBeGreaterThan(0);
      expect(leafAt(fr as Node, path).trim().length, path).toBeGreaterThan(0);
    }
  });

  it('els marcadors són els mateixos a les dues llengües', () => {
    // «Tot el que has de saber abans de {{eclipse}}» sense el marcador a la
    // versió castellana es pinta sense petar i sense la data.
    for (const path of caPaths) {
      expect(jsonMarkers(leafAt(es as Node, path)), path).toEqual(
        jsonMarkers(leafAt(ca as Node, path)),
      );
      expect(jsonMarkers(leafAt(en as Node, path)), path).toEqual(
        jsonMarkers(leafAt(ca as Node, path)),
      );
      expect(jsonMarkers(leafAt(fr as Node, path)), path).toEqual(jsonMarkers(leafAt(ca as Node, path)));
    }
  });
});

/* ------------------------------------------- les taules `{ ca, es }` dels mòduls */

/**
 * Un accessor genèric. Les signatures reals estan tipades amb la unió de claus
 * de cada mòdul, que no existeix en temps d'execució: aquí les claus surten
 * del disc i el `cast` és el preu d'anar-les a buscar allà.
 */
type Accessor = (key: string, locale: Locale) => string;

interface Table {
  /** Per si algun dia falla: diu quin fitxer mirar. */
  readonly file: string;
  readonly access: Accessor;
  /** Quantes claus se n'esperen com a mínim, per detectar una extracció morta. */
  readonly atLeast: number;
}

const TABLES: readonly Table[] = [
  { file: 'src/screens/strings.ts', access: s as Accessor, atLeast: 100 },
  { file: 'src/offline/strings.ts', access: os as Accessor, atLeast: 30 },
  { file: 'src/features/spots/strings.ts', access: sp as Accessor, atLeast: 50 },
  { file: 'src/features/sim/strings.ts', access: hs as Accessor, atLeast: 20 },
  { file: 'src/features/location/strings.ts', access: ls as Accessor, atLeast: 20 },
  { file: 'src/features/weather/strings.ts', access: ws as Accessor, atLeast: 10 },
  { file: 'src/features/about/strings.ts', access: ab as Accessor, atLeast: 10 },
  { file: 'src/features/align/strings.ts', access: al as Accessor, atLeast: 10 },
  { file: 'src/features/clock/strings.ts', access: cs as Accessor, atLeast: 5 },
  { file: 'src/features/share/strings.ts', access: sh as Accessor, atLeast: 10 },
];

/**
 * Les claus, tal com estan escrites al fitxer.
 *
 * Totes les taules del projecte segueixen la mateixa forma —dos espais, la
 * clau entre cometes simples, dos punts i una clau d'obertura— perquè totes
 * són el mateix patró copiat. Si algú la canvia, el recompte mínim de cada
 * entrada de `TABLES` ho denuncia en comptes de deixar la prova passant en va.
 */
function keysOf(file: string): string[] {
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
  return [...source.matchAll(/^ {2}'([^']+)':\s*\{/gm)].map((m) => m[1]);
}

/** Els marcadors dels mòduls són de clau simple: `{radius}`. */
function markers(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe('cap taula bilingüe es queda a mitges', () => {
  for (const table of TABLES) {
    describe(table.file, () => {
      const keys = keysOf(table.file);

      it('les claus es llegeixen del fitxer', () => {
        expect(keys.length).toBeGreaterThanOrEqual(table.atLeast);
      });

      it('cap clau no es queda sense text en cap de les dues llengües', () => {
        for (const key of keys) {
          for (const locale of ['ca', 'es'] as const) {
            const text = table.access(key, locale);
            expect(typeof text, `${key}/${locale}`).toBe('string');
            expect(text.trim().length, `${key}/${locale}`).toBeGreaterThan(0);
          }
        }
      });

      it('els marcadors són els mateixos a les dues llengües', () => {
        // El cas real: `list.contextMany` diu «{n} llocs de {candidates} punts
        // mirats dins de {radius}». Si al castellà se n'oblida un, la frase
        // surt sencera i sense la xifra, i no ho veu ningú fins que algú es
        // planta a 14 km del lloc equivocat.
        for (const key of keys) {
          expect(markers(table.access(key, 'es')), key).toEqual(
            markers(table.access(key, 'ca')),
          );
        }
      });

      it('les frases llargues no són una còpia del català', () => {
        /*
         * NOMÉS LES LLARGUES. «Sol», «Etapa», «C1» o «mirador» s'escriuen
         * igual en totes dues llengües i no volen dir que ningú s'hagi
         * descuidat res. A partir de seixanta caràcters, en canvi, dues
         * frases idèntiques volen dir copiar i enganxar: no hi ha cap oració
         * llarga que s'escrigui exactament igual en català i en castellà.
         */
        for (const key of keys) {
          const catala = table.access(key, 'ca');
          if (catala.length < 60) continue;
          expect(table.access(key, 'es'), key).not.toBe(catala);
        }
      });
    });
  }
});
