/**
 * Tests de l'alineació d'un element amb el Sol eclipsat.
 *
 * La geometria es prova amb terreny SINTÈTIC i determinista: un pla, una carena
 * gaussiana i prou. Així cada número que surt es pot comprovar a mà amb la
 * trigonometria, i cap test no depèn de baixar tessel·les.
 *
 * L'astronomia, en canvi, és la de veritat: l'instant i l'altura del Sol surten
 * de l'eclipsi del 12-08-2026 vist des de Sòria, on C2 cau amb el Sol a 7,33°
 * d'altura aparent i azimut 283,4°. Amb un element de 100 m, això posa el punt
 * d'alineació a uns 764 m — i el marge de posició, a menys de trenta metres.
 */

import { describe, expect, it } from 'vitest';
import {
  alignmentDistanceM,
  checkLineOfSight,
  describeAlignment,
  initialBearingDeg,
  solveAlignment,
  tilesAlongLine,
  type AlignmentTarget,
} from './alignment';
import { apparentAltitudeDeg, destination } from '../horizon/raycast';
import { approxDistanceKm } from './grid';
import { sampleAt } from '../astro/ephemeris';
import type { ElevationReader } from './types';

const ECLIPSE = '2026-08-12';

/** Sòria: dins de la franja de totalitat del 12-08-2026. */
const SORIA = { lat: 41.7665, lon: -2.479 };

/** Terreny pla al nivell del mar. Deixa la trigonometria despullada. */
const flatGround: ElevationReader = () => 0;

/**
 * Pla amb una carena gaussiana en anell al voltant de l'element.
 *
 * És el cas que justifica tot el mòdul: la línia d'alineació hi passa per sobre
 * i, sense mirar el terreny, ningú no sabria que la carena tapa l'element.
 */
function ridgeGround(
  centreM: number,
  heightM: number,
  sigmaM: number,
): ElevationReader {
  return (lon, lat) => {
    const dM = approxDistanceKm(SORIA.lat, SORIA.lon, lat, lon) * 1000;
    const z = (dM - centreM) / sigmaM;
    return heightM * Math.exp(-z * z);
  };
}

function tower(heightM: number): AlignmentTarget {
  return {
    name: 'la torre',
    lat: SORIA.lat,
    lon: SORIA.lon,
    summitElevationM: heightM,
  };
}

describe('alignmentDistanceM: la inversa de l’altura aparent', () => {
  it('desfà exactament apparentAltitudeDeg', () => {
    for (const rise of [10, 100, 800, 2000]) {
      for (const alt of [1.4, 2.5, 7.335, 12.5, 30]) {
        const d = alignmentDistanceM(rise, alt);
        expect(d).not.toBeNull();
        // El punt trobat ha de veure la punta exactament a l'altura demanada.
        expect(apparentAltitudeDeg(rise, 0, d as number)).toBeCloseTo(alt, 9);
      }
    }
  });

  it('a poca distància coincideix amb la trigonometria plana', () => {
    // 98,4 m de desnivell i el Sol a 7,335°: el cas de Sòria amb una torre de
    // 100 m i l'ull a 1,6 m.
    const d = alignmentDistanceM(98.4, 7.335) as number;
    const flat = 98.4 / Math.tan((7.335 * Math.PI) / 180);
    expect(d).toBeGreaterThan(750);
    expect(d).toBeLessThan(770);
    // La curvatura escurça la distància, però a 764 m encara no arriba al metre.
    expect(flat - d).toBeGreaterThan(0);
    expect(flat - d).toBeLessThan(1);
  });

  it('amb el Sol baix, ignorar la curvatura et posaria tres quilòmetres massa lluny', () => {
    const d = alignmentDistanceM(1000, 1.5) as number;
    const flat = 1000 / Math.tan((1.5 * Math.PI) / 180);
    expect(flat).toBeGreaterThan(38_000);
    expect(d).toBeGreaterThan(34_000);
    expect(d).toBeLessThan(36_000);
    expect(flat - d).toBeGreaterThan(3000);
  });

  it('no hi ha solució si l’element no queda per damunt teu', () => {
    expect(alignmentDistanceM(0, 5)).toBeNull();
    expect(alignmentDistanceM(-30, 5)).toBeNull();
  });
});

describe('initialBearingDeg', () => {
  it('el rumb inicial cap a llevant no val 90°, i no és cap error', () => {
    expect(initialBearingDeg(41, -2, 42, -2)).toBeCloseTo(0, 6);
    // Sobre el cercle màxim, un grau de longitud cap a llevant surt amb rumb
    // 89,67°: la geodèsica es decanta cap al pol. L'aproximació plana en diria
    // 90 exactes, i aquest terç de grau ja és més gran que el radi del Sol.
    const east = initialBearingDeg(41, -2, 41, -1);
    expect(east).toBeGreaterThan(89.5);
    expect(east).toBeLessThan(90);
  });

  it('recull la convergència dels meridians', () => {
    // Deu quilòmetres cap a l'est a 42° de latitud: el rumb de tornada NO és
    // 270° exactes, i la diferència és de l'ordre d'un terç del radi del Sol.
    const east = destination(42, -2, 90, 10_000);
    const back = initialBearingDeg(east.lat, east.lon, 42, -2);
    expect(Math.abs(back - 270)).toBeGreaterThan(0.05);
    expect(Math.abs(back - 270)).toBeLessThan(0.15);
  });
});

describe('tilesAlongLine', () => {
  it('cobreix els dos extrems i no repeteix res', () => {
    const far = destination(SORIA.lat, SORIA.lon, 103, 12_000);
    const tiles = tilesAlongLine(SORIA, { lat: far.lat, lon: far.lon }, 12);

    const keys = new Set(tiles.map((t) => `${t.z}/${t.x}/${t.y}`));
    expect(keys.size).toBe(tiles.length);
    expect(tiles.every((t) => t.z === 12)).toBe(true);

    // Els dos caps del passadís hi han de ser.
    for (const p of [SORIA, { lat: far.lat, lon: far.lon }]) {
      const n = 2 ** 12;
      const x = Math.floor(((p.lon + 180) / 360) * n);
      expect(tiles.some((t) => t.x === x)).toBe(true);
    }
  });

  it('un passadís curt no demana desenes de tessel·les', () => {
    const near = destination(SORIA.lat, SORIA.lon, 103, 700);
    const tiles = tilesAlongLine(SORIA, { lat: near.lat, lon: near.lon }, 12);
    // Nou com a màxim: la tessel·la de cada punt i el seu marge d'una.
    expect(tiles.length).toBeLessThanOrEqual(12);
  });
});

describe('checkLineOfSight', () => {
  const target = { lat: SORIA.lat, lon: SORIA.lon, topElevationM: 100 };

  it('sobre un pla, res no tapa la punta', () => {
    const p = destination(SORIA.lat, SORIA.lon, 103, 764);
    const check = checkLineOfSight(
      { lat: p.lat, lon: p.lon, eyeElevationM: 1.6 },
      target,
      { elevation: flatGround, targetGroundElevationM: 0 },
    );
    expect(check.checked).toBe(true);
    expect(check.clear).toBe(true);
    expect(check.coverage).toBe(1);
    expect(check.hiddenBaseM).toBe(0);
  });

  it('una carena de 55 m a mig camí tapa un element de 100 m', () => {
    const p = destination(SORIA.lat, SORIA.lon, 103, 764);
    const check = checkLineOfSight(
      { lat: p.lat, lon: p.lon, eyeElevationM: 1.6 },
      target,
      {
        elevation: ridgeGround(400, 55, 60),
        targetGroundElevationM: 0,
      },
    );
    // La visual passa a 48,5 m damunt del punt on la carena arriba a 55 m.
    expect(check.checked).toBe(true);
    expect(check.clear).toBe(false);
    expect(check.marginDeg).toBeLessThan(0);
    expect(check.foregroundDistanceKm).toBeCloseTo(0.364, 1);
  });

  it('una carena que no arriba a la visual deixa amagada només la base', () => {
    const p = destination(SORIA.lat, SORIA.lon, 103, 764);
    const check = checkLineOfSight(
      { lat: p.lat, lon: p.lon, eyeElevationM: 1.6 },
      target,
      { elevation: ridgeGround(400, 40, 60), targetGroundElevationM: 0 },
    );
    expect(check.clear).toBe(true);
    // 40 m de carena a 400 m de l'element amaguen les desenes de metres de baix.
    expect(check.hiddenBaseM).toBeGreaterThan(50);
    expect(check.hiddenBaseM).toBeLessThan(90);
  });

  it('sense dades del model no s’inventa cap veredicte', () => {
    const p = destination(SORIA.lat, SORIA.lon, 103, 764);
    const check = checkLineOfSight(
      { lat: p.lat, lon: p.lon, eyeElevationM: 1.6 },
      target,
      { elevation: () => undefined, targetGroundElevationM: 0 },
    );
    // Zero mostres amb dades no vol dir «lliure»: vol dir «no ho hem mirat».
    expect(check.checked).toBe(false);
    expect(check.skipped).toBe('no-model');
  });

  it('massa a prop, ho diu en comptes de fer veure que ho ha comprovat', () => {
    const p = destination(SORIA.lat, SORIA.lon, 103, 60);
    const check = checkLineOfSight(
      { lat: p.lat, lon: p.lon, eyeElevationM: 1.6 },
      target,
      { elevation: flatGround, targetGroundElevationM: 0 },
    );
    expect(check.checked).toBe(false);
    expect(check.skipped).toBe('too-close');
  });
});

describe('solveAlignment sobre terreny pla', () => {
  const outcome = solveAlignment({
    eclipseId: ECLIPSE,
    target: tower(100),
    moment: 'c2',
    elevation: flatGround,
    origin: { lat: SORIA.lat, lon: SORIA.lon - 0.2, elevation: 0 },
  });

  it('troba un punt', () => {
    expect(outcome.ok).toBe(true);
  });

  it('la distància reprodueix la trigonometria del Sol a 7,33°', () => {
    if (!outcome.ok) throw new Error('calia una solució');
    // 98,4 m de desnivell (100 menys l'ull a 1,6) amb el Sol a 7,33°.
    expect(outcome.point.distanceKm).toBeGreaterThan(0.74);
    expect(outcome.point.distanceKm).toBeLessThan(0.79);
    expect(outcome.point.groundElevationM).toBe(0);
    expect(outcome.point.eyeElevationM).toBeCloseTo(1.6, 6);

    // I la comprovació que compta: des del punt, la punta i el Sol han de
    // quedar a la mateixa altura aparent.
    const alt = apparentAltitudeDeg(100, 1.6, outcome.point.distanceKm * 1000);
    expect(alt).toBeCloseTo(outcome.sunAltitudeDeg, 3);
    expect(outcome.targetAltitudeDeg).toBeCloseTo(outcome.sunAltitudeDeg, 3);
  });

  it('l’altura del Sol que fem servir és la de les efemèrides al punt', () => {
    if (!outcome.ok) throw new Error('calia una solució');
    const real = sampleAt(new Date(outcome.atUtcMs), {
      lat: outcome.point.lat,
      lon: outcome.point.lon,
      elevation: outcome.point.groundElevationM,
    }).sun;
    expect(outcome.sunAltitudeDeg).toBeCloseTo(real.altitudeApparent, 2);
    expect(outcome.sunAzimuthDeg).toBeCloseTo(real.azimuth, 2);
  });

  it('mirant l’element es mira exactament cap al Sol', () => {
    if (!outcome.ok) throw new Error('calia una solució');
    const bearing = initialBearingDeg(
      outcome.point.lat,
      outcome.point.lon,
      SORIA.lat,
      SORIA.lon,
    );
    expect(Math.abs(bearing - outcome.sunAzimuthDeg)).toBeLessThan(0.02);
    // El punt queda a l'est-sud-est de l'element, oposat al Sol de ponent.
    expect(outcome.bearingFromTargetDeg).toBeGreaterThan(95);
    expect(outcome.bearingFromTargetDeg).toBeLessThan(115);
  });

  it('diu quant marge de posició tens, i és poc', () => {
    if (!outcome.ok) throw new Error('calia una solució');
    // Amb el Sol a 7,3° i un element a 764 m, el disc solar es menja en trenta
    // metres de camí. De costat, encara menys.
    expect(outcome.toleranceAlongM).toBeGreaterThan(20);
    expect(outcome.toleranceAlongM).toBeLessThan(40);
    expect(outcome.toleranceLateralM).toBeGreaterThan(2);
    expect(outcome.toleranceLateralM).toBeLessThan(6);
  });

  it('comprova el terreny i comprova la fase central', () => {
    if (!outcome.ok) throw new Error('calia una solució');
    expect(outcome.terrain.checked).toBe(true);
    expect(outcome.terrain.clear).toBe(true);
    expect(outcome.centralDurationSec).toBeGreaterThan(90);
  });

  it('diu què et costa arribar-hi des d’on ets', () => {
    if (!outcome.ok) throw new Error('calia una solució');
    expect(outcome.fromOrigin).not.toBeNull();
    expect(outcome.fromOrigin?.distanceKm).toBeGreaterThan(15);
    // L'origen és a ponent de l'element i el punt, a llevant.
    expect(outcome.fromOrigin?.bearingDeg).toBeGreaterThan(60);
    expect(outcome.fromOrigin?.bearingDeg).toBeLessThan(120);
  });
});

describe('solveAlignment amb el disc recolzat damunt la punta', () => {
  it('demanar mig disc de marge t’allunya just la tolerància que et diem', () => {
    const centred = solveAlignment({
      eclipseId: ECLIPSE,
      target: tower(100),
      moment: 'c2',
      elevation: flatGround,
    });
    if (!centred.ok) throw new Error('calia una solució');

    const resting = solveAlignment({
      eclipseId: ECLIPSE,
      target: tower(100),
      moment: 'c2',
      elevation: flatGround,
      // El centre del Sol un radi per damunt de la punta: el disc hi queda
      // recolzat en comptes de partit.
      sunAboveTargetDeg: centred.sunAngularRadiusDeg,
    });
    if (!resting.ok) throw new Error('calia una solució');

    const movedM = (resting.point.distanceKm - centred.point.distanceKm) * 1000;
    expect(movedM).toBeGreaterThan(0);
    // La tolerància que publiquem ha de ser aquest mateix desplaçament. No
    // quadra al mil·límetre perquè és una derivada i la corba no és recta: la
    // banda real és un metre asimètrica (28,8 m enrere, 26,8 m endavant), que
    // és molt per sota del que qualsevol GPS et sap situar.
    expect(Math.abs(movedM - centred.toleranceAlongM) / centred.toleranceAlongM)
      .toBeLessThan(0.06);
  });
});

describe('solveAlignment amb terreny pel mig', () => {
  it('quan una carena tapa l’element, el punt bo és dalt de la carena', () => {
    const outcome = solveAlignment({
      eclipseId: ECLIPSE,
      target: tower(100),
      moment: 'c2',
      elevation: ridgeGround(400, 55, 60),
    });

    if (!outcome.ok) throw new Error('calia una solució');

    // El punt de terreny pla (764 m) queda darrere la carena; el bo és al
    // pendent, on el terra puja i la punta baixa fins a l'altura del Sol.
    expect(outcome.point.distanceKm).toBeGreaterThan(0.3);
    expect(outcome.point.distanceKm).toBeLessThan(0.5);
    expect(outcome.point.groundElevationM).toBeGreaterThan(35);
    expect(outcome.terrain.clear).toBe(true);

    // I l'altre punt, el que donaria la geometria sola, hi és i està marcat.
    const far = outcome.alternatives.find((p) => p.distanceKm > 0.6);
    expect(far).toBeDefined();
    expect(far?.terrainClear).toBe(false);
  });

  it('sense lector d’elevació resol la geometria però no promet res del terreny', () => {
    const outcome = solveAlignment({
      eclipseId: ECLIPSE,
      target: {
        name: 'el castell',
        lat: SORIA.lat,
        lon: SORIA.lon,
        summitElevationM: 100,
        groundElevationM: 0,
      },
      moment: 'c2',
    });

    if (!outcome.ok) throw new Error('calia una solució');
    expect(outcome.terrain.checked).toBe(false);
    expect(outcome.point.distanceKm).toBeGreaterThan(0.74);
    expect(describeAlignment(outcome).terrain).toContain('Sense dades del terreny');
  });
});

describe('solveAlignment quan no hi ha solució', () => {
  it('un pal d’un metre no aguanta el Sol si mires des d’1,6 m', () => {
    const outcome = solveAlignment({
      eclipseId: ECLIPSE,
      target: {
        name: 'el pal',
        lat: SORIA.lat,
        lon: SORIA.lon,
        heightAboveGroundM: 1,
      },
      moment: 'c2',
      elevation: flatGround,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problem).toBe('target-too-low');
    // La frase ja no viatja dins del resultat: el resultat porta les xifres i
    // el text el munta `describeAlignment`, que és qui sap en quin idioma va
    // l'app. Aquí es comprova que el nom de l'element hi arribi.
    expect(describeAlignment(outcome).headline).toContain('el pal');
    expect(describeAlignment(outcome, 'es').headline).toContain('el pal');
    expect(outcome.wouldNeedKm).toBeNull();
  });

  it('si el punt cau fora del radi que acceptes, diu quant caldria', () => {
    // Un cim de 3000 m amb el Sol a 7,33° demana 23 km. Qui només vulgui
    // moure's 12 km ha de rebre el número, no un punt inventat a 12 km.
    const outcome = solveAlignment({
      eclipseId: ECLIPSE,
      target: tower(3000),
      moment: 'c2',
      elevation: flatGround,
      maxDistanceKm: 12,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problem).toBe('out-of-range');
    expect(outcome.wouldNeedKm).not.toBeNull();
    expect(outcome.wouldNeedKm as number).toBeGreaterThan(20);
    expect(outcome.wouldNeedKm as number).toBeLessThan(26);
    expect(describeAlignment(outcome).headline).toContain('12 km');
  });

  it('amb el Sol post no hi ha cap punt on plantar-se', () => {
    const outcome = solveAlignment({
      eclipseId: ECLIPSE,
      target: tower(100),
      // Tres hores després de C2: el Sol ja fa estona que és sota l'horitzó.
      atUtcMs: Date.UTC(2026, 7, 12, 21, 29, 0),
      elevation: flatGround,
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problem).toBe('sun-below-horizon');
    expect(describeAlignment(outcome).headline).toContain('horitzó');
    expect(describeAlignment(outcome, 'es').headline).toContain('horizonte');
  });

  it('sense cota de l’element no s’inventa res', () => {
    const outcome = solveAlignment({
      eclipseId: ECLIPSE,
      target: { name: 'el cim desconegut', lat: SORIA.lat, lon: SORIA.lon },
      moment: 'c2',
    });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.problem).toBe('no-elevation');
  });
});

describe('describeAlignment', () => {
  const outcome = solveAlignment({
    eclipseId: ECLIPSE,
    target: { ...tower(100), name: 'el castell' },
    moment: 'c2',
    elevation: flatGround,
    origin: { lat: SORIA.lat, lon: SORIA.lon - 0.2, elevation: 0 },
  });

  it('dona coordenades, camí, tolerància i terreny', () => {
    const text = describeAlignment(outcome);
    expect(text.headline).toContain('el castell');
    expect(text.coordinates).toMatch(/^-?\d+\.\d{5}, -?\d+\.\d{5}$/);
    expect(text.approach).toContain('d’on ets');
    expect(text.tolerance).toContain('marge');
    expect(text.terrain).toContain('el castell');
    expect(text.caveats.some((c) => c.includes('terreny nu'))).toBe(true);
  });

  it('el text del cas sense solució explica el problema', () => {
    const impossible = solveAlignment({
      eclipseId: ECLIPSE,
      target: tower(3000),
      moment: 'c2',
      elevation: flatGround,
      maxDistanceKm: 12,
    });
    const text = describeAlignment(impossible);
    expect(text.coordinates).toBeNull();
    expect(text.headline.length).toBeGreaterThan(20);
  });

  it('sense emojis, sense exclamacions', () => {
    const text = describeAlignment(outcome);
    const all = [
      text.headline,
      text.coordinates ?? '',
      text.approach ?? '',
      text.tolerance ?? '',
      text.terrain ?? '',
      ...text.caveats,
    ].join(' ');
    expect(all).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(all).not.toContain('!');
  });

  /*
   * EL CASTELLÀ, PROVAT PEÇA A PEÇA.
   *
   * Aquest mòdul es va escriure sencer en català perquè no el muntava ningú.
   * Ara que va a la pantalla, una frase catalana enmig del castellà seria el
   * mateix defecte que ja s'ha arreglat tres vegades en aquest projecte, i
   * costa de veure a ull perquè el text el munten set funcions diferents.
   */
  describe('en castellà', () => {
    it('cap tros del resultat no es queda en català', () => {
      const text = describeAlignment(outcome, 'es');
      expect(text.headline).toContain('el castell'); // el nom el posa l'usuari
      expect(text.approach).toContain('donde estás');
      expect(text.tolerance).toContain('margen');
      expect(text.caveats.some((c) => c.includes('terreno desnudo'))).toBe(true);

      const all = [
        text.headline,
        text.approach ?? '',
        text.tolerance ?? '',
        text.terrain ?? '',
        ...text.caveats,
      ].join(' ');
      /*
       * Paraules que només existeixen a la versió catalana. Si en surt cap, és
       * que una branca s'ha quedat sense traduir.
       *
       * VAN AMB VORA DE PARAULA (`\b`) I NO AMB `toContain`: «margen» conté
       * «marge» i «terreno» conté «terreny» retallat. Amb la comparació de
       * subcadena, aquesta prova fallava sobre un text perfectament castellà —
       * i una prova que crida el llop no la mira ningú a la tercera vegada.
       */
      for (const catalanism of [/\bdamunt\b/, /d’on ets/, /\bmarge\b/, /\bterreny\b/]) {
        expect(all).not.toMatch(catalanism);
      }
    });

      /*
     * LA COMA DECIMAL, QUE AQUEST MÒDUL ESCRIVIA AMB PUNT.
     *
     * `toFixed` dona «6.23°» i tota la resta de l'app escriu «6,23°». Amb els
     * dos textos un sota l'altre a la mateixa fitxa del mapa, la barreja fa
     * dubtar de les dues xifres —és el mateix defecte que ESTAT.md ja recull
     * per a `formatDegrees`.
     */
    it('les xifres van amb coma decimal, com la resta de l’app', () => {
      for (const locale of ['ca', 'es'] as const) {
        const text = describeAlignment(outcome, locale);
        const all = [text.headline, text.approach ?? '', text.tolerance ?? ''].join(' ');
        // Un dígit, un punt i un dígit és la firma de `toFixed`.
        expect(all).not.toMatch(/\d\.\d/);
        expect(all).toMatch(/\d,\d/);
      }
    });

  it('els cinc problemes tenen frase en totes dues llengües', () => {
      const cases = [
        // sense cota: no hi ha model ni cota donada
        solveAlignment({
          eclipseId: ECLIPSE,
          target: { name: 'el cim desconegut', lat: SORIA.lat, lon: SORIA.lon },
          moment: 'c2',
        }),
        // element massa baix
        solveAlignment({
          eclipseId: ECLIPSE,
          target: { name: 'el pal', lat: SORIA.lat, lon: SORIA.lon, heightAboveGroundM: 1 },
          moment: 'c2',
          elevation: flatGround,
        }),
        // fora de radi
        solveAlignment({
          eclipseId: ECLIPSE,
          target: tower(3000),
          moment: 'c2',
          elevation: flatGround,
          maxDistanceKm: 12,
        }),
        // Sol post
        solveAlignment({
          eclipseId: ECLIPSE,
          target: tower(100),
          atUtcMs: Date.UTC(2026, 7, 12, 21, 29, 0),
          elevation: flatGround,
        }),
      ];

      for (const c of cases) {
        expect(c.ok).toBe(false);
        for (const locale of ['ca', 'es'] as const) {
          const text = describeAlignment(c, locale);
          expect(text.headline.length).toBeGreaterThan(20);
          expect(text.headline).not.toContain('undefined');
          expect(text.headline).not.toContain('null');
        }
      }
    });
  });
});
