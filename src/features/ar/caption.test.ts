/**
 * CAP FOTO QUE SURTI D'AQUÍ POT DUR LA UBICACIÓ DE NINGÚ CREMADA A SOBRE.
 *
 * Aquesta prova no comprova que el peu digui una frase concreta: comprova la
 * PROPIETAT, que és que allà dins no hi hagi mai una coordenada. Escrita al
 * revés —esperant una cadena literal— passaria a ser una prova del text i
 * deixaria entrar qualsevol recanvi numèric nou que algú hi posés amb un altre
 * format.
 *
 * EL PATRÓ VA HAVER DE SER MÉS FI DEL QUE SEMBLAVA, i val la pena que consti:
 * la primera versió buscava qualsevol nombre amb decimals i es menjava l'hora,
 * perquè en català s'escriu «20.29». El que distingeix una coordenada d'una hora
 * és la PRECISIÓ: `toFixed(3)` sempre dona tres decimals i cap rellotge no en té
 * tants. Per això es busquen tres decimals o més, i el signe de grau a part.
 */

import { describe, expect, it } from 'vitest';
import { captureCaption } from './caption';

/**
 * Tres decimals o més: la firma d'un `toFixed(3)`, mai la d'una hora.
 *
 * ES MIRA DESPRÉS DE TREURE LES DATES, i el motiu és una passada que va fallar:
 * amb el peu nou, «12.08.2026» conté «8.202» i el guardià la caçava com si fos
 * una coordenada. Una data completa és `dd.mm.aaaa`; una coordenada no ho és
 * mai. Es treuen les dates i el que quedi amb tres decimals ja no té excusa.
 */
const DATA = /\b\d{2}[./]\d{2}[./]\d{4}\b/g;
const COORDENADA = /\d[.,]\d{3}/;
const senseDates = (text: string): string => text.replace(DATA, '');

describe('el peu de la captura', () => {
  it('el guardià caça el peu que es publicava fins avui', () => {
    // Sense això, les proves de sota podrien passar amb un patró que no caça
    // res. Aquest és el text EXACTE que sortia cremat a la imatge quan el
    // topònim no s'havia resolt, amb les coordenades de Sòria.
    const elQueSortia = 'Eclipsi total · 41.766°, -2.479° · 20.29';
    expect(senseDates(elQueSortia)).toMatch(COORDENADA);
    expect(elQueSortia).toContain('°');
  });

  it('diu el lloc quan se’n sap el nom', () => {
    const peu = captureCaption({ placeLabel: 'Sòria', date: '12.08.2026', clock: '20:29' });
    expect(peu).toBe('Sòria · 12.08.2026 · 20:29 · eclipsi.info');
  });

  it('sense topònim no diu on ets, i molt menys amb decimals', () => {
    // El cas de debò: al camp, sense cobertura, amb el geocodificador caigut.
    const peu = captureCaption({ placeLabel: null, date: '12.08.2026', clock: '20:29' });
    expect(peu).toBe('12.08.2026 · 20:29 · eclipsi.info');
    expect(senseDates(peu)).not.toMatch(COORDENADA);
    expect(peu).not.toContain('°');
  });

  it('un topònim buit compta com a cap topònim', () => {
    // Photon pot tornar una cadena buida, i un peu acabat en « · » és lleig
    // però sobretot és una porta oberta a que algú hi torni a posar el recanvi.
    const peu = captureCaption({ placeLabel: '   ', date: '12.08.2026', clock: '20:29' });
    expect(peu).toBe('12.08.2026 · 20:29 · eclipsi.info');
  });

  it('cap combinació no deixa passar una coordenada', () => {
    // El barrescut: qualsevol entrada raonable, i la propietat s'ha de mantenir.
    const dates = ['12.08.2026', '02/08/2027', '26.01.2028'];
    const llocs: (string | null)[] = [null, '', 'Sòria', 'a 3,1 km de Valls'];
    const hores = ['20:29', '8:29 PM'];
    let comptats = 0;
    for (const date of dates) {
      for (const placeLabel of llocs) {
        for (const clock of hores) {
          expect(senseDates(captureCaption({ placeLabel, date, clock }))).not.toMatch(COORDENADA);
          comptats++;
        }
      }
    }
    // Que el bucle hagi corregut de debò: un `for` que no entra passa per verd.
    expect(comptats).toBe(dates.length * llocs.length * hores.length);
  });
});
