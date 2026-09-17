import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function KitPortraitField({ value, resolvedUrl, onChange }: { value: string; resolvedUrl?: string | null; onChange: (value: string) => void }) {
  const [failed, setFailed] = useState<string | null>(null);
  const url = !value ? null : /^https:\/\//.test(value) ? value : resolvedUrl;
  return <div className="space-y-3"><Input aria-label="Kit portrait URL or R2 asset key" value={value} onChange={event => onChange(event.target.value)} placeholder="https://…/kit-portrait.webp or catalog/kits/…" />
    <p className="text-sm text-ink-muted">Silhouette portrait · 4:5 canvas, fixed three-quarter view, neutral background, low saturation. Keep the complete model within 70–80% of the frame. No packaging or scene.</p>
    {url && failed !== url ? <img src={url} alt="Kit portrait preview" className="h-48 w-40 border border-line-secondary object-contain" onError={() => setFailed(url)} /> : <p className="text-sm text-ink-muted">{value ? "Save to resolve an R2 key, or check the image URL." : "No portrait configured. Kit cards will display Portrait pending."}</p>}
    {value ? <Button variant="outline" type="button" onClick={() => onChange("")}>Remove portrait</Button> : null}
  </div>;
}
