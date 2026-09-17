/** One recipe ingredient/modification line (or a manual entry) contributing to a merged grocery item. */
export type GrocerySource = {
  /** Absent for items added manually (not sourced from a recipe ingredient). */
  recipeId?: string;
  recipeTitle?: string;
  /** The original ingredient text as written on the recipe, e.g. "1/4 cup basil". */
  originalText: string;
};

export type GroceryItem = {
  id: string;
  /** Clean, quantity-stripped display name, e.g. "Basil" — shared by every source below. */
  text: string;
  checked: boolean;
  addedBy: string;
  sources: GrocerySource[];
};

/**
 * A menu — just a named, numbered slot of recipes, not tied to weeks or any
 * other calendar cadence. Index 0 is always the one you're actively cooking
 * from (the only one eligible for the Complete flow); `startNextMenu`
 * shifts everything down a slot when you're ready to move on. Dates are
 * entirely optional — a menu works fine with neither, and only shows up on
 * the calendar view once one is set.
 */
export type Menu = {
  recipeIds: string[];
  /** Optional custom name, e.g. "Thanksgiving". Falls back to a positional label ("Menu 1", "Menu 2", ...) when unset. */
  name?: string;
  /** YYYY-MM-DD, inclusive. */
  startDate?: string;
  /** YYYY-MM-DD, inclusive — defaults to `startDate` (a single day) when unset. */
  endDate?: string;
};

export type GroceryInvite = {
  id: string;
  listOwnerId: string;
  listOwnerEmail: string;
  invitedEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
};
