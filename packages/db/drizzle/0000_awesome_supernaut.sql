CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text UNIQUE,
	`password_hash` text NOT NULL,
	`display_name` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`is_admin` integer DEFAULT 0 NOT NULL,
	`must_change_password` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);