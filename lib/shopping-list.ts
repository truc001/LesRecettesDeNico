/**
 * Builds a shopping list from recipes: ingredient lines are free text, so each
 * one is parsed into a quantity, a unit and a name, and identical ingredients
 * are added up across recipes ("100 g de farine" + "150 g de farine").
 */

export type ShoppingItem = {
  /** Stable identifier of the ingredient, used to remember ticked items. */
  key: string;
  /** What to buy, e.g. "300 g de farine" or "5 œufs". */
  label: string;
  /** Titles of the recipes that need it. */
  recipes: string[];
};

export type ShoppingList = {
  /** Ingredients with a quantity, summed across recipes. */
  items: ShoppingItem[];
  /** Ingredients without a usable quantity (salt, pepper, "to serve"…). */
  extras: ShoppingItem[];
};

type ShoppingRecipe = { title: string; ingredients: string };

// Units that convert into one another, expressed in the base unit of their family.
const MEASURES: Record<string, { unit: "g" | "cl" | "spoon"; factor: number }> = {
  mg: { unit: "g", factor: 0.001 }, g: { unit: "g", factor: 1 }, kg: { unit: "g", factor: 1000 },
  ml: { unit: "cl", factor: 0.1 }, cl: { unit: "cl", factor: 1 }, dl: { unit: "cl", factor: 10 },
  l: { unit: "cl", factor: 100 }, litre: { unit: "cl", factor: 100 }, litres: { unit: "cl", factor: 100 },
};
// Spoons are counted in teaspoons: one tablespoon holds three. Also written "c. à soupe".
const SPOON = "(?:cuillères?|c\\.?\\s?s?\\.?)\\s+à\\s+(?:soupe|café)";
// Other units, singular then plural. They only add up with themselves.
const COUNT_UNITS: Array<[string, string]> = [
  ["sachet", "sachets"], ["gousse", "gousses"], ["tranche", "tranches"], ["boîte", "boîtes"], ["pot", "pots"],
  ["feuille", "feuilles"], ["branche", "branches"], ["bouquet", "bouquets"], ["brin", "brins"], ["poignée", "poignées"],
  ["morceau", "morceaux"], ["portion", "portions"], ["cube", "cubes"], ["bûche", "bûches"], ["filet", "filets"], ["verre", "verres"],
];
const UNIT_PATTERN = [SPOON, ...[...Object.keys(MEASURES), ...COUNT_UNITS.flat(), "pincée", "pincées"].sort((a, b) => b.length - a.length)].join("|");
const SIZE = "(?:(?:petite?|grosse|gros|grande?|belle|beau|bonne?)s?\\s+)?";
const QUANTITY = "(\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+(?:[.,]\\d+)?(?:\\s*/\\s*\\d+)?)";
const WITH_UNIT = new RegExp(`^${QUANTITY}\\s*${SIZE}(${UNIT_PATTERN})\\s+(?:de\\s+|d[’'])(.+)$`, "i");
const WITHOUT_UNIT = new RegExp(`^${QUANTITY}\\s+${SIZE}(.+)$`, "i");
// How the ingredient is prepared does not change what has to be bought.
const PREPARATION = /\s+(?:fondue?s?|mou|molle|froide?s?|tièdes?|chaude?s?|râpée?s?|hachée?s?|émincée?s?|ciselée?s?|tamisée?s?|grillée?s?|en (?:dés|morceaux|rondelles|lanières|copeaux|quartiers|conserve)|bien mûre?s?|très fraîche?s?|très frais|extra-frais|à température ambiante|entiers?|entières?|non traitée?s?|dénoyautée?s?|décortiquée?s?|égouttée?s?)(?=\s|$)/gi;
// Not bought: tap water and ice.
const NOT_BOUGHT = new Set(["eau", "eau bouillante", "eau tiede", "eau froide", "eau chaude", "glacon"]);

const collator = new Intl.Collator("fr");
const plain = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/œ/g, "oe");
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase("fr") + text.slice(1);

function parseQuantity(text: string) {
  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const [value, divisor] = text.replace(",", ".").split("/").map((part) => Number(part.trim()));
  return divisor ? value / divisor : value;
}

/** "beurre fondu (tiède)" → "beurre"; "lait ou boisson végétale" → "lait". */
function cleanName(name: string) {
  return name.replace(/\([^)]*\)/g, " ")
    .replace(/\s+pour (?:servir|garnir|dorer|la poêle|les ramequins|le moule|la pâte).*$/i, "")
    .replace(/\s+d[’']environ\s.*$/i, "").replace(/\s+de \d+(?:[.,]\d+)? cm.*$/i, "")
    .split(/\s+ou\s+|,/)[0].replace(PREPARATION, "").replace(/\s+/g, " ").trim();
}

/** Same ingredient whatever the accents and the number: "Œufs" and "œuf" share a key. */
export function nameKey(name: string) {
  return plain(name).split(" ").map((word) => word.length > 3 ? word.replace(/[sx]$/, "") : word).join(" ");
}

/** Name of the ingredient on a line, without its quantity: "120 g de chocolat noir" → "chocolat noir". */
export function ingredientName(line: string) {
  const text = line.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  return cleanName(WITH_UNIT.exec(text)?.[3] ?? WITHOUT_UNIT.exec(text)?.[2] ?? text);
}

function formatNumber(value: number) {
  const rounded = Math.round(value * 100) / 100;
  if (rounded === 0.5) return "1/2";
  if (rounded === 0.25) return "1/4";
  if (rounded === 0.75) return "3/4";
  return String(rounded).replace(".", ",");
}

function formatAmount(unit: string, quantity: number) {
  if (unit === "g") return quantity >= 1000 ? `${formatNumber(quantity / 1000)} kg` : `${formatNumber(quantity)} g`;
  if (unit === "cl") return quantity >= 100 ? `${formatNumber(quantity / 100)} l` : `${formatNumber(quantity)} cl`;
  if (unit === "spoon") {
    const spoons = (count: number, kind: string) => `${formatNumber(count)} ${count >= 2 ? "cuillères" : "cuillère"} à ${kind}`;
    const tablespoons = Math.floor(quantity / 3);
    const teaspoons = Math.round((quantity - tablespoons * 3) * 100) / 100;
    return [...(tablespoons ? [spoons(tablespoons, "soupe")] : []), ...(teaspoons ? [spoons(teaspoons, "café")] : [])].join(" + ");
  }
  const plural = COUNT_UNITS.find(([singular]) => singular === unit)?.[1] ?? unit;
  return `${formatNumber(quantity)} ${quantity >= 2 ? plural : unit}`;
}

const looksPlural = (name: string) => /[sx]$/.test(name.split(" ")[0]);
/** "citron vert" → "citrons verts", "pomme de terre" → "pommes de terre": the plural stops at the first preposition. */
function pluralize(name: string) {
  const words = name.split(" ");
  const stop = words.findIndex((word) => /^(?:de|du|des|à|au|aux|en|d[’'].*)$/i.test(word));
  return words.map((word, index) => (stop === -1 || index < stop) && !/[sxz]$/.test(word) ? `${word}s` : word).join(" ");
}
// French does not elide before an aspirated h: "de haricots", but "d’huile".
const elides = (name: string) => /^(?:[aeiouy]|h(?!aricot|achis|areng|omard|oumous))/.test(plain(name));

type Entry = { names: string[]; amounts: Map<string, number>; recipes: string[] };

export function buildShoppingList(recipes: ShoppingRecipe[]): ShoppingList {
  const entries = new Map<string, Entry>();
  const extras = new Map<string, ShoppingItem>();

  function addExtra(text: string, recipe: string) {
    const label = capitalize(cleanName(text));
    const key = nameKey(label);
    if (!label || NOT_BOUGHT.has(key)) return;
    const extra = extras.get(key) ?? { key: `extra:${key}`, label, recipes: [] };
    if (!extra.recipes.includes(recipe)) extra.recipes.push(recipe);
    extras.set(key, extra);
  }

  function addAmount(rawName: string, unit: string, quantity: number, recipe: string) {
    const name = cleanName(rawName);
    const key = nameKey(name);
    if (!name || NOT_BOUGHT.has(key)) return;
    const entry: Entry = entries.get(key) ?? { names: [], amounts: new Map(), recipes: [] };
    if (!entry.names.includes(name)) entry.names.push(name);
    entry.amounts.set(unit, (entry.amounts.get(unit) ?? 0) + quantity);
    if (!entry.recipes.includes(recipe)) entry.recipes.push(recipe);
    entries.set(key, entry);
  }

  function addPart(part: string, recipe: string) {
    const text = part.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return;
    // "4 à 6 pommes" has no single quantity to add up.
    if (/^\d+(?:[.,]\d+)?\s+à\s+\d/.test(text)) return addExtra(text, recipe);
    const measured = WITH_UNIT.exec(text);
    if (measured) {
      const unit = measured[2].toLowerCase();
      if (unit.startsWith("pincée")) return addExtra(measured[3], recipe);
      const measure = /à\s+soupe$/.test(unit) ? { unit: "spoon", factor: 3 } : /à\s+café$/.test(unit) ? { unit: "spoon", factor: 1 } : MEASURES[unit];
      if (measure) return addAmount(measured[3], measure.unit, parseQuantity(measured[1]) * measure.factor, recipe);
      const singular = COUNT_UNITS.find((forms) => forms.includes(unit))?.[0] ?? unit;
      return addAmount(measured[3], singular, parseQuantity(measured[1]), recipe);
    }
    const counted = WITHOUT_UNIT.exec(text);
    if (counted) return addAmount(counted[2], "", parseQuantity(counted[1]), recipe);
    addExtra(text.replace(/^(?:le même poids de|quelques|un peu d[e’']|une?|des|du|de la|le|la|les)\s+/i, ""), recipe);
  }

  for (const recipe of recipes) {
    for (const line of recipe.ingredients.split("\n").map((item) => item.trim()).filter(Boolean)) {
      // "Pour servir : riz basmati et coriandre" and "Sel, poivre" hold several ingredients.
      const prefixed = /^[^:\d]{2,40}:\s*(.+)$/.exec(line);
      const content = prefixed ? prefixed[1] : line;
      const several = prefixed || !/^\d/.test(content);
      const parts = several ? content.replace(/\([^)]*\)/g, " ").split(/,\s*|\s+et\s+/) : [content];
      for (const part of parts) addPart(part, recipe.title);
    }
  }

  const items = [...entries].map(([key, entry]): ShoppingItem => {
    const total = entry.amounts.get("") ?? 0;
    const shortest = [...entry.names].sort((a, b) => a.length - b.length)[0];
    const plural = entry.names.find(looksPlural);
    // A plain count carries the plural itself: "5 œufs", "1 citron".
    const countName = total >= 2 ? plural ?? pluralize(shortest) : entry.names.find((name) => !looksPlural(name)) ?? shortest;
    const measuredName = plural ?? shortest;
    const measured = [...entry.amounts].filter(([unit]) => unit).map(([unit, quantity]) => formatAmount(unit, quantity));
    const parts = [
      ...(measured.length ? [`${measured.join(" + ")} ${elides(measuredName) ? "d’" : "de "}${measuredName}`] : []),
      ...(total ? [`${formatNumber(total)} ${countName}`] : []),
    ];
    return { key, label: parts.join(" + "), recipes: entry.recipes };
  }).sort((a, b) => collator.compare(a.key, b.key));

  return {
    items,
    // Salt listed "to taste" is redundant once a quantity of it is on the list.
    extras: [...extras].filter(([key]) => !entries.has(key)).map(([, extra]) => extra).sort((a, b) => collator.compare(a.label, b.label)),
  };
}
