CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT 'Mes recettes' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`duration` text DEFAULT 'À préciser' NOT NULL,
	`servings` text DEFAULT 'À préciser' NOT NULL,
	`emoji` text DEFAULT '🍽️' NOT NULL,
	`ingredients` text DEFAULT '' NOT NULL,
	`steps` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
