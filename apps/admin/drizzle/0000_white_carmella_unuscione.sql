CREATE TABLE `app_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`kind` text NOT NULL,
	`key_hash` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_keys_hash_unique` ON `app_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `app_keys_app_index` ON `app_keys` (`app_id`);--> statement-breakpoint
CREATE TABLE `apps` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`manifest_mode` text NOT NULL,
	`manifest_url` text,
	`active_manifest_revision_id` text,
	`runtime_public_base_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apps_key_unique` ON `apps` (`key`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`status` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage_key` text NOT NULL,
	`checksum` text,
	`width` integer,
	`height` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `assets_app_status_created_index` ON `assets` (`app_id`,`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `assets_storage_key_unique` ON `assets` (`storage_key`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`scope` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_app_scope_key_unique` ON `categories` (`app_id`,`scope`,`key`);--> statement-breakpoint
CREATE TABLE `document_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`document_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`document_json` text NOT NULL,
	`source_revision` integer NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_versions_document_number_unique` ON `document_versions` (`document_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `document_versions_document_index` ON `document_versions` (`document_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`resource_kind` text NOT NULL,
	`resource_id` text NOT NULL,
	`schema_version` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`draft_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_resource_unique` ON `documents` (`app_id`,`resource_kind`,`resource_id`);--> statement-breakpoint
CREATE TABLE `locales` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locales_app_code_unique` ON `locales` (`app_id`,`code`);--> statement-breakpoint
CREATE TABLE `manifest_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`protocol_version` text NOT NULL,
	`app_key` text NOT NULL,
	`manifest_json` text NOT NULL,
	`checksum` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `manifest_revisions_app_index` ON `manifest_revisions` (`app_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `manifest_revisions_app_checksum_unique` ON `manifest_revisions` (`app_id`,`checksum`);--> statement-breakpoint
CREATE TABLE `pages` (
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
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_app_key_unique` ON `pages` (`app_id`,`key`);--> statement-breakpoint
CREATE TABLE `preview_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`allowed_origins_json` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`encrypted_headers_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `preview_profiles_app_index` ON `preview_profiles` (`app_id`);--> statement-breakpoint
CREATE TABLE `releases` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`document_id` text NOT NULL,
	`version_id` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`storage_key` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`version_id`) REFERENCES `document_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `releases_document_index` ON `releases` (`app_id`,`document_id`,`channel`,`created_at`);--> statement-breakpoint
CREATE TABLE `schema_migrations` (
	`id` text PRIMARY KEY NOT NULL,
	`applied_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `studio_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`resource_kind` text NOT NULL,
	`resource_id` text NOT NULL,
	`preview_profile_id` text NOT NULL,
	`return_url` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`preview_profile_id`) REFERENCES `preview_profiles`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `studio_sessions_app_expiry_index` ON `studio_sessions` (`app_id`,`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `studio_sessions_token_unique` ON `studio_sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `templates` (
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
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `templates_app_key_unique` ON `templates` (`app_id`,`key`);