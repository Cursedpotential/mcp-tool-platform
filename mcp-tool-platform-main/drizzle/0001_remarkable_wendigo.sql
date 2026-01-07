CREATE TABLE `apiKeyUsageLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`apiKeyId` int NOT NULL,
	`toolName` varchar(255),
	`method` varchar(50),
	`statusCode` int,
	`latencyMs` int,
	`tokensUsed` int,
	`cost` int,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `apiKeyUsageLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `apiKeys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`keyHash` varchar(255) NOT NULL,
	`keyPrefix` varchar(16) NOT NULL,
	`permissions` text NOT NULL,
	`lastUsedAt` timestamp,
	`expiresAt` timestamp,
	`isActive` enum('true','false') NOT NULL DEFAULT 'true',
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `apiKeys_id` PRIMARY KEY(`id`),
	CONSTRAINT `apiKeys_keyHash_unique` UNIQUE(`keyHash`)
);
--> statement-breakpoint
CREATE TABLE `systemPrompts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`toolName` varchar(255),
	`promptText` text NOT NULL,
	`variables` text,
	`version` int NOT NULL DEFAULT 1,
	`parentId` int,
	`isActive` enum('true','false') NOT NULL DEFAULT 'true',
	`successRate` int DEFAULT 0,
	`avgLatencyMs` int DEFAULT 0,
	`usageCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `systemPrompts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflowTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100),
	`steps` text NOT NULL,
	`systemPromptId` int,
	`isPublic` enum('true','false') NOT NULL DEFAULT 'false',
	`usageCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflowTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `apiKeyUsageLogs` ADD CONSTRAINT `apiKeyUsageLogs_apiKeyId_apiKeys_id_fk` FOREIGN KEY (`apiKeyId`) REFERENCES `apiKeys`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `apiKeys` ADD CONSTRAINT `apiKeys_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `systemPrompts` ADD CONSTRAINT `systemPrompts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflowTemplates` ADD CONSTRAINT `workflowTemplates_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflowTemplates` ADD CONSTRAINT `workflowTemplates_systemPromptId_systemPrompts_id_fk` FOREIGN KEY (`systemPromptId`) REFERENCES `systemPrompts`(`id`) ON DELETE no action ON UPDATE no action;