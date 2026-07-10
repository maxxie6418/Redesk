ALTER TABLE `books` ADD `import_order` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `books` SET `import_order` = (
  SELECT COUNT(*) FROM `books` AS b2
  WHERE b2.`owner_id` = `books`.owner_id
    AND (b2.`created_at` < `books`.created_at
         OR (b2.`created_at` = `books`.created_at AND b2.`id` <= `books`.id))
);
--> statement-breakpoint
CREATE INDEX `idx_books_import_order` ON `books` (`owner_id`, `import_order`);
