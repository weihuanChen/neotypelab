import { UserButton } from "@clerk/tanstack-react-start";
import { useMutation, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

type SpecKind = "material" | "paint-finish" | "style" | "weathering" | "identity-lock";
type SpecSection = SpecKind | "prompt-preview" | "tests";
type SpecStatus = "draft" | "active";
type TestStatus = "untested" | "testing" | "passed" | "failed";

type PresetDraft = {
  changelog: string;
  name: string;
  renderBehaviorText: string;
  slug: string;
  specJson: string;
  status: SpecStatus;
  testNotes: string;
  testStatus: TestStatus;
  version: string;
};

const navItems: Array<{ href: string; label: string; section: SpecSection }> = [
  { href: "/spec-admin/materials", label: "Materials", section: "material" },
  { href: "/spec-admin/paint-finishes", label: "Paint Finishes", section: "paint-finish" },
  { href: "/spec-admin/weathering", label: "Weathering", section: "weathering" },
  { href: "/spec-admin/styles", label: "Styles", section: "style" },
  { href: "/spec-admin/identity-locks", label: "Identity Locks", section: "identity-lock" },
  { href: "/spec-admin/prompt-preview", label: "Prompt Preview", section: "prompt-preview" },
  { href: "/spec-admin/tests", label: "Spec Tests", section: "tests" },
];

const kindLabels: Record<SpecKind, string> = {
  "identity-lock": "Identity Lock",
  material: "Material Spec",
  "paint-finish": "Paint Finish Spec",
  style: "Style Spec",
  weathering: "Weathering Spec",
};

const priorityLabels: Record<SpecKind, string> = {
  "identity-lock": "P1",
  material: "P2",
  "paint-finish": "P3",
  weathering: "P4",
  style: "P5",
};

export function SpecAdminWorkbench({ section }: { section: SpecSection }) {
  const viewer = useQuery(api.users.viewer);

  if (viewer === undefined) {
    return <SpecAdminShell section={section}>Loading admin session.</SpecAdminShell>;
  }

  if (!viewer?.canManagePlatform) {
    return (
      <SpecAdminShell section={section}>
        <section className="border-2 border-accent-red bg-accent-red/10 p-6 text-accent-red">
          <p className="text-xs uppercase tracking-[0.28em]">Access denied</p>
          <h2 className="mt-3 text-2xl font-semibold">Spec calibration is admin-only.</h2>
        </section>
      </SpecAdminShell>
    );
  }

  return (
    <SpecAdminShell section={section}>
      {section === "prompt-preview" ? (
        <PromptPreviewPanel />
      ) : section === "tests" ? (
        <SpecTestRecordsPanel />
      ) : (
        <PresetEditor kind={section} />
      )}
    </SpecAdminShell>
  );
}

function SpecAdminShell({
  children,
  section,
}: {
  children: ReactNode;
  section: SpecSection;
}) {
  return (
    <main className="terminal-shell">
      <section className="terminal-shell__header">
        <div>
          <p className="showcase-kicker">Spec Calibration Admin</p>
          <h1>Rendering Pipeline V2 Control</h1>
          <p>
            JSON-first calibration for material, paint finish, weathering, style, and identity-lock specs.
          </p>
        </div>
        <div className="terminal-shell__auth">
          <UserButton />
        </div>
      </section>

      <section className="terminal-shell__nav-panel">
        <nav className="terminal-shell__nav" aria-label="Spec admin routes">
          <a className="showcase-chip is-button" href="/t/admin">
            Admin
          </a>
          {navItems.map((item) => (
            <a
              aria-current={section === item.section ? "page" : undefined}
              className={
                section === item.section
                  ? "showcase-chip is-active"
                  : "showcase-chip is-button"
              }
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="terminal-shell__operator">
          <span>Priority</span>
          <strong>Identity / Material / Paint Finish / Weathering / Style</strong>
          <em>Prompt template untouched</em>
        </div>
      </section>

      <div className="terminal-shell__body">{children}</div>
    </main>
  );
}

function PresetEditor({ kind }: { kind: SpecKind }) {
  const presets = useQuery(api.specAdmin.listPresets, { kind });
  const createPreset = useMutation(api.specAdmin.createPreset);
  const updatePreset = useMutation(api.specAdmin.updatePreset);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PresetDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPreset = useMemo(() => {
    if (!presets || presets.length === 0) {
      return null;
    }
    return presets.find((preset) => preset._id === selectedPresetId) ?? presets[0];
  }, [presets, selectedPresetId]);

  useEffect(() => {
    if (!selectedPreset) {
      setDraft(null);
      return;
    }
    setSelectedPresetId(selectedPreset._id);
    setDraft({
      changelog: selectedPreset.changelog ?? "",
      name: selectedPreset.name,
      renderBehaviorText: selectedPreset.renderBehaviorText,
      slug: selectedPreset.slug,
      specJson: selectedPreset.specJson,
      status: selectedPreset.status,
      testNotes: selectedPreset.testNotes ?? "",
      testStatus: selectedPreset.testStatus,
      version: selectedPreset.version,
    });
  }, [selectedPreset]);

  async function onCreatePreset() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const presetId = await createPreset({ kind });
      setSelectedPresetId(presetId);
      setMessage(`Created ${kindLabels[kind]} draft.`);
    } catch (createError) {
      setError(readError(createError));
    } finally {
      setBusy(false);
    }
  }

  async function onSavePreset() {
    if (!selectedPreset || !draft) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await updatePreset({
        changelog: emptyToUndefined(draft.changelog),
        name: draft.name,
        presetId: selectedPreset._id,
        renderBehaviorText: draft.renderBehaviorText,
        slug: draft.slug,
        specJson: draft.specJson,
        status: draft.status,
        testNotes: emptyToUndefined(draft.testNotes),
        testStatus: draft.testStatus,
        version: draft.version,
      });
      setMessage(`Saved ${draft.name}.`);
    } catch (saveError) {
      setError(readError(saveError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="border-2 border-line-primary bg-panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-accent-orange">
              {priorityLabels[kind]} / {kindLabels[kind]}
            </p>
            <h2 className="mt-2 text-xl font-semibold">Preset Registry</h2>
          </div>
          <Button
            className="h-9 rounded-[14px] border border-line-secondary bg-main px-3 text-xs text-ink-primary hover:bg-hover-subtle"
            disabled={busy}
            onClick={() => void onCreatePreset()}
            type="button"
          >
            New
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {presets === undefined ? (
            <p className="text-sm text-ink-secondary">Loading presets.</p>
          ) : presets.length === 0 ? (
            <p className="text-sm leading-6 text-ink-secondary">
              No presets yet. Create a draft to begin calibration.
            </p>
          ) : (
            presets.map((preset) => (
              <button
                className={cn(
                  "w-full border p-3 text-left transition-colors",
                  selectedPreset?._id === preset._id
                    ? "border-accent-teal bg-accent-teal/10"
                    : "border-line-secondary bg-main hover:border-line-active"
                )}
                key={preset._id}
                onClick={() => setSelectedPresetId(preset._id)}
                type="button"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-primary">{preset.name}</p>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                    {preset.status}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-ink-secondary">{preset.slug}</p>
                <p className="mt-2 text-xs text-ink-muted">
                  {preset.version} / {preset.testStatus}
                </p>
                <p className="mt-1 text-[11px] text-ink-muted">
                  Updated {formatDateTime(preset.updatedAt)}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="border-2 border-line-primary bg-panel p-5">
        {!draft || !selectedPreset ? (
          <p className="text-sm text-ink-secondary">Select or create a preset.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 border border-line-secondary bg-main p-3 text-xs text-ink-secondary md:grid-cols-3">
              <Meta label="Kind" value={kindLabels[kind]} />
              <Meta label="Created" value={formatDateTime(selectedPreset.createdAt)} />
              <Meta label="Updated" value={formatDateTime(selectedPreset.updatedAt)} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name">
                <Input
                  className="border-line-secondary bg-main text-ink-primary"
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  value={draft.name}
                />
              </Field>
              <Field label="Slug">
                <Input
                  className="border-line-secondary bg-main font-mono text-ink-primary"
                  onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
                  value={draft.slug}
                />
              </Field>
              <Field label="Status">
                <Select
                  onValueChange={(value: SpecStatus) => setDraft({ ...draft, status: value })}
                  value={draft.status}
                >
                  <SelectTrigger className="border-line-secondary bg-main text-ink-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-line-secondary bg-panel text-ink-primary">
                    <SelectItem value="draft">draft</SelectItem>
                    <SelectItem value="active">active</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Test Status">
                <Select
                  onValueChange={(value: TestStatus) =>
                    setDraft({ ...draft, testStatus: value })
                  }
                  value={draft.testStatus}
                >
                  <SelectTrigger className="border-line-secondary bg-main text-ink-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-line-secondary bg-panel text-ink-primary">
                    <SelectItem value="untested">untested</SelectItem>
                    <SelectItem value="testing">testing</SelectItem>
                    <SelectItem value="passed">passed</SelectItem>
                    <SelectItem value="failed">failed</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Version">
                <Input
                  className="border-line-secondary bg-main font-mono text-ink-primary"
                  onChange={(event) => setDraft({ ...draft, version: event.target.value })}
                  value={draft.version}
                />
              </Field>
              <Field label="Changelog">
                <Input
                  className="border-line-secondary bg-main text-ink-primary"
                  onChange={(event) => setDraft({ ...draft, changelog: event.target.value })}
                  value={draft.changelog}
                />
              </Field>
            </div>

            <Field label="Spec JSON">
              <Textarea
                className="min-h-[360px] border-line-secondary bg-main font-mono text-xs leading-5 text-ink-primary"
                onChange={(event) => setDraft({ ...draft, specJson: event.target.value })}
                value={draft.specJson}
              />
            </Field>

            <Field label="Render Behavior Text">
              <Textarea
                className="min-h-[96px] border-line-secondary bg-main text-ink-primary"
                onChange={(event) =>
                  setDraft({ ...draft, renderBehaviorText: event.target.value })
                }
                value={draft.renderBehaviorText}
              />
            </Field>

            <Field label="Test Notes">
              <Textarea
                className="min-h-[96px] border-line-secondary bg-main text-ink-primary"
                onChange={(event) => setDraft({ ...draft, testNotes: event.target.value })}
                value={draft.testNotes}
              />
            </Field>

            {error ? (
              <div className="border border-accent-red bg-accent-red/10 p-3 text-sm text-accent-red">
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="border border-accent-teal bg-accent-teal/10 p-3 text-sm text-accent-teal">
                {message}
              </div>
            ) : null}

            <Button
              className="h-11 rounded-[16px] border border-accent-teal bg-[#13241B] px-5 text-ink-primary hover:bg-white/10"
              disabled={busy}
              onClick={() => void onSavePreset()}
              type="button"
            >
              {busy ? "Saving" : "Save Spec Preset"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function PromptPreviewPanel() {
  const options = useQuery(api.specAdmin.listPromptPreviewOptions);
  const createTestRecord = useMutation(api.specAdmin.createTestRecord);
  const [baseModelId, setBaseModelId] = useState("none");
  const [identityLockId, setIdentityLockId] = useState("none");
  const [materialSpecId, setMaterialSpecId] = useState("none");
  const [paintFinishSpecId, setPaintFinishSpecId] = useState("none");
  const [styleSpecId, setStyleSpecId] = useState("none");
  const [weatheringSpecId, setWeatheringSpecId] = useState("none");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [testTitle, setTestTitle] = useState("");
  const [testStatus, setTestStatus] = useState<TestStatus>("testing");
  const [resultImageUrl, setResultImageUrl] = useState("");
  const [testNotes, setTestNotes] = useState("");
  const [testRecordBusy, setTestRecordBusy] = useState(false);
  const [testRecordMessage, setTestRecordMessage] = useState<string | null>(null);
  const [testRecordError, setTestRecordError] = useState<string | null>(null);

  const preview = useQuery(
    api.specAdmin.compilePromptPreview,
    options === undefined
      ? "skip"
      : {
          baseModelId: optionalId<"baseModels">(baseModelId),
          identityLockId: optionalId<"specPresets">(identityLockId),
          materialSpecId: optionalId<"specPresets">(materialSpecId),
          paintFinishSpecId: optionalId<"specPresets">(paintFinishSpecId),
          styleSpecId: optionalId<"specPresets">(styleSpecId),
          weatheringSpecId: optionalId<"specPresets">(weatheringSpecId),
        }
  );

  const presets = options?.presets ?? [];
  const compiledPrompt = preview?.compiledPrompt ?? "";

  async function onCopyCompiledPrompt() {
    if (!compiledPrompt) {
      return;
    }

    try {
      await navigator.clipboard.writeText(compiledPrompt);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 1800);
  }

  async function onCreateTestRecord() {
    if (!compiledPrompt) {
      return;
    }
    setTestRecordBusy(true);
    setTestRecordMessage(null);
    setTestRecordError(null);
    try {
      await createTestRecord({
        baseModelId: optionalId<"baseModels">(baseModelId),
        compiledPrompt,
        identityLockId: optionalId<"specPresets">(identityLockId),
        materialSpecId: optionalId<"specPresets">(materialSpecId),
        paintFinishSpecId: optionalId<"specPresets">(paintFinishSpecId),
        resultImageUrl: emptyToUndefined(resultImageUrl),
        styleSpecId: optionalId<"specPresets">(styleSpecId),
        testNotes: emptyToUndefined(testNotes),
        testStatus,
        title: testTitle,
        weatheringSpecId: optionalId<"specPresets">(weatheringSpecId),
      });
      setTestRecordMessage("Saved test record. Review it in Spec Tests.");
      setTestTitle("");
      setResultImageUrl("");
      setTestNotes("");
    } catch (createError) {
      setTestRecordError(readError(createError));
    } finally {
      setTestRecordBusy(false);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="border-2 border-line-primary bg-panel p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-accent-teal">
          Compiled Prompt Preview
        </p>
        <h2 className="mt-2 text-xl font-semibold">Constraint Stack</h2>
        <p className="mt-3 text-sm leading-6 text-ink-secondary">
          Preview combines current base model identity with calibrated spec presets. It does not
          call image generation.
        </p>

        <div className="mt-5 space-y-4">
          <Field label="Base Model">
            <Select onValueChange={setBaseModelId} value={baseModelId}>
              <SelectTrigger className="border-line-secondary bg-main text-ink-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-line-secondary bg-panel text-ink-primary">
                <SelectItem value="none">None</SelectItem>
                {options?.baseModels.map((baseModel) => (
                  <SelectItem key={baseModel._id} value={baseModel._id}>
                    {baseModel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <PresetSelect
            kind="material"
            label="Material Spec"
            onChange={setMaterialSpecId}
            presets={presets}
            value={materialSpecId}
          />
          <PresetSelect
            kind="paint-finish"
            label="Paint Finish Spec"
            onChange={setPaintFinishSpecId}
            presets={presets}
            value={paintFinishSpecId}
          />
          <PresetSelect
            kind="weathering"
            label="Weathering Spec"
            onChange={setWeatheringSpecId}
            presets={presets}
            value={weatheringSpecId}
          />
          <PresetSelect
            kind="style"
            label="Style Spec"
            onChange={setStyleSpecId}
            presets={presets}
            value={styleSpecId}
          />
          <PresetSelect
            kind="identity-lock"
            label="Identity Lock"
            onChange={setIdentityLockId}
            presets={presets}
            value={identityLockId}
          />
        </div>

        <div className="mt-6 border border-line-secondary bg-main p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-accent-orange">
            Test Record Upload
          </p>
          <div className="mt-4 space-y-4">
            <Field label="Test Title">
              <Input
                className="border-line-secondary bg-panel text-ink-primary"
                onChange={(event) => setTestTitle(event.target.value)}
                placeholder="Matte ceramic armor v0.1"
                value={testTitle}
              />
            </Field>
            <Field label="Verdict">
              <Select
                onValueChange={(value: TestStatus) => setTestStatus(value)}
                value={testStatus}
              >
                <SelectTrigger className="border-line-secondary bg-panel text-ink-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-line-secondary bg-panel text-ink-primary">
                  <SelectItem value="testing">testing</SelectItem>
                  <SelectItem value="passed">passed</SelectItem>
                  <SelectItem value="failed">failed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Result Image URL">
              <Input
                className="border-line-secondary bg-panel text-ink-primary"
                onChange={(event) => setResultImageUrl(event.target.value)}
                placeholder="https://..."
                value={resultImageUrl}
              />
            </Field>
            <Field label="Test Notes">
              <Textarea
                className="min-h-[96px] border-line-secondary bg-panel text-ink-primary"
                onChange={(event) => setTestNotes(event.target.value)}
                placeholder="What worked, what failed, what should change."
                value={testNotes}
              />
            </Field>
            {testRecordError ? (
              <div className="border border-accent-red bg-accent-red/10 p-3 text-sm text-accent-red">
                {testRecordError}
              </div>
            ) : null}
            {testRecordMessage ? (
              <div className="border border-accent-teal bg-accent-teal/10 p-3 text-sm text-accent-teal">
                {testRecordMessage}
              </div>
            ) : null}
            <Button
              className="h-10 rounded-[14px] border border-accent-teal bg-[#13241B] px-4 text-xs text-ink-primary hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!compiledPrompt || testRecordBusy}
              onClick={() => void onCreateTestRecord()}
              type="button"
            >
              {testRecordBusy ? "Saving" : "Save Test Record"}
            </Button>
          </div>
        </div>
      </aside>

      <div className="border-2 border-line-primary bg-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-accent-orange">
              Preview Output
            </p>
            <h2 className="mt-2 text-xl font-semibold">Compiled Prompt Preview</h2>
          </div>
          <Button
            className="h-9 rounded-[14px] border border-line-secondary bg-main px-3 text-xs text-ink-primary hover:bg-hover-subtle disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!compiledPrompt}
            onClick={() => void onCopyCompiledPrompt()}
            type="button"
          >
            {copyState === "copied"
              ? "Copied"
              : copyState === "failed"
                ? "Copy failed"
                : "Copy Prompt"}
          </Button>
        </div>
        <pre className="mt-4 min-h-[560px] overflow-auto whitespace-pre-wrap border border-line-secondary bg-main p-4 font-mono text-xs leading-5 text-ink-secondary">
          {compiledPrompt || "Select specs to compile a preview."}
        </pre>
      </div>
    </section>
  );
}

function SpecTestRecordsPanel() {
  const records = useQuery(api.specAdmin.listTestRecords, { limit: 60 });
  const applyTestRecord = useMutation(api.specAdmin.applyTestRecord);
  const [applyingRecordId, setApplyingRecordId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onApplyTestRecord(testRecordId: Id<"specTestRecords">) {
    setApplyingRecordId(testRecordId);
    setMessage(null);
    setError(null);
    try {
      const result = await applyTestRecord({ testRecordId });
      setMessage(`Applied result to ${result.appliedCount} linked spec preset(s).`);
    } catch (applyError) {
      setError(readError(applyError));
    } finally {
      setApplyingRecordId(null);
    }
  }

  return (
    <section className="space-y-5">
      <div className="border-2 border-line-primary bg-panel p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-accent-teal">
          Spec Test Management
        </p>
        <h2 className="mt-2 text-xl font-semibold">Test Records</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">
          Records saved from Prompt Preview keep the exact compiled prompt snapshot, selected
          specs, result reference, and verdict. Apply writes the verdict back to the linked spec
          presets as their current test status.
        </p>
      </div>

      {error ? (
        <div className="border border-accent-red bg-accent-red/10 p-3 text-sm text-accent-red">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="border border-accent-teal bg-accent-teal/10 p-3 text-sm text-accent-teal">
          {message}
        </div>
      ) : null}

      {records === undefined ? (
        <div className="border-2 border-line-primary bg-panel p-5 text-sm text-ink-secondary">
          Loading test records.
        </div>
      ) : records.length === 0 ? (
        <div className="border-2 border-line-primary bg-panel p-5 text-sm text-ink-secondary">
          No test records yet. Save one from Prompt Preview after compiling a prompt.
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => {
            const specSummaries = [
              { label: "Material", spec: record.specs.material },
              { label: "Paint Finish", spec: record.specs.paintFinish },
              { label: "Weathering", spec: record.specs.weathering },
              { label: "Style", spec: record.specs.style },
              { label: "Identity Lock", spec: record.specs.identityLock },
            ];

            return (
              <article
                className="border-2 border-line-primary bg-panel p-5"
                key={record._id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-accent-orange">
                      {record.testStatus}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-ink-primary">
                      {record.title}
                    </h3>
                    <p className="mt-1 text-xs text-ink-muted">
                      Created {formatDateTime(record.createdAt)}
                      {record.appliedAt
                        ? ` / Applied ${formatDateTime(record.appliedAt)}`
                        : ""}
                    </p>
                  </div>
                  <Button
                    className="h-9 rounded-[14px] border border-accent-teal bg-[#13241B] px-3 text-xs text-ink-primary hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={applyingRecordId === record._id}
                    onClick={() => void onApplyTestRecord(record._id)}
                    type="button"
                  >
                    {applyingRecordId === record._id ? "Applying" : "Apply Result"}
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 border border-line-secondary bg-main p-3 text-xs text-ink-secondary lg:grid-cols-3">
                  <Meta label="Base Model" value={record.baseModelName ?? "None"} />
                  <Meta label="Result" value={record.resultImageUrl ?? "No result URL"} />
                  <Meta label="Updated" value={formatDateTime(record.updatedAt)} />
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                  {specSummaries.map((item) => (
                    <div
                      className="border border-line-secondary bg-main p-3 text-xs"
                      key={item.label}
                    >
                      <p className="uppercase tracking-[0.18em] text-ink-muted">
                        {item.label}
                      </p>
                      {item.spec ? (
                        <>
                          <p className="mt-2 font-semibold text-ink-primary">
                            {item.spec.name}
                          </p>
                          <p className="mt-1 font-mono text-ink-secondary">
                            {item.spec.version} / {item.spec.testStatus}
                          </p>
                        </>
                      ) : (
                        <p className="mt-2 text-ink-secondary">Not linked</p>
                      )}
                    </div>
                  ))}
                </div>

                {record.testNotes ? (
                  <div className="mt-4 border border-line-secondary bg-main p-3 text-sm leading-6 text-ink-secondary">
                    {record.testNotes}
                  </div>
                ) : null}

                <details className="mt-4 border border-line-secondary bg-main">
                  <summary className="cursor-pointer px-3 py-2 text-xs uppercase tracking-[0.2em] text-ink-muted">
                    Prompt Snapshot
                  </summary>
                  <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap border-t border-line-secondary p-3 font-mono text-xs leading-5 text-ink-secondary">
                    {record.compiledPrompt}
                  </pre>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PresetSelect({
  kind,
  label,
  onChange,
  presets,
  value,
}: {
  kind: SpecKind;
  label: string;
  onChange: (value: string) => void;
  presets: Array<{
    _id: Id<"specPresets">;
    kind: SpecKind;
    name: string;
    status: SpecStatus;
    testStatus: TestStatus;
    version: string;
  }>;
  value: string;
}) {
  const filtered = presets.filter((preset) => preset.kind === kind);
  return (
    <Field label={label}>
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger className="border-line-secondary bg-main text-ink-primary">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-line-secondary bg-panel text-ink-primary">
          <SelectItem value="none">None</SelectItem>
          {filtered.map((preset) => (
            <SelectItem key={preset._id} value={preset._id}>
              {preset.name} / {preset.version} / {preset.testStatus}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-ink-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">{label}</p>
      <p className="mt-1 text-ink-primary">{value}</p>
    </div>
  );
}

function optionalId<TableName extends "baseModels" | "specPresets">(value: string) {
  return value === "none" ? undefined : (value as Id<TableName>);
}

function emptyToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown spec admin error";
}

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
