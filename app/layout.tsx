import type { Metadata } from "next";
import { FirebaseAnalytics } from "@/components/firebase-analytics";
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
