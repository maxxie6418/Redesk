ALTER TABLE `users` ADD COLUMN `is_active` integer DEFAULT 1 NOT NULL;
ALTER TABLE `users` ADD COLUMN `session_expires_days` integer DEFAULT 30 NOT NULL;
