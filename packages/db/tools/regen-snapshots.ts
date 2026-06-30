import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, existsSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const repoRoot = resolve(import.meta.dirname, '..', '..', '..');
const drizzleDir = join(repoRoot, 'packages', 'db', 'drizzle');
const metaDir = join(drizzleDir, 'meta');
const workDir = join(repoRoot, '.tmp-snapregen');

if (existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });

interface DrizzleColumn {
  name: string;
  type: string;
  primaryKey: boolean;
  notNull: boolean;
  autoincrement: boolean;
  default?: unknown;
}

function buildSnapshot(db: Database.Database, prevId: string | null): { snapshot: unknown; id: string } {
  const tables: Record<string, unknown> = {};
  const tableRows = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
         AND name NOT LIKE '__drizzle_%'
       ORDER BY name`,
    )
    .all() as Array<{ name: string }>;

  for (const { name } of tableRows) {
    const createSql = (db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name) as { sql: string } | undefined)?.sql ?? '';
    const compositePkMatch = createSql.match(/PRIMARY KEY\s*\(\s*([^)]+)\s*\)/i);
    const compositePkColumns = compositePkMatch
      ? compositePkMatch[1].split(',').map((c) => c.trim().replace(/[`"[\]]/g, ''))
      : [];

    const columnRows = db.prepare(`PRAGMA table_info(${name})`).all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: unknown;
      pk: number;
    }>;

    const fkRows = db.prepare(`PRAGMA foreign_key_list(${name})`).all() as Array<{
      id: number;
      seq: number;
      table: string;
      from: string;
      to: string;
      on_update: string;
      on_delete: string;
      match: string;
    }>;

    const fkGroups = new Map<number, { columnsFrom: string[]; columnsTo: string[]; table: string; onUpdate: string; onDelete: string }>();
    for (const fk of fkRows) {
      const g = fkGroups.get(fk.id) ?? { columnsFrom: [], columnsTo: [], table: fk.table, onUpdate: fk.on_update, onDelete: fk.on_delete };
      g.columnsFrom.push(fk.from);
      g.columnsTo.push(fk.to);
      fkGroups.set(fk.id, g);
    }

    const indexRows = db
      .prepare(`PRAGMA index_list(${name})`)
      .all() as Array<{ name: string; unique: number; origin: string; partial: number }>;
    const indexes: Record<string, { name: string; columns: string[]; isUnique: boolean }> = {};
    for (const idx of indexRows) {
      const infoRows = db.prepare(`PRAGMA index_info(${idx.name})`).all() as Array<{ name: string; seqno: number }>;
      const columns = infoRows.sort((a, b) => a.seqno - b.seqno).map((r) => r.name);
      if (columns.length === 0) continue;
      indexes[idx.name] = { name: idx.name, columns, isUnique: idx.unique === 1 };
    }

    const columns: Record<string, DrizzleColumn> = {};
    for (const c of columnRows) {
      const isPk = c.pk > 0;
      const col: DrizzleColumn = {
        name: c.name,
        type: c.type.toLowerCase(),
        primaryKey: isPk,
        notNull: c.notnull === 1,
        autoincrement: isPk && c.pk === 1,
      };
      if (c.dflt_value !== null) col.default = c.dflt_value;
      columns[c.name] = col;
    }

    const foreignKeys: Record<string, Record<string, unknown>> = {};
    for (const [, g] of Array.from(fkGroups.entries()).sort(([a], [b]) => a - b)) {
      const fkName = `${name}_${g.columnsFrom.join('_')}_${g.table}_${g.columnsTo.join('_')}_fk`;
      foreignKeys[fkName] = {
        name: fkName,
        tableFrom: name,
        tableTo: g.table,
        columnsFrom: g.columnsFrom,
        columnsTo: g.columnsTo,
        onDelete: !g.onDelete || g.onDelete === 'NO ACTION' ? 'no action' : g.onDelete.toLowerCase().replace(/\s+/g, ' '),
        onUpdate: !g.onUpdate || g.onUpdate === 'NO ACTION' ? 'no action' : g.onUpdate.toLowerCase().replace(/\s+/g, ' '),
      };
    }

    const fkCount = Object.keys(foreignKeys).length;
    if (fkCount > 0) {
      console.log(`[regen]   ${name}: ${columnRows.length} cols, ${fkCount} fks`);
    }

    const compositePrimaryKeys: Record<string, { name: string; columns: string[] }> = {};
    if (compositePkColumns.length > 0) {
      compositePrimaryKeys[`${name}_pkey`] = { name: `${name}_pkey`, columns: compositePkColumns };
    }

    tables[name] = {
      name,
      columns,
      indexes,
      foreignKeys,
      compositePrimaryKeys,
      uniqueConstraints: {},
      checkConstraints: {},
    };
  }

  const id = randomUUID();
  const snapshot = {
    version: '6',
    dialect: 'sqlite',
    id,
    prevId,
    tables,
    enums: {},
    views: {},
    internal: { indexes: {} },
    _meta: { schemas: {}, tables: {}, columns: {} },
  };
  return { snapshot, id };
}

const journalPath = join(metaDir, '_journal.json');
const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));
const entries: Array<{ idx: number; tag: string; when: number }> = journal.entries;
const sorted = [...entries].sort((a, b) => a.idx - b.idx);
console.log(`[regen] ${sorted.length} journal entries`);

const existingSnapshots = readdirSync(metaDir).filter((f) => f.match(/^\d+_snapshot\.json$/));
const existingIdxs = new Set(existingSnapshots.map((f) => Number(f.split('_')[0])));
console.log(`[regen] existing snapshots: ${[...existingIdxs].sort((a, b) => a - b).join(', ')}`);

const idChain = new Map<number, string>();
for (const idx of existingIdxs) {
  const snapPath = join(metaDir, `${String(idx).padStart(4, '0')}_snapshot.json`);
  const snap = JSON.parse(readFileSync(snapPath, 'utf-8'));
  if (snap.id) idChain.set(idx, snap.id as string);
}
console.log(`[regen] idChain initial: ${[...idChain.entries()].map(([k, v]) => `${k}=${v.slice(0, 8)}`).join(', ')}`);

const targets = sorted.filter((e) => !existingIdxs.has(e.idx)).map((e) => e.idx);
if (targets.length === 0) {
  console.log('[regen] all snapshots present, nothing to do');
  process.exit(0);
}
console.log(`[regen] generating snapshots for: ${targets.join(', ')}`);

for (const target of targets) {
  console.log(`\n[regen] === idx ${target} (${sorted.find((e) => e.idx === target)?.tag}) ===`);

  const sliceFolder = join(workDir, `migrations-${target}`);
  if (existsSync(sliceFolder)) rmSync(sliceFolder, { recursive: true, force: true });
  mkdirSync(join(sliceFolder, 'meta'), { recursive: true });
  const sliceJournal = {
    version: '7',
    dialect: 'sqlite',
    entries: sorted.filter((e) => e.idx <= target),
  };
  writeFileSync(
    join(sliceFolder, 'meta', '_journal.json'),
    JSON.stringify(sliceJournal, null, 2),
  );
  for (const e of sorted.filter((x) => x.idx <= target)) {
    cpSync(join(drizzleDir, `${e.tag}.sql`), join(sliceFolder, `${e.tag}.sql`));
  }

  const dbPath = join(workDir, `step-${target}.db`);
  if (existsSync(dbPath)) rmSync(dbPath);
  const db = new Database(dbPath);
  const drizzleDb = drizzle(db);
  try {
    migrate(drizzleDb, { migrationsFolder: sliceFolder });
  } catch (err) {
    console.error(`[regen] migrate failed at ${target}: ${(err as Error).message}`);
    throw err;
  }

  const tableRows = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle_%' ORDER BY name`)
    .all() as Array<{ name: string }>;
  console.log(`[regen]   tables: ${tableRows.map((t) => t.name).join(', ')}`);

  const prevIdx = sorted.filter((e) => e.idx < target).map((e) => e.idx).pop() ?? null;
  const prevId = prevIdx !== null ? idChain.get(prevIdx) ?? null : null;
  const { snapshot, id } = buildSnapshot(db, prevId);
  const targetPath = join(metaDir, `${String(target).padStart(4, '0')}_snapshot.json`);
  writeFileSync(targetPath, JSON.stringify(snapshot, null, 2) + '\n');
  idChain.set(target, id);
  console.log(`[regen]   wrote ${targetPath} (id=${id.slice(0, 8)}..., prev=${prevId?.slice(0, 8) ?? 'null'})`);

  db.close();
}

console.log('\n[regen] done');
