UPDATE `book_files`
SET
  `storage_mode` = CASE
    WHEN `storage_driver` = 's3' THEN 'cloud_only'
    ELSE 'local_only'
  END,
  `local_path` = CASE WHEN `storage_driver` = 'local' THEN `file_path` ELSE NULL END,
  `remote_key` = CASE WHEN `storage_driver` = 's3' THEN `file_path` ELSE NULL END,
  `primary_location` = CASE WHEN `storage_driver` = 's3' THEN 'cloud' ELSE 'local' END,
  `sync_status` = 'synced';
