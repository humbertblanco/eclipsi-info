/**
 * QUÈ PASSA DE DEBÒ EN AQUEST PUNT, DIT AMB UN CODI I NO AMB UNA FRASE.
 *
 * ── L'ERROR QUE ARREGLA, QUE JA HAVIA PASSAT DUES VEGADES ───────────────────
 *
 * Les fitxes de ciutat publicades el 5 d'agost de 2026 duien aquest títol:
 *
 *     «Eclipsi total 2026 a Barcelona: hora i visibilitat»
 *
 * i, dues pantalles més avall, el cos de la mateixa pàgina deia «99,8 %»,
 * «PARCIAL» i «no és una totalitat petita: és una altra cosa». Des de Barcelona
 * no hi ha totalitat. El títol sortia del catàleg d'eclipsis —on el 12 d'agost
 * del 2026 és, globalment, un eclipsi TOTAL— i no de les circumstàncies del
 * punt, que és l'única cosa que la pàgina té per feina explicar.
 *
 * És la tercera vegada que aquest projecte fa la mateixa cosa: abans el mapa
 * havia dibuixat una franja que deixava València fora amb 62 segons de
 * totalitat, i el text havia anunciat «Galícia» d'una franja que no passa ni per
 * Vigo ni per Santiago. Les tres vegades l'error tenia la mateixa forma: **el
 * que s'escriu no s'havia comparat mai amb el que es calcula**.
 *
 * ── PER QUÈ AQUEST FITXER, I PER QUÈ NO HI HA CAP FRASE ─────────────────────
 *
 * `computeLocalCircumstances()` ja retorna `kind`, `edgeUncertain` i
 * `centralDurationSec` calculats per a aquelles coordenades. El que faltava no
 * era el càlcul: era que ningú no el fes servir per triar les paraules.
 *
 * Aquí hi ha només el CODI —quatre casos, cap text— i les paraules de cada cas
 * viuen a `strings.ts`, que és l'única capa que sap en quin idioma es parla.
 * Amb la frase aquí dins, la regla es podria complir en català i incomplir-se
 * en francès sense que ningú se n'assabentés.
 *
 * ── L'ORDRE DELS CASOS NO ÉS ARBITRARI ──────────────────────────────────────
 *
 * `edgeUncertain` es mira PRIMER, abans que la durada. Al caire de la franja el
 * motor dona una durada positiva petita que NO es pot garantir: publicar-la com
 * si fos una mesura és exactament el que la regla 2 prohibeix. Un punt al caire
 * no és un punt amb poca totalitat; és un punt del qual no sabem si en tindrà.
 */

/** El resultat d'un eclipsi en un punt, tal com el decideix el motor. */
export type SeoOutcome =
  /** Hi ha fase central confirmada: totalitat o anularitat. */
  | 'central'
  /** El punt cau dins la incertesa del caire. No es promet cap durada. */
  | 'edge'
  /** Fase parcial: el disc no es tapa mai del tot. */
  | 'partial'
  /** Des d'aquí no es veu res: els discos no arriben a tocar-se. */
  | 'none';

/**
 * El mínim que cal saber d'un punt per decidir-ne el veredicte.
 *
 * Es demana així, i no `LocalCircumstances` sencer, perquè aquest mòdul l'ha de
 * poder cridar tant el generador (que en té l'objecte complet) com una prova
 * amb un cas de joguina. El que importa és que els tres camps surtin del motor.
 */
export interface SeoCircumstances {
  kind: 'none' | 'partial' | 'total' | 'annular';
  edgeUncertain: boolean;
  centralDurationSec: number;
}

export function seoOutcome(circumstances: SeoCircumstances): SeoOutcome {
  if (circumstances.kind === 'none') return 'none';
  if (circumstances.edgeUncertain) return 'edge';
  return circumstances.centralDurationSec > 0 ? 'central' : 'partial';
}

/**
 * Cert només quan la pàgina pot dir «total» o «totalitat» sense mentir.
 *
 * Existeix com a funció amb nom perquè és el que asserta
 * `build-seo-pages.test.ts` sobre el títol i l'encapçalament generats de cada
 * ciutat i de cada punt. La prova compara la PARAULA amb el MOTOR, que és la
 * comparació que faltava les tres vegades.
 */
export function admetsTotality(circumstances: SeoCircumstances): boolean {
  return seoOutcome(circumstances) === 'central' && circumstances.kind === 'total';
}
