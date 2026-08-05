// oxlint-disable react/only-export-components -- entrada autònoma: munta els widgets en carregar.
import { createRoot } from 'react-dom/client';
import { Component, lazy, Suspense, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { LocaleProvider, type Locale } from './i18n';
import { computeLocalCircumstances } from './core/astro/contacts';
import type { GeoLocation } from './core/astro/types';
import { useHorizon } from './features/sim/useHorizon';
import { SimulationView } from './features/sim/SimulationView';
import { MiniMap } from './features/map/MiniMap';
import { CloudPanel } from './features/weather/CloudPanel';
import { pointsForEclipse } from './data/observation-points/catalog';
import { SEO_CITIES } from './content/seo/cities';
import { Card } from './ui';
import { usePlaceSearch } from './features/location/usePlaceSearch';
import './styles/index.css';
import './index.css';
import './seo-widgets.css';

interface WidgetData {
  eclipse: string;
  lat: number;
  lon: number;
  elevation: number;
  locale: Locale;
  label: string;
  mapUrl: string;
}

const distance2=(aLat:number,aLon:number,bLat:number,bLon:number)=>(aLat-bLat)**2+((aLon-bLon)*Math.cos(aLat*Math.PI/180))**2;
const dateSlug=(iso:string)=>{const [y,m,d]=iso.split('-');return `${d}-${m}-${y}`;};
const pointPath=(locale:Locale,id:string,eclipse:string)=>`${locale==='ca'?'':`/${locale}`}/${locale==='ca'?'punt-oficial':locale==='es'?'punto-oficial':locale==='fr'?'site-officiel':'official-site'}/${id}/${dateSlug(eclipse)}/`;
const cityPath=(locale:Locale,id:string,eclipse:string)=>`${locale==='ca'?'':`/${locale}`}/${locale==='ca'?'ciutat':locale==='es'?'ciudad':locale==='fr'?'ville':'city'}/${id}/${dateSlug(eclipse)}/`;
const LocalEclipseMap=lazy(()=>import('./features/map/EclipseMap').then(module=>({default:module.EclipseMap})));

function HeaderLocationTools({ locale, eclipseId }: { locale: Locale; eclipseId: string }) {
  const search = usePlaceSearch();
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const root = locale === 'ca' ? '/' : `/${locale}/`;
  const copy = locale === 'ca'
    ? { placeholder: 'Cerca un lloc', locate: 'La meva ubicació', locating: 'Situant…', empty: 'Cap resultat' }
    : locale === 'es'
      ? { placeholder: 'Busca un lugar', locate: 'Mi ubicación', locating: 'Localizando…', empty: 'Sin resultados' }
      : locale === 'fr'
        ? { placeholder: 'Rechercher un lieu', locate: 'Ma position', locating: 'Localisation…', empty: 'Aucun résultat' }
        : { placeholder: 'Search a location', locate: 'My location', locating: 'Locating…', empty: 'No results' };
  const go = (lat: number, lon: number, name: string) => {
    window.location.href = `${root}?p=${lat.toFixed(5)},${lon.toFixed(5)}&e=${eclipseId}&n=${encodeURIComponent(name)}#/compte`;
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (search.hits[0]) go(search.hits[0].lat, search.hits[0].lon, search.hits[0].name);
  };
  const locate = () => {
    if (!navigator.geolocation || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      position => go(position.coords.latitude, position.coords.longitude, copy.locate),
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };
  return <div className={`seo-header-tools${open ? ' is-open' : ''}`}>
    <button className="seo-header-tools__toggle" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} aria-label={copy.placeholder}>⌕</button>
    <form className="seo-header-search" role="search" onSubmit={submit}>
      <span aria-hidden="true">⌕</span>
      <input value={search.query} onFocus={() => setOpen(true)} onChange={event => { search.setQuery(event.target.value); setOpen(true); }} placeholder={copy.placeholder} aria-label={copy.placeholder} autoComplete="off" />
      {open && search.query.trim().length >= 2 && <div className="seo-header-search__results">
        {search.loading && <span className="seo-header-search__status">…</span>}
        {!search.loading && search.hits.map(hit => <button type="button" key={hit.id} onClick={() => go(hit.lat, hit.lon, hit.name)}><strong>{hit.name}</strong>{hit.detail && <small>{hit.detail}</small>}</button>)}
        {!search.loading && search.outcome === 'empty' && <span className="seo-header-search__status">{copy.empty}</span>}
      </div>}
    </form>
    <button className="seo-header-locate" type="button" onClick={locate} disabled={locating} title={copy.locate}><span aria-hidden="true">◎</span><span>{locating ? copy.locating : copy.locate}</span></button>
  </div>;
}

class MapErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function NearbyPointsMap({data,location}:{data:WidgetData;location:GeoLocation}) {
  const points=useMemo(()=>[...pointsForEclipse(data.eclipse)].sort((a,b)=>distance2(data.lat,data.lon,a.lat,a.lon)-distance2(data.lat,data.lon,b.lat,b.lon)).slice(0,5),[data.eclipse,data.lat,data.lon]);
  return <div className="seo-pointsmap">
    <div className="seo-pointsmap__canvas">
      <MapErrorBoundary fallback={<p className="screen__note seo-pointsmap__fallback">{data.locale==='ca'?'Aquest dispositiu no pot mostrar el mapa interactiu. Els punts oficials continuen disponibles a la llista.':data.locale==='es'?'Este dispositivo no puede mostrar el mapa interactivo. Los puntos oficiales siguen disponibles en la lista.':data.locale==='fr'?'Cet appareil ne peut pas afficher la carte interactive. Les sites officiels restent accessibles dans la liste.':'This device cannot display the interactive map. Official sites remain available in the list.'}</p>}>
        <Suspense fallback={<p className="screen__note">{data.locale==='ca'?'Carregant el mapa local…':data.locale==='es'?'Cargando el mapa local…':data.locale==='fr'?'Chargement de la carte locale…':'Loading local map…'}</p>}>
          <LocalEclipseMap eclipseId={data.eclipse} locale={data.locale} observer={location} picked={location} focus={{location,label:data.label}} spots={points.map((point,index)=>({lat:point.lat,lon:point.lon,index:index+1}))} />
        </Suspense>
      </MapErrorBoundary>
    </div>
    <ol className="seo-pointsmap__legend">{points.map((point,index)=><li key={point.id}><a href={pointPath(data.locale,point.id,data.eclipse)}><span>{index+1}</span>{point.name[data.locale]}</a></li>)}</ol>
  </div>;
}

function OverviewMap({locale,eclipseId,label,mapUrl}:{locale:Locale;eclipseId:string;label:string;mapUrl:string}) {
  const fallback=<div className="seo-overviewmap__fallback"><MiniMap eclipseId={eclipseId} location={null} label={label} onOpen={()=>{window.location.href=mapUrl;}} /></div>;
  return <div className="seo-overviewmap">
    <div className="seo-overviewmap__canvas">
      <MapErrorBoundary fallback={fallback}>
        <Suspense fallback={<p className="screen__note">{locale==='ca'?'Carregant el mapa interactiu…':locale==='es'?'Cargando el mapa interactivo…':locale==='fr'?'Chargement de la carte interactive…':'Loading interactive map…'}</p>}>
          <LocalEclipseMap eclipseId={eclipseId} locale={locale} spots={SEO_CITIES.map((city,index)=>({lat:city.lat,lon:city.lon,index:index+1}))} />
        </Suspense>
      </MapErrorBoundary>
    </div>
    <ol className="seo-overviewmap__legend">{SEO_CITIES.map((city,index)=><li key={city.id}><a href={cityPath(locale,city.id,eclipseId)}><span>{index+1}</span>{city.name[locale]}</a></li>)}</ol>
  </div>;
}

function LocalWidgets({ data }: { data: WidgetData }) {
  const location: GeoLocation = { lat: data.lat, lon: data.lon, elevation: data.elevation };
  const horizon = useHorizon(location, { heightAboveGroundM: 1.6 });
  const circumstances = computeLocalCircumstances(data.eclipse, location);
  const weatherTitle = data.locale === 'ca' ? 'Previsió del temps al punt'
    : data.locale === 'es' ? 'Previsión del tiempo en el punto'
      : data.locale === 'fr' ? 'Prévision météo sur le site' : 'Weather forecast for this site';
  const simulationTitle = data.locale === 'ca' ? 'Simula què veuràs'
    : data.locale === 'es' ? 'Simula lo que verás'
      : data.locale === 'fr' ? 'Simulez ce que vous verrez' : 'Simulate what you will see';
  const mapTitle = data.locale === 'ca' ? `Franja i punts prop de ${data.label}`
    : data.locale === 'es' ? `Franja y puntos cerca de ${data.label}`
      : data.locale === 'fr' ? `Bande et sites près de ${data.label}` : `Path and sites near ${data.label}`;

  const mapDescription=data.locale==='ca'?`El punt blau és ${data.label}; les xinxetes numerades són els cinc punts oficials més pròxims. El mapa s’obre amb zoom local per comparar accessos i posició dins la franja.`:data.locale==='es'?`El punto azul es ${data.label}; las chinchetas numeradas son los cinco puntos oficiales más cercanos. El mapa se abre con zoom local para comparar accesos y posición dentro de la franja.`:data.locale==='fr'?`Le point bleu correspond à ${data.label} ; les repères numérotés sont les cinq sites officiels les plus proches. La carte locale permet de comparer accès et position dans la bande.`:`The blue point is ${data.label}; numbered markers are the five nearest official sites. The local map helps compare access and position within the eclipse path.`;
  return (
    <LocaleProvider initialLocale={data.locale}>
      <div className="seo-live-layout">
      <section className="seo-live-section seo-live-section--simulation">
        <h2>{simulationTitle}</h2>
        {horizon.loading && (
          <p className="screen__note">{Math.round(horizon.progress * 100)} % · {data.locale === 'ca' ? 'calculant el perfil del relleu' : data.locale === 'es' ? 'calculando el perfil del relieve' : data.locale === 'fr' ? 'calcul du profil du relief' : 'calculating the terrain profile'}</p>
        )}
        <SimulationView location={location} eclipseId={data.eclipse} locale={data.locale} horizon={horizon.profile} />
      </section>
      <section className="seo-live-section seo-live-section--weather">
        <h2>{weatherTitle}</h2>
        <CloudPanel
          locale={data.locale}
          location={location}
          targetTimeMs={circumstances.contacts.max.time.getTime()}
          sunAzimuthDeg={circumstances.contacts.max.sun.azimuth}
          sunAltitudeDeg={circumstances.contacts.max.sun.altitudeApparent}
          eventLabel={data.label}
        />
      </section>
      <section className="seo-live-section seo-live-section--map">
        <h2>{mapTitle}</h2>
        <p className="screen__note">{mapDescription}</p>
        <Card className="seo-live-minimap">
          <NearbyPointsMap data={data} location={location} />
        </Card>
      </section>
      </div>
    </LocaleProvider>
  );
}

for (const node of document.querySelectorAll<HTMLElement>('[data-eclipse-local-widget]')) {
  const data: WidgetData = {
    eclipse: node.dataset.eclipse ?? '2026-08-12',
    lat: Number(node.dataset.lat),
    lon: Number(node.dataset.lon),
    elevation: Number(node.dataset.elevation ?? 0),
    locale: (node.dataset.locale ?? 'ca') as Locale,
    label: node.dataset.label ?? '',
    mapUrl: node.dataset.mapUrl ?? '/#/mapa',
  };
  createRoot(node).render(<LocalWidgets data={data} />);
}

for (const node of document.querySelectorAll<HTMLElement>('[data-eclipse-overview-widget]')) {
  const locale = (node.dataset.locale ?? 'ca') as Locale;
  const eclipseId = node.dataset.eclipse ?? '2026-08-12';
  const label = node.dataset.label ?? '';
  const mapUrl = node.dataset.mapUrl ?? '/#/mapa';
  createRoot(node).render(
    <LocaleProvider initialLocale={locale}>
      <Card className="seo-live-minimap">
        <OverviewMap locale={locale} eclipseId={eclipseId} label={label} mapUrl={mapUrl} />
      </Card>
    </LocaleProvider>,
  );
}

for (const node of document.querySelectorAll<HTMLElement>('[data-seo-header-tools]')) {
  createRoot(node).render(<HeaderLocationTools
    locale={(node.dataset.locale ?? 'ca') as Locale}
    eclipseId={node.dataset.eclipse ?? '2026-08-12'}
  />);
}
