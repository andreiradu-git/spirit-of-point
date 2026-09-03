// Branding / UI media must never be treated as portfolio photography.
// The Point Studio wordmark was imported together with the photographs during
// the Squarespace migration, which is why it turned up as the first item of the
// static gallery seed files. These helpers keep branding out of galleries while
// leaving header, footer, favicon and logo settings untouched.

/** Object keys of branding assets (Point Studio wordmark variants). */
export const BRANDING_OBJECT_KEYS = [
  "originals/4d60d181-80a0-4944-8dd7-c6e0312db758.webp",
];

const BRANDING_PATTERNS = [/LOGO_PSP/i, /point[\s_+-]*studio[\s_+-]*logo/i];

export function isBrandingAsset(image: { src?: string | null; alt?: string | null; title?: string | null }): boolean {
  const src = image.src ?? "";
  if (BRANDING_OBJECT_KEYS.some((key) => src.includes(key))) return true;
  if (BRANDING_PATTERNS.some((re) => re.test(src))) return true;
  const label = `${image.alt ?? ""} ${image.title ?? ""}`.trim();
  return /^point\s*studio$/i.test(label);
}

/** Removes branding assets from a portfolio gallery list, preserving order. */
export function withoutBrandingAssets<T extends { src?: string | null; alt?: string | null; title?: string | null }>(
  images: T[],
): T[] {
  return images.filter((image) => !isBrandingAsset(image));
}
