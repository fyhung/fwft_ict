export interface PaletteColor {
  id: string;
  hex: string;
  label: string;
}

const hues = [0, 35, 60, 105, 170, 205, 255, 305];
const levels = [
  [88, 58],
  [78, 66],
  [70, 58],
  [62, 68],
  [54, 56],
  [48, 66],
  [42, 54],
  [36, 62],
];

export const PALETTE: PaletteColor[] = hues.flatMap((hue, hueIndex) =>
  levels.map(([saturation, lightness], levelIndex) => ({
    id: `c${String(hueIndex * 8 + levelIndex).padStart(2, "0")}`,
    hex: `hsl(${hue} ${saturation}% ${lightness}%)`,
    label: `Color ${hueIndex * 8 + levelIndex + 1}`,
  })),
);

export function colorValue(colorId: string): string {
  return PALETTE.find((color) => color.id === colorId)?.hex ?? "#f7d94c";
}
