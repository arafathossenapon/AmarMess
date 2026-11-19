import { createHash, timingSafeEqual } from "node:crypto";

export const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");
export function validCode(code: unknown, hash?: string) {
  return typeof code === "string" && !!hash && timingSafeEqual(Buffer.from(hash), Buffer.from(hashCode(code)));
}
