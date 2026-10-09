import { Suspense } from "react";
import { connection } from "next/server";
import { Carnet } from "@/components/carnet";
import { getRecipes } from "@/lib/recipes-cache";

export default async function Home() {
  // Rendered per request: the CSP nonce is per request, and Firestore is not reachable at build time.
  await connection();
  const recipes = await getRecipes().catch(() => null);
  // The carnet reads its filters from the address, which needs a Suspense boundary.
  return <Suspense><Carnet initialRecipes={recipes ?? []} loadError={!recipes} /></Suspense>;
}
