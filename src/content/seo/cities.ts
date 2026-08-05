import type { SeoCity, SeoText } from './types';

const text = (ca: string, es: string, en: string, fr: string): SeoText => ({ ca, es, en, fr });

function city(id:string,name:SeoText,lat:number,lon:number,region:SeoText):SeoCity {
  return { id,name,lat,lon,region,context:{
    ca:`Càlcul fet al centre de ${name.ca}; dins la mateixa ciutat, l’horitzó i els contactes poden variar lleugerament.`,
    es:`Cálculo realizado en el centro de ${name.es}; dentro de la ciudad, el horizonte y los contactos pueden variar ligeramente.`,
    en:`Calculated for central ${name.en}; the horizon and contact times may vary slightly elsewhere in the city.`,
    fr:`Calcul effectué au centre de ${name.fr} ; l’horizon et les contacts peuvent varier légèrement ailleurs dans la ville.`,
  }};
}

/** Ciutats amb intenció de cerca clara; no és un cens ni genera pàgines arbitràries. */
export const SEO_CITIES: readonly SeoCity[] = [
  city('a-coruna',text('A Coruña','A Coruña','A Coruña','La Corogne'),43.3623,-8.4115,text('Galícia','Galicia','Galicia','Galice')),
  city('oviedo',text('Oviedo','Oviedo','Oviedo','Oviedo'),43.3619,-5.8494,text('Astúries','Asturias','Asturias','Asturies')),
  city('santander',text('Santander','Santander','Santander','Santander'),43.4623,-3.81,text('Cantàbria','Cantabria','Cantabria','Cantabrie')),
  city('bilbao',text('Bilbao','Bilbao','Bilbao','Bilbao'),43.263,-2.935,text('Euskadi','Euskadi','Basque Country','Pays basque')),
  city('vitoria-gasteiz',text('Vitòria-Gasteiz','Vitoria-Gasteiz','Vitoria-Gasteiz','Vitoria-Gasteiz'),42.8467,-2.6726,text('Euskadi','Euskadi','Basque Country','Pays basque')),
  city('valladolid',text('Valladolid','Valladolid','Valladolid','Valladolid'),41.6523,-4.7245,text('Castella i Lleó','Castilla y León','Castile and León','Castille-et-León')),
  city('burgos',text('Burgos','Burgos','Burgos','Burgos'),42.3439,-3.6969,text('Castella i Lleó','Castilla y León','Castile and León','Castille-et-León')),
  city('logrono',text('Logronyo','Logroño','Logroño','Logroño'),42.4627,-2.4449,text('La Rioja','La Rioja','La Rioja','La Rioja')),
  city('zaragoza',text('Saragossa','Zaragoza','Zaragoza','Saragosse'),41.6488,-0.8891,text('Aragó','Aragón','Aragon','Aragon')),
  city('lleida',text('Lleida','Lleida','Lleida','Lérida'),41.6176,0.62,text('Catalunya','Cataluña','Catalonia','Catalogne')),
  city('tarragona',text('Tarragona','Tarragona','Tarragona','Tarragone'),41.1189,1.2445,text('Catalunya','Cataluña','Catalonia','Catalogne')),
  city('barcelona',text('Barcelona','Barcelona','Barcelona','Barcelone'),41.3874,2.1686,text('Catalunya','Cataluña','Catalonia','Catalogne')),
  city('castello',text('Castelló de la Plana','Castellón de la Plana','Castellón de la Plana','Castellón de la Plana'),39.9864,-0.0513,text('País Valencià','Comunitat Valenciana','Valencian Community','Communauté valencienne')),
  city('valencia',text('València','Valencia','Valencia','Valence'),39.4699,-0.3763,text('País Valencià','Comunitat Valenciana','Valencian Community','Communauté valencienne')),
  city('palma',text('Palma','Palma','Palma','Palma'),39.5696,2.6502,text('Illes Balears','Islas Baleares','Balearic Islands','Îles Baléares')),
  city('madrid',text('Madrid','Madrid','Madrid','Madrid'),40.4168,-3.7038,text('Comunitat de Madrid','Comunidad de Madrid','Community of Madrid','Communauté de Madrid')),
];
