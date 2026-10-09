"use client";

import { useEffect } from "react";

/** Registers public/sw.js, which keeps visited pages and favorite recipes readable without network. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
