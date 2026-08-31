CREATE TABLE `invite_attempts` (
	`actor` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`attempts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `match_invite_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`invite_hash` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_invite_codes_match_id_unique` ON `match_invite_codes` (`match_id`);--> statement-breakpoint
CREATE TABLE `match_invite_grants` (
	`match_id` text NOT NULL,
	`actor` text NOT NULL,
	`invite_hash` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`match_id`, `actor`)
);
