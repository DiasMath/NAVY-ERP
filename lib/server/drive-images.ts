import "server-only";
import sharp from "sharp";
import { ApiError } from "./navy-auth";

export async function prepareJpeg(value: FormDataEntryValue | null, kind: "avatar" | "gallery") {
  if (!(value instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(value.type)) throw new ApiError(400, "Escolha uma foto JPG, PNG ou WebP.");
  if (value.size === 0 || value.size > 4 * 1024 * 1024) throw new ApiError(400, "Envie uma imagem de até 4 MB.");
  try {
    const input = Buffer.from(await value.arrayBuffer());
    const image = sharp(input, { limitInputPixels: 40_000_000, failOn: "error" }).rotate();
    const output = kind === "avatar"
      ? image.resize(512, 512, { fit: "contain", background: "#e3eef5" })
      : image.resize(2200, 2200, { fit: "inside", withoutEnlargement: true });
    return await output.jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  } catch { throw new ApiError(400, "Não foi possível processar essa imagem. Escolha outra foto."); }
}
