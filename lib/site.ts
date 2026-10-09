/** Public origin of the site, used for canonical URLs, the sitemap and social previews. */
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const siteName = "Les recettes de Nico";

/** Picture shown when a page of the site is shared. */
export const sharingImage = { url: "/tarte-tatin.jpg", width: 1254, height: 1254, alt: "Tarte aux pommes caramélisées" };

export const recipePath = (id: string | number) => `/recettes/${encodeURIComponent(String(id))}`;
