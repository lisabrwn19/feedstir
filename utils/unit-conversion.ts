import { parseIngredientAmount } from '@/utils/parse-ingredient-amount';

export type UnitSystem = 'us' | 'metric';

type UnitKind = 'weight' | 'volume';

type UnitDef = {
  kind: UnitKind;
  system: UnitSystem;
  /** Multiplier to the base unit: grams for weight, milliliters for volume. */
  toBase: number;
};

// Keys are matched case-insensitively against the word right after a
// leading amount (see parse-ingredient-amount.ts) — plural/abbreviated
// forms are separate keys rather than a single regex, since `\b` matching
// already keeps "g" from false-matching "garlic" etc.
const UNIT_DEFS: Record<string, UnitDef> = {
  g: { kind: 'weight', system: 'metric', toBase: 1 },
  gram: { kind: 'weight', system: 'metric', toBase: 1 },
  grams: { kind: 'weight', system: 'metric', toBase: 1 },
  kg: { kind: 'weight', system: 'metric', toBase: 1000 },
  kilogram: { kind: 'weight', system: 'metric', toBase: 1000 },
  kilograms: { kind: 'weight', system: 'metric', toBase: 1000 },
  oz: { kind: 'weight', system: 'us', toBase: 28.3495 },
  ounce: { kind: 'weight', system: 'us', toBase: 28.3495 },
  ounces: { kind: 'weight', system: 'us', toBase: 28.3495 },
  lb: { kind: 'weight', system: 'us', toBase: 453.592 },
  lbs: { kind: 'weight', system: 'us', toBase: 453.592 },
  pound: { kind: 'weight', system: 'us', toBase: 453.592 },
  pounds: { kind: 'weight', system: 'us', toBase: 453.592 },
  ml: { kind: 'volume', system: 'metric', toBase: 1 },
  milliliter: { kind: 'volume', system: 'metric', toBase: 1 },
  milliliters: { kind: 'volume', system: 'metric', toBase: 1 },
  l: { kind: 'volume', system: 'metric', toBase: 1000 },
  liter: { kind: 'volume', system: 'metric', toBase: 1000 },
  liters: { kind: 'volume', system: 'metric', toBase: 1000 },
  litre: { kind: 'volume', system: 'metric', toBase: 1000 },
  litres: { kind: 'volume', system: 'metric', toBase: 1000 },
  cup: { kind: 'volume', system: 'us', toBase: 236.588 },
  cups: { kind: 'volume', system: 'us', toBase: 236.588 },
  tbsp: { kind: 'volume', system: 'us', toBase: 14.7868 },
  tablespoon: { kind: 'volume', system: 'us', toBase: 14.7868 },
  tablespoons: { kind: 'volume', system: 'us', toBase: 14.7868 },
  tsp: { kind: 'volume', system: 'us', toBase: 4.92892 },
  teaspoon: { kind: 'volume', system: 'us', toBase: 4.92892 },
  teaspoons: { kind: 'volume', system: 'us', toBase: 4.92892 },
};

const UNIT_NAMES = Object.keys(UNIT_DEFS);

// Grams per milliliter for common ingredients — needed only to cross
// between weight and volume (e.g. grams -> cups), which is inherently
// ingredient-specific and approximate. Same-type conversions (g<->oz,
// ml<->cup) never need this table and are always exact.
const DENSITY_G_PER_ML: Record<string, number> = {
  flour: 0.53,
  'all-purpose flour': 0.53,
  'bread flour': 0.54,
  'cake flour': 0.48,
  sugar: 0.85,
  'brown sugar': 0.93,
  'powdered sugar': 0.56,
  'confectioners sugar': 0.56,
  butter: 0.96,
  rice: 0.78,
  oats: 0.38,
  water: 1,
  milk: 1.03,
  cream: 1.01,
  honey: 1.42,
  'maple syrup': 1.37,
  oil: 0.92,
  salt: 1.2,
  cocoa: 0.5,
  'cocoa powder': 0.5,
};
const DENSITY_KEYS = Object.keys(DENSITY_G_PER_ML).sort((a, b) => b.length - a.length);

function findDensity(ingredientName: string): number | undefined {
  const normalized = ingredientName.toLowerCase();
  const key = DENSITY_KEYS.find((k) => normalized.includes(k));
  return key ? DENSITY_G_PER_ML[key] : undefined;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatWeightUS(grams: number): string {
  const oz = grams / 28.3495;
  if (oz < 16) return `${round(oz, 1)} oz`;
  return `${round(oz / 16, 2)} lb`;
}

function formatWeightMetric(grams: number): string {
  if (grams < 1000) return `${round(grams, 0)} g`;
  return `${round(grams / 1000, 2)} kg`;
}

function formatVolumeUS(ml: number): string {
  const cups = ml / 236.588;
  if (cups >= 0.25) return `${round(cups, 2)} cup${cups === 1 ? '' : 's'}`;
  const tbsp = ml / 14.7868;
  if (tbsp >= 1) return `${round(tbsp, 1)} tbsp`;
  return `${round(ml / 4.92892, 1)} tsp`;
}

function formatVolumeMetric(ml: number): string {
  if (ml < 1000) return `${round(ml, 0)} ml`;
  return `${round(ml / 1000, 2)} L`;
}

/**
 * Which unit system most of a recipe's convertible ingredient lines are
 * already written in — used to pick what the global toggle converts *to*
 * (the opposite system), without asking the user to pick a target.
 */
export function detectPredominantSystem(ingredients: string[]): UnitSystem {
  let usCount = 0;
  let metricCount = 0;
  for (const line of ingredients) {
    const parsed = parseIngredientAmount(line, UNIT_NAMES);
    const def = parsed && UNIT_DEFS[parsed.unit];
    if (!def) continue;
    if (def.system === 'us') usCount++;
    else metricCount++;
  }
  return metricCount > usCount ? 'metric' : 'us';
}

export type ConvertedAmount = {
  text: string;
  /** True when a weight<->volume density lookup was used — flag this as approximate in the UI. */
  approximate: boolean;
};

/**
 * Converts one ingredient line's amount to the target unit system, keeping
 * the rest of the line (the ingredient name) unchanged. Returns undefined
 * when the line has no recognizable amount+unit, or is already in the
 * target system (nothing to convert).
 */
export function convertIngredientLine(raw: string, target: UnitSystem): ConvertedAmount | undefined {
  const parsed = parseIngredientAmount(raw, UNIT_NAMES);
  if (!parsed) return undefined;
  const unitDef = UNIT_DEFS[parsed.unit];
  if (!unitDef || unitDef.system === target) return undefined;

  const baseAmount = parsed.amount * unitDef.toBase; // grams (weight) or ml (volume)
  const density = findDensity(parsed.rest);

  if (target === 'us') {
    if (unitDef.kind === 'weight') {
      if (density !== undefined) {
        return { text: `${formatVolumeUS(baseAmount / density)} ${parsed.rest}`, approximate: true };
      }
      return { text: `${formatWeightUS(baseAmount)} ${parsed.rest}`, approximate: false };
    }
    return { text: `${formatVolumeUS(baseAmount)} ${parsed.rest}`, approximate: false };
  }

  if (unitDef.kind === 'volume') {
    if (density !== undefined) {
      return { text: `${formatWeightMetric(baseAmount * density)} ${parsed.rest}`, approximate: true };
    }
    return { text: `${formatVolumeMetric(baseAmount)} ${parsed.rest}`, approximate: false };
  }
  return { text: `${formatWeightMetric(baseAmount)} ${parsed.rest}`, approximate: false };
}
