CREATE UNIQUE INDEX `idx_book_rel_unique` ON `book_relations` (`source_book_id`,`target_book_id`,`relation_type`);
