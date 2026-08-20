import { CopyIcon, ExternalLinkIcon } from "@radix-ui/react-icons";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LabEmpty, LabSectionLabel } from "./PromptLabPrimitives";
import type {
  PromptLabResult,
  PromptTemplateRecord,
  PromptTemplateVersionRecord,
  PromptViewerTab,
} from "./promptLabTypes";

export function CompiledPromptViewer({
  result,
  selectedTemplate,
  selectedVersion,
  onCopyError,
}: {
  result: PromptLabResult | null;
  selectedTemplate: PromptTemplateRecord | null;
  selectedVersion: PromptTemplateVersionRecord | null;
  onCopyError: (message: string) => void;
}) {
  const [tab, setTab] = useState<PromptViewerTab>("full");
  const [copied, setCopied] = useState(false);
  const blocks = useMemo(() => buildPromptBlocks(result), [result]);
  const activeValue = blocks[tab];

  const copyActivePrompt = async () => {
    if (!activeValue.trim()) return;
    try {
      await navigator.clipboard.writeText(activeValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (error) {
      onCopyError(error instanceof Error ? error.message : "Failed to copy prompt");
    }
  };

  return (
    <section className="prompt-lab-viewer">
      <LabSectionLabel
        count={result ? `${activeValue.length.toLocaleString()} chars` : "Not composed"}
        description="Inspect the exact prompt snapshot before opening a vendor tool."
        title="Compiled prompt"
      />

      <Tabs
        className="prompt-lab-prompt-tabs"
        onValueChange={(value) => setTab(value as PromptViewerTab)}
        value={tab}
      >
        <div className="prompt-lab-viewer-toolbar">
          <TabsList>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="user">User</TabsTrigger>
            <TabsTrigger value="full">Full</TabsTrigger>
          </TabsList>
          <div>
            {selectedTemplate ? (
              <Link
                aria-label="Open selected template"
                search={{
                  template: selectedTemplate._id,
                  version: selectedVersion?._id ?? undefined,
                }}
                title="Open template"
                to="/admin/templates"
              >
                <ExternalLinkIcon aria-hidden="true" />
              </Link>
            ) : null}
            <button
              aria-label={`Copy ${tab} prompt`}
              disabled={!activeValue.trim()}
              onClick={() => void copyActivePrompt()}
              title={`Copy ${tab} prompt`}
              type="button"
            >
              <CopyIcon aria-hidden="true" />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {(["system", "user", "full"] as PromptViewerTab[]).map((value) => (
          <TabsContent key={value} value={value}>
            {result ? (
              <pre>{blocks[value] || "This prompt block is empty."}</pre>
            ) : (
              <LabEmpty>Compose the experiment to generate a prompt snapshot.</LabEmpty>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {result?.warnings.length ? (
        <div className="prompt-lab-warning">{result.warnings.join(" ")}</div>
      ) : null}

      {result ? (
        <footer className="prompt-lab-variable-summary">
          <span>Variables</span>
          <div>
            {result.usedVariables.length ? (
              result.usedVariables.map((variable) => <code key={variable}>{`{{${variable}}}`}</code>)
            ) : (
              <em>No runtime variables</em>
            )}
          </div>
        </footer>
      ) : null}
    </section>
  );
}

function buildPromptBlocks(result: PromptLabResult | null): Record<PromptViewerTab, string> {
  if (!result) return { system: "", user: "", full: "" };
  const negative = result.copyBlocks.negativePrompt.trim();
  return {
    system: result.copyBlocks.systemPrompt,
    user: result.copyBlocks.userPrompt,
    full: [
      "SYSTEM",
      result.copyBlocks.systemPrompt,
      "USER",
      result.copyBlocks.userPrompt,
      negative ? `NEGATIVE\n${negative}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}
