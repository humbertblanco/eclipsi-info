/**
 * L'ADREÇA QUE ES COMPARTEIX, CONTRA LA DECISIÓ QUE DIU EL MÒDUL.
 *
 * Aquest fitxer tenia una prova que es deia «usa el slug traduït» i que
 * comprovava que `readablePlacePath(barcelona, 'fr')` fos
 * `/fr/ville/barcelona/…`. Passava per casualitat: el nom francès de Barcelona
 * és «Barcelone», i si el camí fes servir el topònim traduït hauria sortit
 * `barcelone`. El que hi ha al camí és l'id, que val `barcelona`, i per a
 * aquella ciutat les dues coses s'assemblen prou perquè ningú no ho notés.
 *
 * Les proves d'aquesta mena són pitjor que no tenir-ne: diuen que vigilen una
 * decisió i el que vigilen és una coincidència.
 *
 * Ara es prova amb els dos casos on l'id i el topònim traduït NO s'assemblen
 * gens —A Coruña / «La Corogne» i Saragossa / «Saragosse»—, de manera que la
 * prova només pot passar si el camí es construeix de debò amb l'id.
 */
import { describe, expect, it } from 'vitest';
import { buildReadableShareUrl, findReadablePlace, readablePlacePath } from './readable';

describe('adreces llegibles', () => {
  it('localitza la ciutat sense perdre la coordenada exacta compartida', () => {
    const url = buildReadableShareUrl(
      { lat: 41.118881, lon: 1.244491, eclipseId: '2026-08-12', label: 'Tarragona' },
      'https://eclipsi.info/es/#/compte',
      'es',
    );
    expect(url).toBe(
      'https://eclipsi.info/es/ciudad/tarragona/12-08-2026/?p=41.11888,1.24449&e=2026-08-12&n=Tarragona#/compte',
    );
  });

  it('el camí porta l’id estable i no el topònim traduït', () => {
    // A Coruña en francès és «La Corogne»: si el camí fes servir el topònim,
    // aquí sortiria `la-corogne` i la prova cauria. És justament el cas que la
    // versió anterior d'aquesta prova no mirava.
    const coruna = findReadablePlace({ lat: 43.3623, lon: -8.4115 });
    expect(coruna).not.toBeNull();
    expect(coruna!.label.fr).toBe('La Corogne');
    expect(readablePlacePath(coruna!, 'fr', '2026-08-12')).toBe(
      '/fr/ville/a-coruna/12-08-2026/',
    );

    // I el segon: Saragossa en francès és «Saragosse».
    const zaragoza = findReadablePlace({ lat: 41.6488, lon: -0.8891 });
    expect(zaragoza!.label.fr).toBe('Saragosse');
    expect(readablePlacePath(zaragoza!, 'fr', '2026-08-12')).toBe(
      '/fr/ville/zaragoza/12-08-2026/',
    );
  });

  it('el segment sí que es tradueix, i surt del mateix lloc que el generador', () => {
    // El que es tradueix és la MENA de pàgina, no el nom del lloc. Els quatre
    // segments han de coincidir amb els que escriu `build-seo-pages.ts`, i
    // coincideixen perquè tots dos criden `seoPath()`.
    const place = findReadablePlace({ lat: 41.3874, lon: 2.16857 })!;
    expect(readablePlacePath(place, 'ca', '2026-08-12')).toBe('/ciutat/barcelona/12-08-2026/');
    expect(readablePlacePath(place, 'es', '2026-08-12')).toBe('/es/ciudad/barcelona/12-08-2026/');
    expect(readablePlacePath(place, 'en', '2026-08-12')).toBe('/en/city/barcelona/12-08-2026/');
    expect(readablePlacePath(place, 'fr', '2026-08-12')).toBe('/fr/ville/barcelona/12-08-2026/');
  });

  it('manté l’URL compatible per a un punt lliure', () => {
    expect(
      buildReadableShareUrl(
        { lat: 42.12345, lon: 1.56789, eclipseId: '2026-08-12', label: 'El meu prat' },
        'https://eclipsi.info/en/#/mapa',
        'en',
      ),
    ).toBe(
      'https://eclipsi.info/en/?p=42.12345,1.56789&e=2026-08-12&n=El%20meu%20prat#/mapa',
    );
  });
});

describe('registre oficial', () => {
  it('reutilitza els punts oficials del catàleg i els lliga a l’eclipsi', () => {
    const place = findReadablePlace({
      lat: 43.135,
      lon: -5.63473,
      eclipseId: '2026-08-12',
    });
    expect(place).toMatchObject({
      kind: 'official',
      id: 'ast-aller-alto-de-coto-bello',
      eclipseId: '2026-08-12',
    });
    expect(readablePlacePath(place!, 'ca')).toBe('/punt-oficial/ast-aller-alto-de-coto-bello/12-08-2026/');
  });

  it('no atribueix el punt oficial a un altre eclipsi', () => {
    expect(
      findReadablePlace({ lat: 43.135, lon: -5.63473, eclipseId: '2027-08-02' }),
    ).toBeNull();
  });

  it('no converteix un nom arbitrari en identitat', () => {
    const place = findReadablePlace({
      lat: 10,
      lon: 10,
      label: 'Alto de Coto Bello',
      eclipseId: '2026-08-12',
    });
    expect(place).toBeNull();
  });
});
