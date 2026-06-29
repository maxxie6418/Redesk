CREATE TABLE `book_file_new` (
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
INSERT INTO `book_file_new` SELECT * FROM `book_file`;
--> statement-breakpoint
DROP TABLE `book_file`;
--> statement-breakpoint
ALTER TABLE `book_file_new` RENAME TO `book_file`;
--> statement-breakpoint
CREATE INDEX `idx_book_file_book` ON `book_file` (`book_id`);
--> statement-breakpoint
CREATE INDEX `idx_book_file_checksum` ON `book_file` (`checksum`);
