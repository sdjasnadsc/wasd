import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const root = new URL('../', import.meta.url);
const web = new URL('apps/web/', root);
const dist = new URL('dist/', web);
mkdirSync(dist, { recursive: true });
for (const path of ['index.html', 'src', 'public']) cpSync(new URL(path, web), new URL(path, dist), { recursive: true });
const shared = readFileSync(new URL('packages/shared/src/index.ts', root), 'utf8');
writeFileSync(new URL('shared.js', dist), stripTypeScriptTypes(shared));
console.log('Production site built in apps/web/dist.');
