// Extracts a structured {amount, unit, rest} out of a free-text ingredient
// line, e.g. "1 1/2 cups flour" -> { amount: 1.5, unit: 'cups', rest: 'flour' }.
// Used by unit conversion — ranges ("2-3 cups") and unitless lines ("3
// eggs", "Salt to taste") deliberately return undefined rather than guess.

const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

const NUMBER_TOKEN = `(?:[0-9]+\\s*\\/\\s*[0-9]+|[0-9]*\\.[0-9]+|[0-9]+|[${Object.keys(UNICODE_FRACTIONS).join('')}])`;
// A whole number optionally followed by a fraction ("1 1/2"), then a
// required space before whatever comes next (the unit).
const LEADING_AMOUNT = new RegExp(`^(${NUMBER_TOKEN})(?:\\s+(${NUMBER_TOKEN}))?\\s+`);

export type ParsedIngredientAmount = {
  amount: number;
  /** Canonical key into `UNIT_DEFS` (utils/unit-conversion.ts), e.g. "cup", "g". */
  unit: string;
  /** Whatever follows the amount+unit, e.g. "flour". */
  rest: string;
};

function parseNumberToken(token: string): number | undefined {
  const trimmed = token.trim();
  if (trimmed in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[trimmed];
  if (trimmed.includes('/')) {
    const [num, denom] = trimmed.split('/').map((s) => parseFloat(s.trim()));
    return Number.isFinite(num) && Number.isFinite(denom) && denom !== 0 ? num / denom : undefined;
  }
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function matchLeadingAmount(text: string): { amount: number; consumed: number } | undefined {
  const match = text.match(LEADING_AMOUNT);
  if (!match) return undefined;
  const whole = parseNumberToken(match[1]);
  if (whole === undefined) return undefined;
  let amount = whole;
  if (match[2] !== undefined) {
    const frac = parseNumberToken(match[2]);
    if (frac === undefined) return undefined;
    amount += frac;
  }
  return { amount, consumed: match[0].length };
}

// Longest-key-first so a plural/longer form never gets shadowed by a
// shorter prefix (not that `\b` word-boundary matching below would allow
// that anyway, but it keeps intent obvious).
function matchLeadingUnit(
  text: string,
  unitNames: string[]
): { unit: string; consumed: number } | undefined {
  for (const name of unitNames) {
    const match = text.match(new RegExp(`^${name}\\.?\\b`, 'i'));
    if (match) return { unit: name, consumed: match[0].length };
  }
  return undefined;
}

export function parseIngredientAmount(
  raw: string,
  unitNames: string[]
): ParsedIngredientAmount | undefined {
  const text = raw.trim();
  const amountMatch = matchLeadingAmount(text);
  if (!amountMatch) return undefined;

  const afterAmount = text.slice(amountMatch.consumed);
  const unitMatch = matchLeadingUnit(afterAmount, unitNames);
  if (!unitMatch) return undefined;

  const rest = afterAmount
    .slice(unitMatch.consumed)
    .replace(/^\.?\s+/, '')
    .replace(/^of\s+/i, '')
    .trim();

  return { amount: amountMatch.amount, unit: unitMatch.unit.toLowerCase(), rest };
}
