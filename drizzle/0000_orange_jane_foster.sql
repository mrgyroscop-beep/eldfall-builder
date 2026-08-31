CREATE TABLE `datasets` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `match_events` (
	`match_id` text NOT NULL,
	`seq` integer NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`match_id`, `seq`)
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`guest` text,
	`payload` text NOT NULL,
	`revision` integer NOT NULL,
	`updated` text NOT NULL,
	`read_hash` text NOT NULL,
	`edit_hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `match_owner` ON `matches` (`owner`,`updated`);--> statement-breakpoint
CREATE INDEX `match_guest` ON `matches` (`guest`,`updated`);--> statement-breakpoint
CREATE TABLE `roster_versions` (
	`roster_id` text NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL,
	`updated` text NOT NULL,
	PRIMARY KEY(`roster_id`, `revision`)
);
--> statement-breakpoint
CREATE TABLE `rosters` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer NOT NULL,
	`updated` text NOT NULL,
	`read_hash` text NOT NULL,
	`edit_hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `roster_owner` ON `rosters` (`owner`,`updated`);