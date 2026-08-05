import { describe, expect, it } from 'vitest';
import {
  buildReadableShareUrl,
  findReadablePlace,
  readablePlacePath,
  readableSlug,
  resolveReadablePlacePath,
} from './readable';

describe('slugs llegibles', () => {
  it('normalitza accents, puntuació i espais', () => {
    expect(readableSlug('  Castelló de la Plana  ')).toBe('castello-de-la-plana');
  });

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

  it('usa el slug traduït', () => {
    const place = findReadablePlace({ lat: 41.3874, lon: 2.16857 });
    expect(place).not.toBeNull();
    expect(readablePlacePath(place!, 'fr', '2026-08-12')).toBe('/fr/ville/barcelona/12-08-2026/');
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

describe('resolució de pathname', () => {
  it('resol els quatre segments localitzats', () => {
    expect(resolveReadablePlacePath('/ciutat/zaragoza/12-08-2026/')?.place.id).toBe('zaragoza');
    expect(resolveReadablePlacePath('/es/ciudad/zaragoza/12-08-2026')?.place.id).toBe('zaragoza');
    expect(resolveReadablePlacePath('/en/city/zaragoza/12-08-2026/')?.locale).toBe('en');
    expect(resolveReadablePlacePath('/fr/ville/zaragoza/12-08-2026/')?.locale).toBe('fr');
    // Compatibilitat durant la migració dels primers enllaços publicats.
    expect(resolveReadablePlacePath('/ciutat/zaragoza/2026-08-12/')?.place.id).toBe('zaragoza');
  });

  it('rebutja segments i slugs desconeguts', () => {
    expect(resolveReadablePlacePath('/es/ciutat/zaragoza/2026-08-12/')).toBeNull();
    expect(resolveReadablePlacePath('/es/ciudad/inventat/2026-08-12/')).toBeNull();
  });
});
