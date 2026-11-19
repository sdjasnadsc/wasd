import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const paths = ['apps/server/src', 'apps/web/src', 'packages/shared/src', 'tests', 'scripts'];
let checked = 0;
for (const path of paths) {
  for (const file of readdirSync(path, { recursive: true })) {
    if (!/\.(?:ts|mjs|js)$/.test(file)) continue;
    const full = join(path, file);
    const source = readFileSync(full, 'utf8');
    const js = file.endsWith('.ts') ? stripTypeScriptTypes(source) : source;
    const check = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: js, encoding: 'utf8' });
    if (check.status !== 0) { console.error(full, check.stderr); process.exit(1); }
    checked++;
  }
}
console.log(`Checked ${checked} modules for syntax and Node TypeScript compatibility.`);
