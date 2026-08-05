/**
 * Proves de l'enllaç que porta el punt.
 *
 * QUÈ ES PROVA AQUÍ, EN UNA FRASE: que res del que arriba per l'URL pugui
 * entrar a l'app sense passar per la porta. L'URL és el canal menys de confiança
 * que té aquesta app —el `localStorage` almenys l'ha escrit una versió nostra;
 * una adreça l'escriu qualsevol i la retallen els clients de correu pel mig—, i
 * el que hi ha darrere d'aquesta funció és el càlcul d'efemèrides, que amb un
 * `NaN` no peta: segueix endavant i escup una hora de contacte invàlida a una
 * pantalla que és molt lluny d'aquí.
 *
 * LES DUES COSES QUE HAN DE SER CERTES SEMPRE:
 *
 *  1. Un enllaç dolent no dona MAI un punt. Ni a mitges, ni al golf de Guinea
 *     per haver llegit una cadena buida com un zero.
 *  2. Un enllaç bo dona EXACTAMENT el punt que s'hi va posar. Si l'anada i la
 *     tornada no coincideixen, la persona que ha rebut l'enllaç està mirant les
 *     xifres d'un altre lloc sense saber-ho, que és justament el que tota
 *     aquesta app existeix per evitar.
 */

import { describe, expect, it } from 'vitest';
import { ECLIPSES } from '../../core/eclipses/catalog';
import { buildShareLink, buildShareUrl, MAX_LABEL_CHARS, parseShareLink } from './link';

describe('URL compartida completa', () => {
  it('conserva l’idioma i la vista actual del mapa', () => {
    expect(
      buildShareUrl(
        { lat: 42, lon: 1, eclipseId: '2026-08-12' },
        'https://eclipsi.info/es/?vell=1#/mapa/llocs',
      ),
    ).toBe('https://eclipsi.info/es/?p=42,1&e=2026-08-12#/mapa/llocs');
  });
});

describe('llegir un enllaç bo', () => {
  it('en treu el punt, l’eclipsi i el nom', () => {
    const link = parseShareLink('?p=42.12345,1.56789&e=2026-08-12&n=Coll%20de%20Narg%C3%B3');
    expect(link).toEqual({
      lat: 42.12345,
      lon: 1.56789,
      eclipseId: '2026-08-12',
      label: 'Coll de Nargó',
    });
  });

  it('el `?` del davant és opcional', () => {
    // Qui crida hi passa el `location.search`, que en porta; però un enllaç
    // escrit a mà a un test o a una consola sovint no. Que la funció n'exigís un
    // seria una trampa per a qui la faci servir demà.
    expect(parseShareLink('p=42.5,1.5')?.lat).toBe(42.5);
  });

  it('només amb el punt també val: `e` i `n` són opcionals', () => {
    expect(parseShareLink('?p=42.5,-1.5')).toEqual({
      lat: 42.5,
      lon: -1.5,
      eclipseId: null,
      label: null,
    });
  });

  it('l’ordre dels paràmetres no importa i els que no coneixem no molesten', () => {
    // Els enllaços passen per escurçadors, per xarxes socials i per clients de
    // correu, i tots hi enganxen paràmetres de seguiment. Un `utm_source` no pot
    // fer perdre el punt.
    const link = parseShareLink('?utm_source=whatsapp&e=2027-08-02&p=36.5,-6.3&fbclid=x');
    expect(link?.lat).toBe(36.5);
    expect(link?.eclipseId).toBe('2027-08-02');
  });
});

describe('el zero negatiu', () => {
  /*
   * AQUEST BUG JA HA MOSSEGAT DUES VEGADES EN AQUEST PROJECTE i l'URL és el camí
   * més curt per tornar-lo a introduir: `?p=-0,-0` és un text que qualsevol pot
   * escriure. `-0 === 0` és cert i es pinta com a «0», o sigui que no es veu
   * enlloc fins que algú el fa servir per fabricar una clau:
   * `(-0).toFixed(3)` dona `'-0.000'` i `(0).toFixed(3)` dona `'0.000'`, que són
   * dues entrades diferents de la mateixa cel·la. `core/places/cache.ts` va
   * haver d'afegir-hi `snapCoordinate` per això, i `offline/store.ts` encara
   * fa servir `${lat.toFixed(3)},${lon.toFixed(3)}` com a clau d'IndexedDB.
   *
   * `toBe` no serveix per provar-ho, perquè `expect(-0).toBe(0)` passa. Cal
   * `Object.is`, que és l'única comparació que els distingeix.
   */

  it('un `-0` de l’URL entra com a `0` net', () => {
    const link = parseShareLink('?p=-0,-0');
    expect(Object.is(link?.lat, 0)).toBe(true);
    expect(Object.is(link?.lon, 0)).toBe(true);
  });

  it('una longitud que s’arrodoneix a zero per negatiu, també', () => {
    // Un punt a 0,0000004° oest de Greenwich. Arrodonit als cinc decimals de
    // l'enllaç és zero, i el signe s'hi enganxaria si no es netegés.
    expect(Object.is(parseShareLink('?p=51.4,-0.0000004')?.lon, 0)).toBe(true);
  });

  it('i no se’n fabrica cap en escriure’l', () => {
    // L'altra banda de la mateixa porta: si l'enllaç sortís amb `p=-0,-0`, el
    // `-0` viatjaria fins al dispositiu de qui el rep.
    expect(buildShareLink({ lat: -0, lon: -0 })).toBe('?p=0,0');
  });
});

describe('coordenades que no poden ser', () => {
  it('una latitud de fora del planeta es rebutja sencera', () => {
    // No s'arrodoneix ni es retalla a 90: una latitud de 91 no és un punt amb
    // un error petit, és un enllaç trencat. Retallar-lo posaria l'usuari al pol
    // nord sense dir-l'hi.
    expect(parseShareLink('?p=90.1,2')).toBeNull();
    expect(parseShareLink('?p=-91,2')).toBeNull();
    expect(parseShareLink('?p=1000,2')).toBeNull();
  });

  it('una longitud de fora, igual', () => {
    expect(parseShareLink('?p=42,180.0001')).toBeNull();
    expect(parseShareLink('?p=42,-181')).toBeNull();
  });

  it('els pols i l’antimeridià SÍ que són llocs', () => {
    // El límit s'inclou. ±180 és l'antimeridià i ±90 són els pols: existeixen,
    // i un `>=` per error hi deixaria l'app sense poder arribar.
    expect(parseShareLink('?p=90,180')).toMatchObject({ lat: 90, lon: 180 });
    expect(parseShareLink('?p=-90,-180')).toMatchObject({ lat: -90, lon: -180 });
  });

  it('el que no és un número no s’endevina', () => {
    expect(parseShareLink('?p=hola,2')).toBeNull();
    expect(parseShareLink('?p=42,NaN')).toBeNull();
    expect(parseShareLink('?p=Infinity,0')).toBeNull();
    // `Number('0x1f')` és 31 i `Number('1e400')` és infinit. El format el
    // generem nosaltres i sempre és un decimal pla: acceptar res més és obrir
    // portes que no calen.
    expect(parseShareLink('?p=0x1f,2')).toBeNull();
    expect(parseShareLink('?p=1e2,2')).toBeNull();
  });

  it('mig punt no és un punt', () => {
    // El cas de l'enllaç retallat pel client de correu. Amb `lat` i `lon` per
    // separat aquí hi hauria una decisió a prendre; amb un sol paràmetre, no.
    expect(parseShareLink('?p=42.5')).toBeNull();
    expect(parseShareLink('?p=42.5,1.5,300')).toBeNull();
  });

  it('una cadena buida al lloc del número no és un zero', () => {
    // EL CAS QUE HO JUSTIFICA TOT: `Number('')` és 0. Sense la validació
    // estricta, un `?p=,` —el que queda d'un enllaç copiat a mitges— seria un
    // punt perfectament vàlid al golf de Guinea, i l'app s'hi posaria a calcular
    // hores de contacte com si res.
    expect(parseShareLink('?p=,')).toBeNull();
    expect(parseShareLink('?p=42,')).toBeNull();
    expect(parseShareLink('?p=,2')).toBeNull();
    expect(parseShareLink('?p=')).toBeNull();
  });
});

describe('enllaços sense punt', () => {
  it('la cadena buida no és cap enllaç', () => {
    // És el cas normal: obrir l'app pel seu compte. No pot ser un error, ha de
    // ser un `null` tranquil.
    expect(parseShareLink('')).toBeNull();
    expect(parseShareLink('?')).toBeNull();
  });

  it('paràmetres que no diuen res tampoc', () => {
    expect(parseShareLink('?foo=bar')).toBeNull();
    expect(parseShareLink('?lat=42&lon=1')).toBeNull();
  });

  it('un eclipsi i un nom sense punt no serveixen de res', () => {
    // Un nom de lloc que no sabem on és no es pot pintar, i canviar d'eclipsi
    // sense canviar de lloc no és compartir res.
    expect(parseShareLink('?e=2026-08-12&n=Burgos')).toBeNull();
  });
});

describe('l’eclipsi', () => {
  it('els tres del catàleg es reconeixen', () => {
    for (const entry of ECLIPSES) {
      expect(parseShareLink(`?p=42,1&e=${entry.id}`)?.eclipseId).toBe(entry.id);
    }
  });

  it('un que no és del catàleg es descarta però el punt es queda', () => {
    // ÉS LA REGLA IMPORTANT D'AQUEST FITXER. Un enllaç d'una versió futura amb
    // un eclipsi que aquesta encara no té no pot fer perdre el lloc, que és el
    // que val. I passar-lo endavant seria pitjor que descartar-lo: `getEclipse`
    // llança amb un id desconegut i el que hi ha darrere és tota la pantalla.
    const link = parseShareLink('?p=42.5,1.5&e=2099-01-01');
    expect(link?.eclipseId).toBeNull();
    expect(link?.lat).toBe(42.5);
  });

  it('i tampoc se’n fabrica cap d’inventat en escriure', () => {
    expect(buildShareLink({ lat: 42, lon: 1, eclipseId: '2099-01-01' })).toBe('?p=42,1');
  });
});

describe('el nom del lloc', () => {
  it('viatja amb l’enllaç perquè al cim no hi ha xarxa', () => {
    // Qui obre l'enllaç dalt d'un port de muntanya no pot resoldre el topònim.
    // Si el nom no viatgés, la barra diria unes coordenades on hauria de dir
    // «Coll de Nargó».
    expect(parseShareLink('?p=42,1&n=Coll+de+Narg%C3%B3')?.label).toBe('Coll de Nargó');
  });

  it('un nom buit és «cap nom» i no una cadena buida', () => {
    // `?n=` és el que queda quan es comparteix un punt del mapa que encara no
    // tenia nom. `placeTitle` mira `label !== ''` justament per això: una
    // etiqueta buida deixaria la barra de la ubicació sense res.
    expect(parseShareLink('?p=42,1&n=')?.label).toBeNull();
    expect(parseShareLink('?p=42,1&n=%20%20')?.label).toBeNull();
  });

  it('un nom desmesurat es retalla, no fa perdre el punt', () => {
    const link = parseShareLink(`?p=42,1&n=${'A'.repeat(500)}`);
    expect(link?.label).toHaveLength(MAX_LABEL_CHARS);
    expect(link?.lat).toBe(42);
  });

  it('en escriure, també es retalla', () => {
    const built = buildShareLink({ lat: 42, lon: 1, label: 'B'.repeat(500) });
    expect(parseShareLink(built)?.label).toHaveLength(MAX_LABEL_CHARS);
  });
});

describe('escriure un enllaç', () => {
  it('surt el format documentat, llegible per una persona', () => {
    // Aquest text s'enganxa dins d'un missatge i el llegeix algú abans de
    // tocar-lo. `URLSearchParams.toString()` escriuria
    // `p=42.12345%2C1.56789&n=Coll+de+Narg%C3%B3`, que és igual de correcte i
    // molt pitjor de llegir.
    expect(
      buildShareLink({ lat: 42.12345, lon: 1.56789, eclipseId: '2026-08-12', label: 'Coll de Nargó' }),
    ).toBe('?p=42.12345,1.56789&e=2026-08-12&n=Coll%20de%20Narg%C3%B3');
  });

  it('els zeros de la cua no hi són', () => {
    // `toFixed(5)` de 42,1 dona «42.10000». Quatre caràcters que no diuen res,
    // dos cops per enllaç, en un text que molts clients trenquen per llargada.
    expect(buildShareLink({ lat: 42.1, lon: -1 })).toBe('?p=42.1,-1');
  });

  it('s’arrodoneix a cinc decimals, que és un metre', () => {
    // Cinc decimals de latitud són 1,1 m: dos ordres de magnitud per sota de
    // `SAME_PLACE_M` (150 m), o sigui que l'arrodoniment no pot canviar cap
    // veredicte. Els decimals de més són mentida i ocupen.
    expect(buildShareLink({ lat: 42.123456789, lon: 1.987654321 })).toBe(
      '?p=42.12346,1.98765',
    );
  });
});

describe('anada i tornada', () => {
  /*
   * LA PROVA QUE HO SOSTÉ TOT. Si el que s'escriu i el que es llegeix no
   * coincideixen exactament, qui rep l'enllaç mira les xifres d'un altre lloc
   * sense que res ho digui — i cinc quilòmetres canvien el veredicte.
   */

  const CASES: { lat: number; lon: number; what: string }[] = [
    { lat: 43.3619, lon: -5.8494, what: 'la línia central a Astúries' },
    { lat: 42.3439, lon: -3.6969, what: 'Burgos' },
    { lat: 40.4168, lon: 3.7038, what: 'una longitud est' },
    { lat: 0, lon: 0, what: 'l’illa Nul' },
    { lat: -33.8688, lon: 151.2093, what: 'l’hemisferi sud' },
    { lat: 90, lon: 180, what: 'el pol nord a l’antimeridià' },
    { lat: -90, lon: -180, what: 'el pol sud a l’altra banda' },
  ];

  for (const { lat, lon, what } of CASES) {
    it(`el punt torna igual: ${what}`, () => {
      const back = parseShareLink(buildShareLink({ lat, lon }));
      expect(back?.lat).toBe(lat);
      expect(back?.lon).toBe(lon);
    });
  }

  it('amb l’eclipsi i el nom, tot torna igual', () => {
    const built = buildShareLink({
      lat: 42.3439,
      lon: -3.6969,
      eclipseId: '2028-01-26',
      label: 'Burgos',
    });
    expect(parseShareLink(built)).toEqual({
      lat: 42.3439,
      lon: -3.6969,
      eclipseId: '2028-01-26',
      label: 'Burgos',
    });
  });

  it('un nom amb accents, apòstrofs i «&» sobreviu al viatge', () => {
    // Els topònims d'aquí en van plens («L’Hospitalet», «Sant Julià») i el `&`
    // és el separador de l'URL: sense escapar-lo partiria l'enllaç en dos.
    const label = 'L’Hospitalet & Sant Julià';
    const back = parseShareLink(buildShareLink({ lat: 41.36, lon: 2.1, label }));
    expect(back?.label).toBe(label);
    expect(back?.lat).toBe(41.36);
  });
});
