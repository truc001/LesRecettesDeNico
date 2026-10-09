import type { Metadata, Viewport } from "next";
import { FirebaseAnalytics } from "@/components/firebase-analytics";
import { ServiceWorker } from "@/components/service-worker";
import { sharingImage, siteName, siteUrl } from "@/lib/site";
import "./globals.css";

const description = "Le carnet personnel de recettes de Nico.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteName, template: `%s — ${siteName}` },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName,
    title: siteName,
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
      <body className="antialiased">{children}<FirebaseAnalytics /><ServiceWorker /></body>
    </html>
  );
}
