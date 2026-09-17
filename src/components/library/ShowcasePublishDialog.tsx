"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  Share1Icon,
  StarIcon,
} from "@radix-ui/react-icons";
import { Kicker, WorkbenchNotice } from "@/src/components/ui/workbench";

export interface ShowcasePublishTarget {
  id: string;
  title: string;
  recordNumber: number | null;
  kitName?: string | null;
  styleName?: string | null;
  materialName?: string | null;
  weathering?: string | null;
}

interface ShowcasePublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ShowcasePublishTarget | null;
  previewUrl: string | null;
  onConfirmPublish: () => Promise<void>;
  isPublishing: boolean;
  errorMessage: string | null;
}

export function ShowcasePublishDialog({
  open,
  onOpenChange,
  target,
  previewUrl,
  onConfirmPublish,
  isPublishing,
  errorMessage,
}: ShowcasePublishDialogProps) {
  const [allowRemix, setAllowRemix] = useState(true);
  const [isPublishedSuccess, setIsPublishedSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!target) return null;

  const showcaseUrl = typeof window !== "undefined"
    ? `${window.location.origin}/prototype/${target.id}`
    : `/prototype/${target.id}`;

  async function handlePublish() {
    await onConfirmPublish();
    setIsPublishedSuccess(true);
  }

  function handleCopy() {
    void navigator.clipboard.writeText(showcaseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setIsPublishedSuccess(false);
      setCopied(false);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="showcase-publish-dialog border-line-primary bg-panel text-ink-primary max-w-lg p-0 overflow-hidden sm:rounded-none">
        {isPublishedSuccess ? (
          <div className="showcase-publish-dialog__success p-6">
            <div className="showcase-publish-dialog__badge">
              <span className="showcase-kicker is-teal inline-flex items-center gap-1.5">
                <StarIcon className="w-3.5 h-3.5" /> Hangar Wall Exhibition
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-display font-medium">
              Your build is now on the hangar wall.
            </h2>
            <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
              Fellow modelers and builders can now explore your color system, inspect the paint match, and find inspiration for their workbench.
            </p>

            <div className="showcase-publish-dialog__preview mt-4">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={target.title}
                  className="w-full aspect-video object-cover border border-line-secondary"
                />
              ) : null}
            </div>

            <div className="showcase-publish-dialog__share-box mt-4 p-3 bg-surface-muted border border-line-secondary flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-ink-secondary truncate select-all">
                {showcaseUrl}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1 shrink-0 rounded-none"
                onClick={handleCopy}
              >
                {copied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <CopyIcon className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            <DialogFooter className="mt-6 flex-row sm:justify-between items-center gap-3">
              <Button
                variant="ghost"
                className="rounded-none text-xs"
                onClick={() => handleClose(false)}
              >
                Close
              </Button>
              <Button
                asChild
                className="rounded-none gap-1.5 bg-ink text-paper hover:bg-ink-secondary text-xs"
              >
                <Link to="/prototype/$conceptId" params={{ conceptId: target.id }}>
                  View in Showcase <ExternalLinkIcon className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="showcase-publish-dialog__form p-6">
            <DialogHeader className="p-0">
              <div className="flex items-center justify-between">
                <Kicker>Exhibition Release</Kicker>
                <span className="font-mono text-xs text-ink-muted">
                  N°.{target.recordNumber ? String(target.recordNumber).padStart(3, "0") : "BUILD"}
                </span>
              </div>
              <DialogTitle className="text-xl font-display font-medium">
                Publish to Showcase
              </DialogTitle>
              <DialogDescription className="text-xs text-ink-muted">
                Make this prototype publicly discoverable on NeotypeLab&apos;s community hangar.
              </DialogDescription>
            </DialogHeader>

            <div className="showcase-publish-dialog__cover mt-4 relative border border-line-secondary bg-surface-muted overflow-hidden">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={target.title}
                  className="w-full aspect-[16/10] object-cover"
                />
              ) : (
                <div className="w-full aspect-[16/10] flex items-center justify-center text-xs text-ink-muted">
                  No preview image
                </div>
              )}
              <div className="showcase-publish-dialog__overlay absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-white">
                <p className="text-xs uppercase tracking-wider font-mono opacity-75">Cover Render</p>
                <p className="font-semibold text-sm truncate">{target.title}</p>
              </div>
            </div>

            <div className="showcase-publish-dialog__metadata mt-3 py-2 border-y border-line-secondary flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-0.5 bg-surface-muted border border-line-secondary font-mono">
                {target.kitName ?? "Kit unspecified"}
              </span>
              {target.styleName ? (
                <span className="px-2 py-0.5 bg-surface-muted border border-line-secondary font-mono">
                  {target.styleName}
                </span>
              ) : null}
              {target.materialName ? (
                <span className="px-2 py-0.5 bg-surface-muted border border-line-secondary font-mono">
                  {target.materialName}
                </span>
              ) : null}
              {target.weathering ? (
                <span className="px-2 py-0.5 bg-surface-muted border border-line-secondary font-mono capitalize">
                  {target.weathering}
                </span>
              ) : null}
            </div>

            <div className="showcase-publish-dialog__remix mt-4 flex items-start gap-3 p-3 bg-surface-subtle border border-line-secondary">
              <input
                id="allow-remix-checkbox"
                type="checkbox"
                checked={allowRemix}
                onChange={(e) => setAllowRemix(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-line-primary accent-black cursor-pointer"
              />
              <label htmlFor="allow-remix-checkbox" className="text-xs cursor-pointer select-none">
                <span className="font-semibold block text-ink-primary">Allow remix</span>
                <span className="text-ink-secondary leading-normal block mt-0.5">
                  Allows other builders to remix this palette and explore alternative kits with your colorway.
                </span>
              </label>
            </div>

            {errorMessage ? (
              <div className="mt-3">
                <WorkbenchNotice tone="danger">
                  <p>{errorMessage}</p>
                </WorkbenchNotice>
              </div>
            ) : null}

            <DialogFooter className="mt-6 flex-row sm:justify-between items-center gap-3">
              <Button
                variant="ghost"
                className="rounded-none text-xs"
                onClick={() => handleClose(false)}
                disabled={isPublishing}
              >
                Cancel
              </Button>
              <Button
                className="rounded-none gap-1.5 bg-ink text-paper hover:bg-ink-secondary text-xs px-4"
                onClick={() => void handlePublish()}
                disabled={isPublishing}
              >
                <Share1Icon className="w-3.5 h-3.5" />
                {isPublishing ? "Publishing to Hangar…" : "Publish to Showcase"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
