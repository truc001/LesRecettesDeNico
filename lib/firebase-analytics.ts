"use client";

import type { Analytics } from "firebase/analytics";
import type { Recipe } from "@/lib/notion-recipes";
import { getFirebaseApp } from "@/lib/firebase-client";

export const ANALYTICS_CONSENT_KEY = "nico-analytics-consent-v1";
export const ANALYTICS_SETTINGS_EVENT = "nico:open-analytics-settings";

let analyticsPromise: Promise<Analytics | null> | null = null;

export async function enableFirebaseAnalytics() {
  if (typeof window === "undefined") return null;
  if (!analyticsPromise) {
    analyticsPromise = import("firebase/analytics").then(async (sdk) => {
      if (!(await sdk.isSupported())) return null;
      sdk.setConsent({
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      const analytics = sdk.getAnalytics(getFirebaseApp());
      sdk.setAnalyticsCollectionEnabled(analytics, true);
      return analytics;
    }).catch(() => null);
  }
  return analyticsPromise;
}

export async function disableFirebaseAnalytics() {
  if (!analyticsPromise) return;
  const analytics = await analyticsPromise;
  if (!analytics) return;
  const sdk = await import("firebase/analytics");
  sdk.setConsent({
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  sdk.setAnalyticsCollectionEnabled(analytics, false);
}

export async function trackRecipeView(recipe: Pick<Recipe, "id" | "title" | "category">) {
  try {
    const stored = JSON.parse(localStorage.getItem(ANALYTICS_CONSENT_KEY) ?? "null") as { choice?: string; expiresAt?: number } | null;
    if (stored?.choice !== "accepted" || !stored.expiresAt || stored.expiresAt <= Date.now()) return;
    const analytics = await enableFirebaseAnalytics();
    if (!analytics) return;
    const { logEvent } = await import("firebase/analytics");
    logEvent(analytics, "view_recipe", {
      recipe_id: String(recipe.id),
      recipe_name: recipe.title,
      recipe_category: recipe.category,
    });
  } catch {
    // Analytics must never interfere with reading a recipe.
  }
}
