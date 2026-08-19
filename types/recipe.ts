export type Recipe = {
  id: string;
  ownerId: string;
  title: string;
  ingredients: string[];
  instructions: string[];
  /** Extra ingredients the owner has noted for this recipe, kept separate from the original ingredient list. */
  modifications: string[];
  photoUri?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  sourceUrl?: string;
  createdAt: number;
  timesMade: number;
  lastMadeAt?: number;
  /** 1-5 stars, undefined = unrated. 1 = never make this again, 5 = could eat this every day. */
  rating?: number;
  difficulty?: 'easy' | 'moderate' | 'hard';
  /**
   * uid of the grocery list (its owner's uid) this recipe is currently
   * queued on, if any. Firestore rules grant read access to any current
   * member of that list, checked live — so this only needs to be set once
   * at queue-time, not kept in sync as list membership changes later.
   */
  queuedOnListId: string | null;
};

export type NewRecipeInput = Omit<
  Recipe,
  | 'id'
  | 'ownerId'
  | 'createdAt'
  | 'timesMade'
  | 'lastMadeAt'
  | 'rating'
  | 'difficulty'
  | 'modifications'
  | 'queuedOnListId'
>;
