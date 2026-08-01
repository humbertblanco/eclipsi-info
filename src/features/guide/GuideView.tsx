/**
 * Vista de la guia de l'eclipsi.
 *
 * Renderitza el contingut tipat de `src/content/guide.ts` en seccions
 * plegables. El component no sap res del contingut: només sap pintar blocs.
 * Així, afegir un apartat nou a la guia és editar dades, no tocar JSX.
 *
 * Es fa amb <details>/<summary> natius i no amb estat de React perquè el
 * navegador ja se n'encarrega (teclat, cerca dins la pàgina amb Ctrl+F, i
 * l'obertura automàtica en imprimir), i perquè així funciona sense JavaScript
 * si mai servim la guia estàtica per a l'ús offline.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  GUIDE_SOURCES,
  getEclipseHighlight,
  getGuide,
  isCritical,
  type GuideBlock,
  type GuideSection,
} from '../../content/guide';
import { getEclipse } from '../../core/eclipses/catalog';
import { useTranslation } from '../../i18n';
import { SafetyBanner } from './SafetyBanner';
import './guide.css';

export interface GuideViewProps {
  eclipseId: string;
}

/* ------------------------------------------------------------- blocs */

function Block({ block, index }: { block: GuideBlock; index: number }) {
  switch (block.kind) {
    case 'p':
      return <p className="guide__p">{block.text}</p>;

    case 'list':
      return (
        <ul className={`guide__list${block.tone ? ` guide__list--${block.tone}` : ''}`}>
          {block.items.map((item, i) => (
            <li key={`${index}-${i}`}>{item}</li>
          ))}
        </ul>
      );

    case 'defs':
      return (
        <dl className="guide__defs">
          {block.items.map((item, i) => (
            <div key={`${index}-${i}`}>
              <dt>{item.term}</dt>
              <dd>{item.text}</dd>
            </div>
          ))}
        </dl>
      );

    case 'callout':
      return (
        <aside className={`guide__callout guide__callout--${block.tone}`}>
          <strong>{block.title}</strong>
          <p>{block.text}</p>
        </aside>
      );

    case 'table':
      return (
        <figure className="guide__tablewrap">
          {/* L'embolcall amb scroll horitzontal evita que la taula
              d'exposicions desbordi la pantalla d'un mòbil. */}
          <div className="guide__tablescroll">
            <table className="guide__table">
              <thead>
                <tr>
                  {block.head.map((h, i) => (
                    <th key={`${index}-h-${i}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={`${index}-r-${r}`}>
                    {row.map((cell, c) => (
                      <td key={`${index}-r-${r}-${c}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption && (
            <figcaption className="guide__caption">{block.caption}</figcaption>
          )}
        </figure>
      );
  }
}

/* ---------------------------------------------------------- seccions */

interface SectionProps {
  section: GuideSection;
  critical: boolean;
  open: boolean;
  badge: string;
}

function Section({ section, critical, open, badge }: SectionProps) {
  return (
    <details
      className={`guide__section${critical ? ' guide__section--critical' : ''}`}
      open={open}
    >
      <summary className="guide__summary">
        <span className="guide__summaryhead">
          <span className="guide__title">{section.title}</span>
          {critical && <span className="guide__badge">{badge}</span>}
        </span>
        <span className="guide__lead">{section.lead}</span>
      </summary>
      <div className="guide__body">
        {section.blocks.map((block, i) => (
          <Block key={`${section.id}-${i}`} block={block} index={i} />
        ))}
      </div>
    </details>
  );
}

/* -------------------------------------------------------------- vista */

export function GuideView({ eclipseId }: GuideViewProps) {
  const { locale, t } = useTranslation();

  // Si l'id no és al catàleg no volem que la guia peti: mostrem el contingut
  // genèric i prou. La guia ha de ser el component més robust de l'app.
  const eclipse = useMemo(() => {
    try {
      return getEclipse(eclipseId);
    } catch {
      return null;
    }
  }, [eclipseId]);

  const sections = useMemo(() => getGuide(locale, eclipseId), [locale, eclipseId]);
  const highlight = useMemo(
    () => getEclipseHighlight(eclipseId, locale),
    [eclipseId, locale],
  );

  // `null` = cada secció decideix (defaultOpen o criticalFor).
  const [forcedOpen, setForcedOpen] = useState<boolean | null>(null);
  const generation = useRef(0);

  const toggleAll = useCallback((next: boolean) => {
    generation.current += 1;
    setForcedOpen(next);
  }, []);

  const allOpen = forcedOpen === true;

  return (
    <section className="guide">
      <header className="guide__head">
        <h2>{t('guide.title')}</h2>
        <p className="guide__subtitle">
          {t('guide.subtitle', {
            eclipse: eclipse ? eclipse.label[locale] : t('guide.title'),
          })}
        </p>
      </header>

      {/* El banner de seguretat encapçala la guia amb el veredicte estàtic de
          l'eclipsi triat: fora de la totalitat, sempre filtre. */}
      <SafetyBanner
        eclipseKind={eclipse ? eclipse.kind : 'none'}
        isInTotality={false}
        className="guide__banner"
      />

      {highlight && (
        <aside className={`guide__callout guide__callout--${highlight.tone}`}>
          <strong>{highlight.title}</strong>
          <p>{highlight.text}</p>
        </aside>
      )}

      <p className="guide__hint">{t('guide.readingTime')}</p>

      <div className="guide__toolbar">
        <button className="btn" onClick={() => toggleAll(!allOpen)}>
          {allOpen ? t('guide.collapseAll') : t('guide.expandAll')}
        </button>
      </div>

      <div className="guide__sections">
        {sections.map((section) => {
          const critical = isCritical(section, eclipseId);
          return (
            // La clau inclou la generació: canviar-la remunta el <details>
            // amb el nou `open` per defecte, que és la manera neta de fer
            // «obre-ho tot» sense controlar l'estat de cada secció una a una.
            <Section
              key={`${section.id}-${generation.current}`}
              section={section}
              critical={critical}
              open={forcedOpen ?? (section.defaultOpen === true || critical)}
              badge={t('guide.criticalBadge')}
            />
          );
        })}
      </div>

      <footer className="guide__sources">
        <h3>{t('guide.sourcesTitle')}</h3>
        <p className="guide__sourcesnote">{t('guide.sourcesNote')}</p>
        <ul>
          {GUIDE_SOURCES.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </footer>
    </section>
  );
}
