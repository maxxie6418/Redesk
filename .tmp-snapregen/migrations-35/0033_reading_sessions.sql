CREATE TABLE `reading_sessions` (
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
CREATE INDEX `idx_reading_sessions_book_owner` ON `reading_sessions` (`book_id`,`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_reading_sessions_owner_started` ON `reading_sessions` (`owner_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_reading_sessions_started_at` ON `reading_sessions` (`started_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
PRAGMA foreign_keys=ON;--> statement-breakpoint
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
ALTER TABLE `__new_topic_notes` RENAME TO `topic_notes`;