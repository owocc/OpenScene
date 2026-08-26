CREATE TABLE IF NOT EXISTS `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `organization_slug_unique` ON `organization` (`slug`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `member` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `member_organization_user_unique` ON `member` (`organization_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `member_organization_id_idx` ON `member` (`organization_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `member_user_id_idx` ON `member` (`user_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer,
	`inviter_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `invitation_organization_id_idx` ON `invitation` (`organization_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `invitation_email_idx` ON `invitation` (`email`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `organization_role` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`role` text NOT NULL,
	`permission` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `organization_role_org_role_unique` ON `organization_role` (`organization_id`,`role`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `organization_role_org_idx` ON `organization_role` (`organization_id`);
--> statement-breakpoint
ALTER TABLE `session` ADD COLUMN `active_organization_id` text;
--> statement-breakpoint
INSERT OR IGNORE INTO `organization` (`id`, `name`, `slug`, `created_at`, `updated_at`)
VALUES ('org_default', 'Default Organization', 'default', cast(unixepoch('subsecond') * 1000 as integer), cast(unixepoch('subsecond') * 1000 as integer));
--> statement-breakpoint
INSERT OR IGNORE INTO `member` (`id`, `organization_id`, `user_id`, `role`, `created_at`)
SELECT 'member_default', 'org_default', id, 'owner', cast(unixepoch('subsecond') * 1000 as integer) FROM user LIMIT 1;
--> statement-breakpoint
ALTER TABLE `apps` ADD COLUMN `organization_id` text;
--> statement-breakpoint
UPDATE `apps` SET `organization_id` = 'org_default' WHERE `organization_id` IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `apps_organization_id_idx` ON `apps` (`organization_id`);
--> statement-breakpoint
ALTER TABLE `ai_config` ADD COLUMN `organization_id` text;
--> statement-breakpoint
UPDATE `ai_config` SET `organization_id` = 'org_default' WHERE `organization_id` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ai_config_organization_id_unique` ON `ai_config` (`organization_id`);
--> statement-breakpoint
ALTER TABLE `system_prompts` ADD COLUMN `organization_id` text;
--> statement-breakpoint
UPDATE `system_prompts` SET `organization_id` = 'org_default' WHERE `organization_id` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `system_prompts_organization_id_unique` ON `system_prompts` (`organization_id`);
