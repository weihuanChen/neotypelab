import type { Dispatch, SetStateAction } from "react";
import { CompiledPromptViewer } from "./CompiledPromptViewer";
import { ExperimentInputs } from "./ExperimentInputs";
import type {
  PromptCatalogData,
  PromptLabDraft,
  PromptLabResult,
  PromptTemplateRecord,
  PromptTemplateVersionRecord,
} from "./promptLabTypes";

export function ExperimentComposer({
  busy,
  catalog,
  disabled,
  draft,
  onCompose,
  onCopyError,
  onReset,
  result,
  selectedTemplate,
  selectedVersion,
  setDraft,
}: {
  busy: boolean;
  catalog: PromptCatalogData | undefined;
  disabled: boolean;
  draft: PromptLabDraft;
  onCompose: () => void;
  onCopyError: (message: string) => void;
  onReset: () => void;
  result: PromptLabResult | null;
  selectedTemplate: PromptTemplateRecord | null;
  selectedVersion: PromptTemplateVersionRecord | null;
  setDraft: Dispatch<SetStateAction<PromptLabDraft>>;
}) {
  return (
    <div className="prompt-lab-composer">
      <ExperimentInputs
        busy={busy}
        catalog={catalog}
        disabled={disabled}
        draft={draft}
        onCompose={onCompose}
        onReset={onReset}
        setDraft={setDraft}
      />
      <CompiledPromptViewer
        onCopyError={onCopyError}
        result={result}
        selectedTemplate={selectedTemplate}
        selectedVersion={selectedVersion}
      />
    </div>
  );
}
