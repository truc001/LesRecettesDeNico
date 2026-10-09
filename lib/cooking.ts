import { ingredientName, nameKey } from "./shopping-list";

/**
 * Ingredient lines a step calls for: those whose main word appears in the step
 * ("Faites fondre le chocolat avec le beurre" → chocolate and butter lines).
 */
export function stepIngredients(step: string, ingredients: string[]) {
  const words = new Set(nameKey(step.replace(/[^\p{L}\p{N}]+/gu, " ").trim()).split(" "));
  return ingredients.filter((line) => {
    const main = nameKey(ingredientName(line)).split(" ")[0];
    return main.length >= 3 && words.has(main);
  });
}

/** Minutes a step asks to wait ("Enfournez 9 à 10 minutes" → 9, "Laissez lever 1 h 30" → 90), or null. */
export function stepMinutes(step: string) {
  const hours = /(\d+)\s*(?:h|heures?)\b(?:\s*(\d+))?/i.exec(step);
  if (hours) return Number(hours[1]) * 60 + Number(hours[2] ?? 0);
  const minutes = /(\d+)(?:\s*à\s*\d+)?\s*(?:minutes?|min)\b/i.exec(step);
  return minutes ? Number(minutes[1]) : null;
}
