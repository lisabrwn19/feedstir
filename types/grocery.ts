export type GroceryItem = {
  id: string;
  text: string;
  checked: boolean;
  /** Absent for items added manually (not sourced from a recipe ingredient). */
  recipeId?: string;
  recipeTitle?: string;
  addedBy: string;
};

export type GroceryInvite = {
  id: string;
  listOwnerId: string;
  listOwnerEmail: string;
  invitedEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
};
