import { validateSite } from './check-site.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
for (const name of ['index.html','styles.css','app.js','bank.js','config.js','assets','contracts']) {
  fs.cpSync(path.join(root, name), path.join(dist, name), { recursive:true });
}
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
validateSite(dist);
console.log('Static website ready in ' + dist);
