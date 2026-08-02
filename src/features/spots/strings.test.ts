/**
 * Proves del diccionari del cercador.
 *
 * PER QUÈ VAL LA PENA PROVAR UNES CADENES. Perquè el defecte que aquestes
 * proves cacen ja ha passat quatre vegades en aquest projecte, i sempre igual:
 * algú afegeix un text, l'escriu en català, i el castellà no arriba fins que
 * algú obre l'app en castellà i troba una frase catalana enmig. Amb el
 * diccionari en una taula, la comprovació és mecànica i val el que costa
 * llegir-la.
 *
 * La segona prova és la del marcador orfe: un `{radius}` que no rep valor surt
 * literalment a la pantalla. Val més que peti aquí que no pas a la targeta d'un
 * lloc a 14 km.
 */

import { describe, expect, it } from 'vitest';
import { sp } from './strings';

describe('diccionari del cercador', () => {
  it('cap clau no es queda sense castellà', () => {
    // La taula és interna; es prova a través de `sp`, que és el que fa servir
    // la interfície. Una clau sense castellà retornaria `undefined` i això
    // arriba a la pantalla com a text buit, no com a error.
    const sample = [
      'panel.title',
      'panel.lead',
      'panel.search',
      'panel.dataWarning',
      'stage.grid',
      'stage.done',
      'list.empty',
      'list.caveat',
      'card.willSee',
      'card.makeMine',
      'cost.title',
      'error.noWorker',
    ] as const;

    for (const key of sample) {
      for (const locale of ['ca', 'es'] as const) {
        const text = sp(key, locale);
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
      }
    }
  });

  it('les dues llengües diuen coses diferents, o algú ha copiat i enganxat', () => {
    // Frases llargues: si el castellà és idèntic al català, o no s'ha traduït o
    // s'ha oblidat. Les etiquetes curtes («Sol», «Etapa») sí que poden coincidir
    // i per això no hi són.
    for (const key of ['panel.lead', 'list.caveat', 'card.willSee'] as const) {
      expect(sp(key, 'es')).not.toBe(sp(key, 'ca'));
    }
  });

  it('els marcadors es substitueixen, i els que no reben valor es veuen', () => {
    const amb = sp('list.empty', 'ca', { radius: '25 km' });
    expect(amb).toContain('25 km');
    expect(amb).not.toContain('{radius}');

    // Sense valor, el marcador es queda tal qual a posta: un forat visible és
    // més fàcil de trobar que una frase que ha perdut mitja informació.
    expect(sp('list.empty', 'ca')).toContain('{radius}');
  });
});
