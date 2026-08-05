/** Genera pàgines editorials estàtiques després de Vite, fora del precache PWA. */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { computeLocalCircumstances } from '../src/core/astro/contacts';
import { computeEclipsePath, distanceToCenterLineKm } from '../src/core/eclipses/path';
import { ECLIPSES, type EclipseEntry } from '../src/core/eclipses/catalog';
import { pointsForEclipse, type ObservationPoint } from '../src/data/observation-points/catalog';
import { EDITORIAL_GUIDE_IDS, getEditorialGuide, type EditorialGuideId } from '../src/content/editorial-guides';
import { GUIDE_SOURCES, getGuide, type GuideBlock } from '../src/content/guide';
import { SEO_CITIES } from '../src/content/seo/cities';
import { eclipseDateSlug } from '../src/content/seo/dateSlug';
import { SEO_EVENT_WINDOWS } from '../src/content/seo/events';
import type { SeoCity } from '../src/content/seo/types';
import { SEO_LOCALES, SEO_SITE, prefix, seoStrings } from '../src/content/seo/strings';
import type { Locale } from '../src/i18n';
import { Badge, Card, PhaseDial, SafetyNotice, Stat, TimelineTrack } from '../src/ui';
import type { BadgeProps, CardProps, SafetyNoticeProps } from '../src/ui';

const OUT = resolve(process.env.ECLIPSI_OUT_DIR ?? 'dist');
type Kind = 'eclipse' | 'city' | 'point' | 'guide' | 'guides';
interface Route { kind: Kind; id: string; eclipseId?: string }
interface Page { route: Route; html: string }
let appStylesheets = '';
let seoWidgetScript = '';
const DATA_VISUAL_CSS = `<style>
html,body{max-width:100%;overflow-x:hidden}.visual-card{margin:0}.hero h1{max-width:100%;overflow-wrap:anywhere;font-size:clamp(2.5rem,5.5vw,4.5rem)!important}.hero__eyebrow{display:inline-flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-4);font:var(--text-overline);letter-spacing:var(--ls-caps);text-transform:uppercase;color:var(--status-info)}.hero__eyebrow:before{content:'';width:8px;height:8px;border-radius:50%;background:var(--status-info);box-shadow:0 0 0 5px color-mix(in srgb,var(--status-info) 15%,transparent)}body[data-page-kind="point"] .hero{padding-bottom:var(--sp-6)}
.map-embed{position:relative;overflow:hidden;border:1px solid var(--border-hairline);border-radius:var(--r-lg);background:var(--bg-inset)}.map-embed iframe{display:block;width:100%;height:clamp(430px,58vw,650px);border:0;background:var(--bg-inset)}.map-embed__label{position:absolute;left:var(--sp-4);bottom:var(--sp-4);z-index:2;display:inline-flex;align-items:center;min-height:42px;padding:0 var(--sp-4);border:1px solid var(--border-subtle);border-radius:var(--r-pill);background:var(--surface-glass);backdrop-filter:var(--blur-glass);color:var(--text-primary);font:var(--text-label);pointer-events:none}
.locator{display:block;position:relative;aspect-ratio:725/532!important;overflow:hidden;border-top:1px solid var(--border-hairline);background:var(--bg-inset)!important;border-bottom:0}
.locator svg{display:block;width:100%;height:100%}.map-band{fill:rgba(255,165,31,.20)}.map-limit{fill:none;stroke:var(--sun-400,#ffc257);stroke-width:2}.map-center{fill:none;stroke:var(--corona-100,#fffaf2);stroke-width:1.5;stroke-dasharray:7 8;opacity:.8}.map-official{fill:var(--status-info,#4fa8e8);stroke:var(--ink-950,#05060b);stroke-width:3}.map-user circle:first-child{fill:var(--ink-950,#05060b);stroke:var(--corona-100,#fffaf2);stroke-width:4}.map-user circle:last-child{fill:var(--accent,#ffa51f)}.map-legend{position:absolute;left:14px;right:14px;bottom:12px;padding:9px 11px;border:1px solid var(--border-subtle);border-radius:var(--r-pill);background:var(--surface-glass);backdrop-filter:var(--blur-glass);color:var(--text-body);font:var(--text-body-sm);display:flex;align-items:center;gap:8px}.map-legend i{width:20px;height:7px;background:var(--accent-quiet);border:1px solid var(--accent);display:inline-block}
.seo-nav{position:sticky;top:0;z-index:30;width:100%;padding-left:var(--gutter-web);padding-right:var(--gutter-web);background:var(--surface-glass);backdrop-filter:var(--blur-glass)}.seo-nav__links{display:flex;gap:var(--sp-7);align-items:center;margin-left:auto}.seo-nav__links a{border:0;color:var(--text-secondary);font:var(--text-body-sm)}.seo-nav__links .seo-nav__cta{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:auto!important;height:44px!important;min-height:44px!important;margin:0!important;padding:0 var(--sp-5)!important;background:var(--accent)!important;color:var(--on-accent)!important;border-radius:var(--r-pill)!important;font:var(--text-label)!important;line-height:1!important;white-space:nowrap}.seo-dateline{display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--sp-2) var(--sp-8);padding:var(--sp-4) 0;border-bottom:1px solid var(--border-subtle);font:var(--text-overline);letter-spacing:var(--ls-caps);text-transform:uppercase;color:var(--text-muted)}
.spot-list{display:grid;gap:10px;padding:0;list-style:none}.spot-list li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 18px;padding:16px 18px;border:1px solid var(--border-hairline);border-radius:var(--r-md);background:var(--surface-card)}.spot-list a{font:var(--text-label);border:0}.spot-list strong{font:var(--text-data);color:var(--text-primary);font-variant-numeric:tabular-nums}.spot-list span{grid-column:1/-1;color:var(--text-muted);font:var(--text-body-sm)}
.tool-actions{max-width:800px;margin:28px auto 42px;display:flex;align-items:center;flex-wrap:wrap;gap:10px}.tool-actions .cta{margin:0}.tool-actions>a:not(.cta){min-height:44px;display:inline-flex;align-items:center;padding:0 16px;border:1px solid var(--border-hairline);border-radius:var(--r-pill);background:var(--surface-card);color:var(--text-body);font:var(--text-label)}.tool-actions__sky{display:none!important}.seo-live-widgets{display:grid;gap:var(--sp-8);margin:var(--sp-10) 0}.seo-live-section{max-width:none!important;margin:0!important}.seo-live-section>.simulation,.seo-live-section>.cloudpanel{margin-top:var(--sp-5)}.seo-live-minimap{padding:0!important;overflow:hidden}.visual-grid--phase{grid-template-columns:minmax(0,1fr);max-width:800px;margin-left:auto;margin-right:auto}.seo-pointsmap{position:relative}.seo-pointsmap__markers{position:absolute;inset:0;pointer-events:none}.seo-pointsmap__marker{position:absolute;z-index:3;display:grid;place-items:center;width:30px;height:30px;transform:translate(-50%,-50%);border:3px solid var(--ink-950);border-radius:50%;background:var(--status-info);color:var(--ink-950);font:var(--text-data-sm);pointer-events:auto;box-shadow:0 2px 12px rgba(0,0,0,.45)}.seo-pointsmap__legend{list-style:none;margin:0;padding:var(--sp-4);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sp-2);border-top:1px solid var(--border-hairline)}.seo-pointsmap__legend a{display:flex;align-items:center;gap:var(--sp-3);min-height:44px;border:0;color:var(--text-body);font:var(--text-body-sm)}.seo-pointsmap__legend span{flex:0 0 26px;height:26px;display:grid;place-items:center;border-radius:50%;background:var(--status-info);color:var(--ink-950);font:var(--text-data-sm)}
.timeline-widget{margin:var(--sp-5) 0 var(--sp-9);padding:0 var(--sp-5)}.seo-position{margin:0 0 var(--sp-3)}.seo-stats{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--sp-5);margin:var(--sp-5) 0}.seo-guide-safety{max-width:800px;margin:var(--sp-8) auto}.guide-index{max-width:800px;margin:var(--sp-8) auto}.guide-index ol{list-style:none;padding:0;margin:0;border-top:1px solid var(--border-strong)}.guide-index a{display:grid;grid-template-columns:42px minmax(0,1fr);gap:var(--sp-4);padding:var(--sp-4) 0;border-bottom:1px solid var(--border-hairline);font:var(--text-label)}.guide-index span{font:var(--text-overline);color:var(--text-accent)}
.seo-local-phase{height:100%;display:grid!important;grid-template-columns:180px minmax(0,1fr);align-items:center;gap:var(--sp-6);padding:var(--sp-6)!important}.seo-local-phase__visual{display:grid;justify-items:center;gap:var(--sp-3)}.seo-local-phase__visual span{font:var(--text-overline);color:var(--text-muted);text-align:center}.seo-local-phase__stats{display:grid;grid-template-columns:1fr;gap:var(--sp-5)}.seo-local-detail{max-width:800px;margin:var(--sp-8) auto}.seo-local-detail>.ui-card{padding:var(--sp-6)}.seo-local-detail .fingerprint{max-width:none}.seo-local-detail__intro{margin-bottom:var(--sp-4);color:var(--text-secondary)}
.official-identity{max-width:800px;margin:0 auto var(--sp-7);padding:var(--sp-5);border:1px solid var(--status-info);border-radius:var(--r-lg);background:var(--surface-card);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--sp-3) var(--sp-6)}.official-identity__eyebrow{font:var(--text-overline);letter-spacing:var(--ls-caps);text-transform:uppercase;color:var(--status-info)}.official-identity strong{font:var(--text-title-3);color:var(--text-primary)}.official-identity p{grid-column:1/-1;margin:0;color:var(--text-secondary)}.official-identity a{border:0}
.editorial-guide{display:grid;grid-template-columns:230px minmax(0,1fr);align-items:start;gap:var(--sp-9);max-width:980px;margin:var(--sp-8) auto}.editorial-guide__toc{display:block!important;position:sticky;top:96px}.editorial-guide__toc a{justify-content:flex-start;width:100%;text-align:left;border:0}.editorial-guide__body{min-width:0}.editorial-guide__body .guide__section{background:var(--surface-card)}.editorial-guide__faq{margin-top:var(--sp-9)}
.guide-decision{max-width:980px;margin:var(--sp-7) auto var(--sp-9);padding:var(--sp-5);border:1px solid var(--border-hairline);border-radius:var(--r-lg);background:var(--surface-card)}.guide-decision__head{display:flex;justify-content:space-between;align-items:end;gap:var(--sp-5);margin-bottom:var(--sp-5)}.guide-decision__head h2{margin:0}.guide-decision__head p{max-width:46ch;margin:0;color:var(--text-muted);font:var(--text-body-sm)}.guide-decision__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--sp-3)}.guide-decision__item{min-width:0;padding:var(--sp-4);border:1px solid var(--border-hairline);border-radius:var(--r-md);background:var(--bg-inset)}.guide-decision__item span{display:block;margin-bottom:var(--sp-3);font:var(--text-overline);letter-spacing:var(--ls-caps);text-transform:uppercase;color:var(--text-muted)}.guide-decision__item strong{display:block;color:var(--text-primary);font:var(--text-title-3)}.guide-decision__item p{margin:var(--sp-2) 0 0;color:var(--text-secondary);font:var(--text-body-sm)}.guide-decision__item--safe{border-color:color-mix(in oklab,var(--status-clear) 42%,transparent)}.guide-decision__item--safe strong{color:var(--status-clear)}.guide-decision__item--danger{border-color:color-mix(in oklab,var(--status-danger) 42%,transparent)}.guide-decision__item--danger strong{color:var(--status-danger)}.guide-decision__item--accent strong{color:var(--accent)}.guide-essentials{max-width:980px;margin:var(--sp-9) auto}.guide-essentials>h2{margin-bottom:var(--sp-5)}.guide-essentials__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sp-4)}.guide-essentials article{padding:var(--sp-5);border:1px solid var(--border-hairline);border-radius:var(--r-lg);background:var(--surface-card)}.guide-essentials article h3{margin:0 0 var(--sp-3);color:var(--text-primary)}.guide-essentials article p{margin:0;color:var(--text-secondary);font:var(--text-body-sm)}.guide-essentials article ul{margin:var(--sp-4) 0 0;padding-left:var(--sp-5);font:var(--text-body-sm)}.guide-tool-link{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-5);max-width:980px;margin:var(--sp-7) auto;padding:var(--sp-5);border:1px solid var(--border-subtle);border-radius:var(--r-lg);background:var(--surface-card-hover)}.guide-tool-link strong{display:block;color:var(--text-primary)}.guide-tool-link p{margin:var(--sp-1) 0 0;color:var(--text-muted);font:var(--text-body-sm)}.guide-tool-link a{flex:0 0 auto}.guide-sources{max-width:800px;margin:var(--sp-10) auto}.guide-sources p{color:var(--text-muted);font:var(--text-body-sm)}.guide-sources ul{padding-left:var(--sp-5)}.guide-sources li{margin:var(--sp-2) 0;font:var(--text-body-sm)}
.guide-hub{max-width:980px;margin:0 auto}.guide-hub__intro{max-width:760px;color:var(--text-secondary);font:var(--text-body-lg)}.guide-hub__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--sp-4);margin:var(--sp-8) 0}.guide-hub__card{display:flex;min-width:0;flex-direction:column;padding:var(--sp-5);border:1px solid var(--border-hairline);border-radius:var(--r-lg);background:var(--surface-card)}.guide-hub__card>span{font:var(--text-overline);letter-spacing:var(--ls-caps);text-transform:uppercase;color:var(--text-accent)}.guide-hub__card h2{margin:var(--sp-4) 0 var(--sp-3);font:var(--text-title-2)}.guide-hub__card p{flex:1;margin:0 0 var(--sp-5);color:var(--text-secondary);font:var(--text-body-sm)}.guide-hub__card a{align-self:flex-start}.guide-hub__route{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--sp-4);padding:0;list-style:none;counter-reset:route}.guide-hub__route li{counter-increment:route;padding:var(--sp-5);border-top:1px solid var(--border-strong)}.guide-hub__route li:before{content:'0' counter(route);display:block;margin-bottom:var(--sp-3);font:var(--text-overline);color:var(--text-accent)}.guide-hub__route strong{display:block;color:var(--text-primary)}.guide-hub__route span{display:block;margin-top:var(--sp-2);color:var(--text-muted);font:var(--text-body-sm)}
.guide-filter-note{display:flex;align-items:center;gap:var(--sp-4);max-width:800px;margin:var(--sp-6) auto;padding:var(--sp-4);border:1px solid color-mix(in oklab,var(--status-danger) 35%,transparent);border-radius:var(--r-md);background:var(--status-danger-quiet)}.guide-filter-note strong{color:var(--status-danger)}.guide-filter-note span{flex:1;color:var(--text-secondary);font:var(--text-body-sm)}.guide-filter-note a{flex:0 0 auto;border:0;font:var(--text-label)}
.overview-map{margin:0 0 var(--sp-9);max-width:none}.city-directory,.point-directory{display:grid;gap:10px}.city-group,.point-group{border:1px solid var(--border-hairline);border-radius:var(--r-md);background:var(--surface-card);overflow:hidden}.city-group summary,.point-group summary{min-height:56px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 18px;cursor:pointer;color:var(--text-primary);font:var(--text-label)}.city-group summary strong,.point-group summary strong{font:var(--text-data-sm);color:var(--text-muted)}.city-group ul,.point-group ul{list-style:none;padding:0;margin:0;border-top:1px solid var(--border-hairline);display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.city-group li,.point-group li{min-width:0;border-bottom:1px solid var(--border-hairline)}.city-group li:nth-child(odd),.point-group li:nth-child(odd){border-right:1px solid var(--border-hairline)}.city-group a,.point-group li{display:grid;gap:6px;padding:14px 18px}.city-group a,.point-group a{border:0}.city-group strong,.point-group a{font:var(--text-label);color:var(--text-primary)}.city-group span,.point-group li span{font:var(--text-data-sm);color:var(--text-muted);font-variant-numeric:tabular-nums}.directory-outcome{display:inline-flex;align-items:center;gap:var(--sp-2)}.directory-outcome:before{content:'';width:7px;height:7px;border-radius:50%;background:var(--text-muted)}.directory-outcome--central:before{background:var(--status-clear)}.directory-outcome--edge:before{background:var(--status-partial)}
.event-intro{max-width:800px;margin:var(--sp-8) auto}.event-intro__lead{font:var(--text-body-lg);color:var(--text-primary)}.event-steps{counter-reset:step;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--sp-4);padding:0;list-style:none}.event-steps li{counter-increment:step;padding:var(--sp-5);border:1px solid var(--border-hairline);border-radius:var(--r-lg);background:var(--surface-card)}.event-steps li:before{content:'0' counter(step);display:block;margin-bottom:var(--sp-4);font:var(--text-overline);color:var(--text-accent)}.event-steps strong{display:block;margin-bottom:var(--sp-2);color:var(--text-primary)}.event-steps span{font:var(--text-body-sm);color:var(--text-secondary)}.event-directory-note{max-width:800px;margin:0 auto var(--sp-6);color:var(--text-secondary)}
.seo-footer{display:none}.seo-sitefooter{margin-top:var(--sp-12);padding:var(--sp-10) 0;border-top:1px solid var(--border-hairline);display:grid;grid-template-columns:1.35fr repeat(4,minmax(0,1fr));gap:var(--sp-8)}.seo-sitefooter__brand img{width:164px;height:auto}.seo-sitefooter__brand p{max-width:28ch;color:var(--text-muted);font:var(--text-body-sm)}.seo-sitefooter strong{display:block;margin-bottom:var(--sp-5);font:var(--text-overline);letter-spacing:var(--ls-caps);text-transform:uppercase;color:var(--text-muted)}.seo-sitefooter ul{list-style:none;padding:0;margin:0;display:grid;gap:var(--sp-4)}.seo-sitefooter a{border:0;color:var(--text-secondary);font:var(--text-body-sm)}
@media(max-width:900px){.seo-sitefooter{grid-template-columns:repeat(2,minmax(0,1fr))}.seo-sitefooter__brand{grid-column:1/-1}.editorial-guide{display:block}.editorial-guide__toc{position:static;overflow-x:auto;margin-bottom:var(--sp-6)}.editorial-guide__toc .guidescreen__toclist{display:flex!important;flex-wrap:nowrap}.editorial-guide__toc li{flex:0 0 auto}}@media(max-width:760px){main.seo-wrap{width:calc(100% - 28px)!important;max-width:1040px!important}.seo-nav{width:100%!important;max-width:none!important;padding-left:14px;padding-right:14px}.seo-nav__links{display:none}.seo-nav__cta{display:none}.seo-langs{min-width:0;font-size:12px!important;gap:3px!important}.seo-langs>span:last-child{white-space:nowrap}.tool-actions__sky{display:inline-flex!important}.hero,.visual-grid{width:100%;grid-template-columns:minmax(0,1fr)!important}.hero>*,.visual-card{min-width:0;max-width:100%}.seo-local-phase{grid-template-columns:116px minmax(0,1fr);padding:var(--sp-4)!important;gap:var(--sp-4)}.event-steps{grid-template-columns:1fr}.guide-decision__head,.guide-tool-link{align-items:flex-start;flex-direction:column}.guide-decision__grid,.guide-essentials__grid{grid-template-columns:1fr}.map-legend{font-size:12px}.seo-dateline{display:grid;grid-template-columns:1fr}.seo-stats,.city-directory,.point-group ul{grid-template-columns:1fr}.point-group li:nth-child(odd){border-right:0}.seo-sitefooter{grid-template-columns:1fr;gap:var(--sp-7)}.seo-sitefooter__brand{grid-column:auto}}
@media(max-width:900px){.guide-hub__grid,.guide-hub__route{grid-template-columns:1fr}}
@media(max-width:760px){.city-group ul{grid-template-columns:1fr}.city-group li:nth-child(odd){border-right:0}}
@media(max-width:900px){.guide-filter-note{align-items:flex-start;flex-direction:column}}
.seo-nav{width:100%!important;max-width:none!important;margin:0!important;padding-left:max(var(--gutter-web),calc((100vw - 1040px)/2))!important;padding-right:max(var(--gutter-web),calc((100vw - 1040px)/2))!important}
.guide-sources{max-width:none;margin:var(--sp-10) 0}
@media(min-width:901px){.editorial-guide__toc{min-width:0;overflow:hidden}.editorial-guide__toc .guidescreen__toclist{display:grid!important;grid-template-columns:minmax(0,1fr);gap:var(--sp-2);width:100%;padding:0}.editorial-guide__toc li{min-width:0}.editorial-guide__toc a{display:flex;justify-content:flex-start;width:100%;max-width:100%;white-space:normal;overflow-wrap:anywhere}}
</style>`;

const SEGMENTS: Record<Locale, Record<Kind, string>> = {
  ca: { eclipse: 'eclipsi', city: 'ciutat', point: 'punt-oficial', guide: 'guia', guides:'guia' },
  es: { eclipse: 'eclipse', city: 'ciudad', point: 'punto-oficial', guide: 'guia', guides:'guia' },
  en: { eclipse: 'eclipse', city: 'city', point: 'official-site', guide: 'guide', guides:'guide' },
  fr: { eclipse: 'eclipse', city: 'ville', point: 'site-officiel', guide: 'guide', guides:'guide' },
};
const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]!));
const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
const shorten = (value: string, maximum: number) => value.length <= maximum ? value : `${value.slice(0, maximum - 1).trimEnd()}…`;
const eclipseKind = (locale:Locale,eclipse:EclipseEntry) => eclipse.kind==='annular'
  ? (locale==='ca'?'anular':locale==='es'?'anular':locale==='fr'?'annulaire':'annular')
  : (locale==='ca'?'total':locale==='es'?'total':locale==='fr'?'totale':'total');
const eclipseMetaTitle = (locale:Locale,eclipse:EclipseEntry) => {
  const year=eclipse.id.slice(0,4);
  return locale==='ca'?`Eclipsi solar ${year}: hora, mapa i on veure’l | eclipsi.info`:locale==='es'?`Eclipse solar ${year}: hora, mapa y dónde verlo | eclipsi.info`:locale==='fr'?`Éclipse solaire ${year} : horaires, carte et où la voir | eclipsi.info`:`${year} solar eclipse: times, map and where to watch | eclipsi.info`;
};
const eclipseMetaDescription = (locale:Locale,eclipse:EclipseEntry) => {
  const year=eclipse.id.slice(0,4),kind=eclipseKind(locale,eclipse);
  return locale==='ca'?`Guia de l’eclipsi ${kind} de ${year}: franja, ciutats, punts oficials, seguretat, climatologia i càlcul exacte per al teu lloc.`:locale==='es'?`Guía del eclipse ${kind} de ${year}: franja, ciudades, puntos oficiales, seguridad, climatología y cálculo exacto para tu ubicación.`:locale==='fr'?`Guide de l’éclipse ${kind} de ${year} : bande, villes, sites officiels, sécurité, climatologie et calcul pour votre position.`:`Guide to the ${year} ${kind} eclipse: path, cities, official sites, safety, climatology and calculations for your exact location.`;
};
const routeSlug = (locale: Locale, route: Route): string => route.kind === 'guide'
  ? getEditorialGuide(route.id as EditorialGuideId, locale).slug
  : route.kind === 'guides' ? '' : route.kind === 'eclipse' ? eclipseDateSlug(route.id) : route.id;
const segment = (locale: Locale, route: Route) => {
  if(route.kind==='guides') return `${SEGMENTS[locale].guides}/`;
  const suffix = route.eclipseId && route.kind !== 'eclipse' ? `/${eclipseDateSlug(route.eclipseId)}` : '';
  return `${SEGMENTS[locale][route.kind]}/${routeSlug(locale, route)}${suffix}/`;
};
const pathFor = (locale: Locale, route: Route) => `${prefix(locale)}${segment(locale, route)}`;
const urlFor = (locale: Locale, route: Route) => `${SEO_SITE}${pathFor(locale, route)}`;
const appUrl = (locale: Locale, lat: number, lon: number, eclipseId: string, label: string) =>
  `${SEO_SITE}${prefix(locale)}?p=${lat.toFixed(5)},${lon.toFixed(5)}&amp;e=${eclipseId}&amp;n=${encodeURIComponent(label)}`;
const fmtTime = (locale: Locale, date: Date) => new Intl.DateTimeFormat(locale, { timeZone:'Europe/Madrid', hour:'2-digit', minute:'2-digit', second:'2-digit' }).format(date);
const fmtLongDate = (locale:Locale,eclipseId:string) => new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Madrid'}).format(new Date(`${eclipseId}T12:00:00Z`));
const localPageHeading = (locale:Locale,eclipse:EclipseEntry,name:string) => locale==='ca'
  ? `Eclipsi ${eclipseKind(locale,eclipse)} del ${fmtLongDate(locale,eclipse.id)} a ${name}`
  : locale==='es' ? `Eclipse ${eclipseKind(locale,eclipse)} del ${fmtLongDate(locale,eclipse.id)} en ${name}`
  : locale==='fr' ? `Éclipse ${eclipseKind(locale,eclipse)} du ${fmtLongDate(locale,eclipse.id)} à ${name}`
  : `${fmtLongDate(locale,eclipse.id)} ${eclipseKind(locale,eclipse)} eclipse in ${name}`;
const fmtNum = (locale: Locale, value: number, digits=1) => new Intl.NumberFormat(locale, { maximumFractionDigits:digits, minimumFractionDigits:digits }).format(value);
const distance2 = (aLat:number,aLon:number,bLat:number,bLon:number) => (aLat-bLat)**2 + ((aLon-bLon)*Math.cos(aLat*Math.PI/180))**2;
const distanceKm = (aLat:number,aLon:number,bLat:number,bLon:number) => {
  const radius=6371, dLat=(bLat-aLat)*Math.PI/180, dLon=(bLon-aLon)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(aLat*Math.PI/180)*Math.cos(bLat*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2*radius*Math.asin(Math.sqrt(a));
};
const PATH_CACHE = new Map<string,ReturnType<typeof computeEclipsePath>>();
const eclipsePath = (eclipseId:string) => {
  const cached=PATH_CACHE.get(eclipseId);
  if(cached) return cached;
  const computed=computeEclipsePath(eclipseId);
  PATH_CACHE.set(eclipseId,computed);
  return computed;
};
function eclipseOverviewMap(locale:Locale,eclipseId:string):string {
  const label=locale==='ca'?'Mapa interactiu de la franja':locale==='es'?'Mapa interactivo de la franja':locale==='fr'?'Carte interactive de la bande':'Interactive eclipse-path map';
  return `<section class="overview-map"><h2>${esc(label)}</h2><div data-eclipse-overview-widget data-eclipse="${eclipseId}" data-locale="${locale}" data-label="${esc(label)}" data-map-url="${prefix(locale)}?e=${eclipseId}#/mapa"></div></section>`;
}
const nearbyPoints = (eclipseId:string,lat:number,lon:number,exclude?:string) => [...pointsForEclipse(eclipseId)].filter(point=>point.id!==exclude).sort((a,b)=>distance2(lat,lon,a.lat,a.lon)-distance2(lat,lon,b.lat,b.lon)).slice(0,3);

function nearbyPointCards(locale:Locale,eclipse:EclipseEntry,lat:number,lon:number,exclude?:string):string {
  const durationLabel=locale==='ca'?'fase central':locale==='es'?'fase central':locale==='fr'?'phase centrale':'central phase';
  const partialLabel=locale==='ca'?'parcial':locale==='es'?'parcial':locale==='fr'?'partielle':'partial';
  const altitudeLabel=locale==='ca'?'Sol':locale==='es'?'Sol':locale==='fr'?'Soleil':'Sun';
  return nearbyPoints(eclipse.id,lat,lon,exclude).map(point=>{
    const local=computeLocalCircumstances(eclipse.id,{lat:point.lat,lon:point.lon,elevation:point.elevationM??0});
    const phase=local.centralDurationSec>0?`${fmtNum(locale,local.centralDurationSec)} s ${durationLabel}`:`${fmtNum(locale,local.contacts.max.obscuration*100)} % ${partialLabel}`;
    return `<li><a href="${urlFor(locale,{kind:'point',id:point.id,eclipseId:eclipse.id})}">${esc(point.name[locale])}</a><strong>${fmtNum(locale,distanceKm(lat,lon,point.lat,point.lon))} km</strong><span>${phase} · ${altitudeLabel} ${fmtNum(locale,local.contacts.max.sun.altitudeApparent)}° · ${esc(point.source.who)}</span></li>`;
  }).join('');
}

function toolActions(locale:Locale,lat:number,lon:number,eclipseId:string,name:string):string {
  const base=appUrl(locale,lat,lon,eclipseId,name);
  const calculate=seoStrings(locale).calculate;
  const map=locale==='ca'?'Obre el mapa':locale==='es'?'Abre el mapa':locale==='fr'?'Ouvrir la carte':'Open the map';
  const sky=locale==='ca'?'Mira el cel':locale==='es'?'Mira el cielo':locale==='fr'?'Voir le ciel':'View the sky';
  return `<div class="tool-actions"><a class="cta" href="${base}#/compte">${esc(calculate)}</a><a href="${base}#/mapa">${esc(map)}</a><a class="tool-actions__sky" href="${base}#/cel">${esc(sky)}</a></div>`;
}

function alternateLinks(route: Route): string {
  return `${SEO_LOCALES.map(locale => `<link rel="alternate" hreflang="${locale}" href="${urlFor(locale,route)}">`).join('')}<link rel="alternate" hreflang="x-default" href="${urlFor('ca',route)}">`;
}

function seoSiteFooter(locale:Locale):string {
  const labels={
    ca:{producte:'Producte',mapa:'Mapa de la franja',compte:'Compte enrere',guies:'Guies',eclipsis:'Eclipsis',projecte:'Projecte',metode:'Metodologia i fonts',codi:'Codi a GitHub',about:'Com funciona',note:'Calculat al dispositiu. Sense comptes ni anuncis.'},
    es:{producte:'Producto',mapa:'Mapa de la franja',compte:'Cuenta atrás',guies:'Guías',eclipsis:'Eclipses',projecte:'Proyecto',metode:'Metodología y fuentes',codi:'Código en GitHub',about:'Cómo funciona',note:'Calculado en el dispositivo. Sin cuentas ni anuncios.'},
    en:{producte:'Product',mapa:'Eclipse path map',compte:'Countdown',guies:'Guides',eclipsis:'Eclipses',projecte:'Project',metode:'Methods and sources',codi:'Code on GitHub',about:'How it works',note:'Calculated on your device. No accounts or ads.'},
    fr:{producte:'Produit',mapa:'Carte de la bande',compte:'Compte à rebours',guies:'Guides',eclipsis:'Éclipses',projecte:'Projet',metode:'Méthode et sources',codi:'Code sur GitHub',about:'Fonctionnement',note:'Calculé sur votre appareil. Sans compte ni publicité.'},
  }[locale];
  const eclipseLinks=ECLIPSES.map(eclipse=>`<li><a href="${urlFor(locale,{kind:'eclipse',id:eclipse.id})}">${esc(eclipse.label[locale])}</a></li>`).join('');
  const guideLinks=EDITORIAL_GUIDE_IDS.map(id=>{const guide=getEditorialGuide(id,locale);return `<li><a href="${urlFor(locale,{kind:'guide',id})}">${esc(guide.title)}</a></li>`;}).join('');
  return `<footer class="seo-sitefooter"><div class="seo-sitefooter__brand"><img src="/brand/logo.svg" width="164" height="35" alt="eclipsi.info"><p>${esc(labels.note)}</p></div><nav aria-label="${esc(labels.producte)}"><strong>${esc(labels.producte)}</strong><ul><li><a href="${SEO_SITE}${prefix(locale)}#/mapa">${esc(labels.mapa)}</a></li><li><a href="${SEO_SITE}${prefix(locale)}#/compte">${esc(labels.compte)}</a></li><li><a href="${SEO_SITE}${prefix(locale)}#/guia">${esc(labels.guies)}</a></li></ul></nav><nav aria-label="${esc(labels.eclipsis)}"><strong>${esc(labels.eclipsis)}</strong><ul>${eclipseLinks}</ul></nav><nav aria-label="${esc(labels.guies)}"><strong><a href="${urlFor(locale,{kind:'guides',id:'index'})}">${esc(labels.guies)}</a></strong><ul>${guideLinks}</ul></nav><nav aria-label="${esc(labels.projecte)}"><strong>${esc(labels.projecte)}</strong><ul><li><a href="${SEO_SITE}${prefix(locale)}#/com-funciona">${esc(labels.about)}</a></li><li><a href="${SEO_SITE}${prefix(locale)}#/com-funciona">${esc(labels.metode)}</a></li><li><a href="https://github.com/humbertblanco/eclipsi-info" rel="external">${esc(labels.codi)}</a></li></ul></nav></footer>`;
}

function shell(locale: Locale, route: Route, title: string, description: string, h1: string, body: string, schemas: unknown[]): string {
  const canonical = urlFor(locale, route), s = seoStrings(locale);
  const languageLinks = SEO_LOCALES.map(language => `<a href="/${pathFor(language,route)}"${language===locale?' aria-current="page"':''}>${language.toUpperCase()}</a>`).join(' · ');
  const mapLabel=locale==='ca'?'Mapa':locale==='es'?'Mapa':locale==='fr'?'Carte':'Map';
  const guideLabel=locale==='ca'?'Guia':locale==='es'?'Guía':locale==='fr'?'Guide':'Guide';
  const openLabel=locale==='ca'?'Obre l’app':locale==='es'?'Abre la app':locale==='fr'?'Ouvrir l’app':'Open the app';
  const eclipseId=route.kind==='eclipse'?route.id:route.eclipseId;
  const languages = `<span class="seo-nav__links"><a href="/${prefix(locale)}#/mapa">${mapLabel}</a><a href="/${pathFor(locale,{kind:'guides',id:'index'})}">${guideLabel}</a><a href="https://github.com/humbertblanco/eclipsi-info" rel="external">GitHub</a><a class="seo-nav__cta" href="/${prefix(locale)}">${openLabel}</a></span><span data-seo-header-tools data-locale="${locale}" data-eclipse="${eclipseId??'2026-08-12'}"></span><span>${languageLinks}</span>`;
  if(eclipseId){
    const eclipse=ECLIPSES.find(entry=>entry.id===eclipseId);
    if(eclipse) body=`<div class="seo-dateline"><span>${esc(eclipse.label[locale])}</span><span>${esc(eclipseDateSlug(eclipse.id).replaceAll('-', ' · '))}</span><span>${locale==='ca'?'Càlcul topocèntric local':locale==='es'?'Cálculo topocéntrico local':locale==='fr'?'Calcul topocentrique local':'Local topocentric calculation'}</span></div>${body}`;
  }
  body+=seoSiteFooter(locale);
  body=body.replaceAll(`href="${SEO_SITE}`, 'href="/');
  const officialEyebrow=route.kind==='point'?(locale==='ca'?'Punt oficial d’observació':locale==='es'?'Punto oficial de observación':locale==='fr'?'Site officiel d’observation':'Official viewing site'):'';
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#05060b"><meta name="color-scheme" content="dark"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"><link rel="canonical" href="${canonical}">${alternateLinks(route)}<meta property="og:type" content="article"><meta property="og:site_name" content="eclipsi.info"><meta property="og:locale" content="${locale}"><meta property="og:url" content="${canonical}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${SEO_SITE}brand/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(h1)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${SEO_SITE}brand/og.png"><meta name="twitter:image:alt" content="${esc(h1)}"><link rel="icon" href="${SEO_SITE}favicon.ico">${appStylesheets}${schemas.map(schema=>`<script type="application/ld+json">${json(schema)}</script>`).join('')}<script>if(new URLSearchParams(location.search).has('p'))location.replace('${SEO_SITE}${prefix(locale)}'+location.search+location.hash)</script><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:var(--bg-page,#05060b);color:var(--text-body,#c9d1e2)}.seo-wrap{width:min(1040px,calc(100% - 40px));margin:auto}.seo-nav{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:24px;border-bottom:1px solid var(--border-hairline,#283044)}.seo-brand{border:0;display:block}.seo-brand img{display:block;width:164px;height:auto}.seo-langs{display:flex;gap:8px;align-items:center;font:var(--text-label,600 14px system-ui)}.seo-langs a{padding:8px 10px;border:0;border-radius:999px;color:var(--text-secondary,#9aa5bc)}.seo-langs a[aria-current]{background:var(--surface-card,#121623);color:var(--text-primary,#fff)}.hero{display:grid;grid-template-columns:minmax(0,1fr) 270px;align-items:center;gap:48px;padding:64px 0 44px}.hero h1{font:var(--text-display,700 clamp(2.4rem,7vw,4.6rem)/.98 system-ui);letter-spacing:var(--ls-display,-.04em);margin:0 0 20px;color:var(--text-primary,#fff)}.lede{font:var(--text-body-lg,400 18px/1.6 system-ui);color:var(--text-secondary,#aeb8cc);margin:0}.hero-eclipse{width:220px;aspect-ratio:1;margin:auto;border-radius:50%;position:relative;background:radial-gradient(circle,#05060b 0 55%,#121623 56% 61%,transparent 62%),radial-gradient(circle,rgba(255,165,31,.44),rgba(255,165,31,.08) 51%,transparent 69%);filter:drop-shadow(0 0 22px rgba(255,165,31,.2))}.hero-eclipse:after{content:'';position:absolute;inset:11%;border:1px solid var(--border-strong,#4a5670);border-radius:50%}.visual-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:16px;margin:0 0 22px}.visual-card,.fact,section{background:var(--surface-card,#121623);border:1px solid var(--border-hairline,#283044);border-radius:var(--r-lg,18px)}.visual-card{overflow:hidden;min-height:250px;position:relative}.visual-card__head{padding:18px 20px 14px;font:var(--text-overline,600 12px/1.3 monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted,#8994aa)}.locator{aspect-ratio:725/410;background:url('/brand/minimapa-iberia.png') center/cover;position:relative;border-top:1px solid var(--border-hairline,#283044)}.locator__point{position:absolute;width:18px;height:18px;border-radius:50%;background:var(--accent,#ffa51f);border:4px solid var(--ink-950,#05060b);box-shadow:0 0 0 2px var(--accent,#ffa51f),0 0 24px var(--accent,#ffa51f);transform:translate(-50%,-50%)}.eclipse-diagram{height:180px;display:grid;place-items:center}.eclipse-diagram svg{width:160px;height:160px;overflow:visible}.sun-disc{fill:var(--accent,#ffa51f);filter:drop-shadow(0 0 16px rgba(255,165,31,.55))}.moon-disc{fill:var(--ink-950,#05060b);stroke:var(--border-strong,#536079)}.altitude{padding:0 22px 22px}.altitude svg{width:100%;height:112px;overflow:visible}.altitude__horizon{stroke:var(--border-strong,#536079);stroke-width:2}.altitude__path{stroke:var(--mint-400,#55d6b3);stroke-width:3;fill:none;stroke-linecap:round}.altitude__sun{fill:var(--accent,#ffa51f);filter:drop-shadow(0 0 8px rgba(255,165,31,.5))}.altitude text{fill:var(--text-muted,#8994aa);font:12px var(--font-mono,monospace)}.timeline{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;position:relative;padding:16px 4px 2px;margin:22px 0 30px}.timeline:before{content:'';position:absolute;left:7%;right:7%;top:22px;height:2px;background:var(--border-strong,#536079)}.timeline__point{position:relative;z-index:1;display:grid;justify-items:center;gap:8px;min-width:70px;font:var(--text-data-sm,500 13px monospace);color:var(--text-primary,#fff)}.timeline__point i{width:14px;height:14px;background:var(--mint-400,#55d6b3);border:3px solid var(--bg-page,#05060b);border-radius:50%;box-shadow:0 0 0 1px var(--mint-400,#55d6b3)}.timeline__point--max i{background:var(--accent,#ffa51f);box-shadow:0 0 0 1px var(--accent,#ffa51f)}.timeline__point small{color:var(--text-muted,#8994aa)}.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:22px 0}.fact{padding:18px}.fact small{display:block;color:var(--text-muted,#8994aa);font:var(--text-overline,600 11px monospace);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}.fact strong{font:var(--text-data,500 21px monospace);font-variant-numeric:tabular-nums;color:var(--text-primary,#fff)}main>p,main>section,main>h2,main>.links,main>.cta{max-width:800px;margin-left:auto;margin-right:auto}main>p,p,li{line-height:1.65}main>h2,h2{margin-top:48px;color:var(--text-primary,#fff)}section{padding:22px;margin-top:28px;margin-bottom:28px}section h2{margin-top:0}.cta{display:block;width:max-content;margin-top:28px;margin-bottom:38px;padding:15px 22px;border:0;border-radius:999px;background:var(--accent,#ffa51f);color:var(--on-accent,#05060b);font:var(--text-label,700 15px system-ui);text-decoration:none}.links{padding:0;list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.links li{background:var(--surface-card,#121623);border:1px solid var(--border-hairline,#283044);border-radius:var(--r-md,14px);padding:14px 16px}.links a{border:0}.faq{padding:18px 0;border-top:1px solid var(--border-hairline,#283044)}.faq h3{margin:0 0 8px}.seo-footer{padding:42px 0;margin-top:60px;border-top:1px solid var(--border-hairline,#283044);color:var(--text-muted,#8994aa)}@media(max-width:760px){.seo-wrap{width:min(100% - 28px,1040px)}.seo-nav{min-height:66px}.seo-brand img{width:142px}.seo-langs{gap:2px}.seo-langs a{padding:7px}.hero{grid-template-columns:1fr;padding:38px 0 30px;gap:26px}.hero-eclipse{width:150px;grid-row:1}.visual-grid{grid-template-columns:1fr}.facts{grid-template-columns:repeat(2,minmax(0,1fr))}.links{grid-template-columns:1fr}.timeline__point{min-width:52px;font-size:11px}.timeline__point small{font-size:10px}}@media(max-width:390px){.seo-brand img{width:126px}.seo-langs a{font-size:12px;padding:6px 5px}.facts{grid-template-columns:1fr 1fr}.fact{padding:14px}.fact strong{font-size:17px}}</style></head><body data-page-kind="${route.kind}"><nav class="seo-nav seo-wrap"><a class="seo-brand" href="${SEO_SITE}${prefix(locale)}" aria-label="eclipsi.info"><img src="/brand/logo.svg" width="164" height="35" alt="eclipsi.info"></a><span class="seo-langs" aria-label="Languages">${languages}</span></nav><main class="seo-wrap"><header class="hero"><div>${officialEyebrow?`<span class="hero__eyebrow">${esc(officialEyebrow)}</span>`:''}<h1>${esc(h1)}</h1><p class="lede">${esc(description)}</p></div><div class="hero-eclipse" aria-hidden="true"></div></header>${body}</main><footer class="seo-footer seo-wrap">eclipsi.info · ${esc(s.disclaimer)}</footer></body></html>`;
}

function breadcrumb(locale:Locale, route:Route, name:string) {
  const s=seoStrings(locale);
  const items:Array<Record<string,unknown>>=[{'@type':'ListItem',position:1,name:s.home,item:`${SEO_SITE}${prefix(locale)}`}];
  if(route.kind==='guide') items.push({'@type':'ListItem',position:2,name:s.guides,item:urlFor(locale,{kind:'guides',id:'index'})});
  items.push({'@type':'ListItem',position:items.length+1,name,item:urlFor(locale,route)});
  return {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items};
}

function guideLinks(locale: Locale, eclipseId?: string): string {
  return EDITORIAL_GUIDE_IDS.filter(id => !eclipseId || getEditorialGuide(id, locale).relatedEclipseIds.includes(eclipseId)).map(id => {
    const guide = getEditorialGuide(id, locale);
    return `<li><a href="${urlFor(locale,{kind:'guide',id})}">${esc(guide.title)}</a></li>`;
  }).join('');
}

const REGION_LABELS:Record<string,Record<Locale,string>>={
  ast:{ca:'Astúries',es:'Asturias',en:'Asturias',fr:'Asturies'},
  cyl:{ca:'Castella i Lleó',es:'Castilla y León',en:'Castile and León',fr:'Castille-et-León'},
  cat:{ca:'Catalunya',es:'Cataluña',en:'Catalonia',fr:'Catalogne'},
  nav:{ca:'Navarra',es:'Navarra',en:'Navarre',fr:'Navarre'},
  ara:{ca:'Aragó',es:'Aragón',en:'Aragon',fr:'Aragon'},
  val:{ca:'País Valencià',es:'Comunitat Valenciana',en:'Valencian Community',fr:'Communauté valencienne'},
  bal:{ca:'Illes Balears',es:'Islas Baleares',en:'Balearic Islands',fr:'Îles Baléares'},
  mad:{ca:'Comunitat de Madrid',es:'Comunidad de Madrid',en:'Community of Madrid',fr:'Communauté de Madrid'},
};

function eclipseCityDirectory(locale:Locale,eclipse:EclipseEntry):string {
  const groups=new Map<'central'|'edge'|'partial',Array<{city:SeoCity;local:ReturnType<typeof computeLocalCircumstances>}>>();
  for(const city of SEO_CITIES){
    const local=computeLocalCircumstances(eclipse.id,{lat:city.lat,lon:city.lon,elevation:0});
    const key=local.edgeUncertain?'edge':local.centralDurationSec>0?'central':'partial';
    groups.set(key,[...(groups.get(key)??[]),{city,local}]);
  }
  const labels={central:locale==='ca'?'Dins la franja central':locale==='es'?'Dentro de la franja central':locale==='fr'?'Dans la bande centrale':'Inside the central path',edge:locale==='ca'?'Al caire de la franja':locale==='es'?'En el límite de la franja':locale==='fr'?'Sur la limite de la bande':'At the path edge',partial:locale==='ca'?'Fase parcial':locale==='es'?'Fase parcial':locale==='fr'?'Phase partielle':'Partial phase'};
  const cityWord=locale==='ca'?'ciutats':locale==='es'?'ciudades':locale==='fr'?'villes':'cities';
  return (['central','edge','partial'] as const).flatMap(key=>{const entries=groups.get(key);if(!entries?.length)return[];return [`<details class="city-group"${key==='central'?' open':''}><summary><span class="directory-outcome directory-outcome--${key}">${esc(labels[key])}</span><strong>${entries.length} ${cityWord}</strong></summary><ul>${entries.map(({city,local})=>{const outcome=key==='edge'?edgeText(locale):key==='central'?`${fmtNum(locale,local.centralDurationSec)} s`:`${fmtNum(locale,local.contacts.max.obscuration*100)} %`;return `<li><a href="${urlFor(locale,{kind:'city',id:city.id,eclipseId:eclipse.id})}"><strong>${esc(city.name[locale])}</strong><span>${outcome} · ${fmtTime(locale,local.contacts.max.time)} · ${fmtNum(locale,local.contacts.max.sun.altitudeApparent)}°</span><span>${esc(city.region[locale])}</span></a></li>`;}).join('')}</ul></details>`];}).join('');
}

function officialPointDirectory(locale:Locale,eclipse:EclipseEntry):string {
  const groups=new Map<string,ObservationPoint[]>();
  for(const point of pointsForEclipse(eclipse.id)){
    const key=point.id.split('-')[0];
    groups.set(key,[...(groups.get(key)??[]),point]);
  }
  const sites=locale==='ca'?'punts':locale==='es'?'puntos':locale==='fr'?'sites':'sites';
  return [...groups].map(([key,points],index)=>`<details class="point-group"${index===0?' open':''}><summary><span>${esc(REGION_LABELS[key]?.[locale]??key.toUpperCase())}</span><strong>${points.length} ${sites}</strong></summary><ul>${points.map(point=>{const local=computeLocalCircumstances(eclipse.id,{lat:point.lat,lon:point.lon,elevation:point.elevationM??0});const phase=local.centralDurationSec>0?`${fmtNum(locale,local.centralDurationSec)} s`:`${fmtNum(locale,local.contacts.max.obscuration*100)} %`;return `<li><a href="${urlFor(locale,{kind:'point',id:point.id,eclipseId:eclipse.id})}">${esc(point.name[locale])}</a><span>${phase} · ${fmtNum(locale,local.contacts.max.sun.altitudeApparent)}° · ${esc(point.source.who)}</span></li>`;}).join('')}</ul></details>`).join('');
}

function eclipseSummary(locale:Locale,eclipse:EclipseEntry):string {
  const badge=renderToStaticMarkup(createElement(Badge,{tone:eclipse.kind==='annular'?'partial':'clear',dot:true} as BadgeProps,eclipseKind(locale,eclipse)));
  const stats=[
    createElement(Stat,{key:'date',label:locale==='ca'?'Data':locale==='es'?'Fecha':locale==='fr'?'Date':'Date',value:eclipseDateSlug(eclipse.id)}),
    createElement(Stat,{key:'max',label:locale==='ca'?'Màxim global':locale==='es'?'Máximo global':locale==='fr'?'Maximum global':'Global maximum',value:fmtTime(locale,new Date(eclipse.greatestEclipseUtc))}),
    createElement(Stat,{key:'cities',label:locale==='ca'?'Ciutats calculades':locale==='es'?'Ciudades calculadas':locale==='fr'?'Villes calculées':'Calculated cities',value:String(SEO_CITIES.length)}),
    createElement(Stat,{key:'points',label:locale==='ca'?'Punts oficials':locale==='es'?'Puntos oficiales':locale==='fr'?'Sites officiels':'Official sites',value:String(pointsForEclipse(eclipse.id).length)}),
  ];
  return `<div class="eclipse-summary">${badge}${renderToStaticMarkup(createElement(Card,{className:'seo-stats'} as CardProps,stats))}</div>`;
}

function eclipseJourney(locale:Locale):string {
  const copy={
    ca:{title:'Com planificar aquest eclipsi',lead:'La franja només és el primer filtre. El punt exacte, l’altura del Sol, el relleu i el temps decideixen quant en veuràs de debò.',steps:[['Comprova el teu punt','Calcula fase, contactes i altura del Sol per a unes coordenades concretes.'],['Compara alternatives','Prioritza punts oficials i contrasta durada, distància a la central i horitzó.'],['Torna-hi amb la previsió','La climatologia ajuda a triar zona; la previsió actualitzada decidirà el desplaçament final.']]},
    es:{title:'Cómo planificar este eclipse',lead:'La franja es solo el primer filtro. El punto exacto, la altura del Sol, el relieve y el tiempo deciden cuánto verás realmente.',steps:[['Comprueba tu punto','Calcula fase, contactos y altura del Sol para unas coordenadas concretas.'],['Compara alternativas','Prioriza puntos oficiales y contrasta duración, distancia a la central y horizonte.'],['Vuelve con la previsión','La climatología ayuda a elegir zona; la previsión actualizada decidirá el desplazamiento final.']]},
    en:{title:'How to plan for this eclipse',lead:'The path is only the first filter. Your exact site, Sun altitude, terrain and weather decide how much you will actually see.',steps:[['Check your location','Calculate phase, contacts and Sun altitude for exact coordinates.'],['Compare alternatives','Start with official sites and compare duration, centre-line distance and horizon.'],['Return for the forecast','Climatology helps choose a region; the updated forecast should guide the final move.']]},
    fr:{title:'Comment préparer cette éclipse',lead:'La bande n’est que le premier filtre. Le lieu exact, la hauteur du Soleil, le relief et la météo déterminent ce que vous verrez réellement.',steps:[['Vérifiez votre lieu','Calculez phase, contacts et hauteur du Soleil pour des coordonnées précises.'],['Comparez les alternatives','Privilégiez les sites officiels et comparez durée, distance à la ligne centrale et horizon.'],['Revenez pour la prévision','La climatologie aide à choisir une région ; la prévision actualisée guidera le déplacement final.']]},
  }[locale];
  return `<section class="event-intro"><h2>${esc(copy.title)}</h2><p class="event-intro__lead">${esc(copy.lead)}</p><ol class="event-steps">${copy.steps.map(([title,text])=>`<li><strong>${esc(title)}</strong><span>${esc(text)}</span></li>`).join('')}</ol></section>`;
}

function eclipsePage(locale: Locale, eclipse: EclipseEntry): Page {
  const s=seoStrings(locale), route:Route={kind:'eclipse',id:eclipse.id};
  const title=eclipseMetaTitle(locale,eclipse);
  const description=eclipseMetaDescription(locale,eclipse);
  const cityLinks=eclipseCityDirectory(locale,eclipse);
  const pointLinks=officialPointDirectory(locale,eclipse);
  const directoryNote=locale==='ca'?'Compara primer les ciutats per entendre el recorregut; després obre el teu punt exacte, perquè uns quilòmetres i el relleu poden canviar el resultat.':locale==='es'?'Compara primero las ciudades para entender el recorrido; después abre tu punto exacto, porque unos kilómetros y el relieve pueden cambiar el resultado.':locale==='fr'?'Comparez d’abord les villes pour comprendre le parcours, puis ouvrez votre lieu exact : quelques kilomètres et le relief peuvent changer le résultat.':'Compare cities first to understand the route, then open your exact location: a few kilometres and the terrain can change the result.';
  const body=`${eclipseOverviewMap(locale,eclipse.id)}${eclipseSummary(locale,eclipse)}<section class="event-intro"><h2>${esc(s.eclipse)}</h2><p class="event-intro__lead">${esc(eclipse.spain[locale])}</p>${eclipse.tips?`<ul>${eclipse.tips[locale].map(tip=>`<li>${esc(tip)}</li>`).join('')}</ul>`:''}<a class="cta" href="${SEO_SITE}${prefix(locale)}#/mapa">${esc(locale==='ca'?'Calcula el teu punt al mapa':locale==='es'?'Calcula tu punto en el mapa':locale==='fr'?'Calculez votre lieu sur la carte':'Calculate your location on the map')}</a></section>${eclipseJourney(locale)}<h2>${esc(s.cities)}</h2><p class="event-directory-note">${esc(directoryNote)}</p><div class="city-directory">${cityLinks}</div>${pointLinks?`<h2>${esc(s.points)}</h2><p class="event-directory-note">${esc(locale==='ca'?'Punts publicats per administracions i organitzadors, agrupats per territori. Comprova sempre accés, aforament i avisos oficials abans de sortir.':locale==='es'?'Puntos publicados por administraciones y organizadores, agrupados por territorio. Comprueba siempre acceso, aforo y avisos oficiales antes de salir.':locale==='fr'?'Sites publiés par les administrations et organisateurs, regroupés par territoire. Vérifiez toujours accès, capacité et avis officiels avant le départ.':'Sites published by public bodies and organisers, grouped by region. Always check access, capacity and official notices before travelling.')}</p><div class="point-directory">${pointLinks}</div>`:''}<h2>${esc(s.guides)}</h2><ul class="links">${guideLinks(locale,eclipse.id)}</ul>`;
  const window=SEO_EVENT_WINDOWS[eclipse.id];
  const event={ '@context':'https://schema.org','@type':'Event','@id':`${urlFor(locale,route)}#event`,name:eclipse.label[locale],startDate:window.start,endDate:window.end,eventStatus:'https://schema.org/EventScheduled',eventAttendanceMode:'https://schema.org/OfflineEventAttendanceMode',description:eclipse.spain[locale],url:urlFor(locale,route),image:`${SEO_SITE}brand/og.png`,location:{'@type':'Place',name:window.area[locale]} };
  return {route,html:shell(locale,route,title,description,eclipse.label[locale],body,[event,breadcrumb(locale,route,eclipse.label[locale])])};
}

function edgeText(locale:Locale):string {
  return locale==='ca'?'Al caire: el model no pot confirmar la fase central':locale==='es'?'En el límite: el modelo no puede confirmar la fase central':locale==='fr'?'Sur la limite : le modèle ne peut pas confirmer la phase centrale':'On the edge: the model cannot confirm the central phase';
}
function safetyText(locale:Locale,kind:string,edge:boolean):string {
  if(edge || kind==='partial' || kind==='annular') return locale==='ca'?'Protecció ocular: filtre solar homologat durant tot l’eclipsi. En una fase parcial o anular no hi ha cap instant segur sense filtre.':locale==='es'?'Protección ocular: filtro solar homologado durante todo el eclipse. En una fase parcial o anular no hay ningún instante seguro sin filtro.':locale==='fr'?'Protection oculaire : filtre solaire homologué pendant toute l’éclipse. Une phase partielle ou annulaire ne comporte aucun instant sûr sans filtre.':'Eye safety: use a certified solar filter throughout. A partial or annular eclipse has no safe filter-free interval.';
  return locale==='ca'?'Protecció ocular: mantén el filtre fins que la totalitat estigui confirmada al teu punt; només es pot retirar entre C2 i C3, i s’ha de reposar abans que reaparegui el Sol.':locale==='es'?'Protección ocular: mantén el filtro hasta confirmar la totalidad en tu punto; solo se puede retirar entre C2 y C3 y debe volver a colocarse antes de que reaparezca el Sol.':locale==='fr'?'Protection oculaire : gardez le filtre jusqu’à confirmation de la totalité à votre position ; retirez-le seulement entre C2 et C3 et remettez-le avant le retour du Soleil.':'Eye safety: keep the filter on until totality is confirmed at your location; remove it only between C2 and C3 and replace it before sunlight returns.';
}
function localContext(locale:Locale,c:{edgeUncertain:boolean;sunBelowHorizonDuringEvent:boolean;contacts:{max:{sun:{altitudeApparent:number;azimuth:number}}}}):string {
  const altitude=fmtNum(locale,c.contacts.max.sun.altitudeApparent),azimuth=fmtNum(locale,c.contacts.max.sun.azimuth,0);
  if(c.edgeUncertain) return locale==='ca'?`Aquest punt cau dins la zona d’incertesa del caire. No planifiquis la totalitat aquí: mou-te cap a l’interior de la franja i comprova el nou punt.`:locale==='es'?`Este punto cae en la zona de incertidumbre del borde. No planifiques aquí la totalidad: desplázate hacia el interior de la franja y comprueba el nuevo punto.`:locale==='fr'?`Ce point se trouve dans la zone d’incertitude de la limite. N’y planifiez pas la totalité : déplacez-vous vers l’intérieur de la bande et vérifiez le nouveau point.`:`This point lies in the uncertainty zone at the path edge. Do not plan on totality here: move farther inside the path and check the new point.`;
  if(c.sunBelowHorizonDuringEvent || c.contacts.max.sun.altitudeApparent<5) return locale==='ca'?`El Sol serà molt baix (${altitude}°, azimut ${azimuth}°): una carena, edifici, calitja o núvol baix pot decidir el resultat. Comprova el perfil del relleu al simulador.`:locale==='es'?`El Sol estará muy bajo (${altitude}°, acimut ${azimuth}°): una loma, edificio, calima o nube baja puede decidir el resultado. Comprueba el perfil del relieve en el simulador.`:locale==='fr'?`Le Soleil sera très bas (${altitude}°, azimut ${azimuth}°) : crête, bâtiment, brume ou nuage bas peuvent décider du résultat. Vérifiez le profil du relief dans le simulateur.`:`The Sun will be very low (${altitude}°, azimuth ${azimuth}°): a ridge, building, haze or low cloud may decide the outcome. Check the terrain profile in the simulator.`;
  return locale==='ca'?`Al màxim, el Sol serà a ${altitude}° d’altura i azimut ${azimuth}°. El relleu pesa menys que en un eclipsi arran d’horitzó, però els obstacles pròxims encara s’han de comprovar.`:locale==='es'?`En el máximo, el Sol estará a ${altitude}° de altura y acimut ${azimuth}°. El relieve pesa menos que en un eclipse a ras del horizonte, pero aún hay que comprobar los obstáculos cercanos.`:locale==='fr'?`Au maximum, le Soleil sera à ${altitude}° de hauteur et ${azimuth}° d’azimut. Le relief compte moins qu’à l’horizon, mais les obstacles proches restent à vérifier.`:`At maximum the Sun will be ${altitude}° high at azimuth ${azimuth}°. Terrain matters less than for a horizon eclipse, but nearby obstacles still need checking.`;
}
type LocalCircumstances = ReturnType<typeof computeLocalCircumstances>;

function visualDashboard(locale: Locale, c: LocalCircumstances): string {
  const phaseLabel=locale==='ca'?'Aspecte al màxim':locale==='es'?'Aspecto en el máximo':locale==='fr'?'Aspect au maximum':'Appearance at maximum';
  const contactsLabel=locale==='ca'?'Cronologia local':locale==='es'?'Cronología local':locale==='fr'?'Chronologie locale':'Local timeline';
  const obscuration=Math.max(0,Math.min(1,c.contacts.max.obscuration));
  const altitude=c.contacts.max.sun.altitudeApparent;
  const contactEntries=[
    c.contacts.c1&&['C1',c.contacts.c1.time],
    c.contacts.c2&&['C2',c.contacts.c2.time],
    ['MAX',c.contacts.max.time],
    c.contacts.c3&&['C3',c.contacts.c3.time],
    c.contacts.c4&&['C4',c.contacts.c4.time],
  ].filter(Boolean) as [string,Date][];
  const timeline=renderToStaticMarkup(createElement(TimelineTrack,{
    contacts:contactEntries.map(([label,time])=>({label:label==='MAX'?(locale==='ca'?'Màx':locale==='es'?'Máx':locale==='fr'?'Max':'Max'):label,time:fmtTime(locale,time)})),
    activeIndex:contactEntries.findIndex(([label])=>label==='MAX'),
    className:'seo-timeline',
  }));
  const phaseCard=renderToStaticMarkup(createElement(Card,{className:'seo-local-phase'} as CardProps,
    createElement('div',{className:'seo-local-phase__visual'},
      createElement('span',null,phaseLabel),
      createElement(PhaseDial,{obscuration,totality:c.kind==='total'&&c.centralDurationSec>0&&!c.edgeUncertain,size:160,glow:true}),
    ),
    createElement('div',{className:'seo-local-phase__stats'},
      createElement(Stat,{label:locale==='ca'?'Disc solar cobert':locale==='es'?'Disco solar cubierto':locale==='fr'?'Disque solaire couvert':'Solar disc obscured',value:`${fmtNum(locale,obscuration*100)} %`,size:'lg',tone:'accent'}),
      createElement(Stat,{label:locale==='ca'?'Sol sobre l’horitzó astronòmic':locale==='es'?'Sol sobre el horizonte astronómico':locale==='fr'?'Soleil au-dessus de l’horizon astronomique':'Sun above astronomical horizon',value:`${fmtNum(locale,altitude)}°`}),
      createElement(Stat,{label:locale==='ca'?'Direcció al màxim':locale==='es'?'Dirección en el máximo':locale==='fr'?'Direction au maximum':'Direction at maximum',value:`${fmtNum(locale,c.contacts.max.sun.azimuth,0)}°`,unit:locale==='ca'||locale==='es'?'azimut':locale==='fr'?'azimut':'azimuth'}),
    ),
  ));
  return `<div class="visual-grid visual-grid--phase" style="display:block;max-width:800px;margin-left:auto;margin-right:auto">${phaseCard}</div><div class="visual-card__head">${esc(contactsLabel)}</div><div class="timeline-widget">${timeline}</div>`;
}

function liveLocalWidgets(locale:Locale,eclipseId:string,lat:number,lon:number,elevation:number,name:string):string {
  const mapUrl=`${prefix(locale)}?p=${lat.toFixed(5)},${lon.toFixed(5)}&amp;e=${eclipseId}&amp;n=${encodeURIComponent(name)}#/mapa`;
  return `<div class="seo-live-widgets" data-eclipse-local-widget data-eclipse="${eclipseId}" data-lat="${lat}" data-lon="${lon}" data-elevation="${elevation}" data-locale="${locale}" data-label="${esc(name)}" data-map-url="${mapUrl}"></div>`;
}

function facts(locale:Locale, eclipse:EclipseEntry, lat:number, lon:number, elevation=0) {
  const s=seoStrings(locale), circumstances=computeLocalCircumstances(eclipse.id,{lat,lon,elevation});
  const centerDistance=distanceToCenterLineKm({lat,lon},eclipsePath(eclipse.id).center);
  const central=circumstances.edgeUncertain?edgeText(locale):circumstances.centralDurationSec>0?`${fmtNum(locale,circumstances.centralDurationSec)} s`:s.noCentral;
  const starts=locale==='ca'?'Comença la fase parcial (C1)':locale==='es'?'Empieza la fase parcial (C1)':locale==='fr'?'Début de la phase partielle (C1)':'Partial phase begins (C1)';
  const ends=locale==='ca'?'Acaba la fase parcial (C4)':locale==='es'?'Termina la fase parcial (C4)':locale==='fr'?'Fin de la phase partielle (C4)':'Partial phase ends (C4)';
  const stats=[
    circumstances.contacts.c1&&createElement(Stat,{key:'c1',label:starts,value:fmtTime(locale,circumstances.contacts.c1.time)}),
    createElement(Stat,{key:'max',label:s.maximum,value:fmtTime(locale,circumstances.contacts.max.time)}),
    circumstances.contacts.c4&&createElement(Stat,{key:'c4',label:ends,value:fmtTime(locale,circumstances.contacts.c4.time)}),
    createElement(Stat,{key:'duration',label:s.duration,value:central,tone:circumstances.centralDurationSec>0?'accent':'default'}),
    createElement(Stat,{key:'obscuration',label:s.obscuration,value:`${fmtNum(locale,circumstances.contacts.max.obscuration*100)} %`}),
    createElement(Stat,{key:'sun',label:s.sun,value:`${fmtNum(locale,circumstances.contacts.max.sun.altitudeApparent)}°`}),
    centerDistance!==null&&createElement(Stat,{key:'center',label:locale==='ca'?'Distància a la central':locale==='es'?'Distancia a la central':locale==='fr'?'Distance à la ligne centrale':'Distance to centre line',value:fmtNum(locale,centerDistance),unit:'km'}),
  ].filter(Boolean);
  const statsMarkup=renderToStaticMarkup(createElement(Card,{className:'seo-stats'} as CardProps,stats));
  const positionLabel=circumstances.edgeUncertain?edgeText(locale):circumstances.centralDurationSec>0
    ? (locale==='ca'?'Dins la franja central':locale==='es'?'Dentro de la franja central':locale==='fr'?'Dans la bande centrale':'Inside the central path')
    : (locale==='ca'?'Fora de la franja: fase parcial':locale==='es'?'Fuera de la franja: fase parcial':locale==='fr'?'Hors de la bande : phase partielle':'Outside the path: partial phase');
  const position=renderToStaticMarkup(createElement(Badge,{tone:circumstances.centralDurationSec>0&&!circumstances.edgeUncertain?'clear':'partial',dot:true,className:'seo-position'} as BadgeProps,positionLabel));
  return { circumstances, html:`${visualDashboard(locale,circumstances)}${position}${statsMarkup}`};
}

const nearbyHeading=(locale:Locale,name:string,alternative=false)=>locale==='ca'
  ? `${alternative?'Altres punts':'Punts'} oficials a prop de ${name}`
  : locale==='es' ? `${alternative?'Otros puntos':'Puntos'} oficiales cerca de ${name}`
  : locale==='fr' ? `${alternative?'Autres sites':'Sites'} officiels près de ${name}`
  : `${alternative?'Other official sites':'Official sites'} near ${name}`;

function cityPage(locale:Locale,eclipse:EclipseEntry,city:SeoCity): Page {
  const name=city.name[locale];
  const s=seoStrings(locale),route:Route={kind:'city',id:city.id,eclipseId:eclipse.id},data=facts(locale,eclipse,city.lat,city.lon);
  const year=eclipse.id.slice(0,4),kind=eclipseKind(locale,eclipse);
  const title=shorten(locale==='ca'?`Eclipsi ${kind} ${year} a ${name}: hora i visibilitat | eclipsi.info`:locale==='es'?`Eclipse ${kind} ${year} en ${name}: hora y visibilidad | eclipsi.info`:locale==='fr'?`Éclipse ${kind} ${year} à ${name} : horaires et visibilité | eclipsi.info`:`${year} ${kind} eclipse in ${name}: times and visibility | eclipsi.info`,72);
  const description=shorten(locale==='ca'?`Hora, fase i altura del Sol de l’eclipsi ${year} a ${name}. Simulador amb relleu, previsió del temps i punts oficials pròxims.`:locale==='es'?`Hora, fase y altura del Sol del eclipse ${year} en ${name}. Simulador con relieve, previsión del tiempo y puntos oficiales cercanos.`:locale==='fr'?`Heure, phase et hauteur du Soleil pour l’éclipse ${year} à ${name}. Simulateur du relief, météo et sites officiels proches.`:`Time, phase and Sun altitude for the ${year} eclipse in ${name}. Terrain simulator, weather forecast and nearby official sites.`,160);
  const nearby=nearbyPointCards(locale,eclipse,city.lat,city.lon);
  const nearbySection=nearby?`<h2>${esc(nearbyHeading(locale,name))}</h2><ul class="spot-list">${nearby}</ul>`:'';
  const body=`${liveLocalWidgets(locale,eclipse.id,city.lat,city.lon,0,name)}<p>${esc(s.intro)}</p><p>${esc(city.context[locale])}</p><p>${esc(localContext(locale,data.circumstances))}</p><p><strong>${esc(safetyText(locale,data.circumstances.kind,data.circumstances.edgeUncertain))}</strong></p>${toolActions(locale,city.lat,city.lon,eclipse.id,name)}${nearbySection}<h2>${esc(s.related)}</h2><ul class="links"><li><a href="${urlFor(locale,{kind:'eclipse',id:eclipse.id})}">${esc(eclipse.label[locale])}</a></li>${guideLinks(locale,eclipse.id)}</ul>`;
  const page={'@context':'https://schema.org','@type':'WebPage','@id':`${urlFor(locale,route)}#webpage`,name:title,url:urlFor(locale,route),inLanguage:locale,about:{'@type':'Place',name,addressRegion:city.region[locale],geo:{'@type':'GeoCoordinates',latitude:city.lat,longitude:city.lon}}};
  return {route,html:shell(locale,route,title,description,localPageHeading(locale,eclipse,name),body,[page,breadcrumb(locale,route,name)])};
}

function pointPage(locale:Locale,eclipse:EclipseEntry,point:ObservationPoint): Page {
  const name=point.name[locale];
  const s=seoStrings(locale),route:Route={kind:'point',id:point.id,eclipseId:eclipse.id},data=facts(locale,eclipse,point.lat,point.lon,point.elevationM??0);
  const duplicateName=pointsForEclipse(eclipse.id).filter(candidate=>candidate.name[locale]===name).length>1;
  const displayName=duplicateName?`${name} · ${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`:name;
  const year=eclipse.id.slice(0,4);
  const title=shorten(locale==='ca'?`Eclipsi ${year} a ${displayName}: punt oficial | eclipsi.info`:locale==='es'?`Eclipse ${year} en ${displayName}: punto oficial | eclipsi.info`:locale==='fr'?`Éclipse ${year} à ${displayName} : site officiel | eclipsi.info`:`${year} eclipse at ${displayName}: official site | eclipsi.info`,64);
  const phase=data.circumstances.edgeUncertain?edgeText(locale):point.phase==='central'?s.central:s.partial;
  const officialBy=locale==='ca'?`Punt oficial d’observació publicat per ${point.source.who}.`:locale==='es'?`Punto oficial de observación publicado por ${point.source.who}.`:locale==='fr'?`Site officiel d’observation publié par ${point.source.who}.`:`Official viewing site published by ${point.source.who}.`;
  const description=shorten(`${name}: ${phase}, ${s.maximum.toLowerCase()} ${fmtTime(locale,data.circumstances.contacts.max.time)}. ${officialBy}`,148);
  const precision=point.precision==='exact'?s.exact:s.estimated;
  const nearby=nearbyPointCards(locale,eclipse,point.lat,point.lon,point.id);
  const kindContext=point.kind==='event'?s.event:point.kind==='observatory'?s.observatory:s.openSite;
  const elevation=point.elevationM===undefined?'':`<p><strong>${esc(s.elevation)}:</strong> ${fmtNum(locale,point.elevationM,0)} m</p>`;
  const nearbySection=nearby?`<h2>${esc(nearbyHeading(locale,name,true))}</h2><ul class="spot-list">${nearby}</ul>`:'';
  const officialLabel=locale==='ca'?'Punt oficial d’observació':locale==='es'?'Punto oficial de observación':locale==='fr'?'Site officiel d’observation':'Official viewing site';
  const identity=`<aside class="official-identity"><span class="official-identity__eyebrow">${esc(officialLabel)}</span><strong>${esc(point.source.who)}</strong><p>${esc(kindContext)} ${esc(precision)} · <a href="${esc(point.source.url)}" rel="nofollow external">${esc(s.source)}</a></p></aside>`;
  const body=`${identity}${liveLocalWidgets(locale,eclipse.id,point.lat,point.lon,point.elevationM??0,name)}<p><strong>${esc(officialBy)}</strong></p>${point.note?`<p>${esc(point.note[locale])}</p>`:''}<p>${esc(localContext(locale,data.circumstances))}</p><p><strong>${esc(safetyText(locale,data.circumstances.kind,data.circumstances.edgeUncertain))}</strong></p><p><strong>${esc(s.coords)}:</strong> ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}</p>${elevation}${toolActions(locale,point.lat,point.lon,eclipse.id,name)}${nearbySection}<h2>${esc(s.related)}</h2><ul class="links"><li><a href="${urlFor(locale,{kind:'eclipse',id:eclipse.id})}">${esc(eclipse.label[locale])}</a></li>${guideLinks(locale,eclipse.id)}</ul>`;
  const place={'@context':'https://schema.org','@type':'Place','@id':`${urlFor(locale,route)}#place`,name,description,url:urlFor(locale,route),geo:{'@type':'GeoCoordinates',latitude:point.lat,longitude:point.lon},subjectOf:point.source.url};
  return {route,html:shell(locale,route,title,description,localPageHeading(locale,eclipse,displayName),body,[place,breadcrumb(locale,route,displayName)])};
}

function renderGuideBlock(block:GuideBlock):string {
  if(block.kind==='p') return `<p class="guide__p">${esc(block.text)}</p>`;
  if(block.kind==='list') return `<ul class="guide__list${block.tone?` guide__list--${block.tone}`:''}">${block.items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`;
  if(block.kind==='defs') return `<dl class="guide__defs">${block.items.map(item=>`<div><dt>${esc(item.term)}</dt><dd>${esc(item.text)}</dd></div>`).join('')}</dl>`;
  if(block.kind==='callout') return `<aside class="guide__callout guide__callout--${block.tone}"><strong>${esc(block.title)}</strong><p>${esc(block.text)}</p></aside>`;
  return `<figure class="guide__tablewrap"><div class="guide__tablescroll"><table class="guide__table"><thead><tr>${block.head.map(cell=>`<th>${esc(cell)}</th>`).join('')}</tr></thead><tbody>${block.rows.map(row=>`<tr>${row.map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${block.caption?`<figcaption class="guide__caption">${esc(block.caption)}</figcaption>`:''}</figure>`;
}

function guideDecision(locale:Locale,id:EditorialGuideId):string {
  const copy={
    ca:{
      safety:{title:'La regla en tres moments',lead:'Decideix pel tipus de fase, no per la foscor que perceps.',items:[['Fase parcial','Filtre sempre','Qualsevol part de fotosfera visible pot lesionar la retina.'],['Totalitat C2–C3','Única excepció','Només si el teu punt té totalitat confirmada i visible.'],['Eclipsi anular','Filtre sempre','L’anell és fotosfera: no hi ha interval segur.']]},
      photography:{title:'Una seqüència que puguis assajar',lead:'La càmera no ha de competir amb l’experiència.',items:[['Abans','Filtre, focus i enquadrament','Assaja amb el Sol filtrat i bloqueja l’enfocament.'],['Fases parcials','Manual i histograma','Evita saturar el disc i deixa marge al moviment.'],['Totalitat','Forquilla i avisos C2/C3','Retira el filtre només durant totalitat visible.']]},
      'low-sun':{title:'Tres comprovacions abans de triar lloc',lead:'La franja no serveix si el Sol queda darrere de l’horitzó local.',items:[['Altura','Quants graus queden','Com menys altura, menys marge davant relleu i boirina.'],['Azimut','Cap on has de mirar','Compara la direcció amb el perfil real del teu punt.'],['Pla B','Un horitzó alternatiu','Comprova accessos i una segona ubicació abans del dia.']]},
    },
    es:{
      safety:{title:'La regla en tres momentos',lead:'Decide según la fase, no por la oscuridad que percibes.',items:[['Fase parcial','Filtro siempre','Cualquier parte de fotosfera visible puede dañar la retina.'],['Totalidad C2–C3','Única excepción','Solo si tu punto tiene totalidad confirmada y visible.'],['Eclipse anular','Filtro siempre','El anillo es fotosfera: no hay intervalo seguro.']]},
      photography:{title:'Una secuencia que puedas ensayar',lead:'La cámara no debe competir con la experiencia.',items:[['Antes','Filtro, foco y encuadre','Ensaya con el Sol filtrado y bloquea el enfoque.'],['Fases parciales','Manual e histograma','Evita saturar el disco y deja margen al movimiento.'],['Totalidad','Bracketing y avisos C2/C3','Retira el filtro solo durante la totalidad visible.']]},
      'low-sun':{title:'Tres comprobaciones antes de elegir lugar',lead:'La franja no sirve si el Sol queda detrás del horizonte local.',items:[['Altura','Cuántos grados quedan','Cuanta menos altura, menos margen ante relieve y calima.'],['Acimut','Hacia dónde mirar','Compara la dirección con el perfil real de tu punto.'],['Plan B','Un horizonte alternativo','Comprueba accesos y una segunda ubicación con antelación.']]},
    },
    en:{
      safety:{title:'The rule in three moments',lead:'Decide from the eclipse phase, not from how dark it feels.',items:[['Partial phase','Filter at all times','Any visible photosphere can injure the retina.'],['Totality C2–C3','The only exception','Only where totality is confirmed and visible.'],['Annular eclipse','Filter at all times','The ring is photosphere: there is no safe interval.']]},
      photography:{title:'A sequence you can rehearse',lead:'The camera should not compete with the experience.',items:[['Beforehand','Filter, focus and framing','Rehearse on the filtered Sun and lock focus.'],['Partial phases','Manual and histogram','Avoid clipping the disc and allow for its motion.'],['Totality','Bracket and heed C2/C3','Remove the filter only during visible totality.']]},
      'low-sun':{title:'Three checks before choosing a site',lead:'The path is irrelevant if the Sun falls behind your local horizon.',items:[['Altitude','How many degrees remain','Lower altitude leaves less margin for terrain and haze.'],['Azimuth','Where to look','Compare the direction with the real horizon profile.'],['Backup','A second clear horizon','Check access and an alternative site beforehand.']]},
    },
    fr:{
      safety:{title:'La règle en trois moments',lead:'Décidez selon la phase, pas selon l’obscurité ressentie.',items:[['Phase partielle','Filtre en permanence','Toute photosphère visible peut léser la rétine.'],['Totalité C2–C3','Seule exception','Uniquement si la totalité est confirmée et visible sur place.'],['Éclipse annulaire','Filtre en permanence','L’anneau est la photosphère : aucun intervalle sûr.']]},
      photography:{title:'Une séquence que vous pouvez répéter',lead:'L’appareil ne doit pas vous priver de l’expérience.',items:[['Avant','Filtre, mise au point, cadrage','Répétez sur le Soleil filtré et verrouillez la mise au point.'],['Phases partielles','Manuel et histogramme','Évitez la saturation et prévoyez le déplacement.'],['Totalité','Bracketing et alertes C2/C3','Retirez le filtre uniquement pendant la totalité visible.']]},
      'low-sun':{title:'Trois vérifications avant de choisir',lead:'La bande ne sert à rien si le Soleil passe derrière l’horizon local.',items:[['Hauteur','Les degrés disponibles','Une faible hauteur laisse peu de marge au relief et à la brume.'],['Azimut','La direction du Soleil','Comparez-la au profil réel de l’horizon.'],['Repli','Un second horizon dégagé','Vérifiez les accès et un autre site à l’avance.']]},
    },
  } as const;
  const selected=copy[locale][id];
  return `<section class="guide-decision"><div class="guide-decision__head"><h2>${esc(selected.title)}</h2><p>${esc(selected.lead)}</p></div><div class="guide-decision__grid">${selected.items.map((item,index)=>`<article class="guide-decision__item ${id==='safety'?(index===1?'guide-decision__item--safe':'guide-decision__item--danger'):'guide-decision__item--accent'}"><span>${esc(item[0])}</span><strong>${esc(item[1])}</strong><p>${esc(item[2])}</p></article>`).join('')}</div></section>`;
}

function guideTool(locale:Locale,id:EditorialGuideId):string {
  const copy={ca:{safety:['Assaja els avisos de C2 i C3','El compte enrere et diu quan mantenir, retirar i reposar el filtre.','Obre el compte enrere'],photography:['Comprova l’enquadrament al cel','La càmera de cel mostra la direcció i l’altura des del teu punt.','Obre la càmera'],'low-sun':['Comprova l’horitzó del teu punt','Utilitza la càmera i el simulador de relleu abans de decidir on plantar-te.','Mira el cel']},es:{safety:['Ensaya los avisos de C2 y C3','La cuenta atrás indica cuándo mantener, retirar y volver a poner el filtro.','Abrir cuenta atrás'],photography:['Comprueba el encuadre en el cielo','La cámara de cielo muestra dirección y altura desde tu punto.','Abrir cámara'],'low-sun':['Comprueba el horizonte de tu punto','Usa la cámara y el simulador de relieve antes de decidir dónde situarte.','Mirar el cielo']},en:{safety:['Rehearse the C2 and C3 cues','The countdown tells you when to keep, remove and replace the filter.','Open countdown'],photography:['Check your framing in the sky','The sky camera shows direction and altitude from your site.','Open camera'],'low-sun':['Check your local horizon','Use the sky camera and terrain simulator before choosing your position.','View the sky']},fr:{safety:['Répétez les alertes C2 et C3','Le compte à rebours indique quand garder, retirer et remettre le filtre.','Ouvrir le compte à rebours'],photography:['Vérifiez le cadrage dans le ciel','La caméra du ciel montre direction et hauteur depuis votre site.','Ouvrir la caméra'],'low-sun':['Vérifiez votre horizon local','Utilisez la caméra et le simulateur de relief avant de choisir votre position.','Voir le ciel']}} as const;
  const selected=copy[locale][id];
  const hash=id==='safety'?'#/compte':'#/cel';
  return `<aside class="guide-tool-link"><div><strong>${esc(selected[0])}</strong><p>${esc(selected[1])}</p></div><a class="cta" href="${SEO_SITE}${prefix(locale)}${hash}">${esc(selected[2])}</a></aside>`;
}

function guideHubPage(locale:Locale):Page {
  const route:Route={kind:'guides',id:'index'};
  const copy={
    ca:{title:'Guies per preparar i veure un eclipsi solar',description:'Guies pràctiques de seguretat, fotografia i elecció del lloc per preparar un eclipsi solar amb les eines d’eclipsi.info.',intro:'Tres guies per resoldre les decisions que realment canvien l’experiència: protegir la vista, preparar la càmera i trobar un horitzó útil.',labels:['Seguretat','Fotografia','Planificació'],open:'Obre la guia',route:'Un ordre útil per preparar-te',steps:[['Primer, seguretat','Aprèn quan el filtre és obligatori i l’única excepció entre C2 i C3.'],['Després, el lloc','Comprova franja, altura, azimut, relleu i una alternativa.'],['Finalment, la càmera','Assaja l’equip i una seqüència que no et faci perdre la totalitat.']]},
    es:{title:'Guías para preparar y ver un eclipse solar',description:'Guías prácticas de seguridad, fotografía y elección de lugar para preparar un eclipse solar con las herramientas de eclipsi.info.',intro:'Tres guías para resolver las decisiones que realmente cambian la experiencia: proteger la vista, preparar la cámara y encontrar un horizonte útil.',labels:['Seguridad','Fotografía','Planificación'],open:'Abrir la guía',route:'Un orden útil para prepararte',steps:[['Primero, seguridad','Aprende cuándo el filtro es obligatorio y la única excepción entre C2 y C3.'],['Después, el lugar','Comprueba franja, altura, acimut, relieve y una alternativa.'],['Finalmente, la cámara','Ensaya el equipo y una secuencia que no te haga perder la totalidad.']]},
    en:{title:'Guides for planning and watching a solar eclipse',description:'Practical eclipse safety, photography and site-planning guides, connected to the tools at eclipsi.info.',intro:'Three guides for the decisions that genuinely change the experience: protect your sight, prepare the camera and find a usable horizon.',labels:['Safety','Photography','Planning'],open:'Open guide',route:'A useful order for preparing',steps:[['Safety first','Learn when a filter is mandatory and the sole C2–C3 exception.'],['Then choose the site','Check the path, altitude, azimuth, terrain and a backup.'],['Finally, the camera','Rehearse the equipment and a sequence that will not cost you totality.']]},
    fr:{title:'Guides pour préparer et observer une éclipse solaire',description:'Guides pratiques de sécurité, photographie et choix du lieu, reliés aux outils d’eclipsi.info.',intro:'Trois guides pour les décisions qui changent vraiment l’expérience : protéger la vue, préparer l’appareil et trouver un horizon adapté.',labels:['Sécurité','Photographie','Planification'],open:'Ouvrir le guide',route:'Un ordre utile pour se préparer',steps:[['D’abord, la sécurité','Sachez quand le filtre est obligatoire et l’unique exception entre C2 et C3.'],['Ensuite, le lieu','Vérifiez bande, hauteur, azimut, relief et site de repli.'],['Enfin, l’appareil','Répétez le matériel et une séquence qui ne vous fera pas manquer la totalité.']]},
  }[locale];
  const cards=EDITORIAL_GUIDE_IDS.map((id,index)=>{const guide=getEditorialGuide(id,locale);return `<article class="guide-hub__card"><span>${esc(copy.labels[index])}</span><h2>${esc(guide.title)}</h2><p>${esc(guide.description)}</p><a class="btn" href="${urlFor(locale,{kind:'guide',id})}">${esc(copy.open)}</a></article>`;}).join('');
  const body=`<section class="guide-hub"><p class="guide-hub__intro">${esc(copy.intro)}</p><div class="guide-hub__grid">${cards}</div><h2>${esc(copy.route)}</h2><ol class="guide-hub__route">${copy.steps.map(([title,text])=>`<li><strong>${esc(title)}</strong><span>${esc(text)}</span></li>`).join('')}</ol></section>`;
  const collection={'@context':'https://schema.org','@type':'CollectionPage','@id':`${urlFor(locale,route)}#page`,name:copy.title,description:copy.description,url:urlFor(locale,route),inLanguage:locale,hasPart:EDITORIAL_GUIDE_IDS.map(id=>({'@type':'Article',url:urlFor(locale,{kind:'guide',id}),name:getEditorialGuide(id,locale).title}))};
  return {route,html:shell(locale,route,`${copy.title} | eclipsi.info`,copy.description,copy.title,body,[collection,breadcrumb(locale,route,copy.title)])};
}

function guidePage(locale: Locale, id: EditorialGuideId): Page {
  const guide=getEditorialGuide(id,locale), route:Route={kind:'guide',id};
  const allAppSections=getGuide(locale,'2026-08-12',{sunAltitudeDeg:4.4});
  const wanted=id==='safety'?new Set(['phases']):id==='photography'?new Set(['photo']):new Set(['lowsun']);
  const appSections=allAppSections.filter(section=>wanted.has(section.id));
  const sections=appSections.map(section=>`<details class="guide__section" open><summary class="guide__summary"><span class="guide__summaryhead"><span class="guide__title">${esc(section.title)}</span></span><span class="guide__lead">${esc(section.lead)}</span></summary><div class="guide__body">${section.blocks.map(renderGuideBlock).join('')}</div></details>`).join('');
  const editorialSections=guide.sections.map(section=>`<section id="${esc(section.id)}" class="guide-article__section"><h2>${esc(section.title)}</h2>${section.paragraphs.map(paragraph=>`<p>${esc(paragraph)}</p>`).join('')}${section.bullets?.length?`<ul class="guide__list">${section.bullets.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`:''}</section>`).join('');
  const faq=guide.faq.map(item=>`<details class="guide__section"><summary class="guide__summary"><span class="guide__summaryhead"><span class="guide__title">${esc(item.question)}</span></span></summary><div class="guide__body"><p class="guide__p">${esc(item.answer)}</p></div></details>`).join('');
  const related=guide.relatedEclipseIds.map(eclipseId=>{const eclipse=ECLIPSES.find(item=>item.id===eclipseId)!;return `<li><a href="${urlFor(locale,{kind:'eclipse',id:eclipseId})}">${esc(eclipse.label[locale])}</a></li>`;}).join('');
  const safetyTitle=locale==='ca'?'No miris el Sol sense filtre':locale==='es'?'No mires el Sol sin filtro':locale==='fr'?'Ne regardez pas le Soleil sans filtre':'Never look at the Sun without a filter';
  const safetyBody=locale==='ca'?'La fase parcial i l’anular exigeixen filtre homologat en tot moment. En un eclipsi total, només es pot retirar entre C2 i C3 si la totalitat és visible al punt exacte.':locale==='es'?'La fase parcial y la anular exigen filtro homologado en todo momento. En un eclipse total, solo se puede retirar entre C2 y C3 si la totalidad es visible en el punto exacto.':locale==='fr'?'Les phases partielle et annulaire exigent un filtre homologué à tout moment. Pendant une éclipse totale, retirez-le seulement entre C2 et C3 si la totalité est visible au lieu exact.':'Partial and annular phases require a certified filter throughout. During a total eclipse, remove it only between C2 and C3 when totality is visible at the exact location.';
  const guideLayoutStyle='<style>.hero-eclipse{display:none}.hero{grid-template-columns:minmax(0,800px);padding-bottom:var(--sp-5)}.editorial-guide .guide__section{padding:0;margin:0}.editorial-guide .guide__body{padding-top:0}.editorial-guide__faq>h2{margin-bottom:var(--sp-5)}.guide-article__section{padding:0 0 var(--sp-8);margin:0 0 var(--sp-8);border:0;border-bottom:1px solid var(--border-hairline);border-radius:0;background:transparent;scroll-margin-top:110px}.guide-article__section h2{margin:0 0 var(--sp-4)}.guide-article__section p{color:var(--text-secondary)}.guide-tool-link .cta{margin:0}</style>';
  const safetyLinkLabel=locale==='ca'?'Guia de seguretat':locale==='es'?'Guía de seguridad':locale==='fr'?'Guide de sécurité':'Safety guide';
  const safety=guideLayoutStyle+(id==='safety'?renderToStaticMarkup(createElement(SafetyNotice,{level:'danger',title:safetyTitle,className:'seo-guide-safety'} as SafetyNoticeProps,safetyBody)):`<aside class="guide-filter-note"><strong>${esc(safetyTitle)}</strong><span>${esc(safetyBody)}</span><a href="${urlFor(locale,{kind:'guide',id:'safety'})}">${esc(safetyLinkLabel)}</a></aside>`);
  const indexLabel=locale==='ca'?'Índex':locale==='es'?'Índice':locale==='fr'?'Sommaire':'Contents';
  const faqLabel=locale==='ca'?'Preguntes freqüents':locale==='es'?'Preguntas frecuentes':locale==='fr'?'Questions fréquentes':'Frequently asked questions';
  const essentialsLabel=locale==='ca'?'Guia pas a pas':locale==='es'?'Guía paso a paso':locale==='fr'?'Guide pas à pas':'Step-by-step guide';
  const deeperLabel=locale==='ca'?'Dades pràctiques de l’app':locale==='es'?'Datos prácticos de la app':locale==='fr'?'Données pratiques de l’app':'Practical app data';
  const sourcesLabel=locale==='ca'?'Fonts i criteri editorial':locale==='es'?'Fuentes y criterio editorial':locale==='fr'?'Sources et critères éditoriaux':'Sources and editorial criteria';
  const sourceNote=locale==='ca'?'Contingut revisat el 5 d’agost de 2026. Prioritzem fonts astronòmiques, normatives i institucionals; no substitueix assessorament mèdic.':locale==='es'?'Contenido revisado el 5 de agosto de 2026. Priorizamos fuentes astronómicas, normativas e institucionales; no sustituye asesoramiento médico.':locale==='fr'?'Contenu révisé le 5 août 2026. Nous privilégions les sources astronomiques, normatives et institutionnelles ; ce guide ne remplace pas un avis médical.':'Content reviewed on 5 August 2026. We prioritise astronomical, standards and institutional sources; this guide is not medical advice.';
  const relevantSources=GUIDE_SOURCES.filter(source=>id==='safety'?/IGN|Safety|ISO/.test(source.label):id==='photography'?/Photography|Exposure|Safety/.test(source.label):/IGN|Dark/.test(source.label));
  const sources=`<section class="guide-sources"><h2>${esc(sourcesLabel)}</h2><p>${esc(sourceNote)}</p><ul>${relevantSources.map(source=>`<li><a href="${esc(source.url)}" rel="external">${esc(source.label)}</a></li>`).join('')}</ul></section>`;
  const relatedGuides=EDITORIAL_GUIDE_IDS.filter(other=>other!==id).map(other=>{const candidate=getEditorialGuide(other,locale);return `<li><a href="${urlFor(locale,{kind:'guide',id:other})}">${esc(candidate.title)}</a></li>`;}).join('');
  const body=`<p>${esc(guide.intro)}</p>${safety}${guideDecision(locale,id)}${guideTool(locale,id)}<div class="editorial-guide"><nav class="editorial-guide__toc guidescreen__toc" aria-label="${esc(indexLabel)}"><span class="guidescreen__tochead">${esc(indexLabel)}</span><ul class="guidescreen__toclist">${guide.sections.map(section=>`<li><a class="btn" href="#${esc(section.id)}">${esc(section.title)}</a></li>`).join('')}</ul></nav><article class="editorial-guide__body guide"><h2>${esc(essentialsLabel)}</h2>${editorialSections}<section class="guide-essentials"><h2>${esc(deeperLabel)}</h2><div class="guide__sections">${sections}</div></section><div class="editorial-guide__faq"><h2>${esc(faqLabel)}</h2><div class="guide__sections">${faq}</div></div>${sources}<h2>${esc(seoStrings(locale).related)}</h2><ul class="links">${relatedGuides}${related}</ul></article></div>`;
  const metaTitle=id==='safety'?(locale==='ca'?'Seguretat en un eclipsi: ulleres i filtres | eclipsi.info':locale==='es'?'Seguridad en un eclipse: gafas y filtros | eclipsi.info':locale==='fr'?'Sécurité pendant une éclipse : lunettes et filtres | eclipsi.info':'Solar eclipse safety: glasses and filters | eclipsi.info'):id==='photography'?(locale==='ca'?'Com fotografiar un eclipsi amb càmera o mòbil | eclipsi.info':locale==='es'?'Cómo fotografiar un eclipse con cámara o móvil | eclipsi.info':locale==='fr'?'Photographier une éclipse avec appareil ou mobile | eclipsi.info':'How to photograph an eclipse with a camera or phone | eclipsi.info'):(locale==='ca'?'Eclipsi amb el Sol baix: horitzó i azimut | eclipsi.info':locale==='es'?'Eclipse con el Sol bajo: horizonte y acimut | eclipsi.info':locale==='fr'?'Éclipse avec Soleil bas : horizon et azimut | eclipsi.info':'Low-Sun eclipse: horizon and azimuth | eclipsi.info');
  const article={'@context':'https://schema.org','@type':'Article','@id':`${urlFor(locale,route)}#article`,headline:guide.title,description:guide.description,datePublished:'2026-08-05',dateModified:'2026-08-05',inLanguage:locale,mainEntityOfPage:urlFor(locale,route),isPartOf:{'@id':`${urlFor(locale,{kind:'guides',id:'index'})}#page`},image:`${SEO_SITE}brand/og.png`,citation:relevantSources.map(source=>source.url),author:{'@type':'Organization',name:'eclipsi.info',url:SEO_SITE},publisher:{'@type':'Organization',name:'eclipsi.info',url:SEO_SITE,logo:{'@type':'ImageObject',url:`${SEO_SITE}brand/logo.svg`}}};
  const faqSchema={'@context':'https://schema.org','@type':'FAQPage','@id':`${urlFor(locale,route)}#faq`,url:urlFor(locale,route),inLanguage:locale,mainEntity:guide.faq.map(item=>({'@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:item.answer}}))};
  return {route,html:shell(locale,route,metaTitle,guide.description,guide.title,body,[article,faqSchema,breadcrumb(locale,route,guide.title)])};
}

async function main() {
  // Reutilitza els fulls compilats de l'app: tipografies, tokens de color,
  // espaiat i accessibilitat són exactament els del design system viu.
  const appShell=await readFile(resolve(OUT,'index.html'),'utf8');
  const assets=await readdir(resolve(OUT,'assets'));
  const widgetAsset=assets.find(name=>/^seoWidgets-.*\.js$/.test(name));
  const widgetStylesheet=assets.find(name=>/^seoWidgets-.*\.css$/.test(name));
  const guideStylesheet=assets.find(name=>/^GuideScreen-.*\.css$/.test(name));
  seoWidgetScript=widgetAsset?`<script type="module" src="/assets/${widgetAsset}"></script>`:'';
  appStylesheets=[...appShell.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]
    .map(([,href])=>`<link rel="stylesheet" href="${href}">`).join('')+(guideStylesheet?`<link rel="stylesheet" href="/assets/${guideStylesheet}">`:'')+(widgetStylesheet?`<link rel="stylesheet" href="/assets/${widgetStylesheet}">`:'')+seoWidgetScript+DATA_VISUAL_CSS;
  const generated: Array<{locale: Locale; route: Route; url: string}> = [];
  for (const locale of SEO_LOCALES) {
    const pages: Page[] = [guideHubPage(locale),...EDITORIAL_GUIDE_IDS.map(id=>guidePage(locale,id))];
    for (const eclipse of ECLIPSES) pages.push(eclipsePage(locale,eclipse),...SEO_CITIES.map(city=>cityPage(locale,eclipse,city)),...pointsForEclipse(eclipse.id).map(point=>pointPage(locale,eclipse,point)));
    for (const page of pages) {
      const directory=resolve(OUT,pathFor(locale,page.route));
      await mkdir(directory,{recursive:true});
      await writeFile(resolve(directory,'index.html'),page.html);
      generated.push({locale,route:page.route,url:urlFor(locale,page.route)});
    }
  }
  const rootRoutes=SEO_LOCALES.map(locale=>`<url><loc>${SEO_SITE}${prefix(locale)}</loc>${SEO_LOCALES.map(language=>`<xhtml:link rel="alternate" hreflang="${language}" href="${SEO_SITE}${prefix(language)}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${SEO_SITE}"/></url>`).join('');
  const entries=generated.map(({url,route})=>`<url><loc>${url}</loc>${SEO_LOCALES.map(locale=>`<xhtml:link rel="alternate" hreflang="${locale}" href="${urlFor(locale,route)}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${urlFor('ca',route)}"/></url>`).join('');
  await writeFile(resolve(OUT,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${rootRoutes}${entries}</urlset>`);
  console.log(`Generated ${generated.length} useful SEO pages in ${OUT}`);
}

await main();
