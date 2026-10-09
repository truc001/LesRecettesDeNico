import { NextResponse, type NextRequest } from "next/server";

const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "lesrecettesdenico-51466.firebaseapp.com";
const isDev = process.env.NODE_ENV !== "production";

// Scripts run only with the per-request nonce; 'strict-dynamic' extends that
// trust to what they load themselves (Google sign-in, Analytics). The host
// names are a fallback for browsers that do not support 'strict-dynamic'.
function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""} https://apis.google.com https://www.googletagmanager.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.google-analytics.com https://*.googletagmanager.com",
    "font-src 'self' data:",
    `connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://apis.google.com https://firebase.googleapis.com https://firebaseinstallations.googleapis.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com${isDev ? " ws:" : ""}`,
    `frame-src https://${firebaseAuthDomain} https://accounts.google.com`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  // Next.js reads the nonce from this request header and applies it to its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [{
    source: "/((?!api|_next/static|_next/image|favicon.svg|tarte-tatin.jpg|robots.txt|sitemap.xml).*)",
    missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }],
  }],
};
