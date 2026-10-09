import type { Metadata } from "next";
import { FirebaseAnalytics } from "@/components/firebase-analytics";
import { siteName, siteUrl } from "@/lib/site";
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
    images: [{ url: "/tarte-tatin.jpg", width: 1254, height: 1254, alt: "Tarte aux pommes caramélisées" }],
  },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}<FirebaseAnalytics /></body>
    </html>
  );
}
