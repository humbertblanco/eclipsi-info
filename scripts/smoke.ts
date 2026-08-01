/**
 * Comprovació ràpida del motor contra llocs de referència.
 * Ús: npx tsx scripts/smoke.ts
 */
import { computeLocalCircumstances, findSunset } from '../src/core/astro/contacts';
import type { GeoLocation } from '../src/core/astro/types';

const PLACES: Array<{ name: string; loc: GeoLocation }> = [
  { name: 'A Coruña',        loc: { lat: 43.3623, lon: -8.4115, elevation: 20 } },
  { name: 'Oviedo',          loc: { lat: 43.3619, lon: -5.8494, elevation: 232 } },
  { name: 'Aranda de Duero', loc: { lat: 41.6704, lon: -3.6892, elevation: 798 } },
  { name: 'Sòria',           loc: { lat: 41.7665, lon: -2.4790, elevation: 1065 } },
  { name: 'Peníscola',       loc: { lat: 40.3583, lon:  0.4064, elevation: 10 } },
  { name: 'Palma',           loc: { lat: 39.5696, lon:  2.6502, elevation: 13 } },
  { name: 'Maó (Menorca)',   loc: { lat: 39.8885, lon:  4.2658, elevation: 45 } },
  { name: 'Barcelona',       loc: { lat: 41.3874, lon:  2.1686, elevation: 12 } },
  { name: 'Madrid',          loc: { lat: 40.4168, lon: -3.7038, elevation: 650 } },
];

const fmt = (d: Date | undefined) =>
  d
    ? d.toLocaleTimeString('es-ES', {
        timeZone: 'Europe/Madrid',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

console.log('\nECLIPSI 2026-08-12 — hores en hora oficial peninsular (CEST)\n');
console.log(
  'Lloc'.padEnd(17),
  'Tipus'.padEnd(8),
  'C1'.padEnd(9),
  'C2'.padEnd(9),
  'Màx'.padEnd(9),
  'C3'.padEnd(9),
  'C4'.padEnd(9),
  'Durada'.padEnd(8),
  'Mag'.padEnd(6),
  'Obsc'.padEnd(6),
  'Alt°'.padEnd(6),
  'Az°',
);

for (const { name, loc } of PLACES) {
  const t0 = performance.now();
  const r = computeLocalCircumstances('2026-08-12', loc);
  const ms = performance.now() - t0;
  const c = r.contacts;

  const dur =
    r.centralDurationSec > 0
      ? `${Math.floor(r.centralDurationSec / 60)}m ${(r.centralDurationSec % 60).toFixed(0).padStart(2, '0')}s`
      : '—';

  console.log(
    name.padEnd(17),
    r.kind.padEnd(8),
    fmt(c.c1?.time).padEnd(9),
    fmt(c.c2?.time).padEnd(9),
    fmt(c.max.time).padEnd(9),
    fmt(c.c3?.time).padEnd(9),
    fmt(c.c4?.time).padEnd(9),
    dur.padEnd(8),
    c.max.magnitude.toFixed(3).padEnd(6),
    (c.max.obscuration * 100).toFixed(1).padEnd(6),
    c.max.sun.altitudeApparent.toFixed(2).padEnd(6),
    c.max.sun.azimuth.toFixed(1),
    ` (${ms.toFixed(0)} ms)`,
  );
}

// La posta del Sol respecte al final de la totalitat: el nus del problema.
console.log('\nPosta de Sol vs. fi de la totalitat\n');
for (const { name, loc } of PLACES) {
  const r = computeLocalCircumstances('2026-08-12', loc);
  const sunset = findSunset(loc, r.contacts.max.time);
  if (!sunset || r.kind === 'none') continue;
  const ref = r.contacts.c4 ?? r.contacts.max;
  const margin = (sunset.getTime() - ref.time.getTime()) / 1000 / 60;
  console.log(
    name.padEnd(17),
    'posta',
    fmt(sunset),
    '| C4',
    fmt(ref.time),
    `| marge ${margin > 0 ? '+' : ''}${margin.toFixed(1)} min`,
  );
}
