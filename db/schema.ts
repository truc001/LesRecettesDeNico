import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const recipes = sqliteTable("recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  category: text("category").notNull().default("Mes recettes"),
  description: text("description").notNull().default(""),
  duration: text("duration").notNull().default("À préciser"),
  servings: text("servings").notNull().default("À préciser"),
  emoji: text("emoji").notNull().default("🍽️"),
  ingredients: text("ingredients").notNull().default(""),
  steps: text("steps").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
