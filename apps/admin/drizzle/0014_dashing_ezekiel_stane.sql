CREATE TABLE `storage_objects` (
	`key` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`checksum` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `storage_objects_app_idx` ON `storage_objects` (`app_id`);--> statement-breakpoint
DROP INDEX "ai_chat_sessions_resource_unique";--> statement-breakpoint
DROP INDEX "ai_chat_sessions_app_idx";--> statement-breakpoint
DROP INDEX "ai_config_provider_index";--> statement-breakpoint
DROP INDEX "app_keys_hash_unique";--> statement-breakpoint
DROP INDEX "app_keys_app_index";--> statement-breakpoint
DROP INDEX "app_openapi_docs_app_index";--> statement-breakpoint
DROP INDEX "app_prompts_app_key_unique";--> statement-breakpoint
DROP INDEX "app_prompts_app_index";--> statement-breakpoint
DROP INDEX "app_storage_configs_app_idx";--> statement-breakpoint
DROP INDEX "apps_key_unique";--> statement-breakpoint
DROP INDEX "assets_app_status_created_index";--> statement-breakpoint
DROP INDEX "assets_storage_key_unique";--> statement-breakpoint
DROP INDEX "categories_app_scope_key_unique";--> statement-breakpoint
DROP INDEX "document_versions_document_number_unique";--> statement-breakpoint
DROP INDEX "document_versions_document_index";--> statement-breakpoint
DROP INDEX "documents_resource_unique";--> statement-breakpoint
DROP INDEX "documents_app_id_unique";--> statement-breakpoint
DROP INDEX "locales_app_code_unique";--> statement-breakpoint
DROP INDEX "manifest_revisions_app_index";--> statement-breakpoint
DROP INDEX "manifest_revisions_app_checksum_unique";--> statement-breakpoint
DROP INDEX "pages_app_key_unique";--> statement-breakpoint
DROP INDEX "preview_profiles_app_index";--> statement-breakpoint
DROP INDEX "releases_document_index";--> statement-breakpoint
DROP INDEX "storage_objects_app_idx";--> statement-breakpoint
DROP INDEX "studio_sessions_app_expiry_index";--> statement-breakpoint
DROP INDEX "studio_sessions_token_unique";--> statement-breakpoint
DROP INDEX "templates_app_key_unique";--> statement-breakpoint
ALTER TABLE `app_storage_configs` ALTER COLUMN "driver" TO "driver" text NOT NULL DEFAULT 'database';--> statement-breakpoint
CREATE UNIQUE INDEX `ai_chat_sessions_resource_unique` ON `ai_chat_sessions` (`app_id`,`resource_kind`,`resource_id`);--> statement-breakpoint
CREATE INDEX `ai_chat_sessions_app_idx` ON `ai_chat_sessions` (`app_id`);--> statement-breakpoint
CREATE INDEX `ai_config_provider_index` ON `ai_config` (`provider`);--> statement-breakpoint
CREATE UNIQUE INDEX `app_keys_hash_unique` ON `app_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `app_keys_app_index` ON `app_keys` (`app_id`);--> statement-breakpoint
CREATE INDEX `app_openapi_docs_app_index` ON `app_openapi_docs` (`app_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `app_prompts_app_key_unique` ON `app_prompts` (`app_id`,`key`);--> statement-breakpoint
CREATE INDEX `app_prompts_app_index` ON `app_prompts` (`app_id`);--> statement-breakpoint
CREATE INDEX `app_storage_configs_app_idx` ON `app_storage_configs` (`app_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `apps_key_unique` ON `apps` (`key`);--> statement-breakpoint
CREATE INDEX `assets_app_status_created_index` ON `assets` (`app_id`,`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `assets_storage_key_unique` ON `assets` (`storage_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_app_scope_key_unique` ON `categories` (`app_id`,`scope`,`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `document_versions_document_number_unique` ON `document_versions` (`document_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `document_versions_document_index` ON `document_versions` (`document_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `documents_resource_unique` ON `documents` (`app_id`,`resource_kind`,`resource_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `documents_app_id_unique` ON `documents` (`app_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `locales_app_code_unique` ON `locales` (`app_id`,`code`);--> statement-breakpoint
CREATE INDEX `manifest_revisions_app_index` ON `manifest_revisions` (`app_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `manifest_revisions_app_checksum_unique` ON `manifest_revisions` (`app_id`,`checksum`);--> statement-breakpoint
CREATE UNIQUE INDEX `pages_app_key_unique` ON `pages` (`app_id`,`key`);--> statement-breakpoint
CREATE INDEX `preview_profiles_app_index` ON `preview_profiles` (`app_id`);--> statement-breakpoint
CREATE INDEX `releases_document_index` ON `releases` (`app_id`,`document_id`,`channel`,`created_at`);--> statement-breakpoint
CREATE INDEX `studio_sessions_app_expiry_index` ON `studio_sessions` (`app_id`,`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `studio_sessions_token_unique` ON `studio_sessions` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `templates_app_key_unique` ON `templates` (`app_id`,`key`);--> statement-breakpoint
ALTER TABLE `app_storage_configs` ALTER COLUMN "region" TO "region" text DEFAULT 'auto';--> statement-breakpoint
ALTER TABLE `app_storage_configs` ALTER COLUMN "bucket" TO "bucket" text;--> statement-breakpoint
ALTER TABLE `app_storage_configs` ALTER COLUMN "access_key_id" TO "access_key_id" text;--> statement-breakpoint
ALTER TABLE `app_storage_configs` ALTER COLUMN "secret_access_key_enc" TO "secret_access_key_enc" text;