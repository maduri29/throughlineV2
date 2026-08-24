// Attachment bytes, kept out of the graph on purpose.
//
// A reference node carries only an Attachment's name, mime and size. The bytes
// live here, in their own IndexedDB store, because the node is what the lossless
// envelope exports and what the sync tier pushes as jsonb — base64 blobs would
// bloat every push and be re-sent on every unrelated edit to the same story.
//
// The consequence is real and must not be hidden: a file does NOT follow you to
// another device. It travels as a name and a size, and `hasBytes` is how the UI
// tells the difference between "here" and "recorded but elsewhere".
import { dbDelete, dbGet, dbPut } from "./idb";
import type { Attachment } from "../types";

/** Big enough for a PDF or a photo, small enough not to fill a browser quota. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

type FileRecord = { id: string; blob: Blob };

export async function putFile(id: string, blob: Blob): Promise<void> {
  await dbPut("files", [{ id, blob } satisfies FileRecord]);
}

export async function getFile(id: string): Promise<Blob | null> {
  const rec = await dbGet<FileRecord>("files", id);
  return rec?.blob ?? null;
}

export async function deleteFile(id: string): Promise<void> {
  await dbDelete("files", [id]);
}

export async function hasBytes(id: string): Promise<boolean> {
  return (await getFile(id)) !== null;
}

/** Hand the file to the browser. Revoked on the next tick, not immediately. */
export async function openAttachment(a: Attachment): Promise<boolean> {
  const blob = await getFile(a.id);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = a.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

export function describeSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
