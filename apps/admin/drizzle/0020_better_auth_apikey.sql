CREATE TABLE IF NOT EXISTS `apikey` (
  `id` text PRIMARY KEY NOT NULL,
  `config_id` text DEFAULT 'default' NOT NULL,
  `name` text,
  `start` text,
  `prefix` text,
  `key` text NOT NULL,
  `reference_id` text NOT NULL,
  `refill_interval` integer,
  `refill_amount` integer,
  `last_refill_at` integer,
  `enabled` integer DEFAULT true NOT NULL,
  `rate_limit_enabled` integer DEFAULT true NOT NULL,
  `rate_limit_time_window` integer DEFAULT 86400000 NOT NULL,
  `rate_limit_max` integer DEFAULT 1000 NOT NULL,
  `request_count` integer DEFAULT 0 NOT NULL,
  `remaining` integer,
  `last_request` integer,
  `expires_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `permissions` text,
  `metadata` text
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `apikey_key_unique` ON `apikey` (`key`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `apikey_reference_id_idx` ON `apikey` (`reference_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `apikey_config_id_idx` ON `apikey` (`config_id`);