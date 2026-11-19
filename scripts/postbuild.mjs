// Removes development-only test sectors (status "dev") from the production build.
import { readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');
const regPath = join(dist, 'data', 'sectors.json');
const reg = JSON.parse(readFileSync(regPath, 'utf8'));
const dev = reg.sectors.filter((s) => s.status === 'dev').map((s) => s.slug);
for (const slug of dev) {
  const dir = join(dist, 'data', slug);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}
reg.sectors = reg.sectors.filter((s) => s.status !== 'dev');
writeFileSync(regPath, JSON.stringify(reg, null, 1));
console.log(dev.length ? `postbuild: removed test sector(s) ${dev.join(', ')} from dist/` : 'postbuild: nothing to remove');
