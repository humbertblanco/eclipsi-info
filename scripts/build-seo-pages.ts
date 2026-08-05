/** Genera pàgines editorials estàtiques després de Vite, fora del precache PWA. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { computeLocalCircumstances } from '../src/core/astro/contacts';
import { climCellAt, parseCloudClimGrid } from '../src/core/weather/climGrid';
import { ECLIPSES, type EclipseEntry } from '../src/core/eclipses/catalog';
import { pointsForEclipse, type ObservationPoint } from '../src/data/observation-points/catalog';
import { EDITORIAL_GUIDE_IDS, getEditorialGuide, type EditorialGuideId } from '../src/content/editorial-guides';
import { SEO_CITIES } from '../src/content/seo/cities';
import { SEO_EVENT_WINDOWS } from '../src/content/seo/events';
import type { SeoCity } from '../src/content/seo/types';
import { SEO_LOCALES, SEO_SITE, prefix, seoStrings } from '../src/content/seo/strings';
import type { Locale } from '../src/i18n';
import rawClimatology2026 from '../public/data/clouds-clim-2026-08-12.json';

const OUT = resolve(process.env.ECLIPSI_OUT_DIR ?? 'dist');
const CLIMATOLOGY_2026 = parseCloudClimGrid(rawClimatology2026);
type Kind = 'eclipse' | 'city' | 'point' | 'guide';
interface Route { kind: Kind; id: string; eclipseId?: string }
interface Page { route: Route; html: string }

const SEGMENTS: Record<Locale, Record<Kind, string>> = {
  ca: { eclipse: 'eclipsi', city: 'ciutat', point: 'punt-oficial', guide: 'guia' },
  es: { eclipse: 'eclipse', city: 'ciudad', point: 'punto-oficial', guide: 'guia' },
  en: { eclipse: 'eclipse', city: 'city', point: 'official-site', guide: 'guide' },
  fr: { eclipse: 'eclipse', city: 'ville', point: 'site-officiel', guide: 'guide' },
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
  : route.id;
const segment = (locale: Locale, route: Route) => {
  const suffix = route.eclipseId && route.kind !== 'eclipse' ? `/${route.eclipseId}` : '';
  return `${SEGMENTS[locale][route.kind]}/${routeSlug(locale, route)}${suffix}/`;
};
const pathFor = (locale: Locale, route: Route) => `${prefix(locale)}${segment(locale, route)}`;
const urlFor = (locale: Locale, route: Route) => `${SEO_SITE}${pathFor(locale, route)}`;
const appUrl = (locale: Locale, lat: number, lon: number, eclipseId: string, label: string) =>
  `${SEO_SITE}${prefix(locale)}?p=${lat.toFixed(5)},${lon.toFixed(5)}&amp;e=${eclipseId}&amp;n=${encodeURIComponent(label)}`;
const fmtTime = (locale: Locale, date: Date) => new Intl.DateTimeFormat(locale, { timeZone:'Europe/Madrid', hour:'2-digit', minute:'2-digit', second:'2-digit' }).format(date);
const fmtNum = (locale: Locale, value: number, digits=1) => new Intl.NumberFormat(locale, { maximumFractionDigits:digits, minimumFractionDigits:digits }).format(value);
const distance2 = (aLat:number,aLon:number,bLat:number,bLon:number) => (aLat-bLat)**2 + ((aLon-bLon)*Math.cos(aLat*Math.PI/180))**2;
const distanceKm = (aLat:number,aLon:number,bLat:number,bLon:number) => {
  const radius=6371, dLat=(bLat-aLat)*Math.PI/180, dLon=(bLon-aLon)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(aLat*Math.PI/180)*Math.cos(bLat*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2*radius*Math.asin(Math.sqrt(a));
};
const nearbyPoints = (eclipseId:string,lat:number,lon:number,exclude?:string) => [...pointsForEclipse(eclipseId)].filter(point=>point.id!==exclude).sort((a,b)=>distance2(lat,lon,a.lat,a.lon)-distance2(lat,lon,b.lat,b.lon)).slice(0,3);

function alternateLinks(route: Route): string {
  return `${SEO_LOCALES.map(locale => `<link rel="alternate" hreflang="${locale}" href="${urlFor(locale,route)}">`).join('')}<link rel="alternate" hreflang="x-default" href="${urlFor('ca',route)}">`;
}

function shell(locale: Locale, route: Route, title: string, description: string, h1: string, body: string, schemas: unknown[]): string {
  const canonical = urlFor(locale, route), s = seoStrings(locale);
  const languages = SEO_LOCALES.map(language => `<a href="${urlFor(language,route)}"${language===locale?' aria-current="page"':''}>${language.toUpperCase()}</a>`).join(' · ');
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#05060b"><meta name="color-scheme" content="dark"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1"><link rel="canonical" href="${canonical}">${alternateLinks(route)}<meta property="og:type" content="article"><meta property="og:site_name" content="eclipsi.info"><meta property="og:url" content="${canonical}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${SEO_SITE}brand/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${SEO_SITE}brand/og.png"><link rel="icon" href="${SEO_SITE}favicon.ico">${schemas.map(schema=>`<script type="application/ld+json">${json(schema)}</script>`).join('')}<script>if(new URLSearchParams(location.search).has('p'))location.replace('${SEO_SITE}${prefix(locale)}'+location.search+location.hash)</script><style>:root{color-scheme:dark;font-family:"IBM Plex Sans",system-ui,sans-serif;background:#05060b;color:#fbf8f1}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% 0,#172038 0,transparent 34rem),#05060b}main,nav,footer{width:min(800px,calc(100% - 32px));margin:auto}nav{display:flex;justify-content:space-between;gap:16px;padding:22px 0;color:#9aa5bc;border-bottom:1px solid #20283a}nav a{color:#ffc257}.hero{padding:52px 0 28px;border-bottom:1px solid #283044}h1{font-size:clamp(2rem,7vw,3.7rem);line-height:1.03;letter-spacing:-.035em;margin:0 0 16px}h2{margin-top:42px;font-size:1.45rem}h3{margin-top:28px}p,li{line-height:1.68;color:#c9d1e2}.lede{font-size:1.16rem}.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:28px 0}.fact{padding:17px;border:1px solid #283044;border-radius:14px;background:#111522}.fact small{display:block;color:#9aa5bc;margin-bottom:7px}.fact strong{font-size:1.22rem}.cta{display:inline-block;margin:22px 0;padding:14px 19px;border-radius:999px;background:#ffc257;color:#12151d;font-weight:750;text-decoration:none}.links{padding-left:20px}.links a,main a{color:#72dfc2}.faq{padding:18px 0;border-top:1px solid #283044}.faq h3{margin:0 0 8px}footer{padding:45px 0;color:#9aa5bc;border-top:1px solid #283044;margin-top:48px}@media(max-width:560px){nav{align-items:flex-start;flex-direction:column}.hero{padding-top:32px}}</style></head><body><nav><span><a href="${SEO_SITE}${prefix(locale)}">eclipsi.info</a> · ${esc(s.home)}</span><span aria-label="Languages">${languages}</span></nav><main><header class="hero"><h1>${esc(h1)}</h1><p class="lede">${esc(description)}</p></header>${body}</main><footer>eclipsi.info · ${esc(s.disclaimer)}</footer></body></html>`;
}

function breadcrumb(locale:Locale, route:Route, name:string) {
  const s=seoStrings(locale);
  return {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:s.home,item:`${SEO_SITE}${prefix(locale)}`},{'@type':'ListItem',position:2,name,item:urlFor(locale,route)}]};
}

function guideLinks(locale: Locale, eclipseId?: string): string {
  return EDITORIAL_GUIDE_IDS.filter(id => !eclipseId || getEditorialGuide(id, locale).relatedEclipseIds.includes(eclipseId)).map(id => {
    const guide = getEditorialGuide(id, locale);
    return `<li><a href="${urlFor(locale,{kind:'guide',id})}">${esc(guide.title)}</a></li>`;
  }).join('');
}

function eclipsePage(locale: Locale, eclipse: EclipseEntry): Page {
  const s=seoStrings(locale), route:Route={kind:'eclipse',id:eclipse.id};
  const title=eclipseMetaTitle(locale,eclipse);
  const description=eclipseMetaDescription(locale,eclipse);
  const cityLinks=SEO_CITIES.map(city=>`<li><a href="${urlFor(locale,{kind:'city',id:city.id,eclipseId:eclipse.id})}">${esc(city.name[locale])}</a></li>`).join('');
  const pointLinks=pointsForEclipse(eclipse.id).map(point=>`<li><a href="${urlFor(locale,{kind:'point',id:point.id,eclipseId:eclipse.id})}">${esc(point.name[locale])}</a></li>`).join('');
  const body=`<h2>${esc(s.eclipse)}</h2><p>${esc(eclipse.spain[locale])}</p>${eclipse.tips?`<ul>${eclipse.tips[locale].map(tip=>`<li>${esc(tip)}</li>`).join('')}</ul>`:''}<h2>${esc(s.guides)}</h2><ul class="links">${guideLinks(locale,eclipse.id)}</ul><h2>${esc(s.cities)}</h2><ul class="links">${cityLinks}</ul>${pointLinks?`<h2>${esc(s.points)}</h2><ul class="links">${pointLinks}</ul>`:''}`;
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
function facts(locale:Locale, eclipse:EclipseEntry, lat:number, lon:number, elevation=0) {
  const s=seoStrings(locale), circumstances=computeLocalCircumstances(eclipse.id,{lat,lon,elevation});
  const central=circumstances.edgeUncertain?edgeText(locale):circumstances.centralDurationSec>0?`${fmtNum(locale,circumstances.centralDurationSec)} s`:s.noCentral;
  const starts=locale==='ca'?'Comença la fase parcial (C1)':locale==='es'?'Empieza la fase parcial (C1)':locale==='fr'?'Début de la phase partielle (C1)':'Partial phase begins (C1)';
  const ends=locale==='ca'?'Acaba la fase parcial (C4)':locale==='es'?'Termina la fase parcial (C4)':locale==='fr'?'Fin de la phase partielle (C4)':'Partial phase ends (C4)';
  const first=circumstances.contacts.c1?`<div class="fact"><small>${esc(starts)}</small><strong>${esc(fmtTime(locale,circumstances.contacts.c1.time))}</strong></div>`:'';
  const last=circumstances.contacts.c4?`<div class="fact"><small>${esc(ends)}</small><strong>${esc(fmtTime(locale,circumstances.contacts.c4.time))}</strong></div>`:'';
  return { circumstances, html:`<div class="facts">${first}<div class="fact"><small>${esc(s.maximum)}</small><strong>${esc(fmtTime(locale,circumstances.contacts.max.time))}</strong></div>${last}<div class="fact"><small>${esc(s.duration)}</small><strong>${esc(central)}</strong></div><div class="fact"><small>${esc(s.obscuration)}</small><strong>${esc(fmtNum(locale,circumstances.contacts.max.obscuration*100))} %</strong></div><div class="fact"><small>${esc(s.sun)}</small><strong>${esc(fmtNum(locale,circumstances.contacts.max.sun.altitudeApparent))}°</strong></div></div>`};
}

function climatology(locale: Locale, eclipseId: string, lat: number, lon: number): string {
  if (eclipseId !== '2026-08-12') return '';
  const cell=climCellAt(CLIMATOLOGY_2026,lat,lon);
  if (!cell) return '';
  const s=seoStrings(locale);
  const years=locale==='ca'?`${cell.years} anys`:locale==='es'?`${cell.years} años`:locale==='fr'?`${cell.years} ans`:`${cell.years} years`;
  return `<section><h2>${esc(s.climatology)}</h2><div class="facts"><div class="fact"><small>${esc(s.skyScore)}</small><strong>${cell.score}/100</strong></div><div class="fact"><small>${esc(s.clearYears)}</small><strong>${fmtNum(locale,cell.clearFraction*100,0)} %</strong></div><div class="fact"><small>${esc(s.cloudyYears)}</small><strong>${fmtNum(locale,cell.cloudyFraction*100,0)} %</strong></div></div><p>${esc(s.climCaveat)} ${esc(years)} · Open-Meteo · CC BY 4.0</p></section>`;
}

function cityPage(locale:Locale,eclipse:EclipseEntry,city:SeoCity): Page {
  const s=seoStrings(locale),route:Route={kind:'city',id:city.id,eclipseId:eclipse.id},data=facts(locale,eclipse,city.lat,city.lon);
  const name=city.name[locale];
  const year=eclipse.id.slice(0,4),kind=eclipseKind(locale,eclipse);
  const title=shorten(locale==='ca'?`Eclipsi ${kind} ${year} a ${name}: hora i visibilitat | eclipsi.info`:locale==='es'?`Eclipse ${kind} ${year} en ${name}: hora y visibilidad | eclipsi.info`:locale==='fr'?`Éclipse ${kind} ${year} à ${name} : horaires et visibilité | eclipsi.info`:`${year} ${kind} eclipse in ${name}: times and visibility | eclipsi.info`,72);
  const description=shorten(locale==='ca'?`Hora, fase, disc cobert i altura del Sol de l’eclipsi ${year} a ${name}. Climatologia, punts oficials pròxims i càlcul del relleu.`:locale==='es'?`Hora, fase, disco cubierto y altura del Sol del eclipse ${year} en ${name}. Climatología, puntos oficiales cercanos y cálculo del relieve.`:locale==='fr'?`Heure, phase, disque couvert et hauteur du Soleil pour l’éclipse ${year} à ${name}. Climatologie, sites officiels proches et relief.`:`Time, phase, obscuration and Sun altitude for the ${year} eclipse in ${name}. Climatology, nearby official sites and terrain calculations.`,160);
  const nearby=nearbyPoints(eclipse.id,city.lat,city.lon).map(point=>`<li><a href="${urlFor(locale,{kind:'point',id:point.id,eclipseId:eclipse.id})}">${esc(point.name[locale])}</a> · ${fmtNum(locale,distanceKm(city.lat,city.lon,point.lat,point.lon))} km</li>`).join('');
  const body=`${data.html}<p>${esc(s.intro)}</p><p>${esc(city.context[locale])}</p><p>${esc(localContext(locale,data.circumstances))}</p><p><strong>${esc(safetyText(locale,data.circumstances.kind,data.circumstances.edgeUncertain))}</strong></p>${climatology(locale,eclipse.id,city.lat,city.lon)}<a class="cta" href="${appUrl(locale,city.lat,city.lon,eclipse.id,name)}">${esc(s.calculate)}</a><h2>${esc(s.related)}</h2><ul class="links"><li><a href="${urlFor(locale,{kind:'eclipse',id:eclipse.id})}">${esc(eclipse.label[locale])}</a></li>${nearby}${guideLinks(locale,eclipse.id)}</ul>`;
  const page={'@context':'https://schema.org','@type':'WebPage','@id':`${urlFor(locale,route)}#webpage`,name:title,url:urlFor(locale,route),inLanguage:locale,about:{'@type':'Place',name,addressRegion:city.region[locale],geo:{'@type':'GeoCoordinates',latitude:city.lat,longitude:city.lon}}};
  return {route,html:shell(locale,route,title,description,`${eclipse.label[locale]} — ${name}`,body,[page,breadcrumb(locale,route,name)])};
}

function pointPage(locale:Locale,eclipse:EclipseEntry,point:ObservationPoint): Page {
  const s=seoStrings(locale),route:Route={kind:'point',id:point.id,eclipseId:eclipse.id},data=facts(locale,eclipse,point.lat,point.lon,point.elevationM??0),name=point.name[locale];
  const duplicateName=pointsForEclipse(eclipse.id).filter(candidate=>candidate.name[locale]===name).length>1;
  const displayName=duplicateName?`${name} · ${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`:name;
  const title=shorten(`${displayName}: ${s.point}, ${eclipse.id.slice(0,4)} | eclipsi.info`,72);
  const phase=data.circumstances.edgeUncertain?edgeText(locale):point.phase==='central'?s.central:s.partial;
  const description=shorten(`${name}: ${phase}, ${s.maximum.toLowerCase()} ${fmtTime(locale,data.circumstances.contacts.max.time)}. ${s.official}`,160);
  const precision=point.precision==='exact'?s.exact:s.estimated;
  const nearby=nearbyPoints(eclipse.id,point.lat,point.lon,point.id).map(other=>`<li><a href="${urlFor(locale,{kind:'point',id:other.id,eclipseId:eclipse.id})}">${esc(other.name[locale])}</a> · ${fmtNum(locale,distanceKm(point.lat,point.lon,other.lat,other.lon))} km</li>`).join('');
  const kindContext=point.kind==='event'?s.event:point.kind==='observatory'?s.observatory:s.openSite;
  const elevation=point.elevationM===undefined?'':`<p><strong>${esc(s.elevation)}:</strong> ${fmtNum(locale,point.elevationM,0)} m</p>`;
  const body=`${data.html}<p>${esc(s.official)} ${esc(precision)}</p><p>${esc(kindContext)}</p>${point.note?`<p>${esc(point.note[locale])}</p>`:''}<p>${esc(localContext(locale,data.circumstances))}</p><p><strong>${esc(safetyText(locale,data.circumstances.kind,data.circumstances.edgeUncertain))}</strong></p><p><strong>${esc(s.coords)}:</strong> ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}</p>${elevation}<p><strong>${esc(s.source)}:</strong> <a href="${esc(point.source.url)}" rel="nofollow external">${esc(point.source.who)}</a></p>${climatology(locale,eclipse.id,point.lat,point.lon)}<a class="cta" href="${appUrl(locale,point.lat,point.lon,eclipse.id,name)}">${esc(s.calculate)}</a><h2>${esc(s.related)}</h2><ul class="links"><li><a href="${urlFor(locale,{kind:'eclipse',id:eclipse.id})}">${esc(eclipse.label[locale])}</a></li>${nearby}${guideLinks(locale,eclipse.id)}</ul>`;
  const place={'@context':'https://schema.org','@type':'Place','@id':`${urlFor(locale,route)}#place`,name,description,url:urlFor(locale,route),geo:{'@type':'GeoCoordinates',latitude:point.lat,longitude:point.lon},subjectOf:point.source.url};
  return {route,html:shell(locale,route,title,description,displayName,body,[place,breadcrumb(locale,route,displayName)])};
}

function guidePage(locale: Locale, id: EditorialGuideId): Page {
  const guide=getEditorialGuide(id,locale), route:Route={kind:'guide',id};
  const sections=guide.sections.map(section=>`<section id="${esc(section.id)}"><h2>${esc(section.title)}</h2>${section.paragraphs.map(paragraph=>`<p>${esc(paragraph)}</p>`).join('')}${section.bullets?`<ul>${section.bullets.map(bullet=>`<li>${esc(bullet)}</li>`).join('')}</ul>`:''}</section>`).join('');
  const faq=guide.faq.map(item=>`<article class="faq"><h3>${esc(item.question)}</h3><p>${esc(item.answer)}</p></article>`).join('');
  const related=guide.relatedEclipseIds.map(eclipseId=>{const eclipse=ECLIPSES.find(item=>item.id===eclipseId)!;return `<li><a href="${urlFor(locale,{kind:'eclipse',id:eclipseId})}">${esc(eclipse.label[locale])}</a></li>`;}).join('');
  const body=`<p>${esc(guide.intro)}</p>${sections}<h2>FAQ</h2>${faq}<h2>${esc(seoStrings(locale).related)}</h2><ul class="links">${related}</ul>`;
  const article={'@context':'https://schema.org','@type':'Article','@id':`${urlFor(locale,route)}#article`,headline:guide.title,description:guide.description,dateModified:'2026-08-05',inLanguage:locale,mainEntityOfPage:urlFor(locale,route),image:`${SEO_SITE}brand/og.png`,author:{'@type':'Organization',name:'eclipsi.info',url:SEO_SITE},publisher:{'@type':'Organization',name:'eclipsi.info',url:SEO_SITE}};
  const faqSchema={'@context':'https://schema.org','@type':'FAQPage',mainEntity:guide.faq.map(item=>({'@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:item.answer}}))};
  return {route,html:shell(locale,route,guide.title,guide.description,guide.title,body,[article,faqSchema,breadcrumb(locale,route,guide.title)])};
}

async function main() {
  const generated: Array<{locale: Locale; route: Route; url: string}> = [];
  for (const locale of SEO_LOCALES) {
    const pages: Page[] = EDITORIAL_GUIDE_IDS.map(id=>guidePage(locale,id));
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
