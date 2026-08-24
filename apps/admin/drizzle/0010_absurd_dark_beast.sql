DROP TABLE IF EXISTS `app_prompts`;
--> statement-breakpoint
CREATE TABLE `app_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`system` text NOT NULL,
	`sections` text DEFAULT '[]' NOT NULL,
	`injected_components` text DEFAULT '[]' NOT NULL,
	`injected_openapi_doc_ids` text DEFAULT '[]' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_prompts_app_key_unique` ON `app_prompts` (`app_id`,`key`);
--> statement-breakpoint
CREATE INDEX `app_prompts_app_index` ON `app_prompts` (`app_id`);