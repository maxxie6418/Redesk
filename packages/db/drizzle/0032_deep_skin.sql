CREATE TABLE `reading_progress` (
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
CREATE UNIQUE INDEX `uq_reading_progress_book_owner` ON `reading_progress` (`book_id`,`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_reading_progress_owner_last_read` ON `reading_progress` (`owner_id`,`last_read_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`owner_id` integer NOT NULL,
	`cfi` text NOT NULL,
	`label` text,
	`percentage` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_bookmarks`("id", "book_id", "owner_id", "cfi", "label", "percentage", "created_at") SELECT "id", "book_id", "owner_id", "cfi", "label", "percentage", "created_at" FROM `bookmarks`;--> statement-breakpoint
DROP TABLE `bookmarks`;--> statement-breakpoint
ALTER TABLE `__new_bookmarks` RENAME TO `bookmarks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
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
	FOREIGN KEY (`book_file_id`) REFERENCES `book_files`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_book_covers`("id", "owner_id", "book_id", "book_file_id", "source_type", "source_label", "original_url", "storage_mode", "local_path", "remote_key", "primary_location", "sync_status", "mime_type", "file_size", "checksum", "is_active", "created_at", "updated_at") SELECT "id", "owner_id", "book_id", "book_file_id", "source_type", "source_label", "original_url", "storage_mode", "local_path", "remote_key", "primary_location", "sync_status", "mime_type", "file_size", "checksum", "is_active", "created_at", "updated_at" FROM `book_covers`;--> statement-breakpoint
DROP TABLE `book_covers`;--> statement-breakpoint
ALTER TABLE `__new_book_covers` RENAME TO `book_covers`;--> statement-breakpoint
CREATE TABLE `__new_book_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`book_id` integer,
	`storage_mode` text DEFAULT 'local_only' NOT NULL,
	`local_path` text,
	`remote_key` text,
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
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_book_files`("id", "owner_id", "book_id", "storage_mode", "local_path", "remote_key", "primary_location", "sync_status", "original_filename", "file_format", "mime_type", "file_size", "checksum", "is_primary", "created_at", "updated_at") SELECT "id", "owner_id", "book_id", "storage_mode", "local_path", "remote_key", "primary_location", "sync_status", "original_filename", "file_format", "mime_type", "file_size", "checksum", "is_primary", "created_at", "updated_at" FROM `book_files`;--> statement-breakpoint
DROP TABLE `book_files`;--> statement-breakpoint
ALTER TABLE `__new_book_files` RENAME TO `book_files`;--> statement-breakpoint
DROP INDEX `idx_book_relations_unique`;--> statement-breakpoint
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
DROP INDEX `idx_status_history_book`;--> statement-breakpoint
DROP INDEX `idx_tags_owner_name`;--> statement-breakpoint
CREATE TABLE `__new_topic_books` (
	`topic_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`added_at` text NOT NULL,
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
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_topic_notes`("topic_id", "note_id", "added_at") SELECT "topic_id", "note_id", "added_at" FROM `topic_notes`;--> statement-breakpoint
DROP TABLE `topic_notes`;--> statement-breakpoint
ALTER TABLE `__new_topic_notes` RENAME TO `topic_notes`;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text,
	`password_hash` text NOT NULL,
	`display_name` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`is_admin` integer DEFAULT 0 NOT NULL,
	`must_change_password` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "username", "password_hash", "display_name", "is_active", "is_admin", "must_change_password", "created_at", "updated_at") SELECT "id", "username", "password_hash", "display_name", "is_active", "is_admin", "must_change_password", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);