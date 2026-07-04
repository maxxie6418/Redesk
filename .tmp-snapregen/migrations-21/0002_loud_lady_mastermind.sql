CREATE TABLE `bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`owner_id` integer NOT NULL,
	`cfi` text NOT NULL,
	`label` text,
	`percentage` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON DELETE CASCADE,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `idx_bookmarks_book` ON `bookmarks` (`book_id`);
--> statement-breakpoint
CREATE INDEX `idx_bookmarks_owner` ON `bookmarks` (`owner_id`);
--> statement-breakpoint
ALTER TABLE `books` ADD COLUMN `subtitle` text;
--> statement-breakpoint
ALTER TABLE `books` ADD COLUMN `source_url` text;
--> statement-breakpoint
ALTER TABLE `books` ADD COLUMN `translator` text;
--> statement-breakpoint
ALTER TABLE `books` ADD COLUMN `original_title` text;
--> statement-breakpoint
ALTER TABLE `books` ADD COLUMN `page_count` integer;
--> statement-breakpoint
ALTER TABLE `books` ADD COLUMN `genre_category_id` integer;
--> statement-breakpoint
ALTER TABLE `books` ADD COLUMN `favorited_at` text;
--> statement-breakpoint
ALTER TABLE `books` ADD COLUMN `started_at` text;
--> statement-breakpoint
ALTER TABLE `books` ADD COLUMN `finished_at` text;
--> statement-breakpoint
CREATE INDEX `idx_books_favorited` ON `books` (`owner_id`, `favorited_at`);
--> statement-breakpoint
CREATE INDEX `idx_books_genre_category` ON `books` (`owner_id`, `genre_category_id`);
--> statement-breakpoint
ALTER TABLE `categories` ADD COLUMN `type` text DEFAULT 'PERSONAL' NOT NULL;
--> statement-breakpoint
DROP INDEX `idx_categories_owner_name`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_owner_name_type` ON `categories` (`owner_id`, `name`, `type`);
