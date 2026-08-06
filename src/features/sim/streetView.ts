/*
 * L'enllaç que ensenya QUÈ TENS DAVANT en la direcció on serà el Sol.
 *
 * La fitxa del mapa ja diu cap on miraràs al màxim («El Sol al màxim, cap a»)
 * i quant de marge et queda sobre el terreny. Però el marge es calcula contra
 * el MODEL D'ELEVACIONS, que sap on hi ha una carena i no sap que hi ha un bloc
 * de pisos, una nau industrial o una filera de plàtans. Set graus de marge
 * sobre una carena a tres quilòmetres no valen res si tens un edifici a
 * quaranta metres. Això només ho resol mirar-ho.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PER QUÈ AQUEST FORMAT D'URL I NO L'API DOCUMENTADA. LLEGEIX-HO ABANS DE
 * «FER-HO BÉ».
 *
 * Això va néixer amb la Google Maps URLs API, que és la pública i la que Google
 * promet mantenir:
 *
 *     /maps/@?api=1&map_action=pano&viewpoint=LAT,LON&heading=H&pitch=P
 *
 * I EL RUMB NO ES FEIA CAS. La fitxa deia 285,8° i la càmera s'obria mirant cap
 * a una altra banda. El motiu és que `viewpoint` no és una posició de càmera:
 * és una CERCA («troba'm un panorama a prop d'aquí»), i la documentació mateixa
 * de Google diu què fa llavors amb l'orientació:
 *
 *     «a default heading is chosen based on the viewpoint (if specified) of the
 *      query and the actual location of the image»
 *
 * O sigui que se'l calcula ell, del panorama cap al punt demanat, i el nostre
 * `heading` queda de decoració. Amb `api=1` només mana el rumb si en comptes de
 * `viewpoint` li dones un `pano=<ID>`, i aquest identificador només el dona
 * l'API de metadades: clau de Google, compte de Cloud amb facturació activada i
 * una tercera destinació per a la coordenada de l'usuari. Massa peatge per
 * arreglar un paràmetre.
 *
 * Per això es fa servir el format INTERN del client web, que sí que obeeix:
 *
 *     /maps/@LAT,LON,3a,90y,285.8h,94.5t/data=!3m1!1e1
 *
 * La gramàtica és posicional i no de paràmetres amb nom: `3a` és el mode Street
 * View, `90y` el camp de visió en graus, `…h` el rumb i `…t` la inclinació.
 *
 * AIXÒ NO ÉS API PÚBLICA i es pot trencar sense avisar ni versionar. Si un dia
 * deixa d'obrir Street View, la sortida ja està estudiada: `pano=<ID>` amb
 * `api=1`, alimentat per la Street View Image Metadata API — que és gratuïta i
 * il·limitada (SKU «Street View Metadata», 3168-48A9-5C8C) i té CORS obert
 * (`access-control-allow-origin: *`, comprovat amb `curl`), però demana la clau
 * i la facturació de sobre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * `t` NO ÉS EL `pitch`: ÉS `90 − pitch`. AIXÒ VA COSTAR DE VEURE, DUES VEGADES.
 *
 * La URL de testimoni d'on surt la conversió, tal com la genera Google:
 *
 *     https://www.google.com/maps/@40.869752,0.7936051,3a,90y,254.17h,100.54t/
 *     data=!3m7!1e1!3m5!1skjY91FrVNP4tm4tFHvnxBg!2e0!6shttps:%2F%2Fstreetview
 *     pixels-pa.clients6.google.com%2Fv1%2Fthumbnail%3F…%26pitch%3D-10.5384428
 *     02941603%26panoid%3DkjY91FrVNP4tm4tFHvnxBg%26yaw%3D254.16605595349938…
 *
 * Porta `100.54t` i, dins del seu propi blob, `pitch=-10.538442802941603`.
 * 90 − (−10,54) = 100,54: la inclinació d'aquest format es compta des de
 * mirar amunt del tot (0 = zenit, 90 = horitzó, 180 = als peus).
 *
 * LA PRIMERA VERSIÓ D'AQUEST FITXER TENIA `pitch + 90`. Amb aquesta mateixa
 * URL de testimoni la prova passava, perquè el test hi havia copiat el
 * `10,54` sense el signe menys: 90 + 10,54 dona el mateix 100,54 que
 * 90 − (−10,54), i amb un sol exemple negatiu els dos formats semblen
 * idèntics. Es va destapar comparant-ho amb una segona URL real amb el pitch
 * en positiu (19,32° → `70.68t`, mai `109.32t`): `pitch + 90` només encertava
 * quan el pitch d'entrada era negatiu. Amb el Sol per SOBRE l'horitzó —el cas
 * normal d'aquesta app— la versió vella girava la càmera cap avall, exactament
 * l'error de «mirar cap a l'asfalt» que ja s'havia pagat abans, però per la
 * banda contrària del signe.
 *
 * SI ALGÚ TORNA A ESCRIURE `pitch + 90`, la prova «la inclinació es compta des
 * del zenit» l'ha d'aturar: comprova un pitch positiu i un de negatiu, no
 * només el de la URL de testimoni.
 *
 * PER QUÈ LA CÀMERA VA INCLINADA I NO PLANA. Amb la inclinació a l'horitzó
 * s'obre mirant al pla, que és el que ja se suposa. El que decideix és el tros
 * de cel on hi haurà el Sol: el 12 d'agost del 2026, a la franja peninsular, el
 * Sol és baix —de l'ordre de 5° a 10°— i just per això el que el pot tapar és
 * qualsevol cosa. Per tant la inclinació surt de l'altura APARENT del Sol al
 * màxim, la mateixa que dibuixa `renderTrajectory` i que fa servir
 * `useCloudOutlook`: l'aparent, i no la geomètrica, perquè és la que es veu.
 *
 * QUE NO SEMPRE HI HAURÀ FOTOS. Google troba el panorama més proper al punt i,
 * si no n'hi ha cap a la vora, ensenya un panell buit. Passarà sovint, perquè
 * els llocs bons d'aquesta app són ports de muntanya, pistes i cims —i el mar
 * no hi és mai. Comprovar-ho abans voldria dir l'API de metadades, amb tot el
 * peatge de sobre. Així que no es comprova, no s'amaga l'enllaç, i es diu a la
 * nota. Val més un enllaç honest que de tant en tant no ensenya res que una
 * comprovació que costa un compte de Google.
 */

/**
 * Camp de visió, en graus, del tros `…y`.
 *
 * 90 és el valor per defecte que ja teníem amb `api=1` i el mateix que porta la
 * URL de testimoni: canviar-lo aquí canviaria l'enquadrament de tots els
 * enllaços alhora, i no hi ha cap motiu per fer-ho.
 */
const FIELD_OF_VIEW_DEG = 90;

/**
 * El tros `3a` de la URL, allà on una URL de mapa pla porta un zoom
 * (`@LAT,LON,15z`). És literal i fix: diu «interpreta el que ve després com
 * una càmera de Street View», no un valor que canviï amb la ubicació ni amb
 * el rumb. Cap URL de Street View en porta un altre.
 */
const STREET_VIEW_POSITION_MARKER = '3a';

/**
 * El sufix `data=` que fa que la mateixa coordenada obri el panorama i no un
 * mapa pla amb una xinxeta. `3m1` és «camp 3, missatge amb 1 subcamp»; `1e1`
 * és, dins d'aquell missatge, «camp 1, enum amb valor 1», que es correspon
 * amb la capa Street View. No és API documentada —és el mateix
 * reverse-engineering que `tiltFromPitch`— però surt idèntic a qualsevol URL
 * de Street View que generi Google mateix.
 */
const STREET_VIEW_DATA_SUFFIX = 'data=!3m1!1e1';

/**
 * De la inclinació que fa servir l'app a la que escriu el format de Google.
 *
 * `pitchDeg` és des de l'horitzó i amunt (el que diu la fitxa: «altura del
 * Sol»); el tros `…t` és des del zenit i avall. Vegeu la URL de testimoni de la
 * capçalera.
 */
function tiltFromPitch(pitchDeg: number): number {
  return 90 - pitchDeg;
}

/**
 * URL de Street View per a un punt, ja orientada.
 *
 * `null` quan alguna xifra no és finita: el component no pinta l'enllaç en
 * comptes de fabricar una adreça amb `NaN` a dins.
 *
 * No demana cap clau ni cap script de tercers: és una adreça i prou, i només
 * viatja si algú la pica.
 */
export function streetViewUrl(
  lat: number,
  lon: number,
  headingDeg: number,
  pitchDeg: number,
): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(headingDeg)) {
    return null;
  }

  /*
   * CINC DECIMALS, els mateixos que `coordsForCopy()` i `mapUrl()`. Són uns
   * 1,1 m a la nostra latitud: prou per clavar el panorama del carrer i prou
   * poc per no fingir una precisió que la ubicació de l'usuari no té. La URL de
   * testimoni de Google en porta set; no els copiem, perquè la precisió que
   * publiquem és la que la ubicació té i no la que un `number` permet escriure.
   */
  const place = `${lat.toFixed(5)},${lon.toFixed(5)}`;

  // La resta de l'app parla en [0, 360): que l'URL porti el MATEIX número que
  // la fitxa imprimeix és el que fa que es pugui comparar d'una llambregada
  // quan alguna cosa no quadri.
  const heading = ((headingDeg % 360) + 360) % 360;

  // Es retalla ABANS de convertir, perquè el rang de sortida ([0, 180]) surti
  // garantit d'un rang d'entrada garantit. El Sol pot sortir sota l'horitzó al
  // màxim (punts d'aquest catàleg on cau fora de la sortida del Sol), i una
  // entrada no finita no ha d'invalidar tot l'enllaç: el rumb, que és el que
  // decideix, segueix essent bo i la càmera es queda a l'horitzó.
  const pitch = Number.isFinite(pitchDeg) ? Math.min(90, Math.max(-90, pitchDeg)) : 0;
  const tilt = tiltFromPitch(pitch);

  const camera = [
    place,
    STREET_VIEW_POSITION_MARKER,
    `${FIELD_OF_VIEW_DEG}y`,
    `${heading.toFixed(1)}h`,
    `${tilt.toFixed(1)}t`,
  ].join(',');

  return `https://www.google.com/maps/@${camera}/${STREET_VIEW_DATA_SUFFIX}`;
}
