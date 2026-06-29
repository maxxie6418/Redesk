CREATE TABLE `book_files_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer REFERENCES `books`(`id`) ON DELETE SET NULL,
	`file_path` text NOT NULL,
	`original_filename` text,
	`file_format` text NOT NULL,
	`mime_type` text,
	`file_size` integer,
	`checksum` text,
	`is_primary` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `book_files_new` SELECT * FROM `book_files`;
--> statement-breakpoint
DROP TABLE `book_files`;
--> statement-breakpoint
ALTER TABLE `book_files_new` RENAME TO `book_files`;
--> statement-breakpoint
CREATE INDEX `idx_book_files_book` ON `book_files` (`book_id`);
--> statement-breakpoint
CREATE INDEX `idx_book_files_checksum` ON `book_files` (`checksum`);
