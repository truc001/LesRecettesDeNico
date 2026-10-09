export type RecipeInput = {
  title: string;
  category: string;
  description: string;
  duration: string;
  servings: string;
  emoji: string;
  ingredients: string;
  steps: string;
  contributor: string;
};

export class RecipeInputError extends Error {}

const forbiddenCharacters = /[<>`\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u;
const executableProtocol = /\b(?:javascript|vbscript|data)\s*:/iu;

type TextOptions = {
  label: string;
  min?: number;
  max: number;
  fallback?: string;
  multiline?: boolean;
  maxLines?: number;
};

function safeText(value: unknown, options: TextOptions) {
  const source = typeof value === "string" ? value : options.fallback ?? "";
  // Tabs come with text pasted from tables; the Firestore rules refuse them.
  const cleaned = source.normalize("NFC").replace(/\r\n?/g, "\n").replace(/\t+/g, " ").trim();
  const normalized = cleaned || options.fallback?.normalize("NFC").trim() || "";
  if (!options.multiline && normalized.includes("\n")) throw new RecipeInputError(`${options.label} doit tenir sur une seule ligne.`);
  if (forbiddenCharacters.test(normalized) || executableProtocol.test(normalized)) throw new RecipeInputError(`${options.label} contient des caractères interdits.`);
  if (normalized.length < (options.min ?? 0)) throw new RecipeInputError(`${options.label} est trop court.`);
  if (normalized.length > options.max) throw new RecipeInputError(`${options.label} est trop long.`);
  if (options.multiline && normalized.split("\n").length > (options.maxLines ?? 80)) throw new RecipeInputError(`${options.label} contient trop de lignes.`);
  return normalized;
}

/** Optional label of a recipe; an empty string removes it. */
export function parseRecipeTag(value: unknown) {
  return safeText(value, { label: "L’étiquette", max: 40 });
}

export function assertAllowedKeys(body: Record<string, unknown>, allowed: string[]) {
  const allowedKeys = new Set(allowed);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) throw new RecipeInputError("La proposition contient des champs non autorisés.");
}

export function parseRecipeInput(body: Record<string, unknown>, requireCompleteRecipe = false): RecipeInput {
  return {
    title: safeText(body.title, { label: "Le nom de la recette", min: requireCompleteRecipe ? 3 : 1, max: 200 }),
    category: safeText(body.category, { label: "La catégorie", min: 1, max: 80, fallback: "Mes recettes" }),
    description: safeText(body.description, { label: "Le résumé", max: 1000, fallback: "Une recette à essayer." }),
    duration: safeText(body.duration, { label: "Le temps total", min: 1, max: 80, fallback: "À préciser" }),
    servings: safeText(body.servings, { label: "Les portions", min: 1, max: 80, fallback: "À préciser" }),
    emoji: safeText(body.emoji, { label: "L’illustration", min: 1, max: 16, fallback: "🍽️" }),
    ingredients: safeText(body.ingredients, { label: "Les ingrédients", min: requireCompleteRecipe ? 3 : 0, max: 4000, multiline: true, maxLines: 80 }),
    steps: safeText(body.steps, { label: "La préparation", min: requireCompleteRecipe ? 3 : 0, max: 4000, multiline: true, maxLines: 80 }),
    contributor: safeText(body.contributor, { label: "La signature", max: 60 }),
  };
}
