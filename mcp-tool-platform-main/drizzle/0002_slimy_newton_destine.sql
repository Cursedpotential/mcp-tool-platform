ALTER TABLE `apiKeys` MODIFY COLUMN `permissions` text NOT NULL;--> statement-breakpoint
ALTER TABLE `systemPrompts` MODIFY COLUMN `variables` text;