CREATE TABLE `book_covers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`book_file_id` integer,
	`source_type` text NOT NULL,
	`source_label` text,
	`original_url` text,
	`file_path` text NOT NULL,
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
CREATE INDEX `idx_book_covers_owner_book` ON `book_covers` (`owner_id`, `book_id`);
--> statement-breakpoint
CREATE INDEX `idx_book_covers_book_active` ON `book_covers` (`book_id`, `is_active`);
--> statement-breakpoint
INSERT INTO `book_covers` (
	`owner_id`,
	`book_id`,
	`source_type`,
	`source_label`,
	`file_path`,
	`mime_type`,
	`is_active`,
	`created_at`,
	`updated_at`
)
SELECT
	`owner_id`,
	`id`,
	'EPUB_EXTRACTED',
	'legacy',
	`cover_path`,
	CASE
		WHEN lower(`cover_path`) LIKE '%.png' THEN 'image/png'
		WHEN lower(`cover_path`) LIKE '%.gif' THEN 'image/gif'
		WHEN lower(`cover_path`) LIKE '%.webp' THEN 'image/webp'
		WHEN lower(`cover_path`) LIKE '%.svg' THEN 'image/svg+xml'
		ELSE 'image/jpeg'
	END,
	1,
	`created_at`,
	`updated_at`
FROM `books`
WHERE `cover_path` IS NOT NULL;
