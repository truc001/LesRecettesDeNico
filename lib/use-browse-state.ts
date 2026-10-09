"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { BrowseFilters } from "@/lib/recipe-browse";

export type BrowseState = BrowseFilters & { favoritesOnly: boolean };

// Names of the filters in the address, e.g. /?moment=desserts&temps=30&q=citron
const PARAMS = { group: "moment", time: "temps", query: "q", tag: "etiquette", favoritesOnly: "favoris" } as const;

/**
 * The carnet's filters live in the address: the back button brings them back
 * after opening a recipe, and a filtered view can be shared as a link.
 */
export function useBrowseState() {
  const params = useSearchParams();
  const state = useMemo<BrowseState>(() => ({
    group: params.get(PARAMS.group) ?? "",
    time: params.get(PARAMS.time) ?? "",
    query: params.get(PARAMS.query) ?? "",
    tag: params.get(PARAMS.tag) ?? "",
    favoritesOnly: params.get(PARAMS.favoritesOnly) === "1",
  }), [params]);

  /** `replace` keeps typing in the search box out of the history. */
  const update = useCallback((patch: Partial<BrowseState>, replace = false) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch) as Array<[keyof BrowseState, string | boolean]>) {
      const text = value === true ? "1" : value || "";
      if (text) next.set(PARAMS[key], text); else next.delete(PARAMS[key]);
    }
    const address = next.size ? `?${next}` : window.location.pathname;
    // Next.js keeps useSearchParams in sync with the History API.
    if (replace) window.history.replaceState(null, "", address); else window.history.pushState(null, "", address);
  }, []);
  const reset = useCallback(() => window.history.pushState(null, "", window.location.pathname), []);

  return { ...state, active: Boolean(state.group || state.time || state.query || state.tag || state.favoritesOnly), update, reset };
}
