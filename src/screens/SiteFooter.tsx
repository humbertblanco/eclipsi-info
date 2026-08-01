/**
 * Peu de pàgina: qui ho ha fet, amb quines dades, i la versió que corres.
 *
 * PER QUÈ NO ÉS DECORACIÓ. Tres raons, i cap és estètica:
 *
 *  1. LES LLICÈNCIES HO EXIGEIXEN. Els topònims i la cartografia són dades
 *     d'OpenStreetMap sota ODbL, i la trajectòria de l'ombra és de Fred
 *     Espenak. L'atribució ha de ser visible allà on es fa servir la dada, i
 *     fins ara només sortia al peu del mapa i dins de la guia: qui es passava
 *     l'estona al compte enrere o a la càmera no la veia mai.
 *  2. LA VERSIÓ. S'ha perdut més d'una estona dubtant si una cosa estava
 *     pujada o no. Amb el service worker pel mig, no saber quina versió corres
 *     no és una curiositat: és la diferència entre provar el que has fet i
 *     provar el que hi havia abans.
 *  3. D'ON SURTEN ELS NÚMEROS. Una app que et diu que et pots treure una
 *     protecció ocular ha de poder dir contra què s'ha validat.
 *
 * Va a l'estructura i no dins d'una pantalla, perquè si fos de cada pantalla
 * n'hi hauria alguna que se'l deixaria.
 */

import type { Locale } from '../i18n';
import './screens.css';

/**
 * Versió i moment de compilació, injectats per Vite.
 *
 * Es llegeixen amb `?? ''` perquè en desenvolupament no hi són i el peu no ha
 * de petar per això: simplement no diu la versió.
 */
const BUILD_VERSION = (import.meta.env.VITE_BUILD_ID as string | undefined) ?? '';

interface Credit {
  what: Record<Locale, string>;
  who: string;
  url: string;
}

/**
 * D'on surt cada cosa.
 *
 * L'ordre és el de la importància per a l'usuari, no el alfabètic: primer el
 * que decideix les xifres, després el que decideix el que veu.
 */
const CREDITS: Credit[] = [
  {
    what: { ca: 'Efemèrides', es: 'Efemérides' },
    who: 'astronomy-engine',
    url: 'https://github.com/cosinekitty/astronomy',
  },
  {
    what: { ca: 'Trajectòria de l’ombra', es: 'Trayectoria de la sombra' },
    who: 'Fred Espenak, NASA/GSFC',
    url: 'https://eclipse.gsfc.nasa.gov/',
  },
  {
    what: { ca: 'Dades d’observació', es: 'Datos de observación' },
    who: 'IGN',
    url: 'https://eclipses.ign.es/',
  },
  {
    what: { ca: 'Model del terreny', es: 'Modelo del terreno' },
    who: 'AWS Terrain Tiles',
    url: 'https://registry.opendata.aws/terrain-tiles/',
  },
  {
    what: { ca: 'Cartografia i topònims', es: 'Cartografía y topónimos' },
    who: 'OpenStreetMap · Photon · CARTO',
    url: 'https://www.openstreetmap.org/copyright',
  },
  {
    what: { ca: 'Meteorologia', es: 'Meteorología' },
    who: 'Open-Meteo',
    url: 'https://open-meteo.com/',
  },
  {
    what: { ca: 'Seguretat ocular', es: 'Seguridad ocular' },
    who: 'AAS · ISO 12312-2',
    url: 'https://eclipse.aas.org/eye-safety',
  },
];

const TEXT = {
  what: {
    ca: 'Els càlculs es fan al teu dispositiu. La teva ubicació no surt d’aquí.',
    es: 'Los cálculos se hacen en tu dispositivo. Tu ubicación no sale de aquí.',
  },
  sources: { ca: 'D’on surten les dades', es: 'De dónde salen los datos' },
  code: { ca: 'Codi obert', es: 'Código abierto' },
  version: { ca: 'Versió', es: 'Versión' },
  by: { ca: 'Fet per', es: 'Hecho por' },
  and: { ca: 'i', es: 'y' },
} as const;

const REPO_URL = 'https://github.com/humbertblanco/eclipsi-info';

/**
 * Qui ho signa.
 *
 * ELS DOS AL MATEIX NIVELL, a posta: no és una persona amb un despatx a sota
 * ni un despatx amb una persona a dins. Van a la mateixa línia i amb el mateix
 * pes tipogràfic.
 *
 * PER QUÈ VA ABANS DE LES FONTS I NO AL FINAL. El peu respon tres preguntes i
 * aquest és l'ordre en què se les fa qui hi arriba: qui ho ha fet, d'on surten
 * els números, i què estic corrent. L'autoria al final, després de set files
 * de proveïdors i enganxada a la versió, es llegeix com un peu de pàgina
 * legal; aquí és una signatura.
 *
 * SENSE ENLLAÇ. No n'hi ha cap que es pugui posar sense inventar-se'l: el
 * repositori ja té la seva línia més avall. El dia que hi hagi un lloc web,
 * s'hi afegeix `url` i el component ja el pintarà.
 */
interface Author {
  name: string;
  url?: string;
}

const AUTHORS: Author[] = [{ name: 'Humbert Blanco' }, { name: 'Damos en el Blanco' }];

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

      <p className="sitefoot__what">{TEXT.what[locale]}</p>

      <p className="screen__overline">{TEXT.sources[locale]}</p>
      <ul className="sitefoot__list">
        {CREDITS.map((credit) => (
          <li key={credit.url}>
            <span className="sitefoot__what2">{credit.what[locale]}</span>
            <a href={credit.url} target="_blank" rel="noreferrer noopener">
              {credit.who}
            </a>
          </li>
        ))}
      </ul>

      <p className="sitefoot__meta eclipsi-data">
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
