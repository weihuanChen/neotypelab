"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "@tanstack/react-router";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { maxCreativeNotesLength, type StyleIntent } from "@/convex/creativeContracts";
import { readStyleIntent, resolveStyleRefinements } from "@/convex/styleRefinements";
import { getCreatorPackAccessCopy } from "@/lib/creatorPackAccess";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { StyleDiscovery } from "./StyleDiscovery";
import { CustomStylePicker } from "./CustomStylePicker";
import { StylePalette, displayPalette } from "./StylePalette";
import { KitPicker, KitPortrait } from "./KitPicker";
import { CustomKitPicker, type CustomKitSelection } from "./CustomKitPicker";
import { GenerationJobSheet } from "./GenerationJobSheet";
import { useNudge } from "./useNudge";
import type { CreateWorkbenchSearch } from "./createSearch";
import { SystemState, systemStates } from "@/src/components/system-state";
import { AiDisclosureNote } from "@/src/components/legal/AiDisclosureNote";
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
  const [inspireView, setInspireView] = useState<"strip" | "mine">("strip");
  const [seed, setSeed] = useState<{ text: string; nonce: number }>();
  const [refineOpen, setRefineOpen] = useState(Boolean(search.remix));
  const [igniting, setIgniting] = useState(false);
  const wasReady = useRef(false);
  const styleAreaRef = useRef<HTMLElement>(null);
  const styleStripRef = useRef<HTMLElement>(null);
  const kitAreaRef = useRef<HTMLDivElement>(null);
  const { hint, nudge, tell, clear: clearHint } = useNudge();
  const [styleMode, setStyleMode] = useState<"preset" | "custom">(search.communityStyle ? "custom" : "preset");
  const [presetId, setPresetId] = useState<Id<"stylePresets"> | null>(null);
  const [custom, setCustom] = useState<StyleIntent | null>(null);
  const [customDescription, setCustomDescription] = useState<string>();
  const [savedId, setSavedId] = useState<Id<"userStyles"> | null>(null);
  const [communityId, setCommunityId] = useState<string>();
  const [kitId, setKitId] = useState<Id<"baseModels"> | null>(null);
  const customKitAvailability = useQuery(api.customKits.availability);
  const [kitModeChoice, setKitMode] = useState<"catalog" | "custom" | null>(null);
  const kitMode = kitModeChoice ?? (search.remix || search.recommendedBaseModel || customKitAvailability?.enabled === false ? "catalog" : "custom");
  const [customKit, setCustomKit] = useState<CustomKitSelection | null>(null);
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
    if (phase !== "input") setInspireView("strip");
  }, []);
  const appliedSearch = useRef(false);
  const requestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const preset = catalog?.stylePresets.find(row => row._id === presetId);
  const intent = styleMode === "custom" ? custom : readStyleIntent(preset?.styleIntentJson);
  const defaults = resolveStyleRefinements(intent, catalog?.materialPresets ?? [], preset?.recommendedMaterialSlugs);
  const hasStyle = styleMode === "custom" ? Boolean(custom) : Boolean(preset);
  const styleName = styleMode === "custom" ? custom?.name : preset?.name;
  const colors = styleMode === "custom" && custom?.colors?.length
    ? custom.colors.map((color, index) => ({ id: `style-color-${index}`, role: color.name, hex: color.hex, weight: color.coverage }))
    : styleMode === "preset" ? displayPalette(preset?.slug ?? "") : [];
  const isRunning = latestRun?.status === "queued" || latestRun?.status === "running";
  const access = getCreatorPackAccessCopy({ creatorHandle: pack?.creator.handle, packType: pack?.packType ?? "free", viewer });
  const locked = Boolean(search.creatorPack && (!pack || (pack.packType === "premium" && !access.allowed)));
  const actualKitId = kitMode === "catalog" ? kit?._id : undefined;
  const hasKit = kitMode === "custom" ? Boolean(customKit?.versionId) : Boolean(actualKitId);
  const kitName = kitMode === "custom" ? customKit?.name : kit?.name;
  const kitPortrait = kitMode === "custom" ? customKit?.portrait : kit?.portrait;
  const resolvedMaterial = materialId ?? defaults.material?._id;
  const resolvedWeathering = weathering ?? defaults.weathering;
  const creditBalance = viewer?.credits?.balance;
  const creditsOk = !quote || creditBalance === undefined || creditBalance >= quote.cost;
  const ready = hasStyle && hasKit && Boolean(resolvedMaterial && quote) && creditsOk && !locked;
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [step]);
  useEffect(() => { clearHint(); }, [step, clearHint]);
  useEffect(() => {
    if (ready && !wasReady.current) {
      setIgniting(true);
      const timer = window.setTimeout(() => setIgniting(false), 1000);
      wasReady.current = true;
      return () => window.clearTimeout(timer);
    }
    wasReady.current = ready;
  }, [ready]);

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
      setWeathering(remix.weatheringLevel); setMood(remix.moodTags); setNotes(remix.notes?.slice(0, maxCreativeNotesLength) ?? "");
    }
  }, [catalog, remix, search]);

  async function generate() {
    if (!hasStyle || !hasKit || !resolvedMaterial || !quote || isRunning || busy || locked) return;
    const input = {
      kitVariantId: actualKitId,
      customKitId: kitMode === "custom" ? customKit?.id : undefined,
      customKitVersionId: kitMode === "custom" ? customKit?.versionId ?? undefined : undefined,
      stylePresetId: styleMode === "preset" ? presetId ?? undefined : undefined,
      userStyleId: styleMode === "custom" ? savedId ?? undefined : undefined,
      styleIntentJson: styleMode === "custom" && custom ? JSON.stringify(custom) : undefined,
      styleDescription: styleMode === "custom" ? customDescription : undefined,
      styleRevision: styleMode === "preset" ? preset?.styleIntentJson : undefined,
      materialPresetId: resolvedMaterial, moodTags: mood, weatheringLevel: resolvedWeathering,
      selectionSources: {
        material: materialId ? "user-selection" as const : "system-default" as const,
        weathering: weathering ? "user-selection" as const : "system-default" as const,
      },
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

  /** Generate is never disabled for missing input: check on click, then nudge or explain. */
  function requestGenerate(button: HTMLElement | null) {
    if (busy || isRunning) return;
    if (!hasStyle) { nudge({ button, target: styleStripRef.current, text: "Pick a style first." }); return; }
    if (!hasKit) { nudge({ button, target: kitAreaRef.current, focus: kitAreaRef.current?.querySelector<HTMLInputElement>(kitMode === "custom" ? 'input[type="file"]' : 'input[type="search"]'), text: kitMode === "custom" ? "Upload, scan and confirm your Custom Kit first." : "Pick a kit from the grid." }); return; }
    if (locked) { tell({ tone: "info", text: pack ? access.message : "Loading creator pack access…" }); return; }
    if (!quote) { tell({ tone: "info", text: "Pricing is unavailable right now. Try again in a moment." }); return; }
    if (!resolvedMaterial) { tell({ tone: "info", text: "Choose a finish in Advanced options to continue." }); setAdvanced(true); return; }
    if (!creditsOk) { tell({ tone: "info", text: `Needs ${quote.cost} credits · ${creditBalance} available.`, action: { label: "Get credits", href: "/pricing" } }); return; }
    clearHint();
    void generate();
  }

  function goToKitStep() {
    if (hasStyle) { setStep(2); return; }
    nudge({ target: styleAreaRef.current, text: "Form a style or use a direction first." });
  }

  const working = busy || Boolean(isRunning);
  const styleTakeover = stylePhase === "forming" || stylePhase === "interrupted";
  const generateClass = `psy-btn${ready ? " is-ready" : ""}${igniting ? " is-igniting" : ""}`;
  const hintLine = <p className={`create-hint${hint ? ` is-${hint.tone}` : ""}`} role="status">{hint?.text}{hint?.action ? <> <a href={hint.action.href}>{hint.action.label}</a></> : null}</p>;
  const lights = [
    { key: "style", label: "Style", ok: hasStyle, value: hasStyle ? "Ready" : "Missing" },
    { key: "kit", label: kitMode === "custom" ? "Custom Kit" : "Kit", ok: hasKit, value: hasKit ? "Ready" : kitMode === "custom" ? "Confirm structure" : "Pick one" },
    { key: "credits", label: "Credits", ok: Boolean(quote) && creditsOk, value: creditBalance === undefined ? "—" : `${creditBalance} available` },
  ];
  return <div className={`create-workspace ${styleTakeover ? "is-job-wait" : step === 1 ? "is-style" : "is-model"}`}>
    {styleTakeover ? null : <nav className="create-sequence" aria-label="Creation steps">
      <button type="button" aria-current={step === 1 ? "step" : undefined} onClick={() => setStep(1)}>
        <span className="create-sequence-bar" style={{ "--fill": hasStyle ? 1 : .15 } as CSSProperties} /><span className="create-sequence-label">01 · Style{styleName ? <em>{styleName}</em> : null}</span>
      </button>
      <button type="button" aria-current={step === 2 ? "step" : undefined} aria-disabled={!hasStyle || undefined} onClick={goToKitStep}>
        <span className="create-sequence-bar" style={{ "--fill": step === 2 ? (hasKit ? 1 : .15) : 0 } as CSSProperties} /><span className="create-sequence-label">02 · Kit{step === 2 && kitName ? <em>{kitName}</em> : null}</span>
      </button>
    </nav>}
    {step === 1 ? <section className="create-style-workspace" ref={styleAreaRef}>
      {!styleTakeover && inspireView === "mine" ? <div className="create-mine-heading"><h2>Your styles</h2><button type="button" onClick={() => setInspireView("strip")}>Back to the console</button></div> : null}
      <CustomStylePicker userId={viewer?._id ?? "guest"} creditCost={catalog.priceRules.find(row => row.actionType === "generate-style-suggestion")?.creditCost} creditBalance={creditBalance ?? 0} selectedId={savedId} view={!styleTakeover && inspireView === "mine" ? "mine" : "describe"} seed={seed}
        onPhaseChange={handleStylePhase}
        onUse={(value, id, description) => { setStyleMode("custom"); setCustom(value); setCustomDescription(description); setSavedId(id); setCommunityId(undefined); setMaterialId(null); setWeathering(null); setMood([]); }} onClear={() => { if (styleMode === "custom") { setCustom(null); setCustomDescription(undefined); setSavedId(null); setCommunityId(undefined); } }} onApply={() => setStep(2)} />
      {!styleTakeover && stylePhase === "input" && hasStyle ? <section className="create-style-chosen" aria-label="Style in use"><StylePalette colors={colors} /><div><small>Style in use</small><strong>{styleName}</strong></div><button type="button" className="psy-btn" disabled={busy} onClick={() => setStep(2)}>Apply to a kit</button></section> : null}
      {!styleTakeover && stylePhase === "input" && inspireView === "strip" ? <section className="create-inspiration" ref={styleStripRef}><StyleDiscovery presets={catalog.stylePresets} community={community} previews={previews ?? []} busy={working} initialCommunity={search.communityStyle} selectedId={styleMode === "preset" ? presetId ?? undefined : communityId ?? savedId ?? undefined}
        onLoad={text => setSeed({ text, nonce: Date.now() })}
        headingAction={<button type="button" onClick={() => setInspireView("mine")}>Your styles</button>}
        onPreset={row => { setStyleMode("preset"); setPresetId(row._id); setMaterialId(null); setWeathering(null); setMood([]); }}
        onCommunity={row => { setBusy(true); setError(null); void saveCommunity({ styleId: row.id }).then(saved => { setStyleMode("custom"); setCustom(saved.intent); setSavedId(saved.styleId); setCommunityId(row.id); setMaterialId(null); setWeathering(null); setMood([]); }).catch(failure => setError(errorText(failure))).finally(() => setBusy(false)); }} /></section> : null}
      {styleTakeover ? null : hintLine}
    </section> : <>
      <section className="selected-style-strip" ref={styleStripRef} aria-label="Selected style"><p className="workbench-kicker">Selected style</p><div className="selected-style-identity"><StylePalette colors={colors} /><div><strong>{styleName ?? "Choose a style"}</strong><small>{intent?.graphicLanguage ?? preset?.shortDescription ?? "Your selected visual direction"}</small>{!colors.length ? <small>Palette follows your style description</small> : null}</div></div><button type="button" onClick={() => setStep(1)}>Change style</button></section>
      <div className="create-model-layout"><div className="create-kit-inputs">
      <section className={`create-style-refinements${refineOpen || notes ? " is-open" : ""}`} aria-labelledby="style-refinements-title">
        {refineOpen || notes ? <>
        <label htmlFor="style-refinements"><span id="style-refinements-title">Refine this style</span><small>Optional · {notes.length}/{maxCreativeNotesLength}</small></label>
        <Textarea id="style-refinements" value={notes} disabled={working} maxLength={maxCreativeNotesLength} rows={2}
          onChange={event => setNotes(event.target.value)} aria-describedby="style-refinements-help"
          placeholder="Use blue and white armor, or specify colors for particular parts…" />
        <p id="style-refinements-help">Your color requests override the style’s default colors. Proportions stay open unless you specify them.</p>
        </> : <button type="button" className="create-refine-toggle" aria-expanded="false" onClick={() => setRefineOpen(true)}><span id="style-refinements-title">+ Refine colors for this build</span><small>Optional</small></button>}
      </section>
      <div ref={kitAreaRef} className="create-kit-area"><div className="create-kit-source" role="group" aria-label="Kit source"><button type="button" className="is-custom" disabled={working} aria-pressed={kitMode === "custom"} onClick={() => setKitMode("custom")}>Custom Kit</button><button type="button" disabled={working} aria-pressed={kitMode === "catalog"} onClick={() => setKitMode("catalog")}>Official Kit</button></div>
        {kitMode === "custom" ? <CustomKitPicker selectedId={customKit?.id ?? null} disabled={working} onChange={setCustomKit} /> : <KitPicker selectedId={actualKitId ?? null} onSelect={id => { setKitId(id); clearHint(); }} disabled={working} />}</div></div>
        <aside className="create-generate-panel" aria-label="Your preview"><p className="workbench-kicker">Your preview</p><div className="create-kit-portrait"><KitPortrait url={kitPortrait} name={kitName ?? "Kit"} /></div><div className="create-kit-caption"><h3>{kitName ?? "Select a kit"}</h3><p>{kitMode === "custom" ? "Custom Kit · Private reference" : kit ? [kit.grade, kit.scale, kit.releaseVersion].filter(Boolean).join(" · ") : "Choose the model for your next build"}</p></div>
          <section className="create-panel-style"><p className="workbench-kicker">Style</p><StylePalette colors={colors} /><strong>{styleName}</strong></section>
          <section className="create-panel-ready" aria-label="Build readiness"><ul>{lights.map(light => <li key={light.key} className={light.ok ? "is-ok" : undefined}><i aria-hidden="true" />{light.label}<span>{light.value}</span></li>)}</ul></section>
          <section className="create-panel-output"><p className="workbench-kicker">Output</p><strong>Preview image + paint plan</strong><span className="create-total-price">{quote ? `${quote.cost} credits` : "Pricing unavailable"}</span><button type="button" className={`${generateClass} create-generate-button`} aria-busy={working || undefined} onClick={event => requestGenerate(event.currentTarget)}>{working ? "Generating preview…" : "Generate preview"}</button>{hintLine}<button className="create-advanced-link" type="button" onClick={() => setAdvanced(true)}>Advanced options +</button><AiDisclosureNote kind="text-and-image" /></section>
        </aside>
      </div>
      <div className="create-mobile-generate"><div><strong>{kitName ?? "Choose a kit"}</strong><span>{hint?.text ?? `${quote?.cost ?? "—"} credits · Image + plan`}</span></div><button type="button" className={generateClass} aria-busy={working || undefined} onClick={event => requestGenerate(event.currentTarget)}>{working ? "Generating…" : "Generate"}</button></div>
    </>}
    {locked ? <p className="create-flow-error" role="alert">{pack ? access.message : "Loading creator pack access…"}</p> : null}
    {error ? <p className="create-flow-error" role="alert">{error}</p> : null}
    {latestRun && !shouldShowJobSheet && !styleTakeover ? <section className="create-run-status" aria-live="polite"><div><p className="workbench-kicker">Latest build</p><strong>{latestRun.title}</strong><p>{latestRun.status === "succeeded" ? "Your preview is ready in your library." : latestRun.status === "failed" ? `${latestRun.error ?? "Generation failed."}${latestRun.refunded ? ` All ${latestRun.cost} credits were returned.` : ""}` : "A preview is in progress."}</p></div>
      <Button variant="outline" onClick={() => { setDismissedRunId(null); setWatchingRunId(latestRun.id); }}>View job status →</Button>
      {latestRun.conceptId ? <Button asChild variant="outline"><Link to="/library/$conceptId" params={{ conceptId: latestRun.conceptId }} search={{ tab: "overview" }}>View details →</Link></Button> : <Link to="/library">Open library →</Link>}
    </section> : null}
    <Sheet open={advanced} onOpenChange={setAdvanced}><SheetContent className="create-advanced-sheet"><SheetHeader><SheetTitle>Advanced options</SheetTitle><SheetDescription>Defaults come from your selected style. The standard output includes both the image and paint plan.</SheetDescription></SheetHeader><div className="create-advanced-fields"><label>Finish<select disabled={Boolean(isRunning)} value={materialId ?? "auto"} onChange={event => setMaterialId(event.target.value === "auto" ? null : event.target.value as Id<"materialPresets">)}><option value="auto">Style default · {defaults.material?.slug ?? "Unavailable"}</option>{catalog.materialPresets.map(row => <option key={row._id} value={row._id}>{row.name}</option>)}</select></label><label>Weathering<select disabled={Boolean(isRunning)} value={weathering ?? "auto"} onChange={event => setWeathering(event.target.value === "auto" ? null : event.target.value as "clean" | "light" | "heavy")}><option value="auto">Style default · {defaults.weathering}</option>{["clean", "light", "heavy"].map(value => <option key={value}>{value}</option>)}</select></label><fieldset disabled={Boolean(isRunning)}><legend>Mood</legend><button type="button" aria-pressed={!mood.length} onClick={() => setMood([])}>Style default · {defaults.mood}</button>{moodOptions.map(value => <button type="button" key={value} aria-pressed={mood.includes(value)} onClick={() => setMood(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])}>{value.replace(/-/g, " ")}</button>)}</fieldset><p>New works are private. Publish them later from your library.</p><Button onClick={() => setAdvanced(false)}>Done</Button></div></SheetContent></Sheet>
  </div>;
}

function errorText(error: unknown) {
  const text = error instanceof Error ? error.message : "Could not start this preview";
  return (text.match(/Uncaught (?:Error|ConvexError): ([^\n]+)/)?.[1] ?? text.split("\n")[0]).replace(/^(?:Uncaught Error:\s*)+/, "");
}
