import type { MetadataRoute } from "next";
import { siteName } from "@/lib/site";

/** Lets a phone install the site on its home screen, where it opens like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: "Recettes de Nico",
    description: "Le carnet personnel de recettes de Nico.",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f5",
    theme_color: "#faf9f5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
