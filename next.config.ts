import type { NextConfig } from "next";

// The Content-Security-Policy of pages carries a per-request nonce: see proxy.ts.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [
        { key: "Cache-Control", value: "no-store" },
        { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" },
      ] },
    ];
  },
};

export default nextConfig;
