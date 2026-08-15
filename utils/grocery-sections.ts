export const GROCERY_SECTIONS = [
  'Produce',
  'Dairy & Eggs',
  'Meat & Seafood',
  'Bakery',
  'Pantry',
  'Other',
  'Frozen',
] as const;

export type GrocerySection = (typeof GROCERY_SECTIONS)[number];

type CategorizedSection = Exclude<GrocerySection, 'Other'>;

const SECTION_KEYWORDS: Record<CategorizedSection, string[]> = {
  Produce: [
    'lettuce', 'spinach', 'kale', 'arugula', 'cabbage', 'tomato', 'onion', 'garlic',
    'potato', 'carrot', 'celery', 'cucumber', 'zucchini', 'squash', 'pepper', 'jalapeno',
    'avocado', 'lemon', 'lime', 'orange', 'apple', 'banana', 'berry', 'berries', 'grape',
    'melon', 'mushroom', 'broccoli', 'cauliflower', 'corn', 'cilantro', 'parsley', 'basil',
    'mint', 'dill', 'thyme', 'rosemary', 'scallion', 'shallot', 'ginger', 'herb', 'fruit',
    'vegetable', 'greens', 'romaine', 'radish', 'beet', 'asparagus', 'leek', 'sprout',
  ],
  'Dairy & Eggs': [
    'milk', 'cream', 'half and half', 'half-and-half', 'butter', 'cheese', 'feta',
    'mozzarella', 'parmesan', 'cheddar', 'ricotta', 'yogurt', 'egg', 'sour cream',
    'buttermilk', 'cottage cheese',
  ],
  'Meat & Seafood': [
    'chicken', 'beef', 'pork', 'turkey', 'lamb', 'bacon', 'sausage', 'ham', 'steak',
    'fish', 'salmon', 'shrimp', 'tuna', 'cod', 'tilapia', 'crab', 'scallop', 'meat',
    'seafood', 'mince',
  ],
  Bakery: [
    'bread', 'bun', 'roll', 'bagel', 'tortilla', 'pita', 'baguette', 'croissant',
    'dough', 'crust', 'naan',
  ],
  Pantry: [
    'flour', 'sugar', 'salt', 'black pepper', 'oil', 'vinegar', 'rice', 'pasta',
    'noodle', 'bean', 'lentil', 'chickpea', 'broth', 'stock', 'ketchup', 'mustard',
    'mayo', 'honey', 'syrup', 'vanilla', 'baking soda', 'baking powder', 'cornstarch',
    'cornmeal', 'yeast', 'spice', 'cumin', 'paprika', 'cinnamon', 'nutmeg', 'oregano',
    'chili powder', 'canned', 'tomato paste', 'tomato sauce', 'coconut milk',
    'chocolate', 'almond', 'walnut', 'pecan', 'peanut', 'cashew', 'oat', 'cereal',
    'chip', 'cracker', 'olive', 'caper', 'soy sauce', 'sesame oil', 'breadcrumb', 'panko',
  ],
  Frozen: ['frozen', 'ice cream', 'popsicle'],
};

export function categorizeIngredient(text: string): GrocerySection {
  const normalized = text.toLowerCase();

  // The longest matching keyword wins, so a more specific phrase (e.g.
  // "black pepper", "ice cream") beats a shorter generic word from another
  // section that happens to also appear as a substring (e.g. "pepper", "cream").
  let best: { section: CategorizedSection; length: number } | null = null;
  for (const section of GROCERY_SECTIONS) {
    if (section === 'Other') continue;
    for (const keyword of SECTION_KEYWORDS[section]) {
      if (normalized.includes(keyword) && (!best || keyword.length > best.length)) {
        best = { section, length: keyword.length };
      }
    }
  }

  return best ? best.section : 'Other';
}
