import { defineConfig } from 'vitest/config';

/**
 * Configuració pròpia de Vitest, separada de `vite.config.ts`.
 *
 * Si no hi fos, Vitest agafaria `vite.config.ts`, que carrega el plugin de
 * React i el de certificats autofirmats. Cap dels dos fa cap falta per provar
 * el nucli astronòmic i el segon arriba a generar un certificat cada vegada
 * que s'arrenca la suite.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOS PROJECTES, I PER QUÈ NO UNA CONFIGURACIÓ SOLA
 *
 * Aquí hi corren dues coses molt diferents. El NUCLI són 107 fitxers i 1.809
 * proves que fan trigonometria a Node; la VISTA són quatre fitxers `.test.tsx`
 * amb 63 proves que necessiten un DOM. La regla és que la segona no pot fer
 * pagar res a la primera: aquelles 1.809 proves són el patrimoni d'aquest
 * projecte, i el dia que els 24 s passin a ser 90 ningú no les tornarà a córrer
 * abans de pujar res.
 *
 * MESURAT EL 3-8-2026, tres passades de cada, en aquest ordinador: el nucli sol
 * fa 24,36 / 24,40 / 24,42 s i les dues meitats juntes 24,54 / 24,57 / 24,72 s.
 * Els components costen DOS DÈCIMES a la bateria sencera —el 0,8 %— i no perquè
 * siguin gratis, sinó perquè els seus quatre fitxers caben dins del temps que
 * el nucli ja passa esperant els seus: la vista sola són 1,5 s. Si algun dia
 * aquesta diferència es fa de segons, el que ha passat és que un `.test.tsx` ha
 * començat a fer feina de nucli i el que s'ha de moure és la prova, no el
 * llindar.
 *
 * S'HI VAN MIRAR TRES CAMINS:
 *
 *   1. `environmentMatchGlobs`. JA NO EXISTEIX. Va quedar obsolet a Vitest 3 i
 *      s'ha tret a Vitest 4 (aquí en corre la 4.1.10: la clau no surt enlloc
 *      dels seus `.d.ts`). Si algú el llegeix en un article i el posa, Vitest
 *      l'ignora en silenci i els tests de components peten amb «document is not
 *      defined» sense dir per què.
 *
 *   2. El comentari per fitxer, `@vitest-environment jsdom`. Funciona i és el
 *      mínim, però obliga a un `setupFiles` global —el `cleanup()` de
 *      testing-library s'ha de registrar d'alguna manera— i un `setupFiles`
 *      d'una configuració sola corre també als 107 fitxers de Node: hi importa
 *      React i testing-library a cada un per no fer-hi res.
 *
 *   3. ELS PROJECTES, que és el que hi ha. Cada meitat declara el seu entorn i
 *      el seu arrencador, i el de Node no s'assabenta que l'altre existeix. De
 *      passada surten dues coses que el comentari per fitxer no dona: que un
 *      `.test.tsx` no pugui acabar corrent a Node per haver-se descuidat una
 *      línia —no és una convenció, és que no hi és inclòs— i poder córrer una
 *      meitat sola amb `npx vitest run --project nucli` mentre s'itera.
 *
 * ELS `include` NO ES TREPITGEN: `*.test.ts` no aparella `*.test.tsx` (el glob
 * demana que el nom acabi exactament en `.ts`). Un fitxer és d'un projecte o de
 * l'altre, mai dels dos, i el compte de proves de les dues meitats sumat ha de
 * ser el d'abans més els que s'hi afegeixin.
 *
 * NO S'HI CARREGA `@vitejs/plugin-react`. El JSX el transforma esbuild amb el
 * `jsx: "react-jsx"` que ja diuen els `tsconfig`; el plugin només afegiria Fast
 * Refresh, que en una bateria de proves no serveix de res.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'nucli',
          // Entorn Node: el nucli (`src/core/**`) no toca el DOM enlloc, i
          // muntar jsdom només per fer trigonometria seria pagar un peatge per
          // res. Aquesta línia és la que no ha de canviar mai.
          environment: 'node',
          include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
          // Els tests d'or recorren desenes de municipis i cada un fa una cerca
          // d'arrels amb centenars de crides a efemèrides.
          testTimeout: 60_000,
        },
      },
      {
        test: {
          name: 'vista',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./tests/dom-setup.ts'],
          /*
           * Aquí no hi ha efemèrides: hi ha esperes de `waitFor` per a coses
           * que han de passar en mil·lisegons. El temps d'espera curt és part
           * de la prova — si un component triga vint segons a ensenyar un
           * resultat, la prova ha de ser vermella i no pacient.
           */
          testTimeout: 20_000,
        },
      },
    ],
  },
});
