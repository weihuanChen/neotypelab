"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowLeftIcon,
  ArrowTopRightIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  ImageIcon,
  LockClosedIcon,
  Share1Icon,
  ZoomInIcon,
} from "@radix-ui/react-icons";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StatusPill, mapStatusTone } from "@/src/components/ui/workbench";
import type { LibraryDetailTab } from "./libraryDetailSearch";
import { computeMaskingSummary, CUSTOM_MIX_LABEL, CUSTOM_MIX_NOTE, roleNeedsCustomMix } from "./libraryBriefData";
import { ShowcasePublishDialog } from "./ShowcasePublishDialog";
import {
  SystemSignInButton,
  SystemState,
  SystemStateLink,
  systemStates,
} from "@/src/components/system-state";

export type WorkDetail = NonNullable<FunctionReturnType<typeof api.libraryDetails.get>>;
export type PaintSystemSet = NonNullable<WorkDetail["paintRecommendations"]>["sets"][number];
type ResourceFile = WorkDetail["collections"][number]["versions"][number]["files"][number];
type PreviewSource = { storageObjectId: Id<"storageObjects"> | null; publicUrl: string | null };
const tabs: Array<{ id: LibraryDetailTab; label: string }> = [
  { id: "overview", label: "Overview" }, { id: "resources", label: "Resources" }, { id: "history", label: "History" },
];

export function LibraryDetailPage(props: { conceptId: string; tab: LibraryDetailTab; onTabChange: (tab: LibraryDetailTab) => void }) {
  return <>
    <AuthLoading><DetailLoading /></AuthLoading>
    <Unauthenticated>
      <SystemState
        {...systemStates.authRecord}
        primary={<SystemSignInButton />}
        secondary={<SystemStateLink to="/library">Return to Library ←</SystemStateLink>}
      />
    </Unauthenticated>
    <Authenticated><OwnedWorkDetail {...props} /></Authenticated>
  </>;
}

function OwnedWorkDetail({ conceptId, tab, onTabChange }: { conceptId: string; tab: LibraryDetailTab; onTabChange: (tab: LibraryDetailTab) => void }) {
  const detail = useQuery(api.libraryDetails.get, { conceptId });
  const recommendations = detail?.paintRecommendations;
  const defaultSystem = recommendations?.sets.find((set) => set.recommended)
    ?? recommendations?.sets.find((set) => set.coverageCount === set.roleCount)
    ?? recommendations?.sets[0];
  const [selectedSystemId, setSelectedSystemId] = useState<string>("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const setVisibility = useAction(api.publicationNode.setConceptVisibility);
  const preview = useDetailImage(detail?.hero ?? { storageObjectId: null, publicUrl: null });
  const activeSystem = recommendations?.sets.find((set) => set.id === (selectedSystemId || defaultSystem?.id)) ?? defaultSystem;

  if (detail === undefined) return <DetailLoading />;
  if (detail === null) return (
    <SystemState
      {...systemStates.recordMissing}
      primary={<SystemStateLink to="/library">Return to Library ←</SystemStateLink>}
    />
  );
  const resources = detail.collections.reduce((total, collection) => total + collection.versions.reduce((count, version) => count + version.files.length, 0), 0)
    + Number(Boolean(detail.palette)) + Number(Boolean(detail.specification)) + detail.documents.length;
  const workId = detail.id;

  async function handleConfirmPublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      await setVisibility({ conceptId: workId, visibility: "public" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Publication failed";
      setPublishError(message);
      throw error;
    } finally {
      setPublishing(false);
    }
  }

  return <article className="work-detail" aria-labelledby="work-title">
    <p className="work-detail-print-banner">
      NeotypeLab Build Manual · {recordLabel(detail)}
      {detail.kit ? ` · ${[detail.kit.grade, detail.kit.name].filter(Boolean).join(" ")}` : ""}
      {activeSystem ? ` · ${activeSystem.brand} ${activeSystem.line}` : ""}
    </p>
    <header className="work-detail-header">
      <Link className="work-detail-back" to="/library"><ArrowLeftIcon aria-hidden="true" />Library</Link>
      <div className="work-detail-heading">
        <div><p className="work-detail-eyebrow">Work archive / {recordLabel(detail)}</p><h1 id="work-title">{detail.title}</h1></div>
        <div className="work-detail-badges"><StatusPill label={detail.specification && detail.status === "draft" ? "Plan ready" : detail.status} tone={mapStatusTone(detail.status)} /><span>{detail.visibility === "private" ? <LockClosedIcon aria-hidden="true" /> : null}{detail.visibility}</span></div>
      </div>
    </header>
    <div className="work-detail-hero">
      <WorkPreview detail={detail} />
      <aside className="work-detail-summary" aria-label="Work configuration">
        <p className="work-detail-eyebrow">The build</p>
        <dl>
          <Fact label="Kit" value={detail.kit ? [detail.kit.grade, detail.kit.name].filter(Boolean).join(" · ") : "Not selected"} />
          {detail.kit?.scale ? <Fact label="Scale" value={detail.kit.scale} /> : null}
          <Fact label="Style DNA" value={detail.style ?? "Not selected"} />
          <Fact label="Material" value={detail.material ?? "Not selected"} />
          <Fact label="Weathering" value={humanize(detail.weathering)} />
          <Fact label="Mood" value={detail.mood.length ? detail.mood.map(humanize).join(" · ") : "No modifiers"} />
          <Fact label="Created" value={formatDate(detail.createdAt)} />
        </dl>
        {detail.notes ? <div className="work-detail-note"><p className="work-detail-eyebrow">Operator notes</p><p>{detail.notes}</p></div> : null}
        <p className="work-detail-summary-foot">{resources} resources <span aria-hidden="true">/</span> {detail.history.length} generation records</p>
      </aside>
    </div>

    <ExhibitionStrip detail={detail} onPublish={() => setPublishOpen(true)} />
    <WorkbenchActionBar detail={detail} selectedSystem={activeSystem} />

    <Tabs value={tab} onValueChange={value => onTabChange(value as LibraryDetailTab)} className="work-detail-tabs">
      <TabsList aria-label="Work details" className="work-detail-tab-list">
        {tabs.map(item => <TabsTrigger key={item.id} value={item.id} className="work-detail-tab">
          {item.label}{item.id !== "overview" ? <span>{item.id === "resources" ? resources : detail.history.length}</span> : null}
        </TabsTrigger>)}
      </TabsList>
      <TabsContent value="overview">
        <Overview
          detail={detail}
          selectedSystem={activeSystem}
          onSelectSystemId={setSelectedSystemId}
        />
      </TabsContent>
      <TabsContent value="resources"><Resources detail={detail} /></TabsContent>
      <TabsContent value="history"><History detail={detail} /></TabsContent>
    </Tabs>
    <ShowcasePublishDialog
      open={publishOpen}
      onOpenChange={setPublishOpen}
      target={{
        id: detail.id,
        title: detail.title,
        recordNumber: detail.recordNumber,
        kitName: detail.kit?.name ?? null,
        styleName: detail.style,
        materialName: detail.material,
        weathering: detail.weathering,
      }}
      previewUrl={preview.url}
      onConfirmPublish={handleConfirmPublish}
      isPublishing={publishing}
      errorMessage={publishError}
    />
    <PrintColophon />
  </article>;
}

function WorkPreview({ detail }: { detail: WorkDetail }) {
  const image = useDetailImage(detail.hero);
  const [expanded, setExpanded] = useState(false);
  const [broken, setBroken] = useState<string | null>(null);
  const failed = Boolean(image.error || (image.url && broken === image.url));
  return <figure className="work-detail-preview">
    <div className="work-detail-image-stage">
      {image.url && !failed ? <button className="work-detail-image-button" type="button" onClick={() => setExpanded(true)} aria-label="View full image">
        <img src={image.url} alt={`${detail.title} completed repaint`} onError={() => setBroken(image.url)} />
        <span className="work-detail-zoom"><ZoomInIcon aria-hidden="true" />View full image</span>
      </button> : <div className="work-detail-image-empty" role="status">
        <ImageIcon aria-hidden="true" />
        <strong>{failed ? "Image unavailable" : image.loading ? "Loading your render…" : "Your render will appear here"}</strong>
        <p>{failed ? "The image could not be loaded. Try refreshing its access link." : image.loading ? "Opening the saved preview." : "The work’s saved plans and generation history are available below."}</p>
        {failed ? <Button variant="outline" className="work-detail-action" onClick={() => { setBroken(null); image.retry(); }}>Retry image</Button> : null}
      </div>}
    </div>
    <figcaption><span>{detail.hero.version ? `Render / Version ${detail.hero.version}` : "Current preview"}</span><span>{detail.hero.width && detail.hero.height ? `${detail.hero.width} × ${detail.hero.height} px` : ""}</span></figcaption>
    <Dialog open={expanded} onOpenChange={setExpanded}>
      <DialogContent className="work-detail-lightbox">
        <DialogTitle>{detail.title}</DialogTitle><DialogDescription>Full composition, without cropping.</DialogDescription>
        {image.url ? <img src={image.url} alt={`${detail.title} full render`} /> : null}
      </DialogContent>
    </Dialog>
  </figure>;
}

function canPublishWork(status: string) {
  return status === "generated" || status === "archived";
}

function ExhibitionStrip({
  detail,
  onPublish,
}: {
  detail: WorkDetail;
  onPublish: () => void;
}) {
  const isPublic = detail.visibility === "public";
  const canPublish = canPublishWork(detail.status);

  return (
    <section
      className={isPublic ? "work-detail-exhibition is-live" : "work-detail-exhibition"}
      aria-label={isPublic ? "Public case" : "Showcase publication"}
    >
      <div>
        <span>{isPublic ? "On hangar wall" : "Exhibition"}</span>
        <p>
          {isPublic
            ? "This work already has its public case on the hangar wall."
            : canPublish
              ? "Share this prototype to Showcase so other builders can inspect the color system."
              : "Generate a render before publishing this build to Showcase."}
        </p>
      </div>
      {isPublic ? (
        <Link
          className="work-detail-exhibition__case"
          to="/prototype/$conceptId"
          params={{ conceptId: detail.id }}
        >
          Go to case
          <ArrowTopRightIcon aria-hidden="true" />
        </Link>
      ) : canPublish ? (
        <Button type="button" className="work-detail-action is-primary" onClick={onPublish}>
          <Share1Icon aria-hidden="true" />
          Publish to Showcase
        </Button>
      ) : null}
    </section>
  );
}

function WorkbenchActionBar({
  detail,
  selectedSystem,
}: {
  detail: WorkDetail;
  selectedSystem?: PaintSystemSet;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopyShoppingList() {
    const lines: string[] = [
      `=== ${detail.title.toUpperCase()} // PAINT SHOPPING LIST ===`,
      `Kit: ${detail.kit ? [detail.kit.grade, detail.kit.name].filter(Boolean).join(" ") : "Custom Kit"}`,
      selectedSystem
        ? `Paint System: ${selectedSystem.brand} - ${selectedSystem.line}`
        : "Color Palette Specification",
      "",
    ];

    if (selectedSystem && selectedSystem.entries.length > 0) {
      lines.push("--- Matched Paints ---");
      selectedSystem.entries.forEach((entry, idx) => {
        const role =
          detail.palette?.entries.find((p) => p.roleSlug === entry.roleSlug)?.roleName ??
          humanize(entry.roleSlug);
        lines.push(
          `${String(idx + 1).padStart(2, "0")}. [${entry.paint.code}] ${entry.paint.colorName}`
        );
        lines.push(
          `    Role: ${role} | Target: ${entry.targetHex} | Match: ΔE00 ${entry.deltaE00.toFixed(1)} (${humanize(entry.matchBand)})`
        );
      });
      if (selectedSystem.warnings.length > 0) {
        lines.push("", "--- System Warnings ---");
        selectedSystem.warnings.forEach((w) => lines.push(`* ${w}`));
      }
    } else if (detail.palette && detail.palette.entries.length > 0) {
      lines.push("--- Color Roles ---");
      detail.palette.entries.forEach((entry, idx) => {
        lines.push(
          `${String(idx + 1).padStart(2, "0")}. ${entry.roleName}: ${entry.targetHex} (${humanize(entry.paintEffect)})`
        );
        if (entry.recommendedArea) lines.push(`    Area: ${entry.recommendedArea}`);
      });
    }

    if (detail.specification?.panels && detail.specification.panels.length > 0) {
      lines.push("", "--- Target Zones & Masking ---");
      detail.specification.panels.forEach((panel) => {
        const role =
          detail.palette?.entries.find((e) => e.roleSlug === panel.roleSlug)?.roleName ??
          humanize(panel.roleSlug);
        lines.push(`* ${role}: ${panel.areas.join(", ")}`);
        if (panel.maskingNotes) lines.push(`  Masking: ${panel.maskingNotes}`);
      });
    }

    lines.push("", "--- NeotypeLab Modeler Workbench ---");

    void navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  function handlePrint() {
    const previousTitle = document.title;
    const root = document.documentElement;
    document.title = `${safeFilename(detail.title)}-build-manual`;
    root.classList.add("is-printing");
    const restore = () => {
      document.title = previousTitle;
      root.classList.remove("is-printing");
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    requestAnimationFrame(() => window.print());
  }

  return (
    <div className="work-detail-workbench-bar" aria-label="Workbench actions">
      <div className="work-detail-workbench-bar__info">
        <span className="work-detail-workbench-bar__badge">MODELER MANUAL</span>
        <span className="work-detail-workbench-bar__desc">
          {selectedSystem
            ? `${(selectedSystem.missingRoleSlugs?.length ?? 0) > 0 ? "Mix required" : "Ready to spray"} · ${selectedSystem.brand} ${selectedSystem.line} (${selectedSystem.coverageCount}/${selectedSystem.roleCount} matched)`
            : "Physical Kit Painting Directives"}
        </span>
      </div>
      <div className="work-detail-workbench-bar__actions">
        <Button
          type="button"
          variant="outline"
          onClick={handleCopyShoppingList}
          className="work-detail-action"
        >
          {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
          {copied ? "Shopping List Copied!" : "Copy Shopping List"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handlePrint}
          className="work-detail-action"
        >
          <FileTextIcon aria-hidden="true" />
          Print Manual
        </Button>
        <Button asChild variant="outline" className="work-detail-action">
          <Link to="/create" search={{ remix: detail.id }}>
            <ArrowTopRightIcon aria-hidden="true" />
            Remix in Create
          </Link>
        </Button>
      </div>
    </div>
  );
}

function recommendPrimer(hex?: string, effect?: string): string {
  if (effect === "metallic") return "Gloss Black Primer base";
  if (effect === "transparent") return "Mirror Chrome or Bright Silver base";
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return "Gray 1000 Surfacer";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  if (y > 185) return "White Primer (preserves brilliance)";
  if (r > 170 && g < 115 && b < 115) return "Pink / White Surfacer (preserves red vibrancy)";
  if (y < 65) return "Dark Gray or Black Surfacer";
  return "Gray 1000 Surfacer (neutral base)";
}

function deltaEClass(deltaE: number): string {
  if (deltaE <= 2.0) return "is-very-close";
  if (deltaE <= 4.0) return "is-close";
  return "is-usable";
}

function Overview({
  detail,
  selectedSystem,
  onSelectSystemId,
}: {
  detail: WorkDetail;
  selectedSystem?: PaintSystemSet;
  onSelectSystemId: (id: string) => void;
}) {
  const maskingSummary = computeMaskingSummary(detail.specification, detail.palette);

  return (
    <div className="work-detail-overview">
      {/* Section 01: Part-by-Part Color Plan Matrix */}
      <section aria-labelledby="palette-title" className="work-detail-section">
        <SectionHeading
          number="01"
          title="Part-by-Part Color Plan"
          id="palette-title"
          note={
            detail.palette
              ? `${detail.palette.entries.length} color roles · ${
                  selectedSystem ? `${selectedSystem.brand} ${selectedSystem.line}` : "Target Hex"
                }`
              : "No saved palette"
          }
        />

        {detail.palette ? (
          <>
            <p className="work-detail-intro">
              Complete workbench matrix mapping kit parts to visual color roles, catalog paint codes, and surface prep instructions.
            </p>
            {selectedSystem && (selectedSystem.missingRoleSlugs?.length ?? 0) > 0 ? (
              <p className="work-detail-mix-banner">
                {selectedSystem.missingRoleSlugs.length === 1
                  ? "1 color role has no direct catalog SKU in this system and needs a custom mix."
                  : `${selectedSystem.missingRoleSlugs.length} color roles have no direct catalog SKU in this system and need a custom mix.`}
              </p>
            ) : null}

            {detail.paintRecommendations && detail.paintRecommendations.sets.length > 1 ? (
              <div className="work-detail-system-switch" role="group" aria-label="Paint system selector">
                {detail.paintRecommendations.sets.map((set) => (
                  <button
                    type="button"
                    key={set.id}
                    className={set.id === selectedSystem?.id ? "is-active" : ""}
                    aria-pressed={set.id === selectedSystem?.id}
                    onClick={() => onSelectSystemId(set.id)}
                  >
                    <span>{set.label}</span>
                    <small>
                      {set.coverageCount} / {set.roleCount}
                      {set.recommended ? " · Recommended" : ""}
                    </small>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="work-detail-matrix-container">
              <table className="work-detail-matrix">
                <thead>
                  <tr>
                    <th scope="col">Color Role</th>
                    <th scope="col">
                      Paint Match
                      {selectedSystem ? ` · ${selectedSystem.brand} ${selectedSystem.line}` : ""}
                    </th>
                    <th scope="col">Target Areas</th>
                    <th scope="col">Technique & Primer</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.palette.entries.map((color, index) => {
                    const match = selectedSystem?.entries.find((entry) => entry.roleSlug === color.roleSlug);
                    const panel = detail.specification?.panels.find((p) => p.roleSlug === color.roleSlug);
                    const areas =
                      panel?.areas && panel.areas.length > 0
                        ? panel.areas
                        : color.recommendedArea
                          ? [color.recommendedArea]
                          : [];
                    const primerAdvice = recommendPrimer(color.targetHex, color.paintEffect);

                    return (
                      <tr key={`${color.roleSlug}-${index}`}>
                        <td className="work-detail-matrix__role" data-label="Color Role">
                          <div className="work-detail-matrix__role-inner">
                            <span
                              className="work-detail-matrix__swatch"
                              style={{ backgroundColor: validHex(color.targetHex) }}
                              aria-hidden="true"
                            />
                            <div>
                              <strong>{color.roleName}</strong>
                              <span className="work-detail-matrix__hex">{color.targetHex}</span>
                              <span className="work-detail-matrix__effect">{color.paintEffect} target</span>
                            </div>
                          </div>
                        </td>
                        <td className="work-detail-matrix__match" data-label={selectedSystem ? `Paint Match · ${selectedSystem.brand} ${selectedSystem.line}` : "Paint Match"}>
                          {match && !roleNeedsCustomMix(selectedSystem, color.roleSlug) ? (
                            <>
                              <div className="work-detail-matrix__code-row">
                                <strong>{match.paint.code}</strong>
                                <span className={`work-detail-matrix__delta ${deltaEClass(match.deltaE00)}`}>
                                  ΔE {match.deltaE00.toFixed(1)}
                                </span>
                              </div>
                              <span className="work-detail-matrix__paint-name">{match.paint.colorName}</span>
                            </>
                          ) : (
                            <div className="work-detail-matrix__missing">
                              <span>{CUSTOM_MIX_LABEL}</span>
                              <small>{CUSTOM_MIX_NOTE}</small>
                            </div>
                          )}
                        </td>
                        <td className="work-detail-matrix__areas" data-label="Target Areas">
                          {areas.length > 0 ? joinList(areas) : "—"}
                        </td>
                        <td className="work-detail-matrix__technique" data-label="Technique & Primer">
                          <span>{primerAdvice}</span>
                          {panel?.maskingNotes ? (
                            <p>
                              <strong>Masking </strong>
                              {panel.maskingNotes}
                            </p>
                          ) : color.rationale ? (
                            <p>{color.rationale}</p>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptySection>This work does not have a saved palette snapshot. Its original configuration is shown above.</EmptySection>
        )}
      </section>

      {/* Section 02: Masking & Process Steps */}
      <section aria-labelledby="spec-title" className="work-detail-section">
        <SectionHeading
          number="02"
          title="Masking & Workshop Process"
          id="spec-title"
          note={detail.specification ? "Physical kit build manual" : "Not yet recorded"}
        />

        {detail.specification ? (
          <>
            <p className="work-detail-intro">{detail.specification.summary}</p>
            <div className="work-detail-process">
              <article className="work-detail-process-col">
                <header className="work-detail-process-head">
                  <span>01</span>
                  <h3>Panel Masking</h3>
                </header>
                <p className="work-detail-process-load">
                  <span>Masking load</span>
                  <b className={maskingSummary.difficulty === "High" ? "is-high" : undefined}>
                    {maskingSummary.difficulty}
                    <span>/ {maskingSummary.zoneCount} zones</span>
                  </b>
                </p>
                <SpecField label="Key attention areas">
                  {maskingSummary.keyAreas.length > 0 ? (
                    <ul className="work-detail-process-areas">
                      {maskingSummary.keyAreas.map((item, idx) => (
                        <li key={idx}>
                          <strong>{item.area}</strong>
                          {item.note}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "Standard component separation; assemble after painting."
                  )}
                </SpecField>
                <SpecField label="Workshop rule">
                  Spray lightest shades first. Burnish masking tape edges, then mist a light clear coat to seal edges before spraying darker contrasting tones.
                </SpecField>
              </article>

              <article className="work-detail-process-col">
                <header className="work-detail-process-head">
                  <span>02</span>
                  <h3>Surface & Finish</h3>
                </header>
                <SpecField label="Surface">{detail.specification.material.surfaceTexture}</SpecField>
                <SpecField label="Reflectivity">{detail.specification.material.reflectivity}</SpecField>
                <SpecField label="Topcoat">{detail.specification.material.coating}</SpecField>
                <p className="work-detail-process-note">
                  Apply 1000–1200 grit primer to verify seamline elimination. Sand nubs flat before spraying color coats.
                </p>
              </article>

              <article className="work-detail-process-col">
                <header className="work-detail-process-head">
                  <span>03</span>
                  <h3>Decals & Weathering</h3>
                </header>
                <SpecField label="Weathering">
                  {joinList([
                    humanize(detail.specification.weathering.level),
                    detail.specification.weathering.applicationNotes,
                  ])}
                </SpecField>
                <SpecField label="Decals">
                  {joinList([
                    `${humanize(detail.specification.decals.density)} density`,
                    detail.specification.decals.placementNotes,
                  ])}
                </SpecField>
                <SpecField label="Sequence">
                  Gloss → Decal → Seal → Panel line → Topcoat
                </SpecField>
              </article>
            </div>
          </>
        ) : (
          <EmptySection>No repaint specification has been saved for this work yet.</EmptySection>
        )}
      </section>

      {/* Section 03: Painting Sequence & Spray Notes */}
      {detail.palette?.sprayNotes && detail.palette.sprayNotes.length > 0 ? (
        <section aria-labelledby="spray-notes-title" className="work-detail-section">
          <SectionHeading
            number="03"
            title="Painting Sequence & Spray Notes"
            id="spray-notes-title"
            note={`${detail.palette.sprayNotes.length} sequential directives`}
          />
          <div className="work-detail-sequence-wrap">
            <ol
              className="work-detail-sequence"
              style={{ gridTemplateColumns: `repeat(${detail.palette.sprayNotes.length}, minmax(10.5rem, 1fr))` }}
            >
              {detail.palette.sprayNotes.map((note, index) => (
                <li key={index}>
                  <span className="work-detail-sequence__index">{String(index + 1).padStart(2, "0")}</span>
                  <p>{note}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {/* Section 04: Paint System Catalog Details */}
      {selectedSystem ? (
        <section aria-labelledby="paint-systems-title" className="work-detail-section">
          <SectionHeading
            number="04"
            title="Paint System Catalog Details"
            id="paint-systems-title"
            note={`Matched ${formatDate(detail.paintRecommendations?.generatedAt ?? detail.createdAt)}`}
          />
          <div className="work-detail-system-summary">
            <div><span>System</span><strong>{selectedSystem.brand} · {selectedSystem.line}</strong></div>
            <div><span>Average ΔE00</span><strong>{selectedSystem.averageDeltaE?.toFixed(1) ?? "—"}</strong></div>
            <div><span>Worst ΔE00</span><strong>{selectedSystem.maxDeltaE?.toFixed(1) ?? "—"}</strong></div>
            <div><span>Coverage</span><strong>{selectedSystem.coverageCount}/{selectedSystem.roleCount}</strong></div>
          </div>
          {selectedSystem.warnings.length > 0 ? (
            <ul className="work-detail-match-warnings">
              {selectedSystem.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <p className="work-detail-match-note">
            Matches compare catalog color spectrophotometer data. Primer tone, coat thickness, clear coat, and lighting will influence the final painted appearance.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Resources({ detail }: { detail: WorkDetail }) {
  const [downloadError, setDownloadError] = useState<string | null>(null);
  return <section className="work-detail-section" aria-labelledby="resources-title">
    <SectionHeading number="03" title="Work resources" id="resources-title" note="Renders, plans and source files" />
    <p className="work-detail-intro">Keep the files behind this build together. Renders retain their versions, alongside the approved plans.</p>
    {downloadError ? <p className="work-detail-error" role="alert">{downloadError}</p> : null}
    {detail.collections.length ? detail.collections.map(collection => <section key={collection.id} className="work-detail-resource-group" aria-label={collection.title}>
      <div className="work-detail-resource-heading"><h3>{collection.title}</h3><span>{humanize(collection.kind)}</span></div>
      {collection.versions.length ? collection.versions.map(version => <div className="work-detail-version" key={version.id}>
        <div className="work-detail-version-heading"><strong>Version {version.version}</strong>{version.current ? <span>Current</span> : null}<time dateTime={new Date(version.createdAt).toISOString()}>{formatDate(version.createdAt)}</time></div>
        {version.files.length ? version.files.map(file => <ResourceFileRow key={file.id} file={file} title={detail.title} version={version.version} onError={setDownloadError} />)
          : <EmptySection>No downloadable files remain in this version.</EmptySection>}
      </div>) : <EmptySection>No resource versions are available yet.</EmptySection>}
    </section>) : <EmptySection>No image resources yet. Saved renders and reference files associated with this work will appear here.</EmptySection>}
    <section className="work-detail-resource-group" aria-label="Build documents">
      <div className="work-detail-resource-heading"><h3>Build documents</h3><span>Saved plans</span></div>
      {detail.palette ? <DocumentRow title="Approved visual color plan" description="Color roles, target HEX values and painting notes" onDownload={() => downloadJson(detail, "color-plan", detail.palette)} /> : null}
      {detail.paintRecommendations ? <DocumentRow title="Paint recommendation sets" description="Single-system catalog matches and color distances" onDownload={() => downloadJson(detail, "paint-recommendations", detail.paintRecommendations)} /> : null}
      {detail.specification ? <DocumentRow title="Repaint specification" description="Panel placement, finish, weathering and markings" onDownload={() => downloadJson(detail, "repaint-specification", detail.specification)} /> : null}
      {detail.documents.map(document => <div className="work-detail-file" key={document.id}><FileTextIcon aria-hidden="true" /><div><strong>{document.title}</strong><small>Spray plan · Version {document.version} · {document.status}</small></div><Button asChild variant="outline" className="work-detail-action"><Link to="/studio">Open studio<ArrowTopRightIcon aria-hidden="true" /></Link></Button></div>)}
      {!detail.palette && !detail.specification && !detail.documents.length ? <EmptySection>Approved color plans, repaint specifications and spray plans will be kept here as the work develops.</EmptySection> : null}
    </section>
  </section>;
}

function ResourceFileRow({ file, title, version, onError }: { file: ResourceFile; title: string; version: number; onError: (message: string | null) => void }) {
  const sign = useAction(api.assetNode.createPrivateDownloadUrl);
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true); onError(null);
    try {
      const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg", "application/pdf": "pdf", "application/json": "json", "text/plain": "txt", "text/csv": "csv", "application/zip": "zip" };
      const extension = extensions[file.contentType ?? ""] ?? "bin";
      const filename = `${safeFilename(title)}-v${version}-${file.rendition}.${extension}`;
      const { url } = await sign({ storageObjectId: file.id });
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error("Resource download failed");
      const blobUrl = URL.createObjectURL(await response.blob());
      triggerDownload(blobUrl, filename);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      onError(error instanceof Error && error.name === "TimeoutError"
        ? "The download timed out. Please try again."
        : "The file could not be downloaded. Check your connection and try again.");
    }
    finally { setBusy(false); }
  }
  const labels: Record<string, string> = { original: "Original image", master: "Full-size render", preview: "Web preview", thumbnail: "Thumbnail" };
  return <div className="work-detail-file">
    {file.contentType?.startsWith("image/") ? <ImageIcon aria-hidden="true" /> : <FileTextIcon aria-hidden="true" />}<div><strong>{labels[file.rendition] ?? humanize(file.rendition)}</strong><small>{[file.contentType?.split("/")[1]?.toUpperCase(), file.width && file.height ? `${file.width} × ${file.height}` : null, formatBytes(file.bytes)].filter(Boolean).join(" · ")}</small>
      {file.unavailableReason ? <small>{file.unavailableReason}</small> : file.retainUntil ? <small>Retained until {formatDate(file.retainUntil)}</small> : null}
    </div>
    <Button variant="outline" className="work-detail-action" disabled={!file.canDownload || busy} onClick={() => void download()} aria-label={`Download ${labels[file.rendition] ?? file.rendition}, version ${version}`}><DownloadIcon aria-hidden="true" />{busy ? "Preparing…" : "Download"}</Button>
  </div>;
}

function History({ detail }: { detail: WorkDetail }) {
  return <section className="work-detail-section" aria-labelledby="history-title">
    <SectionHeading number="04" title="Generation record" id="history-title" note={`${detail.history.length} recorded steps`} />
    {detail.history.length ? <ol className="work-detail-history">{detail.history.map((entry, index) => <li key={entry.id}>
      <span className="work-detail-history-index">{String(detail.history.length - index).padStart(2, "0")}</span>
      <div><div className="work-detail-history-heading"><h3>{humanize(entry.label)}</h3><StatusPill label={entry.status} tone={mapStatusTone(entry.status)} /></div>
        <p>{[entry.model, entry.templateVersion ? `Template ${entry.templateVersion}` : null].filter(Boolean).join(" · ") || "Model details were not recorded"}</p>
        <small><time dateTime={new Date(entry.createdAt).toISOString()}>{formatDate(entry.createdAt, true)}</time>{entry.credits !== null ? ` · ${entry.credits} credits requested` : ""}</small>
        {entry.error ? <p className="work-detail-error">{entry.error.split("\n")[0]}</p> : null}
      </div>
    </li>)}</ol> : <EmptySection>No generation steps have been recorded for this work.</EmptySection>}
  </section>;
}

function useDetailImage(source: PreviewSource) {
  const sign = useAction(api.assetNode.createPrivateDownloadUrl);
  const [attempt, setAttempt] = useState(0);
  const key = source.storageObjectId ?? source.publicUrl ?? "none";
  const [state, setState] = useState<{ key: string; url: string | null; error: boolean }>({ key: "", url: null, error: false });
  useEffect(() => {
    if (!source.storageObjectId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const signed = await sign({ storageObjectId: source.storageObjectId! });
        if (cancelled) return;
        setState({ key, url: signed.url, error: false });
        timer = setTimeout(() => void refresh(), Math.max(30000, signed.expiresAt - Date.now() - 60000));
      } catch { if (!cancelled) setState({ key, url: null, error: true }); }
    };
    setState({ key, url: null, error: false });
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [source.storageObjectId, sign, key, attempt]);
  const current = state.key === key ? state : null;
  return { url: source.storageObjectId ? current?.url ?? null : source.publicUrl, error: current?.error ?? false,
    loading: Boolean(source.storageObjectId && !current?.url && !current?.error), retry: () => setAttempt(value => value + 1) };
}

const SITE_BRAND_URL = "https://neotypelab.com";

function PrintColophon() {
  return (
    <aside className="work-detail-print-colophon" aria-label="NeotypeLab">
      <NeotypeLabQr />
      <p>
        <strong>NeotypeLab</strong>
        <span>Scale-model color systems and build manuals</span>
        <a href={SITE_BRAND_URL}>{SITE_BRAND_URL.replace(/^https:\/\//, "")}</a>
      </p>
    </aside>
  );
}

function NeotypeLabQr() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 27 27" shapeRendering="crispEdges" aria-hidden="true">
      <title>QR code for neotypelab.com</title>
      <path fill="#fff" d="M0 0h27v27H0z" />
      <path fill="none" stroke="#111" d="M1 1.5h7m4 0h1m4 0h1m1 0h7M1 2.5h1m5 0h1m3 0h4m1 0h2m1 0h1m5 0h1M1 3.5h1m1 0h3m1 0h1m1 0h1m2 0h1m3 0h1m2 0h1m1 0h3m1 0h1M1 4.5h1m1 0h3m1 0h1m1 0h6m1 0h1m2 0h1m1 0h3m1 0h1M1 5.5h1m1 0h3m1 0h1m1 0h1m1 0h2m1 0h1m2 0h1m1 0h1m1 0h3m1 0h1M1 6.5h1m5 0h1m1 0h4m1 0h3m2 0h1m5 0h1M1 7.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M9 8.5h1m1 0h1m4 0h2M1 9.5h1m1 0h5m2 0h1m2 0h3m3 0h5M3 10.5h3m2 0h2m2 0h2m3 0h1m2 0h1m3 0h1M2 11.5h1m1 0h1m2 0h1m5 0h2m1 0h4m1 0h2m1 0h2M1 12.5h2m1 0h3m4 0h1m1 0h1m1 0h7m3 0h1M1 13.5h1m3 0h5m2 0h1m1 0h3m1 0h2m1 0h1m1 0h3M1 14.5h5m7 0h2m2 0h1m2 0h1m1 0h1m1 0h1M1 15.5h1m1 0h5m2 0h2m2 0h3m1 0h1m1 0h3m1 0h2M1 16.5h1m1 0h1m1 0h2m2 0h2m2 0h1m1 0h2m1 0h1m1 0h2m3 0h1M1 17.5h1m3 0h1m1 0h5m1 0h9m1 0h1M9 18.5h3m2 0h1m2 0h1m3 0h2M1 19.5h7m4 0h2m1 0h1m1 0h1m1 0h1m1 0h1m1 0h3M1 20.5h1m5 0h1m1 0h4m2 0h1m1 0h1m3 0h2M1 21.5h1m1 0h3m1 0h1m1 0h2m1 0h1m3 0h6m1 0h3M1 22.5h1m1 0h3m1 0h1m1 0h2m2 0h2m3 0h2m1 0h5M1 23.5h1m1 0h3m1 0h1m1 0h2m3 0h5m3 0h2m1 0h1M1 24.5h1m5 0h1m2 0h1m2 0h2m2 0h6m2 0h1M1 25.5h7m1 0h1m3 0h1m1 0h1m3 0h7" />
    </svg>
  );
}

function DetailLoading() { return <section className="work-detail-loading" role="status" aria-label="Loading work details"><span>Opening work archive…</span><div /><div /></section>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function SpecField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="work-detail-spec">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}
function joinList(items: string[]) { return items.filter(Boolean).join(" · "); }
function SectionHeading({ number, title, id, note }: { number: string; title: string; id: string; note: string }) { return <header className="work-detail-section-heading"><div><span>{number}</span><h2 id={id}>{title}</h2></div><p>{note}</p></header>; }
function EmptySection({ children }: { children: ReactNode }) { return <p className="work-detail-empty">{children}</p>; }
function DocumentRow({ title, description, onDownload }: { title: string; description: string; onDownload: () => void }) { return <div className="work-detail-file"><FileTextIcon aria-hidden="true" /><div><strong>{title}</strong><small>{description} · JSON</small></div><Button variant="outline" className="work-detail-action" onClick={onDownload} aria-label={`Export ${title}`}><DownloadIcon aria-hidden="true" />Export</Button></div>; }
function recordLabel(detail: WorkDetail) { return detail.recordNumber ? `N° ${String(detail.recordNumber).padStart(4, "0")}` : "Prototype"; }
function humanize(value: string) { return value.replace(/-/g, " ").replace(/^\w/, letter => letter.toUpperCase()).replace(/^Hd\b/, "HD"); }
function formatDate(timestamp: number, time = false) { return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } as const : {}) }).format(timestamp); }
function formatBytes(bytes: number | null) { return bytes === null ? null : bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`; }
function validHex(hex?: string) { return hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : "var(--color-paper-3)"; }
function safeFilename(title: string) { return title.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0,80) || "work"; }
function triggerDownload(url: string, filename: string) { const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); }
function downloadJson(detail: WorkDetail, kind: string, content: unknown) {
  const blob = new Blob([JSON.stringify({ work: { title: detail.title, kit: detail.kit, style: detail.style, material: detail.material, weathering: detail.weathering }, [kind]: content }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); triggerDownload(url, `${safeFilename(detail.title)}-${kind}.json`); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
