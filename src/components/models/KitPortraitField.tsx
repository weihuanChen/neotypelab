import { useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { KitImageKind } from "@/convex/modelCatalogImages";

type KitImageFieldProps = {
  kind: KitImageKind;
  kitVariantId?: Id<"baseModels"> | null;
  value: string;
  resolvedUrl?: string | null;
  onChange: (value: string) => void;
  onUploaded?: (key: string) => void;
};

const COPY: Record<
  KitImageKind,
  { label: string; guidance: string; empty: string; remove: string }
> = {
  cover: {
    label: "Cover image",
    guidance:
      "Create kit-picker cover · 4:5 canvas, fixed three-quarter view, neutral background, low saturation. Keep the complete model within 70–80% of the frame. No packaging or scene.",
    empty: "No cover configured. Kit cards will display Portrait pending.",
    remove: "Remove cover",
  },
  fullBody: {
    label: "Full-body loading image",
    guidance:
      "Shown while a preview is generating. Prefer a clear full-body silhouette on a clean background. Falls back to the cover image when empty.",
    empty: "No full-body image. Generation loading will reuse the cover.",
    remove: "Remove full-body image",
  },
};

export function KitImageField({
  kind,
  kitVariantId,
  value,
  resolvedUrl,
  onChange,
  onUploaded,
}: KitImageFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateStagingUrl = useMutation(api.modelCatalogAdmin.generateKitImageStagingUrl);
  const commitKitImage = useAction(api.modelCatalogNode.commitKitImage);
  const removeKitImage = useAction(api.modelCatalogNode.removeKitImage);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[kind];
  const url = !value ? null : /^https:\/\//.test(value) ? value : resolvedUrl;

  const uploadFile = async (file: File) => {
    if (!kitVariantId) {
      setError("Save the kit variant once before uploading images.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const uploadUrl = await generateStagingUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) {
        throw new Error("The image could not be staged for upload.");
      }
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      const result = await commitKitImage({
        kitVariantId,
        kind,
        storageId,
      });
      onChange(result.key);
      onUploaded?.(result.key);
      setFailed(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const clearImage = async () => {
    if (!kitVariantId) {
      onChange("");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await removeKitImage({ kitVariantId, kind });
      onChange("");
      setFailed(null);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Could not remove image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input
        aria-label={`${copy.label} URL or R2 asset key`}
        disabled={busy}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://…/cover.webp or catalog/kits/…"
        value={value}
      />
      <p className="text-sm text-ink-muted">{copy.guidance}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          accept="image/webp,image/jpeg,image/png"
          className="hidden"
          disabled={busy || !kitVariantId}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFile(file);
          }}
          ref={fileInputRef}
          type="file"
        />
        <Button
          disabled={busy || !kitVariantId}
          onClick={() => fileInputRef.current?.click()}
          type="button"
          variant="outline"
        >
          {busy ? "Uploading…" : "Upload image"}
        </Button>
        {value ? (
          <Button disabled={busy} onClick={() => void clearImage()} type="button" variant="outline">
            {copy.remove}
          </Button>
        ) : null}
        {!kitVariantId ? (
          <span className="text-xs text-ink-muted">Save the kit first to enable uploads.</span>
        ) : null}
      </div>
      {error ? <p className="text-sm text-accent-red">{error}</p> : null}
      {url && failed !== url ? (
        <img
          alt={`${copy.label} preview`}
          className="h-48 w-40 border border-line-secondary object-contain"
          onError={() => setFailed(url)}
          src={url}
        />
      ) : (
        <p className="text-sm text-ink-muted">
          {value ? "Save to resolve an R2 key, or check the image URL." : copy.empty}
        </p>
      )}
    </div>
  );
}

/** @deprecated Use KitImageField — kept as a thin alias for any leftover imports. */
export function KitPortraitField(props: {
  value: string;
  resolvedUrl?: string | null;
  onChange: (value: string) => void;
}) {
  return <KitImageField kind="cover" {...props} />;
}
