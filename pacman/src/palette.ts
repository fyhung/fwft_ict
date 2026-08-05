export interface PaletteColor {
  id: string;
  hex: string;
  label: string;
}

const hues = Array.from({ length: 12 }, (_, index) => index * 30);
const variants = [
  { saturation: 94, lightness: 58, offset: 0, label: "Vivid" },
  { saturation: 82, lightness: 72, offset: 10, label: "Bright" },
  { saturation: 88, lightness: 42, offset: 5, label: "Deep" },
  { saturation: 50, lightness: 62, offset: 18, label: "Soft" },
];

const chromaticColors: PaletteColor[] = variants.flatMap((variant, variantIndex) =>
  hues.map((hue, hueIndex) => {
    const index = variantIndex * hues.length + hueIndex;
    return {
      id: `c${String(index).padStart(2, "0")}`,
      hex: `hsl(${(hue + variant.offset) % 360} ${variant.saturation}% ${variant.lightness}%)`,
      label: `${variant.label} color ${hueIndex + 1}`,
    };
  }),
);

const neutralAndDarkColors = [
  ["#ffffff", "Snow white"], ["#eceff4", "Pearl white"], ["#d1d5db", "Silver grey"], ["#a3a3a3", "Stone grey"],
  ["#737373", "Slate grey"], ["#525252", "Graphite grey"], ["#303030", "Charcoal"], ["#151515", "Midnight black"],
  ["#172554", "Night navy"], ["#3b0764", "Night violet"], ["#4a044e", "Night plum"], ["#450a0a", "Night red"],
  ["#422006", "Night brown"], ["#052e16", "Night green"], ["#083344", "Night teal"], ["#1e293b", "Blue charcoal"],
] as const;

// Forty-eight chromatic choices plus sixteen whites, greys, and very dark
// tones keep the full 64-color capacity while providing clearly different looks.
export const PALETTE: PaletteColor[] = [
  ...chromaticColors,
  ...neutralAndDarkColors.map(([hex, label], index) => ({
    id: `c${String(48 + index).padStart(2, "0")}`,
    hex,
    label,
  })),
];

export function colorValue(colorId: string): string {
  return PALETTE.find((color) => color.id === colorId)?.hex ?? "#f7d94c";
}

export function contrastValue(colorId: string): string {
  const color = colorValue(colorId);
  const hslLightness = color.match(/hsl\([^ ]+ [^ ]+ ([\d.]+)%\)/)?.[1];
  if (hslLightness) return Number(hslLightness) < 50 ? "#ffffff" : "#050713";
  const match = color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!match) return "#050713";
  const [red, green, blue] = match.slice(1).map((part) => Number.parseInt(part, 16));
  return red * 0.299 + green * 0.587 + blue * 0.114 < 145 ? "#ffffff" : "#050713";
}
