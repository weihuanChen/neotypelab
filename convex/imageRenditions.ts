"use node";

import { createHash } from "crypto";
import sharp from "sharp";

export type WebRendition = {
  rendition: "master" | "preview" | "thumbnail";
  buffer: Buffer;
  contentType: "image/webp";
  width: number;
  height: number;
  byteSize: number;
  checksum: string;
};

export type ProcessedImage = {
  original: {
    width: number;
    height: number;
    byteSize: number;
    checksum: string;
  };
  renditions: WebRendition[];
};

const WEB_RENDITION_SPECS = [
  { rendition: "master", maxDimension: 2048, quality: 86 },
  { rendition: "preview", maxDimension: 1280, quality: 80 },
  { rendition: "thumbnail", maxDimension: 512, quality: 74 },
] as const;

export async function createImageRenditions(
  input: Buffer,
  masterMaxDimensionPx: number
): Promise<ProcessedImage> {
  const metadata = await sharp(input, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Generated image dimensions could not be determined");
  }
  const masterDimension = Math.min(
    4096,
    Math.max(512, Math.round(masterMaxDimensionPx))
  );
  const renditions = await Promise.all(
    WEB_RENDITION_SPECS.map(async (spec): Promise<WebRendition> => {
      const maxDimension = spec.rendition === "master" ? masterDimension : spec.maxDimension;
      const { data, info } = await sharp(input, { failOn: "error" })
        .rotate()
        .resize({
          width: maxDimension,
          height: maxDimension,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: spec.quality, effort: 4, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });
      return {
        rendition: spec.rendition,
        buffer: data,
        contentType: "image/webp",
        width: info.width,
        height: info.height,
        byteSize: info.size,
        checksum: sha256(data),
      };
    })
  );

  return {
    original: {
      width: metadata.width,
      height: metadata.height,
      byteSize: input.byteLength,
      checksum: sha256(input),
    },
    renditions,
  };
}

function sha256(input: Buffer) {
  return createHash("sha256").update(input).digest("hex");
}
