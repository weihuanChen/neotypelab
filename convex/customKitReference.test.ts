import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { decodeKitReference } from "./customKitsNode";

describe("Custom Kit reference decoding", () => {
  it("decodes and normalizes bytes rather than trusting the upload MIME or extension", async () => {
    const input = await sharp({ create: { width: 512, height: 512, channels: 3, background: "white" } }).png().withMetadata().toBuffer();
    const image = await decodeKitReference(input);
    const meta = await sharp(image.data).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(image.checksum).toMatch(/^[a-f0-9]{64}$/);
    await expect(decodeKitReference(Buffer.from("not an image"))).rejects.toThrow();
  });
  it("rejects tiny or oversized images before they become a billable scan", async () => {
    const input = await sharp({ create: { width: 128, height: 128, channels: 3, background: "white" } }).png().toBuffer();
    await expect(decodeKitReference(input)).rejects.toThrow(/256/);
    await expect(decodeKitReference(Buffer.alloc(8 * 1024 * 1024 + 1))).rejects.toThrow(/8 MB/);
  });
});
