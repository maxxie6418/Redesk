CREATE TABLE `api_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`token_hash` text,
	`scopes` text NOT NULL,
	`expires_at` text,
	`last_used_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_api_tokens_owner` ON `api_tokens` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_api_tokens_token_hash` ON `api_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`token_id` integer,
	`request_id` text,
	`method` text,
	`path` text,
	`action` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`result` text NOT NULL,
	`ip` text,
	`user_agent` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_owner_created_at` ON `audit_logs` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `connect_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`token_id` integer NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`token_id`) REFERENCES `api_tokens`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_connect_codes_code_hash` ON `connect_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `idx_connect_codes_token` ON `connect_codes` (`token_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_book_tags` (
	`book_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`book_id`, `tag_id`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_book_tags`("book_id", "tag_id", "created_at") SELECT "book_id", "tag_id", "created_at" FROM `book_tags`;--> statement-breakpoint
DROP TABLE `book_tags`;--> statement-breakpoint
ALTER TABLE `__new_book_tags` RENAME TO `book_tags`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`key` text NOT NULL,
	`owner_id` integer NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `key`),
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_settings`("key", "owner_id", "value", "updated_at") SELECT "key", "owner_id", "value", "updated_at" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
CREATE TABLE `__new_topic_books` (
	`topic_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`added_at` text NOT NULL,
	PRIMARY KEY(`topic_id`, `book_id`),
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_topic_books`("topic_id", "book_id", "added_at") SELECT "topic_id", "book_id", "added_at" FROM `topic_books`;--> statement-breakpoint
DROP TABLE `topic_books`;--> statement-breakpoint
ALTER TABLE `__new_topic_books` RENAME TO `topic_books`;--> statement-breakpoint
CREATE TABLE `__new_topic_highlights` (
	`topic_id` integer NOT NULL,
	`highlight_id` integer NOT NULL,
	`added_at` text NOT NULL,
	PRIMARY KEY(`topic_id`, `highlight_id`),
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`highlight_id`) REFERENCES `highlights`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_topic_highlights`("topic_id", "highlight_id", "added_at") SELECT "topic_id", "highlight_id", "added_at" FROM `topic_highlights`;--> statement-breakpoint
DROP TABLE `topic_highlights`;--> statement-breakpoint
ALTER TABLE `__new_topic_highlights` RENAME TO `topic_highlights`;--> statement-breakpoint
CREATE TABLE `__new_topic_notes` (
	`topic_id` integer NOT NULL,
	`note_id` integer NOT NULL,
	`added_at` text NOT NULL,
	PRIMARY KEY(`topic_id`, `note_id`),
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_topic_notes`("topic_id", "note_id", "added_at") SELECT "topic_id", "note_id", "added_at" FROM `topic_notes`;--> statement-breakpoint
DROP TABLE `topic_notes`;--> statement-breakpoint
ALTER TABLE `__new_topic_notes` RENAME TO `topic_notes`;--> statement-breakpoint
CREATE TABLE `__new_book_covers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`book_file_id` integer,
	`source_type` text NOT NULL,
	`source_label` text,
	`original_url` text,
	`storage_mode` text DEFAULT 'local_only' NOT NULL,
	`local_path` text,
	`remote_key` text,
	`connection_id` integer,
	`primary_location` text DEFAULT 'local' NOT NULL,
	`sync_status` text DEFAULT 'synced' NOT NULL,
	`mime_type` text,
	`file_size` integer,
	`checksum` text,
	`is_active` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_file_id`) REFERENCES `book_files`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`connection_id`) REFERENCES `cloud_connections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_book_covers`("id", "owner_id", "book_id", "book_file_id", "source_type", "source_label", "original_url", "storage_mode", "local_path", "remote_key", "connection_id", "primary_location", "sync_status", "mime_type", "file_size", "checksum", "is_active", "created_at", "updated_at") SELECT "id", "owner_id", "book_id", "book_file_id", "source_type", "source_label", "original_url", "storage_mode", "local_path", "remote_key", "connection_id", "primary_location", "sync_status", "mime_type", "file_size", "checksum", "is_active", "created_at", "updated_at" FROM `book_covers`;--> statement-breakpoint
DROP TABLE `book_covers`;--> statement-breakpoint
ALTER TABLE `__new_book_covers` RENAME TO `book_covers`;--> statement-breakpoint
CREATE TABLE `__new_book_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`book_id` integer,
	`storage_mode` text DEFAULT 'local_only' NOT NULL,
	`local_path` text,
	`remote_key` text,
	`connection_id` integer,
	`primary_location` text DEFAULT 'local' NOT NULL,
	`sync_status` text DEFAULT 'synced' NOT NULL,
	`original_filename` text,
	`file_format` text NOT NULL,
	`mime_type` text,
	`file_size` integer,
	`checksum` text,
	`is_primary` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`connection_id`) REFERENCES `cloud_connections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_book_files`("id", "owner_id", "book_id", "storage_mode", "local_path", "remote_key", "connection_id", "primary_location", "sync_status", "original_filename", "file_format", "mime_type", "file_size", "checksum", "is_primary", "created_at", "updated_at") SELECT "id", "owner_id", "book_id", "storage_mode", "local_path", "remote_key", "connection_id", "primary_location", "sync_status", "original_filename", "file_format", "mime_type", "file_size", "checksum", "is_primary", "created_at", "updated_at" FROM `book_files`;--> statement-breakpoint
DROP TABLE `book_files`;--> statement-breakpoint
ALTER TABLE `__new_book_files` RENAME TO `book_files`;--> statement-breakpoint
CREATE TABLE `__new_books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`category_id` integer,
	`title` text NOT NULL,
	`author` text,
	`subtitle` text,
	`isbn` text,
	`publisher` text,
	`publish_year` integer,
	`description` text,
	`language` text,
	`cover_path` text,
	`status` text DEFAULT 'COLLECTED' NOT NULL,
	`visibility` text DEFAULT 'PRIVATE' NOT NULL,
	`reading_purpose` text,
	`entry_reason` text,
	`rating` integer,
	`custom_attributes` text,
	`metadata_source` text,
	`source_url` text,
	`translator` text,
	`original_title` text,
	`page_count` integer,
	`genre_category_id` integer,
	`favorited_at` text,
	`started_at` text,
	`finished_at` text,
	`import_order` integer DEFAULT 0 NOT NULL,
	`deleted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`genre_category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_books`("id", "owner_id", "category_id", "title", "author", "subtitle", "isbn", "publisher", "publish_year", "description", "language", "cover_path", "status", "visibility", "reading_purpose", "entry_reason", "rating", "custom_attributes", "metadata_source", "source_url", "translator", "original_title", "page_count", "genre_category_id", "favorited_at", "started_at", "finished_at", "import_order", "deleted_at", "created_at", "updated_at") SELECT "id", "owner_id", "category_id", "title", "author", "subtitle", "isbn", "publisher", "publish_year", "description", "language", "cover_path", "status", "visibility", "reading_purpose", "entry_reason", "rating", "custom_attributes", "metadata_source", "source_url", "translator", "original_title", "page_count", "genre_category_id", "favorited_at", "started_at", "finished_at", "import_order", "deleted_at", "created_at", "updated_at" FROM `books`;--> statement-breakpoint
DROP TABLE `books`;--> statement-breakpoint
ALTER TABLE `__new_books` RENAME TO `books`;--> statement-breakpoint
CREATE TABLE `__new_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'PERSONAL' NOT NULL,
	`parent_id` integer,
	`sort_order` integer DEFAULT 0,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_categories`("id", "owner_id", "name", "type", "parent_id", "sort_order", "created_at", "updated_at") SELECT "id", "owner_id", "name", "type", "parent_id", "sort_order", "created_at", "updated_at" FROM `categories`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
ALTER TABLE `__new_categories` RENAME TO `categories`;--> statement-breakpoint
CREATE TABLE `__new_cloud_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`tested_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_cloud_connections`("id", "owner_id", "name", "type", "config", "is_active", "tested_at", "created_at", "updated_at") SELECT "id", "owner_id", "name", "type", "config", "is_active", "tested_at", "created_at", "updated_at" FROM `cloud_connections`;--> statement-breakpoint
DROP TABLE `cloud_connections`;--> statement-breakpoint
ALTER TABLE `__new_cloud_connections` RENAME TO `cloud_connections`;--> statement-breakpoint
CREATE INDEX `idx_cloud_connections_owner` ON `cloud_connections` (`owner_id`);--> statement-breakpoint
CREATE TABLE `__new_cloud_note_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`connection_id` integer NOT NULL,
	`format` text NOT NULL,
	`remote_key` text NOT NULL,
	`checksum` text,
	`note_count` integer DEFAULT 0 NOT NULL,
	`generated_at` text NOT NULL,
	`sync_status` text DEFAULT 'synced' NOT NULL,
	`error_message` text,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `cloud_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_cloud_note_snapshots`("id", "owner_id", "connection_id", "format", "remote_key", "checksum", "note_count", "generated_at", "sync_status", "error_message") SELECT "id", "owner_id", "connection_id", "format", "remote_key", "checksum", "note_count", "generated_at", "sync_status", "error_message" FROM `cloud_note_snapshots`;--> statement-breakpoint
DROP TABLE `cloud_note_snapshots`;--> statement-breakpoint
ALTER TABLE `__new_cloud_note_snapshots` RENAME TO `cloud_note_snapshots`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_cloud_note_snapshots_connection_format` ON `cloud_note_snapshots` (`owner_id`,`connection_id`,`format`);--> statement-breakpoint
CREATE TABLE `__new_cloud_usage_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`usage` text NOT NULL,
	`connection_id` integer NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `cloud_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_cloud_usage_assignments`("id", "owner_id", "usage", "connection_id", "priority", "created_at") SELECT "id", "owner_id", "usage", "connection_id", "priority", "created_at" FROM `cloud_usage_assignments`;--> statement-breakpoint
DROP TABLE `cloud_usage_assignments`;--> statement-breakpoint
ALTER TABLE `__new_cloud_usage_assignments` RENAME TO `cloud_usage_assignments`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_cloud_usage_connection` ON `cloud_usage_assignments` (`owner_id`,`usage`,`connection_id`);--> statement-breakpoint
CREATE INDEX `idx_cloud_usage_assignments_owner_usage` ON `cloud_usage_assignments` (`owner_id`,`usage`,`priority`);--> statement-breakpoint
CREATE TABLE `__new_reading_progress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`owner_id` integer NOT NULL,
	`file_id` integer NOT NULL,
	`cfi` text NOT NULL,
	`percentage` real DEFAULT 0 NOT NULL,
	`last_read_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_reading_progress`("id", "book_id", "owner_id", "file_id", "cfi", "percentage", "last_read_at", "created_at", "updated_at") SELECT "id", "book_id", "owner_id", "file_id", "cfi", "percentage", "last_read_at", "created_at", "updated_at" FROM `reading_progress`;--> statement-breakpoint
DROP TABLE `reading_progress`;--> statement-breakpoint
ALTER TABLE `__new_reading_progress` RENAME TO `reading_progress`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_reading_progress_book_owner` ON `reading_progress` (`book_id`,`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_reading_progress_owner_last_read` ON `reading_progress` (`owner_id`,`last_read_at`);--> statement-breakpoint
CREATE TABLE `__new_reading_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`owner_id` integer NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`last_heartbeat_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_reading_sessions`("id", "book_id", "owner_id", "started_at", "ended_at", "duration_seconds", "last_heartbeat_at", "created_at") SELECT "id", "book_id", "owner_id", "started_at", "ended_at", "duration_seconds", "last_heartbeat_at", "created_at" FROM `reading_sessions`;--> statement-breakpoint
DROP TABLE `reading_sessions`;--> statement-breakpoint
ALTER TABLE `__new_reading_sessions` RENAME TO `reading_sessions`;--> statement-breakpoint
CREATE INDEX `idx_reading_sessions_book_owner` ON `reading_sessions` (`book_id`,`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_reading_sessions_owner_started` ON `reading_sessions` (`owner_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_reading_sessions_started_at` ON `reading_sessions` (`started_at`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text,
	`password_hash` text NOT NULL,
	`display_name` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`is_admin` integer DEFAULT 0 NOT NULL,
	`permission_level` text DEFAULT 'use' NOT NULL,
	`must_change_password` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "username", "password_hash", "display_name", "is_active", "is_admin", "permission_level", "must_change_password", "created_at", "updated_at") SELECT "id", "username", "password_hash", "display_name", "is_active", "is_admin", "permission_level", "must_change_password", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);