const FILE_LIKE_TEXT =
  /(?:https?:\/\/|\/|\\|\.)(?:[^\s]*)(?:\.(?:avif|bmp|gif|heic|jpeg|jpg|m4v|mov|mp4|png|svg|tif|tiff|webm|webp))(?:[?#][^\s]*)?$/i;

export function looksLikeImageMetadataText(value?: string | null) {
  const text = value?.trim();
  if (!text) return false;
  return FILE_LIKE_TEXT.test(text);
}

export function sanitizeInformativeAlt(value?: string | null, fallback = "Portfolio photograph") {
  const text = value?.trim() ?? "";
  if (!text || looksLikeImageMetadataText(text)) return fallback;
  return text;
}
