/**
 * L'arrencador del projecte `vista` de Vitest: el poc que jsdom no porta.
 *
 * NOMÉS EL CORREN ELS `.test.tsx`. Viu fora de `src/` i el projecte `nucli` ni
 * el carrega, que és tota la gràcia dels dos projectes de `vitest.config.ts`:
 * els 105 fitxers de Node no han d'importar React ni testing-library per no
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
 * aquí no n'hi ha: `globals` és fals a posta, perquè les 1.782 proves del nucli
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
