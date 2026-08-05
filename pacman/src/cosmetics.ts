export const COSMETICS = [
  { id: "party-hat", label: "Party hat", symbol: "△" },
  { id: "crown", label: "Crown", symbol: "♛" },
  { id: "top-hat", label: "Top hat", symbol: "▰" },
  { id: "cap", label: "Cap", symbol: "◒" },
  { id: "beanie", label: "Beanie", symbol: "●" },
  { id: "cowboy", label: "Cowboy hat", symbol: "⌒" },
  { id: "halo", label: "Halo", symbol: "○" },
  { id: "antenna", label: "Antenna", symbol: "⌁" },
  { id: "cat-ears", label: "Cat ears", symbol: "ᨓ" },
  { id: "bow", label: "Bow", symbol: "⋈" },
] as const;

export type CosmeticId = typeof COSMETICS[number]["id"];

export const COSMETIC_IDS = new Set<string>(COSMETICS.map(({ id }) => id));

export function cosmeticLabel(cosmeticId: string) {
  return COSMETICS.find(({ id }) => id === cosmeticId)?.label ?? "Choose a cosmetic";
}
