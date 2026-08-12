/**
 * UN CONTEXT 2D QUE APUNTA EL QUE SE LI DEMANA, i que no s'inventa res.
 *
 * PER QUÈ EXISTEIX. Perquè `tests/dom-setup.ts` retorna `null` a `getContext()`
 * —hi ha escrit per què— i amb `null` el codi de pintar NO S'EXECUTA: cada
 * component que dibuixa fa «const ctx = …; if (!ctx) return;» i se'n va. Una
 * prova escrita a sobre d'això passaria sense haver dibuixat mai res, que és
 * la pitjor manera de tenir una prova. El 12-8-2026 això va costar car: el peu
 * que es crema a les fotos compartides sortia condensat al 87 % i no hi havia
 * cap manera d'assabentar-se'n des d'aquí.
 *
 * QUÈ ÉS I QUÈ NO ÉS. És un quadern: desa cada crida amb els seus arguments i
 * amb l'ESTAT que hi havia en aquell moment (el cos de lletra, el color,
 * l'alineació, el filtre). No pinta res i no té píxels. Serveix per respondre
 * preguntes sobre DECISIONS —quin cos de lletra s'ha triat, quina amplada
 * màxima s'ha passat a `fillText`, en quin ordre s'ha dibuixat— que és
 * exactament la família de preguntes que en aquest projecte s'han de poder
 * respondre.
 *
 * EL `measureText` MESURA AMB UNA FONT DE DEBÒ, I ÉS LA DECISIÓ MÉS IMPORTANT
 * D'AQUEST FITXER. Aquí hi havia un `throw`, amb un motiu bo: qualsevol número
 * tret del barret seria l'única xifra que de debò importa. El context de
 * `features/sim/renderSky.test.ts` en té un que torna `text.length * 8`; allà
 * no fa mal perquè aquella prova no en llegeix el resultat, però copiat aquí
 * seria una mentida amb forma de mesura.
 *
 * El `throw` va durar el que va trigar el codi de producció a necessitar-ne un.
 * `composeCapture()` va deixar de confiar el peu al `maxWidth` de `fillText`
 * —que CONDENSA en comptes de retallar— i ara tria el cos de lletra mesurant.
 * Amb el `throw`, aquell camí no es podia provar: just al revés del que aquest
 * fitxer existeix per fer.
 *
 * La sortida no ha estat inventar-se un número, sinó donar-li la regla:
 * `tests/amplada-de-text.ts` mesura amb les mètriques del WOFF que l'app
 * publica i diu a la seva capçalera què no sap. La prohibició que es queda
 * dempeus és la que valia: cap amplada que no surti d'una font de debò.
 *
 * TAMPOC SIMULA CAP ALTRE TIPUS DE CONTEXT: `getContext('webgl')` segueix
 * tornant `null`. Ni el sabem fer ni cap prova d'aquest projecte el necessita;
 * tornar-hi un objecte buit faria que un codi que comprova si hi ha WebGL es
 * pensés que en té.
 */

import { ampladaPx } from './amplada-de-text';

/** «500 30px system-ui, sans-serif» → 30. La mateixa lectura que fa la prova. */
function cosDeFont(font: string): number {
  const trobat = /(\d+(?:\.\d+)?)px/.exec(font);
  if (trobat === null) throw new Error(`no hi ha cap cos de lletra a «${font}»`);
  return Number(trobat[1]);
}

/** L'estat del context en el moment d'una crida. Només el que algú fixa. */
export interface EstatDibuix {
  font: string;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  globalAlpha: number;
  textAlign: string;
  textBaseline: string;
  filter: string;
}

/** Una crida apuntada, amb l'estat que hi havia quan es va fer. */
export interface CridaDibuix {
  nom: string;
  args: readonly unknown[];
  estat: EstatDibuix;
}

/** El quadern d'un context. */
export interface CanvasApuntat {
  /** El llenç del qual va sortir aquest context. */
  llenc: HTMLCanvasElement;
  crides: CridaDibuix[];
  /** Totes les crides amb aquest nom, en ordre de dibuix. */
  cridesA(nom: string): CridaDibuix[];
  /** L'única crida amb aquest nom. Peta si n'hi ha cap o més d'una. */
  unicaCrida(nom: string): CridaDibuix;
}

const ESTAT_INICIAL: EstatDibuix = {
  /* Els valors per defecte d'un context 2D de debò, tal com els diu l'estàndard. */
  font: '10px sans-serif',
  fillStyle: '#000000',
  strokeStyle: '#000000',
  lineWidth: 1,
  globalAlpha: 1,
  textAlign: 'start',
  textBaseline: 'alphabetic',
  filter: 'none',
};

function creaApuntador(llenc: HTMLCanvasElement): {
  quadern: CanvasApuntat;
  ctx: CanvasRenderingContext2D;
} {
  const estat: EstatDibuix = { ...ESTAT_INICIAL };
  const crides: CridaDibuix[] = [];

  const quadern: CanvasApuntat = {
    llenc,
    crides,
    cridesA: (nom) => crides.filter((c) => c.nom === nom),
    unicaCrida: (nom) => {
      const trobades = crides.filter((c) => c.nom === nom);
      if (trobades.length !== 1) {
        throw new Error(`s'esperava una sola crida a ${nom}() i n'hi ha ${trobades.length}`);
      }
      return trobades[0];
    },
  };

  const ctx = new Proxy(
    {},
    {
      get(_objectiu, clau) {
        /*
         * ELS SÍMBOLS TORNEN `undefined` A POSTA. Vitest i `util.inspect`
         * palpen `Symbol.toStringTag`, `Symbol.iterator` i companyia quan han
         * d'imprimir un objecte; si cada palpada tornés una funció, un error de
         * prova s'imprimiria com una cosa il·legible. I `then` també: un
         * objecte amb `then` és una promesa als ulls de `await`, i qui retornés
         * el context des d'una funció asíncrona es quedaria penjat per sempre.
         */
        if (typeof clau === 'symbol' || clau === 'then') return undefined;
        if (clau === 'canvas') return llenc;
        if (clau in estat) return estat[clau as keyof EstatDibuix];
        if (clau === 'measureText') {
          /*
           * AQUÍ HI HAVIA UN `throw`, I EL MOTIU ERA BO: un `measureText` que
           * es tragués un número del barret seria una mentida amb forma de
           * mesura, i aquell número és justament l'única xifra que importa.
           *
           * El que ha canviat és que el codi de producció ara EN DEMANA un.
           * `composeCapture()` va deixar de confiar el peu al `maxWidth` de
           * `fillText` —que condensa en comptes de retallar— i tria el cos de
           * lletra mesurant, que és el que arregla el peu esclafat. Amb el
           * `throw`, aquell camí no es podia provar: exactament al revés del
           * que aquest fitxer existeix per fer.
           *
           * La sortida NO és inventar-se un número: és donar-li la regla de
           * debò. `ampladaPx()` mesura amb les mètriques del WOFF que l'app
           * publica, i la seva capçalera diu què no sap. La diferència amb el
           * `system-ui` que pinta el navegador està mesurada (+5 a +7 %, sempre
           * cap al cantó segur) i vigilada per `caption-fit.test.tsx`.
           *
           * La prohibició que es queda dempeus és la d'abans, i és la que val:
           * cap número que no surti d'una font de debò.
           */
          return (text: string) => ({ width: ampladaPx(String(text), cosDeFont(estat.font)) });
        }
        /*
         * QUALSEVOL ALTRA CRIDA S'APUNTA. Res no es descarta en silenci: si
         * demà `composeCapture()` hi afegeix un `strokeText`, sortirà al
         * quadern i la prova podrà preguntar-s'hi. Un doble que no apuntés les
         * crides que no coneix seria, altra vegada, un `null` amb bona cara.
         */
        return (...args: unknown[]) => {
          crides.push({ nom: String(clau), args, estat: { ...estat } });
          return undefined;
        };
      },
      set(_objectiu, clau, valor) {
        /*
         * L'ESTAT ES GUARDA I ES TORNA TAL QUAL, també el filtre. `composeCapture`
         * decideix si el navegador li suporta `ctx.filter` escrivint-hi i
         * tornant-lo a llegir; guardar-lo vol dir que aquí es prova la branca
         * dels navegadors que sí que el tenen. La de reserva (el vel negre) es
         * prova passant-hi `'none'`, que és el que fa el codi quan no n'hi ha.
         */
        if (clau in estat) {
          (estat as unknown as Record<string, unknown>)[clau as string] = valor;
        }
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;

  return { quadern, ctx };
}

/** El que torna la instal·lació: els quaderns i com desfer-ho. */
export interface CanvasInstalat {
  /** Un quadern per cada `getContext('2d')` que s'hagi demanat, en ordre. */
  contextos: CanvasApuntat[];
  /** L'últim quadern. Peta si no se n'ha demanat cap. */
  darrer(): CanvasApuntat;
  restaura(): void;
}

/**
 * Fa que `getContext('2d')` torni un apuntador mentre duri la prova.
 *
 * `tests/dom-setup.ts` torna a posar el `null` de sempre després de cada prova,
 * o sigui que oblidar-se el `restaura()` no contamina la següent; hi és
 * igualment per a qui vulgui tornar al `null` a mitja prova.
 */
export function instalaCanvasApuntador(): CanvasInstalat {
  const original = HTMLCanvasElement.prototype.getContext;
  const contextos: CanvasApuntat[] = [];

  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, tipus: string) {
    if (tipus !== '2d') return null;
    const { quadern, ctx } = creaApuntador(this);
    contextos.push(quadern);
    return ctx;
  } as typeof HTMLCanvasElement.prototype.getContext;

  return {
    contextos,
    darrer: () => {
      const ultim = contextos.at(-1);
      if (ultim === undefined) throw new Error('no s’ha demanat cap context 2D');
      return ultim;
    },
    restaura: () => {
      HTMLCanvasElement.prototype.getContext = original;
    },
  };
}
