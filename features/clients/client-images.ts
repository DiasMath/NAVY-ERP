export async function prepareImageUpload(file: File, kind: "avatar" | "gallery") {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Escolha uma foto JPG, PNG ou WebP.");
  if (file.size > 20 * 1024 * 1024) throw new Error("A imagem original pode ter até 20 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const maxSide = kind === "avatar" ? 640 : 2200;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    for (const quality of [0.86, 0.74, 0.62, 0.52]) {
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Este navegador não conseguiu preparar a imagem.");
      context.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= 3.5 * 1024 * 1024) return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }
    throw new Error("A imagem ficou grande demais. Escolha uma foto menor.");
  } finally { bitmap.close(); }
}
