CREATE TABLE `book_files_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`book_id` integer REFERENCES `books`(`id`) ON DELETE SET NULL,
	`file_path` text NOT NULL,
	`original_filename` text,
	`file_format` text NOT NULL,
	`mime_type` text,
	`file_size` integer,
	`checksum` text,
	`is_primary` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `book_files_new` (
	`id`,
	`owner_id`,
	`book_id`,
	`file_path`,
	`original_filename`,
	`file_format`,
	`mime_type`,
	`file_size`,
	`checksum`,
	`is_primary`,
	`created_at`,
	`updated_at`
)
SELECT
	`book_files`.`id`,
	COALESCE(`books`.`owner_id`, (SELECT `id` FROM `users` ORDER BY `id` LIMIT 1)),
	`book_files`.`book_id`,
	`book_files`.`file_path`,
	`book_files`.`original_filename`,
	`book_files`.`file_format`,
	`book_files`.`mime_type`,
	`book_files`.`file_size`,
	`book_files`.`checksum`,
	`book_files`.`is_primary`,
	`book_files`.`created_at`,
	`book_files`.`updated_at`
FROM `book_files`
LEFT JOIN `books` ON `book_files`.`book_id` = `books`.`id`
WHERE COALESCE(`books`.`owner_id`, (SELECT `id` FROM `users` ORDER BY `id` LIMIT 1)) IS NOT NULL;
--> statement-breakpoint
DROP TABLE `book_files`;
--> statement-breakpoint
ALTER TABLE `book_files_new` RENAME TO `book_files`;
--> statement-breakpoint
CREATE INDEX `idx_book_files_owner` ON `book_files` (`owner_id`);
--> statement-breakpoint
CREATE INDEX `idx_book_files_owner_book` ON `book_files` (`owner_id`, `book_id`);
--> statement-breakpoint
CREATE INDEX `idx_book_files_checksum` ON `book_files` (`owner_id`, `checksum`);
