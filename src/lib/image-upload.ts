const CLOUDFLARE_MAX_PIXELS = 100_000_000;
const CLOUDFLARE_MAX_DIMENSION = 50_000;
const WEB_MASTER_LONG_EDGE = 3_000;
const WEB_MASTER_JPEG_QUALITY = 0.92;

export type ImageDimensions = { width: number; height: number };

export type UploadedOriginal = {
  url: string;
  key: string;
  size: number;
  kind: "image";
};

export type ProtectedImageUpload = UploadedOriginal & {
  deliveryUrl: string;
  deliveryKey: string;
  oversized: boolean;
  warning?: string;
};

type UploadImage = (input: {
  data: {
    filename: string;
    contentType: string;
    dataBase64: string;
    kind: "image";
    width?: number;
    height?: number;
    originalObjectKey?: string;
    originalUrl?: string;
  };
}) => Promise<UploadedOriginal>;

export function exceedsCloudflareImageLimit(dimensions: ImageDimensions): boolean {
  return (
    dimensions.width > CLOUDFLARE_MAX_DIMENSION ||
    dimensions.height > CLOUDFLARE_MAX_DIMENSION ||
    dimensions.width * dimensions.height > CLOUDFLARE_MAX_PIXELS
  );
}

export function deliveryDimensions(dimensions: ImageDimensions): ImageDimensions {
  const longest = Math.max(dimensions.width, dimensions.height);
  if (longest <= WEB_MASTER_LONG_EDGE) return dimensions;
  const scale = WEB_MASTER_LONG_EDGE / longest;
  return {
    width: Math.max(1, Math.round(dimensions.width * scale)),
    height: Math.max(1, Math.round(dimensions.height * scale)),
  };
}

export function isValidWebMasterBlob(blob: Blob): boolean {
  return blob.type === "image/jpeg" && blob.size > 0;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function imageDimensions(file: File): Promise<ImageDimensions> {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return dimensions;
}

async function createWebMaster(file: File, dimensions: ImageDimensions): Promise<{ blob: Blob; dimensions: ImageDimensions }> {
  const bitmap = await createImageBitmap(file);
  const output = deliveryDimensions(dimensions);
  const canvas = document.createElement("canvas");
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext("2d", { colorSpace: "srgb" });
  if (!context) throw new Error("Canvas 2D context unavailable for web-ready delivery version");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, output.width, output.height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", WEB_MASTER_JPEG_QUALITY);
  });
  if (!blob || !isValidWebMasterBlob(blob)) {
    throw new Error("The browser could not create a JPEG web-ready delivery version");
  }
  return { blob, dimensions: output };
}

function webMasterFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  return `${stem}-web-master.jpg`;
}

/**
 * Stores the uploaded image byte-for-byte first. Only images beyond the
 * deployed Cloudflare input limits receive a separate JPEG delivery source.
 * SVG logos remain vector originals and are used directly for delivery.
 */
export async function uploadImageWithProtection(file: File, upload: UploadImage): Promise<ProtectedImageUpload> {
  const contentType = file.type || "image/jpeg";
  const original = await upload({
    data: {
      filename: file.name,
      contentType,
      dataBase64: await blobToBase64(file),
      kind: "image",
    },
  });

  if (contentType === "image/svg+xml") {
    return {
      ...original,
      deliveryUrl: original.url,
      deliveryKey: original.key,
      oversized: false,
    };
  }

  let dimensions: ImageDimensions;
  try {
    dimensions = await imageDimensions(file);
  } catch (error) {
    return {
      ...original,
      deliveryUrl: original.url,
      deliveryKey: original.key,
      oversized: false,
      warning: `Original preserved, but image dimensions could not be read: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (!exceedsCloudflareImageLimit(dimensions)) {
    return {
      ...original,
      deliveryUrl: original.url,
      deliveryKey: original.key,
      oversized: false,
    };
  }

  try {
    const webMaster = await createWebMaster(file, dimensions);
    const delivery = await upload({
      data: {
        filename: webMasterFilename(file.name),
        contentType: "image/jpeg",
        dataBase64: await blobToBase64(webMaster.blob),
        kind: "image",
        width: webMaster.dimensions.width,
        height: webMaster.dimensions.height,
        originalObjectKey: original.key,
        originalUrl: original.url,
      },
    });
    return {
      ...original,
      deliveryUrl: delivery.url,
      deliveryKey: delivery.key,
      oversized: true,
      warning: "High-resolution master preserved. A web-ready delivery version is being used for responsive display.",
    };
  } catch (error) {
    return {
      ...original,
      deliveryUrl: original.url,
      deliveryKey: original.key,
      oversized: true,
      warning: `High-resolution master preserved, but the web-ready delivery version failed: ${error instanceof Error ? error.message : String(error)}. Retry this upload to try again.`,
    };
  }
}

export const IMAGE_UPLOAD_LIMITS = {
  maxPixels: CLOUDFLARE_MAX_PIXELS,
  maxDimension: CLOUDFLARE_MAX_DIMENSION,
  webMasterLongEdge: WEB_MASTER_LONG_EDGE,
};
