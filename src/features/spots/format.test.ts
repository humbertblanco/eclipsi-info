/**
 * Proves del text de les xifres.
 *
 * Semblen proves de cosmètica i no ho són: aquí es comprova que l'aplicació no
 * arrodoneixi el que sap. Una totalitat de 101 segons s'ha de dir «1:41» i no
 * «un minut i mig», i una distància de 460 m s'ha de dir en metres i no en
 * «0,5 km», perquè la primera es camina i la segona sona a full de càlcul.
 */

import { describe, expect, it } from 'vitest';
import { compassName } from '../../core/spots/grid';
import {
  NBSP,
  bearingPhrase,
  durationText,
  formatBytes,
  formatPercent,
  formatClock,
  formatCoords,
  formatCount,
  formatDegrees,
  formatDistance,
  formatDuration,
  formatMetres,
  formatMs,
  formatRatio,
  mapUrl,
} from './format';

describe('durades', () => {
  it('per sota del minut es diuen en segons sols', () => {
    expect(formatDuration(41)).toEqual({ value: '41', unit: 's' });
    expect(formatDuration(59.4)).toEqual({ value: '59', unit: 's' });
  });

  it('a partir del minut es diuen en m:ss', () => {
    expect(formatDuration(101.4)).toEqual({ value: '1:41', unit: 'min' });
    expect(formatDuration(60)).toEqual({ value: '1:00', unit: 'min' });
    expect(formatDuration(386.7)).toEqual({ value: '6:27', unit: 'min' });
  });

  it('els segons van amb dos dígits, o «1:5» seria un minut i cinc dècimes', () => {
    expect(formatDuration(65).value).toBe('1:05');
  });

  it('zero i les entrades impossibles no inventen res', () => {
    expect(formatDuration(0)).toEqual({ value: '0', unit: 's' });
    expect(formatDuration(-3)).toEqual({ value: '0', unit: 's' });
    expect(formatDuration(Number.NaN)).toEqual({ value: '0', unit: 's' });
  });

  it('dins d’una frase van amb la unitat enganxada per un espai dur', () => {
    expect(durationText(101.4)).toBe(`1:41${NBSP}min`);
    expect(durationText(12)).toBe(`12${NBSP}s`);
    // L'espai dur és deliberat: la xifra i la unitat no se separen mai de línia.
    expect(durationText(12)).not.toContain(' ');
  });
});

describe('rumbs', () => {
  it('l’article s’apostrofa davant de vocal', () => {
    // Set dels setze rumbs comencen per vocal. Un «cap al oest» a la primera
    // targeta de la llista es carrega la credibilitat de tots els números que
    // hi ha a sota.
    expect(bearingPhrase(0)).toBe('cap al nord');
    expect(bearingPhrase(45)).toBe('cap al nord-est');
    expect(bearingPhrase(90)).toBe('cap a l’est');
    expect(bearingPhrase(270)).toBe('cap a l’oest');
    expect(bearingPhrase(283.5)).toBe('cap a l’oest-nord-oest');
    expect(bearingPhrase(225)).toBe('cap al sud-oest');
    expect(bearingPhrase(247.5)).toBe('cap a l’oest-sud-oest');
  });

  it('cap dels setze rumbs no queda mal escrit', () => {
    for (let deg = 0; deg < 360; deg += 22.5) {
      const frase = bearingPhrase(deg);
      expect(frase.startsWith('cap al ') || frase.startsWith('cap a l’')).toBe(true);
      expect(frase).not.toMatch(/cap al [aeiou]/);
    }
  });

  /*
   * EL CASTELLÀ NO ÉS UN AFEGIT COSMÈTIC: aquest cercador es va escriure sencer
   * en català perquè no es muntava enlloc. En muntar-lo, una sola frase
   * catalana a la llista de qui té l'app en castellà és el mateix defecte que
   * ja ha calgut arreglar amb el veredicte, amb el guió de la totalitat i amb
   * la zona de la realitat augmentada.
   */
  it('en castellà l’article no s’apostrofa mai', () => {
    expect(bearingPhrase(0, 'es')).toBe('hacia el norte');
    expect(bearingPhrase(90, 'es')).toBe('hacia el este');
    expect(bearingPhrase(270, 'es')).toBe('hacia el oeste');
    expect(bearingPhrase(283.5, 'es')).toBe('hacia el oeste-noroeste');
  });

  it('la rosa castellana té els setze rumbs i cap d’ells no és el català', () => {
    const ca = new Set<string>();
    for (let deg = 0; deg < 360; deg += 22.5) {
      ca.add(compassName(deg, 'ca'));
      const es = compassName(deg, 'es');
      expect(es.length).toBeGreaterThan(0);
      // Si una entrada de la taula castellana s'oblidés, `undefined` petaria
      // aquí; si es copiés del català, ho cacem amb la comparació de sota.
      expect(es).not.toBe(compassName(deg, 'ca'));
    }
    expect(ca.size).toBe(16);
  });

  it('el rumb per defecte segueix essent el català', () => {
    // Hi ha crides antigues sense idioma i han de continuar dient el mateix.
    expect(compassName(45)).toBe(compassName(45, 'ca'));
  });
});

describe('graus', () => {
  it('una dècima, que és la precisió honesta d’un horitzó', () => {
    expect(formatDegrees(6.28)).toBe('6,3°');
    expect(formatDegrees(0)).toBe('0,0°');
  });

  it('el signe negatiu no s’amaga: vol dir que el terreny guanya', () => {
    expect(formatDegrees(-0.23)).toContain('0,2');
    expect(formatDegrees(-0.23).startsWith('0')).toBe(false);
  });

  it('el que no és un número es diu amb una ratlla, no amb un zero', () => {
    expect(formatDegrees(Number.NaN)).toBe('—');
  });
});

describe('distàncies', () => {
  it('per sota del quilòmetre, metres arrodonits a la desena', () => {
    expect(formatDistance(0.456)).toBe(`460${NBSP}m`);
    expect(formatDistance(0.4)).toBe(`400${NBSP}m`);
  });

  it('per sota dels deu quilòmetres, una dècima', () => {
    expect(formatDistance(5.72)).toBe(`5,7${NBSP}km`);
  });

  it('per damunt, quilòmetres sencers: la dècima ja no informa de res', () => {
    expect(formatDistance(23.7)).toBe(`24${NBSP}km`);
  });

  it('les cotes són sempre enteres, que és el que sap el model', () => {
    expect(formatMetres(1083.4)).toBe(`1.083${NBSP}m`);
    expect(formatMetres(0)).toBe(`0${NBSP}m`);
  });
});

describe('coordenades i mapa', () => {
  it('cinc decimals, que és un metre', () => {
    // Retallar-ne un mouria el punt onze metres. En una carena, onze metres és
    // la diferència entre veure-ho i no veure-ho.
    expect(formatCoords(41.766498, -2.479004)).toBe('41.76650, -2.47900');
  });

  it('l’enllaç del mapa porta el punt marcat', () => {
    const url = mapUrl(41.7665, -2.479);
    expect(url).toContain('mlat=41.76650');
    expect(url).toContain('mlon=-2.47900');
    expect(url.startsWith('https://www.openstreetmap.org/')).toBe(true);
  });
});

describe('rellotge', () => {
  it('porta els segons: en aquesta aplicació els segons són tot el tema', () => {
    const text = formatClock(Date.UTC(2026, 7, 12, 18, 31, 5));
    expect(text).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('sense instant, ratlla', () => {
    expect(formatClock(Number.NaN)).toBe('—');
  });
});

describe('comptadors del cost', () => {
  it('els milers van separats', () => {
    expect(formatCount(87885)).toBe('87.885');
  });

  it('el guany de l’embut es diu en vegades i no en percentatge', () => {
    // «1.373 vegades menys» s'entén d'una llambregada; «un 99,93 % menys», no.
    expect(formatRatio(64, 87885)).toBe('1.373×');
    expect(formatRatio(10, 25)).toBe('2,5×');
  });

  it('una divisió impossible no torna Infinity a la pantalla', () => {
    expect(formatRatio(0, 100)).toBe('—');
    expect(formatRatio(10, Number.NaN)).toBe('—');
  });

  it('els temps petits es diuen en mil·lisegons i els llargs en segons', () => {
    expect(formatMs(96)).toBe(`96${NBSP}ms`);
    expect(formatMs(6060)).toBe(`6,1${NBSP}s`);
  });

  it('els bytes van amb coma decimal, com la resta de xifres de l’app', () => {
    // Un «10.1 GB» al costat d'un «5,7 km» delata un `toFixed` i trenca la
    // confiança en tota la taula.
    expect(formatBytes(64 * 120 * 1024)).toBe(`7,5${NBSP}MB`);
    expect(formatBytes(87885 * 120 * 1024)).toBe(`10,1${NBSP}GB`);
    expect(formatBytes(Number.NaN)).toBe('—');
  });

  it('el percentatge porta l’espai fi abans del signe', () => {
    expect(formatPercent(0.97)).toBe(`97${NBSP}%`);
    expect(formatPercent(1)).toBe(`100${NBSP}%`);
  });
});
