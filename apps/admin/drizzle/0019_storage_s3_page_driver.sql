ALTER TABLE `app_storage_configs` ADD `page_driver` text DEFAULT 'database' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_storage_configs` ADD `s3_enabled` integer DEFAULT false NOT NULL;
