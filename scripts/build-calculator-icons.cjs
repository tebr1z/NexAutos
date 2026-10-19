const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const sharp = createRequire(path.join(root, 'apps/web/package.json'))('sharp');
const dir = path.join(root, 'extensions/autonex-bidcars/icons');
(async () => {
  const svg = await fs.readFile(path.join(dir, 'icon.svg'));
  for (const size of [16, 32, 48, 128]) await sharp(svg).resize(size, size).png().toFile(path.join(dir, `icon${size}.png`));
  console.log('Calculator icons generated: 16, 32, 48, 128.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
