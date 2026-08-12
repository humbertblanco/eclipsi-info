/**
 * LES MÀSCARES DELS DOS GENERADORS DE DADES: què es demana, i fins on.
 *
 * ── PER QUÈ AQUESTS NÚMEROS VIUEN JUNTS I FORA DELS SCRIPTS ─────────────────
 *
 * Perquè són l'única cosa dels generadors que es pot comparar amb la realitat
 * sense tocar la xarxa, i mentre van viure dins de `build-viewpoints.ts` i de
 * `build-cloud-clim.ts` no els comparava ningú: els dos fitxers criden `main()`
 * a la darrera línia, o sigui que importar-los des d'una prova voldria dir
 * engegar hores de descàrregues contra dos serveis de voluntaris.
 *
 * La prova que els mira és `tests/mascares-dels-generadors.test.ts`, i el que
 * hi compara és exactament el que aquesta casa ja ha fallat dues vegades: **el
 * que es DEMANA contra el que el motor diu que és dins de la franja**. Els dos
 * errors històrics tenien aquesta forma i cap dels dos no el va veure ningú
 * fins mesos després:
 *
 *  · UN CATÀLEG EXTRET AMB UNA MÀSCARA AMB FORAT. El darrer tram del 2026 es
 *    descartava per no tenir límit nord —allà la vora és la TAPA— i Palma
 *    (39,57 / 2,65), amb 96 s de totalitat, no queia dins de cap rectangle de
 *    consulta. Cap mirador de Mallorca ni d'Eivissa no es va demanar mai.
 *  · EL MATEIX FORAT PER L'ALTRA PUNTA, trobat el 12-08-2026 en escriure
 *    aquesta prova: les finestres dels trams es tallen recorrent la línia
 *    central, i la vora comença abans i acaba després que ella (vegeu
 *    `bandChunks` a `core/places/viewpoints.ts`). El límit sud de l'entrada per
 *    Sibèria quedava fora de tots els rectangles.
 *
 * LA REGLA QUE SE'N DEDUEIX I QUE AQUEST FITXER SERVEIX: la màscara no és una
 * capsa dibuixada a ull damunt d'un mapa, és una conseqüència de la franja que
 * dona el motor. El dia que algú n'ajusti un número, la prova el torna a
 * comparar amb `computeEclipsePath` i diu si hi ha quedat un forat a dins.
 *
 * NO IMPORTA RES. Són números i rectangles: així es pot llegir des d'una prova,
 * des d'un script de Node i des d'on faci falta sense arrossegar-hi mig `core`.
 */

/* ══════════════════════════════════ MIRADORS (scripts/build-viewpoints.ts) ══ */

/**
 * Marge al voltant de la franja dins del qual un mirador encara compta, en km.
 *
 * NO ÉS CAP ARRODONIMENT. El límit té una incertesa real i, sobretot, un mirador
 * just a fora és informació útil: des d'allà saps cap on has de caminar. Amb 20
 * km, Madrid entra —n'és a 13,6 km MESURATS del límit sud del 2026—, que és el
 * mateix que dir que un madrileny té la totalitat a un quart d'hora de cotxe.
 */
export const VIEWPOINTS_MARGIN_KM = 20;

/**
 * Longitud de cada tram sobre la línia central, en km.
 *
 * La franja és global i no es pot demanar d'una peça: la del 2026 comença a
 * l'oceà Àrtic i acaba a les Balears. Es talla en trams d'uns 220 km de
 * RECORREGUT i no de durada, perquè als extrems l'ombra corre molt més que al
 * mig —l'anular del 2028 travessa la Península sencera en els darrers 57
 * segons— i trams d'igual durada haurien posat tot Espanya dins d'un sol
 * rectangle continental.
 */
export const VIEWPOINTS_CHUNK_KM = 220;

/**
 * Costat màxim del rectangle que es demana a Overpass, en graus.
 *
 * EL NÚMERO EL VA POSAR UNA MESURA QUE NO ESPERÀVEM. La intuïció deia
 * rectangles petits, per no ofegar el servidor; els cronòmetres del 3 d'agost
 * de 2026 diuen una altra cosa:
 *
 *     rectangle BUIT de l'Àrtic (1,2°)          37 s (.de) · 21 s (.fr)
 *     rectangle DENS dels Pirineus (2,4°)       47 s · 6.303 elements · 1,4 MB
 *
 * O sigui que el cost d'una petició és la CUA, no les dades: un rectangle buit
 * val gairebé el mateix que un que porta un megabyte i mig. Amb rectangles
 * d'1,2° el 2026 en fa 290 i s'hi anaven més de dues hores esperant torn; amb
 * 2,4° en fa 110 i el temps es divideix per tres sense que cap petició deixi de
 * cabre — el rectangle que el servidor SÍ que va rebutjar (26.708 elements,
 * 307.000 km²) és sis vegades més gros que el pitjor d'aquests.
 */
export const VIEWPOINTS_SPAN_DEG = 2.4;

/* ═══════════════════════════════════ NÚVOLS (scripts/build-cloud-clim.ts) ══ */

/**
 * Pas de la graella de climatologia, en graus.
 *
 * MESURAT, PERQUÈ LA SUPOSICIÓ ERA FALSA. La idea de partida era que 0,25° fos
 * la malla d'ERA5 i que baixar-ne més fos fingir detall. Demanant latituds
 * separades 0,02°, l'arxiu torna coordenades enganxades a una malla de
 * 0,0703125° —7,8 km— i valors de nuvolositat diferents gairebé a cada salt. Un
 * transsecte de 20 punts a 0,0703° sobre Burgos dona 10 valors diferents de 20,
 * amb trams iguals de 0,088°: si a sota hi hagués una malla de 0,25°
 * interpolada, s'hi veurien esglaons de 0,25°, i no s'hi veuen.
 *
 * Es queda a 0,25° per COST, i el cost està comptat: a 0,0703° la franja del
 * 2026 passaria de 888 cel·les a unes onze mil dues-centes (creixen amb el
 * quadrat del pas) i les 8.486 crides d'API passarien de cent mil — deu dies
 * sencers del límit diari del pla gratuït.
 *
 * La distinció que no s'ha de perdre mai: 0,25° no INVENTA res —cap cel·la
 * ensenya més detall del que la font en sap—, però tampoc no és el límit de la
 * font. Si algun dia es baixa el pas, això no és cosmètica: és dada nova.
 */
export const CLIM_STEP_DEG = 0.25;

/**
 * Marge al voltant de la franja que la capa de núvols també calcula, en km.
 *
 * La capa no serveix només per triar dins de la franja: serveix per veure si val
 * la pena moure's. Cinquanta quilòmetres és, aproximadament, el que es recorre
 * en tres quarts d'hora de carretera secundària el dia de l'eclipsi, que és el
 * que algú es pot plantejar el mateix matí. Més enllà d'això ja no és una
 * decisió de mapa, és un altre viatge.
 */
export const CLIM_BUFFER_KM = 50;

/** Un rectangle geogràfic de finestra, en graus. */
export interface ClimWindow {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Finestres de món que té sentit calcular, per eclipsi.
 *
 * NO ÉS TOTA LA FRANJA, i tampoc no ho pretén. La del 12 d'agost de 2026 comença
 * a Sibèria, passa pel pol i baixa per Islàndia: calcular-la sencera serien
 * desenes de milers de cel·les i unes quantes hores de peticions per pintar oceà
 * que ningú d'aquesta app no mirarà mai. Aquesta aplicació parla d'anar a veure
 * l'eclipsi des d'Espanya, i aquests rectangles són el tros de franja al qual
 * s'hi pot arribar conduint.
 *
 * ── I ARA LA PART QUE FALTAVA: QUÈ ES DEIXA FORA, MESURAT ───────────────────
 *
 * Un retall deliberat i un forat s'assemblen molt mirant el mapa, i la
 * diferència és que del primer se'n saben els números. Eixamplant cada finestra
 * 3° per cada banda i tornant a comptar cel·les (12-08-2026). Les caixes són les
 * de les cel·les que quedarien fora, i van escrites perquè es puguin mirar en un
 * mapa sense refiar-se de l'adjectiu que hi hem posat al costat:
 *
 *     2026   888 dins · 377 fora    oest 180  lat 43,5…48    lon −13…−10,25
 *                                   nord 280  lat 45,25…48   lon −13…−5,5
 *                                   est   60  lat 37,75…40,5 lon 5,25…6,75
 *                                   sud    0
 *     2027   557 dins · 293 fora    oest 144  lat 33,75…36,75 lon −13…−10,25
 *                                   est  149  lat 34…37       lon 1,25…4
 *                                   nord i sud  0
 *     2028   937 dins · 237 fora    oest 228  lat 31,75…37,75 lon −13…−10,25
 *                                   sud   81  lat 31,75…33,75 lon −13…−9
 *                                   est i nord  0
 *
 * (Les vores sumen més que el total perquè una cel·la de cantonada compta a
 * dues. El 2026: 180 + 280 + 60 = 520 per 377 cel·les diferents.)
 *
 * LLEGIT SOBRE EL MAPA: del 2026, l'oest i el nord són Atlàntic obert i golf de
 * Biscaia per on la franja baixa d'Islàndia, i els 60 de l'est són la mar entre
 * Menorca i Sardenya —a llevant de lon 5,25° ja no hi ha illa nostra. Del 2027,
 * l'oest és Atlàntic davant del Marroc i l'est entra a Algèria (Alger cau a
 * 36,75° / 3,05°). Del 2028, tot són Atlàntic: els 228 de l'oest davant de
 * Portugal i el Marroc, i els 81 del sud a la mar de davant de la costa
 * marroquina —cap d'ells no passa de lon −9°, o sigui que de Marroc endins no
 * se'n deixa fora res.
 *
 * O sigui que els talls cauen sobre mar obert i sobre un tros d'Algèria on
 * aquesta app no envia ningú, i no sobre cap tros de franja que el producte
 * prometi. Qui canviï una xifra d'aquí que refaci aquest recompte i el
 * reescrigui: la primera versió d'aquesta taula es va deixar els 60 de l'est del
 * 2026 sense comptar i en deia «Marroc interior» d'unes cel·les que són mar.
 *
 * ELS LÍMITS ESTAN ARRODONITS A GRAUS SENCERS a posta: així la retallada de
 * veritat la fa la geometria de la franja (`CLIM_BUFFER_KM`) i no un rectangle
 * escrit a mà que algú hauria d'anar ajustant. La comprovació que no s'hi hagi
 * quedat res a fora la fa la prova, ciutat per ciutat, contra el motor.
 *
 * QUÈ PASSA AMB UN ECLIPSI NOU DEL CATÀLEG: que aquí no hi és, i llavors ni
 * l'script el sap generar ni la prova el deixa passar. És deliberat — decidir
 * fins on paguem de baixar és una decisió humana i no en pot sortir cap per
 * defecte.
 */
export const CLIM_WINDOWS: Record<string, ClimWindow> = {
  // Galícia i la cornisa cantàbrica fins a les Balears, passant per Castella,
  // la Rioja, l'Aragó i el litoral valencià.
  '2026-08-12': { west: -10, south: 36, east: 5, north: 45 },
  // L'Estret: Cadis, Màlaga, Ceuta i Melilla, amb el nord del Marroc.
  '2027-08-02': { west: -10, south: 33, east: 1, north: 40 },
  // De Sevilla a la costa catalana, amb el Sol ponent-se durant l'anularitat.
  '2028-01-26': { west: -10, south: 34, east: 5, north: 43 },
};

/** Cert si un punt cau dins de la finestra de núvols d'un eclipsi. */
export function insideClimWindow(
  point: { lat: number; lon: number },
  window: ClimWindow,
): boolean {
  return (
    point.lat >= window.south &&
    point.lat <= window.north &&
    point.lon >= window.west &&
    point.lon <= window.east
  );
}
