CREATE TABLE `reading_progress` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `book_id` integer NOT NULL REFERENCES `books`(`id`),
  `owner_id` integer NOT NULL REFERENCES `users`(`id`),
  `file_id` integer NOT NULL,
  `cfi` text NOT NULL,
  `percentage` real NOT NULL DEFAULT 0,
  `last_read_at` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_reading_progress_book_owner` ON `reading_progress` (`book_id`, `owner_id`);
--> statement-breakpoint
CREATE INDEX `idx_reading_progress_owner_last_read` ON `reading_progress` (`owner_id`, `last_read_at`);
