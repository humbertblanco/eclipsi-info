/**
 * On té sentit oferir la vista de realitat augmentada.
 *
 * PER QUÈ ES PROVA UNA COSA TAN SIMPLE. Perquè el que es prova no és el codi,
 * és el CRITERI: que la decisió es prengui per capacitats i no pel «user
 * agent». Dir qui ets no és el mateix que dir què pots fer —hi ha portàtils
 * amb pantalla tàctil i giroscopi, i tauletes que es fan passar per
 * ordinadors—, i el dia que algú vulgui «arreglar-ho» amb una expressió
 * regular sobre el navegador, aquests tests li diran que no.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectCameraSupport } from './useCameraSupport';

/** Munta un entorn de navegador de mentida amb les capacitats que es diguin. */
function fakeBrowser(opts: {
  camera?: boolean;
  orientation?: boolean;
  coarsePointer?: boolean | 'unknown';
}): void {
  const { camera = true, orientation = true, coarsePointer = true } = opts;

  const win: Record<string, unknown> = {
    matchMedia:
      coarsePointer === 'unknown'
        ? undefined
        : () => ({ matches: coarsePointer === true }),
  };
  if (orientation) win.DeviceOrientationEvent = function () {};

  vi.stubGlobal('window', win);
  vi.stubGlobal('navigator', {
    mediaDevices: camera ? { getUserMedia: () => Promise.resolve(null) } : undefined,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('quan s’ofereix la vista de càmera', () => {
  it('un mòbil: sí', () => {
    fakeBrowser({});
    expect(detectCameraSupport()).toBe(true);
  });

  it('un ordinador amb càmera però sense sensors: no', () => {
    // És el cas que empenyia la gent a concloure que l'app estava trencada: la
    // càmera del portàtil mira l'usuari, i superposar-hi el recorregut del Sol
    // dona una cara amb una corba a sobre.
    fakeBrowser({ orientation: false });
    expect(detectCameraSupport()).toBe(false);
  });

  it('un ordinador amb ratolí: no', () => {
    fakeBrowser({ coarsePointer: false });
    expect(detectCameraSupport()).toBe(false);
  });

  it('sense càmera, encara que tingui sensors: no', () => {
    fakeBrowser({ camera: false });
    expect(detectCameraSupport()).toBe(false);
  });

  it('si el navegador no sap dir quin punter té, s’ofereix', () => {
    // El requisit dur —càmera i sensors— ja s'ha comprovat. Val més oferir-ho
    // i que després calgui un permís que amagar-ho a qui ho podria fer servir.
    fakeBrowser({ coarsePointer: 'unknown' });
    expect(detectCameraSupport()).toBe(true);
  });

  it('sense finestra (Node, o dibuixat al servidor): no', () => {
    vi.stubGlobal('window', undefined);
    expect(detectCameraSupport()).toBe(false);
  });
});
