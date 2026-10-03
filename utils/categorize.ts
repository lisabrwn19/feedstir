// Keyword hints used to auto-sort a new recipe into a default folder. Purely
// a starting suggestion — the category picker stays fully editable, and once
// a user touches it directly this stops being applied.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Breakfast: [
    'pancake', 'waffle', 'omelet', 'omelette', 'oatmeal', 'granola', 'breakfast',
    'bacon', 'hash brown', 'french toast', 'cereal', 'muffin', 'bagel', 'frittata',
    'scrambled egg', 'breakfast burrito',
  ],
  Lunch: ['sandwich', 'wrap', 'panini', 'lunch', 'quesadilla', 'club sandwich'],
  Dinner: [
    'casserole', 'roast', 'steak', 'meatloaf', 'dinner', 'stir fry', 'stir-fry',
    'curry', 'chili', 'lasagna', 'enchilada', 'stew', 'pot pie', 'shepherd’s pie',
  ],
  Dessert: [
    'cake', 'cookie', 'brownie', 'pie', 'ice cream', 'pudding', 'cupcake', 'dessert',
    'tart', 'cheesecake', 'fudge', 'candy',
  ],
  Side: [
    'side dish', 'coleslaw', 'mashed potato', 'fries', 'rice pilaf', 'dinner roll',
    'biscuit', 'cornbread', 'roasted vegetable',
  ],
};

/**
 * Suggests default-category matches based on simple keyword hits in the
 * title and ingredient list. Returns an empty array when nothing matches —
 * callers should treat that as "no suggestion," not "uncategorized forever."
 */
export function inferCategories({
  title,
  ingredients,
}: {
  title: string;
  ingredients: string[];
}): string[] {
  const haystack = `${title} ${ingredients.join(' ')}`.toLowerCase();
  if (!haystack.trim()) return [];

  return Object.entries(CATEGORY_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => haystack.includes(keyword)))
    .map(([category]) => category);
}
