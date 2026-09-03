/**
 * UUIDv7 (unix-ms timestamp + random).
 * Monotonically sortable with millisecond resolution.
 */
export function uuidv7(): string {
  const ts = Date.now();
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const t = ts.toString(16).padStart(12, "0");
  const variant = ((parseInt(rand[3] ?? "0", 16) & 0x3) | 0x8).toString(16);
  return `${t.slice(0, 8)}-${t.slice(8)}-7${rand.slice(0, 3)}-${variant}${rand.slice(4, 7)}-${rand.slice(7, 19)}`;
}
