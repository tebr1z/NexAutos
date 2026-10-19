"use strict";
// Use the repository's installed Prisma and parse dotenv files without a shell.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');
const apiRoot = path.resolve(__dirname, '..');
for (const file of [path.join(apiRoot, '.env'), path.resolve(apiRoot, '../../../.env'), path.resolve(apiRoot, '../../.env')]) {
  dotenv.config({ path: file, quiet: true });
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL tapılmadı. API və ya repo .env faylında təyin edin.');
  process.exit(1);
}
const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--schema', path.join(apiRoot, 'prisma/schema.prisma')], { cwd: apiRoot, env: process.env, stdio: 'inherit', windowsHide: true });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
