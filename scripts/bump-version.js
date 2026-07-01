// 批量同步 monorepo 子包版本号到根 package.json 的版本
// 用法: pnpm bump 1.6.3   或   pnpm bump 1.6.3 --dry-run
import { readFileSync, writeFileSync, globSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const version = args.find((a) => !a.startsWith('-'));

if (!version) {
  console.error('用法: pnpm bump <version> [--dry-run]');
  console.error('示例: pnpm bump 1.6.3');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version)) {
  console.error(`版本号格式不合法: ${version}（期望 x.y.z 或 x.y.z-tag）`);
  process.exit(1);
}

// 根 + 所有 workspace 子包
const targets = [
  resolve(root, 'package.json'),
  ...globSync('apps/*/package.json', { cwd: root }).map((p) => resolve(root, p)),
  ...globSync('packages/*/package.json', { cwd: root }).map((p) => resolve(root, p)),
];

console.log(`目标版本: ${version}${dryRun ? '  (dry-run, 不写入)' : ''}\n`);

let changed = 0;
for (const file of targets) {
  const raw = readFileSync(file, 'utf8');
  const json = JSON.parse(raw);
  const rel = relative(root, file).replace(/\\/g, '/');

  if (json.version === version) {
    console.log(`  - ${rel}  已是 ${version}，跳过`);
    continue;
  }

  const from = json.version ?? '(无)';
  json.version = version;
  const out = JSON.stringify(json, null, 2) + '\n';

  if (!dryRun) {
    writeFileSync(file, out, 'utf8');
  }
  console.log(`  ✓ ${rel}  ${from} → ${version}`);
  changed++;
}

console.log(`\n完成：${changed} 个文件${dryRun ? '（未实际写入）' : ''}。`);
