"use client";

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { KitPortrait } from "./KitPicker";
import { StylePalette, type DisplayColor, displayPalette } from "./StylePalette";
import { usePrivateAssetUrl } from "@/src/hooks/usePrivateAssetUrl";

export type CreationRunRecord = {
  id: Id<"creationRuns">;
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  stage: "palette" | "specification" | "render";
  cost: number;
  refunded: boolean;
  error?: string;
  conceptId?: Id<"concepts">;
  title: string;
  kit?: {
    id: Id<"baseModels">;
    name: string;
    grade?: string;
    scale?: string;
    portrait?: string | null;
    fullBody?: string | null;
  } | null;
  styleName: string;
  styleSlug?: string;
  visualPalette?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    frame?: string;
    detail?: string;
  } | null;
  previewAsset?: {
    publicUrl?: string;
    storageObjectId?: Id<"storageObjects">;
  } | null;
  updatedAt: number;
};

type StageState = "completed" | "running" | "pending" | "failed";

function computeStageStates(status: string, stage: string): {
  palette: StageState;
  mapping: StageState;
  render: StageState;
  paintPlan: StageState;
} {
  if (status === "succeeded") {
    return { palette: "completed", mapping: "completed", render: "completed", paintPlan: "completed" };
  }

  if (status === "failed") {
    if (stage === "palette") {
      return { palette: "failed", mapping: "pending", render: "pending", paintPlan: "pending" };
    }
    if (stage === "specification") {
      return { palette: "completed", mapping: "failed", render: "pending", paintPlan: "pending" };
    }
    return { palette: "completed", mapping: "completed", render: "failed", paintPlan: "pending" };
  }

  // running or queued
  if (stage === "palette") {
    return { palette: "running", mapping: "pending", render: "pending", paintPlan: "pending" };
  }
  if (stage === "specification") {
    return { palette: "completed", mapping: "running", render: "pending", paintPlan: "pending" };
  }
  if (stage === "render") {
    return { palette: "completed", mapping: "completed", render: "running", paintPlan: "pending" };
  }

  return { palette: "running", mapping: "pending", render: "pending", paintPlan: "pending" };
}

function resolveColors(
  visualPalette?: { primary?: string; secondary?: string; accent?: string; frame?: string; detail?: string } | null,
  styleSlug?: string
): DisplayColor[] {
  if (visualPalette) {
    const list: DisplayColor[] = [];
    if (visualPalette.primary) list.push({ role: "Primary Armor", hex: visualPalette.primary, weight: 42 });
    if (visualPalette.secondary) list.push({ role: "Secondary Armor", hex: visualPalette.secondary, weight: 24 });
    if (visualPalette.frame) list.push({ role: "Frame", hex: visualPalette.frame, weight: 16 });
    if (visualPalette.accent) list.push({ role: "Accent", hex: visualPalette.accent, weight: 10 });
    if (visualPalette.detail) list.push({ role: "Detail", hex: visualPalette.detail, weight: 8 });
    if (list.length > 0) return list;
  }
  return styleSlug ? displayPalette(styleSlug) : [];
}

export function GenerationJobSheet({
  run,
  onRetry,
  onReset,
  retryBusy = false,
}: {
  run: CreationRunRecord;
  onRetry: () => void;
  onReset: () => void;
  retryBusy?: boolean;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const privatePreviewUrl = usePrivateAssetUrl(
    run.previewAsset?.publicUrl ? null : run.previewAsset?.storageObjectId
  );
  const previewUrl = run.previewAsset?.publicUrl ?? privatePreviewUrl;
  const isRunning = run.status === "queued" || run.status === "running";
  const isSucceeded = run.status === "succeeded";
  const isFailed = run.status === "failed";
  const stages = computeStageStates(run.status, run.stage);
  const colors = resolveColors(run.visualPalette, run.styleSlug);

  return (
    <div className="generation-job-sheet" role="region" aria-label="Generation Job Status">
      {/* Top Telemetry Bar */}
      <header className="job-sheet-header">
        <div className="job-header-left">
          <Link to="/library" className="job-back-link">
            ← Library
          </Link>
          <span className="job-code">{run.jobId}</span>
        </div>

        <div className="job-header-right">
          {isRunning && (
            <span className="job-status-pill is-running">
              <span className="job-pulse-dot" aria-hidden="true" />
              RUNNING
            </span>
          )}
          {isSucceeded && (
            <span className="job-status-pill is-succeeded">
              ✓ REPAINT READY
            </span>
          )}
          {isFailed && (
            <span className="job-status-pill is-failed">
              ! INTERRUPTED
            </span>
          )}
        </div>
      </header>

      {/* Hero Title & Mecha Pair */}
      <div className="job-sheet-hero">
        <p className="workbench-kicker">
          {isRunning
            ? "Building Repaint"
            : isSucceeded
              ? "Repaint Ready"
              : "Generation Interrupted"}
        </p>
        <h1 className="job-hero-title">
          {run.kit?.name ?? "Kit Model"}
          <span className="job-hero-separator"> × </span>
          <span className="job-hero-style">{run.styleName}</span>
        </h1>
        <p className="job-hero-caption">
          {[run.kit?.grade, run.kit?.scale, "Custom Repaint Prototype"]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {/* Main Grid: Viewport + Details */}
      <div className="job-sheet-body">
        {/* Silhouette & Scanner Viewport */}
        <div className="job-viewport-column">
          <div
            className={`job-silhouette-viewport ${
              isSucceeded && previewUrl && imageLoaded ? "is-ready" : ""
            }`}
          >
            <div className="job-corner-mark top-left" aria-hidden="true" />
            <div className="job-corner-mark top-right" aria-hidden="true" />
            <div className="job-corner-mark bottom-left" aria-hidden="true" />
            <div className="job-corner-mark bottom-right" aria-hidden="true" />

            {/* Scanning Line Beam */}
            {isRunning && <div className="job-scanner-beam" aria-hidden="true" />}

            {/* Silhouette Base */}
            <div className="job-silhouette-media">
              <KitPortrait
                url={run.kit?.fullBody ?? run.kit?.portrait}
                name={run.kit?.name ?? "Kit"}
              />
            </div>

            {/* Completed Render Image */}
            {previewUrl && (
              <img
                src={previewUrl}
                alt={run.title}
                className="job-result-render-image"
                onLoad={() => setImageLoaded(true)}
              />
            )}
          </div>

          {/* Palette Swatch Strip */}
          <div className="job-palette-section">
            <div className="job-palette-header">
              <span className="job-palette-label">Visual Palette</span>
              {run.visualPalette ? (
                <span className="job-palette-status">Locked</span>
              ) : (
                <span className="job-palette-status">Draft intent</span>
              )}
            </div>
            {colors.length > 0 ? (
              <StylePalette colors={colors} large />
            ) : (
              <div className="job-palette-empty">Colors mapped from custom description</div>
            )}
            {colors.length > 0 && (
              <div className="job-color-roles-grid">
                {colors.map((c) => (
                  <div key={c.role} className="job-color-chip">
                    <span
                      className="job-color-dot"
                      style={{ backgroundColor: c.hex }}
                      aria-hidden="true"
                    />
                    <span className="job-color-role">{c.role}</span>
                    <span className="job-color-hex">{c.hex}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pipeline Stages & Controls Column */}
        <div className="job-stages-column">
          <section className="job-pipeline-card" aria-label="Build Pipeline Stages">
            <h3 className="job-pipeline-title">Job Pipeline</h3>
            <ol className="job-stages-list">
              {/* Stage 01 */}
              <li className={`job-stage-item is-${stages.palette}`}>
                <span className="job-stage-badge">
                  {stages.palette === "completed"
                    ? "✓"
                    : stages.palette === "running"
                      ? "●"
                      : stages.palette === "failed"
                        ? "!"
                        : "○"}
                </span>
                <div className="job-stage-info">
                  <div className="job-stage-name">
                    <span className="job-stage-num">01</span> PALETTE
                  </div>
                  <p className="job-stage-desc">
                    Translating style into spray-ready colors.
                  </p>
                </div>
              </li>

              {/* Stage 02 */}
              <li className={`job-stage-item is-${stages.mapping}`}>
                <span className="job-stage-badge">
                  {stages.mapping === "completed"
                    ? "✓"
                    : stages.mapping === "running"
                      ? "●"
                      : stages.mapping === "failed"
                        ? "!"
                        : "○"}
                </span>
                <div className="job-stage-info">
                  <div className="job-stage-name">
                    <span className="job-stage-num">02</span> MAPPING
                  </div>
                  <p className="job-stage-desc">
                    Assigning colors to armor, frame, and accent zones.
                  </p>
                </div>
              </li>

              {/* Stage 03 */}
              <li className={`job-stage-item is-${stages.render}`}>
                <span className="job-stage-badge">
                  {stages.render === "completed"
                    ? "✓"
                    : stages.render === "running"
                      ? "●"
                      : stages.render === "failed"
                        ? "!"
                        : "○"}
                </span>
                <div className="job-stage-info">
                  <div className="job-stage-name">
                    <span className="job-stage-num">03</span> RENDER
                  </div>
                  <p className="job-stage-desc">
                    Building the repaint preview image.
                  </p>
                </div>
              </li>

              {/* Stage 04 */}
              <li className={`job-stage-item is-${stages.paintPlan}`}>
                <span className="job-stage-badge">
                  {stages.paintPlan === "completed"
                    ? "✓"
                    : stages.paintPlan === "running"
                      ? "●"
                      : stages.paintPlan === "failed"
                        ? "!"
                        : "○"}
                </span>
                <div className="job-stage-info">
                  <div className="job-stage-name">
                    <span className="job-stage-num">04</span> PAINT PLAN
                  </div>
                  <p className="job-stage-desc">
                    Matching result to real lacquer/acrylic paint references.
                  </p>
                </div>
              </li>
            </ol>
          </section>

          {/* Contextual Actions / Notices */}
          {isRunning && (
            <div className="job-notice-card">
              <p className="job-notice-text">
                This build will continue in the background if you leave this page.
              </p>
              <Button asChild variant="outline" className="job-action-button">
                <Link to="/library">View in Library →</Link>
              </Button>
            </div>
          )}

          {isSucceeded && (
            <div className="job-succeeded-card">
              <div className="job-succeeded-checklist">
                <div>✓ Preview image generated</div>
                <div>✓ Paint specification locked</div>
                <div>✓ Real paint references compiled</div>
              </div>
              <div className="job-succeeded-actions">
                {run.conceptId ? (
                  <Button asChild className="job-action-button">
                    <Link
                      to="/library/$conceptId"
                      params={{ conceptId: run.conceptId }}
                      search={{ tab: "overview" }}
                    >
                      Open in Library →
                    </Link>
                  </Button>
                ) : (
                  <Button asChild className="job-action-button">
                    <Link to="/library">Open in Library →</Link>
                  </Button>
                )}
                <Button variant="outline" onClick={onReset} className="job-action-button">
                  Start another build
                </Button>
              </div>
            </div>
          )}

          {isFailed && (
            <div className="job-failed-card" role="alert">
              <h4 className="job-failed-title">Generation Interrupted</h4>
              <p className="job-failed-error">
                {run.error ?? "The preview renderer did not return a valid image."}
              </p>
              {run.refunded && (
                <p className="job-failed-refund">
                  All {run.cost} credits were returned to your account.
                </p>
              )}
              <div className="job-failed-actions">
                <Button
                  disabled={retryBusy}
                  onClick={onRetry}
                  className="job-action-button"
                >
                  {retryBusy ? "Retrying preview…" : `Retry preview · ${run.cost} credits`}
                </Button>
                <Button
                  variant="outline"
                  onClick={onReset}
                  className="job-action-button"
                >
                  Return to setup
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
