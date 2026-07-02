import { eq, sql } from 'drizzle-orm';
import { createDatabase, users } from '@redesk/db';
import { config, DEFAULT_ADMIN_PASSWORD } from '../config';
import { hashPassword } from '../lib/auth';

async function main(): Promise<void> {
  const handle = createDatabase({ url: config.databaseUrl });
  const db = handle.db;

  const adminCount =
    db
      .select({ c: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.is_admin, 1))
      .get()?.c ?? 0;

  if (adminCount === 0) {
    console.error(
      '[redesk] No admin account found. Start the API once (or run db:migrate) so that ensureDefaultAdmin can create the initial admin, then retry.',
    );
    handle.close();
    process.exit(1);
  }

  if (adminCount > 1) {
    console.error(
      `[redesk] Found ${adminCount} admin accounts. The system invariant allows exactly one admin. Resolve manually before retrying.`,
    );
    handle.close();
    process.exit(1);
  }

  const admin = db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.is_admin, 1))
    .get();

  if (!admin) {
    console.error('[redesk] Admin lookup failed unexpectedly.');
    handle.close();
    process.exit(1);
  }

  const ts = new Date().toISOString();
  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);

  db.update(users)
    .set({
      password_hash: passwordHash,
      must_change_password: 1,
      updated_at: ts,
    })
    .where(eq(users.id, admin.id))
    .run();

  console.log(
    `[redesk] Admin password reset for username="${admin.username}" (id=${admin.id}). New password is "${DEFAULT_ADMIN_PASSWORD}". must_change_password=1, so the user will be forced to change it on next login.`,
  );
  console.log(
    '[redesk] Other admin fields (display_name, is_active, created_at, etc.) were NOT modified.',
  );

  handle.close();
}

main().catch((err) => {
  console.error('[redesk] reset-admin-password failed:', err);
  process.exit(1);
});
