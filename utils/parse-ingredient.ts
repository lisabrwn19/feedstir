const UNICODE_FRACTIONS = '¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞';
const NUMBER = `(?:[0-9]+\\s*\\/\\s*[0-9]+|[0-9]*\\.[0-9]+|[0-9]+|[${UNICODE_FRACTIONS}])`;

// Matches a leading quantity: "2", "1/4", "1 1/2", "2-3", "¼", etc.
const QUANTITY_PATTERN = new RegExp(`^${NUMBER}(\\s*-\\s*${NUMBER})?(\\s+${NUMBER})?\\s+`);

const UNITS = [
  'cups?',
  'tablespoons?',
  'tbsps?\\.?',
  'teaspoons?',
  'tsps?\\.?',
  'ounces?',
  'oz\\.?',
  'pounds?',
  'lbs?\\.?',
  'grams?',
  'g\\.?',
  'kilograms?',
  'kgs?\\.?',
  'milliliters?',
  'mls?\\.?',
  'liters?',
  'litres?',
  'l\\.?',
  'cloves?',
  'pinch(?:es)?',
  'dash(?:es)?',
  'cans?',
  'jars?',
  'packages?',
  'pkgs?\\.?',
  'boxes?',
  'bags?',
  'slices?',
  'sticks?',
  'bunch(?:es)?',
  'heads?',
  'sprigs?',
  'quarts?',
  'qts?\\.?',
  'pints?',
  'pts?\\.?',
  'gallons?',
  'gals?\\.?',
  'stalks?',
  'strips?',
  'fillets?',
  'handfuls?',
  'large',
  'medium',
  'small',
];
const UNIT_PATTERN = new RegExp(`^(?:${UNITS.join('|')})\\s+`, 'i');

const OF_PATTERN = /^of\s+/i;

const DESCRIPTORS = [
  'fresh',
  'freshly',
  'chopped',
  'diced',
  'minced',
  'sliced',
  'grated',
  'shredded',
  'ground',
  'crushed',
  'dried',
  'peeled',
  'finely',
  'coarsely',
  'thinly',
  'roughly',
];

/**
 * Strips quantity/unit/prep-note noise from a recipe ingredient line down to
 * the plain item name, e.g. "1/4 cup chopped fresh basil" -> "basil". Used
 * both to display a clean grocery list line and to key ingredients so the
 * same item from different recipes merges into one row.
 */
export function parseIngredientName(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  // Drop parenthetical asides, e.g. "flour (all-purpose)" -> "flour".
  text = text.replace(/\([^)]*\)/g, ' ');

  // Drop everything from the first comma on — prep notes like ", chopped".
  const commaIndex = text.indexOf(',');
  if (commaIndex !== -1) text = text.slice(0, commaIndex);

  text = text.trim();
  // "a pinch of salt" / "an onion" — treat a leading article like a "1".
  text = text.replace(/^(a|an)\s+/i, '');
  text = text.replace(QUANTITY_PATTERN, '');
  text = text.replace(UNIT_PATTERN, '');
  text = text.replace(OF_PATTERN, '');

  let changed = true;
  while (changed) {
    changed = false;
    for (const descriptor of DESCRIPTORS) {
      const pattern = new RegExp(`^${descriptor}\\s+`, 'i');
      if (pattern.test(text)) {
        text = text.replace(pattern, '');
        changed = true;
      }
    }
  }

  text = text.trim().replace(/\s+/g, ' ');
  return text || raw.trim();
}

/** Lowercased key used to match/merge ingredients across recipes. */
export function normalizeIngredientKey(raw: string): string {
  return parseIngredientName(raw).toLowerCase();
}

/** Clean, capitalized display name for a grocery list row. */
export function displayIngredientName(raw: string): string {
  const parsed = parseIngredientName(raw);
  return parsed ? parsed[0].toUpperCase() + parsed.slice(1) : parsed;
}
