/**
 * L'arrencador del projecte `vista` de Vitest: el poc que jsdom no porta.
 *
 * NOMÉS EL CORREN ELS `.test.tsx`. Viu fora de `src/` i el projecte `nucli` ni
 * el carrega, que és tota la gràcia dels dos projectes de `vitest.config.ts`:
 * els 107 fitxers de Node no han d'importar React ni testing-library per no
 * fer-hi res.
 *
 * REGLA D'AQUEST FITXER: aquí només hi entra el que FALTA A L'ENTORN, mai el
 * que decideix un component. Un doble que retorni la resposta que la prova vol
 * sentir converteix la bateria en un mirall. Cada cosa que hi hagi ha de portar
 * escrit per què jsdom no la té.
 */

import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/*
 * EL DESMUNTATGE ENTRE PROVES, A MÀ.
 *
 * `@testing-library/react` es desmunta sol quan troba un `afterEach` global, i
 * aquí no n'hi ha: `globals` és fals a posta, perquè les 1.809 proves del nucli
 * importen `describe`/`it`/`expect` de `vitest` explícitament i barrejar els dos
 * estils faria que un fitxer nou no se sabés de quin món és. Sense aquesta
 * línia, cada `render` deixaria el seu arbre penjant del `document` i el segon
 * `getByRole` d'una bateria trobaria dos botons iguals: la prova fallaria per un
 * component muntat en una prova anterior, que és el pitjor error de tots perquè
 * el fitxer que assenyala no és el que falla.
 */
afterEach(cleanup);

/*
 * ELS TEMPORITZADORS I EL RELLOTGE QUEDEN COM ESTAN.
 *
 * Cap `useFakeTimers` global. Els components d'aquesta app llegeixen l'hora de
 * `state/useNow` —el rellotge MONÒTON de `core/timer/clock.ts`— i congelar el
 * temps a tot arreu amagaria justament el que les proves de la línia de temps
 * han de vigilar: que una hora simulada no es pugui confondre amb l'hora real.
 * Qui necessiti aturar el temps, que ho faci a la seva prova i ho digui.
 */

afterEach(() => {
  /*
   * `vi.unstubAllGlobals()` desfà els `vi.stubGlobal` d'una prova (`fetch` i
   * `Worker`, que és el que les proves d'aquí substitueixen). Va al final
   * perquè cap prova s'endugui el seu doble a la següent: un `fetch` fals
   * heretat faria passar una prova que hauria d'anar a la xarxa i fallar.
   */
  vi.unstubAllGlobals();
});

/*
 * EL CANVAS QUE JSDOM NO TÉ, DIT EN VEU BAIXA.
 *
 * jsdom no implementa `getContext()` si no s'instal·la el paquet `canvas`, que
 * és una extensió nativa que es compila a cada instal·lació. NO s'hi posa: cap
 * de les proves d'aquest projecte no comprova píxels des d'aquí —els actius
 * binaris es miren a `tests/actius-binaris.test.ts` i a
 * `features/map/minimap-asset.test.ts`, que corren a Node i llegeixen els
 * fitxers de debò— i pagar una compilació nativa per no mirar res seria car.
 *
 * El que fa aquesta línia NO és afegir capacitat: `getContext()` ja retornava
 * `null` abans i els components que dibuixen ja el comproven
 * (`PlaceThumbnail`: «const ctx = …; if (!ctx) return;»). L'única diferència és
 * que jsdom deixava de dir-ho quatre vegades per bateria. Val la pena perquè
 * una sortida neta és el que fa que un avís de debò es vegi; una que ja ve amb
 * quatre línies vermelles de sèrie no la llegeix ningú.
 *
 * SI ALGUN DIA CAL PROVAR EL QUE ES DIBUIXA: això s'ha de treure i s'ha de
 * posar un context de veritat, perquè amb `null` el codi de pintar no s'executa
 * i una prova que l'assereixi passaria sense haver dibuixat res.
 */
HTMLCanvasElement.prototype.getContext = () => null;
