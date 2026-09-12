// Publish website assets only. Server function source must never be a static asset.
const fs = require('fs');
const path = require('path');
require('./generate-sitemap.js');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output);
const excluded = new Set(['api', 'scripts', 'public', 'node_modules', 'package.json', 'package-lock.json', 'vercel.json']);
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.name.startsWith('.') || excluded.has(entry.name)) continue;
  fs.cpSync(path.join(root, entry.name), path.join(output, entry.name), { recursive: true });
}
