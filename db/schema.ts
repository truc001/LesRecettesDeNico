import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull().default("Mes recettes"),
  description: text("description").notNull().default(""),
  duration: text("duration").notNull().default("À préciser"),
  servings: text("servings").notNull().default("À préciser"),
  emoji: text("emoji").notNull().default("🍽️"),
  ingredients: text("ingredients").notNull().default(""),
  steps: text("steps").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
