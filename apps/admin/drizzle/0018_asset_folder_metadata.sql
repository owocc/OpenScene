ALTER TABLE `assets` ADD `folder` text DEFAULT '/' NOT NULL;--> statement-breakpoint
ALTER TABLE `assets` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `metadata` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `duration` integer;--> statement-breakpoint
CREATE INDEX `assets_app_folder_index` ON `assets` (`app_id`,`folder`);
