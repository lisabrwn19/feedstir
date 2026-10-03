/**
 * Always-shown starter categories — folders appear for these on the Recipes
 * tab even with zero recipes tagged, so there's an obvious place to start
 * organizing. Users can tag recipes with any other custom category too;
 * those get their own folder as soon as a recipe uses them.
 */
export const DEFAULT_CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Side'];

const CATEGORY_EMOJI: Record<string, string> = {
  Favorites: '❤️',
  Breakfast: '🍳',
  Lunch: '🥪',
  Dinner: '🍽️',
  Dessert: '🍰',
  Side: '🥗',
};

const CUSTOM_CATEGORY_EMOJI = '📁';

export function categoryEmoji(name: string): string {
  return CATEGORY_EMOJI[name] ?? CUSTOM_CATEGORY_EMOJI;
}
