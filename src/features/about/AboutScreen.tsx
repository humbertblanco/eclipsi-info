import { useEffect, useState } from 'react';
import { Badge, Button, Card } from '../../ui';
import type { Locale } from '../../i18n';
import { ab, ABOUT_AUTHORS, type AboutStringKey } from './strings';
/*
 * LA LLISTA DE FONTS NO ÉS D'AQUESTA PANTALLA. Aquí n'hi va viure una còpia
 * (`ABOUT_SOURCES`) i la còpia va costar les dues llicències que faltaven:
 * vegeu la capçalera de `credits.ts`. Ara la pàgina només la pinta.
 */
import { CREDITS } from './credits';
import { ObservationSources } from './ObservationSources';
import './about.css';

/**
 * Pantalla «Com funciona»: què calcula l'app, d'on surt cada dada, què no fa,
 * i el bloc de premsa amb els textos per copiar i els actius de marca.
 *
 * NO DEPÈN DE CAP RUTA: la munta App com les altres pantalles, i l'única
 * navegació que coneix —anar a la seguretat ocular de la guia— li arriba per
 * `onOpenGuideSafety`. Si el cablatge encara no hi és, l'enllaç cau al
 * fragment `#/guia/safety`, que el parser de rutes d'App ja entén: la pàgina
 * funciona abans i després de cablar-la.
 *
 * PER QUÈ NO HI HA CAP AVÍS DE SEGURETAT OCULAR AQUÍ: l'avís de debò viu a la
 * guia, amb la comporta que decideix quan és cert. Duplicar-lo en una pàgina
 * explicativa seria una segona font de veritat sense comporta; el que hi ha és
 * l'enllaç textual que hi porta.
 */
export interface AboutScreenProps {
  locale: Locale;
  /** Secció profunda demanada per l'URL; avui només pot ser `premsa`. */
  initialSection?: string | null;
  /**
   * Obre la guia per la secció de seguretat ocular. Opcional a posta: sense
   * el cablatge, l'enllaç es renderitza com a `<a href="#/guia/safety">` i la
   * navegació per fragment fa la mateixa feina.
   */
  onOpenGuideSafety?: () => void;
}

/**
 * Els actius viuen a `public/brand/` i la ruta es compon amb `BASE_URL`
 * perquè l'app viu en un subdirectori — el mateix motiu que `LOGO_SRC` a
 * App.tsx. Es compon aquí, un sol cop, i no dins del JSX.
 */
const BRAND_BASE = `${import.meta.env.BASE_URL}brand/`;
const PRESS_BASE = `${import.meta.env.BASE_URL}press/`;

interface PressAsset {
  file: string;
  labelKey: AboutStringKey;
}

/** Només els fitxers que EXISTEIXEN a `public/brand/`. Res de promeses. */
const PRESS_ASSETS: PressAsset[] = [
  { file: 'logo.svg', labelKey: 'assets.logo' },
  { file: 'logo-mark.svg', labelKey: 'assets.mark' },
  { file: 'logo-mark-mono.svg', labelKey: 'assets.markMono' },
  { file: 'logo-daylight.svg', labelKey: 'assets.daylight' },
  { file: 'og.png', labelKey: 'assets.og' },
];

/** Quant dura el «Copiat» abans de tornar a ser un botó de copiar. */
const COPIED_FEEDBACK_MS = 2000;

interface CopyBlockProps {
  label: string;
  text: string;
  locale: Locale;
}

/**
 * Un text de premsa amb el seu botó de copiar.
 *
 * El porta-retalls pot no existir (context no segur, navegador vell): si la
 * crida falla, no passa res de sorollós — el text queda sota `user-select:
 * all` al CSS i un toc el selecciona sencer, que és el camí manual de sempre.
 */
function CopyBlock({ label, text, locale }: CopyBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
      })
      .catch(() => {
        /* Sense porta-retalls: el text ja és seleccionable d'un toc. */
      });
  };

  return (
    <div className="about__copyblock">
      <div className="about__copyhead">
        <span className="about__overline">{label}</span>
        <Button
          variant="ghost"
          size="sm"
          icon={copied ? 'check' : undefined}
          onClick={copy}
        >
          {copied ? ab('press.copied', locale) : ab('press.copy', locale)}
        </Button>
      </div>
      <p className="about__copytext">{text}</p>
    </div>
  );
}

export function AboutScreen({ locale, initialSection, onOpenGuideSafety }: AboutScreenProps) {
  const safetyLabel = ab('safety.link', locale);

  useEffect(() => {
    if (initialSection !== 'premsa') return;
    // Després de muntar la ruta mandrosa, deixa que el navegador col·loqui la
    // capçalera i aterra directament. En una pàgina llarga, animar des del peu
    // fins aquí fa perdre el context i deixa les eines assistives "en trànsit".
    const frame = requestAnimationFrame(() => {
      document.getElementById('premsa')?.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialSection]);

  return (
    <div className="screen screen--about">
      <div className="about__main">
        <header className="about__head">
          <h2 className="about__title">{ab('title', locale)}</h2>
          <p className="about__subtitle">{ab('subtitle', locale)}</p>
        </header>

        {/* 1 — El càlcul és topocèntric i es fa al dispositiu. */}
        <Card>
          <span className="about__overline">{ab('calc.overline', locale)}</span>
          <h3 className="about__blocktitle">{ab('calc.title', locale)}</h3>
          <p className="about__p">{ab('calc.p1', locale)}</p>
          <p className="about__p">{ab('calc.p2', locale)}</p>
        </Card>

        {/* 2 — L'horitzó del TEU punt: la funció diferencial del producte. */}
        <Card>
          <span className="about__overline">{ab('horizon.overline', locale)}</span>
          <h3 className="about__blocktitle">{ab('horizon.title', locale)}</h3>
          <p className="about__p">{ab('horizon.p1', locale)}</p>
          <p className="about__p">{ab('horizon.p2', locale)}</p>
        </Card>

        {/* 3 — D'on surt cada dada, amb enllaç per anar-ho a comprovar. */}
        <Card>
          <span className="about__overline">{ab('sources.overline', locale)}</span>
          <h3 className="about__blocktitle">{ab('sources.title', locale)}</h3>
          <p className="about__p">{ab('sources.p1', locale)}</p>
          <ul className="about__sources">
            {/*
              LA CLAU ÉS `who` I NO `url`: les dues files d'OpenStreetMap —la
              cartografia i els miradors— apunten totes dues a la pàgina de la
              llicència, perquè és on són les condicions de totes dues. Amb
              `key={source.url}` serien dues germanes amb la mateixa clau.
            */}
            {CREDITS.map((source) => (
              <li key={source.who}>
                <span className="about__sourcewhat">{source.what[locale]}</span>
                {/*
                  EL NOM I LA LLICÈNCIA VAN JUNTS I EN AQUEST ORDRE. «Open-Meteo
                  (CC BY 4.0)» és l'atribució sencera; el nom sol no compleix res
                  i la llicència sola no diu de qui. Les files sense llicència no
                  pinten el parèntesi buit —cada `null` de `credits.ts` porta el
                  motiu escrit— perquè un «(—)» es llegeix com una dada que falta
                  quan el que passa és que aquella font no en té cap.
                */}
                <span className="about__sourcewho">
                  <a href={source.url} target="_blank" rel="noreferrer noopener">
                    {source.who}
                  </a>
                  {source.licence !== null && (
                    <span className="about__sourcelicence">{source.licence}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {/*
            Sense `eclipseId`: aquesta pàgina explica l'app i no una data, i per
            això llista les administracions de tot el catàleg. Si no n'hi hagués
            cap, el bloc no es pinta —ni el títol.
          */}
          <ObservationSources locale={locale} />
        </Card>

        {/* 4 — Els límits, dits en positiu de privacitat i no de mancança. */}
        <Card>
          <span className="about__overline">{ab('not.overline', locale)}</span>
          <h3 className="about__blocktitle">{ab('not.title', locale)}</h3>
          <ul className="about__not">
            <li>{ab('not.lang', locale)}</li>
            <li>{ab('not.location', locale)}</li>
            <li>{ab('not.offline', locale)}</li>
          </ul>
        </Card>

        {/* L'enllaç textual a la guia; l'avís de debò és allà. */}
        <p className="about__safetylink">
          {onOpenGuideSafety !== undefined ? (
            <button type="button" className="about__guidelink" onClick={onOpenGuideSafety}>
              {safetyLabel}
            </button>
          ) : (
            <a className="about__guidelink" href="#/guia/safety">
              {safetyLabel}
            </a>
          )}
        </p>
      </div>

      {/* --- Premsa: la dada, els textos per enganxar, els actius, el contacte. */}
      <aside id="premsa" className="about__side" aria-labelledby="premsa-title">
        <Card>
          <div className="about__presshead">
            <span className="about__overline">{ab('press.overline', locale)}</span>
            <Badge tone="info">{ab('press.badge', locale)}</Badge>
          </div>
          <h3 id="premsa-title" className="about__blocktitle">{ab('press.title', locale)}</h3>
          <p className="about__p">{ab('press.fact', locale)}</p>

          <div className="about__mediakit">
            <span className="about__overline">{ab('media.overline', locale)}</span>
            <p className="about__assetsnote">{ab('media.note', locale)}</p>
            <div className="about__mediagrid">
              <figure className="about__media">
                <img
                  src={`${PRESS_BASE}simulacio-eclipsi.png`}
                  alt={ab('media.simulationAlt', locale)}
                  width="1122"
                  height="1402"
                  loading="lazy"
                  decoding="async"
                />
                <figcaption>
                  <span>{ab('media.simulation', locale)}</span>
                  <a href={`${PRESS_BASE}simulacio-eclipsi.png`} download>
                    {ab('media.download', locale)}
                  </a>
                </figcaption>
              </figure>
              <figure className="about__media">
                <img
                  src={`${PRESS_BASE}vista-escriptori.png`}
                  alt={ab('media.desktopAlt', locale)}
                  width="1448"
                  height="1086"
                  loading="lazy"
                  decoding="async"
                />
                <figcaption>
                  <span>{ab('media.desktop', locale)}</span>
                  <a href={`${PRESS_BASE}vista-escriptori.png`} download>
                    {ab('media.download', locale)}
                  </a>
                </figcaption>
              </figure>
            </div>
            <a className="about__pressrelease" href={`${PRESS_BASE}nota-premsa-eclipsi-info.docx`} download>
              {ab('media.release', locale)}
              <span>DOCX</span>
            </a>
          </div>

          <CopyBlock
            label={ab('press.oneLinerLabel', locale)}
            text={ab('press.oneLiner', locale)}
            locale={locale}
          />
          <CopyBlock
            label={ab('press.paragraphLabel', locale)}
            text={ab('press.paragraph', locale)}
            locale={locale}
          />

          <div className="about__assets">
            <span className="about__overline">{ab('assets.overline', locale)}</span>
            <p className="about__assetsnote">{ab('assets.note', locale)}</p>
            <ul className="about__assetlist">
              {PRESS_ASSETS.map((asset) => (
                <li key={asset.file}>
                  <span className="about__sourcewhat">{ab(asset.labelKey, locale)}</span>
                  {/* `download` sense valor: mateix origen, el nom del fitxer
                      ja és el bo i el navegador el desa en comptes d'obrir-lo. */}
                  <a href={`${BRAND_BASE}${asset.file}`} download>
                    {asset.file}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <p className="about__contact">
            {ab('contact.lead', locale)}{' '}
            {ABOUT_AUTHORS.map((author, i) => (
              <span key={author.name}>
                {i > 0 && <span> {ab('contact.and', locale)} </span>}
                <a href={author.url} target="_blank" rel="noreferrer noopener">
                  {author.name}
                </a>
              </span>
            ))}
          </p>
        </Card>
      </aside>
    </div>
  );
}
