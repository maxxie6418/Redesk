// 迁移演练：模拟"空库"和"已有库"两种场景跑一遍 migrate
// 用法: node scripts/migrate-drill.mjs
//
// 场景 A：空库 → 跑全部 migrations
// 场景 B：模拟旧版数据库（用一个固定 fixture）→ 跑最新 migrations
//
// 退出码：0 全部通过；1 任意场景失败。

import { mkdtempSync, rmSync, existsSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    shell: true,
    ...opts,
  });
  return result;
}

function logSection(title) {
  console.log(`\n=== ${title} ===`);
}

const errors = [];

// 场景 A：空库全量迁移
logSection('场景 A：空库全量迁移');
{
  const tmp = mkdtempSync(join(tmpdir(), 'redesk-migrate-drill-empty-'));
  const dbPath = join(tmp, 'redesk.db');
  console.log(`DB: ${dbPath}`);

  const r = run('pnpm', ['db:migrate'], {
    env: { ...process.env, DATABASE_URL: dbPath },
  });
  if (r.status !== 0) {
    const stdout = r.stdout ?? '';
    const stderr = r.stderr ?? '';
    if (stdout) console.error(stdout);
    if (stderr) console.error(stderr);
    errors.push('场景 A 失败：pnpm db:migrate 在空库上抛错');
  } else {
    if (!existsSync(dbPath)) {
      errors.push('场景 A 失败：数据库文件未被创建');
    } else {
      const stat = readFileSync(dbPath);
      if (stat.length === 0) {
        errors.push('场景 A 失败：数据库文件大小为 0');
      } else {
        console.log(`空库迁移成功（${stat.length} bytes）`);
      }
    }
  }
  rmSync(tmp, { recursive: true, force: true });
}

// 场景 B：从固定 fixture 升级
logSection('场景 B：从旧库升级到当前 HEAD');
{
  const fixtureCandidates = [
    resolve(root, 'dataLab/fixtures/redesk-pre-drill.db'),
    resolve(root, 'dataLab/fixtures/redesk-oldest-stable.db'),
    resolve(root, 'dataLab/fixtures/old-shape.db'),
  ];
  const fixture = fixtureCandidates.find((p) => existsSync(p));

  if (!fixture) {
    console.warn('未发现 fixture，跳过场景 B（不会阻塞 CI）');
    console.warn('可选路径：');
    for (const p of fixtureCandidates) {
      console.warn(`  - ${p}`);
    }
  } else {
    const tmp = mkdtempSync(join(tmpdir(), 'redesk-migrate-drill-fixture-'));
    const dbPath = join(tmp, 'redesk.db');
    copyFileSync(fixture, dbPath);
    console.log(`Fixture: ${fixture}`);
    console.log(`DB: ${dbPath}`);

    const r = run('pnpm', ['db:migrate'], {
      env: { ...process.env, DATABASE_URL: dbPath },
    });
    if (r.status !== 0) {
      const stdout = r.stdout ?? '';
      const stderr = r.stderr ?? '';
      if (stdout) console.error(stdout);
      if (stderr) console.error(stderr);
      errors.push('场景 B 失败：pnpm db:migrate 在 fixture 上抛错');
    } else {
      console.log('fixture 升级成功');
    }
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (errors.length > 0) {
  console.error(`\n[migrate-drill] FAIL: ${errors.length} 项失败\n`);
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  console.error(
    `\n参考: AGENTS.md § 数据库迁移红线 红线 3（升级前 6 步），doc/灾难恢复 SOP.md §3.C`,
  );
  process.exit(1);
}

console.log('\n[migrate-drill] OK: 所有场景通过');
process.exit(0);
