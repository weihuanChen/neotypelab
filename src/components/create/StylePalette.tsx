export type DisplayColor = { role: string; hex: string; weight: number };
const roles = ["Armor primary", "Armor secondary", "Frame", "Accent", "Detail"];
const weights = [42, 24, 16, 10, 8];
// Editorial display studies only. These values never enter generation requests.
const studies: Record<string, string[]> = {
  "crimson-command": ["#A51F25", "#70151B", "#191919", "#C49A45", "#E8E1D2"],
  "classic-hero": ["#E8E3D7", "#D73532", "#23262D", "#23509A", "#E8BC36"],
  "eva-inspired": ["#684690", "#342743", "#25282C", "#96C843", "#D57134"],
  "military-prototype": ["#65705A", "#A6A18B", "#2B3030", "#CE9A3C", "#DED9CB"],
  "armored-core-inspired": ["#4A4F55", "#CFCAB8", "#1E2023", "#E0622A", "#D43A4A"],
  "industrial-orange": ["#E2611B", "#B9BCB7", "#2A2C2F", "#F2EFE6", "#1B5E8C"],
  "excavator-yellow": ["#F2B705", "#1D1D1D", "#5C6065", "#C62828", "#CDD1D4"],
  "arctic-ops": ["#E4E8EA", "#97A6B2", "#363D44", "#C8352B", "#7FC4E0"],
  "racing-livery": ["#86BEE0", "#EE6F2A", "#222428", "#F4F2EC", "#BFC4C9"],
  "naval-grey": ["#8D9396", "#50565A", "#2E3236", "#8E2B24", "#ECEDE8"],
};
/** Colour names from a Style Intent palette, without the HEX anchors meant for the planner. */
export function paletteNames(palette: Record<string, string | string[] | undefined>): string {
  return Object.values(palette).flat().filter((c): c is string => Boolean(c))
    .map(c => c.replace(/\s*#[0-9a-f]{6}\b/gi, "").trim()).filter(Boolean).join(" · ");
}
export function displayPalette(slug: string): DisplayColor[] {
  return (studies[slug] ?? []).map((hex, i) => ({ hex, role: roles[i], weight: weights[i] }));
}
export function StylePalette({ colors, large = false }: { colors: DisplayColor[]; large?: boolean }) {
  if (!colors.length) return null;
  return <div className={large ? "style-color-strip is-large" : "style-color-strip"} aria-label="Illustrative palette balance">
    {colors.map(color => <span key={color.role} tabIndex={0} style={{ flexGrow: color.weight, backgroundColor: color.hex }}
      aria-label={`${color.role}: ${color.hex}, illustrative weight ${color.weight}%`}>
      <span className="style-color-tip">{color.role}<br />{color.hex}<br />Palette balance · {color.weight}%</span>
    </span>)}
  </div>;
}
