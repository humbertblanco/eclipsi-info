import { readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';

const ROOT = '/Users/humbertblanco/Documents/projectescursor/appeclipsi';
const parent = new Map();
const seen = new Set();

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), spec);
  const cands = [base, base + '.ts', base + '.tsx', base + '.js', join(base, 'index.ts'), join(base, 'index.tsx')];
  for (const c of cands) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

const RE = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^'"();]*?\sfrom\s+)?['"]([^'"]+)['"]/g;

function walk(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const src = readFileSync(file, 'utf8');
  RE.lastIndex = 0;
  let m;
  while ((m = RE.exec(src)) !== null) {
    const stmt = m[0];
    if (/\b(?:import|export)\s+type\s/.test(stmt)) continue;
    const spec = m[1];
    if (spec.endsWith('.css')) continue;
    const r = resolveSpec(file, spec);
    if (r) {
      if (!parent.has(r)) parent.set(r, file);
      walk(r);
    }
  }
}

walk(join(ROOT, 'src/main.tsx'));

function chain(target) {
  const full = join(ROOT, target);
  if (!seen.has(full)) return `${target}: NO és al graf estàtic`;
  const out = [];
  let cur = full;
  while (cur) {
    out.push(cur.replace(ROOT + '/', ''));
    cur = parent.get(cur);
  }
  return out.reverse().join('\n   -> ');
}

for (const t of [
  'src/core/eclipses/path.ts',
  'src/core/places/viewpoints.ts',
  'src/core/weather/climGrid.ts',
  'src/core/heat/grid.ts',
  'src/data/observation-points/catalog.ts',
  'src/core/spots/search.ts',
  'src/features/map/MiniMap.tsx',
  'src/core/analytics/vocabulary.ts',
]) {
  console.log('###', t);
  console.log('   ' + chain(t));
  console.log();
}
