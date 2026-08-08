/** Genera pàgines editorials estàtiques després de Vite, fora del precache PWA. */
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
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
import { SEO_LOCALES, SEO_SITE, prefix, seoLocalHeading, seoLocalTitle, seoOfficialTitle, seoStrings, seoTravel, seoVerdict } from '../src/content/seo/strings';
import { seoOutcome } from '../src/content/seo/verdict';
import { travelAdvice } from '../src/content/seo/travel';
import type { SeoVerdictCopy } from '../src/content/seo/strings';
/*
 * LA FRASE DE PRIVADESA S'IMPORTA, NO ES REESCRIU.
 *
 * El peu d'aquestes 1.316 pàgines deia una frase pròpia («Calculat al
 * dispositiu. Sense comptes ni anuncis.») escrita aquí mateix, i el peu de
 * l'app en deia una altra. `credits.ts` explica per què n'hi ha d'haver UNA:
 * la seva versió anterior prometia que la ubicació no sortia del dispositiu i
 * era falsa —Photon i Open-Meteo reben les coordenades—, i es va corregir en
 * un sol lloc. Una còpia aquí hauria conservat la mentida.
 */
import { PRIVACY_NOTE } from '../src/features/about/credits';
import type { Locale } from '../src/i18n';
import { Badge, Card, PhaseDial, SafetyNotice, Stat, TimelineTrack } from '../src/ui';
import type { BadgeProps, CardProps, SafetyNoticeProps } from '../src/ui';

const OUT = resolve(process.env.ECLIPSI_OUT_DIR ?? 'dist');
type Kind = 'eclipse' | 'city' | 'point' | 'guide' | 'guides';
interface Route { kind: Kind; id: string; eclipseId?: string }
interface Page { route: Route; html: string }
let appStylesheets = '';
let seoWidgetScript = '';
/*
 * AQUEST BLOB ESTÀ BUIT A POSTA, I BUIDAR-LO ERA LA FEINA.
 *
 * Aquí hi vivien vint-i-cinc línies de CSS minificat —franja de 25.000
 * caràcters, una seixantena de `!important`, hexadecimals escrits a mà— que el
 * generador enganxava a CADA pàgina DESPRÉS de tots els fulls enllaçats. Com
 * que s'emetia l'últim, guanyava sempre: qualsevol regla neta de
 * `src/seo-pages.css` que toqués una classe que ell també tocava perdia en
 * silenci, i l'única manera de corregir res era afegir-hi una capa nova a
 * sobre. Que és exactament com havia crescut.
 *
 * Una tercera part estilava marcatge que no s'emetia enlloc: `.hero`, `.facts`,
 * `.fact`, `.timeline`, `.locator`, `.altitude`, `.eclipse-diagram`,
 * `.map-embed`, `.map-band`, `.map-limit`, `.map-center`, `.map-official`,
 * `.map-user`, `.map-legend`, `.visual-card`, `.visual-grid`, `.guide-index`,
 * `.seo-local-phase`, `.seo-local-detail`, `.seo-pointsmap__marker`, `.faq`,
 * `.guide-essentials__grid` — 45 classes declarades, cap d'elles a l'HTML.
 *
 * Tot el que era viu ha passat a `src/seo-pages.css`, que Vite compila,
 * minifica i posa amb hash, i que el generador ja enllaça perquè busca el
 * `seoWidgets-*.css`. La constant es queda com a cadena buida i no com a
 * variable esborrada perquè `appStylesheets` la concatena: així el punt on
 * s'enganxava queda documentat i ningú no hi torna a abocar res sense llegir
 * això.
 */
const DATA_VISUAL_CSS = '';

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
  return `<section class="overview-map"><h2>${esc(label)}</h2><div data-eclipse-overview-widget data-eclipse="${eclipseId}" data-locale="${locale}" data-label="${esc(label)}" data-map-url="/${prefix(locale)}?e=${eclipseId}#/mapa"></div></section>`;
}
const nearbyPoints = (eclipseId:string,lat:number,lon:number,exclude?:string) => [...pointsForEclipse(eclipseId)].filter(point=>point.id!==exclude).sort((a,b)=>distance2(lat,lon,a.lat,a.lon)-distance2(lat,lon,b.lat,b.lon)).slice(0,3);

function nearbyPointCards(locale:Locale,eclipse:EclipseEntry,lat:number,lon:number,exclude?:string):string {
  const altitudeLabel=locale==='ca'?'Sol':locale==='es'?'Sol':locale==='fr'?'Soleil':'Sun';
  return nearbyPoints(eclipse.id,lat,lon,exclude).map(point=>{
    const local=computeLocalCircumstances(eclipse.id,{lat:point.lat,lon:point.lon,elevation:point.elevationM??0});
    /*
     * EL MATEIX VEREDICTE QUE LA FITXA QUE HI HA A L'ALTRE COSTAT DE L'ENLLAÇ.
     *
     * Aquesta llista es calculava a part: mirava només `centralDurationSec` i,
     * si era zero, imprimia l'obscuració arrodonida a un decimal. Amb un 99,96 %
     * en sortia «100,0 % parcial» —cent per cent i parcial a la mateixa línia— i
     * un punt al caire de la franja apareixia aquí amb una durada que la seva
     * pròpia fitxa es nega a publicar. Dues pàgines nostres es contradeien.
     */
    const phase=seoVerdict(locale,seoOutcome(local),{
      duration:fmtNum(locale,local.centralDurationSec),
      obscuration:fmtNum(locale,local.contacts.max.obscuration*100),
      total:local.kind==='total',
    }).summary;
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

/*
 * ELS RÈTOLS DE LA CAPÇALERA I DEL PEU, EN UN SOL LLOC.
 *
 * Estaven repartits entre tres funcions i dos `locale==='ca'?…:…` encadenats,
 * i per això el peu oferia «Guies» dues vegades —una a `#/guia` i una altra a
 * `/guia/`— i «Com funciona» dues vegades amb la MATEIXA adreça. Ningú no
 * podia veure la duplicació perquè no hi havia cap lloc on la llista sencera
 * fos visible d'un cop d'ull. Ara sí.
 */
interface ChromeLabels {
  nav: string; lang: string; crumbs: string; open: string; mapShort: string; guideShort: string; eclipseShort: string;
  product: string; map: string; countdown: string; sky: string;
  eclipses: string; guides: string; allGuides: string;
  project: string; how: string; press: string; code: string;
  toolsTitle: string; toolsText: string;
  nextCities: string; distance: string;
}
const CHROME: Record<Locale, ChromeLabels> = {
  ca: { nav:'Navegació del lloc', lang:'Idioma', crumbs:'Ets aquí', open:'Obre l’app', mapShort:'Mapa', guideShort:'Guia', eclipseShort:'Eclipsi',
        product:'Producte', map:'Mapa de la franja', countdown:'Compte enrere', sky:'Càmera del cel',
        eclipses:'Eclipsis', guides:'Guies', allGuides:'Totes les guies',
        project:'Projecte', how:'Com funciona', press:'Premsa', code:'Codi a GitHub',
        toolsTitle:'Calcula l’eclipsi al teu punt', toolsText:'Cerca on seràs o fes servir la ubicació del dispositiu.',
        nextCities:'Compara amb altres ciutats', distance:'de distància' },
  es: { nav:'Navegación del sitio', lang:'Idioma', crumbs:'Estás aquí', open:'Abre la app', mapShort:'Mapa', guideShort:'Guía', eclipseShort:'Eclipse',
        product:'Producto', map:'Mapa de la franja', countdown:'Cuenta atrás', sky:'Cámara del cielo',
        eclipses:'Eclipses', guides:'Guías', allGuides:'Todas las guías',
        project:'Proyecto', how:'Cómo funciona', press:'Prensa', code:'Código en GitHub',
        toolsTitle:'Calcula el eclipse en tu ubicación', toolsText:'Busca dónde estarás o usa la ubicación del dispositivo.',
        nextCities:'Compara con otras ciudades', distance:'de distancia' },
  en: { nav:'Site navigation', lang:'Language', crumbs:'You are here', open:'Open the app', mapShort:'Map', guideShort:'Guide', eclipseShort:'Eclipse',
        product:'Product', map:'Eclipse path map', countdown:'Countdown', sky:'Sky camera',
        eclipses:'Eclipses', guides:'Guides', allGuides:'All guides',
        project:'Project', how:'How it works', press:'Press', code:'Code on GitHub',
        toolsTitle:'Calculate the eclipse at your location', toolsText:'Search where you will be or use your device location.',
        nextCities:'Compare with other cities', distance:'away' },
  fr: { nav:'Navigation du site', lang:'Langue', crumbs:'Vous êtes ici', open:'Ouvrir l’app', mapShort:'Carte', guideShort:'Guide', eclipseShort:'Éclipse',
        product:'Produit', map:'Carte de la bande', countdown:'Compte à rebours', sky:'Caméra du ciel',
        eclipses:'Éclipses', guides:'Guides', allGuides:'Tous les guides',
        project:'Projet', how:'Fonctionnement', press:'Presse', code:'Code sur GitHub',
        toolsTitle:'Calculez l’éclipse à votre position', toolsText:'Recherchez votre lieu ou utilisez la position de l’appareil.',
        nextCities:'Comparer avec d’autres villes', distance:'de distance' },
};

/*
 * LES COLUMNES DEL PEU, AMB CADA ENLLAÇ UNA SOLA VEGADA I A LA SEVA MENA DE RUTA.
 *
 * Què hi havia i per què era pitjor que no tenir-ne:
 *
 * · «Com funciona» sortia dues vegades, totes dues cap a `#/com-funciona`, que
 *   és una ruta de hash de l'app. La pàgina editorial existeix i és
 *   `/com-funciona/` (i `/es/com-funciona/`, etc.): cap de les 1.316 pàgines no
 *   hi enllaçava, o sigui que la pàgina publicada no rebia ni un sol enllaç
 *   intern. Un hash no és una URL per a un cercador.
 * · «Guies» sortia dues vegades: una a `#/guia` dins de Producte i una altra
 *   com a encapçalament de la seva pròpia columna.
 * · L'única porta al centre de guies vivia DINS d'un `<strong>` que fa
 *   d'encapçalament de columna. Un encapçalament no s'espera que sigui un
 *   enllaç, i per això ningú no el clicava.
 *
 * La regla que ho ordena: si existeix una pàgina publicada, s'hi enllaça pel
 * camí (`/guia/`, `/com-funciona/`, `/eclipsi/12-08-2026/`). El hash es reserva
 * per a les vistes que NOMÉS viuen dins de l'app i no tenen pàgina: el mapa, el
 * compte enrere i la càmera del cel.
 */
function seoSiteFooterInner(locale:Locale):string {
  const L=CHROME[locale], home=`/${prefix(locale)}`;
  const column=(label:string,items:string)=>`<nav class="seo-foot__col" aria-label="${esc(label)}"><h2>${esc(label)}</h2><ul>${items}</ul></nav>`;
  const link=(href:string,label:string,rel='')=>`<li><a href="${href}"${rel}>${esc(label)}</a></li>`;
  const product=link(`${home}#/mapa`,L.map)+link(`${home}#/compte`,L.countdown)+link(`${home}#/cel`,L.sky);
  const eclipses=ECLIPSES.map(eclipse=>link(`/${pathFor(locale,{kind:'eclipse',id:eclipse.id})}`,eclipse.label[locale])).join('');
  const guides=link(`/${pathFor(locale,{kind:'guides',id:'index'})}`,L.allGuides)
    +EDITORIAL_GUIDE_IDS.map(id=>link(`/${pathFor(locale,{kind:'guide',id})}`,getEditorialGuide(id,locale).title)).join('');
  const project=link(`${home}com-funciona/`,L.how)+link(`${home}com-funciona/premsa/`,L.press)
    +link('https://github.com/humbertblanco/eclipsi-info',L.code,' rel="external"');
  return `<div class="seo-foot__brand"><img src="/brand/logo.svg" width="164" height="35" alt="eclipsi.info"><p>${esc(PRIVACY_NOTE[locale])}</p></div>`
    +column(L.product,product)+column(L.eclipses,eclipses)+column(L.guides,guides)+column(L.project,project);
}

function seoFooterUtility(locale:Locale,eclipseId='2026-08-12'):string {
  const L=CHROME[locale];
  return `<div class="seo-foot__tools"><div><strong>${esc(L.toolsTitle)}</strong><p>${esc(L.toolsText)}</p></div><span data-seo-header-tools data-locale="${locale}" data-eclipse="${eclipseId}"></span></div>`;
}

function ogImage(locale: Locale): string {
  return `${SEO_SITE}brand/og-${locale}.png`;
}

/**
 * Les peces d'una pàgina, dites com a objecte i no com a set arguments seguits.
 *
 * Amb la llista posicional, afegir el veredicte volia dir tocar sis crides i
 * comptar comes; i sobretot volia dir que `hero` i `lede` es podien intercanviar
 * sense que el compilador digués res. Aquí no.
 */
interface Shell {
  route: Route;
  /** El que veu Google. Porta la xifra del veredicte a posta. */
  title: string;
  /** La meta descripció. NO és el text que llegeix qui obre la pàgina. */
  description: string;
  h1: string;
  /** El text que llegeix qui obre la pàgina, sota l'h1. */
  lede: string;
  /**
   * La xifra que decideix, quan la pàgina n'és una de local.
   *
   * ÉS L'ÚNIC AMBRE DE LA PÀGINA. Abans aquest lloc l'ocupava un `<div>` amb un
   * degradat rodó i `aria-hidden`: quaranta per cent de la primera pantalla del
   * mòbil gastats en un disc negre que no deia res, mentre la resposta —la
   * durada, l'ocultació— quedava dues pantalles avall.
   */
  verdict?: SeoVerdictCopy;
  /** El dibuix de la fase al màxim, si la pàgina té un punt concret. */
  dial?: string;
  eyebrow?: string;
  body: string;
  schemas: unknown[];
}

/*
 * EL CAMÍ DE MOLLES, I PER QUÈ L'HTML I EL JSON-LD SURTEN DEL MATEIX OBJECTE.
 *
 * El `BreadcrumbList` de les 1.296 fitxes de ciutat i de punt es SALTAVA
 * l'eclipsi, que és el seu pare: deia Inici → Barcelona, quan la jerarquia de
 * debò és Inici → Eclipsi del 12 d'agost de 2026 → Barcelona. I no n'hi havia
 * cap versió visible: qui obria la pàgina no tenia cap manera de pujar un
 * nivell.
 *
 * Les dues coses es corregeixen alhora, i a posta amb UNA sola font: aquesta
 * funció construeix la llista, `shell()` la pinta llegint el mateix objecte que
 * ja va a l'`<script type="application/ld+json">`. No hi ha cap manera que el
 * que llegeix una persona i el que llegeix Google divergeixin, perquè són
 * literalment les mateixes dades. És el patró que aquest projecte ja ha hagut
 * d'aprendre tres vegades: allò que no es compara amb res acaba mentint.
 */
interface CrumbList { '@context':string; '@type':string; itemListElement:Array<Record<string,unknown>> }

function breadcrumb(locale:Locale, route:Route, name:string):CrumbList {
  const s=seoStrings(locale);
  const items:Array<Record<string,unknown>>=[{'@type':'ListItem',position:1,name:s.home,item:`${SEO_SITE}${prefix(locale)}`}];
  const push=(label:string,url:string)=>items.push({'@type':'ListItem',position:items.length+1,name:label,item:url});
  if(route.kind==='guide') push(s.guides,urlFor(locale,{kind:'guides',id:'index'}));
  if((route.kind==='city'||route.kind==='point')&&route.eclipseId){
    const eclipse=ECLIPSES.find(entry=>entry.id===route.eclipseId);
    if(eclipse) push(eclipse.label[locale],urlFor(locale,{kind:'eclipse',id:eclipse.id}));
  }
  push(name,urlFor(locale,route));
  return {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items};
}

/*
 * DES D'UNA FITXA DE CIUTAT NO S'ARRIBAVA A CAP ALTRA CIUTAT.
 *
 * Barcelona enllaçava tres punts oficials, l'eclipsi i les guies; Girona, no.
 * Qui compara llocs —que és tot el motiu d'aquestes pàgines: decidir on
 * plantar-se— havia de tornar a la fitxa de l'eclipsi i baixar fins al
 * directori. Aquestes sis ciutats són les més pròximes al punt de la pàgina i
 * porten el seu veredicte al costat, perquè la comparació es pugui fer sense
 * clicar.
 *
 * LA XIFRA SURT DEL MOTOR, com a `nearbyPointCards`: si aquesta llista digués
 * «100,0 % parcial» on la fitxa de l'altre costat en diu 99,96 %, tornaríem a
 * tenir dues pàgines nostres contradient-se.
 */
const CITY_LOCAL=new Map<string,ReturnType<typeof computeLocalCircumstances>>();
const cityLocal=(eclipseId:string,city:SeoCity)=>{
  const key=`${eclipseId}|${city.id}`;
  const cached=CITY_LOCAL.get(key);
  if(cached) return cached;
  const computed=computeLocalCircumstances(eclipseId,{lat:city.lat,lon:city.lon,elevation:0});
  CITY_LOCAL.set(key,computed);
  return computed;
};

function nearbyCityNav(locale:Locale,eclipseId:string,lat:number,lon:number,excludeId?:string):string {
  const L=CHROME[locale];
  const items=[...SEO_CITIES]
    .filter(city=>city.id!==excludeId)
    .sort((a,b)=>distance2(lat,lon,a.lat,a.lon)-distance2(lat,lon,b.lat,b.lon))
    .slice(0,6)
    .map(city=>{
      const local=cityLocal(eclipseId,city);
      const verdict=seoVerdict(locale,seoOutcome(local),{
        duration:fmtNum(locale,local.centralDurationSec),
        obscuration:fmtNum(locale,local.contacts.max.obscuration*100),
        total:local.kind==='total',
      });
      return `<li><a href="/${pathFor(locale,{kind:'city',id:city.id,eclipseId})}"><strong>${esc(city.name[locale])}</strong><span>${esc(verdict.summary)}</span><span>${fmtNum(locale,distanceKm(lat,lon,city.lat,city.lon),0)} km ${esc(L.distance)}</span></a></li>`;
    }).join('');
  return items?`<nav class="seo-nextcities" aria-label="${esc(L.nextCities)}"><h2>${esc(L.nextCities)}</h2><ul>${items}</ul></nav>`:'';
}

function shell(locale: Locale, page: Shell): string {
  const { route, title, description, h1, lede, schemas } = page;
  let body = page.body;
  const canonical = urlFor(locale, route), s = seoStrings(locale), L = CHROME[locale];
  const eclipseId=route.kind==='eclipse'?route.id:route.eclipseId;
  const home=`/${prefix(locale)}`;

  /*
   * LA BARRA SUPERIOR, REFETA SENCERA. El que hi havia i per què no servia:
   *
   * · Per sota de 760 px, `.seo-nav__links` i `.seo-nav__cta` eren
   *   `display:none`. O sigui que al MÒBIL —d'on ve la major part del trànsit
   *   d'aquestes pàgines— no hi havia cap manera d'anar a l'app des d'una
   *   pàgina que existeix precisament per portar-hi gent. Ara el botó no
   *   desapareix mai: el que canvia és on es col·loca, no si hi és.
   * · Tot el menú vivia dins d'un `<span class="seo-langs" aria-label="Languages">`.
   *   Un lector de pantalla anunciava «Languages» —en anglès, als quatre
   *   idiomes— i a dins hi trobava el mapa, la guia, el cercador i el botó de
   *   l'app. Ara són dues `<nav>` amb el seu nom traduït: la del lloc i la de
   *   l'idioma.
   * · S'hi emetia un enllaç «GitHub» a totes les pàgines que el CSS amagava amb
   *   `display:none`. Un enllaç invisible multiplicat per 1.316. És al peu, que
   *   és on toca, i aquí ja no hi és.
   *
   * L'ordre del DOM és el de lectura i el de la importància: marca, navegació,
   * eines, botó, idioma. La graella el recol·loca per amplada sense tornar-lo a
   * ordenar, que és el que permet que al mòbil el botó pugi a la primera fila.
   */
  const eclipseNav=eclipseId&&route.kind!=='eclipse'
    ? `<a class="seo-head__eclipse" href="/${pathFor(locale,{kind:'eclipse',id:eclipseId})}">${esc(L.eclipseShort)} ${eclipseId.slice(0,4)}</a>`
    : '';
  const head=`<header class="seo-head"><div class="seo-head__row seo-wrap">`
    +`<a class="seo-head__brand" href="${home}" aria-label="eclipsi.info"><img src="/brand/logo.svg" width="164" height="35" alt="eclipsi.info"></a>`
    +`<nav class="seo-head__nav" aria-label="${esc(L.nav)}"><a href="${home}#/mapa">${esc(L.mapShort)}</a>${eclipseNav}<a href="/${pathFor(locale,{kind:'guides',id:'index'})}">${esc(L.guideShort)}</a></nav>`
    +`<span class="seo-head__tools" data-seo-header-tools data-locale="${locale}" data-eclipse="${eclipseId??'2026-08-12'}"></span>`
    +`<a class="seo-head__cta" href="${home}">${esc(L.open)}</a>`
    +`<nav class="seo-head__langs" aria-label="${esc(L.lang)}">${SEO_LOCALES.map(language=>`<a href="/${pathFor(language,route)}"${language===locale?' aria-current="page"':''}>${language.toUpperCase()}</a>`).join('')}</nav>`
    +`</div></header>`;

  // El camí visible i el JSON-LD són el MATEIX objecte: vegeu `breadcrumb()`.
  const trail=schemas.find(schema=>(schema as {'@type'?:string})?.['@type']==='BreadcrumbList') as CrumbList|undefined;
  const crumbs=trail?`<nav class="seo-crumbs seo-wrap" aria-label="${esc(L.crumbs)}"><ol>${trail.itemListElement.map((item,index,all)=>{
    const label=String(item.name), url=String(item.item);
    const href=url.startsWith(SEO_SITE)?`/${url.slice(SEO_SITE.length)}`:url;
    return index===all.length-1
      ?`<li><span aria-current="page">${esc(label)}</span></li>`
      :`<li><a href="${href}">${esc(label)}</a></li>`;
  }).join('')}</ol></nav>`:'';

  /*
   * LA FILA DE METADADES JA NO REPETEIX EL NOM DE L'ECLIPSI.
   *
   * Deia tres coses: el nom de l'eclipsi, la data en xifres i «Càlcul
   * topocèntric local». El nom ara és al camí de molles, tres línies més amunt,
   * i la data en xifres era la mateixa data escrita dues vegades seguides.
   * Queden les dues que aporten alguna cosa: quan és, i amb quin mètode.
   */
  if(eclipseId){
    const eclipse=ECLIPSES.find(entry=>entry.id===eclipseId);
    if(eclipse) body=`<p class="seo-dateline"><span>${esc(fmtLongDate(locale,eclipse.id))}</span><span>${locale==='ca'?'Càlcul topocèntric local':locale==='es'?'Cálculo topocéntrico local':locale==='fr'?'Calcul topocentrique local':'Local topocentric calculation'}</span></p>${body}`;
  }

  /*
   * ELS ENLLAÇOS LATERALS ES MUNTEN AQUÍ i no dins de `cityPage()`/`pointPage()`
   * perquè les dues menes de fitxa els necessiten iguals i la regla és una: des
   * d'un lloc s'ha de poder saltar a un altre lloc comparable.
   */
  const origin=route.kind==='city'
    ? SEO_CITIES.find(city=>city.id===route.id)
    : route.kind==='point'&&route.eclipseId ? pointsForEclipse(route.eclipseId).find(point=>point.id===route.id) : undefined;
  if(origin&&eclipseId) body+=nearbyCityNav(locale,eclipseId,origin.lat,origin.lon,route.kind==='city'?route.id:undefined);

  /*
   * EL PEU SURT DE `<main>`, I NO ÉS UNA MINÚCIA D'ETIQUETES.
   *
   * Hi havia DOS `<footer>`: el de les columnes, dins de `<main>` —o sigui,
   * anunciat com a contingut principal de la pàgina—, i un segon
   * `<footer class="seo-footer">` a fora amb l'única frase honesta del conjunt,
   * que el CSS amagava amb `display:none`. S'emetia 1.328 vegades i no la va
   * llegir mai ningú.
   *
   * Ara n'hi ha un, a fora de `<main>`, i la frase es veu. A més ja no és una
   * bessona escrita aquí: és `PRIVACY_NOTE`, la mateixa que signa el peu de
   * l'app i «Com funciona» (vegeu l'import de dalt).
   */
  const footer=`<footer class="seo-foot"><div class="seo-foot__inner seo-wrap">${seoFooterUtility(locale,eclipseId)}<div class="seo-foot__cols">${seoSiteFooterInner(locale)}</div><div class="seo-foot__legal"><p>eclipsi.info · ${esc(s.disclaimer)}</p></div></div></footer>`;

  /*
   * LA MATEIXA FRASE DUES VEGADES SEGUIDES.
   *
   * Les guies passen `guide.intro` com a `lede` —que és el text que va sota
   * l'h1— i el seu cos torna a començar amb `<p>{guide.intro}</p>`. A la
   * pàgina publicada es llegia el mateix paràgraf dos cops, un amb el cos gran
   * i l'altre amb el normal, separats per un espai en blanc.
   *
   * Passa a les tres guies (`<p>{intro}</p>` al principi del cos) i al centre
   * de guies (`<p class="guide-hub__intro">{intro}</p>` dins de la secció).
   *
   * Es treu aquí i no a `guidePage()` perquè la duplicació NO és un error
   * d'aquelles funcions: és el resultat de dues decisions correctes preses per
   * separat (l'entradeta va sota el titular; l'article comença per la seva
   * entrada). Qui les veu totes dues és aquest embolcall, i la comparació és
   * exacta —la mateixa cadena escapada— o no es toca res.
   */
  for(const duplicated of [`<p>${esc(lede)}</p>`,`<p class="guide-hub__intro">${esc(lede)}</p>`]) {
    body=body.replace(duplicated,'');
  }

  body=body.replaceAll(`href="${SEO_SITE}`, 'href="/');

  /*
   * EL VEREDICTE ÉS UN ENCAPÇALAMENT PLA, NO UNA TARGETA, i abans ho era per
   * accident: `.verdict` (`src/index.css:111`) és la targeta del simulador i
   * aquestes pàgines carreguen els fulls de l'app sencers, o sigui que li
   * heretava fons, vora i radi sense que ningú ho decidís. Amb el nom canviat a
   * `seo-verdict` la decisió torna a ser nostra, i és aquesta: la primera
   * pantalla no porta capsa. Si la portés, tot el que ve a sota —la cronologia,
   * la taula, el simulador— serien targetes dins d'una targeta, que és
   * exactament el que el sistema prohibeix. La jerarquia la fan la mida de la
   * xifra i l'ambre, no una vora.
   */
  const eyebrowMarkup=page.eyebrow?`<span class="seo-verdict__eyebrow">${esc(page.eyebrow)}</span>`:'';
  /*
   * El bloc de la xifra només existeix si la pàgina en té una. L'índex de guies
   * i la fitxa d'un eclipsi no parlen de cap punt concret, i inventar-los una
   * xifra seria pitjor que no tenir-ne cap: la graella cau a una sola columna i
   * el títol s'estén, que és el que toca quan no hi ha veredicte a donar.
   */
  const verdictMarkup=page.verdict
    ?`<div class="seo-verdict__answer">${page.dial??''}<p class="seo-verdict__figure${/\d/.test(page.verdict.figure)?'':' seo-verdict__figure--word'}"><strong>${esc(page.verdict.figure)}</strong><span>${esc(page.verdict.unit)}</span></p></div>`
    :'';
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#05060b"><meta name="color-scheme" content="dark"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"><link rel="canonical" href="${canonical}">${alternateLinks(route)}<meta property="og:type" content="article"><meta property="og:site_name" content="eclipsi.info"><meta property="og:locale" content="${locale}"><meta property="og:url" content="${canonical}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${ogImage(locale)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(h1)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${ogImage(locale)}"><meta name="twitter:image:alt" content="${esc(h1)}"><link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/svg+xml" href="/favicon.svg">${appStylesheets}${schemas.map(schema=>`<script type="application/ld+json">${json(schema)}</script>`).join('')}<script>if(/^#\/(compte|mapa|cel|guia|com-funciona)/.test(location.hash)&&new URLSearchParams(location.search).has('p'))location.replace('${SEO_SITE}${prefix(locale)}'+location.search+location.hash)</script></head><body class="seo-page" data-page-kind="${route.kind}">${head}${crumbs}<main class="seo-main seo-wrap"><header class="seo-verdict"><div class="seo-verdict__lead">${eyebrowMarkup}<h1>${esc(h1)}</h1><p class="seo-verdict__consequence">${esc(lede)}</p></div>${verdictMarkup}</header>${body}</main>${footer}</body></html>`;
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
  const event={ '@context':'https://schema.org','@type':'Event','@id':`${urlFor(locale,route)}#event`,name:eclipse.label[locale],startDate:window.start,endDate:window.end,eventStatus:'https://schema.org/EventScheduled',eventAttendanceMode:'https://schema.org/OfflineEventAttendanceMode',description:eclipse.spain[locale],url:urlFor(locale,route),image:`${ogImage(locale)}`,location:{'@type':'Place',name:window.area[locale]} };
  return {route,html:shell(locale,{route,title,description,h1:eclipse.label[locale],lede:eclipse.spain[locale],body,schemas:[event,breadcrumb(locale,route,eclipse.label[locale])]})};
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

/**
 * La cronologia local dels contactes. NOMÉS la cronologia.
 *
 * Aquesta funció es deia `visualDashboard` i pintava tres coses: el dibuix de la
 * fase, tres estadístiques i la línia de contactes. Les tres estadístiques
 * —disc tapat, altura del Sol, azimut— tornaven a sortir setanta píxels més
 * avall, dins de la targeta de dades de `facts()`, amb una altra composició i
 * els mateixos números. El dibuix de la fase ara viu al veredicte, que és on
 * pot dir alguna cosa.
 *
 * El que queda és el que no es repetia enlloc.
 */
function localTimeline(locale: Locale, c: LocalCircumstances): string {
  const contactsLabel=locale==='ca'?'Cronologia local':locale==='es'?'Cronología local':locale==='fr'?'Chronologie locale':'Local timeline';
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
  return `<div class="visual-card__head">${esc(contactsLabel)}</div><div class="timeline-widget">${timeline}</div>`;
}

function liveLocalWidgets(locale:Locale,eclipseId:string,lat:number,lon:number,elevation:number,name:string):string {
  // AMB BARRA DAVANT. Sense ella el camí és RELATIU: des de
  // `/es/ciudad/barcelona/12-08-2026/`, un `es/?p=…` va a parar a
  // `/es/ciudad/barcelona/12-08-2026/es/`, que és un 404. En català passava
  // desapercebut perquè `prefix('ca')` és buit i el resultat quedava a la
  // mateixa pàgina; als altres tres idiomes, no.
  const mapUrl=`/${prefix(locale)}?p=${lat.toFixed(5)},${lon.toFixed(5)}&amp;e=${eclipseId}&amp;n=${encodeURIComponent(name)}#/mapa`;
  return `<div class="seo-live-widgets" data-eclipse-local-widget data-eclipse="${eclipseId}" data-lat="${lat}" data-lon="${lon}" data-elevation="${elevation}" data-locale="${locale}" data-label="${esc(name)}" data-map-url="${mapUrl}"></div>`;
}

function facts(locale:Locale, eclipse:EclipseEntry, lat:number, lon:number, elevation=0) {
  const s=seoStrings(locale), circumstances=computeLocalCircumstances(eclipse.id,{lat,lon,elevation});
  const centerDistance=distanceToCenterLineKm({lat,lon},eclipsePath(eclipse.id).center);
  const starts=locale==='ca'?'Comença la fase parcial (C1)':locale==='es'?'Empieza la fase parcial (C1)':locale==='fr'?'Début de la phase partielle (C1)':'Partial phase begins (C1)';
  const ends=locale==='ca'?'Acaba la fase parcial (C4)':locale==='es'?'Termina la fase parcial (C4)':locale==='fr'?'Fin de la phase partielle (C4)':'Partial phase ends (C4)';
  const outcome=seoOutcome(circumstances);
  const stats=[
    circumstances.contacts.c1&&createElement(Stat,{key:'c1',label:starts,value:fmtTime(locale,circumstances.contacts.c1.time)}),
    createElement(Stat,{key:'max',label:s.maximum,value:fmtTime(locale,circumstances.contacts.max.time)}),
    circumstances.contacts.c4&&createElement(Stat,{key:'c4',label:ends,value:fmtTime(locale,circumstances.contacts.c4.time)}),
    /*
     * LA XIFRA QUE JA ÉS EL TITULAR NO ES REPETEIX AQUÍ.
     *
     * La taula sortia sencera i, a la mateixa pantalla, el veredicte deia el
     * mateix número amb una altra composició. Pitjor encara: a les fitxes sense
     * fase central, la fila «Durada de la fase central» tenia com a valor la
     * frase «Sense fase central en aquest punt» —una frase dins d'una cel·la de
     * dades, on la resta són hores i graus.
     *
     * La regla és senzilla: la durada només és una dada quan n'hi ha, i la que
     * ja ocupa el veredicte no torna a sortir.
     */
    outcome==='central'?null:createElement(Stat,{key:'obscuration',label:s.obscuration,value:`${fmtNum(locale,circumstances.contacts.max.obscuration*100)} %`}),
    createElement(Stat,{key:'sun',label:s.sun,value:`${fmtNum(locale,circumstances.contacts.max.sun.altitudeApparent)}°`}),
    centerDistance!==null&&createElement(Stat,{key:'center',label:locale==='ca'?'Distància a la central':locale==='es'?'Distancia a la central':locale==='fr'?'Distance à la ligne centrale':'Distance to centre line',value:fmtNum(locale,centerDistance),unit:'km'}),
  ].filter(Boolean);
  const statsMarkup=renderToStaticMarkup(createElement(Card,{className:'seo-stats'} as CardProps,stats));
  const positionLabel=circumstances.edgeUncertain?edgeText(locale):circumstances.centralDurationSec>0
    ? (locale==='ca'?'Dins la franja central':locale==='es'?'Dentro de la franja central':locale==='fr'?'Dans la bande centrale':'Inside the central path')
    : (locale==='ca'?'Fora de la franja: fase parcial':locale==='es'?'Fuera de la franja: fase parcial':locale==='fr'?'Hors de la bande : phase partielle':'Outside the path: partial phase');
  const position=renderToStaticMarkup(createElement(Badge,{tone:circumstances.centralDurationSec>0&&!circumstances.edgeUncertain?'clear':'partial',dot:true,className:'seo-position'} as BadgeProps,positionLabel));

  /*
   * EL VEREDICTE SURT DEL MOTOR, NO DEL CATÀLEG.
   *
   * `seoOutcome()` mira `kind`, `edgeUncertain` i `centralDurationSec` de les
   * circumstàncies d'AQUESTES coordenades. El títol i l'encapçalament que en
   * surten no poden dir «total» on el motor no dona fase central, que és
   * exactament el que passava: Barcelona anunciava un eclipsi total i, dues
   * pantalles més avall, la mateixa pàgina en deia 99,8 % i «parcial».
   */
  const obscuration=Math.max(0,Math.min(1,circumstances.contacts.max.obscuration));
  const verdict=seoVerdict(locale,outcome,{
    duration:fmtNum(locale,circumstances.centralDurationSec),
    obscuration:fmtNum(locale,obscuration*100),
    total:circumstances.kind==='total',
  });
  // El dibuix va al costat de la xifra i petit: aquí és prova, no decoració.
  const dial=renderToStaticMarkup(createElement('div',{className:'seo-verdict__dial'},
    createElement(PhaseDial,{obscuration,totality:outcome==='central'&&circumstances.kind==='total',size:132,glow:outcome==='central'}),
  ));

  return { circumstances, outcome, verdict, dial, html:`${localTimeline(locale,circumstances)}${position}${statsMarkup}`};
}

/**
 * La meta descripció d'una fitxa local.
 *
 * PROMET NOMÉS EL QUE LA PÀGINA DONA. La que hi havia deia «Simulador amb
 * relleu, previsió del temps i punts oficials pròxims» a totes les fitxes,
 * inclosa la del 2028, on una previsió del temps no vol dir res.
 *
 * Ara el primer que hi ha és el veredicte —que és la resposta i el que fa que
 * valgui la pena el clic— i després només les dues dades que hi són sempre.
 */
function localDescription(locale:Locale,year:string,place:string,summary:string,c:LocalCircumstances):string {
  const time=fmtTime(locale,c.contacts.max.time), altitude=fmtNum(locale,c.contacts.max.sun.altitudeApparent);
  return locale==='ca'?`Eclipsi ${year} des de ${place}: ${summary}, màxim a les ${time} i Sol a ${altitude}° sobre l’horitzó. Contactes, relleu i punts oficials a prop.`
    :locale==='es'?`Eclipse ${year} desde ${place}: ${summary}, máximo a las ${time} y Sol a ${altitude}° sobre el horizonte. Contactos, relieve y puntos oficiales cercanos.`
    :locale==='fr'?`Éclipse ${year} depuis ${place} : ${summary}, maximum à ${time} et Soleil à ${altitude}° sur l’horizon. Contacts, relief et sites officiels proches.`
    :`${year} eclipse from ${place}: ${summary}, maximum at ${time} with the Sun ${altitude}° above the horizon. Contacts, terrain and nearby official sites.`;
}

const nearbyHeading=(locale:Locale,name:string,alternative=false)=>locale==='ca'
  ? `${alternative?'Altres punts':'Punts'} oficials a prop de ${name}`
  : locale==='es' ? `${alternative?'Otros puntos':'Puntos'} oficiales cerca de ${name}`
  : locale==='fr' ? `${alternative?'Autres sites':'Sites'} officiels près de ${name}`
  : `${alternative?'Other official sites':'Official sites'} near ${name}`;

/**
 * «I si des d'aquí no s'hi veu, on he d'anar?»
 *
 * La meitat que faltava. La fitxa deia el seu tant per cent i s'aturava; qui la
 * llegeix no ha vingut a saber un número, ha vingut a decidir on es planta. El
 * càlcul és a `content/seo/travel.ts` —amb els dos llindars i el motiu de
 * cadascun escrits allà— i aquí només se'n pinta el resultat.
 */
function travelSection(locale:Locale,eclipse:EclipseEntry,lat:number,lon:number,place:string,selfCityId?:string):string {
  const advice=travelAdvice(eclipse.id,{lat,lon},SEO_CITIES,ECLIPSES.map(entry=>entry.id));
  if(advice.centerLineKm===null) return '';
  const target=advice.target
    ? { targetName:SEO_CITIES.find(city=>city.id===advice.target!.id)!.name[locale],
        targetKm:fmtNum(locale,advice.target.km,0),
        targetSeconds:fmtNum(locale,advice.target.durationSec) }
    : {};
  const other=advice.betterEclipse
    ? { otherDate:fmtLongDate(locale,advice.betterEclipse.eclipseId),
        otherSeconds:fmtNum(locale,advice.betterEclipse.durationSec),
        otherTotal:advice.betterEclipse.total }
    : {};
  const copy=seoTravel(locale,{ centerKm:fmtNum(locale,advice.centerLineKm,0), place, ...target, ...other });
  const link=advice.target
    ? `<a class="btn" href="${urlFor(locale,{kind:'city',id:advice.target.id,eclipseId:eclipse.id})}">${esc(SEO_CITIES.find(city=>city.id===advice.target!.id)!.name[locale])}</a>`
    : advice.betterEclipse
      /*
       * L'enllaç porta al MATEIX lloc en l'altre eclipsi quan aquell lloc té
       * fitxa pròpia —que és el cas d'una ciutat— i, si no en té, a la fitxa
       * d'aquell eclipsi. Un punt oficial només existeix per al 2026: no té
       * pàgina del 2027 on anar, i inventar-li-la seria un enllaç trencat.
       */
      ? `<a class="btn" href="${selfCityId!==undefined
          ? urlFor(locale,{kind:'city',id:selfCityId,eclipseId:advice.betterEclipse.eclipseId})
          : urlFor(locale,{kind:'eclipse',id:advice.betterEclipse.eclipseId})}">${esc(fmtLongDate(locale,advice.betterEclipse.eclipseId))}</a>`
      : '';
  return `<section class="seo-travel"><h2>${esc(copy.heading)}</h2><p>${esc(copy.centerLine)}</p>${
    copy.target?`<p>${esc(copy.target)}</p>`:copy.otherEclipse?`<p>${esc(copy.otherEclipse)}</p>`:`<p>${esc(copy.stay!)}</p>`
  }${link}</section>`;
}

function cityPage(locale:Locale,eclipse:EclipseEntry,city:SeoCity): Page {
  const name=city.name[locale];
  const s=seoStrings(locale),route:Route={kind:'city',id:city.id,eclipseId:eclipse.id},data=facts(locale,eclipse,city.lat,city.lon);
  const year=eclipse.id.slice(0,4);
  // El títol porta el VEREDICTE i no la mena global de l'eclipsi. «Eclipsi 2026
  // a Barcelona: 99,8 % del disc tapat» diu la veritat i, de passada, respon la
  // pregunta abans del clic; «Eclipsi total 2026 a Barcelona» no era cert.
  const title=shorten(seoLocalTitle(locale,year,name,data.verdict.summary),72);
  const description=shorten(localDescription(locale,year,name,data.verdict.summary,data.circumstances),160);
  const nearby=nearbyPointCards(locale,eclipse,city.lat,city.lon);
  const nearbySection=nearby?`<h2>${esc(nearbyHeading(locale,name))}</h2><ul class="spot-list">${nearby}</ul>`:'';
  /*
   * L'ORDRE, QUE ANAVA AL REVÉS I ES MENJAVA LA RESPOSTA.
   *
   * Aquest cos començava amb `liveLocalWidgets` —el simulador de relleu, la
   * previsió en directe i un mapa de MapLibre, tot arrencant en carregar— i
   * `data.html`, que és on `facts()` deixa la cronologia de contactes, la
   * posició respecte de la franja i la taula de dades, NO S'HI POSAVA MAI. Es
   * calculava i es llençava.
   *
   * O sigui que una pàgina titulada «hora i visibilitat» no publicava cap hora
   * a l'HTML: ni C1, ni el màxim, ni C4, ni la durada, ni la distància a la
   * línia central. Tot allò només existia dins del JavaScript, que Google no
   * espera i que qui té la xarxa justa no arriba a veure.
   *
   * Ara va primer el que es pot llegir sense executar res, i els widgets vius
   * queden a sota, que és on han d'estar: són per aprofundir, no per respondre.
   */
  const body=[
    data.html,
    travelSection(locale,eclipse,city.lat,city.lon,name,city.id),
    `<p>${esc(city.context[locale])}</p>`,
    `<p>${esc(localContext(locale,data.circumstances))}</p>`,
    `<p><strong>${esc(safetyText(locale,data.circumstances.kind,data.circumstances.edgeUncertain))}</strong></p>`,
    toolActions(locale,city.lat,city.lon,eclipse.id,name),
    liveLocalWidgets(locale,eclipse.id,city.lat,city.lon,0,name),
    nearbySection,
    `<h2>${esc(s.related)}</h2><ul class="links"><li><a href="${urlFor(locale,{kind:'eclipse',id:eclipse.id})}">${esc(eclipse.label[locale])}</a></li>${guideLinks(locale,eclipse.id)}</ul>`,
  ].join('');
  const page={'@context':'https://schema.org','@type':'WebPage','@id':`${urlFor(locale,route)}#webpage`,name:title,url:urlFor(locale,route),inLanguage:locale,about:{'@type':'Place',name,addressRegion:city.region[locale],geo:{'@type':'GeoCoordinates',latitude:city.lat,longitude:city.lon}}};
  return {route,html:shell(locale,{
    route,title,description,
    h1:seoLocalHeading(locale,fmtLongDate(locale,eclipse.id),name),
    lede:data.verdict.sentence,
    verdict:data.verdict,dial:data.dial,
    body,schemas:[page,breadcrumb(locale,route,name)],
  })};
}

function pointPage(locale:Locale,eclipse:EclipseEntry,point:ObservationPoint): Page {
  const name=point.name[locale];
  const s=seoStrings(locale),route:Route={kind:'point',id:point.id,eclipseId:eclipse.id},data=facts(locale,eclipse,point.lat,point.lon,point.elevationM??0);
  const duplicateName=pointsForEclipse(eclipse.id).filter(candidate=>candidate.name[locale]===name).length>1;
  const displayName=duplicateName?`${name} · ${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`:name;
  const year=eclipse.id.slice(0,4);
  // 84 i no 72: aquest títol porta el qualificador «punt oficial» al davant, i
  // amb el tall curt el que es perdia era la marca del final. Google en talla
  // el que li sembla de totes maneres; el que no pot passar és que el tallem
  // nosaltres enmig d'una paraula.
  const title=shorten(seoOfficialTitle(locale,year,displayName,data.verdict.summary),84);
  const officialBy=locale==='ca'?`Punt oficial d’observació publicat per ${point.source.who}.`:locale==='es'?`Punto oficial de observación publicado por ${point.source.who}.`:locale==='fr'?`Site officiel d’observation publié par ${point.source.who}.`:`Official viewing site published by ${point.source.who}.`;
  const description=shorten(`${name}: ${data.verdict.summary}, ${s.maximum.toLowerCase()} ${fmtTime(locale,data.circumstances.contacts.max.time)}. ${officialBy}`,155);
  const precision=point.precision==='exact'?s.exact:s.estimated;
  const nearby=nearbyPointCards(locale,eclipse,point.lat,point.lon,point.id);
  const kindContext=point.kind==='event'?s.event:point.kind==='observatory'?s.observatory:s.openSite;
  const elevation=point.elevationM===undefined?'':`<p><strong>${esc(s.elevation)}:</strong> ${fmtNum(locale,point.elevationM,0)} m</p>`;
  /*
   * CINC DECIMALS SÓN UN METRE, I 112 DELS 274 PUNTS NO EN TENEN CAP.
   *
   * `precision: 'estimated'` vol dir que la font publica el LLOC —«el passeig
   * marítim», «el camp de futbol»— i no cap coordenada; la que tenim l'hem
   * situada nosaltres. Escriure-la amb `toFixed(5)` és donar-li una resolució
   * d'un metre que ningú no ha mesurat: una estimació vestida de mesura, que és
   * el que la regla 2 prohibeix amb totes les lletres.
   *
   * Tres decimals són uns cent metres, que és l'ordre de magnitud del que de
   * debò sabem, i la frase de `s.estimated` ja diu al costat que és estimada.
   */
  const digits=point.precision==='exact'?5:3;
  const coordinates=`<p><strong>${esc(s.coords)}:</strong> ${point.lat.toFixed(digits)}, ${point.lon.toFixed(digits)}</p>`;
  const nearbySection=nearby?`<h2>${esc(nearbyHeading(locale,name,true))}</h2><ul class="spot-list">${nearby}</ul>`:'';
  const officialLabel=locale==='ca'?'Punt oficial d’observació':locale==='es'?'Punto oficial de observación':locale==='fr'?'Site officiel d’observation':'Official viewing site';
  const identity=`<aside class="official-identity"><span class="official-identity__eyebrow">${esc(officialLabel)}</span><strong>${esc(point.source.who)}</strong><p>${esc(kindContext)} ${esc(precision)} · <a href="${esc(point.source.url)}" rel="nofollow external">${esc(s.source)}</a></p></aside>`;
  const body=[
    identity,
    data.html,
    travelSection(locale,eclipse,point.lat,point.lon,name),
    point.note?`<p>${esc(point.note[locale])}</p>`:'',
    `<p>${esc(localContext(locale,data.circumstances))}</p>`,
    `<p><strong>${esc(safetyText(locale,data.circumstances.kind,data.circumstances.edgeUncertain))}</strong></p>`,
    coordinates,
    elevation,
    toolActions(locale,point.lat,point.lon,eclipse.id,name),
    liveLocalWidgets(locale,eclipse.id,point.lat,point.lon,point.elevationM??0,name),
    nearbySection,
    `<h2>${esc(s.related)}</h2><ul class="links"><li><a href="${urlFor(locale,{kind:'eclipse',id:eclipse.id})}">${esc(eclipse.label[locale])}</a></li>${guideLinks(locale,eclipse.id)}</ul>`,
  ].join('');
  const place={'@context':'https://schema.org','@type':'Place','@id':`${urlFor(locale,route)}#place`,name,description,url:urlFor(locale,route),geo:{'@type':'GeoCoordinates',latitude:point.lat,longitude:point.lon},subjectOf:point.source.url};
  return {route,html:shell(locale,{
    route,title,description,
    h1:seoLocalHeading(locale,fmtLongDate(locale,eclipse.id),displayName),
    lede:data.verdict.sentence,
    verdict:data.verdict,dial:data.dial,
    eyebrow:officialLabel,
    body,schemas:[place,breadcrumb(locale,route,displayName)],
  })};
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
  return {route,html:shell(locale,{route,title:`${copy.title} | eclipsi.info`,description:copy.description,h1:copy.title,lede:copy.intro,body,schemas:[collection,breadcrumb(locale,route,copy.title)]})};
}

function guidePage(locale: Locale, id: EditorialGuideId): Page {
  const guide=getEditorialGuide(id,locale), route:Route={kind:'guide',id};
  /*
   * SENSE CONTEXT D'ALTURA, I AIXÒ ÉS TOT EL MOTIU D'AQUEST COMENTARI.
   *
   * Aquí hi deia `getGuide(locale,'2026-08-12',{sunAltitudeDeg:4.4})`. Aquell
   * 4.4 era un número escrit a mà, i `content/guide.ts` el fa servir per
   * personalitzar la secció del Sol baix: les pàgines publicades deien, als
   * quatre idiomes, «Al teu punt, el Sol serà a només 4,4° al màxim. Aquesta
   * altura surt del càlcul de l'eclipsi i canvia quan canvies de lloc».
   *
   * Una guia estàtica no té cap punt. No hi havia cap càlcul: hi havia una
   * constant fent-se passar per una mesura, amb la frase que ho desmenteix
   * escrita al costat. L'altura de debò només la poden dir les fitxes de ciutat
   * i de punt, que sí que tenen coordenades.
   *
   * El paràmetre tampoc no calia per res: la secció `lowsun` ja passa el filtre
   * de `getGuide` pel seu `criticalFor`, amb altura o sense.
   */
  const allAppSections=getGuide(locale,'2026-08-12');
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
  const article={'@context':'https://schema.org','@type':'Article','@id':`${urlFor(locale,route)}#article`,headline:guide.title,description:guide.description,datePublished:'2026-08-05',dateModified:'2026-08-05',inLanguage:locale,mainEntityOfPage:urlFor(locale,route),isPartOf:{'@id':`${urlFor(locale,{kind:'guides',id:'index'})}#page`},image:`${ogImage(locale)}`,citation:relevantSources.map(source=>source.url),author:{'@type':'Organization',name:'eclipsi.info',url:SEO_SITE},publisher:{'@type':'Organization',name:'eclipsi.info',url:SEO_SITE,logo:{'@type':'ImageObject',url:`${SEO_SITE}brand/logo.svg`}}};
  const faqSchema={'@context':'https://schema.org','@type':'FAQPage','@id':`${urlFor(locale,route)}#faq`,url:urlFor(locale,route),inLanguage:locale,mainEntity:guide.faq.map(item=>({'@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:item.answer}}))};
  return {route,html:shell(locale,{route,title:metaTitle,description:guide.description,h1:guide.title,lede:guide.intro,body,schemas:[article,faqSchema,breadcrumb(locale,route,guide.title)]})};
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
  appStylesheets=`<link rel="icon" type="image/png" sizes="96x96" href="/brand/favicon-google-96.png">`+
    [...appShell.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]
      .map(([,href])=>`<link rel="stylesheet" href="${href}">`).join('')+(guideStylesheet?`<link rel="stylesheet" href="/assets/${guideStylesheet}">`:'')+(widgetStylesheet?`<link rel="stylesheet" href="/assets/${widgetStylesheet}">`:'')+seoWidgetScript+DATA_VISUAL_CSS;
  const generated: Array<{locale: Locale; route: Route; url: string}> = [];
  const canonicalUrls=new Set<string>();
  for (const locale of SEO_LOCALES) {
    const pages: Page[] = [guideHubPage(locale),...EDITORIAL_GUIDE_IDS.map(id=>guidePage(locale,id))];
    for (const eclipse of ECLIPSES) pages.push(eclipsePage(locale,eclipse),...SEO_CITIES.map(city=>cityPage(locale,eclipse,city)),...pointsForEclipse(eclipse.id).map(point=>pointPage(locale,eclipse,point)));
    for (const page of pages) {
      const html=page.html;
      const canonicals=[...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map(match=>match[1]);
      const expected=urlFor(locale,page.route);
      if(canonicals.length!==1||canonicals[0]!==expected) throw new Error(`Canonical incorrecta: ${expected}`);
      if(canonicalUrls.has(expected)) throw new Error(`Canonical duplicada: ${expected}`);
      if(!html.includes(`<html lang="${locale}">`)) throw new Error(`Idioma HTML incorrecte: ${expected}`);
      canonicalUrls.add(expected);
      const directory=resolve(OUT,pathFor(locale,page.route));
      await mkdir(directory,{recursive:true});
      await writeFile(resolve(directory,'index.html'),html);
      generated.push({locale,route:page.route,url:urlFor(locale,page.route)});
    }
  }
  for(const locale of SEO_LOCALES){
    const rootUrl=`${SEO_SITE}${prefix(locale)}`;
    const rootHtml=await readFile(resolve(OUT,prefix(locale),'index.html'),'utf8');
    const canonicals=[...rootHtml.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map(match=>match[1]);
    if(canonicals.length!==1||canonicals[0]!==rootUrl) throw new Error(`Canonical d’arrel incorrecta: ${rootUrl}`);
    if(canonicalUrls.has(rootUrl)) throw new Error(`Canonical d’arrel duplicada: ${rootUrl}`);
    if(!rootHtml.includes(`<html lang="${locale}">`)) throw new Error(`Idioma d’arrel incorrecte: ${rootUrl}`);
    canonicalUrls.add(rootUrl);
  }
  /* ══════════════════════════════════════════════════════════════════════════
     EL SITEMAP

     ── QUÈ HI HAVIA, I PER QUÈ NO SERVIA ────────────────────────────────────

     Un sol fitxer d'1 MB amb 1.328 URL, cadascuna amb cinc `hreflang`. Dos
     problemes, i el segon és el greu:

     1. A Search Console un sitemap és la unitat d'informe. Amb un de sol,
        l'única cosa que se'n pot llegir és «1.328 enviades, N indexades», que
        no diu res accionable. Amb un per mena es veu de seguida si el que no
        entra són les fitxes de punt oficial —que és el que un catàleg de 274
        emplaçaments amb la mateixa plantilla té números de fer— o alguna
        altra cosa.

     2. El `lastmod` era la constant `'2026-08-07'` escrita a mà. Mentia el dia
        8 i mentiria cada dia a partir d'aleshores, i mentia igual per a totes
        les pàgines: la fitxa d'un punt que s'acabava d'afegir al catàleg i la
        d'una ciutat que no havia canviat des de feia setmanes deien el mateix.
        Un `lastmod` que no es mou és pitjor que cap: Google aprèn a no
        creure-se'l i deixa de fer-ne cas per a tot el domini.

     ── D'ON SURT ARA LA DATA ────────────────────────────────────────────────

     Del que de debò determina el contingut de cada pàgina. Aquestes pàgines no
     tenen text escrit a mà: surten del motor astronòmic i dels catàlegs. Per
     tant la data de l'última modificació és la del fitxer més nou d'entre els
     que hi entren —el catàleg de punts d'aquell eclipsi, la llista de ciutats,
     el generador mateix— i es mou sola quan alguna cosa canvia de debò.

     No és la data del build a posta: amb la data del build, cada desplegament
     marcaria les 1.328 pàgines com a modificades encara que no hagués canviat
     ni una coma, que és exactament la manera de fer que el camp deixi de
     valer.
     ═════════════════════════════════════════════════════════════════════════ */
  const sourceDate=async(...files:string[]):Promise<string>=>{
    const times=await Promise.all(files.map(async file=>(await stat(resolve(file))).mtimeMs));
    return new Date(Math.max(...times)).toISOString().slice(0,10);
  };
  const GENERATOR='scripts/build-seo-pages.ts';
  const lastmodFor=new Map<Kind,string>([
    ['eclipse',await sourceDate(GENERATOR,'src/core/eclipses/catalog.ts','src/content/seo/cities.ts','src/data/observation-points/catalog.ts')],
    ['city',await sourceDate(GENERATOR,'src/content/seo/cities.ts','src/core/eclipses/catalog.ts')],
    ['point',await sourceDate(GENERATOR,'src/data/observation-points/catalog.ts',...ECLIPSES.map(e=>`src/data/observation-points/${e.id}.json`))],
    ['guide',await sourceDate(GENERATOR,'src/content/editorial-guides.ts','src/content/guide.ts')],
    ['guides',await sourceDate(GENERATOR,'src/content/editorial-guides.ts')],
  ]);
  const appLastmod=await sourceDate(GENERATOR,'index.html');

  const sitemapEntry=(url:string,lastmod:string,alternates:string,xDefault:string)=>[
    '  <url>',
    `    <loc>${url}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    alternates,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefault}"/>`,
    '  </url>',
  ].join('\n');
  const urlset=(entries:string[])=>[
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');

  // L'app i les seves pàgines de projecte: poques, i canvien amb el codi.
  const appEntries=[
    ...SEO_LOCALES.map(locale=>sitemapEntry(
      `${SEO_SITE}${prefix(locale)}`,
      appLastmod,
      SEO_LOCALES.map(language=>`    <xhtml:link rel="alternate" hreflang="${language}" href="${SEO_SITE}${prefix(language)}"/>`).join('\n'),
      SEO_SITE,
    )),
    ...['com-funciona/','com-funciona/premsa/'].flatMap(suffix=>
      SEO_LOCALES.map(locale=>sitemapEntry(
        `${SEO_SITE}${prefix(locale)}${suffix}`,
        appLastmod,
        SEO_LOCALES.map(language=>`    <xhtml:link rel="alternate" hreflang="${language}" href="${SEO_SITE}${prefix(language)}${suffix}"/>`).join('\n'),
        `${SEO_SITE}${suffix}`,
      )),
    ),
  ];

  const entriesFor=(kinds:Kind[])=>generated
    .filter(({route})=>kinds.includes(route.kind))
    .toSorted((a,b)=>a.url.localeCompare(b.url,'en'))
    .map(({url,route})=>sitemapEntry(
      url,
      lastmodFor.get(route.kind)!,
      SEO_LOCALES.map(locale=>`    <xhtml:link rel="alternate" hreflang="${locale}" href="${urlFor(locale,route)}"/>`).join('\n'),
      urlFor('ca',route),
    ));

  const SITEMAPS:Array<{file:string;entries:string[]}>=[
    { file:'sitemap-app.xml', entries:appEntries },
    { file:'sitemap-eclipsis.xml', entries:entriesFor(['eclipse']) },
    { file:'sitemap-ciutats.xml', entries:entriesFor(['city']) },
    { file:'sitemap-punts.xml', entries:entriesFor(['point']) },
    { file:'sitemap-guies.xml', entries:entriesFor(['guide','guides']) },
  ];
  let indexed=0;
  for(const {file,entries} of SITEMAPS){
    // Un sitemap buit és un fitxer que Search Console marca com a error i que
    // no diu res: si una mena no genera cap pàgina, no se'n publica cap.
    if(entries.length===0) continue;
    await writeFile(resolve(OUT,file),urlset(entries));
    indexed+=entries.length;
  }

  const sitemapIndex=[
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...SITEMAPS.filter(({entries})=>entries.length>0).map(({file,entries})=>[
      '  <sitemap>',
      `    <loc>${SEO_SITE}${file}</loc>`,
      // La data de l'índex és la més nova de les que conté: si no, un sitemap
      // acabat de refer quedaria anunciat amb la data d'un altre.
      `    <lastmod>${entries.map(entry=>/<lastmod>([^<]+)</.exec(entry)![1]).toSorted().at(-1)}</lastmod>`,
      '  </sitemap>',
    ].join('\n')),
    '</sitemapindex>',
    '',
  ].join('\n');
  await writeFile(resolve(OUT,'sitemap.xml'),sitemapIndex);
  console.log(`Generated ${generated.length} useful SEO pages in ${OUT}`);
  console.log(`Sitemap: índex amb ${SITEMAPS.filter(s=>s.entries.length>0).length} fitxers i ${indexed} URL.`);
}

await main();
