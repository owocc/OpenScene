PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `documents_app_id_unique` ON `documents` (`app_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category_id` text,
	`document_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`app_id`,`document_id`) REFERENCES `documents`(`app_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_pages`("id", "app_id", "key", "title", "description", "category_id", "document_id", "status", "created_at", "updated_at") SELECT "id", "app_id", "key", "title", "description", "category_id", "document_id", "status", "created_at", "updated_at" FROM `pages`;--> statement-breakpoint
DROP TABLE `pages`;--> statement-breakpoint
ALTER TABLE `__new_pages` RENAME TO `pages`;--> statement-breakpoint
CREATE UNIQUE INDEX `pages_app_key_unique` ON `pages` (`app_id`,`key`);--> statement-breakpoint
CREATE TABLE `__new_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category_id` text,
	`document_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`app_id`,`document_id`) REFERENCES `documents`(`app_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_templates`("id", "app_id", "key", "title", "description", "category_id", "document_id", "status", "created_at", "updated_at") SELECT "id", "app_id", "key", "title", "description", "category_id", "document_id", "status", "created_at", "updated_at" FROM `templates`;--> statement-breakpoint
DROP TABLE `templates`;--> statement-breakpoint
ALTER TABLE `__new_templates` RENAME TO `templates`;--> statement-breakpoint
CREATE UNIQUE INDEX `templates_app_key_unique` ON `templates` (`app_id`,`key`);--> statement-breakpoint
PRAGMA foreign_keys=ON;