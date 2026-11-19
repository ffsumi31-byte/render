import { createHash, randomBytes } from "node:crypto";

export function mintKey() {
  return `sk-gw-${randomBytes(32).toString("hex")}`;
}
export function keyHash(key) {
  if (typeof key !== "string" || !/^sk-gw-[a-f0-9]{64}$/.test(key)) {
    throw new Error("invalid_customer_key");
  }
  return createHash("sha256").update(key).digest("hex");
}
export function positiveTokens(value) {
  const text = String(value ?? "");
  if (!/^[1-9]\d*$/.test(text)) throw new Error("Tokens must be a positive integer");
  const n = Number(text);
  if (!Number.isSafeInteger(n) || n > 1_000_000_000_000) throw new Error("Token amount too large");
  return n;
}
