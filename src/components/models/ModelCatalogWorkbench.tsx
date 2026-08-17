"use client";

import {
  CaretDownIcon,
  CaretRightIcon,
  DotsHorizontalIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { TagEditor } from "./TagEditor";
import {
  BaseUnitDraft,
  BaseUnitItem,
  IpSeriesDraft,
  IpSeriesItem,
  KitVariantDraft,
  KitVariantItem,
  ModelCatalogData,
  ModelCatalogStatus,
  RecordSelection,
  RecordType,
  StatusFilter,
  createBaseUnitDraft,
  createIpSeriesDraft,
  createKitVariantDraft,
  emptyBaseUnitDraft,
  emptyIpSeriesDraft,
  emptyKitVariantDraft,
  recordKey,
  recordTypeLabel,
  statusLabel,
} from "./modelCatalogTypes";

type TreeBranch = {
  series: IpSeriesItem;
  units: Array<{ unit: BaseUnitItem; variants: KitVariantItem[] }>;
};

export function ModelCatalogWorkbench() {
  const viewer = useQuery(api.users.viewer);
  const canManagePlatform = Boolean(viewer?.canManagePlatform);
  const catalog = useQuery(
    api.modelCatalogAdmin.listModelCatalogData,
    canManagePlatform ? {} : "skip"
  );
  const upsertIpSeries = useMutation(api.modelCatalogAdmin.upsertIpSeries);
  const archiveIpSeries = useMutation(api.modelCatalogAdmin.archiveIpSeries);
  const upsertBaseUnit = useMutation(api.modelCatalogAdmin.upsertBaseUnit);
  const archiveBaseUnit = useMutation(api.modelCatalogAdmin.archiveBaseUnit);
  const upsertKitVariant = useMutation(api.modelCatalogAdmin.upsertKitVariant);
  const archiveKitVariant = useMutation(api.modelCatalogAdmin.archiveKitVariant);

  const [selection, setSelection] = useState<RecordSelection | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [ipDrafts, setIpDrafts] = useState<Record<string, IpSeriesDraft>>({});
  const [unitDrafts, setUnitDrafts] = useState<Record<string, BaseUnitDraft>>({});
  const [kitDrafts, setKitDrafts] = useState<Record<string, KitVariantDraft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!catalog || initialized.current) return;
    initialized.current = true;
    setExpanded(new Set(catalog.ipSeries.map((item) => `ipSeries:${item._id}`)));
    const first = catalog.ipSeries.find((item) => item.status === "active") ?? catalog.ipSeries[0];
    if (first) setSelection({ id: first._id, type: "ipSeries" });
  }, [catalog]);

  const selectedIp =
    selection?.type === "ipSeries"
      ? catalog?.ipSeries.find((item) => item._id === selection.id) ?? null
      : null;
  const selectedUnit =
    selection?.type === "baseUnit"
      ? catalog?.baseUnits.find((item) => item._id === selection.id) ?? null
      : null;
  const selectedKit =
    selection?.type === "kitVariant"
      ? catalog?.kitVariants.find((item) => item._id === selection.id) ?? null
      : null;

  const ipDraft = selection?.type === "ipSeries"
    ? ipDrafts[selection.id] ?? (selectedIp ? createIpSeriesDraft(selectedIp) : emptyIpSeriesDraft)
    : emptyIpSeriesDraft;
  const unitDraft = selection?.type === "baseUnit"
    ? unitDrafts[selection.id] ?? (selectedUnit ? createBaseUnitDraft(selectedUnit) : emptyBaseUnitDraft)
    : emptyBaseUnitDraft;
  const kitDraft = selection?.type === "kitVariant"
    ? kitDrafts[selection.id] ?? (selectedKit ? createKitVariantDraft(selectedKit) : emptyKitVariantDraft)
    : emptyKitVariantDraft;

  const tree = useMemo(
    () => (catalog ? buildTree(catalog, query, statusFilter) : []),
    [catalog, query, statusFilter]
  );
  const results = useMemo(
    () => (catalog && query.trim() ? buildSearchResults(catalog, query, statusFilter) : []),
    [catalog, query, statusFilter]
  );

  const dirty = Boolean(selection && (
    selection.id === "new" ||
    (selection.type === "ipSeries" && ipDrafts[selection.id] && JSON.stringify(ipDraft) !== JSON.stringify(selectedIp && createIpSeriesDraft(selectedIp))) ||
    (selection.type === "baseUnit" && unitDrafts[selection.id] && JSON.stringify(unitDraft) !== JSON.stringify(selectedUnit && createBaseUnitDraft(selectedUnit))) ||
    (selection.type === "kitVariant" && kitDrafts[selection.id] && JSON.stringify(kitDraft) !== JSON.stringify(selectedKit && createKitVariantDraft(selectedKit)))
  ));
  const canSave = Boolean(dirty && selection && (
    (selection.type === "ipSeries" && ipDraft.name.trim()) ||
    (selection.type === "baseUnit" && unitDraft.name.trim() && unitDraft.ipSeriesId) ||
    (selection.type === "kitVariant" && kitDraft.name.trim())
  ));

  const updateIp = (patch: Partial<IpSeriesDraft>) => {
    if (!selection || selection.type !== "ipSeries") return;
    setIpDrafts((current) => ({ ...current, [selection.id]: { ...ipDraft, ...patch } }));
  };
  const updateUnit = (patch: Partial<BaseUnitDraft>) => {
    if (!selection || selection.type !== "baseUnit") return;
    setUnitDrafts((current) => ({ ...current, [selection.id]: { ...unitDraft, ...patch } }));
  };
  const updateKit = (patch: Partial<KitVariantDraft>) => {
    if (!selection || selection.type !== "kitVariant") return;
    setKitDrafts((current) => ({ ...current, [selection.id]: { ...kitDraft, ...patch } }));
  };

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    setNotice(null);
    try {
      await action();
      setNotice({ text: success, tone: "success" });
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : "Model catalog action failed",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  const selectRecord = (next: RecordSelection) => {
    setSelection(next);
    if (catalog) revealRecord(next, catalog, setExpanded);
  };

  const createRecord = (type: RecordType, parentId?: string) => {
    if (type === "ipSeries") {
      setIpDrafts((current) => ({ ...current, new: { ...emptyIpSeriesDraft } }));
    } else if (type === "baseUnit") {
      setUnitDrafts((current) => ({
        ...current,
        new: { ...emptyBaseUnitDraft, ipSeriesId: parentId ?? "" },
      }));
    } else {
      setKitDrafts((current) => ({
        ...current,
        new: { ...emptyKitVariantDraft, baseUnitId: parentId ?? "" },
      }));
    }
    setSelection({ id: "new", type });
  };

  const duplicateRecord = (target: RecordSelection) => {
    if (!catalog) return;
    if (target.type === "ipSeries") {
      const item = catalog.ipSeries.find((record) => record._id === target.id);
      if (!item) return;
      setIpDrafts((current) => ({
        ...current,
        new: { ...createIpSeriesDraft(item), name: `${item.name} copy`, slug: "" },
      }));
    } else if (target.type === "baseUnit") {
      const item = catalog.baseUnits.find((record) => record._id === target.id);
      if (!item) return;
      setUnitDrafts((current) => ({
        ...current,
        new: { ...createBaseUnitDraft(item), name: `${item.name} copy`, slug: "" },
      }));
    } else {
      const item = catalog.kitVariants.find((record) => record._id === target.id);
      if (!item) return;
      setKitDrafts((current) => ({
        ...current,
        new: { ...createKitVariantDraft(item), name: `${item.name} copy`, slug: "" },
      }));
    }
    setSelection({ id: "new", type: target.type });
  };

  const cancel = () => {
    if (!selection) return;
    if (selection.type === "ipSeries") setIpDrafts((current) => omit(current, selection.id));
    else if (selection.type === "baseUnit") setUnitDrafts((current) => omit(current, selection.id));
    else setKitDrafts((current) => omit(current, selection.id));
    if (selection.id === "new") setSelection(null);
  };

  const save = () => {
    if (!selection || !canSave) return;
    const current = selection;
    if (selection.type === "ipSeries") {
      void run("save-ip", async () => {
        const id = await upsertIpSeries({
          ipSeriesId: current.id === "new" ? undefined : current.id as Id<"ipSeries">,
          isActive: ipDraft.status === "active",
          manufacturer: optional(ipDraft.manufacturer),
          name: ipDraft.name,
          promptAnchor: optional(ipDraft.promptAnchor),
          rightsOwner: optional(ipDraft.rightsOwner),
          slug: optional(ipDraft.slug),
          status: ipDraft.status,
          universe: optional(ipDraft.universe),
          visualDNA: optional(ipDraft.visualDNA),
        });
        setIpDrafts((drafts) => omit(drafts, current.id));
        setSelection({ id, type: "ipSeries" });
      }, `Saved ${ipDraft.name}.`);
    } else if (selection.type === "baseUnit") {
      void run("save-unit", async () => {
        const id = await upsertBaseUnit({
          aliases: unitDraft.aliases,
          baseUnitId: current.id === "new" ? undefined : current.id as Id<"baseUnits">,
          forbiddenChanges: unitDraft.forbiddenChanges,
          ipSeriesId: unitDraft.ipSeriesId as Id<"ipSeries">,
          isActive: unitDraft.status === "active",
          keyShapeAnchors: unitDraft.keyShapeAnchors,
          name: unitDraft.name,
          nativeEquipment: unitDraft.nativeEquipment,
          promptAnchor: optional(unitDraft.promptAnchor),
          silhouetteType: optional(unitDraft.silhouetteType),
          slug: optional(unitDraft.slug),
          status: unitDraft.status,
          unitCode: optional(unitDraft.unitCode),
        });
        setUnitDrafts((drafts) => omit(drafts, current.id));
        setSelection({ id, type: "baseUnit" });
      }, `Saved ${unitDraft.name}.`);
    } else {
      void run("save-kit", async () => {
        const id = await upsertKitVariant({
          aliases: kitDraft.aliases,
          baseUnitId: kitDraft.baseUnitId ? kitDraft.baseUnitId as Id<"baseUnits"> : undefined,
          complexityLevel: optional(kitDraft.complexityLevel),
          grade: optional(kitDraft.grade),
          isActive: kitDraft.status === "active",
          kitVariantId: current.id === "new" ? undefined : current.id as Id<"baseModels">,
          name: kitDraft.name,
          panelDensity: optional(kitDraft.panelDensity),
          primaryModelBrand: optional(kitDraft.primaryModelBrand),
          promptAnchor: optional(kitDraft.promptAnchor),
          releaseVersion: optional(kitDraft.releaseVersion),
          scale: optional(kitDraft.scale),
          slug: optional(kitDraft.slug),
          status: kitDraft.status,
          tags: kitDraft.tags,
          thumbnailAssetKey: optional(kitDraft.thumbnailAssetKey),
        });
        setKitDrafts((drafts) => omit(drafts, current.id));
        setSelection({ id, type: "kitVariant" });
      }, `Saved ${kitDraft.name}.`);
    }
  };

  const destructiveAction = (target: RecordSelection, mode: "deactivate" | "delete") => {
    if (!catalog) return;
    const name = recordName(catalog, target) ?? "record";
    const prompt = mode === "delete"
      ? `Delete ${name}? This cannot be undone.`
      : `Archive ${name}? It will be hidden from active model selection.`;
    if (!window.confirm(prompt)) return;
    if (target.type === "ipSeries") {
      void run(`${mode}-ip`, () => archiveIpSeries({ ipSeriesId: target.id as Id<"ipSeries">, mode }), mode === "delete" ? `Deleted ${name}.` : `Archived ${name}.`);
    } else if (target.type === "baseUnit") {
      void run(`${mode}-unit`, () => archiveBaseUnit({ baseUnitId: target.id as Id<"baseUnits">, mode }), mode === "delete" ? `Deleted ${name}.` : `Archived ${name}.`);
    } else {
      void run(`${mode}-kit`, () => archiveKitVariant({ kitVariantId: target.id as Id<"baseModels">, mode }), mode === "delete" ? `Deleted ${name}.` : `Archived ${name}.`);
    }
    if (selection?.id === target.id && selection.type === target.type) setSelection(null);
  };

  if (viewer === undefined) return <Loading label="Resolving operator clearance." />;
  if (!canManagePlatform) {
    return (
      <section className="border border-accent-red bg-surface p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-accent-red">Admin only</p>
        <h2 className="mt-3 text-2xl font-semibold">Model catalog access is locked.</h2>
      </section>
    );
  }
  if (!catalog) return <Loading label="Loading model hierarchy." />;

  const activeStatus = selection?.type === "ipSeries"
    ? ipDraft.status
    : selection?.type === "baseUnit"
      ? unitDraft.status
      : kitDraft.status;
  const name = selection ? recordName(catalog, selection) : null;
  const deleteDisabled = selection ? deletionLocked(catalog, selection) : true;

  return (
    <div
      className="space-y-3 text-ink-primary"
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
          event.preventDefault();
          save();
        }
      }}
    >
      <Toolbar
        catalog={catalog}
        onCreate={createRecord}
        onQuery={setQuery}
        onStatus={setStatusFilter}
        query={query}
        status={statusFilter}
      />
      {notice ? (
        <div className={cn(
          "border px-4 py-2 text-sm",
          notice.tone === "error"
            ? "border-accent-red/60 bg-accent-red/5 text-accent-red"
            : "border-accent-teal/60 bg-accent-teal/5 text-accent-teal"
        )}>
          {notice.text}
        </div>
      ) : null}
      <section className="grid min-h-[680px] overflow-hidden border border-line-primary bg-surface xl:h-[calc(100dvh-14rem)] xl:grid-cols-[minmax(320px,32%)_minmax(0,68%)]">
        <aside className="flex min-h-0 flex-col border-b border-line-primary xl:border-b-0 xl:border-r">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-line-secondary bg-panel px-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Model hierarchy</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                {query.trim() ? `${results.length} results` : `${catalog.ipSeries.length + catalog.baseUnits.length + catalog.kitVariants.length} records`}
              </p>
            </div>
            {query ? <button className="text-xs text-ink-muted hover:text-ink-primary" onClick={() => setQuery("")} type="button">Clear</button> : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-2">
            {query.trim() ? (
              <SearchResults onSelect={selectRecord} results={results} selection={selection} />
            ) : tree.length ? (
              <div aria-label="Model hierarchy" role="tree">
                {tree.map((branch) => (
                  <TreeBranchView
                    branch={branch}
                    expanded={expanded}
                    key={branch.series._id}
                    onCreate={createRecord}
                    onDelete={destructiveAction}
                    onDuplicate={duplicateRecord}
                    onSelect={selectRecord}
                    onToggle={(key) => setExpanded((current) => toggle(current, key))}
                    selection={selection}
                  />
                ))}
              </div>
            ) : (
              <Empty message="No records match this status." />
            )}
          </div>
        </aside>
        <section aria-label="Record inspector" className="min-h-0 min-w-0 overflow-y-auto bg-main">
          {selection ? (
            <>
              <InspectorHeader
                busy={Boolean(busy?.startsWith("save"))}
                canSave={canSave}
                dirty={dirty}
                isNew={selection.id === "new"}
                name={name ?? `New ${recordTypeLabel(selection.type)}`}
                onCancel={cancel}
                onSave={save}
                status={activeStatus}
                type={selection.type}
              />
              <div className="mx-auto max-w-4xl px-5 py-6 sm:px-7 lg:px-9">
                {selection.type === "ipSeries" ? (
                  <IpInspector draft={ipDraft} onChange={updateIp} />
                ) : selection.type === "baseUnit" ? (
                  <UnitInspector catalog={catalog} draft={unitDraft} onChange={updateUnit} />
                ) : (
                  <KitInspector
                    catalog={catalog}
                    draft={kitDraft}
                    onChange={updateKit}
                    onOpenUnit={(id) => selectRecord({ id, type: "baseUnit" })}
                    selected={selectedKit}
                  />
                )}
                {selection.id !== "new" ? (
                  <DangerZone
                    deleteDisabled={deleteDisabled}
                    onArchive={() => destructiveAction(selection, "deactivate")}
                    onDelete={() => destructiveAction(selection, "delete")}
                    type={selection.type}
                  />
                ) : null}
              </div>
            </>
          ) : (
            <EmptyInspector onCreate={() => createRecord("ipSeries")} />
          )}
        </section>
      </section>
    </div>
  );
}

function Toolbar({
  catalog,
  onCreate,
  onQuery,
  onStatus,
  query,
  status,
}: {
  catalog: ModelCatalogData;
  onCreate: (type: RecordType) => void;
  onQuery: (value: string) => void;
  onStatus: (value: StatusFilter) => void;
  query: string;
  status: StatusFilter;
}) {
  return (
    <div className="flex flex-col gap-3 border-y border-line-secondary bg-surface px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
        <Count label="IP / Series" value={catalog.ipSeries.length} />
        <Count label="Base Units" value={catalog.baseUnits.length} />
        <Count label="Kit Variants" value={catalog.kitVariants.length} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row lg:max-w-[700px]">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search model records</span>
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            className="h-10 border-line-secondary bg-main pl-9 shadow-none placeholder:text-ink-muted focus-visible:ring-accent-orange"
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search models, kits, slugs…"
            value={query}
          />
        </label>
        <Select value={status} onValueChange={(value) => onStatus(value as StatusFilter)}>
          <SelectTrigger className="h-10 w-full border-line-secondary bg-main shadow-none sm:w-[154px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="prerelease">Pre-release</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-10 shrink-0 gap-2 bg-ink-primary px-4 text-surface shadow-none hover:bg-ink-secondary">
              <PlusIcon /> New record
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border-line-primary bg-surface text-ink-primary">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.16em] text-ink-muted">Create record</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onCreate("ipSeries")}>IP / Series</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCreate("baseUnit")}>Base Unit</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCreate("kitVariant")}>Kit Variant</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return <span className="inline-flex items-baseline gap-2 whitespace-nowrap text-ink-secondary"><span className="text-[11px] uppercase tracking-[0.14em]">{label}</span><strong className="font-mono text-base font-medium tabular-nums text-ink-primary">{value}</strong></span>;
}

function TreeBranchView({
  branch,
  expanded,
  onCreate,
  onDelete,
  onDuplicate,
  onSelect,
  onToggle,
  selection,
}: {
  branch: TreeBranch;
  expanded: Set<string>;
  onCreate: (type: RecordType, parentId?: string) => void;
  onDelete: (selection: RecordSelection, mode: "deactivate" | "delete") => void;
  onDuplicate: (selection: RecordSelection) => void;
  onSelect: (selection: RecordSelection) => void;
  onToggle: (key: string) => void;
  selection: RecordSelection | null;
}) {
  const ip = { id: branch.series._id, type: "ipSeries" } as const;
  const ipKey = recordKey(ip);
  const open = expanded.has(ipKey);
  return (
    <div aria-expanded={open} role="treeitem">
      <TreeNode
        count={branch.units.length}
        expanded={open}
        hasChildren={branch.units.length > 0}
        meta={branch.series.universe ?? branch.series.slug}
        name={branch.series.name}
        onCreate={() => onCreate("baseUnit", branch.series._id)}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onSelect={onSelect}
        onToggle={() => onToggle(ipKey)}
        selected={same(selection, ip)}
        selection={ip}
        status={branch.series.status}
      />
      {open ? (
        <div className="ml-5 border-l border-line-guide" role="group">
          {branch.units.map(({ unit, variants }) => {
            const unitSelection = { id: unit._id, type: "baseUnit" } as const;
            const unitKey = recordKey(unitSelection);
            const unitOpen = expanded.has(unitKey);
            return (
              <div aria-expanded={unitOpen} key={unit._id} role="treeitem">
                <TreeNode
                  count={variants.length}
                  expanded={unitOpen}
                  hasChildren={variants.length > 0}
                  meta={unit.unitCode ?? unit.slug}
                  name={unit.name}
                  onCreate={() => onCreate("kitVariant", unit._id)}
                  onDelete={onDelete}
                  onDuplicate={onDuplicate}
                  onSelect={onSelect}
                  onToggle={() => onToggle(unitKey)}
                  selected={same(selection, unitSelection)}
                  selection={unitSelection}
                  status={unit.status}
                />
                {unitOpen ? (
                  <div className="ml-5 border-l border-line-guide" role="group">
                    {variants.map((variant) => {
                      const kit = { id: variant._id, type: "kitVariant" } as const;
                      return (
                        <TreeNode
                          compact
                          expanded={false}
                          hasChildren={false}
                          key={variant._id}
                          meta={[variant.grade, variant.scale].filter(Boolean).join(" · ") || variant.slug}
                          name={variant.name}
                          onCreate={() => onCreate("kitVariant", unit._id)}
                          onDelete={onDelete}
                          onDuplicate={onDuplicate}
                          onSelect={onSelect}
                          onToggle={() => undefined}
                          selected={same(selection, kit)}
                          selection={kit}
                          status={variant.status}
                        />
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function TreeNode({
  compact,
  count,
  expanded,
  hasChildren,
  meta,
  name,
  onCreate,
  onDelete,
  onDuplicate,
  onSelect,
  onToggle,
  selected,
  selection,
  status,
}: {
  compact?: boolean;
  count?: number;
  expanded: boolean;
  hasChildren: boolean;
  meta: string;
  name: string;
  onCreate: () => void;
  onDelete: (selection: RecordSelection, mode: "deactivate" | "delete") => void;
  onDuplicate: (selection: RecordSelection) => void;
  onSelect: (selection: RecordSelection) => void;
  onToggle: () => void;
  selected: boolean;
  selection: RecordSelection;
  status: ModelCatalogStatus;
}) {
  const addLabel = selection.type === "ipSeries" ? "Add Base Unit" : selection.type === "baseUnit" ? "Add Kit Variant" : "Add sibling Kit Variant";
  const row = (
    <div className={cn("group flex min-h-[48px] items-center border-l-2 border-transparent pr-2 transition-colors", compact && "min-h-[42px]", selected ? "border-l-accent-orange bg-accent-orange/10" : "hover:bg-hover-subtle")}>
      <button aria-label={hasChildren ? `${expanded ? "Collapse" : "Expand"} ${name}` : undefined} className={cn("ml-1 flex h-8 w-7 shrink-0 items-center justify-center text-ink-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-orange", !hasChildren && "pointer-events-none opacity-0")} onClick={onToggle} tabIndex={hasChildren ? 0 : -1} type="button">
        {expanded ? <CaretDownIcon /> : <CaretRightIcon />}
      </button>
      <button className="min-w-0 flex-1 py-1.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent-orange" onClick={() => onSelect(selection)} type="button">
        <span className="flex items-center gap-2"><StatusDot status={status} /><span className="truncate text-sm font-medium">{name}</span>{count !== undefined ? <span className="ml-auto font-mono text-[10px] text-ink-muted">{count}</span> : null}</span>
        <span className="mt-0.5 block truncate pl-3.5 font-mono text-[10px] text-ink-muted">{meta}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button aria-label={`Actions for ${name}`} className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center text-ink-muted opacity-0 hover:bg-main hover:text-ink-primary focus:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-orange group-hover:opacity-100" type="button"><DotsHorizontalIcon /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 border-line-primary bg-surface text-ink-primary">
          <DropdownMenuItem onSelect={onCreate}>{addLabel}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDuplicate(selection)}>Duplicate</DropdownMenuItem>
          <DropdownMenuSeparator className="bg-line-secondary" />
          <DropdownMenuItem onSelect={() => onDelete(selection, "deactivate")}>Archive</DropdownMenuItem>
          <DropdownMenuItem className="text-accent-red focus:text-accent-red" onSelect={() => onDelete(selection, "delete")}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent className="w-52 border-line-primary bg-surface text-ink-primary">
        <ContextMenuItem onSelect={() => onSelect(selection)}>Edit</ContextMenuItem>
        <ContextMenuItem onSelect={onCreate}>{addLabel}</ContextMenuItem>
        <ContextMenuItem onSelect={() => onDuplicate(selection)}>Duplicate</ContextMenuItem>
        <ContextMenuSeparator className="bg-line-secondary" />
        <ContextMenuItem onSelect={() => onDelete(selection, "deactivate")}>Archive</ContextMenuItem>
        <ContextMenuItem className="text-accent-red focus:text-accent-red" onSelect={() => onDelete(selection, "delete")}>Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

type SearchResult = { name: string; path: string; selection: RecordSelection; status: ModelCatalogStatus };

function SearchResults({ onSelect, results, selection }: { onSelect: (selection: RecordSelection) => void; results: SearchResult[]; selection: RecordSelection | null }) {
  if (!results.length) return <Empty message="No matching names, slugs, codes, or tags." />;
  return (
    <div className="space-y-3 px-2">
      {(["ipSeries", "baseUnit", "kitVariant"] as RecordType[]).map((type) => {
        const group = results.filter((item) => item.selection.type === type);
        if (!group.length) return null;
        return (
          <section key={type}>
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">{recordTypeLabel(type)}</p>
            {group.map((result) => (
              <button className={cn("w-full border-l-2 border-transparent px-3 py-2.5 text-left hover:bg-hover-subtle", same(selection, result.selection) && "border-l-accent-orange bg-accent-orange/10")} key={recordKey(result.selection)} onClick={() => onSelect(result.selection)} type="button">
                <span className="flex items-center gap-2 text-sm font-medium"><StatusDot status={result.status} />{result.name}</span>
                <span className="mt-1 block truncate pl-3.5 text-xs text-ink-muted">{result.path}</span>
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function InspectorHeader({ busy, canSave, dirty, isNew, name, onCancel, onSave, status, type }: { busy: boolean; canSave: boolean; dirty: boolean; isNew: boolean; name: string; onCancel: () => void; onSave: () => void; status: ModelCatalogStatus; type: RecordType }) {
  return (
    <header className="sticky top-0 z-20 flex min-h-[76px] flex-col gap-3 border-b border-line-primary bg-surface/95 px-5 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-7 lg:px-9">
      <div className="min-w-0"><h2 className="truncate text-lg font-semibold tracking-tight">{name}</h2><div className="mt-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted"><span>{isNew ? "New" : recordTypeLabel(type)}</span><span>·</span><span className={cn(status === "active" && "text-accent-teal", status === "prerelease" && "text-accent-orange", status === "archived" && "text-accent-red")}>{statusLabel(status)}</span></div></div>
      <div className="flex shrink-0 items-center gap-3"><span className={cn("hidden text-xs sm:inline", dirty ? "text-accent-orange" : "text-ink-muted")}>{dirty ? "Unsaved changes" : "Up to date"}</span><button className="px-2 py-2 text-sm text-ink-secondary hover:text-ink-primary disabled:opacity-40" disabled={!dirty} onClick={onCancel} type="button">Cancel</button><Button className="min-w-[126px] bg-ink-primary text-surface shadow-none hover:bg-ink-secondary" disabled={!canSave || busy} onClick={onSave}>{busy ? "Saving…" : "Save changes"}</Button></div>
    </header>
  );
}

function IpInspector({ draft, onChange }: { draft: IpSeriesDraft; onChange: (patch: Partial<IpSeriesDraft>) => void }) {
  return <div className="space-y-8"><Section description="Catalog identity and ownership." title="General"><Fields><Field label="Name"><Input value={draft.name} onChange={(event) => onChange({ name: event.target.value })} /></Field><Field label="Slug"><Input className="font-mono" value={draft.slug} onChange={(event) => onChange({ slug: event.target.value })} /></Field><Field label="Universe"><Input value={draft.universe} onChange={(event) => onChange({ universe: event.target.value })} /></Field><Field label="Manufacturer"><Input value={draft.manufacturer} onChange={(event) => onChange({ manufacturer: event.target.value })} /></Field><Field className="sm:col-span-2" label="Rights owner"><Input value={draft.rightsOwner} onChange={(event) => onChange({ rightsOwner: event.target.value })} /></Field></Fields></Section><Section description="Upstream context used by prompt composition." title="Prompt grounding"><div className="space-y-5"><Field label="Visual DNA"><Textarea className="min-h-[110px]" value={draft.visualDNA} onChange={(event) => onChange({ visualDNA: event.target.value })} /></Field><Field label="Prompt anchor"><Textarea className="min-h-[140px]" value={draft.promptAnchor} onChange={(event) => onChange({ promptAnchor: event.target.value })} /></Field></div></Section><StatusEditor onChange={(status) => onChange({ status })} status={draft.status} /></div>;
}

function UnitInspector({ catalog, draft, onChange }: { catalog: ModelCatalogData; draft: BaseUnitDraft; onChange: (patch: Partial<BaseUnitDraft>) => void }) {
  return <div className="space-y-8"><Section description="Canonical machine identity, separate from a specific kit." title="General"><Fields><Field label="Name"><Input value={draft.name} onChange={(event) => onChange({ name: event.target.value })} /></Field><Field label="Slug"><Input className="font-mono" value={draft.slug} onChange={(event) => onChange({ slug: event.target.value })} /></Field><Field label="Unit code"><Input className="font-mono" value={draft.unitCode} onChange={(event) => onChange({ unitCode: event.target.value })} /></Field><Field label="Silhouette type"><Input value={draft.silhouetteType} onChange={(event) => onChange({ silhouetteType: event.target.value })} /></Field></Fields><div className="mt-5"><TagEditor label="Aliases" onChange={(aliases) => onChange({ aliases })} values={draft.aliases} /></div></Section><Section description="Moving this record also moves its kit variants." title="Model relation"><Field label="IP / Series"><Select value={draft.ipSeriesId || undefined} onValueChange={(ipSeriesId) => onChange({ ipSeriesId })}><SelectTrigger><SelectValue placeholder="Select IP / Series" /></SelectTrigger><SelectContent>{catalog.ipSeries.map((series) => <SelectItem key={series._id} value={series._id}>{series.name}</SelectItem>)}</SelectContent></Select></Field></Section><Section description="Prompt-critical constraints shared by every kit variant." title="Model DNA"><div className="space-y-5"><TagEditor label="Identity anchors" onChange={(keyShapeAnchors) => onChange({ keyShapeAnchors })} values={draft.keyShapeAnchors} /><TagEditor label="Native equipment" onChange={(nativeEquipment) => onChange({ nativeEquipment })} values={draft.nativeEquipment} /><TagEditor danger label="Forbidden changes" onChange={(forbiddenChanges) => onChange({ forbiddenChanges })} values={draft.forbiddenChanges} /></div></Section><Section title="Prompt grounding"><Field label="Prompt anchor"><Textarea className="min-h-[140px]" value={draft.promptAnchor} onChange={(event) => onChange({ promptAnchor: event.target.value })} /></Field></Section><StatusEditor onChange={(status) => onChange({ status })} status={draft.status} /></div>;
}

function KitInspector({ catalog, draft, onChange, onOpenUnit, selected }: { catalog: ModelCatalogData; draft: KitVariantDraft; onChange: (patch: Partial<KitVariantDraft>) => void; onOpenUnit: (id: string) => void; selected: KitVariantItem | null }) {
  const unit = catalog.baseUnits.find((item) => item._id === draft.baseUnitId) ?? null;
  return <div className="space-y-8"><Section description="Commercial kit identity and release attributes." title="General"><Fields><Field label="Name"><Input value={draft.name} onChange={(event) => onChange({ name: event.target.value })} /></Field><Field label="Slug"><Input className="font-mono" value={draft.slug} onChange={(event) => onChange({ slug: event.target.value })} /></Field><Field label="Primary model brand"><Input value={draft.primaryModelBrand} onChange={(event) => onChange({ primaryModelBrand: event.target.value })} /></Field><Field label="Release version"><Input value={draft.releaseVersion} onChange={(event) => onChange({ releaseVersion: event.target.value })} /></Field><Field label="Grade"><Input value={draft.grade} onChange={(event) => onChange({ grade: event.target.value })} /></Field><Field label="Scale"><Input value={draft.scale} onChange={(event) => onChange({ scale: event.target.value })} /></Field></Fields></Section><Section description="A kit inherits canonical identity from its Base Unit." title="Model relation"><Fields><Field label="IP / Series"><Input disabled value={unit?.ipSeries?.name ?? "Derived from Base Unit"} /></Field><Field label="Base Unit"><Select value={draft.baseUnitId || "none"} onValueChange={(value) => onChange({ baseUnitId: value === "none" ? "" : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Unlinked</SelectItem>{catalog.baseUnits.map((item) => <SelectItem key={item._id} value={item._id}>{item.name} · {item.ipSeries?.name ?? "No IP"}</SelectItem>)}</SelectContent></Select></Field></Fields>{unit ? <div className="mt-5 flex items-start justify-between gap-4 border-l-2 border-accent-teal bg-accent-teal/5 px-4 py-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-teal">Inherited model DNA</p><p className="mt-1 text-sm text-ink-secondary">{unit.keyShapeAnchors.length} identity anchors · {unit.forbiddenChanges.length} forbidden changes</p></div><button className="shrink-0 text-xs font-medium underline underline-offset-4" onClick={() => onOpenUnit(unit._id)} type="button">Open Base Unit</button></div> : null}</Section><Section title="Variant profile"><Fields><Field label="Complexity"><Input value={draft.complexityLevel} onChange={(event) => onChange({ complexityLevel: event.target.value })} /></Field><Field label="Panel density"><Input value={draft.panelDensity} onChange={(event) => onChange({ panelDensity: event.target.value })} /></Field></Fields><div className="mt-5 space-y-5"><TagEditor label="Aliases" onChange={(aliases) => onChange({ aliases })} values={draft.aliases} /><TagEditor label="Tags" onChange={(tags) => onChange({ tags })} values={draft.tags} /></div></Section><Section title="Media & prompt grounding"><div className="space-y-5"><Field label="Thumbnail asset key"><Input className="font-mono" value={draft.thumbnailAssetKey} onChange={(event) => onChange({ thumbnailAssetKey: event.target.value })} /></Field><Field label="Variant prompt anchor"><Textarea className="min-h-[140px]" value={draft.promptAnchor} onChange={(event) => onChange({ promptAnchor: event.target.value })} /></Field></div></Section>{selected ? <Section description="Downstream records that depend on this kit." title="References"><div className="grid grid-cols-2 border-y border-line-secondary sm:grid-cols-4">{Object.entries(selected.references).map(([label, value]) => <div className="border-b border-line-secondary px-3 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0" key={label}><p className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">{label}</p><p className="mt-1 font-mono text-xl">{value}</p></div>)}</div></Section> : null}<StatusEditor onChange={(status) => onChange({ status })} status={draft.status} /></div>;
}

function Section({ children, description, title }: { children: ReactNode; description?: string; title: string }) {
  return <section className="border-t border-line-secondary pt-5 first:border-t-0 first:pt-0"><div className="mb-5 sm:flex sm:items-start sm:justify-between sm:gap-8"><h3 className="text-xs font-semibold uppercase tracking-[0.16em]">{title}</h3>{description ? <p className="mt-1 max-w-md text-xs leading-5 text-ink-muted sm:mt-0 sm:text-right">{description}</p> : null}</div>{children}</section>;
}

function Field({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return <label className={cn("block", className)}><span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">{label}</span><div className="mt-2 [&_input]:border-line-secondary [&_input]:bg-surface [&_input]:shadow-none [&_textarea]:border-line-secondary [&_textarea]:bg-surface [&_textarea]:shadow-none">{children}</div></label>;
}

function Fields({ children }: { children: ReactNode }) { return <div className="grid gap-5 sm:grid-cols-2">{children}</div>; }

function StatusEditor({ onChange, status }: { onChange: (status: ModelCatalogStatus) => void; status: ModelCatalogStatus }) {
  const options: Array<[ModelCatalogStatus, string, string]> = [["active", "Active", "Available in model selection"], ["prerelease", "Pre-release", "Prepared for a future release"], ["archived", "Archived", "Hidden from active selection"]];
  return <Section description="Lifecycle status controls product availability." title="Status"><RadioGroup className="grid gap-0 border-y border-line-secondary sm:grid-cols-3" onValueChange={(value) => onChange(value as ModelCatalogStatus)} value={status}>{options.map(([value, label, copy]) => <label className="flex cursor-pointer items-start gap-3 border-b border-line-secondary px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0" key={value}><RadioGroupItem className="mt-0.5 border-ink-primary" value={value} /><span><span className="block text-sm font-medium">{label}</span><span className="mt-0.5 block text-xs leading-5 text-ink-muted">{copy}</span></span></label>)}</RadioGroup></Section>;
}

function DangerZone({ deleteDisabled, onArchive, onDelete, type }: { deleteDisabled: boolean; onArchive: () => void; onDelete: () => void; type: RecordType }) {
  return <section className="mt-12 border-t border-accent-red/55 pt-5"><h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-red">Danger zone</h3><div className="mt-4 divide-y divide-line-secondary border-y border-line-secondary"><DangerRow action="Archive" copy="Hide this record from active model selection." onClick={onArchive} title="Archive record" /><DangerRow action="Delete record" copy={deleteDisabled ? lockedCopy(type) : "Permanently remove this record. This cannot be undone."} disabled={deleteDisabled} onClick={onDelete} title="Delete record" /></div></section>;
}

function DangerRow({ action, copy, disabled, onClick, title }: { action: string; copy: string; disabled?: boolean; onClick: () => void; title: string }) {
  return <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-ink-muted">{copy}</p></div><button className="shrink-0 border border-accent-red px-3 py-2 text-xs font-medium text-accent-red hover:bg-accent-red/10 disabled:cursor-not-allowed disabled:opacity-35" disabled={disabled} onClick={onClick} type="button">{action}</button></div>;
}

function StatusDot({ status }: { status: ModelCatalogStatus }) { return <span aria-label={statusLabel(status)} className={cn("h-1.5 w-1.5 shrink-0", status === "active" && "bg-accent-teal", status === "prerelease" && "bg-accent-orange", status === "archived" && "bg-accent-red")} title={statusLabel(status)} />; }
function Empty({ message }: { message: string }) { return <div className="px-5 py-12 text-center"><p className="font-medium">No matching records</p><p className="mt-2 text-sm text-ink-muted">{message}</p></div>; }
function EmptyInspector({ onCreate }: { onCreate: () => void }) { return <div className="grid min-h-[620px] place-items-center px-6 text-center"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Record inspector</p><h2 className="mt-3 text-2xl font-semibold">Select a model record</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-secondary">Choose a node to inspect its fields, relationships, and prompt grounding.</p><Button className="mt-5 bg-ink-primary text-surface" onClick={onCreate}>Create first IP / Series</Button></div></div>; }
function Loading({ label }: { label: string }) { return <section className="border border-line-primary bg-surface p-6"><p className="text-xs uppercase tracking-[0.18em] text-accent-teal">Models</p><h2 className="mt-3 text-2xl font-semibold">{label}</h2></section>; }

function buildTree(data: ModelCatalogData, query: string, filter: StatusFilter): TreeBranch[] {
  const term = normalize(query);
  return data.ipSeries.flatMap((series) => {
    const units = data.baseUnits.filter((unit) => unit.ipSeriesId === series._id).flatMap((unit) => {
      const variants = data.kitVariants.filter((kit) => kit.baseUnitId === unit._id && passes(kit.status, filter) && searchable(kit).includes(term));
      return passes(unit.status, filter) && searchable(unit).includes(term) || variants.length ? [{ unit, variants }] : [];
    });
    return passes(series.status, filter) && searchable(series).includes(term) || units.length ? [{ series, units }] : [];
  });
}

function buildSearchResults(data: ModelCatalogData, query: string, filter: StatusFilter): SearchResult[] {
  const term = normalize(query);
  return [
    ...data.ipSeries.filter((item) => passes(item.status, filter) && searchable(item).includes(term)).map((item) => ({ name: item.name, path: item.universe ?? item.slug, selection: { id: item._id, type: "ipSeries" as const }, status: item.status })),
    ...data.baseUnits.filter((item) => passes(item.status, filter) && searchable(item).includes(term)).map((item) => ({ name: item.name, path: item.ipSeries?.name ?? "Unlinked IP / Series", selection: { id: item._id, type: "baseUnit" as const }, status: item.status })),
    ...data.kitVariants.filter((item) => passes(item.status, filter) && searchable(item).includes(term)).map((item) => ({ name: item.name, path: [item.ipSeries?.name, item.baseUnit?.name].filter(Boolean).join(" › ") || "Unlinked kit", selection: { id: item._id, type: "kitVariant" as const }, status: item.status })),
  ];
}

function searchable(item: IpSeriesItem | BaseUnitItem | KitVariantItem) {
  const values = Object.values(item).flatMap((value) => Array.isArray(value) ? value : typeof value === "object" && value ? Object.values(value) : [value]);
  return normalize(values.filter((value) => typeof value === "string" || typeof value === "number").join(" "));
}
function normalize(value: string) { return value.trim().toLocaleLowerCase(); }
function passes(status: ModelCatalogStatus, filter: StatusFilter) { return filter === "all" || status === filter; }
function same(left: RecordSelection | null, right: RecordSelection) { return left?.id === right.id && left.type === right.type; }
function toggle(current: Set<string>, key: string) { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next; }
function omit<T>(record: Record<string, T>, key: string) { const next = { ...record }; delete next[key]; return next; }
function optional(value: string) { const normalized = value.trim(); return normalized ? normalized : undefined; }
function recordName(data: ModelCatalogData, selection: RecordSelection) { if (selection.id === "new") return null; if (selection.type === "ipSeries") return data.ipSeries.find((item) => item._id === selection.id)?.name ?? null; if (selection.type === "baseUnit") return data.baseUnits.find((item) => item._id === selection.id)?.name ?? null; return data.kitVariants.find((item) => item._id === selection.id)?.name ?? null; }
function deletionLocked(data: ModelCatalogData, selection: RecordSelection) { if (selection.type === "ipSeries") return Boolean(data.ipSeries.find((item) => item._id === selection.id)?.baseUnitCount); if (selection.type === "baseUnit") return Boolean(data.baseUnits.find((item) => item._id === selection.id)?.kitVariantCount); const refs = data.kitVariants.find((item) => item._id === selection.id)?.references; return refs ? Object.values(refs).some((value) => value > 0) : false; }
function lockedCopy(type: RecordType) { if (type === "ipSeries") return "Delete is locked while Base Units are linked."; if (type === "baseUnit") return "Delete is locked while Kit Variants are linked."; return "Delete is locked while downstream records reference this kit."; }
function revealRecord(target: RecordSelection, data: ModelCatalogData, setExpanded: (updater: (current: Set<string>) => Set<string>) => void) { setExpanded((current) => { const next = new Set(current); if (target.type === "ipSeries") next.add(`ipSeries:${target.id}`); if (target.type === "baseUnit") { const unit = data.baseUnits.find((item) => item._id === target.id); if (unit) next.add(`ipSeries:${unit.ipSeriesId}`); } if (target.type === "kitVariant") { const kit = data.kitVariants.find((item) => item._id === target.id); const unit = kit?.baseUnitId ? data.baseUnits.find((item) => item._id === kit.baseUnitId) : null; if (kit?.baseUnitId) next.add(`baseUnit:${kit.baseUnitId}`); if (unit) next.add(`ipSeries:${unit.ipSeriesId}`); } return next; }); }
