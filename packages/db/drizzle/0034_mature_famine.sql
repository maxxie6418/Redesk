CREATE TABLE `cloud_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`tested_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_cloud_connections_owner` ON `cloud_connections` (`owner_id`);--> statement-breakpoint
CREATE TABLE `cloud_note_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`connection_id` integer NOT NULL,
	`format` text NOT NULL,
	`remote_key` text NOT NULL,
	`checksum` text,
	`note_count` integer DEFAULT 0 NOT NULL,
	`generated_at` text NOT NULL,
	`sync_status` text DEFAULT 'synced' NOT NULL,
	`error_message` text,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `cloud_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_cloud_note_snapshots_connection_format` ON `cloud_note_snapshots` (`owner_id`,`connection_id`,`format`);--> statement-breakpoint
CREATE TABLE `cloud_usage_assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`usage` text NOT NULL,
	`connection_id` integer NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `cloud_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_cloud_usage_connection` ON `cloud_usage_assignments` (`owner_id`,`usage`,`connection_id`);--> statement-breakpoint
CREATE INDEX `idx_cloud_usage_assignments_owner_usage` ON `cloud_usage_assignments` (`owner_id`,`usage`,`priority`);--> statement-breakpoint
ALTER TABLE `book_covers` ADD `connection_id` integer REFERENCES cloud_connections(id);--> statement-breakpoint
ALTER TABLE `book_files` ADD `connection_id` integer REFERENCES cloud_connections(id);--> statement-breakpoint
INSERT INTO `cloud_connections` (`owner_id`, `name`, `type`, `config`, `is_active`, `created_at`, `updated_at`)
SELECT endpoint.owner_id,
  '迁移的 S3 云存储',
  's3',
  json_object(
    'provider', COALESCE(provider.value, 's3'),
    'endpoint', endpoint.value,
    'bucket', bucket.value,
    'access_key', access_key.value,
    'secret_key', secret_key.value,
    'region', COALESCE(region.value, 'auto'),
    'public_url', public_url.value
  ),
  true,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `settings` endpoint
INNER JOIN `settings` bucket ON bucket.owner_id = endpoint.owner_id AND bucket.key = 'oss_bucket' AND bucket.value <> ''
INNER JOIN `settings` access_key ON access_key.owner_id = endpoint.owner_id AND access_key.key = 'oss_access_key' AND access_key.value <> ''
INNER JOIN `settings` secret_key ON secret_key.owner_id = endpoint.owner_id AND secret_key.key = 'oss_secret_key' AND secret_key.value <> ''
LEFT JOIN `settings` provider ON provider.owner_id = endpoint.owner_id AND provider.key = 'oss_provider'
LEFT JOIN `settings` region ON region.owner_id = endpoint.owner_id AND region.key = 'oss_region'
LEFT JOIN `settings` public_url ON public_url.owner_id = endpoint.owner_id AND public_url.key = 'oss_public_url'
WHERE endpoint.key = 'oss_endpoint' AND endpoint.value <> ''
  AND NOT EXISTS (
    SELECT 1 FROM `cloud_connections` existing
    WHERE existing.owner_id = endpoint.owner_id AND existing.type = 's3'
      AND json_extract(existing.config, '$.endpoint') = endpoint.value
      AND json_extract(existing.config, '$.bucket') = bucket.value
  );--> statement-breakpoint
INSERT OR IGNORE INTO `cloud_usage_assignments` (`owner_id`, `usage`, `connection_id`, `priority`, `created_at`)
SELECT connection.owner_id, usage.usage, connection.id, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `cloud_connections` connection
CROSS JOIN (SELECT 'book_files' AS usage UNION ALL SELECT 'covers') usage
WHERE connection.name = '迁移的 S3 云存储' AND connection.type = 's3';
--> statement-breakpoint
UPDATE `book_files`
SET `connection_id` = (
  SELECT assignment.connection_id
  FROM `cloud_usage_assignments` assignment
  WHERE assignment.owner_id = `book_files`.`owner_id` AND assignment.usage = 'book_files'
  ORDER BY assignment.priority ASC LIMIT 1
)
WHERE `remote_key` IS NOT NULL AND `connection_id` IS NULL;--> statement-breakpoint
UPDATE `book_covers`
SET `connection_id` = (
  SELECT assignment.connection_id
  FROM `cloud_usage_assignments` assignment
  WHERE assignment.owner_id = `book_covers`.`owner_id` AND assignment.usage = 'covers'
  ORDER BY assignment.priority ASC LIMIT 1
)
WHERE `remote_key` IS NOT NULL AND `connection_id` IS NULL;
