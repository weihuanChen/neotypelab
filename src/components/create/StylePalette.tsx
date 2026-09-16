export type DisplayColor = { role: string; hex: string; weight: number };
const roles = ["Armor primary", "Armor secondary", "Frame", "Accent", "Detail"];
const weights = [42, 24, 16, 10, 8];
// Editorial display studies only. These values never enter generation requests.
const studies: Record<string, string[]> = {
  "crimson-command": ["#A51F25", "#70151B", "#191919", "#C49A45", "#E8E1D2"],
  "classic-hero": ["#E8E3D7", "#D73532", "#23262D", "#23509A", "#E8BC36"],
  "eva-inspired": ["#684690", "#342743", "#25282C", "#96C843", "#D57134"],
  "military-prototype": ["#65705A", "#A6A18B", "#2B3030", "#CE9A3C", "#DED9CB"],
};
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
