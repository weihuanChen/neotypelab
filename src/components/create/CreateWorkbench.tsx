"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "@tanstack/react-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { StyleIntent } from "@/convex/creativeContracts";
import { readStyleIntent, resolveStyleRefinements } from "@/convex/styleRefinements";
import { getCreatorPackAccessCopy } from "@/lib/creatorPackAccess";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { StyleDiscovery } from "./StyleDiscovery";
import { CustomStylePicker } from "./CustomStylePicker";
import { StylePalette, displayPalette } from "./StylePalette";
import { KitPicker, KitPortrait } from "./KitPicker";
import { GenerationJobSheet } from "./GenerationJobSheet";
import type { CreateWorkbenchSearch } from "./createSearch";
import { SystemState, systemStates } from "@/src/components/system-state";
import type { StyleJobPhase } from "@/src/components/job-wait";

const moodOptions = ["command-presence", "stealth-tension", "industrial-hazard", "reactor-glow", "field-fatigue", "ceremonial-clean"] as const;
type Mood = typeof moodOptions[number];

export function CreateWorkbench({ search = {} }: { search?: CreateWorkbenchSearch }) {
  const catalog = useQuery(api.catalog.listCreateOptions, { includeKits: false });
  const viewer = useQuery(api.users.viewer);
  const community = useQuery(api.userStyles.community);
  const previews = useQuery(api.styleEditorial.gallery);
  const quote = useQuery(api.creationRuns.quote);
  const latestRun = useQuery(api.creationRuns.latest);
  const start = useMutation(api.creationRuns.start);
  const retry = useMutation(api.creationRuns.retry);
  const saveCommunity = useMutation(api.userStyles.saveCommunityStyle);
  const remix = useQuery(api.showcase.getRemixSeed, search.remix ? { conceptId: search.remix as Id<"concepts"> } : "skip");
  const pack = useQuery(api.showcase.getCreatorPackBySlug, search.creatorPack ? { slug: search.creatorPack } : "skip");
  const [step, setStep] = useState<1 | 2>(1);
  const [tab, setTab] = useState<"discover" | "create" | "saved">("discover");
  const [styleMode, setStyleMode] = useState<"preset" | "custom">(search.communityStyle ? "custom" : "preset");
  const [presetId, setPresetId] = useState<Id<"stylePresets"> | null>(null);
  const [custom, setCustom] = useState<StyleIntent | null>(null);
  const [savedId, setSavedId] = useState<Id<"userStyles"> | null>(null);
  const [communityId, setCommunityId] = useState<string>();
  const [kitId, setKitId] = useState<Id<"baseModels"> | null>(null);
  const kit = useQuery(api.kitPicker.selected, { kitId: kitId ?? undefined, slug: kitId ? undefined : search.recommendedBaseModel });
  const [materialId, setMaterialId] = useState<Id<"materialPresets"> | null>(null);
  const [weathering, setWeathering] = useState<"clean" | "light" | "heavy" | null>(null);
  const [mood, setMood] = useState<Mood[]>([]);
  const [notes, setNotes] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchingRunId, setWatchingRunId] = useState<string | null>(null);
  const [dismissedRunId, setDismissedRunId] = useState<string | null>(null);
  const [stylePhase, setStylePhase] = useState<StyleJobPhase>("input");
  const handleStylePhase = useCallback((phase: StyleJobPhase) => {
    setStylePhase(phase);
    if (phase === "existing" || phase === "forming" || phase === "review" || phase === "stored" || phase === "interrupted") {
      setTab("create");
    }
  }, []);
  const appliedSearch = useRef(false);
  const requestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const preset = catalog?.stylePresets.find(row => row._id === presetId);
  const intent = styleMode === "custom" ? custom : readStyleIntent(preset?.styleIntentJson);
  const defaults = resolveStyleRefinements(intent, catalog?.materialPresets ?? [], preset?.recommendedMaterialSlugs);
  const hasStyle = styleMode === "custom" ? Boolean(custom) : Boolean(preset);
  const styleName = styleMode === "custom" ? custom?.name : preset?.name;
  const colors = styleMode === "preset" ? displayPalette(preset?.slug ?? "") : [];
  const isRunning = latestRun?.status === "queued" || latestRun?.status === "running";
  const access = getCreatorPackAccessCopy({ creatorHandle: pack?.creator.handle, packType: pack?.packType ?? "free", viewer });
  const locked = Boolean(search.creatorPack && (!pack || (pack.packType === "premium" && !access.allowed)));
  const actualKitId = kit?._id;
  const resolvedMaterial = materialId ?? defaults.material?._id;
  const resolvedWeathering = weathering ?? defaults.weathering;
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [step]);

  useEffect(() => {
    if (latestRun && (latestRun.status === "queued" || latestRun.status === "running")) {
      setWatchingRunId(latestRun.id);
    }
  }, [latestRun]);

  useEffect(() => {
    if (latestRun?.status === "succeeded" || latestRun?.status === "failed") requestRef.current = null;
  }, [latestRun?.status]);

  useEffect(() => {
    if (!catalog || appliedSearch.current || (search.remix && remix === undefined)) return;
    appliedSearch.current = true;
    const recommended = catalog.stylePresets.find(row => row.slug === search.recommendedStyle);
    if (recommended) setPresetId(recommended._id);
    const material = catalog.materialPresets.find(row => row.slug === search.recommendedMaterial);
    if (material) setMaterialId(material._id);
    if (["clean", "light", "heavy"].includes(search.recommendedWeathering ?? "")) setWeathering(search.recommendedWeathering as "clean" | "light" | "heavy");
    if (search.recommendedMoodTags) setMood(search.recommendedMoodTags.split(",").filter((value): value is Mood => moodOptions.includes(value as Mood)));
    if (search.recommendedWorkflow === "light-weathering") setWeathering("light");
    if (remix) {
      setKitId(remix.kitVariantId); setPresetId(remix.stylePresetId); setMaterialId(remix.materialPresetId);
      setWeathering(remix.weatheringLevel); setMood(remix.moodTags); setNotes(remix.notes?.slice(0, 100) ?? "");
    }
  }, [catalog, remix, search]);

  async function generate() {
    if (!hasStyle || !actualKitId || !resolvedMaterial || !quote || isRunning || busy || locked) return;
    const input = {
      kitVariantId: actualKitId, stylePresetId: styleMode === "preset" ? presetId ?? undefined : undefined,
      userStyleId: styleMode === "custom" ? savedId ?? undefined : undefined,
      styleIntentJson: styleMode === "custom" && custom ? JSON.stringify(custom) : undefined,
      styleRevision: styleMode === "preset" ? preset?.styleIntentJson : undefined,
      materialPresetId: resolvedMaterial, moodTags: mood, weatheringLevel: resolvedWeathering,
      notes: notes.trim() || undefined, sourceConceptId: remix?._id,
    };
    const fingerprint = JSON.stringify(input);
    if (requestRef.current?.fingerprint !== fingerprint) requestRef.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true); setError(null);
    try {
      const runId = await start({ input, requestKey: requestRef.current.key, expectedCost: quote.cost });
      setWatchingRunId(runId);
      setDismissedRunId(null);
    }
    catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }

  async function handleRetry(runId: Id<"creationRuns">) {
    setBusy(true);
    setError(null);
    try {
      await retry({ runId });
      setWatchingRunId(runId);
      setDismissedRunId(null);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  if (!catalog || viewer === undefined) {
    return <SystemState {...systemStates.createLoading} />;
  }

  const shouldShowJobSheet = Boolean(
    latestRun &&
    dismissedRunId !== latestRun.id &&
    (isRunning || watchingRunId === latestRun.id)
  );

  if (shouldShowJobSheet && latestRun) {
    return (
      <div className="create-workspace is-job-sheet">
        <GenerationJobSheet
          run={latestRun}
          retryBusy={busy}
          onRetry={() => void handleRetry(latestRun.id)}
          onReset={() => {
            setDismissedRunId(latestRun.id);
            setWatchingRunId(null);
            setStep(1);
          }}
        />
        {error ? <p className="create-flow-error" role="alert">{error}</p> : null}
      </div>
    );
  }

  const canGenerate = hasStyle && Boolean(actualKitId && resolvedMaterial && quote) && !busy && !isRunning && !locked;
  const styleTakeover = stylePhase === "forming" || stylePhase === "interrupted";
  return <div className={`create-workspace ${styleTakeover ? "is-job-wait" : step === 1 ? "is-style" : "is-model"}`}>
    {styleTakeover ? null : <nav className="create-step-nav" aria-label="Creation steps"><button type="button" aria-current={step === 1 ? "step" : undefined} onClick={() => setStep(1)}>01 · Style</button><button type="button" disabled={!hasStyle} aria-current={step === 2 ? "step" : undefined} onClick={() => setStep(2)}>02 · Model</button></nav>}
    {step === 1 ? <section className="create-style-workspace">
      {styleTakeover ? null : <><p className="workbench-kicker">01 · Style</p><h2>Choose a color direction.</h2>
      <div className="style-main-tabs" aria-label="Style workspace">{(["discover", "create", "saved"] as const).map(value => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)}>{value === "discover" ? "Discover" : value === "create" ? "Create" : "Saved"}</button>)}</div></>}
      <div hidden={styleTakeover || tab !== "discover"}><StyleDiscovery presets={catalog.stylePresets} community={community} previews={previews ?? []} busy={busy || Boolean(isRunning)} initialCommunity={search.communityStyle} selectedId={styleMode === "preset" ? presetId ?? undefined : communityId ?? savedId ?? undefined}
        onPreset={row => { setStyleMode("preset"); setPresetId(row._id); setMaterialId(null); setWeathering(null); setMood([]); }}
        onCommunity={row => { setBusy(true); setError(null); void saveCommunity({ styleId: row.id }).then(saved => { setStyleMode("custom"); setCustom(saved.intent); setSavedId(saved.styleId); setCommunityId(row.id); setMaterialId(null); setWeathering(null); setMood([]); }).catch(failure => setError(errorText(failure))).finally(() => setBusy(false)); }} /></div>
      <div hidden={!styleTakeover && tab === "discover"}><CustomStylePicker userId={viewer?._id ?? "guest"} creditCost={catalog.priceRules.find(row => row.actionType === "generate-style-suggestion")?.creditCost} creditBalance={viewer?.credits?.balance ?? 0} selectedId={savedId} view={styleTakeover || tab !== "saved" ? "describe" : "mine"}
        onPhaseChange={handleStylePhase}
        onUse={(value, id) => { setStyleMode("custom"); setCustom(value); setSavedId(id); setMaterialId(null); setWeathering(null); setMood([]); }} onClear={() => { setCustom(null); setSavedId(null); }} onApply={() => setStep(2)} /></div>
      {styleTakeover || tab === "create" ? null : <Button className="create-continue" disabled={!hasStyle || busy} onClick={() => setStep(2)}>Apply to a kit →</Button>}
    </section> : <>
      <section className="selected-style-strip" aria-label="Selected style"><p className="workbench-kicker">Selected style</p><div className="selected-style-identity"><StylePalette colors={colors} /><div><strong>{styleName ?? "Choose a style"}</strong><small>{intent?.graphicLanguage ?? preset?.shortDescription ?? "Your selected visual direction"}</small>{!colors.length ? <small>Palette follows your style description</small> : null}</div></div><button type="button" onClick={() => setStep(1)}>Change →</button></section>
      <div className="create-model-layout"><KitPicker selectedId={actualKitId ?? null} onSelect={setKitId} disabled={busy || Boolean(isRunning)} />
        <aside className="create-generate-panel" aria-label="Your preview"><p className="workbench-kicker">Your preview</p><div className="create-kit-portrait"><KitPortrait url={kit?.portrait} name={kit?.name ?? "Kit"} /></div><div className="create-kit-caption"><h3>{kit?.name ?? "Select a kit"}</h3><p>{kit ? [kit.grade, kit.scale, kit.releaseVersion].filter(Boolean).join(" · ") : "Choose the model for your next build"}</p></div>
          <section className="create-panel-style"><p className="workbench-kicker">Style</p><StylePalette colors={colors} /><strong>{styleName}</strong></section>
          <section className="create-panel-output"><p className="workbench-kicker">Output</p><strong>Preview image + paint plan</strong><span className="create-total-price">{quote ? `${quote.cost} credits` : "Pricing unavailable"}</span><Button className="create-generate-button" disabled={!canGenerate} onClick={() => void generate()}>{busy || isRunning ? "Generating preview…" : "Generate preview →"}</Button><button className="create-advanced-link" type="button" onClick={() => setAdvanced(true)}>Advanced options +</button></section>
        </aside>
      </div>
      <div className="create-mobile-generate"><div><strong>{kit?.name ?? "Choose a kit"}</strong><span>{quote?.cost ?? "—"} credits · Image + plan</span></div><Button disabled={!canGenerate} onClick={() => void generate()}>{busy || isRunning ? "Generating…" : "Generate →"}</Button></div>
    </>}
    {locked ? <p className="create-flow-error" role="alert">{pack ? access.message : "Loading creator pack access…"}</p> : null}
    {error ? <p className="create-flow-error" role="alert">{error}</p> : null}
    {latestRun && !shouldShowJobSheet && !styleTakeover ? <section className="create-run-status" aria-live="polite"><div><p className="workbench-kicker">Latest build</p><strong>{latestRun.title}</strong><p>{latestRun.status === "succeeded" ? "Your preview is ready in your library." : latestRun.status === "failed" ? `${latestRun.error ?? "Generation failed."}${latestRun.refunded ? ` All ${latestRun.cost} credits were returned.` : ""}` : "A preview is in progress."}</p></div>
      <Button variant="outline" onClick={() => { setDismissedRunId(null); setWatchingRunId(latestRun.id); }}>View job status →</Button>
      {latestRun.conceptId ? <Button asChild variant="outline"><Link to="/library/$conceptId" params={{ conceptId: latestRun.conceptId }} search={{ tab: "overview" }}>View details →</Link></Button> : <Link to="/library">Open library →</Link>}
    </section> : null}
    <Sheet open={advanced} onOpenChange={setAdvanced}><SheetContent className="create-advanced-sheet"><SheetHeader><SheetTitle>Advanced options</SheetTitle><SheetDescription>Defaults come from your selected style. The standard output includes both the image and paint plan.</SheetDescription></SheetHeader><div className="create-advanced-fields"><label>Finish<select disabled={Boolean(isRunning)} value={materialId ?? "auto"} onChange={event => setMaterialId(event.target.value === "auto" ? null : event.target.value as Id<"materialPresets">)}><option value="auto">Style default · {defaults.material?.slug ?? "Unavailable"}</option>{catalog.materialPresets.map(row => <option key={row._id} value={row._id}>{row.name}</option>)}</select></label><label>Weathering<select disabled={Boolean(isRunning)} value={weathering ?? "auto"} onChange={event => setWeathering(event.target.value === "auto" ? null : event.target.value as "clean" | "light" | "heavy")}><option value="auto">Style default · {defaults.weathering}</option>{["clean", "light", "heavy"].map(value => <option key={value}>{value}</option>)}</select></label><fieldset disabled={Boolean(isRunning)}><legend>Mood</legend><button type="button" aria-pressed={!mood.length} onClick={() => setMood([])}>Style default · {defaults.mood}</button>{moodOptions.map(value => <button type="button" key={value} aria-pressed={mood.includes(value)} onClick={() => setMood(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])}>{value.replace(/-/g, " ")}</button>)}</fieldset><label>Notes · {notes.length}/100<Textarea value={notes} disabled={Boolean(isRunning)} maxLength={100} onChange={event => setNotes(event.target.value)} placeholder="Optional refinements" /></label><p>New works are private. Publish them later from your library.</p><Button onClick={() => setAdvanced(false)}>Done</Button></div></SheetContent></Sheet>
  </div>;
}

function errorText(error: unknown) {
  const text = error instanceof Error ? error.message : "Could not start this preview";
  return (text.match(/Uncaught (?:Error|ConvexError): ([^\n]+)/)?.[1] ?? text.split("\n")[0]).replace(/^(?:Uncaught Error:\s*)+/, "");
}
