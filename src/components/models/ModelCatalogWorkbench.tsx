"use client";

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
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ReactNode, useMemo, useState } from "react";

type ModelCatalogData = FunctionReturnType<typeof api.modelCatalogAdmin.listModelCatalogData>;
type IpSeriesItem = ModelCatalogData["ipSeries"][number];
type BaseUnitItem = ModelCatalogData["baseUnits"][number];
type KitVariantItem = ModelCatalogData["kitVariants"][number];
type ModelTab = "ipSeries" | "baseUnits" | "kitVariants";
type ModelCatalogStatus = "active" | "prerelease" | "archived";

type IpSeriesDraft = {
  name: string;
  promptAnchor: string;
  rightsOwner: string;
  slug: string;
  universe: string;
  visualDNA: string;
  status: ModelCatalogStatus;
};

type BaseUnitDraft = {
  aliases: string;
  forbiddenChanges: string;
  ipSeriesId: string;
  keyShapeAnchors: string;
  name: string;
  nativeEquipment: string;
  promptAnchor: string;
  silhouetteType: string;
  slug: string;
  unitCode: string;
  status: ModelCatalogStatus;
};

type KitVariantDraft = {
  aliases: string;
  baseUnitId: string;
  complexityLevel: string;
  grade: string;
  name: string;
  panelDensity: string;
  primaryModelBrand: string;
  promptAnchor: string;
  releaseVersion: string;
  scale: string;
  slug: string;
  tags: string;
  thumbnailAssetKey: string;
  status: ModelCatalogStatus;
};

const emptyIpSeriesDraft: IpSeriesDraft = {
  name: "",
  promptAnchor: "",
  rightsOwner: "",
  slug: "",
  universe: "",
  visualDNA: "",
  status: "active",
};

const emptyBaseUnitDraft: BaseUnitDraft = {
  aliases: "",
  forbiddenChanges: "",
  ipSeriesId: "",
  keyShapeAnchors: "",
  name: "",
  nativeEquipment: "",
  promptAnchor: "",
  silhouetteType: "",
  slug: "",
  unitCode: "",
  status: "active",
};

const emptyKitVariantDraft: KitVariantDraft = {
  aliases: "",
  baseUnitId: "",
  complexityLevel: "",
  grade: "",
  name: "",
  panelDensity: "",
  primaryModelBrand: "",
  promptAnchor: "",
  releaseVersion: "",
  scale: "",
  slug: "",
  tags: "",
  thumbnailAssetKey: "",
  status: "active",
};

export function ModelCatalogWorkbench() {
  const viewer = useQuery(api.users.viewer);
  const canManagePlatform = Boolean(viewer?.canManagePlatform);
  const modelCatalog = useQuery(
    api.modelCatalogAdmin.listModelCatalogData,
    canManagePlatform ? {} : "skip"
  );

  const upsertIpSeries = useMutation(api.modelCatalogAdmin.upsertIpSeries);
  const archiveIpSeries = useMutation(api.modelCatalogAdmin.archiveIpSeries);
  const upsertBaseUnit = useMutation(api.modelCatalogAdmin.upsertBaseUnit);
  const archiveBaseUnit = useMutation(api.modelCatalogAdmin.archiveBaseUnit);
  const upsertKitVariant = useMutation(api.modelCatalogAdmin.upsertKitVariant);
  const archiveKitVariant = useMutation(api.modelCatalogAdmin.archiveKitVariant);

  const [activeTab, setActiveTab] = useState<ModelTab>("ipSeries");
  const [selectedIpSeriesId, setSelectedIpSeriesId] = useState<string>("new");
  const [selectedBaseUnitId, setSelectedBaseUnitId] = useState<string>("new");
  const [selectedKitVariantId, setSelectedKitVariantId] = useState<string>("new");
  const [ipSeriesDrafts, setIpSeriesDrafts] = useState<Record<string, IpSeriesDraft>>({
    new: emptyIpSeriesDraft,
  });
  const [baseUnitDrafts, setBaseUnitDrafts] = useState<Record<string, BaseUnitDraft>>({
    new: emptyBaseUnitDraft,
  });
  const [kitVariantDrafts, setKitVariantDrafts] = useState<Record<string, KitVariantDraft>>({
    new: emptyKitVariantDraft,
  });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedIpSeries = modelCatalog?.ipSeries.find((item) => item._id === selectedIpSeriesId) ?? null;
  const selectedBaseUnit = modelCatalog?.baseUnits.find((item) => item._id === selectedBaseUnitId) ?? null;
  const selectedKitVariant =
    modelCatalog?.kitVariants.find((item) => item._id === selectedKitVariantId) ?? null;

  const activeIpSeriesDraft =
    ipSeriesDrafts[selectedIpSeriesId] ??
    (selectedIpSeries ? createIpSeriesDraft(selectedIpSeries) : emptyIpSeriesDraft);
  const activeBaseUnitDraft =
    baseUnitDrafts[selectedBaseUnitId] ??
    (selectedBaseUnit ? createBaseUnitDraft(selectedBaseUnit) : emptyBaseUnitDraft);
  const activeKitVariantDraft =
    kitVariantDrafts[selectedKitVariantId] ??
    (selectedKitVariant ? createKitVariantDraft(selectedKitVariant) : emptyKitVariantDraft);

  const modelCounts = useMemo(
    () => ({
      ipSeries: modelCatalog?.ipSeries.length ?? 0,
      baseUnits: modelCatalog?.baseUnits.length ?? 0,
      kitVariants: modelCatalog?.kitVariants.length ?? 0,
      prerelease:
        (modelCatalog?.ipSeries.filter((item) => item.status === "prerelease").length ?? 0) +
        (modelCatalog?.baseUnits.filter((item) => item.status === "prerelease").length ?? 0) +
        (modelCatalog?.kitVariants.filter((item) => item.status === "prerelease").length ?? 0),
      archived:
        (modelCatalog?.ipSeries.filter((item) => item.status === "archived").length ?? 0) +
        (modelCatalog?.baseUnits.filter((item) => item.status === "archived").length ?? 0) +
        (modelCatalog?.kitVariants.filter((item) => item.status === "archived").length ?? 0),
    }),
    [modelCatalog]
  );

  const setIpSeriesDraft = (patch: Partial<IpSeriesDraft>) =>
    setIpSeriesDrafts((current) => ({
      ...current,
      [selectedIpSeriesId]: { ...activeIpSeriesDraft, ...patch },
    }));
  const setBaseUnitDraft = (patch: Partial<BaseUnitDraft>) =>
    setBaseUnitDrafts((current) => ({
      ...current,
      [selectedBaseUnitId]: { ...activeBaseUnitDraft, ...patch },
    }));
  const setKitVariantDraft = (patch: Partial<KitVariantDraft>) =>
    setKitVariantDrafts((current) => ({
      ...current,
      [selectedKitVariantId]: { ...activeKitVariantDraft, ...patch },
    }));

  const runAction = async ({
    action,
    key,
    success,
  }: {
    action: () => Promise<unknown>;
    key: string;
    success: string;
  }) => {
    setBusyKey(key);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await action();
      setStatusMessage(success);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Model catalog action failed");
    } finally {
      setBusyKey(null);
    }
  };

  if (viewer === undefined) {
    return <ModelCatalogLoading label="Resolving operator clearance." />;
  }

  if (!canManagePlatform) {
    return (
      <section className="border-2 border-accent-red bg-surface p-6 text-ink-primary">
        <p className="text-xs uppercase tracking-[0.3em] text-accent-red">Admin only</p>
        <h2 className="mt-3 text-3xl font-semibold">Model catalog access is locked.</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">
          IP / Series, Base Unit, and Kit Variant records control prompt-critical
          model identity and can only be edited by platform administrators.
        </p>
      </section>
    );
  }

  if (modelCatalog === undefined) {
    return <ModelCatalogLoading label="Loading model hierarchy." />;
  }

  return (
    <div className="space-y-6 text-ink-primary">
      <section className="border-2 border-line-primary bg-surface p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent-teal">Model DNA admin</p>
            <h2 className="mt-3 text-3xl font-semibold">IP, base units, and kit variants</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">
              Manage the model hierarchy that feeds prompt grounding: upstream IP / world
              context, canonical machine DNA, and downstream plastic kit variants.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-5 xl:min-w-[640px]">
            <ModelMetric label="IP" value={`${modelCounts.ipSeries}`} />
            <ModelMetric label="Units" value={`${modelCounts.baseUnits}`} />
            <ModelMetric label="Kits" value={`${modelCounts.kitVariants}`} />
            <ModelMetric label="Pre" value={`${modelCounts.prerelease}`} />
            <ModelMetric label="Archived" value={`${modelCounts.archived}`} />
          </div>
        </div>
      </section>

      {errorMessage ? (
        <StatusPanel tone="red">{errorMessage}</StatusPanel>
      ) : null}
      {statusMessage ? (
        <StatusPanel tone="green">{statusMessage}</StatusPanel>
      ) : null}

      <section className="border-2 border-line-primary bg-panel">
        <div className="grid border-b-2 border-line-primary md:grid-cols-3">
          <ModelTabButton
            active={activeTab === "ipSeries"}
            count={modelCounts.ipSeries}
            label="IP / Series"
            onClick={() => setActiveTab("ipSeries")}
          />
          <ModelTabButton
            active={activeTab === "baseUnits"}
            count={modelCounts.baseUnits}
            label="Base Units"
            onClick={() => setActiveTab("baseUnits")}
          />
          <ModelTabButton
            active={activeTab === "kitVariants"}
            count={modelCounts.kitVariants}
            label="Kit Variants"
            onClick={() => setActiveTab("kitVariants")}
          />
        </div>

        {activeTab === "ipSeries" ? (
          <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
            <ModelListPanel
              addLabel="New IP"
              emptyLabel="No IP / Series records yet."
              items={modelCatalog.ipSeries}
              onCreate={() => {
                setSelectedIpSeriesId("new");
                setIpSeriesDrafts((current) => ({ ...current, new: emptyIpSeriesDraft }));
              }}
              renderItem={(item) => (
                <button
                  className={cn(
                    "w-full border-b border-line-secondary p-4 text-left transition-colors hover:bg-hover-subtle",
                    selectedIpSeriesId === item._id && "bg-accent-teal/10"
                  )}
                  key={item._id}
                  onClick={() => setSelectedIpSeriesId(item._id)}
                  type="button"
                >
                  <ListItemHeader name={item.name} slug={item.slug} status={item.status} />
                  <p className="mt-2 text-xs leading-5 text-ink-secondary">
                    {item.universe ?? "No universe"} / {item.baseUnitCount} base units
                  </p>
                </button>
              )}
            />
            <IpSeriesForm
              busyKey={busyKey}
              draft={activeIpSeriesDraft}
              isNew={selectedIpSeriesId === "new"}
              onArchive={(mode) => {
                if (!selectedIpSeries) {
                  return;
                }
                void runAction({
                  key: `archive-ip-${mode}-${selectedIpSeries._id}`,
                  action: async () => {
                    await archiveIpSeries({ ipSeriesId: selectedIpSeries._id, mode });
                    if (mode === "delete") {
                      setSelectedIpSeriesId("new");
                      setIpSeriesDrafts((current) => ({ ...current, new: emptyIpSeriesDraft }));
                    }
                  },
                  success:
                    mode === "delete"
                      ? `Deleted IP / Series ${selectedIpSeries.name}.`
                          : `Archived IP / Series ${selectedIpSeries.name}.`,
                });
              }}
              onSave={() => {
                void runAction({
                  key: "save-ip-series",
                  action: () =>
                    upsertIpSeries({
                      ipSeriesId:
                        selectedIpSeriesId === "new"
                          ? undefined
                          : (selectedIpSeriesId as Id<"ipSeries">),
                      name: activeIpSeriesDraft.name,
                      slug: emptyToUndefined(activeIpSeriesDraft.slug),
                      universe: emptyToUndefined(activeIpSeriesDraft.universe),
                      rightsOwner: emptyToUndefined(activeIpSeriesDraft.rightsOwner),
                      visualDNA: emptyToUndefined(activeIpSeriesDraft.visualDNA),
                      promptAnchor: emptyToUndefined(activeIpSeriesDraft.promptAnchor),
                      isActive: activeIpSeriesDraft.status === "active",
                      status: activeIpSeriesDraft.status,
                    }).then((id) => {
                      setSelectedIpSeriesId(id);
                    }),
                  success: `Saved IP / Series ${activeIpSeriesDraft.name}.`,
                });
              }}
              onUpdate={setIpSeriesDraft}
              selected={selectedIpSeries}
            />
          </div>
        ) : null}

        {activeTab === "baseUnits" ? (
          <div className="grid gap-0 xl:grid-cols-[390px_minmax(0,1fr)]">
            <ModelListPanel
              addLabel="New Base Unit"
              emptyLabel="No base units yet."
              items={modelCatalog.baseUnits}
              onCreate={() => {
                setSelectedBaseUnitId("new");
                setBaseUnitDrafts((current) => ({
                  ...current,
                  new: {
                    ...emptyBaseUnitDraft,
                    ipSeriesId: selectedIpSeriesId !== "new" ? selectedIpSeriesId : "",
                  },
                }));
              }}
              renderItem={(item) => (
                <button
                  className={cn(
                    "w-full border-b border-line-secondary p-4 text-left transition-colors hover:bg-hover-subtle",
                    selectedBaseUnitId === item._id && "bg-accent-blue/10"
                  )}
                  key={item._id}
                  onClick={() => setSelectedBaseUnitId(item._id)}
                  type="button"
                >
                  <ListItemHeader name={item.name} slug={item.slug} status={item.status} />
                  <p className="mt-2 text-xs leading-5 text-ink-secondary">
                    {item.ipSeries?.name ?? "No IP"} / {item.kitVariantCount} kit variants
                  </p>
                </button>
              )}
            />
            <BaseUnitForm
              busyKey={busyKey}
              draft={activeBaseUnitDraft}
              ipSeries={modelCatalog.ipSeries}
              isNew={selectedBaseUnitId === "new"}
              onArchive={(mode) => {
                if (!selectedBaseUnit) {
                  return;
                }
                void runAction({
                  key: `archive-unit-${mode}-${selectedBaseUnit._id}`,
                  action: async () => {
                    await archiveBaseUnit({ baseUnitId: selectedBaseUnit._id, mode });
                    if (mode === "delete") {
                      setSelectedBaseUnitId("new");
                      setBaseUnitDrafts((current) => ({ ...current, new: emptyBaseUnitDraft }));
                    }
                  },
                  success:
                    mode === "delete"
                      ? `Deleted base unit ${selectedBaseUnit.name}.`
                          : `Archived base unit ${selectedBaseUnit.name}.`,
                });
              }}
              onSave={() => {
                void runAction({
                  key: "save-base-unit",
                  action: () =>
                    upsertBaseUnit({
                      baseUnitId:
                        selectedBaseUnitId === "new"
                          ? undefined
                          : (selectedBaseUnitId as Id<"baseUnits">),
                      ipSeriesId: activeBaseUnitDraft.ipSeriesId as Id<"ipSeries">,
                      name: activeBaseUnitDraft.name,
                      slug: emptyToUndefined(activeBaseUnitDraft.slug),
                      unitCode: emptyToUndefined(activeBaseUnitDraft.unitCode),
                      aliases: parseCsv(activeBaseUnitDraft.aliases),
                      silhouetteType: emptyToUndefined(activeBaseUnitDraft.silhouetteType),
                      keyShapeAnchors: parseCsv(activeBaseUnitDraft.keyShapeAnchors),
                      nativeEquipment: parseCsv(activeBaseUnitDraft.nativeEquipment),
                      forbiddenChanges: parseCsv(activeBaseUnitDraft.forbiddenChanges),
                      promptAnchor: emptyToUndefined(activeBaseUnitDraft.promptAnchor),
                      isActive: activeBaseUnitDraft.status === "active",
                      status: activeBaseUnitDraft.status,
                    }).then((id) => {
                      setSelectedBaseUnitId(id);
                    }),
                  success: `Saved base unit ${activeBaseUnitDraft.name}.`,
                });
              }}
              onUpdate={setBaseUnitDraft}
              selected={selectedBaseUnit}
            />
          </div>
        ) : null}

        {activeTab === "kitVariants" ? (
          <div className="grid gap-0 xl:grid-cols-[420px_minmax(0,1fr)]">
            <ModelListPanel
              addLabel="New Kit Variant"
              emptyLabel="No kit variants yet."
              items={modelCatalog.kitVariants}
              onCreate={() => {
                setSelectedKitVariantId("new");
                setKitVariantDrafts((current) => ({
                  ...current,
                  new: {
                    ...emptyKitVariantDraft,
                    baseUnitId: selectedBaseUnitId !== "new" ? selectedBaseUnitId : "",
                  },
                }));
              }}
              renderItem={(item) => (
                <button
                  className={cn(
                    "w-full border-b border-line-secondary p-4 text-left transition-colors hover:bg-hover-subtle",
                    selectedKitVariantId === item._id && "bg-accent-orange/10"
                  )}
                  key={item._id}
                  onClick={() => setSelectedKitVariantId(item._id)}
                  type="button"
                >
                  <ListItemHeader name={item.name} slug={item.slug} status={item.status} />
                  <p className="mt-2 text-xs leading-5 text-ink-secondary">
                    {item.baseUnit?.name ?? "No base unit"} / {item.grade ?? "No grade"} /{" "}
                    {item.scale ?? "No scale"}
                  </p>
                </button>
              )}
            />
            <KitVariantForm
              baseUnits={modelCatalog.baseUnits}
              busyKey={busyKey}
              draft={activeKitVariantDraft}
              isNew={selectedKitVariantId === "new"}
              onArchive={(mode) => {
                if (!selectedKitVariant) {
                  return;
                }
                void runAction({
                  key: `archive-kit-${mode}-${selectedKitVariant._id}`,
                  action: async () => {
                    await archiveKitVariant({ kitVariantId: selectedKitVariant._id, mode });
                    if (mode === "delete") {
                      setSelectedKitVariantId("new");
                      setKitVariantDrafts((current) => ({ ...current, new: emptyKitVariantDraft }));
                    }
                  },
                  success:
                    mode === "delete"
                      ? `Deleted kit variant ${selectedKitVariant.name}.`
                          : `Archived kit variant ${selectedKitVariant.name}.`,
                });
              }}
              onSave={() => {
                void runAction({
                  key: "save-kit-variant",
                  action: () =>
                    upsertKitVariant({
                      kitVariantId:
                        selectedKitVariantId === "new"
                          ? undefined
                          : (selectedKitVariantId as Id<"baseModels">),
                      baseUnitId:
                        activeKitVariantDraft.baseUnitId === ""
                          ? undefined
                          : (activeKitVariantDraft.baseUnitId as Id<"baseUnits">),
                      name: activeKitVariantDraft.name,
                      slug: emptyToUndefined(activeKitVariantDraft.slug),
                      primaryModelBrand: emptyToUndefined(activeKitVariantDraft.primaryModelBrand),
                      grade: emptyToUndefined(activeKitVariantDraft.grade),
                      scale: emptyToUndefined(activeKitVariantDraft.scale),
                      releaseVersion: emptyToUndefined(activeKitVariantDraft.releaseVersion),
                      complexityLevel: emptyToUndefined(activeKitVariantDraft.complexityLevel),
                      panelDensity: emptyToUndefined(activeKitVariantDraft.panelDensity),
                      aliases: parseCsv(activeKitVariantDraft.aliases),
                      tags: parseCsv(activeKitVariantDraft.tags),
                      thumbnailAssetKey: emptyToUndefined(activeKitVariantDraft.thumbnailAssetKey),
                      promptAnchor: emptyToUndefined(activeKitVariantDraft.promptAnchor),
                      isActive: activeKitVariantDraft.status === "active",
                      status: activeKitVariantDraft.status,
                    }).then((id) => {
                      setSelectedKitVariantId(id);
                    }),
                  success: `Saved kit variant ${activeKitVariantDraft.name}.`,
                });
              }}
              onUpdate={setKitVariantDraft}
              selected={selectedKitVariant}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function IpSeriesForm({
  busyKey,
  draft,
  isNew,
  onArchive,
  onSave,
  onUpdate,
  selected,
}: {
  busyKey: string | null;
  draft: IpSeriesDraft;
  isNew: boolean;
  onArchive: (mode: "deactivate" | "delete") => void;
  onSave: () => void;
  onUpdate: (patch: Partial<IpSeriesDraft>) => void;
  selected: IpSeriesItem | null;
}) {
  return (
    <FormShell
      archiveDisabled={isNew}
      busyKey={busyKey}
      deleteDisabled={!isNew && Boolean(selected?.baseUnitCount)}
      deleteHint={selected?.baseUnitCount ? "Delete is locked while base units are linked." : undefined}
      entity="IP / Series"
      isNew={isNew}
      onArchive={onArchive}
      onSave={onSave}
      saveBusyKey="save-ip-series"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Name">
          <Input value={draft.name} onChange={(event) => onUpdate({ name: event.target.value })} />
        </Field>
        <Field label="Slug">
          <Input value={draft.slug} onChange={(event) => onUpdate({ slug: event.target.value })} />
        </Field>
        <Field label="Universe">
          <Input value={draft.universe} onChange={(event) => onUpdate({ universe: event.target.value })} />
        </Field>
        <Field label="Rights Owner">
          <Input value={draft.rightsOwner} onChange={(event) => onUpdate({ rightsOwner: event.target.value })} />
        </Field>
      </div>
      <Field label="Visual DNA">
        <Textarea
          className="min-h-[90px]"
          value={draft.visualDNA}
          onChange={(event) => onUpdate({ visualDNA: event.target.value })}
        />
      </Field>
      <Field label="Prompt Anchor">
        <Textarea
          className="min-h-[120px]"
          value={draft.promptAnchor}
          onChange={(event) => onUpdate({ promptAnchor: event.target.value })}
        />
      </Field>
      <StatusSelect value={draft.status} onChange={(status) => onUpdate({ status })} />
    </FormShell>
  );
}

function BaseUnitForm({
  busyKey,
  draft,
  ipSeries,
  isNew,
  onArchive,
  onSave,
  onUpdate,
  selected,
}: {
  busyKey: string | null;
  draft: BaseUnitDraft;
  ipSeries: IpSeriesItem[];
  isNew: boolean;
  onArchive: (mode: "deactivate" | "delete") => void;
  onSave: () => void;
  onUpdate: (patch: Partial<BaseUnitDraft>) => void;
  selected: BaseUnitItem | null;
}) {
  return (
    <FormShell
      archiveDisabled={isNew}
      busyKey={busyKey}
      deleteDisabled={!isNew && Boolean(selected?.kitVariantCount)}
      deleteHint={selected?.kitVariantCount ? "Delete is locked while kit variants are linked." : undefined}
      entity="Base Unit"
      isNew={isNew}
      onArchive={onArchive}
      onSave={onSave}
      saveBusyKey="save-base-unit"
    >
      <Field label="IP / Series">
        <Select value={draft.ipSeriesId || undefined} onValueChange={(value) => onUpdate({ ipSeriesId: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select IP / Series" />
          </SelectTrigger>
          <SelectContent>
            {ipSeries.map((series) => (
              <SelectItem key={series._id} value={series._id}>
                {series.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-4 lg:grid-cols-3">
        <Field label="Name">
          <Input value={draft.name} onChange={(event) => onUpdate({ name: event.target.value })} />
        </Field>
        <Field label="Slug">
          <Input value={draft.slug} onChange={(event) => onUpdate({ slug: event.target.value })} />
        </Field>
        <Field label="Unit Code">
          <Input value={draft.unitCode} onChange={(event) => onUpdate({ unitCode: event.target.value })} />
        </Field>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Silhouette Type">
          <Input
            value={draft.silhouetteType}
            onChange={(event) => onUpdate({ silhouetteType: event.target.value })}
          />
        </Field>
        <Field label="Aliases CSV">
          <Input value={draft.aliases} onChange={(event) => onUpdate({ aliases: event.target.value })} />
        </Field>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Key Identity Anchors CSV">
          <Textarea
            className="min-h-[90px]"
            value={draft.keyShapeAnchors}
            onChange={(event) => onUpdate({ keyShapeAnchors: event.target.value })}
          />
        </Field>
        <Field label="Native Equipment CSV">
          <Textarea
            className="min-h-[90px]"
            value={draft.nativeEquipment}
            onChange={(event) => onUpdate({ nativeEquipment: event.target.value })}
          />
        </Field>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Forbidden Changes CSV">
          <Textarea
            className="min-h-[90px]"
            value={draft.forbiddenChanges}
            onChange={(event) => onUpdate({ forbiddenChanges: event.target.value })}
          />
        </Field>
        <Field label="Base Unit Prompt Anchor">
          <Textarea
            className="min-h-[90px]"
            value={draft.promptAnchor}
            onChange={(event) => onUpdate({ promptAnchor: event.target.value })}
          />
        </Field>
      </div>
      <StatusSelect value={draft.status} onChange={(status) => onUpdate({ status })} />
    </FormShell>
  );
}

function KitVariantForm({
  baseUnits,
  busyKey,
  draft,
  isNew,
  onArchive,
  onSave,
  onUpdate,
  selected,
}: {
  baseUnits: BaseUnitItem[];
  busyKey: string | null;
  draft: KitVariantDraft;
  isNew: boolean;
  onArchive: (mode: "deactivate" | "delete") => void;
  onSave: () => void;
  onUpdate: (patch: Partial<KitVariantDraft>) => void;
  selected: KitVariantItem | null;
}) {
  const referenceCount = selected ? countReferences(selected.references) : 0;

  return (
    <FormShell
      archiveDisabled={isNew}
      busyKey={busyKey}
      deleteDisabled={!isNew && referenceCount > 0}
      deleteHint={referenceCount > 0 ? "Delete is locked while this kit is referenced." : undefined}
      entity="Kit Variant"
      isNew={isNew}
      onArchive={onArchive}
      onSave={onSave}
      saveBusyKey="save-kit-variant"
    >
      <Field label="Base Unit">
        <Select
          value={draft.baseUnitId || "none"}
          onValueChange={(value) => onUpdate({ baseUnitId: value === "none" ? "" : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select base unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unlinked</SelectItem>
            {baseUnits.map((unit) => (
              <SelectItem key={unit._id} value={unit._id}>
                {unit.name} / {unit.ipSeries?.name ?? "No IP"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-4 lg:grid-cols-3">
        <Field label="Name">
          <Input value={draft.name} onChange={(event) => onUpdate({ name: event.target.value })} />
        </Field>
        <Field label="Slug">
          <Input value={draft.slug} onChange={(event) => onUpdate({ slug: event.target.value })} />
        </Field>
        <Field label="Primary Model Brand">
          <Input
            value={draft.primaryModelBrand}
            onChange={(event) => onUpdate({ primaryModelBrand: event.target.value })}
          />
        </Field>
      </div>
      <div className="grid gap-4 lg:grid-cols-4">
        <Field label="Grade">
          <Input value={draft.grade} onChange={(event) => onUpdate({ grade: event.target.value })} />
        </Field>
        <Field label="Scale">
          <Input value={draft.scale} onChange={(event) => onUpdate({ scale: event.target.value })} />
        </Field>
        <Field label="Release Version">
          <Input
            value={draft.releaseVersion}
            onChange={(event) => onUpdate({ releaseVersion: event.target.value })}
          />
        </Field>
        <Field label="Panel Density">
          <Input value={draft.panelDensity} onChange={(event) => onUpdate({ panelDensity: event.target.value })} />
        </Field>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Complexity">
          <Input
            value={draft.complexityLevel}
            onChange={(event) => onUpdate({ complexityLevel: event.target.value })}
          />
        </Field>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Aliases CSV">
          <Input value={draft.aliases} onChange={(event) => onUpdate({ aliases: event.target.value })} />
        </Field>
        <Field label="Tags CSV">
          <Input value={draft.tags} onChange={(event) => onUpdate({ tags: event.target.value })} />
        </Field>
      </div>
      <Field label="Thumbnail Asset Key">
        <Input
          value={draft.thumbnailAssetKey}
          onChange={(event) => onUpdate({ thumbnailAssetKey: event.target.value })}
        />
      </Field>
      <Field label="Prompt Anchor">
        <Textarea
          className="min-h-[120px]"
          value={draft.promptAnchor}
          onChange={(event) => onUpdate({ promptAnchor: event.target.value })}
        />
      </Field>
      {selected ? (
        <div className="grid gap-3 rounded-[6px] border border-line-secondary bg-main p-4 text-xs text-ink-secondary sm:grid-cols-4">
          <ReferenceStat label="Concepts" value={selected.references.concepts} />
          <ReferenceStat label="Jobs" value={selected.references.generationJobs} />
          <ReferenceStat label="Feedback" value={selected.references.feedbackReports} />
          <ReferenceStat label="Packs" value={selected.references.creatorPacks} />
        </div>
      ) : null}
      <StatusSelect value={draft.status} onChange={(status) => onUpdate({ status })} />
    </FormShell>
  );
}

function FormShell({
  archiveDisabled,
  busyKey,
  children,
  deleteDisabled,
  deleteHint,
  entity,
  isNew,
  onArchive,
  onSave,
  saveBusyKey,
}: {
  archiveDisabled: boolean;
  busyKey: string | null;
  children: ReactNode;
  deleteDisabled: boolean;
  deleteHint?: string;
  entity: string;
  isNew: boolean;
  onArchive: (mode: "deactivate" | "delete") => void;
  onSave: () => void;
  saveBusyKey: string;
}) {
  return (
    <div className="space-y-5 border-t border-line-secondary p-5 xl:border-l xl:border-t-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-accent-blue">
            {isNew ? "Create" : "Edit"} {entity}
          </p>
          <h3 className="mt-2 text-2xl font-semibold">{entity} fields</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busyKey === saveBusyKey} onClick={onSave} type="button">
            {busyKey === saveBusyKey ? "Saving" : `Save ${entity}`}
          </Button>
          <button
            className="border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle disabled:cursor-not-allowed disabled:opacity-40"
            disabled={archiveDisabled}
            onClick={() => {
              onArchive("deactivate");
            }}
            type="button"
          >
            Archive
          </button>
          <button
            className="border border-accent-red px-4 py-2 text-sm text-accent-red transition-colors hover:bg-accent-red/10 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={archiveDisabled || deleteDisabled}
            onClick={() => {
              if (window.confirm(`Delete this ${entity}? This cannot be undone.`)) {
                onArchive("delete");
              }
            }}
            type="button"
            title={deleteHint}
          >
            Delete
          </button>
        </div>
      </div>
      {deleteHint ? (
        <p className="rounded-[6px] border border-line-secondary bg-main px-3 py-2 text-xs text-ink-secondary">
          {deleteHint}
        </p>
      ) : null}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ModelListPanel<TItem>({
  addLabel,
  emptyLabel,
  items,
  onCreate,
  renderItem,
}: {
  addLabel: string;
  emptyLabel: string;
  items: TItem[];
  onCreate: () => void;
  renderItem: (item: TItem) => ReactNode;
}) {
  return (
    <aside className="border-line-secondary xl:border-r">
      <div className="flex items-center justify-between border-b border-line-secondary bg-main p-4">
        <p className="text-[11px] uppercase tracking-[0.24em] text-ink-muted">Records</p>
        <button
          className="border border-accent-teal px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent-teal transition-colors hover:bg-accent-teal/10"
          onClick={onCreate}
          type="button"
        >
          {addLabel}
        </button>
      </div>
      <div className="max-h-[720px] overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4 text-sm text-ink-secondary">{emptyLabel}</div>
        ) : (
          items.map(renderItem)
        )}
      </div>
    </aside>
  );
}

function ModelTabButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex min-h-[76px] items-center justify-between border-b border-line-secondary px-5 py-4 text-left transition-colors md:border-b-0 md:border-r",
        active ? "bg-main text-ink-primary" : "bg-panel text-ink-secondary hover:bg-hover-subtle"
      )}
      onClick={onClick}
      type="button"
    >
      <span className="text-sm font-semibold uppercase tracking-[0.2em]">{label}</span>
      <span className="font-mono text-2xl">{count}</span>
    </button>
  );
}

function ListItemHeader({
  name,
  slug,
  status,
}: {
  name: string;
  slug: string;
  status: ModelCatalogStatus;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-ink-primary">{name}</p>
        <p className="mt-1 font-mono text-[11px] text-ink-muted">{slug}</p>
      </div>
      <span
        className={cn(
          "border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
          status === "active" && "border-accent-teal text-accent-teal",
          status === "prerelease" && "border-accent-orange text-accent-orange",
          status === "archived" && "border-accent-red text-accent-red"
        )}
      >
        {status}
      </span>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function StatusSelect({
  onChange,
  value,
}: {
  onChange: (status: ModelCatalogStatus) => void;
  value: ModelCatalogStatus;
}) {
  return (
    <Field label="Lifecycle Status">
      <Select value={value} onValueChange={(nextValue) => onChange(nextValue as ModelCatalogStatus)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="prerelease">Prerelease</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

function ModelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line-secondary bg-main p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl text-ink-primary">{value}</p>
    </div>
  );
}

function StatusPanel({ children, tone }: { children: ReactNode; tone: "green" | "red" }) {
  return (
    <div
      className={cn(
        "border p-4 text-sm",
        tone === "green" && "border-accent-teal bg-accent-teal/10 text-accent-teal",
        tone === "red" && "border-accent-red bg-accent-red/10 text-accent-red"
      )}
    >
      {children}
    </div>
  );
}

function ModelCatalogLoading({ label }: { label: string }) {
  return (
    <section className="border-2 border-line-primary bg-surface p-6 text-ink-primary">
      <p className="text-xs uppercase tracking-[0.3em] text-accent-teal">Model DNA admin</p>
      <h2 className="mt-3 text-3xl font-semibold">{label}</h2>
    </section>
  );
}

function ReferenceStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">{label}</p>
      <p className="mt-1 font-mono text-xl text-ink-primary">{value}</p>
    </div>
  );
}

function createIpSeriesDraft(item: IpSeriesItem): IpSeriesDraft {
  return {
    name: item.name,
    promptAnchor: item.promptAnchor ?? "",
    rightsOwner: item.rightsOwner ?? item.manufacturer ?? "",
    slug: item.slug,
    universe: item.universe ?? "",
    visualDNA: item.visualDNA ?? "",
    status: item.status,
  };
}

function createBaseUnitDraft(item: BaseUnitItem): BaseUnitDraft {
  return {
    aliases: joinCsv(item.aliases),
    forbiddenChanges: joinCsv(item.forbiddenChanges),
    ipSeriesId: item.ipSeriesId,
    keyShapeAnchors: joinCsv(item.keyShapeAnchors),
    name: item.name,
    nativeEquipment: joinCsv(item.nativeEquipment),
    promptAnchor: item.promptAnchor ?? "",
    silhouetteType: item.silhouetteType ?? "",
    slug: item.slug,
    unitCode: item.unitCode ?? "",
    status: item.status,
  };
}

function createKitVariantDraft(item: KitVariantItem): KitVariantDraft {
  return {
    aliases: joinCsv(item.aliases),
    baseUnitId: item.baseUnitId ?? "",
    complexityLevel: item.complexityLevel ?? "",
    grade: item.grade ?? "",
    name: item.name,
    panelDensity: item.panelDensity ?? "",
    primaryModelBrand: item.primaryModelBrand ?? "",
    promptAnchor: item.promptAnchor ?? "",
    releaseVersion: item.releaseVersion ?? "",
    scale: item.scale ?? "",
    slug: item.slug,
    tags: joinCsv(item.tags),
    thumbnailAssetKey: item.thumbnailAssetKey ?? "",
    status: item.status,
  };
}

function countReferences(references: KitVariantItem["references"]) {
  return references.concepts + references.creatorPacks + references.feedbackReports + references.generationJobs;
}

function joinCsv(values: string[]) {
  return values.join(", ");
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function emptyToUndefined(value: string) {
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}
