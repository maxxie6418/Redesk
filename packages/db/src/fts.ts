import type { AppDatabase } from './client';
import type Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';

const FTS_SCHEMA_VERSION = 'v5-noext-content';

const FTS_META_TABLE = '_redesk_fts_meta';

interface FtsConfig {
  table: 'books' | 'notes' | 'highlights';
  ftsTable: 'books_fts' | 'notes_fts' | 'highlights_fts';
  ftsColumnsList: string;
  oldValues: string;
  newValues: string;
}

const FTS_CONFIGS: Record<FtsConfig['table'], FtsConfig> = {
  books: {
    table: 'books',
    ftsTable: 'books_fts',
    ftsColumnsList: 'title, author, isbn',
    oldValues: 'old.title, old.author, old.isbn',
    newValues: 'new.title, new.author, new.isbn',
  },
  notes: {
    table: 'notes',
    ftsTable: 'notes_fts',
    ftsColumnsList: 'title, content_markdown, content_html',
    oldValues: 'old.title, old.content_markdown, old.content_html',
    newValues: 'new.title, new.content_markdown, new.content_html',
  },
  highlights: {
    table: 'highlights',
    ftsTable: 'highlights_fts',
    ftsColumnsList: 'text, note',
    oldValues: 'old.text, old.note',
    newValues: 'new.text, new.note',
  },
};

const FTS_TABLES = Object.values(FTS_CONFIGS).map((c) => c.ftsTable);

interface SetupOptions {
  sqlite: Database.Database;
}

export function setupFts5(db: AppDatabase, options?: Partial<SetupOptions>): void {
  const exec = options?.sqlite
    ? (sqlText: string) => options.sqlite!.exec(sqlText)
    : (sqlText: string) => {
        db.run(sql.raw(sqlText));
      };
  const query = <T>(querySql: string): T => {
    if (options?.sqlite) {
      return options.sqlite.prepare(querySql).all() as T;
    }
    return db.all(sql.raw(querySql)) as unknown as T;
  };
  runSetup(exec, query);
}

function runSetup(
  exec: (sqlText: string) => void,
  query: <T>(querySql: string) => T,
): void {
  const previousVersion = readSchemaVersion(exec, query);
  ensureMetaTable(exec, query);
  if (previousVersion !== null && previousVersion !== FTS_SCHEMA_VERSION) {
    dropFtsArtifacts(exec);
  }
  for (const cfg of Object.values(FTS_CONFIGS)) {
    ensureFtsTable(exec, cfg);
    ensureInsertTrigger(exec, cfg);
    ensureDeleteTrigger(exec, cfg);
    ensureContentUpdateTrigger(exec, query, cfg);
    ensureSoftDeleteTrigger(exec, query, cfg);
    ensureRestoreTrigger(exec, query, cfg);
  }
  backfillIfNeeded(
    exec,
    query,
    'books_fts',
    'rowid, title, author, isbn',
    `SELECT id, title, author, isbn FROM books WHERE deleted_at IS NULL`,
  );
  backfillIfNeeded(
    exec,
    query,
    'notes_fts',
    'rowid, title, content_markdown, content_html',
    `SELECT id, title, content_markdown, content_html FROM notes WHERE deleted_at IS NULL`,
  );
  backfillIfNeeded(
    exec,
    query,
    'highlights_fts',
    'rowid, text, note',
    `SELECT id, text, note FROM highlights WHERE deleted_at IS NULL`,
  );
}

function readSchemaVersion(
  exec: (sqlText: string) => void,
  query: <T>(querySql: string) => T,
): string | null {
  exec(`CREATE TABLE IF NOT EXISTS ${FTS_META_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  const rows = query<{ value: string }[]>(`SELECT value FROM ${FTS_META_TABLE} WHERE key = 'schema_version'`);
  return rows[0]?.value ?? null;
}

function ensureMetaTable(
  exec: (sqlText: string) => void,
  query: <T>(querySql: string) => T,
): void {
  exec(`CREATE TABLE IF NOT EXISTS ${FTS_META_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  const rows = query<{ value: string }[]>(`SELECT value FROM ${FTS_META_TABLE} WHERE key = 'schema_version'`);
  if (rows.length === 0) {
    exec(`INSERT INTO ${FTS_META_TABLE}(key, value) VALUES ('schema_version', '${FTS_SCHEMA_VERSION}');`);
  } else if (rows[0].value !== FTS_SCHEMA_VERSION) {
    exec(`UPDATE ${FTS_META_TABLE} SET value = '${FTS_SCHEMA_VERSION}' WHERE key = 'schema_version';`);
  }
}

function dropFtsArtifacts(exec: (sqlText: string) => void): void {
  for (const ftsTable of FTS_TABLES) {
    exec(`
      DROP TRIGGER IF EXISTS ${ftsTable}_insert;
      DROP TRIGGER IF EXISTS ${ftsTable}_delete;
      DROP TRIGGER IF EXISTS ${ftsTable}_update;
      DROP TRIGGER IF EXISTS ${ftsTable}_soft_delete;
      DROP TRIGGER IF EXISTS ${ftsTable}_restore;
      DROP TABLE IF EXISTS ${ftsTable};
    `);
  }
  exec(`DELETE FROM ${FTS_META_TABLE} WHERE key LIKE 'trigger:%' OR key LIKE 'backfill:%';`);
}

function getMeta(
  query: <T>(querySql: string) => T,
  key: string,
): string | null {
  const rows = query<{ value: string }[]>(
    `SELECT value FROM ${FTS_META_TABLE} WHERE key = '${key.replace(/'/g, "''")}'`,
  );
  return rows[0]?.value ?? null;
}

function setMeta(
  exec: (sqlText: string) => void,
  query: <T>(querySql: string) => T,
  key: string,
  value: string,
): void {
  const escapedKey = key.replace(/'/g, "''");
  const escapedValue = value.replace(/'/g, "''");
  const existing = query<unknown[]>(`SELECT 1 FROM ${FTS_META_TABLE} WHERE key = '${escapedKey}'`);
  if (existing.length > 0) {
    exec(`UPDATE ${FTS_META_TABLE} SET value = '${escapedValue}' WHERE key = '${escapedKey}';`);
  } else {
    exec(`INSERT INTO ${FTS_META_TABLE}(key, value) VALUES ('${escapedKey}', '${escapedValue}');`);
  }
}

function ensureFtsTable(exec: (sqlText: string) => void, cfg: FtsConfig): void {
  exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS ${cfg.ftsTable} USING fts5(
      ${cfg.ftsColumnsList},
      tokenize='trigram'
    );
  `);
}

function ensureInsertTrigger(exec: (sqlText: string) => void, cfg: FtsConfig): void {
  const name = `${cfg.ftsTable}_insert`;
  exec(`
    CREATE TRIGGER IF NOT EXISTS ${name}
    AFTER INSERT ON ${cfg.table}
    WHEN NEW.deleted_at IS NULL
    BEGIN
      INSERT INTO ${cfg.ftsTable}(rowid, ${cfg.ftsColumnsList})
      VALUES (new.id, ${cfg.newValues});
    END;
  `);
}

function ensureDeleteTrigger(exec: (sqlText: string) => void, cfg: FtsConfig): void {
  const name = `${cfg.ftsTable}_delete`;
  exec(`
    CREATE TRIGGER IF NOT EXISTS ${name}
    AFTER DELETE ON ${cfg.table}
    BEGIN
      DELETE FROM ${cfg.ftsTable} WHERE rowid = old.id;
    END;
  `);
}

function ensureContentUpdateTrigger(
  exec: (sqlText: string) => void,
  query: <T>(querySql: string) => T,
  cfg: FtsConfig,
): void {
  const name = `${cfg.ftsTable}_update`;
  const metaKey = `trigger:${name}`;
  if (getMeta(query, metaKey) === FTS_SCHEMA_VERSION) return;
  exec(`DROP TRIGGER IF EXISTS ${name};`);
  exec(`
    CREATE TRIGGER ${name}
    AFTER UPDATE ON ${cfg.table}
    WHEN NEW.deleted_at IS NULL AND OLD.deleted_at IS NULL
    BEGIN
      DELETE FROM ${cfg.ftsTable} WHERE rowid = old.id;
      INSERT INTO ${cfg.ftsTable}(rowid, ${cfg.ftsColumnsList})
      VALUES (new.id, ${cfg.newValues});
    END;
  `);
  setMeta(exec, query, metaKey, FTS_SCHEMA_VERSION);
}

function ensureSoftDeleteTrigger(
  exec: (sqlText: string) => void,
  query: <T>(querySql: string) => T,
  cfg: FtsConfig,
): void {
  const name = `${cfg.ftsTable}_soft_delete`;
  const metaKey = `trigger:${name}`;
  if (getMeta(query, metaKey) === FTS_SCHEMA_VERSION) return;
  exec(`DROP TRIGGER IF EXISTS ${name};`);
  exec(`
    CREATE TRIGGER ${name}
    AFTER UPDATE ON ${cfg.table}
    WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
    BEGIN
      DELETE FROM ${cfg.ftsTable} WHERE rowid = old.id;
    END;
  `);
  setMeta(exec, query, metaKey, FTS_SCHEMA_VERSION);
}

function ensureRestoreTrigger(
  exec: (sqlText: string) => void,
  query: <T>(querySql: string) => T,
  cfg: FtsConfig,
): void {
  const name = `${cfg.ftsTable}_restore`;
  const metaKey = `trigger:${name}`;
  if (getMeta(query, metaKey) === FTS_SCHEMA_VERSION) return;
  exec(`DROP TRIGGER IF EXISTS ${name};`);
  exec(`
    CREATE TRIGGER ${name}
    AFTER UPDATE ON ${cfg.table}
    WHEN NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL
    BEGIN
      INSERT INTO ${cfg.ftsTable}(rowid, ${cfg.ftsColumnsList})
      VALUES (new.id, ${cfg.newValues});
    END;
  `);
  setMeta(exec, query, metaKey, FTS_SCHEMA_VERSION);
}

function backfillIfNeeded(
  exec: (sqlText: string) => void,
  query: <T>(querySql: string) => T,
  ftsTable: 'books_fts' | 'notes_fts' | 'highlights_fts',
  columns: string,
  selectSql: string,
): void {
  const metaKey = `backfill:${ftsTable}`;
  if (getMeta(query, metaKey) === 'done') return;
  exec(`INSERT INTO ${ftsTable}(${columns}) ${selectSql};`);
  setMeta(exec, query, metaKey, 'done');
}
