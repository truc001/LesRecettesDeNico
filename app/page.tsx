import { connection } from "next/server";
import { Carnet } from "@/components/carnet";
import { getRecipes } from "@/lib/recipes-cache";

export default async function Home() {
  // Rendered per request: the CSP nonce is per request, and Firestore is not reachable at build time.
  await connection();
  const recipes = await getRecipes().catch(() => null);
  // No Suspense boundary around the carnet: React would leave it non-interactive
  // until the visitor's first gesture, and that first click could be lost.
  return <Carnet initialRecipes={recipes ?? []} loadError={!recipes} />;
}
