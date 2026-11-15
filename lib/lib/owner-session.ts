// Khusus server. Login owner/superuser memakai ADMIN_EMAIL + ADMIN_PASSWORD dari environment,
// lalu sesi disimpan di cookie bertanda tangan (HMAC) yang berlaku 1 jam.
import { createHash, createHmac, timingSafeEqual } from "crypto";

const TTL_SECONDS = 3600;

function secret() {
  return process.env.ADMIN_SESSION_SECRET ?? "";
}

export function ownerConfigured() {
  return Boolean(
    process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && secret().length >= 16,
  );
}

function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkOwnerLogin(email: string, password: string) {
  const emailOk = safeEqual(
    email.trim().toLowerCase(),
    (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase(),
  );
  const passwordOk = safeEqual(password, process.env.ADMIN_PASSWORD ?? "");
  return emailOk && passwordOk;
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(`owner.${body}`).digest("base64url");
}

export function createOwnerToken() {
  const body = String(Math.floor(Date.now() / 1000) + TTL_SECONDS);
  return `${body}.${sign(body)}`;
}

export function verifyOwnerToken(token: string) {
  if (!ownerConfigured() || !token) return false;
  const [body, signature] = token.split(".");
  if (!body || !signature) return false;
  if (!safeEqual(signature, sign(body))) return false;
  return Number(body) > Math.floor(Date.now() / 1000);
}
