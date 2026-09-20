/**
 * Flavor vocabulary, grouped the way a tasting wheel is. Fixed tags beat free
 * text here: you can only chart "this got sweeter with age" if the same note
 * is spelled the same way every time.
 */
export const FLAVOR_GROUPS: { group: string; tags: string[] }[] = [
  {
    group: "Earth & Wood",
    tags: ["Cedar", "Oak", "Earth", "Barnyard", "Hay", "Moss", "Tobacco"],
  },
  {
    group: "Spice",
    tags: [
      "Black pepper",
      "White pepper",
      "Red pepper",
      "Cinnamon",
      "Clove",
      "Nutmeg",
      "Anise",
    ],
  },
  {
    group: "Sweet",
    tags: [
      "Caramel",
      "Honey",
      "Molasses",
      "Brown sugar",
      "Vanilla",
      "Maple",
      "Toffee",
    ],
  },
  {
    group: "Roast",
    tags: [
      "Espresso",
      "Coffee",
      "Dark chocolate",
      "Cocoa",
      "Roasted nuts",
      "Toast",
      "Char",
    ],
  },
  {
    group: "Cream & Nut",
    tags: ["Cream", "Butter", "Almond", "Cashew", "Peanut", "Hazelnut"],
  },
  {
    group: "Fruit",
    tags: ["Raisin", "Cherry", "Citrus", "Orange peel", "Dried fruit", "Fig", "Plum"],
  },
  {
    group: "Floral & Herbal",
    tags: ["Floral", "Grass", "Mint", "Tea", "Herbal", "Eucalyptus"],
  },
  {
    group: "Other",
    tags: ["Leather", "Musk", "Mineral", "Salt", "Wine", "Whiskey", "Brine"],
  },
];

export const ALL_FLAVORS = FLAVOR_GROUPS.flatMap((g) => g.tags);

const LOOKUP = new Map(ALL_FLAVORS.map((t) => [t.toLowerCase(), t]));

/** Snaps a loose string (e.g. from the vision model) onto a canonical tag. */
export function canonicalFlavor(input: string): string | null {
  const key = input.trim().toLowerCase();
  if (!key) return null;
  const exact = LOOKUP.get(key);
  if (exact) return exact;
  for (const [lower, tag] of LOOKUP) {
    if (lower.includes(key) || key.includes(lower)) return tag;
  }
  return null;
}
