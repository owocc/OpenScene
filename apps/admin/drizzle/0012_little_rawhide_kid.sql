CREATE TABLE `ai_chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`resource_kind` text NOT NULL,
	`resource_id` text NOT NULL,
	`json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_chat_sessions_resource_unique` ON `ai_chat_sessions` (`app_id`,`resource_kind`,`resource_id`);--> statement-breakpoint
CREATE INDEX `ai_chat_sessions_app_idx` ON `ai_chat_sessions` (`app_id`);