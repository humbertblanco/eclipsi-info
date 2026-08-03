/**
 * Fum assertiu del motor: els tres eclipsis del catàleg, cadascun amb llocs
 * triats a posta —dins la franja, al caire i a fora— i les lleis físiques que
 * cap canvi al motor no té dret a trencar.
 *
 * Ús: npx tsx scripts/smoke.ts   (o `npm run smoke`)
 *
 * Abans aquest script només imprimia la taula del 2026 i sortia sempre amb
 * codi 0: un termòmetre sense escala. La taula continua sent-hi —al camp és
 * útil de debò— però ara cada fila passa comptes: si alguna asserció falla,
 * s'imprimeix en vermell i el procés surt amb codi 1.
 *
 * Què s'hi comprova, i per què això i no altra cosa:
 *
 *   · Invariants físics que valen per a qualsevol eclipsi i qualsevol punt:
 *     l'ordre dels contactes, l'obscuració entre 0 i 1, la magnitud coherent
 *     amb el veredicte (la contradicció «parcial amb magnitud ≥ 1» va ser un
 *     defecte real; vegeu circumstances.test.ts, que en guarda el pany).
 *   · El veredicte esperat a cada lloc, amb una excepció honesta: al caire de
 *     la franja el motor NO pot decidir (el marge és més petit que l'error de
 *     les efemèrides) i el que s'exigeix és que ho confessi via edgeUncertain.
 *   · Dues àncores daurades del 2026 contra les hores de l'IGN, amb la
 *     desviació coneguda del motor descomptada. No és duplicar el test daurat:
 *     és un cable de trampa perquè el fum s'adoni si el motor es mou.
 */
import { computeLocalCircumstances, findSunset } from '../src/core/astro/contacts';
import { ECLIPSES } from '../src/core/eclipses/catalog';
import type { EclipseKind, GeoLocation, LocalCircumstances } from '../src/core/astro/types';

// ─── Llocs de referència ─────────────────────────────────────────────────────
//
// Tres o quatre per eclipsi, i cadascun hi és per una raó: els «dins» han de
// veure la fase central sense discussió, els «caire» són on el motor es juga
// la honestedat, i els «fora» han de quedar-se en parcial per molt a prop que
// siguin de la ratlla.

interface Lloc {
  name: string;
  loc: GeoLocation;
  rol: 'dins' | 'caire' | 'fora';
  /** Veredicte exigit, quan el marge geomètric permet exigir-lo. */
  esperat?: EclipseKind;
  /**
   * Al caire de debò no s'exigeix el veredicte sinó la confessió: el marge
   * umbral és més petit que l'error de les efemèrides (~1,5″) i un sí o un no
   * serien una moneda a l'aire. El motor ha d'aixecar edgeUncertain.
   */
  esperaIncertesa?: boolean;
  /**
   * El tret distintiu d'aquest lloc és que el Sol es pon DINS de la fase
   * central (el catàleg ho promet per a Barcelona el 2028). S'asserteix que la
   * posta cau entre C2 i C3.
   */
  postaDinsCentral?: boolean;
}

const LLOCS: Record<string, Lloc[]> = {
  '2026-08-12': [
    // Oviedo i Burgos porten les coordenades EXACTES de les infografies de
    // l'IGN (tests/golden/ign-2026-08-12.json), perquè les àncores daurades de
    // més avall comparin el mateix punt i no un veí a tres carrers.
    { name: 'Oviedo',  loc: { lat: 43.3623222, lon: -5.8437222, elevation: 231 }, rol: 'dins',  esperat: 'total' },
    { name: 'Burgos',  loc: { lat: 42.3411306, lon: -3.7041972, elevation: 859 }, rol: 'dins',  esperat: 'total' },
    // Madrid queda a un sospir de la ratlla sud (marge ~+1,5″): el que ha de
    // fer el motor no és encertar-ho, és admetre que no ho pot saber.
    { name: 'Madrid',  loc: { lat: 40.4168, lon: -3.7038, elevation: 650 }, rol: 'caire', esperaIncertesa: true },
    { name: 'Sevilla', loc: { lat: 37.3891, lon: -5.9845, elevation: 11 },  rol: 'fora',  esperat: 'partial' },
  ],
  '2027-08-02': [
    { name: 'Tarifa',  loc: { lat: 36.0143, lon: -5.6044, elevation: 7 },   rol: 'dins',  esperat: 'total' },
    // Màlaga és a la vora nord però amb marge (~4″, força per sobre del
    // soroll de les efemèrides): aquí sí que es pot exigir la totalitat.
    { name: 'Màlaga',  loc: { lat: 36.7213, lon: -4.4214, elevation: 11 },  rol: 'caire', esperat: 'total' },
    { name: 'Sevilla', loc: { lat: 37.3891, lon: -5.9845, elevation: 11 },  rol: 'fora',  esperat: 'partial' },
    { name: 'Madrid',  loc: { lat: 40.4168, lon: -3.7038, elevation: 650 }, rol: 'fora',  esperat: 'partial' },
  ],
  '2028-01-26': [
    { name: 'Sevilla', loc: { lat: 37.3891, lon: -5.9845, elevation: 11 },  rol: 'dins',  esperat: 'annular' },
    { name: 'Toledo',  loc: { lat: 39.8628, lon: -4.0273, elevation: 529 }, rol: 'caire', esperat: 'annular' },
    // El cas que el catàleg promet amb totes les lletres: a Barcelona el Sol
    // es pon mentre l'anell encara és al cel.
    { name: 'Barcelona', loc: { lat: 41.3874, lon: 2.1686, elevation: 12 }, rol: 'dins', esperat: 'annular', postaDinsCentral: true },
    { name: 'Madrid',  loc: { lat: 40.4168, lon: -3.7038, elevation: 650 }, rol: 'fora',  esperat: 'partial' },
  ],
};

// ─── Àncores daurades del 2026 ───────────────────────────────────────────────
//
// Les hores de l'IGN són les mateixes que vigila tests/golden/
// circumstances.test.ts. El motor hi va sistemàticament AVANÇAT uns 4 s per
// l'error d'efemèrides d'astronomy-engine (mesurat i documentat allà i a la
// capçalera de contacts.ts); no és corregible des d'aquí. Per això el que
// s'exigeix no és clavar l'IGN, sinó no moure's de la desviació coneguda en
// més de ±2 s: si el motor empitjora, això salta; si algun dia millora,
// també salta, i llavors l'àncora s'ha d'estrènyer a consciència — la mateixa
// filosofia que els tests de caracterització.

const TOLERANCIA_DAURADA_SEC = 2;

const DAURATS: Array<{
  eclipseId: string;
  lloc: string;
  contacte: 'c1' | 'c2' | 'max' | 'c3' | 'c4';
  ignUtc: string;
  /** Motor − IGN mesurat avui, en segons. */
  desviacioConegudaSec: number;
}> = [
  { eclipseId: '2026-08-12', lloc: 'Oviedo', contacte: 'c1',  ignUtc: '2026-08-12T17:31:22Z', desviacioConegudaSec: -4.0 },
  { eclipseId: '2026-08-12', lloc: 'Burgos', contacte: 'max', ignUtc: '2026-08-12T18:29:19Z', desviacioConegudaSec: -3.8 },
];

// ─── Comptabilitat de les assercions ────────────────────────────────────────

const VERMELL = '\x1b[31m';
const VERD = '\x1b[32m';
const NEUTRE = '\x1b[0m';

let assercionsFetes = 0;
const errors: string[] = [];

function comprova(condicio: boolean, missatge: string): void {
  assercionsFetes += 1;
  if (!condicio) errors.push(missatge);
}

const abans = (a: Date | undefined, b: Date | undefined): boolean =>
  a !== undefined && b !== undefined && a.getTime() < b.getTime();

/** Tot el que ha de ser cert a qualsevol lloc, sigui quin sigui l'eclipsi. */
function comprovaLloc(
  eclipseId: string,
  kindCataleg: 'total' | 'annular',
  lloc: Lloc,
  r: LocalCircumstances,
): void {
  const on = `[${eclipseId} · ${lloc.name}]`;
  const c = r.contacts;

  // Tots els llocs triats veuen com a mínim una parcial ben formada.
  comprova(r.kind !== 'none', `${on} el motor diu que aquí no es veu res, i és un lloc triat per veure-hi eclipsi`);
  comprova(c.c1 !== undefined && c.c4 !== undefined, `${on} falten C1 o C4: una parcial sense principi o sense final`);
  comprova(abans(c.c1?.time, c.max.time), `${on} C1 no és abans del màxim`);
  comprova(abans(c.max.time, c.c4?.time), `${on} el màxim no és abans de C4`);

  const central = r.kind === 'total' || r.kind === 'annular';
  if (central) {
    // L'ordre dels cinc contactes és l'ordre del fenomen: si es desordena,
    // no és un detall, és que el cercador d'arrels ha perdut el nord.
    comprova(c.c2 !== undefined && c.c3 !== undefined, `${on} fase central sense C2 o C3`);
    comprova(
      abans(c.c1?.time, c.c2?.time) && abans(c.c2?.time, c.max.time) &&
      abans(c.max.time, c.c3?.time) && abans(c.c3?.time, c.c4?.time),
      `${on} l'ordre C1 < C2 < màx < C3 < C4 no es compleix`,
    );
    // El tipus de fase central el mana el catàleg: un 2028 «total» o un 2026
    // «anular» serien el motor contradient el Canon de la NASA.
    comprova(r.kind === kindCataleg, `${on} fase central «${r.kind}» però el catàleg diu «${kindCataleg}»`);
    comprova(r.centralDurationSec > 0, `${on} fase central amb durada ${r.centralDurationSec} s`);
    if (c.c2 && c.c3) {
      const c3menysC2 = (c.c3.time.getTime() - c.c2.time.getTime()) / 1000;
      comprova(
        Math.abs(r.centralDurationSec - c3menysC2) <= 0.5,
        `${on} centralDurationSec (${r.centralDurationSec.toFixed(1)} s) no quadra amb C3−C2 (${c3menysC2.toFixed(1)} s)`,
      );
    }
  } else {
    comprova(c.c2 === undefined && c.c3 === undefined, `${on} parcial amb C2 o C3: contactes umbrals que no haurien d'existir`);
    comprova(Math.abs(r.centralDurationSec) < 1e-6, `${on} parcial amb durada central ${r.centralDurationSec} s`);
  }
  if (c.c1 && c.c4) {
    const c4menysC1 = (c.c4.time.getTime() - c.c1.time.getTime()) / 1000;
    comprova(
      Math.abs(r.partialDurationSec - c4menysC1) <= 0.5,
      `${on} partialDurationSec (${r.partialDurationSec.toFixed(1)} s) no quadra amb C4−C1 (${c4menysC1.toFixed(1)} s)`,
    );
  }

  // L'obscuració és una fracció d'àrea: fora de [0, 1] no vol dir res.
  const obsc = c.max.obscuration;
  comprova(obsc >= 0 && obsc <= 1 + 1e-9, `${on} obscuració ${obsc} fora de [0, 1]`);

  // La magnitud ha de dir el mateix que el veredicte. «Parcial amb magnitud
  // ≥ 1» va passar de debò quan kind i magnitud sortien de radis diferents.
  const mag = c.max.magnitude;
  if (r.kind === 'total') {
    comprova(mag >= 1, `${on} total amb magnitud ${mag.toFixed(4)} < 1`);
    comprova(obsc >= 0.999, `${on} total amb obscuració ${obsc.toFixed(4)}: la totalitat tapa el disc sencer`);
  } else if (r.kind === 'annular') {
    comprova(mag > 0 && mag < 1, `${on} anular amb magnitud ${mag.toFixed(4)}: l'anell exigeix Lluna més petita que Sol`);
    comprova(obsc < 1, `${on} anular amb obscuració 1: l'anell de fotosfera mai no desapareix`);
  } else if (r.kind === 'partial') {
    comprova(mag > 0 && mag < 1, `${on} parcial amb magnitud ${mag.toFixed(4)} (la contradicció kind/magnitud ha tornat?)`);
  }

  // Als contactes externs l'eclipsi comença i acaba des de zero.
  if (c.c1) comprova(c.c1.magnitude <= 0.001, `${on} magnitud ${c.c1.magnitude} a C1: hauria de ser zero`);
  if (c.c4) comprova(c.c4.magnitude <= 0.001, `${on} magnitud ${c.c4.magnitude} a C4: hauria de ser zero`);

  // Si el lloc està triat per veure l'eclipsi (dins o al caire de la franja),
  // el Sol ha de ser per damunt de −1° d'altura aparent al màxim: per sota,
  // ni el millor horitzó del món no salva la vetllada.
  if (lloc.rol !== 'fora') {
    comprova(
      c.max.sun.altitudeApparent > -1,
      `${on} Sol a ${c.max.sun.altitudeApparent.toFixed(2)}° al màxim: massa baix per a un lloc triat per veure'l`,
    );
  }

  // El veredicte esperat — o, al caire de debò, la confessió esperada.
  if (lloc.esperaIncertesa) {
    comprova(
      r.edgeUncertain,
      `${on} al caire de la franja (marge ${r.umbralMarginArcsec.toFixed(2)}″) el motor hauria de confessar la incertesa, no decidir «${r.kind}»`,
    );
  } else if (lloc.esperat) {
    comprova(r.kind === lloc.esperat, `${on} veredicte «${r.kind}», s'esperava «${lloc.esperat}»`);
  }

  // La promesa del catàleg per a Barcelona 2028: la posta cau dins de la fase
  // central. Si això deixa de ser cert, o el motor o el catàleg menteixen.
  if (lloc.postaDinsCentral && c.c2 && c.c3) {
    const posta = findSunset(lloc.loc, c.max.time);
    comprova(
      posta !== undefined && abans(c.c2.time, posta) && abans(posta, c.c3.time),
      `${on} la posta (${posta?.toISOString() ?? '—'}) hauria de caure entre C2 i C3, com promet el catàleg`,
    );
  }
}

// ─── La taula de sempre, ara per als tres eclipsis ──────────────────────────

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

/** CEST a l'agost, CET al gener: que la capçalera no hagi de mentir mai. */
const zonaDe = (instantUtc: string): string =>
  new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', timeZoneName: 'short' })
    .formatToParts(new Date(instantUtc))
    .find((p) => p.type === 'timeZoneName')?.value ?? 'hora peninsular';

const iniciTotal = performance.now();

for (const eclipse of ECLIPSES) {
  const llocs = LLOCS[eclipse.id];
  // Si el catàleg creix i el fum no se n'assabenta, que ho digui ell mateix.
  comprova(llocs !== undefined, `[${eclipse.id}] eclipsi al catàleg sense llocs de fum: afegiu-n'hi a LLOCS`);
  if (!llocs) continue;

  console.log(`\n${eclipse.label.ca.toUpperCase()} — hores en hora oficial peninsular (${zonaDe(eclipse.greatestEclipseUtc)})\n`);
  console.log(
    'Lloc'.padEnd(12),
    'Rol'.padEnd(6),
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

  const resultats = new Map<string, LocalCircumstances>();

  for (const lloc of llocs) {
    const t0 = performance.now();
    const r = computeLocalCircumstances(eclipse.id, lloc.loc);
    const ms = performance.now() - t0;
    resultats.set(lloc.name, r);
    const c = r.contacts;

    const dur =
      r.centralDurationSec > 0
        ? `${Math.floor(r.centralDurationSec / 60)}m ${(r.centralDurationSec % 60).toFixed(0).padStart(2, '0')}s`
        : '—';

    console.log(
      lloc.name.padEnd(12),
      lloc.rol.padEnd(6),
      (r.kind + (r.edgeUncertain ? '?' : '')).padEnd(8),
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

    comprovaLloc(eclipse.id, eclipse.kind, lloc, r);
  }

  // Qui surt amb «?» al tipus és que el motor no es veu amb cor de decidir.
  for (const lloc of llocs) {
    const r = resultats.get(lloc.name);
    if (r?.edgeUncertain) {
      console.log(
        `  ? ${lloc.name}: marge umbral ${r.umbralMarginArcsec >= 0 ? '+' : ''}${r.umbralMarginArcsec.toFixed(2)}″, per sota de la resolució de les efemèrides — veredicte honestament indecidible.`,
      );
    }
  }

  // La posta del Sol respecte al final de l'eclipsi: als dos eclipsis de Sol
  // baix és el nus del problema, i al camp és la primera xifra que es mira.
  if (eclipse.lowSunOverSpain) {
    console.log('\nPosta de Sol vs. fi de l\'eclipsi\n');
    for (const lloc of llocs) {
      const r = resultats.get(lloc.name);
      if (!r || r.kind === 'none') continue;
      const posta = findSunset(lloc.loc, r.contacts.max.time);
      if (!posta) continue;
      const ref = r.contacts.c4 ?? r.contacts.max;
      const marge = (posta.getTime() - ref.time.getTime()) / 1000 / 60;
      console.log(
        lloc.name.padEnd(12),
        'posta',
        fmt(posta),
        '| C4',
        fmt(ref.time),
        `| marge ${marge > 0 ? '+' : ''}${marge.toFixed(1)} min`,
      );
    }
  }

  // Les àncores daurades d'aquest eclipsi, si en té.
  for (const daurat of DAURATS.filter((d) => d.eclipseId === eclipse.id)) {
    const r = resultats.get(daurat.lloc);
    if (!r) continue;
    const nostre = daurat.contacte === 'max' ? r.contacts.max.time : r.contacts[daurat.contacte]?.time;
    if (!nostre) {
      comprova(false, `[${eclipse.id} · ${daurat.lloc}] falta el contacte ${daurat.contacte} per contrastar amb l'IGN`);
      continue;
    }
    const delta = (nostre.getTime() - new Date(daurat.ignUtc).getTime()) / 1000;
    const residu = delta - daurat.desviacioConegudaSec;
    comprova(
      Math.abs(residu) <= TOLERANCIA_DAURADA_SEC,
      `[${eclipse.id} · ${daurat.lloc}] ${daurat.contacte} a ${delta.toFixed(2)} s de l'IGN: la desviació coneguda és ${daurat.desviacioConegudaSec} s i el motor se n'ha allunyat ${residu.toFixed(2)} s (límit ±${TOLERANCIA_DAURADA_SEC} s)`,
    );
  }
}

// El fum ha de ser prou ràpid per córrer-lo sense pensar-s'ho.
const segonsTotals = (performance.now() - iniciTotal) / 1000;
comprova(segonsTotals < 30, `el fum ha trigat ${segonsTotals.toFixed(1)} s: ha deixat de ser un fum`);

// ─── Veredicte final ─────────────────────────────────────────────────────────

if (errors.length > 0) {
  console.error('');
  for (const error of errors) console.error(`${VERMELL}✗ ${error}${NEUTRE}`);
  console.error(`${VERMELL}✗ ${errors.length} de ${assercionsFetes} assercions han fallat.${NEUTRE}`);
  process.exit(1);
}

console.log(`\n${VERD}✓ ${assercionsFetes} assercions, tot net (${segonsTotals.toFixed(1)} s).${NEUTRE}`);
