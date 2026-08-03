/**
 * Les proves de l'acumulador d'àncores d'una sessió de càmera.
 *
 * El que vigilen no és aritmètica: és que la paraula que surt cap a l'informe
 * no menteixi sobre la funció diferencial de l'app. Dues maneres de mentir, i
 * cada una té aquí el seu test:
 *
 *   · DIR «cap» D'UNA SESSIÓ QUE VA ANCORAR. Si l'acumulador oblidés, la
 *     columna `none` s'ompliria del gest normal d'acabar —abaixar el braç, i
 *     l'última cosa que veu la càmera és el terra— i la conclusió seria que
 *     l'ancoratge no s'enganxa mai en aparells de debò. És la conclusió
 *     contrària a la veritat, i és cara: el mes següent aniria a fer arrencar
 *     una cosa que ja arrenca.
 *   · DIR «Sol» D'UN ASSAIG DE NIT. Vegeu el perquè al vocabulari.
 */

import { describe, expect, it } from 'vitest';
import {
  foldAnchors,
  sessionAnchor,
  NO_ANCHORS_SEEN,
  type AnchorsSeen,
} from './sessionAnchor';

/** Passa una tirada de fotogrames per l'acumulador, com faria el bucle. */
function run(frames: readonly { body: 'sun' | 'moon' | null; terrain: boolean }[]): AnchorsSeen {
  return frames.reduce<AnchorsSeen>(foldAnchors, NO_ANCHORS_SEEN);
}

describe('acumulador d’àncores de la sessió', () => {
  it('una sessió que no ancora res diu «none»', () => {
    expect(sessionAnchor(NO_ANCHORS_SEEN)).toBe('none');
    expect(sessionAnchor(run([]))).toBe('none');
  });

  it('no oblida: el terra dels últims fotogrames no esborra el Sol dels primers', () => {
    const seen = run([
      { body: 'sun', terrain: false },
      { body: null, terrain: false },
      { body: null, terrain: false },
      { body: null, terrain: false },
    ]);
    expect(sessionAnchor(seen)).toBe('sun');
  });

  it('el terreny sol, encara que arribi una sola vegada, es diu «terrain»', () => {
    expect(sessionAnchor(run([{ body: null, terrain: true }]))).toBe('terrain');
  });

  it('astre i terreny en fotogrames DIFERENTS ja són «both»', () => {
    // La fusió no els ha tingut mai alhora al quadre i tant se val: la
    // pregunta és si les dues capes arriben a enganxar-se en aquell aparell.
    const seen = run([
      { body: null, terrain: true },
      { body: 'sun', terrain: false },
    ]);
    expect(sessionAnchor(seen)).toBe('both');
  });

  it('una sessió de nit amb la Lluna no es pot dir «sun»', () => {
    const seen = run([{ body: 'moon', terrain: false }]);
    expect(sessionAnchor(seen)).toBe('moon');
    expect(seen.sun).toBe(false);
  });

  it('la Lluna amb terreny també és «both»', () => {
    expect(sessionAnchor(run([{ body: 'moon', terrain: true }]))).toBe('both');
  });

  it('havent vist el Sol i la Lluna, guanya el Sol: és la condició difícil', () => {
    const seen = run([
      { body: 'moon', terrain: false },
      { body: 'sun', terrain: false },
    ]);
    expect(sessionAnchor(seen)).toBe('sun');
  });

  it('retorna el mateix objecte quan el fotograma no aporta res', () => {
    // Importa perquè això corre dins del bucle de dibuix, a 30 fotogrames per
    // segon i durant tota la sessió: la immensa majoria no aporten res de nou.
    const seen = run([{ body: 'sun', terrain: true }]);
    expect(foldAnchors(seen, { body: 'sun', terrain: true })).toBe(seen);
    expect(foldAnchors(seen, { body: null, terrain: false })).toBe(seen);
    expect(foldAnchors(NO_ANCHORS_SEEN, { body: null, terrain: false })).toBe(NO_ANCHORS_SEEN);
  });

  it('no muta l’acumulador que rep', () => {
    // El de la sessió viu en una ref del component: si es mutés en comptes de
    // substituir-se, el dia que algú el llegís des d'un render veuria valors
    // canviats sota els peus.
    const before = NO_ANCHORS_SEEN;
    foldAnchors(before, { body: 'sun', terrain: true });
    expect(before).toEqual({ sun: false, moon: false, terrain: false });
  });

  it('cada paraula que pot sortir està declarada al vocabulari', async () => {
    // La porta de privadesa rebutjaria una paraula no declarada i l'informe es
    // quedaria amb una columna buida sense que res petés. Es comprova contra la
    // taula de debò, no contra una còpia.
    const { VOCABULARY } = await import('../../core/analytics');
    const declared: readonly string[] = VOCABULARY.camera_session.anchor;
    const combos: AnchorsSeen[] = [
      { sun: false, moon: false, terrain: false },
      { sun: true, moon: false, terrain: false },
      { sun: false, moon: true, terrain: false },
      { sun: false, moon: false, terrain: true },
      { sun: true, moon: false, terrain: true },
      { sun: false, moon: true, terrain: true },
      { sun: true, moon: true, terrain: false },
      { sun: true, moon: true, terrain: true },
    ];
    for (const seen of combos) {
      expect(declared).toContain(sessionAnchor(seen));
    }
    expect(combos).toHaveLength(8);
  });
});
