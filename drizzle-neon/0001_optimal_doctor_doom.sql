ALTER TABLE "recipes" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_source_id_unique" UNIQUE("source_id");