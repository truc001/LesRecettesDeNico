import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { FirebaseAnalytics } from "@/components/firebase-analytics";
import { ServiceWorker } from "@/components/service-worker";
import { sharingImage, siteName, siteUrl } from "@/lib/site";
import "./globals.css";

const title = `${siteName} — recettes maison faciles pour tous les jours`;
const description = "Des recettes maison simples et gourmandes : petits-déjeuners, repas du midi et du soir, légumes à faire aimer aux enfants, desserts et gâteaux. Avec un mode pas à pas et une liste de courses.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: `%s — ${siteName}` },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName,
    title,
    description,
    url: "/",
    images: [sharingImage],
  },
  twitter: { card: "summary_large_image" },
};

// viewport-fit=cover lets the bottom bar reach under the home indicator of recent iPhones.
export const viewport: Viewport = { themeColor: "#faf9f5", viewportFit: "cover" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}<FirebaseAnalytics /><Analytics /><ServiceWorker /></body>
    </html>
  );
}
