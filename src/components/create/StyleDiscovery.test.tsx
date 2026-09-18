// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { StyleDiscovery } from "./StyleDiscovery";
import { displayPalette, StylePalette } from "./StylePalette";
import { CustomStylePicker } from "./CustomStylePicker";
vi.mock("convex/react", () => ({ useQuery: () => null, useMutation: () => vi.fn(), useAction: () => vi.fn() }));
describe("style workspace", () => {
  it("keeps the default discovery rail to four directions", () => {
    const presets = Array.from({ length: 20 }, (_, i) => ({
      _id: "style-" + i, name: "Direction " + i, slug: "direction-" + i,
    })) as ComponentProps<typeof StyleDiscovery>["presets"];
    const html = renderToStaticMarkup(<StyleDiscovery presets={presets} previews={[]} community={[]} busy={false} onPreset={() => {}} onCommunity={() => {}} />);
    expect(html.match(/<article/g)).toHaveLength(4);
    expect(html).toContain("Browse all 20");
    expect(html).not.toContain('aria-label="Search styles"');
  });
  it("opens a paginated source-filtered catalog for a community share link", () => {
    const presets = Array.from({ length: 20 }, (_, i) => ({ _id: "style-" + i, name: "Direction " + i, slug: "direction-" + i })) as ComponentProps<typeof StyleDiscovery>["presets"];
    const html = renderToStaticMarkup(<StyleDiscovery presets={presets} previews={[]} community={[]} busy={false} initialCommunity="missing" onPreset={() => {}} onCommunity={() => {}} />);
    expect(html).toContain('aria-label="Style pages"');
    expect(html).toContain("No styles match these filters");
  });
  it("uses explicit unequal color weights without inventing unknown palettes", () => {
    const colors = displayPalette("crimson-command");
    expect(colors.reduce((sum, c) => sum + c.weight, 0)).toBe(100);
    expect(new Set(colors.map(c => c.weight)).size).toBe(5);
    expect(displayPalette("unknown")).toEqual([]);
    const html = renderToStaticMarkup(<StylePalette colors={colors} />);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("Armor primary");
    expect(html).not.toContain("gradient");
    expect(html).not.toContain("Mr. Color");
  });
  it("renders only a command task in Create without nested source tabs", () => {
    const html = renderToStaticMarkup(<CustomStylePicker userId="test" creditCost={1} selectedId={null} view="describe" onUse={() => {}} onClear={() => {}} onApply={() => {}} />);
    expect(html).toContain("What should this kit become?");
    expect(html).toContain("Interpret");
    expect(html).not.toContain("Publish to Community");
    expect(html).not.toContain("My Styles");
    expect(html).not.toContain('aria-label="Custom style sources"');
  });
  it("blocks interpretation when the viewer cannot pay the tariff", () => {
    const html = renderToStaticMarkup(<CustomStylePicker userId="test" creditCost={1} creditBalance={0} selectedId={null} view="describe" onUse={() => {}} onClear={() => {}} onApply={() => {}} />);
    expect(html).toContain("Needs 1 credit · 0 available");
    expect(html).toMatch(/disabled=""[^>]*>Interpret/);
  });
});
