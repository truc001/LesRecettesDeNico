import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const cookieName = "nico_admin_session";
const maxAge = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  return secret;
}

function sign(value: string) {
  const secret = getSecret();
  return secret ? createHmac("sha256", secret).update(value).digest("base64url") : null;
}

export function passwordMatches(password: string) {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured || !password) return false;
  const expected = Buffer.from(configured);
  const supplied = Buffer.from(password);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function createAdminSession() {
  const payload = String(Date.now() + maxAge * 1000);
  const signature = sign(payload);
  return signature ? `${payload}.${signature}` : null;
}

export async function isAdmin() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return false;
  const [expiresAt, signature] = token.split(".");
  const expected = expiresAt ? sign(expiresAt) : null;
  if (!expiresAt || !signature || !expected || signature.length !== expected.length) return false;
  return Number(expiresAt) > Date.now() && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export const adminCookie = { name: cookieName, maxAge, options: { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/" } };
