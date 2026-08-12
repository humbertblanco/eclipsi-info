/**
 * QUANTES FITXES PODEN PINTAR L'AMBRE, I QUE NO N'APAREGUI CAP MÉS SENSE VEURE-HO.
 *
 * `CLAUDE.md`, regla 3: «Un sol accent ambre per pantalla, i és el de la xifra
 * que decideix». Vigilar-ho mirant qui escriu `accent` no és suficient, i val la
 * pena entendre per què abans de llegir la prova.
 *
 * A `tokens/colors.css` l'ambre de la marca és UN sol color base, `--sun-500`
 * (`#FFA51F`), i hi ha diverses fitxes que hi apunten:
 *
 *     --accent:         var(--sun-500)
 *     --status-partial: var(--sun-500)
 *     --border-accent:  var(--sun-500)
 *
 * AIXÒ NO ÉS CAP ERROR I NO S'HA D'ARREGLAR. És un àlies declarat, escrit a la
 * cara al full d'estil, i té sentit: l'ambre d'estat «parcial» i l'ambre
 * d'accent són el mateix ambre de la marca. Es va mirar de tractar com una
 * col·lisió amagada i era una lectura equivocada.
 *
 * EL QUE SÍ QUE IMPORTA és la conseqüència pràctica: un `Badge tone="partial"`
 * o un `VisibilityMeter state="partial"` planten aquell ambre a la pantalla
 * sense escriure `accent` enlloc. Qui compti ambres buscant la paraula
 * «accent» en comptarà de menys. Per tant la regla 3 s'ha de llegir en termes
 * de COLOR i no de nom de fitxa, i aquesta prova serveix per saber, en tot
 * moment, quantes portes hi ha.
 *
 * Si algú n'obre una de nova —una fitxa nova que apunti a `--sun-500`— la prova
 * cau i l'obliga a declarar-la aquí. No li diu que no ho faci; li diu que no ho
 * pot fer d'amagat.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const COLORS_CSS = readFileSync(join(here, 'tokens', 'colors.css'), 'utf8');

/** El color base de l'ambre de la marca. Tot el que hi apunti pinta accent. */
const AMBRE = '--sun-500';

/**
 * Les fitxes que avui poden pintar l'ambre, i per què cadascuna hi és.
 *
 * Treure'n una vol dir que aquella porta s'ha tancat; afegir-n'hi una, que se
 * n'ha obert una de nova a posta. Les dues coses han de passar per aquí.
 */
const PORTES: Readonly<Record<string, string>> = {
  '--accent': 'l’accent de la xifra que decideix: la porta principal i la que la regla 3 anomena',
  '--status-partial':
    'l’estat «parcial» del cel i de la visibilitat (`Badge tone="partial"`, ' +
    '`VisibilityMeter state="partial"`). Pinta el mateix ambre sense escriure `accent`: ' +
    'és per això que la regla 3 s’ha de comptar per color i no per nom de fitxa',
  '--border-accent': 'la vora de l’accent, que acompanya la fitxa principal i no n’afegeix cap',
};

/** Les fitxes que declaren `var(--sun-500)` al full d'estil, llegides d'allà. */
function fitxesQueApuntenAlAmbre(): string[] {
  const trobades = new Set<string>();
  for (const m of COLORS_CSS.matchAll(/(--[a-z0-9-]+)\s*:\s*var\(\s*--sun-500\s*\)/gi)) {
    trobades.add(m[1]);
  }
  return [...trobades].sort();
}

describe('l’ambre de la marca', () => {
  it('el color base existeix i és el que diu la paleta', () => {
    // Si `--sun-500` canviés de nom, la resta d'aquesta prova passaria per verd
    // sense mirar res. Aquesta línia ho impedeix.
    expect(COLORS_CSS).toMatch(/--sun-500\s*:\s*#FFA51F/i);
  });

  it('cap fitxa no pot pintar-lo sense estar declarada aquí', () => {
    const fitxes = fitxesQueApuntenAlAmbre();

    // Sense això, un `colors.css` buit o un patró que no casi deixarien la
    // prova en verd sense vigilar res.
    expect(fitxes.length, 'cap fitxa apunta a l’ambre: el patró no casa').toBeGreaterThan(0);

    for (const fitxa of fitxes) {
      expect(
        PORTES[fitxa],
        `${fitxa} pinta ${AMBRE} i no és a la llista. Si és a posta, declara-la amb el motiu: ` +
          'cada fitxa nova que hi apunti és una manera més de plantar un segon ambre a la ' +
          'pantalla sense escriure «accent» enlloc.',
      ).toBeDefined();
    }
  });

  it('no s’hi acumulen portes que ja no existeixen', () => {
    // Una llista d'excepcions que només creix deixa de voler dir res.
    const fitxes = new Set(fitxesQueApuntenAlAmbre());
    for (const declarada of Object.keys(PORTES)) {
      expect(fitxes, `${declarada} ja no apunta a l’ambre: treu-la de la llista`).toContain(
        declarada,
      );
    }
  });
});
