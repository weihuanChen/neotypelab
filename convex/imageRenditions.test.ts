// @vitest-environment node

import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createImageRenditions } from "./imageRenditions";

describe("image rendition processing", () => {
  it("creates bounded WebP master, preview, and thumbnail outputs", async () => {
    const source = await sharp({
      create: {
        width: 3000,
        height: 1800,
        channels: 4,
        background: { r: 32, g: 84, b: 120, alpha: 0.85 },
      },
    })
      .png()
      .toBuffer();

    const processed = await createImageRenditions(source, 2048);

    expect(processed.original).toMatchObject({
      width: 3000,
      height: 1800,
      byteSize: source.byteLength,
    });
    expect(processed.original.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(processed.renditions.map((item) => item.rendition)).toEqual([
      "master",
      "preview",
      "thumbnail",
    ]);
    for (const rendition of processed.renditions) {
      const metadata = await sharp(rendition.buffer).metadata();
      const expectedMax = rendition.rendition === "master"
        ? 2048
        : rendition.rendition === "preview"
          ? 1280
          : 512;
      expect(metadata.format).toBe("webp");
      expect(Math.max(rendition.width, rendition.height)).toBe(expectedMax);
      expect(rendition.byteSize).toBe(rendition.buffer.byteLength);
      expect(rendition.checksum).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("does not enlarge a source below the rendition dimensions", async () => {
    const source = await sharp({
      create: {
        width: 320,
        height: 200,
        channels: 3,
        background: { r: 180, g: 60, b: 40 },
      },
    })
      .jpeg()
      .toBuffer();

    const processed = await createImageRenditions(source, 4096);

    expect(processed.renditions.every((item) => item.width === 320 && item.height === 200))
      .toBe(true);
  });

  it("rejects invalid model output", async () => {
    await expect(createImageRenditions(Buffer.from("not an image"), 2048)).rejects.toThrow();
  });
});
