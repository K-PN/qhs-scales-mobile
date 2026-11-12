import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
export function enabled(value: unknown): boolean {
  return Buffer.isBuffer(value) ? value[0] === 1 : Number(value) === 1;
}
// Desktop DataHelp.CreateMD5: exact ASCII fallback and suffix.
export function legacyHash(password: string): string {
  return createHash("md5")
    .update((password + "@haiviet").replace(/[^\x00-\x7F]/g, "?"), "ascii")
    .digest("hex")
    .toUpperCase();
}
export function equalHash(a: string, b: string): boolean {
  const left = Buffer.from(a.toLowerCase()),
    right = Buffer.from(b.toLowerCase());
  return left.length === right.length && timingSafeEqual(left, right);
}
export function fingerprint(row: unknown): string {
  return createHmac("sha256", env.jwtAccessSecret)
    .update(JSON.stringify(row))
    .digest("hex");
}
export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
