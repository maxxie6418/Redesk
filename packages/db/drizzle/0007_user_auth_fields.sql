ALTER TABLE `users` ADD COLUMN `is_active` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `session_expires_days` integer DEFAULT 30 NOT NULL;
