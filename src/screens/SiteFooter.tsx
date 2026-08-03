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
import { PRIVACY_NOTE } from '../features/about/credits';
import './screens.css';

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
  },
  code: { ca: 'Codi obert', es: 'Código abierto' },
  version: { ca: 'Versió', es: 'Versión' },
  by: { ca: 'Fet per', es: 'Hecho por' },
  and: { ca: 'i', es: 'y' },
  /*
   * L'ÚNICA PORTA CAP A LES FONTS — I CAP A «COM FUNCIONA» SENCERA.
   *
   * Abans hi havia dos rètols que podien acabar sent dos enllaços a la
   * mateixa pàgina: «Com funciona · Premsa» i la llista de fonts. Fusionats:
   * un sol enllaç que diu explícitament que les fonts i atribucions són allà.
   * La premsa segueix vivint dins de «Com funciona»; qui la busca hi arriba
   * per la mateixa porta, i el peu no ha de fer d'índex de la pàgina que obre.
   */
  sourcesLink: {
    ca: 'Fonts i atribucions, a «Com funciona»',
    es: 'Fuentes y atribuciones, en «Cómo funciona»',
  },
} as const;

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
  { name: 'Damos en el Blanco', url: 'https://damosenelblanco.com' },
];

export function SiteFooter({ locale }: { locale: Locale }) {
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

      <p className="sitefoot__meta eclipsi-data">
        {/*
          Enllaç d'àncora i no botó: el canvi de hash el recull el popstate de
          l'App i la pantalla «Com funciona» s'obre com qualsevol altra ruta.
        */}
        <a href="#/com-funciona">{TEXT.sourcesLink[locale]}</a>
        {' · '}
        <a href={REPO_URL} target="_blank" rel="noreferrer noopener">
          {TEXT.code[locale]}
        </a>
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
