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

/*
 * ── PER QUÈ AQUESTES CIUTATS I NO UNES ALTRES ───────────────────────────────
 *
 * La llista es va triar per a l'eclipsi del 12 d'agost del 2026 —la franja del
 * nord— i es publicava igual per als tres. El resultat, mesurat amb el motor:
 * la pàgina del 2027 llistava setze ciutats i CAP no era a la franja, perquè
 * aquell dia la totalitat passa per l'estret de Gibraltar. Setze fitxes que
 * deien «fase parcial» i prou.
 *
 * Ara la llista cobreix els tres, i té dues menes de ciutat a posta:
 *
 *   · les que hi són perquè la franja hi passa —Tarifa, Ceuta, Algesires i
 *     Melilla el 2027; Sevilla, Còrdova i el llevant el 2028—, i
 *   · les grans, que hi són ENCARA QUE quedin fora, perquè és el que la gent
 *     busca i perquè «no, i a quants quilòmetres queda» és una resposta tan
 *     útil com un nombre de segons. Vigo i Santiago hi són per aquest motiu i
 *     no per cap altre: el text d'aquesta app va arribar a anunciar «Galícia»
 *     d'una franja que no passa per cap de les dues, i ara cada una ho diu amb
 *     la distància al davant.
 *
 * Les coordenades són del centre de cada ciutat. No és el mateix que qualsevol
 * punt del terme —per això cada fitxa ho diu— però és l'única cosa que es pot
 * dir d'una ciutat sencera sense inventar precisió.
 */
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
  city('gijon',text('Gijón','Gijón','Gijón','Gijón'),43.5322,-5.6611,text('Astúries','Asturias','Asturias','Asturies')),
  city('vigo',text('Vigo','Vigo','Vigo','Vigo'),42.2406,-8.7207,text('Galícia','Galicia','Galicia','Galice')),
  city('santiago-de-compostela',text('Santiago de Compostel·la','Santiago de Compostela','Santiago de Compostela','Saint-Jacques-de-Compostelle'),42.8782,-8.5448,text('Galícia','Galicia','Galicia','Galice')),
  city('pamplona',text('Pamplona','Pamplona','Pamplona','Pampelune'),42.8125,-1.6458,text('Navarra','Navarra','Navarre','Navarre')),
  city('donostia',text('Donostia-Sant Sebastià','San Sebastián','San Sebastián','Saint-Sébastien'),43.3183,-1.9812,text('Euskadi','Euskadi','Basque Country','Pays basque')),
  city('salamanca',text('Salamanca','Salamanca','Salamanca','Salamanque'),40.9701,-5.6635,text('Castella i Lleó','Castilla y León','Castile and León','Castille-et-León')),
  city('alacant',text('Alacant','Alicante','Alicante','Alicante'),38.3452,-0.4810,text('País Valencià','Comunitat Valenciana','Valencian Community','Communauté valencienne')),
  city('murcia',text('Múrcia','Murcia','Murcia','Murcie'),37.9922,-1.1307,text('Regió de Múrcia','Región de Murcia','Region of Murcia','Région de Murcie')),
  city('albacete',text('Albacete','Albacete','Albacete','Albacete'),38.9943,-1.8585,text('Castella-la Manxa','Castilla-La Mancha','Castilla–La Mancha','Castille-La Manche')),
  city('sevilla',text('Sevilla','Sevilla','Seville','Séville'),37.3891,-5.9845,text('Andalusia','Andalucía','Andalusia','Andalousie')),
  city('cordova',text('Còrdova','Córdoba','Córdoba','Cordoue'),37.8882,-4.7794,text('Andalusia','Andalucía','Andalusia','Andalousie')),
  city('huelva',text('Huelva','Huelva','Huelva','Huelva'),37.2614,-6.9447,text('Andalusia','Andalucía','Andalusia','Andalousie')),
  city('granada',text('Granada','Granada','Granada','Grenade'),37.1773,-3.5986,text('Andalusia','Andalucía','Andalusia','Andalousie')),
  city('malaga',text('Màlaga','Málaga','Málaga','Malaga'),36.7213,-4.4214,text('Andalusia','Andalucía','Andalusia','Andalousie')),
  city('almeria',text('Almeria','Almería','Almería','Almería'),36.8340,-2.4637,text('Andalusia','Andalucía','Andalusia','Andalousie')),
  city('cadis',text('Cadis','Cádiz','Cádiz','Cadix'),36.5271,-6.2886,text('Andalusia','Andalucía','Andalusia','Andalousie')),
  city('jerez',text('Jerez de la Frontera','Jerez de la Frontera','Jerez de la Frontera','Jerez de la Frontera'),36.6866,-6.1364,text('Andalusia','Andalucía','Andalusia','Andalousie')),
  city('algesires',text('Algesires','Algeciras','Algeciras','Algésiras'),36.1275,-5.4531,text('Andalusia','Andalucía','Andalusia','Andalousie')),
  city('tarifa',text('Tarifa','Tarifa','Tarifa','Tarifa'),36.0143,-5.6044,text('Andalusia','Andalucía','Andalusia','Andalousie')),
  city('ceuta',text('Ceuta','Ceuta','Ceuta','Ceuta'),35.8894,-5.3213,text('Ceuta','Ceuta','Ceuta','Ceuta')),
  city('melilla',text('Melilla','Melilla','Melilla','Melilla'),35.2923,-2.9381,text('Melilla','Melilla','Melilla','Melilla')),
];
