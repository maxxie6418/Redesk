CREATE TABLE `book_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`file_path` text NOT NULL,
	`original_filename` text,
	`file_format` text NOT NULL,
	`mime_type` text,
	`file_size` integer,
	`checksum` text,
	`is_primary` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `book_relations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_book_id` integer NOT NULL,
	`target_book_id` integer NOT NULL,
	`relation_type` text,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`source_book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `book_tags` (
	`book_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`book_id`, `tag_id`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`category_id` integer,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`isbn` text,
	`publisher` text,
	`publish_year` integer,
	`description` text,
	`language` text,
	`cover_path` text,
	`status` text DEFAULT 'COLLECTED' NOT NULL,
	`visibility` text DEFAULT 'PRIVATE' NOT NULL,
	`reading_purpose` text,
	`rating` integer,
	`custom_attributes` text,
	`metadata_source` text,
	`deleted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	`sort_order` integer DEFAULT 0,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `status_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text NOT NULL,
	`owner_id` integer NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `key`),
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_owner_name` ON `categories` (`owner_id`,`name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tags_owner_name` ON `tags` (`owner_id`,`name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_book_relations_unique` ON `book_relations` (`source_book_id`,`target_book_id`,`relation_type`);
--> statement-breakpoint
CREATE INDEX `idx_books_owner_status` ON `books` (`owner_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_books_category` ON `books` (`category_id`);
--> statement-breakpoint
CREATE INDEX `idx_books_visibility` ON `books` (`owner_id`,`visibility`);
--> statement-breakpoint
CREATE INDEX `idx_books_deleted` ON `books` (`owner_id`,`deleted_at`);
--> statement-breakpoint
CREATE INDEX `idx_books_updated` ON `books` (`owner_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_book_files_book` ON `book_files` (`book_id`);
--> statement-breakpoint
CREATE INDEX `idx_book_tags_tag` ON `book_tags` (`tag_id`);
--> statement-breakpoint
CREATE INDEX `idx_status_history_book` ON `status_history` (`book_id`,`changed_at`);
