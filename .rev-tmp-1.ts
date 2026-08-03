import { computeLocalCircumstances } from './src/core/astro/contacts';
import { bandClipFor, bandContains, cellsForViewport } from './src/core/heat/grid';

const P: Record<string, [number, number]> = {
  palma: [39.5696, 2.6502],
  mao: [39.8885, 4.2658],
  eivissa: [38.9089, 1.4328],
  valencia: [39.4699, -0.3763],
  castello: [39.9864, -0.0513],
  tarragona: [41.1189, 1.2445],
  soria: [41.7665, -2.479],
  oviedo: [43.3619, -5.8494],
  coruna: [43.3623, -8.4115],
  barcelona: [41.3874, 2.1686],
  madrid: [40.4168, -3.7038],
  sevilla: [37.3891, -5.9845],
  canaries: [28.1, -15.4],
  islandia: [64.14, -21.94],
};

for (const id of ['2026-08-12', '2028-01-26']) {
  const clip = bandClipFor(id);
  console.log('===', id, 'ring', clip.ring.length, 'bbox', JSON.stringify(clip.bbox));
  let maxJump = 0;
  let minLat = 90;
  let maxLat = -90;
  for (let i = 1; i < clip.ring.length; i++) {
    maxJump = Math.max(maxJump, Math.abs(clip.ring[i][0] - clip.ring[i - 1][0]));
    minLat = Math.min(minLat, clip.ring[i][1]);
    maxLat = Math.max(maxLat, clip.ring[i][1]);
  }
  console.log('  salt màxim de longitud', maxJump.toFixed(2), 'lat', minLat.toFixed(2), maxLat.toFixed(2));
  console.log('  tancat?', JSON.stringify(clip.ring[0]) === JSON.stringify(clip.ring[clip.ring.length - 1]));
  for (const [name, [lat, lon]] of Object.entries(P)) {
    const c = computeLocalCircumstances(id, { lat, lon, elevation: 0 });
    const inside = bandContains(clip, lon, lat);
    const engine = c.centralDurationSec > 0;
    const flag = inside === engine ? '  ' : '<<';
    console.log(
      flag,
      name.padEnd(11),
      'polígon(+10km)=', String(inside).padStart(5),
      'motor=', String(engine).padStart(5),
      'central=', c.centralDurationSec.toFixed(0).padStart(4),
      'marge"=', c.umbralMarginArcsec.toFixed(1),
    );
  }
  // Graella fina de discrepàncies sobre la Península i Balears
  let bad = 0;
  let tot = 0;
  const worst: string[] = [];
  for (let lat = 35.5; lat <= 44.0; lat += 0.25) {
    for (let lon = -9.5; lon <= 4.5; lon += 0.25) {
      const c = computeLocalCircumstances(id, { lat, lon, elevation: 0 });
      const engine = c.centralDurationSec > 0;
      const inside = bandContains(clip, lon, lat);
      tot++;
      if (engine && !inside) {
        bad++;
        if (worst.length < 12)
          worst.push(`${lat.toFixed(2)},${lon.toFixed(2)} central=${c.centralDurationSec.toFixed(0)}s`);
      }
    }
  }
  console.log(`  cel·les amb fase central que el polígon deixa FORA: ${bad} de ${tot}`);
  for (const w of worst) console.log('    ', w);
}
