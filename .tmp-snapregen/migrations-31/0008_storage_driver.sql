ALTER TABLE `book_files` ADD COLUMN `storage_driver` text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE `book_covers` ADD COLUMN `storage_driver` text DEFAULT 'local' NOT NULL;
