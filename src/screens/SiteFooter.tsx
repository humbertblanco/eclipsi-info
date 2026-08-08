/**
 * Peu de pàgina: qui ho ha fet, la privadesa, i una línia de meta.
 *
 * EL PEU ÉS LA SIGNATURA, NO L'ARXIU. Abans duia les set files de fonts i es
 * llegia com un peu legal amb una firma perduda a dalt; ara la firma és el
 * protagonista i les fonts viuen on es poden llegir amb calma: senceres a la
 * pàgina «Com funciona» i al diàleg de crèdits del mapa, que ensenyen totes
 * dues LA MATEIXA llista (`features/about/credits.ts`) i no una còpia. El peu
 * només hi deixa la porta, explícita.
 *
 * I AIXÒ ÉS LEGALMENT NET: l'ODbL d'OpenStreetMap no depenia del peu. El mapa
 * porta la seva atribució DINS del llenç (control de MapLibre, a la
 * cantonada) i al seu diàleg de crèdits, que és on la dada es fa servir; la
 * resta de fonts queden atribuïdes a «Com funciona», a un toc d'aquí.
 *
 * LA VERSIÓ ES QUEDA: amb el service worker pel mig, no saber quina versió
 * corres és la diferència entre provar el que has fet i provar el que hi
 * havia abans.
 *
 * Va a l'estructura i no dins d'una pantalla, perquè si fos de cada pantalla
 * n'hi hauria alguna que se'l deixaria.
 */

import type { Locale } from '../i18n';
import { ECLIPSES } from '../core/eclipses/catalog';
import { eclipseDateSlug } from '../content/seo/dateSlug';
import { seoPath, seoPrefix } from '../content/seo/routes';
import type { ConsentState } from '../core/analytics';
import { CREDITS, PRIVACY_NOTE, SOURCES_HEADING } from '../features/about/credits';
import { cs } from '../features/consent/strings';
import './screens.css';
import '../features/consent/consent.css';

/*
 * LA LLISTA DE FONTS JA NO S'ESCRIU AQUÍ, I ES REEXPORTA D'AQUÍ.
 *
 * Vivia en aquest fitxer i «Com funciona» en tenia una còpia declarada
 * (`ABOUT_SOURCES`, amb la nota que era candidata a morir). La còpia va fer el
 * que fan les còpies: el 3 d'agost de 2026 van entrar dues fonts noves —els
 * miradors i cims d'OpenStreetMap, i la llicència CC BY d'Open-Meteo, que són
 * obligacions i no cortesies— i cap de les dues llistes ho deia.
 *
 * Ara la font única és `features/about/credits.ts`. La REEXPORTACIÓ no és
 * pereseja: el diàleg de crèdits del mapa importa `CREDITS`, `PRIVACY_NOTE` i
 * `SOURCES_HEADING` d'aquest mòdul des que existeix, i moure l'escriptura no
 * havia d'obligar a tocar-li ni una línia d'importació. Canvia on s'escriu, no
 * d'on es llegeix.
 */
export {
  CREDITS,
  PRIVACY_NOTE,
  SOURCES_HEADING,
  OBSERVATION_SOURCES_HEADING,
  OBSERVATION_SOURCES_NOTE,
} from '../features/about/credits';
export type { Credit } from '../features/about/credits';

/**
 * Versió i moment de compilació, injectats per Vite.
 *
 * Es llegeixen amb `?? ''` perquè en desenvolupament no hi són i el peu no ha
 * de petar per això: simplement no diu la versió.
 */
const BUILD_VERSION = (import.meta.env.VITE_BUILD_ID as string | undefined) ?? '';

const TEXT = {
  what: PRIVACY_NOTE,
  /*
   * La condició del projecte, dita en veu alta (petició directa de
   * l'usuari): que quedi clar que això no ven res ni vol res de ningú.
   */
  free: {
    ca: 'Gratuït, per a tothom i sense ànim de lucre.',
    es: 'Gratuito, para todo el mundo y sin ánimo de lucro.',
    en: 'Free, for everyone and not for profit.',
    fr: 'Gratuit, ouvert à toutes et à tous, sans but lucratif.',
  },
  /*
   * NO NOMÉS «CODI OBERT»: UNA INVITACIÓ.
   *
   * Deia «Codi obert» i prou, que és una declaració de propietat — diu com és
   * la llicència i s'acaba aquí. Petició directa de l'usuari (4-8-2026): que
   * digui que s'hi pot col·laborar. El verb en segona persona és el que
   * converteix un rètol en una porta; qui llegeix «codi obert» sap que el pot
   * mirar, qui llegeix «hi pots contribuir» sap que l'hi esperen.
   *
   * GitHub s'hi anomena tot i que l'enllaç ja hi va: al peu, un rètol sense
   * destinació obliga a passar el ratolí per sobre per saber on et porta, i al
   * mòbil ni això.
   */
  code: {
    ca: 'Codi obert a GitHub: hi pots contribuir',
    es: 'Código abierto en GitHub: puedes contribuir',
    en: 'Open source on GitHub: you can contribute',
    fr: 'Code source ouvert sur GitHub : vous pouvez contribuer',
  },
  version: { ca: 'Versió', es: 'Versión', en: 'Version', fr: 'Version' },
  by: { ca: 'Fet per', es: 'Hecho por', en: 'Made by', fr: 'Réalisé par' },
  and: { ca: 'i', es: 'y', en: 'and', fr: 'et' },
  /*
   * L'ÚNICA PORTA CAP A LES FONTS — I CAP A «COM FUNCIONA» SENCERA.
   *
   * Les fonts obren la pàgina pel principi. Premsa té una porta pròpia perquè
   * ara conté descàrregues editorials i ha d'aterrar al bloc exacte, però les
   * dues rutes continuen compartint la mateixa pantalla i font de veritat.
   */
  sourcesLink: {
    ca: 'Fonts i atribucions, a «Com funciona»',
    es: 'Fuentes y atribuciones, en «Cómo funciona»',
    en: 'Sources and attribution, under “How it works”',
    fr: 'Sources et attributions, dans « Comment ça marche »',
  },
  pressLink: { ca: 'Premsa', es: 'Prensa', en: 'Press', fr: 'Presse' },
  plan: { ca: 'Planifica els pròxims eclipsis', es: 'Planifica los próximos eclipses', en: 'Plan the next eclipses', fr: 'Préparer les prochaines éclipses' },
  guides: { ca: 'Guies pràctiques', es: 'Guías prácticas', en: 'Practical guides', fr: 'Guides pratiques' },
} as const;

/*
 * ELS CAMINS DEL PEU: DERIVATS, I L'ECLIPSI TAMPOC NO S'ESCRIU.
 *
 * Aquí hi havia una taula amb els dotze camins escrits a mà, `12-08-2026`
 * inclòs. Era la sisena còpia dels mateixos segments d'URL en aquest
 * repositori, i la duplicació d'aquesta llista ja va costar que 1.328 pàgines
 * quedessin invisibles durant tres dies —vegeu la capçalera de
 * `content/seo/routes.ts`.
 *
 * La data escrita a mà era pitjor que la duplicació: el peu de l'app apunta al
 * proper eclipsi, i el 13 d'agost del 2026 aquell enllaç passa a portar a una
 * pàgina d'un fet que ja ha passat. Ara surt del catàleg, ordenat per data, i
 * es mou sol.
 */
function nextEclipseId(nowMs: number): string {
  const upcoming = [...ECLIPSES]
    .map((eclipse) => ({ id: eclipse.id, at: Date.parse(eclipse.greatestEclipseUtc) }))
    .sort((a, b) => a.at - b.at);
  return (upcoming.find((eclipse) => eclipse.at >= nowMs) ?? upcoming[upcoming.length - 1]).id;
}

function seoPaths(locale: Locale, nowMs: number) {
  return {
    eclipse: seoPath(locale, {
      kind: 'eclipse',
      slug: eclipseDateSlug(nextEclipseId(nowMs)),
    }),
    guide: seoPath(locale, { kind: 'guides', slug: '' }),
    about: `/${seoPrefix(locale)}com-funciona/`,
  };
}

const REPO_URL = 'https://github.com/humbertblanco/eclipsi-info';

/**
 * Qui ho signa.
 *
 * ELS DOS AL MATEIX NIVELL, a posta: no és una persona amb un despatx a sota
 * ni un despatx amb una persona a dins. Van a la mateixa línia i amb el mateix
 * pes tipogràfic.
 *
 * PER QUÈ VA PRIMER I GRAN. El peu ÉS la signatura: la resta (privadesa,
 * meta) l'acompanya en segon pla. El pes tipogràfic el posa `screens.css`
 * (`.sitefoot__by`, cos de títol petit): una signatura en cos de nota al
 * final d'una llista es llegia com lletra petita legal, no com una autoria.
 *
 * ELS DOS ENLLACEN, i cadascun al lloc que li toca: la persona al seu perfil i
 * el despatx al seu domini. `url` és opcional perquè el component ha de poder
 * pintar un crèdit sense enllaç el dia que n'hi hagi un que no en tingui.
 */
interface Author {
  name: string;
  url?: string;
}

const AUTHORS: Author[] = [
  { name: 'Humbert Blanco', url: 'https://x.com/humbertblanco' },
  {
    name: 'Damos en el Blanco',
    url: 'https://damosenelblanco.com/?utm_source=eclipsi.info&utm_medium=referral&utm_campaign=credits',
  },
];

export interface SiteFooterProps {
  locale: Locale;
  /*
   * L'ESTAT DEL CONSENTIMENT I COM CANVIAR-LO.
   *
   * Tots dos OPCIONALS, i no per comoditat: el peu s'ha de poder pintar en una
   * prova o en una captura de premsa sense muntar l'estat del consentiment
   * sencer. Quan no hi són, l'enllaç de cookies no existeix — que és el
   * comportament correcte, perquè sense `onChangeConsent` seria un enllaç que
   * no fa res.
   */
  consentState?: ConsentState;
  onChangeConsent?: () => void;
}

export function SiteFooter({ locale, consentState, onChangeConsent }: SiteFooterProps) {
  /*
   * L'ENLLAÇ NOMÉS SURT QUAN JA S'HA CONTESTAT.
   *
   * Amb el bàner obert a la pantalla, un enllaç al peu que obre el bàner no és
   * una segona porta: és el mateix comandament dues vegades, que és exactament
   * el que ESTAT.md diu del commutador de la fitxa i el plafó de capes. Quan
   * l'estat és `'unknown'` el bàner ja hi és (o hi serà en tancar la porta de
   * la ubicació) i aquí no hi ha res a oferir.
   */
  const canChangeConsent =
    onChangeConsent !== undefined && consentState !== undefined && consentState !== 'unknown';
  const paths = seoPaths(locale, Date.now());
  /*
   * El punt de l'usuari sobreviu al salt.
   *
   * «Com funciona» és una navegació de document i no un canvi de fragment:
   * sense arrossegar el `search`, qui hi va des del peu torna a l'app sense el
   * `?p=` i, per tant, sense el lloc que havia triat. Es llegeix del `window`
   * perquè és qui el té; a Node no hi ha `window` i el peu no es pinta.
   */
  const keepPoint = typeof window === 'undefined' ? '' : window.location.search;
  return (
    <footer className="sitefoot">
      <p className="sitefoot__by">
        {TEXT.by[locale]}{' '}
        {AUTHORS.map((author, i) => (
          <span key={author.name}>
            {i > 0 && <span className="sitefoot__and"> {TEXT.and[locale]} </span>}
            {author.url === undefined ? (
              <strong className="sitefoot__author">{author.name}</strong>
            ) : (
              <a className="sitefoot__author" href={author.url} target="_blank" rel="noreferrer noopener">
                {author.name}
              </a>
            )}
          </span>
        ))}
      </p>

      {/* La frase de privadesa es queda, en segon pla: és decisió de producte
          dir-la aquí (vegeu LocationGate.tsx per què es diu on es demana la
          ubicació, i aquí per a qui no hi ha passat). */}
      <p className="sitefoot__what">
        {TEXT.free[locale]} {TEXT.what[locale]}
      </p>

      <nav className="sitefoot__meta" aria-label={TEXT.plan[locale]}>
        <a href={paths.eclipse}>{TEXT.plan[locale]}</a>
        {' · '}
        <a href={paths.guide}>{TEXT.guides[locale]}</a>
      </nav>

      {/*
        ELS CRÈDITS, AL PEU I NO NOMÉS A UN CLIC.

        Fins ara el peu deia «Fonts i atribucions, a “Com funciona”» i prou. Per
        a la majoria de les vuit fonts n'hi ha prou, però DUES no són una
        cortesia: l'ODbL d'OpenStreetMap i la CC BY 4.0 d'Open-Meteo són
        obligacions de llicència, i s'incompleixen mentre la dada es pinta i
        l'atribució viu darrere d'un enllaç que la majoria no obre. La manera de
        complir-les que no depèn de si algú fa clic és dir-ho on la dada es veu.

        LA LLISTA ES DERIVA DE `CREDITS`, no s'escriu. És la mateixa constant que
        pinta «Com funciona» i el diàleg del mapa, i `tests/credits-de-les-fonts.test.ts`
        ja exigeix que tota font que el codi demani hi tingui fila. Si algú
        n'afegeix una, apareix aquí sola; si l'escrivíssim, el peu es quedaria
        enrere exactament com es va quedar l'agost del 2026, quan van entrar els
        miradors d'OSM i la climatologia d'Open-Meteo i cap de les dues llistes
        que hi havia ho deia.

        Només se'n diu `who` i la llicència: el peu no és la pàgina de fonts,
        és la constància que hi són. El «què n'obtenim» de cada fila continua a
        «Com funciona», que és on hi ha lloc per explicar-ho.
      */}
      <p className="sitefoot__meta sitefoot__credits">
        <span className="sitefoot__creditshead">{SOURCES_HEADING[locale]}:</span>{' '}
        {CREDITS.map((credit, index) => (
          <span key={credit.who}>
            {index > 0 && ' · '}
            <a href={credit.url} target="_blank" rel="noreferrer noopener">
              {credit.who}
            </a>
            {credit.licence !== null && ` (${credit.licence})`}
          </span>
        ))}
      </p>

      <p className="sitefoot__meta eclipsi-data">
        {/*
          NAVEGACIÓ DE DOCUMENT, I EL COMENTARI QUE HI HAVIA DEIA EL CONTRARI.

          Aquí hi deia «enllaç d'àncora i no botó: el canvi de hash el recull el
          popstate de l'App». Va deixar de ser cert el dia que `#/com-funciona`
          va passar a `/com-funciona/`: ara això rearrenca la SPA i es perd el
          `?p=` que hi hagués a la barra, o sigui el punt de l'usuari.

          Es manté la recàrrega a posta —el camí curat és el que s'indexa i el
          que la gent enganxa— i es paga afegint-hi el `search` actual, que és
          el que conserva el punt. Un comentari i el seu codi dient coses
          diferents és pitjor que no tenir-ne cap: el següent que hi passi es
          creurà el comentari.
        */}
        <a href={`${paths.about}${keepPoint}`}>{TEXT.sourcesLink[locale]}</a>
        {' · '}
        <a href={`${paths.about}premsa/${keepPoint}`}>{TEXT.pressLink[locale]}</a>
        {' · '}
        <a href={REPO_URL} target="_blank" rel="noreferrer noopener">
          {TEXT.code[locale]}
        </a>
        {/*
          Botó i no enllaç, perquè no navega enlloc: torna a obrir el bàner. Es
          disfressa d'enllaç a `consent.css` perquè al peu ha de pesar el mateix
          que «Codi obert» — ni més (seria cridar l'atenció sobre les cookies
          més que sobre les fonts) ni menys (retirar el consentiment ha de ser
          tan fàcil com donar-lo).

          L'`aria-label` diu QUÈ hi ha contestat ara mateix: qui no veu el bàner
          ha de poder saber-ho sense obrir-lo.
        */}
        {canChangeConsent && (
          <>
            {' · '}
            <button
              type="button"
              className="consent-change"
              onClick={onChangeConsent}
              aria-label={cs(
                consentState === 'granted' ? 'footer.granted' : 'footer.denied',
                locale,
              )}
            >
              {cs('footer.change', locale)}
            </button>
          </>
        )}
        {BUILD_VERSION !== '' && (
          <>
            {' · '}
            {TEXT.version[locale]} {BUILD_VERSION}
          </>
        )}
      </p>
    </footer>
  );
}
