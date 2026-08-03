import { computeLocalCircumstances } from './src/core/astro/contacts';
import { pointsForEclipse } from './src/data/observation-points/catalog';

const pts = pointsForEclipse('2026-08-12');
let unc = 0;
for (const p of pts) {
  const c = computeLocalCircumstances('2026-08-12', {
    lat: p.lat,
    lon: p.lon,
    elevation: p.elevationM ?? 0,
  });
  if (c.edgeUncertain) {
    unc++;
    console.log(
      'EDGE-UNCERTAIN',
      p.id.padEnd(34),
      'phase=', p.phase.padEnd(8),
      'central=', c.centralDurationSec.toFixed(1).padStart(6),
      'margin=', c.umbralMarginArcsec.toFixed(2),
    );
  }
}
console.log('total punts', pts.length, 'incerts', unc);

// Also check whether declared `phase` flips when the point elevation is used
let flips = 0;
for (const p of pts) {
  const c0 = computeLocalCircumstances('2026-08-12', { lat: p.lat, lon: p.lon, elevation: 0 });
  const cE = computeLocalCircumstances('2026-08-12', {
    lat: p.lat,
    lon: p.lon,
    elevation: p.elevationM ?? 700,
  });
  const a = c0.centralDurationSec > 0 ? 'central' : 'partial';
  const b = cE.centralDurationSec > 0 ? 'central' : 'partial';
  if (a !== b) {
    flips++;
    console.log('FLIP amb cota', p.id, a, '->', b, c0.centralDurationSec.toFixed(1), cE.centralDurationSec.toFixed(1));
  }
}
console.log('flips amb cota 700 m:', flips);
