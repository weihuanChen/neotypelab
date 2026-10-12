import { parseCreativeRequirements } from "@/src/components/library/libraryBriefData";

export function CreativeRequirements({ intentJson }: { intentJson?: string | null }) {
  const requirements = parseCreativeRequirements(intentJson);
  if (!requirements.length) return null;
  return <section className="creative-requirements" aria-label="Creative requirements">
    <p className="workbench-kicker">What this build keeps</p>
    <dl>{requirements.map((requirement) => <div key={`${requirement.label}-${requirement.value}-${requirement.source}`}>
      <dt>{requirement.label}</dt><dd>{requirement.value}<small>{requirement.source}</small></dd>
    </div>)}</dl>
  </section>;
}
