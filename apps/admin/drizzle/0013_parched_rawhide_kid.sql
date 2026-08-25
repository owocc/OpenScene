CREATE TABLE `app_storage_configs` (
	`app_id` text PRIMARY KEY NOT NULL,
	`driver` text DEFAULT 'database' NOT NULL,
	`endpoint` text,
	`region` text DEFAULT 'auto',
	`bucket` text,
	`access_key_id` text,
	`secret_access_key_enc` text,
	`force_path_style` integer DEFAULT true NOT NULL,
	`public_base_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `app_storage_configs_app_idx` ON `app_storage_configs` (`app_id`);