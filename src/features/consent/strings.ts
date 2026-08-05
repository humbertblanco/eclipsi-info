/**
 * Els textos del bàner de cookies.
 *
 * ── LA REGLA QUE MANA AQUÍ ÉS LA 4 DEL PROJECTE ─────────────────────────────
 *
 * «Res no es demana ni es baixa sense explicar-ho abans.» Un bàner de cookies
 * és exactament el cas: s'ha de poder contestar sabent què s'accepta, sense
 * obrir cap enllaç. Per això el text diu QUÈ es desa (una galeta), PER A QUÈ
 * (saber quanta gent hi entra) i, sobretot, QUÈ NO (on ets).
 *
 * ── PER QUÈ ÉS CURT I GENÈRIC, I NO UNA PREGUNTA ────────────────────────────
 *
 * La primera versió tenia un títol que interpel·lava («Vols que compti que has
 * entrat?») i tres frases de cos. Es va canviar per petició directa de l'usuari
 * el 4 d'agost de 2026, i la petició era bona: aquest bàner surt VUIT DIES
 * ABANS de l'eclipsi, damunt de l'única pantalla que la gent ha vingut a mirar.
 * Com més estona demani, més cara surt cada visita. Un rètol genèric i conegut
 * es despatxa d'un cop d'ull; una pregunta original obliga a llegir-la.
 *
 * El que NO s'ha escurçat és la frase de la ubicació, i és deliberat: era
 * l'altra meitat de la petició i és la que de debò importa a qui fa servir
 * aquesta app.
 *
 * ── EL QUE NO S'HI DIU, I ÉS DELIBERAT ──────────────────────────────────────
 *
 * No hi surt la paraula «experiència», ni «millorar el servei», ni «socis». No
 * hi ha socis. La publicitat no s'hi menciona perquè no se n'ofereix: els
 * senyals publicitaris van denegats per sempre i sense pregunta, o sigui que
 * posar-los al text seria fer veure que hi ha un tracte on no n'hi ha.
 *
 * No hi ha cap enllaç a una política de cookies de tres pantalles. La frase de
 * privadesa d'aquesta app cap en dues línies i és al peu; si calgués un
 * document per entendre el bàner, el bàner estaria mal escrit.
 *
 * ── LES DUES RESPOSTES PESEN IGUAL ──────────────────────────────────────────
 *
 * «Accepta» i «No, gràcies» són igual de curtes, igual de directes i, a
 * `consent.css`, igual de visibles. Cap de les dues és ambre: l'ambre d'aquesta
 * app és de la xifra que decideix (regla 3) i un bàner de cookies no ho és. Un
 * «Accepta» ressaltat i un «No» en text gris petit és la definició de patró
 * fosc, i a més invalidaria el consentiment.
 *
 * TO: el de la resta de l'app. Tractament de tu, frases declaratives, cap
 * emoji, cap signe d'admiració.
 */

import type { Locale } from '../../i18n';

type Entry = { ca: string; es: string; en: string; fr: string };

const STRINGS = {
  /*
   * EL TÍTOL, LA PARAULA DE TOTA LA VIDA.
   *
   * «Cookies», i prou. És el rètol que tothom ha vist mil vegades i que es
   * reconeix sense llegir-lo, que és precisament el que es vol: qui no hi vol
   * dedicar temps ha de poder resoldre-ho d'un cop d'ull.
   */
  'banner.title': { ca: 'Cookies', es: 'Cookies', en: 'Cookies', fr: 'Cookies' },

  /*
   * EL COS, UNA FRASE.
   *
   * «una galeta» en singular perquè n'és una: la `_ga` de Google Analytics.
   * Dir-ne «cookies» en plural seria inflar-ho.
   */
  'banner.body': {
    ca: 'Fem servir una galeta per comptar quanta gent fa servir l’app.',
    es: 'Usamos una cookie para contar cuánta gente usa la app.',
    en: 'We use one cookie to count how many people use the app.',
    fr: 'Nous utilisons un cookie pour compter le nombre de personnes qui utilisent l’application.',
  },

  /*
   * LA GARANTIA, DESTACADA A PART I SENSE ESCURÇAR.
   *
   * És la frase que la gent d'aquesta app vol llegir, i és certa per codi
   * provat: `core/analytics/sanitize.ts` no deixa passar cap número ni cap text
   * lliure, i `safePageLocation` retalla la consulta sencera —amb el `?p=lat,lon`
   * i el `&n=<topònim>` a dins— abans de cada enviament. Que sigui certa és
   * exactament el motiu pel qual es pot escriure aquí.
   *
   * LA CUA DEL DOS PUNTS NO ÉS ORNAMENT, I NO ES POT TALLAR. «No guardem cap
   * dada personal» a seques seria còmode i seria mentida a mitges: la galeta
   * SÍ que porta una cosa, un número a l'atzar que dura d'una visita a l'altra,
   * i sota el RGPD un identificador persistent no és exactament «res». Dir què
   * hi ha costa seves paraules i és la diferència entre una promesa i un
   * eslògan — que és la regla 2 del projecte aplicada a una frase de bàner.
   */
  'banner.promise': {
    ca: 'No guardem la teva ubicació ni cap dada personal: només un número a l’atzar per no comptar-te dues vegades.',
    es: 'No guardamos tu ubicación ni ningún dato personal: solo un número al azar para no contarte dos veces.',
    en: 'We do not store your location or any personal data: only a random number so we do not count you twice.',
    fr: 'Nous ne conservons ni votre position ni aucune donnée personnelle : seulement un nombre aléatoire pour ne pas vous compter deux fois.',
  },

  /* Les dues respostes. Verb en imperatiu la primera, fórmula educada la
     segona; cap de les dues amaga res ni fa sentir malament qui la tria. */
  'banner.accept': { ca: 'Accepta', es: 'Acepta', en: 'Accept', fr: 'Accepter' },
  'banner.reject': { ca: 'No, gràcies', es: 'No, gracias', en: 'No, thanks', fr: 'Non, merci' },

  /*
   * L'ETIQUETA DEL PEU PER CANVIAR D'OPINIÓ.
   *
   * Ha d'existir: retirar el consentiment ha de ser tan fàcil com donar-lo, i
   * un sí que no es pot desfer no és vàlid. Va al peu i no a un menú amagat.
   */
  'footer.change': { ca: 'Cookies', es: 'Cookies', en: 'Cookies', fr: 'Cookies' },

  /*
   * L'ESTAT ACTUAL, per al lector de pantalla del botó del peu: qui no veu el
   * bàner ha de poder saber què va contestar sense obrir-lo.
   */
  'footer.granted': {
    ca: 'Cookies de mesura: acceptades. Toca per canviar-ho.',
    es: 'Cookies de medición: aceptadas. Toca para cambiarlo.',
    en: 'Analytics cookies: accepted. Tap to change this.',
    fr: 'Cookies de mesure d’audience : acceptés. Touchez pour modifier ce choix.',
  },
  'footer.denied': {
    ca: 'Cookies de mesura: rebutjades. Toca per canviar-ho.',
    es: 'Cookies de medición: rechazadas. Toca para cambiarlo.',
    en: 'Analytics cookies: rejected. Tap to change this.',
    fr: 'Cookies de mesure d’audience : refusés. Touchez pour modifier ce choix.',
  },
} as const satisfies Record<string, Entry>;

export type ConsentStringKey = keyof typeof STRINGS;

/**
 * Accessor de textos del bàner. `cs` per «consent strings», igual que `os` a
 * `offline/strings.ts`.
 */
export function cs(key: ConsentStringKey, locale: Locale): string {
  return STRINGS[key][locale];
}
