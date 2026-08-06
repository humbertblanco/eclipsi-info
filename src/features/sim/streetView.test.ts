/**
 * Generació dels links de Google Street View
 *
 * Es prova amb un càlcul real de l'eclipsi, no amb dades inventades: així
 * el rumb i la inclinació de l'enllaç queden lligats a les mateixes xifres
 * que veu l'usuari a la fitxa del mapa, i qualsevol divergència es detecta.
 */

import { describe, expect, it } from 'vitest';
import { computeLocalCircumstances } from '../../core/astro/contacts';
import { streetViewUrl } from './streetView';

/**
 * Els trossos de la càmera, que al format intern de Google van al CAMÍ i no a
 * la consulta: `/maps/@LAT,LON,3a,90y,285.8h,94.5t/data=…`.
 *
 * Es llegeix amb una expressió i no partint per comes a pèl perquè la prova ha
 * de petar si algú canvia l'ORDRE dels trossos, que és el que dona sentit a
 * cadascun: aquí no hi ha noms de paràmetre que ho salvin.
 */
function camera(url: string): {
  place: string;
  fov: string;
  heading: string;
  tilt: string;
} {
  const match =
    /\/maps\/@(-?[\d.]+,-?[\d.]+),3a,([\d.]+)y,([\d.]+)h,([\d.]+)t\/data=/.exec(url);
  if (match === null) throw new Error(`l’URL no té la forma esperada: ${url}`);
  return { place: match[1], fov: match[2], heading: match[3], tilt: match[4] };
}

describe('l’enllaç de Street View', () => {
  it('mira cap on diu el motor que mirarà el Sol', () => {
    // Sòria, dins la franja: el mateix punt que fa servir la prova d'extrem a
    // extrem del temporitzador, per no inventar-ne un de nou.
    const location = { lat: 41.7665, lon: -2.479, elevation: 1063 };
    const circumstances = computeLocalCircumstances('2026-08-12', location);
    expect(circumstances.kind).toBe('total');

    const max = circumstances.contacts.max;
    const url = streetViewUrl(
      location.lat,
      location.lon,
      max.sun.azimuth,
      max.sun.altitudeApparent,
    );
    expect(url).not.toBeNull();

    const cam = camera(url!);
    // Les xifres del motor, no unes de semblants: si algú canvia el camp que
    // llegeix el component (l'altura geomètrica en lloc de l'aparent, posem
    // per cas), això peta.
    expect(cam.heading).toBe(max.sun.azimuth.toFixed(1));
    expect(cam.tilt).toBe((90 - max.sun.altitudeApparent).toFixed(1));
    expect(cam.place).toBe('41.76650,-2.47900');

    // I el rumb ha de ser el de ponent, que és on es pon el Sol el 12 d'agost
    // del 2026 a les 20.29: si sortís cap a llevant, el número seria d'un altre
    // moment i tota la resta d'aquesta prova seria decorativa.
    expect(max.sun.azimuth).toBeGreaterThan(270);
    expect(max.sun.azimuth).toBeLessThan(305);
  });

  it('la inclinació es compta des del zenit, no des de l’horitzó', () => {
    /*
     * ÉS LA PROVA QUE VIGILA ELS 90. Si algú torna a escriure `pitch + 90`
     * perquè sembla més senzill, aquesta prova l'ha d'aturar: comprova un
     * pitch negatiu I un de positiu, no només un dels dos, que és com es va
     * colar la primera vegada. El cas negatiu surt de la URL de testimoni de
     * la capçalera del mòdul: `100.54t` amb `pitch=-10.538…` a dins. El
     * positiu surt de la primera URL amb què es va provar tot això:
     * `70.68t` amb `pitch=19.32…`.
     */
    const tilt = (p: number) => camera(streetViewUrl(41.4, 2.1, 280, p)!).tilt;
    expect(tilt(0)).toBe('90.0'); // l'horitzó és el mig del recorregut
    expect(tilt(-10.54)).toBe('100.5'); // el cas de la URL de testimoni
    expect(tilt(19.32)).toBe('70.7'); // el cas de la primera URL provada
    expect(tilt(4.5)).toBe('85.5'); // mirant una mica amunt: cap al zenit
    expect(tilt(-4.5)).toBe('94.5'); // mirant una mica avall: cap als peus
  });

  it('el rumb sempre cau dins d’una volta sencera', () => {
    const h = (deg: number) => camera(streetViewUrl(41.4, 2.1, deg, 0)!).heading;
    expect(h(0)).toBe('0.0');
    expect(h(359.9)).toBe('359.9');
    expect(h(360)).toBe('0.0');
    expect(h(-90)).toBe('270.0');
    expect(h(725)).toBe('5.0');
  });

  it('la inclinació no surt mai del rang que el format admet', () => {
    // Retallat a ±90 abans de convertir: la sortida ha de caure dins de
    // [0, 180], del zenit als peus, passi el que passi a l'entrada. Un Sol a
    // +90° (al zenit) mira cap amunt del tot, per això dona 0 i no 180.
    const tilt = (p: number) => camera(streetViewUrl(41.4, 2.1, 280, p)!).tilt;
    expect(tilt(120)).toBe('0.0');
    expect(tilt(-120)).toBe('180.0');
  });

  it('una altura que no se sap no invalida el rumb, que és el que decideix', () => {
    // El marge sobre el terreny pot no estar calculat encara; el rumb del màxim
    // sempre hi és. Val més obrir mirant a l'horitzó que no obrir res.
    const cam = camera(streetViewUrl(41.4, 2.1, 280, Number.NaN)!);
    expect(cam.heading).toBe('280.0');
    expect(cam.tilt).toBe('90.0');
  });

  it('sense coordenada o sense rumb no es fabrica cap adreça', () => {
    expect(streetViewUrl(Number.NaN, 2.1, 280, 7)).toBeNull();
    expect(streetViewUrl(41.4, Number.NaN, 280, 7)).toBeNull();
    expect(streetViewUrl(41.4, 2.1, Number.NaN, 7)).toBeNull();
  });

  it('la coordenada s’escriu amb la precisió de la ubicació, no amb la del «number»', () => {
    // 1,1 m. Publicar els quinze decimals d'un float seria dir-li a Google que
    // sabem on és l'usuari amb precisió de nanòmetre.
    const cam = camera(streetViewUrl(41.386_412_345_678, 2.169_987_654_321, 280, 7)!);
    expect(cam.place).toBe('41.38641,2.16999');
  });

  it('demana Street View i no un mapa pla', () => {
    // Sense aquesta marca, la mateixa adreça obre el mapa i tota l'orientació
    // que hi hem posat no serveix de res.
    const url = streetViewUrl(41.4, 2.1, 280, 7)!;
    expect(url).toContain('/data=!3m1!1e1');
    expect(camera(url).fov).toBe('90');
  });
});
