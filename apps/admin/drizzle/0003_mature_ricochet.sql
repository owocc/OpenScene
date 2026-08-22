ALTER TABLE `apps` ADD `type` text DEFAULT 'web' NOT NULL;--> statement-breakpoint
UPDATE `apps` SET `type` = 'web' WHERE `type` IS NULL;