import { LIMITS } from "@/lib/config/thresholds";

const readAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

const stripPrefix = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(",") + 1);

/**
 * Уменьшает фото до 1600 px и перекодирует в JPEG: укладываемся в 5 МБ, быстрее грузится,
 * а перерисовка через canvas заодно убирает EXIF (геометки).
 */
export async function prepareImage(file: File): Promise<{ mime: "image/jpeg"; base64: string }> {
  if (!file.type.startsWith("image/")) throw new Error("not_image");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
  if (!blob) throw new Error("image_failed");
  if (blob.size > LIMITS.maxImageBytes) throw new Error("image_too_large");
  return { mime: "image/jpeg", base64: stripPrefix(await readAsDataUrl(blob)) };
}

export async function preparePdf(file: File): Promise<{ base64: string }> {
  if (file.type !== "application/pdf") throw new Error("not_pdf");
  if (file.size > LIMITS.maxPdfBytes) throw new Error("pdf_too_large");
  return { base64: stripPrefix(await readAsDataUrl(file)) };
}
