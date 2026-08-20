import { ChevronDownIcon } from "@radix-ui/react-icons";
import type { Dispatch, SetStateAction } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LabActionButton, LabField, LabSectionLabel } from "./PromptLabPrimitives";
import type { PromptLabExperimentDraft } from "./promptLabTypes";
import { calculateScoreAverage } from "./promptLabUtils";

const scoreFields: Array<{
  key: keyof Pick<
    PromptLabExperimentDraft,
    | "styleHitScore"
    | "silhouetteScore"
    | "paintabilityScore"
    | "promptAdherenceScore"
    | "visualImpactScore"
  >;
  label: string;
}> = [
  { key: "silhouetteScore", label: "Silhouette" },
  { key: "styleHitScore", label: "Style" },
  { key: "paintabilityScore", label: "Paintability" },
  { key: "promptAdherenceScore", label: "Adherence" },
  { key: "visualImpactScore", label: "Impact" },
];

export function RunRecorder({
  busy,
  disabled,
  draft,
  onSave,
  providers,
  setDraft,
}: {
  busy: boolean;
  disabled: boolean;
  draft: PromptLabExperimentDraft;
  onSave: () => void;
  providers: string[];
  setDraft: Dispatch<SetStateAction<PromptLabExperimentDraft>>;
}) {
  const computedOverall = calculateScoreAverage(draft);

  return (
    <section className="prompt-lab-recorder">
      <LabSectionLabel
        description="Attach the vendor output and save a reproducible run."
        title="Record result"
      />

      <div className="prompt-lab-result-primary">
        <LabField label="Provider">
          <Input
            list="prompt-lab-provider-options"
            onChange={(event) =>
              setDraft((current) => ({ ...current, providerLabel: event.target.value }))
            }
            placeholder="OpenAI"
            value={draft.providerLabel}
          />
          <datalist id="prompt-lab-provider-options">
            {providers.map((provider) => <option key={provider} value={provider} />)}
          </datalist>
        </LabField>
        <LabField label="Model">
          <Input
            onChange={(event) =>
              setDraft((current) => ({ ...current, modelLabel: event.target.value }))
            }
            placeholder="GPT Image"
            value={draft.modelLabel}
          />
        </LabField>
        <LabField label="Image URL">
          <Input
            onChange={(event) =>
              setDraft((current) => ({ ...current, outputImageUrl: event.target.value }))
            }
            placeholder="https://..."
            type="url"
            value={draft.outputImageUrl}
          />
        </LabField>
        <LabField label="Overall">
          <Input
            max="10"
            min="0"
            onChange={(event) =>
              setDraft((current) => ({ ...current, overallScore: event.target.value }))
            }
            placeholder={computedOverall === undefined ? "Auto" : `Auto ${computedOverall}`}
            step="0.1"
            type="number"
            value={draft.overallScore}
          />
        </LabField>
      </div>

      <LabField label="Result notes">
        <Textarea
          onChange={(event) =>
            setDraft((current) => ({ ...current, outputNotes: event.target.value }))
          }
          placeholder="What worked, what failed, and what should change next."
          value={draft.outputNotes}
        />
      </LabField>

      <Collapsible className="prompt-lab-evaluation">
        <CollapsibleTrigger>
          <ChevronDownIcon aria-hidden="true" />
          Detailed evaluation
          <span>{computedOverall === undefined ? "No dimensions scored" : `Auto overall ${computedOverall}`}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="prompt-lab-score-grid">
            {scoreFields.map((field) => (
              <LabField key={field.key} label={field.label}>
                <Input
                  max="10"
                  min="0"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                  step="0.1"
                  type="number"
                  value={draft[field.key]}
                />
              </LabField>
            ))}
          </div>
          <div className="prompt-lab-evaluation-details">
            <LabField label="Failure tags">
              <Input
                onChange={(event) =>
                  setDraft((current) => ({ ...current, failureTags: event.target.value }))
                }
                placeholder="weak-material, off-model"
                value={draft.failureTags}
              />
            </LabField>
            <LabField label="Vendor URL">
              <Input
                onChange={(event) =>
                  setDraft((current) => ({ ...current, vendorUrl: event.target.value }))
                }
                placeholder="Optional web session link"
                type="url"
                value={draft.vendorUrl}
              />
            </LabField>
          </div>
          <LabField label="Parameter notes">
            <Textarea
              onChange={(event) =>
                setDraft((current) => ({ ...current, parameterNotes: event.target.value }))
              }
              placeholder="Vendor-side settings that are not part of the prompt."
              value={draft.parameterNotes}
            />
          </LabField>
          <label className="prompt-lab-winner-toggle">
            <Checkbox
              checked={draft.selectedAsWinner}
              onCheckedChange={(checked) =>
                setDraft((current) => ({ ...current, selectedAsWinner: checked === true }))
              }
            />
            <span>
              Winner candidate
              <small>Mark this result as the selected benchmark.</small>
            </span>
          </label>
        </CollapsibleContent>
      </Collapsible>

      <div className="prompt-lab-record-actions">
        <LabActionButton busy={busy} disabled={disabled} onClick={onSave}>
          Save run
        </LabActionButton>
        <span>Compiled prompt and input snapshots are saved with every run.</span>
      </div>
    </section>
  );
}
