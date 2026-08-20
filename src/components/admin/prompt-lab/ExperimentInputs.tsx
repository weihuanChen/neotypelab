import { ChevronDownIcon, ReloadIcon } from "@radix-ui/react-icons";
import type { Dispatch, SetStateAction } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { LabActionButton, LabField, LabSectionLabel } from "./PromptLabPrimitives";
import type {
  PromptCatalogData,
  PromptCatalogOption,
  PromptLabDraft,
  WeatheringLevel,
} from "./promptLabTypes";
import { moodOptions, weatheringOptions } from "./promptLabUtils";

export function ExperimentInputs({
  busy,
  catalog,
  disabled,
  draft,
  onCompose,
  onReset,
  setDraft,
}: {
  busy: boolean;
  catalog: PromptCatalogData | undefined;
  disabled: boolean;
  draft: PromptLabDraft;
  onCompose: () => void;
  onReset: () => void;
  setDraft: Dispatch<SetStateAction<PromptLabDraft>>;
}) {
  return (
    <section className="prompt-lab-inputs">
      <LabSectionLabel
        description="Define the runtime context used to compile this template."
        title="Experiment input"
      />

      <div className="prompt-lab-primary-inputs">
        <CatalogSelect
          label="Kit"
          onChange={(value) => setDraft((current) => ({ ...current, kitVariantId: value }))}
          options={catalog?.kitVariants ?? []}
          value={draft.kitVariantId}
        />
        <CatalogSelect
          label="Style DNA"
          onChange={(value) => setDraft((current) => ({ ...current, stylePresetId: value }))}
          options={catalog?.stylePresets ?? []}
          value={draft.stylePresetId}
        />
        <CatalogSelect
          label="Material"
          onChange={(value) => setDraft((current) => ({ ...current, materialPresetId: value }))}
          options={catalog?.materialPresets ?? []}
          value={draft.materialPresetId}
        />
      </div>

      <div className="prompt-lab-context-row">
        <LabField label="Mood">
          <div className="prompt-lab-mood-control" role="group" aria-label="Mood vector">
            {moodOptions.map((option) => {
              const active = draft.moodTags.includes(option.value);
              return (
                <button
                  aria-pressed={active}
                  className={cn(active && "is-active")}
                  key={option.value}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      moodTags: active
                        ? current.moodTags.filter((tag) => tag !== option.value)
                        : [...current.moodTags, option.value],
                    }))
                  }
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </LabField>

        <LabField label="Weathering">
          <Select
            onValueChange={(value: WeatheringLevel) =>
              setDraft((current) => ({ ...current, weatheringLevel: value }))
            }
            value={draft.weatheringLevel}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weatheringOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabField>
      </div>

      <Collapsible className="prompt-lab-advanced">
        <CollapsibleTrigger>
          <ChevronDownIcon aria-hidden="true" />
          Advanced context
          <span>Concept, remix source and operator note</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="prompt-lab-advanced-grid">
            <LabField label="Manual concept ID">
              <Input
                onChange={(event) =>
                  setDraft((current) => ({ ...current, conceptId: event.target.value }))
                }
                placeholder="Optional stable label"
                value={draft.conceptId}
              />
            </LabField>
            <LabField label="Remix source">
              <Input
                onChange={(event) =>
                  setDraft((current) => ({ ...current, remixSource: event.target.value }))
                }
                placeholder="Optional source title"
                value={draft.remixSource}
              />
            </LabField>
          </div>
          <LabField label="Additional note">
            <Textarea
              onChange={(event) =>
                setDraft((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="Runtime guidance for this experiment"
              value={draft.notes}
            />
          </LabField>
        </CollapsibleContent>
      </Collapsible>

      <div className="prompt-lab-compose-actions">
        <LabActionButton busy={busy} disabled={disabled} onClick={onCompose}>
          Compose
        </LabActionButton>
        <button aria-label="Reset experiment inputs" onClick={onReset} title="Reset inputs" type="button">
          <ReloadIcon aria-hidden="true" />
          Reset
        </button>
      </div>
    </section>
  );
}

function CatalogSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: PromptCatalogOption[];
  value: string;
}) {
  return (
    <LabField label={label}>
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {options.map((option) => (
            <SelectItem key={option._id} value={option._id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </LabField>
  );
}
