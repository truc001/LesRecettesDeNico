// Service worker of Les recettes de Nico: keeps the site readable without network.
// The network always comes first for pages, so nothing shown online is ever stale;
// the copies below are only used when it fails.
const PAGES = "nico-pages-v1";
// The favorite button (components/favorite-button.tsx) fills a third cache, "nico-favoris",
// which caches.match() below searches like the others.
const ASSETS = "nico-assets-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(PAGES)).put(request, response.clone());
    return response;
  } catch {
    const saved = await caches.match(request, { ignoreVary: true }) ?? await caches.match(new URL(request.url).pathname, { ignoreVary: true });
    if (saved) return saved;
    if (request.mode !== "navigate") return Response.error();
    return new Response("<!doctype html><html lang=\"fr\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>Hors connexion</title><body style=\"margin:0;display:grid;place-items:center;min-height:100vh;padding:24px;background:#faf9f5;color:#243d33;font-family:Georgia,serif;text-align:center\"><div><h1 style=\"font-weight:400\">Pas de réseau pour le moment.</h1><p style=\"font-family:sans-serif;color:#59645b\">Vos recettes favorites déjà ouvertes restent lisibles. Réessayez dès que la connexion revient.</p></div>", { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

// Photos and build files: the saved copy at once, refreshed in the background.
async function cacheFirst(request) {
  const saved = await caches.match(request, { ignoreVary: true });
  const fresh = fetch(request).then(async (response) => {
    if (response.ok) (await caches.open(ASSETS)).put(request, response.clone());
    return response;
  });
  if (saved) { fresh.catch(() => undefined); return saved; }
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/photos/") || url.pathname.startsWith("/_next/static/") || /^\/(logo|icon[^/]*|apple-icon)\.png$/.test(url.pathname)) return event.respondWith(cacheFirst(request));
  if (request.mode === "navigate" || url.pathname === "/api/recipes") return event.respondWith(networkFirst(request));
});
