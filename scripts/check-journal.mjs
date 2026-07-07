// 校验 Drizzle journal 与 drizzle/* 文件的一致性
// 用法: node scripts/check-journal.mjs
//
// 硬错误（exit 1，CI 必须通过）：
//  1. journal entries 序号 0..N-1 连续无跳跃
//  2. when 时间戳单调递增
//  3. 每个 entry 的 tag 在 drizzle/<tag>.sql 存在
//  4. 每个 entry 的 tag 在 drizzle/meta/<NNNN>_snapshot.json 存在
//     （NNNN = tag 的数字前缀；0011b_add_is_admin → snapshot 0011_snapshot.json）
//
// 软警告（exit 0，但打印 WARN）：
//  - drizzle/*.sql / meta/*_snapshot.json 没有对应 journal entry（孤儿文件）
//  - 这些可能是历史开发产物，暂不强制清理
//
// 退出码：0 全部通过 / 仅警告；1 存在硬错误。

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const drizzleDir = resolve(root, 'packages/db/drizzle');
const metaDir = resolve(drizzleDir, 'meta');
const journalPath = resolve(metaDir, '_journal.json');

if (!existsSync(journalPath)) {
  console.error(`[check-journal] journal 不存在: ${journalPath}`);
  process.exit(1);
}

const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
const entries = journal.entries ?? [];

const errors = [];
const warnings = [];

// 1. 序号连续性
for (let i = 0; i < entries.length; i += 1) {
  if (entries[i].idx !== i) {
    errors.push(`entries[${i}].idx === ${entries[i].idx}（期望 ${i}）`);
  }
}

// 2. when 单调递增
for (let i = 1; i < entries.length; i += 1) {
  if (entries[i].when < entries[i - 1].when) {
    errors.push(
      `entries[${i}].when (${entries[i].when}) 早于 entries[${i - 1}].when (${entries[i - 1].when})`,
    );
  }
}

// 3. 每个 tag 在 SQL 文件存在
for (const entry of entries) {
  const sqlPath = resolve(drizzleDir, `${entry.tag}.sql`);
  if (!existsSync(sqlPath)) {
    errors.push(`entries[${entry.idx}] 引用 ${entry.tag}，但 ${sqlPath} 不存在`);
  }
}

// 4. 每个 tag 的数字前缀对应 snapshot 存在
for (const entry of entries) {
  const m = entry.tag.match(/^(\d+)/);
  if (!m) {
    errors.push(`entries[${entry.idx}].tag = "${entry.tag}" 缺少数字前缀`);
    continue;
  }
  const numericPrefix = m[1].padStart(4, '0');
  const snapshotPath = resolve(metaDir, `${numericPrefix}_snapshot.json`);
  if (!existsSync(snapshotPath)) {
    errors.push(
      `entries[${entry.idx}] tag = "${entry.tag}" 期望 snapshot ${snapshotPath} 不存在`,
    );
  }
}

// 软警告：孤儿文件
const sqlFiles = readdirSync(drizzleDir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => f.replace(/\.sql$/, ''));
const snapshotFiles = readdirSync(metaDir)
  .filter((f) => /^\d{4}_snapshot\.json$/.test(f))
  .map((f) => f.replace(/_snapshot\.json$/, ''));

const journalTags = entries.map((e) => e.tag);
const journalNumericPrefixes = new Set(
  entries
    .map((e) => e.tag.match(/^(\d+)/)?.[1]?.padStart(4, '0'))
    .filter(Boolean),
);

for (const tag of sqlFiles) {
  if (!journalTags.includes(tag)) {
    warnings.push(`drizzle/${tag}.sql 存在但 journal 中无对应 entry（孤儿文件）`);
  }
}

for (const prefix of snapshotFiles) {
  if (!journalNumericPrefixes.has(prefix)) {
    warnings.push(
      `drizzle/meta/${prefix}_snapshot.json 存在但 journal 中无对应 entry（孤儿文件）`,
    );
  }
}

let exitCode = 0;

if (warnings.length > 0) {
  console.warn(`[check-journal] WARN: ${warnings.length} 项孤儿文件（不阻塞 CI）\n`);
  for (const w of warnings) {
    console.warn(`  - ${w}`);
  }
  console.warn(
    `\n孤儿文件通常来自历史开发分支，可以忽略；如确认无用可手工删除。`,
  );
}

if (errors.length > 0) {
  console.error(`\n[check-journal] FAIL: ${errors.length} 项硬错误\n`);
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  console.error(
    `\n参考: AGENTS.md § 数据库迁移红线 红线 2（禁止 journal 跳跃），doc/灾难恢复 SOP.md §2.B`,
  );
  exitCode = 1;
}

if (errors.length === 0 && warnings.length === 0) {
  console.log(
    `[check-journal] OK: ${entries.length} entries / ${sqlFiles.length} SQL / ${snapshotFiles.length} snapshots 全部对齐`,
  );
}

process.exit(exitCode);
