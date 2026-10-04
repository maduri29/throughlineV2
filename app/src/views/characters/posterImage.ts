export function posterHue(id: string): number {
  return [...id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 360;
}

export function posterMonogram(title: string): string {
  return (
    title
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("") || "?"
  );
}

export async function processPosterImage(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error("Choose a JPG, PNG or WebP image under 10 MB.");
  }

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing unavailable");

  const scale = Math.max(480 / bitmap.width, 640 / bitmap.height);
  ctx.drawImage(
    bitmap,
    (480 - bitmap.width * scale) / 2,
    (640 - bitmap.height * scale) / 2,
    bitmap.width * scale,
    bitmap.height * scale,
  );
  bitmap.close();

  return canvas.toDataURL("image/webp", 0.8);
}
