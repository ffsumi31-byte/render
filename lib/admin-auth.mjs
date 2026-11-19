import { createHash, timingSafeEqual } from "node:crypto";

export function authorizeAdmin(req, expected = process.env.ADMIN_ACCESS_KEY) {
  if (!expected || !/^sk-admin-[a-f0-9]{64}$/.test(expected)) return 503;
  if (new URL(req.url).protocol !== "https:") return 400;
  const supplied = /^Bearer (sk-admin-[a-f0-9]{64})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!supplied) return 401;
  const digest = (s) => createHash("sha256").update(s).digest();
  if (!timingSafeEqual(digest(supplied), digest(expected))) return 401;
  if (req.method !== "GET") {
    if (req.headers.get("origin") !== new URL(req.url).origin) return 403;
    if (req.headers.get("content-type")?.split(";")[0] !== "application/json") return 415;
  }
  return 200;
}
