CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'Mes recettes' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"duration" text DEFAULT 'À préciser' NOT NULL,
	"servings" text DEFAULT 'À préciser' NOT NULL,
	"emoji" text DEFAULT '🍽️' NOT NULL,
	"ingredients" text DEFAULT '' NOT NULL,
	"steps" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
