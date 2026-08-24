CREATE TABLE `ai_config` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`base_url` text,
	`api_key_enc` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_config_provider_index` ON `ai_config` (`provider`);