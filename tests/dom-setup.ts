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
 * EL CANVAS QUE JSDOM NO TÉ, DIT EN VEU BAIXA — I LA PORTA QUE ARA HI HA.
 *
 * jsdom no implementa `getContext()` si no s'instal·la el paquet `canvas`, que
 * és una extensió nativa que es compila a cada instal·lació. SEGUEIX SENSE
 * POSAR-S'HI, i ara per dos motius i no per un: el preu de la compilació, i que
 * mesuraria amb les fonts de la màquina que corre les proves —`system-ui` a un
 * Mac és SF Pro, a una màquina d'integració pelada és el que hi hagi— i cap de
 * les dues és la del mòbil de l'usuari. Els píxels dels actius binaris se
 * segueixen mirant a `tests/actius-binaris.test.ts` i a
 * `features/map/minimap-asset.test.ts`, que corren a Node i obren els fitxers.
 *
 * EL VALOR PER DEFECTE ÉS EL DE SEMPRE: `null`. No és cap capacitat que es
 * tregui —`getContext()` ja tornava `null` abans i els components que dibuixen
 * ja el comproven (`PlaceThumbnail`: «const ctx = …; if (!ctx) return;»)—, és
 * que jsdom ho anunciava quatre vegades per bateria. Una sortida neta és el que
 * fa que un avís de debò es vegi.
 *
 * QUÈ HA CANVIAT EL 12-8-2026, i per què. Aquesta capçalera deia: «si algun dia
 * cal provar el que es dibuixa, això s'ha de treure, perquè amb `null` el codi
 * de pintar no s'executa i una prova que l'assereixi passaria sense haver
 * dibuixat res». Va arribar el dia. El peu que `composeCapture()` crema dins de
 * la foto que l'usuari comparteix sortia CONDENSAT AL 87 % en castellà amb
 * topònims llargs —`ctx.fillText(text, x, y, maxW)` no retalla: estreny— i des
 * d'aquí no hi havia manera de veure-ho.
 *
 * No s'ha tret el `null`: s'hi ha obert una porta. `tests/canvas-apuntador.ts`
 * instal·la, MENTRE DURA UNA PROVA, un context que apunta les crides amb el seu
 * estat, i les amplades de text les dona `tests/amplada-de-text.ts` llegint una
 * font de debò. Les dues capçaleres diuen què saben i què no. La primera prova
 * que ho fa servir és `src/features/ar/caption-fit.test.tsx`.
 *
 * La línia de sota es torna a posar després de CADA prova, i això no és zel:
 * el `getContext` viu al prototipus, o sigui que és global. Una prova que
 * s'instal·lés el seu apuntador i no el desés faria que la següent —que no
 * n'espera cap— executés camins de dibuix que ningú no ha mirat, i el fitxer
 * que fallaria no seria el que va deixar la porta oberta.
 */
const senseContext = () => null;
HTMLCanvasElement.prototype.getContext = senseContext;
afterEach(() => {
  HTMLCanvasElement.prototype.getContext = senseContext;
});
