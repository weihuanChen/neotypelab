import type { HomeHeroPaint } from "./types";

/**
 * The home hero is a long-lived static plate: the same kit photographed before
 * and after its repaint, pixel-aligned so the drag seam lines up exactly.
 * Swap the two files in public/assets/home/ (same pose, same camera, square)
 * and update the paint key below when the hero changes.
 */
export const heroShowcase = {
  kitName: "ν Gundam",
  beforeUrl: "/assets/home/hero-kit.webp",
  afterUrl: "/assets/home/hero-build.webp",
  beforeLabel: "Your kit",
  afterLabel: "Your build",
  alt: "ν Gundam repainted in off-white and blue gray, with ochre and russet accents",
  /** Paint key for the "after" image. Photo-sampled swatches and matching paint references. */
  paints: [
    { letter: "A", name: "Off white", roleName: "Armor base", hex: "#D9D5D2", area: null, coverage: null, paint: { brand: "Mr. Color", code: "C69", colorName: "Off White" } },
    { letter: "B", name: "Blue gray", roleName: "Chest, knees, shield, feet", hex: "#395879", area: null, coverage: null, paint: { brand: "Mr. Color", code: "C72", colorName: "Intermediate Blue" } },
    { letter: "C", name: "Middle Stone", roleName: "Vents, fins, shield tip", hex: "#DDA845", area: null, coverage: null, paint: { brand: "Mr. Color", code: "C21", colorName: "Middle Stone" } },
    { letter: "D", name: "Russet", roleName: "Chest and waist marks", hex: "#A75A5A", area: null, coverage: null, paint: { brand: "Mr. Color", code: "C81", colorName: "Russet" } },
    { letter: "E", name: "Frame gray", roleName: "Hands, joints", hex: "#414246", area: null, coverage: null, paint: { brand: "Mr. Color", code: "C40", colorName: "German Gray" } },
  ] as HomeHeroPaint[],
  /** Positions on the full "after" photo (0–1); the comparison seam clips hidden markers. */
  callouts: [
    { letter: "A", x: 0.622, y: 0.158 },
    { letter: "B", x: 0.614, y: 0.702 },
    { letter: "C", x: 0.717, y: 0.419 },
    { letter: "D", x: 0.443, y: 0.378 },
    { letter: "E", x: 0.643, y: 0.498 },
  ],
};
