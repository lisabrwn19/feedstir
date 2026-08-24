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

export type GroceryInvite = {
  id: string;
  listOwnerId: string;
  listOwnerEmail: string;
  invitedEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
};
