PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `books_new` (
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
	`deleted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`genre_category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `books_new` (
	`id`,
	`owner_id`,
	`category_id`,
	`title`,
	`author`,
	`subtitle`,
	`isbn`,
	`publisher`,
	`publish_year`,
	`description`,
	`language`,
	`cover_path`,
	`status`,
	`visibility`,
	`reading_purpose`,
	`rating`,
	`custom_attributes`,
	`metadata_source`,
	`source_url`,
	`translator`,
	`original_title`,
	`page_count`,
	`genre_category_id`,
	`favorited_at`,
	`started_at`,
	`finished_at`,
	`deleted_at`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`owner_id`,
	`category_id`,
	`title`,
	NULLIF(`author`, ''),
	`subtitle`,
	`isbn`,
	`publisher`,
	`publish_year`,
	`description`,
	`language`,
	`cover_path`,
	`status`,
	`visibility`,
	`reading_purpose`,
	`rating`,
	`custom_attributes`,
	`metadata_source`,
	`source_url`,
	`translator`,
	`original_title`,
	`page_count`,
	`genre_category_id`,
	`favorited_at`,
	`started_at`,
	`finished_at`,
	`deleted_at`,
	`created_at`,
	`updated_at`
FROM `books`;
--> statement-breakpoint
DROP TABLE `books`;
--> statement-breakpoint
ALTER TABLE `books_new` RENAME TO `books`;
--> statement-breakpoint
CREATE INDEX `idx_books_owner_status` ON `books` (`owner_id`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_books_category` ON `books` (`category_id`);
--> statement-breakpoint
CREATE INDEX `idx_books_visibility` ON `books` (`owner_id`, `visibility`);
--> statement-breakpoint
CREATE INDEX `idx_books_deleted` ON `books` (`owner_id`, `deleted_at`);
--> statement-breakpoint
CREATE INDEX `idx_books_updated` ON `books` (`owner_id`, `updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_books_favorited` ON `books` (`owner_id`, `favorited_at`);
--> statement-breakpoint
CREATE INDEX `idx_books_genre_category` ON `books` (`owner_id`, `genre_category_id`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
